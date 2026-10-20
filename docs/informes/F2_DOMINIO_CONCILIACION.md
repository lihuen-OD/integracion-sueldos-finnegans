# Informe F2 · Dominio, parsers, conciliación y readiness

**Fecha:** 20-10-2026 · **Rama:** `f2-dominio-conciliacion` (local, sin
remoto), **integrada en `main`** con el merge
`ba7eceda48aa115761327df3d690c8fc20360797` · **Decisiones:** D-044 a
D-057 · **Estado:** **F2 cerrada**; implementación completa con la
corrección final (D-056, D-057, P-29 resuelta).

Este informe no contiene datos personales. Los resultados con el archivo
real son agregados (conteos y booleanos), sin importes.

## 1. Alcance

**Implementado:** dominio (`Cuil` con N-02 estricta, `Cbu`, `Centavos`
bigint, incidencias, `PayrollLine`, `MasterRecord`, catálogos con
fuente); parser Finnegans; plantilla del maestro vacía y prellenada;
parser del maestro; cruce por CUIL con legajo exacto; reglas de docs/03
§E.2 aprobadas; decisiones del operador; conciliación global con
invariantes; readiness independiente BNA / Patagonia; integración,
volumen y pruebas locales opt-in; herramienta de análisis de
`Descripcion` (solo análisis).

**No implementado (por decisión):** TXT, `FieldSpec`/`RecordSpec`,
layouts bancarios, máximo de importe por layout (F5/F6), mapeo de
liquidaciones y extracción de período/tipo (P-09, P-10), regla 18
(P-28), nombre Patagonia (F6), perfil de empresa, `CivilDate`,
parámetros de envío y UI (F3).

## 2. Estructura

``` text
src/shared/          brand.ts · result.ts
src/domain/          money · cuil · cbu · destino · incidencias · liquidacion · maestro
src/import/          comun.ts · huella.ts · finnegans/parseFinnegans.ts
                     master/{contrato, plantillaMaestro, parseMaestro}.ts
src/reconciliation/  tipos · incidencia · alcance · decisiones · conciliar · totales · readiness · index
                     reglas/{estado, pago, cruce, maestro, contexto}.ts
tests/unit/          domain/ · import/ · reconciliation/ · fixtures/
tests/integration/   conciliacion.integracion.test.ts
tests/local/         f2-conciliacion-real · f2-descripcion-variantes (opt-in, npm run local:f2)
```

Contratos finales: docs/03 §H (fuente de verdad: `src/domain` y
`src/reconciliation/tipos.ts`, `totales.ts`, `readiness.ts`).

## 3. Matriz regla → incidencia → nivel → alcance → test

Abreviaturas de tests: `R` = `tests/unit/reconciliation/reglas.test.ts`,
`D` = `decisiones.test.ts`, `G` = `global.test.ts`, `RD` =
`readiness.test.ts`, `PF` = `tests/unit/import/finnegans.test.ts`, `PM`
= `maestro.test.ts`, `I` = `tests/integration/…`. "Destino" = alcance del
banco de la fila; global si la fila no tiene destino o está excluida.

| Regla (docs/03) | Incidencia | Nivel | Alcance | Tests |
|---|---|---|---|---|
| §A.3 hoja/encabezados | `ESTRUCTURA_INVALIDA` | BLOQUEANTE | Global | PF «estructura» |
| §A.3 hoja oculta (D-054) | `HOJA_FINNEGANS_OCULTA` | INFORMACION | Global | PF «hoja oculta…» |
| §A.3/§B.3 columna extra | `COLUMNA_DESCONOCIDA` | INFORMACION | Global | PF, PM «estructura» |
| §A.3 fórmula en columna usada / no usada | `FORMULA_EN_CELDA` | BLOQUEANTE / INFORMACION | Global | PF «importes» |
| §B.3 fórmula en el maestro | `FORMULA_EN_CELDA` (CUIL/LEGAJO) o campo `INVALIDO` | según D-048 | Registro → destino | PM, R regla 13 |
| D-050 `Cuil`/`Legajo` numérico | `CELDA_NUMERICA_EN_TEXTO` | BLOQUEANTE | Destino / registro | PF, PM, R regla 9 |
| Tipos de celda no admitidos | `TIPO_CELDA_INVALIDO` | BLOQUEANTE (Banco, Descripcion) / INFORMACION (nombres) | Destino | PF «Banco y Descripcion» |
| Filas vacías | `FILAS_VACIAS_IGNORADAS` | INFORMACION | Global | PF, PM |
| D-051 Control / versión | `VERSION_MAESTRO_NO_SOPORTADA` | BLOQUEANTE | Global | PM «hoja Control» |
| §B.1 LEGAJO vacío en el maestro | `CAMPO_REQUERIDO_FALTANTE` | BLOQUEANTE | Registro → destino | PM, R regla 9 |
| 1 CUIL inválido (N-02 D-052, DV) | `CUIL_INVALIDO` | BLOQUEANTE | Destino (global sin destino o excluida, P-25) | `cuil.test.ts`, PF, PM, R reglas 1 y 2 |
| 2 CUIL repetido en Finnegans | `CUIL_REPETIDO_FINNEGANS` | BLOQUEANTE | Destino de cada fila | PF, R reglas 1 y 2 |
| 3 CUIL/LEGAJO repetido en el maestro | `CUIL_REPETIDO_MAESTRO`, `LEGAJO_REPETIDO_MAESTRO` | BLOQUEANTE si lo usa una fila con pago; INFORMACION si no | Destino / global | PM «duplicados», R regla 3 |
| 4 Neto = 0 | `NETO_CERO` → EXCLUIDA | INFORMACION | Global | R regla 4, G |
| 5 Importe no interpretable | `IMPORTE_INVALIDO` | BLOQUEANTE | Global (Neto) / destino (componentes) | `money.test.ts`, PF, G |
| 6 Neto negativo | `NETO_NEGATIVO` | BLOQUEANTE | Destino | R regla 6, RD |
| 6 máximo por layout | — | — | — | **Diferido a F5/F6** (D-047) |
| 7 Sin maestro | `SIN_MAESTRO` | BLOQUEANTE | Destino | R regla 7, RD, I |
| 8 Maestro sin liquidación | `MAESTRO_SIN_LIQUIDACION` | INFORMACION | Global | R regla 8 |
| 9 Legajo exacto (D-017, D-053) | `LEGAJO_NO_COINCIDE` | REQUIERE_REVISION | Destino | R regla 9, D, RD |
| 10 Banco vacío | `BANCO_VACIO` → PENDIENTE | REQUIERE_REVISION | Global | R reglas 10 y 11, D, G, I |
| 11 Banco no soportado | `BANCO_NO_SOPORTADO` → PENDIENTE | BLOQUEANTE | Global | R reglas 10 y 11, G |
| 12 Banco incompatible (D-018 modificada por D-056) | `BANCO_INCOMPATIBLE_MAESTRO` | BLOQUEANTE: CBU en BNA, `PAT_CODIGO_BANCO` en Patagonia, destino sin catálogo · INFORMACION: CBU de otra entidad en Patagonia | Destino | R regla 12, D, I |
| 13 Datos del destino (D-048 corregida por D-056) | `CBU_FALTANTE`/`CBU_INVALIDO`/`DATO_PATAGONIA_*` | BLOQUEANTE si el destino lo consume (BNA: CBU; Patagonia: PAT_*); INFORMACION si es del otro banco (PAT_* en BNA, CBU en Patagonia) | Destino | R regla 13 (incluida la simetría), RD, I |
| §G.3 readiness (D-057) | estados de `BankReadiness` | conciliación global no cerrada antes que `SIN_REGISTROS` | Por banco | RD «P-29.10» casos A–D |
| 14 Liquidación sin mapeo (D-026) | `LIQUIDACION_SIN_MAPEO` | BLOQUEANTE | Destino | R regla 14, RD, I |
| 15–16 Nombre Patagonia | — | — | — | **Diferidas a F6** |
| 17 Componentes del neto | `NETO_NO_CUADRA_COMPONENTES` | REQUIERE_REVISION | Destino | R reglas 17 y 19, D |
| 18 Documento vs CUIL | — | — | — | **Diferida** (P-28) |
| 19 Legajoapellidonombre | `LEGAJO_NOMBRE_INCONSISTENTE` | INFORMACION | Destino | R reglas 17 y 19 |
| §E.3 decisión no vigente | `DECISION_NO_APLICADA` | INFORMACION | Global | D |
| Registros del maestro sin evaluar | campo inválido | INFORMACION | Global | R «registros del maestro no evaluados» |

## 4. Resultados

### 4.1 Espejo sintético de la muestra (156 filas, producción)

| Concepto | Resultado |
|---|---|
| Estados | 116 BNA · 38 Patagonia · 1 excluida · 1 pendiente |
| Incidencias | `LIQUIDACION_SIN_MAPEO` 116 (BNA) + 38 (Patagonia) · `BANCO_VACIO` 1 · `NETO_CERO` 1 |
| Global | `PENDIENTE` (fila pendiente y revisión global); invariantes de cantidad e importe: verdaderos |
| Totales sintéticos | Finnegans = BNA + Patagonia + excluidas + pendientes (exacto en centavos) |
| Readiness | BNA y Patagonia `BLOQUEADO_POR_CONCILIACION_GLOBAL` |
| Con la pendiente asignada | Global `CERRADA`; ambos `BLOQUEADO` (sin mapeos de liquidación) |
| Con dobles de mapeo y generador | ambos `LISTO_PARA_GENERAR`, `pendienteHomologacion: true` |

### 4.2 Volumen (sintético, Node, bundle de navegador de ExcelJS)

| Escenario | Estados | Lectura XLSX | Parsers | Conciliación + readiness |
|---|---|---|---|---|
| 300 filas | 220 BNA · 73 Patagonia · 4 excluidas · 3 pendientes | ~28 ms | ~2 ms | ~2 ms |
| 5.000 filas | 3.669 BNA · 1.222 Patagonia · 57 excluidas · 52 pendientes | ~160 ms | ~30 ms | ~15 ms |

En ambos, estados idénticos al oráculo independiente e invariantes de
cantidad e importe verdaderos.

### 4.3 Independencia BNA / Patagonia

Con dobles de mapeo y generador: un empleado de Patagonia sin número de
cuenta deja Patagonia `BLOQUEADO` y BNA `LISTO_PARA_GENERAR`; un empleado
de BNA sin CBU deja BNA `BLOQUEADO` y Patagonia `LISTO_PARA_GENERAR`; un
empleado de BNA con `PAT_TIPO_CUENTA` inválido solo se informa
(`DATO_PATAGONIA_INVALIDO` INFORMACION) y BNA sigue `LISTO_PARA_GENERAR`;
simétricamente (D-056), un empleado de Patagonia con CBU inválido o con un
CBU válido de otra entidad solo se informa y Patagonia sigue
`LISTO_PARA_GENERAR`. Una fila con pago y sin destino bloquea ambos
(P-24), también al banco que todavía no tiene filas (D-057).

### 4.4 Archivo real (local, opt-in, solo agregados)

Con un maestro prellenado en memoria desde la misma liquidación (no existe
todavía un maestro real): 156 filas, 156 CUIL válidos con la N-02
estricta, 0 hallazgos del parser, 156 filas prellenadas, 0 hallazgos del
maestro, 156 CUIL canónicos coincidentes, 155 filas cruzadas con legajo
exacto. La única fila sin cruzar es la `EXCLUIDA:NETO_CERO` (D-034; la
prueba lo verifica con un conteo de filas no cruzadas por estado); la
pendiente sí queda cruzada. Estados: 116 BNA · 38 Patagonia · 1
excluida · 1 pendiente = 156. Invariantes de cantidad e importe:
verdaderos.
Faltan, como se espera sin datos bancarios, `CBU_FALTANTE` (116) y
`DATO_PATAGONIA_FALTANTE` (38 × 7 campos).

### 4.5 Variantes de `Descripcion` (herramienta de análisis, D-051)

Un solo archivo disponible (un solo mes). Variantes exactas: `"JULIO
Agrario"` 121 · `"JULIO Comercio "` 27 · `"JULIO Directivos"` 4 · `"JULIO
Liq Final"` 3 · `"JULIO Liq final "` 1. Ninguna omitida por posible dato
personal. **No se derivó ninguna regla**: para P-10 hacen falta
exportaciones de otros meses.

## 5. Interpretaciones de implementación (P-29, resuelta el 20-10-2026)

| # | Comportamiento | Estado | Tests |
|---|---|---|---|
| P-29.1 | Neto cero: `EXCLUIDA(NETO_CERO)`, sin maestro ni datos bancarios; solo la identificación (CUIL inválido o repetido) conserva su nivel, con alcance global; el resto se informa | Aprobada | R «regla 4» (incluido CUIL repetido en fila excluida) |
| P-29.2 | Reglas de banco solo con destino determinado; en filas pendientes, solo identificación y duplicados del maestro, con alcance global | Aprobada | R «reglas 10 y 11», «regla 3»; D |
| P-29.3 | Decisiones atadas a la SHA-256 de los archivos que observaron; si cambian → `DATOS_CAMBIARON` | Aprobada | D; I |
| P-29.4 | Dos o más decisiones para la misma incidencia → ninguna (`DECISIONES_EN_CONFLICTO`) | Aprobada | D «conflictos y pureza» |
| P-29.5 | El id incluye código, alcance, referencias y campo: una confirmación bajo el destino A no se reutiliza con el destino B (`INCIDENCIA_INEXISTENTE`, trazada) | Aprobada | D «P-29.5» (de punta a punta) |
| P-29.6 | Neto ilegible: no se convierte a cero ni se excluye; destino textual si existe; importes de Finnegans y del banco null; global `BLOQUEADA` (`IMPORTE_NO_CALCULABLE`); cantidades conciliadas | Aprobada | R «regla 4»; G |
| P-29.7 | CBU en Patagonia: ya no se consume (inválido o de otra entidad → INFORMACION) | **Modificada → D-056** | R «regla 12», «regla 13» (simetría); I |
| P-29.8 | Destino sin entrada en el catálogo → BLOQUEANTE `DESTINO_SIN_CATALOGO` | Aprobada | R «regla 12»; D |
| P-29.9 | `LIQUIDACION_SIN_MAPEO` por fila en el dominio; agrupar es tarea de la UI (F3) | Aprobada | R «regla 14»; RD; I |
| P-29.10 | La conciliación global no cerrada precede a `SIN_REGISTROS` | **Modificada → D-057** | RD «P-29.10» casos A–D |
| P-29.11 | Registros del maestro no consumidos por un destino: campos inválidos → INFORMACION global | Aprobada | R «registros del maestro no evaluados» |
| P-29.12 | CUIL duplicado en el maestro: nunca se elige; BLOQUEANTE si participa de un pago, INFORMACION si no | Aprobada | R «regla 3» |
| P-29.13 | Celda `Banco` no textual: `TIPO_CELDA_INVALIDO` + no soportado, ambos con el mismo efecto (bloqueo global); nunca se infiere ni se convierte a texto (tampoco el valor en caché de una fórmula) | Aprobada | R «reglas 10 y 11» |
| P-29.14 | Destino asignado por el operador: la regla 12 usa la entidad del catálogo para ese destino; sin entrada → P-29.8 | Aprobada | D «ASIGNAR_DESTINO» |

## 5.1 Corrección final (D-056, D-057)

-   **D-056** (modifica D-018 y corrige D-048): el CBU pertenece solo al
    flujo BNA. En la tabla de consumo, el CBU pasa a "no consumido" para
    Patagonia. La regla 12 usa esa tabla: el CBU de otra entidad bloquea
    BNA pero solo informa en Patagonia; `PAT_CODIGO_BANCO` bloquea
    Patagonia y no se compara para BNA.
-   **D-057** (modifica el orden de §G.3): la conciliación global no
    cerrada se evalúa antes que `SIN_REGISTROS`.

## 6. Riesgos abiertos

-   P-18: los DV de CUIL y CBU siguen docs/04 §5 sin fuente oficial en
    `references/`. El CUIL quedó validado con datos reales (156/156); el
    CBU solo con sintéticos (no hay maestro real).
-   Toda liquidación queda bloqueada por `LIQUIDACION_SIN_MAPEO` hasta
    resolver P-09 y P-10.
-   R-001 a R-005 (docs/07 §6) siguen vigentes.

## 7. Pendientes documentados

P-03, P-04, P-05, P-08, P-09, P-10, P-14, P-17, P-18, P-19, P-20, P-21,
P-22, P-23 y P-28 (docs/07 §2.2). P-29 quedó resuelta.
