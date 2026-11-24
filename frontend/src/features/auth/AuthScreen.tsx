import { Eye, Fingerprint, EyeOff, KeyRound, Lock, Mail, ShieldCheck, Sparkles, User } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { getApiErrorMessage } from '../../services/api';
import {
  browserSupportsWebAuthn,
  loginUser,
  loginWithBiometrics,
  registerUser,
  requestPasswordResetCode,
  updatePassword
} from '../../services/auth.service';
import { useAuthStore } from '../../store/useAuthStore';
import { useBudgetStore } from '../../store/useBudgetStore';
import { validateStrongPassword } from '../../utils/format';

type AuthMode = 'login' | 'register' | 'reset-password';

interface FieldErrors {
  displayName?: string;
  email?: string;
  recoveryKey?: string;
  password?: string;
}

const AVATAR_EMOJIS = [
  '🧑', '👩', '👨', '🧔', '👩‍💻', '👨‍💻', '🦊', '🐱',
  '🐶', '🐼', '🦁', '🦉', '🚀', '🌟', '💼', '🎯'
];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Écran Mobile-First d'authentification (Connexion, Création de compte et Mise à jour du mot de passe).
 */
export function AuthScreen() {
  const setSession = useAuthStore((state) => state.setSession);
  const setLastRecoveryKey = useAuthStore((state) => state.setLastRecoveryKey);
  const setActiveBudgetId = useBudgetStore((state) => state.setActiveBudgetId);

  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('🧑');
  const [email, setEmail] = useState('');
  const [recoveryOrCurrent, setRecoveryOrCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingEmailCode, setIsRequestingEmailCode] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setRecoveryOrCurrent('');
    setPassword('');
    setShowPassword(false);
    setFieldErrors({});
    setSubmitError(null);
    if (nextMode !== 'login') {
      setSuccessMessage(null);
    }
  };

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    if (submitError) setSubmitError(null);
  };

  const validateSingleField = (field: keyof FieldErrors, value: string): string | undefined => {
    if (field === 'displayName') {
      if (value.trim().length === 0) {
        return 'Veuillez saisir votre prénom ou pseudo.';
      }
      return undefined;
    }

    if (field === 'email') {
      const trimmed = value.trim();
      if (!trimmed) return 'L’adresse e-mail est requise.';
      if (!EMAIL_REGEX.test(trimmed)) return 'Veuillez saisir une adresse e-mail valide.';
      return undefined;
    }

    if (field === 'recoveryKey') {
      if (!value.trim()) {
        return 'Veuillez saisir votre clé (EPAR-XXXX-XXXX), votre code e-mail à 6 chiffres ou votre mot de passe actuel.';
      }
      return undefined;
    }

    if (field === 'password') {
      if (!value) {
        return 'Le mot de passe est requis.';
      }
      if (mode !== 'login') {
        return validateStrongPassword(value);
      }
      return undefined;
    }

    return undefined;
  };

  const handleFieldBlur = (field: keyof FieldErrors, value: string) => {
    // Valide uniquement si l'utilisateur a interagi ou quitté un champ requis
    const error = validateSingleField(field, value);
    if (error) {
      setFieldErrors((prev) => ({ ...prev, [field]: error }));
    }
  };

  const validateFormBeforeSubmit = (): boolean => {
    const errors: FieldErrors = {};
    if (mode === 'register') {
      const nameErr = validateSingleField('displayName', displayName);
      if (nameErr) errors.displayName = nameErr;
    }
    const emailErr = validateSingleField('email', email);
    if (emailErr) errors.email = emailErr;

    if (mode === 'reset-password') {
      const recoveryErr = validateSingleField('recoveryKey', recoveryOrCurrent);
      if (recoveryErr) errors.recoveryKey = recoveryErr;
    }

    const passErr = validateSingleField('password', password);
    if (passErr) errors.password = passErr;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    if (!validateFormBeforeSubmit()) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        const res = await loginUser({ email: email.trim(), password });
        setSession(res.token, res.user);
      } else if (mode === 'register') {
        const res = await registerUser({
          displayName: displayName.trim(),
          avatarEmoji,
          email: email.trim(),
          password
        });
        if (res.defaultBudget) {
          setActiveBudgetId(res.defaultBudget.id);
        }
        setLastRecoveryKey(res.recoveryKey ?? null);
        setSession(res.token, res.user);
      } else {
        const trimmedSecret = recoveryOrCurrent.trim();
        const isEmailCode = /^\d{6}$/.test(trimmedSecret);
        const isRecoveryKey =
          /^EPAR[-\s]/i.test(trimmedSecret) || /^EPAR[A-Z0-9]{8}$/i.test(trimmedSecret);

        await updatePassword({
          email: email.trim(),
          ...(isEmailCode
            ? { emailCode: trimmedSecret }
            : isRecoveryKey
              ? { recoveryKey: trimmedSecret.toUpperCase() }
              : { currentPassword: recoveryOrCurrent }),
          newPassword: password
        });
        setSuccessMessage('Mot de passe mis à jour avec succès. Vous pouvez vous connecter.');
        setMode('login');
        setRecoveryOrCurrent('');
        setPassword('');
        setFieldErrors({});
      }
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Impossible de valider votre demande.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestEmailCode = async () => {
    setSubmitError(null);
    setSuccessMessage(null);
    const emailErr = validateSingleField('email', email);
    if (emailErr) {
      setFieldErrors((prev) => ({ ...prev, email: emailErr }));
      return;
    }

    setIsRequestingEmailCode(true);
    try {
      const res = await requestPasswordResetCode(email.trim());
      setSuccessMessage(res.message);
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(error, 'Impossible d’envoyer le code par e-mail pour le moment.')
      );
    } finally {
      setIsRequestingEmailCode(false);
    }
  };

  const emailInputId = mode === 'register' ? 'register-email' : mode === 'reset-password' ? 'reset-email' : 'login-email';
  const passwordInputId = mode === 'login' ? 'current-password' : 'new-password';
  const passwordInputName = mode === 'login' ? 'password' : 'new-password';
  const passwordAutoComplete = mode === 'login' ? 'current-password' : 'new-password';

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-[#F6F7FB] px-4 py-8">
      <div className="mb-6 text-center">
        <img
          src="/icon.svg"
          alt="Eparnio"
          className="mx-auto mb-3 h-14 w-14 rounded-2xl shadow-md"
        />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Eparnio</h1>
        <p className="mt-1 text-sm text-slate-500">
          Reprenez le contrôle de chaque euro avec le Budget Base Zéro
        </p>
      </div>

      <Card className="p-5">
        {mode !== 'reset-password' ? (
          <div
            role="tablist"
            aria-label="Choix d’authentification"
            className="mb-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              className={`min-h-11 rounded-xl text-sm font-semibold transition-colors ${
                mode === 'login'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
              className={`min-h-11 rounded-xl text-sm font-semibold transition-colors ${
                mode === 'register'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Créer un compte
            </button>
          </div>
        ) : (
          <div className="mb-5 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-50">
              <KeyRound className="h-5 w-5 text-violet-600" aria-hidden="true" />
              Mettre à jour le mot de passe
            </h2>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="min-h-11 px-2 text-sm font-semibold text-violet-600 hover:underline"
            >
              Retour
            </button>
          </div>
        )}

        {successMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800"
          >
            {successMessage}
          </div>
        ) : null}

        {submitError ? (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700"
          >
            {submitError}
          </div>
        ) : null}

        <form method="post" noValidate onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' ? (
            <>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Votre avatar</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar">
                  {AVATAR_EMOJIS.map((emoji) => (
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
                  htmlFor="display-name"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Prénom ou pseudo
                </label>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="display-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    enterKeyHint="next"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      clearFieldError('displayName');
                    }}
                    onBlur={() => handleFieldBlur('displayName', displayName)}
                    aria-invalid={Boolean(fieldErrors.displayName)}
                    aria-describedby={fieldErrors.displayName ? 'display-name-error' : undefined}
                    placeholder="Ex. Camille"
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-base text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>
                {fieldErrors.displayName ? (
                  <p id="display-name-error" className="mt-1 text-xs font-medium text-red-600">
                    {fieldErrors.displayName}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          <div>
            <label
              htmlFor={emailInputId}
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Adresse e-mail
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id={emailInputId}
                name="email"
                type="email"
                autoComplete="username"
                required
                enterKeyHint="next"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError('email');
                }}
                onBlur={() => handleFieldBlur('email', email)}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                placeholder="camille@exemple.fr"
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-base text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
            </div>
            {fieldErrors.email ? (
              <p id="email-error" className="mt-1 text-xs font-medium text-red-600">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          {mode === 'reset-password' ? (
            <div>
              <label
                htmlFor="reset-recovery-key"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Clé de récupération ou mot de passe actuel
              </label>
              <div className="relative">
                <ShieldCheck
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="reset-recovery-key"
                  name="recoveryKey"
                  type="text"
                  autoComplete="off"
                  required
                  enterKeyHint="next"
                  value={recoveryOrCurrent}
                  onChange={(e) => {
                    setRecoveryOrCurrent(e.target.value);
                    clearFieldError('recoveryKey');
                  }}
                  onBlur={() => handleFieldBlur('recoveryKey', recoveryOrCurrent)}
                  aria-invalid={Boolean(fieldErrors.recoveryKey)}
                  aria-describedby={
                    fieldErrors.recoveryKey ? 'recovery-key-error' : 'recovery-key-hint'
                  }
                  placeholder="Ex. EPAR-XXXX-XXXX ou 123456"
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-base text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>
              <p id="recovery-key-hint" className="mt-1 text-xs text-slate-500">
                Saisissez votre clé (EPAR-XXXX-XXXX), un code reçu par e-mail (6 chiffres) ou votre
                mot de passe actuel.
              </p>
              <button
                type="button"
                disabled={isRequestingEmailCode || isSubmitting}
                onClick={() => void handleRequestEmailCode()}
                className="mt-1.5 inline-flex min-h-9 items-center text-xs font-semibold text-violet-600 hover:underline disabled:opacity-50"
              >
                {isRequestingEmailCode
                  ? 'Envoi du code par e-mail...'
                  : 'Recevoir un code par e-mail (gratuit)'}
              </button>
              {fieldErrors.recoveryKey ? (
                <p id="recovery-key-error" className="mt-1 text-xs font-medium text-red-600">
                  {fieldErrors.recoveryKey}
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <label
              htmlFor={passwordInputId}
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              {mode === 'reset-password' ? 'Nouveau mot de passe' : 'Mot de passe'}
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id={passwordInputId}
                name={passwordInputName}
                type={showPassword ? 'text' : 'password'}
                autoComplete={passwordAutoComplete}
                minLength={mode === 'login' ? undefined : 8}
                required
                enterKeyHint="done"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError('password');
                }}
                onBlur={() => handleFieldBlur('password', password)}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={
                  fieldErrors.password
                    ? 'password-error'
                    : mode !== 'login'
                      ? 'password-constraints'
                      : undefined
                }
                placeholder="••••••••"
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-12 text-base text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label={
                  showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                }
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200/60"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mode !== 'login' ? (
              <p id="password-constraints" className="mt-1 text-xs text-slate-500">
                8 caractères minimum, avec au moins 1 majuscule, 1 minuscule et 1 chiffre.
              </p>
            ) : null}
            {fieldErrors.password ? (
              <p id="password-error" className="mt-1 text-xs font-medium text-red-600">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          {mode === 'login' ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => switchMode('reset-password')}
                className="min-h-11 px-1 text-xs font-semibold text-violet-600 hover:underline"
              >
                Mot de passe oublié / Mettre à jour
              </button>
            </div>
          ) : null}

          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting
              ? 'Validation en cours...'
              : mode === 'login'
                ? 'Se connecter'
                : mode === 'register'
                  ? 'Créer mon compte'
                  : 'Mettre à jour mon mot de passe'}
          </Button>

          {mode === 'login' && typeof browserSupportsWebAuthn === 'function' && browserSupportsWebAuthn() ? (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={isSubmitting}
              onClick={async () => {
                if (!email.trim()) {
                  setFieldErrors({ email: 'Saisissez votre e-mail pour la biométrie' });
                  return;
                }
                setSubmitError(null);
                setIsSubmitting(true);
                try {
                  const response = await loginWithBiometrics(email.trim());
                  setSession(response.token, response.user);
                } catch (err) {
                  setSubmitError(getApiErrorMessage(err, 'Connexion biométrique annulée ou échouée'));
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              <Fingerprint className="h-4 w-4 text-violet-600" aria-hidden="true" />
              Se connecter avec Face ID / Empreinte
            </Button>
          ) : null}
        </form>
      </Card>

      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
        <Sparkles className="h-3.5 w-3.5 text-violet-500" aria-hidden="true" />
        100 % gratuit, sans connexion bancaire obligatoire
      </p>
    </div>
  );
}
