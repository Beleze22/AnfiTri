import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // Os testes de integração truncam tabelas; rodar arquivos em paralelo
    // faria um limpar o banco debaixo do outro.
    fileParallelism: false,
  },
  resolve: {
    // Mesmo alias "@/*" do tsconfig.
    alias: { "@": path.resolve(__dirname) },
  },
});
