import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { PillSelectOption } from './PillSelect';

interface DropdownSelectProps {
  label?: string;
  options: PillSelectOption[];
  value: string;
  onChange: (value: string) => void;
  emptyOptionLabel?: string;
}

export function DropdownSelect({
  label,
  options,
  value,
  onChange,
  emptyOptionLabel = 'Aucun',
}: DropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative space-y-1.5">
      {label && (
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {label}
        </p>
      )}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-1.5 truncate">
          {selected ? (
            <>
              {selected.icon && <span>{selected.icon}</span>}
              <span>{selected.label}</span>
              {selected.sublabel && (
                <span className="text-slate-400 tabular-nums">({selected.sublabel})</span>
              )}
            </>
          ) : (
            <span className="text-slate-400">{emptyOptionLabel}</span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className="w-full px-3 py-2.5 text-left text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            <span>{emptyOptionLabel}</span>
            {value === '' && <Check className="w-3.5 h-3.5 text-violet-600" />}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className="w-full px-3 py-2.5 text-left text-xs font-medium text-slate-800 dark:text-slate-100 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <span className="flex items-center gap-1.5 truncate">
                {opt.icon && <span>{opt.icon}</span>}
                <span>{opt.label}</span>
                {opt.sublabel && (
                  <span className="text-slate-400 tabular-nums">({opt.sublabel})</span>
                )}
              </span>
              {opt.value === value && <Check className="w-3.5 h-3.5 text-violet-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
