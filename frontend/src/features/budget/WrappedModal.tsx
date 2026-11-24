import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { fetchAnnualWrapped } from '../../services/wrapped.service';

interface WrappedModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgetId: string;
}

const SLIDE_COUNT = 5;

export function WrappedModal({ isOpen, onClose, budgetId }: WrappedModalProps) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [slideIndex, setSlideIndex] = useState(0);

  const { data: wrapped, isLoading } = useQuery({
    queryKey: ['wrapped', budgetId, selectedYear],
    queryFn: () => fetchAnnualWrapped(budgetId, selectedYear),
    enabled: isOpen && Boolean(budgetId),
  });

  if (!isOpen) return null;

  const availableYears = wrapped?.availableYears?.length
    ? wrapped.availableYears
    : [selectedYear];

  const handleNext = () => setSlideIndex((prev) => Math.min(SLIDE_COUNT - 1, prev + 1));
  const handlePrev = () => setSlideIndex((prev) => Math.max(0, prev - 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3">
      <div className="w-full max-w-md rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-cyan-500 p-[2px] shadow-2xl">
        <div className="rounded-[22px] bg-white dark:bg-slate-900 p-5 min-h-[480px] flex flex-col justify-between">
          {/* Barre de progression Stories */}
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: SLIDE_COUNT }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 rounded-full transition-colors ${
                    idx <= slideIndex
                      ? 'bg-violet-600 dark:bg-violet-400'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>

            {/* En-tête + Sélecteur d'année */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  Eparnio Wrapped
                </span>
              </div>

              <div className="flex items-center gap-1">
                {availableYears.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => {
                      setSelectedYear(yr);
                      setSlideIndex(0);
                    }}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold tabular-nums transition-colors ${
                      yr === selectedYear
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Contenu du Slide */}
          <div className="flex-1 flex flex-col justify-center py-6">
            {isLoading ? (
              <div className="text-center text-sm text-slate-500 dark:text-slate-400">
                Préparation de votre rétrospective {selectedYear}...
              </div>
            ) : !wrapped || wrapped.periodsCount === 0 ? (
              <div className="text-center space-y-2">
                <p className="text-3xl">📅</p>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Aucune donnée pour {selectedYear}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sélectionnez une autre année ou commencez à saisir vos budgets mensuels.
                </p>
              </div>
            ) : (
              <>
                {slideIndex === 0 && (
                  <div className="space-y-4 text-center">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {selectedYear} en un coup d’œil
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-left">
                      <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30">
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">Revenus</p>
                        <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-200">
                          {wrapped.macro.totalIncome.toLocaleString('fr-FR')} €
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl bg-violet-50 dark:bg-violet-900/30">
                        <p className="text-xs text-violet-700 dark:text-violet-300">Fixes</p>
                        <p className="text-lg font-bold tabular-nums text-violet-700 dark:text-violet-200">
                          {wrapped.macro.totalFixedCharges.toLocaleString('fr-FR')} €
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/30">
                        <p className="text-xs text-blue-700 dark:text-blue-300">Variables</p>
                        <p className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-200">
                          {wrapped.macro.totalVariableSpent.toLocaleString('fr-FR')} €
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-900/30">
                        <p className="text-xs text-cyan-700 dark:text-cyan-300">Épargne</p>
                        <p className="text-lg font-bold tabular-nums text-cyan-700 dark:text-cyan-200">
                          {wrapped.macro.totalSaved.toLocaleString('fr-FR')} €
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {slideIndex === 1 && (
                  <div className="space-y-4 text-center">
                    <p className="text-4xl">🐷</p>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      Votre épargne {selectedYear}
                    </h3>
                    <p className="text-4xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {wrapped.macro.totalSaved.toLocaleString('fr-FR')} €
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Soit un taux d’épargne annuel de{' '}
                      <strong className="tabular-nums">{wrapped.macro.savingsRate} %</strong>.
                    </p>
                    {wrapped.patrimoine && (wrapped.patrimoine.totalAssets > 0 || wrapped.patrimoine.totalLiabilities > 0) && (
                      <div className="p-3 rounded-2xl bg-violet-50 dark:bg-violet-900/30">
                        <p className="text-xs text-violet-700 dark:text-violet-300">
                          Patrimoine Net actuel
                        </p>
                        <p className="text-xl font-bold tabular-nums text-violet-700 dark:text-violet-200">
                          {wrapped.patrimoine.netWorth.toLocaleString('fr-FR')} €
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {slideIndex === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-center text-slate-900 dark:text-slate-100">
                      Vos enveloppes phares
                    </h3>
                    {wrapped.highlights.topEnvelopes.length === 0 ? (
                      <p className="text-center text-xs text-slate-500">
                        Aucune dépense variable enregistrée.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {wrapped.highlights.topEnvelopes.map((env, i) => (
                          <div
                            key={env.name}
                            className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                              <span className="text-lg">{env.icon}</span>
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {env.name}
                              </span>
                            </div>
                            <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                              {env.totalSpent.toLocaleString('fr-FR')} €
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {slideIndex === 3 && (
                  <div className="space-y-4 text-center">
                    <p className="text-4xl">🏆</p>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      Vos records {selectedYear}
                    </h3>
                    <div className="space-y-2.5 text-left">
                      {wrapped.highlights.bestMonth && (
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Mois le plus économe
                          </p>
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {wrapped.highlights.bestMonth.label} (+
                            {wrapped.highlights.bestMonth.remainingToLive.toLocaleString('fr-FR')}{' '}
                            €)
                          </p>
                        </div>
                      )}
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Score Budget Base Zéro
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          {wrapped.highlights.zeroBasedScore} / {wrapped.periodsCount} mois à
                          l’équilibre (0 €)
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {slideIndex === 4 && (
                  <div className="space-y-4 text-center">
                    <p className="text-4xl">✨</p>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      Bravo pour {selectedYear} !
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {wrapped.budgetName} • {wrapped.periodsCount} mois suivis
                    </p>
                    {wrapped.topTags.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {wrapped.topTags.map((t) => (
                          <span
                            key={t.tag}
                            className="px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                          >
                            #{t.tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Navigation Stories */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={slideIndex === 0}
              onClick={handlePrev}
              aria-label="Slide précédent"
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 disabled:opacity-30 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </button>
            <span className="text-xs text-slate-400 tabular-nums">
              {slideIndex + 1} / {SLIDE_COUNT}
            </span>
            <button
              type="button"
              disabled={slideIndex === SLIDE_COUNT - 1}
              onClick={handleNext}
              aria-label="Slide suivant"
              className="px-3 py-2 rounded-xl text-xs font-semibold text-violet-600 dark:text-violet-400 disabled:opacity-30 flex items-center gap-1"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
