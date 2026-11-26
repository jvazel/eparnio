import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplePayShortcutGuideSheet } from '../features/budget/ApplePayShortcutGuideSheet';
import {
  consumePendingQuickAddPrefill,
  parseQuickAddUrlParams,
  savePendingQuickAddPrefill
} from '../utils/quickAddDeepLink';

describe('Deep-Link Quick-Add & Apple Pay Guide (Étape 55)', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('parse le mode structuré Apple Pay / Raccourcis (amount virgule/point, label, envelope, tags)', () => {
    const res = parseQuickAddUrlParams(
      '/quick-add',
      '?amount=12,50€&label=Boulangerie&envelope=Courses&date=2026-11-26&tags=pain,matin'
    );
    expect(res).toEqual({
      source: 'deep_link',
      amount: 12.5,
      label: 'Boulangerie',
      envelopeName: 'Courses',
      date: '2026-11-26',
      tags: ['pain', 'matin']
    });
  });

  it('parse le mode texte libre Web Share Target via parseNaturalExpense', () => {
    const res = parseQuickAddUrlParams(
      '/quick-add',
      '?text=Paiement+18,40+euros+Carrefour+%23alimentation'
    );
    expect(res?.source).toBe('share_target');
    expect(res?.amount).toBe(18.4);
    expect(res?.tags).toContain('alimentation');
  });

  it('retourne null hors /quick-add et gère le raccourci vide + sessionStorage', () => {
    expect(parseQuickAddUrlParams('/other', '?amount=10')).toBeNull();

    const shortcut = parseQuickAddUrlParams('/quick-add', '');
    expect(shortcut).toEqual({ source: 'shortcut' });

    savePendingQuickAddPrefill({ source: 'deep_link', amount: 42, label: 'Test' });
    expect(consumePendingQuickAddPrefill()).toEqual({
      source: 'deep_link',
      amount: 42,
      label: 'Test'
    });
    // Consommé une seule fois
    expect(consumePendingQuickAddPrefill()).toBeNull();
  });

  it('affiche le guide Apple Pay, copie le lien Quick-Add et déclenche le bouton Tester', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const onTest = vi.fn();

    render(
      <ApplePayShortcutGuideSheet isOpen={true} onClose={vi.fn()} onTestShortcut={onTest} />
    );

    expect(screen.getByText(/Automatiser avec Apple Pay/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Copier le lien/i }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/quick-add?amount=&label='));

    fireEvent.click(screen.getByRole('button', { name: /Tester/i }));
    expect(onTest).toHaveBeenCalledTimes(1);
  });
});
