import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// dotenv carrega ".env" por padrão; usamos ".env.local" para manter um único
// arquivo de variáveis reais, no mesmo nome que o Next.js já lê automaticamente.
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --env-file=.env.local prisma/seed.ts",
  },
  datasource: {
    // Conexão direta (porta 5432) — usada só pelo CLI do Prisma (migrate/db pull),
    // nunca pela aplicação em runtime (essa usa o adapter em lib/db/client.ts).
    url: env("DIRECT_URL"),
  },
});
