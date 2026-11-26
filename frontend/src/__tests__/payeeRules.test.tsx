import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PayeeRulesSheet } from '../features/budget/PayeeRulesSheet';
import { apiClient } from '../services/api';
import {
  applyPayeeRules,
  extractSuggestedPattern,
  type PayeeRule
} from '../utils/applyPayeeRules';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Payee Rules — Moteur pur & UI (Étape 54)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('évalue les règles par ordre de priorité, gère accents NFD, autoExcludeFromImport et extractSuggestedPattern', () => {
    expect(extractSuggestedPattern('CB MONOPRIX 14/11 75011')).toBe('MONOPRIX');
    expect(extractSuggestedPattern('PRLV SEPA NETFLIX')).toBe('NETFLIX');

    const rules: PayeeRule[] = [
      {
        id: 'r1',
        budgetId: 'b1',
        pattern: 'virement interne',
        matchType: 'contains',
        transactionType: 'all',
        addTags: [],
        autoExcludeFromImport: true,
        isActive: true,
        order: 0
      },
      {
        id: 'r2',
        budgetId: 'b1',
        pattern: 'carrefour',
        matchType: 'contains',
        transactionType: 'expense',
        targetEnvelopeName: 'Courses',
        renameLabel: 'Carrefour',
        addTags: ['alimentation'],
        autoExcludeFromImport: false,
        isActive: true,
        order: 1
      }
    ];

    const envelopes = [{ id: 'env-1', name: 'Coursés' }];

    const matchCarrefour = applyPayeeRules('CB CARREFOUR MARKET 12/05', 'expense', rules, envelopes);
    expect(matchCarrefour?.resolvedEnvelopeId).toBe('env-1');
    expect(matchCarrefour?.renameLabel).toBe('Carrefour');
    expect(matchCarrefour?.addTags).toEqual(['alimentation']);
    expect(matchCarrefour?.autoExcludeFromImport).toBe(false);

    const matchExclude = applyPayeeRules('VIREMENT INTERNE LIVRET A', 'expense', rules, envelopes);
    expect(matchExclude?.autoExcludeFromImport).toBe(true);
  });

  it('affiche les règles, permet de tester un libellé en direct et de créer une nouvelle règle', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        status: 'ok',
        rules: [
          {
            id: 'r1',
            budgetId: 'b1',
            pattern: 'CARREFOUR',
            matchType: 'contains',
            transactionType: 'all',
            targetEnvelopeName: 'Courses',
            renameLabel: 'Carrefour',
            addTags: ['alimentation'],
            autoExcludeFromImport: false,
            isActive: true,
            order: 0
          }
        ]
      }
    });

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        status: 'ok',
        rule: {
          id: 'r2',
          budgetId: 'b1',
          pattern: 'NETFLIX',
          matchType: 'contains',
          transactionType: 'all',
          targetEnvelopeName: 'Loisirs',
          addTags: [],
          autoExcludeFromImport: false,
          isActive: true,
          order: 1
        }
      }
    });

    renderWithQueryClient(<PayeeRulesSheet isOpen={true} onClose={vi.fn()} budgetId="b1" />);

    await waitFor(() => {
      expect(screen.getByText(/« CARREFOUR »/)).toBeInTheDocument();
    });

    // Testeur en direct
    fireEvent.change(screen.getByLabelText(/Tester un libellé en direct/i), {
      target: { value: 'CB CARREFOUR MARKET' }
    });
    expect(screen.getByText(/Courses · « Carrefour » · #alimentation/i)).toBeInTheDocument();

    // Création d'une règle
    fireEvent.click(screen.getByRole('button', { name: /Nouvelle règle/i }));
    fireEvent.change(screen.getByLabelText(/Texte à rechercher/i), {
      target: { value: 'NETFLIX' }
    });
    fireEvent.change(screen.getByLabelText(/Enveloppe cible/i), {
      target: { value: 'Loisirs' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        '/budgets/b1/payee-rules',
        expect.objectContaining({ pattern: 'NETFLIX', targetEnvelopeName: 'Loisirs' })
      );
    });
  });
});
