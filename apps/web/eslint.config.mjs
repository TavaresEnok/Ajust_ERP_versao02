import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: ['.next*/**', 'tmp/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'],
  },
  ...compat.extends('next/core-web-vitals'),
];

export default config;
