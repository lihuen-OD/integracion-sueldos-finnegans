import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Los tests usan el mismo bundle de ExcelJS que Vite empaqueta para el navegador
    // (campo "browser" de su package.json), no la versión para Node.
    alias: { exceljs: 'exceljs/dist/exceljs.min.js' },
  },
  test: {
    include: [
      'tests/unit/**/*.test.{ts,tsx}',
      'tests/guardrails/**/*.test.ts',
      'tests/scripts/**/*.test.ts',
      'tests/spike/**/*.test.ts',
    ],
    // Por defecto Node; los tests de UI declaran `@vitest-environment jsdom`.
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    testTimeout: 60_000,
  },
});
