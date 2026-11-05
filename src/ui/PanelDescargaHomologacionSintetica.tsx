import { useRef, useState } from 'react';
import { downloadBytes } from '../export/download';
import {
  prepararDescargaHomologacionSintetica,
  TXT_SINTETICO_MIME_TYPE,
  type BancoDescargaHomologacionSintetica,
  type PreparacionDescargaHomologacionSintetica,
  type ResultadoPreparacionDescargaHomologacionSintetica,
} from './orquestacion';

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
      className="mt-8 rounded border border-sky-300 bg-sky-50 p-4"
      aria-labelledby="descarga-sintetica-titulo"
      data-testid="panel-descarga-sintetica"
    >
      <h2 id="descarga-sintetica-titulo" className="text-lg font-semibold">
        7 · Descargar TXT sintéticos de prueba
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        Estos archivos se preparan con un catálogo ficticio cerrado.{' '}
        <strong>No contienen los empleados ni los importes cargados por Recursos Humanos.</strong>
      </p>
      <p className="mt-2 text-sm font-semibold text-amber-900">
        ARCHIVO SINTÉTICO, NO PRODUCTIVO — NO HOMOLOGADO
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="preparar-sintetico-bna"
          disabled={ocupado}
          onClick={() => void preparar('BNA')}
          className="rounded border border-sky-700 bg-white px-3 py-1.5 text-sm hover:bg-sky-100 disabled:opacity-50"
        >
          Preparar Banco Nación
        </button>
        <button
          type="button"
          data-testid="preparar-sintetico-patagonia"
          disabled={ocupado}
          onClick={() => void preparar('PATAGONIA')}
          className="rounded border border-sky-700 bg-white px-3 py-1.5 text-sm hover:bg-sky-100 disabled:opacity-50"
        >
          Preparar Banco Patagonia
        </button>
      </div>

      {preparacion !== null && (
        <div
          className="mt-4 rounded border border-slate-300 bg-white p-3 text-sm"
          data-testid="vista-previa-sintetica"
        >
          <h3 className="font-semibold">Vista previa segura</h3>
          <dl className="mt-2 grid gap-1 sm:grid-cols-[11rem_1fr]">
            <dt className="font-medium">Banco</dt>
            <dd data-testid="sintetico-banco">{nombreBanco(preparacion.banco)}</dd>
            <dt className="font-medium">Nombre sugerido</dt>
            <dd className="break-all" data-testid="sintetico-nombre">
              {preparacion.nombreArchivo}
            </dd>
            <dt className="font-medium">Registros</dt>
            <dd data-testid="sintetico-registros">
              {String(preparacion.inspeccion.cantidadRegistros)}
            </dd>
            <dt className="font-medium">Bytes</dt>
            <dd data-testid="sintetico-bytes">{String(preparacion.cantidadBytes)}</dd>
            <dt className="font-medium">SHA-256</dt>
            <dd className="break-all font-mono text-xs" data-testid="sintetico-sha256">
              {preparacion.sha256}
            </dd>
            <dt className="font-medium">Inspección</dt>
            <dd data-testid="sintetico-inspeccion">
              {`OK · pagos=${String(preparacion.inspeccion.cantidadPagos)}`}
              {preparacion.inspeccion.cantidadLotes === undefined
                ? ''
                : ` · lotes=${String(preparacion.inspeccion.cantidadLotes)}`}
            </dd>
          </dl>
          <p className="mt-3 text-xs text-slate-600">
            El navegador permite sugerir el nombre, pero no garantizar el directorio final ni releer
            el archivo después de guardarlo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="confirmar-descarga-sintetica"
              disabled={ocupado}
              onClick={() => void confirmar()}
              className="rounded border border-sky-800 bg-sky-800 px-3 py-1.5 text-sm text-white hover:bg-sky-700 disabled:opacity-50"
            >
              Confirmar y descargar TXT
            </button>
            <button
              type="button"
              data-testid="cancelar-descarga-sintetica"
              disabled={ocupado}
              onClick={cancelar}
              className="rounded border border-slate-400 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
            >
              Cancelar
            </button>
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
