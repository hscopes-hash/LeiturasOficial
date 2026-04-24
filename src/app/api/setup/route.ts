import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Endpoint para criar as tabelas e enums do Prisma no banco de dados
// Versão 2: faz DROP + CREATE para garantir que as colunas tenham o tipo correto
export async function POST() {
  try {
    const prisma = new PrismaClient({
      log: ['error'],
      datasources: {
        db: {
          url: process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '',
        },
      },
    });

    const results: string[] = [];

    // 1. Criar os enums necessários
    const enumsSQL = [
      { name: 'Plano', values: "'BASICO', 'PROFISSIONAL', 'PREMIUM', 'ENTERPRISE'" },
      { name: 'NivelAcesso', values: "'ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR'" },
      { name: 'StatusMaquina', values: "'ATIVA', 'INATIVA', 'MANUTENCAO', 'VENDIDA'" },
      { name: 'StatusAssinatura', values: "'ATIVA', 'SUSPENSA', 'CANCELADA', 'VENCIDA'" },
      { name: 'StatusPagamento', values: "'PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO'" },
      { name: 'FormaPagamento', values: "'PIX', 'BOLETO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO', 'TRANSFERENCIA'" },
      { name: 'TipoMoeda', values: "'M001', 'M005', 'M010', 'M025'" },
      { name: 'StatusAssinaturaSaaS', values: "'ATIVA', 'TRIAL', 'VENCIDA', 'CANCELADA', 'SUSPENSA'" },
      { name: 'StatusPagamentoSaaS', values: "'PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO', 'ESTORNADO'" },
      { name: 'FormaPagamentoSaaS', values: "'PIX', 'BOLETO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'TRANSFERENCIA'" },
    ];

    for (const enumDef of enumsSQL) {
      try {
        await prisma.$executeRawUnsafe(`
          DO $$ BEGIN
            CREATE TYPE "public"."${enumDef.name}" AS ENUM (${enumDef.values});
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$;
        `);
        results.push(`Enum "${enumDef.name}" OK`);
      } catch (e: any) {
        results.push(`Enum "${enumDef.name}": ${e.message?.substring(0, 100)}`);
      }
    }

    // 2. Drop all tables in correct order (reverse dependency) then recreate
    const dropTables = [
      'DROP TABLE IF EXISTS "pagamentos_saas" CASCADE',
      'DROP TABLE IF EXISTS "assinaturas_saas" CASCADE',
      'DROP TABLE IF EXISTS "planos_saas" CASCADE',
      'DROP TABLE IF EXISTS "debitos" CASCADE',
      'DROP TABLE IF EXISTS "webhook_logs" CASCADE',
      'DROP TABLE IF EXISTS "logs_acesso" CASCADE',
      'DROP TABLE IF EXISTS "leituras" CASCADE',
      'DROP TABLE IF EXISTS "faturamentos" CASCADE',
      'DROP TABLE IF EXISTS "pagamentos" CASCADE',
      'DROP TABLE IF EXISTS "assinaturas" CASCADE',
      'DROP TABLE IF EXISTS "maquinas" CASCADE',
      'DROP TABLE IF EXISTS "tipos_maquina" CASCADE',
      'DROP TABLE IF EXISTS "clientes" CASCADE',
      'DROP TABLE IF EXISTS "usuarios" CASCADE',
      'DROP TABLE IF EXISTS "empresas" CASCADE',
      'DROP TABLE IF EXISTS "_prisma_migrations" CASCADE',
    ];

    for (const sql of dropTables) {
      try {
        await prisma.$executeRawUnsafe(sql);
        results.push(`Drop OK`);
      } catch (e: any) {
        results.push(`Drop: ${e.message?.substring(0, 80)}`);
      }
    }

    // 3. Criar as tabelas com os tipos corretos
    const tablesSQL = [
      // empresas
      `CREATE TABLE "empresas" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "nome" TEXT NOT NULL,
        "cnpj" TEXT UNIQUE,
        "email" TEXT,
        "telefone" TEXT,
        "endereco" TEXT,
        "cidade" TEXT,
        "estado" TEXT,
        "logo" TEXT,
        "ativa" BOOLEAN NOT NULL DEFAULT true,
        "plano" "Plano" NOT NULL DEFAULT 'BASICO',
        "dataVencimento" TIMESTAMP(3),
        "isDemo" BOOLEAN NOT NULL DEFAULT false,
        "diasDemo" INTEGER NOT NULL DEFAULT 7,
        "bloqueada" BOOLEAN NOT NULL DEFAULT false,
        "motivoBloqueio" TEXT,
        "llmApiKey" TEXT,
        "llmModel" TEXT,
        "llmApiKeyGemini" TEXT,
        "llmApiKeyGlm" TEXT,
        "llmApiKeyOpenrouter" TEXT,
        "mercadopagoAccessToken" TEXT,
        "mercadopagoPublicKey" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,

      // usuarios
      `CREATE TABLE "usuarios" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "nome" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "senha" TEXT NOT NULL,
        "telefone" TEXT,
        "foto" TEXT,
        "ativo" BOOLEAN NOT NULL DEFAULT true,
        "nivelAcesso" "NivelAcesso" NOT NULL DEFAULT 'OPERADOR',
        "empresaId" TEXT NOT NULL,
        "ultimoAcesso" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "usuarios_email_empresaId_key" UNIQUE ("email", "empresaId")
      )`,
      `ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      // clientes
      `CREATE TABLE "clientes" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "nome" TEXT NOT NULL,
        "cpfCnpj" TEXT,
        "email" TEXT,
        "telefone" TEXT,
        "telefone2" TEXT,
        "endereco" TEXT,
        "cidade" TEXT,
        "estado" TEXT,
        "cep" TEXT,
        "observacoes" TEXT,
        "whatsapp" TEXT,
        "acertoPercentual" INTEGER NOT NULL DEFAULT 50,
        "ativo" BOOLEAN NOT NULL DEFAULT true,
        "bloqueado" BOOLEAN NOT NULL DEFAULT false,
        "motivoBloqueio" TEXT,
        "empresaId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE "clientes" ADD CONSTRAINT "clientes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      // tipos_maquina
      `CREATE TABLE "tipos_maquina" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "descripcion" TEXT NOT NULL,
        "nomeEntrada" TEXT NOT NULL DEFAULT 'E',
        "nomeSaida" TEXT NOT NULL DEFAULT 'S',
        "ativo" BOOLEAN NOT NULL DEFAULT true,
        "empresaId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "tipos_maquina_descripcion_empresaId_key" UNIQUE ("descripcion", "empresaId")
      )`,
      `ALTER TABLE "tipos_maquina" ADD CONSTRAINT "tipos_maquina_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      // maquinas
      `CREATE TABLE "maquinas" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "codigo" TEXT NOT NULL,
        "tipoId" TEXT NOT NULL,
        "descripcion" TEXT,
        "marca" TEXT,
        "modelo" TEXT,
        "numeroSerie" TEXT,
        "dataAquisicion" TIMESTAMP(3),
        "valorAquisicion" DOUBLE PRECISION,
        "valorMensual" DOUBLE PRECISION,
        "localizacion" TEXT,
        "status" "StatusMaquina" NOT NULL DEFAULT 'ATIVA',
        "observaciones" TEXT,
        "moeda" "TipoMoeda" NOT NULL DEFAULT 'M001',
        "entradaAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "saidaAtual" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "clienteId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "maquinas_codigo_clienteId_key" UNIQUE ("codigo", "clienteId")
      )`,
      `ALTER TABLE "maquinas" ADD CONSTRAINT "maquinas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "maquinas" ADD CONSTRAINT "maquinas_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "tipos_maquina"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,

      // assinaturas
      `CREATE TABLE "assinaturas" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "plano" TEXT NOT NULL,
        "descripcion" TEXT,
        "valorMensual" DOUBLE PRECISION NOT NULL,
        "diaVencimento" INTEGER NOT NULL DEFAULT 10,
        "dataInicio" TIMESTAMP(3) NOT NULL,
        "dataFim" TIMESTAMP(3),
        "status" "StatusAssinatura" NOT NULL DEFAULT 'ATIVA',
        "clienteId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      // pagamentos
      `CREATE TABLE "pagamentos" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "valor" DOUBLE PRECISION NOT NULL,
        "dataVencimiento" TIMESTAMP(3) NOT NULL,
        "dataPagamento" TIMESTAMP(3),
        "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
        "formaPagamento" "FormaPagamento",
        "observaciones" TEXT,
        "clienteId" TEXT NOT NULL,
        "assinaturaId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_assinaturaId_fkey" FOREIGN KEY ("assinaturaId") REFERENCES "assinaturas"("id") ON DELETE SET NULL ON UPDATE CASCADE`,

      // faturamentos
      `CREATE TABLE "faturamentos" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "maquinaId" TEXT NOT NULL,
        "dataReferencia" TIMESTAMP(3) NOT NULL,
        "valorTotal" DOUBLE PRECISION NOT NULL,
        "cantidad" INTEGER,
        "observaciones" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE "faturamentos" ADD CONSTRAINT "faturamentos_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "maquinas"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      // leituras
      `CREATE TABLE "leituras" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "maquinaId" TEXT NOT NULL,
        "clienteId" TEXT NOT NULL,
        "usuarioId" TEXT NOT NULL,
        "dataLeitura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "entradaAnterior" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "entradaNova" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "saidaAnterior" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "saidaNova" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "diferencaEntrada" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "diferencaSaida" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "saldo" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "moeda" "TipoMoeda" NOT NULL DEFAULT 'M010',
        "observaciones" TEXT,
        "despesa" TEXT,
        "valorDespesa" DOUBLE PRECISION,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE "leituras" ADD CONSTRAINT "leituras_maquinaId_fkey" FOREIGN KEY ("maquinaId") REFERENCES "maquinas"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "leituras" ADD CONSTRAINT "leituras_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "leituras" ADD CONSTRAINT "leituras_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `CREATE INDEX IF NOT EXISTS "leituras_clienteId_dataLeitura_idx" ON "leituras"("clienteId", "dataLeitura")`,
      `CREATE INDEX IF NOT EXISTS "leituras_maquinaId_dataLeitura_idx" ON "leituras"("maquinaId", "dataLeitura")`,

      // logs_acesso
      `CREATE TABLE "logs_acesso" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "acao" TEXT NOT NULL,
        "descripcion" TEXT,
        "ip" TEXT,
        "usuarioId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE "logs_acesso" ADD CONSTRAINT "logs_acesso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      // webhook_logs
      `CREATE TABLE "webhook_logs" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "metodo" TEXT NOT NULL,
        "url" TEXT NOT NULL,
        "headers" TEXT NOT NULL,
        "body" TEXT,
        "query" TEXT,
        "statusCode" INTEGER,
        "origem" TEXT NOT NULL DEFAULT 'mercadopago',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,

      // debitos
      `CREATE TABLE "debitos" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "descripcion" TEXT NOT NULL,
        "valor" DOUBLE PRECISION NOT NULL,
        "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "paga" BOOLEAN NOT NULL DEFAULT false,
        "dataPagamento" TIMESTAMP(3),
        "observaciones" TEXT,
        "empresaId" TEXT NOT NULL,
        "clienteId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE "debitos" ADD CONSTRAINT "debitos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "debitos" ADD CONSTRAINT "debitos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      // planos_saas
      `CREATE TABLE "planos_saas" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "nombre" TEXT NOT NULL,
        "descripcion" TEXT,
        "valorMensual" DOUBLE PRECISION NOT NULL,
        "valorAnual" DOUBLE PRECISION,
        "moeda" TEXT NOT NULL DEFAULT 'BRL',
        "limiteClientes" INTEGER NOT NULL,
        "limiteUsuarios" INTEGER NOT NULL,
        "limiteMaquinas" INTEGER NOT NULL,
        "recIA" BOOLEAN NOT NULL DEFAULT false,
        "recRelatorios" BOOLEAN NOT NULL DEFAULT false,
        "recBackup" BOOLEAN NOT NULL DEFAULT false,
        "recAPI" BOOLEAN NOT NULL DEFAULT false,
        "recSuporte" TEXT NOT NULL DEFAULT 'email',
        "ordem" INTEGER NOT NULL DEFAULT 0,
        "ativo" BOOLEAN NOT NULL DEFAULT true,
        "popular" BOOLEAN NOT NULL DEFAULT false,
        "mercadoPagoPreferenceId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "planos_saas_nombre_key" UNIQUE ("nombre")
      )`,

      // assinaturas_saas
      `CREATE TABLE "assinaturas_saas" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "empresaId" TEXT NOT NULL,
        "planoSaaSId" TEXT NOT NULL,
        "status" "StatusAssinaturaSaaS" NOT NULL DEFAULT 'ATIVA',
        "dataInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "dataFim" TIMESTAMP(3),
        "dataCancelamento" TIMESTAMP(3),
        "mercadoPagoPreferenciaId" TEXT,
        "mercadoPagoPagamentoId" TEXT,
        "mercadoPagoStatus" TEXT,
        "valorPago" DOUBLE PRECISION,
        "formaPagamento" "FormaPagamentoSaaS",
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE "assinaturas_saas" ADD CONSTRAINT "assinaturas_saas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "assinaturas_saas" ADD CONSTRAINT "assinaturas_saas_planoSaaSId_fkey" FOREIGN KEY ("planoSaaSId") REFERENCES "planos_saas"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,

      // pagamentos_saas
      `CREATE TABLE "pagamentos_saas" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "assinaturaSaaSId" TEXT NOT NULL,
        "empresaId" TEXT NOT NULL,
        "valor" DOUBLE PRECISION NOT NULL,
        "status" "StatusPagamentoSaaS" NOT NULL DEFAULT 'PENDENTE',
        "formaPagamento" "FormaPagamentoSaaS",
        "dataVencimiento" TIMESTAMP(3) NOT NULL,
        "dataPagamento" TIMESTAMP(3),
        "mercadoPagoPaymentId" TEXT,
        "mercadoPagoStatus" TEXT,
        "mercadoPagoApprovedAt" TIMESTAMP(3),
        "mercadoPagoFee" DOUBLE PRECISION,
        "descripcion" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "pagamentos_saas_mercadoPagoPaymentId_key" UNIQUE ("mercadoPagoPaymentId")
      )`,
      `ALTER TABLE "pagamentos_saas" ADD CONSTRAINT "pagamentos_saas_assinaturaSaaSId_fkey" FOREIGN KEY ("assinaturaSaaSId") REFERENCES "assinaturas_saas"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "pagamentos_saas" ADD CONSTRAINT "pagamentos_saas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

      // _prisma_migrations
      `CREATE TABLE "_prisma_migrations" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "checksum" TEXT NOT NULL,
        "finished_at" TIMESTAMP(3),
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMP(3),
        "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )`,
    ];

    for (let i = 0; i < tablesSQL.length; i++) {
      try {
        await prisma.$executeRawUnsafe(tablesSQL[i]);
        results.push(`Create ${i + 1} OK`);
      } catch (e: any) {
        results.push(`Create ${i + 1}: ${e.message?.substring(0, 120)}`);
      }
    }

    await prisma.$disconnect();

    return NextResponse.json({
      success: true,
      message: 'Setup completo: DROP + CREATE de todas as tabelas',
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro no setup', detail: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
