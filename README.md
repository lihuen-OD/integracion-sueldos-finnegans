# Conversor de Haberes · Finnegans → Bancos

**Estado:** F0 cerrada. F1 (base técnica + spike XLSX) cerrada e
integrada en `main`. F2 (dominio, parsers, conciliación y readiness)
cerrada e integrada en `main` (merge técnico
`ba7eceda48aa115761327df3d690c8fc20360797`). **F3 (UI operativa)
cerrada, aprobada e integrada en `main`**: merge técnico
`e125d30435b2628242ebd6a93a59e622e2e20a4d`, informe en
`docs/informes/F3_UI_OPERATIVA.md`. **F4 (motor fixed-width genérico)
cerrada, aprobada e integrada en `main`**: merge técnico
`ab6f394c9523bee5fc81098a8de9e3b70387e5e4`, informe en
`docs/informes/F4_MOTOR_FIXED_WIDTH.md`. **F5 (Banco Nación)
técnicamente implementada, NO homologada**: CP-F5-A (contrato, spec y
aptitud), CP-F5-B (perfil v2, mapper, totales, serialización e
inspector) y CP-F5-C (fachada `run`, integración con readiness y golden
técnico sintético) ejecutados; BNA-1 sigue abierta y la generación
productiva se bloquea. No hay UI ni descarga conectadas en F5.
Siguen abiertos P-03, P-04, P-05, P-08, P-09, P-10, P-14, P-17, P-18,
P-20, P-21, P-22, P-23 y P-28, y los riesgos R-001 a R-005
(docs/07 §2.2 y §6); P-19 se cerró por aprobación humana el 26-10-2026.
En particular siguen abiertos P-18 (fuente oficial de los DV),
P-09/P-10 (mapeo de liquidaciones) y P-28 (regla 18, documento frente a
CUIL, diferida).
**Fecha de referencia:** 26-10-2026.
**No apto para pagos reales hasta homologación.**

## Objetivo

Aplicación **100 % local y offline** que recibe (1) una liquidación XLSX
de Finnegans, (2) un XLSX maestro de cuentas bancarias de empleados y
(3) parámetros del envío introducidos por un operador; cruza datos por
CUIL con control de legajo, valida y genera TXT específicos de **Banco
Nación (GT Pagos de Haberes)** y **Banco Patagonia (Plan Sueldos,
B.2)**.

No requiere backend, API, base de datos, usuario, servicio cloud ni
subida de nóminas. La app **no ejecuta transferencias**: genera archivos
para revisión y carga/autorización bancaria.

## Primeras decisiones

-   **Finnegans XLSX** es la fuente de importes y datos de liquidación.
    El TXT concatenado de Finnegans **no** es el formato prioritario.
-   **Maestro bancario XLSX** es la fuente de datos estables faltantes.
    No se guarda permanentemente en la app; RRHH mantiene el archivo
    fuera de ella.
-   **Perfil de empresa** (CUIT, convenios, cuenta de origen, mapeos):
    archivo importable/exportable, separado del maestro y sin datos de
    empleados. **Parámetros de envío** (fechas, números de envío): se
    completan en cada corrida y no se persisten.
-   **Cada archivo Finnegans corresponde a una sola empresa/CUIT.**
-   **CUIL** es la clave de asociación; **legajo** es un control
    secundario exacto (`007` ≠ `7`); nunca se asocia por nombre.
-   **La columna `Banco` de Finnegans determina el destino**: Nación →
    TXT BNA GT Haberes; Patagonia → TXT Patagonia B.2. Dos archivos
    independientes, generados sobre un motor fixed-width común.
-   Incidencias en cuatro niveles: `CORRECTO`, `INFORMACION`,
    `REQUIERE_REVISION`, `BLOQUEANTE`, cada una con alcance global o de
    un banco. Conciliación global (Finnegans = BNA + Patagonia +
    excluidos + pendientes, en cantidad y centavos) y **readiness
    independiente por banco**: un problema exclusivo de Patagonia no
    bloquea el TXT BNA, y viceversa. La aceptación final requiere pruebas
    con los bancos.

## Stack propuesto

-   React + TypeScript (modo `strict`) + Vite.
-   Tailwind CSS (UI) y componentes accesibles; sin fuentes/CDN remotos.
-   `exceljs` para XLSX, **aprobado** tras el spike de F1 (D-040) y
    encapsulado en el adaptador `src/import/xlsx/`: el resto de la app
    depende solo del contrato del adaptador.
-   Validadores propios, hechos a mano con mensajes controlados, sin
    Zod ni dependencias de esquema (D-051, D-058); funciones puras para
    reglas bancarias.
-   Vitest, React Testing Library y Playwright para pruebas.
-   ESLint, Prettier y TypeScript strict para calidad.
-   Motor **fixed-width** propio y genérico para los TXT; los layouts
    bancarios se declaran como datos con fuente y estado.
-   **Tauri 2** (o HTML único autocontenido) como empaquetado de
    escritorio offline **en F8**, una vez validado el núcleo web. No
    incorporar Rust al motor de negocio.

## Estructura objetivo

``` text
conversor-haberes/
├── CLAUDE.md
├── README.md
├── docs/
│   ├── 01_REQUISITOS.md
│   ├── 02_ARQUITECTURA.md
│   ├── 03_DATOS_Y_MAESTRO.md
│   ├── 04_CONTRATOS_BANCARIOS.md
│   ├── 05_PLAN_DE_TRABAJO.md
│   ├── 06_PRUEBAS_Y_SEGURIDAD.md
│   ├── 07_DECISIONES_Y_PENDIENTES.md
│   └── 08_PROMPT_CLAUDE_CODE.md
├── references/  # PDFs oficiales agregados localmente; no datos reales en git
├── src/         # lo crea Claude Code tras aprobar el plan
├── tests/
└── package.json
```

## Iniciar

1.  `references/` contiene, solo en el equipo local, los PDF oficiales
    y el Excel de muestra (inventario y SHA-256 en
    `docs/07_DECISIONES_Y_PENDIENTES.md` §3).
2.  Abrir la carpeta en Claude Code; `docs/08_PROMPT_CLAUDE_CODE.md`
    fue el prompt de la primera sesión (F0).
3.  Cada fase empieza con un plan detallado aprobado (docs/05). **No
    implementar generadores hasta aprobar contratos y resolver
    ambigüedades.**

## Desarrollo

Requiere Node 24 (`.nvmrc`). Sin red en runtime; la red solo se usa al
instalar dependencias y el navegador de pruebas.

``` sh
npm ci                        # instala dependencias exactas y activa el hook pre-commit
npx playwright install chromium
npm run verify                # typecheck, lint, formato, check:sensitive, unit, build, check:dist, e2e
npm run dev                   # desarrollo (sin CSP: el servidor usa WebSocket para recarga)
npm run build && npm run preview   # build de producción con CSP en http://127.0.0.1:4173
```

| Script | Qué hace |
|---|---|
| `typecheck` | `tsc` estricto para `src/` y para herramientas/tests |
| `lint` / `format:check` | ESLint (con protecciones de privacidad y capas) y Prettier |
| `test` / `test:e2e` | Vitest (unitarios y spike) / Playwright contra el build |
| `check:sensitive` | Busca forma de CUIL/CBU (en todo el repositorio, fixtures incluidos, D-042) y archivos de datos (también corre en el hook pre-commit) |
| `check:dist` | Verifica CSP, ausencia de sourcemaps y hosts embebidos en `dist/` |
| `fixtures:synthetic` | Escribe fixtures sintéticos en `tests/fixtures/synthetic/generated/` (ignorado) |
| `spike:t10` | Prueba local con el Excel real; requiere `T10_FINNEGANS_PATH` y solo imprime agregados |
| `local:f2` | Pruebas locales opt-in de F2 con archivos reales, solo agregados: conciliación (`F2_FINNEGANS_PATH`) y variantes de `Descripcion` para P-10 (`F2_DESCRIPCION_PATHS`, rutas separadas por `:`), sin crear reglas ni mapeos |

## Fuentes autorizadas

Solo los documentos de `references/` son fuente de reglas bancarias:

-   BNA: `BNA_Instructivo_Pago_Haberes_GT.pdf` (**Pago de Haberes GT**;
    no confundir con el PDF BNA **Pago a Proveedores/Terceros**).
-   Patagonia: `Patagonia_Diseno_Registros_Plan_Sueldos.pdf`, sección
    **B.2** (fuente principal), obtenido de la guía de implementación
    Patagonia Sueldo → "Descargar Diseño de Registro";
    `Patagonia_Instructivo_Excel_Acreditaciones.pdf` como evidencia
    complementaria.
-   Finnegans: `Finnegans_Reporte_Ejemplo.xlsx`, real; contiene
    información personal: no incluir en repositorios, tests ni
    documentación.

**No guardar, commitear, registrar en logs ni compartir nóminas, CUIL,
CBU o importes reales.**
