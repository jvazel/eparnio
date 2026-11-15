import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING_CLASSES: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5'
};

/**
 * Carte blanche standard d'Eparnio aux coins arrondis et ombre douce.
 */
export function Card({
  children,
  className = '',
  padding = 'md',
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-100/80 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900 ${PADDING_CLASSES[padding]} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
