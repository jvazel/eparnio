import { Check, Copy, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { buildQrMatrix } from '../../utils/qrCode';

export interface QrCodeModalProps {
  isOpen: boolean;
  budgetName: string;
  inviteCode: string;
  inviteUrl: string;
  isGenerating?: boolean;
  onRegenerate?: () => Promise<void> | void;
  onClose: () => void;
}

/**
 * Modale affichant le QR Code SVG scannable (100 % généré côté client) et le code d'invitation.
 */
export function QrCodeModal({
  isOpen,
  budgetName,
  inviteCode,
  inviteUrl,
  isGenerating = false,
  onRegenerate,
  onClose
}: QrCodeModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen, inviteCode]);

  const { viewBoxSize, pathData } = useMemo(() => {
    const matrix = buildQrMatrix(inviteUrl);
    const margin = 2;
    const total = matrix.length + margin * 2;
    const segments: string[] = [];

    for (let r = 0; r < matrix.length; r += 1) {
      for (let c = 0; c < matrix.length; c += 1) {
        if (matrix[r][c]) {
          segments.push(`M${c + margin} ${r + margin}h1v1h-1z`);
        }
      }
    }

    return {
      viewBoxSize: total,
      pathData: segments.join('')
    };
  }, [inviteUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(inviteUrl);
    } catch {
      // Ignore les environnements sans presse-papiers actif
    }
    setCopied(true);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="QR Code d’invitation">
      <div className="space-y-4 text-center">
        <p className="text-xs leading-relaxed text-slate-500">
          Faites scanner ce QR Code à votre proche ou transmettez le code ci-dessous pour rejoindre{' '}
          <strong className="font-semibold text-slate-800">{budgetName}</strong>.
        </p>

        <div className="mx-auto flex w-fit flex-col items-center rounded-3xl border border-slate-100 bg-white p-5 shadow-card">
          <svg
            role="img"
            aria-label={`QR Code d’invitation pour ${budgetName}`}
            viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
            className="h-48 w-48 rounded-xl bg-white"
            shapeRendering="crispEdges"
          >
            <rect width={viewBoxSize} height={viewBoxSize} fill="#FFFFFF" />
            <path d={pathData} fill="#0F172A" />
          </svg>

          <div className="mt-3 rounded-xl bg-violet-50 px-3.5 py-1.5">
            <span className="text-[11px] font-medium text-violet-600">Code d’invitation : </span>
            <span className="font-mono text-sm font-bold tracking-wider text-violet-900">
              {inviteCode}
            </span>
          </div>
        </div>

        <p className="break-all rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          {inviteUrl}
        </p>

        {copied ? (
          <p
            role="status"
            aria-live="polite"
            className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
          >
            URL d’invitation copiée !
          </p>
        ) : null}

        <div className="space-y-2.5 pt-1">
          <Button type="button" fullWidth onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                Lien copié
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copier le lien complet
              </>
            )}
          </Button>

          {onRegenerate ? (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={isGenerating}
              onClick={() => void onRegenerate()}
            >
              <RefreshCw
                className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {isGenerating ? 'Génération...' : 'Régénérer un nouveau code'}
            </Button>
          ) : null}

          <Button type="button" variant="ghost" fullWidth onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
