import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashSenha } from '@/lib/auth';

// Restaurar dados da empresa a partir de um backup JSON
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { backupData, empresaId } = body;

    if (!empresaId || !backupData) {
      return NextResponse.json(
        { error: 'Dados do backup e ID da empresa são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se a empresa existe
    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
    });

    if (!empresa) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    // Validar estrutura do backup
    if (!backupData.versao || !backupData.dados) {
      return NextResponse.json(
        { error: 'Formato de backup inválido. O arquivo não contém a estrutura esperada.' },
        { status: 400 }
      );
    }

    const { dados } = backupData;

    // Gerar mapas de IDs antigos para novos (para manter relacionamentos)
    const idMap = new Map<string, string>();

    // Função auxiliar para gerar novo ID mapeando do antigo
    const newId = (oldId: string) => {
      if (!idMap.has(oldId)) {
        // Usar o próprio ID antigo para manter compatibilidade
        idMap.set(oldId, oldId);
      }
      return idMap.get(oldId)!;
    };

    let restaurados = {
      tiposMaquina: 0,
      clientes: 0,
      usuarios: 0,
      maquinas: 0,
      assinaturas: 0,
      pagamentos: 0,
      faturamentos: 0,
      leituras: 0,
    };

    // Usar transação para garantir integridade
    await db.$transaction(async (tx) => {
      // 1. Limpar dados existentes da empresa (em ordem inversa de dependências)
      await tx.leitura.deleteMany({
        where: { cliente: { empresaId } },
      });
      await tx.faturamento.deleteMany({
        where: { maquina: { cliente: { empresaId } } },
      });
      await tx.pagamento.deleteMany({
        where: { cliente: { empresaId } },
      });
      await tx.assinatura.deleteMany({
        where: { cliente: { empresaId } },
      });
      await tx.maquina.deleteMany({
        where: { cliente: { empresaId } },
      });
      await tx.logAcesso.deleteMany({
        where: { usuario: { empresaId } },
      });
      await tx.usuario.deleteMany({
        where: { empresaId },
      });
      await tx.cliente.deleteMany({
        where: { empresaId },
      });
      await tx.tipoMaquina.deleteMany({
        where: { empresaId },
      });

      // 2. Restaurar Tipos de Máquina
      if (dados.tiposMaquina && Array.isArray(dados.tiposMaquina)) {
        for (const tipo of dados.tiposMaquina) {
          const { id, createdAt, updatedAt, ...tipoData } = tipo;
          idMap.set(id, id); // Manter o mesmo ID para preservar referências
          await tx.tipoMaquina.create({
            data: {
              ...tipoData,
              id: newId(id),
              empresaId,
            },
          });
          restaurados.tiposMaquina++;
        }
      }

      // 3. Restaurar Clientes
      if (dados.clientes && Array.isArray(dados.clientes)) {
        for (const cliente of dados.clientes) {
          const { id, createdAt, updatedAt, empresaId: _, ...clienteData } = cliente;
          idMap.set(id, id);
          await tx.cliente.create({
            data: {
              ...clienteData,
              id: newId(id),
              empresaId,
            },
          });
          restaurados.clientes++;
        }
      }

      // 4. Restaurar Usuários (re-hash senhas padrão)
      if (dados.usuarios && Array.isArray(dados.usuarios)) {
        for (const usuario of dados.usuarios) {
          const { id, createdAt, updatedAt, empresaId: _, senha, ...usuarioData } = usuario;
          idMap.set(id, id);
          // Se a senha veio no backup, usa; senão gera hash padrão
          const senhaHash = senha || await hashSenha('123456');
          await tx.usuario.create({
            data: {
              ...usuarioData,
              id: newId(id),
              senha: senhaHash,
              empresaId,
            },
          });
          restaurados.usuarios++;
        }
      }

      // 5. Restaurar Máquinas
      if (dados.maquinas && Array.isArray(dados.maquinas)) {
        for (const maquina of dados.maquinas) {
          const { id, createdAt, updatedAt, clienteId, tipoId, cliente, tipo, nome, ...maquinaData } = maquina;
          idMap.set(id, id);

          // Verificar se o clienteId existe nos dados restaurados
          const mappedClienteId = newId(clienteId);
          const mappedTipoId = newId(tipoId);

          const clienteExists = await tx.cliente.findUnique({ where: { id: mappedClienteId } });
          const tipoExists = await tx.tipoMaquina.findUnique({ where: { id: mappedTipoId } });

          if (clienteExists && tipoExists) {
            await tx.maquina.create({
              data: {
                ...maquinaData,
                id: newId(id),
                clienteId: mappedClienteId,
                tipoId: mappedTipoId,
              },
            });
            restaurados.maquinas++;
          }
        }
      }

      // 6. Restaurar Assinaturas
      if (dados.assinaturas && Array.isArray(dados.assinaturas)) {
        for (const assinatura of dados.assinaturas) {
          const { id, createdAt, updatedAt, clienteId, cliente, pagamentos, ...assinaturaData } = assinatura;
          idMap.set(id, id);

          const mappedClienteId = newId(clienteId);
          const clienteExists = await tx.cliente.findUnique({ where: { id: mappedClienteId } });

          if (clienteExists) {
            await tx.assinatura.create({
              data: {
                ...assinaturaData,
                id: newId(id),
                clienteId: mappedClienteId,
              },
            });
            restaurados.assinaturas++;
          }
        }
      }

      // 7. Restaurar Pagamentos
      if (dados.pagamentos && Array.isArray(dados.pagamentos)) {
        for (const pagamento of dados.pagamentos) {
          const { id, createdAt, updatedAt, clienteId, cliente, assinatura, ...pagamentoData } = pagamento;
          idMap.set(id, id);

          const mappedClienteId = newId(clienteId);
          const mappedAssinaturaId = pagamentoData.assinaturaId ? newId(pagamentoData.assinaturaId) : null;
          const clienteExists = await tx.cliente.findUnique({ where: { id: mappedClienteId } });

          if (clienteExists) {
            await tx.pagamento.create({
              data: {
                ...pagamentoData,
                id: newId(id),
                clienteId: mappedClienteId,
                assinaturaId: mappedAssinaturaId,
              },
            });
            restaurados.pagamentos++;
          }
        }
      }

      // 8. Restaurar Faturamentos
      if (dados.faturamentos && Array.isArray(dados.faturamentos)) {
        for (const faturamento of dados.faturamentos) {
          const { id, createdAt, updatedAt, maquinaId, maquina, ...faturamentoData } = faturamento;
          idMap.set(id, id);

          const mappedMaquinaId = newId(maquinaId);
          const maquinaExists = await tx.maquina.findUnique({ where: { id: mappedMaquinaId } });

          if (maquinaExists) {
            await tx.faturamento.create({
              data: {
                ...faturamentoData,
                id: newId(id),
                maquinaId: mappedMaquinaId,
              },
            });
            restaurados.faturamentos++;
          }
        }
      }

      // 9. Restaurar Leituras
      if (dados.leituras && Array.isArray(dados.leituras)) {
        for (const leitura of dados.leituras) {
          const { id, createdAt, maquinaId, clienteId, usuarioId, maquina, cliente, usuario, ...leituraData } = leitura;
          idMap.set(id, id);

          const mappedMaquinaId = newId(maquinaId);
          const mappedClienteId = newId(clienteId);
          const mappedUsuarioId = newId(usuarioId);

          const maquinaExists = await tx.maquina.findUnique({ where: { id: mappedMaquinaId } });
          const clienteExists = await tx.cliente.findUnique({ where: { id: mappedClienteId } });
          const usuarioExists = await tx.usuario.findUnique({ where: { id: mappedUsuarioId } });

          if (maquinaExists && clienteExists && usuarioExists) {
            await tx.leitura.create({
              data: {
                ...leituraData,
                id: newId(id),
                maquinaId: mappedMaquinaId,
                clienteId: mappedClienteId,
                usuarioId: mappedUsuarioId,
              },
            });
            restaurados.leituras++;
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Backup restaurado com sucesso!',
      restaurados,
    });
  } catch (error) {
    console.error('Erro ao restaurar backup:', error);
    return NextResponse.json(
      { error: 'Erro ao restaurar backup. Verifique o formato do arquivo e tente novamente.' },
      { status: 500 }
    );
  }
}
