import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Testes de componente (C-082). Os fluxos completos continuam no Playwright (e2e/).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['components/**/*.test.tsx', 'lib/**/*.test.ts'],
  },
});
