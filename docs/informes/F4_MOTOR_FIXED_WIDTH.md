# F4 · Motor fixed-width genérico

**Estado:** CP-F4-A, CP-F4-B y CP-F4-C ejecutados en la rama
`f4-motor-fixed-width`, sin merge a `main`. F4 **no está cerrada**: queda
la auditoría humana final. La aplicación sigue **NO apta para pagos
reales** hasta la homologación bancaria (F7).

## 1. Objetivo

Entregar las primitivas genéricas de archivos de ancho fijo —serialización,
parseo, identificación, estructura, inspección y aptitud— sin conocimiento
de bancos, con specs exclusivamente sintéticas y un harness de invariantes
reutilizable por F5/F6 (D-077).

## 2. Alcance

-   Motor en `src/banks/fixed-width/`, sin ids, nombres, códigos,
    posiciones ni catálogos de BNA o Patagonia (D-068).
-   Contratos de `FieldSpec`, `RecordSpec`, `EstructuraArchivo` y
    `FileSpec` congelados en docs/02 (D-068 a D-077).
-   Serializer y parser de registro; identificación por discriminadores;
    validación estática de specs y estructura; runtime de estructura;
    serializer y parser de archivo; `rutaRepeticiones`; inspector;
    `hallarBloqueosGeneracion`; guardrails y cobertura.
-   Sin UI, red, persistencia, telemetría, descargas ni lógica bancaria.

## 3. Commits de F4

| Commit    | Contenido                                                           |
| --------- | ------------------------------------------------------------------- |
| `5022697` | Contratos y validación de specs (T4-1, T4-3)                        |
| `4f09f5b` | Serializer y parser de registro (T4-4, T4-5)                        |
| `7a8c9b2` | Invariantes y round-trip (T4-5, T4-6)                               |
| `e27d7e3` | Corrección de propiedades R-T2 y R-T3                               |
| `831da21` | Robustecimiento del parser y de la validación de specs              |
| `b006fb2` | Sincronización documental de errores técnicos (auditoría CP-F4-B)   |
| `863e11c` | Precondición `SPEC_INVALIDA` precisada (cierre documental CP-F4-B)  |
| `d18cdf5` | Estructura runtime y serialización de archivos (T4-7)               |
| `4439e73` | Parser e inspector de archivos (T4-8, T4-9)                         |
| `a4d931c` | Aptitud y guardrails (T4-10, T4-11)                                 |
| `70847e7` | Simplificación de defensas sin ramas alcanzables                    |
| `2f5f1dd` | Matriz de pruebas y cobertura F4 (T4-11, T4-12)                     |

El cierre documental (este informe, docs/02, docs/05 y docs/06) se
registra en el commit posterior de la misma rama.

## 4. Contratos

-   `FieldSpec`: `id`, `name`, `start`/`end` 1-based inclusivos en bytes,
    `declaredLength`, tipo `N`/`A`, relleno `ZERO_LEFT`/`SPACE_RIGHT`,
    `fixedValue?` y `status`.
-   `RecordSpec`: `id` opaco, `recordLength` entero >= 1 y campos con
    cobertura exacta 1..`recordLength` en orden (D-069).
-   `EstructuraArchivo`: `registro`, `secuencia` y `repeticion` con `min`
    entero >= 1; sin `max`, sin `min: 0`, sin DSL (D-070).
-   `FileSpec`: `id` opaco, records, charset `ASCII_PRINTABLE`,
    `lineSeparator` (`\n`/`\r\n`), `trailingSeparator` booleano y
    estructura tipada.
-   `ContractStatus` no participa de la validez técnica ni del motor; solo
    lo interpreta `hallarBloqueosGeneracion` (D-075).

## 5. Arquitectura

```text
src/banks/fixed-width/
  ascii.ts             codec ASCII printable 0x20–0x7E
  tipos.ts             contratos del motor
  validacion.ts        validación técnica de Field/Record/FileSpec
  estructura.ts        POSIBLES, FIRST y no ambigüedad estática
  identificacion.ts    identificación por longitud + discriminadores
  serializer.ts        serializer de UN registro
  parser.ts            parser RAW de UN registro
  estructuraRuntime.ts ejecución determinista + rutaRepeticiones
  serializerArchivo.ts archivo completo (estructura/separadores/trailing)
  parserArchivo.ts     archivo completo (escáner/líneas/estructura)
  inspector.ts         observación estructural sin serializer
  aptitud.ts           bloqueos contractuales de generación
  index.ts             API pública
```

La validación técnica es independiente del estado contractual: un
elemento `BLOQUEADA` sigue siendo serializable/parseable; la decisión
productiva queda en la capa superior (D-075).

## 6. Serializer y parser de registro

-   **Serializer:** valida el `RecordSpec`; los `fixedValue` los escribe la
    spec (recibirlos como entrada es `VALOR_EN_CAMPO_FIJO`). `N` exige
    dígitos ASCII y relleno `ZERO_LEFT`; `A` admite ASCII printable y
    relleno `SPACE_RIGHT`; vacío en `N` es error; overflow es error y
    nunca se trunca; claves desconocidas y faltantes se informan.
-   **Parser RAW:** observa bytes, sin `trim`, sin `parseInt`/`Number`, sin
    quitar ceros (`02` sigue `02`, `0000` sigue `0000`) ni espacios
    interiores/finales. Cada campo se entrega como slice de ancho completo
    y copia independiente del buffer de entrada. Los `fixedValue` se
    comparan byte a byte. Los errores llevan campo y posición 1-based, sin
    contenido del registro.
-   **Independencia:** serializer y parser no comparten lógica de
    serialización/parseo; solo tipos, `Result`, codec ASCII y validación de
    spec.

## 7. Identificación

Orden congelado (D-070): filtrar por `recordLength`; comparar todos los
`fixedValue` byte a byte; 0 coincidencias → `REGISTRO_DESCONOCIDO`; 1 →
registro identificado; >1 → `REGISTRO_AMBIGUO`.

`REGISTRO_AMBIGUO` es una defensa en profundidad: con una `FileSpec`
técnicamente válida, `validarFileSpec` rechaza antes los pares ambiguos con
`DISCRIMINADOR_AMBIGUO`. El parser de archivo devuelve `SPEC_INVALIDA` sin
llegar a esa defensa; la primitiva de identificación y el runtime conservan
sus pruebas directas. No se debilitó `SPEC_INVALIDA` para hacer alcanzable
un error defensivo.

## 8. Estructura estática

`validarEstructura` recorre la estructura y reporta ids inexistentes,
secuencias vacías, `min` inválido, registros no alcanzables y
`ESTRUCTURA_AMBIGUA`. La condición es
`POSIBLES(parte) ∩ FOLLOW(repeticion) = ∅` para toda repetición (D-070).
También se validan los discriminadores de todo registro alcanzado
(`REGISTRO_SIN_DISCRIMINADOR`) y los pares de igual longitud
(`DISCRIMINADOR_AMBIGUO`): longitudes distintas no se comparan; una
posición restringida por un solo registro es wildcard, no conflicto.

## 9. Estructura runtime

`ejecutarEstructura` recorre la gramática ya validada:

-   `registro`: consume exactamente el id esperado;
-   `secuencia`: consume sus partes en orden;
-   `repeticion`: mientras el id pertenezca a `POSIBLES(parte)` itera; si
    pertenece al FOLLOW cierra (solo si cumplió `min`); si no pertenece a
    ninguno, `ORDEN_INVALIDO`.

No hay backtracking, heurística, `continue-wins` ni `close-wins`. Si un id
pertenece simultáneamente a la parte y al FOLLOW (spec no validada), se
reporta `ESTRUCTURA_AMBIGUA` como defensa. Al terminar, los items
sobrantes producen `LINEA_DEMASIADO`.

## 10. Serializer de archivo

`serializarArchivo(spec, entradas)` recibe solo `recordId` +
`ValoresPorCampo`. Exige `FileSpec` técnicamente válido y corta con
`SPEC_INVALIDA` antes de mirar datos. Valida los ids de entrada, **ejecuta
realmente la estructura** (no acepta una lista arbitraria), reutiliza
`serializarRegistro`, inserta exactamente `lineSeparator.value` y respeta
`trailingSeparator.value`. La salida es determinista y no comparte buffers
con la entrada.

Errores: `REGISTRO_INEXISTENTE_EN_ESTRUCTURA`, `ORDEN_INVALIDO`,
`REPETICION_INCOMPLETA`, `REGISTRO_FALTANTE`, `LINEA_DEMASIADO`,
`ESTRUCTURA_AMBIGUA` y los errores de campo propagados, con línea de
entrada 1-based cuando corresponde.

## 11. Parser de archivo

Fases deterministas:

1. `validarFileSpec` → `SPEC_INVALIDA` sin procesar bytes;
2. archivo vacío → `ARCHIVO_VACIO`;
3. escáner byte a byte: BOM (`BOM_DETECTADO`), separador alternativo por
    ocurrencia (`SEPARADOR_MIXTO`), línea vacía (`LINEA_VACIA`) y
    separador final (`SEPARADOR_FINAL_INVALIDO`);
4. por línea: longitud (`LONGITUD_LINEA_INVALIDA`), identificación
    (`REGISTRO_DESCONOCIDO`/`REGISTRO_AMBIGUO`) y `parsearRegistro`;
5. ejecución estructural única que asigna `rutaRepeticiones`.

El escáner y la fase por línea se detienen en el primer problema; los
errores incluyen línea y offset técnicos. El parser no normaliza nada y no
comparte buffers mutables con el llamador.

## 12. `rutaRepeticiones`

Contrato: `readonly number[]`, contadores 1-based, exterior → interior.

-   fuera de repetición: `[]`;
-   primera iteración: `[1]`;
-   segunda: `[2]`;
-   tercera exterior con segunda interior: `[3, 2]`.

El contador interior se reinicia al comenzar cada iteración exterior. La
evidencia explícita está en `tests/unit/banks/fixed-width/parserArchivo.test.ts`
(caso `[3, 2]`) y en la prueba directa de `0 (1 2+)+` de
`estructuraRuntime.test.ts`.

## 13. Inspector

`inspeccionarArchivo` exige `FileSpec` válido, devuelve `SPEC_INVALIDA`
antes de mirar bytes y observa el archivo recibido: registros RAW, línea,
offset y `rutaRepeticiones`. No depende de `serializarArchivo` ni usa
round-trip como prueba de validez. Las pruebas construyen o mutan bytes a
mano para cubrir longitud, discriminador, charset, separadores, trailing y
orden.

R-T3 se mantiene honesta: una mutación dentro de un campo variable que
sigue cumpliendo alfabeto y longitud puede continuar siendo técnicamente
válida. No se inventan checksums ni reglas semánticas para detectarla.

## 14. Aptitud

`hallarBloqueosGeneracion` es el único componente de F4 que interpreta
`ContractStatus`. Informa, en orden determinista:

1. `lineSeparator` si está `BLOQUEADA`;
2. `trailingSeparator` si está `BLOQUEADA`;
3. cada campo `BLOQUEADA` por `recordId` + `campoId`, en orden de spec.

`INTERPRETACION_PENDIENTE` no bloquea técnicamente y no se informa.
`CONFIRMADA` tampoco. La función no muta la spec, no incluye datos de
empleados/importes y no implementa readiness bancario.

## 15. Guardrails

`eslint.guardrails.js` incorpora la frontera `guardrails/fixed-width`
(T4-11, D-076): `src/banks/fixed-width/**` solo puede depender de sí mismo y
de `src/shared`. Se prohíben UI/React, ExcelJS, `import/`,
`reconciliation/`, `export/`, bancos hermanos y nombres de bancos reales.
La restricción se prueba de forma automatizada en
`tests/guardrails/eslint-guardrails.test.ts`, incluida la no aplicación a
otros módulos de bancos.

## 16. Cobertura

Umbral integrado en `vitest.config.ts` dentro de `verify`:

```ts
'src/banks/fixed-width/**': {
  statements: 95,
  branches: 95,
  functions: 95,
  lines: 95,
}
```

Cobertura medida sobre `src/banks/fixed-width/**`:

| Métrica    | Cobertura |
| ---------- | --------- |
| Statements | 99.22 %   |
| Branches   | 95.71 %   |
| Functions  | 100 %     |
| Lines      | 99.18 %   |

No se excluyeron archivos ni ramas para alcanzar el umbral; las ramas
restantes son defensas inalcanzables con una `FileSpec` válida.

## 17. Tests

-   Motor fixed-width: **161 tests** en 11 archivos.
-   Guardrails ESLint: **67 tests**.
-   Suite completa (unitaria, guardrails, scripts, spike e integración):
    **802 tests** en 53 archivos.
-   E2E Playwright: **23 tests** en Chromium.

Las fixtures son exclusivamente sintéticas: ids neutrales (`H`, `D`, `C`,
`I`, `R0`…), longitudes pequeñas y ningún layout, posición, nombre de
archivo ni fecha bancaria.

## 18. Verify

`npm run verify` ejecutado de punta a punta:

-   `typecheck` (app + node): OK;
-   `lint` con `--max-warnings=0`: OK;
-   `format:check`: OK;
-   `check:sensitive`: OK, sin hallazgos;
-   `test:coverage`: 802 tests OK y umbrales por capa OK;
-   `build`: OK;
-   `check:dist`: OK;
-   `test:e2e`: 23/23 OK.

## 19. Límites deliberados

-   Sin padding `CUSTOM` (D-072).
-   Sin DSL de totales, cantidades, checksums ni loteo (D-073).
-   Sin restricciones de charset bancarias adicionales (D-074).
-   Sin catálogo de documentos, orígenes ni trazabilidad documental en el
    motor (D-068); eso es extensión de F5/F6.
-   Sin specs, layouts, posiciones, nombres de archivo, fechas ni reglas de
    liquidación de BNA o Patagonia.
-   Sin UI, descargas, backend, DB, red, persistencia ni telemetría.
-   Sin nueva dependencia npm.

## 20. Pendientes F5/F6/F7

-   **F5:** spec real BNA como datos con trazabilidad documental, mapper,
    validaciones y golden sintético; generación deshabilitada mientras
    BNA-1 siga bloqueado.
-   **F6:** spec real Patagonia, mapper, loteo, validaciones y golden
    sintético; generación deshabilitada mientras PAT-1/PAT-2 sigan
    bloqueados.
-   **F7:** homologación bancaria de las `B`/`I` de docs/04 y registro de
    respuestas.

## 21. Frontera y advertencia

F4 entrega un motor genérico probado, **no** un generador bancario. No hay
ninguna spec bancaria real implementada. F4 **no habilita pagos reales**:
la aptitud productiva depende de F5/F6/F7, de la homologación y de la
política de readiness de la capa superior. La rama permanece sin merge
hasta la auditoría humana final.
