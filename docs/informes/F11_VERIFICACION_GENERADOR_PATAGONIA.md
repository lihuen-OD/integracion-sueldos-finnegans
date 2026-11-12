# F11 — Verificación técnica del generador Banco Patagonia B.2

**Fecha:** 11-11-2026.
**Rama:** `f9-ui-flujo-guiado` (HEAD `1db8e3f`).
**Alcance:** verificar el estado real del generador Patagonia B.2 contra la evidencia
documental disponible, aplicar solo correcciones confirmadas que no exijan inventar
especificaciones y dejar registrado qué falta para homologar.
**Resultado de F11:** no se modificó código, contratos, layouts, fixtures ni goldens.
La verificación no encontró ningún requisito confirmado pendiente de implementación que
pueda aplicarse sin una decisión humana o sin contradecir evidencia existente.

> Este informe **no** homologa el banco, **no** autoriza producción y **no** convierte una
> decisión técnica interna en una confirmación bancaria. La generación productiva sigue
> cerrada por `HOMOLOGACION_PATAGONIA_PENDIENTE`.

---

## 1. Estado actual del generador

El generador B.2 está implementado de punta a punta a nivel técnico:

```
PayrollLine (Finnegans)
  → conciliación (D-012/D-034/D-056, sin cambios)
  → readiness y cobertura efectiva por SourceRef (F10-B)
  → selección explícita de tipo de liquidación (snapshot C5-A)
  → política Patagonia (C5-B)
  → mapper puro → EntradaRegistro[]
  → serializador F4 → bytes
  → inspector independiente
  → compuerta de autorización productiva (cerrada)
```

Puntos verificados:

- **Contrato:** desde C2.3 no quedan issues `BLOQUEADA` en Patagonia. `PAT-1` está
  `CONFIRMADA` solo para `ESPACIOS` y `PAT-2` solo para `ALFANUMERICA`; las hipótesis
  históricas `CEROS` y `NUMERICA` siguen bloqueadas.
- **Aptitud:** `aptitudPatagonia()` no devuelve bloqueos con las hipótesis confirmadas,
  pero eso **no** habilita nada: la compuerta productiva es independiente.
- **Compuerta:** `produccionPatagoniaHabilitada()` devuelve siempre `false`
  (`src/banks/patagonia-b2/autorizacion.ts`). `evaluarGeneracionPatagonia()` devuelve
  `HOMOLOGACION_PATAGONIA_PENDIENTE` antes de mapear y serializar; no hay estado, flag,
  propiedad de entrada ni variable de entorno que la abra.
- **Serializador:** exportado y restringido por guardrail
  (`tests/guardrails/serializadorPatagonia.test.ts`); ninguna ruta de UI o CLI lo importa
  directamente.
- **UI/flujo:** solo existe la selección explícita de tipo de liquidación Patagonia
  (`PanelTipoLiquidacionPatagonia`). No se agregaron formularios ni cargas mensuales en F11.
- **Maestro y perfil:** se consumen los campos `PAT_*` del maestro y únicamente
  `patagonia.numeroEmpresa` del perfil v3. El resto de los datos de envío no se captura en
  la UI y no se inventa.

Estado correcto a comunicar: **implementado y técnicamente validado ≠ homologado ≠
autorizado para producción**.

---

## 2. Requisitos confirmados y evidencia

### 2.1 Campo 16 del R2 (verificación principal de F11)

| Aspecto | Evidencia | Implementación | Verificación |
|---|---|---|---|
| Posiciones 104–196 | PAT-RESP respuesta 1: “son 93 caracteres de longitud (confirmado con txt de prueba)”; PAT-DR2 y modelo | `campoRellenoPat1()` en `src/banks/patagonia-b2/spec.ts` | `PAT1_POSICION_INICIO = 104`, `PAT1_POSICION_FIN = 196` |
| Longitud | 196 − 104 + 1 = **93** | `PAT1_LONGITUD_GEOMETRICA = 93`; `declaredLength` geométrico | `tests/unit/banks/patagonia-b2/spec.test.ts` |
| Contenido | 93 espacios (modelo y DRPS) | `fixedValue: ' '.repeat(93)`, tipo `A`, `SPACE_RIGHT` | Test unitario y goldens byte a byte |
| Posición siguiente | Número de EMPRESA en 197–200 | `r2_numeroEmpresa`, `start: 197`, `end: 200` | `spec.test.ts` y ambos goldens |
| Tipo | PAT-DR2 declara `N`; el contenido es espacios | Se representa `A`/`SPACE_RIGHT` por aprobación humana explícita de PC-01 | `issues: ['PAT-1']`, `CONFIRMADA` solo en `ESPACIOS` |

Verificación en bytes reales:

- `tests/integration/goldenPatagonia.integracion.test.ts` comprueba que cada R2 mide 200,
  que `linea.subarray(103, 196)` tiene 93 posiciones y todas son `0x20`, y que
  `linea.subarray(196, 200)` es `1234`.
- `tests/integration/goldenPatagoniaPat2.integracion.test.ts` repite la comprobación con
  PAT-2 alfanumérica.
- Ambos goldens son de 1004 bytes: 5 registros de 200 (1 R0 + 2 R1 + 2 R2) y 4 separadores
  LF, sin salto final.

**Conclusión:** el campo 16 coincide exactamente con la evidencia confirmada (93
posiciones, 93 espacios, EMPRESA en 197–200). La única diferencia es de representación
interna (`A` en lugar de `N`), aprobada en PC-01 y sin efecto sobre los bytes.

### 2.2 Otros requisitos confirmados ya implementados

| Requisito | Evidencia | Implementación |
|---|---|---|
| PAT-2: código de dependencia `A`, 15, izquierda, espacios a la derecha | PAT-RESP respuesta 2 | `spec.ts` 85–99 `SPACE_RIGHT`; `validacion.ts` solo `A-Z`/`a-z`/`0-9`, sin transformar |
| PAT-5: número de envío 01–97 | PAT-RESP respuesta 5 | `validarNumeroEnvioPatagonia()`: dos dígitos, rechaza `00`, `98`, `99` |
| PAT-6: mismo número de EMPRESA en R0, R1 y R2 | PAT-RESP respuesta 2 (equivalencia) | `mapeo.ts` replica el valor del perfil en los tres registros |
| PAT-8: solo tipo de documento `001` | PAT-RESP respuesta 4 | `validacion.ts` + fachada: otros códigos → `TIPO_DOCUMENTO_NO_CONFIRMADO`, sin bytes |
| PAT-13: conteos de lotes y detalles coinciden | PAT-RESP respuesta 9 | `loteo.ts`: validación de lotes, numeración y coincidencia con pagos; `totales.ts` recalcula desde los pagos |
| PAT-1/PAT-2 aplicadas | PC-01 / PC-02 | Código, contrato, tests y goldens coherentes |

### 2.3 Integración maestro–perfil–decisiones

- **Maestro:** `PAT_TIPO_CUENTA`, `PAT_NUMERO_CUENTA`, `PAT_CODIGO_BANCO`,
  `PAT_CODIGO_SUCURSAL`, `PAT_TIPO_DOCUMENTO`, `PAT_NUMERO_DOCUMENTO`,
  `PAT_PROVINCIA_DOCUMENTO`, `PAT_CODIGO_DEPENDENCIA`; el legajo de Finnegans alimenta el
  comprobante (PAT-16).
- **Perfil v3:** solo `patagonia.numeroEmpresa` (`perfilPatagoniaDesdePerfil()`); v1/v2
  producen `CONFIGURACION_INCOMPLETA`.
- **Decisiones:** PAT-4 (provincia `00` cuando el tipo no la exige), PAT-15 (8 espacios),
  PAT-16 (`0000000` solo con legajo ausente), P-20 (lotes consecutivos de hasta 999) y
  PAT-9/P-14 (nombre `APELLIDO NOMBRE` normalizado) son **decisiones internas aprobadas**,
  no confirmaciones del banco.
- **Tipo de liquidación:** se resuelve por selección explícita y snapshot C5-A ligado a la
  huella de Finnegans; no hay extracción automática ni default.
- **F10-B:** las filas reasignadas manualmente participan por `SourceRef`, no por banco de
  origen. Cubierto por `tests/unit/run/f10bCoberturaReasignados.test.ts` (caso Patagonia).

---

## 3. Implementaciones de F11

**Ninguna.** F11 no requirió cambios de código ni de datos:

- El campo 16 ya estaba correcto.
- PAT-2, PAT-5, PAT-6, PAT-8 y PAT-13 ya estaban implementados.
- No se tocaron layouts, contratos, fixtures, goldens ni `src/reconciliation/**`.
- No se agregaron formularios, cargas mensuales, flags ni rutas de generación.

Motivo: los únicos requisitos “confirmados por escrito pero no implementados” están
afectados por contradicciones o requieren aprobación humana; aplicarlos habría exigido
inventar o contradecir evidencia (ver §4).

---

## 4. Conciliación documental de los requisitos pendientes

Esta sección contrasta las respuestas disponibles con PAT-1, PAT-3, PAT-7, PAT-9,
PAT-10, PAT-12, PAT-14 y PAT-17, y precisa la lectura preliminar de F11.

### 4.0 Fuentes y estatus probatorio

- `references/Respuestas_Banco_Patagonia.txt`: transcripción de diez consultas,
  recompuesta a partir de un mensaje de chat. **No es una exportación del correo**: no
  informa remitente, fecha, asunto ni acuse.
- `references/DRPS (1).docx`: adjunto del banco según el usuario. Contiene tres imágenes
  (R0, R1, R2) sin capa de texto; es el diseño corregido con semáforo, no una respuesta
  escrita.
- `references/Modelo_ACRE2614 (1).txt`: modelo de 606 bytes, tres registros de 200,
  ASCII, CRLF y CRLF final, con placeholders y `2614`.
- `Patagonia_Diseno_Registros_Plan_Sueldos.pdf` (PAT-DR) e
  `Patagonia_Instructivo_Excel_Acreditaciones.pdf` (PAT-XL): documentación de diseño del
  banco, no respuestas a las consultas.

**Regla de lectura.** Una respuesta escrita no equivale a homologación; el modelo es
evidencia observada de un archivo de ejemplo, no una regla general; y la ausencia de una
respuesta en la transcripción **no prueba** que el banco no haya respondido. Solo indica
que no hay evidencia escrita disponible en el repositorio.

### 4.1 PAT-1 — campo 16 del R2 (posiciones 104–196)

- **Confirmado por el banco:** la longitud es **93**. La respuesta 1 dice: “campo 16:
  tiene razón, son 93 caracteres de longitud (confirmado con txt de prueba)”. La pregunta
  también pedía confirmar espacios/ceros y EMPRESA en 197–200; la respuesta escrita no
  repite esas dos confirmaciones.
- **Evidencia exacta:** respuesta 1; DRPS R2 (imagen): campo 16 “Espacios”, tipo `N`,
  inicio 104, fin 196, longitud 93, amarillo; respuesta 2: amarillo = espacios; modelo:
  93 espacios en 104–196 y `2614` en 197–200, 200 caracteres por registro.
- **Implementado:** `spec.ts` fija 104–196, longitud 93, `fixedValue: ' '.repeat(93)`,
  tipo `A`/`SPACE_RIGHT` y `CONFIRMADA` solo para `ESPACIOS`; EMPRESA en 197–200. Los
  goldens verifican los bytes.
- **Contradicción / falta:** el banco confirmó por escrito la longitud, no el contenido ni
  el tipo. El DRPS declara `N` para un campo que el modelo llena con espacios. La
  representación `A` es la aprobación humana de PC-01, no una confirmación bancaria.
- **Cierre requerido:** homologación/aceptación del banco sobre contenido y tipo. No hace
  falta una decisión interna nueva.

### 4.2 PAT-3 — campos que deben coincidir con el alta

- **Confirmado por el banco:** la semántica de colores. La respuesta 2 dice: “en verde los
  datos que el archivo debe contener si o si y coincidir con lo registrado en el banco, en
  amarillo todo lo que son espacios en blanco y en blanco los datos que el cliente puede
  no detallar… pero cuyo campo debe completar con espacios o 0 segúnn [sic] corresponda al
  tipo de campo”.
- **Evidencia exacta:** respuesta 2 (complementaria); DRPS R2, nota al pie: “Los campos 11,
  12, 13 y 14 deben coincidir con los que fueran informados en el momento del alta de la
  cuenta”.
- **Implementado:** no hay una regla ejecutable de “coincidencia con el alta”. Los campos
  11–13 (documento, provincia, dependencia) se toman del maestro y el 14 es fijo de
  espacios; la coincidencia con el alta es un control operativo, no una validación del
  generador.
- **Contradicción / falta:** la enumeración no es utilizable literalmente: el campo 14 es
  “Espacios” amarillo y no puede “coincidir” con el alta. Además, el color verde no
  distingue campo por campo cuáles deben coincidir.
- **Cierre requerido:** información bancaria (enumeración correcta) y control interno
  maestro–alta. No hay cambio de código posible sin esa definición.

### 4.3 PAT-7 — tipo de liquidación (Anexo III)

- **Confirmado por el banco:** nada específico para este campo. La consulta 5 pidió los
  catálogos de tipos de documento y de tipos de liquidación; la respuesta fue “Informar
  tipo de documento 001”, que responde PAT-8. La consulta 3 remitió a DRPS y modelo por
  versión y comprobante, no por el Anexo III.
- **Evidencia exacta:** respuesta 5; DRPS R2: campo 15 “Tipo de liquidación”, tipo `N`,
  101–103, verde, “Dato obligatorio. Ver códigos validos en Anexo III”; PAT-DR Anexo III
  como fuente del catálogo provisional (001/002/003/004/006/007/009); PAT-XL agrega 005 y
  omite 006/007.
- **Implementado:** catálogo provisional y selección explícita por descripción, con
  `confirmadoPorRespuestaEscrita: false` y `homologado: false` en cada entrada. No hay
  mapeo automático por descripción (P-09) ni validación de catálogo en el validador.
- **Contradicción / falta:** se desconoce qué códigos del Anexo III están vigentes para
  este convenio y si 005/006/007 aplican. La transcripción no registra una respuesta
  específica; eso no prueba que el banco no haya respondido.
- **Cierre requerido:** información bancaria (catálogo vigente) y homologación. El mapeo
  descripción→concepto sigue siendo una decisión empresarial separada (P-09).

### 4.4 PAT-9 — apellido y nombre

- **Confirmado por el banco:** el alfabeto. La respuesta 6: “el sistema solo admite datos
  con letras y números del teclado qwerty en inglés, ningún carácter especia [sic], es
  decir, sin Ñ, sin acentos, ni comas, puntos, guiones, cejillas, diéresis, apostrofes,
  etc.”.
- **Evidencia exacta:** respuesta 6; DRPS R2: campo 7 `A`, 35–54, 20, verde (obligatorio);
  modelo: placeholder `a` minúscula (opcional). La respuesta remite a DRPS y modelo para
  obligatoriedad y no responde qué hacer si el contenido supera 20 posiciones.
- **Implementado:** normalización a mayúsculas, sin acentos, `Ñ`→`N`; composición
  `APELLIDO NOMBRE` con un espacio; recorte de extremos y colapso de espacios internos;
  rechazo si supera 20 (no truncamiento). El validador acepta solo `A–Z` y espacio.
- **Contradicción / falta:** obligatoriedad contradictoria (verde vs `a`); orden,
  separador y truncamiento no fueron respondidos. El validador es más restrictivo que el
  alfabeto confirmado (rechaza dígitos) y el separador espacio no está enumerado
  literalmente en la respuesta.
- **Cierre requerido:** información bancaria sobre obligatoriedad, truncamiento y
  separador; homologación. La composición ya tiene decisión interna; no se cambia ahora.

### 4.5 PAT-10 — nombre de archivo

- **Confirmado por el banco:** archivo `.txt`, nombre `ACREXXXX` (`XXXX` = número de
  convenio), envío web sin encriptamiento; alternativa `.BPS` generada por el aplicativo
  Patagonia Sueldo.
- **Evidencia exacta:** respuesta 7. La misma transcripción, en la respuesta 9, menciona
  “archivo ACREXXXX.TXT”; la respuesta 7 dice “debe ser un archivo .txt, el nombre del
  archivo deb ser ACREXXXX”.
- **Implementado:** solo la constante sintética `ACREXXXX.TXT` del compositor de
  homologación. No existe función productiva de nombre ni se usa el convenio real.
- **Contradicción / falta:** no está confirmado si el nombre lleva extensión, si `XXXX` se
  rellena con ceros, qué pasa con un convenio de menos de cuatro dígitos ni la
  sensibilidad a mayúsculas. El convenio real sigue sin definirse (`2416` vs `2614`).
- **Cierre requerido:** dato empresarial (convenio) y materialización en CP-F7-D2;
  eventual confirmación bancaria sobre relleno/extensión. No se inventa ahora.

### 4.6 PAT-12 — concepto del R1

- **Confirmado por el banco:** el alfabeto de la respuesta 8: letras y números qwerty,
  “sin Ñ, sin acentos, ni comas, puntos, guiones…”. La palabra “puntos” excluye
  expresamente el `.`.
- **Evidencia exacta:** respuesta 8; DRPS R1: campo 4 “Concepto”, `A`, 7–16, 10, verde,
  con “ejemplo: HAB.05/00”. El ejemplo usa `.` y `/`, que la respuesta escrita excluye.
- **Implementado:** `validarConceptoPatagonia()` acepta todo ASCII imprimible (0x20–0x7E),
  no vacío y hasta 10 posiciones; no aplica el alfabeto confirmado.
- **Contradicción / falta:** contradicción real entre dos materiales del banco (respuesta
  escrita vs ejemplo del DRPS). No se sabe si el concepto es texto libre o catálogo.
- **Cierre requerido:** aclaración bancaria. PC-12 no está aprobada ni aplicada; ninguna
  decisión interna puede resolver la contradicción sin evidencia del banco.

### 4.7 PAT-14 — encoding y fin de línea

- **Confirmado por el banco:** nada en la transcripción. La consulta 7 preguntó
  expresamente por encoding, CRLF/LF y salto final; la respuesta 7 solo trata nombre y
  encriptamiento.
- **Evidencia exacta:** respuesta 7; modelo: 606 bytes = 3 × 200 + 3 × CRLF, con CRLF
  final, ASCII y placeholders; el DRPS no fija encoding ni separador.
- **Implementado:** configuración explícita `lineSeparator` y `trailingSeparator`, sin
  defaults; los goldens sintéticos usan LF y sin salto final. No hay elección productiva.
- **Contradicción / falta:** no hay confirmación escrita; el CRLF/CRLF final es una
  observación del modelo, no una regla general. La ausencia en la transcripción no prueba
  que el banco no haya respondido.
- **Cierre requerido:** confirmación bancaria o prueba de ingesta. PAT-14 sigue contingente
  y requiere homologación.

### 4.8 PAT-17 — código de banco del R2 y fecha diferida

- **Confirmado por el banco:** el código es siempre `034` para la acreditación en banco
  corresponsal, porque los fondos se acreditan primero en la cuenta PS del empleado en
  Banco Patagonia; además, no puede usarse la misma fecha de presentación: corresponde
  “fecha diferida” con acreditación de al menos 24 horas hábiles posteriores.
- **Evidencia exacta:** respuesta 10, transcripta en el archivo de respuestas.
- **Implementado:** R0 fija `034`; R2 toma `PAT_CODIGO_BANCO`; la conciliación exige
  entidad `034` para Patagonia. No hay modelo de fecha diferida, calendario de feriados ni
  captura de fechas en la UI.
- **Contradicción / falta:** el DRPS define el campo 8 como “código del banco donde está
  radicada la cuenta” y no fija `034`; la respuesta escrita explica la razón operativa para
  corresponsal. Falta confirmar el alcance (¿el convenio es corresponsal?), modelar la
  fecha diferida y decidir la política de feriados.
- **Cierre requerido:** decisión interna explícita sobre PC-17 (no automática), modelo de
  fecha diferida y homologación bancaria. D-086 sigue congelada.

### 4.9 Otros puntos abiertos

- **PAT-11:** B.2 admisible; `C*` sujeto a aprobación humana.
- **Convenio real:** `2416` vs `2614`; ninguno se fija.
- **Altas A.2:** datos por empleado dependientes del alta bancaria.
- **Parámetros de envío:** fecha de presentación, fecha de acreditación, número de envío y
  concepto no se capturan en la UI; requieren una vía explícita.
- **PAT-9/P-14, PAT-15, PAT-16, P-20:** decisiones internas aprobadas, no confirmaciones
  del banco.

---

## 5. Bloqueos de homologación

Para pasar de “técnicamente implementado” a “homologado” falta, como mínimo:

1. **Convenio real de la empresa** configurado (resolver `2416`/`2614`).
2. **Altas A.2** y datos bancarios por empleado (P-04).
3. **Confirmaciones o aclaraciones del banco** sobre:
   - PAT-1: contenido (espacios) y tipo (`N` vs `A`) — la longitud 93 ya está confirmada;
   - PAT-3: enumeración de campos que deben coincidir con el alta (la semántica de colores
     ya está confirmada);
   - PAT-7: catálogo vigente del Anexo III para el convenio;
   - PAT-9: obligatoriedad, separador/espacio y truncamiento >20 (el alfabeto ya está
     confirmado);
   - PAT-12: catálogo vs texto libre y contradicción de `HAB.05/00` (el alfabeto ya está
     confirmado);
   - PAT-14: encoding, CRLF/LF y salto final;
   - PAT-17: alcance corresponsal y modalidad de fecha diferida (`034` ya está confirmado
     por escrito, pero no aplicado).
4. **Modelo de fecha diferida** ≥24 horas hábiles, con calendario de feriados y decisión
   de alcance para banco corresponsal.
5. **Mecanismo de autorización productiva no falsificable** y checkpoint propio (D-090).
6. **Envío controlado y evidencia de aceptación** del banco (D2/E); el envío es un acto
   humano.

Ninguno de estos bloqueos se resuelve con un cambio de `ContractStatus` ni con un golden
sintético.

---

## 6. Pruebas ejecutadas

Se ejecutó `npm run verify` sobre el árbol sin cambios de código:

| Etapa | Resultado |
|---|---|
| `typecheck` | OK |
| `lint` (`--max-warnings=0`) | OK |
| `format:check` | OK |
| `check:sensitive` | Sin hallazgos (333 archivos, incluido este informe) |
| Unitarias/integración | **127 archivos, 1719 tests OK** |
| Cobertura | 90,68 % statements · 86,24 % branches · 89,97 % functions · 91,26 % lines |
| `build` | OK |
| `check:dist` | OK |
| E2E Playwright | **28/28 OK** |

Cobertura específica relevante:

- **Geometría y bytes del campo 16:** `tests/unit/banks/patagonia-b2/spec.test.ts`,
  `tests/integration/goldenPatagonia.integracion.test.ts`,
  `tests/integration/goldenPatagoniaPat2.integracion.test.ts`.
- **Contrato y aptitud:** `tests/unit/banks/patagonia-b2/contrato.test.ts`,
  `aptitud.test.ts`, `autorizacion.test.ts`.
- **Mapper, totales, loteo, inspección:** `mapeo.test.ts`, `totales.test.ts`,
  `loteo.test.ts`, `inspeccion.test.ts`.
- **Cobertura, neto cero/excluidos y errores:** `tests/unit/run/generacionPatagoniaCobertura.test.ts`
  (neto ausente, neto cero, sin maestro, totales, readiness, tipo no confirmado).
- **F10-B / filas reasignadas:** `tests/unit/run/f10bCoberturaReasignados.test.ts`
  (incluye el caso Patagonia por `SourceRef`).
- **Sin habilitación productiva:** `tests/integration/generacionPatagoniaAutorizacion.integracion.test.ts`
  (estados de error, precedencia, PAT-8, propiedades extra que no abren la compuerta).
- **Descarga sintética:** `tests/e2e/descarga-sintetica.spec.ts` (BNA y Patagonia,
  `productivo: false`, `homologado: false`).

No se agregaron pruebas nuevas porque no hubo cambios de comportamiento que cubrir; las
pruebas existentes ya cubren los escenarios sintéticos pedidos.

---

## 7. ¿Se puede generar un TXT sintético completo?

**Sí, a nivel técnico y solo en memoria:**

- El compositor `src/run/composicionHomologacionSintetica.ts` arma un archivo Patagonia
  completo con R0, R1, R2, cantidades e importes coherentes.
- Los goldens producen 1004 bytes con 1 R0 + 2 R1 + 2 R2, LF y sin salto final, y el
  inspector recalcula cantidades e importes desde los bytes.
- La UI de descarga sintética permite bajar `ACREXXXX.TXT` con advertencia explícita;
  el resultado se marca `productivo: false` y `homologado: false`.
- El TXT sintético **no** es un archivo productivo, **no** usa el convenio real y **no**
  acredita aceptación del banco.

**Producción:** sigue **NO habilitada**. `produccionPatagoniaHabilitada()` es `false` por
construcción y la fachada devuelve `HOMOLOGACION_PATAGONIA_PENDIENTE` sin bytes. La
aplicación **no es apta para pagos reales** hasta completar los bloqueos de §5 y obtener
la autorización interna correspondiente.

---

## 8. Tabla final de pendientes reales

| Punto | Pendiente real | Evidencia disponible | Tipo de cierre | Responsable |
|---|---|---|---|---|
| PAT-1 | Confirmar contenido (espacios) y tipo (`N`/`A`) del campo 16 | Longitud 93 confirmada por escrito; DRPS y modelo muestran espacios; el DRPS declara `N` | Homologación / información bancaria | Banco |
| PAT-3 | Enumerar qué campos deben coincidir con el alta y corregir la nota “11, 12, 13 y 14” | Semántica de colores confirmada; el campo 14 es espacios y no puede coincidir | Información bancaria + control interno | Banco / RRHH |
| PAT-7 | Catálogo vigente de tipos de liquidación (Anexo III) y mapeo P-09 | El DRPS remite al Anexo III; el catálogo adoptado no tiene confirmación escrita | Información bancaria + decisión interna (mapeo) | Banco / Empresa |
| PAT-9 | Obligatoriedad, separador/espacio y truncamiento >20; revisar rechazo de dígitos | Alfabeto confirmado; DRPS verde vs modelo `a`; la respuesta no resuelve truncamiento | Información bancaria + homologación | Banco |
| PAT-10 | Convenio real; extensión/relleno del nombre; materializar en CP-F7-D2 | `.txt` y `ACREXXXX` confirmados; `2416` vs `2614`; no hay función productiva | Dato empresarial + definición operativa | Empresa / RRHH |
| PAT-12 | Catálogo vs texto libre y contradicción de `HAB.05/00` | Alfabeto confirmado; el ejemplo del DRPS usa `.` y `/`; PC-12 no aprobada | Información bancaria | Banco |
| PAT-14 | Encoding, CRLF/LF y salto final | Sin respuesta escrita en la transcripción; solo el modelo muestra CRLF/CRLF final | Información bancaria u homologación por ingesta | Banco |
| PAT-17 | Aplicar `034` en R2 (PC-17) y modelar fecha diferida ≥24 hs hábiles | `034` y fecha diferida confirmados por escrito; hoy R2 usa `PAT_CODIGO_BANCO`; sin calendario | Decisión interna + información/homologación | Empresa / Banco |
| Transversal | Convenio, altas A.2, autorización productiva y envío controlado | Sin cambios respecto de F7 | Datos + homologación + autorización | Empresa / Banco |

## 9. Recomendación de cierre de F11

**F11 puede cerrarse como verificación técnica y conciliación documental, no como
homologación.** El generador está implementado y probado; el campo 16 está verificado; no
quedan requisitos confirmados que puedan aplicarse sin una decisión humana o sin evidencia
bancaria adicional.

Recomendación:

1. Aceptar este informe como estado documental de F11 y cerrar la verificación técnica.
2. Abrir un checkpoint de homologación (F12/D2) con un paquete de consultas focalizado en
   PAT-1 (contenido/tipo), PAT-3 (enumeración), PAT-7 (catálogo), PAT-9
   (obligatoriedad/truncamiento/separador), PAT-12 (contradicción del concepto) y PAT-14
   (encoding/fin de línea). PAT-10 y PAT-17 dependen además de datos de la empresa.
3. Mantener PC-12 y PC-17 **sin aprobar** hasta tener respuesta bancaria y una decisión
   interna explícita.
4. No modificar código, contratos, layouts ni goldens hasta esas respuestas.
5. Conservar la compuerta `HOMOLOGACION_PATAGONIA_PENDIENTE` y la prohibición de generar
   archivos productivos.

**Criterio de cierre:** F11 queda cerrado cuando el usuario acepte este informe como estado
documental. La homologación bancaria, la autorización productiva y el envío quedan fuera de
F11 y requieren checkpoints propios.

---

## Conclusión F11

- Campo 16 del R2: **verificado y correcto** (93 posiciones, 93 espacios, EMPRESA en
  197–200, comprobado en spec, tests y goldens).
- Conciliación documental: PAT-1, PAT-3, PAT-7, PAT-9, PAT-10, PAT-12, PAT-14 y PAT-17
  revisados; se precisó qué está confirmado, qué proviene de adjuntos y qué falta.
- Requisitos confirmados: **ya implementados**; no quedó ninguno aplicable sin decisión
  humana o evidencia bancaria.
- Pruebas: `npm run verify` **OK** (1719 unitarias/integración, 28 E2E, cobertura y
  quality gates).
- Sin cambios de código, contratos, layouts, pruebas ni bloqueos; sin commit, sin push y
  sin habilitación productiva.
