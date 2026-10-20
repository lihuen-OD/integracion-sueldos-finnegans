// Configuración para pruebas LOCALES con archivos reales (T10). No forma parte de `npm test`.
// Uso: T10_FINNEGANS_PATH=references/Finnegans_Reporte_Ejemplo.xlsx npm run spike:t10
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { exceljs: 'exceljs/dist/exceljs.min.js' },
  },
  test: {
    include: ['tests/local/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
});
