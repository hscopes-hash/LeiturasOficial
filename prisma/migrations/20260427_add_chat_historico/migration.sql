-- CreateTable: chat_historico
CREATE TABLE IF NOT EXISTS "chat_historico" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "acaoExecutada" TEXT,
    "resultadoAcao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletadoEm" TIMESTAMP(3),

    CONSTRAINT "chat_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_historico_empresaId_criadoEm_idx" ON "chat_historico"("empresaId", "criadoEm");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_historico_empresaId_sessaoId_idx" ON "chat_historico"("empresaId", "sessaoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_historico_deletadoEm_idx" ON "chat_historico"("deletadoEm");
