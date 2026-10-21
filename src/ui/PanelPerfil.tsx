// Panel de perfil de empresa (CP-F3-B, P-19 ABIERTO): importa/valida el JSON del perfil v1
// (CUALQUIER nombre de archivo, D-059), lo registra en la corrida y lo exporta como
// plantilla. No captura parámetros de envío (D-065) y no agrega campos al esquema.
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { perfilDesdeBytes, descargarPerfil } from '../profile/archivo';
import { NOMBRE_SUGERIDO_PERFIL } from '../profile/plantilla';
import type { CompanyProfile } from '../profile/contrato';

interface Props {
  readonly perfil: CompanyProfile | null;
  readonly cargarPerfil: (perfil: CompanyProfile) => void;
  /** Botón solo-desarrollo para precargar el perfil demo. */
  readonly demo?: ReactNode;
}

interface Aviso {
  readonly valido: boolean;
  readonly texto: string;
}

export function PanelPerfil({ perfil, cargarPerfil, demo }: Props) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const inputPerfil = useRef<HTMLInputElement>(null);

  async function importar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }
    setAviso(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const resultado = perfilDesdeBytes(bytes);
      if (!resultado.ok) {
        const resumen = resultado.error
          .slice(0, 5)
          .map((error) => `${error.ruta}: ${error.codigo}`)
          .join(' · ');
        setAviso({
          valido: false,
          texto: `Perfil de empresa inválido (${resumen}). Revisá la plantilla de guía.`,
        });
        return;
      }
      cargarPerfil(resultado.value);
      setAviso({ valido: true, texto: 'Perfil de empresa cargado.' });
    } catch {
      setAviso({ valido: false, texto: 'No se pudo leer el archivo del perfil.' });
    } finally {
      if (inputPerfil.current !== null) {
        inputPerfil.current.value = '';
      }
    }
  }

  function exportarPlantilla() {
    // La plantilla usa el CUIT de la corrida si hay perfil; si no, queda como guía el
    // propio perfil cargado (mismo mecanismo exportador). Solo se exporta contenido
    // válido (D-059).
    if (perfil !== null) {
      descargarPerfil(perfil, NOMBRE_SUGERIDO_PERFIL);
    }
  }

  return (
    <section className="mt-6" aria-labelledby="perfil-titulo" data-testid="panel-perfil">
      <h2 id="perfil-titulo" className="text-lg font-semibold">
        2 · Datos de la empresa (perfil opcional)
      </h2>
      <p className="text-sm text-slate-600">
        El perfil identifica a la empresa que paga y trae el catálogo de bancos. En esta versión no
        pide datos bancarios de envío: esa configuración va en una fase posterior.
      </p>
      <div className="mt-3 space-y-2">
        <label htmlFor="archivo-perfil" className="block text-sm font-medium">
          Archivo del perfil (JSON)
        </label>
        <input
          id="archivo-perfil"
          ref={inputPerfil}
          type="file"
          accept=".json,application/json"
          autoComplete="off"
          onChange={(event) => void importar(event)}
          className="text-sm"
        />
        {perfil === null ? (
          <p data-testid="estado-perfil" className="text-sm">
            Sin perfil de empresa. La conciliación funciona igual; la generación de archivos queda
            incompleta (estado válido y esperado).
          </p>
        ) : (
          <div className="rounded border border-slate-300 p-3 text-sm" data-testid="perfil-activo">
            <p>
              <strong>Empresa:</strong> {perfil.nombreEmpresa ?? '(sin nombre cargado)'}
            </p>
            <p>
              <strong>CUIT:</strong> {perfil.cuitEmpresa}{' '}
              <span className="text-slate-500">
                (estructura validada; el dígito verificador se revisa en una fase posterior)
              </span>
            </p>
          </div>
        )}
        <button
          type="button"
          disabled={perfil === null}
          onClick={exportarPlantilla}
          className="rounded border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-50"
        >
          Descargar perfil como plantilla editable
        </button>
        {demo}
      </div>
      <div aria-live="polite">
        {aviso !== null && (
          <p
            role="alert"
            data-testid={aviso.valido ? 'perfil-ok' : 'error-perfil'}
            className={aviso.valido ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}
          >
            {aviso.texto}
          </p>
        )}
      </div>
    </section>
  );
}
