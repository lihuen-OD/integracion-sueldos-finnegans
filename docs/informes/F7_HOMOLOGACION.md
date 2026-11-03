# F7 · Homologación bancaria — documento operativo

**Estado:** CP-F7-0 aprobado (auditoría humana); CP-F7-0-B aprobado
(auditoría humana); CP-F7-A ejecutado, **pendiente de auditoría humana**;
CP-F7-C0 ejecutado, **pendiente de auditoría humana**; CP-F7-C2.2 aprobado
para continuar; CP-F7-C2.3 ejecutado, **pendiente de auditoría humana**.
**Rama:** `f7-homologacion`.
**Base:** `main` en `d8be143ca3dc34fc9a0aa39246ba279204748b3b`.
**Fecha:** 27-10-2026 (CP-F7-0/A); 30-10-2026 (CP-F7-C0); 02-11-2026 (C2.2);
03-11-2026 (C2.3).

F5 y F6 están **técnicamente cerradas e integradas**, pero **ninguna está
homologada**. La aplicación sigue **NO apta para pagos reales** y F8 no se
inicia.

## 1. Objetivo

Dejar el repositorio preparado para homologar Banco Nación y Banco Patagonia
sin confundir tres cosas distintas: resolver el contrato, generar bytes y
obtener aceptación bancaria.

CP-F7-0 no resuelve preguntas bancarias, no modifica código, no genera
archivos, no contacta bancos y no cambia estados `B`/`I`/`C`.

## 2. Estado inicial

| Banco | Implementación técnica | Contrato documental | Generación productiva | Homologación |
|---|---|---|---|---|
| BNA | Cerrada (F5) | Abierto: 1 `B` + 8 `I` | Bloqueada (`BNA-1`) | No |
| Patagonia | Cerrada (F6) | Abierto: 1 `B` + 15 `I` | Bloqueada (`PAT-2`) | No |

**Estado vigente del contrato Patagonia (C2.2/C2.3):** PAT-1 quedó
`CONFIRMADA` para `ESPACIOS` y PAT-2 para `ALFANUMERICA`; no quedan `B` en
Patagonia. La generación productiva sigue **bloqueada por la compuerta de
autorización**, no por un `B`. La tabla anterior refleja el estado inicial de
CP-F7-0 y se conserva como registro histórico.

Ambas fachadas devuelven bytes **solo en memoria** y terminan en
`CONTRATO_BNA_BLOQUEADO` / `CONTRATO_PATAGONIA_BLOQUEADO` antes de
serializar. Desde CP-F7-0-B, la fachada BNA acepta perfiles v2 y v3 usando
solo la sección `bna`; v1 sigue siendo `PERFIL_VERSION_INCOMPATIBLE`.
Aceptar v3 no habilita la generación productiva. Los goldens existentes son
técnicos, sintéticos y **no homologados**.

**CP-F7-C0 (30-10-2026).** Banco Patagonia respondió por escrito las diez
consultas. La transcripción y los dos adjuntos del banco se registran en
`docs/informes/F7_CONSULTAS_BANCARIAS.md` §12 y en §13.1 de este documento.
La evidencia es **parcial**: no trae fecha, remitente ni acuse verificables y
no responde todas las preguntas. Ningún estado `B`/`I`/`C` cambió.

## 3. Separación contrato / homologación

**Nivel 1 — resolución contractual.** Un `B`/`I` pasa a regla confirmada con
evidencia suficiente: documentación bancaria oficial, respuesta escrita del
banco o decisión humana autorizada. No exige un archivo aceptado por cada
campo.

**Nivel 2 — homologación bancaria.** Etapa posterior e integral. Un único
archivo aceptado puede validar muchas reglas a la vez.

Cadena explícita:

> resolver contrato **≠** generar archivo **≠** inspeccionar **≠** enviar
> **≠** archivo aceptado **≠** banco homologado **≠** autorización interna
> para producción.

## 4. Taxonomía A–E

| Categoría | Significado |
|---|---|
| **A** | Resoluble internamente: documentación disponible, decisión de producto/arquitectura, configuración explícita o decisión de negocio |
| **B** | Requiere confirmación explícita de Banco Nación o Banco Patagonia |
| **C** | Requiere archivo, ejemplo homologado, prueba, acuse o resultado del canal para resolver **esa** incertidumbre |
| **D** | Requiere dato de la empresa: convenio, número de empresa, modalidad, cuenta, altas, clasificaciones |
| **E** | Requiere fuente oficial externa no incorporada (ARCA, BCRA, calendario) |

Un ítem puede tener varias categorías. Los estados contractuales `B`/`I`/`C`
son otra dimensión y no se mezclan con esta taxonomía.

### 4.1 Roll-up (41 ítems = 26 contractuales + 15 P)

| Categoría | Total |
|---|---|
| A | 8 |
| B | 33 |
| C confirmado | 0 |
| C contingente | 3 (BNA-9, PAT-10, PAT-14) |
| D | 13 |
| E | 3 |
| Exclusivamente interno | 4 (P-08, P-14, P-21, P-22) |

**C contingente** significa: solo pasará a C si el banco responde que la
incertidumbre no puede resolverse documentalmente y debe verificarse por
ingesta. No cambia `ContractStatus` ni `docs/04`.

## 5. Readiness

### 5.1 BNA

| # | Estado | Valor |
|---|---|---|
| 1 | Implementación técnica existente | Sí |
| 2 | Contrato documental resuelto | No |
| 3 | Configuración de empresa | Parcial |
| 4 | Generación técnicamente posible | Sí, por capas técnicas |
| 5 | Generación productiva habilitada | No |
| 6 | Archivo materializable para prueba | No |
| 7 | Archivo enviado al banco | No |
| 8 | Aceptación bancaria | No |
| 9 | Homologación | No |
| 10 | Autorización interna para producción | No |

### 5.2 Patagonia

| # | Estado | Valor |
|---|---|---|
| 1 | Implementación técnica existente | Sí |
| 2 | Contrato documental resuelto | Parcial: C1 consolidó evidencia y propuestas, pero **ningún estado `B`/`I`/`C` cambió**; C2 no iniciado |
| 3 | Configuración de empresa | Parcial |
| 4 | Generación técnicamente posible | Sí, por capas técnicas |
| 5 | Generación productiva habilitada | No |
| 6 | Archivo materializable para prueba | No |
| 7 | Archivo enviado al banco | No |
| 8 | Aceptación bancaria | No |
| 9 | Homologación | No |
| 10 | Autorización interna para producción | No |

Capacidad técnica ≠ generación productiva ≠ homologación.

## 6. Política de evidencia

| Artefacto | Qué es | Regla |
|---|---|---|
| Golden técnico sintético | Fixture de regresión 100 % sintético | Inmutable; no prueba aceptación bancaria |
| Fixture contractual confirmado | Caso sintético derivado de una respuesta bancaria | Opcional; solo si aporta valor, es 100 % sintético, pasa `check:sensitive` y hay aprobación explícita |
| Evidencia bancaria | Respuesta, acuse, fecha, canal, SHA-256, resultado, observaciones | No es fixture; si contiene datos reales, el original no se versiona |

Una aceptación bancaria no obliga a crear un golden nuevo. No se fijan
todavía nombres definitivos de archivos de evidencia.

## 7. Política de privacidad

- Preferencia por datos de empleados 100 % sintéticos.
- Si el banco exige datos reales, se usan **solo localmente** para la prueba.
- Nunca en fixture ni en repo: CUIL real, CBU real de empleado, nombres
  reales, legajos reales, importes reales, nómina real ni TXT real.
- La configuración empresarial real necesaria para formar bytes puede usarse
  localmente, pero no se convierte automáticamente en fixture ni en
  documentación pública.
- La evidencia versionada debe estar redactada/sanitizada.

## 8. Diseño del harness (solo diseño)

Herramienta local, separada de la UI, que:

- importa **exclusivamente** `generarBna` y `generarPatagonia`;
- no importa mapper/serializer internos;
- no inyecta política ni aptitud, no usa mocks;
- no bypassa readiness ni conciliación;
- materializa exactamente los bytes que produciría la aplicación;
- ejecuta/recibe la inspección productiva;
- calcula SHA-256 e informa tamaño y cantidades/totales sin PII;
- escribe el TXT fuera del repositorio;
- nunca sube ni envía automáticamente.

No es ruta productiva, no forma parte del bundle/UI. Se implementa en
CP-F7-D1, no en CP-F7-0.

## 9. Checkpoints

| CP | Alcance | Estado |
|---|---|---|
| CP-F7-0 | Decisiones y documentación | Ejecutado y aprobado (auditoría humana) |
| CP-F7-0-B | Implementación G-1 (v2 + v3 en BNA, motivo de versión incompatible, tests) | Aprobado (auditoría humana) |
| CP-F7-A | Paquete de consultas + trazabilidad; STOP antes de enviar | Ejecutado; pendiente de auditoría humana |
| CP-F7-B | Respuestas BNA | No iniciado |
| CP-F7-C | Respuestas Patagonia (alcance original) | Reemplazado por C0–C3 |
| CP-F7-C0 | Registro documental de respuestas Patagonia | Ejecutado; aprobado por auditoría humana (base de C1) |
| CP-F7-C1 | Actualización y consolidación documental Patagonia | Ejecutado; pendiente de auditoría humana |
| CP-F7-C2 | Corrección contractual Patagonia | C2.0/C2.1/C2.2/C2.3 ejecutados; C2.4 no iniciado |
| CP-F7-C3 | Verificación y cierre técnico Patagonia | No iniciado |
| CP-F7-D1 | Harness local | No iniciado |
| CP-F7-D2 | Materialización y envío controlado (acto humano) | No iniciado |
| CP-F7-E | Evidencia, iteraciones y cierre | No iniciado |

El paquete de CP-F7-A vive en `docs/informes/F7_CONSULTAS_BANCARIAS.md`:
41 ítems trazados, 18 consultas firmes y 1 condicional. No fue enviado desde
el repositorio; requiere auditoría humana y P-21 antes de cualquier contacto.
BNA-9 y PAT-14 siguen como `C` contingente en el estado contractual vigente.
PAT-10 conserva ese estado hasta la aprobación de CP-F7-C1, aunque la respuesta
escrita ya permite proponer `C`.

CP-F7-C0 registró las respuestas recibidas y una matriz corregida en
`F7_CONSULTAS_BANCARIAS.md` §12. No aplicó estados, no tocó `docs/04` ni
`src/**` y no inició CP-F7-C1.

CP-F7-C1 consolidó esa evidencia en `docs/04` §3.5: clases de evidencia
`RC`/`DC`/`TM`/`DE`/`PH`, matriz final PAT-1…PAT-17, propuestas `PC-01`…`PC-17`,
doce contradicciones, diseño de la compuerta y plan de pruebas C2. **No aplicó
ningún estado**, no tocó `src/**`, `tests/**`, `main`, goldens ni
`references/**`, no generó TXT y no implementó la compuerta. Queda pendiente de
auditoría humana; C2 no se inicia.

### 9.1 Riesgo de compuerta al cerrar PAT-1/PAT-2

`aptitudPatagonia` habilita el generador cuando no quedan bloqueos `B`.
Al momento de C1, PAT-1 y PAT-2 eran los **únicos** `B` de Patagonia. Si
CP-F7-C1/C2 los pasaran a `C` sin una compuerta adicional,
`generadorHabilitado` podría quedar en `true` aunque la homologación siga
pendiente y aunque P-14, P-20, PAT-7, PAT-9, PAT-16 y el requisito de fecha
diferida sigan abiertos.

Propuesta para un checkpoint posterior, **implementada en CP-F7-C2.0/C2.1**:

1. Conservar todas las compuertas actuales.
2. Agregar un requisito independiente de **homologación aprobada**, separado
   de `generadorHabilitado`, antes de generar para producción.
3. Mantener `homologacion: 'PENDIENTE_DE_HOMOLOGACION'` hasta una decisión
   humana explícita y hacer que la fachada bloquee con un motivo propio.
4. No interpretar un cambio de `ContractStatus` como autorización de
   producción (D-090).

### 9.2 Compuerta de homologación — diseño C1, implementado en C2.0

CP-F7-C1 deja el diseño completo en `docs/04` §3.5.6 y §3.5.7. Resumen
normativo:

-   **Nombre del motivo:** `HOMOLOGACION_PATAGONIA_PENDIENTE`.
-   **Estado inicial:** `PENDIENTE_DE_HOMOLOGACION`, con `evidencia: null`.
-   **Predicado:** producción habilitada solo si el contrato no tiene `B`,
    el estado es `HOMOLOGACION_APROBADA` y existe un ID de evidencia
    registrado en `docs/07` §4.
-   **Ubicación propuesta:** módulo nuevo
    `src/banks/patagonia-b2/autorizacion.ts`, evaluado por la fachada
    `src/run/generacionPatagonia.ts` después de `aptitudPatagonia` y antes de
    mapear/serializar.
-   **Sin *override*:** no se toma de variables de entorno, perfiles,
    parámetros de fachada, archivos editables ni query string. Solo cambia por
    commit revisado con aprobación humana.
-   **Fail-closed:** estado desconocido, evidencia vacía o autorización
    ausente ⇒ bloqueo, sin bytes.
-   **Independencia:** `generadorHabilitado` puede seguir significando
    “contrato sin bloqueos”; no se redefine para ocultar la diferencia.

La compuerta se implementó en CP-F7-C2.0: `produccionPatagoniaHabilitada()`
no recibe argumentos y devuelve siempre `false`. C2.1 agregó la validación de
PAT-8 en el flujo; C2.2 y C2.3 confirmaron PAT-1 y PAT-2 en sus hipótesis
respaldadas. La compuerta se evalúa en la fachada después de los bloqueos
contractuales y antes de mapear/serializar; el serializador de bajo nivel no la
contiene. Desde C2.3 no quedan `B` en Patagonia, pero la fachada sigue sin
producir bytes: devuelve `HOMOLOGACION_PATAGONIA_PENDIENTE`.

## 10. Pendientes humanos

| ID | Pendiente | Estado |
|---|---|---|
| P-14 | Composición exacta del nombre Patagonia | Abierta |
| P-21 | Responsable y canal de contacto con cada banco | Abierta |
| — | Datos reales del convenio BNA (número, dígitos, CBU empresa, moneda) | Pendiente |
| — | Datos reales del convenio Patagonia (número de empresa, modalidad B.2) | Pendiente |
| — | Altas A.2 y origen de datos por empleado (P-04) | Pendiente |
| — | Política interna sobre evidencia redactada | Pendiente |
| — | Autorización para usar datos sintéticos en la homologación | Pendiente |

P-21 no bloquea F7 documental; sí bloquea enviar consultas, registrar un
canal real e iniciar una prueba externa.

## 11. Pendientes BNA

| ID | Tema | Estado | Cat. |
|---|---|---|---|
| BNA-1 | Tipo de documento del beneficiario | BLOQUEADA | B |
| BNA-2 | Bloque 2 del CBU en el detalle | I | B |
| BNA-5 | Convenio: relleno y longitud | I | B + D |
| BNA-6 | Entidad y sucursal derivadas del CBU | I | B |
| BNA-7 | Fecha de compensación | I | B + E |
| BNA-8 | Alfabeto y mayúsculas | I | B |
| BNA-9 | Fin de línea / salto final | I | B (C contingente) |
| BNA-10 | Mismo CBU en dos beneficiarios | I | A + B |
| BNA-11 | Campos libres vacíos | I | B + D |

## 12. Pendientes Patagonia

| ID | Tema | Estado | Cat. |
|---|---|---|---|
| PAT-1 | Relleno final del detalle (93 vs 96) | CONFIRMADA solo para `ESPACIOS` (PC-01, C2.2) | C |
| PAT-2 | Código de dependencia (`N` vs `A`) | CONFIRMADA solo para `ALFANUMERICA` (PC-02, C2.3) | C |
| PAT-3 | Campos que deben coincidir con el alta | I | B |
| PAT-4 | Provincia cuando el tipo no es `004` | I | B |
| PAT-5 | Número de envío | I | B |
| PAT-6 | Número de empresa vs convenio | I | B + D |
| PAT-7 | Anexo III | I | B + D |
| PAT-8 | Anexo I (`004`) | I | B |
| PAT-9 | Apellido y nombre | I | B |
| PAT-10 | Nombre de archivo | I | B (C contingente) |
| PAT-11 | Variante B.2 | I | B + D |
| PAT-12 | Caracteres en concepto | I | B |
| PAT-13 | Loteo | I | A + B |
| PAT-14 | Encoding y fin de línea | I | B (C contingente) |
| PAT-15 | Versión del registro 1 | I | B |
| PAT-16 | Comprobante no informado | I | B |
| PAT-17 | Código de banco del R2 | I | B + D |

PAT-17 no autoriza modificar `src/reconciliation/**` ni la regla `034`
congelada por D-086.

**CP-F7-C0 — evidencia y propuesta (sin cambio de estados).** Las diez
respuestas escritas y los dos adjuntos del banco en
`F7_CONSULTAS_BANCARIAS.md` §12. CP-F7-C1 consolidó la propuesta en `docs/04`
§3.5.3:

- `C`: PAT-2, PAT-5, PAT-6 (equivalencia), PAT-8 (`001` limitado), PAT-10.
  PAT-1 y PAT-2 ya fueron aplicadas en C2.2/C2.3; el resto sigue como propuesta.
- `C*` (requiere aprobación explícita): PAT-1 (93 posiciones/espacios y
  representación `A`/`SPACE_RIGHT`), PAT-4, PAT-11, PAT-13 (conteos), PAT-15,
  PAT-16, PAT-17 (`034`).
- `C contingente`: PAT-14.
- `I`: PAT-3, PAT-7, PAT-9 (obligatoriedad/formato y P-14), PAT-8
  (`004`/extranjero) y la parte libre/catálogo de PAT-12.

C1 ajustó PAT-1 de `C` a `C*`: la respuesta escrita confirma 93 caracteres,
pero no el tipo ni el relleno; los espacios provienen del diseño y del modelo.
Siguen abiertas P-14 (composición del nombre), P-20 (loteo), P-09/P-10
(clasificación) y el dato real del convenio (el texto menciona `2416`; el
modelo usa `2614`). La respuesta 10 agrega un requisito no modelado: pagos a
banco corresponsal con fecha diferida y acreditación ≥24 horas hábiles. Ningún
estado fue aplicado en C1.

**CP-F7-C2.2 — PC-01 aplicada (sin habilitar producción).** PAT-1 pasa a
`CONFIRMADA` **solo** para la hipótesis `ESPACIOS`: 93 posiciones (104–196)
completadas con 93 espacios, tipo `A` y `SPACE_RIGHT` porque `N` con espacios no
es representable en F4. La hipótesis histórica `CEROS` sigue `BLOQUEADA`.
PAT-2 permanece `BLOQUEADA`, por lo que una entrada válida sigue devolviendo
`CONTRATO_PATAGONIA_BLOQUEADO`; la compuerta de autorización sigue cerrada y no
hay bytes. El golden técnico conserva sus 1004 bytes y su SHA-256
`36f55f2a0aee04e944c5347ecde62f6c8722418f8b0bca86ebf1a408848a7ade`. La
homologación bancaria, P-03/PAT-11, P-09/P-10, P-14 y P-20 siguen abiertas.

**CP-F7-C2.3 — PC-02 aplicada (sin habilitar producción).** PAT-2 pasa a
`CONFIRMADA` **solo** para la hipótesis `ALFANUMERICA`: 15 posiciones (85–99),
tipo `A`, alineado a la izquierda y completado con espacios a la derecha
(`SPACE_RIGHT`). El flujo confirmado acepta solo letras ASCII `A-Z`/`a-z` y
dígitos `0-9`; rechaza signos, espacios internos, `Ñ`, acentos y vacío, sin
transformar el valor ni recortar espacios. La restricción se apoya en
“alfanumérico” (PAT-2) y en el alfabeto qwerty inglés que el banco declara para
los campos de texto (PAT-9/PAT-12); PAT-2 no enumera el alfabeto y persiste la
incertidumbre sobre el código realmente registrado en el alta. La hipótesis
histórica `NUMERICA` (`N`/`ZERO_LEFT`) sigue `BLOQUEADA`; la fachada la rechaza
con `HIPOTESIS_PAT2_NO_CONFIRMADA` antes de mapear o serializar y no produce
bytes. Con `ALFANUMERICA` y datos válidos la fachada devuelve
`HOMOLOGACION_PATAGONIA_PENDIENTE`. PAT-8 conserva su alcance limitado a `001`;
P-09/P-10, P-14 y P-20 siguen abiertas. El golden anterior conserva 1004 bytes
y SHA-256
`36f55f2a0aee04e944c5347ecde62f6c8722418f8b0bca86ebf1a408848a7ade`; se agrega un
golden sintético nuevo, **NO HOMOLOGADO**, de 1004 bytes y SHA-256
`e55158df1ba4cf74603729e319efcb3af63a5d355aeaf058ccdac41a0d3e78cb`. La
homologación bancaria sigue abierta.

## 13. Registro futuro de pruebas y hashes (sin PII)

### 13.1 Evidencia documental Patagonia registrada en CP-F7-C0

| Artefacto | SHA-256 | Bytes | Procedencia | Tratamiento |
|---|---|---:|---|---|
| `Respuestas_Banco_Patagonia.txt` | `b8d1c198d60b7cfdb6abcbe90cac3441c2999d7cd4d873226f51998b1b218852` | 12 203 | Transcripción del texto compartido por el usuario; no es exportación de correo | Fuera de Git; sin versión |
| `DRPS (1).docx` | `0625ac4e03b35daeb6930aade391a68005d32480dbeecde85f0ac597d13d778d` | 270 055 | Adjunto del banco informado por el usuario | Fuera de Git; metadatos personales no se versionan |
| `Modelo_ACRE2614 (1).txt` | `d17ce90e4a047ec9beb87b756e9ba79af3a446bab09ac40e6dc982b3d5da64e8` | 606 | Adjunto del banco informado por el usuario | Fuera de Git; solo placeholders |

No se registran fecha de respuesta, remitente, asunto ni acuse porque la
transcripción no los informa. El hash identifica la copia local, no autentica
al emisor.

Se completa en CP-F7-D2/CP-F7-E. Columnas previstas:

| Fecha | Banco | Archivo (referencia local) | SHA-256 | Bytes | Registros / lotes | Total (centavos) | Canal | Acuse | Resultado | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — | — | — |

Reglas: sin CUIL, CBU, nombres, legajos ni importes individuales; el archivo
original queda fuera del repositorio; la evidencia versionada es redactada.

## 14. Lo que este documento no afirma

- No afirma que BNA o Patagonia hayan aceptado ningún archivo.
- No afirma que la aplicación sea apta para pagos reales.
- No afirma que las reglas `B`/`I` estén resueltas.
- No convierte una respuesta documental en homologación.
- No afirma que la transcripción de CP-F7-C0 sea una exportación de correo ni
  que acredite remitente, fecha o acuse.
- No afirma que el convenio real sea `2416` ni `2614`: la diferencia queda
  registrada como contradicción abierta.
