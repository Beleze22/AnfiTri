// Testes que tocam o banco usam TEST_DATABASE_URL, nunca o banco de
// desenvolvimento — eles truncam tabelas entre casos e apagariam os dados do
// gestor. O singleton do Prisma lê DATABASE_URL no momento do import, e os
// setupFiles do vitest rodam antes dos arquivos de teste, então apontar aqui
// é suficiente.
//
// Local: `npx prisma dev -P 5433` sobe um Postgres sem precisar de Docker.
// CI: serviço postgres do GitHub Actions (ver .github/workflows/ci.yml).
// Sem a variável, os testes de integração se marcam como skip em vez de
// falhar, e os de função pura seguem rodando.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
