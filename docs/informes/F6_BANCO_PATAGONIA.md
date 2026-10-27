# F6 · Banco Patagonia — CP-F6-A

**Estado:** CP-F6-A ejecutado; **STOP pendiente de auditoría humana**.
**Rama:** `f6-banco-patagonia`.
**Base:** `main` `927b8b4d3214b680023a8fd884158778b363449a`.
**Fecha:** 27-10-2026.

CP-F6-B, F7 y cualquier generación productiva **no están iniciados**. La
aplicación sigue **NO apta para pagos reales** hasta resolver los bloqueos
bancarios y completar la homologación.

## 1. Alcance ejecutado

Se implementaron exclusivamente:

- contrato documental `PAT-1`…`PAT-17`;
- trazabilidad de cada campo con `origin`, `source.doc`, `source.paginas` e
  `issues`, reutilizando `src/banks/trazabilidad.ts`;
- spec técnica B.2 con R0/R1/R2 de 200 bytes y estructura `0 (1 2+)+`;
- hipótesis técnicas explícitas para PAT-1, PAT-2 y PAT-14, sin defaults;
- aptitud contractual compatible con D-075/D-078;
- guardrail de aislamiento de `src/banks/patagonia-b2/**`;
- tests sintéticos, cobertura y documentación.

No se implementaron mapper, totales productivos, loteo productivo, nombre
productivo, serialización bancaria, inspector Patagonia, fachada `run`, golden
files, `CompanyProfileV3` ni parámetros de envío productivos.

## 2. Análisis inicial aprobado y correcciones

La auditoría humana aprobó el análisis inicial con estas precisiones:

- **H-01 → PAT-17 formal.** El R2 campo 8 dice “Código del banco donde está
  radicada la cuenta de acreditación” y no fija `034`. El `034` fijo
  documentado es el R0 campo 2. PAT-17 queda `INTERPRETACION_PENDIENTE`,
  afecta bytes/validación/readiness y requiere confirmación de Banco
  Patagonia.
- **H-02 → fuera de alcance.** F6 implementa solo B.2 acreditación Plan
  Sueldos (R1 campo 3 = `2`). El tipo de movimiento `4` queda
  `FUERA_DE_ALCANCE_F6`.
- **H-03 → observación documental.** “Movimientos” de PAT-XL no se mapea a
  ningún campo B.2.
- **H-04 → cubierto por PAT-7/P-09/P-10.** No se inventa correspondencia
  entre “Código de concepto” de PAT-XL y R1 concepto o R2 tipo de
  liquidación.
- **H-05 → absorbido por PAT-17.** No se crea un catálogo nuevo de bancos.

La regla actual de entidad Patagonia `034` (D-012, D-056, catálogo de destinos
y `reglaBancoCompatible`) queda **congelada**. No se modificó
`src/reconciliation/**`, no se habilitaron cuentas de otros bancos, no se quitó
la validación actual y no se cambió D-056.

## 3. Inventario PAT

| ID | Estado | Afecta bytes | Tema |
|---|---|---|---|
| PAT-1 | **BLOQUEADA** | Sí | R2 campo 16: 93 posiciones reales vs. 96 declaradas |
| PAT-2 | **BLOQUEADA** | Sí | Código de dependencia `N`/`A`: alineación y relleno |
| PAT-3 | INTERPRETACION_PENDIENTE | No | Campos que deben coincidir con el alta |
| PAT-4 | INTERPRETACION_PENDIENTE | Sí | Provincia si no aplica |
| PAT-5 | INTERPRETACION_PENDIENTE | Sí | Número de envío |
| PAT-6 | INTERPRETACION_PENDIENTE | Sí | Número de EMPRESA vs. convenio |
| PAT-7 | INTERPRETACION_PENDIENTE | Sí | Anexo III |
| PAT-8 | INTERPRETACION_PENDIENTE | Sí | Anexo I |
| PAT-9 | INTERPRETACION_PENDIENTE | Sí | Apellido y nombre |
| PAT-10 | INTERPRETACION_PENDIENTE | No | Nombre de archivo |
| PAT-11 | INTERPRETACION_PENDIENTE | Sí | Variante de detalle |
| PAT-12 | INTERPRETACION_PENDIENTE | Sí | Caracteres en concepto |
| PAT-13 | INTERPRETACION_PENDIENTE | Sí | Loteo |
| PAT-14 | INTERPRETACION_PENDIENTE | Sí | Encoding y fin de línea |
| PAT-15 | INTERPRETACION_PENDIENTE | Sí | Versión del registro 1 |
| PAT-16 | INTERPRETACION_PENDIENTE | Sí | Comprobante no informado |
| PAT-17 | INTERPRETACION_PENDIENTE | Sí | Código de banco del registro 2 |

PAT-1 y PAT-2 son las únicas `BLOQUEADA`. Las `INTERPRETACION_PENDIENTE` no se
convirtieron en `B`.

## 4. Geometría y spec técnica

| Registro | Longitud | Campos | Cobertura |
|---|---:|---:|---|
| R0 cabecera general | 200 | 14 | 1–200 |
| R1 cabecera de lote | 200 | 11 | 1–200 |
| R2 detalle | 200 | 17 | 1–200 |

Estructura: `0 (1 2+)+`.

Discriminadores: R0 `0`, R1 `1`, R2 `2`.

La spec usa solo la API pública de F4 y la metadata de trazabilidad existente.
No se modificó `src/banks/fixed-width/**`.

## 5. PAT-1: hipótesis explícita

R2 campo 16:

- posiciones reales: 104–196;
- longitud geométrica: **93**;
- longitud declarada documentalmente: **96**;
- nombre documental: “Espacios”;
- tipo documental: `N`;
- estado: **BLOQUEADA**.

`crearSpecPatagoniaB2` exige una de estas hipótesis, sin default:

- `ESPACIOS` → `type: 'A'`, `SPACE_RIGHT`, 93 espacios;
- `CEROS` → `type: 'N'`, `ZERO_LEFT`, 93 ceros.

En ambos casos:

- el `FieldSpec` mide 93 y es técnicamente válido;
- PAT-1 sigue `BLOQUEADA`;
- la aptitud sigue bloqueada;
- no se afirma que la hipótesis sea la decisión bancaria correcta.

El `96` se conserva como metadata documental
(`PAT1_LONGITUD_DECLARADA_DOCUMENTAL`) y en las notas de trazabilidad, nunca
como `declaredLength` del motor F4.

## 6. PAT-2: hipótesis explícita

R2 campo 13, código de dependencia. La documentación es contradictoria:

- `N` en B.2 p.9 y Anexo A.3;
- `A` en A.2, A.4 y A.6.

`crearSpecPatagoniaB2` exige una de estas hipótesis, sin default:

- `NUMERICA` → `N`, `ZERO_LEFT`;
- `ALFANUMERICA` → `A`, `SPACE_RIGHT`.

En ambos casos PAT-2 sigue `BLOQUEADA`; no se modifica el maestro, no se
normaliza `PAT_CODIGO_DEPENDENCIA` y no se elige una hipótesis productiva.

## 7. PAT-14: archivo físico

`lineSeparator` y `trailingSeparator` son obligatorios y explícitos:

- `lineSeparator`: `'\n'` o `'\r\n'`;
- `trailingSeparator`: `true` o `false`.

Ambos quedan `INTERPRETACION_PENDIENTE`. No se infiere LF por Unix, CRLF por
Windows ni salto final. El charset técnico es `ASCII_PRINTABLE`; no se afirma
que Patagonia exija ASCII.

## 8. Aptitud contractual

`aptitudPatagonia(spec)`:

- usa `hallarBloqueosGeneracion()` como único detector de `BLOQUEADA`;
- hoy devuelve dos bloqueos: `r2_codigoDependencia` y `r2_rellenoPat1`;
- `generadorHabilitado` es `false`;
- informa las `I` que afectan bytes y las que no;
- no convierte `I` en `B`;
- PAT-17 aparece entre las interpretaciones que afectan bytes, nunca como
  bloqueo;
- no evalúa conciliación, P-09/P-10, datos de empleado, readiness, perfil
  cargado ni parámetros de corrida;
- no modifica D-075/D-078.

## 9. CompanyProfileV3: decisión futura

Queda aprobada arquitectónicamente una futura `CompanyProfileV3`, **no
implementada en CP-F6-A**:

```ts
interface CompanyProfileV3 {
  schemaVersion: '3';
  cuitEmpresa: CuitEmpresaEstructural;
  nombreEmpresa: string | null;
  catalogoBancos: readonly BancoCatalogado[];

  bna: {
    cbuEmpresa: Cbu;
    codigoConvenio: string;
    moneda: '0' | '1';
  };

  patagonia: {
    numeroEmpresa: string;
  };

  mapeosLiquidacion: readonly [];
}
```

Reglas: v1 y v2 quedan exactamente intactos; no hay migración, fallback ni
defaults; la versión declarada determina el contrato; la exportación conserva
la versión; V3 mantiene la configuración BNA de V2 y agrega solo
`patagonia.numeroEmpresa`. No agrega cuenta de empleados, documento, sucursal,
`PAT_CODIGO_BANCO` ni mapeos reales; `mapeosLiquidacion` sigue vacío.

PAT-6 sigue abierta: `numeroEmpresa` representa el “Número de EMPRESA otorgado
por el banco” de PAT-DR; no se afirma que sea el “número de convenio” de
PAT-XL.

## 10. Guardrails

Se agregó una whitelist para `src/banks/patagonia-b2/**` que permite solo:

- su propio subárbol;
- la API pública de `fixed-width` (`../fixed-width`, `index`, `index.ts`);
- `banks/trazabilidad`;
- `src/domain/**`;
- `src/shared/**`.

Rechaza BNA, internals de fixed-width, UI, import/XLSX, conciliación, `run`,
exportación, React, ExcelJS, paquetes npm, builtins, alias, rutas absolutas,
`import()` dinámico no verificable y traversals. BNA sigue sin poder importar
Patagonia y fixed-width sigue sin poder importar bancos.

## 11. Tests y verificación

Comandos ejecutados:

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/banks/patagonia-b2` | **47 tests / 4 archivos, 47 passed** |
| `npx vitest run tests/guardrails/eslint-guardrails.test.ts` | **219 tests / 1 archivo, 219 passed** |
| `npx vitest run tests/unit/banks/fixed-width` | **161 tests / 11 archivos, 161 passed** |
| `npx vitest run tests/unit/banks/bna tests/integration/generacionBna.integracion.test.ts` | **139 tests / 9 archivos, 139 passed** |
| `npm run verify` | **69 archivos, 1165 tests passed; 23 e2e passed; typecheck, lint, format, check:sensitive, build y check:dist OK** |

Cobertura de `src/banks/patagonia-b2/**`:

- statements: **97,82 %**;
- branches: **97,14 %**;
- functions: **100 %**;
- lines: **97,82 %**.

`check:sensitive`: sin hallazgos (225 archivos).

## 12. Archivos

Creados:

- `src/banks/patagonia-b2/contrato.ts`
- `src/banks/patagonia-b2/spec.ts`
- `src/banks/patagonia-b2/aptitud.ts`
- `src/banks/patagonia-b2/index.ts`
- `tests/unit/banks/patagonia-b2/contrato.test.ts`
- `tests/unit/banks/patagonia-b2/spec.test.ts`
- `tests/unit/banks/patagonia-b2/aptitud.test.ts`
- `tests/unit/banks/patagonia-b2/trazabilidad.test.ts`
- `docs/informes/F6_BANCO_PATAGONIA.md`

Modificados:

- `eslint.guardrails.js`
- `tests/guardrails/eslint-guardrails.test.ts`
- `vitest.config.ts`
- `docs/04_CONTRATOS_BANCARIOS.md`
- `docs/05_PLAN_DE_TRABAJO.md`
- `docs/07_DECISIONES_Y_PENDIENTES.md`

Sin cambios:

- `src/banks/fixed-width/**`
- `src/banks/bna/**`
- `src/reconciliation/**`
- `src/profile/**`
- UI
- `src/run/**`

## 13. Pendientes y próximo paso

- PAT-1 y PAT-2 siguen `BLOQUEADA`.
- PAT-17 sigue `INTERPRETACION_PENDIENTE`; P-30 abierta para confirmación de
  Banco Patagonia.
- No se resolvió ningún pendiente bancario.
- CP-F6-A queda a la espera de auditoría humana.
- **CP-F6-B no iniciado.**
- **F7 no iniciado.**
- La app sigue **NO apta para pagos reales**.

# STOP
