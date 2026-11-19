import { Plus, X } from 'lucide-react';
import { useState } from 'react';

export interface QuickAddMenuAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface QuickAddButtonProps {
  visible?: boolean;
  onClick: () => void;
  ariaLabel?: string;
  menuActions?: QuickAddMenuAction[];
}

/**
 * Bouton flottant d'action rapide (+ bleu) centré dans la zone mobile au-dessus de la BottomNav.
 */
export function QuickAddButton({
  visible = true,
  onClick,
  ariaLabel = 'Ajouter un élément',
  menuActions
}: QuickAddButtonProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!visible) return null;

  const hasMenu = Boolean(menuActions && menuActions.length > 0);

  const handleMainClick = () => {
    if (hasMenu) {
      setIsMenuOpen((prev) => !prev);
      return;
    }
    onClick();
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 mx-auto flex max-w-md flex-col items-end gap-2 px-4 pb-safe">
      {hasMenu && isMenuOpen && (
        <div
          role="menu"
          aria-label="Actions rapides"
          className="pointer-events-auto flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800"
        >
          {menuActions!.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                action.onClick();
              }}
              className={`rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition ${
                action.primary
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleMainClick}
        aria-label={ariaLabel}
        aria-expanded={hasMenu ? isMenuOpen : undefined}
        className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#1D7DFA] text-white shadow-lg transition-transform hover:bg-blue-600 active:scale-95"
      >
        {hasMenu && isMenuOpen ? (
          <X className="h-6 w-6" strokeWidth={2.5} />
        ) : (
          <Plus className="h-7 w-7" strokeWidth={2.5} />
        )}
      </button>
    </div>
  );
}
