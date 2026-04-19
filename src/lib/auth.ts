import { db } from '@/lib/db';
import { Usuario, Empresa } from '@prisma/client';
import { NextRequest } from 'next/server';

export type { Usuario, Empresa };

// ============================================
// Autenticação por Token (compatível com base64 e JWT)
// ============================================

interface TokenUserData {
  userId: string;
  empresaId: string;
  email: string;
  nivelAcesso: string;
}

// Extrair userId do token (suporta base64 userId:timestamp e JWT)
export function extractUserIdFromToken(token: string): string | null {
  try {
    // Tentar formato JWT (header.payload.signature)
    if (token.includes('.')) {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return payload.sub || payload.id || payload.userId || null;
      }
    } else {
      // Formato simples: base64(userId:timestamp)
      const decoded = Buffer.from(token, 'base64').toString();
      return decoded.split(':')[0] || null;
    }
  } catch {
    return null;
  }
}

// Obter dados completos do usuário a partir do token
export async function getUserFromRequest(request: NextRequest): Promise<TokenUserData | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.substring(7);
    const userId = extractUserIdFromToken(token);
    if (!userId) return null;

    const usuario = await db.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nivelAcesso: true,
        ativo: true,
        empresaId: true,
      },
    });

    if (!usuario || !usuario.ativo) return null;

    return {
      userId: usuario.id,
      empresaId: usuario.empresaId || '',
      email: usuario.email,
      nivelAcesso: usuario.nivelAcesso,
    };
  } catch {
    return null;
  }
}

// Verificar se é super admin
export async function isSuperAdmin(request: NextRequest): Promise<boolean> {
  const user = await getUserFromRequest(request);
  return user?.nivelAcesso === 'ADMINISTRADOR';
}

// Verificar se está autenticado (qualquer usuário ativo)
export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const user = await getUserFromRequest(request);
  return user !== null;
}

// Criptografia simples para senha (em produção usar bcrypt)
export async function hashSenha(senha: string): Promise<string> {
  // Para produção, usar bcrypt ou similar
  const encoder = new TextEncoder();
  const data = encoder.encode(senha + 'machines-gestao-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  const senhaHash = await hashSenha(senha);
  return senhaHash === hash;
}

export async function autenticarUsuario(email: string, senha: string, empresaId: string): Promise<{ usuario: Usuario; empresa: Empresa } | null> {
  const usuario = await db.usuario.findFirst({
    where: {
      email,
      empresaId,
      ativo: true,
    },
    include: {
      empresa: true,
    },
  });

  if (!usuario) {
    return null;
  }

  const senhaValida = await verificarSenha(senha, usuario.senha);

  if (!senhaValida) {
    return null;
  }

  // Atualizar último acesso
  await db.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAcesso: new Date() },
  });

  const { senha: _, ...usuarioSemSenha } = usuario;
  return { usuario: usuarioSemSenha as Usuario, empresa: usuario.empresa };
}

export function temPermissao(nivelAcesso: string, acaoRequerida: string[]): boolean {
  const permissoes: Record<string, string[]> = {
    ADMINISTRADOR: ['all'],
    SUPERVISOR: ['view', 'create', 'edit', 'reports'],
    OPERADOR: ['view', 'edit'],
  };

  const permissoesUsuario = permissoes[nivelAcesso] || [];
  
  if (permissoesUsuario.includes('all')) return true;
  
  return acaoRequerida.every(acao => permissoesUsuario.includes(acao));
}

export function isAdmin(nivelAcesso: string): boolean {
  return nivelAcesso === 'ADMINISTRADOR';
}

export function isSupervisor(nivelAcesso: string): boolean {
  return nivelAcesso === 'SUPERVISOR' || nivelAcesso === 'ADMINISTRADOR';
}
