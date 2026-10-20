import nextVitals from 'eslint-config-next/core-web-vitals';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [
      '.next*/**',
      'tmp/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...nextVitals,
  {
    // Regras do React Compiler (novas no eslint-config-next 16). O código herdado do redesign
    // usa efeitos de montagem e Date.now() no render; refatorar nas fases de integração.
    rules: {
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default config;
