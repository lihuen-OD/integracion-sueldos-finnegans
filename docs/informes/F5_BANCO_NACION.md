# F5 · Banco Nación

**Estado:** F5 **cerrada**, aprobada por auditoría humana e integrada en
`main`. HEAD F5 aprobado: `4803919db30970fa727ba843cd349e64e278b756`.
Merge técnico `--no-ff`: `1ea3b1d8a2ef2ad662cfed5667a7361989a46e12`.
Padres del merge: `0e3653252d89ccca2affc379d42bcfa262d3b9d6` (`main`)
y `4803919db30970fa727ba843cd349e64e278b756`
(`f5-banco-nacion`). Fecha de cierre: 26-10-2026.

F5 queda **NO homologada** y la aplicación sigue **NO apta para pagos
reales** hasta F7. BNA-1 continúa `BLOQUEADA`: la generación productiva
devuelve `CONTRATO_BNA_BLOQUEADO` y la API pública no puede devolver
`GENERADO`.

## 1. Objetivo

Entregar la capa Banco Nación GT Pagos de Haberes: contrato documental y
spec de 47 campos en 3 registros de 200 bytes, aptitud contractual,
perfil v2, mapper, totales, serialización, inspector independiente,
fachada `run` integrada con la readiness de F2 y golden técnico
sintético, sin habilitar la generación productiva mientras BNA-1 siga
bloqueada y sin declarar homologación bancaria.

## 2. Alcance

-   Contrato BNA, trazabilidad documental, spec y `crearSpecBna`.
-   `aptitudBna` compatible con D-075 y D-078.
-   Perfil v2 versionado, sin migración desde v1.
-   Modelo puro `PerfilBna` / `PagoBna` / `ParametrosEnvioBna` y política
    productiva sin resolución para BNA-1, BNA-2, BNA-6, P-09/P-10 y
    BNA-11/P-17.
-   Mapper BNA puro, totales/cantidades exactos en `Centavos` y límites
    de layout.
-   Serialización por la API pública de fixed-width e inspector
    independiente que relee bytes.
-   Fachada `src/run/generacionBna.ts`, con readiness existente,
    compuertas y unión discriminada de resultados.
-   Golden técnico 100 % sintético y guardrails de capa.
-   Sin UI, descarga, red, persistencia, telemetría ni datos reales.

## 3. Checkpoints y auditorías

| Checkpoint | Contenido                                                                 | Estado                            |
| ---------- | ------------------------------------------------------------------------- | --------------------------------- |
| CP-F5-A    | Contrato, spec, trazabilidad y aptitud                                    | Aprobado por auditoría humana     |
| CP-F5-B    | Perfil v2, modelo, política, mapper, totales, serialización e inspector    | Aprobado por auditoría humana     |
| CP-F5-C    | Fachada `run`, integración con readiness, golden y guardrails             | Corregido tras auditoría y aprobado |
| Cierre F5  | Merge `--no-ff` a `main` y verify post-merge                              | Aprobado e integrado              |

La auditoría de CP-F5-C detectó dos hallazgos, ambos corregidos antes de
la aprobación:

1.  La fachada productiva exponía `politica`, `aptitud`, `serializar` e
    `inspeccionar` como entradas públicas. Se eliminaron: la entrada
    pública solo admite `perfil`, `conciliacion` y `parametros`.
2.  El guardrail de `src/run/**` aceptaba cualquier ruta de
    `src/banks/bna/**`, incluidos sus internals. Ahora solo acepta los
    entry points públicos de BNA.

## 4. Commits de F5

| Commit    | Contenido                                                        |
| --------- | ---------------------------------------------------------------- |
| `ba7563a` | Contrato y checkpoints F5                                        |
| `1528155` | Trazabilidad bancaria y spec contractual                         |
| `a4de29a` | Tests de contrato y aptitud                                      |
| `3500c9e` | Guardrails de la capa BNA                                        |
| `89be9d9` | Corrección de contrato y guardrails CP-F5-A                      |
| `da26d29` | Perfil v2 versionado                                             |
| `2a30d4a` | Mapper, totales, serialización e inspector                       |
| `f75150c` | Registro documental de perfil v2 y capa BNA                      |
| `2c01b2b` | Integración de generación BNA con readiness                      |
| `da40c5e` | Integración y golden sintético                                   |
| `0887ba8` | Guardrail de la fachada run                                      |
| `a5e60ca` | Cierre documental de la implementación técnica                   |
| `348b08c` | Cierre de bypasses de test en generación BNA                     |
| `4803919` | Precisión documental del aislamiento productivo                  |

## 5. Contratos

-   **Spec BNA:** 47 campos distribuidos en R1, R2 y R3; cada registro
    mide 200 bytes.
-   **Estados:** BNA-1 a BNA-11 documentados con origen y fuente. Los
    bloqueos B se detectan con el mecanismo genérico de F4; las
    interpretaciones pendientes no se redefinen como bloqueos (D-078).
-   **Separadores:** `lineSeparator` y `trailingSeparator` son entradas
    explícitas de `crearSpecBna`. LF/CRLF son hipótesis técnicas sin
    default productivo (BNA-9, D-084).
-   **Perfil v2:** `schemaVersion: '2'`, CUIT empresa, nombre opcional,
    catálogo de bancos, `bna` con CBU empresa, convenio y moneda, y
    `mapeosLiquidacion` vacío. v1 no se migra ni se reinterpreta
    (D-059, D-079).
-   **P-19:** permanece **RESUELTA** por decisión humana explícita. El
    formato versionado v1+v2 se implementó sin migración silenciosa.

## 6. Arquitectura

-   `src/banks/bna/contrato.ts`, `spec.ts`, `aptitud.ts`,
    `trazabilidad.ts`: contrato documental, geometría, aptitud y
    metadata.
-   `src/banks/bna/politica.ts`: `POLITICA_BNA_PRODUCTIVA` devuelve
    ausencia de resolución para BNA-1, BNA-2, BNA-6, P-09/P-10 y
    BNA-11/P-17; no contiene `02`/`96`, `0000`/`0003` ni defaults.
-   `src/banks/bna/mapeo.ts`: mapper puro y determinista; no infiere
    valores y calcula R3 sobre la misma lista de pagos.
-   `src/banks/bna/totales.ts`: límites de importe, total y cantidad en
    `Centavos`/`bigint`, sin `Number` ni redondeo.
-   `src/banks/bna/serializacion.ts`: delega la escritura en la API
    pública de fixed-width; no importa internals del motor.
-   `src/banks/bna/inspeccion.ts`: usa el parser de F4 y verifica
    totales, cantidad, límite de total y alfabeto sobre bytes RAW.
    BNA-10 es una advertencia no bloqueante.
-   `src/run/generacionBna.ts`: fachada que compone perfil,
    conciliación, readiness, aptitud, política, mapper, serializer e
    inspector. No duplica reglas de F2/F4.

Ninguna capa BNA importa UI, importación, conciliación, `run`,
exportación, Patagonia, React ni ExcelJS. La UI no importa `banks/**`.

## 7. Fachada productiva y cierre de bypasses

La entrada pública es exactamente:

```ts
export interface EntradaGeneracionBna {
  readonly perfil: CompanyProfileImportado | null;
  readonly conciliacion: ResultadoConciliacion | null;
  readonly parametros: ParametrosEnvioBna | null;
}
```

La fachada productiva:

-   calcula siempre `aptitudBna(crearSpecBna(parametros))`;
-   usa siempre `POLITICA_BNA_PRODUCTIVA`;
-   usa siempre `serializarBna` e `inspeccionarBna`.

No existe `__testOnly`, `generarBnaUnsafe`, `generarBnaTecnico`, fábrica
exportada de dependencias, `testMode`, variable global, variable de
entorno ni backdoor equivalente. Un test de contrato de tipos impide
reintroducir `aptitud`, `politica`, `serializar` o `inspeccionar` en la
entrada.

Mientras BNA-1 siga `BLOQUEADA`:

-   `generarBna({ perfil, conciliacion, parametros })` devuelve
    `CONTRATO_BNA_BLOQUEADO` con referencia a BNA-1 y sin bytes;
-   `GENERADO`, `SERIALIZACION_FALLIDA` e `INSPECCION_BNA_FALLIDA` son
    inalcanzables desde la API pública;
-   esas ramas se prueban por capas técnicas con `vi.mock` confinado a
    `tests/**`, sin abrir un bypass productivo.

## 8. Golden técnico sintético

`tests/fixtures/synthetic/golden/bna-tecnico-sintetico.json` conserva:

-   2 pagos sintéticos;
-   total `84000050` centavos;
-   LF;
-   sin separador final;
-   SHA-256 `c883ef4e50f3962ecb09a2638728ea0d583a7e1c873e19eb1314e5fc47d9e3a6`;
-   etiqueta **GOLDEN TÉCNICO SINTÉTICO — NO HOMOLOGADO POR BANCO
    NACIÓN.**

El test compone directamente `perfilBnaDesdePerfil` +
`pagosBnaDesdeConciliacion` + `serializarBna` + `inspeccionarBna` con
política sintética de test. No atraviesa la fachada productiva ni
sustituye la aptitud contractual. El golden demuestra capacidad técnica
de las capas inferiores, no habilitación productiva ni aceptación
bancaria.

## 9. Guardrails

-   `src/banks/bna/**` solo alcanza su subárbol, la API pública de
    fixed-width, `banks/trazabilidad`, `domain` y `shared`.
-   `src/run/**` solo alcanza su subárbol, perfil, conciliación, **los
    entry points públicos de BNA** (`../banks/bna`,
    `../banks/bna/index`, `../banks/bna/index.ts`), la huella del
    maestro, `domain` y `shared`.
-   Desde `run` se rechazan los internals BNA (`modelo`, `spec`,
    `mapeo`, `politica`, `serializacion`, `inspeccion`), sus traversals,
    internals de fixed-width, Patagonia, UI, exportación, XLSX, React,
    ExcelJS, bare packages, builtins, alias y rutas absolutas.
-   Los imports dinámicos exigen un specifier literal verificable.

## 10. Decisiones

F5 se apoya en D-078 a D-085:

-   D-078: aptitud BNA compatible con D-075.
-   D-079: perfil v2 congelado e implementado.
-   D-080: trazabilidad bancaria genérica.
-   D-081: mapper BNA puro y determinista.
-   D-082: totales y límites BNA.
-   D-083: fachada de integración, con entrada pública cerrada.
-   D-084: goldens sintéticos e hipótesis explícitas.
-   D-085: checkpoints F5, **completada** con el cierre e integración.

No se creó D-086. No se cerró ninguna pregunta bancaria adicional.

## 11. Cobertura y tests

| Área                  | Tests | Cobertura (stmt / branch / func / lines) |
| --------------------- | ----: | ---------------------------------------- |
| Fachada `run` BNA     |    31 | 100 / 100 / 100 / 100                    |
| `src/banks/bna/**`    |   118 | 98,34 / 96,33 / 100 / 98,3               |
| Conciliación          |   111 | 100 / 97,4 / 100 / 100                   |
| Perfil                |    30 | 93,01 / 90,76 / 93,33 / 92,97            |
| Fixed-width           |   161 | 99,22 / 95,7 / 100 / 99,18               |
| Guardrails            |   178 | —                                        |
| Golden técnico        |     3 | —                                        |
| **Suite total**       | **1077 en 65 archivos** | —                          |

## 12. Verify de cierre

Ejecutado sobre `main` después del merge `--no-ff`:

-   `npm run verify`: **verde**.
-   Typecheck, lint y `format:check`: **OK**.
-   `check:sensitive`: **sin hallazgos** (216 archivos).
-   Tests: **65 archivos / 1077 tests**.
-   Playwright: **23/23**.
-   Build: **OK**.
-   `check:dist`: **OK**.

## 13. Pendientes que siguen abiertos

Siguen abiertas las preguntas bancarias:

-   **BNA-1, BNA-2, BNA-5, BNA-6, BNA-7, BNA-8, BNA-9, BNA-10,
    BNA-11.**
-   **P-09, P-10, P-17, P-18, P-21, P-23.**

P-19 permanece **RESUELTA**. No se agregó ningún `ContractStatus` nuevo ni
se convirtió una interpretación pendiente en bloqueo.

## 14. Límites deliberados

-   F5 no inicia F6 ni F7.
-   No hay UI ni descarga conectadas a la generación BNA.
-   No se generan archivos reales ni se ejecutan transferencias.
-   No hay red, persistencia, telemetría ni datos productivos.
-   La rama `f5-banco-nacion` se conserva local y remota.
-   La aplicación sigue **NO apta para pagos reales** hasta la
    homologación bancaria y el cierre de F7.

## 15. Referencias

-   `docs/02_ARQUITECTURA.md`
-   `docs/03_DATOS_Y_MAESTRO.md`
-   `docs/04_CONTRATOS_BANCARIOS.md`
-   `docs/05_PLAN_DE_TRABAJO.md`
-   `docs/06_PRUEBAS_Y_SEGURIDAD.md`
-   `docs/07_DECISIONES_Y_PENDIENTES.md`
-   `src/run/generacionBna.ts`
-   `src/banks/bna/**`
-   `tests/fixtures/synthetic/golden/bna-tecnico-sintetico.json`
