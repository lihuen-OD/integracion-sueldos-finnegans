// Destinos bancarios soportados (D-012): uno por banco, cada uno con su propio TXT y su
// propia readiness (D-032).
export type Destino = 'BNA_GT_HABERES' | 'PATAGONIA_B2';

export const DESTINOS = ['BNA_GT_HABERES', 'PATAGONIA_B2'] as const satisfies readonly Destino[];

/** Texto de la columna `Banco` de Finnegans asociado a un destino (docs/03 §D.1). */
export interface BancoCatalogado {
  readonly textoFinnegans: string;
  readonly destino: Destino;
  /** Código de entidad esperado para el control de compatibilidad (§E.2 regla 12). */
  readonly entidadEsperada: string;
  readonly fuente: string;
}

/** Catálogo cerrado aprobado (D-012, D-049). El perfil de empresa podrá ampliarlo en F3. */
export const CATALOGO_BANCOS: readonly BancoCatalogado[] = [
  {
    textoFinnegans: 'BANCO DE LA NACION ARGENTINA',
    destino: 'BNA_GT_HABERES',
    entidadEsperada: '011',
    fuente: 'D-012; entidad: BNA p.11 ("Entidad: 011 Banco Nación")',
  },
  {
    textoFinnegans: 'BANCO PATAGONIA S.A.',
    destino: 'PATAGONIA_B2',
    entidadEsperada: '034',
    fuente: 'D-012; entidad: PAT-DR p.8 (código de banco fijo 034)',
  },
];

export type ClasificacionBanco =
  /** Vacío o compuesto solo por espacios U+0020 (N-04, D-049): el operador elige el destino. */
  | { readonly tipo: 'VACIO' }
  | { readonly tipo: 'CATALOGADO'; readonly banco: BancoCatalogado }
  /** Texto fuera del catálogo o celda ilegible: falla de forma segura, nunca se adivina. */
  | { readonly tipo: 'NO_SOPORTADO' };

/**
 * Clasifica el texto de `Banco` con coincidencia **exacta** contra el catálogo cerrado, sin
 * mayúsculas/minúsculas, trim ni fuzzy matching (D-049). `null` = celda ilegible.
 */
export function clasificarBanco(
  texto: string | null,
  catalogo: readonly BancoCatalogado[] = CATALOGO_BANCOS,
): ClasificacionBanco {
  if (texto === null) {
    return { tipo: 'NO_SOPORTADO' };
  }
  if (/^ *$/.test(texto)) {
    return { tipo: 'VACIO' };
  }
  const banco = catalogo.find((entrada) => entrada.textoFinnegans === texto);
  return banco === undefined ? { tipo: 'NO_SOPORTADO' } : { tipo: 'CATALOGADO', banco };
}
