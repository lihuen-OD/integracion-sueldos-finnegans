// Tabla de filas conciliadas y su detalle individual (CP-F3-B): navegación simple
// (elegir fila → ver todo su contenido e incidencias). Los datos en pantalla son los del
// operador; nunca se guardan ni salen por red.
import type { FilaConciliada, ResultadoConciliacion } from '../reconciliation';
import { DESCRIPCION_CODIGO } from '../domain/incidencias';
import {
  ESTILO_NIVEL,
  ETIQUETA_NIVEL,
  etiquetaAlcance,
  etiquetaEstadoFila,
  etiquetaImporte,
} from './etiquetas';

interface TablaProps {
  readonly resultado: ResultadoConciliacion;
  readonly abrirFila: (indiceFila: number) => void;
}

function abreviarTexto(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

export function TablaFilas({ resultado, abrirFila }: TablaProps) {
  return (
    <section className="mt-6" aria-labelledby="filas-titulo" data-testid="tabla-filas">
      <h2 id="filas-titulo" className="text-lg font-semibold">
        Filas de la liquidación
      </h2>
      <table className="mt-3 w-full border-collapse text-sm" data-testid="filas">
        <caption className="text-left">
          {String(resultado.filas.length)} filas · elegir una para ver el detalle
        </caption>
        <thead>
          <tr className="border-b border-slate-300 text-left">
            <th scope="col" className="py-1 pr-3">
              #
            </th>
            <th scope="col" className="py-1 pr-3">
              Empleado
            </th>
            <th scope="col" className="py-1 pr-3">
              Estado
            </th>
            <th scope="col" className="py-1">
              Gravedad
            </th>
          </tr>
        </thead>
        <tbody>
          {resultado.filas.map((fila, indice) => (
            <tr key={indice} data-testid={`fila-${String(indice)}`}>
              <td className="py-1 pr-3">{String(indice + 1)}</td>
              <td className="py-1 pr-3">
                <button
                  type="button"
                  data-testid={`ver-fila-${String(indice)}`}
                  onClick={() => {
                    abrirFila(indice);
                  }}
                  className="underline decoration-dotted"
                >
                  {abreviarTexto(fila.linea.legajoApellidoNombre, 40)}
                </button>
              </td>
              <td className="py-1 pr-3">{etiquetaEstadoFila(fila.estado)}</td>
              <td className={`py-1 ${ESTILO_NIVEL[fila.nivel]}`}>{ETIQUETA_NIVEL[fila.nivel]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

interface DetalleProps {
  readonly fila: FilaConciliada;
  readonly cerrar: () => void;
}

export function DetalleFila({ fila, cerrar }: DetalleProps) {
  return (
    <section className="mt-6 rounded border border-slate-300 p-4" data-testid="detalle-fila">
      <button
        type="button"
        data-testid="cerrar-detalle"
        onClick={cerrar}
        className="rounded border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100"
      >
        ← Volver a la tabla
      </button>
      <h3 className="mt-3 text-lg font-semibold">
        {fila.linea.legajoApellidoNombre || '(empleado sin nombre legible)'}
      </h3>
      <dl className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2" data-testid="datos-fila">
        <dt className="font-medium">Estado</dt>
        <dd>{etiquetaEstadoFila(fila.estado)}</dd>
        <dt className="font-medium">Neto</dt>
        <dd>{etiquetaImporte(fila.linea.neto)}</dd>
        <dt className="font-medium">Remunerativo</dt>
        <dd>{etiquetaImporte(fila.linea.componentes.remunerativo)}</dd>
        <dt className="font-medium">No remunerativo</dt>
        <dd>{etiquetaImporte(fila.linea.componentes.noRemunerativo)}</dd>
        <dt className="font-medium">Descuento</dt>
        <dd>{etiquetaImporte(fila.linea.componentes.descuento)}</dd>
        <dt className="font-medium">Legajo</dt>
        <dd>{fila.linea.legajo ?? '(ilegible)'}</dd>
        <dt className="font-medium">CUIL texto</dt>
        <dd>{fila.linea.cuilTexto === '' ? '(vacío)' : fila.linea.cuilTexto}</dd>
        <dt className="font-medium">Banco en Finnegans</dt>
        <dd>
          {fila.linea.bancoFinnegans === null
            ? '(ilegible)'
            : fila.linea.bancoFinnegans === ''
              ? '(vacío)'
              : fila.linea.bancoFinnegans}
        </dd>
        <dt className="font-medium">Origen</dt>
        <dd>
          Hoja «{fila.linea.ref.hoja ?? '—'}», fila{' '}
          {fila.linea.ref.fila === undefined ? '—' : String(fila.linea.ref.fila)}
        </dd>
      </dl>
      {fila.incidencias.length > 0 && (
        <ul className="mt-3 space-y-2" data-testid="incidencias-fila">
          {fila.incidencias.map((incidencia) => (
            <li key={incidencia.id} data-testid="detalle-incidencia">
              <p className={ESTILO_NIVEL[incidencia.nivel]}>
                <strong>{ETIQUETA_NIVEL[incidencia.nivel]}</strong> ·{' '}
                {DESCRIPCION_CODIGO[incidencia.codigo]} — {incidencia.detalle} (
                {etiquetaAlcance(incidencia.alcance)})
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
