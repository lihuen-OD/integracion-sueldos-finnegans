// @vitest-environment jsdom
// FIX 2 (correctivo CP-F3-C): el feedback de edición del maestro vive SOLO mientras el
// detalle de ese empleado está abierto. Nunca migra entre empleados ni reaparece en la
// corrida nueva (sin persistencia, sin datos técnicos visibles). Datos 100 % sintéticos.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
} from '../../fixtures/synthetic/identities.ts';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NACION = 'BANCO DE LA NACION ARGENTINA';

function archivo(bytes: Uint8Array, nombre: string, mime: string): File {
  const copia = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copia.set(bytes);
  return new File([copia], nombre, { type: mime });
}

afterEach(cleanup);

async function corridaVisible(usuario: ReturnType<typeof userEvent.setup>): Promise<void> {
  const [una, dos] = personas(2, 20261020);
  if (una === undefined || dos === undefined) {
    throw new Error('personas esperadas');
  }
  const random = createRandom(3);
  await usuario.upload(
    screen.getByLabelText('Archivo de la liquidación', { exact: true }),
    archivo(
      finnegansXlsx([filaFinnegans(una, { Banco: NACION }), filaFinnegans(dos, { Banco: NACION })]),
      'finnegans.xlsx',
      XLSX_MIME,
    ),
  );
  await usuario.upload(
    screen.getByLabelText('Archivo del maestro', { exact: true }),
    archivo(
      maestroXlsx([registroBna(una, random), registroBna(dos, random)]),
      'maestro.xlsx',
      XLSX_MIME,
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

async function abrirDetalle(
  usuario: ReturnType<typeof userEvent.setup>,
  indice: '0' | '1',
): Promise<void> {
  await usuario.click(screen.getByTestId(`ver-fila-${indice}`));
  await waitFor(() => {
    expect(screen.getByTestId('detalle-fila')).toBeInTheDocument();
  });
}

const editarCBU = async (
  usuario: ReturnType<typeof userEvent.setup>,
  texto: string,
): Promise<void> => {
  await usuario.click(screen.getByTestId('boton-editar-CBU'));
  await usuario.clear(screen.getByTestId('entrada-CBU'));
  await usuario.type(screen.getByTestId('entrada-CBU'), texto);
  await usuario.click(screen.getByTestId('guardar-CBU'));
};

describe('FIX 2 · el feedback de edición no migra entre empleados ni corridas', () => {
  it('A/B · editar CBU del empleado 0 muestra el mensaje acá; abrir el empleado 1 no lo muestra', async () => {
    const usuario = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    await corridaVisible(usuario);
    await abrirDetalle(usuario, '0');
    await editarCBU(usuario, syntheticCbu('028', '0521', syntheticCuenta(createRandom(9))));
    await waitFor(() => {
      expect(screen.getByTestId('aviso-edicion')).toHaveTextContent('Dato guardado.');
    });
    // ir al empleado 1 (cambio directo de detalle): el mensaje del otro NO aparece
    await usuario.click(screen.getByTestId('ver-fila-1'));
    await waitFor(() => {
      expect(screen.getByTestId('detalle-fila')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('aviso-edicion')).not.toBeInTheDocument();
    // cerrar y volver a abrir el 0 tampoco lo recupera (ciclo de vida, no historial)
    await usuario.click(screen.getByTestId('cerrar-detalle'));
    await abrirDetalle(usuario, '0');
    expect(screen.queryByTestId('aviso-edicion')).not.toBeInTheDocument();
  });

  it('C · reiniciar la corrida descarta el feedback; D · la corrida nueva no trae nada viejo', async () => {
    const usuario = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    await corridaVisible(usuario);
    await abrirDetalle(usuario, '0');
    await editarCBU(usuario, syntheticCbu('028', '0521', syntheticCuenta(createRandom(10))));
    await waitFor(() => {
      expect(screen.getByTestId('revision-maestro')).toHaveTextContent('Versión del maestro: 1');
    });
    // Reiniciar: todo el estado se descarta (D-009/D-065); el feedback no sobrevive.
    await usuario.click(screen.getByTestId('boton-reiniciar'));
    await waitFor(() => {
      expect(screen.getByTestId('resumen-carga')).toHaveTextContent(
        'Finnegans: pendiente · Maestro: pendiente · Perfil: sin cargar',
      );
    });
    expect(screen.queryByTestId('detalle-fila')).not.toBeInTheDocument();
    expect(screen.queryByTestId('aviso-edicion')).not.toBeInTheDocument();
    // D: corrida nueva limpia: conciliar, abrir el detalle y editar = sin mensaje viejo ni
    // revisión heredada (revision-maestro arranca en 0 y el feedback es nuevo solo al editar).
    await corridaVisible(usuario);
    await abrirDetalle(usuario, '0');
    expect(screen.getByTestId('revision-maestro')).toHaveTextContent('Versión del maestro: 0');
    expect(screen.queryByTestId('aviso-edicion')).not.toBeInTheDocument();
  });
});
