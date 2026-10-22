# 02 · Arquitectura técnica

**Estado:** aprobada con modificaciones (14-10-2026). Decisiones en
`07_DECISIONES_Y_PENDIENTES.md` (D-007, D-027, D-031). Contratos del
motor fixed-width congelados por el plan F4 v3 (22-10-2026: D-068 a
D-077).

## Principio

**Aplicación local de procesamiento por lotes, sin backend ni base de
datos.** El maestro XLSX y el perfil de empresa son archivos externos
administrados por RRHH; la app no es dueña de ellos.

``` text
Finnegans.xlsx ──→ adaptador Finnegans ──┐
Maestro.xlsx ────→ adaptador Maestro ────┼─→ conciliación ─→ validación ─→ modelo de pago
Perfil empresa ──→ validación de perfil ─┤                                   │
Parámetros envío → validación de envío ──┘                                   │
                                                                             ▼
                                         ┌──────── motor fixed-width genérico ────────┐
                                         │ FieldSpec · RecordSpec · Serializer ·      │
                                         │ Parser · Inspector                         │
                                         └──────┬──────────────────────────┬──────────┘
                                                ▼                          ▼
                                       spec BNA GT Haberes         spec Patagonia B.2
                                                ▼                          ▼
                                     inspección independiente   inspección independiente
                                                ▼                          ▼
                                              .txt                       .txt
                                    (PENDIENTE DE HOMOLOGACION hasta aprobación bancaria)
              conciliación ──→ reporte de conciliación .xlsx
```

## Capas

-   **Presentación (React):** carga de archivos, resumen, incidencias,
    decisiones del operador, configuración y descarga. **No conoce
    posiciones ni construye TXT**; no contiene reglas bancarias.
-   **Importación:** lectura XLSX a través de un único adaptador,
    normalización de encabezados, mapeo de filas, errores localizados
    por hoja/fila/columna.
-   **Dominio:** `Cuil`, `Cbu`, `Cents`, `CivilDate`, `PayrollLine`,
    `MasterRecord`, `Incidencia` (docs/03 §H). Funciones puras.
-   **Conciliación:** join determinista por CUIL, control exacto de
    legajo, destino, reglas de docs/03 §E, invariante de totales.
-   **Motor fixed-width:** genérico, sin conocimiento de bancos (ver
    abajo).
-   **Especificaciones bancarias:** layouts BNA y Patagonia declarados
    como datos, más el mapeo dominio → valores de campo.
-   **Exportación:** TXT (bytes), reporte de conciliación, plantilla de
    maestro y perfil. Nunca API.

## Motor fixed-width genérico (D-027 · contratos F4: D-068 a D-077)

BNA y Patagonia **no** implementan por separado posiciones, relleno,
longitudes, serialización, juego de caracteres, parseo ni inspección:
todo eso vive en `banks/fixed-width/`, que **no conoce bancos**: sin
nombres, ids, códigos ni catálogos de BNA o Patagonia (D-068). Cada
banco aporta solo especificaciones (datos) y el mapeo de su modelo de
pago a valores de campo.

### Componentes

| Componente | Responsabilidad |
|---|---|
| `FieldSpec` | Un campo: id, nombre humano, inicio/fin 1-based inclusivos en **bytes**, longitud declarada, tipo `N`/`A`, relleno `ZERO_LEFT`/`SPACE_RIGHT`, valor fijo opcional y estado contractual |
| `RecordSpec` | Un tipo de registro: id opaco, longitud total en **bytes** y `FieldSpec[]` con cobertura exacta |
| `FixedWidthSerializer` | Valores lógicos → representación exacta: valida tipo, juego de caracteres y longitud de cada valor; aplica el relleno; arma la línea; **rechaza** (nunca trunca en silencio) |
| `FixedWidthParser` | Bytes → slices crudos exactos por campo, solo con la especificación; implementación independiente del serializador; **sin canonicalización** (D-071) |
| `FixedWidthInspector` | Archivo completo: bytes y charset, longitud de cada línea, identificación de registros, orden/estructura, cardinalidades, valores fijos y separadores (D-073) |
| `hallarBloqueosGeneracion` | Único lector de `ContractStatus`: lista los campos/separadores `BLOQUEADA` para la capa superior (D-075) |

### Contratos (sin implementación; PLAN F4 v3)

``` ts
type ContractStatus = 'CONFIRMADA' | 'INTERPRETACION_PENDIENTE' | 'BLOQUEADA';
type FieldType = 'N' | 'A';
type Padding =
  | { kind: 'ZERO_LEFT' }   // N: dígitos, ceros a la izquierda
  | { kind: 'SPACE_RIGHT' } // A: alineado a izquierda, espacios a derecha
// Sin CUSTOM en F4 (D-072): solo si F5/F6 demuestran necesidad con regla
// bancaria confirmada se extiende esta unión.

interface FieldSpec {
  id: string;
  name: string;             // requerido: metadata humana, sin datos de usuario
  start: number;            // 1-based, inclusivo, en bytes
  end: number;              // 1-based, inclusivo, en bytes
  declaredLength: number;   // tal como figura en la fuente
  type: FieldType;
  padding: Padding;         // ZERO_LEFT exige 'N'; SPACE_RIGHT exige 'A' (PADDING_INCOHERENTE)
  fixedValue?: string;      // ocupa todo el campo; base del discriminador (D-070)
  status: ContractStatus;   // solo lo lee hallarBloqueosGeneracion (D-075)
}
// Sin `origin` ni `source`: son trazabilidad documental de las specs
// bancarias (F5/F6), no necesidad del motor (D-068).

interface RecordSpec {
  id: string;                   // opaco
  recordLength: number;         // bytes; >= 1; longitudes heterogéneas permitidas (D-069)
  fields: readonly FieldSpec[]; // cobertura exacta 1..recordLength, en orden por start
}

type EstructuraArchivo =
  | { kind: 'registro'; recordId: string }
  | { kind: 'secuencia'; partes: readonly EstructuraArchivo[] }
  | { kind: 'repeticion'; parte: EstructuraArchivo; min: number }; // min entero >= 1
// Sin `max` ni `min: 0`: diferidos hasta existir necesidad real (D-070).

interface FileSpec {
  id: string;             // opaco; sin unión de bancos (D-068)
  records: readonly RecordSpec[];
  charset: 'ASCII_PRINTABLE'; // 0x20–0x7E, sin BOM (D-074)
  lineSeparator: { value: '\r\n' | '\n'; status: ContractStatus };
  trailingSeparator: { value: boolean; status: ContractStatus };
  structure: EstructuraArchivo; // tipada; sin string libre ni DSL de totales (D-073)
}
```

Frontera (D-077): F4 entrega las primitivas/API del motor genérico
(serializer, parser, inspector, estructura, identificación, aptitud); no
define interfaz de generación bancaria. F5/F6 componen esas primitivas
con sus specs, mappers y reglas bancarias para cada banco; la política
productiva (readiness y condición 7) permanece en la capa superior y no
se mueve al motor.

En la capa bancaria (F5/F6) se extienden estos tipos con la trazabilidad
documental, y siguen siendo asignables donde el motor pide
`FieldSpec`/`FileSpec`:

``` ts
type FieldOrigin = 'FINNEGANS' | 'MAESTRO' | 'PERFIL' | 'ENVIO' | 'DERIVADO' | 'FIJO';
type DocBancario = 'BNA' | 'PAT_DR' | 'PAT_XL'; // catálogo de docs/04; nunca importado por el motor

interface FieldSpecBancaria extends FieldSpec {
  origin: FieldOrigin;
  source: { doc: DocBancario; paginas: readonly number[]; nota?: string };
}
```

### Identificación de RecordSpec (D-070)

Los discriminadores se derivan de **todos** los campos con `fixedValue`
(no existe un matcher adicional). Todo `RecordSpec` alcanzado por la
estructura debe tener al menos un `fixedValue`
(`REGISTRO_SIN_DISCRIMINADOR`).

Identificación runtime, en orden:

1.  filtrar candidatos por `recordLength` igual a la longitud de la
    línea;
2.  comparar discriminadores (slices fijos byte a byte);
3.  0 coincidencias → `REGISTRO_DESCONOCIDO`;
4.  1 coincidencia → identificado;
5.  más de una → `REGISTRO_AMBIGUO` (defensa en profundidad).

Validación estática en `validarFileSpec`:

-   **Longitudes diferentes entre dos RecordSpec:** no se evalúan entre
    sí; la longitud los discrimina.
-   **Misma longitud:** distinguibles **solo si** existe al menos una
    posición restringida por `fixedValue` en **ambos** con bytes
    distintos. Una posición restringida por uno solo es *wildcard*, no
    conflicto. Si no existe una posición común restringida con bytes
    distintos → `DISCRIMINADOR_AMBIGUO`.

Ejemplos normativos (obligatorios en tests, docs/06):

| # | R1 | R2 | Resultado |
|---|---|---|---|
| 1 | pos 1 = `1` (misma longitud) | pos 1 = `2` | distinguibles |
| 2 | pos 1 = `1` (misma longitud) | pos 2 = `A` | `DISCRIMINADOR_AMBIGUO` |
| 3 | pos 1 = `1`, pos 2 = `A` (misma longitud) | pos 1 = `1` | `DISCRIMINADOR_AMBIGUO` |
| 4 | mismos `fixedValue` (misma longitud) | ídem | `DISCRIMINADOR_AMBIGUO` |
| 5 | pos 1 = `1` (misma longitud) | pos 1 = `1`, pos 2 = `A` | `DISCRIMINADOR_AMBIGUO` |
| 6 | pos 1 = `1`, longitud 10 | pos 1 = `1`, longitud 12 | no ambiguos: la longitud discrimina |

### No ambigüedad estructural (D-070)

La gramática debe probarse no ambigua **antes** del runtime. Para toda
`repeticion` R se verifica que los ids que pueden continuar R (los
alcanzables dentro de su `parte`) sean disjuntos de los ids que pueden
seguirla (formulación FIRST/FOLLOW equivalente:
`POSIBLES(parte) ∩ FOLLOW(R) = ∅`, con FOLLOW que incluye los hermanos
siguientes y la re-entrada de las repeticiones contenedoras). Si no,
`ESTRUCTURA_AMBIGUA`.

El runtime **no resuelve ambigüedad**: ni "continuar gana" ni "cerrar
gana" son reglas de desempate. Ejecuta una gramática ya demostrada no
ambigua, donde cada línea identificada tiene exactamente una transición
válida. No hay backtracking y nunca se cierra un marco de repetición sin
cumplir su `min`.

-   Aceptados: `1 2+ 3` · `0 (1 2+)+` ·
    `secuencia[registro A, repeticion{min:1} A]`.
-   Rechazados: `secuencia[repeticion{min:1} A, registro A]` ·
    `secuencia[repeticion{min:1} A, repeticion{min:1} A]` · anidamientos
    equivalentes donde el mismo recordId pueda significar
    simultáneamente continuar una repetición o avanzar en la estructura.

### Semántica del parser (RAW, D-071)

El parser observa bytes. **No** recorta (*trim*), no canonicaliza, no
elimina ceros ni espacios, no interpreta semántica bancaria. Preserva la
representación exacta: `02` permanece `02`; `0000` permanece `0000`; los
espacios interiores y finales se conservan; el slice es de **ancho
completo** por campo.

-   `N`: solo dígitos ASCII. Un slice de espacios en `N` es inválido,
    simétrico con el serializer.
-   `A`: ASCII printable admitido por el motor (D-074).
-   `fixedValue`: comparación exacta byte a byte.
-   Errores con posición (spec/registro/campo/línea/offset) y códigos,
    nunca con el contenido del registro.

### Round-trip (D-071)

-   **R-T1 · Fidelidad.** Para valores lógicos válidos `V`:
    `parse(serializar(V))` devuelve exactamente los slices/raw bytes que
    el serializer escribió, relleno incluido.
-   **R-T2 · Estabilidad.** Para todo registro crudo aceptado: parsear;
    tomar únicamente los slices de campos **sin** `fixedValue`;
    construir `ValoresPorCampo`; serializar — el serializer reconstruye
    los `fixedValue` desde la spec —; el resultado es byte a byte
    idéntico al registro original. El helper para probarlo es exclusivo
    de tests, sin API pública adicional.
-   **R-T3 · Limitación honesta.** Una mutación dentro de un campo
    variable que continúe siendo válida según su alfabeto no
    necesariamente puede detectarse genéricamente. Totales, consistencia
    y reglas semánticas son F5/F6, sobre el modelo parseado.

Reglas de valores del serializer: `N` vacío → error; `A` vacío →
espacios (`SPACE_RIGHT`); overflow → error; nunca truncar; dar valor a
un campo fijo → `VALOR_EN_CAMPO_FIJO`. Los espacios finales recibidos en
`A` son caracteres; cualquier semántica adicional es bancaria.

### `rutaRepeticiones` (D-070, D-073)

Cada registro de `ArchivoParseado` informa `rutaRepeticiones:
readonly number[]`: contadores **1-based** de las repeticiones anidadas,
de la **exterior a la interior**. `[]` fuera de repeticiones; `[3]`
tercera iteración exterior; `[3, 2]` tercera iteración exterior y
segunda interior. Con eso, F5/F6 implementan loteo, totales y
consistencias sin reescribir parser, serializer ni inspector.

### Aptitud vs capacidad técnica (D-075)

El motor puede serializar, parsear e inspeccionar **independientemente
de `ContractStatus`**: la capacidad técnica no es la autorización
productiva. `hallarBloqueosGeneracion` examina la spec y lista los
campos/separadores `BLOQUEADA`; la política de habilitación permanece en
la capa superior (readiness y condición 7 de docs/03 §G.3).
`BLOQUEADA` impide la generación productiva; `INTERPRETACION_PENDIENTE`
no se convierte silenciosamente en confirmada y la salida continúa
**PENDIENTE DE HOMOLOGACION**. La aplicación no está apta para pagos
reales hasta la homologación.

### Errores (convención)

`Result` explícito (sin excepciones como flujo normal, D-022); códigos
deterministas estilo `ErrorImporte`; se acumulan todos, ordenados
deterministamente. Borrador de códigos:

-   **Spec:** `HUECO_POSICIONES`, `SOLAPAMIENTO_POSICIONES`,
    `LONGITUD_DECLARADA_INCONSISTENTE`, `COBERTURA_INCOMPLETA`,
    `PADDING_INCOHERENTE`, `FIJO_INCOHERENTE`,
    `REGISTRO_SIN_DISCRIMINADOR`, `DISCRIMINADOR_AMBIGUO`,
    `ESTRUCTURA_AMBIGUA`, `REGISTRO_INEXISTENTE_EN_ESTRUCTURA`,
    `REGISTRO_NO_ALCANZABLE`.
-   **Valor:** `VALOR_FALTANTE`, `VALOR_EN_CAMPO_FIJO`,
    `VACIO_NO_PERMITIDO`, `CARACTER_INVALIDO`, `LONGITUD_EXCEDIDA`,
    `DIGITO_INVALIDO`.
-   **Parseo:** `LONGITUD_INVALIDA`, `CARACTER_NO_ADMITIDO`,
    `DIGITO_INVALIDO`, `VALOR_FIJO_INCORRECTO`.
-   **Archivo:** `ARCHIVO_VACIO`, `BOM_DETECTADO`, `SEPARADOR_MIXTO`,
    `SEPARADOR_FINAL_INVALIDO`, `LINEA_VACIA`, `LONGITUD_LINEA_INVALIDA`,
    `REGISTRO_DESCONOCIDO`, `REGISTRO_AMBIGUO`, `ORDEN_INVALIDO`,
    `REPETICION_INCOMPLETA`, `REGISTRO_FALTANTE`, `LINEA_DEMASIADO`.

Ningún error incluye el valor del registro.

### Invariantes verificadas por tests (sobre cada spec)

-   Posiciones contiguas, sin huecos ni solapamientos, desde 1 hasta
    `recordLength` (en bytes).
-   `end − start + 1` igual a `declaredLength`; si no coincide →
    `LONGITUD_DECLARADA_INCONSISTENTE` → la `RecordSpec` es técnicamente
    INVÁLIDA. `ContractStatus` no modifica esta conclusión.
-   **Validez técnica (A) ≠ estado contractual (B).** (A) Los puntos de
    esta lista son validez técnica de la spec: rangos, cobertura, huecos,
    solapamientos, `declaredLength`, padding/tipo, `fixedValue`,
    discriminadores, estructura; si falla, la spec es inválida. (B) El
    estado (`CONFIRMADA` / `INTERPRETACION_PENDIENTE` / `BLOQUEADA`)
    informa aptitud contractual/productiva; **no repara ni excusa** una
    spec técnicamente inválida. Es consecuencia de D-075: serializer,
    parser e inspector operan independientemente de `ContractStatus`, y
    `hallarBloqueosGeneracion` es el único componente que interpreta ese
    estado para informar aptitud productiva. Una discrepancia de la
    documentación bancaria puede justificar que una futura
    interpretación/layout permanezca contractualmente bloqueada (p. ej.
    PAT-1, sigue pendiente para F6), pero toda `RecordSpec` concreta que
    se entregue al motor debe ser internamente coherente para poder ser
    técnicamente válida.
-   Longitud real de cada valor serializado igual a la del campo.
-   Relleno coherente con el tipo; valores fijos exactos.
-   Solo caracteres 0x20–0x7E, sin BOM; longitud de cada registro =
    `recordLength` **bytes**.
-   Identificación determinista por discriminadores; gramática no
    ambigua demostrada estáticamente.
-   Round-trip R-T1/R-T2; el inspector rechaza mutaciones estructurales
    (charset, longitud, separadores, fijos, orden), construidas también
    sobre bytes a mano, sin pasar por el serializer.
-   Golden files **sintéticos** armados a mano: de F5/F6 para sus specs
    reales (los totales de los ejemplos BNA no son coherentes, BNA-3).

## Librerías

| Área | Elección | Estado |
|---|---|---|
| UI | React + TypeScript strict + Vite | Aprobada |
| Diseño | Tailwind CSS, componentes accesibles, sin fuentes ni CDN remotos | Aprobada |
| XLSX | ExcelJS 4.4.0 (bundle de navegador) + guarda previa del zip con fflate | **Aprobada** (D-040): confinada a `src/import/xlsx/`; el resto de la app depende solo del contrato del adaptador. Riesgo `uuid` aceptado (D-041). Plan B documentado: lector mínimo propio (unzip + DOMParser) |
| Validación | Validadores propios, hechos a mano, sin Zod ni dependencias de esquema (perfil, parámetros y filas del maestro); **no** para layouts fixed-width | Aprobada (D-051, D-058; reemplaza el Zod preciso en F1) |
| Tests | Vitest + React Testing Library + Playwright | Aprobada |
| Calidad | ESLint + Prettier + `tsc --noEmit` | Aprobada |
| Desktop | Tauri 2 o HTML único autocontenido | Se decide en F8 |

**Nota de empaquetado:** el MVP web puede abrirse en `localhost`
mediante servidor local de vista previa. Esto **no es un backend** ni
requiere Internet.

## Reglas de implementación

-   El parser XLSX no evalúa fórmulas. Celdas con fórmulas en datos
    usados → `BLOQUEANTE`, nunca cálculo implícito.
-   El lector no confía en la dimensión declarada del XLSX (Finnegans la
    escribe incorrecta, docs/03 §A.1).
-   CUIL, CBU, cuentas, documentos y legajos son **strings**; los
    legajos se comparan de forma exacta (D-017).
-   `Cents` = `bigint`. Conversión: valor leído → texto decimal mínimo de
    ida y vuelta → regex decimal estricta (máx. 2 decimales) → `bigint`.
    Prohibido `parseFloat`, `toFixed` o multiplicar por 100 en dominio y
    bancos.
-   Fechas civiles `YYYY-MM-DD` sin `Date` con zona horaria. No se
    calculan feriados: el operador ingresa las fechas; la app valida
    formato, orden y fines de semana.
-   CUIL y CBU con DV validado como validación externa (docs/04 §5).
    No se deriva la cuenta Patagonia del CBU ni el documento del CUIL.
-   Salida: bytes ASCII 0x20–0x7E construidos explícitamente (en ese
    rango coinciden ASCII, Windows-1252 "ANSI" y UTF-8 sin BOM).
    Separador de línea y salto final según `FileSpec` (hoy `I`).
-   Toda descarga pasa por el inspector, que es independiente del
    serializador.
-   Sin persistencia: nada en `localStorage`, `sessionStorage`,
    IndexedDB, cookies, service workers ni caché. Al cerrar o recargar,
    se vuelven a seleccionar los archivos. `autocomplete="off"` en los
    formularios.
-   Build de producción con CSP `connect-src 'none'`; ningún `fetch`,
    `XMLHttpRequest`, `WebSocket` ni `sendBeacon` en el código.
-   Sin logs de datos personales ni importes (`console` prohibido en
    `src/`, salvo un logger que no reciba datos de filas).
-   Límites de las capas reforzados con reglas de ESLint
    (`no-restricted-imports`): `ui/` no importa specs ni el motor; solo
    `import/xlsx/` importa la librería XLSX.

## Estructura de `src/`

``` text
src/
  domain/                  # Cuil, Cbu, Cents, CivilDate, Incidencia (puras)
  import/
    xlsx/                  # único adaptador que conoce la librería XLSX
    finnegans/             # encabezados, mapeo, errores por celda
    master/                # plantilla y lector del maestro
  profile/                 # perfil de empresa (validadores propios, import/export)
  reconciliation/          # join, reglas docs/03 §E, resumen, invariante
  banks/
    fixed-width/           # FieldSpec, RecordSpec, FileSpec, Serializer, Parser, Inspector
    bna-gt-haberes/        # spec (datos con fuente/estado) + mapper del modelo de pago
    patagonia-b2/          # spec (datos con fuente/estado) + mapper del modelo de pago
  export/                  # descarga de bytes, reporte XLSX, plantilla del maestro
  ui/                      # React: pasos del asistente, sin reglas de negocio
```
