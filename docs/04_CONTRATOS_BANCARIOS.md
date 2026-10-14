# 04 · Contratos bancarios y puntos a confirmar

**Versión:** F0 v1 · **Fecha:** 14-10-2026

## 1. Política

-   Ninguna posición, longitud, código, relleno o regla se implementa
    sin fuente en `references/`. No se usa Internet como fuente.
-   Cada campo tiene estado **C** = `CONFIRMADA`, **I** =
    `INTERPRETACION_PENDIENTE` o **B** = `BLOQUEADA`.
-   Las interpretaciones y bloqueos de la §6 **no están autorizados a
    resolverse** sin respuesta del banco o decisión documentada del
    usuario (D-029). La app se desarrolla alrededor de ellos.
-   Un generador **no puede habilitarse** mientras use un campo `B`.
    Aun habilitado, su salida queda marcada **PENDIENTE DE
    HOMOLOGACION** hasta la aprobación del banco (D-010, D-030).
    Cumplir 200 posiciones no implica que el banco acepte el archivo.
-   Hoy los pagos se cargan manualmente persona por persona: **no existe
    un TXT histórico** aceptado que sirva como golden file (D-030).
-   Los layouts se declaran como datos (`FieldSpec` / `RecordSpec`) sobre
    el motor fixed-width genérico (docs/02, D-027). Los números de página
    citados se copian en cada `FieldSpec.source`.

### 1.1 Fuentes

| Abrev. | Archivo en `references/` | Págs. | Contenido |
|---|---|---|---|
| **BNA** | `BNA_Instructivo_Pago_Haberes_GT.pdf` | 16 | Convenio Pago de Haberes, "Instructivo Diseños de Registro de Pagos GT". No es el de Proveedores/Terceros. |
| **PAT-DR** | `Patagonia_Diseno_Registros_Plan_Sueldos.pdf` | 10 | Plan Sueldos, diseños de registros. **B.2 en pp. 8–9 (fuente principal, D-025)**; anexos pp. 9–10; alta de cuentas (A.2) pp. 2–3 |
| **PAT-XL** | `Patagonia_Instructivo_Excel_Acreditaciones.pdf` | 6 | Manual del aplicativo Excel con macros del banco. **Evidencia complementaria**; no define el TXT (D-025) |

SHA-256 y fechas de recepción en `07_DECISIONES_Y_PENDIENTES.md`.
"p.N" es la página del PDF.

## 2. Banco Nación — Pagos GT Haberes

### 2.1 Reglas generales del documento

| Regla | Fuente | Estado |
|---|---|---|
| TXT de 200 posiciones; registros `1` cabecera, `2` individual (uno por cuenta a acreditar), `3` fin de archivo | p.2, 3, 8 | C |
| `A`: letras A–Z y dígitos 0–9, alineado a izquierda, espacios a derecha | p.4 | C |
| `N`: solo dígitos, ceros a la izquierda, longitud completa | p.4 | C |
| Filler: espacios. Sin tabulaciones ni caracteres especiales | p.4 | C |
| Texto en mayúsculas (el ejemplo convierte "Pago Haberes mayo" en `PAGO HABERES MAYO`) | p.7 | I (BNA-8) |
| TXT en formato "ANSI" | p.14 | C |
| "Pulsar ENTER" tras el registro 3: implica salto de línea final; el separador (CRLF/LF) no se especifica | p.14 | I (BNA-9) |
| El archivo puede probarse antes de la acreditación en la casilla SERVICIOSDEPAGO | p.14 | C |
| Canales: sucursales (transmisión XC), NE24 (excepto pagos por plantilla), BNA.net | p.2 | C |
| La acreditación puede ser en cuentas radicadas en BNA **o en otros bancos** | p.5 | C |

### 2.2 Posiciones

El PDF **no tiene columnas de posición**: da orden y longitud. Las
posiciones se derivan por suma acumulada (**aprobado por el usuario,
D-023**), cierran en 200 en los tres registros y se verificaron contra
los ejemplos de p.7, 11, 14 y 15.

#### Registro 1 — Cabecera de archivo (p.5–7)

Verificación: el ejemplo de p.7 tiene 79 caracteres + "121 espacios en
blanco" = 200.

| # | Campo | Pos. | L | T | Valor / regla | Origen | Fuente | Estado |
|---|---|---|---|---|---|---|---|---|
| 1 | Tipo de registro | 1–1 | 1 | N | `1` | Fijo | p.5 | C |
| 2 | Identificación empresa | 2–12 | 11 | N | CUIT ordenante, sin guiones | Perfil | p.5 | C |
| 3 | Sucursal de la cuenta de la empresa | 13–16 | 4 | N | "0 + código BCRA"; en el ejemplo coincide con los dígitos 4–7 del CBU de la empresa | Perfil (derivado del CBU empresa) | p.5, 7 | C · derivación **I** (BNA-6) |
| 4 | Bloque 2 CBU de la empresa | 17–30 | 14 | N | Dígitos 9–22 del CBU de la empresa | Perfil (derivado) | p.5, 7 | C |
| 5 | Moneda transacción | 31–31 | 1 | A | `0` pesos · `1` dólares | Perfil | p.5 | C |
| 6 | Fecha compensación | 32–39 | 8 | N | Día hábil **anterior** a la acreditación. Formato AAAAMMDD solo por ejemplo | Envío | p.5, 7, 14 | **I** (BNA-7) |
| 7 | Información criterio empresa | 40–59 | 20 | A | Libre | Envío | p.6, 7 | C · vacío permitido **I** (BNA-11) |
| 8 | Tipo de pagos | 60–62 | 3 | A | `SUE` | Fijo | p.6 | C |
| 9 | Clase de pagos | 63–63 | 1 | A | `1` | Fijo | p.6 | C |
| 10 | Código de convenio | 64–73 | 10 | N | "2 ceros + 8 números; si sólo tienen 4, completar con 4 ceros más". Ejemplo: 4455 → `0044550000` (relleno a **derecha**) | Perfil | p.6, 7, 15 | **I** (BNA-5) |
| 11 | Número de envío | 74–79 | 6 | N | `1` primer envío del día, `2` segundo | Envío | p.6 | C |
| 12 | Sistema original | 80–81 | 2 | A | Espacios (uso BNA) | Fijo | p.6 | C |
| 13 | Filler | 82–96 | 15 | A | Espacios | Fijo | p.6 | C |
| 14 | Casa envío rendición | 97–100 | 4 | A | Espacios (uso BNA) | Fijo | p.6 | C |
| 15 | Filler | 101–200 | 100 | A | Espacios | Fijo | p.6 | C |

#### Registro 2 — Registro individual (p.8–11)

Verificación: el ejemplo de p.11 tiene 85 caracteres + 2 ceros + 13
espacios + 4 ceros + "96 espacios" (9+4+6+15+62) = 200.

| # | Campo | Pos. | L | T | Valor / regla | Origen | Fuente | Estado |
|---|---|---|---|---|---|---|---|---|
| 1 | Tipo de registro | 1–1 | 1 | N | `2` | Fijo | p.8 | C |
| 2 | Entidad a acreditar | 2–5 | 4 | N | "0 + código BCRA de la entidad"; en el ejemplo = `0` + dígitos 1–3 del CBU | Derivado del CBU | p.8, 11 | C · derivación **I** (BNA-6) |
| 3 | Sucursal a acreditar | 6–9 | 4 | N | "0 + código BCRA de la sucursal"; en el ejemplo = dígitos 4–7 del CBU | Derivado del CBU | p.8, 11 | **I** (BNA-6) |
| 4 | Dígito verificador bloque 1 CBU | 10–10 | 1 | N | Último dígito del bloque 1 (dígito 8) | Derivado del CBU | p.8 | C |
| 5 | Bloque 2 CBU cuenta a acreditar | 11–24 | 14 | N | Dígitos 9–22. El texto dice "CBU **de la empresa**"; el ejemplo usa el CBU del beneficiario | Derivado del CBU del empleado | p.8, 11 | **I** (BNA-2) |
| 6 | Importe | 25–34 | 10 | N | Centavos: 8 enteros + 2 decimales | Finnegans `Neto` | p.8, 11 | C |
| 7 | Referencia unívoca | 35–49 | 15 | A | A criterio de la empresa; espacios si no se completa | Envío | p.9 | C |
| 8 | Identificación cliente beneficiario | 50–71 | 22 | A | Libre integración (CUIT/CUIL/CDI, documento, legajo…) | Perfil (qué dato) | p.9 | C · obligatoriedad **I** (BNA-11) |
| 9 | Clase de documento | 72–72 | 1 | N | `1` clave fiscal · `2` otros documentos | Perfil | p.9 | C |
| 10 | Tipo documento beneficiario | 73–74 | 2 | N | p.9: `96` para DNI. p.11: `02` con clave fiscal. p.15: `96` con CUIL. Otros códigos remiten a un documento no disponible | Perfil | p.9, 11, 15 | **B** (BNA-1) |
| 11 | Número de documento beneficiario | 75–85 | 11 | N | CUIL (11 dígitos) o `000` + documento | Finnegans `Cuil` | p.9, 11 | C |
| 12 | Estado | 86–87 | 2 | N | `00` (uso BNA) | Fijo | p.9, 11 | C |
| 13 | Datos de la empresa | 88–100 | 13 | A | Uso interno; espacios si no se usa | Perfil | p.9, 11 | C |
| 14 | Identificador préstamo | 101–104 | 4 | N | `0000` haberes ordinarios · `0003` extraordinarios | Mapeo de liquidación | p.10 | C (códigos) · mapeo **PENDIENTE** (D-026) |
| 15 | Nro. operación link | 105–113 | 9 | A | Espacios (uso BNA) | Fijo | p.10 | C |
| 16 | Sucursal acreditar original | 114–117 | 4 | A | Espacios (uso BNA) | Fijo | p.10 | C |
| 17 | Número de registro link | 118–123 | 6 | A | Espacios (uso BNA) | Fijo | p.10 | C |
| 18 | Observaciones | 124–138 | 15 | A | Espacios (uso BNA) | Fijo | p.10 | C |
| 19 | Filler | 139–200 | 62 | A | Espacios | Fijo | p.10 | C |

#### Registro 3 — Fin de archivo (p.12–14)

Verificación: el ejemplo de p.14 indica "(94 ceros)(83 espacios)" =
posiciones 24–117 y 118–200.

| # | Campo | Pos. | L | T | Valor / regla | Origen | Fuente | Estado |
|---|---|---|---|---|---|---|---|---|
| 1 | Tipo de registro | 1–1 | 1 | N | `3` | Fijo | p.12 | C |
| 2 | Total importe archivo | 2–16 | 15 | N | Suma de importes de los registros 2 (13 + 2) | Derivado | p.12 | C |
| 3 | Total cantidad de registros tipo 2 | 17–23 | 7 | N | Conteo de registros 2 | Derivado | p.12 | C |
| 4 | Importe aceptados | 24–38 | 15 | N | Ceros (uso BNA) | Fijo | p.12 | C |
| 5 | Cantidad aceptados | 39–45 | 7 | A | Ceros (declarado `A`) | Fijo | p.12 | C |
| 6 | Importe rechazados | 46–60 | 15 | N | Ceros | Fijo | p.12 | C |
| 7 | Cantidad rechazados | 61–67 | 7 | A | Ceros (declarado `A`) | Fijo | p.12 | C |
| 8 | Importe comisiones | 68–77 | 10 | N | Ceros | Fijo | p.13 | C |
| 9 | Importe IVA | 78–87 | 10 | N | Ceros | Fijo | p.13 | C |
| 10 | Importe retención IVA | 88–97 | 10 | N | Ceros | Fijo | p.13 | C |
| 11 | Importe percepción IIBB | 98–107 | 10 | N | Ceros | Fijo | p.13 | C |
| 12 | Importe sellado provincial | 108–117 | 10 | N | Ceros | Fijo | p.13 | C |
| 13 | Filler | 118–200 | 83 | A | Espacios | Fijo | p.13 | C |

### 2.3 Límites que se validan

-   Importe por registro 2: máximo 99.999.999,99 (p.8).
-   Total del archivo: máximo 15 dígitos (p.12). Cantidad de registros 2:
    máximo 7 dígitos (p.12).

## 3. Banco Patagonia — Plan Sueldos B.2 (fuente principal, D-025)

### 3.1 Reglas generales del documento

| Regla | Fuente | Estado |
|---|---|---|
| `N`: alineado a derecha, ceros a izquierda | PAT-DR p.1 | C |
| `A`: alineado a izquierda, blancos a derecha | PAT-DR p.2 | C |
| "Todos los campos son obligatorios excepto… NO OBLIGATORIO" (enunciado en A.1, sección de novedades; B no lo repite) | PAT-DR p.2 | I para B.2 |
| Registro de 200 caracteres; archivo `ACREXXXX.TXT` | PAT-DR p.8 | C (nombre: **I**, PAT-10) |
| Fecha de presentación = día en que la empresa envía el archivo; fecha de acreditación = fondos disponibles | PAT-DR p.7 | C |
| Número de envío distinto de `99`; distinto para cada medio con igual fecha de acreditación | PAT-DR p.7–8 | C |
| Altas, bajas y acreditaciones van en archivos separados | PAT-DR p.1 | C |
| Archivos de prueba a BPSUELDO@bancopatagonia.com.ar para validación | PAT-DR p.1 | C |
| Encoding y fin de línea | — | **No especificados** (PAT-14) |

#### Registro 0 — Cabecera general (PAT-DR p.8)

| # | Campo | Pos. | L | T | Valor / regla | Origen | Estado |
|---|---|---|---|---|---|---|---|
| 1 | Tipo de registro | 1–1 | 1 | N | `0` | Fijo | C |
| 2 | Código de banco | 2–4 | 3 | N | `034` | Fijo | C |
| 3 | Espacios | 5–9 | 5 | A | Espacios | Fijo | C |
| 4 | Número de EMPRESA | 10–13 | 4 | N | Otorgado por el banco | Perfil | C (equivalencia con "número de convenio" de PAT-XL: **I**, PAT-6) |
| 5 | Fecha de presentación | 14–21 | 8 | N | AAAAMMDD | Envío | C |
| 6 | Número de envío | 22–23 | 2 | N | Secuencial; no puede ser `99` | Envío | C (PAT-XL "1 a 70": **I**, PAT-5) |
| 7 | Cantidad de lotes | 24–27 | 4 | N | Cantidad de lotes del envío | Derivado | C |
| 8 | Espacios | 28–29 | 2 | A | Espacios | Fijo | C |
| 9 | Importe de lotes | 30–44 | 15 | N | 13 enteros + 2 decimales | Derivado | C |
| 10 | Espacios | 45–54 | 10 | A | Espacios | Fijo | C |
| 11 | Tipo de acreditación | 55–55 | 1 | N | `0` Plan Sueldos (`2` = cuentas de orden de terceros, fuera de alcance) | Fijo | C |
| 12 | Espacios | 56–188 | 133 | A | Espacios | Fijo | C |
| 13 | Versión | 189–196 | 8 | A | "En blanco" | Fijo | C |
| 14 | Número de EMPRESA | 197–200 | 4 | N | Igual al campo 4 | Perfil | C |

#### Registro 1 — Cabecera de lote (PAT-DR p.8–9)

| # | Campo | Pos. | L | T | Valor / regla | Origen | Estado |
|---|---|---|---|---|---|---|---|
| 1 | Tipo de registro | 1–1 | 1 | N | `1` | Fijo | C |
| 2 | Número de lote | 2–5 | 4 | N | No se repite en el envío; distinto de `0000` | Derivado | C |
| 3 | Tipo de movimiento | 6–6 | 1 | N | `2` | Fijo | C |
| 4 | Concepto | 7–16 | 10 | A | Concepto de pago; ejemplo `HAB.05/00` | Envío | C (caracteres admitidos: **I**, PAT-12) |
| 5 | Cantidad del lote | 17–19 | 3 | N | Movimientos de detalle del lote (máx. 999) | Derivado | C |
| 6 | Importe del lote | 20–34 | 15 | N | Suma de los detalles (13 + 2) | Derivado | C |
| 7 | Fecha de acreditación | 35–42 | 8 | N | AAAAMMDD; igual en todos los lotes | Envío | C |
| 8 | Número de envío | 43–44 | 2 | N | Igual al campo 6 del registro 0 | Envío | C |
| 9 | Espacios | 45–188 | 144 | A | Espacios | Fijo | C |
| 10 | Versión | 189–196 | 8 | A | Sin observación (en el registro 0 dice "En blanco") | Fijo | **I** (PAT-15) |
| 11 | Número de EMPRESA | 197–200 | 4 | N | Igual al registro 0 | Perfil | C |

#### Registro 2 — Detalle de acreditación con cuenta confirmada (PAT-DR p.9)

| # | Campo | Pos. | L | T | Valor / regla | Origen | Estado |
|---|---|---|---|---|---|---|---|
| 1 | Tipo de registro | 1–1 | 1 | N | `2` | Fijo | C |
| 2 | Número de lote | 2–5 | 4 | N | Igual a su cabecera de lote | Derivado | C |
| 3 | Tipo de cuenta | 6–6 | 1 | N | `2` caja de ahorros · `1` cuenta corriente | Maestro `PAT_TIPO_CUENTA` | C |
| 4 | Número de cuenta | 7–16 | 10 | N | Confirmado por el banco | Maestro `PAT_NUMERO_CUENTA` | C |
| 5 | Importe neto a acreditar | 17–27 | 11 | N | 9 enteros + 2 decimales | Finnegans `Neto` | C |
| 6 | Número de comprobante | 28–34 | 7 | N | "Se puede informar" el legajo u otro identificador | Finnegans `Legajo` | C (contenido si no se informa: **I**, PAT-16) |
| 7 | Apellido y Nombre | 35–54 | 20 | A | — | Finnegans (D-021) | **I** (PAT-9) |
| 8 | Código de BANCO | 55–57 | 3 | N | Banco donde está radicada la cuenta | Maestro `PAT_CODIGO_BANCO` | C |
| 9 | Código de SUCURSAL | 58–62 | 5 | N | Sucursal de la cuenta | Maestro `PAT_CODIGO_SUCURSAL` | C |
| 10 | Tipo de documento | 63–65 | 3 | N | Anexo I | Maestro `PAT_TIPO_DOCUMENTO` | C |
| 11 | Nro. de documento | 66–82 | 17 | N | — | Maestro `PAT_NUMERO_DOCUMENTO` | C |
| 12 | Provincia del documento | 83–84 | 2 | N | Anexo II; "solo se debe informar" con tipo `004` | Maestro `PAT_PROVINCIA_DOCUMENTO` | C · valor si no aplica **I** (PAT-4) |
| 13 | Código de dependencia | 85–99 | 15 | N | Según tabla de dependencias | Maestro / perfil | **B** (PAT-2) |
| 14 | Espacios | 100–100 | 1 | A | Espacios | Fijo | C |
| 15 | Tipo de liquidación | 101–103 | 3 | N | Obligatorio; Anexo III | Mapeo de liquidación | C (códigos) · mapeo **PENDIENTE** (D-026) |
| 16 | "Espacios" | 104–196 | 93 por posición / **96 declarado** | N | Relleno desconocido | Fijo | **B** (PAT-1) |
| 17 | Número de EMPRESA | 197–200 | 4 | N | Igual al registro 0 | Perfil | C |

Observación del PDF (p.9): "Los campos 11, 12, 13 y 14 deben coincidir
con los que fueran informados en el momento del alta de la cuenta" (ver
PAT-3).

### 3.2 Catálogos

| Anexo | Códigos (PAT-DR) | Diferencias en PAT-XL |
|---|---|---|
| I · Documento (p.9) | `001` DOCUMENTO NACIONAL DE IDENTIDAD · `002` LIBRETA DE ENROLAMIENTO · `003` LIBRETA CIVICA · `004` CEDULA DE IDENTIDAD (SOLO PARA EXTRANJEROS) · `006` DNI EXTRANJEROS | PAT-XL p.5 lista `001` D.N.I./D.U., `002` L.E., `003` L.C., `006` Doc. Extranjero; **omite `004`** (PAT-8) |
| II · Provincia (p.10) | `01` CAPITAL FEDERAL · `02` BUENOS AIRES · `03` CATAMARCA · `04` CORDOBA · `05` CORRIENTES · `06` CHACO · `07` CHUBUT · `08` ENTRE RIOS · `09` FORMOSA · `10` JUJUY · `11` LA PAMPA · `12` LA RIOJA · `13` MENDOZA · `14` MISIONES · `15` NEUQUEN · `16` RIO NEGRO · `17` SALTA · `18` SAN JUAN · `19` SAN LUIS · `20` SANTA CRUZ · `21` SANTA FE · `22` SANTIAGO DEL ESTERO · `23` TUCUMAN · `40` TIERRA DEL FUEGO | — |
| III · Tipo de liquidación (p.10) | `001` SUELDO · `002` S.A.C. · `003` VARIOS · `004` HONORARIOS · `006` HABERES JUBILATORIOS · `007` RENTA VITALICIA · `009` ULTIMA ACREDITACION AUTOMATICA | PAT-XL p.5 agrega `005` Becas y **omite `006` y `007`** (PAT-7) |

### 3.3 Datos de cuenta: origen y no derivabilidad

-   El banco devuelve, en la respuesta del alta (A.2), el código de
    banco (campo 35, 3 posiciones), la sucursal (campo 36, 5
    posiciones), el número de cuenta (campo 20B, 10 posiciones) y la CBU
    (campo 30A) (PAT-DR p.3). Son la fuente de los campos `PAT_*` del
    maestro.
-   La CBU devuelta tiene sucursal de 4 dígitos y bloque 2 = tipo de
    cuenta (2) + número de cliente (9) + subcuenta (2) + DV (PAT-DR
    p.3). No hay regla documentada para obtener la sucursal de 5 dígitos
    ni la cuenta de 10 de B.2: **no se derivan**.
-   PAT-XL p.5: al subir el archivo, e-bank "validará que ese Nro de
    documento pertenezca al convenio". El documento debe ser el del alta;
    **no se deriva del CUIL**.

### 3.4 Validaciones adicionales tomadas de PAT-XL (evidencia complementaria)

| Regla | PAT-XL | Tratamiento |
|---|---|---|
| Importe neto mayor a cero | p.5 | Se aplica (coincide con D-016) |
| Apellido y nombre: sin caracteres especiales (`@`, `"`, `;`, etc.), máx. 20 | p.5 | Compatible con D-021; ver P-13 |
| Fecha de acreditación posterior a hoy | p.5 | Validación de envío (PROPUESTA) |
| Número de envío 1 a 70; número de convenio 1 a 8999 | p.4–5 | **No se aplican en silencio**: PAT-5 / PAT-6 |

## 4. Mapeo de liquidaciones a códigos bancarios — PENDIENTE (D-026)

La muestra de Finnegans contiene las clasificaciones Agrario, Comercio,
Directivos y Liq. Final. **No se infiere** a qué identificador de
préstamo BNA (`0000` / `0003`) ni a qué tipo de liquidación Patagonia
(Anexo III) corresponde cada una: pueden ser clasificaciones internas de
Finnegans sin equivalencia directa. El mapeo se configura explícitamente
en el perfil (`Descripcion` → código BNA / código Patagonia). Una
descripción sin mapeo aprobado bloquea la generación del archivo
correspondiente. Clave de mapeo: P-10.

## 5. Validaciones externas al layout bancario (D-024)

Estos algoritmos **no figuran en los PDF bancarios** y no se les
atribuyen. Son estándares externos; la fuente oficial (ARCA para CUIL,
BCRA para CBU) debe incorporarse a `references/` (P-18). Estado:
`EXTERNA — fuente oficial pendiente`.

**CUIL (ARCA):** 11 dígitos. Pesos `5 4 3 2 7 6 5 4 3 2` sobre los
dígitos 1–10; `r = 11 − (Σ mod 11)`; si `r = 11`, DV = 0; si `r = 10`,
el CUIL es inválido; en otro caso, DV = `r`. Debe coincidir con el
dígito 11.

**CBU (BCRA):** 22 dígitos en dos bloques.

-   Bloque 1 (dígitos 1–8): entidad (3) + sucursal (4) + DV. Pesos
    `7 1 3 9 7 1 3` sobre los dígitos 1–7; DV = `(10 − (Σ mod 10)) mod
    10`.
-   Bloque 2 (dígitos 9–22): 13 dígitos + DV. Pesos `3 9 7 1 3 9 7 1 3 9
    7 1 3` sobre los dígitos 9–21; DV = `(10 − (Σ mod 10)) mod 10`.

La división en bloques (8 + 14) y la posición de los DV sí es trazable a
los PDF: BNA p.5, 7, 8 y 11; PAT-DR p.3.

## 6. Interpretaciones y bloqueos abiertos (no autorizados a resolver)

### 6.1 BNA

| ID | Tema | Detalle | Fuente | Estado | Afecta bytes |
|---|---|---|---|---|---|
| BNA-1 | Tipo de documento | `96` para DNI (p.9) vs clase `1` + tipo `02` + CUIL (p.11) vs clase `1` + tipo `96` + CUIL (p.15). Otros códigos en un documento no disponible | p.9, 11, 15 | **B** | Sí |
| BNA-2 | CBU en registro 2 | El texto dice "2do bloque del CBU de la empresa"; el ejemplo usa el CBU del beneficiario. **Nunca** copiar el CBU de origen al destino | p.8, 11 | **I** | Sí |
| BNA-3 | Ejemplos inconsistentes | p.14: cantidad `0000004` vs leyenda "1". p.15: total del registro 3 (80.545,23) ≠ único registro 2 (66.876,54). Sirven solo para validar posiciones | p.14, 15 | Documentado | No |
| BNA-4 | Posiciones derivadas | Aprobadas (D-023); se conserva la trazabilidad a longitudes y ejemplos | p.4–15 | C | — |
| BNA-5 | Convenio | Relleno a derecha para 4 dígitos (contrario a la regla N general de p.4); sin regla para 5–7 dígitos | p.4, 6, 7, 15 | **I** | Sí |
| BNA-6 | Entidad/sucursal | "0 + código BCRA" vs dígitos del CBU (la sucursal del CBU ya tiene 4 dígitos) | p.5, 8, 11 | **I** | Sí |
| BNA-7 | Fecha de compensación | "Día hábil anterior"; sin calendario de feriados en `references/`; formato AAAAMMDD solo por ejemplo; el ejemplo la rotula "Fecha de pago" | p.5, 7, 14 | **I** | Sí |
| BNA-8 | Caracteres | A–Z y 0–9, sin especiales; sin regla para `Ñ`, acentos ni minúsculas | p.4, 7 | **I** | Sí |
| BNA-9 | Fin de línea | No especificado; implica salto final | p.14 | **I** (requiere homologación) | Sí |
| BNA-10 | Mismo CBU repetido | El documento no lo trata; con D-015 no puede ocurrir por CUIL, pero dos CUIL podrían tener el mismo CBU | — | **I** | No |
| BNA-11 | Campos libres | ¿Pueden ir vacíos "Información criterio empresa" e "Identificación cliente beneficiario"? | p.6, 9 | **I** | Sí |

### 6.2 Patagonia

| ID | Tema | Detalle | Fuente | Estado | Afecta bytes |
|---|---|---|---|---|---|
| PAT-1 | Registro 2, campo 16 | Posiciones 104–196 (93) vs longitud declarada 96; tipo `N` con nombre "Espacios". Las longitudes declaradas suman 203 | PAT-DR p.9 | **B** | Sí |
| PAT-2 | Código de dependencia | `N` en B.2 (p.9) y A.3 (p.4); `A` en A.2 campo 28 (p.3), A.4 campo 18 (p.5) y A.6 campo 2 (p.6). Cambia alineación y relleno; debe coincidir con el alta | PAT-DR p.3–6, 9 | **B** | Sí |
| PAT-3 | Campos que deben coincidir con el alta | "11, 12, 13 y 14", pero el 14 es "Espacios"; probablemente sean del 10 al 13 | PAT-DR p.9 | **I** | No |
| PAT-4 | Provincia si no aplica | Tipo `N`; no se dice si va `00` o espacios cuando el tipo no es `004` | PAT-DR p.9 | **I** | Sí |
| PAT-5 | Número de envío | Distinto de `99` (DR) vs "1 a 70" (XL); ¿se admite `00`? | PAT-DR p.7–8; PAT-XL p.5 | **I** | Sí |
| PAT-6 | Número de empresa | ¿Es el "número de convenio" (1 a 8999) de PAT-XL? | PAT-DR p.8; PAT-XL p.4 | **I** | Sí |
| PAT-7 | Anexo III | `006` y `007` solo en DR; `005` Becas solo en XL | PAT-DR p.10; PAT-XL p.5 | **I** | Sí |
| PAT-8 | Anexo I | XL omite `004` | PAT-DR p.9; PAT-XL p.5 | **I** | Sí |
| PAT-9 | Apellido y nombre | Obligatoriedad (regla general de A.1 vs "opcional" en XL); separador y truncado no definidos. La normalización aprobada (D-021) es la regla de la app; la aceptación del banco sigue pendiente | PAT-DR p.2, 9; PAT-XL p.5 | **I** | Sí |
| PAT-10 | Nombre de archivo | `ACREXXXX.TXT` (DR) vs `BP_AAMMDD_HHMMSS` (XL) | PAT-DR p.8; PAT-XL p.6 | **I** | No |
| PAT-11 | Variante de detalle | El detalle es "con cuenta confirmada": implica que existen otras variantes. El aplicativo XL solo pide documento | PAT-DR p.9; PAT-XL p.5 | **I** (¿convenio contratado?) | Sí |
| PAT-12 | Caracteres en concepto | El ejemplo `HAB.05/00` usa `.` y `/` | PAT-DR p.8 | **I** | Sí |
| PAT-13 | Loteo | Máximo 999 detalles por lote; regla de división no definida | PAT-DR p.8 | **I** | Sí |
| PAT-14 | Encoding y fin de línea | No especificados | — | **I** (requiere homologación) | Sí |
| PAT-15 | Versión del registro 1 | Sin observación de contenido | PAT-DR p.8 | **I** | Sí |
| PAT-16 | Comprobante no informado | Campo `N` de contenido opcional: ¿ceros? | PAT-DR p.9 | **I** | Sí |

## 7. Estado de los generadores

| Generador | Bloqueos (B) | Interpretaciones (I) que afectan bytes | Estado |
|---|---|---|---|
| BNA GT Haberes | BNA-1 | BNA-2, 5, 6, 7, 8, 9, 11 | **No habilitado.** Desarrollo permitido (F4–F5); producción PENDIENTE DE HOMOLOGACION |
| Patagonia B.2 | PAT-1, PAT-2 | PAT-4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16 | **No habilitado.** Desarrollo permitido (F4, F6); producción PENDIENTE DE HOMOLOGACION |

## 8. Homologación (F7)

-   Se generan archivos **100 % sintéticos** con 1, 2 y N empleados;
    se validan localmente posiciones, importes, totales, bytes y orden.
-   Canales de prueba documentados: BNA, casilla SERVICIOSDEPAGO (p.14);
    Patagonia, BPSUELDO@bancopatagonia.com.ar (PAT-DR p.1). Qué datos
    admite cada prueba se acuerda con cada banco.
-   Cada respuesta bancaria se registra en `07` con fecha, fuente y
    prueba asociada, y actualiza los estados de este documento.
-   Solo con aceptación documentada y autorización interna se habilita
    el uso productivo.
