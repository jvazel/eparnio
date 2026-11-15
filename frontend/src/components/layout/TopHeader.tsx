import { CreditCard } from 'lucide-react';

export interface TopHeaderProps {
  firstName: string;
  avatarEmoji?: string;
  activeBudgetName?: string;
  onProfileClick?: () => void;
  onBudgetSwitcherClick?: () => void;
}

/**
 * En-tête commun Mobile-First : avatar violet + « Bonjour Prénom » à gauche, bouton Budget à droite.
 */
export function TopHeader({
  firstName,
  avatarEmoji = '🧑',
  activeBudgetName,
  onProfileClick,
  onBudgetSwitcherClick
}: TopHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 pt-4 pb-2">
      <button
        type="button"
        onClick={onProfileClick}
        aria-label={`Profil de ${firstName}`}
        className="flex min-h-11 items-center gap-3 rounded-full pr-2 text-left transition-opacity hover:opacity-90"
      >
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8B3DFF] text-xl shadow-sm"
          aria-hidden="true"
        >
          {avatarEmoji}
        </span>
        <div className="flex flex-col">
          <span className="text-base font-medium text-slate-900 dark:text-slate-100">
            Bonjour {firstName}
          </span>
          {activeBudgetName ? (
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {activeBudgetName}
            </span>
          ) : null}
        </div>
      </button>

      <button
        type="button"
        onClick={onBudgetSwitcherClick}
        aria-label="Changer d'espace budget"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-900 shadow-card transition-transform active:scale-95 dark:border dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        <CreditCard className="h-5 w-5" />
      </button>
    </header>
  );
}
