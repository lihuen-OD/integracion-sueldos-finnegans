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
      'tests/integration/**/*.test.ts',
    ],
    // Por defecto Node; los tests de UI declaran `@vitest-environment jsdom`.
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    testTimeout: 60_000,
    // `npm run test:coverage` (parte de `verify`) exige estos umbrales por capa.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx'],
      reporter: [['text', { skipFull: false }]],
      thresholds: {
        'src/shared/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'src/domain/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'src/import/*.ts': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'src/import/finnegans/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'src/import/master/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'src/reconciliation/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'src/banks/fixed-width/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'src/banks/bna/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'src/banks/trazabilidad.ts': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
});
