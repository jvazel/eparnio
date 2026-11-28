import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAppModals } from '../hooks/useAppModals';

describe('useAppModals — Isolation des états de modales (Étape 73)', () => {
  it('initialise toutes les modales fermées et permet de tout fermer via closeAllOverlays', () => {
    const { result } = renderHook(() => useAppModals());

    expect(result.current.isProfileOpen).toBe(false);
    expect(result.current.isQuickAddExpenseOpen).toBe(false);
    expect(result.current.isClosingWizardOpen).toBe(false);
    expect(result.current.editorState.isOpen).toBe(false);

    act(() => {
      result.current.setIsProfileOpen(true);
      result.current.setIsQuickAddExpenseOpen(true);
      result.current.setIsClosingWizardOpen(true);
      result.current.setEditorState({ isOpen: true, pillar: 'income', item: null });
      result.current.setSelectedTag('vacances');
    });

    expect(result.current.isProfileOpen).toBe(true);
    expect(result.current.isQuickAddExpenseOpen).toBe(true);
    expect(result.current.isClosingWizardOpen).toBe(true);
    expect(result.current.editorState.isOpen).toBe(true);
    expect(result.current.selectedTag).toBe('vacances');

    act(() => {
      result.current.closeAllOverlays();
    });

    expect(result.current.isProfileOpen).toBe(false);
    expect(result.current.isQuickAddExpenseOpen).toBe(false);
    expect(result.current.isClosingWizardOpen).toBe(false);
    expect(result.current.editorState.isOpen).toBe(false);
    expect(result.current.selectedTag).toBeNull();
  });
});
