import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef } from 'react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Tiroir modal tactile glissant depuis le bas reposant sur `<dialog closedby="any">`
 * avec repli automatique pour les navigateurs ne supportant pas encore `closedBy`.
 */
export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isOpenRef = useRef(isOpen);
  const onCloseRef = useRef(onClose);
  const isProgrammaticCloseRef = useRef(false);
  const titleId = useId();

  isOpenRef.current = isOpen;
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      isProgrammaticCloseRef.current = false;
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    } else if (!isOpen && dialog.open) {
      isProgrammaticCloseRef.current = true;
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      const wasProgrammatic = isProgrammaticCloseRef.current;
      isProgrammaticCloseRef.current = false;
      // Ignore les événements 'close' natifs (souvent asynchrones) provoqués par un changement de prop isOpen=false.
      if (wasProgrammatic || !isOpenRef.current) {
        return;
      }
      onCloseRef.current();
    };

    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (isOpenRef.current) {
        onCloseRef.current();
      }
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);

    let handleFallbackClick: ((event: MouseEvent) => void) | undefined;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      handleFallbackClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;

        if (isDialogContent) return;
        if (typeof dialog.close === 'function') {
          isProgrammaticCloseRef.current = false;
          dialog.close();
        } else if (isOpenRef.current) {
          onCloseRef.current();
        }
      };
      dialog.addEventListener('click', handleFallbackClick);
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
      if (handleFallbackClick) {
        dialog.removeEventListener('click', handleFallbackClick);
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="eparnio-sheet"
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="p-5 pb-safe">
        <div
          className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700"
          aria-hidden="true"
        />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-50">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le tiroir"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {isOpen ? children : null}
      </div>
    </dialog>
  );
}
