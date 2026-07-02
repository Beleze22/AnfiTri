-- Criar tabela de configuração do sistema (IF NOT EXISTS para idempotência)
CREATE TABLE IF NOT EXISTS "system_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "system_config_key_key" ON "system_config"("key");

-- Remover default que usa o enum antes de alterar o tipo
ALTER TABLE "properties" ALTER COLUMN "category" DROP DEFAULT;

-- Converter category de enum para text (preserva os valores existentes)
ALTER TABLE "properties" ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;

-- Definir novo default como text simples
ALTER TABLE "properties" ALTER COLUMN "category" SET DEFAULT 'urbano';

-- Remover o enum (CASCADE para limpar dependências restantes)
DROP TYPE IF EXISTS "PropertyCategory" CASCADE;
