import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthlyInsights } from '../features/analytics/MonthlyInsights';
import { BudgetSettingsSheet } from '../features/budget/BudgetSettingsSheet';
import { apiClient } from '../services/api';
import type {
  BudgetPeriod,
  BudgetSpace,
  EnvelopeItem,
  PeriodAnalytics,
  SavingsGoalItem
} from '../types/budget.types';
import {
  downloadBudgetCsv,
  downloadBudgetJsonBackup,
  downloadPeriodPdfReport,
  generatePeriodPdfBytes,
  sanitizeFilenamePart
} from '../utils/exportReport';

const sampleAnalytics: PeriodAnalytics = {
  periodId: 'period-2026-11',
  budgetId: 'budget-1',
  budgetType: 'shared',
  cashFlow: {
    plannedIncome: 3500,
    plannedFixedCharges: 1100,
    plannedEnvelopes: 800,
    spentVariables: 420,
    plannedSavings: 400,
    remainingToLive: 1580
  },
  dailyBudget: {
    startDate: '2026-11-01T00:00:00.000Z',
    endDate: '2026-11-30T23:59:59.999Z',
    referenceDate: '2026-11-19T12:00:00.000Z',
    totalDays: 30,
    daysRemaining: 12,
    remainingToLive: 1580,
    dailyAmount: 131.67
  },
  allocation: {
    totalOutflows: 1920,
    plannedIncome: 3500,
    items: [
      { key: 'fixed', label: 'Fixe', color: '#8B5CF6', amount: 1100, percentage: 57.3, incomeSharePercentage: 31.4 },
      { key: 'variable', label: 'Variable', color: '#3B82F6', amount: 420, percentage: 21.9, incomeSharePercentage: 12 },
      { key: 'savings', label: 'Épargne', color: '#22C55E', amount: 400, percentage: 20.8, incomeSharePercentage: 11.4 }
    ]
  },
  zeroBased: {
    plannedIncome: 3500,
    totalAllocated: 2300,
    remainingToAllocate: 1200,
    isBalanced: false
  },
  memberBreakdown: [
    {
      userId: 'u-1',
      displayName: 'Johann',
      avatarEmoji: '🧑',
      color: '#7C3AED',
      role: 'owner',
      incomeContributed: 2000,
      fixedChargesPaid: 600,
      variableExpensesPaid: 250,
      savingsContributed: 200,
      expensesPaid: 850,
      netBalance: 1150,
      incomeSharePercentage: 57.1,
      expensesSharePercentage: 55.9
    }
  ]
};

const samplePeriod: BudgetPeriod = {
  id: 'period-2026-11',
  budgetId: 'budget-1',
  year: 2026,
  month: 11,
  label: 'Novembre 2026',
  startDate: '2026-11-01T00:00:00.000Z',
  endDate: '2026-11-30T23:59:59.999Z',
  summary: {
    plannedIncome: 3500,
    plannedFixedCharges: 1100,
    plannedEnvelopes: 800,
    plannedSavings: 400,
    spentVariables: 420,
    remainingToAllocate: 1200,
    remainingToLive: 1580
  }
};

const sampleEnvelopes: EnvelopeItem[] = Array.from({ length: 45 }, (_, index) => ({
  id: `env-${index}`,
  budgetId: 'budget-1',
  budgetPeriodId: 'period-2026-11',
  pillar: 'variable_envelope',
  name: `Enveloppe #${index + 1}`,
  icon: '🛒',
  color: '#16A34A',
  allocatedAmount: 200,
  spentOrPaidAmount: 50,
  date: '2026-11-01T12:00:00.000Z',
  isRecurring: true,
  isPaid: false,
  order: index
}));

const sampleGoals: SavingsGoalItem[] = [
  {
    id: 'goal-1',
    budgetId: 'budget-1',
    name: 'Matelas sécurité',
    icon: '🛡️',
    color: '#22C55E',
    targetAmount: 5000,
    initialAmount: 1000,
    currentAmount: 2500,
    order: 0
  }
];

const sampleBudget: BudgetSpace = {
  id: 'budget-1',
  name: 'Budget Foyer',
  type: 'shared',
  ownerId: 'u-1',
  contributionMode: 'equal_50_50',
  members: [
    {
      userId: 'u-1',
      role: 'owner',
      color: '#7C3AED',
      declaredMonthlyIncome: 2000,
      joinedAt: '2026-01-01T00:00:00.000Z',
      displayName: 'Johann'
    }
  ],
  budgetStartDay: 1
};

let originalCreateObjectURL: typeof URL.createObjectURL | undefined;
let originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined;
let clickSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  originalCreateObjectURL = URL.createObjectURL;
  originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:eparnio-test');
  URL.revokeObjectURL = vi.fn();
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  if (originalCreateObjectURL) {
    URL.createObjectURL = originalCreateObjectURL;
  }
  if (originalRevokeObjectURL) {
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
  clickSpy.mockRestore();
  sessionStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.restoreAllMocks();
});

describe('Étape 29 — Exports CSV / Bilan PDF & Sauvegarde JSON', () => {
  it('génère un PDF 1.4 multi-pages valide et déclenche les téléchargements CSV / PDF / JSON', async () => {
    expect(sanitizeFilenamePart('Budget Foyer / 2026!')).toBe('budget-foyer-2026');

    const pdfBytes = generatePeriodPdfBytes({
      budgetName: 'Budget Foyer',
      periodLabel: 'Novembre 2026',
      analytics: sampleAnalytics,
      envelopes: sampleEnvelopes,
      goals: sampleGoals,
      generatedAt: new Date('2026-11-19T11:00:00.000Z')
    });

    const pdfText = new TextDecoder('latin1').decode(pdfBytes);
    expect(pdfText.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdfText).toContain('/Type /Pages');
    expect(pdfText).toContain('/Count 2'); // Pagination multi-pages (18 enveloppes + objectifs + membres)
    expect(pdfText).toContain('EPARNIO - Bilan budgetaire');
    expect(pdfText).toContain('Bilan par membre');
    expect(pdfText).toContain('xref\n');
    expect(pdfText.trim().endsWith('%%EOF')).toBe(true);

    const pdfFilename = downloadPeriodPdfReport({
      budgetName: 'Budget Foyer',
      periodLabel: 'Novembre 2026',
      analytics: sampleAnalytics,
      envelopes: sampleEnvelopes,
      goals: sampleGoals
    });
    expect(pdfFilename).toBe('eparnio-bilan-budget-foyer-novembre-2026.pdf');
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const apiSpy = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ data: 'Date;Libelle\r\n2026-11-01;Salaire' })
      .mockResolvedValueOnce({ data: { status: 'ok', schemaVersion: 1, periods: [] } });

    const csvFilename = await downloadBudgetCsv('budget-1', {
      budgetName: 'Budget Foyer',
      periodId: 'period-2026-11',
      periodLabel: 'Novembre 2026'
    });
    expect(csvFilename).toBe('eparnio-budget-foyer-novembre-2026.csv');
    expect(apiSpy).toHaveBeenCalledWith(
      '/budgets/budget-1/export/csv',
      expect.objectContaining({ params: { periodId: 'period-2026-11' }, responseType: 'text' })
    );

    const jsonFilename = await downloadBudgetJsonBackup('budget-1', 'Budget Foyer');
    expect(jsonFilename).toBe('eparnio-backup-budget-foyer.json');
    expect(apiSpy).toHaveBeenCalledWith('/budgets/budget-1/export/json');
    expect(clickSpy).toHaveBeenCalledTimes(3);
  });

  it('affiche les actions d’export dans MonthlyInsights et BudgetSettingsSheet (modes clair & sombre)', async () => {
    const user = userEvent.setup();
    const onExportCsv = vi.fn().mockResolvedValue('eparnio-novembre-2026.csv');
    const onExportPdf = vi.fn().mockResolvedValue('eparnio-bilan.pdf');
    const onExportJson = vi.fn().mockRejectedValue(new Error('Réseau indisponible'));

    document.documentElement.classList.add('dark');

    render(
      <MonthlyInsights
        analytics={sampleAnalytics}
        envelopes={sampleEnvelopes}
        onExportCsv={onExportCsv}
        onExportPdf={onExportPdf}
        onExportJson={onExportJson}
      />
    );

    expect(screen.queryByRole('button', { name: /Ajouter/i })).not.toBeInTheDocument();

    const csvBtn = screen.getByRole('button', { name: 'Exporter en CSV (Excel)' });
    const pdfBtn = screen.getByRole('button', { name: 'Télécharger le bilan PDF' });
    const jsonBtn = screen.getByRole('button', { name: 'Sauvegarde complète (.json)' });

    expect(csvBtn).toHaveClass('dark:bg-slate-800/80');

    await user.click(csvBtn);
    expect(onExportCsv).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('Fichier téléchargé : eparnio-novembre-2026.csv')
    ).toBeInTheDocument();

    await user.click(pdfBtn);
    expect(onExportPdf).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('Fichier téléchargé : eparnio-bilan.pdf')
    ).toBeInTheDocument();

    await user.click(jsonBtn);
    expect(await screen.findByRole('alert')).toHaveTextContent('Réseau indisponible');

    // Vérification dans BudgetSettingsSheet
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { status: 'ok', schemaVersion: 1 } });

    render(
      <QueryClientProvider client={queryClient}>
        <BudgetSettingsSheet
          isOpen
          onClose={vi.fn()}
          budget={sampleBudget}
          initialMode="edit"
          canDelete={false}
          currentUserId="u-1"
          activePeriod={samplePeriod}
          activeAnalytics={sampleAnalytics}
          activeEnvelopes={sampleEnvelopes}
          activeGoals={sampleGoals}
          onBudgetCreated={vi.fn()}
          onBudgetDeleted={vi.fn()}
        />
      </QueryClientProvider>
    );

    expect(screen.getAllByRole('button', { name: 'Exporter en CSV (Excel)' }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('button', { name: 'Télécharger le bilan PDF' }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('button', { name: 'Sauvegarde complète (.json)' }).length).toBeGreaterThanOrEqual(2);
  });
});
