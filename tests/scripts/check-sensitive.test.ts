import { describe, expect, it } from 'vitest';
import {
  checkPath,
  formatFinding,
  isProbablyBinary,
  scanText,
} from '../../scripts/lib/sensitive.ts';

// Los valores de prueba se arman en tiempo de ejecución para que este archivo
// no contenga literales con forma de CUIL/CBU (el propio escáner lo revisa).
const cuilConGuiones = ['20', '00012345', '6'].join('-');
const cuilSinGuiones = ['27', '00054321', '0'].join('');
const cbuContinuo = '0'.repeat(3) + '1'.repeat(19);
const cbuEnBloques = `${'1'.repeat(8)}-${'2'.repeat(14)}`;

describe('scanText', () => {
  it.each([
    ['CUIL con guiones', `cuil: ${cuilConGuiones}`, 'POSIBLE_CUIL'],
    ['CUIL sin guiones', `"${cuilSinGuiones}"`, 'POSIBLE_CUIL'],
    ['CBU continuo', `cbu=${cbuContinuo}`, 'POSIBLE_CBU'],
    ['CBU en bloques', cbuEnBloques, 'POSIBLE_CBU'],
  ])('detecta %s', (_name, text, rule) => {
    const findings = scanText('src/ejemplo.ts', `primera línea\n${text}\n`);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule, line: 2 });
  });

  it('no reproduce el valor detectado en el informe', () => {
    const [finding] = scanText('docs/x.md', cuilConGuiones);
    expect(finding).toBeDefined();
    if (finding !== undefined) {
      expect(formatFinding(finding)).not.toContain('00012345');
    }
  });

  it('ignora patrones enmascarados y números que no tienen forma de CUIL o CBU', () => {
    const text = ['`99-99999999-9`', 'versión 20.19.0', 'total 1234567', '9'.repeat(23)].join('\n');
    expect(scanText('docs/x.md', text)).toEqual([]);
  });

  it('también analiza el contenido de los fixtures sintéticos (D-042)', () => {
    const findings = scanText('tests/fixtures/synthetic/identities.ts', cuilConGuiones);
    expect(findings.map((finding) => finding.rule)).toEqual(['POSIBLE_CUIL']);
  });
});

describe('checkPath', () => {
  it.each([
    ['references/BNA.pdf', 'RUTA_REFERENCES'],
    ['references/Finnegans.xlsx', 'RUTA_REFERENCES'],
    ['datos/liquidacion.xlsx', 'ARCHIVO_DE_DATOS'],
    ['salida/BNA.txt', 'ARCHIVO_DE_DATOS'],
    ['exportacion.csv', 'ARCHIVO_DE_DATOS'],
    ['MAESTRO_CUENTAS_EMPLEADOS.xlsx', 'ARCHIVO_OPERATIVO'],
    ['PERFIL_EMPRESA_X.json', 'ARCHIVO_OPERATIVO'],
    ['config/empresa.perfil.json', 'ARCHIVO_OPERATIVO'],
  ])('rechaza %s', (path, rule) => {
    expect(checkPath(path).map((finding) => finding.rule)).toContain(rule);
  });

  it.each([
    'references/LEEME.txt',
    'tests/fixtures/synthetic/finnegans.xlsx',
    'tests/fixtures/synthetic/golden/bna.txt',
    'src/import/xlsx/excelAdapter.ts',
    'package.json',
  ])('acepta %s', (path) => {
    expect(checkPath(path)).toEqual([]);
  });
});

describe('isProbablyBinary', () => {
  it('distingue binario de texto', () => {
    expect(isProbablyBinary(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe(true);
    expect(isProbablyBinary(new TextEncoder().encode('texto plano'))).toBe(false);
  });
});
