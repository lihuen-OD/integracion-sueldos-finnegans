// Tipos nominales: un valor validado (CUIL, CBU, centavos) no se confunde con uno sin validar.
export type Brand<T, B extends string> = T & { readonly __brand: B };
