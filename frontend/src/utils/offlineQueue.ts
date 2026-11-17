export interface OfflineAction {
  id: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  url: string;
  payload?: unknown;
  createdAt: string;
}

const OFFLINE_QUEUE_KEY = 'eparnio-offline-queue';

export function getOfflineQueue(): OfflineAction[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineAction[]) : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineAction(
  action: Omit<OfflineAction, 'id' | 'createdAt'>
): OfflineAction {
  const nextItem: OfflineAction = {
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString()
  };
  const current = getOfflineQueue();
  current.push(nextItem);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(current));
  }
  return nextItem;
}

export function removeOfflineAction(id: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  const filtered = getOfflineQueue().filter((item) => item.id !== id);
  window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
}

export function clearOfflineQueue(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(OFFLINE_QUEUE_KEY);
  }
}
