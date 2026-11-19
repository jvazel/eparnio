import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalSearchModal } from '../features/budget/GlobalSearchModal';
import * as searchService from '../services/search.service';

describe('GlobalSearchModal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('affiche les résultats groupés par mois et déclenche onSelectResult au clic', async () => {
    const searchSpy = vi.spyOn(searchService, 'searchBudgetItems').mockResolvedValue({
      totalCount: 1,
      items: [
        {
          id: 'tx-1',
          kind: 'transaction',
          title: 'Achat Casque Audio',
          notes: 'Garantie 2 ans',
          amount: 129.9,
          date: '2026-07-14T12:00:00.000Z',
          periodId: 'p-1',
          month: 7,
          year: 2026,
          envelopeId: 'env-1',
          envelopeName: 'Loisirs',
          envelopeIcon: '🎧',
          envelopeColor: '#8B5CF6'
        }
      ]
    });

    const onSelectResult = vi.fn();
    const onClose = vi.fn();

    render(
      <GlobalSearchModal
        isOpen
        budgetId="budget-1"
        onClose={onClose}
        onSelectResult={onSelectResult}
      />
    );

    const input = screen.getByLabelText('Rechercher un libellé, une note ou un montant');
    fireEvent.change(input, { target: { value: 'Garantie' } });

    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith('budget-1', {
        q: 'Garantie',
        type: 'all',
        limit: 30
      });
    });

    expect(await screen.findByText('Juillet 2026')).toBeInTheDocument();
    expect(screen.getByText('Achat Casque Audio')).toBeInTheDocument();
    expect(screen.getByText('« Garantie 2 ans »')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Achat Casque Audio'));
    expect(onSelectResult).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
