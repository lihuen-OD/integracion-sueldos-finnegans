# 05 · Plan de trabajo por etapas

**Hoja de ruta aprobada (D-028), 14-10-2026.** Prioridad: correctitud,
trazabilidad, conciliación, privacidad, pruebas y homologación, por
encima de la velocidad de implementación.

F1–F4 pueden avanzar aunque existan bloqueos bancarios. Ningún generador
se declara apto para producción hasta resolver sus ambigüedades y
completar la homologación (D-029).

| Fase | Nombre | Depende de bloqueos bancarios |
|---|---|---|
| F0 | Análisis y contratos | No |
| F1 | Base técnica + spike XLSX | No |
| F2 | Dominio, parsers, conciliación y readiness (D-044) | No (PAT-2 solo afecta la validación de un campo; el mapeo de liquidaciones queda vacío) |
| F3 | UI, perfil y parámetros de envío | No |
| F4 | Motor fixed-width genérico | No |
| F5 | Banco Nación | Sí, para habilitar la generación (BNA-1 y demás `I`) |
| F6 | Banco Patagonia | Sí (PAT-1, PAT-2 y demás `I`) |
| F7 | Homologación bancaria | Sí (iniciada en CP-F7-0) |
| F8 | Empaquetado / producción | Sí (requiere F7) |

## F0 · Análisis y contratos — **cerrada documentalmente**

-   Análisis de los PDF BNA y Patagonia y del Excel real de Finnegans
    (solo agregados).
-   Matrices de campos con posición, fuente y estado (docs/04); contrato
    del maestro y reglas de conciliación (docs/03); decisiones y
    preguntas (docs/07).

**Salida:** documentación aprobada por el usuario. No se construyó
código.

## F1 · Base técnica + spike XLSX — **CERRADA: aprobada e integrada en `main` (20-10-2026)**

Rama `f1-base-tecnica` integrada en `main` con merge local (D-043), sin
remoto. T1–T11 aprobados (`docs/spikes/F1_XLSX.md`); ExcelJS aprobado
(D-040); riesgo `uuid` aceptado temporalmente (D-041, R-001); política
de literales con forma de CUIL/CBU (D-042).

-   Repositorio git local, `.gitignore` reforzado, hook de chequeo de
    datos sensibles.
-   React + TS strict + Vite + Tailwind; ESLint, Prettier, Vitest, RTL y
    Playwright.
-   Endurecimiento offline: CSP, prueba de cero requests, almacenamiento
    vacío.
-   Spike XLSX (ExcelJS candidato) con fixtures sintéticos que imitan la
    estructura de Finnegans, y verificación local con el archivo real
    (solo salida agregada).

**Salida:** `verify` en verde; informe del spike y decisión sobre D-007.
Sin lógica de negocio. El plan detallado se aprueba antes de empezar.

## F2 · Dominio, parsers, conciliación y readiness — **CERRADA e integrada en `main` (20-10-2026)**

Plan aprobado con ajustes el 20-10-2026 (D-044 a D-051); corrección final
D-056 y D-057. Rama `f2-dominio-conciliacion` integrada en `main` con
merge local `--no-ff`, sin remoto: merge técnico
`ba7eceda48aa115761327df3d690c8fc20360797`. Informe en
`docs/informes/F2_DOMINIO_CONCILIACION.md`. Siguen abiertos P-03, P-04,
P-05, P-08, P-09, P-10, P-14, P-17, P-18, P-19, P-20, P-21, P-22, P-23 y
P-28, y los riesgos R-001 a R-005 (docs/07 §2.2 y §6); en particular
P-18 (fuente oficial de los DV), P-09/P-10 (mapeo de liquidaciones) y
P-28 (regla 18, documento frente a CUIL, diferida).

-   Dominio: `Cuil` y `Cbu` (DV según D-024; fuente oficial pendiente,
    P-18), `Centavos` (`bigint` con signo, D-045), incidencias con los
    cuatro niveles (D-019) y alcance (D-032), `PayrollLine`,
    `MasterRecord`, `DescripcionLiquidacion` en estado
    `REGLA_PENDIENTE` (D-037), catálogos con fuente.
-   Normalización controlada de lista cerrada (D-046).
-   Parser Finnegans y parser del maestro con incidencias por
    hoja/fila/columna.
-   Plantilla `MAESTRO_CUENTAS_EMPLEADOS.xlsx` vacía y prellenada.
-   Cruce exacto por CUIL, control exacto de legajo, reglas de docs/03 §E
    (D-047, D-048), decisiones del operador como entrada pura,
    `GlobalReconciliationStatus`, `BnaReadiness` y `PatagoniaReadiness`.
-   Herramienta local de análisis de variantes de `Descripcion` (solo
    análisis, D-051).
-   **Checkpoint obligatorio** después del commit 10 (parser del maestro):
    aprobado el 20-10-2026 junto con T-F2-M1 (D-055); las correcciones
    del checkpoint van en un commit correctivo nuevo (D-052 a D-054).
-   **Checkpoint final** de F2 antes del merge a `main`: aprobado el
    20-10-2026; F2 integrada en `main`.

**Fuera de F2:** TXT, `FieldSpec` y layouts bancarios; máximo de importe
por layout (F5/F6); mapeo de liquidaciones; extracción de período/tipo
(P-10); regla 18 (P-28); nombre Patagonia (F6); perfil de empresa,
`CivilDate`, parámetros de envío y UI (F3).

**Salida:** lectura, validación y conciliación de Finnegans y maestro con
fixtures sintéticos; readiness independiente por banco; cero TXT.

## F3 · UI, perfil y parámetros de envío — **CERRADA: aprobada e integrada en `main` (22-10-2026)**

**Cierre:** CP-F3-A/B/C aprobados por auditoría humana; rama
`f3-ui-operativa` integrada a `main` con merge `--no-ff`
(`e125d30435b2628242ebd6a93a59e622e2e20a4d`). Verify completo verde sobre
`main` tras el merge (628 unit+integration / 42 archivos; 23 e2e;
check:sensitive sin hallazgos; check:dist OK). Informe:
`docs/informes/F3_UI_OPERATIVA.md`. Rama `f3-ui-operativa` conservada
(sin borrar). Al cierre de F3, la fase siguiente (F4) aún no había sido
iniciada.

Plan aprobado el 21-10-2026 con decisiones D-058 a D-067 (docs/07). Rama
`f3-ui-operativa` desde `main` (`db79b52`), sin merge. Cumplimiento por
tres checkpoints con STOP obligatorio después de cada uno:

-   **CP-F3-A (T3-0…T3-7, dominio puro, sin UI):** acta documental;
    `CivilDate` canónico `YYYY-MM-DD` (D-044); CUIT de empresa con solo
    validación estructural (DV pendiente, P-18, D-061); CompanyProfile v1
    (`schemaVersion: "1"`, claves desconocidas rechazadas, sin
    migraciones; import por contenido con cualquier nombre de archivo;
    D-059/D-022/P-19 abierto entonces; P-19 se cerró el 26-10-2026), con
    importación y exportación; estado de
    corrida solo en memoria; `MasterRevisionFingerprint` separado de
    `FileFingerprint` (D-062); integración controlada con las decisiones
    del operador según la regla conservadora (D-063); tests y
    guardrails; `verify` verde. **STOP: no continuar automáticamente a
    UI.**
-   **CP-F3-B (T3-8…T3-10, UI base, tras aprobación de CP-F3-A):** carga
    de Finnegans, maestro y perfil; resumen, incidencias y agrupación con
    trazabilidad individual (D-067); decisiones; readiness e invariantes;
    datos sintéticos y e2e. STOP con revisión visual obligatoria.
-   **CP-F3-C (T3-11…T3-15, tras aprobación visual de CP-F3-B):** editor
    UPDATE-only del maestro (D-066) con re-conciliación; exportación del
    maestro nuevo XLSX con fecha/versión en el nombre; pruebas con 300
    filas y medición exploratoria con 5.000; accesibilidad final;
    guardrails finales; informe F3.

Límites de F3 (D-065, D-066, D-067): cero captura de parámetros de envío
de docs/03 §D.2 (se difieren con sus pendientes bancarias;
`CONFIGURACION_INCOMPLETA` es un estado válido y honesto); sin ADD ni
DELETE en el editor; identidad no editable; reporte descargable de
conciliación diferido (D-064, P-17 abierto); **F3 no genera TXT de
ningún banco** y el perfil NO decide destinos.

-   Perfil de empresa: esquema, importación y exportación (D-022, D-059,
    P-19).
-   `CivilDate` (D-044; D-044 pasó la implementación a F3).
-   Regla de extracción de período y tipo de liquidación (D-037, P-10):
    diferida fuera de F3; `LIQUIDACION_SIN_MAPEO` continúa por fila
    (P-29.9), la agrupación visual es presentación.
-   UI del asistente (CP-F3-B/C): carga, incidencias, decisiones del
    operador (asignación de destino, confirmación de revisiones), perfil,
    resumen de conciliación sobre el motor de conciliación de F2. La UI
    no conoce posiciones.
-   Edición temporal del maestro y exportación de una versión nueva.

**Salida:** recorrido completo con datos sintéticos; conciliación
cerrada o bloqueada correctamente según cada caso de docs/06.

## F4 · Motor fixed-width genérico — **COMPLETADA, APROBADA E INTEGRADA EN `main` (26-10-2026)**

Plan v3 aprobado por el humano el 22-10-2026. Contratos congelados por
escrito en docs/02 (D-068 a D-077). Rama `f4-motor-fixed-width` originada
desde `main` (`e7bfff9`). **Frontera definitiva (D-077):** F4 no
implementa ni prueba layouts bancarios reales (eso es F5/F6); usa specs
exclusivamente sintéticas.

Cumplimiento por tres checkpoints con STOP obligatorio después de cada
uno:

-   **CP-F4-A (T4-0, documental):** contratos definitivos del motor en
    docs/02 (FieldSpec/RecordSpec/EstructuraArchivo/FileSpec,
    identificación por discriminadores, parser RAW, round-trip
    R-T1/R-T2/R-T3, `rutaRepeticiones`, aptitud vs capacidad técnica);
    matriz de pruebas de F4 en docs/06; decisiones D-068 a D-077 en
    docs/07; corrección de la frontera en docs/05. **Sin código del
    motor.**
-   **CP-F4-B (T4-1…T4-6, módulo de registro, tras aprobación de
    CP-F4-A):** T4-1 tipos + validador de RecordSpec; T4-2 codec ASCII;
    T4-3 identificación de registros + validación estática (estructura,
    discriminadores); T4-4 `FixedWidthSerializer` de registro; T4-5
    `FixedWidthParser` RAW (independiente); T4-6 round-trip
    R-T1/R-T2/R-T3. Tests de la matriz de docs/06. **STOP.**
-   **CP-F4-C (T4-7…T4-12, archivo e integración, tras aprobación de
    CP-F4-B):** T4-7 serialización de archivo (estructura,
    separadores, trailing); T4-8 parseo de archivo (con
    `rutaRepeticiones`); T4-9 inspector; T4-10 aptitud
    (`hallarBloqueosGeneracion`); T4-11 guardrails (solo `src/shared`)
    y cobertura >= 95 % para `src/banks/fixed-width/**`; T4-12 `verify`
    completo + informe `docs/informes/F4_MOTOR_FIXED_WIDTH.md` + cierre
    documental. **STOP → revisión humana → merge `--no-ff`.**

**Estado final (26-10-2026):** CP-F4-A, CP-F4-B y CP-F4-C completados
en la rama `f4-motor-fixed-width`, con auditoría humana final aprobada.
El motor, sus tests, los guardrails y el umbral de cobertura de
`src/banks/fixed-width/**` están integrados en `verify`; el informe final
está en `docs/informes/F4_MOTOR_FIXED_WIDTH.md`.

-   HEAD F4 aprobado: `7dcdbd83474c7a252e825c9d0205f73e136c4aa3`.
-   Merge `--no-ff` a `main`:
    `ab6f394c9523bee5fc81098a8de9e3b70387e5e4`; integración auditada en
    GitHub.
-   `npm run verify` post-merge: verde.
-   Tests fixed-width: 161 en 11 archivos.
-   Tests de guardrails: 98.
-   Suite total: 833 tests en 53 archivos.
-   Playwright: 23/23.
-   Cobertura fixed-width: statements 99.22 %, branches 95.71 %,
    functions 100 %, lines 99.18 %.

F4 **no implementa layouts bancarios reales**: F5/F6 son responsables de
los layouts bancarios. La aplicación sigue **NO apta para pagos reales**
hasta la homologación; F5 **técnicamente implementada (CP-F5-A/B/C)**,
**NO homologada**.

**Fuera de F4 (D-072, D-073, D-074):** padding `CUSTOM`; DSL de
totales/cantidades/loteo; restricciones de charset bancarias; catálogo
de documentos bancarios; orígenes y trazabilidad documental de campos.

**Salida:** motor probado de forma independiente de los bancos, con
specs sintéticas y un harness de invariantes reutilizable (los layouts
reales de F5/F6 lo aplicarán).

## F5 · Banco Nación — **TÉCNICAMENTE IMPLEMENTADA (CP-F5-A/B/C); NO HOMOLOGADA**

Plan aprobado con correcciones humanas (D-078 a D-085). F5 no toca
Patagonia ni modifica F4. Se ejecuta en tres checkpoints con STOP
obligatorio después de cada uno:

-   **CP-F5-A · Contrato, spec y trazabilidad (completado):**
    documentación D-078…D-085; extensión genérica de trazabilidad
    bancaria; contrato BNA (ids, estados, issues, metadata documental);
    spec de los 47 campos en 3 registros de 200 bytes; `crearSpecBna`
    con hipótesis explícita de separador; `aptitudBna` compatible con
    D-075; contrato documental de perfil v2 congelado (D-079, docs/03
    §C.1); tests de geometría, estados, BNA-1/BNA-9, D-075 y guardrails;
    cobertura >= 95 % para `src/banks/bna/**`. **Sin mapper, sin perfil
    v2 funcional, sin totales, sin serialización productiva, sin
    fachada ni UI.**
-   **CP-F5-B · Perfil v2, mapper y totales (completado y aprobado por
    auditoría humana, 26-10-2026):** contrato y APIs versionadas v1+v2
    sin migración silenciosa; modelo puro `PagoBna`/`ParametrosEnvioBna`/
    `PerfilBna`; política productiva sin resolución para BNA-1, BNA-2,
    BNA-6, P-09/P-10 y BNA-11/P-17; mapper BNA puro y determinista;
    `NETO_EXCEDE_LAYOUT`; totales/cantidades exactos en `Centavos`;
    serialización vía API pública F4 con LF/CRLF y salto final
    explícitos; inspector independiente que relee bytes; rechazo de
    convenio de 5–7 dígitos; sin defaults que resuelvan B/I. No toca UI,
    conciliación, `run`, Patagonia ni F4. Requiere aprobación de
    CP-F5-A y STOP humano antes de CP-F5-C.
-   **CP-F5-C · Integración y salida (completado, corregido tras
    auditoría y aprobado por auditoría humana, 26-10-2026):** fachada
    `src/run/generacionBna.ts` para que la UI no importe `banks/**`;
    composición de la readiness existente (sin una segunda readiness);
    perfil v2 → `PerfilBna` copiando solo los cuatro datos BNA;
    `PagoBna[]` derivado de la conciliación, en orden, con `SourceRef`,
    solo pagos BNA incluidos, positivos, conciliados y con identidad/CBU
    válidos; parámetros de envío explícitos; compuertas de conciliación
    global, registros, bloqueos BNA, revisiones, contrato BNA-1, política
    productiva, serializer e inspector. **La entrada pública expone solo
    `perfil`, `conciliacion` y `parametros`; no admite política, aptitud,
    serializer ni inspector.** La fachada usa siempre
    `aptitudBna(crearSpecBna(parametros))`, `POLITICA_BNA_PRODUCTIVA`,
    `serializarBna` e `inspeccionarBna`; las hipótesis sintéticas quedan
    confinadas a `tests/**` (composición directa de capas técnicas o
    `vi.mock` controlado). Mientras BNA-1 siga bloqueada, `GENERADO`,
    `SERIALIZACION_FALLIDA` e `INSPECCION_BNA_FALLIDA` son inalcanzables
    desde la API pública y se prueban por capas. Unión discriminada de
    resultados con errores estructurados, sin excepciones de flujo
    normal, sin Blob, sin descarga y sin bytes parciales. Golden técnico
    100 % sintético con etiqueta **NO HOMOLOGADO POR BANCO NACIÓN**,
    comparación byte a byte y SHA-256, generado por composición directa
    de las capas técnicas (no por un bypass de la fachada). Guardrail de
    `src/run/**` limitado a los entry points públicos de BNA y umbral
    >= 95 % para la fachada. No toca UI, conciliación, Patagonia ni F4.
    Requiere aprobación de CP-F5-B.

**Reglas de alcance (D-078/D-079/D-084):** BNA-1 sigue `B` y mantiene el
generador deshabilitado. Las `I` no se convierten en `B`. `aptitudBna`
informa por separado las `I` que afectan bytes y las que no; la
homologación sigue pendiente. P-09/P-10 producen
`LIQUIDACION_SIN_MAPEO` **BLOQUEANTE por fila** en conciliación, no un
`ContractStatus` de la spec. El perfil v1 (D-059) no se modifica ni se
migra; BNA F5 queda `CONFIGURACION_INCOMPLETA` hasta un perfil v2
explícito. `sucursalEmpresa` no se agrega como dato estable mientras
BNA-6 siga abierto. Los goldens son 100 % sintéticos y no se declaran
aceptados por el banco; LF/CRLF son hipótesis técnicas sin default.

**Estado final de F5 (26-10-2026):** CP-F5-A, CP-F5-B y CP-F5-C
completados y aprobados por auditoría humana; F5 **cerrada e integrada
en `main`** con merge técnico `--no-ff`
`1ea3b1d8a2ef2ad662cfed5667a7361989a46e12` (padres: `main`
`0e3653252d89ccca2affc379d42bcfa262d3b9d6` y `f5-banco-nacion`
`4803919db30970fa727ba843cd349e64e278b756`). Informe de cierre:
`docs/informes/F5_BANCO_NACION.md`. Verify post-merge verde: 1077 tests
en 65 archivos, 23 e2e, `check:sensitive` sin hallazgos, build y
`check:dist` OK; cobertura de la fachada 100 % en statements, branches,
functions y lines. F5 queda **NO homologada**: BNA-1 sigue `BLOQUEADA`,
la generación productiva devuelve `CONTRATO_BNA_BLOQUEADO`,
BNA-2/BNA-6/BNA-11/P-09/P-10/P-17 y el resto de las preguntas BNA siguen
abiertas, y la aplicación **NO es apta para pagos reales**. El golden es
técnico, sintético y no declarado aceptado por el banco; demuestra
capacidad de las capas inferiores, no habilitación productiva. No hay UI
ni descarga conectadas en este checkpoint. La rama `f5-banco-nacion` se
conserva local y remota.

**Salida esperada de F5:** generador completo salvo campos bloqueados;
marcado PENDIENTE DE HOMOLOGACION. La aplicación sigue **NO apta para
pagos reales** hasta F7.

## F6 · Banco Patagonia — **TÉCNICAMENTE IMPLEMENTADA, CERRADA E INTEGRADA EN `main`; NO HOMOLOGADA**

**CP-F6-A — APROBADO por auditoría humana en `f6-banco-patagonia`
(27-10-2026).** Implementó únicamente contrato, trazabilidad, spec técnica y
aptitud contractual. PAT-1 y PAT-2 siguen `BLOQUEADA`; PAT-17 queda
`INTERPRETACION_PENDIENTE`. La spec exige hipótesis explícitas para PAT-1
(`ESPACIOS`/`CEROS`, geometría 93 y 96 solo documental), PAT-2
(`NUMERICA`/`ALFANUMERICA`) y PAT-14 (`lineSeparator`/`trailingSeparator`), sin
defaults. No se implementó mapper, totales, loteo productivo, serialización,
inspector, fachada run, golden, perfil V3 ni parámetros de envío.

**CP-F6-B — ejecutado y APROBADO por auditoría humana en
`f6-banco-patagonia` (27-10-2026).** Base aprobada inicial:
`b267c7feeae0629932d9eb8ba52a857bf5a2f494`. Correctivo final del mapper:
`b3e3a60f07b6b28f6d6fe42822843b5909552809`, también auditado y aprobado.
Implementó la capa técnica pura de Patagonia B.2 y el perfil V3, sin cerrar
ninguna pregunta bancaria:

-   `CompanyProfileV3` (`src/profile/**`): misma configuración BNA que v2 más
    `patagonia.numeroEmpresa`; v1 y v2 quedan exactamente intactos, sin
    migración, fallback ni defaults; la exportación conserva la versión
    declarada. `numeroEmpresa` se persiste exactamente como 1–4 dígitos ASCII,
    sin relleno ni normalización. `mapeosLiquidacion` sigue vacío y las claves
    desconocidas se rechazan. El único cambio en `src/run/**` es la ampliación
    de tipo de `perfilVersion` a `'3'`.
-   Modelo puro (`modelo.ts`): pagos ya conciliados, dinero `Centavos`/`bigint`,
    sin CBU/CUIL/datos de alta ni decisiones escondidas.
-   Política (`politica.ts`): toda decisión abierta pasa por
    `PoliticaPatagonia`. La política productiva devuelve `SIN_RESOLUCION` para
    P-20, PAT-4, PAT-7/P-09/P-10, PAT-9/P-14, PAT-15 y PAT-16. Las resoluciones
    sintéticas viven solo en `tests/**`.
-   Nombre (`nombre.ts`): aplica únicamente mayúsculas, eliminación de
    acentos/diéresis y Ñ→N; orden, separador, recorte, colapso y truncamiento
    exigen una `DecisionNombrePatagonia` explícita. No hay truncamiento
    silencioso.
-   Validaciones (`validacion.ts`): formas técnicas, catálogos Anexo I/II,
    longitudes de la spec y fechas AAAAMMDD sin `Date` ni calendario. PAT-5
    solo aplica la prohibición PAT-DR de `99`; no impone 1–70 ni decide `00`.
    PAT-7 valida forma de 3 dígitos sin imponer catálogo DR/XL.
-   Totales y loteo (`totales.ts`, `loteo.ts`): límites derivados de la
    geometría, máximos 999 detalles por lote y 9999 lotes, validación técnica
    separada de la estrategia y cobertura por identidad/orden de los mismos
    pagos. No hay estrategia de loteo por default.
-   Mapper (`mapeo.ts`): `EntradaRegistro[]` puro con R0 + (R1 + R2*)+; PAT-4
    solo exige provincia para el tipo documental `004`; PAT-8 usa Anexo I
    PAT-DR; PAT-17 toma el código de banco del dato para R2 y mantiene `034`
    fijo solo en R0. No serializa bytes, no genera TXT, no descarga, no usa
    inspector, golden, UI ni fachada `run`.
-   PAT-1 y PAT-2 siguen `BLOQUEADA`; PAT-17 sigue
    `INTERPRETACION_PENDIENTE`; P-30 y las demás preguntas siguen abiertas.

Verificación de CP-F6-B: `npm run verify` verde con **1263 tests en 78
archivos** y **23 e2e**; `check:sensitive` sin hallazgos y `check:dist` OK.
Patagonia B.2: **133 tests en 11 archivos**; cobertura agregada
`src/banks/patagonia-b2/**` 96,78 % statements / 95,01 % branches / 100 %
functions / 96,75 % lines. En ese momento, CP-F6-C y F7 no estaban iniciados;
la app sigue **NO apta para pagos reales**.

El correctivo `b3e3a60f07b6b28f6d6fe42822843b5909552809` —commit
`fix(f6): preservar ocurrencias de pagos en mapper Patagonia`— fue auditado y
**APROBADO**. Corrigió la deduplicación accidental de ocurrencias cuando el
mismo objeto `PagoPatagonia` aparecía más de una vez; la solución preserva las
ocurrencias por posición/índice. No queda pendiente.

**CP-F6-C — APROBADO por auditoría humana (27-10-2026). HEAD final auditado
de la rama: `5bae56c5369bbd4c28a49a95f041561e19fb47d2`; la ejecución técnica
inicial quedó en `3d689f9338f86993dc15d58a9c508e9786a6015b`.** Conecta la capa
técnica de Patagonia sin homologar el banco ni habilitar pagos reales:

-   `serializacion.ts` compone mapper → `crearSpecPatagoniaB2` →
    `serializarArchivo` de la API pública F4; no duplica fixed-width,
    posiciones, padding ni defaults, no hace I/O y no devuelve bytes parciales
    ante error.
-   `inspeccion.ts` recibe solo bytes y configuración técnica, usa la
    inspección pública F4 y reconstruye cantidades, importes, lotes, EMPRESA y
    envío sin confiar en el mapper ni en los modelos de generación. Las
    interpretaciones pendientes no se convierten en errores.
-   `src/run/generacionPatagonia.ts` acepta exclusivamente `perfil`,
    `conciliacion` y `parametros`; usa siempre la política productiva, la
    aptitud contractual, el serializer y el inspector públicos. No admite
    bypasses por política, aptitud, mapper, spec, callbacks ni opciones
    equivalentes.
-   El perfil debe ser `CompanyProfileV3`; v1/v2 devuelven
    `CONFIGURACION_INCOMPLETA` y solo se copia
    `{ numeroEmpresa: perfil.patagonia.numeroEmpresa }`. La readiness se
    reutiliza con Patagonia como banco evaluado y BNA no configurado/no
    habilitado.
-   Estados cubiertos: configuración incompleta, conciliación ausente/global
    pendiente/global bloqueada, sin registros, bloqueantes/revisiones
    Patagonia, contrato bloqueado, mapeo no resuelto, fallo de serialización,
    fallo de inspección y generado. P-09/P-10 se consumen como
    `LIQUIDACION_SIN_MAPEO`; `tipoLiquidacion()` productivo sigue
    `SIN_RESOLUCION`.
-   Compuerta crítica: con PAT-1/PAT-2 `BLOQUEADA`, una entrada válida devuelve
    `CONTRATO_PATAGONIA_BLOQUEADO` antes de serializar. Por la política
    productiva actual, `GENERADO`, `SERIALIZACION_FALLIDA` e
    `INSPECCION_PATAGONIA_FALLIDA` solo se alcanzan con mocks de test.
-   Golden 100 % sintético en `tests/fixtures/synthetic/golden/`, con 2 pagos,
    2 lotes, PAT-1 `ESPACIOS`, PAT-2 `NUMERICA`, LF sin salto final, total
    `84000050`, 1004 bytes, SHA-256
    `36f55f2a0aee04e944c5347ecde62f6c8722418f8b0bca86ebf1a408848a7ade` y la
    etiqueta `GOLDEN TÉCNICO SINTÉTICO — NO HOMOLOGADO POR BANCO PATAGONIA.`.
    No pasa por la fachada productiva.
-   Guardrail de `run` ampliado solo para las APIs públicas de BNA y Patagonia,
    con tests de internals, traversals y bypasses.

Verificación de CP-F6-C: **1332 tests en 84 archivos** y **23 e2e**;
`npm run verify` verde con typecheck, lint, format, `check:sensitive`, build y
`check:dist`. Cobertura `src/banks/patagonia-b2/**`: **96,98 % statements /
95,22 % branches / 100 % functions / 96,95 % lines**; fachada
`generacionPatagonia.ts`: **97,58 / 96,62 / 100 / 97,50**. CP-F6-C **APROBADO
por auditoría humana**.

**Estado final de F6 (27-10-2026):** CP-F6-A, CP-F6-B y CP-F6-C
**APROBADOS**. F6 **técnicamente implementada, cerrada e integrada en
`main`** con merge `--no-ff`
`d7070ecd638ef96bcc729801fe469080d01631de` (padres:
`927b8b4d3214b680023a8fd884158778b363449a` y
`5bae56c5369bbd4c28a49a95f041561e19fb47d2`; 19 commits de la rama).
Verify post-merge verde: **1332 tests / 84 archivos + 23 e2e**;
`check:sensitive` sin hallazgos (254 archivos), build y `check:dist` OK.
La rama `f6-banco-patagonia` se conserva local y remota. F6 sigue **NO
homologada**: PAT-1/PAT-2 siguen `BLOQUEADA`, PAT-17 sigue
`INTERPRETACION_PENDIENTE`, P-30/P-20 siguen abiertas y PAT-4,
PAT-7/P-09/P-10, PAT-9/P-14, PAT-15 y PAT-16 siguen pendientes. El golden
sigue siendo **GOLDEN TÉCNICO SINTÉTICO — NO HOMOLOGADO POR BANCO
PATAGONIA.**, sin cambios de bytes ni SHA. La aplicación sigue **NO apta para
pagos reales** y F7 no se inicia.

-   Spec B.2 (docs/04 §3) como datos, con trazabilidad documental
    (`origin`/`source`, D-068); loteo; mapper; golden files; inspector.
    Aplica el harness de invariantes de F4 (D-077).
-   Generación deshabilitada mientras PAT-1 y PAT-2 sigan `B`.
-   Nombre Patagonia (docs/03 §F, reglas 15–16) y control de importe
    máximo derivado del layout (9 enteros + 2 decimales, PAT-DR p.9),
    diferidos desde F2 (D-044, D-047). Regla 18 solo si se resuelve P-28.

**Salida:** generador completo salvo campos bloqueados; marcado
PENDIENTE DE HOMOLOGACION.

## F7 · Homologación bancaria — **iniciada (CP-F7-0)**

F5 y F6 siguen **técnicamente cerradas e integradas**, pero **ninguna está
homologada**. La aplicación sigue **NO apta para pagos reales** y F8 no se
inicia.

F7 distingue dos niveles que no deben mezclarse:

-   **Resolución contractual:** un `B`/`I` pasa a regla confirmada con
    evidencia suficiente (documentación bancaria oficial, respuesta escrita
    del banco o decisión humana autorizada). No exige un archivo aceptado por
    cada campo.
-   **Homologación bancaria:** etapa posterior e integral. Un único archivo
    aceptado puede validar muchas reglas a la vez.

Cadena explícita: resolver contrato **≠** generar archivo **≠** inspeccionar
**≠** enviar **≠** archivo aceptado **≠** banco homologado **≠** autorización
interna para producción.

| Checkpoint | Alcance | Estado |
|---|---|---|
| **CP-F7-0** | Saneamiento y decisiones internas: arquitectura v2/v3, separación contrato/homologación, política de evidencia y datos, diseño del harness, readiness y checkpoints | **Ejecutado y aprobado** (auditoría humana) |
| **CP-F7-0-B** | Implementación de G-1: BNA admite v2 y v3; motivo de versión incompatible; tests v1/v2/v3 | **Aprobado** (auditoría humana) |
| **CP-F7-A** | Paquete de consultas BNA y Patagonia + matriz de trazabilidad pregunta ↔ BNA/PAT/P | **Ejecutado**; pendiente de auditoría humana; STOP antes de enviar |
| **CP-F7-B** | Incorporación de respuestas BNA | No iniciado; requiere respuestas reales |
| **CP-F7-C** | Incorporación de respuestas Patagonia | No iniciado; requiere respuestas reales; PAT-17 no autoriza tocar conciliación |
| **CP-F7-D1** | Implementación del harness local de homologación | No iniciado |
| **CP-F7-D2** | Materialización y envío controlado | No iniciado; acto humano |
| **CP-F7-E** | Evidencia de aceptación/rechazo, iteraciones y cierre | No iniciado; requiere evidencia bancaria real |

CP-F7-0 fue **docs-only**: no modificó `src/**`, `tests/**`, `references/**`
ni `docs/04`, no cambió estados `B`/`I`/`C`, no contactó bancos y no generó
archivos bancarios. CP-F7-0-B implementó D-089 en `src/run/generacionBna.ts`
y sus tests: BNA acepta v2 y v3, v1 da `PERFIL_VERSION_INCOMPATIBLE` y la
sección Patagonia no se lee; fue **aprobado** por auditoría humana. CP-F7-A
preparó el paquete de consultas y la matriz de trazabilidad en
`docs/informes/F7_CONSULTAS_BANCARIAS.md`; está **ejecutado y pendiente de
auditoría humana**. Ninguna consulta fue enviada. El detalle operativo vive en
`docs/informes/F7_HOMOLOGACION.md`.

**Salida de F7:** aceptación documentada de cada banco, con evidencia
registrada y autorización interna. Sin ambas, no hay habilitación productiva.

## F8 · Empaquetado / producción

-   E2E final, accesibilidad, robustez, rendimiento con 150–300
    empleados (y 10× como margen).
-   Manual de RRHH, instructivo de respaldo del maestro y del perfil,
    checklist de doble control.
-   Empaquetado según P-08: Tauri 2 o HTML único autocontenido.

**Salida:** release candidata; **producción solo con aprobación
bancaria e interna**.

## Ritmo de trabajo

Una fase por vez; plan detallado aprobado antes de cada fase; commits
pequeños; revisión humana de documentación y código; sin agentes
concurrentes editando la misma rama. Si se paraleliza, ramas/worktrees
aislados y revisión de integración.
