import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // O NestJS depende de emitDecoratorMetadata para a injeção de dependências.
  // O transformador padrão do Vite não gera esses metadados por completo; o SWC gera.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/main.ts', 'src/**/*.module.ts'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
          // Na aplicação, o @nestjs/core carrega este polyfill; testes unitários
          // que não importam o Nest (ex.: validação de env) precisam dele também.
          setupFiles: ['reflect-metadata'],
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          globalSetup: ['./test/global-setup.ts'],
          setupFiles: ['./test/setup-env.ts'],
          // Os arquivos compartilham o mesmo banco: executamos um de cada vez.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
});
