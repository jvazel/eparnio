import { CreditCard, Mail, PieChart, PiggyBank, Wallet, type LucideIcon } from 'lucide-react';

export type TabId = 'revenus' | 'depenses' | 'enveloppes' | 'epargne' | 'budget';

export interface BottomNavItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
}

export const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { id: 'revenus', label: 'Revenus', icon: Wallet },
  { id: 'depenses', label: 'Dépenses', icon: CreditCard },
  { id: 'enveloppes', label: 'Enveloppes', icon: Mail },
  { id: 'epargne', label: 'Epargne', icon: PiggyBank },
  { id: 'budget', label: 'Budget', icon: PieChart }
];

export interface BottomNavProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

/**
 * Barre de navigation inférieure fixe à 5 onglets (onglet actif en violet #7C3AED).
 */
export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-slate-100 bg-white pb-safe shadow-[0_-4px_20px_-2px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900"
    >
      <ul className="grid grid-cols-5">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'font-semibold text-[#7C3AED] dark:text-violet-400'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                <span>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
