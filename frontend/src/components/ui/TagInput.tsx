import { Hash, Plus, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

export interface TagInputProps {
  tags: string[];
  onChange: (nextTags: string[]) => void;
  suggestions?: string[];
  maxTags?: number;
}

function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, '-');
}

export function TagInput({
  tags,
  onChange,
  suggestions = [],
  maxTags = 5
}: TagInputProps) {
  const [draft, setDraft] = useState('');

  const addTag = (raw: string) => {
    const clean = normalizeTag(raw);
    if (!clean || tags.includes(clean) || tags.length >= maxTags) {
      setDraft('');
      return;
    }
    onChange([...tags, clean]);
    setDraft('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(draft);
    }
  };

  const availableSuggestions = suggestions
    .filter((s) => !tags.includes(s))
    .slice(0, 6);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Tags (optionnel)
        </span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          {tags.length}/{maxTags}
        </span>
      </div>

      {tags.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
            >
              #{tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                aria-label={`Retirer le tag ${tag}`}
                className="rounded-full p-0.5 hover:bg-violet-200/60 dark:hover:bg-violet-900/60"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {tags.length < maxTags && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Hash
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="vacances-ete, remboursable..."
              aria-label="Ajouter un tag"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <button
            type="button"
            onClick={() => addTag(draft)}
            disabled={!normalizeTag(draft)}
            aria-label="Valider le tag"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      {availableSuggestions.length > 0 && tags.length < maxTags && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {availableSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addTag(suggestion)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              + #{suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
