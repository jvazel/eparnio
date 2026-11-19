import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BalanceReconcileSheet } from '../features/budget/BalanceReconcileSheet';
import { CsvImportSheet } from '../features/transactions/CsvImportSheet';
import * as transactionService from '../services/transaction.service';
import type { EnvelopeItem as Envelope, TransactionItem as Transaction } from '../types/budget.types';
import { parseBankStatement } from '../utils/csvParser';

const ENVELOPES = [
  {
    id: 'env-1',
    budgetPeriodId: 'period-1',
    name: 'Courses',
    allocatedAmount: 400,
    icon: '🛒',
    color: '#22C55E'
  },
  {
    id: 'env-2',
    budgetPeriodId: 'period-1',
    name: 'Transport',
    allocatedAmount: 150,
    icon: '🚆',
    color: '#3B82F6'
  }
] as unknown as Envelope[];

const PAST_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    budgetId: 'budget-1',
    budgetPeriodId: 'period-1',
    envelopeId: 'env-1',
    amount: 42.5,
    label: 'Carrefour Market',
    date: '2026-11-02T00:00:00.000Z',
    type: 'expense',
    authorId: 'user-1',
    paidByUserId: 'user-1',
    createdAt: '2026-11-02T00:00:00.000Z'
  }
];

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});

describe('Étape 30 — Parseur CSV/OFX, Boîte de tri & Réconciliation (Frontend)', () => {
  it('parse un relevé CSV français avec point-virgule, virgule décimale et suggère les enveloppes', () => {
    const csv = [
      'Date;Libellé;Débit;Crédit',
      '10/11/2026;Carrefour Market;-38,90;',
      '11/11/2026;SNCF Transport;25,00;',
      '12/11/2026;Virement Salaire;;2000,00'
    ].join('\n');

    const ops = parseBankStatement(csv, ENVELOPES, PAST_TRANSACTIONS);
    expect(ops).toHaveLength(2);
    expect(ops[0]).toMatchObject({
      date: '2026-11-10',
      label: 'Carrefour Market',
      amount: 38.9,
      suggestedEnvelopeId: 'env-1'
    });
    expect(ops[1]).toMatchObject({
      date: '2026-11-11',
      label: 'SNCF Transport',
      amount: 25,
      suggestedEnvelopeId: 'env-2'
    });
  });

  it('parse un relevé OFX basique', () => {
    const ofx = `
      <OFX>
        <STMTTRN>
          <DTPOSTED>20261114
          <TRNAMT>-19.90
          <NAME>Boulangerie Paul
        </STMTTRN>
      </OFX>
    `;
    const ops = parseBankStatement(ofx, ENVELOPES, []);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      date: '2026-11-14',
      label: 'Boulangerie Paul',
      amount: 19.9
    });
  });

  it('affiche la boîte de tri dans CsvImportSheet, exclut en 1 tap et importe le lot (mode clair)', async () => {
    const importSpy = vi.spyOn(transactionService, 'importTransactions').mockResolvedValue({
      status: 'ok',
      importedCount: 1,
      skippedDuplicatesCount: 0,
      transactions: [],
      envelopes: ENVELOPES,
      period: {} as never
    });

    const onImported = vi.fn();
    const onClose = vi.fn();

    render(
      <CsvImportSheet
        isOpen={true}
        onClose={onClose}
        periodId="period-1"
        envelopes={ENVELOPES}
        existingTransactions={PAST_TRANSACTIONS}
        onImported={onImported}
      />
    );

    const fileContent = [
      'Date;Libellé;Débit',
      '10/11/2026;Boulangerie;12,50',
      '11/11/2026;Pharmacie;25,00'
    ].join('\n');

    const file = new File([fileContent], 'releve.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(fileContent)
    });

    const input = screen.getByLabelText('Fichier CSV ou OFX');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Boulangerie')).toBeInTheDocument();
      expect(screen.getByText('Pharmacie')).toBeInTheDocument();
    });

    // Exclure Boulangerie en 1 tap
    fireEvent.click(screen.getByRole('button', { name: 'Exclure Boulangerie' }));

    const submitBtn = screen.getByRole('button', { name: 'Importer 1 opération' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith('period-1', [
        {
          envelopeId: 'env-1',
          amount: 25,
          label: 'Pharmacie',
          date: '2026-11-11'
        }
      ]);
      expect(onImported).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('calcule et affiche l’écart dans BalanceReconcileSheet (mode sombre)', async () => {
    document.documentElement.classList.add('dark');

    const reconcileSpy = vi.spyOn(transactionService, 'reconcilePeriodBalance').mockResolvedValue({
      status: 'ok',
      reconciliation: {
        theoreticalBalance: 1500,
        bankBalance: 1450,
        difference: -50,
        status: 'under',
        suggestedAdjustmentAmount: 50
      }
    });

    render(
      <BalanceReconcileSheet
        isOpen={true}
        onClose={vi.fn()}
        periodId="period-1"
        theoreticalBalance={1500}
      />
    );

    const input = screen.getByLabelText('Solde bancaire réel');
    fireEvent.change(input, { target: { value: '1450' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comparer les soldes' }));

    await waitFor(() => {
      expect(reconcileSpy).toHaveBeenCalledWith('period-1', 1450);
      expect(screen.getByText('Écart détecté')).toBeInTheDocument();
      expect(screen.getByText(/-50,00\s*€/)).toBeInTheDocument();
    });
  });
});
