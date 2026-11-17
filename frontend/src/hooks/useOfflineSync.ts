import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../services/api';
import { getOfflineQueue, removeOfflineAction } from '../utils/offlineQueue';

/**
 * Hook gérant la détection réseau (online/offline) et la synchronisation
 * automatique de la file d'attente hors-ligne dès le retour de la connexion.
 */
export function useOfflineSync() {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(() => getOfflineQueue().length);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshCount = useCallback(() => {
    setPendingCount(getOfflineQueue().length);
  }, []);

  const syncQueue = useCallback(async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      refreshCount();
      return;
    }

    setIsSyncing(true);
    try {
      for (const action of queue) {
        await apiClient.request({
          method: action.method,
          url: action.url,
          data: action.payload
        });
        removeOfflineAction(action.id);
      }
      await queryClient.invalidateQueries();
    } finally {
      refreshCount();
      setIsSyncing(false);
    }
  }, [queryClient, refreshCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void syncQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshCount, syncQueue]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    syncQueue,
    refreshCount
  };
}
