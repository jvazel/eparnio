import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Camera, Check, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { getApiErrorMessage } from '../../services/api';
import {
  applyBudgetTemplate,
  createBudgetTemplate,
  deleteBudgetTemplate,
  fetchBudgetTemplates,
  updateBudgetTemplate,
  type ApplyTemplateResult,
  type BudgetTemplate,
  type BudgetTemplateItem
} from '../../services/budgetTemplate.service';

const euroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR'
});

function formatEuro(amount: number): string {
  return euroFormatter.format(amount);
}

export interface AvailableTemplateEnvelope {
  id: string;
  pillar: 'variable_envelope' | 'savings';
  name: string;
  icon: string;
  color: string;
  allocatedAmount: number;
  linkedGoalId?: string;
}

export interface BudgetTemplatesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  budgetId: string | null;
  activePeriodId?: string | null;
  activePeriodLabel?: string;
  availableEnvelopes?: AvailableTemplateEnvelope[];
}

type SheetView = 'list' | 'snapshot' | 'edit' | 'preview';

const TEMPLATE_ICONS = ['🎭', '🌿', '❄️', '✈️', '🎉', '🛡️', '📚', '💼'];

/**
 * Tiroir Mobile-First de gestion et d'application des Scénarios / Modèles de Budget
 * (Mois Normal, Mois Serré, Vacances...) avec aperçu Avant/Après obligatoire.
 */
export function BudgetTemplatesSheet({
  isOpen,
  onClose,
  budgetId,
  activePeriodId = null,
  activePeriodLabel,
  availableEnvelopes = []
}: BudgetTemplatesSheetProps) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<SheetView>('list');
  const [editingTemplate, setEditingTemplate] = useState<BudgetTemplate | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎭');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<BudgetTemplateItem[]>([]);
  const [previewResult, setPreviewResult] = useState<ApplyTemplateResult | null>(null);
  const [selectedTemplateForApply, setSelectedTemplateForApply] = useState<BudgetTemplate | null>(
    null
  );
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['budget-templates', budgetId],
    queryFn: () => fetchBudgetTemplates(budgetId!),
    enabled: isOpen && Boolean(budgetId)
  });

  useEffect(() => {
    if (!isOpen) return;
    setView('list');
    setEditingTemplate(null);
    setPreviewResult(null);
    setSelectedTemplateForApply(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [isOpen]);

  const handleOpenSnapshot = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setName('');
    setIcon('🌿');
    setDescription('');
    setView('snapshot');
  };

  const handleOpenEdit = (tpl: BudgetTemplate | null) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEditingTemplate(tpl);
    if (tpl) {
      setName(tpl.name);
      setIcon(tpl.icon);
      setDescription(tpl.description ?? '');
      setItems(tpl.items.map((item) => ({ ...item })));
    } else {
      setName('');
      setIcon('🎭');
      setDescription('');
      setItems([
        {
          pillar: 'variable_envelope',
          name: 'Courses',
          icon: '🛒',
          color: '#22C55E',
          allocatedAmount: 300
        }
      ]);
    }
    setView('edit');
  };

  const handleSaveSnapshot = async () => {
    if (!budgetId || !activePeriodId) return;
    if (!name.trim()) {
      setErrorMessage('Veuillez saisir un nom pour ce scénario.');
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    try {
      await createBudgetTemplate(budgetId, {
        name: name.trim(),
        icon,
        description: description.trim() || undefined,
        sourcePeriodId: activePeriodId
      });
      await queryClient.invalidateQueries({ queryKey: ['budget-templates', budgetId] });
      setSuccessMessage(`Scénario « ${name.trim()} » enregistré depuis ce mois.`);
      setView('list');
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, 'Impossible de créer ce scénario.'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveForm = async () => {
    if (!budgetId) return;
    if (!name.trim()) {
      setErrorMessage('Veuillez saisir un nom pour ce scénario.');
      return;
    }

    const sanitizedItems = items
      .filter((item) => item.name.trim().length > 0)
      .map((item, idx) => ({
        ...item,
        name: item.name.trim(),
        allocatedAmount: Math.max(0, Number(item.allocatedAmount) || 0),
        order: idx
      }));

    setIsBusy(true);
    setErrorMessage(null);
    try {
      if (editingTemplate) {
        await updateBudgetTemplate(budgetId, editingTemplate.id, {
          name: name.trim(),
          icon,
          description: description.trim() || null,
          items: sanitizedItems
        });
      } else {
        await createBudgetTemplate(budgetId, {
          name: name.trim(),
          icon,
          description: description.trim() || undefined,
          items: sanitizedItems
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['budget-templates', budgetId] });
      setView('list');
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, 'Impossible d’enregistrer ce scénario.'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async (tpl: BudgetTemplate) => {
    if (!budgetId) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await deleteBudgetTemplate(budgetId, tpl.id);
      await queryClient.invalidateQueries({ queryKey: ['budget-templates', budgetId] });
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, 'Impossible de supprimer ce scénario.'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpenPreview = async (tpl: BudgetTemplate) => {
    if (!activePeriodId) {
      setErrorMessage('Aucune période active pour appliquer ce scénario.');
      return;
    }
    setIsBusy(true);
    setErrorMessage(null);
    setSelectedTemplateForApply(tpl);
    try {
      const result = await applyBudgetTemplate(activePeriodId, tpl.id, true);
      setPreviewResult(result);
      setView('preview');
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, 'Impossible de calculer l’aperçu du scénario.'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmApply = async () => {
    if (!activePeriodId || !selectedTemplateForApply) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await applyBudgetTemplate(activePeriodId, selectedTemplateForApply.id, false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['period'] }),
        queryClient.invalidateQueries({ queryKey: ['envelopes'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['goals'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar'] })
      ]);
      setSuccessMessage(`Scénario « ${selectedTemplateForApply.name} » appliqué avec succès.`);
      setView('list');
    } catch (err) {
      setErrorMessage(getApiErrorMessage(err, 'Impossible d’appliquer ce scénario.'));
    } finally {
      setIsBusy(false);
    }
  };

  const templates = templatesQuery.data ?? [];

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        view === 'list'
          ? 'Scénarios de budget'
          : view === 'snapshot'
            ? 'Enregistrer ce mois en scénario'
            : view === 'edit'
              ? editingTemplate
                ? 'Modifier le scénario'
                : 'Nouveau scénario'
              : `Aperçu · ${selectedTemplateForApply?.name ?? ''}`
      }
    >
      <div className="space-y-4 pb-2">
        {view === 'list' ? (
          <>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Préparez des modèles (Mois Normal, Mois Serré, Vacances) pour adapter vos
              enveloppes variables et votre épargne mensuelle en 1 tap.
            </p>

            <div className="flex flex-col gap-2">
              {activePeriodId ? (
                <Button
                  type="button"
                  variant="primary"
                  fullWidth
                  disabled={isBusy}
                  onClick={handleOpenSnapshot}
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  Enregistrer ce mois comme scénario
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={isBusy}
                onClick={() => handleOpenEdit(null)}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Créer un scénario de zéro
              </Button>
            </div>

            {templatesQuery.isLoading ? (
              <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                Chargement des scénarios…
              </p>
            ) : templates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-center dark:border-slate-700 dark:bg-slate-800/40">
                <Layers
                  className="mx-auto h-6 w-6 text-slate-400 dark:text-slate-500"
                  aria-hidden="true"
                />
                <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Aucun scénario enregistré
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Capturez votre mois actuel en 1 tap pour créer votre premier modèle.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-lg dark:bg-violet-950/60">
                          {tpl.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">
                            {tpl.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {tpl.items.length} poste(s) · {formatEuro(tpl.totalAllocatedAmount)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Modifier ${tpl.name}`}
                          onClick={() => handleOpenEdit(tpl)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Supprimer ${tpl.name}`}
                          disabled={isBusy}
                          onClick={() => {
                            void handleDelete(tpl);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {activePeriodId ? (
                      <div className="mt-3">
                        <Button
                          type="button"
                          variant="violet"
                          fullWidth
                          disabled={isBusy}
                          onClick={() => {
                            void handleOpenPreview(tpl);
                          }}
                        >
                          Appliquer{activePeriodLabel ? ` sur ${activePeriodLabel}` : ''}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}

        {view === 'snapshot' ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Toutes vos enveloppes variables et allocations d’épargne du mois actif seront
              capturées dans ce scénario.
            </p>
            <div>
              <label
                htmlFor="tpl-snapshot-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Nom du scénario
              </label>
              <input
                id="tpl-snapshot-name"
                type="text"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Mois Normal, Mois Serré, Vacances"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg ${
                    icon === emoji
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/50'
                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setView('list')}
              >
                Retour
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                disabled={isBusy}
                onClick={() => {
                  void handleSaveSnapshot();
                }}
              >
                {isBusy ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        ) : null}

        {view === 'edit' ? (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="tpl-edit-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Nom du scénario
              </label>
              <input
                id="tpl-edit-name"
                type="text"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Mois Serré"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Postes ({items.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setItems((prev) => [
                      ...prev,
                      {
                        pillar: 'variable_envelope',
                        name: '',
                        icon: '💡',
                        color: '#38BDF8',
                        allocatedAmount: 0
                      }
                    ])
                  }
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400"
                >
                  + Ajouter un poste
                </button>
              </div>
              {availableEnvelopes.length > 0 ? (
                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-700 dark:bg-slate-800/40">
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    Choisir parmi vos enveloppes &amp; épargnes du mois :
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableEnvelopes.map((env) => {
                      const alreadyAdded = items.some(
                        (it) =>
                          it.pillar === env.pillar &&
                          it.name.trim().toLowerCase() === env.name.trim().toLowerCase()
                      );
                      return (
                        <button
                          key={env.id}
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() =>
                            setItems((prev) => [
                              ...prev.filter((p) => p.name.trim().length > 0),
                              {
                                pillar: env.pillar,
                                name: env.name,
                                icon: env.icon,
                                color: env.color,
                                allocatedAmount: env.allocatedAmount,
                                ...(env.linkedGoalId ? { linkedGoalId: env.linkedGoalId } : {})
                              }
                            ])
                          }
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                            alreadyAdded
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 opacity-70 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500'
                          }`}
                        >
                          {env.icon} {env.name} {alreadyAdded ? '✓' : '+'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <datalist id="eparnio-template-envelopes-datalist">
                {availableEnvelopes.map((env) => (
                  <option key={env.id} value={env.name} />
                ))}
              </datalist>

              {items.map((item, idx) => (
                <div
                  key={`${item.pillar}-${idx}`}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2 dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <input
                    type="text"
                    list="eparnio-template-envelopes-datalist"
                    aria-label={`Nom du poste ${idx + 1}`}
                    value={item.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      const matched = availableEnvelopes.find(
                        (env) => env.name.toLowerCase() === val.trim().toLowerCase()
                      );
                      setItems((prev) =>
                        prev.map((p, i) =>
                          i === idx
                            ? {
                                ...p,
                                name: val,
                                ...(matched
                                  ? {
                                      pillar: matched.pillar,
                                      icon: matched.icon,
                                      color: matched.color,
                                      ...(matched.linkedGoalId
                                        ? { linkedGoalId: matched.linkedGoalId }
                                        : {})
                                    }
                                  : {})
                              }
                            : p
                        )
                      );
                    }}
                    placeholder="Nom d’enveloppe ou épargne"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    aria-label={`Montant du poste ${idx + 1}`}
                    value={item.allocatedAmount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setItems((prev) =>
                        prev.map((p, i) =>
                          i === idx ? { ...p, allocatedAmount: Number.isFinite(val) ? val : 0 } : p
                        )
                      );
                    }}
                    className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-xs font-semibold tabular-nums text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    aria-label={`Retirer le poste ${idx + 1}`}
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setView('list')}
              >
                Annuler
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                disabled={isBusy}
                onClick={() => {
                  void handleSaveForm();
                }}
              >
                {isBusy ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        ) : null}

        {view === 'preview' && previewResult ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/70">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Reste à répartir</span>
                <p className="mt-0.5 font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {formatEuro(previewResult.summaryBefore.remainingToAllocate)} →{' '}
                  {formatEuro(previewResult.summaryAfter.remainingToAllocate)}
                </p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Reste à vivre</span>
                <p className="mt-0.5 font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {formatEuro(previewResult.summaryBefore.remainingToLive)} →{' '}
                  {formatEuro(previewResult.summaryAfter.remainingToLive)}
                </p>
              </div>
            </div>

            {previewResult.warnings.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/40">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Points d’attention</span>
                </div>
                <ul className="mt-1 space-y-1 text-xs text-amber-800 dark:text-amber-200">
                  {previewResult.warnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
              {previewResult.changes.map((c, idx) => (
                <div
                  key={`${c.pillar}-${c.name}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                      {c.icon} {c.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {c.status === 'created'
                        ? 'Nouvelle enveloppe'
                        : c.status === 'reset_to_zero'
                          ? 'Mise à 0 € · conservée'
                          : c.status === 'updated'
                            ? 'Montant ajusté'
                            : 'Inchangé'}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatEuro(c.previousAmount)} → {formatEuro(c.newAmount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={isBusy}
                onClick={() => setView('list')}
              >
                Retour
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                disabled={isBusy}
                onClick={() => {
                  void handleConfirmApply();
                }}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {isBusy ? 'Application…' : 'Appliquer ce scénario'}
              </Button>
            </div>
          </div>
        ) : null}

        {successMessage ? (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
          >
            {successMessage}
          </p>
        ) : null}

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
