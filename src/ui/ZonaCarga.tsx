import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { XLSX_MIME_TYPE, downloadBytes } from '../export/download';
import type { LecturaFinnegans } from '../domain/liquidacion';
import type { LecturaMaestro } from '../domain/maestro';
import { mensajeErrorArchivo, leerFinnegansDeArchivo, leerMaestroDeArchivo } from './orquestacion';
import type { FilaPrellenada, ResumenPrellenado } from '../import/master/plantillaMaestro';

type Aviso = { readonly archivo: 'finnegans' | 'maestro'; readonly mensaje: string } | null;

interface Props {
  /** Registra Finnegans ya leído en la corrida (orquesta App). */
  readonly cargarFinnegans: (lectura: LecturaFinnegans, huellaArchivo: string) => void;
  /** Registra el maestro ya leído en la corrida (orquesta App). */
  readonly cargarMaestro: (lectura: LecturaMaestro, huellaArchivo: string) => void;
  /** Estado actual de las cargas, para saber qué quedó cargado. */
  readonly cargado: {
    readonly finnegans: { readonly filas: number } | null;
    readonly maestro: { readonly registros: number } | null;
  };
  /** Botón solo-desarrollo para cargar una corrida demo con datos sintéticos. */
  readonly demo?: ReactNode;
  /** Contenido extra de la tarjeta del maestro: versión de revisión y descarga (T3-11/12). */
  readonly extrasMaestro?: ReactNode;
}

const XLSX = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Fecha local AAAA-MM-DD (la del equipo del operador, no UTC). */
export function fechaLocal(): string {
  const ahora = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${String(ahora.getFullYear())}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

/** Zona de carga de los dos archivos de entrada. Muestra solo conteos, nunca valores. */
export function ZonaCarga({ cargarFinnegans, cargarMaestro, cargado, demo, extrasMaestro }: Props) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [plantilla, setPlantilla] = useState<{
    readonly filas: readonly FilaPrellenada[];
    readonly resumen: ResumenPrellenado;
  } | null>(null);
  const inputFinnegans = useRef<HTMLInputElement>(null);
  const inputMaestro = useRef<HTMLInputElement>(null);

  async function leer(archivo: 'finnegans' | 'maestro', event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }
    setAviso(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (archivo === 'finnegans') {
        const leido = await leerFinnegansDeArchivo(bytes);
        if (!leido.ok) {
          setAviso({ archivo, mensaje: mensajeErrorArchivo(leido.error) });
          return;
        }
        setPlantilla(null);
        cargarFinnegans(leido.value.lectura, leido.value.huellaArchivo);
        const { prellenarDesdeFinnegans } = await import('../import/master/plantillaMaestro');
        setPlantilla(prellenarDesdeFinnegans(leido.value.lectura));
      } else {
        const leido = await leerMaestroDeArchivo(bytes);
        if (!leido.ok) {
          setAviso({ archivo, mensaje: mensajeErrorArchivo(leido.error) });
          return;
        }
        cargarMaestro(leido.value.lectura, leido.value.huellaArchivo);
      }
    } catch {
      setAviso({ archivo, mensaje: 'Error inesperado al leer el archivo.' });
    } finally {
      if (inputFinnegans.current !== null && archivo === 'finnegans') {
        inputFinnegans.current.value = '';
      }
      if (inputMaestro.current !== null && archivo === 'maestro') {
        inputMaestro.current.value = '';
      }
    }
  }

  async function descargarPlantilla(prellenada: boolean) {
    const maestro = await import('../import/master/plantillaMaestro');
    const fecha = fechaLocal();
    // El nombre lleva fecha SOLO si es prellenada (docs/03 §B.4); la vacía queda base.
    const prellenando = prellenada && plantilla !== null;
    const bytes = await maestro.generarPlantillaMaestro({
      fechaGeneracion: fecha,
      ...(prellenando ? { filas: plantilla.filas } : {}),
    });
    downloadBytes(
      bytes,
      maestro.nombreArchivoMaestro(prellenando ? fecha : undefined),
      XLSX_MIME_TYPE,
    );
  }

  const filas = cargado.finnegans;
  const registros = cargado.maestro;

  return (
    <section className="mt-6 space-y-4" aria-labelledby="carga-titulo" data-testid="zona-carga">
      <h2 id="carga-titulo" className="text-lg font-semibold">
        1 · Cargar archivos
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-slate-300 p-4" data-testid="tarjeta-finnegans">
          <h3 className="font-medium">Liquidación de Finnegans (XLSX)</h3>
          <label htmlFor="archivo-finnegans" className="mt-2 block text-sm">
            Archivo de la liquidación
          </label>
          <input
            id="archivo-finnegans"
            ref={inputFinnegans}
            type="file"
            accept={XLSX}
            autoComplete="off"
            onChange={(event) => void leer('finnegans', event)}
            className="text-sm"
          />
          <p data-testid="estado-finnegans" className="mt-2 text-sm">
            {filas === null ? 'Sin cargar.' : `Cargada: ${String(filas.filas)} filas leídas.`}
          </p>
        </div>
        <div className="rounded border border-slate-300 p-4" data-testid="tarjeta-maestro">
          <h3 className="font-medium">Maestro de empleados (XLSX)</h3>
          <label htmlFor="archivo-maestro" className="mt-2 block text-sm">
            Archivo del maestro
          </label>
          <input
            id="archivo-maestro"
            ref={inputMaestro}
            type="file"
            accept={XLSX}
            autoComplete="off"
            onChange={(event) => void leer('maestro', event)}
            className="text-sm"
          />
          <p data-testid="estado-maestro" className="mt-2 text-sm">
            {registros === null
              ? 'Sin cargar.'
              : `Cargado: ${String(registros.registros)} registros.`}
          </p>
          {extrasMaestro}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void descargarPlantilla(false)}
              className="rounded border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100"
            >
              Descargar plantilla del maestro (vacía)
            </button>
            <button
              type="button"
              disabled={plantilla === null}
              onClick={() => void descargarPlantilla(true)}
              className="rounded border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-50"
            >
              Descargar maestro prellenado
            </button>
          </div>
          <p data-testid="prellenado" className="mt-2 text-sm text-slate-600">
            {plantilla === null
              ? 'Cargá la liquidación de Finnegans para prellenar la plantilla del maestro.'
              : `Prellenado listo: ${String(plantilla.resumen.prellenadas)} filas · omitidas por CUIL inválido: ${String(plantilla.resumen.omitidasCuilInvalido)} · por CUIL repetido: ${String(plantilla.resumen.omitidasCuilRepetido)} · por legajo ilegible: ${String(plantilla.resumen.omitidasLegajoIlegible)}.`}
          </p>
        </div>
      </div>
      {demo}
      <div aria-live="polite">
        {aviso !== null && (
          <p role="alert" data-testid={`error-${aviso.archivo}`} className="text-sm text-red-700">
            {aviso.mensaje}
          </p>
        )}
      </div>
    </section>
  );
}
