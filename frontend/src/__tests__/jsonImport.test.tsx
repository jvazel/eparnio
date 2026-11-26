import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JsonImportSheet } from '../features/budget/JsonImportSheet';
import { apiClient } from '../services/api';
import type { BudgetSpace } from '../types/budget.types';

const mockActiveBudget: BudgetSpace = {
  id: 'budget-existing-1',
  name: 'Budget Perso',
  type: 'personal',
  ownerId: 'user-1',
  contributionMode: 'equal_50_50',
  members: [],
  budgetStartDay: 1,
  quickTemplates: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
  };
}

describe('JsonImportSheet (Étape 51)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejette un fichier JSON corrompu ou sans schemaVersion avant tout appel API', async () => {
    const postSpy = vi.spyOn(apiClient, 'post');

    renderWithQueryClient(
      <JsonImportSheet isOpen={true} onClose={vi.fn()} activeBudget={mockActiveBudget} />
    );

    const input = document.getElementById('eparnio-json-backup-input') as HTMLInputElement;
    expect(input).toBeTruthy();

    const invalidFile = new File(['{not valid json'], 'broken.json', {
      type: 'application/json'
    });
    Object.defineProperty(invalidFile, 'text', {
      value: async () => '{not valid json'
    });

    fireEvent.change(input, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalide ou corrompu/i);
    });
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('affiche l’aperçu, bascule create_new vs replace_existing (confirmation obligatoire) et restaure', async () => {
    const onBudgetRestored = vi.fn();
    const validBackup = {
      schemaVersion: 2,
      exportedAt: '2026-03-01T10:00:00.000Z',
      budget: { name: 'Mon Backup', budgetStartDay: 1 },
      periods: [],
      envelopes: [],
      transactions: [],
      goals: [],
      assets: []
    };

    const postSpy = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValueOnce({
        data: {
          status: 'ok',
          preview: {
            budgetName: 'Mon Backup',
            schemaVersion: 2,
            exportedAt: '2026-03-01T10:00:00.000Z',
            periodsCount: 3,
            envelopesCount: 12,
            transactionsCount: 45,
            goalsCount: 2,
            assetsCount: 1,
            dateRange: { from: '2026-01-01', to: '2026-03-31' },
            warnings: []
          }
        }
      })
      .mockResolvedValueOnce({
        data: {
          status: 'ok',
          budget: { ...mockActiveBudget, id: 'budget-restored-2', name: 'Mon Backup (Restauré)' },
          summary: {
            periodsCount: 3,
            envelopesCount: 12,
            transactionsCount: 45,
            goalsCount: 2,
            assetsCount: 1
          }
        }
      });

    renderWithQueryClient(
      <JsonImportSheet
        isOpen={true}
        onClose={vi.fn()}
        activeBudget={mockActiveBudget}
        canReplaceActiveBudget={true}
        onBudgetRestored={onBudgetRestored}
      />
    );

    const input = document.getElementById('eparnio-json-backup-input') as HTMLInputElement;
    const validFile = new File([JSON.stringify(validBackup)], 'eparnio-backup.json', {
      type: 'application/json'
    });
    Object.defineProperty(validFile, 'text', {
      value: async () => JSON.stringify(validBackup)
    });

    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByText('Mon Backup')).toBeInTheDocument();
    });
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();

    // Bascule sur replace_existing -> bouton bloqué tant que la case n'est pas cochée
    fireEvent.click(screen.getByRole('radio', { name: /Remplacer l’espace actuel/i }));
    const restoreButton = screen.getByRole('button', { name: /Restaurer maintenant/i });
    expect(restoreButton).toBeDisabled();

    // Retour sur create_new -> bouton actif
    fireEvent.click(screen.getByRole('radio', { name: /Créer un nouvel espace/i }));
    expect(restoreButton).not.toBeDisabled();

    fireEvent.click(restoreButton);

    await waitFor(() => {
      expect(screen.getByText(/Sauvegarde restaurée !/i)).toBeInTheDocument();
    });
    expect(onBudgetRestored).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledTimes(2);
  });
});
