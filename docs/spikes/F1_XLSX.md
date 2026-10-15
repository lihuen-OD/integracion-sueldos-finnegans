# Spike F1 · Librería XLSX (ExcelJS candidato)

**Fecha:** 15-10-2026 · **Rama:** `f1-base-tecnica` · **Decisión
relacionada:** D-007, D-038 · **Estado:** spike técnico superado;
recomendación **EXCELJS APROBADO** con condiciones (§6), sujeta a
confirmación del usuario. T11 queda pendiente de verificación manual.

Este informe no contiene datos personales. Las pruebas usan fixtures
sintéticos; la única prueba con el archivo real (T10) se ejecutó solo en
el equipo local y produce únicamente agregados.

## 1. Objetivo y criterio

Demostrar que la base puede leer y escribir XLSX de forma correcta,
offline y privada, incluido el formato particular que exporta Finnegans
(Apache POI: celdas `inlineStr`, números como texto literal en `<v>` y
`<dimension ref="A1">` incorrecta).

Criterio aprobado: si ExcelJS supera T1–T10 se confirma D-007; si falla
T1, T2, T3 o T6 se aplica el plan B (lector propio con `fflate` +
`DOMParser`, y ExcelJS solo para escribir si supera T5).

## 2. Entorno

| Elemento | Versión |
|---|---|
| Sistema | macOS (darwin), equipo de desarrollo |
| Node.js | 24.18.0 |
| ExcelJS | 4.4.0 (bundle de navegador `dist/exceljs.min.js`) |
| fflate | 0.8.3 (guarda previa del zip) |
| Navegador e2e | Chromium headless shell 156 (Playwright 1.64.1) |

Vitest usa el **mismo bundle de navegador** de ExcelJS que Vite empaqueta
para producción (alias en `vitest.config.ts`), no la versión para Node.

## 3. Arquitectura probada

-   `src/import/xlsx/` es el único directorio que importa ExcelJS
    (regla de ESLint con test).
-   Contrato propio (`types.ts`): celdas `text`, `number`, `boolean`,
    `date`, `formula`, `error`, `merged`, `unsupported`.
-   Los números se entregan como el **texto decimal mínimo de ida y
    vuelta** (`String(n)`); la conversión a centavos `bigint` queda para
    el dominio (F2). Las fórmulas nunca se evalúan.
-   `zipGuard.ts` (fflate) valida antes de ExcelJS: firma zip, cantidad
    de entradas, tamaños declarados y reales descomprimidos, y partes
    mínimas de un XLSX.
-   Escritura: todo valor como texto, formato Texto (`@`) por columna,
    validaciones de lista.

## 4. Resultados

| # | Prueba | Resultado | Evidencia |
|---|---|---|---|
| T1 | Dimensión `A1` incorrecta | **OK**: 161/161 filas y 14 columnas | `tests/spike/t01-t02-lectura-finnegans.test.ts` |
| T2 | Textos | **OK**: CUIL con guiones, legajos `0xx`, espacios finales y descripciones idénticos; ningún texto llega como número | ídem |
| T3 | Números | **OK**: 0 discrepancias en 100.000 importes aleatorios (0,01–999.999.999,99) escritos como decimal, formato Java/POI y notación científica; 14 casos límite; sin redondeo (3 decimales se conservan para que el dominio los rechace) | `tests/spike/t03-numeros.test.ts` |
| T4 | Tipos | **OK**: legajo y CBU numéricos detectables, fórmula sin evaluar, `sharedStrings`, celdas combinadas, filas vacías y hoja oculta | `tests/spike/t04-tipos-mezclados.test.ts` |
| T5 | Escritura | **OK**: 4 hojas; formato Texto (`numFmtId 49`) en `<col>` y celdas; lista `"1,2"`; sin fórmulas; propiedades sin usuario del sistema; relectura idéntica | `tests/spike/t05-escritura.test.ts` |
| T6 | Navegador | **OK**: lectura y escritura en Chromium contra el build con CSP (sin `unsafe-eval`), con la red cortada, sin pedidos externos, sin errores de consola y sin almacenamiento | `tests/e2e/xlsx-navegador.spec.ts` |
| T7 | Tamaño | **OK** con observación: chunk XLSX 939,22 kB (260,77 kB gzip), cargado de forma diferida al primer uso; app inicial 227,67 kB (71,96 kB gzip) | salida de `vite build`; e2e verifica la carga diferida |
| T8 | Rendimiento | **OK**: 300 filas en 27–38 ms; 5.000 filas en 136–152 ms (Node, bundle de navegador) | `tests/spike/t08-rendimiento.test.ts` |
| T9 | Robustez | **OK**: no-zip, zip sin libro, zip truncado, XML malformado, archivo grande, expansión excesiva, demasiadas entradas, filas y columnas → error controlado en menos de 2 s, sin contenido de celdas en el error | `tests/spike/t09-robustez.test.ts` |
| T10 | Archivo real (local) | **OK**: coincide con docs/03 §A (ver §5) | `tests/local/t10-archivo-real.test.ts` |
| T11 | Verificación manual en Excel | **PENDIENTE (usuario)** | ver §7 |

## 5. T10 · Resultado agregado del archivo real

Ejecutado localmente con
`T10_FINNEGANS_PATH=references/Finnegans_Reporte_Ejemplo.xlsx npm run spike:t10`.

| Dato | Valor | Esperado (docs/03 §A) |
|---|---|---|
| Zip | 9 entradas, 119.610 bytes descomprimidos | — |
| Lectura | 24 ms | — |
| Hojas | 1: `hoja1`, visible, 156 filas de datos, 14 columnas | igual |
| Encabezados | los 14 exactos | igual |
| Tipos | 8 columnas de texto (156 cada una; `Banco` 155) y 6 numéricas (156 cada una) | igual |
| CUIL con formato `99-99999999-9` | 156 | 156 |
| Legajo de 3 dígitos / con cero inicial | 156 / 50 | 156 / 50 |
| Espacios finales (apellido / nombre) | 9 / 12 | 9 / 12 |
| Banco | Nación 116 · Patagonia 39 · vacía 1 | igual |
| Descripción | Agrario 121 · Comercio 27 · Directivos 4 · Liq. Final 4 (2 variantes) | igual |
| `Transaccionsubtipoid` | `281` en 156 | igual |
| Importes (5 columnas) | 156/156 decimales estrictos (≤ 2 decimales), 0 negativos, 0 en notación científica | — |
| Neto | entero en 156; cero en 1 | igual |

## 6. Hallazgos

1.  **Texto vacío inline = celda ausente.** ExcelJS no devuelve la celda
    `<is><t></t></is>` (el `Banco` vacío del archivo real). En F2, celda
    ausente y texto vacío deben tratarse igual (fijado en T2 y T10).
2.  **POI puede escribir notación científica.** Java escribe los dobles
    ≥ 10.000.000 como `1.2345678E7`. El adaptador los entrega en decimal
    (`12345678`). La muestra real no tiene importes de ese tamaño, pero el
    caso está cubierto (T3).
3.  **Sin redondeo silencioso.** Un valor con 3 decimales o en notación
    científica (por ejemplo, un CBU guardado como número) llega tal cual,
    para que el dominio lo rechace.
4.  **Escritura segura.** Los textos que parecen fórmulas (`=1+1`) se
    escriben como texto; el formato Texto queda en `<col>` y en las
    celdas; las propiedades del documento no incluyen el usuario del
    sistema.
5.  **Bundle sin red ni eval.** El chunk XLSX no contiene
    `XMLHttpRequest`, `Worker`, `WebSocket`, `sendBeacon`, `eval` ni
    `new Function`. Las URLs embebidas son namespaces XML, mensajes de
    error y licencias (lista justificada en `scripts/check-dist.ts`).
    `postMessage`/`importScripts` aparecen solo en polyfills de
    planificación de tareas (core-js / setImmediate).
6.  **Celdas combinadas** se marcan como `merged` en la celda secundaria.

## 7. Riesgos y condiciones

| Riesgo | Evaluación | Mitigación / condición |
|---|---|---|
| Mantenimiento de ExcelJS: 4.4.0 es la última versión (2023) | Medio | Dependencia confinada a `src/import/xlsx/`; contrato propio; plan B documentado |
| `npm audit`: 2 moderadas por `uuid < 11.1.1` (GHSA-w5hq-g745-h8pq: falta de control de límites en v3/v5/v6 **con buffer**) | Bajo: ExcelJS solo usa `uuid.v4()` sin buffer (formato condicional) | La corrección propuesta (`npm audit fix --force`) degrada a ExcelJS 3.4.0: **no se aplica**. Reevaluar en cada actualización |
| Dependencias transitivas deprecadas (inflight, rimraf 2, glob 7, fstream, uuid 8) | Bajo para el navegador: son de la versión Node de ExcelJS | Revisar en cada actualización |
| Tamaño del chunk (~940 kB) | Bajo: local y diferido | Umbral de advertencia justificado en `vite.config.ts` |
| La guarda descomprime todo con fflate para medir tamaños reales | Bajo: memoria acotada por los tamaños declarados y el límite total | Límites por defecto: 20 MB comprimido, 100 MB descomprimido, 500 entradas |
| Ambigüedad zip (directorio central vs. entradas locales) | Residual | Los archivos de entrada son exportaciones conocidas (Finnegans, maestro propio) |
| El bundle de ExcelJS incluye polyfills de core-js | Bajo | Los e2e no muestran errores ni violaciones de CSP |

**Condiciones de la recomendación:** mantener la guarda `zipGuard`, el
alias al bundle de navegador en Vitest, la regla de ESLint que confina
ExcelJS y la revisión de `check:dist` y `npm audit` en cada
actualización de dependencias.

## 8. T11 · Verificación manual pendiente

1.  `npm run build && npm run preview` y abrir `http://127.0.0.1:4173`.
2.  Pulsar **Descargar plantilla de prueba (T11)**.
3.  Abrir `plantilla_prueba_spike_F1.xlsx` en Excel y verificar:
    -   en `Empleados`, escribir `007` en `LEGAJO` y 22 dígitos en `CBU`
        en una fila vacía: deben quedar como texto, sin perder ceros ni
        dígitos ni pasar a notación científica;
    -   `PAT_TIPO_CUENTA` ofrece una lista desplegable con `1` y `2` y
        rechaza otros valores;
    -   la fila con `=1+1` se ve como texto, no como el resultado `2`;
    -   la hoja `Control` está oculta.

No cargar datos reales en esa plantilla.

## 9. Recomendación

**EXCELJS APROBADO** como implementación del adaptador XLSX de
`src/import/xlsx/`, con las condiciones de §7. El plan B no fue
necesario. La confirmación final de D-007 corresponde al usuario, junto
con el resultado de T11.
