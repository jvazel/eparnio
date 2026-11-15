import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Share2,
  UserPlus,
  X
} from 'lucide-react';
import { type TouchEvent, useEffect, useRef, useState } from 'react';
import { QrCodeModal } from '../../features/shared-budget/QrCodeModal';
import type { BudgetSpace } from '../../types/budget.types';

export interface ShareBudgetModalProps {
  isOpen: boolean;
  budget: BudgetSpace | null;
  onGenerateInvite?: (budgetId: string) => Promise<string | null>;
  onClose: () => void;
}

/**
 * Modale centrale de partage d'un espace Eparnio (calibrée sur la capture Finzee).
 */
export function ShareBudgetModal({
  isOpen,
  budget,
  onGenerateInvite,
  onClose
}: ShareBudgetModalProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeCode, setActiveCode] = useState<string>('');
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isOpen || !budget) {
      setIsQrOpen(false);
      return;
    }

    setFeedback(null);
    setActiveCode(budget.inviteCode ?? budget.id);

    if (!budget.inviteCode && onGenerateInvite) {
      setIsGenerating(true);
      void onGenerateInvite(budget.id)
        .then((generated) => {
          if (generated) {
            setActiveCode(generated);
          }
        })
        .catch(() => {
          // Conserve le repli local sans bloquer la modale
        })
        .finally(() => {
          setIsGenerating(false);
        });
    }
  }, [isOpen, budget, onGenerateInvite]);

  if (!isOpen || !budget) return null;

  const resolvedCode = activeCode || budget.inviteCode || budget.id;
  const inviteUrl = `${window.location.origin}/?invite=${resolvedCode}`;

  const handleCopyInviteUrl = async () => {
    try {
      await navigator.clipboard?.writeText(inviteUrl);
      setFeedback('URL d’invitation copiée dans le presse-papiers !');
    } catch {
      setFeedback(`Lien d’invitation prêt : ${inviteUrl}`);
    }
  };

  const handleSendSms = () => {
    const smsText = encodeURIComponent(
      `Rejoins mon espace budget "${budget.name}" sur Eparnio : ${inviteUrl}`
    );
    setFeedback(`Invitation SMS préparée (${budget.name}).`);
    if (
      typeof window !== 'undefined' &&
      !/jsdom/i.test(window.navigator.userAgent ?? '')
    ) {
      window.location.href = `sms:?&body=${smsText}`;
    }
  };

  const handleShowQrCode = () => {
    setFeedback(`Code espace ${resolvedCode} : QR Code disponible au partage.`);
    setIsQrOpen(true);
  };

  const handleRegenerateInvite = async () => {
    if (!onGenerateInvite) return;
    setIsGenerating(true);
    try {
      const nextCode = await onGenerateInvite(budget.id);
      if (nextCode) {
        setActiveCode(nextCode);
        setFeedback(`Nouveau code généré : ${nextCode}. L’ancien lien a été révoqué.`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Partager ${budget.name}`}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-6"
      >
        <div className="w-full max-w-xs overflow-hidden rounded-2xl bg-white/95 text-center shadow-2xl backdrop-blur-md">
          <div className="px-5 pb-4 pt-5">
            <h2 className="text-base font-bold text-slate-900">
              Partagez votre espace Eparnio avec vos proches !
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Les transactions et le budget sont synchronisés en temps réel
            </p>
            <p className="mt-2 inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
              Lien et QR Code valables 24 heures
            </p>
            {feedback ? (
              <p
                role="status"
                aria-live="polite"
                className="mt-2.5 rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700"
              >
                {feedback}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col divide-y divide-slate-200 border-t border-slate-200">
            <button
              type="button"
              onClick={handleSendSms}
              className="min-h-12 w-full px-4 text-sm font-medium text-indigo-700 hover:bg-slate-50"
            >
              Envoyer par SMS
            </button>
            <button
              type="button"
              onClick={handleShowQrCode}
              className="min-h-12 w-full px-4 text-sm font-medium text-indigo-700 hover:bg-slate-50"
            >
              Scanner le QR Code
            </button>
            <button
              type="button"
              onClick={handleCopyInviteUrl}
              className="min-h-12 w-full px-4 text-sm font-medium text-indigo-700 hover:bg-slate-50"
            >
              Copier l&apos;URL d&apos;invitation
            </button>
            {onGenerateInvite ? (
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => void handleRegenerateInvite()}
                className="min-h-12 w-full px-4 text-sm font-medium text-violet-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {isGenerating ? 'Régénération...' : 'Régénérer le code (24h)'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="min-h-12 w-full px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>

      <QrCodeModal
        isOpen={isQrOpen}
        budgetName={budget.name}
        inviteCode={resolvedCode}
        inviteUrl={inviteUrl}
        isGenerating={isGenerating}
        onRegenerate={onGenerateInvite ? handleRegenerateInvite : undefined}
        onClose={() => setIsQrOpen(false)}
      />
    </>
  );
}

export interface BudgetSwitcherOverlayProps {
  isOpen: boolean;
  budgets: BudgetSpace[];
  activeBudgetId: string | null;
  onClose: () => void;
  onSelectBudget: (budgetId: string) => void;
  onOpenSettings: (budget: BudgetSpace) => void;
  onCreateNewBudget: () => void;
  onJoinBudget?: () => void;
  onGenerateInvite?: (budgetId: string) => Promise<string | null>;
}

/**
 * Overlay plein écran du sélecteur d'espace Budget (`BudgetSwitcherOverlay`),
 * avec cartes au dégradé violet-rose-turquoise empilées et swipables.
 */
export function BudgetSwitcherOverlay({
  isOpen,
  budgets,
  activeBudgetId,
  onClose,
  onSelectBudget,
  onOpenSettings,
  onCreateNewBudget,
  onJoinBudget,
  onGenerateInvite
}: BudgetSwitcherOverlayProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [shareTarget, setShareTarget] = useState<BudgetSpace | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setShareTarget(null);
      return;
    }
    const activeIndex = budgets.findIndex((budget) => budget.id === activeBudgetId);
    setFocusedIndex(activeIndex >= 0 ? activeIndex : 0);
  }, [isOpen, budgets, activeBudgetId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (shareTarget) {
          setShareTarget(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, shareTarget, onClose]);

  if (!isOpen) return null;

  const currentCard = budgets[focusedIndex] ?? budgets[0];
  const nextCard =
    budgets.length > 1 ? budgets[(focusedIndex + 1) % budgets.length] : undefined;

  const goPrevious = () => {
    if (budgets.length <= 1) return;
    setFocusedIndex((prev) => (prev - 1 + budgets.length) % budgets.length);
  };

  const goNext = () => {
    if (budgets.length <= 1) return;
    setFocusedIndex((prev) => (prev + 1) % budgets.length);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    if (delta > 40) {
      goPrevious();
    } else if (delta < -40) {
      goNext();
    }
    touchStartX.current = null;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sélecteur d’espace budget"
      className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col justify-between bg-slate-900/65 p-4 backdrop-blur-[2px]"
    >
      <div className="flex items-center justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le sélecteur d'espace"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-lg transition-transform active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 px-4 text-center">
        <p className="text-sm font-semibold text-white/95 drop-shadow">
          Swipez vers la gauche ou vers la droite pour changer d&apos;espace
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onCreateNewBudget}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nouvel espace budget
          </button>
          {onJoinBudget ? (
            <button
              type="button"
              onClick={onJoinBudget}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Rejoindre un espace
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="space-y-2 pb-4"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {budgets.length > 1 ? (
          <div className="flex items-center justify-between px-1 text-white/90">
            <button
              type="button"
              onClick={goPrevious}
              aria-label="Espace budget précédent"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-xs font-medium tabular-nums">
              {focusedIndex + 1} / {budgets.length}
            </span>
            <button
              type="button"
              onClick={goNext}
              aria-label="Espace budget suivant"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : null}

        {currentCard ? (
          <div className="rounded-3xl bg-gradient-to-br from-purple-600 via-pink-500 to-cyan-400 p-5 text-white shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-white/90">Espace Budget :</p>
                <p className="mt-1 text-xl font-bold">{currentCard.name}</p>
                <p className="mt-1 text-[11px] font-medium text-white/85">
                  {currentCard.type === 'shared' ? 'Budget partagé' : 'Budget personnel'} · Cycle
                  le {currentCard.budgetStartDay}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShareTarget(currentCard)}
                  aria-label={`Partager ${currentCard.name}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm transition-transform active:scale-95"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenSettings(currentCard)}
                  aria-label={`Options pour ${currentCard.name}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm transition-transform active:scale-95"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              {currentCard.id === activeBudgetId ? (
                <span className="text-sm font-semibold text-white">Espace actuel</span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onSelectBudget(currentCard.id);
                    onClose();
                  }}
                  className="min-h-11 rounded-full bg-white/25 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/35"
                >
                  Accéder
                </button>
              )}
            </div>
          </div>
        ) : null}

        {nextCard ? (
          <button
            type="button"
            onClick={() => {
              onSelectBudget(nextCard.id);
              onClose();
            }}
            className="flex min-h-12 w-full items-center justify-between rounded-3xl bg-white/20 px-5 py-3 text-left text-white/90 backdrop-blur-md transition-colors hover:bg-white/30"
          >
            <span className="text-sm font-semibold">{nextCard.name}</span>
            <span className="text-xs font-bold uppercase tracking-wide">Accéder</span>
          </button>
        ) : null}
      </div>

      <ShareBudgetModal
        isOpen={Boolean(shareTarget)}
        budget={shareTarget}
        onGenerateInvite={onGenerateInvite}
        onClose={() => setShareTarget(null)}
      />
    </div>
  );
}
