import { defineConfig } from '@playwright/test';

/**
 * E2E do frontend. Requer API NestJS e web em execução:
 *   PLAYWRIGHT_BASE_URL=http://localhost:8070 pnpm --filter @ajust/web test:e2e
 * O login da API limita tentativas por usuário (5 a cada 15 min); a sessão é criada uma vez
 * no projeto "setup" e reaproveitada.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8070',
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  projects: [
    { name: 'publico', testMatch: /smoke\.spec\.ts/, use: { browserName: 'chromium' } },
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { browserName: 'chromium' } },
    {
      name: 'gerencia',
      testMatch: /flows\.spec\.ts/,
      dependencies: ['setup'],
      use: { browserName: 'chromium', storageState: 'e2e/.auth/gerente.json' },
    },
  ],
});
