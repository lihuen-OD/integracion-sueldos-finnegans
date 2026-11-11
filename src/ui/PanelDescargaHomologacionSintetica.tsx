import { useRef, useState } from 'react';
import { downloadBytes } from '../export/download';
import {
  prepararDescargaHomologacionSintetica,
  TXT_SINTETICO_MIME_TYPE,
  type BancoDescargaHomologacionSintetica,
  type PreparacionDescargaHomologacionSintetica,
  type ResultadoPreparacionDescargaHomologacionSintetica,
} from './orquestacion';
import { Boton, Insignia } from './componentes';

function bytesIguales(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  return a.every((byte, indice) => byte === b[indice]);
}

function nombreBanco(banco: BancoDescargaHomologacionSintetica): string {
  return banco === 'BNA' ? 'Banco Nación · GT 200' : 'Banco Patagonia · B.2';
}

function mensajeRechazo(resultado: ResultadoPreparacionDescargaHomologacionSintetica): string {
  if (resultado.estado === 'PREPARADA') return '';
  switch (resultado.codigo) {
    case 'ARGUMENTOS_INVALIDOS':
    case 'BANCO_NO_ADMITIDO':
    case 'VARIANTE_NO_ADMITIDA':
      return 'La opción sintética solicitada no está permitida.';
    case 'COMPOSICION_RECHAZADA':
      return 'No se pudo preparar el archivo sintético con las comprobaciones vigentes.';
    case 'HUELLA_NO_DISPONIBLE':
      return 'El navegador no pudo calcular la huella de integridad.';
  }
}

export function PanelDescargaHomologacionSintetica() {
  const [preparacion, setPreparacion] = useState<PreparacionDescargaHomologacionSintetica | null>(
    null,
  );
  const [ocupado, setOcupado] = useState(false);
  const [diagnostico, setDiagnostico] = useState<string | null>(null);
  const ticketPreparacion = useRef(0);

  async function preparar(banco: BancoDescargaHomologacionSintetica): Promise<void> {
    const ticket = ++ticketPreparacion.current;
    setPreparacion(null);
    setDiagnostico(null);
    setOcupado(true);
    const resultado =
      banco === 'BNA'
        ? await prepararDescargaHomologacionSintetica('BNA', 'VALIDA')
        : await prepararDescargaHomologacionSintetica('PATAGONIA', 'VALIDA');
    if (ticket !== ticketPreparacion.current) return;
    setOcupado(false);
    if (resultado.estado !== 'PREPARADA') {
      setDiagnostico(mensajeRechazo(resultado));
      return;
    }
    setPreparacion(resultado);
  }

  function cancelar(): void {
    ticketPreparacion.current += 1;
    setPreparacion(null);
    setOcupado(false);
    setDiagnostico('Descarga cancelada. No se creó ningún archivo.');
  }

  async function confirmar(): Promise<void> {
    const esperada = preparacion;
    if (esperada === null) return;
    const ticket = ++ticketPreparacion.current;
    setOcupado(true);
    setDiagnostico(null);

    // Recompone y recalcula SHA-256 inmediatamente antes de crear el Blob. La UI nunca
    // reutiliza bytes provenientes de la corrida real ni confía solo en la vista previa.
    const fresca =
      esperada.banco === 'BNA'
        ? await prepararDescargaHomologacionSintetica('BNA', esperada.variante)
        : await prepararDescargaHomologacionSintetica('PATAGONIA', esperada.variante);
    if (ticket !== ticketPreparacion.current) return;
    if (fresca.estado !== 'PREPARADA') {
      setOcupado(false);
      setPreparacion(null);
      setDiagnostico(mensajeRechazo(fresca));
      return;
    }
    const integra =
      fresca.banco === esperada.banco &&
      fresca.nombreArchivo === esperada.nombreArchivo &&
      fresca.cantidadBytes === esperada.cantidadBytes &&
      fresca.sha256 === esperada.sha256 &&
      bytesIguales(fresca.bytes, esperada.bytes);
    if (!integra) {
      setOcupado(false);
      setPreparacion(null);
      setDiagnostico('La integridad cambió desde la vista previa. Prepará el archivo nuevamente.');
      return;
    }

    downloadBytes(fresca.bytes, fresca.nombreArchivo, TXT_SINTETICO_MIME_TYPE);
    setOcupado(false);
    setPreparacion(null);
    setDiagnostico(`Descarga sintética iniciada: ${fresca.nombreArchivo}`);
  }

  return (
    <section
      id="descargas-sinteticas"
      className="scroll-mt-24 rounded-2xl border-2 border-dashed border-sky-400 bg-sky-50 p-4 sm:p-6"
      aria-labelledby="descarga-sintetica-titulo"
      data-testid="panel-descarga-sintetica"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-sky-800 uppercase">
            Circuito separado · no es un archivo de pago
          </p>
          <h2 id="descarga-sintetica-titulo" className="mt-1 text-xl font-semibold text-sky-950">
            Descargas sintéticas de prueba
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-700">
            Estos archivos se preparan con un catálogo ficticio cerrado.{' '}
            <strong>
              No contienen los empleados ni los importes cargados por Recursos Humanos.
            </strong>{' '}
            Sirven solo para comprobar el formato y la integridad del circuito.
          </p>
        </div>
        <Insignia tono="sintetico">SINTÉTICO · NO PRODUCTIVO</Insignia>
      </div>

      <p className="mt-3 rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900">
        ARCHIVO SINTÉTICO, NO PRODUCTIVO — NO HOMOLOGADO. No lo uses para pagar haberes.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Boton
          data-testid="preparar-sintetico-bna"
          disabled={ocupado}
          onClick={() => void preparar('BNA')}
        >
          Preparar Banco Nación
        </Boton>
        <Boton
          data-testid="preparar-sintetico-patagonia"
          disabled={ocupado}
          onClick={() => void preparar('PATAGONIA')}
        >
          Preparar Banco Patagonia
        </Boton>
      </div>

      {preparacion !== null && (
        <div
          className="mt-4 rounded-xl border border-slate-300 bg-white p-4 text-sm shadow-sm"
          data-testid="vista-previa-sintetica"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-marca-950">Vista previa segura</h3>
            <Insignia tono="sintetico">Prueba, no pago</Insignia>
          </div>
          <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-[11rem_1fr]">
            <dt className="font-medium text-slate-600">Banco</dt>
            <dd data-testid="sintetico-banco">{nombreBanco(preparacion.banco)}</dd>
            <dt className="font-medium text-slate-600">Nombre sugerido</dt>
            <dd className="break-all" data-testid="sintetico-nombre">
              {preparacion.nombreArchivo}
            </dd>
            <dt className="font-medium text-slate-600">Registros</dt>
            <dd data-testid="sintetico-registros">
              {String(preparacion.inspeccion.cantidadRegistros)}
            </dd>
            <dt className="font-medium text-slate-600">Bytes</dt>
            <dd data-testid="sintetico-bytes">{String(preparacion.cantidadBytes)}</dd>
            <dt className="font-medium text-slate-600">SHA-256</dt>
            <dd className="break-all font-mono text-xs" data-testid="sintetico-sha256">
              {preparacion.sha256}
            </dd>
            <dt className="font-medium text-slate-600">Inspección</dt>
            <dd data-testid="sintetico-inspeccion">
              {`OK · pagos=${String(preparacion.inspeccion.cantidadPagos)}`}
              {preparacion.inspeccion.cantidadLotes === undefined
                ? ''
                : ` · lotes=${String(preparacion.inspeccion.cantidadLotes)}`}
            </dd>
          </dl>
          <p className="mt-3 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
            El navegador permite sugerir el nombre, pero no garantizar el directorio final ni releer
            el archivo después de guardarlo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton
              variante="primario"
              data-testid="confirmar-descarga-sintetica"
              disabled={ocupado}
              onClick={() => void confirmar()}
            >
              Confirmar y descargar TXT sintético
            </Boton>
            <Boton data-testid="cancelar-descarga-sintetica" disabled={ocupado} onClick={cancelar}>
              Cancelar
            </Boton>
          </div>
        </div>
      )}

      <div aria-live="polite">
        {ocupado && <p className="mt-2 text-sm text-slate-600">Comprobando bytes sintéticos…</p>}
        {diagnostico !== null && (
          <p className="mt-2 text-sm text-slate-700" data-testid="diagnostico-sintetico">
            {diagnostico}
          </p>
        )}
      </div>
    </section>
  );
}
