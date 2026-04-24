import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const results: string[] = [];

    // Step 1: Verificar se tabela empresas existe
    results.push('✓ Verificando estrutura do banco...');

    // Step 2: Adicionar colunas novas em tabelas existentes
    try {
      await db.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'leituras' AND column_name = 'despesa'
          ) THEN
            ALTER TABLE leituras ADD COLUMN "despesa" TEXT;
          END IF;
        END $$;
      `);
      results.push('✓ Coluna despesa verificada em leituras');
    } catch (e) {
      results.push('⚠ Coluna despesa em leituras: ' + (e instanceof Error ? e.message : String(e)));
    }

    try {
      await db.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'leituras' AND column_name = 'valorDespesa'
          ) THEN
            ALTER TABLE leituras ADD COLUMN "valorDespesa" DOUBLE PRECISION;
          END IF;
        END $$;
      `);
      results.push('✓ Coluna valorDespesa verificada em leituras');
    } catch (e) {
      results.push('⚠ Coluna valorDespesa em leituras: ' + (e instanceof Error ? e.message : String(e)));
    }

    // Step 3: Criar/migrar tabela debitos
    try {
      // Tenta acessar via Prisma (verifica se tabela debitos já existe)
      await db.debito.findFirst();
      results.push('✓ Tabela debitos já existe e está acessível');
    } catch {
      // Tabela debitos não existe via Prisma - verificar se tabela "despesas" antiga existe
      try {
        const oldTable = await db.$executeRawUnsafe(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'despesas'
          ) as exists;
        `);

        // Verificar se tabela antiga despesas existe
        const result = await db.$queryRawUnsafe<{ exists: boolean }[]>(
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'despesas') as exists`
        );
        
        if (result[0]?.exists) {
          results.push('✓ Tabela "despesas" encontrada - migrando para "debitos"...');
          
          // Renomear tabela
          await db.$executeRawUnsafe(`ALTER TABLE "despesas" RENAME TO "debitos"`);
          results.push('✓ Tabela renomeada: despesas → debitos');
          
          // Renomear constraint de primary key
          try {
            await db.$executeRawUnsafe(`
              DO $$
              BEGIN
                IF EXISTS (
                  SELECT 1 FROM information_schema.table_constraints 
                  WHERE table_name = 'debitos' AND constraint_name LIKE '%despesas%'
                ) THEN
                  ALTER TABLE "debitos" RENAME CONSTRAINT "despesas_pkey" TO "debitos_pkey";
                END IF;
              END $$;
            `);
            results.push('✓ Primary key constraint renomeada');
          } catch (pkErr) {
            results.push('⚠ PK constraint: ' + (pkErr instanceof Error ? pkErr.message : String(pkErr)));
          }
        } else {
          results.push('✓ Criando tabela debitos (nova)...');
          
          // Criar tabela debitos do zero
          await db.$executeRawUnsafe(`
            CREATE TABLE "debitos" (
              id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
              descricao TEXT NOT NULL,
              valor DOUBLE PRECISION NOT NULL,
              "dataVencimento" TIMESTAMP(3) NOT NULL,
              "dataPagamento" TIMESTAMP(3),
              status TEXT DEFAULT 'PENDENTE',
              observacoes TEXT,
              "clienteId" TEXT NOT NULL,
              "empresaId" TEXT NOT NULL,
              "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
              "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY ("clienteId") REFERENCES clientes(id) ON DELETE CASCADE,
              FOREIGN KEY ("empresaId") REFERENCES empresas(id) ON DELETE CASCADE
            )
          `);
          results.push('✓ Tabela debitos criada com sucesso');
        }
      } catch (migrationErr) {
        results.push('⚠ Migração debitos: ' + (migrationErr instanceof Error ? migrationErr.message : String(migrationErr)));
      }
    }

    // Step 4: Adicionar colunas SaaS se não existirem
    try {
      await db.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'empresas' AND column_name = 'llmApiKey'
          ) THEN
            ALTER TABLE empresas ADD COLUMN "llmApiKey" TEXT;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'empresas' AND column_name = 'llmModel'
          ) THEN
            ALTER TABLE empresas ADD COLUMN "llmModel" TEXT;
          END IF;
        END $$;
      `);
      results.push('✓ Colunas de IA verificadas em empresas');
    } catch (e) {
      results.push('⚠ Colunas IA: ' + (e instanceof Error ? e.message : String(e)));
    }

    return NextResponse.json({
      success: true,
      message: 'Sincronização do schema concluída',
      results
    });
  } catch (error) {
    console.error('Erro ao sincronizar schema:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }, { status: 500 });
  }
}
