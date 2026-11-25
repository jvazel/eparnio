import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickAddExpenseSheet } from '../features/transactions/QuickAddExpenseSheet';
import type { EnvelopeItem } from '../types/budget.types';

const ENVELOPES: EnvelopeItem[] = [
  {
    id: 'env-courses',
    budgetId: 'b1',
    budgetPeriodId: 'p1',
    pillar: 'variable_envelope',
    name: 'Courses',
    icon: '🛒',
    color: '#34D399',
    allocatedAmount: 400,
    spentOrPaidAmount: 100,
    date: '2026-11-01',
    isRecurring: true,
    isPaid: false,
    order: 0
  },
  {
    id: 'env-resto',
    budgetId: 'b1',
    budgetPeriodId: 'p1',
    pillar: 'variable_envelope',
    name: 'Restaurants',
    icon: '🍽️',
    color: '#F472B6',
    allocatedAmount: 150,
    spentOrPaidAmount: 20,
    date: '2026-11-01',
    isRecurring: true,
    isPaid: false,
    order: 1
  }
];

interface MockRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: unknown) => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
}

describe('Étape 50 — QuickAddExpenseSheet (Saisie Vocale & Langage Naturel)', () => {
  afterEach(() => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    document.documentElement.classList.remove('dark');
  });

  it('pré-remplit le formulaire via le champ texte libre sans soumettre automatiquement', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <QuickAddExpenseSheet
        isOpen={true}
        onClose={vi.fn()}
        envelopes={ENVELOPES}
        onSubmit={onSubmit}
      />
    );

    const input = screen.getByLabelText(/Saisie express/i);
    await user.type(input, '42,50 € Carrefour courses');
    await user.click(screen.getByRole('button', { name: 'Appliquer' }));

    expect(screen.getByText('Détecté :')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Carrefour')).toBeInTheDocument();
    // Aucune soumission automatique tant que l'utilisateur n'a pas validé
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('masque le bouton micro lorsque SpeechRecognition n’est pas supporté', () => {
    render(
      <QuickAddExpenseSheet
        isOpen={true}
        onClose={vi.fn()}
        envelopes={ENVELOPES}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.queryByRole('button', { name: /Dicter une dépense/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Saisie express/i)).toBeInTheDocument();
  });

  it('gère la dictée vocale (écoute, transcription finale et erreur not-allowed) en mode sombre', async () => {
    document.documentElement.classList.add('dark');
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    let activeInstance: MockRecognitionInstance | null = null;

    class MockSpeechRecognition implements MockRecognitionInstance {
      lang = '';
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      start = vi.fn(() => {
        this.onstart?.();
      });
      stop = vi.fn(() => {
        this.onend?.();
      });
      abort = vi.fn();

      constructor() {
        activeInstance = this;
      }
    }

    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = MockSpeechRecognition;

    render(
      <QuickAddExpenseSheet
        isOpen={true}
        onClose={vi.fn()}
        envelopes={ENVELOPES}
        onSubmit={onSubmit}
      />
    );

    const micBtn = screen.getByRole('button', { name: 'Dicter une dépense' });
    await user.click(micBtn);

    expect(activeInstance).not.toBeNull();
    expect(screen.getByText(/Écoute en cours/i)).toBeInTheDocument();

    act(() => {
      activeInstance?.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: true,
            length: 1,
            0: { transcript: '24 euros 50 Bistrot restaurants' }
          }
        }
      });
      activeInstance?.onend?.();
    });

    expect(screen.getByDisplayValue('Bistrot')).toBeInTheDocument();
    expect(screen.getByText('Détecté :')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    // Test erreur micro refusé
    await user.click(screen.getByRole('button', { name: 'Dicter une dépense' }));
    act(() => {
      activeInstance?.onerror?.({ error: 'not-allowed' });
    });
    expect(screen.getByText(/Accès au micro refusé/i)).toBeInTheDocument();
  });
});
