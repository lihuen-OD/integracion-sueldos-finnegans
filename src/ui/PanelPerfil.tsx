// Perfil de empresa versionado: importa y exporta v1/v2/v3 sin migraciones, defaults ni
// reinterpretaciones. No captura parámetros de envío (D-065) ni modifica los contratos.
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { perfilVersionadoDesdeBytes, descargarPerfilVersionado } from '../profile/archivo';
import { NOMBRE_SUGERIDO_PERFIL } from '../profile/plantilla';
import type { CompanyProfileImportado } from '../profile/contrato';

interface Props {
  readonly perfil: CompanyProfileImportado | null;
  readonly cargarPerfil: (perfil: CompanyProfileImportado) => void;
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
      const resultado = perfilVersionadoDesdeBytes(bytes);
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
      setAviso({
        valido: true,
        texto: `Perfil de empresa v${resultado.value.schemaVersion} cargado sin convertir su versión.`,
      });
    } catch {
      setAviso({ valido: false, texto: 'No se pudo leer el archivo del perfil.' });
    } finally {
      if (inputPerfil.current !== null) {
        inputPerfil.current.value = '';
      }
    }
  }

  function exportarPerfil() {
    // El serializador versionado conserva exactamente el contrato declarado (D-079/D-087).
    if (perfil !== null) {
      descargarPerfilVersionado(perfil, NOMBRE_SUGERIDO_PERFIL);
    }
  }

  return (
    <section className="mt-6" aria-labelledby="perfil-titulo" data-testid="panel-perfil">
      <h3 id="perfil-titulo" className="text-lg font-semibold">
        Perfil empresarial
      </h3>
      <p className="text-sm text-slate-600">
        Importá un perfil v1, v2 o v3. La aplicación conserva la versión declarada y no completa ni
        migra datos faltantes. Los parámetros de cada envío siguen fuera de esta pantalla.
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
            <p data-testid="version-perfil">
              <strong>Versión del perfil:</strong> {perfil.schemaVersion}
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
          onClick={exportarPerfil}
          className="rounded border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100 disabled:opacity-50"
        >
          Descargar perfil conservando su versión (JSON)
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
