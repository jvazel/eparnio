import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickAddExpenseSheet } from '../features/transactions/QuickAddExpenseSheet';
import type { EnvelopeItem, QuickTemplateItem } from '../types/budget.types';

const ENVELOPES = [
  {
    id: 'env-1',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-1',
    pillar: 'variable_envelope',
    name: 'Courses',
    allocatedAmount: 300,
    spentOrPaidAmount: 50,
    icon: '🛒',
    color: '#22C55E',
    date: '2026-11-01',
    isPaid: false,
    isRecurring: false
  },
  {
    id: 'env-2',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-1',
    pillar: 'variable_envelope',
    name: 'Café & Sorties',
    allocatedAmount: 100,
    spentOrPaidAmount: 10,
    icon: '☕',
    color: '#F59E0B',
    date: '2026-11-01',
    isPaid: false,
    isRecurring: false
  }
] as unknown as EnvelopeItem[];

const TEMPLATES: QuickTemplateItem[] = [
  {
    id: 'tpl-1',
    label: 'Espresso',
    envelopeName: 'cafe & sorties',
    defaultAmount: 2.5,
    order: 0
  }
];

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});

describe('Étape 32 — Auto-complétion & Favoris 1-Tap (Frontend)', () => {
  it('pré-remplit enveloppe, libellé et montant via un favori 1-tap et permet sa suppression (mode clair)', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <QuickAddExpenseSheet
        isOpen={true}
        onClose={vi.fn()}
        envelopes={ENVELOPES}
        quickTemplates={TEMPLATES}
        onDeleteQuickTemplate={onDelete}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^Espresso/i }));

    expect(screen.getByLabelText('Libellé de la dépense')).toHaveValue('Espresso');
    expect(screen.getByText(/Restant dans Café & Sorties/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le favori Espresso' }));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('tpl-1');
    });
  });

  it('suggère les libellés en temps réel, pré-sélectionne l’enveloppe et enregistre en favori (mode sombre)', async () => {
    document.documentElement.classList.add('dark');
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <QuickAddExpenseSheet
        isOpen={true}
        onClose={vi.fn()}
        envelopes={ENVELOPES}
        suggestions={[
          { label: 'Starbucks', envelopeName: 'Café & Sorties', lastAmount: 5.5, count: 3 }
        ]}
        onSaveQuickTemplate={onSave}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Libellé de la dépense'), {
      target: { value: 'Star' }
    });

    const suggestionChip = screen.getByRole('button', { name: /Starbucks/i });
    fireEvent.click(suggestionChip);

    expect(screen.getByLabelText('Libellé de la dépense')).toHaveValue('Starbucks');
    expect(screen.getByText(/Restant dans Café & Sorties/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer en favori/i }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        label: 'Starbucks',
        envelopeName: 'Café & Sorties',
        defaultAmount: 5.5
      });
    });
  });
});
