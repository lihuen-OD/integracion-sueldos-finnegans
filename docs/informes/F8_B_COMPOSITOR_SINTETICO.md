# CP-F8-B · Compositor sintético browser-safe

**Rama:** `f7-homologacion`
**Base:** `a86bf32`
**Alcance:** extracción y reutilización de composición sintética; sin UI, descarga ni generación
productiva.

## Cambio de D-093

D-093 se modifica solo para permitir un compositor sintético cerrado dentro de `src/run`. La
prohibición original de conectar el harness a la aplicación se conserva para datos operativos: el
módulo no recibe `EstadoCorrida`, `ResultadoConciliacion`, archivos, perfiles empresariales,
empleados, pagos, CUIL, CBU ni parámetros externos. React puede importarlo únicamente con una de
las variantes enumeradas por el propio módulo.

No cambian las fachadas `generarBna`/`generarPatagonia`, los contratos bancarios, specs, mappers,
serializadores, inspectores ni compuertas. No se habilita producción ni homologación.

## API pública

- `componerBnaHomologacionSintetica(variante: VarianteBnaSintetica)`
- `componerPatagoniaHomologacionSintetica(variante: VariantePatagoniaSintetica)`
- `VARIANTES_BNA` y `VARIANTES_PATAGONIA`, congeladas en runtime.

Cada función exige exactamente un string de la unión cerrada. Ausencia de argumento, objetos,
argumentos extra o strings desconocidos devuelven rechazo antes de construir datos. El éxito
devuelve bytes en memoria, totales e inspección, siempre con `productivo: false` y
`homologado: false`.

## Aislamiento

- Datos ficticios generados dentro de un catálogo inmutable del módulo.
- Cero imports `node:*`, `tests/**`, `scripts/**`, UI, exportación o XLSX en el grafo browser.
- Cero API de archivo, ruta, `Blob`, persistencia o red.
- Las compuertas BNA y Patagonia deben continuar en `false`; una apertura hace fallar la
  composición.
- D1-B mantiene la confirmación humana, los nombres actuales y su escritura `wx` confinada.

## Identidad

La comparación directa compositor ↔ plan D1-B es byte a byte. También se fijan las huellas previas
de D1-A:

| Banco | Bytes | SHA-256 |
|---|---:|---|
| BNA | 803 | `b72a7e942249a75298bb6041e96b7b4d6505775d22a21f23e600adff40b426de` |
| Patagonia | 803 | `004140b216b76fc56b7a08ac3edde1524df8e7dd8f860ed7fbabed0ddd671a4d` |

## Verificación

Las pruebas cubren variantes válidas/negativas, aridad y tipos runtime, identidad directa de bytes,
huellas, compuertas, aislamiento de las fachadas productivas y build ESM browser-safe en memoria.
El build inspecciona todos los módulos incluidos y falla si aparece `node:*`, `tests/**` o
`scripts/**`.
