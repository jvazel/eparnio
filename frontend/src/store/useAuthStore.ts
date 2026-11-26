import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UserProfile } from '../types/budget.types';

export interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  lastRecoveryKey: string | null;
  setSession: (token: string, user: UserProfile) => void;
  updateUser: (user: UserProfile) => void;
  setLastRecoveryKey: (recoveryKey: string | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      lastRecoveryKey: null,
      setSession: (token, user) =>
        set({
          token,
          user,
          isAuthenticated: true
        }),
      updateUser: (user) =>
        set((state) => ({
          ...state,
          user
        })),
      setLastRecoveryKey: (lastRecoveryKey) =>
        set({
          lastRecoveryKey
        }),
      clearSession: () =>
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          lastRecoveryKey: null
        })
    }),
    {
      name: 'eparnio-auth-storage',
      storage: createJSONStorage(() => localStorage),
      // Le JWT reste uniquement en mémoire (le cookie HttpOnly assure la persistance sécurisée)
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
