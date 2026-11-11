// @vitest-environment jsdom
// Pruebas de UI del asistente CP-F3-B. La UI no implementa reglas: aquí solo se prueban
// accesibilidad básica, avisos y estados de arranque.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../../src/ui/App';
import {
  filaFinnegans,
  finnegansXlsx,
  maestroXlsx,
  personas,
  registroBna,
} from '../../fixtures/synthetic/escenarios.ts';
import {
  createRandom,
  syntheticCbu,
  syntheticCuenta,
  syntheticCuil,
} from '../../fixtures/synthetic/identities.ts';
import { plantillaPerfil } from '../../../src/profile/plantilla';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NACION = 'BANCO DE LA NACION ARGENTINA';

/** File de prueba con copia de bytes de tipos alineados (Uint8Array<ArrayBuffer>). */
function archivo(bytes: Uint8Array, nombre: string, mime: string): File {
  const copia = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copia.set(bytes);
  return new File([copia], nombre, { type: mime });
}

afterEach(cleanup);

/** Corrida mínima con conciliación visible usando archivos sintéticos reales. */
async function concilacionVisible(usuario: ReturnType<typeof userEvent.setup>) {
  const [una, dos] = personas(2, 20261020);
  if (una === undefined || dos === undefined) {
    throw new Error('personas esperadas');
  }
  await usuario.upload(
    screen.getByLabelText('Archivo de la liquidación', { exact: true }),
    archivo(
      finnegansXlsx([filaFinnegans(una, { Banco: NACION }), filaFinnegans(dos, { Banco: NACION })]),
      'finnegans_demo.xlsx',
      XLSX_MIME,
    ),
  );
  await usuario.upload(
    screen.getByLabelText('Archivo del maestro', { exact: true }),
    new File(
      [
        archivo(
          maestroXlsx([registroBna(una, createRandom(1)), registroBna(dos, createRandom(2))]),
          'maestro_demo.xlsx',
          XLSX_MIME,
        ),
      ],
      'maestro_demo.xlsx',
      { type: XLSX_MIME },
    ),
  );
  await waitFor(() => {
    expect(screen.getByTestId('resumen-carga')).toHaveTextContent(
      'Finnegans: cargada · Maestro: cargado',
    );
  });
  await usuario.click(screen.getByTestId('boton-conciliar'));
  await waitFor(() => {
    expect(screen.getByTestId('panel-resumen')).toBeInTheDocument();
  });
}

describe('App · corrida recién iniciada', () => {
  it('avisa que no apto para pagos y que las salidas quedan pendientes de homologación', () => {
    render(<App />);
    expect(screen.getByRole('note')).toHaveTextContent('No apto para pagos');
    expect(screen.getByRole('note')).toHaveTextContent('pendientes de homologación');
  });

  it('ofrece la carga de los dos archivos con etiquetas accesibles y sin autocompletado', () => {
    render(<App />);
    for (const label of ['Archivo de la liquidación', 'Archivo del maestro']) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute('type', 'file');
      expect(input).toHaveAttribute('autocomplete', 'off');
    }
  });

  it('ofrece la plantilla del maestro; la prellenada exige la liquidación cargada', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: 'Descargar plantilla del maestro (vacía)' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Descargar maestro prellenado' })).toBeDisabled();
    expect(screen.getByTestId('prellenado')).toHaveTextContent(
      'Cargá la liquidación de Finnegans para prellenar la plantilla del maestro.',
    );
  });

  it('sin archivos cargados no permite conciliar ni reinicia sin indicación', () => {
    render(<App />);
    expect(screen.getByTestId('boton-conciliar')).toBeDisabled();
    expect(screen.getByTestId('resumen-carga')).toHaveTextContent(
      'Finnegans: pendiente · Maestro: pendiente · Empresa: sin configurar',
    );
    expect(screen.queryByTestId('panel-resumen')).not.toBeInTheDocument();
  });

  it('el modo demo solo existe en desarrollo', () => {
    render(<App />);
    const enDev = import.meta.env.DEV;
    expect(screen.queryByTestId('boton-demo') === null).toBe(!enDev);
  });

  it('presenta los cinco pasos en orden y separa la descarga sintética de la corrida', () => {
    render(<App />);
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((titulo) => titulo.textContent),
    ).toEqual([
      '1 · Cargar archivos',
      '2 · Configurar tipos de haberes',
      '3 · Validar liquidación',
      '4 · Revisar empleados',
      '5 · Resultados y descargas',
      'Descargas sintéticas de prueba',
    ]);
    expect(screen.getByTestId('paso-conciliar')).toHaveTextContent(
      'La conciliación es siempre explícita',
    );
    expect(screen.getByTestId('paso-resultados')).toHaveTextContent(
      'Todavía no hay un resultado vigente',
    );
    expect(screen.getByTestId('panel-descarga-sintetica')).toHaveTextContent(
      'No contienen los empleados ni los importes cargados por Recursos Humanos',
    );
    // La descarga sintética queda fuera de la numeración de los pasos y no se presenta
    // como un archivo de pago.
    expect(screen.getByTestId('panel-descarga-sintetica')).toHaveTextContent(
      'SINTÉTICO · NO PRODUCTIVO',
    );
    expect(screen.queryByTestId('panel-clasificacion-liquidaciones')).not.toBeInTheDocument();
  });

  it('muestra los resultados con las salidas productivas bloqueadas y las pruebas sintéticas aparte', async () => {
    const usuario = userEvent.setup();
    render(<App />);
    await concilacionVisible(usuario);

    expect(screen.getByTestId('produccion-bloqueada-BNA_GT_HABERES')).toHaveTextContent(
      'Salida pendiente de homologación bancaria.',
    );
    expect(screen.getByTestId('produccion-bloqueada-PATAGONIA_B2')).toHaveTextContent(
      'Catálogo documentado provisional, no confirmado ni homologado.',
    );
    expect(
      screen.queryByRole('button', { name: /descargar.*(TXT|archivo bancario)/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('panel-descarga-sintetica')).toHaveTextContent(
      'SINTÉTICO · NO PRODUCTIVO',
    );
  });

  it('cargar un perfil después de conciliar invalida el resultado; vuelve al presionar Conciliar', async () => {
    const usuario = userEvent.setup();
    render(<App />);
    await concilacionVisible(usuario);
    expect(screen.getByTestId('resumen-carga')).toHaveTextContent('Empresa: sin configurar');

    // Perfil válido de la plantilla oficial de la UI, con CUIT estructural sintético en
    // runtime (D-042): mismo documento que PanelPerfil valida al vuelo.
    const cuit = ['30', '45678901', '3'].join('-');
    const perfilValido = {
      ...plantillaPerfil(cuit as never),
      nombreEmpresa: 'Empresa de prueba (sintética)',
    };
    await usuario.upload(
      screen.getByLabelText('¿Ya tenés una configuración guardada?', { exact: true }),
      archivo(
        new TextEncoder().encode(JSON.stringify(perfilValido)),
        'perfil.json',
        'application/json',
      ),
    );
    expect(screen.getByTestId('perfil-ok')).toHaveTextContent('Configuración importada');
    expect(screen.getByTestId('resumen-carga')).toHaveTextContent('Empresa: configurada');

    // El resultado anterior ya no está en pantalla: la conciliación queda pendiente del
    // «Conciliar» explícito (nunca se recalcula solo porque cambió el perfil).
    expect(screen.queryByTestId('panel-resumen')).not.toBeInTheDocument();

    // Conciliar de nuevo usa el perfil vigente (readiness llega a cercanía de homologación).
    await usuario.click(screen.getByTestId('boton-conciliar'));
    await waitFor(() => {
      expect(screen.getByTestId('panel-resumen')).toBeInTheDocument();
    });
    expect(screen.getByTestId('perfil-activo')).toHaveTextContent('Empresa de prueba (sintética)');
    // Con el perfil el catálogo entra al motor: la corrida concilia con el perfil vigente
    // (el «motivo» de faltar datos de envío bancario sigue por diseño D-065; no lo afirmo).
  });

  it('completar Banco Nación mejora la preparación sin habilitar la salida', async () => {
    const usuario = userEvent.setup();
    render(<App />);
    await concilacionVisible(usuario);

    // Sin configuración, la readiness de BNA informa que falta completarla.
    expect(screen.getByTestId('readiness-BNA_GT_HABERES')).toHaveTextContent(
      'Falta completar la configuración de la empresa',
    );

    const cuit = syntheticCuil('30', 23_456_789);
    if (cuit === null) throw new Error('CUIT sintético esperado');
    const cbu = syntheticCbu('011', '0001', syntheticCuenta(createRandom(808)));

    await usuario.type(screen.getByLabelText(/CUIT de la empresa/), cuit);
    await usuario.type(screen.getByLabelText(/Nombre o razón social/), 'Empresa sintética');
    await usuario.type(screen.getByLabelText('CBU de la empresa en Banco Nación'), cbu);
    await usuario.type(screen.getByLabelText('Código de convenio de Banco Nación'), '4455');
    await usuario.selectOptions(screen.getByLabelText('Moneda de la cuenta de Banco Nación'), '0');
    await usuario.click(screen.getByTestId('boton-guardar-configuracion'));
    expect(screen.getByTestId('perfil-ok')).toHaveTextContent('Configuración guardada');

    await usuario.click(screen.getByTestId('boton-conciliar'));
    await waitFor(() => {
      expect(screen.getByTestId('panel-resumen')).toBeInTheDocument();
    });

    // La configuración BNA satisface la parte de perfil (v2): el motivo de configuración
    // desaparece. Los bloqueos propios de la liquidación y el generador deshabilitado
    // siguen vigentes; la homologación sigue pendiente.
    const bna = screen.getByTestId('readiness-BNA_GT_HABERES');
    expect(bna).not.toHaveTextContent('Falta completar la configuración de la empresa');
    expect(bna).toHaveTextContent('Bloqueado');
    expect(screen.getByTestId('homologacion-BNA_GT_HABERES')).toHaveTextContent(
      'pendiente de homologación',
    );
    expect(
      screen.queryByRole('button', { name: /descargar.*(TXT|archivo bancario)/i }),
    ).not.toBeInTheDocument();
  });
});
