import { useCallback, useState } from 'react';
import type {
  BudgetSpace,
  EnvelopeItem,
  SavingsGoalItem,
  SavingsWithdrawalItem,
  TransactionItem
} from '../types/budget.types';
import type { QuickAddPrefill } from '../utils/quickAddDeepLink';

export interface EnvelopeEditorState {
  isOpen: boolean;
  pillar: 'income' | 'fixed_charge' | 'variable_envelope';
  item: EnvelopeItem | null;
}

export interface ExpenseEditorState {
  isOpen: boolean;
  transaction: TransactionItem | null;
}

export interface GoalFormState {
  isOpen: boolean;
  goal: SavingsGoalItem | null;
}

export interface GoalContributionState {
  isOpen: boolean;
  goal: SavingsGoalItem | null;
  envelope: EnvelopeItem | null;
}

export interface GoalWithdrawalState {
  isOpen: boolean;
  goal: SavingsGoalItem | null;
  withdrawal: SavingsWithdrawalItem | null;
}

export interface BudgetSettingsModalState {
  isOpen: boolean;
  mode: 'edit' | 'create';
  budget: BudgetSpace | null;
}

/**
 * Centralise et isole l'état d'ouverture/édition de toutes les modales et tiroirs d'Eparnio.
 */
export function useAppModals() {
  const [isWhatIfOpen, setIsWhatIfOpen] = useState(false);
  const [isWrappedOpen, setIsWrappedOpen] = useState(false);
  const [isQuickAddExpenseOpen, setIsQuickAddExpenseOpen] = useState(false);
  const [quickAddPrefill, setQuickAddPrefill] = useState<QuickAddPrefill | null>(null);
  const [editorState, setEditorState] = useState<EnvelopeEditorState>({
    isOpen: false,
    pillar: 'fixed_charge',
    item: null
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string | null>(null);
  const [expenseEditorState, setExpenseEditorState] = useState<ExpenseEditorState>({
    isOpen: false,
    transaction: null
  });
  const [goalFormState, setGoalFormState] = useState<GoalFormState>({
    isOpen: false,
    goal: null
  });
  const [contributionState, setContributionState] = useState<GoalContributionState>({
    isOpen: false,
    goal: null,
    envelope: null
  });
  const [withdrawalState, setWithdrawalState] = useState<GoalWithdrawalState>({
    isOpen: false,
    goal: null,
    withdrawal: null
  });
  const [isPlaceholderAddOpen, setIsPlaceholderAddOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [settingsState, setSettingsState] = useState<BudgetSettingsModalState>({
    isOpen: false,
    mode: 'edit',
    budget: null
  });
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinInitialCode, setJoinInitialCode] = useState('');
  const [calculatorBudget, setCalculatorBudget] = useState<BudgetSpace | null>(null);
  const [isClosingWizardOpen, setIsClosingWizardOpen] = useState(false);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isBalanceReconcileOpen, setIsBalanceReconcileOpen] = useState(false);
  const [isWeeklyDigestOpen, setIsWeeklyDigestOpen] = useState(false);

  const closeAllOverlays = useCallback(() => {
    setIsWhatIfOpen(false);
    setIsWrappedOpen(false);
    setIsQuickAddExpenseOpen(false);
    setQuickAddPrefill(null);
    setEditorState((prev) => ({ ...prev, isOpen: false, item: null }));
    setIsSearchOpen(false);
    setSelectedTag(null);
    setExpenseEditorState({ isOpen: false, transaction: null });
    setGoalFormState({ isOpen: false, goal: null });
    setContributionState({ isOpen: false, goal: null, envelope: null });
    setWithdrawalState({ isOpen: false, goal: null, withdrawal: null });
    setIsPlaceholderAddOpen(false);
    setIsProfileOpen(false);
    setIsSwitcherOpen(false);
    setSettingsState((prev) => ({ ...prev, isOpen: false }));
    setIsJoinOpen(false);
    setCalculatorBudget(null);
    setIsClosingWizardOpen(false);
    setIsCsvImportOpen(false);
    setIsBalanceReconcileOpen(false);
    setIsWeeklyDigestOpen(false);
  }, []);

  return {
    isWhatIfOpen,
    setIsWhatIfOpen,
    isWrappedOpen,
    setIsWrappedOpen,
    isQuickAddExpenseOpen,
    setIsQuickAddExpenseOpen,
    quickAddPrefill,
    setQuickAddPrefill,
    editorState,
    setEditorState,
    isSearchOpen,
    setIsSearchOpen,
    selectedTag,
    setSelectedTag,
    selectedEnvelopeId,
    setSelectedEnvelopeId,
    expenseEditorState,
    setExpenseEditorState,
    goalFormState,
    setGoalFormState,
    contributionState,
    setContributionState,
    withdrawalState,
    setWithdrawalState,
    isPlaceholderAddOpen,
    setIsPlaceholderAddOpen,
    isProfileOpen,
    setIsProfileOpen,
    isSwitcherOpen,
    setIsSwitcherOpen,
    settingsState,
    setSettingsState,
    isJoinOpen,
    setIsJoinOpen,
    joinInitialCode,
    setJoinInitialCode,
    calculatorBudget,
    setCalculatorBudget,
    isClosingWizardOpen,
    setIsClosingWizardOpen,
    isCsvImportOpen,
    setIsCsvImportOpen,
    isBalanceReconcileOpen,
    setIsBalanceReconcileOpen,
    isWeeklyDigestOpen,
    setIsWeeklyDigestOpen,
    closeAllOverlays
  };
}
