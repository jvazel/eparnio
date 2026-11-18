import { CheckCircle2, Users } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import type { MemberBreakdownItem } from '../../types/budget.types';
import { formatCurrency } from '../../utils/format';

export interface SettlementSuggestion {
  fromName: string;
  toName: string;
  amount: number;
}

/**
 * Calcule la régularisation minimale entre membres pour équilibrer les dépenses du mois.
 */
export function computeSettlementSuggestion(
  members: MemberBreakdownItem[]
): SettlementSuggestion | null {
  if (members.length < 2) return null;
  const totalExpenses = members.reduce((acc, m) => acc + m.expensesPaid, 0);
  if (totalExpenses <= 0) return null;

  const fairShare = totalExpenses / members.length;
  const balances = members.map((m) => ({
    name: m.displayName,
    diff: Math.round((m.expensesPaid - fairShare) * 100) / 100
  }));

  const debtor = [...balances].sort((a, b) => a.diff - b.diff)[0];
  const creditor = [...balances].sort((a, b) => b.diff - a.diff)[0];
  if (!debtor || !creditor || debtor.diff >= -0.01 || creditor.diff <= 0.01) {
    return null;
  }

  const amount = Math.round(Math.min(Math.abs(debtor.diff), creditor.diff) * 100) / 100;
  if (amount <= 0) return null;

  return {
    fromName: debtor.name,
    toName: creditor.name,
    amount
  };
}

export interface MemberBreakdownCardProps {
  members: MemberBreakdownItem[];
  currentUserId?: string;
}

/**
 * Carte d'analyse comparée par membre affichée sur l'onglet « Budget »
 * lorsque l'espace actif est un budget partagé (`shared`).
 */
export function MemberBreakdownCard({ members, currentUserId }: MemberBreakdownCardProps) {
  const [isSettled, setIsSettled] = useState(false);

  if (members.length === 0) {
    return null;
  }

  const settlement = computeSettlementSuggestion(members);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600"
            aria-hidden="true"
          >
            <Users className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">Bilan par membre</h2>
        </div>
        <Badge tone="violet">Budget partagé</Badge>
      </div>

      {settlement ? (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
          {isSettled ? (
            <span className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Équilibre réglé pour ce mois
            </span>
          ) : (
            <>
              <span>
                <strong>{settlement.fromName}</strong> doit{' '}
                <strong className="tabular-nums">{formatCurrency(settlement.amount)}</strong> à{' '}
                <strong>{settlement.toName}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsSettled(true)}
                className="shrink-0 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-700"
              >
                Marquer comme réglé
              </button>
            </>
          )}
        </div>
      ) : null}

      <ul className="space-y-3">
        {members.map((member) => {
          const isSelf = Boolean(currentUserId && member.userId === currentUserId);
          return (
            <li
              key={member.userId}
              className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-white text-base shadow-sm"
                    style={{ borderColor: member.color }}
                    aria-hidden="true"
                  >
                    {member.avatarEmoji}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: member.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm font-bold text-slate-900">
                        {member.displayName}
                      </span>
                      {isSelf && <Badge tone="neutral">Moi</Badge>}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Part apports :{' '}
                      <span className="font-semibold tabular-nums">
                        {member.incomeSharePercentage.toFixed(1)}%
                      </span>{' '}
                      · Part paiements :{' '}
                      <span className="font-semibold tabular-nums">
                        {member.expensesSharePercentage.toFixed(1)}%
                      </span>
                    </p>
                  </div>
                </div>

                <Badge tone={member.netBalance >= 0 ? 'emerald' : 'red'}>
                  {member.netBalance >= 0 ? '+' : ''}
                  {formatCurrency(member.netBalance)}
                </Badge>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-slate-200/70 pt-2 text-xs">
                <div>
                  <p className="text-[11px] text-slate-500">Apports versés</p>
                  <p className="font-bold tabular-nums text-emerald-700">
                    {formatCurrency(member.incomeContributed)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-500">Dépenses réglées</p>
                  <p className="font-bold tabular-nums text-slate-900">
                    {formatCurrency(member.expensesPaid)}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
