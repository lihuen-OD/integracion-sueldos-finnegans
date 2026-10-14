# Prompt inicial para Claude Code · MODO PLAN

Quiero desarrollar desde cero una aplicación local y offline para
convertir liquidaciones de haberes de Finnegans a archivos TXT bancarios
para Banco Nación (Pagos GT Haberes) y Banco Patagonia (Plan Sueldos
B.2).

**Antes de escribir código, leé íntegramente** `README.md`, `CLAUDE.md`
y todos los archivos de `docs/`. Considerá estos documentos como la
fuente de decisiones del proyecto. También leerás los PDFs oficiales que
yo agregue a `references/` y el XLSX real Finnegans que te indicaré,
pero **NO mostrarás, registrarás, subirás, commitearás ni copiarás datos
reales de empleados**.

**En esta primera sesión trabajá SOLO EN MODO PLAN; no crees la app ni
generadores todavía.**

Tu entrega de planificación debe incluir:

1.  Evaluación crítica de la arquitectura propuesta (React+TS+Vite,
    ExcelJS como candidato sujeto a spike, Zod, Vitest/RTL/Playwright y
    eventual Tauri 2). Explicá alternativas solo si existe una ventaja
    concreta para una app offline de RRHH.
2.  Matriz **completa, campo por campo** de BNA GT Haberes y Patagonia
    B.2, con nombre, tipo, posición inicial/final, longitud, relleno,
    regla, origen (`Finnegans` / `Maestro XLSX` / `Configuración` /
    `Derivado` / `Fijo`), fuente exacta y estado de confirmación.
3.  Propuesta de contrato del Excel maestro con **solo CUIL, legajo y
    datos estables faltantes**; evitar duplicar importes y otros campos
    que ya trae Finnegans. Indicar qué columnas son requeridas según
    banco y cuáles son condicionales.
4.  Contratos TypeScript del modelo normalizado y esquema de
    conciliación, sin código de implementación todavía.
5.  Lista de **inconsistencias y bloqueantes** de los instructivos,
    especialmente Patagonia posiciones 104--196 vs longitud 96/tipo N, y
    el texto BNA de CBU de empresa en registro individual. **No inventes
    soluciones.**
6.  Plan de fases pequeñas F0--F6, entregables, pruebas, criterios de
    aceptación, riesgos y puntos de revisión humana.
7.  Preguntas indispensables para mí antes de programar, incluyendo
    distinción **banco pagador vs banco de cuenta del empleado**.
8.  Propuesta de estructura de carpetas, scripts y estrategia de
    commits. No usar múltiples agentes en la misma rama de trabajo.

Reglas obligatorias:

-   Nada de backend, DB, APIs, servicios cloud, autenticación,
    telemetría ni dependencia de Internet en operación.
-   CUIL exacto normalizado como clave; legajo como control. Nunca
    asociación automática por nombre.
-   Importes en centavos enteros, sin floats.
-   Nada de supuestos en layouts bancarios.
-   Solo datos sintéticos en tests y repositorio.
-   No generar TXT reales ni habilitar producción sin homologación
    bancaria.

**Terminá presentándome el plan y solicitando mi aprobación para
comenzar F0/F1.**
