import { expect, test, type Page } from '@playwright/test';
import {
  filaFinnegans,
  maestroXlsx,
  finnegansXlsx,
  registroBna,
  espejoMuestra,
} from '../fixtures/synthetic/escenarios.ts';
import type { RegistroMaestro } from '../fixtures/synthetic/escenarios.ts';
import { plantillaPerfil } from '../../src/profile/plantilla';
import { createRandom } from '../fixtures/synthetic/identities.ts';
import { personas } from '../fixtures/synthetic/escenarios.ts';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function watch(page: Page) {
  const requests: string[] = [];
  const problems: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.name}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push(`console: ${message.text().slice(0, 120)}`);
    }
  });
  return { requests, problems };
}

async function uploadFinnegans(page: Page, bytes: Uint8Array) {
  await page.getByLabel('Archivo de la liquidación', { exact: true }).setInputFiles({
    name: 'finnegans_demo_sintética.xlsx',
    mimeType: XLSX_MIME,
    buffer: Buffer.from(bytes),
  });
}

async function uploadMaestro(page: Page, bytes: Uint8Array, name = 'maestro_demo_sintético.xlsx') {
  await page
    .getByLabel('Archivo del maestro', { exact: true })
    .setInputFiles({ name, mimeType: XLSX_MIME, buffer: Buffer.from(bytes) });
}

const external = (urls: readonly string[]) =>
  urls.filter(
    (url) =>
      !url.startsWith('http://127.0.0.1:4173/') &&
      !url.startsWith('blob:') &&
      !url.startsWith('data:'),
  );

/** Personas sintéticas sin `!` del índice (la ESLint del repo lo prohíbe). */
function exigir<T>(valor: T | undefined, rótulo: string): T {
  if (valor === undefined) {
    throw new Error(`Falta el dato esperado: ${rótulo}`);
  }
  return valor;
}

const NACION = 'BANCO DE LA NACION ARGENTINA';

test.beforeEach(({ page }) => {
  // Reinicia corrida con confirmación (window.confirm) ya aceptada.
  page.on('dialog', (dialog) => void dialog.accept());
});

test.describe('CP-F3-B · recorrido completo del asistente (datos sintéticos)', () => {
  test('corrida vacía, carga correcta, conciliación cerrada y readiness simétrico', async ({
    page,
  }) => {
    const { requests, problems } = watch(page);
    await page.goto('/');
    await expect(page.getByTestId('boton-conciliar')).toBeDisabled();
    await expect(page.getByTestId('sin-conciliar')).toBeVisible();

    const base = personas(2, 20261020);
    const filas = [
      filaFinnegans(exigir(base[0], 'persona base 0'), {
        Banco: NACION,
        Descripcion: 'JULIO Agrario',
      }),
      filaFinnegans(exigir(base[1], 'persona base 1'), {
        Banco: NACION,
        Descripcion: 'JULIO Agrario',
      }),
    ];
    const registros: RegistroMaestro[] = base.map((persona) =>
      registroBna(persona, createRandom(1)),
    );
    await uploadFinnegans(page, finnegansXlsx(filas));
    await expect(page.getByTestId('estado-finnegans')).toHaveText('Cargada: 2 filas leídas.');
    await uploadMaestro(page, maestroXlsx(registros));
    await expect(page.getByTestId('estado-maestro')).toHaveText('Cargado: 2 registros.');
    await expect(page.getByTestId('boton-conciliar')).toBeEnabled();
    await page.getByTestId('boton-conciliar').click();

    await expect(page.getByTestId('estado-global')).toHaveText('Conciliación cerrada');
    await expect(page.getByTestId('totales')).toContainText('Liquidación de Finnegans');
    // Sin mapeos aprobados del perfil (P-09/P-10 pendientes), el tipo de liquidación
    // siempre queda como bloqueante DE FILA; el estado global no lo traduce (D-026).
    await expect(page.getByTestId('grupo-caso-LIQUIDACION_SIN_MAPEO-1')).toContainText(
      'Tipo de liquidación sin mapeo aprobado',
    );
    await expect(page.getByTestId('lista-acciones')).toHaveCount(0);
    await expect(page.getByTestId('incidencias-resueltas')).toHaveCount(0);
    // Readiness simétrico, con estados según el motor (D-065/D-067).
    await expect(page.getByTestId('readiness-BNA_GT_HABERES')).toContainText('Banco Nación');
    await expect(page.getByTestId('readiness-PATAGONIA_B2')).toContainText('Banco Patagonia');
    await expect(page.getByTestId('estado-BNA_GT_HABERES')).toHaveText('Bloqueado');
    await expect(page.getByTestId('estado-PATAGONIA_B2')).toHaveText('Sin registros asignados');
    await expect(page.getByTestId('readiness-BNA_GT_HABERES')).toContainText(
      'Hay filas de este banco con bloqueos.',
    );
    for (const destino of ['BNA_GT_HABERES', 'PATAGONIA_B2']) {
      await expect(page.getByTestId(`homologacion-${destino}`)).toContainText(
        'pendiente de homologación',
      );
    }
    await page.getByTestId('boton-reiniciar').click();
    await expect(page.getByTestId('resumen-carga')).toHaveText(
      'Finnegans: pendiente · Maestro: pendiente · Perfil: sin cargar',
    );
    expect(problems).toEqual([]);
    expect(external(requests)).toEqual([]);
  });

  test('NETO_CERO: la fila queda excluida y visible en la tabla con su motivo', async ({
    page,
  }) => {
    const { problems } = watch(page);
    await page.goto('/');
    const base = personas(2, 20261020);
    const filas = [
      filaFinnegans(exigir(base[0], 'persona base 0'), { Banco: NACION }),
      filaFinnegans(exigir(base[1], 'persona base 1'), {
        Banco: NACION,
        Remunerativo: '0',
        'No remunerativo': '0',
        Descuento: '0',
        Neto: '0',
      }),
    ];
    const registros = base.map((persona) => registroBna(persona, createRandom(2)));
    await uploadFinnegans(page, finnegansXlsx(filas));
    await uploadMaestro(page, maestroXlsx(registros));
    await page.getByTestId('boton-conciliar').click();
    await expect(page.getByTestId('estado-global')).toHaveText('Conciliación cerrada');
    await expect(page.getByTestId('fila-1')).toContainText('Excluida');
    await page.getByTestId('ver-fila-1').click();
    await expect(page.getByTestId('datos-fila')).toContainText('Neto igual a cero');
    expect(problems).toEqual([]);
  });

  test('BANCO_VACIO: pendiente, asignación manual de destino y decisión aplicada', async ({
    page,
  }) => {
    const { problems } = watch(page);
    await page.goto('/');
    const base = personas(1, 20261020);
    await uploadFinnegans(
      page,
      finnegansXlsx([filaFinnegans(exigir(base[0], 'persona base 0'), { Banco: null })]),
    );
    await uploadMaestro(
      page,
      maestroXlsx([registroBna(exigir(base[0], 'persona base 0'), createRandom(3))]),
    );
    await page.getByTestId('boton-conciliar').click();
    await expect(page.getByTestId('estado-global')).toHaveText('Conciliación pendiente');
    await expect(page.getByTestId('motivos-globales')).toContainText('Hay filas pendientes');
    await expect(page.getByTestId('fila-0')).toContainText('Pendiente · Sin banco');

    const asignar = page.getByTestId('asignar-patagonia');
    await asignar.click();
    // Re-conciliación automática: la fila queda incluida con el banco elegido.
    await expect(page.getByTestId('fila-0')).toContainText('Incluida · Banco Patagonia');
    await expect(page.getByTestId('estado-global')).toHaveText('Conciliación cerrada');
    await expect(page.getByTestId('decisiones-aplicadas')).toContainText(
      'Banco asignado: Banco Patagonia',
    );
    expect(problems).toEqual([]);
  });

  test('CONFIRMAR_REVISION: revisión de legajo confirmada, queda aplicada y trazable', async ({
    page,
  }) => {
    const { problems } = watch(page);
    await page.goto('/');
    const base = personas(1, 20261020);
    await uploadFinnegans(
      page,
      finnegansXlsx([
        filaFinnegans({ ...exigir(base[0], 'persona base 0'), legajo: '007' }, { Banco: NACION }),
      ]),
    );
    await uploadMaestro(
      page,
      maestroXlsx([
        registroBna({ ...exigir(base[0], 'persona base 0'), legajo: '7' }, createRandom(4)),
      ]),
    );
    await page.getByTestId('boton-conciliar').click();
    // La fila sigue siendo bloqueante por el tipo sin mapeo (P-09); la revisión del legajo
    // aparece en el panel «Requiere tu acción» y su grupo conserva los valores observados.
    await expect(page.getByTestId('fila-0')).toContainText('Incluida · Banco Nación');
    await expect(page.getByTestId('panel-accion')).toContainText('legajo');
    // Los valores observados de ambas fuentes quedan a la vista (sin red ni captura).
    await expect(page.getByTestId('panel-accion')).toContainText('«007»');
    await expect(page.getByTestId('panel-accion')).toContainText('«7»');
    await page.getByTestId('confirmar-revision').click();
    await expect(page.getByTestId('incidencias-resueltas')).toContainText(
      'Resuelta por decisión del operador',
    );
    await expect(page.getByTestId('estado-global')).toHaveText('Conciliación cerrada');
    await expect(page.getByTestId('decisiones-aplicadas')).toContainText(
      'Revisión confirmada por el operador',
    );
    expect(problems).toEqual([]);
  });

  test('decisión no aplicada: al cambiar el maestro, la confirmación deja de valer (DATOS_CAMBIARON)', async ({
    page,
  }) => {
    const { problems } = watch(page);
    await page.goto('/');
    const base = personas(1, 20261020);
    await uploadFinnegans(
      page,
      finnegansXlsx([
        filaFinnegans({ ...exigir(base[0], 'persona base 0'), legajo: '007' }, { Banco: NACION }),
      ]),
    );
    await uploadMaestro(
      page,
      maestroXlsx([
        registroBna({ ...exigir(base[0], 'persona base 0'), legajo: '7' }, createRandom(4)),
      ]),
    );
    await page.getByTestId('boton-conciliar').click();
    await page.getByTestId('confirmar-revision').click();
    await expect(page.getByTestId('decisiones-aplicadas')).toContainText(
      'Revisión confirmada por el operador',
    );

    // Re-cargar el maestro con contenido lógico distinto (otro legajo distinto): la
    // huella de la revisión cambia (D-063, vía puente) y la decisión vieja deja de valer.
    const random = createRandom(99);
    const registroEditado = registroBna(exigir(base[0], 'persona base 0'), random, {
      LEGAJO: '8',
    });
    await uploadMaestro(page, maestroXlsx([registroEditado]), 'maestro_cambiado_sintético.xlsx');
    // El re-cargo del maestro deja la corrida sin conciliar: esperar ese estado (y no el
    // texto igual de la fase anterior) evita conciliar con el maestro viejo del estado.
    await expect(page.getByTestId('panel-resumen')).toHaveCount(0);
    await expect(page.getByTestId('estado-maestro')).toHaveText('Cargado: 1 registros.');
    await page.getByTestId('boton-conciliar').click();
    await expect(page.getByTestId('panel-accion')).toContainText('legajo');
    await expect(page.getByTestId('decisiones-no-aplicadas')).toContainText(
      'Revisión confirmada por el operador',
    );
    await expect(page.getByTestId('decisiones-no-aplicadas')).toContainText(
      'ya no son los vigentes',
    );
    expect(problems).toEqual([]);
  });

  test('conciliación bloqueada: banco fuera del catálogo es bloqueante global y ambos bancos esperan', async ({
    page,
  }) => {
    const { problems } = watch(page);
    await page.goto('/');
    const base = personas(2, 20261020);
    const filas = [
      filaFinnegans(exigir(base[0], 'persona base 0'), { Banco: NACION }),
      filaFinnegans(exigir(base[1], 'persona base 1'), { Banco: 'BANCO FANTASMA S.A.' }),
    ];
    await uploadFinnegans(page, finnegansXlsx(filas));
    await uploadMaestro(
      page,
      maestroXlsx(base.map((persona) => registroBna(persona, createRandom(5)))),
    );
    await page.getByTestId('boton-conciliar').click();
    await expect(page.getByTestId('estado-global')).toHaveText('Conciliación bloqueada');
    await expect(page.getByTestId('grupo-caso-BANCO_NO_SOPORTADO-1')).toContainText(
      'Banco fuera del catálogo',
    );
    await expect(page.getByTestId('estado-BNA_GT_HABERES')).toContainText(
      'Esperando que la conciliación cierre',
    );
    await expect(page.getByTestId('estado-PATAGONIA_B2')).toContainText(
      'Esperando que la conciliación cierre',
    );
    expect(problems).toEqual([]);
  });

  test('perfil inválido: error controlado y sin perfil cargado; perfil válido activa la corrida', async ({
    page,
  }) => {
    const { problems } = watch(page);
    await page.goto('/');
    // JSON sin campos: el validador lo rechaza por rutas y códigos, no por excepción.
    await page.getByLabel('Archivo del perfil (JSON)', { exact: true }).setInputFiles({
      name: 'perfil_truncado.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{}'),
    });
    await expect(page.getByTestId('error-perfil')).toContainText('Perfil de empresa inválido');
    await expect(page.getByTestId('estado-perfil')).toHaveText(/Sin perfil de empresa/);

    // Ahora un perfil válido, generado con la misma plantilla que exporta la UI
    // (catálogo canónico) y CUIT estructural sintético armado en runtime (D-042).
    const cuit = ['30', '45678901', '3'].join('-');
    const perfilValido = {
      ...plantillaPerfil(cuit as never),
      nombreEmpresa: 'Empresa de prueba (sintética)',
    };
    await page.getByLabel('Archivo del perfil (JSON)', { exact: true }).setInputFiles({
      name: 'perfil.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(perfilValido)),
    });
    await expect(page.getByTestId('perfil-ok')).toHaveText('Perfil de empresa cargado.');
    await expect(page.getByTestId('perfil-activo')).toContainText('Empresa de prueba');
    expect(problems).toEqual([]);
  });

  test('muestra de 156 filas: bloqueos agrupados sin perder casos, búsqueda, filtros y páginas', async ({
    page,
  }) => {
    const { problems } = watch(page);
    await page.goto('/');
    const espejo = espejoMuestra();
    await uploadFinnegans(page, finnegansXlsx([...espejo.filas]));
    await uploadMaestro(page, maestroXlsx([...espejo.registros]));
    await page.getByTestId('boton-conciliar').click();
    await expect(page.getByTestId('estado-global')).toHaveText('Conciliación pendiente');
    await expect(page.getByTestId('totales')).toContainText('156');

    // «Requiere tu acción»: solo el banco vacío (1 decisión humana); el resto son grupos.
    await expect(page.getByTestId('panel-accion')).toContainText('Requiere tu acción — 1');
    await expect(page.getByTestId('asignar-bna')).toBeVisible();

    // Bloqueos agrupados: los 154 casos idénticos no se imprimen uno por uno; al expandir
    // cada grupo se ven TODAS las incidencias (nada se pierde en la proyección).
    const grupos = page.locator('[data-testid^="grupo-caso-LIQUIDACION_SIN_MAPEO-"]');
    await expect(grupos).toHaveCount(7);
    let casosAgrupados = 0;
    for (const grupo of await grupos.all()) {
      const texto = await grupo.innerText();
      const cantidad = Number(/(\d+) casos?/.exec(texto)?.[1] ?? '0');
      casosAgrupados += cantidad;
      // El grupo colapsado es distinguible: muestra el valor observado (nada hardcodeado).
      expect(texto).toMatch(/JULIO/);
      await grupo.getByTestId(/^detalle-grupo-/).click();
    }
    expect(casosAgrupados).toBe(154);
    await expect(
      page.locator('[data-testid="incidencias-bloqueos"] [data-testid^="incidencia-"]'),
    ).toHaveCount(154);
    // Un grupo informativo (neto cero) y su conteo derivado del motor.
    await expect(page.getByTestId('incidencias-informacion')).toContainText('1 caso');

    // Nada de códigos internos (D-xxx, d-1, F2/F3) en la vista del operador.
    const cuerpo = await page.locator('body').innerText();
    expect(cuerpo).not.toMatch(/D-\d{3}/);
    expect(cuerpo).not.toMatch(/\bd-\d/);
    expect(cuerpo).not.toContain('F2');
    expect(cuerpo).not.toContain('F3');

    // Búsqueda por legajo y filtros de proyección, todos derivados del motor.
    await page.getByTestId('busqueda-empleados').fill('067');
    await expect(page.getByTestId('paginacion-empleados')).toContainText(
      '1 empleados · página 1 de 1',
    );
    await expect(page.getByTestId('fila-17')).toContainText('Pendiente · Sin banco');
    await page.getByTestId('busqueda-empleados').fill('');
    await expect(page.getByTestId('paginacion-empleados')).toContainText(
      '156 empleados · página 1 de 8',
    );
    const conteo = async (filtro: string, texto: string) => {
      await page.getByTestId(`filtro-empleados-${filtro}`).click();
      await expect(page.getByTestId('paginacion-empleados')).toContainText(texto);
    };
    await conteo('ACCION', '1 empleados');
    await conteo('BLOQUEANTES', '154 empleados');
    await conteo('INFORMACION', '1 empleados');
    await conteo('BNA', '116 empleados');
    await conteo('PATAGONIA', '38 empleados');
    await conteo('EXCLUIDOS', '1 empleados');
    await conteo('PENDIENTES', '1 empleados');
    await page.getByTestId('filtro-empleados-TODOS').click();
    await page.getByTestId('pag-siguiente').click();
    await expect(page.getByTestId('paginacion-empleados')).toContainText('página 2 de 8');
    await page.getByTestId('pag-anterior').click();
    await expect(page.getByTestId('paginacion-empleados')).toContainText('página 1 de 8');
    expect(problems).toEqual([]);
  });
});
