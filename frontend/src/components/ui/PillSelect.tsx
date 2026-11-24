export interface PillSelectOption {
  value: string;
  label: string;
  icon?: string;
  sublabel?: string;
}

interface PillSelectProps {
  label?: string;
  options: PillSelectOption[];
  value: string;
  onChange: (value: string) => void;
  emptyOptionLabel?: string;
}

export function PillSelect({
  label,
  options,
  value,
  onChange,
  emptyOptionLabel,
}: PillSelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {label}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {emptyOptionLabel !== undefined && (
          <button
            type="button"
            onClick={() => onChange('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              value === ''
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {emptyOptionLabel}
          </button>
        )}
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1 ${
                isActive
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              {opt.icon && <span>{opt.icon}</span>}
              <span>{opt.label}</span>
              {opt.sublabel && (
                <span
                  className={`text-[10px] tabular-nums ${
                    isActive ? 'text-violet-100' : 'text-slate-400 dark:text-slate-400'
                  }`}
                >
                  ({opt.sublabel})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
