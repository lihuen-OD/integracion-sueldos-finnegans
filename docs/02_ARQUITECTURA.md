# 02 · Arquitectura técnica

**Estado:** aprobada con modificaciones (14-10-2026). Decisiones en
`07_DECISIONES_Y_PENDIENTES.md` (D-007, D-027, D-031).

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

## Motor fixed-width genérico (D-027)

BNA y Patagonia **no** implementan por separado posiciones, relleno,
longitudes, serialización, juego de caracteres, parseo ni inspección:
todo eso vive en `banks/fixed-width/`. Cada banco aporta solo
especificaciones (datos) y el mapeo de su modelo de pago a valores de
campo.

### Componentes

| Componente | Responsabilidad |
|---|---|
| `FieldSpec` | Un campo: id, nombre, inicio/fin 1-based inclusivos, longitud declarada, tipo `N`/`A`, regla de relleno, origen, valor fijo opcional, fuente (documento + página) y estado (`CONFIRMADA` / `INTERPRETACION_PENDIENTE` / `BLOQUEADA`) |
| `RecordSpec` | Un tipo de registro: identificador, longitud total (200) y `FieldSpec[]` ordenados |
| `FixedWidthSerializer` | Valores → registro: valida tipo, juego de caracteres y longitud de cada valor; aplica el relleno; arma la línea; **rechaza** (nunca trunca en silencio) |
| `FixedWidthParser` | Registro → valores, usando solo la especificación; implementación independiente del serializador |
| `FixedWidthInspector` | Archivo completo: longitud en bytes de cada línea, orden de registros, valores fijos, caracteres admitidos, separador de líneas y reglas de totales/cantidades que declara cada banco |

### Contratos (sin implementación)

``` ts
type ContractStatus = 'CONFIRMADA' | 'INTERPRETACION_PENDIENTE' | 'BLOQUEADA';
type FieldType = 'N' | 'A';
type Padding =
  | { kind: 'ZERO_LEFT' }                         // N: dígitos, ceros a la izquierda
  | { kind: 'SPACE_RIGHT' }                       // A: alineado a izquierda, espacios a derecha
  | { kind: 'CUSTOM'; ruleId: string };           // p. ej. convenio BNA (BNA-5); requiere fuente
type FieldOrigin = 'FINNEGANS' | 'MAESTRO' | 'PERFIL' | 'ENVIO' | 'DERIVADO' | 'FIJO';

interface FieldSpec {
  id: string;
  name: string;
  start: number;                                  // 1-based, inclusivo
  end: number;                                    // 1-based, inclusivo
  declaredLength: number;                         // tal como figura en el PDF
  type: FieldType;
  padding: Padding;
  origin: FieldOrigin;
  fixedValue?: string;
  source: { doc: 'BNA' | 'PAT_DR' | 'PAT_XL'; pages: number[]; note?: string };
  status: ContractStatus;
}

interface RecordSpec {
  id: string;                                     // p. ej. 'BNA_R1', 'PAT_R2'
  recordLength: 200;
  fields: readonly FieldSpec[];
}

interface FileSpec {
  id: 'BNA_GT_HABERES' | 'PATAGONIA_B2';
  records: readonly RecordSpec[];
  lineSeparator: { value: '\r\n' | '\n'; status: ContractStatus };
  trailingSeparator: { value: boolean; status: ContractStatus };
  charset: 'ASCII_PRINTABLE';                     // 0x20–0x7E
  structure: string;                              // orden de registros, p. ej. '1 2+ 3' o '0 (1 2+)+'
}

// Un FileSpec puede generar solo si ninguno de sus FieldSpec/separadores está BLOQUEADA.
```

### Invariantes verificadas por tests (sobre cada spec)

-   Posiciones contiguas, sin huecos ni solapamientos, desde 1 hasta
    `recordLength`.
-   `end − start + 1` igual a la longitud declarada; si no coincide, el
    campo debe estar `BLOQUEADA` con la discrepancia documentada (caso
    PAT-1).
-   Longitud real de cada valor serializado igual a la del campo.
-   Relleno correcto por tipo; valores fijos exactos.
-   Solo caracteres admitidos; longitud de cada registro = 200 **bytes**.
-   Round-trip: `parse(serialize(x)) = x`; el inspector rechaza archivos
    alterados deliberadamente (un byte, una línea, un total).
-   Golden files **sintéticos** armados a mano y verificados contra los
    ejemplos de los PDF (solo posiciones; los totales de los ejemplos
    BNA no son coherentes, BNA-3).

## Librerías

| Área | Elección | Estado |
|---|---|---|
| UI | React + TypeScript strict + Vite | Aprobada |
| Diseño | Tailwind CSS, componentes accesibles, sin fuentes ni CDN remotos | Aprobada |
| XLSX | ExcelJS 4.4.0 (bundle de navegador) + guarda previa del zip con fflate | Spike F1 superado; recomendación APROBAR pendiente de confirmación (`docs/spikes/F1_XLSX.md`). Plan B: lector mínimo propio (unzip + DOMParser) para Finnegans |
| Validación | Zod para perfil, parámetros y filas del maestro; **no** para layouts fixed-width | Aprobada |
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
  profile/                 # perfil de empresa (Zod, import/export)
  reconciliation/          # join, reglas docs/03 §E, resumen, invariante
  banks/
    fixed-width/           # FieldSpec, RecordSpec, FileSpec, Serializer, Parser, Inspector
    bna-gt-haberes/        # spec (datos con fuente/estado) + mapper del modelo de pago
    patagonia-b2/          # spec (datos con fuente/estado) + mapper del modelo de pago
  export/                  # descarga de bytes, reporte XLSX, plantilla del maestro
  ui/                      # React: pasos del asistente, sin reglas de negocio
```
