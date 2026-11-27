import { useQueryClient } from '@tanstack/react-query';
import { DropdownSelect } from '../../components/ui/DropdownSelect';
import { NotificationsSettingsSection } from './NotificationsSettingsSection';
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  LogOut,
  Moon,
  RefreshCw,
  Shield,
  Sun,
  Trash2,
  User,
  Bell
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useReminders } from '../../hooks/useReminders';
import packageJson from '../../../../package.json';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { getApiErrorMessage } from '../../services/api';
import {
  browserSupportsWebAuthn,
  deleteMyAccount,
  regenerateRecoveryKey,
  registerBiometrics,
  removeBiometrics,
  updateMe,
  updatePassword
} from '../../services/auth.service';
import { useAuthStore } from '../../store/useAuthStore';
import { useBudgetStore } from '../../store/useBudgetStore';
import type { BudgetViewMode, ThemeMode } from '../../types/budget.types';
import { downloadRecoveryKeyFile, validateStrongPassword } from '../../utils/format';

export interface ProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileSaved?: () => void;
}

const PROFILE_EMOJIS = [
  '🧑', '👩', '👨', '🧔', '👩‍💻', '👨‍💻', '🦊', '🐱',
  '🐶', '🐼', '🦁', '🦉', '🚀', '🌟', '💼', '🎯'
];

/**
 * Tiroir de profil utilisateur (ouvert via l'avatar violet du TopHeader) :
 * édition prénom/avatar, jour de début de cycle, thème, clé de récupération, mot de passe et déconnexion.
 */
export function ProfileSheet({ isOpen, onClose, onProfileSaved }: ProfileSheetProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const updateUser = useAuthStore((state) => state.updateUser);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setActiveBudgetId = useBudgetStore((state) => state.setActiveBudgetId);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [avatarEmoji, setAvatarEmoji] = useState(user?.avatarEmoji ?? '🧑');
  const [budgetStartDay, setBudgetStartDay] = useState<number>(
    user?.preferences.budgetStartDay ?? 1
  );
  const [theme, setTheme] = useState<ThemeMode>(user?.preferences.theme ?? 'light');
  const [defaultTab, setDefaultTab] = useState<NonNullable<typeof user>['preferences']['defaultTab']>(
    user?.preferences.defaultTab ?? 'depenses'
  );
  const [budgetViewMode, setBudgetViewMode] = useState<BudgetViewMode>(
    user?.preferences.budgetViewMode ?? 'essential'
  );
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState<string | null>(null);
  const [recoveryKeyError, setRecoveryKeyError] = useState<string | null>(null);
  const [isRegeneratingKey, setIsRegeneratingKey] = useState(false);
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState(false);
  const [downloadedRecoveryKey, setDownloadedRecoveryKey] = useState(false);
  const [activeSection, setActiveSection] = useState<'profile' | 'security' | 'alerts'>('profile');
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setActiveSection('profile');
      setDisplayName(user.displayName);
      setAvatarEmoji(user.avatarEmoji);
      setBudgetStartDay(user.preferences.budgetStartDay);
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : user.preferences.theme);
      setDefaultTab(user.preferences.defaultTab ?? 'depenses');
      setBudgetViewMode(user.preferences.budgetViewMode ?? 'essential');
      setProfileStatus(null);
      setProfileError(null);
    }
  }, [isOpen, user]);

  const {
    isSupported: isNotificationsSupported,
    enabled: remindersEnabled,
    frequency: reminderFrequency,
    enableReminders,
    disableReminders,
    setFrequency: setReminderFrequency
  } = useReminders();

  useEffect(() => {
    if (!isOpen) {
      setPasswordStatus(null);
      setPasswordError(null);
      setCurrentPassword('');
      setNewPassword('');
      setGeneratedRecoveryKey(null);
      setRecoveryKeyError(null);
      setCopiedRecoveryKey(false);
      setDownloadedRecoveryKey(false);
    }
  }, [isOpen]);

  const handleThemeSwitch = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    document.documentElement.style.colorScheme = nextTheme;
  };

  const handleBudgetViewModeSwitch = async (nextMode: BudgetViewMode) => {
    setBudgetViewMode(nextMode);
    if (user) {
      updateUser({
        ...user,
        preferences: {
          ...user.preferences,
          budgetViewMode: nextMode
        }
      });
    }
    try {
      const updated = await updateMe({ budgetViewMode: nextMode });
      updateUser(updated);
    } catch {
      // L'état optimiste reste actif en session même hors-ligne.
    }
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileStatus(null);
    setProfileError(null);

    if (!displayName.trim()) {
      setProfileError('Le prénom ou pseudo est requis.');
      return;
    }

    if (!Number.isInteger(budgetStartDay) || budgetStartDay < 1 || budgetStartDay > 31) {
      setProfileError('Le jour de début de cycle doit être compris entre 1 et 31.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const updated = await updateMe({
        displayName: displayName.trim(),
        avatarEmoji,
        budgetStartDay,
        theme,
        budgetViewMode,
        ...(defaultTab !== (user?.preferences.defaultTab ?? 'depenses') ? { defaultTab } : {})
      });
      updateUser(updated);
      await queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setProfileStatus('Profil enregistré.');
      onProfileSaved?.();
      onClose();
    } catch (err) {
      setProfileError(getApiErrorMessage(err, 'Impossible de mettre à jour le profil.'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordStatus(null);
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError('Veuillez saisir votre mot de passe actuel.');
      return;
    }
    const passwordValidationErr = validateStrongPassword(newPassword);
    if (passwordValidationErr) {
      setPasswordError(passwordValidationErr);
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await updatePassword({ currentPassword, newPassword });
      if (res.token && user) {
        setSession(res.token, user);
      }
      setPasswordStatus(res.message);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordError(getApiErrorMessage(err, 'Impossible de modifier le mot de passe.'));
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleRegenerateRecoveryKey = async () => {
    setRecoveryKeyError(null);
    setCopiedRecoveryKey(false);
    setDownloadedRecoveryKey(false);
    setIsRegeneratingKey(true);
    try {
      const res = await regenerateRecoveryKey();
      updateUser(res.user);
      setGeneratedRecoveryKey(res.recoveryKey);
    } catch (err) {
      setRecoveryKeyError(
        getApiErrorMessage(err, 'Impossible de générer une nouvelle clé de récupération.')
      );
    } finally {
      setIsRegeneratingKey(false);
    }
  };

  const handleCopyRecoveryKey = async () => {
    if (!generatedRecoveryKey) return;
    try {
      await navigator.clipboard?.writeText(generatedRecoveryKey);
    } catch {
      // Ignore les environnements sans presse-papiers actif
    }
    setCopiedRecoveryKey(true);
  };

  const handleDownloadRecoveryKey = () => {
    if (!generatedRecoveryKey) return;
    downloadRecoveryKeyFile(generatedRecoveryKey, user?.email);
    setDownloadedRecoveryKey(true);
  };

  const handleLogout = () => {
    setActiveBudgetId(null);
    clearSession();
    queryClient.clear();
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Mon profil & préférences">
      <div className="space-y-4 pb-2">
        <div
          role="tablist"
          aria-label="Sections du profil"
          className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/80"
        >
          {(
            [
              { id: 'profile', label: 'Profil', icon: User },
              { id: 'security', label: 'Sécurité', icon: Shield },
              { id: 'alerts', label: 'Alertes', icon: Bell }
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

        {activeSection === 'profile' ? (
          <div className="space-y-4">
            <form
              id="profile-settings-form"
              method="post"
              onSubmit={handleProfileSubmit}
              className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Avatar
                </p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Choisir un avatar">
                  {PROFILE_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      role="radio"
                      aria-checked={avatarEmoji === emoji}
                      aria-label={`Avatar ${emoji}`}
                      onClick={() => setAvatarEmoji(emoji)}
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-lg transition-transform ${
                        avatarEmoji === emoji
                          ? 'scale-105 bg-[#8B3DFF] ring-2 ring-violet-600 ring-offset-2'
                          : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="profile-display-name"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Prénom ou pseudo
                </label>
                <input
                  id="profile-display-name"
                  name="displayName"
                  type="text"
                  autoComplete="name"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="profile-start-day"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Jour de paie (1-31)
                  </label>
                  <input
                    id="profile-start-day"
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

                <div>
                  <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Thème
                  </span>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => handleThemeSwitch('light')}
                      aria-pressed={theme === 'light'}
                      className={`flex min-h-9 items-center justify-center gap-1 rounded-lg text-xs font-semibold ${
                        theme === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                      Clair
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemeSwitch('dark')}
                      aria-pressed={theme === 'dark'}
                      className={`flex min-h-9 items-center justify-center gap-1 rounded-lg text-xs font-semibold ${
                        theme === 'dark' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                      Sombre
                    </button>
                  </div>
                </div>
              </div>

              <DropdownSelect
                label="Onglet d'ouverture par défaut"
                value={defaultTab ?? 'depenses'}
                onChange={(val) =>
                  setDefaultTab(
                    val as 'revenus' | 'depenses' | 'enveloppes' | 'epargne' | 'budget'
                  )
                }
                options={[
                  { value: 'depenses', label: 'Dépenses fixes', icon: '💳' },
                  { value: 'enveloppes', label: 'Enveloppes', icon: '✉️' },
                  { value: 'revenus', label: 'Revenus', icon: '💵' },
                  { value: 'epargne', label: 'Épargne', icon: '🐷' },
                  { value: 'budget', label: 'Budget', icon: '📊' },
                ]}
              />

              <div>
                <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Mode d’affichage
                </span>
                <div
                  role="group"
                  aria-label="Mode d’affichage"
                  className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    onClick={() => void handleBudgetViewModeSwitch('essential')}
                    aria-pressed={budgetViewMode === 'essential'}
                    className={`flex min-h-10 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors ${
                      budgetViewMode === 'essential'
                        ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-800 dark:text-violet-300'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    Mode essentiel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBudgetViewModeSwitch('advanced')}
                    aria-pressed={budgetViewMode === 'advanced'}
                    className={`flex min-h-10 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors ${
                      budgetViewMode === 'advanced'
                        ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-800 dark:text-violet-300'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    Mode détaillé
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {budgetViewMode === 'essential'
                    ? 'Affiche l’essentiel (piliers, synthèse, calendrier, patrimoine, tags, scan et vocal).'
                    : 'Débloque les outils experts : pilotage, tendances, simulateur, import CSV, scénarios, règles, fractionnement et rollover.'}
                </p>
              </div>

              {profileError ? (
                <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                  {profileError}
                </p>
              ) : null}
              {profileStatus ? (
                <p role="status" className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {profileStatus}
                </p>
              ) : null}

              <Button
                type="submit"
                variant="violet"
                fullWidth
                disabled={isSavingProfile}
              >
                {isSavingProfile ? 'Enregistrement...' : 'Enregistrer le profil'}
              </Button>
            </form>

            <Button variant="danger" fullWidth onClick={handleLogout}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Se déconnecter
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              <img src="/icon.svg" alt="Eparnio" className="h-4 w-4 rounded" />
              <span>Eparnio v{packageJson.version}</span>
            </div>
          </div>
        ) : null}

        {activeSection === 'security' ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                  Changer de mot de passe
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPasswords((prev) => !prev)}
                  aria-pressed={showPasswords}
                  className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400"
                >
                  {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showPasswords ? 'Masquer' : 'Afficher'}
                </button>
              </div>

              <form method="post" onSubmit={handlePasswordSubmit} className="space-y-3">
                <div>
                  <label
                    htmlFor="profile-current-password"
                    className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Mot de passe actuel
                  </label>
                  <input
                    id="profile-current-password"
                    name="currentPassword"
                    type={showPasswords ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-new-password"
                    className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Nouveau mot de passe (8 caractères min.)
                  </label>
                  <input
                    id="profile-new-password"
                    name="newPassword"
                    type={showPasswords ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                  />
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Au moins 8 caractères, 1 majuscule, 1 minuscule et 1 chiffre.
                  </p>
                </div>

                {passwordError ? (
                  <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                    {passwordError}
                  </p>
                ) : null}
                {passwordStatus ? (
                  <p role="status" className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {passwordStatus}
                  </p>
                ) : null}

                <Button type="submit" variant="secondary" fullWidth disabled={isSavingPassword}>
                  {isSavingPassword ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
                </Button>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-50">
                  <KeyRound className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                  Clé de récupération
                </h3>
                <span className="rounded-full bg-white px-2.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {user?.recoveryKeyHint ?? 'Aucune clé active'}
                </span>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Permet de réinitialiser votre mot de passe gratuitement sans service e-mail tiers.
              </p>

              {generatedRecoveryKey ? (
                <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                      Nouvelle clé générée (à noter) :
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleCopyRecoveryKey()}
                        className="inline-flex min-h-8 items-center gap-1 rounded-xl bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
                      >
                        {copiedRecoveryKey ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                            Clé copiée
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" aria-hidden="true" />
                            Copier
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadRecoveryKey}
                        className="inline-flex min-h-8 items-center gap-1 rounded-xl bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
                      >
                        {downloadedRecoveryKey ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                            Fichier téléchargé
                          </>
                        ) : (
                          <>
                            <Download className="h-3 w-3" aria-hidden="true" />
                            Télécharger (.txt)
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 select-all rounded-xl bg-white px-3 py-2 text-center font-mono text-sm font-bold tracking-wider text-slate-900">
                    {generatedRecoveryKey}
                  </p>
                </div>
              ) : null}

              {recoveryKeyError ? (
                <p role="alert" className="mb-2 text-xs font-medium text-red-600 dark:text-red-400">
                  {recoveryKeyError}
                </p>
              ) : null}

              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={isRegeneratingKey}
                onClick={() => void handleRegenerateRecoveryKey()}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRegeneratingKey ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {isRegeneratingKey ? 'Génération...' : 'Générer une nouvelle clé de secours'}
              </Button>
            </div>

            {typeof browserSupportsWebAuthn === 'function' && browserSupportsWebAuthn() ? (
              <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                  <Fingerprint className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                  Connexion biométrique
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {user?.hasBiometrics
                    ? 'Face ID / Empreinte activée sur cet appareil.'
                    : 'Connectez-vous rapidement avec Face ID ou votre empreinte digitale.'}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={async () => {
                    setProfileStatus(null);
                    setProfileError(null);
                    try {
                      const res = user?.hasBiometrics
                        ? await removeBiometrics()
                        : await registerBiometrics();
                      updateUser(res.user);
                      setProfileStatus(
                        res.user.hasBiometrics
                          ? 'Connexion biométrique activée.'
                          : 'Connexion biométrique désactivée.'
                      );
                    } catch (err) {
                      setProfileError(
                        getApiErrorMessage(err, 'Impossible de configurer la biométrie')
                      );
                    }
                  }}
                >
                  <Fingerprint className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                  {user?.hasBiometrics ? 'Désactiver la biométrie' : 'Activer Face ID / Empreinte'}
                </Button>
              </div>
            ) : null}

            <div className="rounded-2xl border border-red-200/80 bg-red-50/50 p-3.5 dark:border-red-900/60 dark:bg-red-950/30">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-red-700 dark:text-red-300">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Supprimer mon compte
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-red-800/80 dark:text-red-200/80">
                Suppression définitive (RGPD) de votre compte et de vos budgets personnels. Les
                budgets partagés avec d’autres membres leur sont automatiquement transférés.
              </p>

              {!showDeleteAccount ? (
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="danger"
                    fullWidth
                    onClick={() => {
                      setDeleteError(null);
                      setDeletePassword('');
                      setDeleteConfirmation('');
                      setShowDeleteAccount(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Supprimer définitivement mon compte
                  </Button>
                </div>
              ) : (
                <div className="mt-3 space-y-2.5">
                  <div>
                    <label
                      htmlFor="delete-account-password"
                      className="mb-1 block text-xs font-semibold text-red-900 dark:text-red-200"
                    >
                      Mot de passe actuel pour supprimer
                    </label>
                    <input
                      id="delete-account-password"
                      type="password"
                      autoComplete="current-password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="min-h-11 w-full rounded-xl border border-red-200 bg-white px-3 text-sm text-slate-900 focus:border-red-500 focus:outline-none dark:border-red-900 dark:bg-slate-900 dark:text-slate-50"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="delete-account-confirmation"
                      className="mb-1 block text-xs font-semibold text-red-900 dark:text-red-200"
                    >
                      Tapez SUPPRIMER pour confirmer
                    </label>
                    <input
                      id="delete-account-confirmation"
                      type="text"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder="SUPPRIMER"
                      className="min-h-11 w-full rounded-xl border border-red-200 bg-white px-3 text-sm font-bold uppercase text-slate-900 focus:border-red-500 focus:outline-none dark:border-red-900 dark:bg-slate-900 dark:text-slate-50"
                    />
                  </div>

                  {deleteError ? (
                    <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                      {deleteError}
                    </p>
                  ) : null}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      disabled={isDeletingAccount}
                      onClick={() => setShowDeleteAccount(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="flex-1"
                      disabled={
                        isDeletingAccount ||
                        !deletePassword.trim() ||
                        deleteConfirmation.trim() !== 'SUPPRIMER'
                      }
                      onClick={async () => {
                        setDeleteError(null);
                        setIsDeletingAccount(true);
                        try {
                          await deleteMyAccount({
                            currentPassword: deletePassword,
                            confirmation: 'SUPPRIMER'
                          });
                          setActiveBudgetId(null);
                          clearSession();
                          queryClient.clear();
                          sessionStorage.clear();
                          onClose();
                        } catch (err) {
                          setDeleteError(
                            getApiErrorMessage(err, 'Impossible de supprimer votre compte.')
                          );
                        } finally {
                          setIsDeletingAccount(false);
                        }
                      }}
                    >
                      {isDeletingAccount ? 'Suppression…' : 'Confirmer la suppression définitive'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeSection === 'alerts' ? (
          <div className="space-y-4">
            <NotificationsSettingsSection initialPreferences={user?.notificationPreferences} />

            {isNotificationsSupported ? (
              <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                  <Bell className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                  Rappels locaux
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {remindersEnabled
                    ? `Rappel local actif (${reminderFrequency === 'daily' ? 'quotidien' : 'hebdomadaire'}).`
                    : 'Recevez un rappel local pour penser à saisir vos dépenses.'}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    fullWidth
                    onClick={async () => {
                      if (remindersEnabled) {
                        disableReminders();
                        setProfileStatus('Rappels désactivés.');
                        return;
                      }
                      const ok = await enableReminders(reminderFrequency);
                      if (ok) {
                        setProfileStatus('Rappels activés.');
                      } else {
                        setProfileError('Permission de notification refusée par le navigateur.');
                      }
                    }}
                  >
                    <Bell className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                    {remindersEnabled ? 'Désactiver les rappels' : 'Activer les rappels'}
                  </Button>
                  {remindersEnabled ? (
                    <select
                      aria-label="Fréquence des rappels"
                      value={reminderFrequency}
                      onChange={(e) =>
                        setReminderFrequency(e.target.value === 'weekly' ? 'weekly' : 'daily')
                      }
                      className="min-h-11 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <option value="daily">Quotidien</option>
                      <option value="weekly">Hebdomadaire</option>
                    </select>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
