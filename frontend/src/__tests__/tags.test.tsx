import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TagInput } from '../components/ui/TagInput';
import { TagAnalyticsCard } from '../features/analytics/TagAnalyticsCard';
import { TagDetailModal } from '../features/analytics/TagDetailModal';
import * as analyticsService from '../services/analytics.service';

describe('Étape 36 — Tags Transversaux & Suivi Visuel (Frontend)', () => {
  it('permet d’ajouter, suggérer et retirer des tags via TagInput', () => {
    const onChange = vi.fn();
    render(
      <TagInput
        tags={['pro']}
        onChange={onChange}
        suggestions={['vacances-ete', 'pro']}
      />
    );

    expect(screen.getByText('#pro')).toBeInTheDocument();
    fireEvent.click(screen.getByText('+ #vacances-ete'));
    expect(onChange).toHaveBeenCalledWith(['pro', 'vacances-ete']);
  });

  it('affiche TagAnalyticsCard et ouvre TagDetailModal avec les graphiques', async () => {
    vi.spyOn(analyticsService, 'getTagDetailAnalytics').mockResolvedValue({
      tag: 'vacances-ete',
      totalAmount: 100,
      count: 2,
      byEnvelope: [
        {
          envelopeId: 'e1',
          envelopeName: 'Courses',
          envelopeIcon: '🛒',
          envelopeColor: '#22C55E',
          amount: 60,
          percentage: 60
        },
        {
          envelopeId: 'e2',
          envelopeName: 'Transports',
          envelopeIcon: '🚆',
          envelopeColor: '#3B82F6',
          amount: 40,
          percentage: 40
        }
      ],
      byMonth: [{ year: 2026, month: 8, label: 'Août 26', amount: 100 }],
      transactions: [
        {
          id: 't1',
          label: 'Pique-nique plage',
          amount: 60,
          date: '2026-08-10T12:00:00.000Z',
          envelopeId: 'e1',
          envelopeName: 'Courses',
          envelopeIcon: '🛒',
          envelopeColor: '#22C55E',
          month: 8,
          year: 2026
        }
      ]
    });

    const onSelectTag = vi.fn();
    render(
      <>
        <TagAnalyticsCard
          tags={[{ tag: 'vacances-ete', totalAmount: 100, count: 2 }]}
          onSelectTag={onSelectTag}
        />
        <TagDetailModal
          isOpen
          budgetId="b1"
          tag="vacances-ete"
          onClose={vi.fn()}
        />
      </>
    );

    fireEvent.click(screen.getAllByText('#vacances-ete', { exact: false })[0]);
    expect(onSelectTag).toHaveBeenCalledWith('vacances-ete');

    expect(await screen.findByText('Répartition par enveloppe')).toBeInTheDocument();
    expect(screen.getByText('Évolution mois par mois')).toBeInTheDocument();
    expect(screen.getByText('Pique-nique plage')).toBeInTheDocument();
  });
});
