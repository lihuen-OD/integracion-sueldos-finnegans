# BNA · Requisitos para la homologación del generador GT200

**Rama:** `f9-ui-flujo-guiado` · **Base:** `d1d6f53` · **F12-B:** commit local
(no publicado) · **Fecha:** 12-11-2026.

**Estado:** documento de trabajo para la gestión con Banco Nación. **No
homologa**, **no autoriza producción**, **no contiene datos reales** y **no
modifica** contratos, layouts, políticas ni bloqueos.

> **BNA-1 `CONFIRMADA` no es homologación.** Significa que clase `1` + tipo
> `02` + CUIL se deduce del diseño documental (p.11). No implica aceptación
> bancaria: la homologación sigue pendiente y la producción sigue cerrada.

**Fuentes:** `references/BNA_Instructivo_Pago_Haberes_GT.pdf` (16 páginas;
SHA-256 `d28ffbcc3cae01d56b48c8416d44c22a03d53b682800381b7a7d8dabe88f2f56`);
`docs/informes/F12_MATRIZ_RESOLUCION_BNA_GT200.md`;
`docs/04_CONTRATOS_BANCARIOS.md` §2.1–§2.3 y §6.1;
`docs/informes/F12_VERIFICACION_GENERADOR_BNA_GT200.md`.

**Evidencia disponible:** no hay respuestas escritas de Banco Nación ni un
archivo de prueba enviado o aceptado. “Documentado” no es “homologado”.

---

## 1. Resumen: qué cambió respecto del documento anterior

El documento anterior enviaba ocho consultas. Al releer la fuente principal, la
mayoría se puede resolver con el propio instructivo o se valida con un archivo
sintético.

| Requisito | Antes | Ahora |
|---|---|---|
| BNA-1 | Consulta escrita | **Sin consulta inicial.** p.11 da clase `1` + tipo `02` + CUIL. |
| BNA-2 | Consulta escrita | **Sin consulta inicial.** El campo y el ejemplo usan el CBU del beneficiario. |
| BNA-5 | Consulta escrita | **Condicional.** Solo si el convenio real tiene 5, 6 o 7 dígitos. |
| BNA-6 | Consulta escrita | **Sin consulta inicial.** La derivación desde CBU coincide con los ejemplos. |
| BNA-7 | Consulta escrita | **Sin consulta inicial.** La fecha la informa la empresa; el calendario es decisión interna. |
| BNA-8 | Consulta escrita | **Sin consulta inicial.** p.4 define el alfabeto; el código lo aplica. |
| BNA-9 | Consulta escrita | **Sin consulta inicial.** Se valida con el archivo; si se rechaza, se consulta. |
| BNA-11 | Consulta escrita | **Sin consulta inicial.** p.9 permite la referencia vacía. |

**Resultado:** cero preguntas interpretativas en el envío inicial; dos preguntas
condicionales y una pregunta de diagnóstico solo si la prueba es rechazada.

---

## 2. Preguntas que quedan redactadas

### 2.1 Condicional — convenio de 5, 6 o 7 dígitos (BNA-5)

Solo se envía si el convenio real de la empresa no tiene 4 u 8 dígitos.

> El instructivo indica “2 ceros + los 8 números del convenio” y, para 4
> dígitos, “completar con 4 ceros más”. Si el código de convenio tiene 5, 6 o 7
> dígitos, ¿cómo se completa el campo de 10 posiciones? ¿Los ceros van a la
> izquierda o a la derecha? ¿Pueden confirmar con un ejemplo?

**Respuesta útil:** una tabla o un ejemplo oficial para cada longitud.

### 2.2 Condicional — beneficiario sin CUIL (BNA-1)

Solo se envía si la empresa necesita pagar a alguien que no tiene CUIL.

> Para un beneficiario que solo tiene DNI, ¿qué valor debe llevar “Clase de
> documento”, qué valor “Tipo documento beneficiario” y el número debe
> completarse con `000` + DNI? ¿La combinación es clase `2` + tipo `96` +
> `000` + DNI?

**Respuesta útil:** confirmación escrita del par clase/tipo y del formato del
número.

### 2.3 Diagnóstico — solo si el archivo es rechazado (BNA-9)

No se envía antes de la prueba. Se usa si el banco rechaza el archivo y no
informa la causa.

> ¿El archivo debe usar CRLF y terminar con salto de línea después del registro
> 3? Si el rechazo se debe a otro motivo, ¿pueden indicarnos el código de error y
> la posición exacta?

**Respuesta útil:** causa, posición y corrección esperada.

---

## 3. Interpretaciones que usaremos en la prueba

Estas interpretaciones se declaran en la nota de cobertura. **No son
confirmaciones del banco**; son la lectura de la fuente principal.

| Requisito | Interpretación | Fuente | Estado |
|---|---|---|---|
| **BNA-1** | Clase `1` (clave fiscal) + tipo `02` + CUIL de 11 dígitos. | p.9, p.11 | Respaldo documental fuerte; p.15 se descarta como ejemplo inconsistente (BNA-3). |
| **BNA-2** | El bloque 2 del R2 usa el CBU del beneficiario, no el de la empresa. | p.8, p.11 | Respaldo documental fuerte; el texto “de la empresa” se considera error de redacción. |
| **BNA-5** | 4 dígitos → `00` + 4 + `0000`; 8 dígitos → `00` + 8. | p.6, p.7 | Documentado; 5–7 no definido. |
| **BNA-6** | Entidad = `0` + CBU[0:3]; sucursal = CBU[3:7]; DV = CBU[7]; bloque 2 = CBU[8:22]. R1 sucursal = CBU empresa[3:7]. | p.5, p.7, p.8, p.11 | Respaldo documental fuerte para BNA; para otras entidades se copia el campo de 4 dígitos del CBU. |
| **BNA-7** | Fecha `AAAAMMDD`, día hábil anterior; la informa la empresa. | p.5, p.7, p.14 | Forma y regla documentadas; calendario no incluido. |
| **BNA-8** | Solo `A–Z`, `0–9` y espacio; sin `Ñ`, acentos, minúsculas ni signos. | p.4 | Documentado; el código rechaza lo demás. |
| **BNA-9** | CRLF + salto final; charset ANSI/ASCII para los caracteres permitidos. | p.14 | Hipótesis fuerte; se valida con la ingesta. |
| **BNA-11** | Referencia vacía permitida → 15 espacios; campos libres según decisión de la empresa. | p.9, p.6 | Documentado e implementado (C-1); el contenido de los campos libres sigue en P-17. |

---

## 4. Datos que debe conseguir la empresa

| Dato | Para qué | Estado |
|---|---|---|
| CUIT de la empresa | R1, identificación | Requerido por el perfil |
| CBU de la cuenta empresarial | R1, bloque 2 y sucursal | Requerido por el perfil |
| Moneda (`0` pesos / `1` dólares) | R1 | Requerido por el perfil |
| **Convenio real y cantidad exacta de dígitos** | R1, posiciones 64–73; P-23 | **Pendiente**; define si BNA-5 necesita consulta |
| CUIL y CBU de cada empleado | R2, documento y cuenta de destino | Desde el maestro validado; solo en entorno autorizado |
| Neto a acreditar | R2 y totales | Desde Finnegans/conciliación |
| Descripción de cada liquidación y su mapeo a `0000`/`0003` | R2, identificador de préstamo; P-09 | **Pendiente de RRHH** |
| Fecha de compensación | R1 | La aporta el operador en cada envío |
| Número de envío (`1`/`2`) | R1 | La aporta el operador |
| Información criterio empresa | R1, campo libre | La aporta el operador; contenido P-17 abierto |
| Referencia unívoca | R2, campo a criterio | Puede ir vacía; implementado como 15 espacios |
| Contacto y canal con el banco | Gestión de homologación; P-21 | **Pendiente de designación** |
| Autorización para datos reales en prueba controlada | Protección de datos | **Pendiente de aprobación interna** |

No incluir CUIT, CBU, CUIL, importes ni nombres reales en este documento ni en
los archivos sintéticos. Los datos reales se gestionan solo en el entorno
autorizado y nunca se versionan.

---

## 5. Requisitos que resolvemos internamente

No hace falta consultar al banco para:

1. **BNA-2:** el CBU del R2 es el del beneficiario.
2. **BNA-3:** las inconsistencias de los ejemplos compuestos no son reglas.
3. **BNA-4:** las posiciones derivadas están aprobadas por D-023.
4. **BNA-6:** la derivación desde CBU coincide con los ejemplos.
5. **BNA-8:** el alfabeto está documentado; la normalización de datos reales es
   una decisión interna.
6. **BNA-11:** la referencia vacía está permitida; el contenido de los campos
   libres es una decisión interna (P-17).
7. **BNA-10:** decidir si el mismo CBU puede repetirse; no es una regla del
   banco.
8. **P-09:** mapeo de descripciones de Finnegans a `0000`/`0003`.
9. **P-23:** cantidad de dígitos del convenio real.
10. **P-21:** responsable, suplente y canal con el banco.
11. **Calendario de feriados:** fuente oficial y decisión de validación.
12. **Configuración de separador:** CRLF + salto final como hipótesis canónica.
13. **Mecanismo de autorización productiva:** no depende del banco.

---

## 6. Procedimiento para la prueba sintética

### 6.1 Condiciones previas

- Designar responsable y suplente (P-21).
- Obtener el contacto y el canal que indique el banco.
- Confirmar el convenio real y su cantidad de dígitos (P-23).
- Congelar el commit y la versión del generador.
- Generar el archivo con el harness sintético, no con datos reales.
- Verificar que no contenga CUIT, CBU, CUIL, importes ni nombres reales.

### 6.2 Contenido del envío

1. **TXT sintético** con datos ficticios.
2. **Manifiesto:** versión del layout, cantidad de registros, cantidad de pagos,
   importe total, longitud, SHA-256, separador, salto final y aclaración de que
   todos los datos son ficticios.
3. **Nota de cobertura:** empresa, convenio (completar fuera de este documento),
   contacto, versión del instructivo y pedido concreto.
4. **Aclaración expresa:** es una prueba de estructura/ingesta, no una orden de
   pago, no debe acreditarse y no contiene datos reales.

Si el banco exige el CUIT real para asociar la prueba, se acuerda por escrito
antes de generar el archivo. No se incluye por iniciativa propia.

### 6.3 Secuencia

1. Enviar la nota y el archivo juntos al contacto designado.
2. Pedir respuesta escrita sobre:
   - recepción del archivo;
   - si pasó la validación de estructura e ingesta;
   - aceptación o rechazo;
   - en caso de rechazo, motivo, código de error y posición exacta;
   - corrección esperada.
3. Registrar fecha, destinatario, canal, hash, versión del generador y
   respuesta. Guardar solo evidencia sanitizada.
4. Si es aceptado: registrar la aceptación y preguntar qué requisitos
   adicionales pide el banco para producción. **La aceptación de un archivo
   sintético no habilita producción.**
5. Si es rechazado: mapear el error al requisito correspondiente, corregir solo
   lo autorizado, generar un archivo nuevo con nuevo hash y reenviar.
6. Cerrar la homologación cuando exista aceptación escrita y se hayan resuelto
   los requisitos que afectan bytes.
7. Recién después evaluar la habilitación productiva con un mecanismo de
   autorización independiente y un checkpoint propio.

### 6.4 Criterio de aceptación

Se considera evidencia:

- confirmación escrita de recepción y validación; o
- registro de ingesta aceptado por el canal que indique el banco.

Un “ok” verbal, una respuesta informal o la generación local del archivo no
alcanzan. La aceptación de un archivo sintético **no es homologación de
producción** ni autoriza pagos reales.

---

## 7. Qué bloquea un archivo de prueba y qué bloquea producción

| Requisito | ¿Bloquea un archivo sintético? | ¿Bloquea un archivo con datos reales? | ¿Bloquea solo producción? |
|---|---|---|---|
| **BNA-1** | No: se usa `1`/`02`/CUIL. | No si todos tienen CUIL; sí si falta el CUIL. | Sí. |
| **BNA-2** | No: se usa el CBU del beneficiario. | No, si el maestro tiene CBU. | Sí. |
| **BNA-5** | No para 4/8; sí para 5–7. | Depende del convenio real. | Sí. |
| **BNA-6** | No: se deriva del CBU. | No, si el CBU es válido. | Sí. |
| **BNA-7** | No: la fecha es un parámetro. | No para construir; puede ser rechazada si no es hábil. | Sí. |
| **BNA-8** | No si se usan `A–Z`/`0–9`/espacio. | Puede bloquear si los datos reales tienen otros caracteres. | Sí. |
| **BNA-9** | No: el separador es explícito. | No para construir; la ingesta es incierta. | Sí. |
| **BNA-11** | No: la referencia vacía ya se acepta (C-1). | No, si los campos libres están definidos. | Sí. |
| **P-09** | No: el harness usa un catálogo cerrado. | Sí, si falta el mapeo de alguna descripción. | Sí. |
| **Perfil y parámetros** | No: el harness usa datos ficticios. | Sí: faltan CUIT/CBU/moneda, convenio, fecha, número de envío y campos libres. | Sí. |
| **Compuerta `produccionBnaHabilitada()`** | No: el harness no pasa por la fachada productiva. | Sí para la fachada: siempre devuelve `false`. | Sí, por diseño. |
| **Aceptación bancaria** | No para construir. | No para construir. | Sí para homologar y producir. |

**Conclusión:** hoy se puede construir un archivo sintético: C-1 a C-5 están
implementadas y la compuerta productiva sigue cerrada. No se puede construir un
archivo productivo con datos reales mientras falten P-09/P-10, el convenio real
(P-23), los campos libres (P-17) y el perfil/parámetros reales. La compuerta
seguiría cerrada aunque el contrato y la política estén resueltos.

---

## 8. Propuesta de comunicación al banco

**Asunto:** Pago de Haberes GT — solicitud de validación de un archivo de prueba
sin datos reales

> Estimados:
>
> Somos [empresa], con convenio [número] de Pago de Haberes. Estamos
> implementando la generación del archivo GT y recibimos el “Instructivo Diseños
> de Registro de Pagos GT” de 16 páginas.
>
> Antes de generar un archivo para producción, queremos validar un archivo de
> prueba con datos ficticios. El archivo no contiene datos reales, no es una
> orden de pago y no debe acreditarse.
>
> Adjuntamos:
>
> 1. el archivo TXT sintético;
> 2. un manifiesto con cantidad de registros, importe total, longitud, hash
>    SHA-256, separador y salto final;
> 3. esta nota con las interpretaciones usadas.
>
> Les pedimos:
>
> 1. indicar si el archivo pasa la validación de estructura e ingesta;
> 2. si es rechazado, informar el motivo, el código de error y la posición
>    exacta;
> 3. si alguna de las interpretaciones no es la esperada, indicarnos cuál y en
>    qué posición;
> 4. indicar el contacto y el canal para continuar la homologación.
>
> Quedamos a disposición para adaptar el archivo a las observaciones del banco.
>
> Saludos cordiales,
> [nombre, área, teléfono y correo]

**Anexo de la comunicación:** la tabla de interpretaciones de la §3. No se
adjuntan datos de empleados, CBU reales, CUIL reales, importes reales ni
nóminas.

**Preguntas condicionales:** solo se agregan si se cumple la condición de la §2.
No forman parte del envío inicial.

---

## 9. Acciones concretas de la empresa

1. Designar responsable y suplente para la gestión bancaria (P-21).
2. Obtener el convenio real y su cantidad de dígitos (P-23). Si es 5–7, enviar
   la pregunta condicional de la §2.1.
3. Confirmar que todos los beneficiarios tienen CUIL. Si no, enviar la pregunta
   condicional de la §2.2.
4. Definir el mapeo de descripciones a `0000`/`0003` con RRHH (P-09).
5. Decidir el contenido de los campos libres y si se exige referencia no vacía
   (P-17).
6. Confirmar si el mismo CBU puede repetirse en dos beneficiarios (BNA-10).
7. Elegir el calendario de feriados y la política de normalización de
   caracteres.
8. Preparar el archivo sintético y su manifiesto; verificar que no haya datos
   reales y calcular el hash.
9. Obtener contacto y canal del banco; enviar la nota y el archivo; registrar la
   evidencia.
10. No habilitar producción ni modificar políticas, layouts o bloqueos hasta
    tener respuesta escrita y un checkpoint aprobado.

**Resultado esperado:** un archivo sintético aceptado o un rechazo con causas
concretas. Ese resultado es el insumo para corregir el contrato, implementar las
políticas pendientes y recién después evaluar la producción.
