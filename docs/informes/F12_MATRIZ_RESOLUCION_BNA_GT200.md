# F12 · Matriz de resolución documental y técnica — Banco Nación GT200

**Rama:** `f9-ui-flujo-guiado` · **HEAD de referencia:** `d1d6f53` ·
**Fecha:** 12-11-2026.

**Estado:** F12-B implementado en el árbol de trabajo local. C-1 a C-5 y la
hipótesis de separador D-6 quedaron aplicadas y cubiertas por pruebas. Este
documento **no homologa** y **no autoriza producción**: la aceptación bancaria
sigue pendiente. La columna “Código actual” describe el estado posterior a
F12-B.

> **BNA-1 `CONFIRMADA` no es homologación.** Significa que la combinación clase
> `1` + tipo `02` + CUIL se deduce del diseño documental (p.11), no que Banco
> Nación haya aceptado el generador ni el archivo. La compuerta productiva sigue
> cerrada y la homologación sigue `PENDIENTE_DE_HOMOLOGACION`.

**Fuente principal:** `references/BNA_Instructivo_Pago_Haberes_GT.pdf`
(16 páginas; SHA-256
`d28ffbcc3cae01d56b48c8416d44c22a03d53b682800381b7a7d8dabe88f2f56`).

**Fuentes de contraste:** `docs/04_CONTRATOS_BANCARIOS.md` §2.1–§2.3 y §6.1;
`docs/informes/F12_VERIFICACION_GENERADOR_BNA_GT200.md`;
`docs/informes/F7_CONSULTAS_BANCARIAS.md`; `docs/informes/F7_BNA_DEFINICIONES.md`.

> **Alcance de la fuente.** En el repositorio, el único documento GT200
> disponible es el PDF indicado. No hay un diseño GT200 separado ni un
> instructivo público distinto. Si la empresa posee otra versión del diseño,
> debe incorporarla antes de cerrar cualquier requisito. El PDF se trata como
> fuente principal, no como manual público complementario.

> **Regla de lectura.** La especificación de campo prevalece sobre el ejemplo
> dedicado; el ejemplo dedicado prevalece sobre el ejemplo compuesto. El
> ejemplo compuesto de la página 15 contiene inconsistencias ya documentadas
> como BNA-3 y **no se usa como golden**.

> **Documentado no es homologado.** Que una regla se deduzca del instructivo no
> significa que Banco Nación haya aceptado el archivo. La aceptación bancaria se
> registra solo con evidencia escrita o ingesta aceptada.

---

## 1. Matriz BNA-1 a BNA-11

| ID | Regla documentada (resumen) | Fuente / campo | Código actual | ¿Contradicción real? | ¿Resoluble con la fuente? | Decisión interna faltante | ¿Consulta al banco? |
|---|---|---|---|---|---|---|---|
| **BNA-1** | Clase `1` = clave fiscal; clase `2` = otros documentos. Tipo `96` = DNI; el ejemplo dedicado usa clase `1` + tipo `02` + CUIL. Número: CUIL de 11 dígitos o `000` + documento. | p.9 (clase, tipo, número); p.11 (ejemplo dedicado); p.15 (compuesto) | `r2_tipoDocumento` está `CONFIRMADA` por el diseño documental, sin `fixedValue`; `POLITICA_BNA_PRODUCTIVA.documento` devuelve clase `1` + tipo `02`; el mapper escribe `String(pago.cuil)`. | Sí, entre p.11 (`02`) y p.15 (`96`) con CUIL. No es una contradicción de la regla de clase. | **Sí, para el camino CUIL:** clase `1` + tipo `02` + CUIL, según p.11. p.15 es inconsistencia de ejemplo (BNA-3). | Usar solo el camino CUIL y rechazar beneficiarios sin CUIL; no usar `000` + DNI mientras el modelo no lo soporte. | **No inicial.** Se valida con el archivo. Solo condicional si hay beneficiarios sin CUIL. |
| **BNA-2** | “Bloque 2 CBU cuenta a acreditar”: segundo bloque del CBU de la cuenta que se acredita. | p.8 (campo); p.11 (ejemplo: CBU del beneficiario) | `politica.cbuCuenta` devuelve `pago.cbu` (CBU del beneficiario); el mapper toma `cbu.slice(8,22)` y `cbu.slice(7,8)` para el DV. | Sí, el texto dice “CBU de la empresa” pero el ejemplo y el nombre del campo indican el CBU del beneficiario. | **Sí.** El texto es un error de redacción: el R2 es individual y el ejemplo usa el CBU del empleado. | Ninguna de fondo; usar el CBU del beneficiario y no el de la empresa. | **No inicial.** Se declara la interpretación en la prueba. |
| **BNA-3** | Ejemplos compuestos con inconsistencias: p.14 declara cantidad `1` pero los bytes muestran `0000004`; p.15 usa un total de R3 que no coincide con el único R2; p.15 usa `96` con CUIL. | p.14, p.15 | Documentado; no se usa como regla ni golden. | Sí, pero es inconsistencia de ejemplo, no de regla. | **Sí:** se descarta el ejemplo compuesto y se usan las páginas específicas. | Ninguna. | **No.** |
| **BNA-4** | Posiciones derivadas por suma acumulada de longitudes. | p.4–15; D-023 | Implementado y verificado contra los ejemplos. | No. | **Sí.** | Ninguna. | **No.** |
| **BNA-5** | “2 ceros + los 8 números del convenio. Si sólo tienen 4 completar con 4 ceros más.” Ejemplo: `4455` → `0044550000`. | p.6 (regla); p.7 (ejemplo) | `validarConvenioBna`: 4 dígitos → `00` + 4 + `0000`; 8 → `00` + 8; 5–7 se rechazan. | No para 4/8. **Sí** para 5–7: no hay regla. | **Sí para 4 y 8.** Para 5–7, no: no se debe extrapolar el relleno. | Obtener el convenio real y su cantidad de dígitos (P-23). Si es 5–7, decidir o consultar. | **Condicional:** solo si el convenio real tiene 5, 6 o 7 dígitos. |
| **BNA-6** | R1: sucursal = `0` + código BCRA. R2: entidad = `0` + código BCRA de la entidad; sucursal = `0` + código BCRA de la sucursal. | p.5 (R1); p.8 (R2); p.7 y p.11 (ejemplos) | `sucursalEmpresa` devuelve CBU empresa[3:7]; `entidadSucursal` devuelve `0`+CBU[0:3] y CBU[3:7] del beneficiario; el DV sale de CBU[7]. | No para BNA. La aparente contradicción “la sucursal del CBU ya tiene 4 dígitos” se explica porque `0599` = `0` + BCRA `599`. | **Sí:** entidad = `0` + CBU[0:3]; sucursal = CBU[3:7]; DV = CBU[7]; bloque 2 = CBU[8:22]. Para R1, sucursal = CBU empresa[3:7]. | Confirmar el tratamiento de CBU de otras entidades con sucursal de 4 dígitos; no cambiar la derivación por eso. | **No inicial.** Se valida con la prueba; si hay CBU de otra entidad, incluir el caso. |
| **BNA-7** | “Fecha del día hábil anterior al previsto para la acreditación”. Formato `AAAAMMDD` por ejemplo. Sin calendario de feriados. | p.5 (regla); p.7 (ejemplo); p.14 (recordatorio) | `validarFechaCompensacionBna` exige fecha gregoriana real `AAAAMMDD`; no valida día hábil, fin de semana ni feriado. | No en la regla; el ejemplo rotula “Fecha de pago” en lugar de “Fecha compensación”. | **Parcial:** la forma y la regla están documentadas; falta calendario. La fecha la informa la empresa. | Elegir calendario de feriados y si se valida el día hábil antes de generar. | **No inicial.** Si la prueba se rechaza por fecha, consultar el calendario. |
| **BNA-8** | Campos `A`: letras `A`–`Z`, dígitos `0`–`9`; relleno con espacios a la derecha; sin tabulaciones ni caracteres especiales. | p.4 (tipo); p.7 y p.11 (ejemplos en mayúsculas) | `validarAlfabetoBna` acepta solo `A–Z`, `0–9` y espacio; rechaza minúsculas, `Ñ`, acentos, tab y CR/LF. No transforma. | No. La regla es estricta y el código la aplica. | **Sí.** | Decidir qué hacer con datos reales que no cumplen: rechazar, normalizar a mayúsculas/ASCII o corregir en origen. | **No.** |
| **BNA-9** | “Una vez finalizada la carga del último dato del registro 3, pulsar ENTER”. “Siempre el TXT tiene que estar en formato ANSI”. | p.14 | `crearSpecBna` exige `lineSeparator` y `trailingSeparator` explícitos; el perfil sintético usa CRLF + salto final; el golden técnico LF/sin salto se conserva para diagnóstico. | No en el charset: para `A–Z`/`0–9`/espacio, ANSI y ASCII son idénticos. **Sí** en CRLF vs LF y salto final. | **Parcial:** “ENTER” y “ANSI” respaldan CRLF + salto final, pero no lo dicen literalmente. | Mantener la configuración explícita y validar CRLF + salto final con la ingesta bancaria (BNA-9). | **Solo si la prueba es rechazada.** El propio archivo es la evidencia. |
| **BNA-10** | El instructivo no trata el mismo CBU en dos beneficiarios. | — | El inspector emite advertencia; no bloquea ni deduplica. | No es contradicción documental. | **No aplica:** no hay regla del banco; es un control interno. | Decidir si el caso puede ocurrir y si se bloquea. | **No.** |
| **BNA-11** | “Referencia unívoca: si no se completa dejar los espacios en blanco.” “Información criterio empresa” e “Identificación cliente beneficiario” son libres. “Datos de la empresa”: espacios si no se usa. | p.9 (campos); p.6 (criterio); p.11 (ejemplo) | `mapeo.ts` acepta la referencia vacía y el serializer la completa con 15 espacios; `infoCriterio` puede quedar vacío; identificación usa CUIL; datos de empresa usa `''`. | **No** en la referencia vacía: la corrección C-1 alineó código y documento. Queda abierto el contenido de los campos libres. | **Sí.** La referencia vacía se serializa como 15 espacios. Los demás campos ya aceptan vacío. | Decidir el contenido de los campos libres (P-17) y si la empresa exige referencia. | **No.** |

---

## 2. Detalle de los requisitos focales

### BNA-1 · Clase, tipo y número de documento con CUIL

1. **Regla documentada.** Clase `1` para clave fiscal y `2` para otros
   documentos (p.9). Tipo `96` para DNI (p.9). El ejemplo dedicado del R2 usa
   clase `1`, tipo `02` y el CUIL de 11 dígitos (p.11). El número admite CUIL o
   `000` + documento (p.9).
2. **Fuente/campo.** p.9, campos “Clase de documento”, “Tipo documento del
   beneficiario” y “Nro. Documento del beneficiario”; p.11, ejemplo dedicado;
   p.15, ejemplo compuesto.
3. **Código actual.** `spec.ts` deja `r2_tipoDocumento` en `CONFIRMADA` por el
   diseño documental, sin `fixedValue` ni default. `politica.ts` devuelve clase
   `1` + tipo `02`. `mapeo.ts` escribe siempre `String(pago.cuil)` en
   `r2_numeroDocumento`. `CONFIRMADA` no implica homologación bancaria.
4. **Contradicción real.** p.11 usa `02` con CUIL; p.15 usa `96` con CUIL. La
   regla de clase no está contradicha: `1` es clave fiscal y el CUIL es el
   identificador fiscal. p.15 es un ejemplo compuesto inconsistente (BNA-3).
5. **Resolución técnica.** Para el camino CUIL: clase `1`, tipo `02`, número
   CUIL. Es la combinación del ejemplo dedicado y la única que el modelo puede
   emitir hoy. No se usa `000` + DNI porque `PagoBna` solo contiene CUIL.
6. **Decisión interna.** Pagar por BNA solo beneficiarios con CUIL; rechazar el
   resto. Si en el futuro hay DNI, decidir si se agrega al modelo y qué
   combinación se usa.
7. **Banco.** No se pregunta inicialmente. La prueba declara la interpretación
   y el banco la acepta o la rechaza. Solo si hay beneficiarios sin CUIL se
   consulta la combinación `clase 2` + `tipo 96` + `000` + documento.

### BNA-2 · CBU del registro individual

1. **Regla documentada.** El campo es “Bloque 2 CBU cuenta a acreditar” y debe
   contener el segundo bloque del CBU de la cuenta que se acredita (p.8).
2. **Fuente/campo.** p.8, campo 5 del R2; p.11, ejemplo dedicado.
3. **Código actual.** `politica.cbuCuenta` devuelve `pago.cbu` (CBU del
   beneficiario). El mapper toma `cbu.slice(8,22)` y `cbu.slice(7,8)` para el
   DV.
4. **Contradicción real.** El texto dice “CBU de la empresa”; el ejemplo usa un
   CBU distinto del CBU de la empresa del R1: comparten entidad y sucursal, pero
   cambian el dígito verificador y el bloque 2. El ejemplo del R2 es el CBU del
   beneficiario.
5. **Resolución técnica.** Usar el CBU del beneficiario (`pago.cbu`). El R2 es
   individual y el objetivo es acreditar al empleado; copiar el CBU de la
   empresa contradice el nombre del campo y el ejemplo.
6. **Decisión interna.** Ninguna de fondo. Confirmar que el maestro del
   empleado es la fuente del CBU de destino.
7. **Banco.** No se pregunta inicialmente. Se declara en la prueba que el R2 usa
   el CBU del beneficiario; si el banco lo rechaza, el error debe indicar la
   posición 11–24.

### BNA-5 · Código de convenio

1. **Regla documentada.** Dos ceros + los 8 números del convenio. Si solo hay 4
   dígitos, completar con 4 ceros más. Campo numérico de 10 posiciones.
2. **Fuente/campo.** p.6, “Código de convenio”; p.7, ejemplo `4455` →
   `0044550000`.
3. **Código actual.** `validarConvenioBna`: 4 dígitos → `00` + 4 + `0000`; 8
   dígitos → `00` + 8; 5–7 se rechazan con `CONVENIO_LONGITUD_BNA5`.
4. **Contradicción real.** Para 4 y 8 no hay contradicción: el ejemplo confirma
   el relleno a la derecha para 4. Para 5, 6 y 7 no hay regla; el texto “2 ceros
   + los 8 números” sugeriría completar a 8, pero el ejemplo de 4 lo desmiente.
5. **Resolución técnica.** No cambiar el código para 4/8. No extrapolar 5–7.
6. **Decisión interna.** Obtener el convenio real y su cantidad exacta de
   dígitos (P-23). Si es 4 u 8, el requisito queda cerrado documentalmente.
7. **Banco.** Consulta **condicional** solo si el convenio real tiene 5, 6 o 7
   dígitos: cómo se representa en 10 posiciones.

### BNA-6 · Entidad y sucursal

1. **Regla documentada.** R1: sucursal = `0` + código BCRA. R2: entidad = `0` +
   código BCRA de la entidad; sucursal = `0` + código BCRA de la sucursal.
2. **Fuente/campo.** p.5 (R1), p.8 (R2), p.7 y p.11 (ejemplos).
3. **Código actual.** `sucursalEmpresa` devuelve CBU empresa[3:7];
   `entidadSucursal` devuelve `0` + CBU[0:3] y CBU[3:7] del beneficiario. El DV
   se toma de CBU[7].
4. **Contradicción real.** La aparente contradicción es que la sucursal del CBU
   ya tiene 4 dígitos. En los ejemplos, `0599` = `0` + BCRA `599`; la entidad
   `0011` = `0` + BCRA `011`. No hay contradicción para BNA.
5. **Resolución técnica.** Derivar del CBU: entidad = `0` + CBU[0:3]; sucursal =
   CBU[3:7]; DV = CBU[7]; bloque 2 = CBU[8:22]. Para R1, sucursal = CBU
   empresa[3:7]. Es exactamente la hipótesis ya probada en
   `POLITICA_BNA_HIPOTESIS_TECNICA`.
6. **Decisión interna.** Confirmar que se acepta esta derivación para CBU de
   otras entidades. Si la sucursal del CBU tiene 4 dígitos que no son `0` + un
   código de 3, se copia el campo de 4 dígitos del CBU; no se recorta.
7. **Banco.** No se pregunta inicialmente. La prueba puede incluir un CBU de
   otra entidad; si el banco rechaza por posición 2–9, se analiza el caso.

### BNA-7 · Fecha de compensación

1. **Regla documentada.** Informar la fecha del día hábil anterior al previsto
   para la acreditación. La acreditación se hace a primera hora del día
   siguiente. Longitud 8, numérico.
2. **Fuente/campo.** p.5, “Fecha compensación”; p.7, ejemplo `20210527`; p.14,
   recordatorio “la fecha de compensación debe ser la anterior a la que
   pretenden pagar”.
3. **Código actual.** `validarFechaCompensacionBna` exige una fecha gregoriana
   real `AAAAMMDD`. No valida día hábil, fin de semana ni feriado. El operador
   informa la fecha.
4. **Contradicción real.** El ejemplo del R1 rotula “Fecha de pago”, pero la
   regla y el campo se llaman “Fecha compensación”. Es una inconsistencia de
   etiqueta, no de regla. No hay calendario en la documentación.
5. **Resolución técnica.** Validar que sea una fecha real en formato
   `AAAAMMDD` (por ejemplo, rechazar `20260230`). La regla del día hábil queda
   documentada, pero su verificación requiere calendario.
6. **Decisión interna.** Elegir el calendario de feriados y si se valida el día
   hábil antes de generar o se deja al operador. La fecha sigue siendo un
   parámetro explícito.
7. **Banco.** No se pregunta inicialmente por el formato ni por quién calcula:
   p.5 dice que la empresa informa la fecha. Solo si la prueba se rechaza por
   fecha se consulta el calendario.

### BNA-8 · Caracteres permitidos

1. **Regla documentada.** Campos `A`: letras `A`–`Z` y dígitos `0`–`9`; relleno
   con espacios a la derecha. Sin tabulaciones ni caracteres especiales.
2. **Fuente/campo.** p.4, “Tipo”; p.7 y p.11, ejemplos en mayúsculas.
3. **Código actual.** `validarAlfabetoBna` acepta solo `A–Z`, `0–9` y espacio.
   Rechaza minúsculas, `Ñ`, acentos, tabulaciones y CR/LF. No transforma.
4. **Contradicción real.** No. La regla es estricta y el código la aplica.
5. **Resolución técnica.** No hace falta cambiar la validación para cumplir el
   instructivo. La decisión es qué hacer con datos reales que no cumplen.
6. **Decisión interna.** Elegir entre rechazar, normalizar a mayúsculas/ASCII o
   corregir en origen. Cualquier normalización debe ser explícita y auditables;
   no debe ser silenciosa.
7. **Banco.** No se pregunta. La regla está documentada.

### BNA-9 · Separador y salto final

1. **Regla documentada.** Después del último dato del R3, pulsar ENTER y
   guardar. El TXT debe estar en formato ANSI.
2. **Fuente/campo.** p.14, “Recomendaciones”.
3. **Código actual.** `crearSpecBna` exige `lineSeparator` y
   `trailingSeparator` explícitos, sin default. El perfil sintético usa CRLF +
   salto final como hipótesis BNA-9; el golden técnico LF/sin salto se conserva
   para diagnóstico.
4. **Contradicción real.** Para el charset permitido (`A–Z`, `0–9`, espacio),
   ANSI y ASCII son idénticos; no hay problema de encoding. La ambigüedad real
   es CRLF vs LF y si el último registro lleva salto.
5. **Resolución técnica.** La lectura más respaldada es CRLF + salto final:
   “ENTER” en un flujo Windows/ANSI y el ejemplo compuesto en varias líneas. No
   es una especificación literal; es una hipótesis fuerte.
6. **Decisión interna.** Adoptar CRLF + salto final como configuración canónica
   de la prueba y, si se aprueba, del harness/golden. Mantener la posibilidad de
   LF/sin salto como configuración explícita para diagnóstico.
7. **Banco.** No se pregunta inicialmente. El archivo de prueba es la evidencia:
   si es aceptado, la configuración queda validada; si es rechazado, se pide
   el motivo y la posición.

### BNA-11 · Campos libres y referencia unívoca vacía

1. **Regla documentada.** “Referencia unívoca”: si no se completa, dejar los
   espacios en blanco. “Información criterio empresa”: información adicional a
   criterio de la empresa. “Identificación cliente beneficiario”: libre
   integración. “Datos de la empresa”: espacios si no se usa.
2. **Fuente/campo.** p.9 (referencia, identificación, datos de empresa); p.6
   (criterio); p.11 (ejemplo).
3. **Código actual.** `mapeo.ts` acepta la referencia vacía y el serializer la
   completa con 15 espacios. `infoCriterio` puede quedar vacío. La identificación
   usa el CUIL. `datosEmpresa` usa `''` y el serializer lo rellena con espacios.
4. **Contradicción real.** No en la referencia vacía: C-1 alineó código y
   documento. Queda abierto el contenido de los campos libres (P-17).
5. **Resolución técnica.** Aceptar `referenciaUnivoca === ''` y serializar 15
   espacios. Mantener el rechazo para caracteres inválidos o longitud excedida.
6. **Decisión interna.** Definir el contenido de “Información criterio empresa”
   y si la empresa exige una referencia no vacía por control interno. Si la
   exige, es una política de la empresa, no una regla del banco.
7. **Banco.** No se pregunta. p.9 es explícito para la referencia; la prueba
   confirma la aceptación.

---

## 3. Clasificación de cambios

### 3.1 Correcciones respaldadas por el diseño principal

| ID | Cambio implementado | Archivo / función | Fundamento | Efecto |
|---|---|---|---|---|
| **C-1** | Aceptar referencia unívoca vacía y serializarla como 15 espacios. | `src/banks/bna/mapeo.ts`, `mapearBna` | p.9: “Si no se completa dejar los espacios en blanco”. | Deja de emitir `REFERENCIA_INVALIDA` por vacío. Sigue rechazando alfabeto y longitud. |
| **C-2** | Resolver el CBU del R2 con el CBU del beneficiario. | `src/banks/bna/politica.ts`, `cbuCuenta` | p.8, nombre del campo; p.11, ejemplo con CBU del empleado. | `cbuCuenta: (pago) => resuelto(pago.cbu)`. Nunca usa el CBU de la empresa. |
| **C-3** | Derivar entidad y sucursal del CBU. | `src/banks/bna/politica.ts`, `sucursalEmpresa` y `entidadSucursal` | p.5, p.7, p.8 y p.11; estructura del CBU. | R1 sucursal = CBU empresa[3:7]; R2 entidad = `0` + CBU[0:3]; R2 sucursal = CBU[3:7]. |
| **C-4** | Resolver documento como clase `1` + tipo `02` + CUIL. | `src/banks/bna/politica.ts`, `documento`; `spec.ts`/`contrato.ts` para el estado | p.9 (clase 1 = clave fiscal); p.11 (ejemplo 1/02/CUIL). | `documento: () => resuelto({ claseDocumento: '1', tipoDocumento: '02' })`; el número sigue siendo el CUIL. |
| **C-5** | Validar fecha real `AAAAMMDD`, no solo 8 dígitos. | `src/banks/bna/validacion.ts`, `validarFechaCompensacionBna` | p.5 (fecha) y p.7 (ejemplo `20210527`). | Rechaza `20260230`, `20211301`, etc. No implementa calendario. |

**Nota sobre C-3.** La regla “0 + código BCRA” se cumple para BNA porque el
código BCRA de entidad/sucursal es de 3 dígitos. Para otras entidades, el CBU
trae 4 dígitos en cada campo; se copian tal cual. No se recorta ni se agrega un
`0` adicional.

**Nota sobre C-4.** p.15 usa `96` con CUIL y contradice p.11. Se documenta como
BNA-3. No se usa `96` para CUIL. Si la empresa necesita pagar beneficiarios sin
CUIL, se abre una decisión específica y, si corresponde, una consulta.

### 3.2 Decisiones internas de la empresa

| ID | Decisión | Dueño | Efecto |
|---|---|---|---|
| **D-1** | Pagar por BNA solo beneficiarios con CUIL; rechazar los que no lo tengan. | RRHH / Liquidación | Cierra BNA-1 por el camino CUIL. |
| **D-2** | Obtener el convenio real y su cantidad de dígitos (P-23). | Administración | Cierra BNA-5 si es 4 u 8; abre consulta si es 5–7. |
| **D-3** | Definir el contenido de “Información criterio empresa” y si se exige referencia no vacía (P-17). | Liquidación | No cambia la regla bancaria; define la operatoria. |
| **D-4** | Elegir calendario de feriados y si se valida el día hábil anterior. | Liquidación / Administración | Cierra la parte operativa de BNA-7. |
| **D-5** | Definir la política de normalización de `Ñ`, acentos y minúsculas. | Datos / Liquidación | BNA-8 sigue rechazando; la decisión define si se normaliza antes. |
| **D-6** | Adoptar CRLF + salto final como configuración canónica de la prueba. | Tecnología | Alinea harness/golden con la lectura fuerte de BNA-9. |
| **D-7** | Definir el mapeo de descripciones de Finnegans a `0000`/`0003` (P-09/P-10). | RRHH / Liquidación | Sin esto no se puede generar un R2 productivo. |
| **D-8** | Decidir si el mismo CBU en dos beneficiarios puede ocurrir y si se bloquea. | Liquidación | BNA-10 sigue como advertencia si no se decide. |
| **D-9** | Designar responsable, suplente y canal con el banco (P-21). | Dirección | Habilita la gestión de homologación. |
| **D-10** | Definir el mecanismo de autorización productiva. | Dirección / Tecnología | No depende del banco; la compuerta sigue cerrada. |

### 3.3 Evidencia adicional necesaria

| ID | Evidencia | ¿Para qué? | ¿Es del banco? |
|---|---|---|---|
| **E-1** | Convenio real y cantidad de dígitos. | BNA-5 / P-23. | No; dato de la empresa. |
| **E-2** | Calendario oficial de feriados y días hábiles bancarios. | BNA-7, si se valida el día hábil. | Complemento oficial; no es una consulta de interpretación. |
| **E-3** | “Archivo de diseños de registros” para documentos distintos de DNI. | BNA-1, solo si hay beneficiarios sin CUIL. | Documento del banco; no se necesita hoy. |
| **E-4** | Caso de CBU de otra entidad con sucursal de 4 dígitos. | BNA-6, para confirmar la copia directa. | Se puede incluir en la prueba; no requiere pregunta previa. |
| **E-5** | Aceptación o rechazo del archivo sintético. | Todos los requisitos que afectan bytes. | Sí; es la evidencia de homologación. |

### 3.4 Cuestiones exclusivas de homologación y aceptación

| ID | Cuestión | Cómo se cierra |
|---|---|---|
| **H-1** | El banco acepta la estructura y la ingesta del TXT. | Acuse/aceptación escrita o registro del canal. |
| **H-2** | El banco acepta las interpretaciones BNA-1, BNA-2, BNA-6 y BNA-11 usadas en el archivo. | Aceptación del archivo; si hay rechazo, error con posición. |
| **H-3** | El banco acepta la fecha y el separador elegidos. | Aceptación del archivo; si hay rechazo, motivo. |
| **H-4** | El banco confirma los requisitos adicionales para producción. | Respuesta escrita posterior a la aceptación. |
| **H-5** | La empresa autoriza producción con un mecanismo no falsificable. | Checkpoint interno; no lo abre el banco. |

---

## 4. Implementado en F12-B

Los cambios siguientes quedaron aplicados y cubiertos por pruebas en F12-B.
**No** habilitan producción ni sustituyen la aceptación bancaria.

| Orden | Cambio | Archivos | Estado |
|---|---|---|---|
| 1 | C-1: referencia vacía → espacios. | `mapeo.ts` | Implementado; regresión en `correccionesC1C5.test.ts`. |
| 2 | C-2: CBU del beneficiario en R2. | `politica.ts` | Implementado; regresión por pago y por posición. |
| 3 | C-3: entidad/sucursal/DV desde CBU. | `politica.ts` | Implementado; casos con CBU BNA y de otra entidad. |
| 4 | C-4: documento 1/02/CUIL. | `politica.ts`, `spec.ts`, `contrato.ts` | Implementado; BNA-1 `CONFIRMADA` por diseño documental. |
| 5 | C-5: fecha real `AAAAMMDD`. | `validacion.ts` | Implementado; bisiestos y fechas imposibles. |
| 6 | D-6: CRLF + salto final en el harness. | `composicionHomologacionSintetica.ts` | Implementado como hipótesis BNA-9; golden técnico LF/sin salto conservado. |
| 7 | BNA-5: sin cambio de código. | — | Convenio 4/8 igual; 5–7 siguen rechazados (P-23). |
| 8 | BNA-8: sin cambio de validación. | — | Sigue rechazando minúsculas/`Ñ`/acentos; normalización pendiente. |
| 9 | BNA-9: configuración explícita. | `spec.ts` | Sin default; separador definitivo pendiente de la ingesta. |
| 10 | BNA-10: sin cambio. | — | Advertencia no bloqueante; no deduplica. |

**Lo que no cambia:** `produccionBnaHabilitada()` sigue devolviendo `false`;
`POLITICA_BNA_PRODUCTIVA` no resuelve P-09/P-10; la fachada no genera bytes
productivos; no se toca ningún layout ni posición.

---

## 5. Consultas al banco estrictamente necesarias

Después de leer la fuente principal, **no hay preguntas interpretativas que
enviar antes de la prueba**. La mayoría se resuelve con el instructivo y el
resto se valida con el archivo sintético.

| Requisito | ¿Consulta inicial? | Motivo |
|---|---|---|
| **BNA-1** | **No.** | p.11 da la combinación para CUIL. Solo condicional si hay beneficiarios sin CUIL. |
| **BNA-2** | **No.** | El nombre del campo y el ejemplo p.11 usan el CBU del beneficiario. Se declara en la prueba. |
| **BNA-3** | **No.** | Es una inconsistencia de ejemplo, no una regla. |
| **BNA-4** | **No.** | Posiciones derivadas y verificadas. |
| **BNA-5** | **Condicional.** | Solo si el convenio real tiene 5, 6 o 7 dígitos. |
| **BNA-6** | **No.** | La derivación desde CBU coincide con p.5, p.7, p.8 y p.11. Se valida con la prueba. |
| **BNA-7** | **No.** | p.5 dice que la empresa informa la fecha; el calendario es decisión interna. Solo si la prueba se rechaza. |
| **BNA-8** | **No.** | p.4 define el alfabeto; el código lo aplica. |
| **BNA-9** | **No inicial.** | “ENTER” + “ANSI” respaldan CRLF + salto final; la prueba lo confirma. Si se rechaza, se consulta. |
| **BNA-10** | **No.** | Es una decisión interna; no hay regla bancaria. |
| **BNA-11** | **No.** | p.9 permite expresamente la referencia vacía. |

**Preguntas condicionales que quedan redactadas:**

1. **Convenio de 5–7 dígitos:** “Si el código de convenio tiene 5, 6 o 7
   dígitos, ¿cómo se completa el campo de 10 posiciones? ¿Los ceros van a la
   izquierda o a la derecha?”
2. **Beneficiario sin CUIL:** “Para un beneficiario que solo tiene DNI, ¿qué
   clase y tipo de documento deben informarse y el número debe ser `000` + DNI?”
3. **Solo si la prueba es rechazada:** “¿El archivo debe usar CRLF y terminar
   con salto de línea? Si el rechazo se debe a otro motivo, indíquennos la
   posición exacta.”

---

## 6. Conclusión

1. **Se puede avanzar sin consultar al banco** en BNA-1, BNA-2, BNA-6, BNA-8,
   BNA-11 y en la forma de BNA-7. La fuente principal alcanza para fijar la
   interpretación y para construir un archivo sintético representativo.
2. **BNA-5 depende de un dato de la empresa**, no de una interpretación: el
   convenio real y su cantidad de dígitos. Si es 4 u 8, no hay consulta.
3. **BNA-7 y BNA-9 tienen una parte operativa** (calendario y separador) que es
   decisión interna y se valida con la prueba. No son preguntas de formato.
4. **BNA-11 quedó corregido:** la referencia vacía se acepta y se serializa
   como 15 espacios. No requirió decisión bancaria.
5. **BNA-1 `CONFIRMADA` es una confirmación documental.** Se deduce de p.11
   (clase `1`, tipo `02`, CUIL) y no de una homologación ni de una aceptación
   del banco.
6. **La homologación sigue pendiente.** Ninguna de estas conclusiones reemplaza
   la aceptación del banco. La prueba sintética es el siguiente paso; la
   producción sigue cerrada por diseño.

**Próximo checkpoint:** F12-B cerrado localmente. Falta enviar el archivo
sintético con su manifiesto, registrar la respuesta bancaria y resolver los
pendientes que condicionan la homologación (P-09/P-10, P-23, BNA-7, BNA-8,
BNA-9 y el contenido de campos libres).
