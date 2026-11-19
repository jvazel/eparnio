import type { ReactNode } from 'react';
import { PillarInfoPopover } from '../ui/PillarInfoPopover';
import { BottomNav, type TabId } from './BottomNav';
import { PeriodSelector } from './PeriodSelector';
import { QuickAddButton, type QuickAddMenuAction } from './QuickAddButton';
import { TopHeader } from './TopHeader';

export interface MobileShellProps {
  firstName: string;
  avatarEmoji?: string;
  activeBudgetName?: string;
  periodLabel: string;
  isPeriodClosed?: boolean;
  activeTab: TabId;
  sectionTitle: string;
  sectionDescription: string;
  onTabChange: (tab: TabId) => void;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  onQuickAdd?: () => void;
  quickAddLabel?: string;
  fabMenuActions?: QuickAddMenuAction[];
  onProfileClick?: () => void;
  onSearchClick?: () => void;
  onBudgetSwitcherClick?: () => void;
  children: ReactNode;
}

/**
 * Gabarit Mobile-First centré (`max-w-md`) unifiant TopHeader, PeriodSelector, BottomNav et FAB (+).
 */
export function MobileShell({
  firstName,
  avatarEmoji,
  activeBudgetName,
  periodLabel,
  isPeriodClosed = false,
  activeTab,
  sectionTitle,
  sectionDescription,
  onTabChange,
  onPreviousPeriod,
  onNextPeriod,
  onQuickAdd,
  quickAddLabel,
  fabMenuActions,
  onProfileClick,
  onSearchClick,
  onBudgetSwitcherClick,
  children
}: MobileShellProps) {
  const showFab = activeTab !== 'budget' && Boolean(onQuickAdd);

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-md bg-[#F6F7FB] pb-28 shadow-xl dark:bg-slate-950">
      <TopHeader
        firstName={firstName}
        avatarEmoji={avatarEmoji}
        activeBudgetName={activeBudgetName}
        onProfileClick={onProfileClick}
        onSearchClick={onSearchClick}
        onBudgetSwitcherClick={onBudgetSwitcherClick}
      />

      <PeriodSelector
        label={periodLabel}
        isClosed={isPeriodClosed}
        onPrevious={onPreviousPeriod}
        onNext={onNextPeriod}
      />

      <div className="px-4 pb-2 pt-1">
        <PillarInfoPopover title={sectionTitle} description={sectionDescription} />
      </div>

      <main className="px-4 py-2">{children}</main>

      <QuickAddButton
        visible={showFab}
        onClick={() => onQuickAdd?.()}
        ariaLabel={quickAddLabel ?? `Ajouter dans ${sectionTitle}`}
        menuActions={fabMenuActions}
      />

      <BottomNav activeTab={activeTab} onChange={onTabChange} />
    </div>
  );
}
