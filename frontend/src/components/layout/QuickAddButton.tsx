import { Plus } from 'lucide-react';

export interface QuickAddButtonProps {
  visible?: boolean;
  onClick: () => void;
  ariaLabel?: string;
}

/**
 * Bouton flottant d'action rapide (+ bleu) centré dans la zone mobile au-dessus de la BottomNav.
 */
export function QuickAddButton({
  visible = true,
  onClick,
  ariaLabel = 'Ajouter un élément'
}: QuickAddButtonProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 mx-auto flex max-w-md justify-end px-4 pb-safe">
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#1D7DFA] text-white shadow-lg transition-transform hover:bg-blue-600 active:scale-95"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>
    </div>
  );
}
