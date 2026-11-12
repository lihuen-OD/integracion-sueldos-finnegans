// Componentes visuales reutilizables del asistente (capa de presentación).
// No contienen reglas de negocio ni leen estado: reciben textos ya calculados por App y
// los contratos de dominio. Centralizan tipografía, espaciado, estados y foco accesible.
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type Tono = 'neutral' | 'marca' | 'info' | 'exito' | 'atencion' | 'peligro' | 'sintetico';

const CLASE_INSIGNIA: Readonly<Record<Tono, string>> = {
  neutral: 'border-slate-300 bg-slate-100 text-slate-700',
  marca: 'border-marca-200 bg-marca-50 text-marca-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  exito: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  atencion: 'border-amber-300 bg-amber-50 text-amber-900',
  peligro: 'border-red-200 bg-red-50 text-red-800',
  sintetico: 'border-sky-400 bg-sky-100 text-sky-900',
};

export function Insignia({
  tono = 'neutral',
  children,
  className = '',
}: {
  readonly tono?: Tono;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${CLASE_INSIGNIA[tono]} ${className}`}
    >
      {children}
    </span>
  );
}

type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro';

const CLASE_BOTON: Readonly<Record<VarianteBoton, string>> = {
  primario:
    'border-marca-900 bg-marca-900 text-white hover:bg-marca-800 focus-visible:outline-marca-900',
  secundario: 'border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50',
  fantasma: 'border-transparent bg-transparent text-marca-800 hover:bg-marca-50',
  peligro: 'border-red-300 bg-white text-red-800 hover:bg-red-50',
};

export function Boton({
  variante = 'secundario',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variante?: VarianteBoton;
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${CLASE_BOTON[variante]} ${className}`}
      {...props}
    />
  );
}

export function EnlaceBoton({
  href,
  children,
  variante = 'secundario',
  className = '',
}: {
  readonly href: string;
  readonly children: ReactNode;
  readonly variante?: VarianteBoton;
  readonly className?: string;
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold ${CLASE_BOTON[variante]} ${className}`}
    >
      {children}
    </a>
  );
}

export function Tarjeta({
  titulo,
  descripcion,
  acciones,
  children,
  tono = 'neutral',
  testid,
  className = '',
}: {
  readonly titulo?: string;
  readonly descripcion?: string;
  readonly acciones?: ReactNode;
  readonly children?: ReactNode;
  readonly tono?: Tono;
  readonly testid?: string;
  readonly className?: string;
}) {
  const borde =
    tono === 'sintetico'
      ? 'border-sky-300 bg-sky-50'
      : tono === 'atencion'
        ? 'border-amber-300 bg-amber-50'
        : tono === 'peligro'
          ? 'border-red-200 bg-red-50'
          : 'border-slate-200 bg-white';
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm sm:p-5 ${borde} ${className}`}
      {...(testid === undefined ? {} : { 'data-testid': testid })}
    >
      {(titulo !== undefined || acciones !== undefined) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {titulo !== undefined && (
              <h3 className="text-base font-semibold text-marca-950">{titulo}</h3>
            )}
            {descripcion !== undefined && (
              <p className="mt-1 text-sm text-slate-600">{descripcion}</p>
            )}
          </div>
          {acciones}
        </div>
      )}
      {children !== undefined && (
        <div className={titulo === undefined && acciones === undefined ? '' : 'mt-3'}>
          {children}
        </div>
      )}
    </div>
  );
}

export function Metrica({
  etiqueta,
  valor,
  detalle,
  tono = 'neutral',
}: {
  readonly etiqueta: string;
  readonly valor: ReactNode;
  readonly detalle?: string;
  readonly tono?: Tono;
}) {
  const color =
    tono === 'exito'
      ? 'text-emerald-800'
      : tono === 'atencion'
        ? 'text-amber-900'
        : tono === 'peligro'
          ? 'text-red-800'
          : 'text-marca-950';
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{etiqueta}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{valor}</p>
      {detalle !== undefined && <p className="mt-0.5 text-xs text-slate-500">{detalle}</p>}
    </div>
  );
}

export function Mensaje({
  tono = 'info',
  rol = 'status',
  titulo,
  children,
  testid,
  className = '',
}: {
  readonly tono?: Tono;
  readonly rol?: 'alert' | 'status' | 'note';
  readonly titulo?: string;
  readonly children: ReactNode;
  readonly testid?: string;
  readonly className?: string;
}) {
  const estilo =
    tono === 'peligro'
      ? 'border-red-300 bg-red-50 text-red-900'
      : tono === 'atencion'
        ? 'border-amber-300 bg-amber-50 text-amber-950'
        : tono === 'exito'
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
          : tono === 'sintetico'
            ? 'border-sky-400 bg-sky-50 text-sky-950'
            : 'border-slate-300 bg-slate-50 text-slate-800';
  return (
    <div
      role={rol}
      className={`rounded-lg border px-3.5 py-3 text-sm ${estilo} ${className}`}
      {...(testid === undefined ? {} : { 'data-testid': testid })}
    >
      {titulo !== undefined && <p className="font-semibold">{titulo}</p>}
      <div className={titulo === undefined ? '' : 'mt-1'}>{children}</div>
    </div>
  );
}

export function Vacio({
  titulo,
  children,
  acciones,
}: {
  readonly titulo: string;
  readonly children?: ReactNode;
  readonly acciones?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-8 text-center">
      <p className="font-medium text-slate-700">{titulo}</p>
      {children !== undefined && (
        <div className="mx-auto mt-1 max-w-2xl text-sm text-slate-600">{children}</div>
      )}
      {acciones !== undefined && <div className="mt-4 flex justify-center gap-2">{acciones}</div>}
    </div>
  );
}

export function EncabezadoSeccion({
  id,
  numero,
  titulo,
  descripcion,
  acciones,
}: {
  readonly id: string;
  readonly numero?: string;
  readonly titulo: string;
  readonly descripcion?: string;
  readonly acciones?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {numero !== undefined && (
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-marca-900 text-sm font-semibold text-white"
          >
            {numero}
          </span>
        )}
        <div className="min-w-0">
          <h2 id={id} className="text-xl font-semibold tracking-tight text-marca-950">
            {numero === undefined ? titulo : `${numero} · ${titulo}`}
          </h2>
          {descripcion !== undefined && (
            <p className="mt-1 max-w-3xl text-sm text-slate-600">{descripcion}</p>
          )}
        </div>
      </div>
      {acciones}
    </div>
  );
}

export type EstadoPaso = 'completo' | 'en-curso' | 'pendiente' | 'bloqueado';

const ETIQUETA_ESTADO_PASO: Readonly<Record<EstadoPaso, string>> = {
  completo: 'Completado',
  'en-curso': 'En curso',
  pendiente: 'Pendiente',
  bloqueado: 'Con bloqueos',
};

const CLASE_ESTADO_PASO: Readonly<Record<EstadoPaso, string>> = {
  completo: 'bg-emerald-600 text-white',
  'en-curso': 'bg-marca-900 text-white',
  pendiente: 'bg-slate-200 text-slate-700',
  bloqueado: 'bg-amber-500 text-white',
};

export interface PasoProgreso {
  readonly id: string;
  readonly numero: string;
  readonly titulo: string;
  readonly detalle: string;
  readonly estado: EstadoPaso;
}

/** Navegación fija entre las secciones (todas viven en la misma página y conservan estado). */
export function ProgresoPasos({
  pasos,
  activoId,
  onNavegar,
}: {
  readonly pasos: readonly PasoProgreso[];
  readonly activoId?: string;
  readonly onNavegar?: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Pasos del asistente"
      className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur"
    >
      <ol className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2">
        {pasos.map((paso) => (
          <li key={paso.id} className="min-w-[8.5rem] flex-1">
            <a
              href={`#${paso.id}`}
              aria-current={paso.id === activoId ? 'step' : undefined}
              onClick={() => onNavegar?.(paso.id)}
              className={`flex h-full items-start gap-2 rounded-lg border px-2 py-1.5 hover:bg-slate-50 ${
                paso.id === activoId
                  ? 'border-marca-300 bg-marca-50'
                  : 'border-transparent hover:border-slate-200'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${CLASE_ESTADO_PASO[paso.estado]}`}
              >
                {paso.numero}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-marca-950">{paso.titulo}</span>
                <span className="block text-[11px] text-slate-500">
                  {ETIQUETA_ESTADO_PASO[paso.estado]}
                </span>
                <span className="sr-only">{paso.detalle}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Clases compartidas para los campos nativos (selects/inputs) de las pantallas. */
export const CLASE_CAMPO =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-marca-500 focus:ring-2 focus:ring-marca-200 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500';
