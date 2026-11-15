import { useQueryClient } from '@tanstack/react-query';
import { Link2, UserPlus } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { getApiErrorMessage } from '../../services/api';
import { extractInviteCodeFromInput, joinBudgetByCode } from '../../services/budget.service';
import type { BudgetSpace } from '../../types/budget.types';

export interface InvitePartnerSheetProps {
  isOpen: boolean;
  initialCode?: string;
  onClose: () => void;
  onJoined: (budget: BudgetSpace) => void;
}

/**
 * Tiroir permettant de rejoindre un budget partagé à l'aide d'un code ou d'une URL d'invitation.
 */
export function InvitePartnerSheet({
  isOpen,
  initialCode = '',
  onClose,
  onJoined
}: InvitePartnerSheetProps) {
  const queryClient = useQueryClient();
  const [rawInput, setRawInput] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRawInput(initialCode);
      setError(null);
    }
  }, [isOpen, initialCode]);

  const extractedCode = extractInviteCodeFromInput(rawInput);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!extractedCode || extractedCode.length < 4) {
      setError('Veuillez saisir un code d’invitation valide ou coller le lien reçu.');
      return;
    }

    setIsJoining(true);
    try {
      const response = await joinBudgetByCode(extractedCode);
      await queryClient.invalidateQueries({ queryKey: ['budgets'] });
      onJoined(response.budget);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de rejoindre cet espace avec ce code.'));
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Rejoindre un espace partagé">
      <form onSubmit={handleSubmit} className="space-y-4 pb-2">
        <div className="flex items-start gap-3 rounded-2xl bg-violet-50/70 p-3.5 text-xs leading-relaxed text-violet-900">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm">
            <Link2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <p>
            Collez le lien complet reçu par SMS/WhatsApp ou tapez directement le code
            d’invitation de votre partenaire ou colocataire.
          </p>
        </div>

        <div>
          <label
            htmlFor="invite-code-input"
            className="mb-1 block text-xs font-semibold text-slate-600"
          >
            Code ou lien d’invitation
          </label>
          <input
            id="invite-code-input"
            name="inviteCode"
            type="text"
            autoComplete="off"
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
            placeholder="Ex. AB12CD34 ou https://.../?invite=AB12CD34"
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          {extractedCode ? (
            <div className="mt-2">
              <Badge tone="violet">Code détecté : {extractedCode}</Badge>
            </div>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-xs font-medium text-red-600">
            {error}
          </p>
        ) : null}

        <div className="space-y-2 pt-1">
          <Button type="submit" fullWidth disabled={isJoining}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {isJoining ? 'Connexion à l’espace...' : 'Rejoindre cet espace'}
          </Button>
          <Button type="button" variant="ghost" fullWidth onClick={onClose}>
            Annuler
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
