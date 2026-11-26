import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { apiClient } from '../services/api';

export interface RealtimeBudgetEvent {
  type: string;
  budgetId: string;
  periodId?: string;
  actorUserId: string;
  actorName: string;
  summary: string;
  invalidateKeys: string[];
  timestamp: string;
}

export interface UseBudgetRealtimeSyncOptions {
  budgetId: string | null;
  token: string | null;
  currentUserId: string | null;
  enabled?: boolean;
  onExternalActivity?: (event: RealtimeBudgetEvent) => void;
}

/**
 * Parse un buffer SSE brut et retourne les événements `budget_update` complets + le reliquat.
 */
export function parseSseChunks(buffer: string): {
  events: RealtimeBudgetEvent[];
  remainder: string;
} {
  const blocks = buffer.split('\n\n');
  const remainder = blocks.pop() ?? '';
  const events: RealtimeBudgetEvent[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    let eventName = '';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (eventName === 'budget_update' && dataLines.length > 0) {
      try {
        const parsed = JSON.parse(dataLines.join('\n')) as RealtimeBudgetEvent;
        if (parsed && typeof parsed.summary === 'string') {
          events.push(parsed);
        }
      } catch {
        // Ignorer les trames JSON malformées
      }
    }
  }

  return { events, remainder };
}

/**
 * Hook de synchronisation temps réel (SSE via fetch + ReadableStream)
 * compatible Render / mobile (backoff exponentiel, pause sur visibilitychange, reprise sur online).
 */
export function useBudgetRealtimeSync({
  budgetId,
  token,
  currentUserId,
  enabled = true,
  onExternalActivity
}: UseBudgetRealtimeSyncOptions): void {
  const queryClient = useQueryClient();
  const onExternalRef = useRef(onExternalActivity);
  onExternalRef.current = onExternalActivity;

  useEffect(() => {
    if (!enabled || !budgetId || !token) return;

    let cancelled = false;
    let retryDelayMs = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let activeController: AbortController | null = null;

    const baseUrl = (apiClient.defaults.baseURL ?? '/api').replace(/\/$/, '');
    const streamUrl = `${baseUrl}/budgets/${budgetId}/events`;

    const clearRetry = () => {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const disconnect = () => {
      clearRetry();
      if (activeController) {
        activeController.abort();
        activeController = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      clearRetry();
      const delay = retryDelayMs;
      retryDelayMs = Math.min(retryDelayMs * 2, 30_000);
      retryTimer = setTimeout(() => {
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      disconnect();

      const controller = new AbortController();
      activeController = controller;

      try {
        const response = await fetch(streamUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream'
          },
          signal: controller.signal
        });

        if (!response.ok || !response.body) {
          scheduleReconnect();
          return;
        }

        retryDelayMs = 1000;
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, remainder } = parseSseChunks(buffer);
          buffer = remainder;

          for (const evt of events) {
            for (const key of evt.invalidateKeys ?? []) {
              void queryClient.invalidateQueries({ queryKey: [key] });
            }
            if (evt.actorUserId && evt.actorUserId !== currentUserId) {
              onExternalRef.current?.(evt);
            }
          }
        }

        scheduleReconnect();
      } catch {
        if (!controller.signal.aborted) {
          scheduleReconnect();
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        disconnect();
      } else {
        retryDelayMs = 1000;
        void queryClient.invalidateQueries({ queryKey: ['period'] });
        void queryClient.invalidateQueries({ queryKey: ['envelopes'] });
        void queryClient.invalidateQueries({ queryKey: ['analytics'] });
        void connect();
      }
    };

    const handleOnline = () => {
      retryDelayMs = 1000;
      void connect();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    void connect();

    return () => {
      cancelled = true;
      disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [budgetId, token, currentUserId, enabled, queryClient]);
}
