import { useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Layers,
  Target
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { getApiErrorMessage } from '../../services/api';
import { updateMe } from '../../services/auth.service';
import { useAuthStore } from '../../store/useAuthStore';
import { downloadRecoveryKeyFile } from '../../utils/format';

const PAYDAY_PRESETS = [1, 25, 27, 28];

/**
 * Parcours pédagogique en 3 étapes expliquant la méthode Budget Base Zéro
 * et configurant le jour de début de cycle (`budgetStartDay`).
 */
export function OnboardingWizard() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const lastRecoveryKey = useAuthStore((state) => state.lastRecoveryKey);
  const updateUser = useAuthStore((state) => state.updateUser);
  const setLastRecoveryKey = useAuthStore((state) => state.setLastRecoveryKey);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [budgetStartDay, setBudgetStartDay] = useState<number>(
    user?.preferences.budgetStartDay ?? 1
  );
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState(false);
  const [downloadedRecoveryKey, setDownloadedRecoveryKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleCopyRecoveryKey = async () => {
    if (!lastRecoveryKey) return;
    try {
      await navigator.clipboard?.writeText(lastRecoveryKey);
    } catch {
      // Ignore les environnements sans presse-papiers actif
    }
    setCopiedRecoveryKey(true);
  };

  const handleDownloadRecoveryKey = () => {
    if (!lastRecoveryKey) return;
    downloadRecoveryKeyFile(lastRecoveryKey, user?.email);
    setDownloadedRecoveryKey(true);
  };

  const handleFinish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!Number.isInteger(budgetStartDay) || budgetStartDay < 1 || budgetStartDay > 31) {
      setError('Veuillez choisir un jour compris entre 1 et 31.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = await updateMe({
        budgetStartDay,
        hasCompletedOnboarding: true
      });
      updateUser(updatedUser);
      setLastRecoveryKey(null);
      await queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Impossible d’enregistrer votre cycle budgétaire.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between bg-[#F6F7FB] px-4 py-8">
      <div>
        <div className="mb-5 text-center">
          <span
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#8B3DFF] text-2xl shadow-sm"
            aria-hidden="true"
          >
            {user?.avatarEmoji ?? '🧑'}
          </span>
          <h1 className="text-xl font-bold text-slate-900">
            Bienvenue {user?.displayName ?? ''} !
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configurons votre Budget Base Zéro en 3 étapes
          </p>
        </div>

        <nav aria-label="Progression de l'onboarding" className="mb-5">
          <ol className="grid grid-cols-3 gap-2">
            {[
              { id: 1, label: 'Base Zéro' },
              { id: 2, label: '4 Piliers' },
              { id: 3, label: 'Jour de paie' }
            ].map((item) => {
              const isActive = step === item.id;
              const isDone = step > item.id;
              return (
                <li
                  key={item.id}
                  aria-current={isActive ? 'step' : undefined}
                  className={`rounded-2xl px-2.5 py-2 text-center text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#7C3AED] text-white shadow-sm'
                      : isDone
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-white text-slate-500'
                  }`}
                >
                  {item.id}. {item.label}
                </li>
              );
            })}
          </ol>
        </nav>

        <Card className="p-5">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                  <Target className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Le principe du Budget Base Zéro
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                Donnez un rôle précis à chaque euro gagné avant même de le dépenser. L’objectif :
                atteindre <strong>0,00 €</strong> restant à répartir.
              </p>
              <div className="rounded-2xl bg-slate-50 p-3.5 text-center text-xs font-semibold text-slate-800">
                Revenus − Dépenses fixes − Enveloppes variables − Épargne ={' '}
                <span className="text-emerald-600 font-bold">0 €</span>
              </div>
              {lastRecoveryKey ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-left">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                      Clé de récupération personnelle
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
                            Copier la clé
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
                  <p className="mt-2 select-all rounded-xl bg-white px-3 py-2 text-center font-mono text-sm font-bold tracking-wider text-slate-900">
                    {lastRecoveryKey}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800">
                    Notez cette clé en lieu sûr : elle vous permettra de réinitialiser votre mot de
                    passe gratuitement sans e-mail externe (vous pourrez aussi en générer une
                    nouvelle dans votre profil).
                  </p>
                </div>
              ) : null}
              <Button fullWidth onClick={() => setStep(2)}>
                Suivant : découvrir les 4 piliers
              </Button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                  <Layers className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  4 piliers clairs et saisie au pouce
                </h2>
              </div>
              <ul className="space-y-2.5 text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>
                    <strong>Revenus & Dépenses fixes :</strong> pointez en un tap ce qui est perçu
                    ou payé.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  <span>
                    <strong>Enveloppes variables :</strong> courses, sorties et loisirs dans des
                    tuiles pastel dédiées.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                  <span>
                    <strong>Épargne & Budget Commun :</strong> suivez vos projets ou partagez un
                    espace avec vos proches.
                  </span>
                </li>
              </ul>
              <div className="flex gap-3 pt-1">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
                  Précédent
                </Button>
                <Button className="flex-1" onClick={() => setStep(3)}>
                  Suivant
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <form method="post" onSubmit={handleFinish} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Quel jour commence votre mois ?
                </h2>
              </div>
              <p className="text-sm text-slate-600">
                Indiquez votre jour de paie habituel (ex. le 1er ou le 28) pour caler vos cycles
                budgétaires dessus.
              </p>

              <div className="grid grid-cols-4 gap-2" role="group" aria-label="Raccourcis jour de paie">
                {PAYDAY_PRESETS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setBudgetStartDay(day)}
                    className={`min-h-11 rounded-2xl text-sm font-bold tabular-nums transition-colors ${
                      budgetStartDay === day
                        ? 'bg-[#1D7DFA] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Le {day}
                  </button>
                ))}
              </div>

              <div>
                <label
                  htmlFor="budget-start-day"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Jour personnalisé (1 à 31)
                </label>
                <input
                  id="budget-start-day"
                  name="budgetStartDay"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  required
                  enterKeyHint="done"
                  value={budgetStartDay}
                  onChange={(e) => setBudgetStartDay(Number(e.target.value))}
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-bold tabular-nums text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>

              {error ? (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {error}
                </p>
              ) : null}

              <div className="flex gap-3 pt-1">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>
                  Précédent
                </Button>
                <Button type="submit" className="flex-[1.5]" disabled={isSaving}>
                  {isSaving ? 'Enregistrement...' : 'Terminer'}
                </Button>
              </div>
            </form>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
