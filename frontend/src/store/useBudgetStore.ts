import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface BudgetSelectionState {
  activeBudgetId: string | null;
  setActiveBudgetId: (budgetId: string | null) => void;
}

export const useBudgetStore = create<BudgetSelectionState>()(
  persist(
    (set) => ({
      activeBudgetId: null,
      setActiveBudgetId: (activeBudgetId) => set({ activeBudgetId })
    }),
    {
      name: 'eparnio-budget-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
);
