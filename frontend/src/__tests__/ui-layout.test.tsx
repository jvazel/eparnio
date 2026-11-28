import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { BottomNav } from '../components/layout/BottomNav';
import { MobileShell } from '../components/layout/MobileShell';
import { PeriodSelector } from '../components/layout/PeriodSelector';
import { QuickAddButton } from '../components/layout/QuickAddButton';
import { TopHeader } from '../components/layout/TopHeader';
import { Badge } from '../components/ui/Badge';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CheckableListCard } from '../components/ui/CheckableListCard';
import { PastelEnvelopeCard, resolvePastelTheme } from '../components/ui/PastelEnvelopeCard';
import { PillarInfoPopover } from '../components/ui/PillarInfoPopover';
import { ProgressBar } from '../components/ui/ProgressBar';
import { RingGauge } from '../components/ui/RingGauge';
import { CashFlowSummaryCard } from '../features/analytics/CashFlowSummaryCard';
import { DailyBudgetCard } from '../features/analytics/DailyBudgetCard';
import { CREATION_COLOR_SWATCHES } from '../features/budget/SharedFormFields';
import * as budgetService from '../services/budget.service';
import * as periodService from '../services/period.service';
import { useAuthStore } from '../store/useAuthStore';
import { useBudgetStore } from '../store/useBudgetStore';
import type { EnvelopeItem } from '../types/budget.types';
import { formatCurrency, formatMonthLabel } from '../utils/format';
import { LIGHT_THEME_TOKENS } from '../utils/lightTheme';

vi.mock('../services/budget.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/budget.service')>();
  return {
    ...actual,
    listBudgets: vi.fn()
  };
});

vi.mock('../services/period.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/period.service')>();
  return {
    ...actual,
    getPeriodByMonth: vi.fn()
  };
});

afterEach(() => {
  useAuthStore.getState().clearSession();
  useBudgetStore.getState().setActiveBudgetId(null);
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Helpers de formatage Eparnio', () => {
  it('formate les montants en EUR et les libellés de mois en français', () => {
    const formattedAmount = formatCurrency(2240.01).replace(/\u202f|\u00a0/g, ' ');
    expect(formattedAmount).toBe('2 240,01 €');
    expect(formatMonthLabel(new Date(2025, 11, 1))).toBe('Décembre 2025');
  });
});

describe('Briques UI de base', () => {
  it('rend Card, Button et Badge avec les variantes attendues', () => {
    render(
      <Card>
        <Badge tone="emerald">Base Zéro</Badge>
        <Button variant="violet" fullWidth>
          Valider
        </Button>
      </Card>
    );

    expect(screen.getByText('Base Zéro')).toHaveClass('tabular-nums');
    expect(screen.getByRole('button', { name: 'Valider' })).toHaveClass('w-full', 'min-h-11');
  });

  it('rend RingGauge avec le montant formaté au centre et gère les valeurs négatives', () => {
    const { rerender } = render(
      <RingGauge value={1130} max={2000} label="Reste dans les enveloppes" />
    );

    expect(screen.getByText('Reste dans les enveloppes')).toBeInTheDocument();
    const img = screen.getByRole('img', { name: /Reste dans les enveloppes/i });
    expect(img).toBeInTheDocument();

    rerender(<RingGauge value={-50} max={2000} label="Reste dans les enveloppes" />);
    const negativeText = screen.getByText((content) => content.includes('-50,00'));
    expect(negativeText).toHaveClass('text-red-500');
  });

  it('rend ProgressBar bornée entre 0% et 100%', () => {
    render(<ProgressBar value={150} max={100} label="Objectif vacances" />);
    const bar = screen.getByRole('progressbar', { name: 'Objectif vacances' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('ouvre et ferme BottomSheet y compris sur clic extérieur en repli sans closedBy', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <BottomSheet isOpen onClose={onClose} title="Nouvelle dépense">
        <p>Contenu du tiroir</p>
      </BottomSheet>
    );

    const dialog = screen.getByRole('dialog', { name: 'Nouvelle dépense' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('closedby', 'any');

    await user.click(screen.getByRole('button', { name: 'Fermer le tiroir' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      top: 400,
      left: 0,
      width: 400,
      height: 300,
      right: 400,
      bottom: 700,
      x: 0,
      y: 400,
      toJSON: () => ({})
    });

    // Clic à l'intérieur de la boîte : ne ferme pas le tiroir
    fireEvent.click(dialog, { clientX: 100, clientY: 500 });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Clic sur le backdrop (hors de la boîte) : ferme le tiroir via le repli
    fireEvent.click(dialog, { clientX: 100, clientY: 100 });
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <BottomSheet isOpen={false} onClose={onClose} title="Nouvelle dépense">
        <p>Contenu du tiroir</p>
      </BottomSheet>
    );
    expect(dialog).not.toHaveAttribute('open');
  });

  it('bascule le popover pédagogique au clic sur le bouton d’information', async () => {
    const user = userEvent.setup();
    render(
      <PillarInfoPopover title="Dépenses variables" description="Explication des enveloppes." />
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Dépenses variables' })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Informations sur Dépenses variables' }));
    expect(screen.getByText('Explication des enveloppes.')).toBeVisible();
  });
});

describe('Layout MobileShell, BottomNav et App', () => {
  it('rend les 5 onglets de BottomNav avec l’onglet actif marqué aria-current="page"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BottomNav activeTab="revenus" onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'Revenus' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Budget' })).not.toHaveAttribute('aria-current');

    await user.click(screen.getByRole('button', { name: 'Enveloppes' }));
    expect(onChange).toHaveBeenCalledWith('enveloppes');
  });

  it('permet de naviguer entre les mois, changer d’onglet et masquer le FAB sur Budget', async () => {
    const user = userEvent.setup();
    vi.mocked(budgetService.listBudgets).mockResolvedValue([
      {
        id: 'budget-1',
        name: 'Budget Perso',
        type: 'personal',
        ownerId: 'user-1',
        contributionMode: 'equal_50_50',
        members: [],
        budgetStartDay: 1
      }
    ]);

    vi.mocked(periodService.getPeriodByMonth).mockImplementation(
      async (budgetId, year, month) => ({
        status: 'ok',
        period: {
          id: `period-${year}-${month}`,
          budgetId,
          year,
          month,
          label: formatMonthLabel(new Date(year, month - 1, 1)),
          startDate: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
          endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString(),
          summary: {
            plannedIncome: 0,
            plannedFixedCharges: 0,
            plannedEnvelopes: 0,
            plannedSavings: 0,
            spentVariables: 0,
            remainingToAllocate: 0,
            remainingToLive: 0
          }
        },
        envelopes: []
      })
    );

    useAuthStore.getState().setSession('jwt-valid', {
      id: 'user-1',
      email: 'johann@eparnio.fr',
      displayName: 'Johann',
      avatarEmoji: '🧑',
      hasCompletedOnboarding: true,
      preferences: {
        currency: 'EUR',
        budgetStartDay: 1,
        theme: 'light'
      }
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    const now = new Date();
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentMonthLabel = formatMonthLabel(currentMonthDate);
    const previousMonthLabel = formatMonthLabel(previousMonthDate);

    expect(screen.getByText('Bonjour Johann')).toBeInTheDocument();
    expect(screen.getByText(currentMonthLabel)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter une dépense fixe' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mois précédent' }));
    expect(screen.getByText(previousMonthLabel)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mois suivant' }));
    expect(screen.getByText(currentMonthLabel)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ajouter une dépense fixe' }));
    expect(screen.getByRole('dialog', { name: 'Ajouter une dépense fixe' })).toHaveAttribute(
      'open'
    );
    await user.click(screen.getByRole('button', { name: 'Fermer le tiroir' }));

    await user.click(screen.getByRole('button', { name: 'Budget' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Budget' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajouter/i })).not.toBeInTheDocument();
  });

  it('supporte le gabarit MobileShell autonome avec en-tête et actions', async () => {
    const user = userEvent.setup();
    const onSwitcher = vi.fn();
    render(
      <MobileShell
        firstName="Camille"
        periodLabel="Janvier 2026"
        activeTab="enveloppes"
        sectionTitle="Dépenses variables"
        sectionDescription="Enveloppes du mois"
        onTabChange={vi.fn()}
        onPreviousPeriod={vi.fn()}
        onNextPeriod={vi.fn()}
        onBudgetSwitcherClick={onSwitcher}
      >
        <div>Contenu test</div>
      </MobileShell>
    );

    expect(screen.getByText('Bonjour Camille')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Changer d'espace budget" }));
    expect(onSwitcher).toHaveBeenCalledTimes(1);
  });
});

describe('Non-régression du Thème Clair par défaut (Light Mode)', () => {
  it('fige l’intégralité des couleurs, des 11 pastilles et des 5 thèmes pastel dans LIGHT_THEME_TOKENS', () => {
    expect(LIGHT_THEME_TOKENS.surfaces.appBackground).toBe('#F6F7FB');
    expect(LIGHT_THEME_TOKENS.surfaces.cardBackground).toBe('#FFFFFF');
    expect(LIGHT_THEME_TOKENS.surfaces.cardShadow).toBe('0 4px 20px -2px rgba(15, 23, 42, 0.05)');
    expect(LIGHT_THEME_TOKENS.surfaces.sheetBackdrop).toBe('rgba(15, 23, 42, 0.5)');

    expect(LIGHT_THEME_TOKENS.brand.violetPrimary).toBe('#7C3AED');
    expect(LIGHT_THEME_TOKENS.brand.avatarViolet).toBe('#8B3DFF');
    expect(LIGHT_THEME_TOKENS.brand.actionBlue).toBe('#1D7DFA');
    expect(LIGHT_THEME_TOKENS.brand.gaugeBlue).toBe('#3B82F6');
    expect(LIGHT_THEME_TOKENS.brand.gaugeTrack).toBe('#E5E7EB');

    expect(LIGHT_THEME_TOKENS.semantic.successGreen).toBe('#22C55E');
    expect(LIGHT_THEME_TOKENS.semantic.warningAmber).toBe('#F59E0B');
    expect(LIGHT_THEME_TOKENS.semantic.dangerRed).toBe('#EF4444');

    expect(LIGHT_THEME_TOKENS.creationSwatches).toHaveLength(24);
    expect([...LIGHT_THEME_TOKENS.creationSwatches]).toEqual([...CREATION_COLOR_SWATCHES]);

    expect(resolvePastelTheme('#16A34A')).toEqual({
      background: LIGHT_THEME_TOKENS.pastelEnvelopes.mint.background,
      ring: LIGHT_THEME_TOKENS.pastelEnvelopes.mint.ring
    });
    expect(resolvePastelTheme('#34D399')).toEqual({
      background: LIGHT_THEME_TOKENS.pastelEnvelopes.mint.background,
      ring: LIGHT_THEME_TOKENS.pastelEnvelopes.mint.altRing
    });
    expect(resolvePastelTheme('#38BDF8')).toEqual({
      background: LIGHT_THEME_TOKENS.pastelEnvelopes.glacier.background,
      ring: LIGHT_THEME_TOKENS.pastelEnvelopes.glacier.ring
    });
    expect(resolvePastelTheme('#075985')).toEqual({
      background: LIGHT_THEME_TOKENS.pastelEnvelopes.glacier.background,
      ring: LIGHT_THEME_TOKENS.pastelEnvelopes.glacier.deepRing
    });
    expect(resolvePastelTheme('#F472B6')).toEqual(LIGHT_THEME_TOKENS.pastelEnvelopes.powderPink);
    expect(resolvePastelTheme('#FCE96A')).toEqual(LIGHT_THEME_TOKENS.pastelEnvelopes.vanilla);
    expect(resolvePastelTheme('#4F46E5')).toEqual(LIGHT_THEME_TOKENS.pastelEnvelopes.lavender);
    expect(resolvePastelTheme('#123456')).toEqual({
      background: '#12345624',
      ring: '#123456'
    });
  });

  it('préserve les classes visuelles du squelette MobileShell, TopHeader, PeriodSelector, BottomNav et FAB en mode clair', () => {
    const { container, rerender } = render(
      <MobileShell
        firstName="Johann"
        activeBudgetName="Budget Perso"
        periodLabel="Décembre 2025"
        activeTab="enveloppes"
        sectionTitle="Dépenses variables"
        sectionDescription="Enveloppes du mois"
        onTabChange={vi.fn()}
        onPreviousPeriod={vi.fn()}
        onNextPeriod={vi.fn()}
        onQuickAdd={vi.fn()}
      >
        <div>Contenu mode clair</div>
      </MobileShell>
    );

    expect(container.firstElementChild).toHaveClass(LIGHT_THEME_TOKENS.surfaces.appBackgroundClass);

    const profileBtn = screen.getByRole('button', { name: 'Profil de Johann' });
    const avatarBadge = profileBtn.querySelector('span.rounded-full');
    expect(avatarBadge).toHaveClass('bg-[#8B3DFF]');
    expect(screen.getByText('Bonjour Johann')).toHaveClass('text-slate-900');

    const switcherBtn = screen.getByRole('button', { name: "Changer d'espace budget" });
    expect(switcherBtn).toHaveClass('bg-white', 'text-slate-900', 'shadow-card');

    const periodText = screen.getByText('Décembre 2025');
    expect(periodText).toHaveClass('text-slate-900');
    expect(periodText.parentElement).toHaveClass('bg-white', 'border-slate-100/80', 'shadow-card');
    expect(screen.getByRole('button', { name: 'Mois précédent' })).toHaveClass(
      'bg-slate-50',
      'text-slate-500'
    );

    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(nav).toHaveClass('bg-white', 'border-slate-100');
    expect(screen.getByRole('button', { name: 'Enveloppes' })).toHaveClass('text-[#7C3AED]');
    expect(screen.getByRole('button', { name: 'Revenus' })).toHaveClass('text-slate-400');

    const fab = screen.getByRole('button', { name: 'Ajouter dans Dépenses variables' });
    expect(fab).toHaveClass('bg-[#1D7DFA]', 'text-white');

    rerender(
      <>
        <TopHeader firstName="Alice" />
        <PeriodSelector label="Janvier 2026" onPrevious={vi.fn()} onNext={vi.fn()} />
        <QuickAddButton onClick={vi.fn()} ariaLabel="FAB test" />
      </>
    );
    expect(screen.getByText('Bonjour Alice')).toHaveClass('text-slate-900');
    expect(screen.getByRole('button', { name: 'Mois précédent' })).toHaveClass(
      'bg-slate-50',
      'text-slate-500'
    );
    expect(screen.getByRole('button', { name: 'FAB test' })).toHaveClass('bg-[#1D7DFA]');
  });

  it('préserve les couleurs des composants UI et graphiques en mode clair', () => {
    const sampleCharge: EnvelopeItem = {
      id: 'env-fixed-1',
      budgetId: 'budget-1',
      budgetPeriodId: 'period-1',
      pillar: 'fixed_charge',
      name: 'Loyer',
      icon: '🏠',
      color: '#4F46E5',
      allocatedAmount: 850,
      spentOrPaidAmount: 0,
      date: '2025-12-05T00:00:00.000Z',
      isRecurring: true,
      isPaid: false,
      order: 0
    };

    const baseVariableEnvelope: EnvelopeItem = {
      id: 'env-var-1',
      budgetId: 'budget-1',
      budgetPeriodId: 'period-1',
      pillar: 'variable_envelope',
      name: 'Courses',
      icon: '🛒',
      color: '#16A34A',
      allocatedAmount: 200,
      spentOrPaidAmount: 40,
      date: '2025-12-01T00:00:00.000Z',
      isRecurring: false,
      isPaid: false,
      order: 0
    };

    const { container, rerender } = render(
      <div>
        <Card data-testid="light-card">Contenu carte</Card>
        <Button variant="primary">Btn Primary</Button>
        <Button variant="violet">Btn Violet</Button>
        <Button variant="secondary">Btn Secondary</Button>
        <Button variant="ghost">Btn Ghost</Button>
        <Button variant="danger">Btn Danger</Button>
        <Badge tone="neutral">Badge Neutral</Badge>
        <Badge tone="violet">Badge Violet</Badge>
        <Badge tone="blue">Badge Blue</Badge>
        <Badge tone="emerald">Badge Emerald</Badge>
        <Badge tone="amber">Badge Amber</Badge>
        <Badge tone="red">Badge Red</Badge>
        <RingGauge value={500} max={1000} label="Jauge claire" />
        <ProgressBar value={50} max={100} label="Barre claire" />
        <CheckableListCard
          item={sampleCharge}
          onEdit={vi.fn()}
          onTogglePaid={vi.fn()}
        />
        <PastelEnvelopeCard envelope={baseVariableEnvelope} onSelect={vi.fn()} />
        <CashFlowSummaryCard
          cashFlow={{
            plannedIncome: 3000,
            plannedFixedCharges: 1000,
            plannedEnvelopes: 800,
            spentVariables: 300,
            plannedSavings: 400,
            remainingToLive: 1300
          }}
        />
        <DailyBudgetCard
          dailyBudget={{
            startDate: '2025-12-01T00:00:00.000Z',
            endDate: '2025-12-31T23:59:59.999Z',
            referenceDate: '2025-12-21T00:00:00.000Z',
            totalDays: 31,
            daysRemaining: 10,
            remainingToLive: 250,
            dailyAmount: 25
          }}
        />
      </div>
    );

    expect(screen.getByTestId('light-card')).toHaveClass('bg-white', 'border-slate-100/80', 'shadow-card');

    expect(screen.getByRole('button', { name: 'Btn Primary' })).toHaveClass('bg-[#1D7DFA]', 'text-white');
    expect(screen.getByRole('button', { name: 'Btn Violet' })).toHaveClass('bg-[#7C3AED]', 'text-white');
    expect(screen.getByRole('button', { name: 'Btn Secondary' })).toHaveClass('bg-slate-100', 'text-slate-900');
    expect(screen.getByRole('button', { name: 'Btn Ghost' })).toHaveClass('bg-transparent', 'text-slate-700');
    expect(screen.getByRole('button', { name: 'Btn Danger' })).toHaveClass('bg-red-50', 'text-red-600');

    expect(screen.getByText('Badge Neutral')).toHaveClass('bg-slate-100', 'text-slate-700');
    expect(screen.getByText('Badge Violet')).toHaveClass('bg-violet-50', 'text-violet-700');
    expect(screen.getByText('Badge Blue')).toHaveClass('bg-blue-50', 'text-blue-600');
    expect(screen.getByText('Badge Emerald')).toHaveClass('bg-emerald-50', 'text-emerald-600');
    expect(screen.getByText('Badge Amber')).toHaveClass('bg-amber-50', 'text-amber-700');
    expect(screen.getByText('Badge Red')).toHaveClass('bg-red-50', 'text-red-600');

    const gaugeSvg = screen.getByRole('img', { name: /Jauge claire/i });
    const gaugeCircles = gaugeSvg.querySelectorAll('circle');
    expect(gaugeCircles[0]).toHaveAttribute('stroke', '#E5E7EB');
    expect(gaugeCircles[1]).toHaveAttribute('stroke', '#3B82F6');
    expect(gaugeSvg.parentElement?.querySelector('span')).toHaveClass('text-slate-900');

    const progressBar = screen.getByRole('progressbar', { name: 'Barre claire' });
    expect(progressBar).toHaveClass('bg-[#E5E7EB]');
    expect(progressBar.firstElementChild).toHaveStyle({ backgroundColor: '#7C3AED' });

    const toggleUnpaidBtn = screen.getByRole('button', { name: 'Marquer Loyer comme payé' });
    expect(toggleUnpaidBtn.parentElement).toHaveClass('bg-white', 'border-slate-100/80', 'shadow-card');
    expect(toggleUnpaidBtn.querySelector('span')).toHaveClass('border-slate-300', 'bg-white', 'text-slate-300');

    const envBtn = screen.getByRole('button', { name: 'Ouvrir l’enveloppe Courses' });
    expect(envBtn).toHaveStyle({ backgroundColor: '#CBEAD6' });
    expect(envBtn.querySelector('span.bg-white')).toBeInTheDocument();
    expect(envBtn.querySelector('.bg-\\[\\#3B82F6\\]')).toBeInTheDocument();
    expect(envBtn.querySelector('.bg-\\[\\#EF4444\\]')).toBeInTheDocument();
    const envHealthyCircles = envBtn.querySelectorAll('svg circle');
    expect(envHealthyCircles[1]).toHaveAttribute('stroke', '#16A34A');

    for (const badgeClass of Object.values(LIGHT_THEME_TOKENS.cashFlowBadges)) {
      const [bgCls, textCls] = badgeClass.split(' ');
      expect(container.querySelector(`.${bgCls}.${textCls}`)).toBeInTheDocument();
    }
    expect(screen.getByText('10 jours')).toHaveClass('text-[#EF4444]');
    expect(screen.getByText((text) => text.includes('25,00'))).toHaveClass('text-[#22C55E]');

    rerender(
      <div>
        <RingGauge value={-50} max={1000} label="Jauge claire" />
        <CheckableListCard
          item={{ ...sampleCharge, isPaid: true }}
          onEdit={vi.fn()}
          onTogglePaid={vi.fn()}
        />
        <PastelEnvelopeCard
          envelope={{ ...baseVariableEnvelope, spentOrPaidAmount: 160 }}
          onSelect={vi.fn()}
        />
      </div>
    );

    const negGaugeSvg = screen.getByRole('img', { name: /Jauge claire/i });
    expect(negGaugeSvg.querySelectorAll('circle')[1]).toHaveAttribute('stroke', '#EF4444');
    expect(negGaugeSvg.parentElement?.querySelector('span')).toHaveClass('text-red-500');

    const togglePaidBtn = screen.getByRole('button', { name: 'Marquer Loyer comme en attente' });
    expect(togglePaidBtn.querySelector('span')).toHaveClass('border-[#22C55E]', 'bg-[#22C55E]', 'text-white');

    const warnEnvCircles = screen
      .getByRole('button', { name: 'Ouvrir l’enveloppe Courses' })
      .querySelectorAll('svg circle');
    expect(warnEnvCircles[1]).toHaveAttribute('stroke', '#F59E0B');

    rerender(
      <PastelEnvelopeCard
        envelope={{ ...baseVariableEnvelope, spentOrPaidAmount: 195 }}
        onSelect={vi.fn()}
      />
    );
    const alertEnvCircles = screen
      .getByRole('button', { name: 'Ouvrir l’enveloppe Courses' })
      .querySelectorAll('svg circle');
    expect(alertEnvCircles[1]).toHaveAttribute('stroke', '#EF4444');

    rerender(
      <PastelEnvelopeCard
        envelope={{ ...baseVariableEnvelope, spentOrPaidAmount: 220 }}
        onSelect={vi.fn()}
      />
    );
    const overEnvBtn = screen.getByRole('button', { name: 'Ouvrir l’enveloppe Courses' });
    expect(overEnvBtn.querySelectorAll('svg circle')[1]).toHaveAttribute('stroke', '#EF4444');
    expect(screen.getByText((text) => text.includes('-20,00'))).toHaveClass('text-red-600');
  });
});

describe('Mode Sombre (Dark Mode)', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it('applique et retire la classe dark et colorScheme sur documentElement selon les préférences utilisateur', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    useAuthStore.setState({
      isAuthenticated: false,
      user: {
        id: 'u1',
        email: 'johann@eparnio.app',
        displayName: 'Johann',
        avatarEmoji: '😊',
        hasCompletedOnboarding: true,
        preferences: { theme: 'dark', currency: 'EUR', budgetStartDay: 1 },
      },
    });

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');

    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'johann@eparnio.app',
        displayName: 'Johann',
        avatarEmoji: '😊',
        hasCompletedOnboarding: true,
        preferences: { theme: 'light', currency: 'EUR', budgetStartDay: 1 },
      },
    });

    rerender(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('inclut les classes dark: sur MobileShell, Card, BottomNav et PeriodSelector', () => {
    const { container } = render(
      <MobileShell
        firstName="Johann"
        periodLabel="Décembre 2025"
        activeTab="budget"
        sectionTitle="Budget"
        sectionDescription="Vue globale"
        onPreviousPeriod={vi.fn()}
        onNextPeriod={vi.fn()}
        onTabChange={vi.fn()}
      >
        <Card>Contenu</Card>
      </MobileShell>
    );

    expect(container.firstChild).toHaveClass('dark:bg-slate-950');
    expect(screen.getByText('Contenu').closest('div')).toHaveClass('dark:bg-slate-900');
    expect(screen.getByRole('button', { name: 'Budget' })).toHaveClass('dark:text-violet-400');
    expect(screen.getByText('Décembre 2025').closest('div')).toHaveClass('dark:bg-slate-900');
  });
});
