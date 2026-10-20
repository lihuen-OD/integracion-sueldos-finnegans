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

const OUT = join('tests', 'fixtures', 'synthetic', 'generated');
mkdirSync(OUT, { recursive: true });

const outputs: Record<string, Uint8Array> = {
  'finnegans_poi_like.xlsx': buildFinnegansLike().bytes,
  'finnegans_5000.xlsx': buildFinnegansLike(5000).bytes,
  'maestro_tipos_mezclados.xlsx': buildMaestroTiposMezclados(),
  'no_es_xlsx.xlsx': notAZip(),
  'zip_sin_libro.xlsx': zipWithoutWorkbook(),
  'xml_malformado.xlsx': malformedXlsx(),
};

for (const [name, bytes] of Object.entries(outputs)) {
  writeFileSync(join(OUT, name), bytes);
  process.stdout.write(`${join(OUT, name)} (${String(bytes.byteLength)} bytes)\n`);
}
