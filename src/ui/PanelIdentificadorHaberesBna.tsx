import { useState } from 'react';
import {
  CATALOGO_IDENTIFICADORES_HABERES_BNA,
  type AplicacionSeleccionesIdentificadorHaberesBna,
  type LiquidacionBnaPendiente,
} from '../run/seleccionIdentificadorHaberesBna';
import type { ErrorSeleccionIdentificadorHaberesBnaCorrida } from './orquestacion';
import { Boton, CLASE_CAMPO, Insignia, Mensaje } from './componentes';

export type ResultadoSeleccionIdentificadorHaberesBnaPanel =
  | { readonly ok: true; readonly value: AplicacionSeleccionesIdentificadorHaberesBna }
  | {
      readonly ok: false;
      readonly error: readonly ErrorSeleccionIdentificadorHaberesBnaCorrida[];
    };

interface Props {
  readonly huellaFinnegans: string;
  readonly descripciones: readonly LiquidacionBnaPendiente[];
  readonly aplicar: (selecciones: unknown) => ResultadoSeleccionIdentificadorHaberesBnaPanel;
  /** El borrador dejó de representar el último snapshot BNA validado. */
  readonly invalidar: () => void;
}

function textoError(error: ErrorSeleccionIdentificadorHaberesBnaCorrida): string {
  switch (error.codigo) {
    case 'FINNEGANS_AUSENTE':
      return 'La liquidación de Finnegans ya no está cargada.';
    case 'HUELLA_FINNEGANS_AUSENTE':
    case 'HUELLA_CORRIDA_INVALIDA':
      return 'No se puede vincular la selección BNA con la importación vigente.';
    case 'ENTRADA_NO_ES_LISTA':
      return 'La selección recibida no tiene el formato esperado.';
    case 'SELECCION_NO_ES_OBJETO':
      return `La selección ${String(error.indiceSeleccion + 1)} no tiene el formato esperado.`;
    case 'TIPO_INVALIDO':
      return `La selección ${String(error.indiceSeleccion + 1)} contiene un valor inválido en ${error.campo}.`;
    case 'CAMPO_VACIO':
      return `La selección ${String(error.indiceSeleccion + 1)} requiere ${error.campo}.`;
    case 'DESTINO_INVALIDO':
    case 'DESTINO_NO_ADMITIDO':
      return `La selección ${String(error.indiceSeleccion + 1)} no corresponde a Banco Nación.`;
    case 'SELECCION_DESVINCULADA':
      return `La selección ${String(error.indiceSeleccion + 1)} pertenece a otra importación.`;
    case 'CODIGO_FUERA_CATALOGO':
      return `El código ${error.codigoIdentificadorHaberes} no pertenece al catálogo BNA disponible.`;
    case 'SELECCION_DESCONOCIDA':
      return `La descripción de la selección ${String(error.indiceSeleccion + 1)} no pertenece a esta importación.`;
    case 'DESCRIPCION_SIN_FILAS_BNA':
      return `La descripción de la selección ${String(error.indiceSeleccion + 1)} no tiene filas de Banco Nación.`;
    case 'SELECCION_DUPLICADA':
      return 'La misma descripción de Banco Nación fue seleccionada más de una vez.';
    case 'SELECCION_CONTRADICTORIA':
      return 'La misma descripción de Banco Nación recibió identificadores distintos.';
    case 'REFERENCIA_DUPLICADA_CORRIDA':
      return 'La corrida contiene referencias BNA duplicadas y no se puede aplicar la selección.';
  }
}

function cantidadFilas(cantidad: number): string {
  return `${String(cantidad)} ${cantidad === 1 ? 'empleado BNA' : 'empleados BNA'}`;
}

export function PanelIdentificadorHaberesBna({
  huellaFinnegans,
  descripciones,
  aplicar,
  invalidar,
}: Props) {
  const [codigos, setCodigos] = useState<ReadonlyMap<string, string>>(
    () => new Map(descripciones.map((item) => [item.descripcionOriginal, ''] as const)),
  );
  const [resultado, setResultado] = useState<ResultadoSeleccionIdentificadorHaberesBnaPanel | null>(
    null,
  );

  function cambiarCodigo(descripcionOriginal: string, codigoIdentificadorHaberes: string) {
    invalidar();
    setCodigos((actuales) => {
      const siguientes = new Map(actuales);
      siguientes.set(descripcionOriginal, codigoIdentificadorHaberes);
      return siguientes;
    });
    setResultado(null);
  }

  function confirmar() {
    const selecciones = descripciones.flatMap((item) => {
      const codigoIdentificadorHaberes = codigos.get(item.descripcionOriginal) ?? '';
      return codigoIdentificadorHaberes === ''
        ? []
        : [
            {
              huellaFinnegans,
              descripcionOriginal: item.descripcionOriginal,
              destino: 'BNA_GT_HABERES',
              codigoIdentificadorHaberes,
            },
          ];
    });
    setResultado(aplicar(selecciones));
  }

  const totalAfectadas =
    resultado?.ok === true
      ? resultado.value.cantidadesAfectadas.reduce(
          (total, item) => total + item.cantidadFilasBna,
          0,
        )
      : null;
  const totalPendientes =
    resultado?.ok === true
      ? resultado.value.pendientes.reduce((total, item) => total + item.cantidadFilasBna, 0)
      : null;
  const descripcionesFaltantes = descripciones.filter(
    (item) => (codigos.get(item.descripcionOriginal) ?? '') === '',
  ).length;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="identificador-haberes-bna-titulo"
      data-testid="panel-identificador-haberes-bna"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3
            id="identificador-haberes-bna-titulo"
            className="text-lg font-semibold text-marca-950"
          >
            Banco Nación · identificador de haberes
          </h3>
          <p className="mt-0.5 text-sm text-slate-600">
            Elegí un código para cada descripción exacta de Finnegans. La elección se aplica a todos
            los empleados de Banco Nación que compartan exactamente esa descripción.
          </p>
        </div>
        <Insignia tono="atencion">Sin preselección</Insignia>
      </div>

      <Mensaje tono="atencion" rol="note" className="mt-3">
        No hay códigos preseleccionados ni inferencias por palabras. Si una misma descripción
        requiere tratamientos distintos entre empleados, dejala sin seleccionar hasta contar con una
        diferenciación segura. Esta decisión no habilita pagos ni producción BNA.
      </Mensaje>
      <p
        className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950"
        data-testid="nota-comparacion-exacta-bna"
      >
        La comparación es exacta: mayúsculas, tildes y espacios finales cuentan como parte de la
        descripción. Por ejemplo, «JULIO Liq final » y «JULIO Liq Final» son dos descripciones
        distintas y se seleccionan por separado.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CATALOGO_IDENTIFICADORES_HABERES_BNA.map((entrada) => (
          <div key={entrada.codigo} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-marca-950">
                <code className="rounded bg-white px-1.5 py-0.5 text-sm">{entrada.codigo}</code>{' '}
                {entrada.descripcion}
              </p>
              <Insignia tono="neutral">Manual</Insignia>
            </div>
            <p className="mt-2 text-sm text-slate-700">{entrada.consecuencia}.</p>
          </div>
        ))}
      </div>

      <h4 className="mt-5 text-sm font-semibold text-marca-950">
        Descripciones de Banco Nación en esta liquidación
      </h4>
      <div className="mt-2 space-y-3">
        {descripciones.map((item, indice) => {
          const codigo = codigos.get(item.descripcionOriginal) ?? '';
          const catalogo = CATALOGO_IDENTIFICADORES_HABERES_BNA.find(
            (entrada) => entrada.codigo === codigo,
          );
          const id = `identificador-haberes-bna-${String(indice)}`;
          return (
            <fieldset
              key={item.descripcionOriginal}
              className="rounded-lg border border-slate-200 p-3"
              data-testid={`descripcion-bna-${String(indice)}`}
            >
              <legend className="px-1 text-sm font-medium">
                <code className="whitespace-pre-wrap">
                  {item.descripcionOriginal === '' ? '(vacía)' : `«${item.descripcionOriginal}»`}
                </code>
                {` · ${cantidadFilas(item.cantidadFilasBna)}`}
              </legend>
              <div className="mt-1 flex flex-wrap items-end gap-3">
                <label className="min-w-64 flex-1 text-sm font-medium text-slate-700" htmlFor={id}>
                  Identificador de haberes
                  <select
                    id={id}
                    value={codigo}
                    onChange={(event) => {
                      cambiarCodigo(item.descripcionOriginal, event.target.value);
                    }}
                    className={CLASE_CAMPO}
                  >
                    <option value="">Sin seleccionar</option>
                    {CATALOGO_IDENTIFICADORES_HABERES_BNA.map((entrada) => (
                      <option key={entrada.codigo} value={entrada.codigo}>
                        {`${entrada.codigo} — ${entrada.descripcion}`}
                      </option>
                    ))}
                  </select>
                </label>
                <Insignia tono={codigo === '' ? 'atencion' : 'exito'}>
                  {codigo === '' ? 'Pendiente' : 'Seleccionado'}
                </Insignia>
              </div>
              <p
                className={`mt-2 rounded-md px-2 py-1.5 text-xs ${codigo === '' ? 'bg-amber-50 text-amber-900' : 'bg-marca-50 text-marca-900'}`}
              >
                {catalogo === undefined
                  ? 'Pendiente de selección: no se aplica ningún código por defecto.'
                  : `${catalogo.codigo} — ${catalogo.descripcion}: ${catalogo.consecuencia}.`}
              </p>
            </fieldset>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Boton variante="primario" onClick={confirmar}>
          Aplicar identificadores de haberes BNA
        </Boton>
        <p className="text-xs text-slate-500">
          Después de aplicar, volvé a «Validar liquidación» para ver el efecto en la corrida.
        </p>
      </div>
      {descripcionesFaltantes > 0 && (
        <p
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          data-testid="aviso-cobertura-bna"
        >
          {`Faltan ${String(descripcionesFaltantes)} ${descripcionesFaltantes === 1 ? 'descripción' : 'descripciones'} por seleccionar. Banco Nación exige cubrir todas las descripciones: mientras falte al menos una, la aplicación guarda un borrador y no resuelve ninguna fila, aunque hayas elegido un código para otras.`}
        </p>
      )}

      <div aria-live="polite" className="mt-3 text-sm">
        {resultado?.ok === false && (
          <ul
            role="alert"
            className="list-disc space-y-1 rounded-lg bg-red-50 p-3 pl-7 text-red-800"
          >
            {resultado.error.map((error, indice) => (
              <li key={`${error.codigo}-${String(indice)}`}>{textoError(error)}</li>
            ))}
          </ul>
        )}
        {resultado?.ok === true && totalAfectadas !== null && totalPendientes !== null && (
          <div
            data-testid="resultado-identificador-haberes-bna"
            className={
              totalPendientes === 0
                ? 'rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900'
                : 'rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900'
            }
          >
            <p>
              {totalPendientes === 0
                ? `${cantidadFilas(totalAfectadas)} con selección validada; 0 pendientes.`
                : `${cantidadFilas(totalAfectadas)} con selección propuesta; ${cantidadFilas(
                    totalPendientes,
                  )} ${totalPendientes === 1 ? 'pendiente' : 'pendientes'}.`}
            </p>
            {totalPendientes > 0 && (
              <p className="mt-1 font-medium" data-testid="borrador-parcial-bna">
                La selección quedó como borrador: no resuelve ninguna fila hasta cubrir todas las
                descripciones. Completá las pendientes y aplicá de nuevo.
              </p>
            )}
            {resultado.value.seleccionesValidadas.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {resultado.value.seleccionesValidadas.map((seleccion, indice) => {
                  const cantidad = resultado.value.cantidadesAfectadas[indice];
                  return (
                    <li key={seleccion.descripcionOriginal}>
                      <code className="whitespace-pre-wrap">{`«${seleccion.descripcionOriginal}»`}</code>
                      {`: ${seleccion.codigoIdentificadorHaberes} — ${seleccion.descripcionCodigo}; ${cantidadFilas(
                        cantidad?.cantidadFilasBna ?? 0,
                      )}`}
                    </li>
                  );
                })}
              </ul>
            )}
            {resultado.value.pendientes.length > 0 && (
              <div className="mt-2" data-testid="pendientes-bna">
                <p className="font-medium">Descripciones todavía sin selección:</p>
                <ul className="mt-1 list-disc pl-5">
                  {resultado.value.pendientes.map((pendiente) => (
                    <li key={pendiente.descripcionOriginal}>
                      <code className="whitespace-pre-wrap">{`«${pendiente.descripcionOriginal}»`}</code>
                      {`: ${cantidadFilas(pendiente.cantidadFilasBna)}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
