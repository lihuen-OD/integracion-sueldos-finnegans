import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
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
