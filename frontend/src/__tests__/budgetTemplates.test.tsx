import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BudgetTemplatesSheet } from '../features/budget/BudgetTemplatesSheet';
import { apiClient } from '../services/api';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('BudgetTemplatesSheet (Étape 52)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche l’état vide puis permet de capturer le mois actif en scénario', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: { status: 'ok', templates: [] }
    });
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        status: 'ok',
        template: {
          id: 'tpl-1',
          budgetId: 'budget-1',
          name: 'Mois Normal',
          icon: '🌿',
          color: '#7C3AED',
          items: [],
          totalVariableAmount: 400,
          totalSavingsAmount: 200,
          totalAllocatedAmount: 600,
          createdBy: 'u1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      }
    });

    renderWithQueryClient(
      <BudgetTemplatesSheet
        isOpen={true}
        onClose={vi.fn()}
        budgetId="budget-1"
        activePeriodId="period-1"
        activePeriodLabel="Mai 2026"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Aucun scénario enregistré/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer ce mois comme scénario/i }));
    fireEvent.change(screen.getByLabelText(/Nom du scénario/i), {
      target: { value: 'Mois Normal' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        '/budgets/budget-1/templates',
        expect.objectContaining({ name: 'Mois Normal', sourcePeriodId: 'period-1' })
      );
    });
  });

  it('affiche l’aperçu Avant/Après (mise à 0 € + alerte dépassement) et applique le scénario', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        status: 'ok',
        templates: [
          {
            id: 'tpl-2',
            budgetId: 'budget-1',
            name: 'Mois Serré',
            icon: '❄️',
            color: '#3B82F6',
            items: [
              {
                pillar: 'variable_envelope',
                name: 'Courses',
                icon: '🛒',
                color: '#22C55E',
                allocatedAmount: 250
              }
            ],
            totalVariableAmount: 250,
            totalSavingsAmount: 0,
            totalAllocatedAmount: 250,
            createdBy: 'u1',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z'
          }
        ]
      }
    });

    const postSpy = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValueOnce({
        data: {
          status: 'ok',
          dryRun: true,
          template: {
            id: 'tpl-2',
            name: 'Mois Serré'
          },
          changes: [
            {
              pillar: 'variable_envelope',
              name: 'Courses',
              icon: '🛒',
              color: '#22C55E',
              status: 'updated',
              previousAmount: 400,
              newAmount: 250,
              deltaAmount: -150,
              spentOrPaidAmount: 300,
              exceedsSpent: true,
              resetToZero: false
            },
            {
              pillar: 'variable_envelope',
              name: 'Sorties',
              icon: '🍽️',
              color: '#F59E0B',
              status: 'reset_to_zero',
              previousAmount: 150,
              newAmount: 0,
              deltaAmount: -150,
              spentOrPaidAmount: 0,
              exceedsSpent: false,
              resetToZero: true
            }
          ],
          summaryBefore: {
            plannedIncome: 2000,
            plannedFixedCharges: 800,
            plannedEnvelopes: 550,
            plannedSavings: 200,
            spentVariables: 300,
            remainingToAllocate: 450,
            remainingToLive: 700
          },
          summaryAfter: {
            plannedIncome: 2000,
            plannedFixedCharges: 800,
            plannedEnvelopes: 250,
            plannedSavings: 200,
            spentVariables: 300,
            remainingToAllocate: 750,
            remainingToLive: 700
          },
          warnings: ['« Courses » a déjà 300.00 € dépensés (nouveau plafond : 250.00 €).']
        }
      })
      .mockResolvedValueOnce({
        data: {
          status: 'ok',
          dryRun: false,
          changes: [],
          warnings: []
        }
      });

    renderWithQueryClient(
      <BudgetTemplatesSheet
        isOpen={true}
        onClose={vi.fn()}
        budgetId="budget-1"
        activePeriodId="period-1"
        activePeriodLabel="Mai 2026"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Mois Serré')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Appliquer sur Mai 2026/i }));

    await waitFor(() => {
      expect(screen.getByText(/Mise à 0 € · conservée/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Points d’attention/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Appliquer ce scénario/i }));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/periods/period-1/apply-template', {
        templateId: 'tpl-2',
        dryRun: false
      });
    });
  });
});
