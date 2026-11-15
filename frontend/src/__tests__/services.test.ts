import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, getApiErrorMessage } from '../services/api';
import {
  fetchMe,
  loginUser,
  regenerateRecoveryKey,
  registerUser,
  requestPasswordResetCode,
  updateMe,
  updatePassword
} from '../services/auth.service';
import {
  createBudget,
  deleteBudget,
  extractInviteCodeFromInput,
  generateBudgetInvite,
  joinBudgetByCode,
  listBudgets,
  removeBudgetMember,
  updateBudget,
  updateContributionSplit
} from '../services/budget.service';
import { useAuthStore } from '../store/useAuthStore';
import { downloadRecoveryKeyFile, validateStrongPassword } from '../utils/format';

afterEach(() => {
  useAuthStore.getState().clearSession();
  vi.restoreAllMocks();
});

describe('Services API & Intercepteur JWT', () => {
  it('injecte le header Authorization Bearer lorsque le jeton JWT est présent', async () => {
    useAuthStore.getState().setSession('jwt-secret-token', {
      id: 'u1',
      email: 'alice@eparnio.fr',
      displayName: 'Alice',
      avatarEmoji: '👩',
      hasCompletedOnboarding: true,
      preferences: { currency: 'EUR', budgetStartDay: 1, theme: 'light' }
    });

    const adapterSpy = vi.fn(async (config: InternalAxiosRequestConfig) => ({
      data: { status: 'ok', budgets: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    }));

    const originalAdapter = apiClient.defaults.adapter;
    apiClient.defaults.adapter = adapterSpy;
    try {
      await listBudgets();
    } finally {
      apiClient.defaults.adapter = originalAdapter;
    }

    expect(adapterSpy).toHaveBeenCalledTimes(1);
    const passedConfig = adapterSpy.mock.calls[0]?.[0];
    expect(passedConfig?.headers.Authorization).toBe('Bearer jwt-secret-token');
  });

  it('extrait proprement les messages d’erreur Axios (details, message) et génériques', () => {
    const detailedErr = new AxiosError(
      'Bad Request',
      '400',
      undefined,
      undefined,
      {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {
          status: 'error',
          message: 'Données invalides',
          details: [{ message: 'Le mot de passe doit contenir au moins 8 caractères' }]
        }
      }
    );

    expect(getApiErrorMessage(detailedErr)).toBe(
      'Le mot de passe doit contenir au moins 8 caractères'
    );

    const apiMsgErr = new AxiosError('Unauthorized', '401', undefined, undefined, {
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { status: 'error', message: 'E-mail ou mot de passe incorrect' }
    });
    expect(getApiErrorMessage(apiMsgErr)).toBe('E-mail ou mot de passe incorrect');

    expect(getApiErrorMessage(new Error('Erreur réseau'))).toBe('Erreur réseau');
    expect(getApiErrorMessage(null, 'Erreur par défaut')).toBe('Erreur par défaut');
  });

  it('délègue les appels auth.service et budget.service vers apiClient', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: { status: 'ok', budget: { id: 'b2' } }
    });
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { status: 'ok', user: { id: 'u1' } }
    });
    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({
      data: { status: 'ok', user: { id: 'u1' }, budget: { id: 'b1' }, message: 'ok' }
    });
    const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValue({
      data: { status: 'ok', message: 'deleted' }
    });

    await registerUser({ email: 'a@b.fr', password: 'Password123!', displayName: 'Alice' });
    await loginUser({ email: 'a@b.fr', password: 'Password123!' });
    await fetchMe();
    await updateMe({ displayName: 'Alice 2' });
    await updatePassword({ currentPassword: 'old', newPassword: 'Password123!' });
    await regenerateRecoveryKey();
    await requestPasswordResetCode('a@b.fr');
    await createBudget({ name: 'Couple', type: 'shared' });
    await updateBudget('b1', { name: 'Perso' });
    await deleteBudget('b1');
    await generateBudgetInvite('b1');
    await joinBudgetByCode('https://eparnio.app/?invite=code99');
    await updateContributionSplit('b1', { contributionMode: 'equal_50_50' });
    await removeBudgetMember('b1', 'u2');

    expect(extractInviteCodeFromInput('  ab12cd34  ')).toBe('AB12CD34');
    expect(extractInviteCodeFromInput('https://eparnio.app/?invite=pair88')).toBe('PAIR88');
    expect(postSpy).toHaveBeenCalledTimes(7);
    expect(postSpy).toHaveBeenCalledWith('/auth/recovery-key');
    expect(postSpy).toHaveBeenCalledWith('/auth/password/forgot', { email: 'a@b.fr' });
    expect(postSpy).toHaveBeenCalledWith('/budgets/b1/invite');
    expect(postSpy).toHaveBeenCalledWith('/budgets/join/CODE99');
    expect(getSpy).toHaveBeenCalledWith('/auth/me');
    expect(patchSpy).toHaveBeenCalledTimes(4);
    expect(deleteSpy).toHaveBeenCalledTimes(2);
    expect(deleteSpy).toHaveBeenCalledWith('/budgets/b1/members/u2');
  });

  it('valide la robustesse des mots de passe via validateStrongPassword', () => {
    expect(validateStrongPassword('Ab1')).toBeTruthy();
    expect(validateStrongPassword('toutminuscule1')).toBe(
      'Le mot de passe doit contenir au moins 1 majuscule, 1 minuscule et 1 chiffre.'
    );
    expect(validateStrongPassword('TOUTMAJUSCULE1')).toBe(
      'Le mot de passe doit contenir au moins 1 majuscule, 1 minuscule et 1 chiffre.'
    );
    expect(validateStrongPassword('SansChiffreAa')).toBe(
      'Le mot de passe doit contenir au moins 1 majuscule, 1 minuscule et 1 chiffre.'
    );
    expect(validateStrongPassword('MotDePasseSolide9!')).toBeUndefined();
  });

  it('télécharge localement la clé de récupération via downloadRecoveryKeyFile', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    downloadRecoveryKeyFile('EPAR-AB12-CD34', 'camille@eparnio.fr');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const link = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(link.download).toBe('eparnio-cle-recuperation.txt');
  });
});
