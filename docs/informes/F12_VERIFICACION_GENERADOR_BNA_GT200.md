# F12 · Verificación técnica y documental del generador Banco Nación GT200

**Rama:** `f9-ui-flujo-guiado` · **HEAD de referencia:** `c52f2e2` ·
**Fecha:** 12-11-2026.

**Estado:** revisión de solo lectura. Este informe **no homologa**, **no autoriza
producción**, **no modifica** código, contratos, layouts, pruebas ni goldens. La
aplicación sigue **NO apta para pagos reales**.

> **Conclusión breve.** Banco Nación está técnicamente implementado y cubierto por
> pruebas de contrato, mapper, serialización, inspección, fachada, perfil y
> selecciones. El contrato sigue **bloqueado por BNA-1** y por interpretaciones
> abiertas; no hay evidencia de aceptación bancaria y la producción está cerrada
> por construcción. `npm run verify` en verde demuestra regresión técnica, **no**
> homologación.

---

## 1. Estado real del generador

### 1.1 Qué existe hoy

| Capa | Estado | Evidencia principal |
|---|---|---|
| Contrato documental y spec | Implementado | `src/banks/bna/contrato.ts`, `spec.ts`; 3 tipos de registro, 47 campos, 200 bytes |
| Aptitud contractual | Implementado | `aptitud.ts`; solo los bloqueos `B` impiden habilitar; hoy BNA-1 |
| Política bancaria | Implementado como frontera explícita | `politica.ts`; sin resolución para BNA-1, BNA-2, BNA-6 y P-09/P-10; P-17 provisional |
| Modelo puro | Implementado | `modelo.ts`; `PerfilBna`, `PagoBna`, `ParametrosEnvioBna` |
| Mapper | Implementado | `mapeo.ts`; R1 + R2* + R3, totales sobre la misma lista |
| Totales y límites | Implementado | `totales.ts`; `Centavos`/`bigint`, sin `Number`/float |
| Serializador | Implementado | `serializacion.ts`; delega en la API pública de fixed-width |
| Inspector independiente | Implementado | `inspeccion.ts`; relee bytes y verifica invariantes |
| Fachada de generación | Implementado, cerrado a producción | `src/run/generacionBna.ts`; compuertas y unión discriminada de resultados |
| Perfil v2/v3 y formulario | Implementado | `src/profile/**`; configuración BNA común a v2/v3 |
| Selección `0000`/`0003` | Mecanismo implementado | `seleccionIdentificadorHaberes.ts`; catálogo cerrado y selección explícita |
| Cobertura por `SourceRef` | Implementado y probado | `lineasBancariasEfectivas.ts`; corrección F10-B |
| Generación productiva | **NO habilitada** | `produccionBnaHabilitada()` devuelve siempre `false` |

### 1.2 Los cuatro niveles que no deben confundirse

1. **Implementación técnica:** existe y tiene pruebas.
2. **Generación técnica posible:** se puede componer en memoria con políticas
   sintéticas de test y con el harness de hipótesis; no usa datos reales.
3. **Homologación bancaria:** **no existe**. No hay archivo enviado ni aceptado
   por Banco Nación en la evidencia disponible.
4. **Autorización productiva:** **no existe**. La compuerta
   `produccionBnaHabilitada()` está cerrada por diseño y no depende del perfil,
   de los parámetros ni de una variable de entorno.

### 1.3 Documentación GT200 y trazabilidad

- La fuente principal es `references/BNA_Instructivo_Pago_Haberes_GT.pdf`, de 16
  páginas. Es documentación oficial del banco para el convenio de Pago de
  Haberes; no es el instructivo de Proveedores/Terceros.
- El PDF **no está versionado**: `references/*` está ignorado por `.gitignore`.
  Su SHA-256 local es
  `d28ffbcc3cae01d56b48c8416d44c22a03d53b682800381b7a7d8dabe88f2f56`, que
  coincide con el registrado en `docs/07_DECISIONES_Y_PENDIENTES.md`.
- La consolidación documental está en `docs/04_CONTRATOS_BANCARIOS.md` §2.1–§2.3
  y en `docs/informes/F5_BANCO_NACION.md`. Las posiciones se derivaron por suma
  acumulada de longitudes (D-023), no porque el PDF traiga una columna de
  posiciones; se verificaron contra los ejemplos de las páginas 7, 11, 14 y 15.
- **No hay respuestas escritas de Banco Nación en el repositorio.**
  `docs/informes/F7_CONSULTAS_BANCARIAS.md` registra CP-F7-B (“Respuestas BNA”)
  como **no iniciado**. La ausencia de una respuesta en el repositorio **no
  prueba** que el banco no haya respondido: solo indica que no hay evidencia
  escrita disponible localmente.
- En este informe, “confirmado” significa **confirmado documentalmente en el
  instructivo o por una decisión interna aprobada**, no “homologado por el
  banco”. Una respuesta escrita del banco y una aceptación de archivo son
  evidencias distintas.

---

## 2. Matriz de requisitos y evidencia

**Clasificación usada:**

- **Confirmado e implementado:** la fuente documental o la decisión interna
  aprobada existe y el código la aplica.
- **Confirmado pero no implementado:** la fuente existe, pero el código no la
  aplica o aplica una regla más estricta.
- **Implementado provisionalmente:** hay código, pero depende de una hipótesis,
  de una decisión interna no homologada o de un valor de test.
- **Pendiente de evidencia bancaria:** falta respuesta, instructivo actualizado
  o prueba de ingesta del banco.
- **Pendiente de decisión empresarial:** falta un dato, un mapeo o una
  autorización de la empresa/RRHH.

### 2.1 Layout y campos

| Requisito y fuente | Evidencia | Implementación | Clasificación |
|---|---|---|---|
| Tres tipos de registro: R1 cabecera, R2 individual, R3 fin; 200 bytes cada uno (BNA p.2–4, 8, 12; docs/04 §2.2) | `spec.ts`: 3 registros, 47 campos (15/19/13); `spec.test.ts`; golden de 4 registros y 803 bytes | Geometría completa y validada por F4 | **Confirmado e implementado** |
| Posiciones y longitudes derivadas por suma acumulada (D-023; docs/04 §2.2) | Cada campo declara inicio/fin y longitud; cierran en 200 en los tres registros | `spec.ts`, `validacion.ts`, tests de geometría | **Confirmado e implementado** |
| R1: tipo `1`, `SUE`, clase `1`, sistema original, fillers, casa de envío (p.5–6) | Valores fijos en la spec | `spec.ts` con `fixedValue` | **Confirmado e implementado** |
| R1: CUIT de la empresa, bloque 2 del CBU empresarial, moneda `0`/`1` (p.5) | Perfil v2/v3 y mapper | `perfilBnaDesdePerfil`, `mapeo.ts`; `validarMonedaBna` | **Confirmado e implementado** |
| R1: sucursal de la cuenta de la empresa (p.5, 7; BNA-6) | “0 + código BCRA”; el ejemplo coincide con los dígitos 4–7 del CBU | `POLITICA_BNA_PRODUCTIVA` devuelve `SIN_RESOLUCION('BNA-6')`; la hipótesis toma los dígitos 4–7 del CBU empresarial y no se usa desde la fachada | **Pendiente de evidencia bancaria** |
| R1: fecha de compensación (p.5, 7, 14; BNA-7) | “Día hábil anterior”; formato `AAAAMMDD` solo por ejemplo; sin calendario de feriados | `validarFechaCompensacionBna` valida 8 dígitos; el operador aporta la fecha; no se calculan días hábiles | **Pendiente de evidencia bancaria** (forma implementada, regla no) |
| R1: información criterio empresa (p.6, 7; BNA-11) | Campo libre de 20; obligatoriedad/vacío no confirmados | P-17 provisional toma `parametros.infoCriterioEmpresa`; puede quedar vacío | **Implementado provisionalmente** |
| R1: código de convenio (p.4, 6, 7, 15; BNA-5) | 4 dígitos → `00` + 4 + `0000`; 8 dígitos → `00` + 8; 5–7 no definidos; relleno a derecha contra la regla `N` general | `validarConvenioBna` implementa 4 y 8 y **rechaza** 5–7; el valor real y sus dígitos dependen de la empresa (P-23) | **Pendiente de evidencia bancaria + decisión empresarial** |
| R1: número de envío (p.6) | `1` primer envío del día, `2` segundo; campo de 6 dígitos | `validarNumeroEnvioBna` acepta dígitos de longitud ≤ 6; no impone la convención 1/2 ni correlatividad | **Confirmado e implementado** (campo y validación; la semántica 1/2 queda a cargo del operador) |
| R2: tipo `2`, estado `00`, campos link, sucursal original, observaciones, filler (p.8–10) | Valores fijos | `spec.ts` con `fixedValue` | **Confirmado e implementado** |
| R2: entidad y sucursal a acreditar (p.8, 11; BNA-6) | “0 + código BCRA” vs. dígitos del CBU; el ejemplo no desambigua | `POLITICA_BNA_PRODUCTIVA` devuelve `SIN_RESOLUCION('BNA-6')`; la hipótesis `0` + dígitos 1–3 y sucursal = dígitos 4–7 no se usa desde la fachada | **Pendiente de evidencia bancaria** |
| R2: dígito verificador del bloque 1 del CBU (p.8) | Último dígito del bloque 1 (posición 8) | `mapeo.ts` usa `cbu.slice(7, 8)` | **Confirmado e implementado** |
| R2: bloque 2 del CBU de la cuenta a acreditar (p.8, 11; BNA-2) | El texto dice “CBU de la empresa”; el ejemplo usa el CBU del beneficiario | `politica.cbuCuenta` devuelve `SIN_RESOLUCION('BNA-2')`; nunca se copia el CBU de origen por defecto | **Pendiente de evidencia bancaria** |
| R2: importe en centavos (p.8, 11) | 8 enteros + 2 decimales; máximo `9.999.999.999` centavos | `mapeo.ts` usa `pago.neto`; `totales.ts` valida límite | **Confirmado e implementado** |
| R2: referencia unívoca (p.9) | “A criterio de la empresa; espacios si no se completa” | `mapeo.ts` **rechaza** el valor vacío con `REFERENCIA_INVALIDA`; no acepta la opción “espacios si no se completa” | **Confirmado pero no implementado** (implementación más estricta) |
| R2: identificación del beneficiario y datos de la empresa (p.9, 11; BNA-11) | Campo libre; datos de empresa “espacios si no se usa” | P-17 provisional: CUIL validado y `datosEmpresa: ''`; no hay confirmación bancaria del vacío | **Implementado provisionalmente** |
| R2: número de documento del beneficiario con CUIL (p.9, 11) | CUIL de 11 dígitos | `mapeo.ts` usa `String(pago.cuil)`; `PagoBna` exige un CUIL ya validado | **Confirmado e implementado** |
| R2: variante `000` + documento del beneficiario (p.9, 11) | Alternativa documentada para quien no se identifica por CUIL | No es representable: `PagoBna` exige `Cuil` y el mapper siempre emite 11 dígitos | **Confirmado pero no implementado** |
| R2: clase y tipo de documento (p.9, 11, 15; BNA-1) | `96` para DNI vs. clase `1` + tipo `02` + CUIL vs. clase `1` + tipo `96` + CUIL; otros códigos en documento no disponible | El campo está `BLOQUEADA`; la política no elige `02` ni `96`; no hay `fixedValue` ni default. La hipótesis `1`/`02` solo la usa el harness sintético, no la fachada | **Pendiente de evidencia bancaria** (bloqueo `B`) |
| R2: identificador de préstamo `0000`/`0003` (p.10; P-09/P-10) | `0000` haberes ordinarios (considera cuotas de préstamos); `0003` extraordinarios (no las considera) | Catálogo cerrado y selección explícita B1/B2. `POLITICA_BNA_PRODUCTIVA` devuelve `SIN_RESOLUCION('P-09/P-10')`; la fachada superpone `politicaBnaDesdeResolucionIdentificadorHaberesBna`, que resuelve solo con snapshot completo y revalidado | **Confirmado e implementado** (catálogo y mecanismo; la política productiva sola no resuelve) |
| R2: asignación de cada descripción de Finnegans a `0000`/`0003` (P-09) | La muestra tiene Agrario, Comercio, Directivos y Liq. Final; no hay equivalencia bancaria | Sin inferencia ni default; una descripción sin selección bloquea (`LIQUIDACION_SIN_MAPEO` o `SIN_RESOLUCION('P-09/P-10')`) | **Pendiente de decisión empresarial** |
| R3: total de importe, total de cantidad, aceptados/rechazados/comisiones/IVA/retenciones y filler (p.12–13) | Totales derivados de la misma lista de pagos; los demás campos en cero/espacios | `mapeo.ts` y `totales.ts`; inspector recalcula desde bytes | **Confirmado e implementado** |
| Límites de importe, total y cantidad (p.8, 12; docs/04 §2.3) | `9.999.999.999` centavos por R2; `999.999.999.999.999` centavos de total; `9.999.999` registros | `totales.ts`; errores `NETO_EXCEDE_LAYOUT`, `TOTAL_EXCEDE_LAYOUT`, `CANTIDAD_EXCEDE_LAYOUT` | **Confirmado e implementado** |

### 2.2 Formato, integración y controles

| Requisito y fuente | Evidencia | Implementación | Clasificación |
|---|---|---|---|
| Alfabeto `A`: A–Z, 0–9 y espacio; sin especiales (p.4; BNA-8) | Validación estricta; no transforma mayúsculas, `Ñ`, acentos ni signos | `validarAlfabetoBna` y `validarTextoBna`; rechazan en vez de inventar una normalización | **Confirmado e implementado** (validación) |
| Política de mayúsculas, `Ñ`, acentos y minúsculas (BNA-8) | El ejemplo usa mayúsculas, pero no hay regla de transformación | No hay `toUpperCase`, transliteración ni remoción de acentos | **Pendiente de evidencia bancaria / decisión** |
| Separador de línea y salto final (p.14; BNA-9) | “Pulsar ENTER” implica salto final; no se especifica CRLF/LF; el golden LF sin salto final es una hipótesis de test | `crearSpecBna` exige `lineSeparator` y `trailingSeparator` explícitos, sin default | **Pendiente de evidencia bancaria** |
| Inspector independiente | Relee bytes con F4 y verifica estructura, longitudes, alfabeto, totales y cantidad; no confía en los modelos de generación | `inspeccionarBna`; `BNA-10` se informa como advertencia no bloqueante | **Implementado** (control técnico interno) |
| Mismo CBU repetido entre beneficiarios (BNA-10) | El instructivo no lo trata | El inspector agrupa identidades y emite advertencia; no deduplica ni elimina pagos | **Implementado provisionalmente** |
| Perfil v2/v3 con sección BNA común (D-079, D-087) | CUIT, CBU empresa, convenio y moneda; v1 no es compatible y no se migra | `src/profile/**`, `perfilBnaDesdePerfil`; formulario con CBU, convenio 4/8 y moneda | **Confirmado e implementado** (decisión interna) |
| Selección B1/B2 por descripción exacta y `SourceRef` | Catálogo `0000`/`0003`, sin selección automática; snapshot con huella y revisión | `seleccionIdentificadorHaberes.ts`, `seleccionIdentificadorHaberesBna.ts`; UI y tests | **Confirmado e implementado** (mecanismo) |
| Cobertura de filas reasignadas desde banco vacío (F10-B) | La fila conserva su `SourceRef`; no se muta la línea original; no se hereda al otro banco | `lineasBancariasEfectivas` y `lineasBancariasEfectivasDeConciliacion`; 5 tests F10-B | **Implementado y probado** |
| Control de cobertura de pagos | Compara asignadas, convertidas, `global.bna` y `readiness.asignadas`; refs únicas, orden, datos y totales | `analizarCoberturaPagosBna`, `coberturaPagosBna`; tests de omisión, duplicación, reordenamiento e importes intercambiados | **Implementado** (control interno) |
| Compuerta de producción | `produccionBnaHabilitada()` siempre `false`; `GENERADO` inalcanzable desde la API pública | `autorizacion.ts`, `generacionBna.ts`; no hay flag, evidencia ni variable que la abra | **Implementado** (cierre por diseño) |
| Golden técnico sintético | 2 pagos, 4 registros (R1 + 2 R2 + R3), 803 bytes, total `84000050`, LF sin salto final, SHA-256 `c883ef4e50f3962ecb09a2638728ea0d583a7e1c873e19eb1314e5fc47d9e3a6` | `bna-tecnico-sintetico.json`; usa política sintética de test, no la fachada productiva | **Implementado** (regresión técnica, **no homologación**) |
| Aceptación bancaria y homologación | No hay archivo enviado, acuse, fecha, hash de aceptación ni respuesta BNA en el repositorio | No existe | **Pendiente de evidencia bancaria** |

### 2.3 Requisitos documentales que no afectan bytes

- **BNA-3 (ejemplos inconsistentes):** el ejemplo de p.11 muestra `00` en
  posiciones 80–81 donde la descripción indica espacios; el de p.14 declara una
  cantidad que no coincide con la leyenda; el compuesto de p.15 no cierra sus
  totales. Está **documentado** y no afecta bytes: los ejemplos sirven para
  verificar posiciones, no como golden files.
- **BNA-4 (posiciones derivadas):** **confirmado e implementado** por D-023 y por
  los tests de geometría.
- **P-18 (fuentes oficiales ARCA/BCRA):** los algoritmos de CUIL y CBU son
  estándares externos, no reglas del instructivo BNA. La fuente oficial sigue
  pendiente; no se le atribuyen al banco.

---

## 3. Qué está terminado

1. **Contrato y spec:** 3 tipos de registro, 47 campos, 200 bytes, posiciones
   verificadas, estados `C`/`I`/`B` y trazabilidad a páginas del instructivo.
2. **Aptitud contractual:** `aptitudBna` detecta solo bloqueos `B`; no convierte
   una `I` en `B`; informa interpretaciones que afectan bytes y las que no.
3. **Perfil v2/v3:** configuración BNA común, sin migración desde v1, con CBU,
   convenio y moneda; el formulario valida 4 u 8 dígitos de convenio.
4. **Mapper:** R1 + R2* + R3 determinista, sin I/O ni defaults; deriva el DV y
   el bloque 2 del CBU que resuelve la política; calcula totales sobre la misma
   lista que serializa.
5. **Totales y límites:** `Centavos`/`bigint`, sin punto flotante; límites de
   importe, total y cantidad.
6. **Serialización:** usa la API pública de fixed-width; no importa internals;
   no serializa parcialmente.
7. **Inspector:** relee bytes, valida estructura, longitudes, alfabeto, totales,
   cantidad y límite de total; BNA-10 como advertencia.
8. **Fachada:** compone perfil, conciliación, readiness, aptitud, política,
   mapper, serializador e inspector; no expone política, aptitud, serializer ni
   inspector en la entrada pública.
9. **Cobertura:** control integral contra el conjunto asignado, no solo contra
   los R2 emitidos; detecta omisiones, duplicados, reordenamientos, CBU/CUIL
   sustituidos e importes intercambiados.
10. **Selecciones B1/B2:** catálogo cerrado `0000`/`0003`, selección explícita por
    descripción exacta, sin inferencia; snapshot con huella y revisión; una
    selección parcial no resuelve nada.
11. **F10-B:** las filas con banco vacío reasignadas manualmente participan por
    `SourceRef` exacta, sin mutar la línea original ni heredar la selección al
    otro banco.
12. **Pruebas y guardrails:** suite completa, golden sintético, aislamiento de
    capas, `check:sensitive`, build y `check:dist`.

---

## 4. Qué falta implementar

Nada de esta lista se implementó en F12. El orden importa: primero la evidencia,
después el código.

1. **Política BNA-1:** elegir clase y tipo documental con una regla bancaria
   confirmada; hoy no hay `02`, `96` ni default.
2. **Política BNA-2:** decidir si el bloque 2 del R2 usa el CBU del beneficiario
   o el de la empresa; no copiar el CBU de origen por defecto.
3. **Política BNA-6:** definir entidad y sucursal del R1 y del R2 (código BCRA o
   dígitos del CBU), sin reutilizar la hipótesis del harness.
4. **BNA-5/P-23:** representar convenios de 5, 6 y 7 dígitos si el banco lo
   confirma; incorporar el convenio real y su cantidad de dígitos.
5. **BNA-7:** definir formato, cálculo del día hábil anterior, fines de semana y
   feriados; hoy la fecha es un parámetro explícito y solo se valida su forma.
6. **BNA-8:** decidir la política de normalización (mayúsculas, `Ñ`, acentos,
   minúsculas) o mantener el rechazo; no transformar sin decisión.
7. **BNA-9:** elegir separador y salto final productivos, o validar por ingesta;
   hoy no hay default.
8. **BNA-11/P-17:** confirmar obligatoriedad/vacío de información criterio,
   identificación y datos de empresa; revisar la referencia unívoca vacía, que
   hoy se rechaza aunque el documento permite espacios. Si la empresa necesitara
   beneficiarios sin CUIL, falta además habilitar la variante `000` + documento
   del R2: hoy `PagoBna` exige un CUIL validado y el mapper siempre emite 11
   dígitos.
9. **P-09:** mapear cada descripción exacta de Finnegans a `0000`/`0003` por
   decisión de empresa/RRHH; el mecanismo B1/B2 ya existe, el contenido no.
10. **Endurecimiento del identificador de préstamo:** el mapper valida 4 dígitos,
    pero no el catálogo; la producción queda protegida por la selección, no por
    una validación de catálogo en el mapper.
11. **Parámetros de envío en la UI:** fecha de compensación, número de envío,
    información criterio y referencia unívoca no se capturan en la UI; hoy solo
    existen como entrada de la fachada. D-065 difirió deliberadamente esa captura
    en F3; para producción hace falta una vía explícita, sin defaults.
12. **Flujo de materialización y envío:** no hay descarga productiva, nombre de
    archivo, registro de hash, confirmación humana ni canal de envío; el único
    flujo existente es la descarga sintética, explícitamente no productiva.
13. **Mecanismo de autorización:** la compuerta actual es `false` por
    construcción; una habilitación futura requiere un mecanismo no falsificable y
    un checkpoint propio.
14. **Conciliación documental:** corregir F5/F7 donde afirman que
    `POLITICA_BNA_PRODUCTIVA` sigue sin resolver BNA-11/P-17; el código actual
    resuelve P-17 de forma provisional (ver §7).

---

## 5. Qué necesita confirmación bancaria

| ID | Pregunta concreta | Por qué importa | Comportamiento actual |
|---|---|---|---|
| **BNA-1** | ¿Qué clase y tipo de documento corresponden a un beneficiario identificado por CUIL? ¿`02`, `96` u otro? | Define posiciones 72–74 y es el único bloqueo `B` | Sin resolución; sin default; la hipótesis `1`/`02` solo la usa el harness sintético |
| **BNA-2** | ¿Las posiciones 11–24 del R2 son el CBU del beneficiario o el de la empresa? | Define el destino real de la acreditación | Sin resolución; nunca se copia el CBU de origen por defecto |
| **BNA-5** | ¿Cómo se representan convenios de 5, 6 y 7 dígitos? ¿Se confirma el relleno a derecha para 4 dígitos? | Define posiciones 64–73 | 4 y 8 implementados; 5–7 rechazados |
| **BNA-6** | ¿Entidad y sucursal se derivan del “código BCRA” o de los dígitos del CBU? ¿Qué pasa con la sucursal de la empresa? | Define posiciones 13–16, 2–5 y 6–9 | Sin resolución; la hipótesis solo la usa el harness sintético, no la fachada |
| **BNA-7** | ¿Qué calendario de feriados rige? ¿Quién determina el día hábil anterior? ¿Se confirma `AAAAMMDD`? | Define posiciones 32–39 | Solo forma de 8 dígitos; el operador aporta la fecha |
| **BNA-8** | ¿Qué hacer con minúsculas, `Ñ`, acentos y signos? ¿El banco normaliza o rechaza? | Define la validación y el rechazo de datos | Se rechaza lo que no sea A–Z/0–9/espacio; no se transforma |
| **BNA-9** | ¿CRLF o LF? ¿El R3 debe terminar con salto? | Define los bytes de unión y la ingesta | Separador y salto son parámetros explícitos, sin default |
| **BNA-10** | ¿El banco acepta el mismo CBU para dos beneficiarios distintos? | Puede afectar la validación, no los bytes | Advertencia del inspector; no bloquea ni deduplica |
| **BNA-11** | ¿Información criterio e identificación del beneficiario pueden ir vacías? ¿Qué contenido y longitud se esperan? | Define posiciones 40–59 y 50–71 | P-17 provisional: criterio explícito, CUIL y datos de empresa vacíos |
| **Aceptación** | ¿El banco acepta un archivo de prueba completo y con qué observaciones? | Es la única prueba de homologación | No hay archivo enviado ni acuse en el repositorio |

**No son preguntas bancarias:** P-09 (qué descripción interna corresponde a
`0000`/`0003`), P-17 (qué contenido usar en los campos libres), P-23 (cuántos
dígitos tiene el convenio real) y la autorización interna de producción. Son
decisiones de empresa/RRHH o de gobierno del proyecto.

---

## 6. Qué datos debe aportar la empresa

| Dato | Uso | Estado |
|---|---|---|
| CUIT de la empresa | R1 identificación empresa | Requerido por el perfil |
| CBU de la cuenta empresarial | R1 bloque 2 y derivaciones BNA-6 | Requerido por el perfil |
| Código de convenio real y cantidad de dígitos | R1 posiciones 64–73; BNA-5/P-23 | **Pendiente**; hoy solo se aceptan 4 u 8 |
| Moneda de la cuenta (`0`/`1`) | R1 moneda | Requerido por el perfil |
| CUIL y CBU de cada empleado | R2 número de documento y CBU | Deben provenir del maestro validado |
| Neto a acreditar por empleado | R2 importe y totales | Debe provenir de Finnegans/conciliación |
| Descripción exacta de cada liquidación | Selección `0000`/`0003` (P-09) | **Pendiente de decisión de RRHH** |
| Fecha de compensación | R1 fecha; debe ser el día hábil anterior | La aporta el operador; falta calendario |
| Número de envío | R1 posiciones 74–79 | La aporta el operador; no hay catálogo ni correlatividad automática |
| Información criterio empresa | R1 posiciones 40–59 | La aporta el operador; contenido P-17 abierto |
| Referencia unívoca | R2 posiciones 35–49 | La aporta el operador; hoy no se acepta vacía |
| Separador y salto final | Bytes de unión | **Pendiente de confirmación/ingesta** |
| Autorización de producción | Compuerta independiente | **No existe**; no se abre con datos |

---

## 7. Riesgos y contradicciones

1. **No hay evidencia de respuesta BNA.** Solo existe el instructivo; no hay
   correo, acuse, fecha ni respuesta a las consultas BNA-1 a BNA-11. La ausencia
   en el repositorio no prueba silencio del banco, pero impide cerrar el contrato.
2. **BNA-1 es una contradicción interna del instructivo.** p.9 propone `96` para
   DNI; p.11 usa clase `1` + tipo `02` + CUIL; p.15 usa clase `1` + tipo `96` +
   CUIL. Es el único bloqueo `B` y, por sí solo, impide habilitar el generador.
3. **BNA-2 contradice texto y ejemplo.** El texto dice “CBU de la empresa”; el
   ejemplo usa el CBU del beneficiario. Elegir por inferencia podría acreditar en
   la cuenta equivocada.
4. **BNA-6 no está desambiguado.** “0 + código BCRA” y “dígitos del CBU” pueden
   coincidir en el ejemplo y diferir en la práctica; afecta R1 y R2.
5. **BNA-5 tiene dos problemas.** El relleno a derecha para 4 dígitos contradice
   la regla general `N` de ceros a la izquierda, y 5–7 dígitos no están
   definidos. El código rechaza esos casos en vez de inventar.
6. **BNA-7 no tiene calendario.** El formato `AAAAMMDD` surge de un ejemplo, no
   de una regla; no hay feriados ni criterio para el día hábil anterior.
7. **BNA-8 no tiene política de normalización.** Rechazar minúsculas, `Ñ` y
   acentos es seguro, pero puede bloquear datos reales; transformarlos sin
   decisión también sería inventar.
8. **BNA-9 no está confirmado.** El golden LF sin salto final es una hipótesis de
   test; no es una regla bancaria.
9. **BNA-11/P-17 son provisionales.** `infoCriterio` puede ir vacío, la
   identificación usa CUIL y `datosEmpresa` queda vacío; nada de eso está
   confirmado por el banco.
10. **La referencia unívoca vacía está documentada como permitida, pero el mapper
    la rechaza.** `docs/04` §2.2 dice “espacios si no se completa”; `mapeo.ts`
    devuelve `REFERENCIA_INVALIDA`. Es una divergencia real entre documento y
    código, no una interpretación bancaria.
11. **La documentación F5/F7 está desactualizada respecto de P-17.**
    `F5_BANCO_NACION.md` §6 y `F7_BNA_DEFINICIONES.md` §1 afirman que
    `POLITICA_BNA_PRODUCTIVA` sigue devolviendo `SIN_RESOLUCION` para
    BNA-11/P-17; `politica.ts` ya resuelve provisionalmente `infoCriterio` y
    `camposBeneficiario`. `F7_D1_A_HARNESS_SINTETICO.md` sí lo documenta. La tabla
    de “Puntos que siguen sin resolución” de F7 se refiere a la política de
    hipótesis, no a la productiva, y no presenta la misma contradicción. No es
    un cambio de código de F12, pero debe corregirse para que el estado
    documental no induzca a error.
12. **El identificador de préstamo no se valida contra catálogo en el mapper.**
    `codigoExacto` solo exige 4 dígitos. La producción está protegida porque la
    política devuelve `0000`/`0003` desde el snapshot, pero una política futura
    podría devolver otro código y el mapper lo aceptaría.
13. **La convención 1/2 del número de envío no está modelada.** Se aceptan
    dígitos de longitud ≤ 6; si el banco exige correlatividad o un rango, falta
    definirlo.
14. **La cobertura trata toda fila `EXCLUIDA` como exclusión legítima.** Hoy solo
    existe `NETO_CERO`; si se agregan otros motivos de exclusión, el control
    podría dejar de detectar una omisión.
15. **La revisión B1/B2 es un checksum estable, no criptográfico.** Sirve para
    detectar deriva entre conciliación y evaluación, no para resistir una
    manipulación adversarial; la autorización productiva no debe depender de él.
16. **El golden sintético puede malinterpretarse.** Usa una política de test que
    resuelve `1`/`02`, CBU del beneficiario y `0000`. Su etiqueta es explícita
    (“NO HOMOLOGADO POR BANCO NACIÓN”); no es un archivo aceptado ni una regla
    bancaria.
17. **La compuerta de producción es independiente del contrato.** Aunque BNA-1 se
    resolviera, `produccionBnaHabilitada()` seguiría en `false`; abrirla exige un
    mecanismo no falsificable y un checkpoint propio, no un cambio de estado
    contractual.
18. **No hay flujo productivo en la UI.** La UI solo configura el perfil y aplica
    selecciones; no captura parámetros de envío ni genera/descarga un TXT real.
    Agregar ese flujo sin autorización sería una regresión de seguridad.
19. **Privacidad:** los datos reales de empleados, CBU, CUIL y nóminas no deben
    versionarse. El instructivo y los TXT reales se conservan localmente; la
    evidencia que se versione debe estar sanitizada.

---

## 8. Resultado de pruebas

### 8.1 Pruebas específicas de Banco Nación

Se ejecutaron los 23 archivos de pruebas BNA/F10-B/UI relacionados:

- `tests/unit/banks/bna/**`: contrato, spec, aptitud, autorización, validación,
  totales, mapper, serialización, inspector, política P-17, hipótesis y
  trazabilidad.
- `tests/unit/run/generacionBna*.test.ts`: fachada, cobertura, autorización,
  ramas técnicas, política productiva y B2.
- `tests/unit/run/seleccionIdentificadorHaberesBna*.test.ts`: catálogo,
  snapshot, revisión e invalidación.
- `tests/integration/generacionBna.integracion.test.ts`: perfil, conciliación,
  fachada y golden.
- `tests/unit/run/f10bCoberturaReasignados.test.ts`: cobertura de filas
  reasignadas por `SourceRef`.
- `tests/unit/ui/PanelIdentificadorHaberesBna.test.tsx` y
  `tests/unit/ui/orquestacionBnaB2.test.ts`.

**Resultado:** **23 archivos / 233 tests, todos verdes.**

### 8.2 Verify completo

`npm run verify` se repitió el 12-11-2026 sobre el mismo HEAD y finalizó **OK**:

- Typecheck, lint, `format:check` y `check:sensitive`: sin fallos.
- Suite: **127 archivos / 1719 tests**.
- Cobertura global: **90,68 % statements / 86,24 % branches / 89,97 %
  functions / 91,26 % lines**.
- `src/banks/bna/**`: **98,85 / 96,69 / 100 / 98,81**.
- `src/run/generacionBna.ts`: **100 / 100 / 100 / 100**.
- Build y `check:dist`: **OK**.
- Playwright: **28/28**.

### 8.3 Golden sintético

- 2 pagos; 4 registros (R1 + 2 R2 + R3); 803 bytes.
- Total `84000050` centavos.
- LF, sin salto final.
- SHA-256 `c883ef4e50f3962ecb09a2638728ea0d583a7e1c873e19eb1314e5fc47d9e3a6`.
- Se genera con `serializarBna` + `inspeccionarBna` y una política sintética de
  test; no atraviesa la fachada productiva.
- **No es homologación ni archivo aceptado por el banco.**

### 8.4 Qué prueban y qué no prueban las pruebas

**Prueban:** geometría, estados, mapper determinista, totales exactos, límites,
serialización, inspección independiente, compuertas, cobertura, selecciones,
invalidación por huella/revisión, filas reasignadas y regresión del golden.

**No prueban:** que el banco acepte el archivo; que BNA-1/BNA-2/BNA-6 estén
resueltos; que el calendario de feriados sea correcto; que el separador elegido
sea el que el banco ingiere; que el convenio real sea válido; que la empresa haya
autorizado producción. Un test verde no reemplaza una respuesta bancaria.

---

## 9. Plan mínimo para completar Banco Nación

| Paso | Depende de | Entregable | Criterio de salida |
|---|---|---|---|
| **0. Congelar y conciliar documentación** | Nada | Este informe F12; corrección de F5/F7 sobre P-17; matriz de estados actualizada | Un solo estado documental coherente; sin cambios de código |
| **1. Obtener evidencia bancaria** | Banco Nación | Respuestas escritas a BNA-1, BNA-2, BNA-5, BNA-6, BNA-7, BNA-8, BNA-9, BNA-10, BNA-11; instructivo actualizado si existe | Cada `B`/`I` byte-affecting con fuente, fecha y alcance; sin inferencias |
| **2. Obtener datos de empresa** | Empresa/RRHH | Convenio real y dígitos (P-23), CBU/CUIT/moneda, mapeo de descripciones (P-09), parámetros de envío | Perfil y selección completos; ningún default silencioso |
| **3. Implementar resoluciones** | Pasos 1 y 2 | Política BNA-1/2/6, convenio 5–7 si aplica, fecha/calendario, normalización, separador, P-17, referencia opcional y mapeo P-09 | Cada regla con test y sin valores inventados |
| **4. Ampliar pruebas** | Paso 3 | Tests de contrato, mapper, serialización, inspección, fachada, perfil y selección para cada decisión | Cobertura y regresión verdes; ningún golden existente alterado sin aprobación |
| **5. Materializar y enviar prueba controlada** | Pasos 3 y 4 | TXT local con datos reales solo en el entorno autorizado; hash, fecha, destinatario y confirmación humana | Acuse/aceptación o rechazo documentado del banco |
| **6. Cerrar homologación** | Paso 5 | Evidencia sanitizada de aceptación; informe de homologación | Aceptación bancaria explícita; no alcanza con “el archivo se generó” |
| **7. Autorizar producción** | Paso 6 | Mecanismo de autorización no falsificable; captura de parámetros; flujo de descarga/envío; auditoría | Compuerta abierta solo por aprobación explícita; checkpoint propio |

**Prioridad mínima:** BNA-1, BNA-2 y BNA-6 primero, porque definen bytes y hoy
bloquean la generación. Después BNA-5, BNA-7, BNA-9 y BNA-11/P-17. BNA-8
(normalización) y BNA-10 (CBU repetido) pueden resolverse en paralelo con
empresa/banco. P-09 debe avanzar con RRHH desde el inicio, porque sin mapeo de
descripciones no hay `0000`/`0003` y la generación queda detenida.

**No hacer todavía:** no elegir `02`/`96`, no copiar el CBU de la empresa al R2,
no inventar la derivación de entidad/sucursal, no habilitar `produccionBnaHabilitada`,
no convertir el golden sintético en evidencia bancaria y no agregar un flujo de
descarga productiva antes de la homologación.

---

## Cierre de F12

- Banco Nación está **técnicamente implementado y probado** en todas sus capas.
- El contrato sigue **bloqueado por BNA-1** y por interpretaciones abiertas; no
  hay evidencia de respuesta bancaria ni de aceptación de archivo.
- La producción sigue **cerrada por construcción**; `npm run verify` no la abre.
- Los requisitos “confirmados pero no implementados” detectados son acotados:
  **(a)** la **referencia unívoca vacía**: el documento permite espacios y el
  mapper la rechaza; **(b)** la variante **`000` + documento** del número de
  documento del R2: el documento la admite, pero `PagoBna` exige CUIL y el
  mapper solo emite 11 dígitos. El resto de los faltantes son decisiones
  bancarias o de empresa, o implementaciones provisionales correctamente
  etiquetadas.
- **F12 no se commitea, no se hace push, PR ni merge.** Queda para revisión antes
  de autorizar cualquier cambio de implementación.
