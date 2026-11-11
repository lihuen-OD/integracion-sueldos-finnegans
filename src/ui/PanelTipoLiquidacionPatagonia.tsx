import { useState } from 'react';
import {
  CATALOGO_TIPOS_LIQUIDACION_PATAGONIA,
  type AplicacionSeleccionesLiquidacionPatagonia,
  type LiquidacionPatagoniaPendiente,
} from '../run/seleccionLiquidacionPatagonia';
import type { ErrorSeleccionLiquidacionPatagoniaCorrida } from './orquestacion';
import { Boton, CLASE_CAMPO, Insignia, Mensaje } from './componentes';

export type ResultadoSeleccionPatagoniaPanel =
  | { readonly ok: true; readonly value: AplicacionSeleccionesLiquidacionPatagonia }
  | { readonly ok: false; readonly error: readonly ErrorSeleccionLiquidacionPatagoniaCorrida[] };

interface Props {
  readonly huellaFinnegans: string;
  readonly descripciones: readonly LiquidacionPatagoniaPendiente[];
  readonly aplicar: (selecciones: unknown) => ResultadoSeleccionPatagoniaPanel;
  /** El borrador dejó de representar el último snapshot validado de la corrida. */
  readonly invalidar: () => void;
}

function textoError(error: ErrorSeleccionLiquidacionPatagoniaCorrida): string {
  switch (error.codigo) {
    case 'FINNEGANS_AUSENTE':
      return 'La liquidación de Finnegans ya no está cargada.';
    case 'HUELLA_FINNEGANS_AUSENTE':
    case 'HUELLA_CORRIDA_INVALIDA':
      return 'No se puede vincular la selección con la importación vigente.';
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
      return `La selección ${String(error.indiceSeleccion + 1)} no corresponde a Banco Patagonia.`;
    case 'SELECCION_DESVINCULADA':
      return `La selección ${String(error.indiceSeleccion + 1)} pertenece a otra importación.`;
    case 'CODIGO_FUERA_CATALOGO':
      return `El código ${error.codigoTipoLiquidacion} no pertenece al catálogo provisional disponible.`;
    case 'SELECCION_DESCONOCIDA':
      return `La descripción de la selección ${String(error.indiceSeleccion + 1)} no pertenece a esta importación.`;
    case 'DESCRIPCION_SIN_FILAS_PATAGONIA':
      return `La descripción de la selección ${String(error.indiceSeleccion + 1)} no tiene filas de Banco Patagonia.`;
    case 'SELECCION_DUPLICADA':
      return 'La misma descripción de Banco Patagonia fue seleccionada más de una vez.';
    case 'SELECCION_CONTRADICTORIA':
      return 'La misma descripción de Banco Patagonia recibió conceptos distintos.';
  }
}

function cantidadFilas(cantidad: number): string {
  return `${String(cantidad)} ${cantidad === 1 ? 'fila Patagonia' : 'filas Patagonia'}`;
}

export function PanelTipoLiquidacionPatagonia({
  huellaFinnegans,
  descripciones,
  aplicar,
  invalidar,
}: Props) {
  const [codigos, setCodigos] = useState<ReadonlyMap<string, string>>(
    () => new Map(descripciones.map((item) => [item.descripcionOriginal, ''] as const)),
  );
  const [resultado, setResultado] = useState<ResultadoSeleccionPatagoniaPanel | null>(null);

  function cambiarCodigo(descripcionOriginal: string, codigoTipoLiquidacion: string) {
    invalidar();
    setCodigos((actuales) => {
      const siguientes = new Map(actuales);
      siguientes.set(descripcionOriginal, codigoTipoLiquidacion);
      return siguientes;
    });
    setResultado(null);
  }

  function confirmar() {
    const selecciones = descripciones.flatMap((item) => {
      const codigoTipoLiquidacion = codigos.get(item.descripcionOriginal) ?? '';
      return codigoTipoLiquidacion === ''
        ? []
        : [
            {
              huellaFinnegans,
              descripcionOriginal: item.descripcionOriginal,
              destino: 'PATAGONIA_B2',
              codigoTipoLiquidacion,
            },
          ];
    });
    setResultado(aplicar(selecciones));
  }

  const totalAfectadas =
    resultado?.ok === true
      ? resultado.value.cantidadesAfectadas.reduce(
          (total, item) => total + item.cantidadFilasPatagonia,
          0,
        )
      : null;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="tipo-liquidacion-patagonia-titulo"
      data-testid="panel-tipo-liquidacion-patagonia"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3
            id="tipo-liquidacion-patagonia-titulo"
            className="text-lg font-semibold text-marca-950"
          >
            Banco Patagonia · concepto de pago
          </h3>
          <p className="mt-0.5 text-sm text-slate-600">
            Elegí el concepto que corresponde a cada descripción exacta de Finnegans. No se infiere
            desde Agrario, Comercio, Directivos ni ningún otro texto.
          </p>
        </div>
        <Insignia tono="atencion">Provisional</Insignia>
      </div>

      <Mensaje tono="atencion" rol="note" className="mt-3">
        Catálogo PAT-DR documentado provisionalmente, todavía no confirmado ni homologado. Los
        códigos 006 y 007 conservan una discrepancia documental con PAT-XL. Esta selección no
        autoriza pagos.
      </Mensaje>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CATALOGO_TIPOS_LIQUIDACION_PATAGONIA.map((entrada) => (
          <div
            key={entrada.codigo}
            className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-1">
              <p className="font-semibold text-marca-950">
                <code className="rounded bg-white px-1.5 py-0.5">{entrada.codigo}</code>{' '}
                {entrada.concepto}
              </p>
              <Insignia tono={entrada.advertencia === null ? 'neutral' : 'peligro'}>
                {entrada.advertencia === null ? 'Provisional' : 'Con discrepancia'}
              </Insignia>
            </div>
            {entrada.advertencia !== null && (
              <p className="mt-1 text-xs text-red-800">
                PAT-XL omite este código: no se toma como confirmado.
              </p>
            )}
          </div>
        ))}
      </div>

      <h4 className="mt-5 text-sm font-semibold text-marca-950">
        Descripciones de Banco Patagonia en esta liquidación
      </h4>
      <div className="mt-2 space-y-3">
        {descripciones.map((item, indice) => {
          const codigo = codigos.get(item.descripcionOriginal) ?? '';
          const catalogo = CATALOGO_TIPOS_LIQUIDACION_PATAGONIA.find(
            (entrada) => entrada.codigo === codigo,
          );
          const id = `tipo-liquidacion-patagonia-${String(indice)}`;
          return (
            <fieldset
              key={item.descripcionOriginal}
              className="rounded-lg border border-slate-200 p-3"
              data-testid={`descripcion-patagonia-${String(indice)}`}
            >
              <legend className="px-1 text-sm font-medium">
                <code className="whitespace-pre-wrap">{item.descripcionOriginal || '(vacía)'}</code>
                {` · ${cantidadFilas(item.cantidadFilasPatagonia)}`}
              </legend>
              <div className="mt-1 flex flex-wrap items-end gap-3">
                <label className="min-w-64 flex-1 text-sm font-medium text-slate-700" htmlFor={id}>
                  Concepto bancario
                  <select
                    id={id}
                    value={codigo}
                    onChange={(event) => {
                      cambiarCodigo(item.descripcionOriginal, event.target.value);
                    }}
                    className={CLASE_CAMPO}
                  >
                    <option value="">Sin seleccionar</option>
                    {CATALOGO_TIPOS_LIQUIDACION_PATAGONIA.map((entrada) => (
                      <option key={entrada.codigo} value={entrada.codigo}>
                        {`${entrada.codigo} — ${entrada.concepto}`}
                      </option>
                    ))}
                  </select>
                </label>
                <Insignia tono={codigo === '' ? 'atencion' : 'info'}>
                  {codigo === '' ? 'Pendiente' : 'Provisional'}
                </Insignia>
              </div>
              <p
                className={`mt-2 rounded-md px-2 py-1.5 text-xs ${codigo === '' ? 'bg-amber-50 text-amber-900' : 'bg-marca-50 text-marca-900'}`}
              >
                {codigo === ''
                  ? 'Pendiente de selección.'
                  : `${catalogo?.codigo ?? codigo} — ${catalogo?.concepto ?? ''}: selección preparada para aplicar.`}
              </p>
            </fieldset>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Boton variante="primario" onClick={confirmar}>
          Aplicar tipos de liquidación Patagonia
        </Boton>
        <p className="text-xs text-slate-500">
          Después de aplicar, volvé a «Validar liquidación» para ver el efecto en la corrida.
        </p>
      </div>

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
        {resultado?.ok === true && totalAfectadas !== null && (
          <div
            data-testid="resultado-tipo-liquidacion-patagonia"
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900"
          >
            <p>
              {`${cantidadFilas(totalAfectadas)} con selección validada; ${cantidadFilas(
                resultado.value.pendientes.reduce(
                  (total, item) => total + item.cantidadFilasPatagonia,
                  0,
                ),
              )} ${
                resultado.value.pendientes.reduce(
                  (total, item) => total + item.cantidadFilasPatagonia,
                  0,
                ) === 1
                  ? 'pendiente'
                  : 'pendientes'
              }.`}
            </p>
            {resultado.value.seleccionesValidadas.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {resultado.value.seleccionesValidadas.map((seleccion, indice) => {
                  const cantidad = resultado.value.cantidadesAfectadas[indice];
                  return (
                    <li key={seleccion.descripcionOriginal}>
                      <code className="whitespace-pre-wrap">{seleccion.descripcionOriginal}</code>
                      {`: ${seleccion.codigoTipoLiquidacion} — ${seleccion.concepto}; ${cantidadFilas(
                        cantidad?.cantidadFilasPatagonia ?? 0,
                      )}`}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
