// Destinos bancarios soportados (D-012): uno por banco, cada uno con su propio TXT y su
// propia readiness (D-032).
export type Destino = 'BNA_GT_HABERES' | 'PATAGONIA_B2';

export const DESTINOS = ['BNA_GT_HABERES', 'PATAGONIA_B2'] as const satisfies readonly Destino[];
