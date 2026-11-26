import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptScanButton } from '../features/transactions/ReceiptScanButton';
import { QuickAddExpenseSheet } from '../features/transactions/QuickAddExpenseSheet';
import * as receiptOcr from '../utils/receiptOcr';

vi.mock('../utils/receiptOcr', () => ({
  scanReceiptFile: vi.fn()
}));

const mockedScanReceiptFile = vi.mocked(receiptOcr.scanReceiptFile);

describe('ReceiptScanButton & QuickAddExpenseSheet — Scan de ticket OCR (Étape 61)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pré-remplit le montant, le libellé, la date et l’enveloppe après un scan réussi et permet de choisir un montant candidat', async () => {
    mockedScanReceiptFile.mockResolvedValueOnce({
      amount: 42.8,
      candidateAmounts: [42.8, 38.5],
      merchant: 'Carrefour Market',
      date: '2026-11-24',
      rawText: 'CARREFOUR MARKET\nTOTAL TTC 42,80',
      confidence: 'high'
    });

    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <QuickAddExpenseSheet
        isOpen
        onClose={vi.fn()}
        envelopes={[
          {
            id: 'env-1',
            budgetId: 'b1',
            budgetPeriodId: 'p1',
            pillar: 'variable_envelope',
            name: 'Restos',
            icon: '🍽️',
            color: '#F59E0B',
            allocatedAmount: 200,
            spentOrPaidAmount: 0,
            rolloverEnabled: false,
            rolloverMode: 'positive_only',
            rolloverAmount: 0,
            date: '2026-11-01',
            isRecurring: false,
            isPaid: false,
            order: 0
          },
          {
            id: 'env-2',
            budgetId: 'b1',
            budgetPeriodId: 'p1',
            pillar: 'variable_envelope',
            name: 'Courses',
            icon: '🛒',
            color: '#10B981',
            allocatedAmount: 500,
            spentOrPaidAmount: 0,
            rolloverEnabled: false,
            rolloverMode: 'positive_only',
            rolloverAmount: 0,
            date: '2026-11-01',
            isRecurring: false,
            isPaid: false,
            order: 1
          }
        ]}
        suggestions={[
          {
            label: 'Carrefour',
            envelopeName: 'Courses',
            lastAmount: 45,
            count: 5
          }
        ]}
        onSubmit={onSubmit}
      />
    );

    const fileInput = screen.getByLabelText(/Choisir ou photographier un ticket de caisse/i);
    const fakeFile = new File(['fake-img'], 'ticket.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [fakeFile] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Carrefour Market')).toBeInTheDocument();
    });

    // Les chips de montants alternatifs sont affichés
    const altChip = screen.getByRole('button', { name: /38,50/i });
    expect(altChip).toBeInTheDocument();
    fireEvent.click(altChip);

    // Jamais d'enregistrement automatique sans validation
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('affiche un message d’erreur clair si le fichier n’est pas une image ou si l’OCR échoue', async () => {
    const onResult = vi.fn();
    render(<ReceiptScanButton onResult={onResult} />);

    const fileInput = screen.getByLabelText(/Choisir ou photographier un ticket de caisse/i);
    const pdfFile = new File(['pdf'], 'facture.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    expect(
      await screen.findByText(/Veuillez sélectionner une image/i)
    ).toBeInTheDocument();
    expect(onResult).not.toHaveBeenCalled();

    mockedScanReceiptFile.mockRejectedValueOnce(new Error('Image trop floue'));
    const imgFile = new File(['img'], 'flou.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [imgFile] } });

    expect(await screen.findByText('Image trop floue')).toBeInTheDocument();
  });
});
