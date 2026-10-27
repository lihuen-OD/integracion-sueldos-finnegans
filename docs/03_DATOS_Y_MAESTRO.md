# 03 · Fuentes de datos, maestro, configuración y conciliación

**Versión:** F2 v3 · **Fecha:** 20-10-2026 · **Estado:** F0 aprobada;
ajustes del plan F2 aprobados (D-044 a D-051, decisiones en
`07_DECISIONES_Y_PENDIENTES.md`).

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
| Falta una hoja con los 14 encabezados esperados en la fila 1 (N-01: sin distinguir mayúsculas, acentos ni espacios extremos), o hay más de una hoja candidata, o un encabezado esperado está duplicado | BLOQUEANTE | Global | APROBADA (D-046, D-047) |
| Columna adicional desconocida | INFORMACION | Global | APROBADA (D-047) |
| Celda con fórmula en cualquier columna usada | BLOQUEANTE | Global | APROBADA (docs/02) |
| CUIL (N-02 estricta, D-052): se quitan solo espacios U+0020 de los **extremos**; el valor debe ser exactamente la forma canónica (11 dígitos ASCII consecutivos) o `XX-XXXXXXXX-X` (guiones ASCII en esas posiciones). Guiones en otra posición o repetidos, espacios internos, tab, NBSP, espacio angosto, puntos, barras, guion bajo, rayas Unicode, dígitos no ASCII u otro separador lo invalidan; nada se corrige en silencio. Luego, 11 dígitos con DV válido. Se conserva el texto original. Sin reglas de prefijo | BLOQUEANTE si falla | ver §E.2 | APROBADA (D-004, D-024, D-050, D-052) |
| Hoja con los 14 encabezados pero oculta (`hidden` o `veryHidden`): se procesa; se conserva la visibilidad original como dato de diagnóstico. Si hay varias hojas candidatas, sigue siendo estructura ambigua | INFORMACION (`HOJA_FINNEGANS_OCULTA`) | Global | APROBADA (D-054) |
| `Cuil` o `Legajo` en celda numérica (Excel pudo perder ceros) | BLOQUEANTE | Fila | APROBADA (D-050) |
| `Legajo` y `Descripcion` se conservan exactos, sin trim ni ningún otro cambio | — | — | APROBADA (D-017, D-046) |
| Importes: solo desde celdas numéricas (nunca se reinterpreta texto como dinero); valor leído → texto decimal mínimo de ida y vuelta → regex estricta (máx. 2 decimales) → `bigint` centavos; nunca aritmética de punto flotante. **Límite técnico de precisión** (no bancario): máximo 13 dígitos enteros, porque 13 + 2 = 15 dígitos significativos es lo que un double conserva exacto | IMPORTE_INVALIDO si falla (§E.2 regla 5) | — | APROBADA (D-031, D-050, D-055) |
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

**La regla de extracción no está definida.** No se implementa en F1 ni
en F2 ni se usan regex o heurísticas de producción hasta analizar de
forma segura todas las variantes reales (mayúsculas, espacios, "Liq
final" / "Liq Final", otros meses y años). En F2 toda descripción queda
en estado `REGLA_PENDIENTE`, con `descripcionOriginal` intacta; la
herramienta local de F2 solo agrupa y muestra variantes sin PII (D-051).
Cualquier regla futura requiere revisión y aprobación.

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
-   El `CBU` pertenece solo al flujo BNA (D-056). Si una fila Patagonia
    trae `CBU`, no se consume: si es inválido o de otra entidad, solo se
    informa (§E.2 regla 12; esta nota citaba antes, por error, la regla
    11).

### B.2 Otras hojas

-   `Instrucciones`: propósito, formato de cada columna, ejemplos
    **totalmente ficticios**, política de acceso y respaldo.
-   `Catalogos`: tipos de cuenta y Anexos I y II de Patagonia, con
    página de origen. No incluye mapeos de liquidación (PENDIENTE).
-   `Control`: `VERSION_CONTRATO = 1` y fecha de generación. Sin datos
    personales.

### B.3 Reglas de importación del maestro (APROBADA, D-047, D-048, D-051)

| Situación | Nivel |
|---|---|
| Falta la hoja `Empleados` o una columna requerida (todas las de §B.1 salvo `APELLIDO_NOMBRE_REF`); encabezado duplicado | BLOQUEANTE (global) |
| Falta la hoja `Control` o `VERSION_CONTRATO` no es el texto `1` | BLOQUEANTE (global, D-051) |
| `CUIL` inválido (N-02 estricta, D-052), `CUIL` o `LEGAJO` en celda numérica, con fórmula o vacío | BLOQUEANTE para las filas que usan el registro |
| Celda **numérica**, con **fórmula** o de otro tipo no textual en `CBU` o en un campo `PAT_*` (Excel pudo perder ceros o dígitos > 15) | Según el destino de la fila (D-048) |
| `CBU`, cuenta, sucursal o documento con caracteres que no sean dígitos, o código fuera de catálogo | Según el destino de la fila (D-048); **no se normalizan en silencio** (D-046) |
| CUIL repetido en el maestro (CUIL canónico) | BLOQUEANTE si una fila que participa en la liquidación queda ambigua; INFORMACION si ningún registro duplicado participa. Nunca se elige uno arbitrariamente (D-047) |
| LEGAJO repetido en el maestro (comparación exacta) | Ídem |
| Fila totalmente vacía | Se ignora (INFORMACION) |
| Columna desconocida | INFORMACION |

**Campos según destino (D-048).** Un campo requerido o consumido por el
destino de la fila, faltante o inválido, es `BLOQUEANTE` para ese
destino. Un campo exclusivo del otro destino, inválido, es `INFORMACION`:
se conserva la incidencia para corregir el maestro, pero no bloquea un
pago que no lo usa.

| Campo | BNA | Patagonia |
|---|---|---|
| `CBU` | Requerido | No lo consume: vacío, sin incidencia; inválido o de otra entidad → INFORMACION (D-056) |
| `PAT_*` | No lo consume (inválido → INFORMACION) | Requeridos; `PAT_PROVINCIA_DOCUMENTO` solo con tipo `004` |

Las incidencias de un registro del maestro se asignan al alcance de las
filas de Finnegans que lo usan (§E.1). Si ninguna fila de la corrida usa
ese registro, se informan como `INFORMACION`.

`PAT_PROVINCIA_DOCUMENTO` se valida solo estructuralmente (§B.1): con
tipo `004`, código del Anexo II; con otros tipos, vacía (D-051). No se
infiere ninguna relación entre el documento y el CUIL (D-047, P-28).

### B.4 Plantilla y edición

-   La app ofrece una plantilla vacía y una **prellenada** con `CUIL`,
    `LEGAJO` y `APELLIDO_NOMBRE_REF` desde Finnegans. La prellenada
    contiene datos personales: se genera y descarga localmente y nunca
    se versiona. Muestra el CUIL con guiones; el parser lo lleva al
    `Cuil` canónico por N-02. Las filas con CUIL inválido o repetido no
    se prellenan y se informan (D-051).
-   Las instrucciones de la plantilla describen los formatos en palabras
    y no contienen ejemplos con forma de CUIL o CBU (D-042).
-   Las ediciones en pantalla son **temporales** hasta que el operador
    descargue un maestro nuevo (con fecha/versión en el nombre). No se
    sobrescribe el original ni se simula persistencia.

## C. Perfil de empresa (APROBADA, D-022)

Archivo **separado del maestro**, importable/exportable, **sin nómina
ni datos de empleados**. Al importarlo se rechazan claves desconocidas.

| Contenido | Detalle |
|---|---|
| Empresa | CUIT empleador (D-011) |
| BNA | CBU de la cuenta de la empresa, código de convenio y moneda (sección `bna` de v2, conservada íntegra en v3, §C.1). Clase/tipo de documento y opciones BNA-11 quedan fuera hasta resolver BNA-1/P-17 |
| Patagonia | Número de empresa (`patagonia.numeroEmpresa`, solo en v3). **No** incluye dependencia por defecto, cuenta, documento, sucursal ni `PAT_CODIGO_BANCO` de empleados; la semántica bancaria de `numeroEmpresa` sigue sujeta a PAT-6 |
| Catálogo de bancos | Texto Finnegans → destino y código de entidad esperado (§D) |
| Mapeo de liquidaciones | `tipoLiquidacionNormalizado` → código BNA / código Patagonia. **Vacío hasta definición** (D-026, D-037, P-09, P-10) |

Formato **resuelto**: JSON versionado (`P-19`, cerrada por aprobación
humana el 26-10-2026; contrato v1 en D-059, v2 en D-079 y v3 en D-087).

### C.1 Perfil v1, v2 y v3 (D-079, D-087, D-089)

**Perfil v1 (vigente, D-059; sin cambios):** `schemaVersion`
exactamente `"1"`, claves desconocidas rechazadas y sin migraciones. El
contrato es el `CompanyProfile` ya implementado en
`src/profile/contrato.ts`: `cuitEmpresa`, `nombreEmpresa`,
`catalogoBancos` y `mapeosLiquidacion` (vacío). No se agregan claves, no
se reinterpretan claves existentes y no se modifica su validador en este
correctivo. Un perfil v1 válido debe seguir reconociéndose como v1.

**Perfil v2 (contrato congelado en CP-F5-A, implementado en CP-F5-B):**
el contrato mínimo es exactamente:

```ts
interface CompanyProfileV2 {
  schemaVersion: '2';
  cuitEmpresa: CuitEmpresaEstructural;
  nombreEmpresa: string | null;
  catalogoBancos: readonly BancoCatalogado[];
  bna: {
    cbuEmpresa: Cbu;
    codigoConvenio: string;
    moneda: '0' | '1';
  };
  mapeosLiquidacion: readonly [];
}
```

`CuitEmpresaEstructural`, `Cbu` y `BancoCatalogado` son los tipos
canónicos existentes. El contrato v2 no incluye nada más:

-   **No existe `sucursalEmpresa`** ni otro dato estable independiente
    de sucursal mientras BNA-6 siga abierto. La sucursal se relaciona
    con el CBU y el código BCRA; no se usa un campo aparte para
    “resolver” BNA-6 por otra vía.
-   **No existe tipo/clase documental BNA en v2** mientras BNA-1 siga
    abierto. No se elige `02` ni `96`.
-   **No se agrega configuración de BNA-11/P-17** todavía.
-   **No se agregan códigos `0000`/`0003` reales** al perfil: el byte de
    `r2_identificadorPrestamo` es derivado por mapeo de la liquidación
    observada, no una lectura estable del perfil (`origin: 'DERIVADO'`).
-   **`mapeosLiquidacion` permanece vacío** (`readonly []`) mientras
    P-09/P-10 sigan abiertos. La forma futura de cada mapeo recién podrá
    definirse cuando esas preguntas se resuelvan; no se inventa ahora y
    no se habilitan códigos reales.

**Perfil v3 (contrato implementado en CP-F6-B, D-087; ampliación BNA
decidida en D-089):** el contrato implementado en `src/profile/contrato.ts`
es exactamente:

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

V3 conserva **íntegramente** la configuración BNA de v2 y agrega
únicamente `patagonia.numeroEmpresa`. No contiene:

-   dependencia por defecto;
-   cuenta de empleado;
-   documento del empleado;
-   sucursal del empleado;
-   `PAT_CODIGO_BANCO`;
-   mapeos reales mientras P-09/P-10 sigan abiertos.

`numeroEmpresa` se persiste exactamente como 1–4 dígitos ASCII, sin
relleno ni normalización. PAT-6 continúa abierta respecto de la semántica
bancaria de ese número: no se afirma que sea el “número de convenio” de
PAT-XL.

**Soporte de v3 en la fachada BNA:** D-089 establece que
`generacionBna` deberá admitir v2 **y** v3 usando exclusivamente la
sección `bna` común. Esa ampliación está **decidida pero NO
implementada**. Hasta CP-F7-0-B, `src/run/generacionBna.ts` sigue
exigiendo v2 y un perfil v3 devuelve `CONFIGURACION_INCOMPLETA` con el
motivo `PERFIL_V1`. El contrato de perfil v3 sí está implementado; el
soporte de v3 en la fachada BNA, no.

**Discriminación de versiones (implementada en CP-F5-B, ampliada a v3 en
CP-F6-B):**

1. parsear el JSON;
2. exigir que la raíz sea un objeto plano;
3. leer `schemaVersion`;
4. `"1"` → validar **exclusivamente** con el contrato v1;
5. `"2"` → validar **exclusivamente** con el contrato v2;
6. `"3"` → validar **exclusivamente** con el contrato v3;
7. cualquier otra versión → `SCHEMA_VERSION_INCOMPATIBLE`;
8. nunca intentar validar como otra versión si falla la declarada;
9. nunca convertir un v1 a v2 ni un v2 a v3;
10. nunca completar campos por defecto;
11. nunca reinterpretar claves v1 como configuración BNA.

El tipo importado se expresa como
`CompanyProfileImportado = CompanyProfile | CompanyProfileV2 | CompanyProfileV3`;
las APIs versionadas (`parsePerfilVersionado`, `validarPerfilVersionado`,
`serializarPerfilVersionado`, `perfilVersionadoDesdeBytes`) son las que
discriminan sin fallback. Las APIs v1 (`parsePerfil`, `validarPerfil`,
`serializarPerfil`, `perfilDesdeBytes`) conservan su comportamiento y
rechazan v2 y v3.

**Exportación:** conserva la versión real cargada o creada. Un perfil v1
exporta `"1"`, un v2 exporta `"2"` y un v3 exporta `"3"`; nunca se
exporta automáticamente una versión como otra.

**Readiness:** un perfil v1 válido sigue siendo válido para las funciones
existentes de F3. Para la generación BNA de F5, un perfil v1 da
`CONFIGURACION_INCOMPLETA`. Hoy solo un perfil v2 explícito y válido
satisface la parte BNA de la configuración; por D-089, CP-F7-0-B
ampliará esa aceptación a v3. En todos los casos, un perfil válido **no
habilita por sí solo la generación**: BNA-1, P-09/P-10 y las demás
condiciones siguen aplicando de forma independiente. Para Patagonia, la
fachada exige v3 desde CP-F6-C.

**Sin migración ni defaults silenciosos:** no hay conversión v1 → v2 ni
v2 → v3, no se completan campos ausentes y no se reasigna una versión. La
implementación conserva esas reglas; P-09/P-10 y BNA-1 permanecen
abiertos.

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
| 1 | CUIL inválido (formato o DV) | BLOQUEANTE | Banco de la fila; **global** si la fila no tiene destino o está excluida | Corregir la fuente | APROBADA (alcance: P-25) |
| 2 | CUIL repetido en Finnegans | BLOQUEANTE para todas las filas involucradas; **nunca se suman ni fusionan** | Banco de cada fila involucrada (ambos si están en bancos distintos); global si alguna no tiene destino | Corregir Finnegans | APROBADA (D-015, D-047) |
| 3 | CUIL o LEGAJO repetido en el maestro | BLOQUEANTE si deja ambigua una fila que participa; INFORMACION si ningún registro duplicado participa; nunca se elige uno arbitrariamente | Banco de las filas que usan el registro | Corregir el maestro | APROBADA (D-047) |
| 4 | Neto = 0 | INFORMACION; **excluida** del pago; cuenta en `EXCLUIDOS` | Global (solo informativa) | Ninguna | APROBADA (D-016, D-034) |
| 5 | Importe no interpretable (celda no numérica, más de 2 decimales, notación científica) | BLOQUEANTE | **Global** para `Neto` (el total Finnegans no puede calcularse); banco de la fila para los componentes de control | Corregir la fuente | APROBADA (D-047, D-050) |
| 6 | Neto negativo | BLOQUEANTE | Banco | Corregir la fuente | APROBADA (D-047). El máximo por layout (`NETO_EXCEDE_LAYOUT`) se **difiere** a F5/F6 |
| 7 | Fila Finnegans sin registro en el maestro | BLOQUEANTE | Banco | Completar el maestro | APROBADA (D-018) |
| 8 | Registro del maestro sin liquidación en Finnegans | INFORMACION | Global | Ninguna | APROBADA (D-018) |
| 9 | CUIL coincide pero `LEGAJO` no coincide **exactamente** (ej. `007` vs `7`) | REQUIERE_REVISION; se muestran **ambos valores**; no se modifica ninguno. Si el legajo del maestro pertenece a otro empleado de Finnegans, se indica en el detalle. **Legajo vacío en Finnegans** con CUIL válido y exactamente un registro del maestro que tiene legajo: también es `LEGAJO_NO_COINCIDE` (no es un bloqueante estructural); no se completa ni normaliza nada. Si el registro del maestro no puede identificarse sin ambigüedad (CUIL inválido, duplicado, etc.) aplican esos bloqueantes y esta regla no los oculta | Banco | Confirmar explícitamente (decisión trazable) o corregir la fuente | APROBADA (D-017, D-053) |
| 10 | `Banco` vacío (o solo espacios, N-04) con neto ≠ 0 | REQUIERE_REVISION; fila **PENDIENTE** | **Global** | Indicar BNA o Patagonia; la decisión se registra en la corrida; luego se aplican las reglas de banco | APROBADA (D-013, D-032, D-049) |
| 11 | `Banco` con texto fuera del catálogo (coincidencia exacta, sin fuzzy) | BLOQUEANTE (banco no soportado); fila **PENDIENTE**; no se reasigna | **Global** | Corregir Finnegans o el catálogo | APROBADA (D-014, D-032, D-049) |
| 12 | Banco Finnegans incompatible con el maestro, contra la entidad que el catálogo indica para el destino (también si el destino lo asignó el operador): destino BNA y entidad del `CBU` ≠ `011`; destino Patagonia y `PAT_CODIGO_BANCO` ≠ `034`. Destino Patagonia con `CBU` presente de otra entidad: solo INFORMACION (el CBU no se usa para un pago Patagonia). Destino sin entrada en el catálogo: BLOQUEANTE (`DESTINO_SIN_CATALOGO`) | BLOQUEANTE (salvo el CBU en Patagonia: INFORMACION) | Banco | Corregir la fuente | APROBADA (D-018 modificada por D-056; P-29.8, P-29.14) |
| 13 | Datos del destino faltantes o inválidos (BNA: `CBU`; Patagonia: campos `PAT_*` requeridos). Un campo exclusivo del otro destino inválido es INFORMACION (§B.3, D-048) | BLOQUEANTE | Banco | Completar el maestro | APROBADA (D-048) |
| 14 | Tipo de liquidación sin mapeo aprobado | BLOQUEANTE | Banco | Definir el mapeo en el perfil | APROBADA (D-026) |
| 15 | Nombre Patagonia normalizado o truncado (§F) | INFORMACION; se conservan valor original, valor generado y si hubo truncamiento | Patagonia | Ninguna | APROBADA (D-021, D-033) · se implementa en F6 (D-044) |
| 16 | Nombre con caracteres cuyo tratamiento no respalda el contrato bancario, después de las transformaciones aprobadas | BLOQUEANTE; no se eliminan ni reemplazan en silencio | Patagonia | Corregir la fuente o definir regla con respaldo | APROBADA provisionalmente (D-035) · se implementa en F6 (D-044) |
| 17 | `Rem + NoRem − Desc ≠ Neto` | REQUIERE_REVISION | Banco | Confirmar | APROBADA (D-047) |
| 18 | Documento Patagonia frente al CUIL | — | — | — | **DIFERIDA** (D-047, P-28): no se infiere relación entre CUIL y documento hasta definir su semántica con trazabilidad |
| 19 | `Legajoapellidonombre` no empieza con `Legajo + " - "` | INFORMACION | Banco | Ninguna | APROBADA (D-047) |

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
6.  perfil y parámetros de envío completos para ese banco. Para BNA F5,
    hoy solo un perfil v2 explícito satisface esta condición; por D-089,
    CP-F7-0-B ampliará la aceptación a v3. Mientras no exista un perfil
    válido, esta condición falla y el estado es
    `CONFIGURACION_INCOMPLETA`; un perfil v1 **no** se migra en silencio
    (D-079, D-089);
7.  generador habilitado: ningún campo `BLOQUEADA` en su contrato
    (docs/04 §7). `INTERPRETACION_PENDIENTE` no se convierte en
    `BLOQUEADA`; se informa aparte y la salida sigue pendiente de
    homologación (D-075, D-078).

Estados posibles, evaluados en este orden (precedencia modificada por
D-057: la conciliación global no cerrada va antes que `SIN_REGISTROS`,
porque una fila con pago y sin destino podría terminar en cualquiera de
los dos bancos):

| Estado | Condición |
|---|---|
| `BLOQUEADO_POR_CONCILIACION_GLOBAL` | Falla la condición 1 (aunque el banco no tenga filas asignadas) |
| `SIN_REGISTROS` | Conciliación global `CERRADA` y ninguna fila asignada al banco |
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

## H. Modelo normalizado (contratos TypeScript)

**F2 v3.** La fuente de verdad de los contratos implementados es
`src/domain/` (y `src/shared/`). Cambios respecto de v2: `Centavos` con
signo y `PayrollLine` con `cuil`/`neto` nulos (D-045);
`DescripcionLiquidacion` con estado de clasificación explícito (D-037);
campos del maestro con estado por campo para aplicar D-048; hallazgos de
los parsers con objetivo a resolver en la conciliación. `CivilDate` pasa
a F3 (D-044).

``` ts
type Brand<T, B extends string> = T & { readonly __brand: B };
type Cuil = Brand<string, 'Cuil'>;            // 11 dígitos, DV válido (N-02 aplicada)
type Cbu = Brand<string, 'Cbu'>;              // 22 dígitos, DV bloques 1 y 2, sin normalizar
type Centavos = Brand<bigint, 'Centavos'>;    // con signo (D-045)
type SourceRef = { archivo: 'FINNEGANS' | 'MAESTRO'; hoja?: string; fila?: number; columna?: string };

type Destino = 'BNA_GT_HABERES' | 'PATAGONIA_B2';

type ClasificacionLiquidacion =
  | { estado: 'REGLA_PENDIENTE' }              // único estado que produce F2 (P-10)
  | { estado: 'CLASIFICADA'; periodo: string; tipoLiquidacionNormalizado: string };
interface DescripcionLiquidacion {
  descripcionOriginal: string;                 // siempre, tal cual
  clasificacion: ClasificacionLiquidacion;
}

interface PayrollLine {                        // una fila de Finnegans
  ref: SourceRef;
  cuilTexto: string;                           // tal como vino
  cuil: Cuil | null;                           // null si es inválido o ilegible
  legajo: string | null;                       // exacto, sin trim; null si la celda es ilegible
  apellido: string;
  nombre: string;
  bancoFinnegans: string | null;               // original ('' si vacío); null si ilegible
  neto: Centavos | null;                       // null si no es interpretable
  componentes: { remunerativo: Centavos | null; noRemunerativo: Centavos | null; descuento: Centavos | null };
  descripcion: DescripcionLiquidacion;
  legajoApellidoNombre: string;
}

type CampoMaestro<T> =                         // estado de un campo bancario del maestro (D-048)
  | { estado: 'VACIO' }
  | { estado: 'VALIDO'; texto: string; valor: T }
  | { estado: 'INVALIDO'; texto: string; motivo: MotivoCampoInvalido };

interface MasterRecord {
  ref: SourceRef;
  cuilTexto: string;
  cuil: Cuil | null;
  legajo: string | null;                       // texto exacto
  apellidoNombreRef: string;                   // solo lectura humana
  cbu: CampoMaestro<Cbu>;
  patagonia: {                                 // cada campo con su estado; dependencia tal cual (PAT-2)
    tipoCuenta; numeroCuenta; codigoBanco; codigoSucursal;
    tipoDocumento; numeroDocumento; provinciaDocumento; codigoDependencia;
  };
}

interface Hallazgo {                           // salida de los parsers, antes de resolver el alcance
  codigo: CodigoIncidencia; nivel: NivelIncidencia;
  objetivo: 'GLOBAL' | 'FILA' | 'REGISTRO';    // FILA: fila Finnegans; REGISTRO: registro del maestro
  refs: SourceRef[]; campo?: string; motivo?: string; valores?: Partial<Record<'finnegans' | 'maestro', string>>;
  detalle: string;                             // sin valores
}

interface NombrePatagonia {                    // auditoría (D-033) · se implementa en F6 (D-044)
  original: string;                            // "Apellido" + "Nombre" tal como vienen
  generado: string;                            // valor que iría al TXT
  transformado: boolean;
  truncado: boolean;
}

type NivelVisible = 'CORRECTO' | 'INFORMACION' | 'REQUIERE_REVISION' | 'BLOQUEANTE';
type NivelIncidencia = Exclude<NivelVisible, 'CORRECTO'>;   // una incidencia nunca es CORRECTO
type AlcanceIncidencia = 'GLOBAL' | Destino;

type CodigoIncidencia =                       // F2 (D-047); diferidos al final
  | 'ESTRUCTURA_INVALIDA' | 'COLUMNA_DESCONOCIDA' | 'FORMULA_EN_CELDA' | 'CELDA_NUMERICA_EN_TEXTO'
  | 'TIPO_CELDA_INVALIDO' | 'FILAS_VACIAS_IGNORADAS' | 'VERSION_MAESTRO_NO_SOPORTADA' | 'CAMPO_REQUERIDO_FALTANTE'
  | 'HOJA_FINNEGANS_OCULTA'
  | 'CUIL_INVALIDO' | 'CUIL_REPETIDO_FINNEGANS' | 'CUIL_REPETIDO_MAESTRO' | 'LEGAJO_REPETIDO_MAESTRO'
  | 'NETO_CERO' | 'IMPORTE_INVALIDO' | 'NETO_NEGATIVO'
  | 'SIN_MAESTRO' | 'MAESTRO_SIN_LIQUIDACION' | 'LEGAJO_NO_COINCIDE'
  | 'BANCO_VACIO' | 'BANCO_NO_SOPORTADO' | 'BANCO_INCOMPATIBLE_MAESTRO'
  | 'CBU_FALTANTE' | 'CBU_INVALIDO' | 'DATO_PATAGONIA_FALTANTE' | 'DATO_PATAGONIA_INVALIDO'
  | 'LIQUIDACION_SIN_MAPEO' | 'NETO_NO_CUADRA_COMPONENTES' | 'LEGAJO_NOMBRE_INCONSISTENTE'
  | 'DECISION_NO_APLICADA';
// Diferidos: 'NETO_EXCEDE_LAYOUT' (F5/F6), 'NOMBRE_TRANSFORMADO' y 'NOMBRE_CARACTER_NO_SOPORTADO' (F6),
// 'DOCUMENTO_NO_COINCIDE_CUIL' (P-28).

interface Incidencia {                        // un Hallazgo con su alcance ya resuelto
  id: string;                                  // determinista: lo referencian las decisiones
  codigo: CodigoIncidencia;
  nivel: NivelIncidencia;
  alcance: AlcanceIncidencia;
  refs: SourceRef[];
  campo?: string;
  motivo?: string;                             // subcódigo (p. ej. DV_INVALIDO); nunca el valor
  valores?: Partial<Record<'finnegans' | 'maestro', string>>; // se muestran todos
  detalle: string;
}

// --- Conciliación (src/reconciliation, contratos finales de F2) ---

type EstadoFila =                              // exactamente uno por fila (§G.1)
  | { estado: 'INCLUIDA'; destino: Destino; origen: 'BANCO_FINNEGANS' | 'DECISION_OPERADOR' }
  | { estado: 'EXCLUIDA'; motivo: 'NETO_CERO' }
  | { estado: 'PENDIENTE'; motivo: 'BANCO_VACIO' | 'BANCO_NO_SOPORTADO' };

type TipoDecision = 'ASIGNAR_DESTINO' | 'CONFIRMAR_REVISION';
interface Observado {                          // datos sobre los que se decide
  cuilTexto: string;
  valores: Partial<Record<'finnegans' | 'maestro', string>>;
  huellas: Partial<Record<'finnegans' | 'maestro', string>>;   // SHA-256 de los archivos observados
}
interface IncidenciaConciliada extends Incidencia {
  resoluble?: { por: TipoDecision; observado: Observado };      // solo REQUIERE_REVISION resolubles
  resolucion?: { decisionId: string; tipo: TipoDecision; momento: string };  // sigue visible (D-051)
}
type DecisionOperador =                        // dato puro; nunca modifica las lecturas (§E.3)
  | { tipo: 'ASIGNAR_DESTINO'; destino: Destino; id; incidenciaId; refs; observado; momento }  // solo BANCO_VACIO
  | { tipo: 'CONFIRMAR_REVISION'; id; incidenciaId; refs; observado; momento };
type MotivoNoAplicada =                        // → incidencia DECISION_NO_APLICADA (INFORMACION, global)
  | 'INCIDENCIA_INEXISTENTE' | 'NO_RESOLUBLE_POR_ESTE_TIPO' | 'DATOS_CAMBIARON' | 'DECISIONES_EN_CONFLICTO';

interface FilaConciliada {
  linea: PayrollLine;
  registro: MasterRecord | null;               // único registro cruzado por CUIL; nunca se elige entre duplicados
  estado: EstadoFila;
  incidencias: IncidenciaConciliada[];
  nivel: NivelVisible;                         // el más grave de las NO resueltas, o CORRECTO
}

interface EntradaConciliacion {
  finnegans: LecturaFinnegans;
  maestro: LecturaMaestro;
  huellas: { finnegans: string; maestro: string };
  decisiones?: DecisionOperador[];
  catalogoBancos?: BancoCatalogado[];          // por defecto el catálogo cerrado D-012
  liquidaciones?: PoliticaLiquidaciones;       // por defecto SIN_MAPEOS_APROBADOS (D-026)
}

interface Totales { cantidad: number; importe: Centavos | null; filasSinImporte: number }

interface GlobalReconciliationStatus {
  estado: 'CERRADA' | 'PENDIENTE' | 'BLOQUEADA';
  finnegans: Totales;                          // calculado de las líneas, aparte de los estados
  bna: Totales;
  patagonia: Totales;
  excluidas: Totales;                          // hoy solo NETO_CERO
  pendientes: Totales;
  invarianteCantidad: boolean;                 // finnegans = bna + patagonia + excluidas + pendientes
  invarianteImporte: boolean | null;           // ídem en centavos; null si hay un neto ilegible
  invarianteSinPendientes: boolean | null;     // con pendientes = 0: finnegans = bna + patagonia + excluidas
  bloqueantesGlobales: number;
  revisionesGlobalesSinResolver: number;
  motivos: ('BLOQUEANTES_GLOBALES' | 'IMPORTE_NO_CALCULABLE' | 'INVARIANTE_CANTIDAD'
    | 'INVARIANTE_IMPORTE' | 'FILAS_PENDIENTES' | 'REVISIONES_GLOBALES_SIN_RESOLVER')[];
}

interface ResultadoConciliacion {
  filas: FilaConciliada[];                     // una por PayrollLine, mismo orden
  incidencias: IncidenciaConciliada[];         // todas, id únicos
  decisiones: { aplicadas: DecisionOperador[]; noAplicadas: { decision: DecisionOperador; motivo: MotivoNoAplicada }[] };
  global: GlobalReconciliationStatus;
}

// --- Readiness (evaluarReadiness(resultado, contexto = CONTEXTO_F2)) ---

type EstadoReadiness =
  | 'BLOQUEADO_POR_CONCILIACION_GLOBAL' | 'SIN_REGISTROS' | 'BLOQUEADO' | 'REQUIERE_REVISION'
  | 'CONFIGURACION_INCOMPLETA' | 'GENERADOR_NO_HABILITADO' | 'LISTO_PARA_GENERAR';

interface BankReadiness<D extends Destino> {
  destino: D;
  estado: EstadoReadiness;                     // la primera condición que falla, en el orden de §G.3 (D-057)
  asignadas: Totales;                          // todas las filas con este destino
  bloqueantes: number;
  revisionesSinResolver: number;
  motivos: ('CONCILIACION_GLOBAL_NO_CERRADA' | 'SIN_REGISTROS' | 'BLOQUEANTES_DEL_BANCO'
    | 'REVISIONES_DEL_BANCO_SIN_RESOLVER' | 'CONFIGURACION_INCOMPLETA' | 'GENERADOR_NO_HABILITADO')[];
  pendienteHomologacion: true;                 // siempre, hasta la homologación (D-029)
}
type BnaReadiness = BankReadiness<'BNA_GT_HABERES'>;
type PatagoniaReadiness = BankReadiness<'PATAGONIA_B2'>;
interface ContextoReadiness {                  // F2 en producción: CONTEXTO_F2, todo en false
  configuracionCompleta: Record<Destino, boolean>;   // perfil y parámetros (F3)
  generadorHabilitado: Record<Destino, boolean>;     // contratos sin campos BLOQUEADA (F5/F6)
}
```

## I. Privacidad

El maestro es sensible aunque no haya base de datos: RRHH restringe el
acceso, mantiene una copia de respaldo protegida y controla versiones.
El perfil de empresa no contiene datos de empleados, pero sí datos de la
cuenta de la empresa: se maneja con el mismo cuidado y nunca se versiona.
