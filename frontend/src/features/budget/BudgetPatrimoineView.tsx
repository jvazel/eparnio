import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Landmark, Pencil, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DropdownSelect } from '../../components/ui/DropdownSelect';
import { NumericKeypad } from '../../components/ui/NumericKeypad';
import { formatDateKeyDDMMYYYY } from '../../services/calendar.service';
import {
  createAssetAccount,
  deleteAssetAccount,
  fetchBudgetNetWorth,
  recordAssetOperation,
  updateAssetAccount,
  type AssetAccountDTO,
  type AssetCategory,
} from '../../services/netWorth.service';
import type { SavingsGoalItem } from '../../types/budget.types';

interface BudgetPatrimoineViewProps {
  budgetId: string;
  activePeriodId?: string;
  goals?: SavingsGoalItem[];
}

const CATEGORY_OPTIONS: Array<{ key: AssetCategory; label: string; icon: string }> = [
  { key: 'cash', label: 'Liquidités', icon: '🏦' },
  { key: 'investment', label: 'Placements', icon: '📈' },
  { key: 'real_estate', label: 'Immobilier', icon: '🏠' },
  { key: 'crypto', label: 'Crypto', icon: '₿' },
  { key: 'liability', label: 'Crédit / Passif', icon: '💳' },
];

export function BudgetPatrimoineView({
  budgetId,
  activePeriodId,
  goals = [],
}: BudgetPatrimoineViewProps) {
  const queryClient = useQueryClient();
  const [editingAccount, setEditingAccount] = useState<AssetAccountDTO | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | 'all'>('all');
  const [fullHistoryAccount, setFullHistoryAccount] = useState<AssetAccountDTO | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [editMode, setEditMode] = useState<'add' | 'withdraw' | 'set'>('add');
  const [sheetTab, setSheetTab] = useState<'operation' | 'history'>('operation');
  const [opLabel, setOpLabel] = useState('');
  const [counterpartyType, setCounterpartyType] = useState<
    'external' | 'asset' | 'savings_goal' | 'budget_period'
  >('external');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [amountInput, setAmountInput] = useState('0');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<AssetCategory>('cash');

  const { data: netWorth, isLoading } = useQuery({
    queryKey: ['net-worth', budgetId],
    queryFn: () => fetchBudgetNetWorth(budgetId),
    enabled: Boolean(budgetId),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const parsed = Number.parseFloat(amountInput.replace(',', '.')) || 0;
      const cat = CATEGORY_OPTIONS.find((c) => c.key === newCategory);
      return createAssetAccount(budgetId, {
        name: newName.trim() || cat?.label || 'Compte',
        category: newCategory,
        icon: cat?.icon || '🏦',
        currentBalance: parsed,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['net-worth', budgetId] });
      setIsAddOpen(false);
      setNewName('');
      setAmountInput('0');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingAccount) return;
      const parsed = Number.parseFloat(amountInput.replace(',', '.')) || 0;
      const trimmedName = newName.trim();
      if (
        (trimmedName && trimmedName !== editingAccount.name) ||
        newCategory !== editingAccount.category
      ) {
        const cat = CATEGORY_OPTIONS.find((c) => c.key === newCategory);
        await updateAssetAccount(budgetId, editingAccount.id, {
          name: trimmedName || editingAccount.name,
          category: newCategory,
          ...(cat ? { icon: cat.icon } : {}),
        });
      }
      if (parsed > 0 || editMode === 'set') {
        await recordAssetOperation(budgetId, editingAccount.id, {
          mode: editMode,
          amount: parsed,
          label: opLabel.trim() || undefined,
          counterpartyType,
          counterpartyId: counterpartyId || undefined,
          periodId: counterpartyType === 'budget_period' ? activePeriodId : undefined,
        });
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['net-worth', budgetId] }),
        queryClient.invalidateQueries({ queryKey: ['goals'] }),
        queryClient.invalidateQueries({ queryKey: ['period'] }),
        queryClient.invalidateQueries({ queryKey: ['envelopes'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      ]);
      setEditingAccount(null);
      setOpLabel('');
      setCounterpartyType('external');
      setCounterpartyId('');
      setAmountInput('0');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!editingAccount) return Promise.resolve();
      return deleteAssetAccount(budgetId, editingAccount.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['net-worth', budgetId] });
      setEditingAccount(null);
      setNewName('');
      setAmountInput('0');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-36 rounded-2xl bg-white dark:bg-slate-800 animate-pulse" />
        <div className="h-48 rounded-2xl bg-white dark:bg-slate-800 animate-pulse" />
      </div>
    );
  }

  if (!netWorth) return null;

  return (
    <div className="space-y-4">
      {/* Carte Hero Patrimoine Net */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100/80 dark:border-slate-700/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Patrimoine Net
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setAmountInput('0');
              setIsAddOpen(true);
            }}
            className="px-3 py-1.5 rounded-full bg-violet-600 text-white text-xs font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter un compte
          </button>
        </div>

        <p
          className={`text-3xl font-bold tabular-nums ${
            netWorth.netWorth >= 0
              ? 'text-slate-900 dark:text-slate-100'
              : 'text-red-500 dark:text-red-400'
          }`}
        >
          {netWorth.netWorth.toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          €
        </p>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
            <p className="text-emerald-700 dark:text-emerald-300">Actifs</p>
            <p className="font-bold tabular-nums text-emerald-700 dark:text-emerald-200">
              {netWorth.totalAssets.toLocaleString('fr-FR')} €
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/30">
            <p className="text-red-700 dark:text-red-300">Passifs / Crédits</p>
            <p className="font-bold tabular-nums text-red-700 dark:text-red-200">
              {netWorth.totalLiabilities.toLocaleString('fr-FR')} €
            </p>
          </div>
        </div>
      </div>

      {/* Courbe d'évolution */}
      {netWorth.history.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100/80 dark:border-slate-700/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] p-4">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            Évolution du patrimoine
          </h4>
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={netWorth.history.map((pt) => ({
                  ...pt,
                  formattedDate: formatDateKeyDDMMYYYY(pt.dateKey),
                }))}
                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5} />
                <XAxis dataKey="formattedDate" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94A3B8' }}
                  tickFormatter={(v: number) => `${Math.round(v)}€`}
                />
                <Tooltip
                  formatter={(value: unknown) => [
                    `${Number(value).toLocaleString('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} €`,
                    'Patrimoine net',
                  ]}
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(15,23,42,0.12)',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="netWorth"
                  name="Patrimoine net"
                  stroke="#7C3AED"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filtres par catégorie */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
            categoryFilter === 'all'
              ? 'bg-violet-600 text-white'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
          }`}
        >
          Tout
        </button>
        {CATEGORY_OPTIONS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategoryFilter(c.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              categoryFilter === c.key
                ? 'bg-violet-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
            }`}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Liste des comptes */}
      <div className="space-y-2.5">
        {netWorth.accounts
          .filter((acc) => categoryFilter === 'all' || acc.category === categoryFilter)
          .map((acc) => {
            const catLabel =
              CATEGORY_OPTIONS.find((c) => c.key === acc.category)?.label ?? acc.category;
            return (
          <button
            key={acc.id}
            type="button"
            aria-label={`Modifier ${acc.name}`}
            onClick={() => {
              setEditingAccount(acc);
              setEditMode('add');
              setNewName(acc.name);
              setNewCategory(acc.category);
              setAmountInput('0');
            }}
            className="w-full text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-100/80 dark:border-slate-700/80 shadow-sm p-3.5 flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-lg shrink-0">
                {acc.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {acc.name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {catLabel}
                  {acc.linkedGoals.length > 0 && (
                    <span className="text-violet-600 dark:text-violet-400">
                      {' '}• Projets : {acc.linkedGoals.map((g) => g.name).join(', ')}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-sm font-bold tabular-nums ${
                  acc.category === 'liability'
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {acc.category === 'liability' ? '-' : ''}
                {acc.currentBalance.toLocaleString('fr-FR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                €
              </span>
              <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center">
                <Pencil className="w-3.5 h-3.5" />
              </span>
            </div>
          </button>
            );
          })}
      </div>

      {/* BottomSheet Ajout / Mise à jour */}
      {(isAddOpen || editingAccount) && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-[2px]"
          onClick={() => {
            setIsAddOpen(false);
            setEditingAccount(null);
          }}
        >
          <div
            className="w-full max-w-md bg-[#F6F7FB] dark:bg-slate-900 rounded-t-3xl p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingAccount
                  ? `Mettre à jour : ${editingAccount.name}`
                  : 'Nouveau compte patrimonial'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingAccount(null);
                }}
                className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-center text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {amountInput} €
            </p>

            {editingAccount && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1.5 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-2xl">
                  {(
                    [
                      { key: 'add', label: '+ Ajouter', activeClass: 'bg-emerald-500 text-white shadow-sm' },
                      { key: 'withdraw', label: '− Retirer', activeClass: 'bg-red-500 text-white shadow-sm' },
                      { key: 'set', label: '= Solde', activeClass: 'bg-violet-600 text-white shadow-sm' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setEditMode(m.key)}
                      className={`py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        editMode === m.key
                          ? m.activeClass
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-center text-slate-500 dark:text-slate-400 tabular-nums">
                  Nouveau solde :{' '}
                  <strong>
                    {(editMode === 'add'
                      ? editingAccount.currentBalance +
                        (Number.parseFloat(amountInput.replace(',', '.')) || 0)
                      : editMode === 'withdraw'
                        ? Math.max(
                            0,
                            editingAccount.currentBalance -
                              (Number.parseFloat(amountInput.replace(',', '.')) || 0)
                          )
                        : Number.parseFloat(amountInput.replace(',', '.')) || 0
                    ).toLocaleString('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    €
                  </strong>
                </p>
              </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-3 space-y-2">
              {editingAccount ? (
                <>
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSheetTab('operation')}
                      className={`py-1 rounded-lg text-xs font-semibold ${
                        sheetTab === 'operation'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      Opération
                    </button>
                    <button
                      type="button"
                      onClick={() => setSheetTab('history')}
                      className={`py-1 rounded-lg text-xs font-semibold ${
                        sheetTab === 'history'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      Historique ({editingAccount.operations?.length ?? 0})
                    </button>
                  </div>

                  {sheetTab === 'operation' ? (
                    <div className="space-y-2">
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Nom du compte"
                          className="w-full text-xs rounded-xl bg-slate-50 dark:bg-slate-700 px-2.5 py-2 text-slate-900 dark:text-slate-100 outline-none"
                        />
                        <DropdownSelect
                          label="Catégorie"
                          value={newCategory}
                          onChange={(v) => setNewCategory(v as AssetCategory)}
                          options={CATEGORY_OPTIONS.map((c) => ({
                            value: c.key,
                            label: c.label,
                            icon: c.icon,
                          }))}
                        />
                      </div>
                      <input
                        type="text"
                        value={opLabel}
                        onChange={(e) => setOpLabel(e.target.value)}
                        placeholder="Libellé de l'opération (ex. Virement, Intérêts...)"
                        className="w-full text-sm bg-transparent text-slate-900 dark:text-slate-100 outline-none"
                      />
                      {editMode !== 'set' && (
                        <div className="space-y-2">
                          <DropdownSelect
                            label={editMode === 'add' ? 'Source' : 'Destination'}
                            value={counterpartyType}
                            onChange={(v) => {
                              setCounterpartyType(
                                v as
                                  | 'external'
                                  | 'asset'
                                  | 'savings_goal'
                                  | 'budget_period'
                              );
                              setCounterpartyId('');
                            }}
                            options={[
                              { value: 'external', label: 'Externe', icon: '🌐' },
                              { value: 'asset', label: 'Autre compte patrimoine', icon: '🏦' },
                              ...(goals.length > 0
                                ? [{ value: 'savings_goal', label: 'Objectif d’épargne', icon: '🐷' }]
                                : []),
                              ...(activePeriodId
                                ? [
                                    {
                                      value: 'budget_period',
                                      label:
                                        editMode === 'add'
                                          ? 'Restant à répartir du mois'
                                          : 'Budget du mois',
                                      icon: '📅',
                                    },
                                  ]
                                : []),
                            ]}
                          />

                          {counterpartyType === 'asset' && (
                            <DropdownSelect
                              label="Compte contrepartie"
                              emptyOptionLabel="Choisir un compte..."
                              value={counterpartyId}
                              onChange={setCounterpartyId}
                              options={netWorth.accounts
                                .filter((a) => a.id !== editingAccount.id)
                                .map((a) => ({
                                  value: a.id,
                                  label: a.name,
                                  icon: a.icon,
                                  sublabel: `${a.currentBalance.toFixed(0)} €`,
                                }))}
                            />
                          )}

                          {counterpartyType === 'savings_goal' && (
                            <DropdownSelect
                              label="Objectif contrepartie"
                              emptyOptionLabel="Choisir un objectif..."
                              value={counterpartyId}
                              onChange={setCounterpartyId}
                              options={goals.map((g) => ({
                                value: g.id,
                                label: g.name,
                                icon: g.icon,
                                sublabel: `${g.currentAmount.toFixed(0)} €`,
                              }))}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(editingAccount.operations ?? []).length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setFullHistoryAccount(editingAccount);
                            setHistorySearch('');
                            setEditingAccount(null);
                          }}
                          className="w-full py-2 rounded-xl bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-semibold"
                        >
                          Voir tout l’historique en plein écran
                        </button>
                      )}
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                      {(editingAccount.operations ?? []).length === 0 ? (
                        <p className="text-xs text-center text-slate-400 py-4">
                          Aucune opération enregistrée.
                        </p>
                      ) : (
                        editingAccount.operations?.map((op) => {
                          const isPos = op.type === 'add' || op.type === 'transfer_in';
                          return (
                            <div
                              key={op.id || op.date}
                              className="py-2 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {op.label}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {new Date(op.date).toLocaleDateString('fr-FR')}
                                  {op.counterpartyName ? ` • ${op.counterpartyName}` : ''}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p
                                  className={`font-bold tabular-nums ${
                                    isPos
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-red-500 dark:text-red-400'
                                  }`}
                                >
                                  {isPos ? '+' : '-'}
                                  {op.amount.toFixed(2)} €
                                </p>
                                <p className="text-[10px] text-slate-400 tabular-nums">
                                  Solde : {op.balanceAfter.toFixed(2)} €
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nom du compte (ex. Livret A, PEA...)"
                    className="w-full text-sm bg-transparent text-slate-900 dark:text-slate-100 outline-none"
                  />
                  <DropdownSelect
                    label="Catégorie"
                    value={newCategory}
                    onChange={(v) => setNewCategory(v as AssetCategory)}
                    options={CATEGORY_OPTIONS.map((c) => ({
                      value: c.key,
                      label: c.label,
                      icon: c.icon,
                    }))}
                  />
                </>
              )}
            </div>

            <NumericKeypad value={amountInput} onChange={setAmountInput} />

            <button
              type="button"
              disabled={createMutation.isPending || updateMutation.isPending}
              onClick={() =>
                editingAccount ? updateMutation.mutate() : createMutation.mutate()
              }
              className="w-full py-3.5 rounded-2xl bg-[#1D7DFA] text-white font-semibold text-sm"
            >
              Enregistrer
            </button>

            {editingAccount && (
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                className="w-full py-2.5 rounded-2xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold text-xs"
              >
                {deleteMutation.isPending ? 'Suppression...' : 'Supprimer ce compte'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Page plein écran Historique complet */}
      {fullHistoryAccount && (
        <div className="fixed inset-0 z-50 bg-[#F6F7FB] dark:bg-slate-900 flex flex-col max-w-md mx-auto">
          <div className="bg-white dark:bg-slate-800 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setFullHistoryAccount(null)}
              className="flex items-center gap-1.5 text-sm font-semibold text-violet-600 dark:text-violet-400"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {fullHistoryAccount.icon} {fullHistoryAccount.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Solde : {fullHistoryAccount.currentBalance.toFixed(2)} €
              </p>
            </div>
          </div>

          <div className="p-4 pb-2">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-2xl px-3 py-2.5 border border-slate-100 dark:border-slate-700">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Rechercher un libellé ou une contrepartie..."
                className="w-full text-xs bg-transparent text-slate-900 dark:text-slate-100 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
            {(fullHistoryAccount.operations ?? [])
              .filter((op) => {
                const q = historySearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  op.label.toLowerCase().includes(q) ||
                  (op.counterpartyName ?? '').toLowerCase().includes(q)
                );
              })
              .map((op) => {
                const isPos = op.type === 'add' || op.type === 'transfer_in';
                return (
                  <div
                    key={op.id || op.date}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {op.label}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(op.date).toLocaleDateString('fr-FR')}
                        {op.counterpartyName ? ` • ${op.counterpartyName}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-bold tabular-nums ${
                          isPos
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-500 dark:text-red-400'
                        }`}
                      >
                        {isPos ? '+' : '-'}
                        {op.amount.toFixed(2)} €
                      </p>
                      <p className="text-[11px] text-slate-400 tabular-nums">
                        Solde : {op.balanceAfter.toFixed(2)} €
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
