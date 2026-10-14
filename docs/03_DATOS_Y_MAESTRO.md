# 03 · Fuentes de datos, maestro, configuración y conciliación

**Versión:** F0 v2 · **Fecha:** 14-10-2026 · **Estado:** F0 aprobada
(decisiones en `07_DECISIONES_Y_PENDIENTES.md`).

Convenciones:

-   **APROBADA**: decidida explícitamente por el usuario (se cita `D-xxx`).
-   **PROPUESTA**: surgió del plan F0, no fue objetada, y puede
    ajustarse en F2/F3 sin reabrir decisiones aprobadas.
-   **PENDIENTE**: requiere definición del usuario o de un banco
    (se cita `P-xx`).

Este documento **no contiene datos personales**. Las observaciones del
archivo real son agregadas (conteos, longitudes, patrones enmascarados
como `99-99999999-9`).

## A. Finnegans XLSX (liquidación)

### A.1 Estructura observada en el archivo de muestra

Archivo `references/Finnegans_Reporte_Ejemplo.xlsx` (SHA-256 en
`07`). Datos reales: **no versionable**.

-   Una hoja, `hoja1`. Encabezado en la fila 1; 156 filas de datos
    contiguas; 14 columnas.
-   Sin fórmulas, sin celdas combinadas, sin filas ni columnas ocultas.
-   Generado por **Apache POI**: textos como celdas `inlineStr` (sin
    `sharedStrings`) y `<dimension ref="A1">` **incorrecta**. El lector
    XLSX no debe confiar en la dimensión declarada (prueba obligatoria
    del spike F1).
-   **Cada archivo corresponde a una única empresa/CUIT empleador**
    (D-011). El CUIT no viene en Finnegans; proviene del perfil de
    empresa.

### A.2 Columnas

Los nombres de encabezado son exactos (sin acentos en el original).

| Columna | Celda | Patrón observado (enmascarado) | Uso |
|---|---|---|---|
| `Cuil` | texto | `99-99999999-9`; DV válido 156/156; sin repetidos; prefijos 20/23/27 | **Clave de cruce**; documento BNA (opción CUIL) |
| `Apellido` | texto | mayúsculas/minúsculas mezcladas; contiene `ñ`; 9 con espacios finales | Nombre Patagonia (§F) |
| `Nombre` | texto | acentos; 12 con espacios finales | Nombre Patagonia (§F) |
| `Legajo` | texto | 3 dígitos; 50 con ceros a la izquierda; sin repetidos | **Control secundario exacto**; comprobante Patagonia |
| `Banco` | texto libre | `BANCO DE LA NACION ARGENTINA` 116 · `BANCO PATAGONIA S.A.` 39 · vacío 1 | **Destino** (D-012) |
| `Remunerativo` | número | hasta 2 decimales | Control de integridad |
| `No remunerativo` | número | hasta 2 decimales | Control de integridad |
| `Descuento` | número | hasta 2 decimales | Control de integridad |
| `Contribucion` | número | contribución patronal; no integra el neto | No se usa |
| `Neto` | número | en la muestra siempre entero; ≤ 7 dígitos enteros; 1 en cero; 0 negativos | **Importe a acreditar** |
| `Descripcion` | texto | `<MES> <clasificación>`: Agrario 121, Comercio 27, Directivos 4, Liq. Final 4 (con variantes de mayúsculas y espacio final) | Período y tipo de liquidación (§A.4, **PENDIENTE**) |
| `Transaccionsubtipoid` | número | constante `281` | Significado desconocido; solo se registra |
| `Legajoapellidonombre` | texto | `LLL - APELLIDO, NOMBRE` | Chequeo de consistencia interna |
| `Centrodecosto` | texto | 30 valores | No se usa |

Comprobación agregada en la muestra: `Neto = Remunerativo + No
remunerativo − Descuento` en 156/156 filas. Aunque en la muestra el neto
es entero, el sistema soporta centavos (ambos layouts tienen 2
decimales).

**Finnegans no trae:** CBU, cuenta, sucursal, tipo/número de documento,
dependencia, CUIT empleador, año del período, fecha de pago ni datos de
convenio.

### A.3 Reglas de importación

| Regla | Nivel | Alcance | Estado |
|---|---|---|---|
| Falta una hoja con los 14 encabezados esperados (comparación sin distinguir mayúsculas, acentos ni espacios extremos) | BLOQUEANTE | Global | PROPUESTA |
| Columna adicional desconocida | INFORMACION | Global | PROPUESTA |
| Celda con fórmula en cualquier columna usada | BLOQUEANTE | Global | APROBADA (docs/02) |
| CUIL: se quitan guiones y espacios; debe quedar en 11 dígitos con DV válido | BLOQUEANTE si falla | ver §E.2 | APROBADA (D-004, D-024) |
| Conversión de importes: valor leído → texto decimal mínimo de ida y vuelta → `bigint` centavos; nunca aritmética de punto flotante | — | — | APROBADA (D-031) |
| El archivo original **nunca se modifica**; toda decisión del operador vive en la conciliación de la corrida | — | — | APROBADA (D-013) |

### A.4 Descripción, período y tipo de liquidación (APROBADA como modelo, D-037; regla **PENDIENTE**, P-10)

`Descripcion` mezcla el mes y una clasificación (`JULIO Agrario`). No
queremos que `JULIO Agrario`, `AGOSTO Agrario` y `SEPTIEMBRE Agrario` se
conviertan en tres tipos de liquidación distintos. Conceptualmente se
separan tres datos:

| Dato | Ejemplo conceptual | Uso |
|---|---|---|
| `descripcionOriginal` | `JULIO Agrario` | Trazabilidad; se conserva siempre tal cual |
| `periodo` | `JULIO` | Información del envío |
| `tipoLiquidacionNormalizado` | `AGRARIO` | Clave del mapeo a códigos bancarios (D-026) |

**La regla de extracción no está definida.** No se implementa en F1 ni se
usan regex o heurísticas de producción hasta analizar de forma segura
todas las variantes reales (mayúsculas, espacios, "Liq final" / "Liq
Final", otros meses y años). Se define en F2/F3 con aprobación.

## B. Maestro bancario `MAESTRO_CUENTAS_EMPLEADOS.xlsx`

**Regla (APROBADA):** solo información **estable** que Finnegans no
proporciona. `CUIL` es la clave principal; `LEGAJO` es control
secundario **exacto**; `APELLIDO_NOMBRE_REF` es referencia humana
únicamente. **Nunca se cruza por nombre.** No se duplican datos
mensuales de la liquidación (importes, banco en texto, descripción,
centro de costo, fechas).

### B.1 Hoja `Empleados`

Todas las celdas en formato **Texto** (`@`), sin fórmulas, una fila por
CUIL.

| Columna | Requerida | Formato / validación | Origen del dato | Estado |
|---|---|---|---|---|
| `CUIL` | Siempre | 11 dígitos (se aceptan guiones); DV válido; único en la hoja | Prellenado desde Finnegans | APROBADA |
| `LEGAJO` | Siempre | Texto; se compara **exacto** con Finnegans (§E) | Prellenado desde Finnegans | APROBADA |
| `APELLIDO_NOMBRE_REF` | No | Libre; nunca se usa para cruzar, validar ni generar | Prellenado desde Finnegans | APROBADA |
| `CBU` | Si el destino es BNA | 22 dígitos; DV de ambos bloques (validación externa, ver docs/04 §5) | RRHH | APROBADA |
| `PAT_TIPO_CUENTA` | Si el destino es Patagonia | `1` cuenta corriente / `2` caja de ahorro | Respuesta de alta Patagonia | APROBADA |
| `PAT_NUMERO_CUENTA` | Ídem | Hasta 10 dígitos | Alta Patagonia (A.2 campo 20B) | APROBADA |
| `PAT_CODIGO_BANCO` | Ídem | 3 dígitos | Alta Patagonia (A.2 campo 35) | APROBADA |
| `PAT_CODIGO_SUCURSAL` | Ídem | Hasta 5 dígitos | Alta Patagonia (A.2 campo 36) | APROBADA |
| `PAT_TIPO_DOCUMENTO` | Ídem | Anexo I: `001`, `002`, `003`, `004`, `006` | Alta Patagonia | APROBADA |
| `PAT_NUMERO_DOCUMENTO` | Ídem | Hasta 17 dígitos; **no se deriva del CUIL** | Alta Patagonia | APROBADA |
| `PAT_PROVINCIA_DOCUMENTO` | Solo con tipo `004` | Anexo II; vacía en los demás casos | Alta Patagonia | APROBADA (valor en TXT cuando no aplica: PAT-4 **I**) |
| `PAT_CODIGO_DEPENDENCIA` | Ídem | Hasta 15 caracteres; **se conserva el texto tal cual**; no se decide relleno ni tipo | Tabla de dependencias | **BLOQUEADA** por PAT-2 (A vs N) |

Notas:

-   Los campos `PAT_*` se completan solo para empleados con destino
    Patagonia; para los demás quedan vacíos.
-   La cuenta Patagonia **no** se calcula desde el CBU: el CBU tiene
    sucursal de 4 dígitos y bloque 2 = tipo (2) + cliente (9) +
    subcuenta (2) + DV (PAT-DR p.3), mientras B.2 pide sucursal de 5 y
    cuenta de 10 (PAT-DR p.9).
-   Si una fila Patagonia trae `CBU`, se usa solo como control de
    compatibilidad (§E.2, regla 11).

### B.2 Otras hojas

-   `Instrucciones`: propósito, formato de cada columna, ejemplos
    **totalmente ficticios**, política de acceso y respaldo.
-   `Catalogos`: tipos de cuenta y Anexos I y II de Patagonia, con
    página de origen. No incluye mapeos de liquidación (PENDIENTE).
-   `Control`: `VERSION_CONTRATO = 1` y fecha de generación. Sin datos
    personales.

### B.3 Reglas de importación del maestro (PROPUESTA)

| Situación | Nivel |
|---|---|
| Falta una columna requerida | BLOQUEANTE (global) |
| Celda **numérica** en `CUIL`, `LEGAJO`, `CBU`, `PAT_NUMERO_CUENTA`, `PAT_NUMERO_DOCUMENTO` u otra columna de código (Excel pudo perder ceros o dígitos > 15) | BLOQUEANTE (corregir el maestro) |
| Fórmula en cualquier celda | BLOQUEANTE |
| `CBU`, cuenta, sucursal o documento con caracteres que no sean dígitos | BLOQUEANTE (no se normalizan en silencio) |
| CUIL repetido en el maestro | BLOQUEANTE |
| LEGAJO repetido en el maestro | BLOQUEANTE |
| Fila totalmente vacía | Se ignora (INFORMACION) |
| Columna desconocida | INFORMACION |

Las incidencias de un registro del maestro se asignan al alcance de las
filas de Finnegans que lo usan (§E.1). Si ninguna fila de la corrida usa
ese registro, se informan como `INFORMACION` (PROPUESTA).

### B.4 Plantilla y edición

-   La app ofrece una plantilla vacía y una **prellenada** con `CUIL`,
    `LEGAJO` y `APELLIDO_NOMBRE_REF` desde Finnegans. La prellenada
    contiene datos personales: se genera y descarga localmente y nunca
    se versiona.
-   Las ediciones en pantalla son **temporales** hasta que el operador
    descargue un maestro nuevo (con fecha/versión en el nombre). No se
    sobrescribe el original ni se simula persistencia.

## C. Perfil de empresa (APROBADA, D-022)

Archivo **separado del maestro**, importable/exportable, **sin nómina
ni datos de empleados**. Al importarlo se rechazan claves desconocidas.

| Contenido | Detalle |
|---|---|
| Empresa | CUIT empleador (D-011) |
| BNA | CBU de la cuenta de la empresa, código de convenio, moneda, clase/tipo de documento (cuando se resuelva BNA-1), opciones de los campos libres |
| Patagonia | Número de empresa; dependencia por defecto si fuera única (sujeto a PAT-2) |
| Catálogo de bancos | Texto Finnegans → destino y código de entidad esperado (§D) |
| Mapeo de liquidaciones | `tipoLiquidacionNormalizado` → código BNA / código Patagonia. **Vacío hasta definición** (D-026, D-037, P-09, P-10) |

Formato propuesto: JSON versionado (`P-19`, a confirmar en F3).

## D. Destino bancario y parámetros de envío

### D.1 Destino (APROBADA, D-012)

La columna `Banco` de Finnegans determina el destino:

| Texto `Banco` (catálogo del perfil) | Destino | Entidad esperada | Fuente del código |
|---|---|---|---|
| `BANCO DE LA NACION ARGENTINA` | `BNA_GT_HABERES` | `011` | BNA p.11 (ejemplo "Entidad: 011 Banco Nación") |
| `BANCO PATAGONIA S.A.` | `PATAGONIA_B2` | `034` | PAT-DR p.8 (código de banco fijo `034`) |
| vacío, con neto ≠ 0 | ninguno hasta que el operador lo asigne | — | D-013 |
| cualquier otro texto | no soportado | — | D-014 |

Se generan **dos archivos independientes** (BNA y Patagonia) a partir
de la misma conciliación, cada uno con su propio estado de generación
(§G).

### D.2 Parámetros por envío

Se ingresan en cada corrida, sin valores por defecto silenciosos, y no
se persisten:

-   **BNA:** fecha de compensación (más fecha de acreditación prevista,
    como control), número de envío, información criterio empresa,
    referencia unívoca.
-   **Patagonia:** fecha de presentación, fecha de acreditación, número
    de envío, concepto, loteo (`P-20`).

## E. Cruce Finnegans ↔ Maestro

### E.1 Niveles y alcance de las incidencias

Niveles visibles (APROBADA, D-019):

| Nivel | Significado |
|---|---|
| `CORRECTO` | No requiere intervención. |
| `INFORMACION` | No impide continuar. |
| `REQUIERE_REVISION` | Debe ser revisado/confirmado explícitamente por el operador. Mientras no se resuelva, bloquea lo que corresponda a su alcance. |
| `BLOQUEANTE` | Impide generar/descargar el archivo correspondiente a su alcance. No se resuelve con una confirmación: hay que corregir el dato de origen (maestro, perfil o Finnegans) y volver a cargar o validar. |

El nivel visible de una fila es el más grave de sus incidencias, o
`CORRECTO` si no tiene ninguna.

**Alcance (APROBADA, D-032).** Cada incidencia tiene un alcance:

-   **Banco (`BNA_GT_HABERES` o `PATAGONIA_B2`)**: incidencias de una fila
    cuyo destino está determinado. Afectan solo la generación de ese
    banco.
-   **Global**: incidencias que impiden determinar el destino o el
    importe de una fila, o que afectan la estructura de un archivo de
    entrada. Afectan la conciliación global y, por lo tanto, a ambos
    bancos (§G).

### E.2 Reglas

Orden de evaluación: las reglas 1–3 se aplican a **todas** las filas.
Una fila con neto 0 queda excluida en la regla 4 y a partir de ahí no se
le exige maestro ni datos bancarios (D-034).

| # | Situación | Nivel | Alcance | Acción del operador | Estado |
|---|---|---|---|---|---|
| 1 | CUIL inválido (formato o DV) | BLOQUEANTE | Banco de la fila; **global** si la fila no tiene destino o está excluida (*identificación de una fila no pagada*, PROPUESTA) | Corregir la fuente | APROBADA |
| 2 | CUIL repetido en Finnegans | BLOQUEANTE para todas las filas involucradas; **nunca se suman ni fusionan** | Banco de cada fila involucrada (ambos si están en bancos distintos); global si alguna no tiene destino | Corregir Finnegans | APROBADA (D-015) |
| 3 | CUIL o LEGAJO repetido en el maestro | BLOQUEANTE | Banco de las filas que usan el registro | Corregir el maestro | PROPUESTA |
| 4 | Neto = 0 | INFORMACION; **excluida** del pago; cuenta en `EXCLUIDOS` | Global (solo informativa) | Ninguna | APROBADA (D-016, D-034) |
| 5 | Importe no interpretable (no numérico, más de 2 decimales) | BLOQUEANTE | **Global** (el total Finnegans no puede calcularse) | Corregir la fuente | PROPUESTA |
| 6 | Neto negativo o mayor a lo que admite el layout destino | BLOQUEANTE | Banco | Corregir la fuente | PROPUESTA |
| 7 | Fila Finnegans sin registro en el maestro | BLOQUEANTE | Banco | Completar el maestro | APROBADA (D-018) |
| 8 | Registro del maestro sin liquidación en Finnegans | INFORMACION | Global | Ninguna | APROBADA (D-018) |
| 9 | CUIL coincide pero `LEGAJO` no coincide **exactamente** (ej. `007` vs `7`) | REQUIERE_REVISION; se muestran **ambos valores**; no se modifica ninguno. Si el legajo del maestro pertenece a otro empleado de Finnegans, se indica en el detalle | Banco | Confirmar explícitamente o corregir la fuente | APROBADA (D-017) |
| 10 | `Banco` vacío con neto ≠ 0 | REQUIERE_REVISION; fila **PENDIENTE** | **Global** | Indicar BNA o Patagonia; la decisión se registra en la corrida; luego se aplican las reglas de banco | APROBADA (D-013, D-032) |
| 11 | `Banco` con texto fuera del catálogo | BLOQUEANTE (banco no soportado); fila **PENDIENTE**; no se reasigna | **Global** | Corregir Finnegans o el catálogo | APROBADA (D-014, D-032) |
| 12 | Banco Finnegans incompatible con el maestro: destino BNA y entidad del `CBU` ≠ `011`; destino Patagonia y `PAT_CODIGO_BANCO` ≠ `034`, o `CBU` presente con entidad ≠ `034` | BLOQUEANTE | Banco | Corregir la fuente | APROBADA (D-018) |
| 13 | Datos del destino faltantes o inválidos (BNA: `CBU`; Patagonia: campos `PAT_*` requeridos) | BLOQUEANTE | Banco | Completar el maestro | APROBADA |
| 14 | Tipo de liquidación sin mapeo aprobado | BLOQUEANTE | Banco | Definir el mapeo en el perfil | APROBADA (D-026) |
| 15 | Nombre Patagonia normalizado o truncado (§F) | INFORMACION; se conservan valor original, valor generado y si hubo truncamiento | Patagonia | Ninguna | APROBADA (D-021, D-033) |
| 16 | Nombre con caracteres cuyo tratamiento no respalda el contrato bancario, después de las transformaciones aprobadas | BLOQUEANTE; no se eliminan ni reemplazan en silencio | Patagonia | Corregir la fuente o definir regla con respaldo | APROBADA provisionalmente (D-035) |
| 17 | `Rem + NoRem − Desc ≠ Neto` | REQUIERE_REVISION | Banco | Confirmar | PROPUESTA |
| 18 | Patagonia, tipo de documento `001` y número ≠ dígitos 3–10 del CUIL | REQUIERE_REVISION (no se corrige en silencio) | Patagonia | Confirmar o corregir el maestro | PROPUESTA |
| 19 | `Legajoapellidonombre` no empieza con `Legajo + " - "` | INFORMACION | Banco | Ninguna | PROPUESTA |

Además, los errores estructurales de cualquier archivo de entrada (§A.3,
§B.3: encabezados faltantes, fórmulas) son **globales**.

### E.3 Registro de decisiones del operador

Cada resolución de `REQUIERE_REVISION` (confirmación de legajo,
asignación de destino, etc.) se registra en la conciliación de la
corrida: tipo de decisión, CUIL, valores observados en cada fuente,
acción tomada y momento. El registro forma parte del reporte de
conciliación descargable; **no se persiste** en la app ni modifica los
archivos de entrada.

## F. Nombre para Patagonia (APROBADA, D-021, D-033, D-035)

-   Composición: `APELLIDO` + un espacio + `NOMBRE`, con espacios
    extremos recortados y espacios internos colapsados (*composición
    propuesta en F0; confirmar, P-14*).
-   MAYÚSCULAS; se quitan los acentos y la diéresis; `Ñ` → `N`.
-   Máximo 20 caracteres.
-   Si se transforma o trunca: `INFORMACION`, conservando para auditoría
    el **valor original**, el **valor generado** y la indicación clara de
    **truncamiento**. El archivo Finnegans nunca se modifica.
-   Si después de esas transformaciones quedan caracteres cuyo
    tratamiento no está respaldado por el contrato bancario:
    `BLOQUEANTE` (provisional, D-035). No se eliminan, reemplazan ni
    inventan transformaciones.
-   Nunca se usa como clave de cruce.
-   En la muestra, "apellido + nombre" supera 20 caracteres en 92 de 156
    filas.

## G. Conciliación global y readiness por banco (APROBADA, D-020 modificada por D-032)

### G.1 Estados de fila

Cada fila de Finnegans queda en exactamente uno de estos estados:

| Estado | Cuándo |
|---|---|
| `INCLUIDA_BNA` / `INCLUIDA_PATAGONIA` | Destino determinado (por `Banco` o por decisión registrada del operador). Puede tener incidencias de su banco. |
| `EXCLUIDA` | Motivo `NETO_CERO`, único motivo automático aprobado (D-036). |
| `PENDIENTE` | Destino no determinado: banco vacío sin resolver o banco no soportado. |

### G.2 Conciliación global (`GlobalReconciliationStatus`)

Siempre se muestra, en **cantidad** y en **importe en centavos**:

``` text
TOTAL FINNEGANS = TOTAL BNA + TOTAL PATAGONIA + TOTAL EXCLUIDOS + TOTAL PENDIENTES
```

`TOTAL BNA` y `TOTAL PATAGONIA` incluyen todas las filas asignadas a
cada banco, tengan o no incidencias. La conciliación global está
**cerrada** solo si:

1.  `PENDIENTES = 0`, y entonces se cumple
    `TOTAL FINNEGANS = TOTAL BNA + TOTAL PATAGONIA + TOTAL EXCLUIDOS`;
2.  no hay `BLOQUEANTE` de alcance global;
3.  no hay `REQUIERE_REVISION` global sin resolver.

Si alguna fila tiene un importe no interpretable (regla 5), el total
Finnegans no puede calcularse y la conciliación global queda
`BLOQUEADA`.

### G.3 Readiness por banco (`BnaReadiness`, `PatagoniaReadiness`)

Cada banco tiene su propio estado. Una incidencia que afecta solo a
Patagonia bloquea el TXT Patagonia y **no** el TXT BNA, y viceversa.

Ejemplo: BNA con 116 registros, todos conciliados y válidos → `LISTO`;
Patagonia con 39 registros y un empleado sin dato bancario requerido →
`BLOQUEADO`. El problema de Patagonia no invalida BNA.

La descarga del TXT de un banco requiere:

1.  conciliación global cerrada (§G.2) (*interpretación: una fila
    pendiente podría terminar asignada a cualquiera de los dos bancos,
    así que ninguno conoce su conjunto final de filas; confirmar, P-24*);
2.  todas las filas asignadas a ese banco conciliadas;
3.  cero `BLOQUEANTE` de ese banco;
4.  cero `REQUIERE_REVISION` sin resolver de ese banco;
5.  total y cantidad del banco conciliados: el archivo incluye **todas**
    sus filas asignadas (no hay exportaciones parciales dentro de un
    banco) y el inspector verifica que coinciden;
6.  perfil y parámetros de envío completos para ese banco;
7.  generador habilitado: ningún campo `BLOQUEADA` en su contrato
    (docs/04 §7).

Estados posibles, evaluados en este orden:

| Estado | Condición |
|---|---|
| `SIN_REGISTROS` | Ninguna fila asignada al banco |
| `BLOQUEADO_POR_CONCILIACION_GLOBAL` | Falla la condición 1 |
| `BLOQUEADO` | Falla la condición 3 |
| `REQUIERE_REVISION` | Falla la condición 4 |
| `CONFIGURACION_INCOMPLETA` | Falla la condición 6 |
| `GENERADOR_NO_HABILITADO` | Falla la condición 7 |
| `LISTO_PARA_GENERAR` | Se cumplen todas. La salida queda marcada **PENDIENTE DE HOMOLOGACION** hasta la aprobación bancaria (D-029) |

**Trazabilidad:** el reporte de conciliación incluye siempre el resumen
global, el estado y los motivos de cada banco, todas las incidencias
(también las del banco no generado) y las decisiones del operador. Cada
TXT generado queda asociado a la cantidad y el importe conciliados de su
banco.

## H. Modelo normalizado (contratos TypeScript, sin implementación)

``` ts
type Brand<T, B extends string> = T & { readonly __brand: B };
type Cuil = Brand<string, 'Cuil'>;            // 11 dígitos, DV válido
type Cbu = Brand<string, 'Cbu'>;              // 22 dígitos, DV bloques 1 y 2
type Cents = Brand<bigint, 'Cents'>;          // >= 0n
type CivilDate = Brand<string, 'CivilDate'>;  // 'YYYY-MM-DD', sin zona horaria
type SourceRef = { file: 'FINNEGANS' | 'MAESTRO' | 'PERFIL'; sheet?: string; row?: number; column?: string };

type Destino = 'BNA_GT_HABERES' | 'PATAGONIA_B2';

interface DescripcionLiquidacion {
  descripcionOriginal: string;                 // siempre, tal cual
  periodo?: string;                            // regla de extracción PENDIENTE (P-10)
  tipoLiquidacionNormalizado?: string;         // regla de extracción PENDIENTE (P-10)
}

interface PayrollLine {                        // una fila de Finnegans
  ref: SourceRef;
  cuil: Cuil;
  legajo: string;                              // texto exacto, sin normalizar
  apellido: string;
  nombre: string;
  bancoFinnegans: string;                      // texto original ('' si vacío)
  neto: Cents;
  descripcion: DescripcionLiquidacion;
  control: { remunerativo: Cents; noRemunerativo: Cents; descuento: Cents };
}

interface PatagoniaAccount {
  tipoCuenta: '1' | '2';
  numeroCuenta: string;
  codigoBanco: string;
  codigoSucursal: string;
  tipoDocumento: '001' | '002' | '003' | '004' | '006';
  numeroDocumento: string;
  provinciaDocumento?: string;
  codigoDependencia?: string;                  // texto tal cual; tipo BLOQUEADO (PAT-2)
}

interface MasterRecord {
  ref: SourceRef;
  cuil: Cuil;
  legajo: string;                              // texto exacto
  apellidoNombreRef?: string;                  // solo lectura humana
  cbu?: Cbu;
  patagonia?: PatagoniaAccount;
}

interface NombrePatagonia {                    // auditoría (D-033)
  original: string;                            // "Apellido" + "Nombre" tal como vienen
  generado: string;                            // valor que iría al TXT
  transformado: boolean;
  truncado: boolean;
}

type NivelVisible = 'CORRECTO' | 'INFORMACION' | 'REQUIERE_REVISION' | 'BLOQUEANTE';
type NivelIncidencia = Exclude<NivelVisible, 'CORRECTO'>;   // una incidencia nunca es CORRECTO
type AlcanceIncidencia = 'GLOBAL' | Destino;

type CodigoIncidencia =
  | 'ESTRUCTURA_INVALIDA' | 'COLUMNA_DESCONOCIDA' | 'FORMULA_EN_CELDA' | 'CELDA_NUMERICA_EN_TEXTO'
  | 'CUIL_INVALIDO' | 'CUIL_REPETIDO_FINNEGANS' | 'CUIL_REPETIDO_MAESTRO' | 'LEGAJO_REPETIDO_MAESTRO'
  | 'NETO_CERO' | 'IMPORTE_INVALIDO' | 'NETO_NEGATIVO' | 'NETO_EXCEDE_LAYOUT'
  | 'SIN_MAESTRO' | 'MAESTRO_SIN_LIQUIDACION' | 'LEGAJO_NO_COINCIDE'
  | 'BANCO_VACIO' | 'BANCO_NO_SOPORTADO' | 'BANCO_INCOMPATIBLE_MAESTRO'
  | 'CBU_FALTANTE' | 'CBU_INVALIDO' | 'DATO_PATAGONIA_FALTANTE' | 'DATO_PATAGONIA_INVALIDO'
  | 'LIQUIDACION_SIN_MAPEO' | 'NOMBRE_TRANSFORMADO' | 'NOMBRE_CARACTER_NO_SOPORTADO'
  | 'NETO_NO_CUADRA_COMPONENTES' | 'DOCUMENTO_NO_COINCIDE_CUIL' | 'LEGAJO_NOMBRE_INCONSISTENTE';

interface Incidencia {
  codigo: CodigoIncidencia;
  nivel: NivelIncidencia;
  alcance: AlcanceIncidencia;
  refs: SourceRef[];
  campo?: string;
  valores?: Partial<Record<'finnegans' | 'maestro' | 'perfil' | 'generado', string>>; // se muestran todos
  detalle: string;
}

type DecisionOperador =
  | { tipo: 'CONFIRMAR_REVISION'; codigo: CodigoIncidencia; cuil: Cuil; valores: Incidencia['valores']; momento: string }
  | { tipo: 'ASIGNAR_DESTINO'; cuil: Cuil; bancoFinnegans: ''; destino: Destino; momento: string };

type EstadoFila =
  | { estado: 'INCLUIDA'; destino: Destino }
  | { estado: 'EXCLUIDA'; motivo: 'NETO_CERO' }
  | { estado: 'PENDIENTE' };

interface FilaConciliada {
  payroll: PayrollLine;
  master?: MasterRecord;
  nombrePatagonia?: NombrePatagonia;
  incidencias: Incidencia[];
  nivel: NivelVisible;                         // el más grave, o CORRECTO
  decisiones: DecisionOperador[];
  estado: EstadoFila;
}

interface Totales { cantidad: number; importe: Cents }

interface GlobalReconciliationStatus {
  estado: 'CERRADA' | 'PENDIENTE' | 'BLOQUEADA';
  finnegans: Totales | null;                   // null si hay importes no interpretables
  bna: Totales;
  patagonia: Totales;
  excluidas: Totales;                          // hoy solo NETO_CERO
  pendientes: Totales;
  invarianteOk: boolean;                       // finnegans = bna + patagonia + excluidas + pendientes
  bloqueantesGlobales: number;
  revisionesGlobalesSinResolver: number;
}

type EstadoReadiness =
  | 'SIN_REGISTROS' | 'BLOQUEADO_POR_CONCILIACION_GLOBAL' | 'BLOQUEADO' | 'REQUIERE_REVISION'
  | 'CONFIGURACION_INCOMPLETA' | 'GENERADOR_NO_HABILITADO' | 'LISTO_PARA_GENERAR';

interface BankReadiness<D extends Destino> {
  destino: D;
  estado: EstadoReadiness;
  asignadas: Totales;                          // todas las filas con este destino
  bloqueantes: number;
  revisionesSinResolver: number;
  motivos: string[];                           // explicación visible del estado
  pendienteHomologacion: boolean;              // true hasta F7
}
type BnaReadiness = BankReadiness<'BNA_GT_HABERES'>;
type PatagoniaReadiness = BankReadiness<'PATAGONIA_B2'>;

interface ResultadoConciliacion {
  filas: FilaConciliada[];
  global: GlobalReconciliationStatus;
  bna: BnaReadiness;
  patagonia: PatagoniaReadiness;
}
```

## I. Privacidad

El maestro es sensible aunque no haya base de datos: RRHH restringe el
acceso, mantiene una copia de respaldo protegida y controla versiones.
El perfil de empresa no contiene datos de empleados, pero sí datos de la
cuenta de la empresa: se maneja con el mismo cuidado y nunca se versiona.
