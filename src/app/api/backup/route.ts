import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Exportar todos os dados da empresa como JSON (Backup)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');

    if (!empresaId) {
      return NextResponse.json(
        { error: 'ID da empresa é obrigatório' },
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

    // Exportar todos os dados da empresa em ordem de dependência
    const [
      tiposMaquina,
      clientes,
      usuarios,
      maquinas,
      assinaturas,
      pagamentos,
      faturamentos,
      leituras,
      logsAcesso,
    ] = await Promise.all([
      // Tipos de Máquina (sem dependências)
      db.tipoMaquina.findMany({
        where: { empresaId },
        orderBy: { descricao: 'asc' },
      }),
      // Clientes (depende da empresa)
      db.cliente.findMany({
        where: { empresaId },
        orderBy: { nome: 'asc' },
      }),
      // Usuários (depende da empresa)
      db.usuario.findMany({
        where: { empresaId },
        orderBy: { nome: 'asc' },
      }),
      // Máquinas (depende de cliente e tipo)
      db.maquina.findMany({
        where: { cliente: { empresaId } },
        orderBy: { codigo: 'asc' },
      }),
      // Assinaturas (depende de cliente)
      db.assinatura.findMany({
        where: { cliente: { empresaId } },
        orderBy: { dataInicio: 'desc' },
      }),
      // Pagamentos (depende de cliente)
      db.pagamento.findMany({
        where: { cliente: { empresaId } },
        orderBy: { dataVencimento: 'desc' },
      }),
      // Faturamentos (depende de máquina)
      db.faturamento.findMany({
        where: { maquina: { cliente: { empresaId } } },
        orderBy: { dataReferencia: 'desc' },
      }),
      // Leituras (depende de máquina, cliente, usuário)
      db.leitura.findMany({
        where: { cliente: { empresaId } },
        orderBy: { dataLeitura: 'desc' },
      }),
      // Logs de Acesso (depende de usuário)
      db.logAcesso.findMany({
        where: { usuario: { empresaId } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const backupData = {
      versao: '2.7.0.0',
      dataBackup: new Date().toISOString(),
      empresa: {
        id: empresa.id,
        nome: empresa.nome,
        cnpj: empresa.cnpj,
        email: empresa.email,
        telefone: empresa.telefone,
        endereco: empresa.endereco,
        cidade: empresa.cidade,
        estado: empresa.estado,
        logo: empresa.logo,
        ativa: empresa.ativa,
        plano: empresa.plano,
        dataVencimento: empresa.dataVencimento?.toISOString() || null,
        isDemo: empresa.isDemo,
        diasDemo: empresa.diasDemo,
        bloqueada: empresa.bloqueada,
        motivoBloqueio: empresa.motivoBloqueio,
      },
      resumo: {
        tiposMaquina: tiposMaquina.length,
        clientes: clientes.length,
        usuarios: usuarios.length,
        maquinas: maquinas.length,
        assinaturas: assinaturas.length,
        pagamentos: pagamentos.length,
        faturamentos: faturamentos.length,
        leituras: leituras.length,
        logsAcesso: logsAcesso.length,
      },
      dados: {
        tiposMaquina,
        clientes,
        usuarios: usuarios.map(u => ({
          ...u,
          senha: undefined, // Não exportar senhas por segurança
        })),
        maquinas,
        assinaturas,
        pagamentos,
        faturamentos,
        leituras,
        logsAcesso,
      },
    };

    return NextResponse.json(backupData);
  } catch (error) {
    console.error('Erro ao gerar backup:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar backup dos dados' },
      { status: 500 }
    );
  }
}
