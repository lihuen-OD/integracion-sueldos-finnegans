// Escribe los fixtures sintéticos en tests/fixtures/synthetic/generated/ (ignorado por git)
// para inspección manual. Los tests no dependen de estos archivos: los generan en memoria.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildMaestroTiposMezclados,
  malformedXlsx,
  notAZip,
  zipWithoutWorkbook,
} from '../tests/fixtures/synthetic/edgeCases.ts';
import { buildFinnegansLike } from '../tests/fixtures/synthetic/finnegansLike.ts';
import {
  demostracionIntegral,
  finnegansXlsx,
  maestroXlsx,
} from '../tests/fixtures/synthetic/escenarios.ts';

const OUT = join('tests', 'fixtures', 'synthetic', 'generated');
mkdirSync(OUT, { recursive: true });
const demo = demostracionIntegral();

const outputs: Record<string, Uint8Array> = {
  'finnegans_poi_like.xlsx': buildFinnegansLike().bytes,
  'finnegans_5000.xlsx': buildFinnegansLike(5000).bytes,
  'maestro_tipos_mezclados.xlsx': buildMaestroTiposMezclados(),
  'no_es_xlsx.xlsx': notAZip(),
  'zip_sin_libro.xlsx': zipWithoutWorkbook(),
  'xml_malformado.xlsx': malformedXlsx(),
  'demo_integral_finnegans_valido.xlsx': finnegansXlsx(demo.valida.filas),
  'demo_integral_maestro_valido.xlsx': maestroXlsx(demo.valida.registros, {
    bancosReferencia: demo.valida.bancosReferencia,
  }),
  'demo_integral_finnegans_con_errores.xlsx': finnegansXlsx(demo.invalida.filas),
  'demo_integral_maestro_con_errores.xlsx': maestroXlsx(demo.invalida.registros, {
    bancosReferencia: demo.invalida.bancosReferencia,
  }),
  // Compatibilidad explícita: el contrato v1 anterior no llevaba BANCO_REFERENCIA.
  'demo_maestro_v1_anterior_compatible.xlsx': maestroXlsx(demo.valida.registros),
};

for (const [name, bytes] of Object.entries(outputs)) {
  writeFileSync(join(OUT, name), bytes);
  process.stdout.write(`${join(OUT, name)} (${String(bytes.byteLength)} bytes)\n`);
}

const instrucciones = `# Demo integral sintética CP-F8-D

Todos los datos de estos archivos son ficticios y se generan localmente. Las cuentas solo
satisfacen validadores estructurales; no se presentan como cuentas reales. No usar para pagos.

## Corrida válida

1. Abrir la aplicación en desarrollo y cargar demo_integral_finnegans_valido.xlsx.
2. Cargar demo_integral_maestro_valido.xlsx.
3. Cargar o completar un perfil empresarial sintético desde la UI.
4. Presionar Conciliar.
5. Clasificar Agrario, Comercio, Directivos y Liquidación Final desde el panel.
6. Resolver explícitamente la única fila con banco pendiente y volver a conciliar.

Distribución: 156 filas; 116 Nación, 39 Patagonia y 1 banco pendiente. Una fila Patagonia tiene
neto cero y queda excluida. Los registros Patagonia válidos usan exclusivamente documento 001.

## Corrida con errores intencionales

Cargar demo_integral_finnegans_con_errores.xlsx y demo_integral_maestro_con_errores.xlsx. Incluye
CBU inválido, provincia incompatible con documento 001, documento 002 conocido pero no confirmado
para el flujo Patagonia, componentes que no cuadran, banco no catalogado y banco vacío.

La demo no habilita generación productiva. Las compuertas BNA y Patagonia continúan cerradas.
`;
writeFileSync(join(OUT, 'DEMO_INTEGRAL_LEEME.md'), instrucciones, 'utf8');
process.stdout.write(`${join(OUT, 'DEMO_INTEGRAL_LEEME.md')}\n`);
