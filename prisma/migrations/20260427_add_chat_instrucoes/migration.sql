-- CreateTable: chat_instrucoes
CREATE TABLE IF NOT EXISTS "chat_instrucoes" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "instrucao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_instrucoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_instrucoes_empresaId_idx" ON "chat_instrucoes"("empresaId");
