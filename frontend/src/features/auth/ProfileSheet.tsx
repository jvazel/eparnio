import { useQueryClient } from '@tanstack/react-query';
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
  Sun,
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
  regenerateRecoveryKey,
  registerBiometrics,
  removeBiometrics,
  updateMe,
  updatePassword
} from '../../services/auth.service';
import { useAuthStore } from '../../store/useAuthStore';
import { useBudgetStore } from '../../store/useBudgetStore';
import type { ThemeMode } from '../../types/budget.types';
import { downloadRecoveryKeyFile, validateStrongPassword } from '../../utils/format';

export interface ProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROFILE_EMOJIS = [
  '🧑', '👩', '👨', '🧔', '👩‍💻', '👨‍💻', '🦊', '🐱',
  '🐶', '🐼', '🦁', '🦉', '🚀', '🌟', '💼', '🎯'
];

/**
 * Tiroir de profil utilisateur (ouvert via l'avatar violet du TopHeader) :
 * édition prénom/avatar, jour de début de cycle, thème, clé de récupération, mot de passe et déconnexion.
 */
export function ProfileSheet({ isOpen, onClose }: ProfileSheetProps) {
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

  useEffect(() => {
    if (isOpen && user) {
      setDisplayName(user.displayName);
      setAvatarEmoji(user.avatarEmoji);
      setBudgetStartDay(user.preferences.budgetStartDay);
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : user.preferences.theme);
      setDefaultTab(user.preferences.defaultTab ?? 'depenses');
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
        ...(defaultTab !== (user?.preferences.defaultTab ?? 'depenses') ? { defaultTab } : {})
      });
      updateUser(updated);
      await queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setProfileStatus('Profil enregistré.');
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
      <div className="space-y-6 pb-2">
        <form method="post" onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-xl transition-transform ${
                    avatarEmoji === emoji
                      ? 'bg-[#8B3DFF] ring-2 ring-violet-600 ring-offset-2 scale-105'
                      : 'bg-slate-100 hover:bg-slate-200'
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
              className="mb-1 block text-sm font-semibold text-slate-700"
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
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-base text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:focus:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="profile-start-day"
                className="mb-1 block text-sm font-semibold text-slate-700"
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
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-base font-bold tabular-nums text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:focus:bg-slate-800"
              />
            </div>

            <div>
              <label
                htmlFor="profile-default-tab"
                className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Onglet d&apos;ouverture par défaut
              </label>
              <select
                id="profile-default-tab"
                name="defaultTab"
                value={defaultTab ?? 'depenses'}
                onChange={(e) =>
                  setDefaultTab(
                    e.target.value as 'revenus' | 'depenses' | 'enveloppes' | 'epargne' | 'budget'
                  )
                }
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
              >
                <option value="depenses">Dépenses fixes</option>
                <option value="enveloppes">Enveloppes</option>
                <option value="revenus">Revenus</option>
                <option value="epargne">Épargne</option>
                <option value="budget">Budget</option>
              </select>
            </div>

            <div>
              <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Thème
              </span>
              <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => handleThemeSwitch('light')}
                  aria-pressed={theme === 'light'}
                  className={`flex min-h-10 items-center justify-center gap-1 rounded-xl text-xs font-semibold ${
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
                  className={`flex min-h-10 items-center justify-center gap-1 rounded-xl text-xs font-semibold ${
                    theme === 'dark' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                  Sombre
                </button>
              </div>
            </div>
          </div>

          {profileError ? (
            <p role="alert" className="text-xs font-medium text-red-600">
              {profileError}
            </p>
          ) : null}
          {profileStatus ? (
            <p role="status" className="text-xs font-medium text-emerald-600">
              {profileStatus}
            </p>
          ) : null}

          <div className="sticky bottom-0 z-10 -mx-1 bg-white/95 px-1 pb-2 pt-3 backdrop-blur dark:bg-slate-900/95">
            <Button type="submit" variant="violet" fullWidth disabled={isSavingProfile}>
              {isSavingProfile ? 'Enregistrement...' : 'Enregistrer le profil'}
            </Button>
          </div>
        </form>

        <div className="border-t border-slate-100 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">Changer de mot de passe</h3>
            <button
              type="button"
              onClick={() => setShowPasswords((prev) => !prev)}
              aria-pressed={showPasswords}
              className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-violet-600"
            >
              {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPasswords ? 'Masquer' : 'Afficher'}
            </button>
          </div>

          <form method="post" onSubmit={handlePasswordSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="profile-current-password"
                className="mb-1 block text-xs font-semibold text-slate-600"
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
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-base text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:focus:bg-slate-800"
              />
            </div>

            <div>
              <label
                htmlFor="profile-new-password"
                className="mb-1 block text-xs font-semibold text-slate-600"
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
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 text-base text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:focus:bg-slate-800"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Au moins 8 caractères, 1 majuscule, 1 minuscule et 1 chiffre.
              </p>
            </div>

            {passwordError ? (
              <p role="alert" className="text-xs font-medium text-red-600">
                {passwordError}
              </p>
            ) : null}
            {passwordStatus ? (
              <p role="status" className="text-xs font-medium text-emerald-600">
                {passwordStatus}
              </p>
            ) : null}

            <Button type="submit" variant="secondary" fullWidth disabled={isSavingPassword}>
              {isSavingPassword ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
            </Button>
          </form>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-50">
              <KeyRound className="h-4 w-4 text-violet-600" aria-hidden="true" />
              Clé de récupération de secours
            </h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
              {user?.recoveryKeyHint ?? 'Aucune clé active'}
            </span>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            Permet de réinitialiser votre mot de passe gratuitement sans service e-mail tiers.
          </p>

          {generatedRecoveryKey ? (
            <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-amber-900">
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
            <p role="alert" className="mb-2 text-xs font-medium text-red-600">
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

        <NotificationsSettingsSection />

        {isNotificationsSupported ? (
          <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
              <Bell className="h-4 w-4 text-violet-600" aria-hidden="true" />
              Rappels &amp; Notifications
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
                <Bell className="h-4 w-4 text-violet-600" aria-hidden="true" />
                {remindersEnabled ? 'Désactiver les rappels' : 'Activer les rappels'}
              </Button>
              {remindersEnabled ? (
                <select
                  aria-label="Fréquence des rappels"
                  value={reminderFrequency}
                  onChange={(e) =>
                    setReminderFrequency(e.target.value === 'weekly' ? 'weekly' : 'daily')
                  }
                  className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                </select>
              ) : null}
            </div>
          </div>
        ) : null}

        {typeof browserSupportsWebAuthn === 'function' && browserSupportsWebAuthn() ? (
          <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
              <Fingerprint className="h-4 w-4 text-violet-600" aria-hidden="true" />
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
              <Fingerprint className="h-4 w-4 text-violet-600" aria-hidden="true" />
              {user?.hasBiometrics ? 'Désactiver la biométrie' : 'Activer Face ID / Empreinte'}
            </Button>
          </div>
        ) : null}

        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="danger" fullWidth onClick={handleLogout}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Se déconnecter
          </Button>
          <p className="mt-3 text-center text-[11px] font-medium text-slate-400 dark:text-slate-500">
            Eparnio v{packageJson.version}
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
