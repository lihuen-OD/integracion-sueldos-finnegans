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
| F7 | Homologación bancaria | Sí |
| F8 | Empaquetado / producción | Sí (requiere F7) |

## F0 · Análisis y contratos — **cerrada documentalmente**

-   Análisis de los PDF BNA y Patagonia y del Excel real de Finnegans
    (solo agregados).
-   Matrices de campos con posición, fuente y estado (docs/04); contrato
    del maestro y reglas de conciliación (docs/03); decisiones y
    preguntas (docs/07).

**Salida:** documentación aprobada por el usuario. No se construyó
código.

## F1 · Base técnica + spike XLSX — **APROBADA (20-10-2026)**

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

## F2 · Dominio, parsers, conciliación y readiness — **implementada, checkpoint final pendiente**

Plan aprobado con ajustes el 20-10-2026 (D-044 a D-051). Rama local
`f2-dominio-conciliacion`, sin remoto ni merge. Informe en
`docs/informes/F2_DOMINIO_CONCILIACION.md`.

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
-   **Checkpoint final** de F2 antes del merge a `main`.

**Fuera de F2:** TXT, `FieldSpec` y layouts bancarios; máximo de importe
por layout (F5/F6); mapeo de liquidaciones; extracción de período/tipo
(P-10); regla 18 (P-28); nombre Patagonia (F6); perfil de empresa,
`CivilDate`, parámetros de envío y UI (F3).

**Salida:** lectura, validación y conciliación de Finnegans y maestro con
fixtures sintéticos; readiness independiente por banco; cero TXT.

## F3 · UI, perfil y parámetros de envío

-   Perfil de empresa: esquema, importación y exportación (D-022, P-19).
-   `CivilDate` y parámetros de envío por corrida (docs/03 §D.2).
-   Regla de extracción de período y tipo de liquidación (D-037, P-10),
    solo después de analizar todas las variantes reales.
-   UI del asistente: carga, incidencias, decisiones del operador
    (asignación de destino, confirmación de revisiones), perfil,
    parámetros de envío, resumen de conciliación y reporte descargable,
    sobre el motor de conciliación de F2. La UI no conoce posiciones.
-   Edición temporal del maestro y exportación de una versión nueva.

**Salida:** recorrido completo con datos sintéticos; conciliación
cerrada o bloqueada correctamente según cada caso de docs/06.

## F4 · Motor fixed-width genérico

-   `FieldSpec`, `RecordSpec`, `FileSpec`, `FixedWidthSerializer`,
    `FixedWidthParser`, `FixedWidthInspector` (docs/02, D-027).
-   Tests de invariantes con specs de prueba y con los layouts reales
    declarados como datos (sin habilitar generación).

**Salida:** motor probado de forma independiente de los bancos.

## F5 · Banco Nación

-   Spec BNA (docs/04 §2) como datos; mapper desde el modelo de pago;
    golden files sintéticos; inspector.
-   La generación queda **deshabilitada** mientras BNA-1 siga `B`. Las
    pruebas pueden usar valores marcados como hipótesis de test, nunca
    disponibles en la UI.
-   Control de importe máximo por registro derivado del layout
    (`NETO_EXCEDE_LAYOUT`, 8 enteros + 2 decimales, p.8), diferido desde
    F2 (D-047).

**Salida:** generador completo salvo campos bloqueados; marcado
PENDIENTE DE HOMOLOGACION.

## F6 · Banco Patagonia

-   Spec B.2 (docs/04 §3) como datos; loteo; mapper; golden files;
    inspector.
-   Generación deshabilitada mientras PAT-1 y PAT-2 sigan `B`.
-   Nombre Patagonia (docs/03 §F, reglas 15–16) y control de importe
    máximo derivado del layout (9 enteros + 2 decimales, PAT-DR p.9),
    diferidos desde F2 (D-044, D-047). Regla 18 solo si se resuelve P-28.

**Salida:** generador completo salvo campos bloqueados; marcado
PENDIENTE DE HOMOLOGACION.

## F7 · Homologación bancaria

-   Resolver con cada banco las `B` e `I` de docs/04 §6 y registrar las
    respuestas en docs/07 §4.
-   Probar en los canales documentados (BNA: casilla SERVICIOSDEPAGO;
    Patagonia: BPSUELDO) con los datos que cada banco admita.
-   Actualizar specs y golden files según las respuestas.

**Salida:** aceptación documentada de cada banco.

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
