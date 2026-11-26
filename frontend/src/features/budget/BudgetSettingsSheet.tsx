import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Database, Layers, Plus, Scale, Settings, Smartphone, Trash2, Users, Zap } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { MembersList } from '../shared-budget/MembersList';
import { getApiErrorMessage } from '../../services/api';
import {
  createBudget,
  deleteBudget,
  generateBudgetInvite,
  removeBudgetMember,
  updateBudget,
  updateContributionSplit
} from '../../services/budget.service';
import type {
  BudgetMemberRole,
  BudgetPeriod,
  BudgetSpace,
  BudgetType,
  EnvelopeItem,
  PeriodAnalytics,
  SavingsGoalItem
} from '../../types/budget.types';
import {
  downloadBudgetCsv,
  downloadBudgetJsonBackup,
  downloadPeriodPdfReport
} from '../../utils/exportReport';
import { ExportActionsCard } from './ExportActionsCard';
import { ApplePayShortcutGuideSheet } from './ApplePayShortcutGuideSheet';
import { BudgetTemplatesSheet } from './BudgetTemplatesSheet';
import { JsonImportSheet } from './JsonImportSheet';
import { PayeeRulesSheet } from './PayeeRulesSheet';

export interface BudgetSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  budget: BudgetSpace | null;
  initialMode?: 'edit' | 'create';
  canDelete: boolean;
  currentUserId?: string;
  activePeriod?: BudgetPeriod | null;
  activeAnalytics?: PeriodAnalytics | null;
  activeEnvelopes?: EnvelopeItem[];
  activeGoals?: SavingsGoalItem[];
  onBudgetCreated: (budget: BudgetSpace) => void;
  onBudgetDeleted: (budgetId: string) => void;
  onOpenCalculator?: (budget: BudgetSpace) => void;
}

/**
 * Tiroir de configuration d'un espace budgétaire (ouvert via le bouton `•••` du BudgetSwitcher)
 * ou création d'un nouvel espace personnel / partagé.
 */
export function BudgetSettingsSheet({
  isOpen,
  onClose,
  budget,
  initialMode = 'edit',
  canDelete,
  currentUserId,
  activePeriod,
  activeAnalytics,
  activeEnvelopes = [],
  activeGoals = [],
  onBudgetCreated,
  onBudgetDeleted,
  onOpenCalculator
}: BudgetSettingsSheetProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'edit' | 'create'>(initialMode);
  const [activeBudgetState, setActiveBudgetState] = useState<BudgetSpace | null>(budget);
  const [name, setName] = useState('');
  const [type, setType] = useState<BudgetType>('personal');
  const [budgetStartDay, setBudgetStartDay] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMemberBusy, setIsMemberBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isJsonImportOpen, setIsJsonImportOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isPayeeRulesOpen, setIsPayeeRulesOpen] = useState(false);
  const [isApplePayGuideOpen, setIsApplePayGuideOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'general' | 'members' | 'data'>('general');

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setActiveSection('general');
    setActiveBudgetState(budget);
    setError(null);
    setConfirmDelete(false);

    if (initialMode === 'edit' && budget) {
      setName(budget.name);
      setType(budget.type);
      setBudgetStartDay(budget.budgetStartDay);
    } else {
      setName('');
      setType('shared');
      setBudgetStartDay(1);
    }
  }, [isOpen, initialMode, budget]);

  const currentBudget = activeBudgetState ?? budget;
  const isOwner = Boolean(currentBudget && currentUserId && currentBudget.ownerId === currentUserId);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Veuillez saisir un nom pour cet espace budget.');
      return;
    }

    if (!Number.isInteger(budgetStartDay) || budgetStartDay < 1 || budgetStartDay > 31) {
      setError('Le jour de début de cycle doit être compris entre 1 et 31.');
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'create') {
        const created = await createBudget({
          name: name.trim(),
          type,
          budgetStartDay
        });
        await queryClient.invalidateQueries({ queryKey: ['budgets'] });
        onBudgetCreated(created);
        onClose();
      } else if (budget) {
        await updateBudget(budget.id, {
          name: name.trim(),
          budgetStartDay
        });
        await queryClient.invalidateQueries({ queryKey: ['budgets'] });
        onClose();
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible d’enregistrer cet espace budgétaire.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!budget) return;
    setError(null);
    setIsSaving(true);
    try {
      await deleteBudget(budget.id);
      await queryClient.invalidateQueries({ queryKey: ['budgets'] });
      onBudgetDeleted(budget.id);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de supprimer cet espace budgétaire.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateInvite = async () => {
    if (!currentBudget) return;
    setError(null);
    setIsMemberBusy(true);
    try {
      const response = await generateBudgetInvite(currentBudget.id);
      setActiveBudgetState(response.budget);
      await queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de générer un lien d’invitation.'));
    } finally {
      setIsMemberBusy(false);
    }
  };

  const handleChangeMemberRole = async (
    targetUserId: string,
    role: Extract<BudgetMemberRole, 'editor' | 'viewer'>
  ) => {
    if (!currentBudget) return;
    setError(null);
    setIsMemberBusy(true);
    try {
      const response = await updateContributionSplit(currentBudget.id, {
        contributionMode: currentBudget.contributionMode,
        members: [{ userId: targetUserId, role }]
      });
      setActiveBudgetState(response.budget);
      await queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de modifier le rôle du membre.'));
    } finally {
      setIsMemberBusy(false);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!currentBudget) return;
    setError(null);
    setIsMemberBusy(true);
    try {
      const response = await removeBudgetMember(currentBudget.id, targetUserId);
      setActiveBudgetState(response.budget);
      await queryClient.invalidateQueries({ queryKey: ['budgets'] });
      if (targetUserId === currentUserId) {
        onBudgetDeleted(currentBudget.id);
        onClose();
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible de retirer ce membre de l’espace.'));
    } finally {
      setIsMemberBusy(false);
    }
  };

  const switchToCreateMode = () => {
    setMode('create');
    setName('');
    setType('shared');
    setBudgetStartDay(1);
    setError(null);
    setConfirmDelete(false);
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Nouvel espace budget' : 'Paramètres de l’espace'}
    >
      <div className="space-y-4 pb-2">
        {mode === 'edit' && currentBudget ? (
          <div
            role="tablist"
            aria-label="Sections des paramètres de l’espace"
            className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/80"
          >
            {(
              [
                { id: 'general', label: 'Général', icon: Settings },
                { id: 'members', label: 'Membres', icon: Users },
                { id: 'data', label: 'Données', icon: Database }
              ] as const
            ).map(({ id, label, icon: Icon }) => {
              const isSelected = activeSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveSection(id)}
                  className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {mode === 'create' || activeSection === 'general' ? (
          <form
            method="post"
            onSubmit={handleSubmit}
            className="space-y-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
          >
            <div>
              <label
                htmlFor="budget-space-name"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Nom de l’espace
              </label>
              <input
                id="budget-space-name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Budget Couple, Vacances..."
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-500"
              />
            </div>

            {mode === 'create' ? (
              <fieldset>
                <legend className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Type d’espace
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold ${
                      type === 'personal'
                        ? 'border-violet-600 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-200'
                        : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="budgetType"
                      value="personal"
                      checked={type === 'personal'}
                      onChange={() => setType('personal')}
                      className="sr-only"
                    />
                    Personnel
                  </label>
                  <label
                    className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold ${
                      type === 'shared'
                        ? 'border-violet-600 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-200'
                        : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="budgetType"
                      value="shared"
                      checked={type === 'shared'}
                      onChange={() => setType('shared')}
                      className="sr-only"
                    />
                    Partagé
                  </label>
                </div>
              </fieldset>
            ) : null}

            <div>
              <label
                htmlFor="budget-space-start-day"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Jour de début du cycle (1 à 31)
              </label>
              <input
                id="budget-space-start-day"
                name="budgetStartDay"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                required
                value={budgetStartDay}
                onChange={(e) => setBudgetStartDay(Number(e.target.value))}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold tabular-nums text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              />
            </div>

            {error ? (
              <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}

            <Button type="submit" fullWidth disabled={isSaving}>
              {isSaving
                ? 'Validation...'
                : mode === 'create'
                  ? 'Créer l’espace'
                  : 'Enregistrer les modifications'}
            </Button>
          </form>
        ) : null}

        {mode === 'edit' && currentBudget && activeSection === 'general' ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Outils intelligents
              </p>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setIsTemplatesOpen(true)}
                  className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300">
                    <Layers className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">
                      Scénarios de budget
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      Mois Normal, Mois Serré, Vacances
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsPayeeRulesOpen(true)}
                  className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
                    <Zap className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">
                      Règles d’auto-catégorisation
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      Tri automatique des imports CSV &amp; saisie
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsApplePayGuideOpen(true)}
                  className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <Smartphone className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">
                      Apple Pay &amp; Raccourcis
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      Saisie express via Raccourcis iOS / Partage
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </button>

                {onOpenCalculator ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCalculator(currentBudget);
                    }}
                    className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">
                      <Scale className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">
                        Calculateur 50/50 &amp; Prorata
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        Répartir équitablement les apports
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <Button variant="secondary" fullWidth onClick={switchToCreateMode}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Créer un nouvel espace budget
              </Button>

              {canDelete && isOwner ? (
                confirmDelete ? (
                  <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/40">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                      Supprimer définitivement « {currentBudget.name} » ?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Annuler
                      </Button>
                      <Button
                        variant="danger"
                        className="flex-1"
                        disabled={isSaving}
                        onClick={handleDelete}
                      >
                        Confirmer la suppression
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="danger" fullWidth onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Supprimer cet espace
                  </Button>
                )
              ) : null}
            </div>
          </div>
        ) : null}

        {mode === 'edit' && currentBudget && activeSection === 'members' ? (
          <MembersList
            members={currentBudget.members}
            ownerId={currentBudget.ownerId}
            currentUserId={currentUserId}
            inviteCode={currentBudget.inviteCode}
            isBusy={isMemberBusy}
            onChangeMemberRole={handleChangeMemberRole}
            onRemoveMember={handleRemoveMember}
            onRegenerateInvite={handleRegenerateInvite}
          />
        ) : null}

        {mode === 'edit' && currentBudget && activeSection === 'data' ? (
          <ExportActionsCard
            variant="embedded"
            onExportCsv={() =>
              downloadBudgetCsv(currentBudget.id, {
                budgetName: currentBudget.name,
                ...(activePeriod && activePeriod.budgetId === currentBudget.id
                  ? { periodId: activePeriod.id, periodLabel: activePeriod.label }
                  : {})
              })
            }
            onExportPdf={
              activePeriod &&
              activeAnalytics &&
              activePeriod.budgetId === currentBudget.id
                ? () =>
                    downloadPeriodPdfReport({
                      budgetName: currentBudget.name,
                      periodLabel: activePeriod.label,
                      analytics: activeAnalytics,
                      envelopes: activeEnvelopes,
                      goals: activeGoals
                    })
                : undefined
            }
            onExportJson={() =>
              downloadBudgetJsonBackup(currentBudget.id, currentBudget.name)
            }
            onImportJson={() => setIsJsonImportOpen(true)}
          />
        ) : null}
      </div>

      <JsonImportSheet
        isOpen={isJsonImportOpen}
        onClose={() => setIsJsonImportOpen(false)}
        activeBudget={currentBudget}
        canReplaceActiveBudget={isOwner}
        onBudgetRestored={(restoredBudget) => {
          onBudgetCreated(restoredBudget);
          setIsJsonImportOpen(false);
          onClose();
        }}
      />
      <BudgetTemplatesSheet
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        budgetId={currentBudget?.id ?? null}
        activePeriodId={
          activePeriod && currentBudget && activePeriod.budgetId === currentBudget.id
            ? activePeriod.id
            : null
        }
        activePeriodLabel={
          activePeriod && currentBudget && activePeriod.budgetId === currentBudget.id
            ? activePeriod.label
            : undefined
        }
        availableEnvelopes={activeEnvelopes
          .filter((e) => e.pillar === 'variable_envelope' || e.pillar === 'savings')
          .map((e) => ({
            id: e.id,
            pillar: e.pillar as 'variable_envelope' | 'savings',
            name: e.name,
            icon: e.icon,
            color: e.color,
            allocatedAmount: e.allocatedAmount,
            ...(e.linkedGoalId ? { linkedGoalId: e.linkedGoalId } : {})
          }))}
      />
      <PayeeRulesSheet
        isOpen={isPayeeRulesOpen}
        onClose={() => setIsPayeeRulesOpen(false)}
        budgetId={currentBudget?.id ?? null}
        availableEnvelopes={activeEnvelopes
          .filter((e) => e.pillar === 'variable_envelope')
          .map((e) => ({ id: e.id, name: e.name, icon: e.icon }))}
      />
      <ApplePayShortcutGuideSheet
        isOpen={isApplePayGuideOpen}
        onClose={() => setIsApplePayGuideOpen(false)}
      />
    </BottomSheet>
  );
}
