import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '@if-fleet/domain';

export interface AuthUser {
  id: string;
  userCode?: number;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  department?: string | null;
  mobileNumber?: string | null;
  role: UserRole;
  profileCompleted: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  setAuth: (user: AuthUser, accessToken: string) => void;
  updateUser: (partial: Partial<AuthUser>) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken) => set({ user, accessToken }),
      updateUser: (partial) => {
        const current = get().user;
        if (current) set({ user: { ...current, ...partial } });
      },
      clearAuth: () => set({ user: null, accessToken: null }),
      isAuthenticated: () => !!get().accessToken && !!get().user,
    }),
    {
      name: 'if-fleet-auth',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    },
  ),
);
