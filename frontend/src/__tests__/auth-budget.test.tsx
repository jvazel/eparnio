import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import * as authService from '../services/auth.service';
import * as budgetService from '../services/budget.service';
import { useAuthStore } from '../store/useAuthStore';
import { useBudgetStore } from '../store/useBudgetStore';
import type { BudgetSpace, UserProfile } from '../types/budget.types';

vi.mock('../services/auth.service', () => ({
  browserSupportsWebAuthn: () => false,
  fetchAuthConfig: vi.fn().mockResolvedValue({ registrationRequiresInviteCode: false }),
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  fetchMe: vi.fn(),
  updateMe: vi.fn(),
  updatePassword: vi.fn(),
  regenerateRecoveryKey: vi.fn(),
  requestPasswordResetCode: vi.fn()
}));

vi.mock('../services/budget.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/budget.service')>();
  return {
    ...actual,
    listBudgets: vi.fn(),
    createBudget: vi.fn(),
    updateBudget: vi.fn(),
    deleteBudget: vi.fn(),
    generateBudgetInvite: vi.fn()
  };
});

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

const sampleUser: UserProfile = {
  id: 'user-1',
  email: 'camille@eparnio.fr',
  displayName: 'Camille',
  avatarEmoji: '👩',
  hasCompletedOnboarding: true,
  preferences: {
    currency: 'EUR',
    budgetStartDay: 1,
    theme: 'light'
  }
};

const defaultBudget: BudgetSpace = {
  id: 'budget-1',
  name: 'Budget Perso',
  type: 'personal',
  ownerId: 'user-1',
  contributionMode: 'equal_50_50',
  members: [
    {
      userId: 'user-1',
      role: 'owner',
      color: '#7C3AED',
      declaredMonthlyIncome: 0,
      joinedAt: '2026-01-01T00:00:00.000Z'
    }
  ],
  budgetStartDay: 1
};

const sharedBudget: BudgetSpace = {
  id: 'budget-2',
  name: 'Budget Couple',
  type: 'shared',
  ownerId: 'user-1',
  contributionMode: 'income_prorata',
  members: defaultBudget.members,
  budgetStartDay: 28
};

afterEach(() => {
  useAuthStore.getState().clearSession();
  useBudgetStore.getState().setActiveBudgetId(null);
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Étape 2 — Auth, Création de compte, Mot de passe, Onboarding & Multi-Budgets', () => {
  it('permet de créer un compte puis de compléter l’Onboarding en 3 étapes', async () => {
    const user = userEvent.setup();
    vi.mocked(authService.registerUser).mockResolvedValue({
      status: 'ok',
      token: 'jwt-new',
      user: { ...sampleUser, hasCompletedOnboarding: false, recoveryKeyHint: 'EPAR-****-CD34' },
      defaultBudget,
      recoveryKey: 'EPAR-AB12-CD34'
    });
    vi.mocked(authService.updateMe).mockResolvedValue({
      ...sampleUser,
      hasCompletedOnboarding: true,
      preferences: { ...sampleUser.preferences, budgetStartDay: 28 }
    });
    vi.mocked(budgetService.listBudgets).mockResolvedValue([defaultBudget]);

    renderApp();

    // Bascule sur Création de compte & rejet d'un mot de passe faible
    await user.click(screen.getByRole('tab', { name: 'Créer un compte' }));
    await user.click(screen.getByRole('radio', { name: 'Avatar 👩' }));
    await user.type(screen.getByLabelText('Prénom ou pseudo'), 'Camille');
    await user.type(screen.getByLabelText('Adresse e-mail'), 'camille@eparnio.fr');
    const pwdInput = screen.getByLabelText('Mot de passe');
    await user.type(pwdInput, 'abcdefgh');
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(
      screen.getByText(
        'Le mot de passe doit contenir au moins 1 majuscule, 1 minuscule et 1 chiffre.'
      )
    ).toBeInTheDocument();
    expect(authService.registerUser).not.toHaveBeenCalled();

    await user.clear(pwdInput);
    await user.type(pwdInput, 'MotDePasseSolide9!');
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    await waitFor(() => {
      expect(authService.registerUser).toHaveBeenCalledWith({
        displayName: 'Camille',
        avatarEmoji: '👩',
        email: 'camille@eparnio.fr',
        password: 'MotDePasseSolide9!'
      });
    });

    // Étape 1 -> 2 -> 3 de l'Onboarding Base Zéro (+ Clé de récupération personnelle)
    expect(await screen.findByText('Le principe du Budget Base Zéro')).toBeInTheDocument();
    expect(screen.getByText('Clé de récupération personnelle')).toBeInTheDocument();
    expect(screen.getByText('EPAR-AB12-CD34')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copier la clé' }));
    expect(await screen.findByText('Clé copiée')).toBeInTheDocument();
    const downloadClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      await user.click(screen.getByRole('button', { name: 'Télécharger (.txt)' }));
      expect(await screen.findByText('Fichier téléchargé')).toBeInTheDocument();
      expect(downloadClickSpy).toHaveBeenCalledTimes(1);
    } finally {
      downloadClickSpy.mockRestore();
    }
    await user.click(screen.getByRole('button', { name: 'Suivant : découvrir les 4 piliers' }));
    expect(screen.getByText('4 piliers clairs et saisie au pouce')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    expect(screen.getByText('Quel jour commence votre mois ?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Le 28' }));
    await user.click(screen.getByRole('button', { name: 'Terminer' }));

    await waitFor(() => {
      expect(authService.updateMe).toHaveBeenCalledWith({
        budgetStartDay: 28,
        hasCompletedOnboarding: true
      });
    });

    expect(await screen.findByText('Bonjour Camille')).toBeInTheDocument();
  });

  it('permet de mettre à jour le mot de passe depuis l’écran de connexion puis de se connecter', async () => {
    const user = userEvent.setup();
    vi.mocked(authService.updatePassword).mockResolvedValue({
      status: 'ok',
      message: 'Mot de passe mis à jour avec succès'
    });
    vi.mocked(authService.loginUser).mockResolvedValue({
      status: 'ok',
      token: 'jwt-login',
      user: sampleUser
    });
    vi.mocked(budgetService.listBudgets).mockResolvedValue([defaultBudget]);

    renderApp();

    // Ouvrir l'écran de mise à jour du mot de passe
    await user.click(screen.getByRole('button', { name: 'Mot de passe oublié / Mettre à jour' }));
    await user.type(screen.getByLabelText('Adresse e-mail'), 'camille@eparnio.fr');
    await user.type(
      screen.getByLabelText('Clé de récupération ou mot de passe actuel'),
      'epar-ab12-cd34'
    );
    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'NouveauSecret2026!');
    await user.click(screen.getByRole('button', { name: 'Mettre à jour mon mot de passe' }));

    await waitFor(() => {
      expect(authService.updatePassword).toHaveBeenCalledWith({
        email: 'camille@eparnio.fr',
        recoveryKey: 'EPAR-AB12-CD34',
        newPassword: 'NouveauSecret2026!'
      });
    });

    expect(
      await screen.findByText('Mot de passe mis à jour avec succès. Vous pouvez vous connecter.')
    ).toBeInTheDocument();

    // Connexion avec le nouveau mot de passe
    await user.type(screen.getByLabelText('Mot de passe'), 'NouveauSecret2026!');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(authService.loginUser).toHaveBeenCalledWith({
        email: 'camille@eparnio.fr',
        password: 'NouveauSecret2026!'
      });
    });
    expect(await screen.findByText('Bonjour Camille')).toBeInTheDocument();
  });

  it('permet de demander un code e-mail gratuit (SMTP) et réinitialiser avec un code à 6 chiffres', async () => {
    const user = userEvent.setup();
    vi.mocked(authService.requestPasswordResetCode).mockResolvedValue({
      status: 'ok',
      message: 'Un code à 6 chiffres a été envoyé par e-mail.'
    });
    vi.mocked(authService.updatePassword).mockResolvedValue({
      status: 'ok',
      message: 'Mot de passe mis à jour avec succès'
    });

    renderApp();

    await user.click(screen.getByRole('button', { name: 'Mot de passe oublié / Mettre à jour' }));
    await user.type(screen.getByLabelText('Adresse e-mail'), 'camille@eparnio.fr');
    await user.click(screen.getByRole('button', { name: 'Recevoir un code par e-mail (gratuit)' }));

    await waitFor(() => {
      expect(authService.requestPasswordResetCode).toHaveBeenCalledWith('camille@eparnio.fr');
    });
    expect(
      await screen.findByText('Un code à 6 chiffres a été envoyé par e-mail.')
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Clé de récupération ou mot de passe actuel'), '123456');
    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'NouveauSecret2026!');
    await user.click(screen.getByRole('button', { name: 'Mettre à jour mon mot de passe' }));

    await waitFor(() => {
      expect(authService.updatePassword).toHaveBeenCalledWith({
        email: 'camille@eparnio.fr',
        emailCode: '123456',
        newPassword: 'NouveauSecret2026!'
      });
    });
  });

  it('gère ProfileSheet (édition profil, changement mot de passe, déconnexion)', async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setSession('jwt-1', sampleUser);
    vi.mocked(budgetService.listBudgets).mockResolvedValue([defaultBudget]);
    vi.mocked(authService.updateMe).mockResolvedValue({
      ...sampleUser,
      displayName: 'Camille Pro',
      preferences: { ...sampleUser.preferences, budgetStartDay: 25, theme: 'dark' }
    });
    vi.mocked(authService.updatePassword).mockResolvedValue({
      status: 'ok',
      message: 'Mot de passe mis à jour avec succès'
    });
    vi.mocked(authService.regenerateRecoveryKey).mockResolvedValue({
      status: 'ok',
      recoveryKey: 'EPAR-ZX98-QP76',
      user: { ...sampleUser, recoveryKeyHint: 'EPAR-****-QP76' }
    });

    renderApp();

    await user.click(screen.getByRole('button', { name: 'Profil de Camille' }));
    const nameInput = screen.getByLabelText('Prénom ou pseudo');
    await user.clear(nameInput);
    await user.type(nameInput, 'Camille Pro');
    await user.click(screen.getByRole('button', { name: 'Sombre' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));

    await waitFor(() => {
      expect(authService.updateMe).toHaveBeenCalledWith({
        displayName: 'Camille Pro',
        avatarEmoji: '👩',
        budgetStartDay: 1,
        theme: 'dark'
      });
    });
    expect(await screen.findByText('Profil enregistré.')).toBeInTheDocument();

    // Mise à jour du mot de passe depuis ProfileSheet
    await user.type(screen.getByLabelText('Mot de passe actuel'), 'AncienPass1!');
    await user.type(screen.getByLabelText('Nouveau mot de passe (8 caractères min.)'), 'NouveauPass2!');
    await user.click(screen.getByRole('button', { name: 'Mettre à jour le mot de passe' }));

    await waitFor(() => {
      expect(authService.updatePassword).toHaveBeenCalledWith({
        currentPassword: 'AncienPass1!',
        newPassword: 'NouveauPass2!'
      });
    });

    // Régénération de la clé de récupération dans ProfileSheet
    await user.click(screen.getByRole('button', { name: 'Générer une nouvelle clé de secours' }));
    await waitFor(() => {
      expect(authService.regenerateRecoveryKey).toHaveBeenCalled();
    });
    expect(await screen.findByText('EPAR-ZX98-QP76')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copier' }));
    expect(await screen.findByText(/Copié/i)).toBeInTheDocument();
    const profileDownloadSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    try {
      await user.click(screen.getByRole('button', { name: 'Télécharger (.txt)' }));
      expect(await screen.findByText('Fichier téléchargé')).toBeInTheDocument();
      expect(profileDownloadSpy).toHaveBeenCalledTimes(1);
    } finally {
      profileDownloadSpy.mockRestore();
    }

    // Déconnexion
    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('gère BudgetSwitcherOverlay, ShareBudgetModal et BudgetSettingsSheet (création, édition, suppression)', async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setSession('jwt-1', sampleUser);
    vi.mocked(budgetService.listBudgets).mockResolvedValue([defaultBudget, sharedBudget]);
    vi.mocked(budgetService.createBudget).mockResolvedValue({
      ...sharedBudget,
      id: 'budget-3',
      name: 'Budget Vacances'
    });
    vi.mocked(budgetService.updateBudget).mockResolvedValue({
      ...defaultBudget,
      name: 'Budget Perso Renommé'
    });
    vi.mocked(budgetService.deleteBudget).mockResolvedValue({
      status: 'ok',
      message: 'Espace budgétaire supprimé'
    });
    vi.mocked(budgetService.generateBudgetInvite).mockResolvedValue({
      status: 'ok',
      inviteCode: 'REGEN24H',
      inviteExpiresAt: '2026-11-16T12:00:00.000Z',
      budget: {
        ...defaultBudget,
        inviteCode: 'REGEN24H',
        inviteExpiresAt: '2026-11-16T12:00:00.000Z'
      }
    });

    renderApp();

    // Ouvrir le sélecteur d'espace
    await user.click(screen.getByRole('button', { name: "Changer d'espace budget" }));
    expect(screen.getByRole('dialog', { name: 'Sélecteur d’espace budget' })).toBeInTheDocument();
    expect(screen.getByText('Espace actuel')).toBeInTheDocument();

    // Naviguer vers la carte suivante puis revenir
    await user.click(screen.getByRole('button', { name: 'Espace budget suivant' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Espace budget précédent' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    // Ouvrir la modale de partage
    await user.click(screen.getByRole('button', { name: 'Partager Budget Perso' }));
    expect(
      screen.getByText('Partagez votre espace Eparnio avec vos proches !')
    ).toBeInTheDocument();
    expect(screen.getByText('Lien et QR Code valables 24 heures')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Régénérer le code (24h)' }));
    await waitFor(() => {
      expect(budgetService.generateBudgetInvite).toHaveBeenCalledWith('budget-1');
    });
    await user.click(screen.getByRole('button', { name: 'Envoyer par SMS' }));
    expect(await screen.findByText(/Invitation SMS préparée/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Scanner le QR Code' }));
    expect(await screen.findByText(/QR Code disponible au partage/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Copier l'URL d'invitation" }));
    expect(
      await screen.findByText(/URL d’invitation copiée dans le presse-papiers/i)
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    // Ouvrir les options ••• et renommer + supprimer
    await user.click(screen.getByRole('button', { name: 'Options pour Budget Perso' }));
    const spaceNameInput = screen.getByLabelText('Nom de l’espace');
    await user.clear(spaceNameInput);
    await user.type(spaceNameInput, 'Budget Perso Renommé');
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

    await waitFor(() => {
      expect(budgetService.updateBudget).toHaveBeenCalledWith('budget-1', {
        name: 'Budget Perso Renommé',
        budgetStartDay: 1
      });
    });

    // Créer un nouvel espace depuis le BudgetSwitcher
    await user.click(screen.getByRole('button', { name: "Changer d'espace budget" }));
    await user.click(screen.getByRole('button', { name: 'Nouvel espace budget' }));
    await user.type(screen.getByLabelText('Nom de l’espace'), 'Budget Vacances');
    await user.click(screen.getByRole('button', { name: 'Créer l’espace' }));

    await waitFor(() => {
      expect(budgetService.createBudget).toHaveBeenCalledWith({
        name: 'Budget Vacances',
        type: 'shared',
        budgetStartDay: 1
      });
    });

    // Supprimer l'espace secondaire via Options
    await user.click(screen.getByRole('button', { name: "Changer d'espace budget" }));
    await user.click(screen.getByRole('button', { name: 'Options pour Budget Perso' }));
    await user.click(screen.getByRole('button', { name: 'Supprimer cet espace' }));
    await user.click(screen.getByRole('button', { name: 'Confirmer la suppression' }));

    await waitFor(() => {
      expect(budgetService.deleteBudget).toHaveBeenCalledWith('budget-1');
    });
  });
});
