import { Info } from 'lucide-react';
import { useId, useRef, useState } from 'react';

export interface PillarInfoPopoverProps {
  title: string;
  description: string;
}

/**
 * Titre de vue centré avec icône `ⓘ` ouvrant une bulle d'aide pédagogique via l'API Popover native.
 */
export function PillarInfoPopover({ title, description }: PillarInfoPopoverProps) {
  const popoverId = useId();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);

  const supportsNativePopover =
    typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

  const handleInfoClick = () => {
    if (!supportsNativePopover) {
      setFallbackOpen((prev) => !prev);
      return;
    }

    const popoverEl = popoverRef.current as (HTMLDivElement & { togglePopover?: () => void }) | null;
    if (popoverEl && typeof popoverEl.togglePopover === 'function') {
      popoverEl.togglePopover();
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={handleInfoClick}
          aria-label={`Informations sur ${title}`}
          aria-expanded={!supportsNativePopover ? fallbackOpen : undefined}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-900 transition-colors hover:bg-slate-200/60"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white">
            <Info className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
        </button>
        <h1 className="-ml-2 text-base font-semibold text-slate-800">{title}</h1>
      </div>

      <div
        ref={popoverRef}
        id={popoverId}
        role="region"
        aria-label={`Aide ${title}`}
        {...({ popover: 'auto' } as Record<string, string>)}
        className={`mt-1 max-w-xs rounded-2xl border border-slate-200 bg-white p-3.5 text-center text-xs leading-relaxed text-slate-600 shadow-lg ${
          supportsNativePopover ? '' : fallbackOpen ? 'block' : 'hidden'
        }`.trim()}
      >
        {description}
      </div>
    </div>
  );
}
