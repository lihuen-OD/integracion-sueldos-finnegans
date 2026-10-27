# F6 · Banco Patagonia — CP-F6-A / CP-F6-B / CP-F6-C

**Estado:** CP-F6-C ejecutado; **STOP pendiente de auditoría humana**.
**Rama:** `f6-banco-patagonia`.
**Base:** CP-F6-B aprobado en
`b3e3a60f07b6b28f6d6fe42822843b5909552809`; `main` de partida
`927b8b4d3214b680023a8fd884158778b363449a`.
**Fecha:** 27-10-2026.

CP-F6-C integra la capa técnica de Patagonia B.2, pero **no homologa el banco
ni habilita pagos reales**. CP-F6-C no está aprobado hasta la auditoría humana;
F6 no se cierra y F7 no se inicia. La aplicación sigue **NO apta para pagos
reales** hasta resolver los bloqueos bancarios y completar la homologación.

## 1. Alcance ejecutado

### 1.1 CP-F6-A · base auditada

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

### 1.2 CP-F6-B · este checkpoint

Se implementó la capa técnica pura de Patagonia B.2 y el perfil V3, sin cerrar
ninguna pregunta bancaria:

- **`CompanyProfileV3`** en `src/profile/**`: la misma configuración BNA que
  v2 más `patagonia.numeroEmpresa`; v1 y v2 quedan exactamente intactos; no
  hay migración, fallback ni defaults; la exportación conserva la versión
  declarada. `numeroEmpresa` se persiste exactamente como 1–4 dígitos ASCII,
  sin relleno ni normalización. `mapeosLiquidacion` sigue vacío y las claves
  desconocidas se rechazan.
- **Modelo puro** (`modelo.ts`): pagos ya conciliados, dinero
  `Centavos`/`bigint`, sin CBU/CUIL/datos de alta ni decisiones escondidas.
- **Política** (`politica.ts`): toda decisión abierta pasa por
  `PoliticaPatagonia`. La política productiva devuelve `SIN_RESOLUCION` para
  P-20, PAT-4, PAT-7/P-09/P-10, PAT-9/P-14, PAT-15 y PAT-16. Las resoluciones
  sintéticas viven solo en `tests/**`.
- **Nombre** (`nombre.ts`): aplica únicamente mayúsculas, eliminación de
  acentos/diéresis y Ñ→N; orden, separador, recorte, colapso y truncamiento
  exigen una `DecisionNombrePatagonia` explícita. No hay truncamiento
  silencioso.
- **Validaciones** (`validacion.ts`): formas técnicas, catálogos Anexo I/II,
  longitudes de la spec y fechas AAAAMMDD sin `Date` ni calendario. PAT-5 solo
  aplica la prohibición PAT-DR de `99`; no impone 1–70 ni decide `00`. PAT-7
  valida forma de 3 dígitos sin imponer catálogo DR/XL.
- **Totales y loteo** (`totales.ts`, `loteo.ts`): límites derivados de la
  geometría, máximos 999 detalles por lote y 9999 lotes, validación técnica
  separada de la estrategia y cobertura por identidad/orden de los mismos
  pagos. No hay estrategia de loteo por default.
- **Mapper** (`mapeo.ts`): `EntradaRegistro[]` puro con R0 + (R1 + R2*)+;
  PAT-4 solo exige provincia para el tipo documental `004`; PAT-8 usa Anexo I
  PAT-DR; PAT-17 toma el código de banco del dato para R2 y mantiene `034`
  fijo solo en R0. No serializa bytes, no genera TXT, no descarga, no usa
  inspector, golden, UI ni fachada `run`.
- **Frontera mínima de `run`**: el único cambio autorizado en `src/run/**` es
  la ampliación de tipo de `perfilVersion` a `'3' | null` para representar el
  perfil V3 en la evaluación BNA; no se conecta Patagonia a la fachada.

PAT-1 y PAT-2 siguen `BLOQUEADA`; PAT-17 sigue `INTERPRETACION_PENDIENTE`;
P-30 y las demás preguntas siguen abiertas. En ese momento, CP-F6-C y F7 no
estaban iniciados.

### 1.3 CP-F6-C · este checkpoint

Se implementó la integración técnica completa, sin homologar el banco:

- **Serialización** (`serializacion.ts`): mapper → `crearSpecPatagoniaB2` →
  `serializarArchivo` de la API pública F4. No duplica fixed-width,
  posiciones, padding ni defaults; no hace I/O ni crea `Blob`; cualquier error
  devuelve error sin bytes parciales.
- **Inspector** (`inspeccion.ts`): recibe solo bytes y
  `ConfiguracionTecnicaPatagonia`, usa la inspección pública F4 y reconstruye
  R0/R1/R2, cantidades, totales, importes, pertenencia R2-R1, EMPRESA y envío.
  No usa mapper, perfil, conciliación ni política; no convierte
  `INTERPRETACION_PENDIENTE` en error.
- **Fachada** (`src/run/generacionPatagonia.ts`): entrada exacta `perfil`,
  `conciliacion` y `parametros`; sin política, aptitud, serializer, inspector,
  mapper, spec, callbacks ni bypasses. Usa siempre
  `POLITICA_PATAGONIA_PRODUCTIVA`, `aptitudPatagonia`,
  `serializarPatagonia` e `inspeccionarPatagonia`.
- **Perfil**: exige `CompanyProfileV3`; v1/v2 devuelven
  `CONFIGURACION_INCOMPLETA`; solo se copia
  `{ numeroEmpresa: perfil.patagonia.numeroEmpresa }`. No hay migración ni
  copia de BNA.
- **Readiness**: se reutiliza `evaluarReadiness` con Patagonia como banco
  evaluado y BNA no configurado/no habilitado.
- **Compuertas**: configuración incompleta, conciliación ausente/global
  pendiente/global bloqueada, sin registros, bloqueantes/revisiones Patagonia,
  contrato bloqueado, mapeo no resuelto, fallo de serialización, fallo de
  inspección y generado. P-09/P-10 se consumen como
  `LIQUIDACION_SIN_MAPEO`; `tipoLiquidacion()` productivo sigue
  `SIN_RESOLUCION`.
- **Compuerta crítica**: con PAT-1/PAT-2 `BLOQUEADA`, una entrada válida
  devuelve `CONTRATO_PATAGONIA_BLOQUEADO` antes de serializar. Desde la API
  productiva actual, `GENERADO`, `SERIALIZACION_FALLIDA` e
  `INSPECCION_PATAGONIA_FALLIDA` solo se alcanzan con mocks bajo `tests/**`.
- **Golden**: 100 % sintético, composición directa de capas, sin pasar por la
  fachada; 2 pagos, 2 lotes, PAT-1 `ESPACIOS`, PAT-2 `NUMERICA`, LF sin salto
  final, total `84000050`, 1004 bytes, SHA-256
  `36f55f2a0aee04e944c5347ecde62f6c8722418f8b0bca86ebf1a408848a7ade` y
  etiqueta `GOLDEN TÉCNICO SINTÉTICO — NO HOMOLOGADO POR BANCO PATAGONIA.`.
- **Guardrail**: `run` solo puede importar Patagonia por su entry point
  público; se agregan tests de internals, traversals y bypasses.

No se modificó `src/banks/fixed-width/**`, `src/banks/bna/**`,
`src/reconciliation/**`, `docs/04_CONTRATOS_BANCARIOS.md`, UI, persistencia,
red ni filesystem. No se resolvió ninguna pregunta bancaria.

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

## 9. CompanyProfileV3: decisión e implementación

La `CompanyProfileV3` fue aprobada arquitectónicamente en CP-F6-A e
**implementada en CP-F6-B** (ver §11). El contrato es:

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

## 11. CP-F6-B · CompanyProfileV3

`src/profile/**` implementa el contrato exacto de D-087:

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

Reglas implementadas y probadas:

- v1 y v2 siguen validando, serializando y exportando su versión real;
- la versión declarada decide el contrato; `"3"` no se acepta como v2 y un
  v2 no se completa con Patagonia por default;
- no hay migración ni conversión silenciosa;
- `patagonia.numeroEmpresa` exige 1–4 dígitos ASCII y se persiste exactamente;
- `mapeosLiquidacion` sigue vacío; claves desconocidas en raíz, `bna` o
  `patagonia` se rechazan;
- `perfilVersionadoDesdeBytes` y `serializarPerfilVersionado` conservan la
  versión real.

PAT-6 sigue abierta: `numeroEmpresa` representa el “Número de EMPRESA otorgado
por el banco” de PAT-DR; no se afirma que sea el “número de convenio” de
PAT-XL.

## 12. CP-F6-B · modelo, política y nombre

- `modelo.ts` contiene solo `PerfilPatagonia`, `PagoPatagonia` y
  `ParametrosEnvioPatagonia`. El pago incluye cuenta, documento, dependencia,
  legajo, apellido, nombre y `DescripcionLiquidacion`; no incluye CBU, CUIL,
  CUIT ni datos de alta. El dinero es `Centavos`/`bigint`.
- `politica.ts` define `PoliticaPatagonia` y
  `POLITICA_PATAGONIA_PRODUCTIVA`. La política productiva no resuelve P-20,
  PAT-4, PAT-7/P-09/P-10, PAT-9/P-14, PAT-15 ni PAT-16. `resuelto` y
  `sinResolucion` son helpers de composición; las políticas sintéticas de
  test no viven en `src/`.
- `nombre.ts` separa las transformaciones aprobadas (mayúsculas,
  acentos/diéresis y Ñ→N) de las decisiones pendientes. `NombrePatagonia`
  conserva `original`, `generado`, `transformado` y `truncado`. Si el valor
  supera 20 y la decisión no autoriza truncar, devuelve error; no recorta en
  silencio. El alfabeto no respaldado se rechaza después de las
  transformaciones aprobadas y antes del corte.

## 13. CP-F6-B · validaciones, totales y loteo

- `validacion.ts` toma las longitudes de la spec canónica y valida: número de
  EMPRESA, fechas AAAAMMDD, número de envío, concepto, tipo/número de cuenta,
  banco, sucursal, tipo/número de documento, provincia, dependencia, nombre,
  tipo de liquidación, comprobante y versión.
- PAT-5 solo aplica la prohibición PAT-DR de `99`; acepta `00`, `70` y `71`
  como formas, sin imponer el rango 1–70 de PAT-XL.
- PAT-7 valida solo forma de 3 dígitos; no impone catálogo PAT-DR/PAT-XL.
- PAT-8 usa el Anexo I PAT-DR, que incluye `004`.
- PAT-4 no decide `00` frente a espacios: el campo es N y la política debe
  resolver un valor de 2 dígitos cuando la provincia no aplica.
- `totales.ts` deriva los máximos del layout: 11 dígitos para R2, 15 para R1 y
  R0. Suma con `bigint`, valida neto positivo y conserva el importe por lote
  alineado con la lista.
- `loteo.ts` separa la validación técnica de la estrategia. Valida numeración
  de 4 dígitos distinta de `0000`, ausencia de duplicados, máximo 999 detalles
  por lote, máximo 9999 lotes y cobertura exacta por identidad y orden. No hay
  estrategia por default mientras P-20 siga abierta.

## 14. CP-F6-B · mapper y frontera de decisión

`mapearPatagonia(perfil, parametros, pagos, politica)` devuelve
`Result<ResultadoMapeoPatagonia, ErrorMapeoPatagonia[]>` con:

- `entradas`: R0, luego por cada lote R1 + R2*;
- `totales`: los mismos totales calculados sobre la misma lista.

El mapper no serializa bytes ni conoce el motor de archivo. Aplica:

- PAT-4: solo el tipo `004` usa la provincia del pago; en los demás casos la
  política resuelve el valor;
- PAT-8: tipo documental del Anexo I PAT-DR;
- PAT-17: R2 usa el código de banco del pago; R0 conserva `034` fijo;
- PAT-15: la versión del R1 sale de la política;
- PAT-16: el legajo se usa como comprobante solo cuando es directamente
  utilizable (1–7 dígitos); si no, resuelve la política;
- toda decisión abierta devuelve `POLITICA_SIN_RESOLUCION` con su punto, nunca
  un default.

## 15. Tests y verificación

Comandos ejecutados:

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/banks/patagonia-b2` | **133 tests / 11 archivos, 133 passed** |
| `npx vitest run tests/unit/profile tests/unit/run/perfilV3.test.ts` | **42 tests / 5 archivos, 42 passed** |
| `npx vitest run tests/unit/profile tests/unit/banks/patagonia-b2 tests/guardrails tests/unit/banks/bna tests/unit/banks/fixed-width tests/unit/run tests/integration/generacionBna.integracion.test.ts` | **731 tests / 44 archivos, 731 passed** |
| `npm run verify` | **78 archivos, 1263 tests passed; 23 e2e passed; typecheck, lint, format, check:sensitive, build y check:dist OK** |

Cobertura agregada de `src/banks/patagonia-b2/**`:

- statements: **96,78 %**;
- branches: **95,01 %**;
- functions: **100 %**;
- lines: **96,75 %**.

`check:sensitive`: sin hallazgos (243 archivos). `check:dist`: OK.

## 16. Archivos

Creados:

- `src/banks/patagonia-b2/modelo.ts`
- `src/banks/patagonia-b2/politica.ts`
- `src/banks/patagonia-b2/nombre.ts`
- `src/banks/patagonia-b2/validacion.ts`
- `src/banks/patagonia-b2/totales.ts`
- `src/banks/patagonia-b2/loteo.ts`
- `src/banks/patagonia-b2/mapeo.ts`
- `tests/unit/banks/patagonia-b2/auxiliares.ts`
- `tests/unit/banks/patagonia-b2/modelo.test.ts`
- `tests/unit/banks/patagonia-b2/politica.test.ts`
- `tests/unit/banks/patagonia-b2/nombre.test.ts`
- `tests/unit/banks/patagonia-b2/validacion.test.ts`
- `tests/unit/banks/patagonia-b2/totales.test.ts`
- `tests/unit/banks/patagonia-b2/loteo.test.ts`
- `tests/unit/banks/patagonia-b2/mapeo.test.ts`
- `tests/unit/profile/perfilV3.test.ts`
- `tests/unit/run/perfilV3.test.ts`

Modificados:

- `src/profile/contrato.ts`
- `src/profile/validar.ts`
- `src/profile/plantilla.ts`
- `src/profile/index.ts`
- `src/profile/archivo.ts`
- `src/banks/patagonia-b2/index.ts`
- `src/run/generacionBna.ts` (solo ampliación de tipo `perfilVersion`)
- `tests/unit/profile/perfilV2.test.ts`
- `docs/05_PLAN_DE_TRABAJO.md`
- `docs/07_DECISIONES_Y_PENDIENTES.md`
- `docs/informes/F6_BANCO_PATAGONIA.md`

Sin cambios:

- `src/banks/fixed-width/**`
- `src/banks/bna/**`
- `src/reconciliation/**`
- `docs/04_CONTRATOS_BANCARIOS.md`
- UI, serialización, inspector, golden, fachada Patagonia, CP-F6-C y F7.

## 17. Pendientes al cierre de CP-F6-B

- PAT-1 y PAT-2 siguen `BLOQUEADA`.
- PAT-17 sigue `INTERPRETACION_PENDIENTE`; P-30 abierta para confirmación de
  Banco Patagonia.
- P-09/P-10/P-20 y las demás preguntas siguen abiertas; no se resolvió ningún
  pendiente bancario.
- CP-F6-B quedó a la espera de auditoría humana.
- La app sigue **NO apta para pagos reales**.

## 18. CP-F6-C · serialización

`src/banks/patagonia-b2/serializacion.ts` expone:

```ts
serializarPatagonia(
  perfil: PerfilPatagonia,
  parametros: ParametrosEnvioPatagonia,
  pagos: readonly PagoPatagonia[],
  politica: PoliticaPatagonia,
): Result<ArchivoPatagoniaGenerado, readonly ErrorSerializacionPatagonia[]>
```

Composición exacta: `mapearPatagonia` → `crearSpecPatagoniaB2` →
`serializarArchivo` de la API pública de F4. Devuelve bytes y
`TotalesPatagonia` solo si todas las capas aceptan; si el mapper, la política o
F4 fallan, devuelve error y **no hay bytes parciales**. No hay fixed-width
propio, posiciones, padding, defaults, I/O, `Blob` ni descarga.

Tests: un lote, múltiples lotes, determinismo, LF/CRLF con y sin salto final,
PAT-1 espacios/ceros, PAT-2 alfanumérica, error de política, neto no positivo y
fallo técnico de F4 simulado solo con `vi.mock` bajo `tests/**`.

## 19. CP-F6-C · inspector

`src/banks/patagonia-b2/inspeccion.ts` expone:

```ts
inspeccionarPatagonia(
  bytes: Uint8Array,
  configuracion: ConfiguracionTecnicaPatagonia,
): Result<InspeccionPatagonia, readonly ErrorInspeccionPatagonia[]>
```

Recibe exclusivamente bytes y configuración técnica. Primero usa
`inspeccionarArchivo` de F4 para estructura, longitudes, separadores, BOM,
discriminadores y alfabeto. Después reconstruye R1/R2 y valida:

- cantidad de lotes declarada vs. R1 encontrados;
- cantidad de pagos declarada en R1 vs. R2 encontrados;
- importes netos R2 y totales R1/R0;
- pertenencia de cada R2 a su R1 y ausencia de números de lote repetidos;
- EMPRESA en R0, R1 y R2, y número de envío R0/R1;
- límites técnicos positivos y máximos de `totales.ts`.

No recibe perfil, pagos, conciliación, política, totales de generación ni
mapper. Las interpretaciones pendientes no se convierten en error por sí
mismas.

Tests: reconstrucción de uno y varios lotes, CRLF con salto final, PAT-1/PAT-2,
separador alterado, truncado y mutaciones directas de cantidades, importes,
lotes, EMPRESA y envío.

## 20. CP-F6-C · fachada `run`

`src/run/generacionPatagonia.ts` define exactamente:

```ts
interface EntradaGeneracionPatagonia {
  readonly perfil: CompanyProfileImportado | null;
  readonly conciliacion: ResultadoConciliacion | null;
  readonly parametros: ParametrosEnvioPatagonia | null;
}
```

No admite `politica`, `aptitud`, `serializar`, `inspeccionar`, mapper, spec,
callbacks ni opciones equivalentes. La fachada usa siempre
`POLITICA_PATAGONIA_PRODUCTIVA`, `aptitudPatagonia`, `serializarPatagonia` e
`inspeccionarPatagonia`.

Reglas implementadas:

- `perfil` debe ser `CompanyProfileV3`; v1/v2 devuelven
  `CONFIGURACION_INCOMPLETA`; se copia solo
  `{ numeroEmpresa: perfil.patagonia.numeroEmpresa }`, sin migrar ni copiar BNA;
- `evaluarReadiness` se reutiliza con Patagonia configurada/evaluada y BNA no
  configurado/no habilitado;
- `pagosPatagoniaDesdeConciliacion` solo toma filas `INCLUIDA` con destino
  `PATAGONIA_B2`, neto positivo, maestro presente y sin incidencia
  Patagonia/global no resuelta; preserva orden, ocurrencias y `SourceRef`; no
  infiere documento, banco, sucursal, cuenta, dependencia, identidad ni
  `Descripcion`;
- P-09/P-10 se consumen como `LIQUIDACION_SIN_MAPEO` (bloqueante por fila, no
  `ContractStatus`); la política productiva sigue devolviendo
  `SIN_RESOLUCION` para `tipoLiquidacion()` y los demás puntos abiertos;
- con PAT-1/PAT-2 `BLOQUEADA`, una entrada válida devuelve
  `CONTRATO_PATAGONIA_BLOQUEADO` antes de convertir pagos o serializar;
- ningún estado de error devuelve bytes.

Estados cubiertos por tests: `CONFIGURACION_INCOMPLETA` (perfil ausente, v1,
v2, parámetros ausentes), `CONCILIACION_NO_LISTA` (sin conciliación, global
pendiente, global bloqueada, bloqueantes Patagonia, revisiones Patagonia),
`SIN_REGISTROS` (`BANCO_SIN_FILAS` y `SIN_PAGOS_CONVERTIBLES`),
`CONTRATO_PATAGONIA_BLOQUEADO`, `MAPEO_NO_RESUELTO`
(`LIQUIDACION_SIN_MAPEO` y `POLITICA_SIN_RESOLUCION`),
`SERIALIZACION_FALLIDA`, `INSPECCION_PATAGONIA_FALLIDA`, `LISTO_TECNICAMENTE`
y `GENERADO`.

Las ramas `GENERADO`, `SERIALIZACION_FALLIDA` e
`INSPECCION_PATAGONIA_FALLIDA` se prueban con `vi.mock` del entry point público
exclusivamente bajo `tests/**`; no existe bypass productivo. El test de
contrato público verifica las tres claves y que propiedades extra de bypass no
cambian la compuerta contractual.

## 21. CP-F6-C · golden técnico sintético

Fixture: `tests/fixtures/synthetic/golden/patagonia-b2-tecnico-sintetico.json`.
Escenario: `tests/fixtures/synthetic/goldenPatagonia.ts`.

Metadatos:

| Dato | Valor |
|---|---|
| Etiqueta | `GOLDEN TÉCNICO SINTÉTICO — NO HOMOLOGADO POR BANCO PATAGONIA.` |
| Pagos / lotes | 2 / 2 |
| PAT-1 | `ESPACIOS` |
| PAT-2 | `NUMERICA` |
| Separador | LF sin salto final |
| Total | `84000050` centavos |
| Bytes | 1004 |
| SHA-256 | `36f55f2a0aee04e944c5347ecde62f6c8722418f8b0bca86ebf1a408848a7ade` |

El golden compone directamente perfil Patagonia, parámetros, política
sintética, mapper, serializer e inspector; no pasa por la fachada productiva.
El test reproduce bytes y SHA-256, revalida con el inspector y comprueba que
una mutación de importe invalida el archivo aunque conserve el largo.

## 22. CP-F6-C · guardrails

`eslint.guardrails.js` permite desde `src/run/**` solo los entry points
públicos de BNA y Patagonia (`../banks/bna`, `index`, `index.ts`;
`../banks/patagonia-b2`, `index`, `index.ts`). Siguen prohibidos internals de
ambos bancos, fixed-width, UI, exportación, importación XLSX, React, ExcelJS,
paquetes npm, builtins, alias, rutas absolutas, `import()` no verificable y
traversals. Los tests de guardrail cubren internals de Patagonia, traversals y
la whitelist real.

## 23. CP-F6-C · tests y verificación

| Comando | Resultado |
|---|---|
| `npx vitest run tests/unit/banks/patagonia-b2 tests/unit/run tests/integration/generacionPatagonia.integracion.test.ts tests/integration/goldenPatagonia.integracion.test.ts tests/guardrails` | **459 tests / 26 archivos, 459 passed** |
| `npm run test:coverage` | **84 archivos, 1332 tests passed** |
| `npm run verify` | **1332 tests / 84 archivos + 23 e2e; typecheck, lint, format, `check:sensitive`, build y `check:dist` OK** |

Cobertura:

- `src/banks/patagonia-b2/**`: **96,98 % statements / 95,22 % branches /
  100 % functions / 96,95 % lines**;
- `src/run/generacionPatagonia.ts`: **97,58 % statements / 96,62 % branches /
  100 % functions / 97,50 % lines**;
- total del proyecto: **91,37 / 87,35 / 89,51 / 91,31**.

`check:sensitive`: sin hallazgos (254 archivos). `check:dist`: OK.

## 24. CP-F6-C · archivos

Creados:

- `src/banks/patagonia-b2/serializacion.ts`
- `src/banks/patagonia-b2/inspeccion.ts`
- `src/run/generacionPatagonia.ts`
- `tests/fixtures/synthetic/goldenPatagonia.ts`
- `tests/fixtures/synthetic/golden/patagonia-b2-tecnico-sintetico.json`
- `tests/unit/banks/patagonia-b2/serializacion.test.ts`
- `tests/unit/banks/patagonia-b2/serializacion.mock.test.ts`
- `tests/unit/banks/patagonia-b2/inspeccion.test.ts`
- `tests/unit/run/generacionPatagonia.ramasTecnicas.test.ts`
- `tests/integration/generacionPatagonia.integracion.test.ts`
- `tests/integration/goldenPatagonia.integracion.test.ts`

Modificados:

- `src/banks/patagonia-b2/index.ts`
- `eslint.guardrails.js`
- `tests/guardrails/eslint-guardrails.test.ts`
- `tests/unit/banks/patagonia-b2/modelo.test.ts`
- `vitest.config.ts`
- `docs/05_PLAN_DE_TRABAJO.md`
- `docs/07_DECISIONES_Y_PENDIENTES.md`
- `docs/informes/F6_BANCO_PATAGONIA.md`

Sin cambios:

- `src/banks/fixed-width/**`
- `src/banks/bna/**`
- `src/reconciliation/**`
- `docs/04_CONTRATOS_BANCARIOS.md`
- UI, React, persistencia, red y filesystem.

## 25. Pendientes y próximo paso

- PAT-1 y PAT-2 siguen `BLOQUEADA`; la generación productiva se detiene en
  `CONTRATO_PATAGONIA_BLOQUEADO`.
- PAT-17 sigue `INTERPRETACION_PENDIENTE`; P-30 abierta.
- P-20, PAT-4, PAT-7/P-09/P-10, PAT-9/P-14, PAT-15 y PAT-16 siguen sin
  resolución productiva. El golden demuestra capacidad técnica, no aceptación
  bancaria.
- No hay estrategia productiva de loteo ni habilita pagos reales.
- CP-F6-C queda a la espera de auditoría humana; F6 no se cierra y F7 no se
  inicia.
- La app sigue **NO apta para pagos reales**.

# STOP
