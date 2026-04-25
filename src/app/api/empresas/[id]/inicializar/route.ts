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

// Inicializar dados de uma empresa (tipos de máquina, usuário admin, etc.)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: empresaId } = await params;
    const body = await request.json();
    const { adminEmail, comDadosDemo } = body;

    if (adminEmail !== SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Verificar se a empresa existe
    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      include: {
        _count: {
          select: {
            tiposMaquina: true,
            usuarios: true,
          },
        },
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
      resultados.push(`${empresa._count.tiposMaquina} tipos de máquina já existem`);
    }

    // Criar usuário admin se não existir
    if (empresa._count.usuarios === 0) {
      const senhaHash = await hashSenha('admin123');
      await db.usuario.create({
        data: {
          nome: 'Administrador',
          email: `admin@${empresaId.substring(0, 8)}.com`,
          senha: senhaHash,
          nivelAcesso: 'ADMINISTRADOR',
          empresaId,
        },
      });
      resultados.push('Usuário admin criado (senha: admin123)');
    }

    // Se solicitado, criar dados de demonstração
    if (comDadosDemo) {
      // Buscar tipos criados
      const tipos = await db.tipoMaquina.findMany({ where: { empresaId } });
      const tipoMusica = tipos.find((t) => t.descricao === 'Música');
      const tipoSinuca = tipos.find((t) => t.descricao === 'Sinuca');
      const tipoJogo = tipos.find((t) => t.descricao === 'Jogo');

      // Criar clientes de exemplo
      const cliente1 = await db.cliente.create({
        data: {
          nome: 'Cliente Demo 1',
          cpfCnpj: '123.456.789-00',
          email: 'cliente1@demo.com',
          telefone: '(11) 91234-5678',
          cidade: 'São Paulo',
          estado: 'SP',
          empresaId,
        },
      });

      const cliente2 = await db.cliente.create({
        data: {
          nome: 'Cliente Demo 2',
          cpfCnpj: '987.654.321-00',
          email: 'cliente2@demo.com',
          telefone: '(11) 99876-5432',
          cidade: 'São Paulo',
          estado: 'SP',
          empresaId,
        },
      });

      resultados.push('2 clientes de demonstração criados');

      // Criar máquinas de exemplo
      if (tipoMusica && tipoSinuca && tipoJogo) {
        await db.maquina.createMany({
          data: [
            {
              codigo: 'MUS-001',
              tipoId: tipoMusica.id,
              marca: 'Grandstand',
              modelo: 'GS-500',
              clienteId: cliente1.id,
              empresaId,
              valorMensal: 500,
              status: 'ATIVA',
              moeda: 'M010',
              entradaAtual: 1505,
              saidaAtual: 452,
            },
            {
              codigo: 'SIN-001',
              tipoId: tipoSinuca.id,
              marca: 'Nacional',
              modelo: 'Profissional',
              clienteId: cliente2.id,
              empresaId,
              valorMensal: 600,
              status: 'ATIVA',
              moeda: 'M010',
              entradaAtual: 950,
              saidaAtual: 300,
            },
            {
              codigo: 'JOG-001',
              tipoId: tipoJogo.id,
              marca: 'Capcom',
              modelo: 'Arcade',
              clienteId: cliente1.id,
              empresaId,
              valorMensal: 800,
              status: 'ATIVA',
              moeda: 'M010',
              entradaAtual: 3200,
              saidaAtual: 855,
            },
          ],
        });
        resultados.push('3 máquinas de demonstração criadas');
      }

      // Criar pagamentos de exemplo
      const hoje = new Date();
      await db.pagamento.createMany({
        data: [
          {
            valor: 500,
            dataVencimento: new Date(hoje.getFullYear(), hoje.getMonth(), 10),
            status: 'PENDENTE',
            clienteId: cliente1.id,
            empresaId,
          },
          {
            valor: 600,
            dataVencimento: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 15),
            status: 'ATRASADO',
            clienteId: cliente2.id,
            empresaId,
          },
        ],
      });
      resultados.push('2 pagamentos de demonstração criados');
    }

    return NextResponse.json({
      message: 'Dados inicializados com sucesso!',
      empresa: empresa.nome,
      resultados,
    });
  } catch (error) {
    console.error('Erro ao inicializar dados:', error);
    return NextResponse.json(
      { error: 'Erro ao inicializar dados da empresa' },
      { status: 500 }
    );
  }
}
