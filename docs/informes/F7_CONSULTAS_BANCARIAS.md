# F7 · Consultas bancarias — paquete de CP-F7-A y evidencia CP-F7-C0

**Estado:** CP-F7-0 aprobado (auditoría humana); CP-F7-0-B aprobado
(auditoría humana); CP-F7-A ejecutado, **pendiente de auditoría humana**;
CP-F7-C0 ejecutado, **pendiente de auditoría humana**.
**Rama:** `f7-homologacion`.
**Base:** `main` en `d8be143ca3dc34fc9a0aa39246ba279204748b3b`.
**Fecha:** 27-10-2026 (paquete CP-F7-A); 30-10-2026 (registro CP-F7-C0).
**Alcance:** documental. Ninguna consulta fue enviada desde el repositorio.

## 1. Estado

- CP-F7-0: aprobado por auditoría humana.
- CP-F7-0-B: aprobado por auditoría humana.
- CP-F7-A: ejecutado; pendiente de auditoría humana.
- CP-F7-C0: ejecutado; pendiente de auditoría humana. Registra las respuestas
  escritas recibidas y la evidencia documental de Banco Patagonia, sin
  cambiar estados contractuales.
- BNA: **NO homologado**.
- Banco Patagonia: **NO homologado**.
- Aplicación: **NO apta para pagos reales**.
- Al cierre de CP-F7-A no se había recibido ninguna respuesta. Con
  posterioridad, fuera del repositorio, el usuario recibió respuestas
  escritas de Banco Patagonia y las aportó para CP-F7-C0. El banco **sí
  respondió**; lo que no existe es una exportación de correo con fecha,
  remitente, asunto o acuse verificables.
- CP-F7-C0 no modificó ningún estado `B`/`I`/`C`.
- Este documento contiene el paquete operativo de CP-F7-A y, desde §12, el
  registro de evidencia de CP-F7-C0. No es una homologación.

## 2. Reglas de uso

1.  **Documento preparatorio.** Las preguntas están listas para revisión
    humana y eventual envío. No fueron enviadas.
2.  **Ninguna pregunta equivale a una respuesta.** Una pregunta abierta no
    resuelve un `B` ni un `I`.
3.  **No modifica `ContractStatus`.** `docs/04_CONTRATOS_BANCARIOS.md` queda
    intacto. Ningún `B` pasa a `C`; ningún `I` pasa a `C`; ningún `B`/`I`
    cambia.
4.  **Toda respuesta futura necesita fecha, fuente y trazabilidad.** Debe
    registrarse quién respondió, por qué canal, con qué alcance, qué IDs
    afecta y qué evidencia la respalda.
5.  **STOP humano antes de cualquier contacto.** La aprobación de este
    paquete no autoriza a enviarlo. P-21 sigue abierta: responsable y canal
    real no están decididos.
6.  **La versión para el banco no contiene identificadores internos.** Los
    IDs `BNA-*`, `PAT-*`, `P-*`, `D-*`, nombres de archivos TypeScript,
    checkpoints y detalles de arquitectura aparecen solo en la matriz
    interna. El bloque bancario usa lenguaje funcional.
7.  **Sin datos reales.** No se incluyen CUIL, CBU, nombres, legajos,
    importes, nómina, TXT, números reales de convenio o de empresa. Si un
    ejemplo fuera imprescindible, debe ser sintético y claramente ficticio.
8.  **Sin Internet.** Este paquete se preparó exclusivamente con las fuentes
    locales de `docs/` y `references/`. No se usó la web para resolver
    contratos bancarios.
9.  **No se adelanta CP-F7-B ni CP-F7-C.** La incorporación de respuestas y
    cualquier cambio de regla pertenecen a esos checkpoints, con su propia
    auditoría.

## 3. Matriz maestra de trazabilidad

### 3.1 Cómo leer la matriz

La matriz cubre **41 ítems**: 26 contractuales abiertos (9 BNA + 17
Patagonia) y 15 preguntas `P` abiertas. Es una matriz interna: los IDs se
usan para trazabilidad y no se copian al texto dirigido al banco.

-   **Estado:** `B` = `BLOQUEADA`, `I` = `INTERPRETACION_PENDIENTE`.
-   **Bytes:** indica si la incertidumbre puede cambiar los bytes del archivo.
-   **Cat.:** taxonomía A–E de F7. Un ítem puede tener más de una categoría.
    `C contingente` no es `C confirmado`.
-   **¿Banco?:** `Sí` = pregunta bancaria directa; `Condicional` = solo si se
    confirma el supuesto; `No` = se resuelve internamente o por otra fuente;
    `Sí, dentro de ...` = subpregunta de una consulta agrupada.
-   **Bloquea:** `Gen` = generación productiva; `Prueba` = archivo
    materializable para prueba bancaria; `Homolog.` = cierre de homologación.
    Un `I` no bloquea por sí solo la generación, pero sí impide dar por
    resuelto el contrato y homologar.
-   **Evidencia esperada:** respuesta escrita, instructivo actualizado, tabla
    oficial, ejemplo oficial, confirmación de formato o, si el banco no puede
    confirmar documentalmente, indicación de que debe probarse por ingesta.

### 3.2 Resumen de cobertura

| Concepto | Cantidad | Detalle |
|---|---:|---|
| Ítems trazados | 41 | 26 contractuales abiertos + 15 `P` |
| Contractuales abiertos | 26 | BNA 9 + Patagonia 17 |
| BNA revisados | 11 | BNA-1 a BNA-11; BNA-3 y BNA-4 documentados/C, sin consulta |
| Patagonia revisados | 17 | PAT-1 a PAT-17 |
| `P` abiertas trazadas | 15 | P-03, P-04, P-05, P-08, P-09, P-10, P-14, P-17, P-18, P-20, P-21, P-22, P-23, P-28, P-30 |
| Ítems con dimensión bancaria | 28 | 26 contractuales + P-03 + P-30 |
| Consultas bancarias redactadas | 18 firmes + 1 condicional | BNA: 8 firmes + 1 condicional; Patagonia: 10 |
| Ítems agrupados | 8 grupos | Ver §3.5 |
| `P` excluidas del envío bancario | 13 | Todas las `P` salvo P-03 y P-30 |
| `C` contingente | 3 | BNA-9, PAT-10, PAT-14 |
| `C` confirmado | 0 | Sin respuestas bancarias |
| Documentados sin consulta | 2 | BNA-3 y BNA-4 |

### 3.3 Matriz — BNA

| ID | Dominio | Tema | Estado | Bytes | Cat. | Destinatario | ¿Banco? | Pregunta / acción | Evidencia esperada | Relacionados | Consecuencia | Bloquea | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BNA-1 | BNA / R2 campo 10 | Tipo de documento del beneficiario | BLOQUEADA | Sí | B | Banco Nación | Sí | Consulta BNA 1: confirmar el código exacto para un beneficiario identificado por CUIL y la clase de documento asociada; no elegir `96` ni `02` por inferencia | Respuesta escrita o instructivo actualizado; si no, ejemplo oficial | P-05 | Puede pasar `B` a `C`; define posiciones 72–74 y su validación; no homologa por sí sola | Gen: sí · Prueba: sí · Homolog.: sí | p. 9, 11 y 15; los ejemplos no son coherentes entre sí |
| BNA-2 | BNA / R2 campo 5 | Bloque 2 del CBU de la cuenta a acreditar | I | Sí | B | Banco Nación | Sí | Consulta BNA 2: confirmar que las posiciones 11–24 corresponden al CBU del beneficiario y no al de la empresa; aclarar el texto “CBU de la empresa” | Respuesta escrita o instructivo actualizado | P-05 | Define posiciones 11–24; evita copiar el CBU de la empresa; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 8 y 11; el ejemplo usa el CBU del beneficiario |
| BNA-5 | BNA / R1 campo 10 | Código de convenio: dígitos, representación de 10 posiciones y relleno | I | Sí | B + D | Banco Nación + Empresa | Sí | Consulta BNA 3: confirmar solo la regla general de representación en 10 posiciones para 4, 5, 6, 7 y 8 dígitos, dirección y carácter del relleno y validez del ejemplo; la cantidad real de dígitos es dato interno P-23 | Respuesta escrita, tabla o ejemplo oficial | P-23, P-05 | Define posiciones 64–73; hoy el mapper rechaza longitudes no definidas; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 4, 6, 7 y 15; el ejemplo documentado es `0044550000` |
| BNA-6 | BNA / R1 campo 3; R2 campos 2 y 3 | Entidad y sucursal derivadas del CBU | I | Sí | B | Banco Nación | Sí | Consulta BNA 4: precisar la derivación exacta de la sucursal de la empresa y de la entidad/sucursal del beneficiario; aclarar “0 + código BCRA” frente a la sucursal de 4 dígitos del CBU | Respuesta escrita, tabla o ejemplo oficial | P-05, P-18 | Define posiciones 13–16, 2–5 y 6–9; puede cambiar la derivación; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 5, 8 y 11; la sucursal del CBU ya tiene 4 dígitos |
| BNA-7 | BNA / R1 campo 6 | Fecha de compensación | I | Sí | B + E | Banco Nación | Sí | Consulta BNA 5: confirmar regla, formato, tratamiento de fines de semana y feriados, y quién determina el día hábil anterior | Respuesta escrita o instructivo; si se exige calendario, fuente oficial del calendario | P-05 | Define posiciones 32–39; requiere una regla de calendario; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 5, 7 y 14; el formato AAAAMMDD aparece solo en el ejemplo |
| BNA-8 | BNA / campos A | Alfabeto y mayúsculas | I | Sí | B | Banco Nación | Sí | Consulta BNA 6: confirmar el conjunto exacto de caracteres admitidos y qué debe enviar la empresa para minúsculas, acentos, `Ñ` y signos fuera de A–Z/0–9 | Respuesta escrita, tabla o ejemplo oficial | P-05 | Define la normalización y la validación; hoy no se transforma automáticamente; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 4 y 7; el ejemplo usa mayúsculas, pero no hay regla de transformación |
| BNA-9 | BNA / archivo físico | Separador de registros y salto final | I (C contingente) | Sí | B (C contingente) | Banco Nación | Sí | Consulta BNA 7: confirmar CRLF, LF u otro separador; si el registro 3 debe terminar con salto y si el separador se aplica después de cada registro | Respuesta escrita o instructivo; si no puede confirmarse documentalmente, prueba de ingesta | P-05 | Define los bytes de unión; se mantiene `C` contingente; no homologa por sí sola | Gen: no · Prueba: condicional · Homolog.: sí | p. 14; “Pulsar ENTER” implica salto final, pero no especifica el separador |
| BNA-10 | BNA / R2 CBU | Mismo CBU asociado a más de un beneficiario | I | No | A + B | Banco Nación | Condicional | Consulta BNA 9 (condicional): confirmar si el banco acepta dos registros individuales con el mismo CBU para beneficiarios distintos y si aplica alguna validación o rechazo | Respuesta escrita | BNA-2, D-015 | Puede afectar la validación, no los bytes; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: condicional | No es una pregunta de layout; incluirla solo si la empresa confirma que el caso puede ocurrir |
| BNA-11 | BNA / R1 campo 7; R2 campo 8 | Campos libres: información criterio empresa e identificación del beneficiario | I | Sí | B + D | Banco Nación + Empresa | Sí | Consulta BNA 8: confirmar si los dos campos pueden ir vacíos o solo con espacios, si son obligatorios, qué caracteres y longitud admiten y si hay contenido recomendado o exigido | Respuesta escrita o instructivo actualizado | P-17, P-05 | Define el contenido y la validación de posiciones 40–59 y 50–71; la composición interna sigue en P-17; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 6, 9 y 11; “Referencia unívoca” y “Datos de la empresa” están documentados como espacios si no se usan |

### 3.4 Matriz — Banco Patagonia

> **Nota CP-F7-C0.** Esta tabla conserva el estado del paquete CP-F7-A. La
> evidencia recibida después se registra en §12, con una matriz corregida.
> Los estados `B`/`I`/`C` de esta tabla **no cambian** en CP-F7-C0.

| ID | Dominio | Tema | Estado | Bytes | Cat. | Destinatario | ¿Banco? | Pregunta / acción | Evidencia esperada | Relacionados | Consecuencia | Bloquea | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PAT-1 | Patagonia / R2 campo 16 | Relleno final del detalle: 93 posiciones reales frente a 96 declaradas | BLOQUEADA | Sí | B | Banco Patagonia | Sí | Consulta Patagonia 1: confirmar longitud efectiva, contenido, tipo, alineación y relleno; si son 96, indicar qué posiciones ocupa y cómo se concilia con 197–200 | Respuesta escrita, instructivo actualizado o ejemplo oficial | P-03, PAT-11 | Define posiciones 104–196; sigue `B`; no homologa por sí sola | Gen: sí · Prueba: sí · Homolog.: sí | p. 9; las longitudes declaradas del registro suman 203 |
| PAT-2 | Patagonia / R2 campo 13 | Código de dependencia: tipo `N` frente a `A`, alineación y relleno | BLOQUEADA | Sí | B + D | Banco Patagonia + Empresa/RRHH | Sí | Consulta Patagonia 2: confirmar tipo, longitud, alineación, relleno, origen del valor y relación con el alta A.2 | Respuesta escrita, instructivo o respuesta de alta | P-03, P-04, PAT-3 | Define posiciones 85–99; sigue `B`; no homologa por sí sola | Gen: sí · Prueba: sí · Homolog.: sí | p. 3–6 y 9; `N` en B.2/A.3 y `A` en A.2/A.4/A.6 |
| PAT-3 | Patagonia / R2 alta | Campos que deben coincidir con el alta de la cuenta | I | No | B | Banco Patagonia | Sí | Consulta Patagonia 2: identificar por nombre y posición los campos que deben coincidir; el documento dice “11, 12, 13 y 14”, pero el 14 es “Espacios” | Respuesta escrita o instructivo actualizado | PAT-2, PAT-4, P-04 | Aclara la validación contra el alta; no cambia bytes por sí sola; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 9; probablemente sean del 10 al 13, pero no se elige por inferencia |
| PAT-4 | Patagonia / R2 campo 12 | Provincia cuando el tipo de documento no es `004` | I | Sí | B | Banco Patagonia | Sí | Consulta Patagonia 2: confirmar si va `00`, espacios u otro valor cuando no aplica; si se usan espacios en un campo `N`, cómo se representa | Respuesta escrita, tabla o instructivo | PAT-3, P-04 | Define posiciones 83–84; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 9 y 10; el Anexo II no define el caso “no aplica” |
| PAT-5 | Patagonia / R0 campo 6; R1 campo 8 | Número de envío | I | Sí | B | Banco Patagonia | Sí | Consulta Patagonia 3: confirmar rango válido, si `99` está prohibido, si `00` es válido, si aplica 1–70, si se reinicia por día y si R0 y R1 deben llevar el mismo valor | Respuesta escrita o instructivo actualizado | PAT-13, PAT-15 | Define posiciones 22–23 y 43–44; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 7–8; PAT-XL p. 5 dice 1 a 70 |
| PAT-6 | Patagonia / R0 campos 4 y 14 | Número de EMPRESA frente a “número de convenio” | I | Sí | B + D | Banco Patagonia + Empresa | Sí | Consulta Patagonia 4: confirmar si el número de EMPRESA de 4 dígitos es el mismo “número de convenio” de 1 a 8999 del aplicativo; si existen ambos, cuál se informa y con qué relleno | Respuesta escrita, instructivo o contrato | P-03, P-04, PAT-11 | Define posiciones 10–13 y 197–200; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 8; PAT-XL p. 4; no se asume equivalencia |
| PAT-7 | Patagonia / R2 campo 15 | Anexo III: catálogo de tipo de liquidación | I | Sí | B + D | Banco Patagonia + Empresa | Sí | Consulta Patagonia 5: confirmar qué catálogo aplica a B.2 y si `005`, `006` y `007` son válidos; el mapeo de las clasificaciones internas sigue siendo decisión de empresa | Respuesta escrita o tabla oficial | P-09, P-10, PAT-8 | Define posiciones 101–103; el mapeo interno no se pregunta al banco; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 10; PAT-XL p. 5 agrega `005` y omite `006`/`007` |
| PAT-8 | Patagonia / R2 campo 10 | Anexo I: validez de `004` y códigos de documento | I | Sí | B | Banco Patagonia | Sí | Consulta Patagonia 5: confirmar si `004` sigue admitido para B.2 aunque el aplicativo lo omita y qué código corresponde a un documento extranjero | Respuesta escrita o tabla oficial | PAT-7, P-04 | Define posiciones 63–65; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 9; PAT-XL p. 5 omite `004` |
| PAT-9 | Patagonia / R2 campo 7 | Apellido y Nombre: obligatoriedad, formato y truncado | I | Sí | B | Banco Patagonia | Sí | Consulta Patagonia 6: confirmar si el campo es obligatorio, si el banco exige un orden o separador, qué caracteres admite y si el truncado a 20 lo hace el banco o la empresa | Respuesta escrita o instructivo actualizado | P-14, PAT-3 | Define posiciones 35–54; la composición interna sigue en P-14; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 2 y 9; PAT-XL p. 5; D-021 fija la normalización de la app, no la aceptación bancaria |

| PAT-10 | Patagonia / archivo | Nombre del archivo | I (C contingente) | No | B (C contingente) | Banco Patagonia | Sí | Consulta Patagonia 7: confirmar el nombre exacto para B.2, el significado de `XXXX`, la extensión y si el banco valida el nombre; aclarar `ACREXXXX.TXT` frente al formato del aplicativo | Respuesta escrita o instructivo; si no puede confirmarse documentalmente, prueba de ingesta | P-03, PAT-14 | No cambia bytes; se mantiene `C` contingente; no homologa por sí sola | Gen: no · Prueba: condicional · Homolog.: sí | p. 8; PAT-XL p. 6 |
| PAT-11 | Patagonia / variante | Variante B.2 “detalle de acreditación con cuenta confirmada” | I | Sí | B + D | Banco Patagonia + Empresa | Sí | Consulta Patagonia 4: confirmar que el convenio real usa B.2, si existen otras variantes y qué campos cambian; no asumir B.2 solo porque esté implementado | Respuesta escrita o contrato | P-03, PAT-1, PAT-6 | Confirma la variante contratada; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 9; PAT-XL p. 5 |
| PAT-12 | Patagonia / R1 campo 4 | Caracteres admitidos en el concepto | I | Sí | B | Banco Patagonia | Sí | Consulta Patagonia 8: confirmar el conjunto exacto de caracteres para las 10 posiciones del concepto; el ejemplo usa `.` y `/`; aclarar espacios, acentos, `Ñ`, minúsculas y si es texto libre o catálogo | Respuesta escrita, tabla o ejemplo oficial | PAT-7 | Define posiciones 7–16; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 8; ejemplo `HAB.05/00` |
| PAT-13 | Patagonia / R1 y R0 | Loteo: división y numeración de lotes | I | Sí | A + B | Banco Patagonia + Empresa | Sí | Consulta Patagonia 9: confirmar el criterio esperado cuando hay más de un lote, la numeración, el máximo de 999 detalles y la relación con la cantidad de lotes del R0; la estrategia interna sigue en P-20 | Respuesta escrita o instructivo | P-20, PAT-5 | Define la estructura de lotes; P-20 es decisión interna; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 8; la regla de división no está definida |
| PAT-14 | Patagonia / archivo | Encoding y fin de línea | I (C contingente) | Sí | B (C contingente) | Banco Patagonia | Sí | Consulta Patagonia 7: confirmar encoding exacto, separador CRLF/LF/otro y si el último registro debe terminar con salto | Respuesta escrita o instructivo; si no puede confirmarse documentalmente, prueba de ingesta | PAT-10, BNA-9 | Define los bytes de unión; se mantiene `C` contingente; no homologa por sí sola | Gen: no · Prueba: condicional · Homolog.: sí | Sin fuente local que especifique encoding o fin de línea |
| PAT-15 | Patagonia / R1 campo 10 | Contenido de “Versión” en el registro 1 | I | Sí | B | Banco Patagonia | Sí | Consulta Patagonia 3: confirmar el valor exacto de las posiciones 189–196 del R1; si son espacios, ceros o una versión; si coincide con el R0 | Respuesta escrita, instructivo o ejemplo oficial | PAT-5, PAT-16 | Define posiciones 189–196; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 8–9; el R0 dice “En blanco” y el R1 no tiene observación |
| PAT-16 | Patagonia / R2 campo 6 | Número de comprobante no informado | I | Sí | B | Banco Patagonia | Sí | Consulta Patagonia 3: confirmar qué valor debe llevar el campo `N` de 7 posiciones cuando no se informa el comprobante; ¿ceros, espacios, otro valor o puede omitirse? | Respuesta escrita o instructivo | PAT-5, PAT-15 | Define posiciones 28–34; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 9; “se puede informar” el legajo u otro identificador |
| PAT-17 | Patagonia / R2 campo 8 | Código de banco del registro 2 | I | Sí | B + D | Banco Patagonia + Empresa | Sí | Consulta Patagonia 10: confirmar si el código debe ser siempre `034`, si puede ser el de otra entidad donde esté radicada la cuenta o si depende de la cuenta real; indicar validaciones si es otra entidad | Respuesta escrita o instructivo actualizado | P-30, PAT-6, D-086 | Puede cambiar la validación y la readiness; la regla actual `034` sigue congelada; no se toca código ni conciliación en CP-F7-A; no homologa por sí sola | Gen: no · Prueba: no · Homolog.: sí | p. 8–9; el `034` fijo documentado es el R0 campo 2 |

### 3.5 Matriz — preguntas `P` abiertas

| ID | Dominio | Tema | Estado | Bytes | Cat. | Destinatario | ¿Banco? | Pregunta / acción | Evidencia esperada | Relacionados | Consecuencia | Bloquea | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P-03 | Patagonia / convenio | ¿El convenio contratado usa B.2 “cuenta confirmada”? | Abierta | No | B + D | Banco Patagonia + Empresa | Sí, dentro de Patagonia 4 | Confirmar la variante contratada y su relación con PAT-1/PAT-11; no asumir B.2 por estar implementado | Respuesta escrita o contrato | PAT-1, PAT-11, PAT-6 | Puede confirmar la variante; no cambia bytes por sí sola; no homologa | No por sí sola; condiciona PAT-11 | Subpregunta de la consulta agrupada; no se envía como pregunta separada |
| P-04 | Patagonia / datos | Origen de cuenta, sucursal, banco, documento y dependencia por empleado; respuestas A.2 | Abierta | No | B + D | RRHH / Usuario | No | Obtener de RRHH y del banco las respuestas de alta A.2 y los datos por empleado; no es una pregunta de layout | Respuestas A.2 y datos de alta | PAT-2, PAT-3, PAT-4, PAT-8 | Habilita la carga del maestro; no define bytes por sí sola | Carga de maestro; no envío | Puede requerir contacto con el banco, pero la pregunta es interna |
| P-05 | BNA / agrupador | Conjunto de BNA-1, BNA-2, BNA-5, BNA-6, BNA-7, BNA-9 y BNA-11 | Abierta | No | B | Usuario / BNA | No | Se resuelve con las consultas BNA 1 a 8; no tiene pregunta propia | Las evidencias de esas consultas | BNA-1, BNA-2, BNA-5, BNA-6, BNA-7, BNA-9, BNA-11 | Es un agrupador; no añade una regla nueva | No por sí sola | No confundir con un ítem contractual independiente |
| P-08 | Operación / F8 | PCs, sistema operativo, navegador, permiso de instalación y respaldo del maestro | Abierta | No | A | Usuario | No | Definir la operación local y el respaldo; pertenece a F8 | Decisión interna | F8 | No afecta el contrato bancario | F8; no F7 | Exclusivamente interno |
| P-09 | Mapeo de clasificaciones | Código BNA (`0000`/`0003`) y código Patagonia (Anexo III) por clasificación | Abierta | No | B + D | Empresa / Bancos | No; catálogo vía Patagonia 5 | Definir el mapeo de Agrario, Comercio, Directivos y Liq. Final; la validez del catálogo se consulta en Patagonia 5; no pedir al banco que interprete Finnegans | Decisión interna y catálogo bancario | PAT-7, PAT-12, D-026 | Define el mapeo; no homologa por sí sola | Generación (mapeo); no envío | Separar decisión de empresa de catálogo bancario |
| P-10 | Datos / extracción | Regla de `periodo` y `tipoLiquidacionNormalizado` desde `Descripcion` | Abierta | No | A | Usuario | No | Analizar primero las variantes reales de forma segura; no implementar regex/heurísticas de producción hasta entonces | Análisis de datos y decisión | PAT-7, P-09 | Afecta el mapeo interno; no es pregunta bancaria | F2/F3; no envío | No se resuelve por inferencia |
| P-14 | Patagonia / nombre | Composición exacta del nombre Patagonia | Abierta | No | A | Usuario | No | Decidir la composición exacta; la aceptación bancaria se consulta en Patagonia 6, sin pedirle al banco que elija la composición | Decisión humana | PAT-9 | Define el contenido; no cambia bytes por sí sola; no homologa | Composición definitiva; no envío | Exclusivamente interno |
| P-17 | BNA / campos libres | Contenido de información criterio, referencia unívoca, identificación y datos de la empresa | Abierta | No | D | Usuario | No | Decidir si se usa CUIL, legajo, vacío u otro contenido; la aceptación de los dos campos abiertos se consulta en BNA 8 | Decisión interna | BNA-11 | Define el contenido; no es pregunta bancaria | Contenido; no envío | Separar de BNA-11 |
| P-18 | Fuentes oficiales | ARCA (CUIL) y BCRA (CBU) | Abierta | No | E | ARCA / BCRA | No | Incorporar las fuentes oficiales a `references/`; no usar URLs ni web en este checkpoint; resolver antes del cierre de homologación/F8 | Fuente oficial | BNA-2, BNA-6, D-024 | Aporta trazabilidad; no es pregunta bancaria | Cierre/F8; no envío | Fuera del paquete BNA/Patagonia |
| P-20 | Patagonia / loteo | Un lote por envío o por clasificación; numeración | Abierta | No | A + B | Empresa / Banco Patagonia | No; restricciones vía Patagonia 9 | Decidir la estrategia interna; las restricciones bancarias se consultan en Patagonia 9 | Decisión interna y respuesta bancaria | PAT-13 | Define la estrategia; no es pregunta bancaria por sí sola | Estrategia; no envío | Separar estrategia de restricción bancaria |
| P-21 | Contacto | Responsable y canal real de las consultas | Abierta | No | A | Usuario | No | Decidir responsable y canal efectivo; los canales documentados son evidencia, no la elección; bloquea el envío | Decisión humana | Todas las consultas | Habilita el envío; no resuelve contrato | Envío; no F7 documental | Exclusivamente interno |
| P-22 | Encriptación opcional | Afirmación sin fuente en `references/` | Abierta | No | A | Usuario | No | No reintroducir la encriptación opcional salvo que vuelva a ser relevante y exista fuente | Fuente, si corresponde | — | Sin impacto actual | No | Exclusivamente interno |
| P-23 | BNA / convenio | Cantidad real de dígitos del convenio | Abierta | No | D | Empresa | No; representación vía BNA 3 | Aportar internamente el código de convenio y su cantidad real de dígitos; la representación de 10 posiciones se consulta en BNA 3 | Dato de empresa | BNA-5 | Es un dato previo para posiciones 64–73 | Dato previo; no envío | No es pregunta bancaria |
| P-28 | Regla 18 | Semántica exacta de la comparación documento Patagonia ↔ CUIL | Abierta | No | B + E | Usuario / Banco Patagonia | No en este paquete | Definir la comparación con una especificación trazable; si la regla 18 se activa, podría requerir confirmación de Patagonia y fuente oficial; no inventar la semántica | Especificación o respuesta | PAT-3, PAT-9, D-047 | Regla diferida; no es un campo del layout B.2 | Regla 18; no envío actual | No se pregunta hoy |
| P-30 | Patagonia / R2 campo 8 | Confirmación de `034` o del banco donde está radicada la cuenta | Abierta | No | B + D | Banco Patagonia + Empresa | Sí, dentro de Patagonia 10 | Confirmar la regla del código de banco del R2; subpregunta de Patagonia 10; no descongelar `034` antes de la respuesta | Respuesta escrita | PAT-17, D-086 | Podría habilitar la revisión de la regla congelada; no se toca código ahora | Validación/readiness; no envío | Regla `034` congelada |

### 3.6 Cobertura nominal y agrupaciones

**BNA.** Se revisaron BNA-1 a BNA-11. BNA-1, BNA-2, BNA-5, BNA-6,
BNA-7, BNA-8, BNA-9, BNA-10 y BNA-11 están abiertos y trazados. BNA-3
(ejemplos inconsistentes) y BNA-4 (posiciones derivadas aprobadas) están
documentados/C y **no generan consulta**.

**Patagonia.** Se revisaron PAT-1 a PAT-17; los 17 están trazados.

**P.** Se revisaron 15 preguntas abiertas. P-03 y P-30 se incorporan como
subpreguntas de consultas agrupadas. Las otras 13 no se envían como
pregunta bancaria: se resuelven interna o externamente, o son datos previos.

**Agrupaciones (8):**

1.  BNA-5 + P-23 → Consulta BNA 3.
2.  BNA-11 + P-17 → Consulta BNA 8.
3.  PAT-2 + PAT-3 + PAT-4 → Consulta Patagonia 2.
4.  PAT-5 + PAT-15 + PAT-16 → Consulta Patagonia 3.
5.  PAT-6 + PAT-11 + P-03 → Consulta Patagonia 4.
6.  PAT-7 + PAT-8 → Consulta Patagonia 5.
7.  PAT-10 + PAT-14 → Consulta Patagonia 7.
8.  PAT-17 + P-30 → Consulta Patagonia 10.

El roll-up de categorías se mantiene respecto de CP-F7-0: **A = 8, B = 33,
C confirmado = 0, C contingente = 3 (BNA-9, PAT-10, PAT-14), D = 13, E = 3**.
La diferencia con un conteo simple de filas se explica por ítems con más de
una categoría.

## 4. Paquete BNA

### 4.1 Nota de alcance

Las consultas siguientes están redactadas para una persona del banco que no
conoce el sistema. No incluyen identificadores internos, nombres de archivos
del sistema ni datos reales. Se basan en el instructivo de Pagos GT Haberes
recibido. Cada consulta indica lo que dice la documentación, el punto que
necesita confirmación y la respuesta que sería útil.

### 4.2 Consulta BNA 1 — Tipo de documento del beneficiario

**Lo que dice la documentación.** El instructivo indica `96` para DNI en un
ejemplo; en otro, `02` con clave fiscal; y en otro, `96` con CUIL. También
menciona que otros códigos remiten a un documento no disponible.

**Punto a confirmar.** Para un beneficiario identificado con CUIL de 11
dígitos, ¿qué valor exacto debe informarse en el campo “Tipo documento
beneficiario” (posiciones 73–74)? ¿`96`, `02` u otro? Si es otro, indicar el
código y la condición de uso. ¿Qué valor corresponde a “Clase de documento”
(posición 72) en cada caso?

**Respuesta esperada.** Confirmación escrita del código y de la clase; si
existe, tabla o ejemplo oficial.

### 4.3 Consulta BNA 2 — CBU del beneficiario

**Lo que dice la documentación.** El texto del campo “Bloque 2 CBU cuenta a
acreditar” (posiciones 11–24) dice “CBU de la empresa”; el ejemplo usa el CBU
del beneficiario.

**Punto a confirmar.** ¿El bloque 2 debe corresponder al CBU del beneficiario
o al de la empresa? Si el beneficiario tiene cuenta en otra entidad, ¿se
informa igual el CBU del beneficiario? ¿Qué validaciones aplican?

**Respuesta esperada.** Confirmación escrita o instructivo actualizado.

### 4.4 Consulta BNA 3 — Código de convenio

**Lo que dice la documentación.** El instructivo indica “2 ceros + 8 números;
si sólo tienen 4, completar con 4 ceros más” y muestra un ejemplo de 4 dígitos
convertido en `0044550000`. La regla general de campos `N` es ceros a la
izquierda; el ejemplo muestra relleno a la derecha. No se definen 5, 6 ni 7
dígitos.

**Dato interno (no se pregunta al banco).** La empresa debe aportar
internamente cuál es su código de convenio y cuántos dígitos reales tiene. Ese
dato no se incluye en este documento ni forma parte de la consulta bancaria.

**Punto a confirmar (regla general).** Sin necesidad de conocer el convenio
real de la empresa: (a) ¿Cómo se representa en el campo de 10 posiciones un
código de convenio según su cantidad de dígitos? (b) ¿Cómo se representan
códigos de 4, 5, 6, 7 y 8 dígitos? (c) ¿Cuál es la dirección exacta del
relleno? (d) ¿Cuál es el carácter de relleno? (e) ¿El ejemplo `0044550000` es
literal? (f) Para un código de 8 dígitos, ¿se anteponen dos ceros?

**Respuesta esperada.** Confirmación escrita, tabla o ejemplo oficial.

### 4.5 Consulta BNA 4 — Entidad y sucursal derivadas del CBU

**Lo que dice la documentación.** El campo “Sucursal de la cuenta de la
empresa” (registro 1, posiciones 13–16) dice “0 + código BCRA” y en el ejemplo
coincide con los dígitos 4–7 del CBU. El campo “Entidad a acreditar” (registro
2, posiciones 2–5) dice “0 + código BCRA” y el ejemplo usa 0 + dígitos 1–3 del
CBU. El campo “Sucursal a acreditar” (registro 2, posiciones 6–9) también dice
“0 + código BCRA”, pero la sucursal del CBU ya tiene 4 dígitos.

**Punto a confirmar.** ¿Cuál es la derivación exacta de cada campo? ¿Se toma
el código BCRA de 3 dígitos y se antepone 0, o se usan los 4 dígitos de la
sucursal del CBU? ¿Qué se informa si el CBU corresponde a otra entidad? ¿La
sucursal de la empresa y la del beneficiario se derivan igual?

**Respuesta esperada.** Confirmación escrita, tabla o ejemplo oficial.

### 4.6 Consulta BNA 5 — Fecha de compensación

**Lo que dice la documentación.** El instructivo indica “día hábil anterior”
a la acreditación; el formato AAAAMMDD aparece solo en el ejemplo. No hay
calendario de feriados en la documentación recibida.

**Punto a confirmar.** ¿La fecha debe ser el día hábil anterior a la
acreditación? ¿Qué formato exacto debe usarse? ¿Cómo se tratan fines de semana
y feriados? ¿El banco calcula el día hábil anterior o la empresa debe
informarlo? Si la empresa debe informarlo, ¿qué calendario se usa?

**Respuesta esperada.** Confirmación escrita o instructivo actualizado; si se
exige un calendario, la fuente oficial correspondiente.

### 4.7 Consulta BNA 6 — Alfabeto y mayúsculas

**Lo que dice la documentación.** El tipo `A` admite letras A–Z y dígitos 0–9,
alineado a la izquierda y con espacios a la derecha. El ejemplo usa mayúsculas.
No hay regla para `Ñ`, vocales acentuadas ni minúsculas.

**Punto a confirmar.** ¿Qué caracteres admite exactamente un campo `A`? ¿Solo
A–Z, 0–9 y espacio? ¿Se aceptan minúsculas? ¿Se aceptan `Ñ`, vocales
acentuadas u otros signos? Si no se aceptan, ¿el banco rechaza el archivo o
transforma el texto? ¿Qué debe enviar la empresa?

**Respuesta esperada.** Confirmación escrita, tabla o ejemplo oficial.

### 4.8 Consulta BNA 7 — Separador de registros y salto final

**Lo que dice la documentación.** El instructivo dice “Pulsar ENTER” tras el
registro 3, lo que implica un salto final; no especifica si el separador es
CRLF, LF u otro.

**Punto a confirmar.** ¿Qué separador debe usarse entre registros: CRLF, LF u
otro? ¿El último registro (tipo 3) debe terminar con salto de línea? ¿El
separador se aplica después de cada registro, incluido el último? ¿El archivo
debe ser texto plano?

**Respuesta esperada.** Confirmación escrita o instructivo actualizado; si no
puede confirmarse documentalmente, indicación de que debe probarse por
ingesta.

### 4.9 Consulta BNA 8 — Campos libres

**Lo que dice la documentación.** “Información criterio empresa” (registro 1,
posiciones 40–59) e “Identificación cliente beneficiario” (registro 2,
posiciones 50–71) son campos libres; no se dice si pueden ir vacíos.
“Referencia unívoca” (registro 2, posiciones 35–49) y “Datos de la empresa”
(registro 2, posiciones 88–100) están documentados como espacios si no se usan.

**Punto a confirmar.** Para los dos primeros campos: ¿pueden ir vacíos o solo
con espacios? ¿Son obligatorios? ¿Qué caracteres y longitud admiten? ¿Hay
contenido recomendado o exigido? Para los otros dos: ¿se confirma que espacios
es correcto cuando no se usan?

**Respuesta esperada.** Confirmación escrita o instructivo actualizado.

### 4.10 Consulta BNA 9 (condicional) — Mismo CBU en dos beneficiarios

**Lo que dice la documentación.** El instructivo no trata el caso de dos
beneficiarios distintos con el mismo CBU.

**Punto a confirmar.** Si dos beneficiarios distintos tienen el mismo CBU,
¿el banco acepta dos registros individuales con el mismo CBU? ¿Aplica alguna
validación o rechazo? ¿Debe informarse alguna referencia adicional?

**Respuesta esperada.** Confirmación escrita. Esta consulta solo se incluye si
la empresa confirma que el caso puede ocurrir.

### 4.11 Cierre del paquete BNA

Las consultas BNA 1 a 8 son firmes. La consulta BNA 9 es condicional. La
trazabilidad de cada una está en la matriz maestra (§3.3). No se incluyen
identificadores internos en el texto dirigido al banco.

## 5. Paquete Banco Patagonia

### 5.1 Nota de alcance

Las consultas siguientes están redactadas para una persona del banco que no
conoce el sistema. No incluyen identificadores internos, nombres de archivos
del sistema ni datos reales. Se basan en el diseño de registros B.2 y en el
instructivo del aplicativo de acreditaciones. Cada consulta indica lo que dice
la documentación, el punto que necesita confirmación y la respuesta que sería
útil.

### 5.2 Consulta Patagonia 1 — R2, posiciones 104–196

**Lo que dice la documentación.** El diseño B.2 declara el campo 16 como
“Espacios”, tipo `N`, con una longitud de 96; las posiciones 104–196 suman 93.
Las longitudes declaradas del registro suman 203.

**Punto a confirmar.** ¿Cuál es la longitud efectiva del campo? ¿93, 96 u otra?
¿El contenido debe ser espacios o ceros? ¿El tipo es `N` o `A`? ¿Cómo se
alinea y se rellena? Si son 96 posiciones, ¿qué posiciones ocupa y cómo se
concilia con el número de EMPRESA en 197–200? ¿Se confirma que 197–200 es el
número de EMPRESA?

**Respuesta esperada.** Confirmación escrita, instructivo actualizado o
ejemplo oficial.

### 5.3 Consulta Patagonia 2 — Alta de cuenta: dependencia, campos coincidentes y provincia

**Lo que dice la documentación.** El campo “Código de dependencia” (registro 2,
posiciones 85–99) aparece como `N` en B.2 y en el Anexo A.3, y como `A` en
A.2, A.4 y A.6. El diseño dice que los campos 11, 12, 13 y 14 deben coincidir
con el alta, pero el campo 14 es “Espacios” (posición 100). Para “Provincia del
documento” (posiciones 83–84) solo se indica que se informa con tipo `004`; no
se dice qué va cuando no aplica.

**Punto a confirmar.** (a) ¿Cuál es el tipo, la longitud, la alineación, el
relleno y el origen del código de dependencia? ¿Debe coincidir con el alta?
(b) ¿Qué campos exactos deben coincidir con el alta: los que van del 10 al 13,
los que van del 11 al 14 u otros? ¿Se incluye el campo de espacios? (c) Cuando
el tipo de documento no es `004`, ¿qué valor exacto debe llevar la provincia:
`00`, espacios u otro? Si se usan espacios en un campo `N`, ¿cómo se
representan?

**Respuesta esperada.** Confirmación escrita, instructivo actualizado o
respuesta de alta.

### 5.4 Consulta Patagonia 3 — Contenido de campos numéricos: número de envío, versión y comprobante

**Lo que dice la documentación.** El número de envío (registro 0, posiciones
22–23; registro 1, posiciones 43–44) debe ser distinto de `99`; el aplicativo
menciona un rango de 1 a 70. La “Versión” del registro 1 (posiciones 189–196)
no tiene observación de contenido; el registro 0 dice “En blanco”. El número
de comprobante (registro 2, posiciones 28–34) “se puede informar” con el
legajo u otro identificador.

**Punto a confirmar.** (a) ¿Qué rango es válido para el número de envío? ¿`99`
está prohibido? ¿`00` es válido? ¿Se reinicia por día? ¿El registro 0 y el
registro 1 deben llevar el mismo valor? (b) ¿Qué valor exacto debe llevar la
“Versión” del registro 1: espacios, ceros, una versión concreta? ¿Coincide con
el registro 0? (c) Si no se informa el comprobante, ¿qué valor debe llevar el
campo `N` de 7 posiciones: ceros, espacios, otro valor, o puede omitirse?

**Respuesta esperada.** Confirmación escrita, instructivo actualizado o
ejemplo oficial.

### 5.5 Consulta Patagonia 4 — Número de EMPRESA, convenio y variante B.2

**Lo que dice la documentación.** El registro 0 informa el “Número de EMPRESA”
en las posiciones 10–13 y 197–200, otorgado por el banco. El aplicativo
menciona un “número de convenio” de 1 a 8999. El diseño B.2 se titula “detalle
de acreditación con cuenta confirmada”; el aplicativo solo pide documento.

**Punto a confirmar.** (a) ¿El número de EMPRESA de 4 dígitos es el mismo
“número de convenio” del aplicativo? Si la empresa tiene ambos números, ¿cuál
se informa en el archivo? ¿Cómo se rellena? (b) ¿El convenio de la empresa usa
la variante B.2 “cuenta confirmada”? ¿Existen otras variantes? ¿Qué campos
cambian? ¿El aplicativo que solo pide documento es compatible con B.2?

**Respuesta esperada.** Confirmación escrita, instructivo o contrato.

### 5.6 Consulta Patagonia 5 — Catálogos Anexo I y Anexo III

**Lo que dice la documentación.** El Anexo I del diseño incluye `001`, `002`,
`003`, `004` y `006`; el aplicativo lista `001`, `002`, `003` y `006`, y omite
`004`. El Anexo III del diseño incluye `001`, `002`, `003`, `004`, `006`, `007`
y `009`; el aplicativo agrega `005` y omite `006` y `007`.

**Punto a confirmar.** (a) ¿Qué catálogo del Anexo I aplica a B.2? ¿`004` sigue
admitido aunque el aplicativo lo omita? ¿Qué código corresponde a un documento
extranjero? (b) ¿Qué catálogo del Anexo III aplica a B.2? ¿`005`, `006` y `007`
son válidos? ¿Qué código corresponde a cada concepto de liquidación?

**Respuesta esperada.** Confirmación escrita, tabla oficial o instructivo
actualizado.

### 5.7 Consulta Patagonia 6 — Apellido y Nombre

**Lo que dice la documentación.** El campo “Apellido y Nombre” (registro 2,
posiciones 35–54) tiene 20 posiciones y tipo `A`. La regla general del diseño
dice que todos los campos son obligatorios salvo indicación “NO OBLIGATORIO”;
el aplicativo sugiere que el nombre podría ser opcional. No se define el orden,
el separador ni el truncado.

**Punto a confirmar.** ¿El campo es obligatorio para B.2? ¿El banco exige un
orden o un separador específico? ¿Qué caracteres admite: letras, espacios,
guiones, apóstrofes, `Ñ`, vocales acentuadas, minúsculas? ¿Qué ocurre si el
nombre supera las 20 posiciones: el banco lo trunca, lo rechaza o la empresa
debe truncarlo? Si la empresa debe truncarlo, ¿qué criterio espera el banco?

**Respuesta esperada.** Confirmación escrita o instructivo actualizado.

### 5.8 Consulta Patagonia 7 — Archivo físico: nombre, encoding y fin de línea

**Lo que dice la documentación.** El diseño menciona el nombre
`ACREXXXX.TXT`; el aplicativo menciona un formato con fecha y hora. No se
especifican el encoding ni el fin de línea.

**Punto a confirmar.** (a) ¿Cuál es el nombre exacto del archivo para B.2?
¿Qué significa `XXXX`? ¿La extensión debe ser `.TXT` en mayúsculas? ¿El banco
valida el nombre? ¿Qué nombre se usa si hay más de un archivo el mismo día?
(b) ¿Qué encoding exacto debe usarse: ASCII, Windows-1252, ISO-8859-1 u otro?
(c) ¿El separador de líneas debe ser CRLF, LF u otro? ¿El último registro debe
terminar con salto de línea?

**Respuesta esperada.** Confirmación escrita o instructivo actualizado; si no
puede confirmarse documentalmente, indicación de que debe probarse por
ingesta.

### 5.9 Consulta Patagonia 8 — Caracteres del concepto

**Lo que dice la documentación.** El campo “Concepto” (registro 1, posiciones
7–16) tiene 10 posiciones y tipo `A`; el ejemplo `HAB.05/00` usa `.` y `/`.

**Punto a confirmar.** ¿Cuál es el conjunto exacto de caracteres admitidos?
¿Se permiten `.`, `/`, espacios, guiones, `Ñ`, vocales acentuadas y minúsculas?
¿El campo es texto libre o debe corresponder a un catálogo? ¿Cómo se alinea y
se rellena?

**Respuesta esperada.** Confirmación escrita, tabla o ejemplo oficial.

### 5.10 Consulta Patagonia 9 — Loteo

**Lo que dice la documentación.** El registro 1 tiene un número de lote y una
cantidad de detalles; el máximo es 999 detalles por lote. No se define la
regla de división cuando hay más de un lote.

**Punto a confirmar.** Cuando hay más de un lote, ¿qué criterio espera el
banco: división por cantidad de detalles, por tipo de liquidación u otro? ¿Cómo
se numeran los lotes? ¿El número de lote puede repetirse en distintos envíos?
¿Se permite más de un lote por archivo? ¿Cómo se relaciona la cantidad de
lotes del registro 0 con los lotes del archivo?

**Respuesta esperada.** Confirmación escrita o instructivo actualizado.

### 5.11 Consulta Patagonia 10 — Código de banco del registro 2

**Lo que dice la documentación.** El registro 0 tiene `034` fijo en el campo
2. El registro 2, campo 8 (posiciones 55–57), dice “Código del banco donde está
radicada la cuenta de acreditación” y no fija `034`.

**Punto a confirmar.** Para el convenio de la empresa, ¿el código de banco del
registro 2 debe ser siempre `034`? ¿Puede ser el código de otra entidad donde
esté radicada la cuenta? ¿Depende de la cuenta real de cada beneficiario? Si
puede ser otra entidad, ¿qué validaciones o restricciones aplican?

**Respuesta esperada.** Confirmación escrita o instructivo actualizado.

### 5.12 Cierre del paquete Patagonia

Las consultas Patagonia 1 a 10 son firmes. La trazabilidad de cada una está
en la matriz maestra (§3.4). No se incluyen identificadores internos en el
texto dirigido al banco.

## 6. Decisiones y datos internos que NO deben preguntarse al banco

Las siguientes preguntas no forman parte del envío bancario. Se resuelven
internamente, con datos de la empresa, con RRHH o con una fuente oficial.

| ID | Por qué no va al banco | Quién lo resuelve |
|---|---|---|
| P-08 | Operación local y respaldo; pertenece a F8 | Usuario |
| P-10 | Regla interna de extracción desde `Descripcion`; requiere análisis de datos y decisión de producto | Usuario |
| P-14 | Composición exacta del nombre Patagonia; es una decisión humana, separada de la aceptación bancaria | Usuario |
| P-17 | Contenido de los campos libres BNA; la aceptación de los dos campos abiertos se consulta en BNA 8, pero la elección CUIL/legajo/vacío es interna | Usuario |
| P-20 | Estrategia interna de loteo; las restricciones bancarias se consultan en Patagonia 9 | Empresa |
| P-23 | Cantidad real de dígitos del convenio; es un dato de la empresa; la representación se consulta en BNA 3 | Empresa |
| P-05 | Agrupador de varios ítems BNA; no tiene pregunta propia | Usuario / BNA |
| P-09 | Mapeo de las clasificaciones internas; la validez del catálogo se consulta en Patagonia 5 | Empresa / Bancos |
| P-04 | Origen de cuenta, sucursal, banco, documento y dependencia por empleado; respuestas A.2 y datos de RRHH | RRHH / Usuario |
| P-28 | Semántica de la regla 18 documento ↔ CUIL; requiere especificación y decisión posterior; no es un campo del layout B.2 | Usuario / Banco Patagonia, si se activa |
| P-18 | Fuentes oficiales ARCA/BCRA; no es un banco pagador | ARCA / BCRA |
| P-21 | Responsable y canal real de contacto; decisión humana | Usuario |
| P-22 | Encriptación opcional sin fuente; no se reintroduce | Usuario |

### 6.1 P-21 y canales

Los documentos mencionan dos canales de prueba:

-   BNA: casilla `SERVICIOSDEPAGO`.
-   Patagonia: `BPSUELDO@bancopatagonia.com.ar`.

Eso es **evidencia documental de un canal**, no la elección del canal ni del
responsable. P-21 sigue abierta. Mientras siga abierta:

-   no se declara “este es el canal elegido”;
-   no se envía nada;
-   no se registra un canal real;
-   no se inicia una prueba bancaria externa.

## 7. Fuentes externas no bancarias

P-18 queda fuera del paquete BNA/Patagonia y no se resuelve en CP-F7-A.

-   **ARCA** es la fuente oficial pendiente para CUIL.
-   **BCRA** es la fuente oficial pendiente para CBU.
-   No se agregan URLs ni referencias nuevas.
-   No se usa la web en este checkpoint.
-   Debe resolverse antes del cierre de la homologación o del paso a
    producción, según el contrato vigente.
-   No se reemplaza por conocimiento general ni por los PDF bancarios.

## 8. Datos y evidencia que deben acompañar una futura consulta

### 8.1 Datos que no deben incluirse

No se incluyen en el paquete ni en el repositorio:

-   CUIL reales;
-   CBU reales;
-   nombres reales;
-   legajos reales;
-   importes reales;
-   nómina;
-   TXT real;
-   número real de convenio;
-   número real de empresa.

Si una pregunta necesita un ejemplo, se usa un valor sintético y claramente
ficticio. Se prefiere preguntar sin ejemplos de datos personales.

### 8.2 Datos de empresa necesarios localmente

Para una eventual prueba o materialización, y sin incluirlos en este
documento, la empresa deberá tener disponibles:

-   BNA: número de convenio y cantidad real de dígitos, CBU de la empresa y
    moneda.
-   Patagonia: número de empresa, modalidad B.2 contratada y respuestas de
    alta A.2.
-   Datos por empleado: cuenta, sucursal, banco, documento y dependencia,
    según corresponda.

Estos datos no se convierten automáticamente en fixture, golden ni
documentación pública.

### 8.3 Evidencia de una respuesta

Toda respuesta futura debe registrarse con:

-   fecha;
-   banco y persona o área que respondió;
-   canal utilizado;
-   texto o archivo de la respuesta;
-   alcance: qué preguntas cubre y cuáles no;
-   IDs internos afectados;
-   decisión propuesta y revisión humana;
-   si hubo un archivo, SHA-256 y metadatos no sensibles.

Una respuesta escrita o un instructivo actualizado puede resolver el contrato
sin probar un archivo. La aceptación bancaria de un archivo es otra evidencia
y pertenece a la homologación.

## 9. Checklist previo al envío

1.  **Auditoría humana de CP-F7-A aprobada.** Sin esa aprobación no se
    envía nada.
2.  **P-21 resuelta.** Responsable y canal real definidos. Distinguir el canal
    documentado por el instructivo del canal que la empresa usará.
3.  **Paquete revisado contra datos sensibles.** Sin CUIL, CBU, nombres,
    legajos, importes, nómina, TXT ni números reales de convenio o empresa.
4.  **Datos de empresa disponibles localmente.** BNA: convenio, dígitos, CBU y
    moneda. Patagonia: número de empresa, modalidad B.2 y altas A.2.
5.  **P-04 / A.2 revisada.** Saber si existen las respuestas de alta y quién
    provee los datos por empleado.
6.  **P-14 decidida para la futura prueba.** La composición del nombre no se
    pregunta al banco; la aceptación se consulta en Patagonia 6.
7.  **P-18 registrada aparte.** ARCA/BCRA no forman parte de este envío, pero
    deben resolverse antes del cierre/F8.
8.  **BNA-10 decidida.** Incluir la consulta condicional solo si la empresa
    confirma que puede existir el mismo CBU para dos beneficiarios.
9.  **C contingente preservado.** BNA-9, PAT-10 y PAT-14 siguen como `C`
    contingente. No se convierten a `C` confirmado por redactar la pregunta.
10. **Registro del envío.** Guardar fecha, canal, destinatario, versión del
    paquete y respuestas. No enviar automáticamente.
11. **Post-respuesta.** Incorporar las respuestas en CP-F7-B/CP-F7-C, con
    auditoría. No modificar `docs/04` en CP-F7-A.

## 10. Estado contractual y límites

-   `docs/04_CONTRATOS_BANCARIOS.md` queda **intacto**.
-   Cero cambios en los estados `B`/`I`/`C`.
-   BNA sigue **NO homologado**.
-   Banco Patagonia sigue **NO homologado**.
-   BNA-1 sigue **BLOQUEADA**.
-   PAT-1 y PAT-2 siguen **BLOQUEADA**.
-   PAT-17 y la regla `034` siguen **congelados** por D-086; no se toca
    `src/reconciliation/**` ni se descongela la regla.
-   P-14 sigue **abierta**.
-   P-21 sigue **abierta**.
-   F8 no se inicia.
-   La aplicación sigue **NO apta para pagos reales**.
-   BNA-9, PAT-10 y PAT-14 siguen como `C` contingente; solo pasarían a
    requerir prueba de ingesta si el banco responde que no puede confirmar
    documentalmente el comportamiento.
-   **CP-F7-C0 (30-10-2026):** la evidencia recibida se registra en §12. Los
    estados contractuales de esta sección no cambian; PAT-10 queda con
    evidencia escrita suficiente para proponer `C`, y PAT-14 sigue como `C`
    contingente porque la respuesta no abordó encoding ni fin de línea.

## 11. Fuentes locales consultadas

-   `docs/04_CONTRATOS_BANCARIOS.md`
-   `docs/05_PLAN_DE_TRABAJO.md`
-   `docs/07_DECISIONES_Y_PENDIENTES.md`
-   `docs/informes/F5_BANCO_NACION.md`
-   `docs/informes/F6_BANCO_PATAGONIA.md`
-   `docs/informes/F7_HOMOLOGACION.md`
-   `references/BNA_Instructivo_Pago_Haberes_GT.pdf`
-   `references/Patagonia_Diseno_Registros_Plan_Sueldos.pdf`
-   `references/Patagonia_Instructivo_Excel_Acreditaciones.pdf`
-   `references/Respuestas_Banco_Patagonia.txt` (CP-F7-C0)
-   `references/DRPS (1).docx` (CP-F7-C0)
-   `references/Modelo_ACRE2614 (1).txt` (CP-F7-C0)
-   `references/Instrucciones_OpenCode_CP-F7-C0.txt` (CP-F7-C0)

No se usó Internet. No se agregaron referencias nuevas fuera de `references/`.
No se modificó `references/**`.

## 12. CP-F7-C0 — Evidencia recibida y matriz corregida

### 12.1 Procedencia y registro

| Artefacto | Qué es | Ubicación local | SHA-256 | Sensibilidad | ¿Versionado? |
|---|---|---|---|---|---|
| `Respuestas_Banco_Patagonia.txt` | Transcripción del texto de consultas y respuestas compartido por el usuario. **No es una exportación del correo original** | `references/` | `b8d1c198d60b7cfdb6abcbe90cac3441c2999d7cd4d873226f51998b1b218852` | Sin datos de empleados; incluye el número de convenio | No: `references/*` y `*.txt` están en `.gitignore` |
| `DRPS (1).docx` | Diseño B.2 corregido por el banco. Tres imágenes (R0, R1, R2), sin capa de texto | `references/` | `0625ac4e03b35daeb6930aade391a68005d32480dbeecde85f0ac597d13d778d` | Metadatos de autora en `docProps/core.xml`; no se versiona | No |
| `Modelo_ACRE2614 (1).txt` | Modelo oficial de 606 bytes: 3 registros de 200 caracteres, ASCII, CRLF y CRLF final | `references/` | `d17ce90e4a047ec9beb87b756e9ba79af3a446bab09ac40e6dc982b3d5da64e8` | Sin PII; usa placeholders `N`/`A`/`n`/`a` | No |
| `Instrucciones_OpenCode_CP-F7-C0.txt` | Instrucción de alcance del checkpoint | `references/` | `dc880eb4e3fcfa711b1ae943fc0b6fe3e7f800f4d054210efce82837cb20ff66` | Sin datos sensibles | No |

**Procedencia declarada.** El usuario informa que los tres documentos provienen
de Banco Patagonia. La transcripción declara expresamente: “esta transcripción
NO es una exportación del correo original. Fecha, remitente, asunto y acuse:
no informados en el texto compartido”. Por lo tanto:

- se registra que **el banco respondió** y que el texto es la fuente primaria;
- **no** se afirma una fecha de respuesta, un remitente, un asunto ni un acuse;
- no se copian los originales al repositorio;
- el hash identifica la copia local examinada, no autentica al emisor.

### 12.2 Reglas de lectura aplicadas

1. La respuesta escrita se cita por su texto literal. Cuando el banco remite a
   “DRPS y modelo txt”, se distingue entre **respuesta escrita** y
   **observación documental**.
2. Una respuesta parcial no se completa por inferencia. Se marca como
   `parcial` y se conserva la pregunta abierta.
3. Una característica observada en los bytes del modelo (CRLF, salto final,
   `034`, `00`, `2614`) es **evidencia del modelo**, no una frase del banco.
4. Las decisiones de la empresa (composición del nombre, estrategia de loteo,
   clasificación de liquidaciones) no se atribuyen al banco.
5. Ningún estado `B`/`I`/`C` se modifica en CP-F7-C0. La columna “Estado
   propuesto” es una **propuesta para CP-F7-C1/C2**, no un cambio aplicado.
   `C*` no es un `ContractStatus`: significa “propuesta de `C` que requiere
   aprobación humana explícita”.

### 12.3 Matriz corregida PAT-1…PAT-17

| ID | Respuesta escrita (literal) | DRPS corregido | Modelo TXT | Conclusión C0 | Límite / contradicción | Estado propuesto (no aplicado) | Impacto |
|---|---|---|---|---|---|---|---|
| **PAT-1** | “campo 16: tiene razón, son 93 caracteres de longitud (confirmado con txt de prueba)”. No responde espacios/ceros, tipo ni 197–200 | R2 campo 16: `N`, 104–196, longitud 93, “Espacios”, amarillo | 104–196: 93 espacios; 197–200: `2614` | Longitud **93** confirmada por escrito. Contenido **espacios** y EMPRESA en 197–200 son observación del diseño/modelo | El DRPS declara tipo `N` para un campo que el modelo llena con espacios; `N` con espacios no es representable en F4 | **C** (longitud y espacios) + aprobación de representación como `A`/`SPACE_RIGHT` | `contrato.ts`, `spec.ts`, `mapeo.ts`, tests; golden solo si cambian bytes |
| **PAT-2** | “El campo es Alfanumérico; inicio 85; fin 99; longitud 15; debe coincidir con el dato registrado en el banco al momento del alta de la cuenta; por ser alfanumérico se alinea a la izquierda y se completa con espacios en blanco a la derecha” | R2 campo 13: `A`, 85–99, 15 | 85–99: `AAAAAAAAAAAAAAA` | **Confirmado**: `A`, 15, izquierda, espacios a la derecha, origen = alta bancaria | El valor real por empleado sigue dependiendo de P-04 / altas A.2 | **C** (regla) + **D** (valor real) | `spec.ts`, `validacion.ts`, `mapeo.ts`, tests |
| **PAT-3** | “En DRPS se corrigen errores de tipo de dato y longitud y se marcan en verde los datos que el archivo debe contener si o si y coincidir con lo registrado en el banco, en amarillo todo lo que son espacios en blanco y en blanco los datos que el cliente puede no detallar…” | Observación al pie: “Los campos 11, 12, 13 y 14 deben coincidir con los que fueran informados en el momento del alta”; el campo 14 es “Espacios”, amarillo | La notación `N`/`n`/`A`/`a` distingue obligatorio/opcional, no “coincide con el alta” | La **semántica de colores** queda confirmada por escrito. **No** se enumeran los campos que deben coincidir | El texto “11, 12, 13 y 14” incluye el campo 14, que es espacios amarillos; no puede “coincidir” con el alta | **I** (parcial: semántica C, enumeración abierta) | Solo documentación |
| **PAT-4** | “en blanco los datos que el cliente puede no detallar en el archivo, pero cuyo campo debe completar con espacios o 0 según corresponda al tipo de campo” | R2 campo 12: `N`, 83–84, blanco (opcional) | 83–84: `00` | Para un campo `N` opcional, la regla escrita indica **ceros**; el modelo usa `00`. La prosa no dice “00” literalmente | La conclusión combina una regla escrita general con el valor del modelo | **C\*** (requiere aprobación humana) | `politica.ts`, `validacion.ts`, tests |
| **PAT-5** | “El número de envío debe ser un número entre 1 y 97, recomendamos usar números de envíos distintos y correlativos… puede reutilizar los números de envío siempre que no utilice el mismo número para dos archivos distintos que se intentan subir a la web el mismo día… el número de envío registrado dentro del archivo debe coincidir con el número de envío informado en la web” | R0 campo 6: no puede ser `99`; R1 campo 8: mismo número | R0 y R1: `NN` | Rango **1–97** confirmado; `00` queda fuera del rango; `99` queda fuera; el número del archivo debe coincidir con el de la web | La respuesta no repite “R0 y R1 iguales”, pero habla de un único número del archivo; el modelo lo usa en ambos. Los documentos previos mencionaban 1–70 | **C** (rango y correspondencia con la web) | `validacion.ts`, tests |
| **PAT-6** | “Número de Empresa y convenio son lo mismo, el dato es obligatorio para cualquiera de los formatos de envío de información al banco para el pago de haberes” | R0 campo 4: “Según número otorgado por el Banco”; R0 campo 14, R1 campo 11 y R2 campo 17: mismo valor | `2614` en R0 10–13 y 197–200, R1 197–200 y R2 197–200 | **Equivalencia confirmada**. El valor `2614` es observación del modelo; **no** queda confirmado como convenio real de la empresa | El texto de la consulta 2 menciona el convenio **2416**; el modelo se llama y contiene **2614** | **C** (equivalencia) + **D** (valor real) | Notas en `contrato.ts`/`spec.ts`; test de consistencia entre registros |
| **PAT-7** | “Informar tipo de documento 001” | R2 campo 15: `N`, 101–103, “Dato obligatorio. Ver códigos válidos en Anexo III” | 101–103: `NNN` | **No responde** el catálogo de tipo de liquidación ni el Anexo III | La respuesta se refiere al tipo de documento, no al tipo de liquidación | **I** | `validacion.ts`, `mapeo.ts`; sin cambios |
| **PAT-8** | “Informar tipo de documento 001” | R2 campo 10: `N`, 63–65, “Ver códigos en ANEXO I” | 63–65: `NNN` | **001** confirmado como código a informar en el caso general. **No** se confirma `004` ni el código de documento extranjero | La respuesta no aborda la omisión de `004` en el aplicativo ni el Anexo I completo | **C** (001) + **I** (004/extranjero) | `validacion.ts`, `mapeo.ts` |
| **PAT-9** | “Ver DRPS y modelo txt. Tener en cuenta que el sistema solo admite datos con letras y números del teclado qwerty en inglés, ningún carácter especia [sic], es decir, sin Ñ, sin acentos, ni comas, puntos, guiones, cejillas, diéresis, apostrofes, etc.” | R2 campo 7: `A`, 35–54, 20, **verde** (obligatorio) | 35–54: `aaaaaaaaaaaaaaaaaaaa` (minúscula = opcional) | **Alfabeto confirmado**: letras y números qwerty, sin Ñ, acentos ni signos. **No** responde orden, separador, obligatoriedad ni truncado | DRPS lo marca obligatorio (verde); el modelo usa `a` minúscula (opcional). Contradicción no resuelta | **C** (alfabeto) + **I** (obligatoriedad/formato) + **D** (P-14) | `nombre.ts`, `validacion.ts`, `politica.ts`, tests |
| **PAT-10** | “El archivo generado por diseño de registro debe ser un archivo .txt, el nombre del archivo deb ser ACREXXXX, (donde XXXX, debe ser reemplazado por el número de convenio de la empresa), el sistema lo reconoce por la disposición interna de la información y admite el envío al banco a través de la web sin requerir encriptamiento”. La alternativa encriptada es `.BPS` generada por Patagonia Sueldo | R0/R1: “archivo ACREXXXX.TXT” | El archivo local se llama `Modelo_ACRE2614 (1).txt` | **Confirmado**: `.txt`, nombre `ACREXXXX`, `XXXX` = número de convenio, envío web sin encriptar | No responde encoding, CRLF/LF ni salto final. Queda registrada la diferencia con la convención `BP_AAMMDD_HHMMSS` citada antes | **C** | Sin cambio de bytes; afecta CP-F7-D2 y el nombre materializado |
| **PAT-11** | “El convenio de la empresa no tiene restricciones en cuanto a la modalidad para acreditar los sueldos, podrá hacerlo por archivo (ya sea generado por diseño de registro o por el aplicativo), también puede hacerlo directamente por la plantilla…” | B.2 se titula “detalle de acreditación con cuenta confirmada” | El modelo sigue el layout B.2 | **B.2 es admisible** para el convenio de la empresa; no hay restricción de modalidad | No identifica el número de convenio ni prueba que el alta ya esté hecha; el valor real sigue en D | **C\*** (cierra P-03 con aprobación) | `aptitud.ts`, `politica.ts`, fachada; solo documentación en C0 |
| **PAT-12** | Misma respuesta qwerty que PAT-9: “sin Ñ, sin acentos, ni comas, puntos, guiones, cejillas, diéresis, apostrofes, etc.” | R2 campo 4: `A`, 7–16, 10; ejemplo de contenido `HAB.05/00` | 7–16: `AAAAAAAAAA` | **Alfabeto confirmado**: letras y números qwerty, sin signos. **No** responde si es texto libre o catálogo | El ejemplo del DRPS usa punto y barra, que la respuesta prohíbe; contradicción no resuelta | **C** (alfabeto) + **I** (libre/catálogo) | `validacion.ts` |
| **PAT-13** | “La separación por lotes es a criterio del empleador… debe contener si o si un registro de cabecera… al menos un registro de lote… la cantidad de registros de lote… debe coincidir con el dato ‘cantidad de lotes’… (campo 7)… la cantidad de registros de acreditación que contenga cada lote debe coincidir con el dato ‘cantidad del lote’… (campo 5)” | R1 campo 2: “No puede repetirse dentro del mismo envío. Distinto a `0000`”; campo 5: 3 dígitos | R1 campo 2 `NNNN`; campo 5 `NNN` | **Confirmado**: estructura R0 + al menos un R1 + R2; los conteos deben cuadrar. El criterio de división es del empleador | La numeración única y distinta de `0000` surge del DRPS, no de la respuesta escrita. El máximo 999 es geométrico (3 dígitos) | **C\*** (conteos) + **D** (P-20) | `loteo.ts`, `politica.ts`, tests |
| **PAT-14** | La consulta 7 preguntó encoding, CRLF/LF y salto final; la respuesta **no los menciona** | Sin capa de texto | ASCII; CRLF entre registros; **CRLF final**; 606 bytes = 3×200 + 3×2 | Solo **observación del modelo**. No hay confirmación escrita | No se puede presentar como respuesta del banco | **C contingente** (sin cambio) | `spec.ts`, serialización, golden si se aprueba |
| **PAT-15** | “Sobre los datos versión y comprobante puede ver DRPS y modelo txt” | R0 campo 13: “En blanco”; R1 campo 10: amarillo (espacios) | R0 y R1: 8 espacios en 189–196 | **Espacios**, según los documentos a los que el banco remite; no es un valor dictado en la frase | La respuesta escrita no dice “espacios”; se apoya en DRPS + modelo | **C\*** | `politica.ts`, `spec.ts`, tests |
| **PAT-16** | Misma remisión a “DRPS y modelo txt” | R2 campo 6: “Se puede informar… legajo… u otro dato”; campo `N` de 7 | 28–34: `nnnnnnn` (minúscula = opcional numérico) | **Ceros** cuando no se informa, por la regla escrita de notación: “n minúscula… en caso de no ingresar este dato, se debe completar el campo con ceros” | La conclusión combina la regla de notación con la marca `n` del modelo | **C\*** | `politica.ts`, `validacion.ts`, tests |
| **PAT-17** | “La acreditación de haberes en banco corresponsal se realiza acreditando previamente los fondos en la cuenta PS del empleado en Banco Patagonia, por este motivo el dato de código de banco siempre es el mismo ‘034’ y estas acreditaciones no pueden realizarse el mismo día de presentación del archivo, deben ejecutarse bajo la modalidad ‘con fecha diferida’ y registrar una fecha de acreditación de, al menos, 24 hs hábiles posteriores a la fecha de presentación registrada en la cabecera” | R2 campo 8: “Código del banco donde está radicada la cuenta de acreditación” | 55–57: `034` | **034 siempre** confirmado para R2. Aparece un **requisito nuevo**: pagos a banco corresponsal con fecha diferida y acreditación ≥24 horas hábiles | D-086 mantiene congelada la regla de entidad y prohíbe tocar `src/reconciliation/**`. La modalidad “fecha diferida” no está modelada | **C\*** (034) + **requisito nuevo pendiente** | `mapeo.ts`/`validacion.ts` para 034; **no** tocar conciliación; evaluar fecha diferida en checkpoint posterior |

**Resumen de la propuesta (sin aplicar):**

| Propuesta | PAT |
|---|---|
| `C` | PAT-1 (longitud/espacios), PAT-2, PAT-5, PAT-6 (equivalencia), PAT-8 (001), PAT-10, PAT-12 (alfabeto) |
| `C*` (requiere aprobación) | PAT-4, PAT-11, PAT-13, PAT-15, PAT-16, PAT-17 |
| `C contingente` (sin cambio) | PAT-14 |
| `I` (total o parcial) | PAT-3, PAT-7, PAT-9 (obligatoriedad/formato), PAT-8 (004/extranjero), PAT-12 (libre/catálogo) |

### 12.4 Matriz de preguntas `P`

| ID | Evidencia nueva | Conclusión C0 | Estado propuesto (no aplicado) | Observación |
|---|---|---|---|---|
| **P-03** | Consulta 5: el convenio no tiene restricciones de modalidad; puede usarse el archivo por diseño de registro | B.2 es admisible; no se identifica el número de convenio ni el alta | **Cerrable con aprobación humana** | No se cierra en C0 |
| **P-09** | Consulta 5 solo responde “tipo de documento 001” | El catálogo de **tipo de liquidación** (Anexo III) sigue sin respuesta; el mapeo interno sigue pendiente | **Abierta** | Afecta también BNA; no se toca en C0 |
| **P-10** | Sin evidencia bancaria | Sigue siendo una regla interna de extracción desde `Descripcion` | **Abierta** | No es pregunta bancaria |
| **P-14** | Consulta 6 solo confirma el alfabeto | Composición, orden, separador y truncado siguen sin definirse | **Abierta** | Decisión de empresa |
| **P-20** | Consulta 9: la separación por lotes es “a criterio del empleador” | El banco no impone la estrategia; la decisión sigue siendo interna | **Abierta** | El límite de conteos sí queda confirmado |
| **P-30** | Consulta 10: el código de banco del R2 es siempre `034` | `034` confirmado para R2; la regla general de otras entidades no se usa porque los fondos se acreditan en la cuenta PS | **Cerrable con aprobación humana** | D-086 sigue congelada hasta que se apruebe |

### 12.5 Contradicciones registradas (no resueltas)

| # | Contradicción | Fuentes | Tratamiento |
|---|---|---|---|
| 1 | Convenio **2416** frente a **2614** | Texto de la consulta 2 (“modelo txt para convenio 2416”); nombre y contenido del modelo (`Modelo_ACRE2614`) | Se registra; no se corrige por suposición. Falta el dato real de la empresa |
| 2 | R2 campo 16: tipo `N` con contenido de espacios | DRPS (tipo `N`, “Espacios”); modelo (93 espacios) | Se propone representar como `A`/`SPACE_RIGHT`, sujeto a aprobación |
| 3 | “Los campos 11, 12, 13 y 14 deben coincidir con el alta” | DRPS, observación al pie; el campo 14 es “Espacios” amarillo | Se registra; la semántica de colores no permite que un campo de espacios “coincida” |
| 4 | Apellido y Nombre obligatorio frente a opcional | DRPS: verde (obligatorio); modelo: `a` minúscula (opcional) | Se registra; PAT-9 sigue parcial |
| 5 | Concepto: ejemplo con `.` y `/` frente a alfabeto sin signos | DRPS: ejemplo `HAB.05/00`; respuesta: sin comas, puntos, guiones | Se registra; PAT-12 conserva la parte de catálogo abierta |
| 6 | Número de envío **1–97** frente a **1–70** | Respuesta escrita; documentación previa del aplicativo | Se registra la respuesta como fuente primaria para B.2; no se borra la referencia anterior |
| 7 | Nombre `ACREXXXX.TXT` frente a `BP_AAMMDD_HHMMSS` | Respuesta escrita y DRPS; convención citada en documentación previa | Se registra; la respuesta es explícita para archivo por diseño |
| 8 | CRLF y salto final | Modelo (CRLF/CRLF final); respuesta escrita (no los menciona) | Se registra como observación del modelo, no como confirmación bancaria |
| 9 | Provincia `00` frente a “solo se informa con tipo `004`” | DRPS (blanco/opcional, tipo `N`); modelo (`00`); regla de colores | Se propone `00` por regla de colores + tipo numérico; no se atribuye a una frase del banco |
| 10 | Fecha diferida ≥24 horas hábiles | Respuesta 10; contrato actual no modela esa modalidad | Se registra como **requisito nuevo**; no se implementa en C0 |

### 12.6 Riesgo de compuerta al cerrar PAT-1/PAT-2

`aptitudPatagonia` solo considera bloqueos `B`. Hoy PAT-1 y PAT-2 son los
**únicos** `B` de Patagonia. Si CP-F7-C1/C2 los pasaran a `C` sin una
compuerta adicional, `generadorHabilitado` podría quedar en `true` aunque la
homologación siga pendiente y aunque P-14, P-20, PAT-7, PAT-9, PAT-16 y el
requisito de fecha diferida sigan abiertos.

**Propuesta para un checkpoint posterior (no implementada en C0; diseño
detallado en CP-F7-C1, `docs/04` §3.5.6):**

1. Mantener las compuertas actuales; no eliminarlas ni relajarlas.
2. Agregar un requisito explícito e independiente de **homologación
   aprobada** antes de habilitar generación productiva, separado de
   `generadorHabilitado`.
3. Exigir que la aptitud siga informando `homologacion:
   'PENDIENTE_DE_HOMOLOGACION'` y que la fachada devuelva un bloqueo propio
   mientras ese estado no cambie por decisión humana.
4. No usar un cambio de `ContractStatus` como sinónimo de autorización de
   producción.

Este riesgo queda **documentado**, no corregido: CP-F7-C0 no modifica
`src/**`.

### 12.7 Decisiones internas que siguen pendientes

| Tema | Estado | Por qué no lo resuelve el banco |
|---|---|---|
| Composición del nombre (P-14) | Abierta | El banco solo confirma el alfabeto; no impone orden, separador ni truncado |
| Loteo (P-20) | Abierta | El banco delega la separación en el empleador; solo exige consistencia de conteos |
| Clasificación de liquidaciones (P-09/P-10) | Abierta | No se respondió el Anexo III ni la extracción desde `Descripcion` |
| Convenio real y número de empresa | Pendiente | El texto menciona 2416 y el modelo usa 2614; falta confirmación de la empresa |
| Altas A.2 y datos por empleado (P-04) | Pendiente | Es información de la empresa y del alta bancaria |
| Política de pagos a banco corresponsal | Pendiente | La respuesta 10 agrega fecha diferida y ≥24 horas hábiles; falta decidir si entra en el alcance |
| Dígitos del convenio BNA (P-23) | Pendiente | Es BNA, fuera de CP-F7-C0 |
| Calendario de feriados BNA | Pendiente | Fuente externa, fuera de CP-F7-C0 |

### 12.8 Verificaciones ejecutadas

```
git status --porcelain=v1                  → sin cambios en src/ ni tests/
git rev-parse HEAD                         → a070314aef04dae62f89769d23bc7dc72075ac20
git rev-parse main                         → d8be143ca3dc34fc9a0aa39246ba279204748b3b
shasum -a 256 references/Respuestas...     → b8d1c198…1852
shasum -a 256 "references/DRPS (1).docx"   → 0625ac4e…d778d
shasum -a 256 "references/Modelo_ACRE..."  → d17ce90e…64e8
git check-ignore -v references/...         → ignorados por .gitignore
```

No se generó ningún TXT. No se envió ningún archivo. No se ejecutaron pruebas
de código porque no hubo cambios en `src/**` ni `tests/**`.

### 12.9 CP-F7-C1 — consolidación documental

CP-F7-C1 incorpora la evidencia de §12 al contrato documental. El detalle
normativo vive en `docs/04_CONTRATOS_BANCARIOS.md` §3.5:

-   **Clases de evidencia:** `RC` (respuesta escrita), `DC` (diseño corregido),
    `TM` (solo TXT modelo), `DE` (decisión empresarial) y `PH` (pendiente de
    homologación). Una misma PAT puede tener varias clases.
-   **Matriz final PAT-1…PAT-17** con evidencia exacta y límite de cada regla.
-   **Propuestas `PC-01`…`PC-17`** de cambio de `ContractStatus`, sin aplicar.
-   **Doce contradicciones** registradas; ninguna resuelta por inferencia.
-   **Diseño de la compuerta** `HOMOLOGACION_PATAGONIA_PENDIENTE`, separada de
    `generadorHabilitado`, *fail-closed* y sin *override*.
-   **Plan de pruebas C2**, incluida la prueba de que PAT-1/PAT-2 en `C` con
    autorización pendiente siguen bloqueando la fachada.

Ajuste respecto de C0: PAT-1 pasa de propuesta `C` a **`C*`**. La respuesta
escrita confirma la longitud de 93, pero no el tipo ni el relleno; los espacios
provienen del DRPS y del modelo. La representación `A`/`SPACE_RIGHT` requiere
aprobación humana explícita. PAT-2 se mantiene `C` porque la respuesta escrita
confirma tipo, longitud, alineación, relleno y origen.

**No se modificó ningún estado `B`/`I`/`C`.** Las columnas “Vigente” de
`docs/04` §6.2 siguen siendo las efectivas. **No se tocó `src/**`, `tests/**`,
`main`, goldens ni `references/**`.** No se generó ni envió ningún TXT. La
compuerta no se implementó.

## 13. STOP

CP-F7-C0 dejó registrada la evidencia y la propuesta. CP-F7-C1 consolidó esa
evidencia en `docs/04` §3.5, con la matriz final, las propuestas `PC-*` y el
diseño de la compuerta. **No se modificó ningún estado `B`/`I`/`C`.** **No se
tocó `src/**`, `tests/**`, `main`, goldens ni `references/**`.** **No se generó
ni envió ningún archivo de sueldos.** **La compuerta no se implementó.**

Antes de CP-F7-C2 se requiere auditoría humana de: la admisión de esta
evidencia, la matriz PAT-1…PAT-17, las propuestas `PC-01`…`PC-17`, las doce
contradicciones, el paso de PAT-1 a `C*`, la decisión de representación
`A`/`SPACE_RIGHT` y el diseño de la compuerta de homologación. No se inicia
CP-F7-C2, CP-F7-C3 ni ningún checkpoint BNA desde aquí.

