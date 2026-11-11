// Configuración de la empresa: formulario operativo para RRHH. Compone internamente los
// contratos CompanyProfile v1/v2/v3 con los validadores existentes, permite exportar e
// importar la configuración como archivo local y no persiste nada en el navegador.
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { descargarPerfilVersionado, perfilVersionadoDesdeBytes } from '../profile/archivo';
import { NOMBRE_SUGERIDO_PERFIL } from '../profile/plantilla';
import type { CompanyProfileImportado } from '../profile/contrato';
import {
  construirConfiguracionEmpresa,
  datosConfiguracionDesdePerfil,
  describirAlcance,
  formatearCuit,
  type CampoConfiguracionEmpresa,
  type DatosConfiguracionEmpresa,
  type ProblemaConfiguracionEmpresa,
} from '../profile/empresaFormulario';
import { Boton, CLASE_CAMPO, Insignia, Mensaje } from './componentes';

interface Props {
  readonly perfil: CompanyProfileImportado | null;
  readonly cargarPerfil: (perfil: CompanyProfileImportado) => void;
}

interface Aviso {
  readonly valido: boolean;
  readonly texto: string;
  /** Detalle para quien necesite revisar el archivo; queda plegado. */
  readonly detalleTecnico?: string;
}

const ETIQUETA_ALCANCE: Readonly<
  Record<'datos-comunes' | 'banco-nacion' | 'banco-nacion-patagonia', string>
> = {
  'datos-comunes': 'datos generales',
  'banco-nacion': 'datos generales y Banco Nación',
  'banco-nacion-patagonia': 'datos generales, Banco Nación y Banco Patagonia',
};

function Ayuda({ children }: { readonly children: ReactNode }) {
  return <p className="mt-1 text-xs leading-relaxed text-slate-500">{children}</p>;
}

function ErrorCampo({
  problemas,
}: {
  readonly problemas: readonly ProblemaConfiguracionEmpresa[];
}) {
  if (problemas.length === 0) {
    return null;
  }
  return (
    <ul className="mt-1 space-y-0.5 text-xs font-medium text-red-700">
      {problemas.map((problema) => (
        <li key={problema.mensaje}>{problema.mensaje}</li>
      ))}
    </ul>
  );
}

export function PanelPerfil({ perfil, cargarPerfil }: Props) {
  const [datos, setDatos] = useState<DatosConfiguracionEmpresa>(() =>
    datosConfiguracionDesdePerfil(perfil),
  );
  const [problemas, setProblemas] = useState<readonly ProblemaConfiguracionEmpresa[]>([]);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);

  function actualizar<K extends keyof DatosConfiguracionEmpresa>(
    campo: K,
    valor: DatosConfiguracionEmpresa[K],
  ): void {
    setDatos((previos) => ({ ...previos, [campo]: valor }));
    setProblemas((previos) => previos.filter((problema) => problema.campo !== campo));
    setAviso(null);
  }

  function problemasDe(campo: CampoConfiguracionEmpresa): readonly ProblemaConfiguracionEmpresa[] {
    return problemas.filter((problema) => problema.campo === campo);
  }

  function guardar(event: { preventDefault(): void }): void {
    event.preventDefault();
    const resultado = construirConfiguracionEmpresa(datos);
    if (!resultado.ok) {
      setProblemas(resultado.error);
      setAviso({
        valido: false,
        texto: 'Revisá los datos marcados para poder guardar la configuración.',
      });
      return;
    }
    setProblemas([]);
    cargarPerfil(resultado.value.perfil);
    setAviso({
      valido: true,
      texto: `Configuración guardada para esta sesión: ${ETIQUETA_ALCANCE[resultado.value.alcance]}. Volvé a validar la liquidación para usarla.`,
    });
  }

  async function importar(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }
    setAviso(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const resultado = perfilVersionadoDesdeBytes(bytes);
      if (!resultado.ok) {
        const detalle = resultado.error
          .slice(0, 5)
          .map((error) => `${error.ruta}: ${error.codigo}`)
          .join(' · ');
        setAviso({
          valido: false,
          texto:
            'No pudimos leer esa configuración. Elegí un archivo descargado desde esta pantalla o completá los datos del formulario.',
          detalleTecnico: detalle,
        });
        return;
      }
      setDatos(datosConfiguracionDesdePerfil(resultado.value));
      setProblemas([]);
      cargarPerfil(resultado.value);
      setAviso({
        valido: true,
        texto: `Configuración importada y aplicada a esta sesión: ${describirAlcance(resultado.value)}.`,
      });
    } catch {
      setAviso({
        valido: false,
        texto: 'No pudimos abrir el archivo. Volvé a intentarlo o completá los datos a mano.',
      });
    } finally {
      if (inputArchivo.current !== null) {
        inputArchivo.current.value = '';
      }
    }
  }

  function exportar(): void {
    if (perfil !== null) {
      descargarPerfilVersionado(perfil, NOMBRE_SUGERIDO_PERFIL);
    }
  }

  const problemasGenerales = problemas.filter((problema) => problema.campo === 'general');

  return (
    <section
      className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="perfil-titulo"
      data-testid="panel-perfil"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="perfil-titulo" className="text-base font-semibold text-marca-950">
            Configuración de la empresa
          </h3>
          <p className="mt-0.5 max-w-3xl text-sm text-slate-600">
            Completá una vez los datos de la empresa. Se usan para identificar el empleador y
            preparar los archivos de Banco Nación y Banco Patagonia. No se envían a internet ni se
            guardan en el navegador.
          </p>
        </div>
        <Insignia tono={perfil === null ? 'neutral' : 'exito'}>
          {perfil === null ? 'Sin configurar' : 'Configurada'}
        </Insignia>
      </div>

      <form className="mt-4 space-y-6" onSubmit={guardar} noValidate>
        <fieldset className="rounded-lg border border-slate-200 p-3 sm:p-4">
          <legend className="px-1 text-sm font-semibold text-marca-950">Datos generales</legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="empresa-cuit" className="block text-sm font-medium text-slate-700">
                CUIT de la empresa <span className="text-red-700">*</span>
              </label>
              <input
                id="empresa-cuit"
                data-testid="campo-cuit-empresa"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={datos.cuitEmpresa}
                onChange={(event) => {
                  actualizar('cuitEmpresa', event.target.value);
                }}
                aria-invalid={problemasDe('cuitEmpresa').length > 0}
                aria-describedby="ayuda-cuit-empresa"
                className={CLASE_CAMPO}
                placeholder="11 dígitos"
              />
              <Ayuda>
                <span id="ayuda-cuit-empresa">
                  Está en la constancia de inscripción de AFIP. Se usa para identificar a la empresa
                  en los archivos bancarios.
                </span>
              </Ayuda>
              <ErrorCampo problemas={problemasDe('cuitEmpresa')} />
            </div>
            <div>
              <label htmlFor="empresa-nombre" className="block text-sm font-medium text-slate-700">
                Nombre o razón social{' '}
                <span className="font-normal text-slate-500">
                  (obligatorio si configurás bancos)
                </span>
              </label>
              <input
                id="empresa-nombre"
                data-testid="campo-nombre-empresa"
                type="text"
                autoComplete="off"
                value={datos.nombreEmpresa}
                onChange={(event) => {
                  actualizar('nombreEmpresa', event.target.value);
                }}
                aria-invalid={problemasDe('nombreEmpresa').length > 0}
                aria-describedby="ayuda-nombre-empresa"
                className={CLASE_CAMPO}
                placeholder="Razón social de la empresa"
              />
              <Ayuda>
                <span id="ayuda-nombre-empresa">
                  Sirve para reconocer la configuración en pantalla. No se envía al banco.
                </span>
              </Ayuda>
              <ErrorCampo problemas={problemasDe('nombreEmpresa')} />
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-slate-200 p-3 sm:p-4">
          <legend className="px-1 text-sm font-semibold text-marca-950">Banco Nación</legend>
          <p className="mt-1 text-sm text-slate-600">
            Necesarios para preparar el archivo de pago de Banco Nación. Si no los completás, la
            validación funciona, pero esa salida queda incompleta.
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div>
              <label htmlFor="empresa-cbu" className="block text-sm font-medium text-slate-700">
                CBU de la empresa en Banco Nación
              </label>
              <input
                id="empresa-cbu"
                data-testid="campo-cbu-empresa"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={datos.bnaCbuEmpresa}
                onChange={(event) => {
                  actualizar('bnaCbuEmpresa', event.target.value);
                }}
                aria-invalid={problemasDe('bnaCbuEmpresa').length > 0}
                aria-describedby="ayuda-cbu-empresa"
                className={CLASE_CAMPO}
                placeholder="22 dígitos"
              />
              <Ayuda>
                <span id="ayuda-cbu-empresa">
                  22 dígitos de la cuenta de la empresa en Banco Nación. Sin espacios ni guiones.
                  Está en el resumen de cuenta o en la constancia de CBU.
                </span>
              </Ayuda>
              <ErrorCampo problemas={problemasDe('bnaCbuEmpresa')} />
            </div>
            <div>
              <label
                htmlFor="empresa-convenio"
                className="block text-sm font-medium text-slate-700"
              >
                Código de convenio de Banco Nación
              </label>
              <input
                id="empresa-convenio"
                data-testid="campo-convenio-bna"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={datos.bnaCodigoConvenio}
                onChange={(event) => {
                  actualizar('bnaCodigoConvenio', event.target.value);
                }}
                aria-invalid={problemasDe('bnaCodigoConvenio').length > 0}
                aria-describedby="ayuda-convenio-bna"
                className={CLASE_CAMPO}
                placeholder="4 u 8 dígitos"
              />
              <Ayuda>
                <span id="ayuda-convenio-bna">
                  Código que Banco Nación asigna a la empresa. Puede tener 4 u 8 dígitos. Está en la
                  ficha de convenio o te lo informa el banco.
                </span>
              </Ayuda>
              <ErrorCampo problemas={problemasDe('bnaCodigoConvenio')} />
            </div>
            <div>
              <label htmlFor="empresa-moneda" className="block text-sm font-medium text-slate-700">
                Moneda de la cuenta de Banco Nación
              </label>
              <select
                id="empresa-moneda"
                data-testid="campo-moneda-bna"
                value={datos.bnaMoneda}
                onChange={(event) => {
                  actualizar(
                    'bnaMoneda',
                    event.target.value as DatosConfiguracionEmpresa['bnaMoneda'],
                  );
                }}
                aria-invalid={problemasDe('bnaMoneda').length > 0}
                aria-describedby="ayuda-moneda-bna"
                className={CLASE_CAMPO}
              >
                <option value="">Seleccioná una opción</option>
                <option value="0">Pesos (código 0)</option>
                <option value="1">Dólares (código 1)</option>
              </select>
              <Ayuda>
                <span id="ayuda-moneda-bna">
                  Elegí la moneda de la cuenta indicada en el CBU. El código bancario se completa
                  solo.
                </span>
              </Ayuda>
              <ErrorCampo problemas={problemasDe('bnaMoneda')} />
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-slate-200 p-3 sm:p-4">
          <legend className="px-1 text-sm font-semibold text-marca-950">Banco Patagonia</legend>
          <p className="mt-1 text-sm text-slate-600">
            Necesario para preparar el archivo de pago de Banco Patagonia. Para guardarlo también
            tenés que completar los datos de Banco Nación, porque la configuración conserva ambos
            bloques juntos.
          </p>
          <div className="mt-3 max-w-md">
            <label htmlFor="empresa-patagonia" className="block text-sm font-medium text-slate-700">
              Número de empresa de Banco Patagonia
            </label>
            <input
              id="empresa-patagonia"
              data-testid="campo-numero-empresa-patagonia"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={datos.patagoniaNumeroEmpresa}
              onChange={(event) => {
                actualizar('patagoniaNumeroEmpresa', event.target.value);
              }}
              aria-invalid={problemasDe('patagoniaNumeroEmpresa').length > 0}
              aria-describedby="ayuda-patagonia"
              className={CLASE_CAMPO}
              placeholder="1 a 4 dígitos"
            />
            <Ayuda>
              <span id="ayuda-patagonia">
                Número que Banco Patagonia asignó a la empresa para el pago de haberes. Está en la
                ficha de alta del servicio. No es el número de CUIT.
              </span>
            </Ayuda>
            <ErrorCampo problemas={problemasDe('patagoniaNumeroEmpresa')} />
          </div>
        </fieldset>

        {problemasGenerales.length > 0 && (
          <Mensaje tono="peligro" rol="alert">
            <ErrorCampo problemas={problemasGenerales} />
          </Mensaje>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Boton type="submit" variante="primario" data-testid="boton-guardar-configuracion">
            Guardar configuración
          </Boton>
          <Boton
            disabled={perfil === null}
            onClick={exportar}
            data-testid="boton-exportar-configuracion"
          >
            Descargar configuración guardada
          </Boton>
        </div>
      </form>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <label htmlFor="archivo-configuracion" className="block text-sm font-medium text-slate-700">
          ¿Ya tenés una configuración guardada?
        </label>
        <p className="mt-0.5 text-xs text-slate-500">
          Importá el archivo que descargaste en otra sesión. Se aplica a esta corrida y podés
          revisarlo antes de guardar cambios.
        </p>
        <input
          id="archivo-configuracion"
          data-testid="archivo-configuracion"
          ref={inputArchivo}
          type="file"
          accept=".json,application/json"
          autoComplete="off"
          onChange={(event) => void importar(event)}
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-marca-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-marca-800"
        />
      </div>

      <div className="mt-4">
        {perfil === null ? (
          <p data-testid="estado-perfil" className="text-sm text-slate-600">
            Sin configuración de la empresa. La validación de la liquidación funciona igual; los
            datos bancarios de la empresa quedan pendientes.
          </p>
        ) : (
          <div
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm"
            data-testid="perfil-activo"
          >
            <p>
              <strong>Empresa:</strong> {perfil.nombreEmpresa ?? '(sin nombre cargado)'}
            </p>
            <p>
              <strong>CUIT:</strong> {formatearCuit(perfil.cuitEmpresa)}
            </p>
            <p>
              <strong>Configuración incluida:</strong> {describirAlcance(perfil)}
            </p>
            <details className="mt-2 text-xs text-slate-600">
              <summary className="cursor-pointer font-medium text-slate-700">
                Detalles técnicos del archivo
              </summary>
              <p className="mt-1" data-testid="version-perfil">
                Formato de configuración: {perfil.schemaVersion}
              </p>
              <p>
                El archivo se puede volver a importar en otra sesión. No se guarda automáticamente
                en este navegador.
              </p>
            </details>
          </div>
        )}
      </div>

      <div aria-live="polite">
        {aviso !== null && (
          <Mensaje
            tono={aviso.valido ? 'exito' : 'peligro'}
            rol={aviso.valido ? 'status' : 'alert'}
            className="mt-3"
            testid={aviso.valido ? 'perfil-ok' : 'error-perfil'}
          >
            <p>{aviso.texto}</p>
            {aviso.detalleTecnico !== undefined && (
              <details className="mt-1 text-xs">
                <summary className="cursor-pointer font-medium">Detalle para soporte</summary>
                <p className="mt-1 break-words">{aviso.detalleTecnico}</p>
              </details>
            )}
          </Mensaje>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        La configuración vive solo durante esta sesión. Si recargás o cerrás la aplicación, volvé a
        importar el archivo descargado. No se guarda en el navegador.
      </p>
    </section>
  );
}
