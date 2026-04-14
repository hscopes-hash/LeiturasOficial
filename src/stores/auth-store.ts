'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NivelAcesso = 'ADMINISTRADOR' | 'SUPERVISOR' | 'OPERADOR';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  foto?: string;
  ativo: boolean;
  nivelAcesso: NivelAcesso;
  empresaId: string;
  ultimoAcesso?: string;
}

export interface Empresa {
  id: string;
  nome: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  logo?: string;
  ativa: boolean;
  plano: string;
  bloqueada: boolean;
  llmApiKey?: string;
  llmModel?: string;
  llmApiKeyGlm?: string;
  llmApiKeyOpenrouter?: string;
}

interface AuthState {
  usuario: Usuario | null;
  empresa: Empresa | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (usuario: Usuario, empresa: Empresa, token: string) => void;
  logout: () => void;
  updateUsuario: (usuario: Partial<Usuario>) => void;
  updateEmpresa: (empresa: Partial<Empresa>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      empresa: null,
      token: null,
      isAuthenticated: false,
      login: (usuario, empresa, token) =>
        set({ usuario, empresa, token, isAuthenticated: true }),
      logout: () =>
        set({ usuario: null, empresa: null, token: null, isAuthenticated: false }),
      updateUsuario: (usuarioData) =>
        set((state) => ({
          usuario: state.usuario ? { ...state.usuario, ...usuarioData } : null,
        })),
      updateEmpresa: (empresaData) =>
        set((state) => ({
          empresa: state.empresa ? { ...state.empresa, ...empresaData } : null,
        })),
    }),
    {
      name: 'auth-storage',
    }
  )
);
