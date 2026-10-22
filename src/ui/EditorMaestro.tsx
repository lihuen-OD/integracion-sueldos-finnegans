// Editor UPDATE-only del maestro (T3-11, D-066). Cero reglas acá: valida el motor F2 vía
// `editarMaestro` (orquestada por App) y la UI solo pinta etiquetas humanas, estados
// VACIO/VALIDO/INVALIDO y mensajes. Sin estructuras internas al operador: nada de
// MasterRecord/CampoMaestro/fingerprints. Simetría BNA/Patagonia (D-067) y sin ADD ni
// DELETE; identidad y PAT_CODIGO_DEPENDENCIA aparecen SOLO como referencia.
import { useState } from 'react';
import type { CampoBancario, CampoEditableMaestro, MasterRecord } from '../domain/maestro';
import { CAMPOS_EDITABLES_MAESTRO, CAMPOS_BANCARIOS } from '../domain/maestro';
import {
  ETIQUETA_CAMPO_MAESTRO,
  ETIQUETA_MOTIVO_CAMPO_BANCARIO,
  etiquetaCampoMaestro,
  type CampoMaestroVista,
} from './etiquetas';

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
    <div className="text-sm" data-testid={testid}>
      <dt className="font-medium">{etiqueta}</dt>
      <dd>
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
    <div className="mt-2" data-testid={`campo-maestro-${campo}`}>
      <div className="flex items-baseline justify-between">
        <dt className="text-sm font-medium">{ETIQUETA_CAMPO_MAESTRO[campo]}</dt>
        {esEditable && !editando && (
          <button
            type="button"
            data-testid={`boton-editar-${campo}`}
            onClick={() => {
              setEditando(true);
            }}
            className="rounded border border-slate-400 px-2 py-0.5 text-xs hover:bg-slate-100"
          >
            Editar
          </button>
        )}
      </div>
      <dd className="text-sm">
        {valorDato(dato)}
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
          className="mt-1 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const entrada = event.currentTarget.elements.namedItem(idInput);
            if (entrada instanceof HTMLInputElement) {
              guardar(campo as CampoEditableMaestro, entrada.value);
              setEditando(false);
            }
          }}
        >
          <label className="text-sm" htmlFor={idInput}>
            {ETIQUETA_CAMPO_MAESTRO[campo]} — nuevo valor
          </label>
          <input
            id={idInput}
            data-testid={`entrada-${campo}`}
            name={idInput}
            type="text"
            defaultValue={dato.estado === 'VACIO' ? '' : dato.texto}
            autoComplete="off"
            className="rounded border border-slate-300 px-2 py-0.5 text-sm"
          />
          <button
            type="submit"
            data-testid={`guardar-${campo}`}
            className="rounded bg-slate-800 px-3 py-0.5 text-sm text-white hover:bg-slate-700"
          >
            Guardar
          </button>
          <button
            type="button"
            data-testid={`cancelar-${campo}`}
            onClick={() => {
              setEditando(false);
            }}
            className="rounded border border-slate-400 px-3 py-0.5 text-sm hover:bg-slate-100"
          >
            Cancelar
          </button>
          <p className="text-xs text-slate-600">Vaciar el campo borra el dato.</p>
        </form>
      )}
      {estado !== null && estado.campo === campo && (
        <p
          role={estado.ok ? 'status' : 'alert'}
          aria-live="polite"
          className={`text-sm ${estado.ok ? 'text-emerald-700' : 'text-red-700'}`}
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
      className="mt-4 rounded border border-slate-300 p-4"
      aria-labelledby="maestro-titulo"
      data-testid="datos-maestro"
    >
      <h3 id="maestro-titulo" className="text-lg font-semibold">
        Datos del maestro de este empleado
      </h3>
      <p className="text-sm text-slate-600">
        Cambios de banco y datos de cuenta. También podés vaciar un dato; la conciliación muestra
        después si a algún banco le falta algo.
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-3" data-testid="referencia-identidad">
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
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-slate-200 p-3" data-testid="maestro-bna">
          <h4 className="font-medium">Banco Nación</h4>
          <dl>
            <CampoEditable registro={registro} campo="CBU" guardar={guardar} estado={estado} />
          </dl>
        </div>
        <div className="rounded border border-slate-200 p-3" data-testid="maestro-patagonia">
          <h4 className="font-medium">Banco Patagonia</h4>
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
