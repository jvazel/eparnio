import { RefreshCw, ShieldCheck, UserMinus, Users } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { BudgetMember, BudgetMemberRole } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';

export interface MembersListProps {
  members: BudgetMember[];
  ownerId: string;
  currentUserId?: string;
  inviteCode?: string;
  isBusy?: boolean;
  onChangeMemberRole?: (userId: string, role: Extract<BudgetMemberRole, 'editor' | 'viewer'>) => Promise<void> | void;
  onRemoveMember?: (userId: string) => Promise<void> | void;
  onRegenerateInvite?: () => Promise<void> | void;
}

const ROLE_LABELS: Record<BudgetMemberRole, string> = {
  owner: 'Propriétaire',
  editor: 'Éditeur',
  viewer: 'Lecteur'
};

const ROLE_TONES: Record<BudgetMemberRole, 'violet' | 'blue' | 'neutral'> = {
  owner: 'violet',
  editor: 'blue',
  viewer: 'neutral'
};

/**
 * Liste et gestion des membres d'un espace budgétaire (rôles, révocation/régénération du code, retrait).
 */
export function MembersList({
  members,
  ownerId,
  currentUserId,
  inviteCode,
  isBusy = false,
  onChangeMemberRole,
  onRemoveMember,
  onRegenerateInvite
}: MembersListProps) {
  const isOwner = Boolean(currentUserId && ownerId === currentUserId);
  const currentMember = members.find((m) => m.userId === currentUserId);

  return (
    <section aria-label="Membres de l’espace budget" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Users className="h-4 w-4" aria-hidden="true" />
          </span>
          <h3 className="text-sm font-bold text-slate-900">
            Membres ({members.length})
          </h3>
        </div>
        {inviteCode ? (
          <Badge tone="violet">Code : {inviteCode}</Badge>
        ) : null}
      </div>

      <ul className="space-y-2">
        {members.map((member, index) => {
          const isMe = member.userId === currentUserId;
          const isMemberOwner = member.userId === ownerId || member.role === 'owner';
          const name =
            member.displayName?.trim() || (isMe ? 'Moi' : `Membre ${index + 1}`);

          return (
            <li
              key={member.userId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-3"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 bg-white text-lg shadow-sm"
                  style={{ borderColor: member.color }}
                  aria-hidden="true"
                >
                  {member.avatarEmoji || '🧑'}
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900">{name}</span>
                    {isMe ? (
                      <span className="text-[11px] font-semibold text-violet-600">(Vous)</span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={ROLE_TONES[member.role]}>
                      {isMemberOwner ? <ShieldCheck className="h-3 w-3" aria-hidden="true" /> : null}
                      {ROLE_LABELS[member.role]}
                    </Badge>
                    {member.declaredMonthlyIncome > 0 ? (
                      <span className="text-[11px] font-medium tabular-nums text-slate-500">
                        Revenu : {formatCurrency(member.declaredMonthlyIncome)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {isOwner && !isMemberOwner ? (
                <div className="flex items-center gap-1.5">
                  {onChangeMemberRole ? (
                    <label className="sr-only" htmlFor={`role-${member.userId}`}>
                      Rôle de {name}
                    </label>
                  ) : null}
                  {onChangeMemberRole ? (
                    <select
                      id={`role-${member.userId}`}
                      aria-label={`Rôle de ${name}`}
                      value={member.role === 'viewer' ? 'viewer' : 'editor'}
                      disabled={isBusy}
                      onChange={(event) => {
                        const nextRole = event.target.value as 'editor' | 'viewer';
                        void onChangeMemberRole(member.userId, nextRole);
                      }}
                      className="min-h-11 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 focus:border-violet-500 focus:outline-none"
                    >
                      <option value="editor">Éditeur</option>
                      <option value="viewer">Lecteur</option>
                    </select>
                  ) : null}

                  {onRemoveMember ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      aria-label={`Retirer ${name}`}
                      onClick={() => void onRemoveMember(member.userId)}
                      className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-red-50 px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                    >
                      <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Retirer</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {isOwner && onRegenerateInvite ? (
        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={isBusy}
          onClick={() => void onRegenerateInvite()}
        >
          <RefreshCw className={`h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} aria-hidden="true" />
          {inviteCode ? 'Régénérer le code (révoquer l’ancien lien)' : 'Générer un lien d’invitation'}
        </Button>
      ) : null}

      {!isOwner && currentMember && currentUserId && onRemoveMember ? (
        <Button
          type="button"
          variant="danger"
          fullWidth
          disabled={isBusy}
          onClick={() => void onRemoveMember(currentUserId)}
        >
          <UserMinus className="h-4 w-4" aria-hidden="true" />
          Quitter cet espace partagé
        </Button>
      ) : null}
    </section>
  );
}
