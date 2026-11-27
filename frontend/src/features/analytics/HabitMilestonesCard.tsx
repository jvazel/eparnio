import { Award, CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { HabitMilestoneItem } from '../../services/weeklyHabit.service';

export interface HabitMilestonesCardProps {
  milestones: HabitMilestoneItem[];
}

export function HabitMilestonesCard({ milestones }: HabitMilestonesCardProps) {
  if (milestones.length === 0) return null;

  const unlocked = milestones.filter((m) => m.unlocked);
  const nextMilestone =
    milestones
      .filter((m) => !m.unlocked)
      .sort((a, b) => b.progress - a.progress)[0] ?? null;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300"
            aria-hidden="true"
          >
            <Award className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">
              Mes jalons de régularité
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Progresse à ton rythme, sans remise à zéro
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {unlocked.length}/{milestones.length}
        </span>
      </div>

      {unlocked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unlocked.map((item) => (
            <span
              key={item.id}
              title={item.description}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
            >
              <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
              {item.title}
            </span>
          ))}
        </div>
      )}

      {nextMilestone ? (
        <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              Prochain palier : {nextMilestone.title}
            </span>
            <span className="font-bold tabular-nums text-violet-600 dark:text-violet-300">
              {nextMilestone.progress} %
            </span>
          </div>
          <ProgressBar value={nextMilestone.progress} max={100} color="#7C3AED" />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {nextMilestone.description}
          </p>
        </div>
      ) : (
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          Bravo ! Tous les jalons de régularité sont atteints.
        </p>
      )}
    </Card>
  );
}
