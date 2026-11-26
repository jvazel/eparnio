import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RealtimeToast } from '../components/ui/RealtimeToast';
import {
  parseSseChunks,
  useBudgetRealtimeSync,
  type RealtimeBudgetEvent
} from '../hooks/useBudgetRealtimeSync';

function TestSyncHarness({
  budgetId,
  token,
  currentUserId,
  onExternalActivity
}: {
  budgetId: string | null;
  token: string | null;
  currentUserId: string | null;
  onExternalActivity: (evt: RealtimeBudgetEvent) => void;
}) {
  useBudgetRealtimeSync({ budgetId, token, currentUserId, onExternalActivity });
  return <div>sync-harness</div>;
}

describe('useBudgetRealtimeSync & RealtimeToast (Étape 53)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parse correctement les trames SSE budget_update et ignore les heartbeats', () => {
    const raw =
      ': ping\n\nevent: budget_update\ndata: {"type":"transaction:created","budgetId":"b1","actorUserId":"u2","actorName":"Alex","summary":"Alex a ajouté 38 €","invalidateKeys":["period"],"timestamp":"2026-01-01T00:00:00Z"}\n\n';
    const { events, remainder } = parseSseChunks(raw);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Alex a ajouté 38 €');
    expect(remainder).toBe('');
  });

  it('invalide TanStack Query et notifie uniquement pour un autre membre via ReadableStream', async () => {
    const encoder = new TextEncoder();
    const ssePayload =
      'event: budget_update\ndata: {"type":"transaction:created","budgetId":"b1","actorUserId":"u-partner","actorName":"Alex","summary":"Alex a ajouté 38,00 € dans Courses","invalidateKeys":["period","envelopes"],"timestamp":"2026-01-01T00:00:00Z"}\n\n';

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload));
        controller.close();
      }
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      })
    );

    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const onExternal = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <TestSyncHarness
          budgetId="b1"
          token="jwt-token"
          currentUserId="u-me"
          onExternalActivity={onExternal}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(onExternal).toHaveBeenCalledTimes(1);
    });
    expect(onExternal).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'Alex a ajouté 38,00 € dans Courses' })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['period'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['envelopes'] });
  });

  it('affiche RealtimeToast et le masque à la fermeture', () => {
    const onDismiss = vi.fn();
    render(
      <RealtimeToast
        message="Alex a ajouté 38,00 € dans Courses"
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Alex a ajouté 38,00 € dans Courses');

    act(() => {
      screen.getByRole('button', { name: /Fermer la notification en direct/i }).click();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
