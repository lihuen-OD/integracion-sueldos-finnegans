# Informe F2 · Dominio, parsers, conciliación y readiness

**Fecha:** 20-10-2026 · **Rama:** `f2-dominio-conciliacion` (local, sin
remoto, **sin merge**) · **Decisiones:** D-044 a D-055 · **Estado:**
implementación completa; **checkpoint final pendiente de aprobación**.

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
| 12 Banco incompatible | `BANCO_INCOMPATIBLE_MAESTRO` | BLOQUEANTE | Destino | R regla 12, D |
| 13 Datos del destino (D-048) | `CBU_FALTANTE`/`CBU_INVALIDO`/`DATO_PATAGONIA_*` | BLOQUEANTE si el destino lo consume; INFORMACION si es del otro banco | Destino | R regla 13, RD, I |
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
(`DATO_PATAGONIA_INVALIDO` INFORMACION) y BNA sigue `LISTO_PARA_GENERAR`.
Una fila con pago y sin destino bloquea ambos (P-24).

### 4.4 Archivo real (local, opt-in, solo agregados)

Con un maestro prellenado en memoria desde la misma liquidación (no existe
todavía un maestro real): 156 filas, 156 CUIL válidos con la N-02
estricta, 0 hallazgos del parser, 156 filas prellenadas, 0 hallazgos del
maestro, 156 CUIL canónicos coincidentes, 155 filas cruzadas con legajo
exacto (la excluida no se cruza). Estados: 116 BNA · 38 Patagonia · 1
excluida · 1 pendiente. Invariantes de cantidad e importe: verdaderos.
Faltan, como se espera sin datos bancarios, `CBU_FALTANTE` (116) y
`DATO_PATAGONIA_FALTANTE` (38 × 7 campos).

### 4.5 Variantes de `Descripcion` (herramienta de análisis, D-051)

Un solo archivo disponible (un solo mes). Variantes exactas: `"JULIO
Agrario"` 121 · `"JULIO Comercio "` 27 · `"JULIO Directivos"` 4 · `"JULIO
Liq Final"` 3 · `"JULIO Liq final "` 1. Ninguna omitida por posible dato
personal. **No se derivó ninguna regla**: para P-10 hacen falta
exportaciones de otros meses.

## 5. Interpretaciones de implementación (a confirmar, P-29)

1.  **Filas excluidas por neto cero (D-034):** solo los hallazgos que
    impiden identificar la fila (CUIL) conservan su nivel; legajo, banco,
    descripción o componentes ilegibles se informan como INFORMACION.
2.  **Filas pendientes:** las reglas de banco (sin maestro, legajo, datos
    del destino, etc.) se aplican recién cuando hay destino (§E.2 regla
    10). Los hallazgos de identificación y de duplicados del maestro sí
    se aplican, con alcance global.
3.  **Huellas de archivo en las decisiones:** cada decisión guarda la
    SHA-256 de los archivos cuyos datos observó: asignar destino y neto
    que no cuadra, solo Finnegans; legajo distinto, Finnegans y maestro.
    Si cambia ese archivo, la decisión no se aplica.
4.  **Decisiones en conflicto:** dos o más decisiones para la misma
    incidencia → no se aplica ninguna.
5.  **El id de una incidencia incluye su alcance:** si cambia el destino
    asignado a una fila, las confirmaciones tomadas con el destino anterior
    dejan de aplicarse.
6.  **Neto ilegible:** la fila queda en el banco de su texto `Banco` (no
    se excluye ni se infiere) y el importe de ese banco y el de Finnegans
    quedan null.
7.  **CBU en Patagonia:** un CBU inválido en un empleado de Patagonia
    bloquea Patagonia, porque la tabla de consumo aprobada (D-048) lo
    marca como consumido si está presente (regla 12).
8.  **Destino asignado sin entrada en el catálogo:** no se valida a
    ciegas; `BANCO_INCOMPATIBLE_MAESTRO` con motivo
    `DESTINO_SIN_CATALOGO`.
9.  **`LIQUIDACION_SIN_MAPEO`** se informa por fila (no agrupada).
10. **`SIN_REGISTROS`** se evalúa primero aunque la conciliación global no
    esté cerrada (orden de §G.3).

## 6. Riesgos abiertos

-   P-18: los DV de CUIL y CBU siguen docs/04 §5 sin fuente oficial en
    `references/`. El CUIL quedó validado con datos reales (156/156); el
    CBU solo con sintéticos (no hay maestro real).
-   Toda liquidación queda bloqueada por `LIQUIDACION_SIN_MAPEO` hasta
    resolver P-09 y P-10.
-   Las interpretaciones de §5 deben confirmarse.
-   R-001 a R-005 (docs/07 §6) siguen vigentes.

## 7. Pendientes documentados

P-03, P-04, P-05, P-08, P-09, P-10, P-14, P-17, P-18, P-19, P-20, P-21,
P-22, P-23, P-28 y P-29 (docs/07 §2.2).
