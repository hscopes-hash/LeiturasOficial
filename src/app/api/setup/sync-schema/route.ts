import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const results: string[] = [];

  try {
    results.push('✓ Verificando estrutura do banco...');

    // Usar Prisma db push para sincronizar o schema
    // Em vez de SQL raw, vamos usar o Prisma migrate/deploy
    const { PrismaClient } = await import('@prisma/client');

    // Criar tabela empresas se não existe
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS empresas (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        nome TEXT NOT NULL,
        cnpj TEXT UNIQUE,
        email TEXT,
        telefone TEXT,
        endereco TEXT,
        cidade TEXT,
        estado TEXT,
        logo TEXT,
        ativa BOOLEAN DEFAULT true,
        plano TEXT DEFAULT 'BASICO',
        "dataVencimento" TIMESTAMP(3),
        bloqueada BOOLEAN DEFAULT false,
        "motivoBloqueio" TEXT,
        "llmApiKey" TEXT,
        "llmModel" TEXT,
        "llmApiKeyGemini" TEXT,
        "llmApiKeyGlm" TEXT,
        "llmApiKeyOpenrouter" TEXT,
        "mercadopagoAccessToken" TEXT,
        "mercadopagoPublicKey" TEXT,
        "isDemo" BOOLEAN DEFAULT false,
        "diasDemo" INTEGER DEFAULT 7,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar tabela usuarios
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        nome TEXT NOT NULL,
        email TEXT NOT NULL,
        senha TEXT NOT NULL,
        telefone TEXT,
        foto TEXT,
        ativo BOOLEAN DEFAULT true,
        "nivelAcesso" TEXT DEFAULT 'OPERADOR',
        "empresaId" TEXT NOT NULL,
        "ultimoAcesso" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("empresaId") REFERENCES empresas(id) ON DELETE CASCADE,
        UNIQUE(email, "empresaId")
      )
    `);

    // Criar tabela clientes
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS clientes (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        nome TEXT NOT NULL,
        "cpfCnpj" TEXT,
        email TEXT,
        telefone TEXT,
        telefone2 TEXT,
        endereco TEXT,
        cidade TEXT,
        estado TEXT,
        cep TEXT,
        observacoes TEXT,
        whatsapp TEXT,
        "acertoPercentual" INTEGER DEFAULT 50,
        ativo BOOLEAN DEFAULT true,
        bloqueado BOOLEAN DEFAULT false,
        "motivoBloqueio" TEXT,
        "empresaId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("empresaId") REFERENCES empresas(id) ON DELETE CASCADE
      )
    `);

    // Criar tabela tipos_maquina
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tipos_maquina (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        descricao TEXT NOT NULL,
        "nomeEntrada" TEXT DEFAULT 'E',
        "nomeSaida" TEXT DEFAULT 'S',
        ativo BOOLEAN DEFAULT true,
        "empresaId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("empresaId") REFERENCES empresas(id) ON DELETE CASCADE,
        UNIQUE(descricao, "empresaId")
      )
    `);

    // Adicionar coluna classe se não existir (0=primária, 1=secundária)
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE tipos_maquina ADD COLUMN IF NOT EXISTS classe INTEGER DEFAULT 0
      `);
    } catch (e) {
      // Coluna já existe, ignorar
    }

    // Criar enums necessários para a tabela maquinas
    try { await db.$executeRawUnsafe(`CREATE TYPE "StatusMaquina" AS ENUM ('ATIVA', 'INATIVA', 'MANUTENCAO', 'VENDIDA')`); } catch (e) { /* já existe */ }
    try { await db.$executeRawUnsafe(`CREATE TYPE "TipoMoeda" AS ENUM ('M001', 'M005', 'M010', 'M025')`); } catch (e) { /* já existe */ }

    // Criar tabela maquinas
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS maquinas (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        codigo TEXT NOT NULL,
        "tipoId" TEXT NOT NULL,
        descricao TEXT,
        marca TEXT,
        modelo TEXT,
        "numeroSerie" TEXT,
        "dataAquisicao" TIMESTAMP(3),
        "valorAquisicao" DOUBLE PRECISION,
        "valorMensal" DOUBLE PRECISION,
        localizacao TEXT,
        status TEXT DEFAULT 'ATIVA',
        observacoes TEXT,
        moeda TEXT DEFAULT 'M001',
        "entradaAtual" DOUBLE PRECISION DEFAULT 0,
        "saidaAtual" DOUBLE PRECISION DEFAULT 0,
        "clienteId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("clienteId") REFERENCES clientes(id) ON DELETE CASCADE,
        FOREIGN KEY ("tipoId") REFERENCES tipos_maquina(id) ON DELETE RESTRICT,
        UNIQUE(codigo, "clienteId")
      )
    `);

    // Criar tabela assinaturas
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS assinaturas (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        plano TEXT NOT NULL,
        descricao TEXT,
        "valorMensal" DOUBLE PRECISION NOT NULL,
        "diaVencimento" INTEGER DEFAULT 10,
        "dataInicio" TIMESTAMP(3) NOT NULL,
        "dataFim" TIMESTAMP(3),
        status TEXT DEFAULT 'ATIVA',
        "clienteId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("clienteId") REFERENCES clientes(id) ON DELETE CASCADE
      )
    `);

    // Criar tabela pagamentos
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS pagamentos (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        valor DOUBLE PRECISION NOT NULL,
        "dataVencimento" TIMESTAMP(3) NOT NULL,
        "dataPagamento" TIMESTAMP(3),
        status TEXT DEFAULT 'PENDENTE',
        "formaPagamento" TEXT,
        observacoes TEXT,
        "clienteId" TEXT NOT NULL,
        "assinaturaId" TEXT,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("clienteId") REFERENCES clientes(id) ON DELETE CASCADE,
        FOREIGN KEY ("assinaturaId") REFERENCES assinaturas(id) ON DELETE SET NULL
      )
    `);

    // Criar tabela faturamentos
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS faturamentos (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "maquinaId" TEXT NOT NULL,
        "dataReferencia" TIMESTAMP(3) NOT NULL,
        "valorTotal" DOUBLE PRECISION NOT NULL,
        quantidade INTEGER,
        observacoes TEXT,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("maquinaId") REFERENCES maquinas(id) ON DELETE CASCADE
      )
    `);

    // Criar tabela leituras
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS leituras (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "maquinaId" TEXT NOT NULL,
        "clienteId" TEXT NOT NULL,
        "usuarioId" TEXT NOT NULL,
        "dataLeitura" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "entradaAnterior" DOUBLE PRECISION DEFAULT 0,
        "entradaNova" DOUBLE PRECISION DEFAULT 0,
        "saidaAnterior" DOUBLE PRECISION DEFAULT 0,
        "saidaNova" DOUBLE PRECISION DEFAULT 0,
        "diferencaEntrada" DOUBLE PRECISION DEFAULT 0,
        "diferencaSaida" DOUBLE PRECISION DEFAULT 0,
        saldo DOUBLE PRECISION DEFAULT 0,
        moeda TEXT DEFAULT 'M010',
        observacoes TEXT,
        despesa TEXT,
        "valorDespesa" DOUBLE PRECISION,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("maquinaId") REFERENCES maquinas(id) ON DELETE CASCADE,
        FOREIGN KEY ("clienteId") REFERENCES clientes(id) ON DELETE CASCADE,
        FOREIGN KEY ("usuarioId") REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);

    // Criar índices para leituras
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS leituras_clienteId_dataLeitura_idx ON leituras("clienteId", "dataLeitura")
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS leituras_maquinaId_dataLeitura_idx ON leituras("maquinaId", "dataLeitura")
    `);

    // Criar tabela logs_acesso
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS logs_acesso (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        acao TEXT NOT NULL,
        descricao TEXT,
        ip TEXT,
        "usuarioId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("usuarioId") REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);

    // Criar tabela debitos (contas a pagar e receber)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS debitos (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        descricao TEXT NOT NULL,
        valor DOUBLE PRECISION NOT NULL,
        data TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        paga BOOLEAN DEFAULT false,
        "dataPagamento" TIMESTAMP(3),
        observacoes TEXT,
        tipo INTEGER DEFAULT 1,
        "empresaId" TEXT NOT NULL,
        "clienteId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("empresaId") REFERENCES empresas(id) ON DELETE CASCADE,
        FOREIGN KEY ("clienteId") REFERENCES clientes(id) ON DELETE CASCADE
      )
    `);

    // Adicionar coluna tipo se não existir
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE debitos ADD COLUMN IF NOT EXISTS tipo INTEGER DEFAULT 1
      `);
    } catch (e) {
      // Coluna já existe, ignorar
    }

    // Adicionar coluna empresaId se não existir (migração de debito antigo para conta)
    try {
      await db.$executeRawUnsafe(`
        ALTER TABLE debitos ADD COLUMN IF NOT EXISTS "empresaId" TEXT NOT NULL DEFAULT ''
      `);
    } catch (e) {
      // Coluna já existe, ignorar
    }

    // Migrar registros sem empresaId: preencher com o empresaId do cliente
    try {
      await db.$executeRawUnsafe(`
        UPDATE debitos d
        SET "empresaId" = c."empresaId"
        FROM clientes c
        WHERE d."clienteId" = c.id
        AND (d."empresaId" IS NULL OR d."empresaId" = '')
      `);
    } catch (e) {
      // Nenhum registro para migrar ou erro ignorável
    }

    // Criar tabela planos_saas
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS planos_saas (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        nome TEXT NOT NULL UNIQUE,
        descricao TEXT,
        "valorMensal" DOUBLE PRECISION NOT NULL,
        "valorAnual" DOUBLE PRECISION,
        moeda TEXT DEFAULT 'BRL',
        "limiteClientes" INTEGER NOT NULL DEFAULT 5,
        "limiteUsuarios" INTEGER NOT NULL DEFAULT 1,
        "limiteMaquinas" INTEGER NOT NULL DEFAULT -1,
        "recIA" BOOLEAN DEFAULT false,
        "recChatIA" BOOLEAN DEFAULT false,
        "recRelatorios" BOOLEAN DEFAULT false,
        "recBackup" BOOLEAN DEFAULT false,
        "recAPI" BOOLEAN DEFAULT false,
        "recSuporte" TEXT DEFAULT 'email',
        ordem INTEGER DEFAULT 0,
        ativo BOOLEAN DEFAULT true,
        popular BOOLEAN DEFAULT false,
        "mercadoPagoPreferenceId" TEXT,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar tabela assinaturas_saas
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS assinaturas_saas (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "empresaId" TEXT NOT NULL,
        "planoSaaSId" TEXT NOT NULL,
        status TEXT DEFAULT 'ATIVA',
        "dataInicio" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "dataFim" TIMESTAMP(3),
        "dataCancelamento" TIMESTAMP(3),
        "mercadoPagoPreferenciaId" TEXT,
        "mercadoPagoPagamentoId" TEXT,
        "mercadoPagoStatus" TEXT,
        "valorPago" DOUBLE PRECISION,
        "formaPagamento" TEXT,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("empresaId") REFERENCES empresas(id) ON DELETE CASCADE,
        FOREIGN KEY ("planoSaaSId") REFERENCES planos_saas(id)
      )
    `);

    // Criar tabela pagamentos_saas
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS pagamentos_saas (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "assinaturaSaaSId" TEXT NOT NULL,
        "empresaId" TEXT NOT NULL,
        valor DOUBLE PRECISION NOT NULL,
        status TEXT DEFAULT 'PENDENTE',
        "formaPagamento" TEXT,
        "dataVencimento" TIMESTAMP(3) NOT NULL,
        "dataPagamento" TIMESTAMP(3),
        "mercadoPagoPaymentId" TEXT UNIQUE,
        "mercadoPagoStatus" TEXT,
        "mercadoPagoApprovedAt" TIMESTAMP(3),
        "mercadoPagoFee" DOUBLE PRECISION,
        descricao TEXT,
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("assinaturaSaaSId") REFERENCES assinaturas_saas(id) ON DELETE CASCADE,
        FOREIGN KEY ("empresaId") REFERENCES empresas(id) ON DELETE CASCADE
      )
    `);

    // Criar tabela webhook_logs
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        metodo TEXT NOT NULL,
        url TEXT NOT NULL,
        headers TEXT,
        body TEXT,
        query TEXT,
        "statusCode" INTEGER,
        origem TEXT DEFAULT 'mercadopago',
        "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar tabela chat_historico
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS chat_historico (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "empresaId" TEXT NOT NULL,
        "sessaoId" TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        "acaoExecutada" TEXT,
        "resultadoAcao" TEXT,
        "criadoEm" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "deletadoEm" TIMESTAMP(3)
      )
    `);

    // Criar indices para chat_historico
    try {
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS chat_historico_empresaId_criadoEm_idx ON chat_historico("empresaId", "criadoEm")
      `);
    } catch (e) { /* indice ja existe */ }
    try {
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS chat_historico_empresaId_sessaoId_idx ON chat_historico("empresaId", "sessaoId")
      `);
    } catch (e) { /* indice ja existe */ }
    try {
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS chat_historico_deletadoEm_idx ON chat_historico("deletadoEm")
      `);
    } catch (e) { /* indice ja existe */ }

    // Auto-limpeza: marcar como deletado registros com mais de 30 dias
    try {
      await db.$executeRawUnsafe(`
        UPDATE chat_historico
        SET "deletadoEm" = CURRENT_TIMESTAMP
        WHERE "deletadoEm" IS NULL
        AND "criadoEm" < CURRENT_TIMESTAMP - INTERVAL '30 days'
      `);
    } catch (e) {
      // Tabela pode nao existir ainda na primeira vez
    }

    // Auto-limpeza: remover fisicamente registros deletados ha mais de 7 dias
    try {
      await db.$executeRawUnsafe(`
        DELETE FROM chat_historico
        WHERE "deletadoEm" IS NOT NULL
        AND "deletadoEm" < CURRENT_TIMESTAMP - INTERVAL '7 days'
      `);
    } catch (e) {
      // Tabela pode nao existir ainda
    }

    // Criar tabela chat_instrucoes (instrucoes permanentes do usuario)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS chat_instrucoes (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "empresaId" TEXT NOT NULL,
        instrucao TEXT NOT NULL,
        "criadoEm" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indice para chat_instrucoes
    try {
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS chat_instrucoes_empresaId_idx ON chat_instrucoes("empresaId")
      `);
    } catch (e) { /* indice ja existe */ }

    // Adicionar colunas de impressora térmica Bluetooth (v2.25.10.118)
    try {
      await db.$executeRawUnsafe(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS "impressoraTipo" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS "impressoraPreset" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS "impressoraConexao" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS "impressoraServicoUUID" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS "impressoraCharUUID" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS "impressoraChunkSize" INTEGER`);
      results.push('✓ Colunas de impressora térmica adicionadas');
    } catch (e) {
      results.push('  (colunas de impressora ja existem ou erro: ' + (e instanceof Error ? e.message : 'desconhecido') + ')');
    }

    // Adicionar coluna recChatIA na tabela planos_saas (v2.28.0.136)
    try {
      await db.$executeRawUnsafe(`ALTER TABLE planos_saas ADD COLUMN IF NOT EXISTS "recChatIA" BOOLEAN DEFAULT false`);
      results.push('✓ Coluna recChatIA adicionada em planos_saas');
    } catch (e) {
      results.push('  (coluna recChatIA ja existe ou erro: ' + (e instanceof Error ? e.message : 'desconhecido') + ')');
    }

    // Atualizar recChatIA=true para planos Starter ou superiores (v2.28.0.136)
    try {
      const updated = await db.$executeRawUnsafe(`
        UPDATE planos_saas SET "recChatIA" = true
        WHERE nome IN ('Starter', 'Profissional', 'Empresarial', 'Enterprise')
        AND "recChatIA" = false
      `);
      results.push('✓ Planos Starter+ atualizados com recChatIA=true');
    } catch (e) {
      results.push('  (erro ao atualizar recChatIA dos planos: ' + (e instanceof Error ? e.message : 'desconhecido') + ')');
    }

    results.push('✓ Todas as tabelas foram criadas/verificadas com sucesso!');

    return NextResponse.json({
      success: true,
      message: 'Sincronização do schema concluída',
      results
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
    results.push(`✗ Erro: ${errMsg}`);
    console.error('Erro ao criar tabelas:', error);
    return NextResponse.json({
      success: false,
      message: 'Erro na sincronização',
      error: errMsg,
      results
    }, { status: 500 });
  }
}
