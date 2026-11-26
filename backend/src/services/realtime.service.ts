import type { Response } from 'express';
import { BudgetModel } from '../models/Budget.model';
import { UserModel } from '../models/User.model';
import { sendPushToUser } from './pushNotification.service';

export interface RealtimeBudgetEventPayload {
  type: string;
  budgetId: string;
  periodId?: string;
  actorUserId: string;
  actorName: string;
  summary: string;
  invalidateKeys: string[];
  timestamp: string;
}

interface RealtimeClient {
  id: string;
  userId: string;
  budgetId: string;
  res: Response;
  heartbeatTimer: ReturnType<typeof setInterval>;
}

const MAX_CONNECTIONS_PER_USER = 5;
const HEARTBEAT_INTERVAL_MS = 25_000;

const clientsByBudget = new Map<string, Set<RealtimeClient>>();
let clientSeq = 0;

function countUserConnections(userId: string): number {
  let count = 0;
  for (const clients of clientsByBudget.values()) {
    for (const c of clients) {
      if (c.userId === userId) count += 1;
    }
  }
  return count;
}

function removeClient(client: RealtimeClient): void {
  clearInterval(client.heartbeatTimer);
  const set = clientsByBudget.get(client.budgetId);
  if (set) {
    set.delete(client);
    if (set.size === 0) {
      clientsByBudget.delete(client.budgetId);
    }
  }
}

/**
 * Configure la réponse HTTP en flux SSE compatible Render / Cloudflare / Nginx
 * et enregistre le client pour recevoir les mises à jour en temps réel du budget.
 */
export function registerRealtimeClient(
  budgetId: string,
  userId: string,
  res: Response
): () => void {
  // Limite de sécurité par utilisateur : ferme la plus ancienne si dépassement
  if (countUserConnections(userId) >= MAX_CONNECTIONS_PER_USER) {
    for (const set of clientsByBudget.values()) {
      for (const existing of set) {
        if (existing.userId === userId) {
          removeClient(existing);
          try {
            existing.res.end();
          } catch {
            // ignore
          }
          break;
        }
      }
      if (countUserConnections(userId) < MAX_CONNECTIONS_PER_USER) break;
    }
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write(`event: connected\ndata: ${JSON.stringify({ budgetId, connectedAt: new Date().toISOString() })}\n\n`);

  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      removeClient(client);
    }
  }, HEARTBEAT_INTERVAL_MS);
  if (typeof heartbeatTimer.unref === 'function') {
    heartbeatTimer.unref();
  }

  const client: RealtimeClient = {
    id: `sse-${++clientSeq}`,
    userId,
    budgetId,
    res,
    heartbeatTimer
  };

  let set = clientsByBudget.get(budgetId);
  if (!set) {
    set = new Set<RealtimeClient>();
    clientsByBudget.set(budgetId, set);
  }
  set.add(client);

  return () => {
    removeClient(client);
  };
}

/**
 * Diffuse un événement temps réel à tous les clients connectés sur ce budget.
 */
export function emitBudgetEvent(
  budgetId: string,
  payload: Omit<RealtimeBudgetEventPayload, 'budgetId' | 'timestamp'>
): number {
  const clients = clientsByBudget.get(budgetId);
  if (!clients || clients.size === 0) {
    return 0;
  }

  const fullPayload: RealtimeBudgetEventPayload = {
    ...payload,
    budgetId,
    timestamp: new Date().toISOString()
  };

  const frame = `event: budget_update\ndata: ${JSON.stringify(fullPayload)}\n\n`;
  let delivered = 0;

  for (const client of Array.from(clients)) {
    try {
      client.res.write(frame);
      delivered += 1;
    } catch {
      removeClient(client);
    }
  }

  return delivered;
}

/**
 * Ferme immédiatement toutes les connexions SSE d'un utilisateur sur un budget
 * (ex. lors du retrait d'un membre).
 */
export function disconnectUserFromBudget(budgetId: string, userId: string): number {
  const clients = clientsByBudget.get(budgetId);
  if (!clients) return 0;

  let closed = 0;
  for (const client of Array.from(clients)) {
    if (client.userId === userId) {
      removeClient(client);
      try {
        client.res.end();
      } catch {
        // ignore
      }
      closed += 1;
    }
  }
  return closed;
}

/**
 * Envoie une notification Web Push (fire-and-forget) aux autres membres d'un budget partagé
 * ayant activé `sharedActivityAlertEnabled` (activé par défaut).
 */
export async function notifySharedBudgetActivity(params: {
  budgetId: string;
  actorUserId: string;
  summary: string;
  url?: string;
}): Promise<number> {
  const { budgetId, actorUserId, summary, url = '/' } = params;
  const budget = await BudgetModel.findById(budgetId).select('type name ownerId members');
  if (!budget || budget.type !== 'shared') {
    return 0;
  }

  const recipientIds = new Set<string>();
  if (budget.ownerId.toString() !== actorUserId) {
    recipientIds.add(budget.ownerId.toString());
  }
  for (const member of budget.members) {
    const id = member.userId.toString();
    if (id !== actorUserId) {
      recipientIds.add(id);
    }
  }

  if (recipientIds.size === 0) {
    return 0;
  }

  const users = await UserModel.find({ _id: { $in: Array.from(recipientIds) } }).select(
    'notificationPreferences'
  );

  let sentTotal = 0;
  for (const user of users) {
    const enabled = user.notificationPreferences?.sharedActivityAlertEnabled ?? true;
    if (!enabled) continue;
    const result = await sendPushToUser(user._id.toString(), {
      title: `Eparnio · ${budget.name}`,
      body: summary,
      url
    });
    sentTotal += result.sent;
  }

  return sentTotal;
}

/**
 * Helper non bloquant combinant émission SSE (tous budgets) et notification Push (budgets partagés).
 */
export function emitBudgetActivity(params: {
  budgetId: string;
  periodId?: string;
  type: string;
  actorUserId: string;
  actorName: string;
  summary: string;
  invalidateKeys: string[];
  url?: string;
}): void {
  emitBudgetEvent(params.budgetId, {
    type: params.type,
    ...(params.periodId ? { periodId: params.periodId } : {}),
    actorUserId: params.actorUserId,
    actorName: params.actorName,
    summary: params.summary,
    invalidateKeys: params.invalidateKeys
  });

  void notifySharedBudgetActivity({
    budgetId: params.budgetId,
    actorUserId: params.actorUserId,
    summary: params.summary,
    url: params.url
  }).catch(() => {
    // Fire-and-forget : ne jamais impacter la requête API principale
  });
}

/**
 * Réinitialise les connexions actives en mémoire (utile en tests).
 */
export function resetRealtimeClientsForTests(): void {
  for (const set of clientsByBudget.values()) {
    for (const client of set) {
      clearInterval(client.heartbeatTimer);
    }
  }
  clientsByBudget.clear();
}
