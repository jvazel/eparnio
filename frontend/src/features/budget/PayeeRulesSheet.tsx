import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { getApiErrorMessage } from '../../services/api';
import {
  createPayeeRule,
  deletePayeeRule,
  fetchPayeeRules,
  reorderPayeeRules,
  updatePayeeRule
} from '../../services/payeeRule.service';
import {
  applyPayeeRules,
  type EnvelopeMatchCandidate,
  type PayeeMatchType,
  type PayeeRule
} from '../../utils/applyPayeeRules';

export interface PayeeRulesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  budgetId: string | null;
  availableEnvelopes?: EnvelopeMatchCandidate[];
}

/**
 * Hub Mobile-First de gestion des Règles d'Auto-Catégorisation (Payee Rules)
 * avec création, activation/désactivation, priorité et testeur de libellé en direct.
 */
export function PayeeRulesSheet({
  isOpen,
  onClose,
  budgetId,
  availableEnvelopes = []
}: PayeeRulesSheetProps) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [pattern, setPattern] = useState('');
  const [matchType, setMatchType] = useState<PayeeMatchType>('contains');
  const [targetEnvelopeName, setTargetEnvelopeName] = useState('');
  const [renameLabel, setRenameLabel] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [autoExcludeFromImport, setAutoExcludeFromImport] = useState(false);
  const [testLabel, setTestLabel] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rulesQuery = useQuery({
    queryKey: ['payee-rules', budgetId],
    queryFn: () => fetchPayeeRules(budgetId!),
    enabled: isOpen && Boolean(budgetId)
  });

  const rules = rulesQuery.data ?? [];

  const testResult = useMemo(() => {
    if (!testLabel.trim()) return null;
    return applyPayeeRules(testLabel, 'expense', rules, availableEnvelopes);
  }, [testLabel, rules, availableEnvelopes]);

  const handleCreate = async () => {
    if (!budgetId) return;
    if (!pattern.trim()) {
      setErrorMessage('Veuillez saisir le texte à rechercher (ex. CARREFOUR).');
      return;
    }

    const addTags = tagsInput
      .split(/[\s,;]+/)
      .map((t) => t.replace(/^#+/, '').trim())
      .filter(Boolean);

    setIsBusy(true);
    setErrorMessage(null);
    try {
      await createPayeeRule(budgetId, {
        pattern: pattern.trim(),
        matchType,
        ...(targetEnvelopeName.trim() ? { targetEnvelopeName: targetEnvelopeName.trim() } : {}),
        ...(renameLabel.trim() ? { renameLabel: renameLabel.trim() } : {}),
        addTags,
        autoExcludeFromImport
      });
      await queryClient.invalidateQueries({ queryKey: ['payee-rules', budgetId] });
      setPattern('');
      setTargetEnvelopeName('');
      setRenameLabel('');
      setTagsInput('');
      setAutoExcludeFromImport(false);
      setIsCreating(false);
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, 'Impossible de créer cette règle.'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleActive = async (rule: PayeeRule) => {
    if (!budgetId) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await updatePayeeRule(budgetId, rule.id, { isActive: !rule.isActive });
      await queryClient.invalidateQueries({ queryKey: ['payee-rules', budgetId] });
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, 'Impossible de mettre à jour cette règle.'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!budgetId) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await deletePayeeRule(budgetId, ruleId);
      await queryClient.invalidateQueries({ queryKey: ['payee-rules', budgetId] });
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, 'Impossible de supprimer cette règle.'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (!budgetId) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= rules.length) return;
    const reordered = [...rules];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    setIsBusy(true);
    try {
      await reorderPayeeRules(
        budgetId,
        reordered.map((r) => r.id)
      );
      await queryClient.invalidateQueries({ queryKey: ['payee-rules', budgetId] });
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, 'Impossible de réordonner les règles.'));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Règles d’auto-catégorisation"
    >
      <div className="space-y-4 pb-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Triez automatiquement vos imports CSV et accélérez votre saisie : la première règle
          active correspondante s’applique.
        </p>

        {!isCreating ? (
          <Button
            type="button"
            variant="primary"
            fullWidth
            onClick={() => {
              setErrorMessage(null);
              setIsCreating(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nouvelle règle
          </Button>
        ) : (
          <div className="space-y-2.5 rounded-2xl border border-blue-200 bg-blue-50/40 p-3.5 dark:border-blue-900/60 dark:bg-blue-950/30">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Créer une règle (SI … ALORS …)
            </p>
            <input
              type="text"
              aria-label="Texte à rechercher"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="SI le libellé contient… (ex. CARREFOUR)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <div className="flex gap-1.5">
              {(
                [
                  { id: 'contains', label: 'Contient' },
                  { id: 'starts_with', label: 'Commence par' },
                  { id: 'exact', label: 'Exact' }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMatchType(opt.id)}
                  className={`flex-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${
                    matchType === opt.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              aria-label="Enveloppe cible"
              value={targetEnvelopeName}
              onChange={(e) => setTargetEnvelopeName(e.target.value)}
              placeholder="ALORS enveloppe (ex. Courses)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              aria-label="Renommer le libellé en"
              value={renameLabel}
              onChange={(e) => setRenameLabel(e.target.value)}
              placeholder="Renommer en (optionnel, ex. Carrefour)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              aria-label="Tags à ajouter"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Tags (optionnel, ex. alimentation, promo)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={autoExcludeFromImport}
                onChange={(e) => setAutoExcludeFromImport(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Exclure automatiquement lors de l’import CSV</span>
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setIsCreating(false)}
              >
                Annuler
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                disabled={isBusy}
                onClick={() => {
                  void handleCreate();
                }}
              >
                Enregistrer
              </Button>
            </div>
          </div>
        )}

        {/* Testeur de libellé en direct */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <label
            htmlFor="payee-rule-tester"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Tester un libellé en direct
          </label>
          <input
            id="payee-rule-tester"
            type="text"
            value={testLabel}
            onChange={(e) => setTestLabel(e.target.value)}
            placeholder="Ex. CB CARREFOUR MARKET 14/11"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          {testLabel.trim() ? (
            <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-200">
              {testResult ? (
                testResult.autoExcludeFromImport ? (
                  <>🚫 Exclue à l’import (règle « {testResult.matchedRule.pattern} »)</>
                ) : (
                  <>
                    ⚡ Match :{' '}
                    {[
                      testResult.matchedRule.targetEnvelopeName,
                      testResult.renameLabel ? `« ${testResult.renameLabel} »` : null,
                      testResult.addTags.map((t) => `#${t}`).join(' ') || null
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </>
                )
              ) : (
                'Aucune règle active ne correspond à ce libellé.'
              )}
            </p>
          ) : null}
        </div>

        {/* Liste des règles */}
        {rules.length === 0 ? (
          <p className="py-3 text-center text-xs text-slate-500 dark:text-slate-400">
            Aucune règle configurée pour le moment.
          </p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule, idx) => (
              <div
                key={rule.id}
                className={`rounded-2xl border p-3 transition-opacity ${
                  rule.isActive
                    ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                    : 'border-slate-200/60 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-50">
                      <Zap className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                      <span className="truncate">« {rule.pattern} »</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {rule.autoExcludeFromImport
                        ? '🚫 Exclure à l’import CSV'
                        : [
                            rule.targetEnvelopeName ? `→ ${rule.targetEnvelopeName}` : null,
                            rule.renameLabel ? `Renommer : ${rule.renameLabel}` : null,
                            rule.addTags.length > 0
                              ? rule.addTags.map((t) => `#${t}`).join(' ')
                              : null
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Monter ${rule.pattern}`}
                      disabled={isBusy || idx === 0}
                      onClick={() => {
                        void handleMove(idx, -1);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Descendre ${rule.pattern}`}
                      disabled={isBusy || idx === rules.length - 1}
                      onClick={() => {
                        void handleMove(idx, 1);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Basculer ${rule.pattern}`}
                      disabled={isBusy}
                      onClick={() => {
                        void handleToggleActive(rule);
                      }}
                      className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {rule.isActive ? 'Actif' : 'Inactif'}
                    </button>
                    <button
                      type="button"
                      aria-label={`Supprimer ${rule.pattern}`}
                      disabled={isBusy}
                      onClick={() => {
                        void handleDelete(rule.id);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
