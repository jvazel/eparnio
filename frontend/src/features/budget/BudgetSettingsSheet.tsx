import { useQueryClient } from '@tanstack/react-query';
import { Plus, Scale, Trash2 } from 'lucide-react';
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
import type { BudgetMemberRole, BudgetSpace, BudgetType } from '../../types/budget.types';

export interface BudgetSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  budget: BudgetSpace | null;
  initialMode?: 'edit' | 'create';
  canDelete: boolean;
  currentUserId?: string;
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

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
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
      <div className="space-y-5 pb-2">
        <form method="post" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="budget-space-name"
              className="mb-1 block text-sm font-semibold text-slate-700"
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
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>

          {mode === 'create' ? (
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold text-slate-700">
                Type d’espace
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold ${
                    type === 'personal'
                      ? 'border-violet-600 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-white text-slate-600'
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
                  className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold ${
                    type === 'shared'
                      ? 'border-violet-600 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-white text-slate-600'
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
              className="mb-1 block text-sm font-semibold text-slate-700"
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
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-base font-bold tabular-nums text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>

          {error ? (
            <p role="alert" className="text-xs font-medium text-red-600">
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

        {mode === 'edit' && currentBudget ? (
          <div className="space-y-4 border-t border-slate-100 pt-4">
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

            {onOpenCalculator ? (
              <Button
                variant="violet"
                fullWidth
                onClick={() => {
                  onClose();
                  onOpenCalculator(currentBudget);
                }}
              >
                <Scale className="h-4 w-4" aria-hidden="true" />
                Calculateur 50/50 &amp; Prorata
              </Button>
            ) : null}

            <Button variant="secondary" fullWidth onClick={switchToCreateMode}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Créer un nouvel espace budget
            </Button>

            {canDelete && isOwner ? (
              confirmDelete ? (
                <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-700">
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
        ) : null}
      </div>
    </BottomSheet>
  );
}
