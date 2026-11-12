// Editor UPDATE-only del maestro (T3-11, D-066). Cero reglas acá: valida el motor F2 vía
// `editarMaestro` (orquestada por App) y la UI solo pinta etiquetas humanas, estados
// VACIO/VALIDO/INVALIDO y mensajes. Sin estructuras internas al operador.
import { useState } from 'react';
import type { CampoBancario, CampoEditableMaestro, MasterRecord } from '../domain/maestro';
import { CAMPOS_EDITABLES_MAESTRO, CAMPOS_BANCARIOS } from '../domain/maestro';
import {
  ETIQUETA_CAMPO_MAESTRO,
  ETIQUETA_MOTIVO_CAMPO_BANCARIO,
  etiquetaCampoMaestro,
  type CampoMaestroVista,
} from './etiquetas';
import { Boton, CLASE_CAMPO, Insignia } from './componentes';

/** Resultado de la guardia, ya traducido por el orquestador (App). */
export interface EstadoEdicion {
  readonly campo: CampoBancario;
  readonly ok: boolean;
  readonly mensaje: string;
}

interface Props {
  readonly registro: MasterRecord;
  readonly guardar: (campo: CampoEditableMaestro, texto: string) => void;
  readonly estado: EstadoEdicion | null;
}

/* Referencia legible, nunca controles editables (D-066): identidad y dependencia. */
function Referencia({
  etiqueta,
  valor,
  testid,
}: {
  readonly etiqueta: string;
  readonly valor: string;
  readonly testid: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm" data-testid={testid}>
      <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{etiqueta}</dt>
      <dd className="mt-0.5">
        {valor === '' ? '(vacío)' : valor} <span className="text-slate-500">(solo referencia)</span>
      </dd>
    </div>
  );
}

function valorDato(campo: CampoMaestroVista): string {
  return etiquetaCampoMaestro(campo);
}

function datoBancario(registro: MasterRecord, campo: CampoBancario): CampoMaestroVista {
  if (campo === 'CBU') {
    return registro.cbu;
  }
  const clave: Record<Exclude<CampoBancario, 'CBU'>, keyof MasterRecord['patagonia']> = {
    PAT_TIPO_CUENTA: 'tipoCuenta',
    PAT_NUMERO_CUENTA: 'numeroCuenta',
    PAT_CODIGO_BANCO: 'codigoBanco',
    PAT_CODIGO_SUCURSAL: 'codigoSucursal',
    PAT_TIPO_DOCUMENTO: 'tipoDocumento',
    PAT_NUMERO_DOCUMENTO: 'numeroDocumento',
    PAT_PROVINCIA_DOCUMENTO: 'provinciaDocumento',
    PAT_CODIGO_DEPENDENCIA: 'codigoDependencia',
  };
  return registro.patagonia[clave[campo]];
}

/** Un campo: valor humano + estado, edición explícita con validación del motor. */
function CampoEditable({
  registro,
  campo,
  guardar,
  estado,
}: {
  readonly registro: MasterRecord;
  readonly campo: CampoBancario;
  readonly guardar: Props['guardar'];
  readonly estado: EstadoEdicion | null;
}) {
  const [editando, setEditando] = useState(false);
  const dato = datoBancario(registro, campo);
  const esEditable = (CAMPOS_EDITABLES_MAESTRO as readonly string[]).includes(campo);
  const idInput = `editar-${campo}`;
  return (
    <div
      className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5"
      data-testid={`campo-maestro-${campo}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-sm font-medium text-slate-800">{ETIQUETA_CAMPO_MAESTRO[campo]}</dt>
        {esEditable && !editando && (
          <button
            type="button"
            data-testid={`boton-editar-${campo}`}
            onClick={() => {
              setEditando(true);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-slate-50"
          >
            Editar
          </button>
        )}
      </div>
      <dd className="mt-0.5 text-sm">
        <span className={dato.estado === 'VALIDO' ? 'text-slate-900' : 'text-slate-700'}>
          {valorDato(dato)}
        </span>
        {dato.estado === 'INVALIDO' && (
          <span className="text-red-700">
            {' '}
            · dato inválido ({ETIQUETA_MOTIVO_CAMPO_BANCARIO[dato.motivo]})
          </span>
        )}
        {esEditable && <span className="text-slate-500"> · editable</span>}
        {!esEditable && <span className="text-slate-500"> · solo referencia</span>}
      </dd>
      {esEditable && editando && (
        <form
          className="mt-2 rounded-lg bg-slate-50 p-2"
          onSubmit={(event) => {
            event.preventDefault();
            const entrada = event.currentTarget.elements.namedItem(idInput);
            if (entrada instanceof HTMLInputElement) {
              guardar(campo as CampoEditableMaestro, entrada.value);
              setEditando(false);
            }
          }}
        >
          <label className="text-sm font-medium text-slate-700" htmlFor={idInput}>
            {ETIQUETA_CAMPO_MAESTRO[campo]} — nuevo valor
          </label>
          <input
            id={idInput}
            data-testid={`entrada-${campo}`}
            name={idInput}
            type="text"
            defaultValue={dato.estado === 'VACIO' ? '' : dato.texto}
            autoComplete="off"
            className={CLASE_CAMPO}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Boton variante="primario" type="submit" data-testid={`guardar-${campo}`}>
              Guardar
            </Boton>
            <Boton
              data-testid={`cancelar-${campo}`}
              onClick={() => {
                setEditando(false);
              }}
            >
              Cancelar
            </Boton>
          </div>
          <p className="mt-1 text-xs text-slate-600">Vaciar el campo borra el dato.</p>
        </form>
      )}
      {estado !== null && estado.campo === campo && (
        <p
          role={estado.ok ? 'status' : 'alert'}
          aria-live="polite"
          className={`mt-2 rounded-md px-2 py-1.5 text-sm ${estado.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}
          data-testid={estado.ok ? 'aviso-edicion' : `error-edicion-${campo}`}
        >
          {estado.mensaje}
        </p>
      )}
    </div>
  );
}

export function EditorMaestro({ registro, guardar, estado }: Props) {
  const patagonia: readonly CampoBancario[] = CAMPOS_BANCARIOS.filter((campo) => campo !== 'CBU');
  return (
    <section
      className="mt-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
      aria-labelledby="maestro-titulo"
      data-testid="datos-maestro"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id="maestro-titulo" className="text-lg font-semibold text-marca-950">
          Datos del maestro de este empleado
        </h3>
        <Insignia tono="info">Edición de esta sesión</Insignia>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Cambios de banco y datos de cuenta. También podés vaciar un dato; la conciliación muestra
        después si a algún banco le falta algo.
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="referencia-identidad">
        <Referencia etiqueta="CUIL" valor={registro.cuilTexto} testid="referencia-cuil" />
        <Referencia
          etiqueta="Legajo"
          valor={registro.legajo ?? '(ilegible)'}
          testid="referencia-legajo"
        />
        <Referencia
          etiqueta="Nombre de referencia"
          valor={registro.apellidoNombreRef}
          testid="referencia-nombre"
        />
      </dl>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div
          className="rounded-lg border border-slate-200 bg-slate-50 p-3"
          data-testid="maestro-bna"
        >
          <h4 className="font-semibold text-marca-950">Banco Nación</h4>
          <dl>
            <CampoEditable registro={registro} campo="CBU" guardar={guardar} estado={estado} />
          </dl>
        </div>
        <div
          className="rounded-lg border border-slate-200 bg-slate-50 p-3"
          data-testid="maestro-patagonia"
        >
          <h4 className="font-semibold text-marca-950">Banco Patagonia</h4>
          <dl>
            {patagonia.map((campo) => (
              <CampoEditable
                key={campo}
                registro={registro}
                campo={campo}
                guardar={guardar}
                estado={estado}
              />
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
