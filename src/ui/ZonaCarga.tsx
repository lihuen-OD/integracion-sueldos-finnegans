import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { XLSX_MIME_TYPE, downloadBytes } from '../export/download';
import type { LecturaFinnegans } from '../domain/liquidacion';
import type { LecturaMaestro } from '../domain/maestro';
import { mensajeErrorArchivo, leerFinnegansDeArchivo, leerMaestroDeArchivo } from './orquestacion';
import type { FilaPrellenada, ResumenPrellenado } from '../import/master/plantillaMaestro';
import { Boton, EncabezadoSeccion, Insignia, Mensaje } from './componentes';

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
    <section
      id="paso-carga"
      className="scroll-mt-24"
      aria-labelledby="carga-titulo"
      data-testid="zona-carga"
    >
      <EncabezadoSeccion
        id="carga-titulo"
        numero="1"
        titulo="Cargar archivos"
        descripcion="Importá la liquidación de Finnegans y el maestro de empleados. Todo se procesa en esta computadora: los archivos no se suben a ningún servidor."
        acciones={<Insignia tono="marca">Paso 1 de 5</Insignia>}
      />

      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="font-semibold text-marca-950">1. Liquidación de Finnegans</p>
          <p className="mt-0.5 text-slate-600">Filas a pagar, banco declarado e importes.</p>
        </div>
        <div>
          <p className="font-semibold text-marca-950">2. Maestro de empleados</p>
          <p className="mt-0.5 text-slate-600">CUIL, CBU y datos de cuenta de cada persona.</p>
        </div>
        <div>
          <p className="font-semibold text-marca-950">3. Configuración de la empresa</p>
          <p className="mt-0.5 text-slate-600">
            CUIT y datos bancarios de la empresa. Se completa una vez y se reutiliza al importar el
            archivo de configuración.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          data-testid="tarjeta-finnegans"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-marca-950">Liquidación de Finnegans (XLSX)</h3>
              <p className="mt-0.5 text-sm text-slate-600">
                Es la fuente de las filas, el banco y el tipo de liquidación.
              </p>
            </div>
            <Insignia tono="atencion">Obligatorio</Insignia>
          </div>
          <label
            htmlFor="archivo-finnegans"
            className="mt-4 block text-sm font-medium text-slate-700"
          >
            Archivo de la liquidación
          </label>
          <input
            id="archivo-finnegans"
            ref={inputFinnegans}
            type="file"
            accept={XLSX}
            autoComplete="off"
            onChange={(event) => void leer('finnegans', event)}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-marca-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-marca-800"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Insignia tono={filas === null ? 'neutral' : 'exito'}>
              {filas === null ? 'Pendiente' : 'Cargada'}
            </Insignia>
            <p data-testid="estado-finnegans" className="text-sm text-slate-700">
              {filas === null ? 'Sin cargar.' : `Cargada: ${String(filas.filas)} filas leídas.`}
            </p>
          </div>
        </div>

        <div
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          data-testid="tarjeta-maestro"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-marca-950">Maestro de empleados (XLSX)</h3>
              <p className="mt-0.5 text-sm text-slate-600">
                Aporta CUIL, CBU y los datos de cuenta de Banco Patagonia.
              </p>
            </div>
            <Insignia tono="atencion">Obligatorio</Insignia>
          </div>
          <label
            htmlFor="archivo-maestro"
            className="mt-4 block text-sm font-medium text-slate-700"
          >
            Archivo del maestro
          </label>
          <input
            id="archivo-maestro"
            ref={inputMaestro}
            type="file"
            accept={XLSX}
            autoComplete="off"
            onChange={(event) => void leer('maestro', event)}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-marca-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-marca-800"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Insignia tono={registros === null ? 'neutral' : 'exito'}>
              {registros === null ? 'Pendiente' : 'Cargado'}
            </Insignia>
            <p data-testid="estado-maestro" className="text-sm text-slate-700">
              {registros === null
                ? 'Sin cargar.'
                : `Cargado: ${String(registros.registros)} registros.`}
            </p>
          </div>
          {extrasMaestro}
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton onClick={() => void descargarPlantilla(false)}>
              Descargar plantilla del maestro (vacía)
            </Boton>
            <Boton disabled={plantilla === null} onClick={() => void descargarPlantilla(true)}>
              Descargar maestro prellenado
            </Boton>
          </div>
          <p data-testid="prellenado" className="mt-2 text-sm text-slate-600">
            {plantilla === null
              ? 'Cargá la liquidación de Finnegans para prellenar la plantilla del maestro.'
              : `Prellenado listo: ${String(plantilla.resumen.prellenadas)} filas · omitidas por CUIL inválido: ${String(plantilla.resumen.omitidasCuilInvalido)} · por CUIL repetido: ${String(plantilla.resumen.omitidasCuilRepetido)} · por legajo ilegible: ${String(plantilla.resumen.omitidasLegajoIlegible)}.`}
          </p>
        </div>
      </div>

      {demo !== undefined && demo !== null && (
        <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-3">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Solo para desarrollo
          </p>
          <div className="mt-1">{demo}</div>
        </div>
      )}

      <div aria-live="polite">
        {aviso !== null && (
          <Mensaje tono="peligro" rol="alert" className="mt-3" testid={`error-${aviso.archivo}`}>
            {aviso.mensaje}
          </Mensaje>
        )}
      </div>
    </section>
  );
}
