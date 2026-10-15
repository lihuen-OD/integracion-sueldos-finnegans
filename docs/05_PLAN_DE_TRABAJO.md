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
| F2 | Parser Finnegans + Maestro + dominio | No (PAT-2 solo afecta la validación de un campo) |
| F3 | Conciliación + UI | No (el mapeo de liquidaciones puede quedar vacío) |
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

## F1 · Base técnica + spike XLSX — **completada, pendiente de revisión**

Rama `f1-base-tecnica` (sin merge a `main`). Resultado del spike en
`docs/spikes/F1_XLSX.md`; pendientes T11 manual (P-26) y confirmación de
ExcelJS (P-27).

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

## F2 · Parser Finnegans + Maestro + dominio

-   Dominio: `Cuil` y `Cbu` (con DV, D-024), `Cents` (`bigint`),
    `CivilDate`, `Incidencia` con los cuatro niveles (D-019).
-   Parser Finnegans con errores por hoja/fila/columna.
-   Plantilla XLSX del maestro (vacía y prellenada) y su lector.
-   Perfil de empresa: esquema, importación y exportación (D-022).

**Salida:** lectura y validación de las tres entradas con fixtures
sintéticos; cero TXT.

## F3 · Conciliación + UI

-   Motor de conciliación con las reglas de docs/03 §E, el resumen
    global y la readiness independiente por banco de docs/03 §G (D-032).
-   Regla de extracción de período y tipo de liquidación (D-037, P-10),
    solo después de analizar todas las variantes reales.
-   Registro de decisiones del operador (asignación de destino,
    confirmación de legajo).
-   UI del asistente: carga, incidencias, decisiones, perfil, parámetros
    de envío, resumen de conciliación y reporte descargable. La UI no
    conoce posiciones.
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

**Salida:** generador completo salvo campos bloqueados; marcado
PENDIENTE DE HOMOLOGACION.

## F6 · Banco Patagonia

-   Spec B.2 (docs/04 §3) como datos; loteo; mapper; golden files;
    inspector.
-   Generación deshabilitada mientras PAT-1 y PAT-2 sigan `B`.

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
