import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { seedTiposMaquina } from '@/lib/seed-tipos';

const SUPER_ADMIN_EMAIL = 'hscopes@gmail.com';

// Função para hash de senha
async function hashSenha(senha: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(senha + 'machines-gestao-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Inicializar dados de uma empresa
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminEmail, empresaId } = body;

    if (adminEmail !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    if (!empresaId) {
      return NextResponse.json(
        { error: 'ID da empresa é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se a empresa existe
    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      include: {
        tiposMaquina: true,
        usuarios: true,
      },
    });

    if (!empresa) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    const resultados: string[] = [];

    // Criar tipos de máquina padrão
    const tiposCriados = await seedTiposMaquina(empresaId);
    if (tiposCriados > 0) {
      resultados.push(`${tiposCriados} tipos de máquina criados`);
    } else {
      resultados.push(`${empresa.tiposMaquina.length} tipos de máquina já existem`);
    }

    // Criar usuário admin se não existir
    if (empresa.usuarios.length === 0) {
      const senhaHash = await hashSenha('admin123');
      await db.usuario.create({
        data: {
          nome: 'Administrador',
          email: `admin@${empresa.id.substring(0, 8)}.com`,
          senha: senhaHash,
          nivelAcesso: 'ADMINISTRADOR',
          empresaId: empresa.id,
        },
      });
      resultados.push('Usuário admin criado (senha: admin123)');
    } else {
      resultados.push(`${empresa.usuarios.length} usuários já existem`);
    }

    return NextResponse.json({
      success: true,
      message: 'Dados inicializados com sucesso',
      resultados,
    });
  } catch (error) {
    console.error('Erro ao inicializar empresa:', error);
    return NextResponse.json(
      { error: 'Erro ao inicializar empresa' },
      { status: 500 }
    );
  }
}
