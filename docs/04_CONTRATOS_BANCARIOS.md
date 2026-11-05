# 04 · Contratos bancarios y puntos a confirmar

**Versión:** F0 v1 + consolidación CP-F7-C1 · **Fecha:** 14-10-2026 ·
**Actualizado:** 30-10-2026

> **Alcance de CP-F7-C1.** Este checkpoint incorpora al contrato documental
> las respuestas escritas de Banco Patagonia y el diseño B.2 corregido. Las
> reglas consolidadas y las propuestas de `ContractStatus` están en §3.5.
> **Los estados vigentes del código no cambian en C1**: las columnas “Estado”
> de §3.1–§3.4 y “Vigente” de §6.2 siguen siendo los estados efectivos. La
> aplicación de esas propuestas pertenece a CP-F7-C2.

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
| **PAT-DR2** | `DRPS (1).docx` | 3 imágenes | Diseño B.2 **corregido por el banco** (CP-F7-C0/C1). Corrige tipo/longitud y marca obligatoriedad por color. Sin capa de texto |
| **PAT-RESP** | `Respuestas_Banco_Patagonia.txt` | — | Diez respuestas escritas del banco, en transcripción del texto compartido. Sin fecha, remitente ni acuse verificables |
| **PAT-MODEL** | `Modelo_ACRE2614 (1).txt` | — | Modelo TXT del banco: 606 bytes, 3 registros de 200, ASCII, CRLF y CRLF final. Placeholders `N`/`A`/`n`/`a` |
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
| Texto en mayúsculas (el ejemplo convierte "Pago Haberes mayo" en `PAGO HABERES MAYO`) | p.7 | I (BNA-8); **no autoriza transformación automática** (sin `toUpperCase`, transliteración, remoción de acentos ni conversión de `Ñ`) |
| TXT en formato "ANSI" | p.14 | C |
| "Pulsar ENTER" tras el registro 3: implica salto de línea final; el separador (CRLF/LF) no se especifica | p.14 | I (BNA-9); la spec contractual exige una hipótesis explícita del llamador, sin default |
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

-   Importe por registro 2: 10 dígitos = 8 enteros + 2 decimales; máximo
    `99.999.999,99` (`9.999.999.999` centavos) (p.8).
-   Total del archivo: 15 dígitos = 13 enteros + 2 decimales; máximo
    `999.999.999.999.999` centavos (p.12). Cantidad de registros 2:
    máximo 7 dígitos, `9.999.999` (p.12).
-   El dinero se maneja en `Centavos`/`bigint`; nunca `Number`/float. El
    control `NETO_EXCEDE_LAYOUT` está implementado en CP-F5-B, junto con
    los límites de total y cantidad del archivo.

## 3. Banco Patagonia — Plan Sueldos B.2 (fuente principal, D-025)

### 3.1 Reglas generales del documento

| Regla | Fuente | Estado |
|---|---|---|
| `N`: alineado a derecha, ceros a izquierda | PAT-DR p.1 | C |
| `A`: alineado a izquierda, blancos a derecha | PAT-DR p.2 | C |
| "Todos los campos son obligatorios excepto… NO OBLIGATORIO" (enunciado en A.1, sección de novedades; B no lo repite) | PAT-DR p.2 | I para B.2 (PAT-9) |
| Semántica de colores: verde = el archivo debe contener el dato y coincidir con el banco; amarillo = espacios; blanco = el cliente puede no detallarlo, pero completa con espacios o `0` según el tipo | PAT-RESP respuesta 2; PAT-DR2 | **C** (documental; no aplicado al código) |
| Notación del modelo: `N` obligatorio numérico; `n` opcional numérico (**ceros** si falta); `A` obligatorio alfanumérico; `a` opcional alfanumérico (**espacios** si falta) | PAT-RESP respuesta 2; PAT-MODEL | **C** (documental) |
| Registro de 200 caracteres; archivo `.txt` `ACREXXXX` (`XXXX` = número de convenio); envío web sin encriptar; alternativa `.BPS` generada por Patagonia Sueldo | PAT-DR p.8; PAT-RESP respuesta 7 | C (nombre: PAT-10 con propuesta `C` en C2; PAT-14 sigue I) |
| Fecha de presentación = día en que la empresa envía el archivo; fecha de acreditación = fondos disponibles | PAT-DR p.7 | C |
| Número de envío **01–97**; `99` excluido; recomendado distinto y correlativo; reutilizable si no se repite para dos archivos distintos subidos el mismo día; debe coincidir con el número informado en la web | PAT-RESP respuesta 3; PAT-DR p.7–8 | C (PAT-5 propuesto C en C2) |
| Número de EMPRESA y número de convenio **son el mismo dato**; obligatorio para cualquier formato | PAT-RESP respuesta 4; PAT-DR p.8 | C (equivalencia PAT-6 con propuesta `C` en C2; el valor real sigue en el perfil) |
| El `034` fijo corresponde a R0 campo 2. En R2 campo 8, PAT-DR define “Código del banco donde está radicada la cuenta de acreditación” y **no fija `034`**; el criterio técnico vigente toma el dato de `PAT_CODIGO_BANCO`. La respuesta escrita 10 sostiene que el código sería siempre `034` y agrega, para banco corresponsal, modalidad "fecha diferida" y acreditación ≥24 horas hábiles posteriores a la presentación. Esa respuesta es evidencia de PAT-17, no una regla homologada: PAT-17 sigue `INTERPRETACION_PENDIENTE`, D-086 está congelada y PC-17 (`034` en R2) es una propuesta C2 pendiente de aprobación y homologación | PAT-RESP respuesta 10; PAT-DR p.8–9 | R0 `034`: C; R2 campo 8: **I** (PAT-17; D-086 congelada; PC-17 propuesta `C*` no homologada) |
| Altas, bajas y acreditaciones van en archivos separados | PAT-DR p.1 | C |
| Archivos de prueba a BPSUELDO@bancopatagonia.com.ar para validación | PAT-DR p.1 | C |
| Encoding y fin de línea | PAT-MODEL: ASCII, CRLF y CRLF final | **I** (PAT-14; observación del modelo, no confirmación escrita) |

#### Registro 0 — Cabecera general (PAT-DR p.8)

| # | Campo | Pos. | L | T | Valor / regla | Origen | Estado |
|---|---|---|---|---|---|---|---|
| 1 | Tipo de registro | 1–1 | 1 | N | `0` | Fijo | C |
| 2 | Código de banco | 2–4 | 3 | N | `034` | Fijo | C |
| 3 | Espacios | 5–9 | 5 | A | Espacios | Fijo | C |
| 4 | Número de EMPRESA | 10–13 | 4 | N | Otorgado por el banco; **es el mismo número de convenio** (PAT-6) | Perfil | C · valor real por perfil |
| 5 | Fecha de presentación | 14–21 | 8 | N | AAAAMMDD | Envío | C |
| 6 | Número de envío | 22–23 | 2 | N | **01–97**; no `99`; mismo número informado en la web | Envío | C · PAT-5 propuesto C en C2 |
| 7 | Cantidad de lotes | 24–27 | 4 | N | Cantidad de lotes del envío | Derivado | C |
| 8 | Espacios | 28–29 | 2 | A | Espacios | Fijo | C |
| 9 | Importe de lotes | 30–44 | 15 | N | 13 enteros + 2 decimales | Derivado | C |
| 10 | Espacios | 45–54 | 10 | A | Espacios | Fijo | C |
| 11 | Tipo de acreditación | 55–55 | 1 | N | `0` Plan Sueldos (`2` = cuentas de orden de terceros, fuera de alcance) | Fijo | C |
| 12 | Espacios | 56–188 | 133 | A | Espacios | Fijo | C |
| 13 | Versión | 189–196 | 8 | A | 8 espacios: PAT-DR2 "En blanco"; PAT-MODEL los contiene | Fijo | C (PAT-15 propuesto C* en C2) |
| 14 | Número de EMPRESA | 197–200 | 4 | N | Igual al campo 4 | Perfil | C |

#### Registro 1 — Cabecera de lote (PAT-DR p.8–9)

| # | Campo | Pos. | L | T | Valor / regla | Origen | Estado |
|---|---|---|---|---|---|---|---|
| 1 | Tipo de registro | 1–1 | 1 | N | `1` | Fijo | C |
| 2 | Número de lote | 2–5 | 4 | N | No se repite en el envío; distinto de `0000` (PAT-DR2); el criterio de división es del empleador | Derivado | C · PAT-13: `C*` en C2 · P-20 resuelta por decisión interna 04-11-2026 |
| 3 | Tipo de movimiento | 6–6 | 1 | N | `2` | Fijo | C |
| 4 | Concepto | 7–16 | 10 | A | Concepto de pago; alfabeto qwerty sin Ñ, acentos ni signos; el ejemplo `HAB.05/00` del DR contiene `.` y `/`, contradicción abierta | Envío | C · PAT-12 propuesto C (alfabeto); libre/catálogo **I** |
| 5 | Cantidad del lote | 17–19 | 3 | N | Movimientos de detalle del lote (máx. 999) | Derivado | C |
| 6 | Importe del lote | 20–34 | 15 | N | Suma de los detalles (13 + 2) | Derivado | C |
| 7 | Fecha de acreditación | 35–42 | 8 | N | AAAAMMDD; igual en todos los lotes | Envío | C |
| 8 | Número de envío | 43–44 | 2 | N | Igual al campo 6 del registro 0 | Envío | C |
| 9 | Espacios | 45–188 | 144 | A | Espacios | Fijo | C |
| 10 | Versión | 189–196 | 8 | A | 8 espacios: PAT-DR2 lo marca amarillo y PAT-MODEL los contiene | Fijo | **I** · PAT-15 propuesto C* en C2 |
| 11 | Número de EMPRESA | 197–200 | 4 | N | Igual al registro 0 | Perfil | C |

#### Registro 2 — Detalle de acreditación con cuenta confirmada (PAT-DR p.9)

| # | Campo | Pos. | L | T | Valor / regla | Origen | Estado |
|---|---|---|---|---|---|---|---|
| 1 | Tipo de registro | 1–1 | 1 | N | `2` | Fijo | C |
| 2 | Número de lote | 2–5 | 4 | N | Igual a su cabecera de lote | Derivado | C |
| 3 | Tipo de cuenta | 6–6 | 1 | N | `2` caja de ahorros · `1` cuenta corriente | Maestro `PAT_TIPO_CUENTA` | C |
| 4 | Número de cuenta | 7–16 | 10 | N | Confirmado por el banco | Maestro `PAT_NUMERO_CUENTA` | C |
| 5 | Importe neto a acreditar | 17–27 | 11 | N | 9 enteros + 2 decimales | Finnegans `Neto` | C |
| 6 | Número de comprobante | 28–34 | 7 | N | "Se puede informar" el legajo u otro identificador; si no se informa, **ceros** (`n` minúscula = opcional numérico) | Finnegans `Legajo` | C · PAT-16: `C*` en C2 · decisión interna 04-11-2026 |
| 7 | Apellido y Nombre | 35–54 | 20 | A | Alfabeto qwerty: letras y números, sin Ñ, acentos, comas, puntos, guiones, cedillas, diéresis ni apóstrofes. Obligatoriedad contradictoria: PAT-DR2 verde vs PAT-MODEL `a` minúscula. Composición y truncado: P-14, resuelta internamente el 04-11-2026 | Finnegans (D-021) | **I** · PAT-9: alfabeto C; composición/truncado por decisión interna 04-11-2026; obligatoriedad I |
| 8 | Código de BANCO | 55–57 | 3 | N | Código del banco donde está radicada la cuenta de acreditación (PAT-DR). **No es el `034` constante de R0 campo 2**, que pertenece solo a R0. El valor de R2 se toma de `PAT_CODIGO_BANCO`; la propuesta C2 (PC-17) es `034` siempre, pero PAT-17 sigue `INTERPRETACION_PENDIENTE`. `PAT-RESP` 10 se registra como evidencia de esa propuesta, no como cierre de PAT-17. Banco corresponsal: fecha diferida y acreditación ≥24 h hábiles, requisito aún no modelado | Maestro `PAT_CODIGO_BANCO` | **I** · PAT-17 (D-086 congelada); `034` en R2 solo como propuesta C2, no como regla confirmada |
| 9 | Código de SUCURSAL | 58–62 | 5 | N | Sucursal de la cuenta | Maestro `PAT_CODIGO_SUCURSAL` | C |
| 10 | Tipo de documento | 63–65 | 3 | N | `001` confirmado para el caso general; `004`/extranjero sin confirmar; Anexo I | Maestro `PAT_TIPO_DOCUMENTO` | C · PAT-8 propuesto C(001) + I(004) |
| 11 | Nro. de documento | 66–82 | 17 | N | — | Maestro `PAT_NUMERO_DOCUMENTO` | C |
| 12 | Provincia del documento | 83–84 | 2 | N | Anexo II; "solo se debe informar" con tipo `004`. Si no aplica: **`00`** por regla de colores (blanco + tipo `N`) y modelo | Maestro `PAT_PROVINCIA_DOCUMENTO` | C · PAT-4: `C*` en C2 · decisión interna 04-11-2026 |
| 13 | Código de dependencia | 85–99 | 15 | **A** | **Alfanumérico, 15, alineado a izquierda, espacios a la derecha; debe coincidir con el alta** (PAT-RESP respuesta 2) | Maestro / perfil | **C** · PAT-2 confirmada (PC-02, C2.3) |
| 14 | Espacios | 100–100 | 1 | A | Espacios | Fijo | C |
| 15 | Tipo de liquidación | 101–103 | 3 | N | Obligatorio; Anexo III | Mapeo de liquidación | C (códigos) · mapeo **PENDIENTE** (D-026, P-09/P-10) |
| 16 | "Espacios" | 104–196 | **93** | **A** (PAT-DR2 declara `N`) | **93 espacios** (PAT-RESP respuesta 1; PAT-DR2; PAT-MODEL). Se representa como `A`/`SPACE_RIGHT` porque `N` con espacios no es válido en F4 (la hipótesis `CEROS` sigue bloqueada) | Fijo | **C** · PAT-1 confirmada (PC-01, C2.2) |
| 17 | Número de EMPRESA | 197–200 | 4 | N | Igual al registro 0 | Perfil | C |

Observación del PDF (p.9): "Los campos 11, 12, 13 y 14 deben coincidir
con los que fueran informados en el momento del alta de la cuenta" (ver
PAT-3). **C1:** la nota sigue siendo contradictoria porque el campo 14 es
“Espacios” amarillo; la respuesta escrita confirma la semántica de colores
pero no enumera los campos. No se resuelve por inferencia.

### 3.2 Catálogos

| Anexo | Códigos (PAT-DR) | Diferencias en PAT-XL |
|---|---|---|
| I · Documento (p.9) | `001` DOCUMENTO NACIONAL DE IDENTIDAD · `002` LIBRETA DE ENROLAMIENTO · `003` LIBRETA CIVICA · `004` CEDULA DE IDENTIDAD (SOLO PARA EXTRANJEROS) · `006` DNI EXTRANJEROS | PAT-XL p.5 lista `001` D.N.I./D.U., `002` L.E., `003` L.C., `006` Doc. Extranjero; **omite `004`** (PAT-8) |
| II · Provincia (p.10) | `01` CAPITAL FEDERAL · `02` BUENOS AIRES · `03` CATAMARCA · `04` CORDOBA · `05` CORRIENTES · `06` CHACO · `07` CHUBUT · `08` ENTRE RIOS · `09` FORMOSA · `10` JUJUY · `11` LA PAMPA · `12` LA RIOJA · `13` MENDOZA · `14` MISIONES · `15` NEUQUEN · `16` RIO NEGRO · `17` SALTA · `18` SAN JUAN · `19` SAN LUIS · `20` SANTA CRUZ · `21` SANTA FE · `22` SANTIAGO DEL ESTERO · `23` TUCUMAN · `40` TIERRA DEL FUEGO | — |
| III · Tipo de liquidación (p.10) | `001` SUELDO · `002` S.A.C. · `003` VARIOS · `004` HONORARIOS · `006` HABERES JUBILATORIOS · `007` RENTA VITALICIA · `009` ULTIMA ACREDITACION AUTOMATICA | PAT-XL p.5 agrega `005` Becas y **omite `006` y `007`** (PAT-7) |

**Estado C1 de los catálogos:**

-   **Anexo I:** la respuesta escrita solo confirma `001` (“Informar tipo de
    documento 001”). `004` CÉDULA DE IDENTIDAD (SOLO PARA EXTRANJEROS) sigue
    documentado en PAT-DR pero **no confirmado**; PAT-XL lo omite. Propuesta
    PC-08: admitir `001` y rechazar `004` hasta nueva respuesta.
-   **Anexo II:** no hay respuesta escrita sobre provincias. El `00` cuando no
    aplica es una conclusión de la regla de colores (`N` opcional → ceros) y
    del modelo, no una frase del banco (PAT-4, PC-04). **Decisión interna
    aprobada el 2026-11-04** (CP-F7-C2.4-A2.4): `00` cuando el tipo no exige
    provincia; con tipo `004` se usa exclusivamente el dato válido del maestro
    y un valor inválido bloquea sin sustituirse.
-   **Anexo III:** la respuesta escrita **no** contesta el catálogo de tipo de
    liquidación. En CP-F7-C2.4-A2.7-C1 el proyecto adopta **PAT-DR como
    referencia técnica provisional**, exclusivamente con `001` SUELDO, `002`
    S.A.C., `003` VARIOS, `004` HONORARIOS, `006` HABERES JUBILATORIOS, `007`
    RENTA VITALICIA y `009` ULTIMA ACREDITACION AUTOMATICA. Ninguno fue
    confirmado mediante respuesta escrita específica para R2 campo 15 ni está
    homologado. `005` Becas, presente solo en PAT-XL, queda excluido; se
    conserva la discrepancia porque PAT-XL omite `006`/`007`. La adopción
    provisional no cambia PAT-7 de `I`, no implementa P-09 y no abre producción.

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
-   **C1 — código de banco en R2:** la respuesta escrita 10 sostiene que el
    dato es **siempre `034`**, porque los fondos se acreditan primero en la
    cuenta PS del empleado en Banco Patagonia. Para banco corresponsal indica
    modalidad "con fecha diferida" y acreditación **≥24 horas hábiles**
    posteriores a la presentación. Esa respuesta se registra como evidencia de
    PAT-17 y **no homologa la regla ni cambia el criterio técnico vigente**:
    PAT-DR R2 campo 8 define el “Código del banco donde está radicada la cuenta
    de acreditación” y no fija `034`; el `034` constante corresponde a R0 campo
    2, mientras R2 se toma de `PAT_CODIGO_BANCO`. Esta respuesta **no aplica
    estados ni habilita código** en C1: D-086 sigue **congelada**, no se toca
    `src/reconciliation/**`, no se habilitan cuentas de otras entidades y no
    se modifica D-056. La propuesta PC-17 (`034` en R2) y el requisito de fecha
    diferida siguen pendientes de aprobación y homologación.
-   **C1 — datos que no se derivan:** siguen sin derivarse la sucursal de 5
    dígitos, la cuenta de 10 posiciones, el código de dependencia (se toma del
    alta) ni el número de empresa/convenio (se toma del perfil). El modelo
    `ACRE2614` no se usa como configuración productiva.

### 3.4 Validaciones adicionales tomadas de PAT-XL (evidencia complementaria)

| Regla | PAT-XL | Tratamiento |
|---|---|---|
| Importe neto mayor a cero | p.5 | Se aplica (coincide con D-016) |
| Apellido y nombre: sin caracteres especiales (`@`, `"`, `;`, etc.), máx. 20 | p.5 | Compatible con D-021; ver P-13 |
| Fecha de acreditación posterior a hoy | p.5 | Validación de envío (PROPUESTA) |
| Número de envío 1 a 70; número de convenio 1 a 8999 | p.4–5 | **No se aplican en silencio**: para B.2 la respuesta escrita fija **01–97** (PAT-5) y el número de empresa/convenio no tiene rango productivo fijado (PAT-6). “1 a 70” queda como antecedente del aplicativo, no como regla vigente |

### 3.5 CP-F7-C1 — Consolidación de evidencia y propuesta contractual

Esta sección consolida las respuestas escritas de Banco Patagonia y el diseño
B.2 corregido. **No aplica estados**: las propuestas `PC-*` se ejecutan, si se
aprueban, en CP-F7-C2. Los estados vigentes siguen siendo los de §3.1–§3.4 y
§6.2.

#### 3.5.1 Clases de evidencia

| Clase | Nombre | Qué autoriza | Qué no autoriza |
|---|---|---|---|
| **RC** | Confirmado por respuesta escrita | La frase literal del banco en `PAT-RESP`, citada sin ampliar su alcance | Completar lo que la respuesta no dice; atribuir al banco una inferencia propia |
| **DC** | Respaldado por diseño corregido | Lo que `PAT-DR2` muestra con tipo, longitud, color o leyenda, leído junto con la semántica de colores confirmada | Convertir una marca de color en una frase del banco; resolver contradicciones entre campo y leyenda. La evidencia del diseño **original** `PAT-DR` se cita como `DR` y no se cuenta como `DC` |
| **TM** | Observado únicamente en el TXT modelo | Un byte, relleno o valor presente en `PAT-MODEL` (incluye `2614`, `034`, `00`, CRLF y CRLF final) | Afirmar que el banco exige ese valor para toda empresa; usarlo como golden o como aceptación |
| **DE** | Pendiente de decisión empresarial | Nada por sí sola: identifica una decisión que el banco delegó o que depende de la configuración real | Suplirla con un default, con el valor del modelo o con una preferencia técnica |
| **PH** | Pendiente de homologación | Nada por sí sola: recuerda que la aceptación integral solo se acredita con un archivo aceptado y evidencia registrada | Considerar que un `C` contractual o un test local equivale a homologación |

Reglas de precedencia:

1. `RC` prevalece para el alcance literal de la frase.
2. `DC` y `TM` se citan como evidencia documental separada, nunca como
   respuesta escrita.
3. `DE` y `PH` no son evidencias: son dimensiones abiertas que pueden
   convivir con un `C` contractual.
4. Una contradicción no se resuelve por mayoría de fuentes ni por el valor
   del modelo. Se enumera en §3.5.4 y requiere decisión humana.
5. `DR` no es una clase de evidencia: califica una cita del diseño **original**
   `PAT-DR`, usada para documentar un antecedente o una contradicción. No se
   cuenta como `DC`.

#### 3.5.2 Matriz final PAT-1…PAT-17

| ID | Tema | Clasificación C1 | Evidencia exacta | Propuesta C2 | Límite que permanece |
|---|---|---|---|---|---|
| **PAT-1** | R2 campo 16, posiciones 104–196 | **RC** (longitud) + **DC/TM** (relleno) + **PH** | RC: “campo 16: tiene razón, son 93 caracteres de longitud (confirmado con txt de prueba)”. DC: `N`, 104–196, longitud 93, “Espacios”, amarillo. TM: 93 espacios y `2614` en 197–200 | **`C` aplicada en C2.2 (PC-01)**: longitud **93** y contenido de **93 espacios**, representado como `A`/`SPACE_RIGHT`; `CEROS` queda como hipótesis histórica `BLOQUEADA` | El DRPS declara `N` para un campo que el modelo llena con espacios; la representación `A` se aprobó explícitamente en PC-01. `N` con espacios no es representable en F4 |
| **PAT-2** | R2 campo 13, código de dependencia | **RC** + **DC** + **PH** (valor real: **DE**) | RC: “El campo es Alfanumérico; inicio 85; fin 99; longitud 15; debe coincidir con el dato registrado en el banco al momento del alta de la cuenta; por ser alfanumérico se alinea a la izquierda y se completa con espacios en blanco a la derecha”. DC: `A`, 85–99, 15. TM: `AAAAAAAAAAAAAAA` | **`C`**: tipo `A`, longitud 15, alineación izquierda, espacios a la derecha, origen = alta bancaria | El valor por empleado depende de P-04 y de las altas A.2; no se deriva del CUIL ni se inventa un default |
| **PAT-3** | Campos que deben coincidir con el alta | **RC** (semántica de colores) + **DR** (contradicción) + **PH** | RC: “en verde los datos que el archivo debe contener si o si y coincidir con lo registrado en el banco, en amarillo todo lo que son espacios en blanco…”. DR: nota “Los campos 11, 12, 13 y 14 deben coincidir…”, pero el campo 14 es “Espacios” amarillo | **`I`** (sin cambio): semántica de colores `C`; enumeración de campos que deben coincidir, abierta | No se enumeran los campos; el texto incluye un campo de espacios que no puede “coincidir”. No se corrige por inferencia |
| **PAT-4** | R2 campo 12, provincia si no aplica | **RC** (regla general) + **DC** + **TM** (`00`) + **PH** | RC: “en blanco los datos que el cliente puede no detallar en el archivo, pero cuyo campo debe completar con espacios o 0 según corresponda al tipo de campo”. DC: campo 12 `N`, 83–84, blanco/opcional. TM: `00` | **`C*`**: `00` cuando no corresponda provincia, por regla de colores + tipo numérico | **Decisión interna aprobada el 2026-11-04** (CP-F7-C2.4-A2.4): `00` cuando el tipo no exige provincia; con tipo `004` se usa solo el dato válido del maestro y un valor inválido bloquea. El contrato sigue `C*` y pendiente de homologación bancaria |
| **PAT-5** | Número de envío | **RC** + **DC** + **PH** | RC: “El número de envío debe ser un número entre 1 y 97… puede reutilizar los números de envío siempre que no utilice el mismo número para dos archivos distintos… el mismo día… debe coincidir con el número de envío informado en la web”. DC: R0 campo 6 distinto de `99`; R1 campo 8 igual | **`C`**: rango **01–97**, `00` y `99` fuera; el número del archivo debe coincidir con el informado en la web | La respuesta no repite “R0 y R1 iguales”, pero habla de un único número del archivo y el modelo lo usa en ambos. La referencia previa “1 a 70” queda como antecedente, no como regla vigente |
| **PAT-6** | Número de EMPRESA y convenio | **RC** + **DC** + **TM** (valor `2614`) + **DE** (convenio real) + **PH** | RC: “Número de Empresa y convenio son lo mismo, el dato es obligatorio para cualquiera de los formatos de envío…”. DC: R0 campos 4/14, R1 campo 11 y R2 campo 17 llevan el mismo valor | **`C`** (equivalencia) + **dato del perfil** (valor real): un único identificador, obligatorio, tomado del perfil | `2614` es el valor del modelo; `2416` aparece en el texto de la consulta. **Ninguno se fija como valor productivo**: falta la configuración real de la empresa |
| **PAT-7** | Anexo III, tipo de liquidación | **RC** (no responde) + **DR** + **PH** | RC: “Informar tipo de documento 001” se refiere al campo 10, no al campo 15. DR: R2 campo 15 remite al Anexo III; `006`/`007` solo en DR, `005` Becas solo en XL | **`I`** (sin cambio contractual). C1 adopta PAT-DR solo como catálogo técnico provisional: `001/002/003/004/006/007/009`; excluye `005` | Ningún código está confirmado específicamente para este campo ni homologado. P-09 no está implementada; P-10 tiene selección explícita B1/B2, sin extracción automática. La adopción provisional no abre producción |
| **PAT-8** | Anexo I, tipo de documento | **RC** (`001`) + **DR** (catálogo) + **PH** | RC: “Informar tipo de documento 001”. DR: Anexo I incluye `004` CÉDULA DE IDENTIDAD (SOLO PARA EXTRANJEROS); PAT-XL lo omite | **`C` limitado a `001`** + **`I` residual para `004`/extranjero** | La respuesta solo confirma `001`. `004` no se habilita hasta confirmación; el generador debe rechazarlo, no adivinarlo |
| **PAT-9** | Apellido y Nombre, campo 7 | **RC** (alfabeto) + **DC/TM** (contradicción) + **DE** (P-14) + **PH** | RC: “el sistema solo admite datos con letras y números del teclado qwerty en inglés, ningún carácter especia [sic], es decir, sin Ñ, sin acentos, ni comas, puntos, guiones, cejillas, diéresis, apostrofes, etc.”. DC: campo verde/obligatorio. TM: `aaaaaaaaaaaaaaaaaaaa` (minúscula = opcional) | **`C`** solo para el alfabeto; **`I`** para obligatoriedad; **decisión interna** para composición, orden, separador y truncado (P-14) | DRPS verde vs modelo `a`: contradicción de obligatoriedad no resuelta. **Decisión interna aprobada el 2026-11-04** (CP-F7-C2.4-A2.6): `APELLIDO NOMBRE`, un espacio, extremos recortados, espacios internos colapsados, mayúsculas sin tildes/diéresis, `Ñ`→`N`, sin truncamiento y rechazo de vacío, caracteres no admitidos o más de 20. El contrato sigue pendiente de homologación bancaria |
| **PAT-10** | Nombre del archivo | **RC** + **DR** + **PH** | RC: “debe ser un archivo .txt, el nombre del archivo deb ser ACREXXXX, (donde XXXX, debe ser reemplazado por el número de convenio de la empresa)… admite el envío al banco a través de la web sin requerir encriptamiento”. DR: R0/R1 “archivo ACREXXXX.TXT” | **`C`**: `.txt`, nombre `ACREXXXX`, `XXXX` = número de convenio | No responde encoding, CRLF/LF ni salto final. La convención `BP_AAMMDD_HHMMSS` queda como antecedente, no como nombre vigente para archivo por diseño |
| **PAT-11** | Variante de detalle / modalidad | **RC** + **DR** + **TM** + **PH** | RC: “El convenio de la empresa no tiene restricciones en cuanto a la modalidad para acreditar los sueldos, podrá hacerlo por archivo (ya sea generado por diseño de registro o por el aplicativo)…”. DR: B.2 “detalle de acreditación con cuenta confirmada”. TM: el modelo sigue el layout B.2 | **`C*`**: B.2 es admisible para el convenio; cierra P-03 con aprobación humana | No identifica el número de convenio ni prueba que el alta esté hecha. No autoriza por sí solo a generar ni enviar |
| **PAT-12** | Caracteres del concepto, campo 4 | **RC** (alfabeto) + **DC** (campo) + **DR** (contradicción) + **PH** | RC: mismo alfabeto qwerty, “sin Ñ, sin acentos, ni comas, puntos, guiones, cejillas, diéresis, apostrofes, etc.”. DC: campo `A`, 7–16. DR: ejemplo `HAB.05/00`, que contiene `.` y `/` | **`C`** solo para el alfabeto; **`I`** para texto libre vs catálogo | El ejemplo del DR contradice el alfabeto confirmado. No se decide el catálogo por el ejemplo ni por el modelo |
| **PAT-13** | Lotes y consistencia de cantidades | **RC** (conteos) + **DC** + **TM** + **PH** | RC: “La separación por lotes es a criterio del empleador… la cantidad de registros de lote… debe coincidir con el dato ‘cantidad de lotes’… (campo 7)… la cantidad de registros de acreditación que contenga cada lote debe coincidir con el dato ‘cantidad del lote’… (campo 5)”. DC: lote único, distinto de `0000`; campo 5 de 3 dígitos. TM: un lote `0001` | **`C*`** para estructura y consistencia de conteos; **decisión interna** para la estrategia de lotes (P-20) | La numeración única y distinta de `0000` surge del DRPS, no de la respuesta. El máximo 999 es geométrico. La estrategia (P-20) fue aprobada internamente el 2026-11-04: lotes consecutivos de hasta 999 pagos, en orden, desde `0001`; el contrato sigue pendiente de homologación bancaria |
| **PAT-14** | Encoding y fin de línea | **TM únicamente** + **PH** | La consulta 7 preguntó encoding, CRLF/LF y salto final; la respuesta **no los menciona**. TM: ASCII, CRLF entre registros, CRLF final, 606 bytes = 3×200 + 3×2 | **`C` contingente** (sin cambio): solo se cerraría si el banco indica que debe verificarse por ingesta | No se puede presentar como respuesta del banco ni como regla confirmada. Requiere homologación |
| **PAT-15** | Versión en R0 y R1 | **RC** (remisión) + **DC/TM** (espacios) + **PH** | RC: “Sobre los datos versión y comprobante puede ver DRPS y modelo txt”. DC: R0 “En blanco”; R1 amarillo/espacios. TM: 8 espacios en 189–196 en ambos registros | **`C*`**: 8 espacios | La respuesta escrita no dice “espacios”; se apoya en DRPS + modelo. **Decisión interna aprobada el 2026-11-04** (CP-F7-C2.4-A2.2): 8 espacios en R0/R1. El contrato sigue `C*` y pendiente de homologación bancaria |
| **PAT-16** | Comprobante no informado | **RC** (notación) + **DC/TM** + **PH** | RC: “‘n’ minúscula datos numérico opcional (en caso de no ingresar este dato, se debe completar el campo con ceros)”. DC: campo `N` de 7, “se puede informar” legajo u otro dato. TM: `nnnnnnn` | **`C*`**: ceros cuando no se informa | **Decisión interna aprobada el 2026-11-04** (CP-F7-C2.4-A2.3): `0000000` solo con legajo ausente; un legajo presente inválido bloquea y nunca se reemplaza por ceros ni se trunca. El contrato sigue `C*` y pendiente de homologación bancaria |
| **PAT-17** | R2 campo 8, código de banco | **RC** + **DC** + **TM** + **DE** (alcance corresponsal) + **PH** | RC: “el dato de código de banco siempre es el mismo ‘034’ y estas acreditaciones no pueden realizarse el mismo día de presentación del archivo, deben ejecutarse bajo la modalidad ‘con fecha diferida’ y registrar una fecha de acreditación de, al menos, 24 hs hábiles posteriores…”. DC: R2 campo 8 = código del banco donde está radicada la cuenta; PAT-DR **no fija `034`**. TM: `034` | **`C*` (propuesta, no homologada)**: `034` siempre en R2; requisito nuevo de fecha diferida y ≥24 horas hábiles para banco corresponsal. No aplicada al criterio técnico vigente: R2 usa `PAT_CODIGO_BANCO` y R0 conserva `034` | PAT-17 sigue `I`; D-086 sigue congelada: no se toca `src/reconciliation/**`, no se habilitan otras entidades ni se cambia D-056. La modalidad diferida no está modelada; su alcance es decisión empresarial. Homologación bancaria pendiente |

**Resumen por clase (una misma PAT puede pertenecer a más de una):**

| Clase | PAT |
|---|---|
| Confirmado por respuesta escrita (**RC**) | PAT-1 (longitud), PAT-2, PAT-3 (colores), PAT-4 (regla general), PAT-5, PAT-6 (equivalencia), PAT-7 (negativa), PAT-8 (`001`), PAT-9 (alfabeto), PAT-10, PAT-11, PAT-12 (alfabeto), PAT-13 (conteos), PAT-15 (remisión), PAT-16 (notación), PAT-17 (respuesta 10: `034` y fecha diferida; interpretación `I`, no homologada) |
| Respaldado por diseño corregido (**DC**) | PAT-1, PAT-2, PAT-4, PAT-5, PAT-6, PAT-9, PAT-12 (campo), PAT-13, PAT-15, PAT-16, PAT-17 |
| Diseño original (**DR**, no es una de las cinco clases; se cita para contradicciones) | PAT-3, PAT-7, PAT-8, PAT-10, PAT-11, PAT-12 (ejemplo) |
| Observado únicamente en el TXT modelo (**TM**) | PAT-1 (espacios), PAT-4 (`00`), PAT-6 (`2614`), PAT-9 (`a`), PAT-12 (relleno), PAT-13 (forma), PAT-14 (ASCII/CRLF/CRLF final), PAT-15 (8 espacios), PAT-16 (`n`), PAT-17 (`034`) |
| Pendiente de decisión empresarial (**DE**) | PAT-2 (valor por empleado, P-04), PAT-6 (convenio real), PAT-17 (alcance corresponsal); P-14/PAT-9 quedó resuelta internamente el 04-11-2026 y solo espera homologación |
| Pendiente de homologación (**PH**) | PAT-1…PAT-17, sin excepción |

**Lectura obligatoria de la matriz.** `C` significa “regla contractual
suficientemente fundada”, no “archivo aceptado”. Todo el contrato Patagonia
sigue **PH**: ningún elemento de esta matriz acredita que el banco acepte un
archivo generado.

#### 3.5.3 Propuestas de cambio de `ContractStatus` (`PC-*`)

`C*` no es un `ContractStatus`: significa “propuesta de `C` que requiere
aprobación humana explícita por apoyarse en diseño/modelo y no solo en una
frase del banco”. **En CP-F7-C1 no se aplicó ninguna propuesta; PC-01 se aplica
en CP-F7-C2.2 (§3.5.3.1), PC-02 en CP-F7-C2.3 (§3.5.3.2) y PC-08 tiene
implementación parcial en CP-F7-C2.1.**

| PC | PAT | Estado vigente | Propuesta C2 | Evidencia exacta | Efecto previsto en código | Condición |
|---|---|---|---|---|---|---|
| **PC-01** | PAT-1 | **B** | **`C*` → `C` aplicada en C2.2** | RC: 93 caracteres. DC/TM: 93 espacios | `spec.ts`: campo 16 `A`, 15→93, `SPACE_RIGHT` y `CONFIRMADA` solo para `ESPACIOS`; `contrato.ts`: PAT-1 `B`→`C`; `CEROS` sigue `BLOQUEADA`; tests de contrato, posiciones, bytes, longitud y golden | Aprobación humana de la representación `A`/`SPACE_RIGHT` — otorgada por CP-F7-C2.2 |
| **PC-02** | PAT-2 | **B** | **`C` aplicada en C2.3** | RC: “Alfanumérico… longitud 15… izquierda… espacios a la derecha… debe coincidir con el alta” | `spec.ts`: tipo `A`, 15, `SPACE_RIGHT` y `CONFIRMADA` solo para `ALFANUMERICA`; `contrato.ts`: PAT-2 `B`→`C`; `validacion.ts`: solo `A-Z`/`a-z`/`0-9`, sin signos ni acentos, sin transformar; `NUMERICA` sigue `BLOQUEADA`; fachada rechaza `NUMERICA` con `HIPOTESIS_PAT2_NO_CONFIRMADA`; tests de contrato, geometría, relleno, alfabeto, rechazo y golden nuevo | El valor real sigue viniendo del perfil/alta; no hay default |
| **PC-03** | PAT-3 | **I** | **`I`** (sin cambio) | RC: semántica de colores. DR: nota “11, 12, 13 y 14” con campo 14 de espacios | Solo documentación | Enumeración de campos que deben coincidir sigue abierta |
| **PC-04** | PAT-4 | **I** | **`C*`** | RC: “completar con espacios o 0 según… el tipo”. TM: `00` | `mapeo.ts`/`politica.ts`/`validacion.ts`: `00` cuando no aplica provincia; tipo `004` conserva el dato válido y bloquea el inválido; tests `pat4` | **Decisión interna aprobada el 2026-11-04** (A2.4); no es confirmación bancaria. Homologación pendiente |
| **PC-05** | PAT-5 | **I** | **`C`** | RC: “entre 1 y 97”; `00`/`99` fuera; coincidencia con la web | `validacion.ts`: rango 01–97; tests de `00`, `99`, `01`, `97` | R0 y R1 comparten el número; el modelo lo confirma |
| **PC-06** | PAT-6 | **I** | **`C`** (equivalencia) + **dato del perfil** | RC: “Número de Empresa y convenio son lo mismo… obligatorio” | `contrato.ts`/`spec.ts`: nota de equivalencia; test de consistencia R0/R1/R2 | `2416` y `2614` **no** se fijan; el valor sale del perfil |
| **PC-07** | PAT-7 | **I** | **`I`** (sin cambio) | RC: solo “tipo de documento 001”, no Anexo III | `validacion.ts`/`mapeo.ts`: sin cambio | P-09/P-10 abiertos; no se usa el modelo como catálogo |
| **PC-08** | PAT-8 | **I** | **Implementación parcial en C2.1**: **`C` limitado a `001`** + **`I` residual `004`** | RC: “Informar tipo de documento 001”. DR: Anexo I incluye `004` | `validacion.ts` y fachada (C2.1): admite `001`; `002`, `003`, `004` y `006` devuelven `TIPO_DOCUMENTO_NO_CONFIRMADO`; fuera de catálogo, `TIPO_DOCUMENTO_INVALIDO`; tests | PAT-8 sigue parcialmente pendiente: `004`, extranjeros y demás tipos no confirmados no se habilitan sin respuesta |
| **PC-09** | PAT-9 | **I** | **`I`** (parcial: alfabeto `C` + decisión interna P-14) | RC: alfabeto qwerty sin Ñ/acentos/signos. DC verde vs TM `a` | `nombre.ts`/`politica.ts`/`validacion.ts`: alfabeto y decisión `DECISION_NOMBRE_PATAGONIA_PRODUCTIVA`; tests `pat9` | **Decisión interna aprobada el 2026-11-04** (A2.6): `APELLIDO NOMBRE` sin truncar; la obligatoriedad sigue pendiente y el contrato no está homologado |
| **PC-10** | PAT-10 | **I** | **`C`** | RC: `.txt`, `ACREXXXX`, `XXXX` = convenio, envío sin encriptar | Sin cambio de bytes; nombre materializado en CP-F7-D2; tests de nombre | No se fija `2614`; el nombre usa el convenio del perfil |
| **PC-11** | PAT-11 | **I** | **`C*`** | RC: “no tiene restricciones en cuanto a la modalidad… por archivo… por diseño de registro…” | `aptitud.ts`/`politica.ts`: B.2 admisible; cierra P-03 con aprobación; sin cambio de bytes | Aprobación humana; no autoriza generar ni enviar |
| **PC-12** | PAT-12 | **I** | **`I`** (parcial: alfabeto `C`) | RC: alfabeto sin signos. DR: ejemplo `HAB.05/00` | `validacion.ts`: alfabeto; sin cambio de catálogo | Texto libre vs catálogo sigue abierto |
| **PC-13** | PAT-13 | **I** | **`C*`** (conteos) + decisión interna (estrategia) | RC: estructura R0 + ≥1 R1 + R2; conteos R0/R1 y R1/R2 deben coincidir. DC: lote único, ≠ `0000` | `loteo.ts`/`politica.ts`: `estrategiaLotesPatagonia()` y validación de conteos; A0 garantiza refs únicas en la fachada; tests `p20` | **Decisión interna aprobada el 2026-11-04** (A2.5): lotes de hasta 999 pagos desde `0001`; no es confirmación bancaria. Homologación pendiente |
| **PC-14** | PAT-14 | **`C` contingente** | **`C` contingente** (sin cambio) | TM: ASCII, CRLF, CRLF final; la respuesta escrita no lo menciona | Sin cambio; serialización explícita ya existente | Solo homologación o indicación expresa del banco |
| **PC-15** | PAT-15 | **I** | **`C*`** | RC: “ver DRPS y modelo txt”. DC/TM: 8 espacios | `spec.ts`/`politica.ts`: 8 espacios en 189–196; tests | **Decisión interna aprobada el 2026-11-04** (A2.2); no es confirmación bancaria. Homologación pendiente |
| **PC-16** | PAT-16 | **I** | **`C*`** | RC: `n` opcional → ceros. TM: `nnnnnnn` | `mapeo.ts`/`politica.ts`/`validacion.ts`: `0000000` solo con legajo `null`; legajo presente inválido bloquea; tests `pat16` | **Decisión interna aprobada el 2026-11-04** (A2.3); no es confirmación bancaria. Homologación pendiente |
| **PC-17** | PAT-17 | **I** | **`C*` propuesto (no aplicado)**: `034` en R2 + requisito nuevo | RC: “siempre… 034”; fecha diferida y ≥24 hs hábiles para corresponsal | Propuesta para `mapeo.ts`/`validacion.ts`: `034` en R2; el criterio vigente usa `PAT_CODIGO_BANCO` y R0 conserva `034`; **no** tocar conciliación | PAT-17 sigue `I`; D-086 congelada; alcance corresponsal es decisión empresarial; homologación pendiente; no se toca `src/reconciliation/**` |

**Reglas de aplicación para C2:**

1. Ninguna `PC-*` se aplica sin aprobación humana explícita. PC-01 quedó
   aprobada y aplicada en CP-F7-C2.2 y PC-02 en CP-F7-C2.3; las demás siguen
   pendientes.
2. Las propuestas `C*` requieren aprobación individual; no se convierten en `C`
   por lote.
3. Un cambio de estado no habilita producción: la compuerta de §3.5.6 ya está
   implementada (C2.0) y es independiente. Desde C2.3 no quedan `B` en el
   contrato Patagonia, pero la fachada sigue devolviendo
   `HOMOLOGACION_PATAGONIA_PENDIENTE` sin bytes.
4. Los estados vigentes de §3.1–§3.4 y §6.2 reflejan PC-01 y PC-02 aplicadas;
   el resto no se modifica en C1.
5. No se alteran los goldens anteriores ni se eliminan protecciones existentes.
   PC-02 agrega un golden sintético nuevo y conserva intacto el anterior.

#### 3.5.3.1 PC-01 aplicada (CP-F7-C2.2)

**Evidencia.** La respuesta escrita de Banco Patagonia confirma que el campo 16
del Registro 2 tiene **93 caracteres** de longitud. El diseño corregido lo
denomina “Espacios” (104–196) y el modelo `ACRE2614` conserva **93 espacios**
en 104–196 y `2614` en 197–200, con cada registro de exactamente **200 bytes**.

**Decisión aplicada.** PAT-1 pasa a `CONFIRMADA` **solo** para la hipótesis
`ESPACIOS`, con tipo `A` y relleno `SPACE_RIGHT` porque `N` con espacios no es
representable en F4. La hipótesis histórica `CEROS` queda `BLOQUEADA` y no se
presenta como decisión bancaria. La longitud documental de 96 se conserva como
metadata y no se usa como geometría.

**Alcance.** No se habilita producción: en ese checkpoint PAT-2 seguía
`BLOQUEADA`, la compuerta
de autorización de §3.5.6 sigue cerrada y el golden técnico conserva sus bytes
y su SHA-256 (`36f55f2a0aee04e944c5347ecde62f6c8722418f8b0bca86ebf1a408848a7ade`).
PC-01 se registra como aplicada en el código; P-03/PAT-11 y la homologación
bancaria siguen abiertas.

#### 3.5.3.2 PC-02 aplicada (CP-F7-C2.3)

**Evidencia.** La respuesta escrita de Banco Patagonia confirma que el código de
dependencia del Registro 2 es **alfanumérico**, ocupa las posiciones **85–99**
(**15** caracteres), **se alinea a la izquierda**, **se completa con espacios en
blanco a la derecha** y **debe coincidir con el dato registrado en el banco al
momento del alta de la cuenta**. El diseño corregido `PAT-DR2` muestra `A`, 85–99
y longitud 15; el modelo `ACRE2614` usa `AAAAAAAAAAAAAAA` en 85–99 y cada
Registro 2 mide exactamente **200 bytes**.

**Decisión aplicada.** PAT-2 pasa a `CONFIRMADA` **solo** para la hipótesis
`ALFANUMERICA`, con tipo `A`, longitud 15 y relleno `SPACE_RIGHT`
(`PAT2_POSICION_INICIO = 85`, `PAT2_POSICION_FIN = 99`, `PAT2_LONGITUD = 15`).
La hipótesis histórica `NUMERICA` (`N`/`ZERO_LEFT`) se conserva como
`BLOQUEADA` y no se presenta como decisión bancaria.

**Fachada.** `generarPatagonia` acepta exclusivamente `ALFANUMERICA`. Si recibe
`NUMERICA` devuelve `HIPOTESIS_PAT2_NO_CONFIRMADA` de forma explícita, antes de
mapear o serializar, y no produce bytes. El valor de dependencia se toma del
maestro (`PAT_CODIGO_DEPENDENCIA`) sin default; no se deriva del CUIL ni se
inventa un código.

**Alfabeto.** La respuesta de PAT-2 dice “Alfanumérico”, pero no enumera el
alfabeto. Para el flujo confirmado se aceptan **letras ASCII `A-Z`/`a-z` y
dígitos `0-9`**, sin signos, guiones, guiones bajos, espacios internos, `Ñ` ni
letras acentuadas. La restricción se apoya en la conjunción de “alfanumérico”
con el alfabeto qwerty inglés que el banco declara para los campos de texto
(PAT-9/PAT-12: “solo letras y números… sin Ñ, sin acentos, ni comas, puntos,
guiones…”), no en una enumeración específica de PAT-2. El valor **no se
transforma**: se conserva la caja original y no se recortan espacios
significativos. Un valor fuera del alfabeto devuelve `DEPENDENCIA_INVALIDA` y no
genera bytes. El relleno `SPACE_RIGHT` hasta 15 posiciones lo aplica el
serializador, no la validación.

**Incertidumbre residual.** No hay evidencia de que el código realmente
registrado en el alta pueda contener signos, `Ñ`, acentos o minúsculas
distintas de las del alta. Si el banco confirma un alfabeto más amplio o
exige mayúsculas, la regla deberá revisarse en un checkpoint posterior; no se
introduce conversión automática mientras tanto. El maestro conserva su
validación de longitud (no se modifica el editor en C2.3); el rechazo estricto
ocurre en el mapeo/generación Patagonia.

**Alcance.** No se habilita producción: `produccionPatagoniaHabilitada()` sigue
devolviendo `false`, la compuerta de autorización de §3.5.6 sigue cerrada y la
fachada con datos válidos devuelve `HOMOLOGACION_PATAGONIA_PENDIENTE`.
PAT-8 conserva su alcance limitado a `001`; PAT-7 sigue abierto contractualmente y P-09
sigue sin implementar. P-10 tiene desde B1/B2 una resolución funcional por selección
explícita, sin extracción automática ni código bancario. El punto compuesto
`PAT-7/P-09/P-10` permanece sin resolución en la política productiva. La composición del
nombre P-14/PAT-9 quedó resuelta por decisión interna del
2026-11-04 (CP-F7-C2.4-A2.6), pendiente de homologación bancaria. La estrategia de lotes P-20
quedó resuelta por decisión interna del
2026-11-04 (CP-F7-C2.4-A2.5). El golden técnico anterior conserva su contenido y SHA-256
(`36f55f2a0aee04e944c5347ecde62f6c8722418f8b0bca86ebf1a408848a7ade`); se agrega
un golden sintético nuevo, etiquetado **NO HOMOLOGADO**, con SHA-256
`e55158df1ba4cf74603729e319efcb3af63a5d355aeaf058ccdac41a0d3e78cb` y 1004 bytes.
La homologación bancaria sigue abierta.

#### 3.5.4 Contradicciones pendientes (no resueltas en C1)

| # | Contradicción | Fuentes | Tratamiento C1 | Decisión requerida |
|---|---|---|---|---|
| 1 | Convenio **2416** frente a **2614** | Texto de la consulta 2 (“modelo txt para convenio 2416”); nombre y contenido del modelo (`ACRE2614`) | Se registran ambos como referencias documentales; **ninguno** se fija como valor productivo | Configuración real de la empresa |
| 2 | R2 campo 16: tipo `N` con contenido de espacios | DRPS (`N`, “Espacios”); modelo (93 espacios); RC solo confirma 93 | Se aplica `A`/`SPACE_RIGHT` en CP-F7-C2.2 (PC-01); `CEROS` queda `BLOQUEADA` | Aprobada la representación `A`/`SPACE_RIGHT` en PC-01 |
| 3 | “Los campos 11, 12, 13 y 14 deben coincidir con el alta” | DR, nota al pie; campo 14 es “Espacios” amarillo | Se conserva como contradicción; la semántica de colores no permite que un campo de espacios “coincida” | Confirmación del banco o decisión documentada |
| 4 | Apellido y Nombre obligatorio frente a opcional | DRPS: verde; modelo: `a` minúscula | Se registra; PAT-9 sigue parcial en obligatoriedad | Banco o decisión documentada; P-14 quedó resuelta internamente el 04-11-2026 (A2.6) y solo espera homologación |
| 5 | Concepto: ejemplo con `.` y `/` frente a alfabeto sin signos | DR: `HAB.05/00`; RC: sin puntos ni comas | Se registra; PAT-12 conserva el catálogo abierto | Confirmación del banco |
| 6 | Número de envío **1–97** frente a **1–70** | RC; documentación previa del aplicativo | La RC prevalece para B.2; “1–70” queda como antecedente | Ninguna para B.2; no se borra la referencia |
| 7 | Nombre `ACREXXXX.TXT` frente a `BP_AAMMDD_HHMMSS` | RC y DR; convención previa | La RC prevalece para archivo por diseño; la otra queda como antecedente | Ninguna para B.2 |
| 8 | CRLF y salto final | Modelo (CRLF/CRLF final); RC no los menciona | Solo **TM**; no se atribuye al banco | Homologación o indicación expresa |
| 9 | Provincia `00` frente a “solo se informa con tipo `004`” | DRPS (blanco/opcional, `N`); modelo (`00`); regla de colores | Se resuelve por decisión interna del 2026-11-04: `00` cuando no aplica; con tipo `004` solo el dato válido del maestro | Decisión interna registrada (PC-04); homologación bancaria pendiente |
| 10 | Fecha diferida ≥24 horas hábiles | RC 10; el contrato actual no modela esa modalidad | Se registra como requisito nuevo; no se implementa | Decisión empresarial de alcance y checkpoint posterior |
| 11 | Tipo `N` del campo 16 frente a la imposibilidad de representar espacios con `N` | DRPS; motor F4 | Se resuelve con la representación `A`/`SPACE_RIGHT` aprobada en CP-F7-C2.2 (PC-01), no por inferencia | Aprobada en PC-01 |
| 12 | Obligatoriedad global de B.2 | Regla general de A.1 vs B no la repite; DRPS usa colores | La semántica de colores se toma como fuente para B.2; no se generaliza a otros formatos | Documentación; no afecta bytes por sí sola |

#### 3.5.5 Decisiones empresariales que el banco no resuelve

| Tema | Estado | Por qué sigue abierta | Checkpoint |
|---|---|---|---|
| Composición del nombre (P-14) | Resuelta internamente | El banco solo confirma el alfabeto; la composición, normalización y rechazo por longitud se decidieron internamente | Decisión interna 04-11-2026 (A2.6); homologación bancaria pendiente |
| Estrategia de lotes (P-20) | Resuelta internamente | El banco delega la separación en el empleador; solo exige consistencia de conteos | Decisión interna 04-11-2026 (A2.5); homologación bancaria pendiente |
| Catálogo Anexo III (PAT-7) | Abierto contractualmente | PAT-DR es referencia técnica provisional; no hay respuesta específica ni homologación | Consulta/homologación bancaria |
| Mapeo bancario (P-09) | Diseño aprobado; no implementado | Empresa/RRHH debe decidir concepto por descripción exacta y destino | A2.7-C2 o posterior, sin defaults |
| Clasificación interna (P-10) | Resuelta funcionalmente | B1/B2 usan selección explícita; extracción automática no aprobada | Sin extracción ni inferencia |
| Convenio real y número de empresa | Pendiente | `2416` y `2614` son referencias documentales; falta la configuración de la empresa | Antes de materializar |
| Altas A.2 y datos por empleado (P-04) | Pendiente | Es información de la empresa y del alta bancaria | Antes de generar |
| Política de pagos a banco corresponsal | Pendiente | La RC 10 agrega fecha diferida y ≥24 horas hábiles; falta decidir alcance | Checkpoint posterior a C2 |
| Dígitos del convenio BNA (P-23) | Pendiente | Es BNA, fuera de CP-F7-C1 | F7-B |
| Calendario de feriados BNA | Pendiente | Fuente externa, fuera de CP-F7-C1 | F7-B |

#### 3.5.6 Compuerta de homologación/autorización (C2.0 implementado)

**Problema.** `aptitudPatagonia` solo bloquea cuando quedan `B`. Al inicio de
C1, PAT-1 y PAT-2 eran los **únicos** `B` de Patagonia; desde C2.3 no queda
ninguno. Si los bloqueos se resolvieran sin una compuerta independiente,
`generadorHabilitado` podría quedar en `true` aunque la homologación siga
pendiente y aunque `PAT-7/P-09/P-10` y la fecha diferida sigan abiertos.

**Principio.** `ContractStatus` resuelto **no** es autorización de producción.
La compuerta es independiente, explícita y *fail-closed*.

**Implementación (CP-F7-C2.0, aprobada con ajustes menores):**

1. `src/banks/patagonia-b2/autorizacion.ts` contiene solo la compuerta, separada
   de `aptitud.ts` y de `politica.ts`:
   - `type EstadoAutorizacionProduccionPatagonia = 'PENDIENTE_DE_HOMOLOGACION'`.
   - `produccionPatagoniaHabilitada(): boolean` **no recibe argumentos** y
     devuelve siempre `false`. No hay estado aprobado, evidencia, flag ni
     override.
   - No se exporta una constante de estado “pendiente”: un objeto así podía
     confundirse con un interruptor o volverse mutable. La fuente autoritativa
     es únicamente el predicado.
2. La fachada `src/run/generacionPatagonia.ts` evalúa la compuerta **después**
   de los bloqueos contractuales y **antes** de mapear/serializar. Si falla,
   devuelve `HOMOLOGACION_PATAGONIA_PENDIENTE`, sin bytes, sin `Blob`, sin
   descarga y sin llamar al serializer.
3. La autorización **no** se toma de: variable de entorno, parámetro de la
   fachada, campo de `CompanyProfileV3`, archivo de configuración editable,
   `localStorage`, query string ni default. Tampoco de un ID de evidencia:
   un identificador suelto es falsificable. Habilitar producción exige un
   mecanismo no falsificable y un checkpoint propio (C2.2 o posterior).
4. `generadorHabilitado` de `aptitud.ts` sigue significando “contrato sin
   bloqueos”; la producción exige además la compuerta. No se redefine
   `aptitud` para ocultar la diferencia.
5. Cualquier intento de abrir la compuerta con propiedades adicionales de la
   entrada se ignora y está cubierto por pruebas de integración.
6. La compuerta no reemplaza la aceptación bancaria ni la autorización interna:
   las tres deben existir. Tampoco autoriza enviar archivos.

**PAT-8 en el flujo de generación (CP-F7-C2.1).** La respuesta escrita del banco
confirma únicamente «Informar tipo de documento 001». El catálogo general del
Anexo I no cambia: `002`, `003`, `004` y `006` siguen siendo códigos conocidos,
pero se clasifican como `TIPO_DOCUMENTO_NO_CONFIRMADO` en el flujo actual y no
se generan. Un valor fuera del catálogo es `TIPO_DOCUMENTO_INVALIDO`. PAT-8
permanece parcialmente pendiente: no se confirmó el comportamiento completo de
`004` ni el código de documentos extranjeros.

**Serializador de bajo nivel.** `serializarPatagonia` no contiene la compuerta
productiva y no debe contenerla: debe poder reutilizarse en el futuro flujo de
homologación. Solo puede invocarse desde fachadas controladas
(`src/run/generacionPatagonia.ts` o la futura fachada de homologación); una
importación directa desde UI, CLI u otra ruta productiva está prohibida y la
vigila `tests/guardrails/serializadorPatagonia.test.ts`.

**Invariantes que C2 debe probar:**

| Escenario | `B` restantes | Autorización | Resultado esperado |
|---|---|---|---|
| Estado actual (C2.3) | 0 | Pendiente | `HOMOLOGACION_PATAGONIA_PENDIENTE` |
| C2 aplicado sin gate | 0 | Pendiente | `HOMOLOGACION_PATAGONIA_PENDIENTE` |
| C2 aplicado con gate | 0 | Aprobada con mecanismo no falsificable | Habilitado solo para generar; el envío sigue siendo acto humano |
| Estado desconocido | 0 | Desconocida | Bloqueado |
| Intento por ID de evidencia | 0 | “Aprobada” solo con un ID | Bloqueado |

C2.0 implementó las filas 1 y 2 con PAT-1/PAT-2; desde C2.2 la fila 1 dejó un
solo `B` (PAT-2) y desde C2.3 no quedan `B`: la fachada devuelve
`HOMOLOGACION_PATAGONIA_PENDIENTE` sin bytes. Las filas 4 y 5 se cumplen por
construcción (no existe estado desconocido ni mecanismo de evidencia). La fila 3
(habilitación) no está implementada: requiere un mecanismo de autorización no
falsificable y un checkpoint posterior.

#### 3.5.7 Plan de pruebas previsto para CP-F7-C2

| Grupo | Prueba | Expectativa |
|---|---|---|
| Compuerta | Tabla de verdad de §3.5.6 | *Fail-closed*; sin bytes en todos los casos bloqueados |
| Compuerta | PAT-1/PAT-2 en `C` con autorización pendiente | La fachada devuelve `HOMOLOGACION_PATAGONIA_PENDIENTE`, sin bytes |
| Compuerta | PAT-2 `NUMERICA` con autorización pendiente | Rechazo explícito `HIPOTESIS_PAT2_NO_CONFIRMADA`, sin bytes |
| Compuerta | Intento de pasar autorización por entrada pública | Rechazado por tipos/guardrail; no existe el parámetro |
| PAT-1 | R2 104–196 | Exactamente 93 espacios; 197–200 = EMPRESA |
| PAT-2 | R2 85–99 | 15 caracteres, izquierda, espacios a la derecha; rechazo de Ñ/acentos |
| PAT-5 | R0 campo 6 y R1 campo 8 | `01` y `97` aceptados; `00` y `99` rechazados; mismo número en ambos |
| PAT-6 | R0/R1/R2 | Mismo número de empresa; sin default; `2416`/`2614` no hardcodeados |
| PAT-8 | Tipo de documento | `001` aceptado; `004`, `002`, `003` y `006` conocidos pero `TIPO_DOCUMENTO_NO_CONFIRMADO`; fuera del catálogo, inválido |
| PAT-10 | Nombre | `ACRE` + convenio del perfil + `.txt`; no `2614` fijo |
| PAT-12 | Concepto | Alfabeto qwerty; rechazo de Ñ, acentos y signos; catálogo no inventado |
| PAT-13 | Lotes | Conteos R0/R1 y R1/R2 consistentes; lote `0000` rechazado; estrategia única aprobada (999 pagos, desde `0001`) |
| PAT-15/16 | Versión y comprobante | 8 espacios; `0000000` solo con legajo ausente; legajo presente inválido bloquea |
| PAT-17 | R2 campo 8 | Criterio vigente: R2 toma `PAT_CODIGO_BANCO`; `034` es constante de R0 campo 2. `034` en R2 solo como propuesta PC-17 (`C*`), no aplicada ni homologada; ningún cambio en `src/reconciliation/**`; fecha diferida no implementada sin decisión |
| Regresión | Goldens existentes | Sin cambios de bytes ni SHA; no se regeneran |
| Regresión | `npm run verify`, `check:sensitive`, formato | Verdes; sin PII ni originales sensibles versionados |

Un fixture contractual nuevo solo se agrega si es 100 % sintético, aporta
valor, pasa `check:sensitive` y cuenta con aprobación explícita (D-091). No se
modifica el golden técnico existente.

## 4. Mapeo de liquidaciones a códigos bancarios — DISEÑO APROBADO, IMPLEMENTACIÓN PENDIENTE (D-026, D-095)

La muestra de Finnegans contiene las clasificaciones Agrario, Comercio,
Directivos y Liq. Final. **No se infiere** a qué identificador de préstamo BNA
(`0000` / `0003`) ni a qué tipo de liquidación Patagonia (Anexo III)
corresponde cada una: pueden ser grupos laborales o clasificaciones internas
sin equivalencia bancaria directa.

CP-F7-C2.4-A2.7-C1 fija para P-09 el diseño futuro: selección explícita por
`descripcionOriginal` exacta y `destino` dentro de la corrida, sin códigos
predeterminados, inferencias ni reutilización automática entre importaciones.
Dos descripciones pueden compartir concepto. Una descripción presente en más
de un destino requiere decisiones independientes. Si dentro de un mismo
destino una descripción necesitara conceptos distintos, se detiene esa
agrupación y debe diseñarse una selección más granular. La empresa/RRHH
confirma el concepto real; la herramienta conserva referencias e importes y
no modifica los datos originales.

P-09 sigue **sin implementar**. P-10 está resuelta funcionalmente por la
clasificación explícita B1/B2, no por extracción automática. Una descripción
sin mapeo bancario aprobado continúa bloqueando la generación del destino
correspondiente.

Separación obligatoria de campos: R1 “Concepto” es texto de 10 caracteres; R2
“Tipo de documento” es el campo 10 y la respuesta `001` le corresponde; R2
“Tipo de liquidación” es el campo 15, posiciones 101–103, y usa el Anexo III.
Ninguna decisión o valor se reutiliza entre esos campos.

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
| BNA-1 | Tipo de documento | `96` para DNI (p.9) vs clase `1` + tipo `02` + CUIL (p.11) vs clase `1` + tipo `96` + CUIL (p.15). Otros códigos en un documento no disponible. **No se elige `02` ni `96` como default** | p.9, 11, 15 | **B** | Sí |
| BNA-2 | CBU en registro 2 | El texto dice "2do bloque del CBU de la empresa"; el ejemplo usa el CBU del beneficiario. **Nunca** copiar el CBU de origen al destino | p.8, 11 | **I** | Sí |
| BNA-3 | Ejemplos inconsistentes | p.11: el ejemplo muestra `00` en las posiciones 80–81, mientras la descripción del campo 12 ("Sistema original", p.6) indica 2 espacios. p.14: cantidad `0000004` vs leyenda "1". p.15: ejemplo compuesto no coherente: el total del registro 3 (80.545,23) ≠ el único registro 2 (66.876,54). Sirven solo para validar posiciones; no son golden files | p.6, 11, 14, 15 | Documentado | No |
| BNA-4 | Posiciones derivadas | Aprobadas (D-023); se conserva la trazabilidad a longitudes y ejemplos | p.4–15 | C | — |
| BNA-5 | Convenio | Relleno a derecha para 4 dígitos (contrario a la regla N general de p.4); forma de 8 números documentada; **5, 6 y 7 dígitos no definidos**. El mapper de CP-F5-B debe rechazar los casos no definidos hasta nueva decisión | p.4, 6, 7, 15 | **I** | Sí |
| BNA-6 | Entidad/sucursal | "0 + código BCRA" vs dígitos del CBU (la sucursal del CBU ya tiene 4 dígitos) | p.5, 8, 11 | **I** | Sí |
| BNA-7 | Fecha de compensación | "Día hábil anterior"; sin calendario de feriados en `references/`; formato AAAAMMDD solo por ejemplo; el ejemplo la rotula "Fecha de pago" | p.5, 7, 14 | **I** | Sí |
| BNA-8 | Caracteres | A–Z y 0–9, sin especiales; sin regla para `Ñ`, acentos ni minúsculas. **No se transforma automáticamente** (sin `toUpperCase`, transliteración ni remoción de acentos); una entrada fuera del alfabeto confirmado puede rechazarse. La normalización eventual requiere decisión documentada | p.4, 7 | **I** | Sí |
| BNA-9 | Fin de línea | No especificado; implica salto final | p.14 | **I** (requiere homologación) | Sí |
| BNA-10 | Mismo CBU repetido | El documento no lo trata; con D-015 no puede ocurrir por CUIL, pero dos CUIL podrían tener el mismo CBU | — | **I** | No |
| BNA-11 | Campos libres | ¿Pueden ir vacíos "Información criterio empresa" e "Identificación cliente beneficiario"? **Solo esos dos campos.** `Datos de la empresa` (R2, pos. 88–100) está documentado como uso interno y espacios si no se usa; no forma parte de BNA-11 | p.6, 9, 11 | **I** | Sí |

### 6.2 Patagonia

Los estados de la columna **Vigente** son los efectivos del código y no se
modifican en CP-F7-C1. La columna **Propuesta C2** remite a §3.5.3; `C*`
significa “`C` propuesto que requiere aprobación humana explícita”.

| ID | Tema | Detalle C1 | Fuente | Vigente | Propuesta C2 | Afecta bytes |
|---|---|---|---|---|---|---|
| PAT-1 | Registro 2, campo 16 | 93 posiciones y 93 espacios; `PAT-DR2` declara `N`; se representa como `A`/`SPACE_RIGHT`. `CEROS` queda como hipótesis histórica bloqueada | PAT-RESP 1; PAT-DR2; PAT-MODEL | **C** (solo `ESPACIOS`) | `C` aplicada (PC-01, C2.2) | Sí |
| PAT-2 | Código de dependencia | `A`, 15, izquierda, espacios a la derecha; solo letras ASCII y dígitos (sin signos, `Ñ` ni acentos), sin transformar; debe coincidir con el alta. El valor real sigue en P-04 | PAT-RESP 2; PAT-DR2 | **C** | `C` aplicada (PC-02, C2.3); `NUMERICA` sigue `BLOQUEADA` | Sí |
| PAT-3 | Campos que deben coincidir con el alta | Semántica de colores confirmada; la enumeración “11, 12, 13 y 14” sigue contradictoria porque el 14 es espacios | PAT-RESP 2; PAT-DR | **I** | `I` (PC-03) | No |
| PAT-4 | Provincia si no aplica | `00` cuando el tipo no exige provincia por decisión interna; con tipo `004` solo el dato válido del maestro y el inválido bloquea | PAT-RESP 2; PAT-DR2; PAT-MODEL | **I** | `C*` (PC-04) | Sí |
| PAT-5 | Número de envío | **01–97**; `00` y `99` fuera; debe coincidir con el número informado en la web. “1–70” queda como antecedente | PAT-RESP 3; PAT-DR | **I** | `C` (PC-05) | Sí |
| PAT-6 | Número de empresa | Es el mismo número de convenio; obligatorio. `2416`/`2614` no se fijan como valor productivo | PAT-RESP 4; PAT-MODEL | **I** | `C` equivalencia + `D` valor (PC-06) | Sí |
| PAT-7 | Anexo III | La respuesta solo se refiere al tipo de documento `001`; el catálogo de tipo de liquidación no fue respondido | PAT-RESP 5; PAT-DR; PAT-XL | **I** | `I` (PC-07) | Sí |
| PAT-8 | Anexo I | `001` confirmado para el caso general; `004`/extranjero no confirmado y PAT-XL lo omite | PAT-RESP 5; PAT-DR; PAT-XL | **I** | `C` limitado a `001` + `I` `004` (PC-08) | Sí |
| PAT-9 | Apellido y nombre | Alfabeto qwerty sin Ñ, acentos ni signos. Obligatoriedad contradictoria (verde vs `a`); composición/truncado resueltos internamente | PAT-RESP 6; PAT-DR2; PAT-MODEL | **I** | `I` parcial: alfabeto `C` + decisión interna P-14 (PC-09) | Sí |
| PAT-10 | Nombre de archivo | `.txt`, `ACREXXXX`, `XXXX` = número de convenio, envío web sin encriptar; `.BPS` es alternativa del aplicativo | PAT-RESP 7; PAT-DR | **I** | `C` (PC-10) | No |
| PAT-11 | Variante de detalle / modalidad | B.2 es admisible; el convenio no tiene restricción de modalidad. No prueba que el alta esté hecha | PAT-RESP 5; PAT-DR2; PAT-MODEL | **I** | `C*` (PC-11) | Sí |
| PAT-12 | Caracteres en concepto | Alfabeto qwerty sin signos; el ejemplo `HAB.05/00` del DRPS contradice la respuesta. Texto libre vs catálogo abierto | PAT-RESP 8; PAT-DR2 | **I** | `I` parcial: alfabeto `C` (PC-12) | Sí |
| PAT-13 | Loteo | Separación a criterio del empleador; conteos R0/R1 y R1/R2 deben coincidir; lote único ≠ `0000`. Estrategia P-20 resuelta por decisión interna | PAT-RESP 9; PAT-DR2; PAT-MODEL | **I** | `C*` conteos + decisión interna (PC-13) | Sí |
| PAT-14 | Encoding y fin de línea | ASCII, CRLF y CRLF final solo observados en el modelo; la respuesta escrita no los menciona | PAT-MODEL | **C contingente** | `C contingente` (PC-14) | Sí |
| PAT-15 | Versión | 8 espacios en R0 y R1; RC remite a DRPS/modelo, no lo dicta | PAT-RESP 3; PAT-DR2; PAT-MODEL | **I** | `C*` (PC-15) | Sí |
| PAT-16 | Comprobante no informado | Ceros solo con legajo ausente, por la notación `n`; legajo presente inválido bloquea; combinación de RC, DRPS y modelo | PAT-RESP 3; PAT-DR2; PAT-MODEL | **I** | `C*` (PC-16) | Sí |
| PAT-17 | Código de banco del R2 | Criterio vigente: R2 toma `PAT_CODIGO_BANCO`; PAT-DR no fija `034` y el `034` constante es de R0 campo 2. La respuesta 10 sostiene `034` en R2 y agrega fecha diferida ≥24 horas hábiles para corresponsal; PC-17 (`034` en R2) es propuesta `C*` no aplicada ni homologada. D-086 congelada; no se toca conciliación | PAT-RESP 10; PAT-DR; PAT-MODEL | **I** | `C*` `034` + requisito nuevo (PC-17), pendiente | Sí |

## 7. Estado de los generadores

| Generador | Bloqueos (B) | Interpretaciones (I) que afectan bytes | Estado |
|---|---|---|---|
| BNA GT Haberes | BNA-1 | BNA-2, 5, 6, 7, 8, 9, 11 | **No habilitado.** Desarrollo permitido (F4–F5); producción PENDIENTE DE HOMOLOGACION |
| Patagonia B.2 | Ninguno (PAT-1 y PAT-2 confirmados en sus hipótesis) | PAT-4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17 | **No habilitado.** Desarrollo permitido (F4; F6 CP-F6-A); producción PENDIENTE DE HOMOLOGACION. PAT-1 quedó `CONFIRMADA` para `ESPACIOS` en C2.2 y PAT-2 para `ALFANUMERICA` en C2.3; la producción sigue bloqueada por la compuerta de §3.5.6 |

**Dos mecanismos de bloqueo distintos (no mezclar):**

1.  **Contrato bancario:** BNA-1 es `BLOQUEADA`; PAT-1 quedó `CONFIRMADA` para
    `ESPACIOS` en C2.2 y PAT-2 para `ALFANUMERICA` en C2.3. `hallarBloqueosGeneracion()`
    los informa y la condición 7 de docs/03 §G.3 mantiene el generador deshabilitado.
    Las `INTERPRETACION_PENDIENTE` **no** se convierten en `BLOQUEADA` (D-075,
    D-078). PAT-17 es `I`: no bloquea por sí sola, pero mantiene la salida
    PENDIENTE DE HOMOLOGACION y la regla actual de entidad Patagonia `034`
    congelada (no fija el valor de R2 campo 8). **C2.3:** aunque
    PAT-1 y PAT-2 ya no bloqueen, la compuerta de homologación de §3.5.6 es
    independiente y *fail-closed*: la producción no genera bytes.
2.  **Datos de la corrida:** si P-09/P-10 no están resueltos, una fila
    puede quedar `LIQUIDACION_SIN_MAPEO` **BLOQUEANTE** en la conciliación
    (docs/03 §E.2 regla 14, D-026/D-037). Es una incidencia por fila, no
    un `ContractStatus` de la spec y no se duplica en `aptitudBna`.
3.  **Homologación/autorización (propuesta C2):** un estado contractual
    resuelto no es autorización de producción. La fachada Patagonia deberá
    exigir una autorización explícita con evidencia registrada; sin ella
    devolverá `HOMOLOGACION_PATAGONIA_PENDIENTE` aunque no queden `B`. No se
    implementa en C1.

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

**CP-F7-C1 — estados y homologación siguen separados.** La consolidación
documental de §3.5 no acredita aceptación bancaria. Aun con `PC-01` y `PC-02`
aplicadas y el contrato sin `B`, la generación productiva Patagonia seguirá
bloqueada hasta que exista:

1.  homologación aprobada por el banco, con evidencia registrada;
2.  autorización interna explícita (D-090);
3.  la compuerta de §3.5.6 implementada y probada.

La cadena completa sigue siendo: resolver contrato **≠** generar archivo **≠**
inspeccionar **≠** enviar **≠** archivo aceptado **≠** banco homologado **≠**
autorización interna para producción. La compuerta no se implementa en C1; su
diseño y sus pruebas están en §3.5.6 y §3.5.7.
