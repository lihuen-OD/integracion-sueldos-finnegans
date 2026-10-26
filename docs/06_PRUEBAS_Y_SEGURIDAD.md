# 06 · Estrategia de pruebas, privacidad y control

## Pruebas de entrada

-   Encabezados faltantes/alterados, hoja incorrecta, XLSX corrupto,
    filas vacías.
-   CUIL con guiones y sin guiones, inválido, duplicado, ausente. CUIL
    repetido en Finnegans → `BLOQUEANTE`, sin sumar ni fusionar (D-015).
-   Legajo duplicado o cambiado. Diferencia exacta (`007` vs `7`) →
    `REQUIERE_REVISION` mostrando ambos valores, sin normalizar (D-017).
-   CBU de 22 dígitos, inválido por checksum, faltante, banco diferente.
-   Patagonia: cuenta confirmada de 10 dígitos, tipo cuenta, sucursal,
    dependencia, documento y tipo liquidación.
-   Importes 0, negativos, con centavos, formato decimal argentino,
    overflow por layout, suma exacta.
-   Filas en Finnegans sin maestro (`BLOQUEANTE`), en maestro sin
    Finnegans (`INFORMACION`), nombres similares (nunca se cruzan).
-   Banco vacío con neto ≠ 0 (`REQUIERE_REVISION` hasta que el operador
    asigne destino), banco no soportado (`BLOQUEANTE`), banco
    incompatible con el maestro (`BLOQUEANTE`).
-   Neto 0: excluido, `INFORMACION`, contabilizado en la conciliación.
-   Descripción sin mapeo → bloquea la generación del banco
    correspondiente.
-   Nombre Patagonia: acentos, `ñ`, minúsculas, espacios extremos y más
    de 20 caracteres (D-021).

## Pruebas de conciliación

-   Invariante global: Finnegans = BNA + Patagonia + excluidos +
    pendientes, en cantidad y en centavos, con valores grandes y límites
    de cada layout; con pendientes = 0, Finnegans = BNA + Patagonia +
    excluidos.
-   La conciliación global no cierra con filas pendientes (banco vacío
    sin resolver, banco no soportado) ni con incidencias globales.
-   Readiness independiente (D-032): un bloqueo exclusivo de Patagonia
    deja BNA `LISTO_PARA_GENERAR` y viceversa; ningún banco se descarga
    con pendientes globales (P-24); dentro de un banco no hay
    exportaciones parciales.
-   Propiedades sobre 200 escenarios aleatorios con semilla fija contra
    un oráculo independiente: ninguna fila se pierde, cada una en un solo
    estado, invariantes de cantidad e importe (F2).
-   Integración de punta a punta desde bytes XLSX sintéticos hasta la
    readiness, con 300 y 5.000 filas (F2).
-   Pruebas locales opt-in con archivos reales (`npm run local:f2`), solo
    agregados y sin escribir archivos (F2).
-   Las decisiones del operador quedan registradas en el reporte y no
    modifican los archivos de entrada.

## Pruebas de salida

**Contrato de pruebas de F4 (plan v3, D-076/D-077):** la matriz siguiente
está implementada en T4-1…T4-12 sobre el motor genérico con specs
exclusivamente sintéticas. Los tests viven en
`tests/unit/banks/fixed-width/**` y `tests/guardrails/**`.

-   Longitud por registro **exactamente `recordLength` bytes** (con
    longitudes heterogéneas entre registros; 200 en las specs bancarias
    de F5/F6).
-   **Specs (validador):** válidas; hueco; solapamiento; start/end fuera
    de rango; `declaredLength` inconsistente; cobertura 1..recordLength
    incompleta; orden de campos; ids duplicados; `recordLength`
    inconsistente; `PADDING_INCOHERENTE`; fijo incoherente
    (`FIJO_INCOHERENTE`); registro sin discriminador;
    `REGISTRO_INEXISTENTE_EN_ESTRUCTURA`; registro no alcanzable.
-   **Estructura (estática):** aceptar `1 2+ 3`, `0 (1 2+)+` y
    `secuencia[registro A, repeticion{min:1} A]`; rechazar
    `secuencia[repeticion{min:1} A, registro A]`,
    `secuencia[repeticion{min:1} A, repeticion{min:1} A]` y anidamientos
    equivalentes (`ESTRUCTURA_AMBIGUA`).
-   **Identificación de registros (matching):** una coincidencia;
    ninguna (`REGISTRO_DESCONOCIDO`); más de una (`REGISTRO_AMBIGUO`);
    discriminador inválido; los 6 casos estáticos de
    `DISCRIMINADOR_AMBIGUO` documentados en docs/02 (incluido que
    longitudes distintas no se evalúan entre sí y que una posición
    restringida por uno solo es wildcard, no conflicto).
-   **Serializer:** `N` (relleno, valor exacto, no numérico, vacío →
    error); `A` (relleno, vacío → espacios); overflow sin truncar;
    charset (límites 0x20/0x7E, tab/LF/CR, Unicode multibyte); campos
    fijos (`VALOR_EN_CAMPO_FIJO`); determinismo; campos/separadores
    `BLOQUEADA` son técnicamente serializables (D-075).
-   **Parser RAW:** preservación de ceros iniciales (`02`, `0000`),
    espacios interiores y finales, slices de ancho completo; fijo
    alterado; errores con posición y sin contenido del registro.
-   **Round-trip:** R-T1 (fidelidad) y R-T2 (estabilidad re-serializando
    solo campos sin `fixedValue`, con helper exclusivo de tests);
    serializer y parser independientes; bytes construidos a mano;
    mutación de un byte, de longitud y de discriminador.
-   **Archivo:** estructura correcta/incorrecta; `\n` y `\r\n`;
    separador mixto; trailing requerido/prohibido; BOM (`BOM_DETECTADO`);
    línea vacía; archivo vacío; orden inválido; repetición sin cumplir
    `min`; registro faltante; línea de más; `rutaRepeticiones` (1-based,
    exterior → interior: `[]`, `[3]`, `[3, 2]`).
-   **Inspector:** detección de mutaciones estructurales sin usar el
    serializer (R-T3: mutaciones internas de alfabeto no son objetivos
    genéricos; totales/consistencias son F5/F6, docs/02 D-073).
-   **Aptitud:** `BLOQUEADA` listada por `hallarBloqueosGeneracion`;
    `INTERPRETACION_PENDIENTE` no bloquea el motor; el motor funciona
    con cualquier `ContractStatus`.
-   **Guardrails:** `banks/fixed-width/` solo depende de `src/shared`
    (prohibidos `ui/`, React, ExcelJS, `import/`, `reconciliation/`,
    `export/` y los módulos bancarios hermanos).
-   **Cobertura:** >= 95 % para `src/banks/fixed-width/**` en `verify`.
-   Posiciones 1-based exactas de todos los campos; ceros/espacios sin
    corrimiento.
-   Archivo bancario con registro de cabecera, detalles y cierre/lotes
    correctos según cada banco (F5/F6); en F4 la estructura se prueba
    con specs sintéticas.
-   Totales y cantidades exactas frente a los empleados incluidos:
    reglas bancarias de F5/F6 sobre el modelo parseado; sin DSL de
    totales en el motor (D-073).
-   Saltos de línea y codificación documentados; solo caracteres
    admitidos.
-   Inspector independiente capaz de rechazar un archivo
    intencionalmente alterado (mutaciones estructurales).
-   Tests snapshot/golden basados en **datos ficticios**, nunca en el
    reporte real.

## Pruebas end-to-end

-   Cargar 2 XLSX ficticios → conciliación → configurar → descargar →
    inspeccionar bytes.
-   Abrir app sin Internet y confirmar que no hace peticiones de red.
-   Reiniciar/cerrar y verificar que no quedan datos en almacenamiento
    del navegador.
-   Archivo con 150--300 empleados, rendimiento aceptable en equipo
    típico de RRHH.
-   Mensajes de error precisos y navegación con teclado.

## CP-F5-A · contrato, spec y aptitud BNA

Pruebas mínimas del núcleo contractual (sin mapper ni TXT productivo):

-   **Geometría:** 3 `RecordSpec`, 47 campos (15 + 19 + 13), cada uno de
    200 bytes, cobertura exacta 1..200, sin huecos ni solapamientos,
    `declaredLength` coherente, ids únicos, tipos/rellenos correctos,
    `fixedValue` confirmados y ceros de cantidad de ancho completo.
-   **Estructura:** `1`, `2+` (mínimo 1) y `3`; discriminadores `1`/`2`/`3`;
    `validarFileSpec`/`validarRecordSpec` en verde con ambas hipótesis de
    separador.
-   **Trazabilidad:** cada campo tiene `origin` válido, `source.doc = BNA`,
    al menos una página y solo los issues BNA documentados.
-   **Estados:** BNA-1 `BLOQUEADA`; BNA-2/5/6/7/8/9/11 `I` que afectan
    bytes; BNA-10 `I` sin impacto; BNA-3 documentada; BNA-4 confirmada.
-   **D-075:** un test elimina el único `B` y comprueba que las `I`
    siguen informadas, el generador queda habilitado por ausencia de B y
    la homologación sigue `PENDIENTE_DE_HOMOLOGACION`. `I` nunca se
    convierte en `B`.
-   **BNA-1:** el tipo de documento no tiene `fixedValue` `02`/`96` ni
    default. Los valores de la contradicción solo pueden aparecer en
    documentación/tests, no como elección productiva.
-   **BNA-9:** se construyen especificaciones con LF y con CRLF **sin
    default**; ambas quedan `INTERPRETACION_PENDIENTE` y los tests no
    declaran que el banco acepte ninguna.
-   **Privacidad:** no se usan CUIL/CBU ni PII reales; no hay golden BNA
    en CP-F5-A. `check:sensitive` sigue vigente.
-   **Guardrail:** `src/banks/bna/**` no importa UI, React, ExcelJS,
    importación, conciliación, `run`, exportación ni Patagonia; sí puede
    usar fixed-width, trazabilidad, domain/shared y su subárbol.
-   **Cobertura:** >= 95 % de statements, branches, functions y lines para
    `src/banks/bna/**`, sin excluir ramas para alcanzar el umbral.

## CP-F5-B · perfil v2, mapper, totales, serialización e inspector

Pruebas mínimas del contrato ejecutado; no habilitan producción ni
resuelven BNA-1, BNA-2, BNA-6, P-09/P-10 ni BNA-11/P-17:

-   **Perfil v2:** claves exactas, `nombreEmpresa` requerido (puede ser
    `null`), CUIT/CBU canónicos, moneda `0`/`1`, convenio de 4 u 8
    dígitos, rechazo explícito de 5–7 (BNA-5), claves desconocidas y
    `mapeosLiquidacion` no vacío rechazados. Sin defaults.
-   **Versiones:** `"1"` valida exclusivamente v1 y conserva todas sus
    APIs; `"2"` valida exclusivamente v2; otra versión da
    `SCHEMA_VERSION_INCOMPATIBLE`. No hay fallback, conversión ni
    reinterpretación. Import por bytes acepta el tipo unión; export es
    determinista y conserva la versión real (v1 nunca sale como v2).
-   **Modelo y política:** `PerfilBna`, `PagoBna` y
    `ParametrosEnvioBna` no contienen `Date` ni inferencias. La política
    productiva devuelve ausencia de resolución para BNA-1, BNA-2,
    BNA-6, P-09/P-10 y BNA-11/P-17. Las políticas sintéticas de test no
    alteran `ISSUES_BNA`, la spec ni el estado de producción.
-   **Mapper:** usa solo la geometría de la spec y produce
    `EntradaRegistro`/`ValoresPorCampo`; no inventa `02`/`96`,
    `0000`/`0003`, entidad/sucursal ni textos libres. BNA-8 rechaza
    minúsculas, `ñ`/`Ñ`, acentos, tabs, CR/LF y no ASCII sin
    transformarlos. Convenio de 4 → `00` + 4 + `0000`; de 8 → `00` +
    8; 5–7 es error BNA-5; el campo final mide exactamente 10 bytes.
    Fecha, envío, moneda y referencias son entradas explícitas; no hay
    calendario ni día hábil inferido (BNA-7 abierta).
-   **Totales/límites:** `NETO_EXCEDE_LAYOUT` para importe R2 mayor a
    `9.999.999.999` centavos; total R3 máximo `999.999.999.999.999`;
    cantidad máxima `9.999.999`. Sumas exactas con `Centavos`/`bigint`,
    sin `Number`, float, truncamiento ni redondeo. R2 y R3 usan la misma
    lista de pagos.
-   **Serialización:** llama a la API pública F4, exige LF o CRLF y
    `trailingSeparator` explícitos (BNA-9), produce 3 registros de 200
    bytes y es determinista. Un error de mapeo o de serialización no
    devuelve bytes parciales. No hay separador por defecto.
-   **Inspector:** usa primero el parser F4 y luego verifica total,
    cantidad, límite de total y alfabeto sobre valores RAW. Detecta
    mutaciones de importe, total y cantidad; eliminación de R1/R2/R3;
    truncamiento; byte extra; BOM; minúsculas y bytes no ASCII/tabs/CR/LF;
    separador distinto. BNA-10 emite una advertencia no bloqueante por
    cuentas repetidas, sin deduplicar ni reinterpretar CBU.
-   **Privacidad:** fixtures 100 % sintéticos, sin CUIL/CBU/CUIT reales,
    sin PII y sin afirmar aceptación bancaria. No se agregan XLSX ni
    goldens productivos. `check:sensitive` sigue vigente.
-   **Cobertura:** >= 95 % de statements, branches, functions y lines para
    `src/banks/bna/**`; el perfil v2 se cubre con sus tests propios.

## CP-F5-C · fachada run, integración y golden técnico

Pruebas de la fachada `src/run/generacionBna.ts`; no habilitan producción
ni resuelven BNA-1, BNA-2, BNA-6, P-09/P-10 ni BNA-11/P-17:

-   **Perfil y configuración:** v1 sigue válido históricamente pero BNA
    devuelve `CONFIGURACION_INCOMPLETA`; perfil ausente y parámetros
    ausentes tampoco se completan por default. Solo v2 + parámetros
    explícitos pasan a la evaluación BNA.
-   **Conciliación:** sin conciliación, global pendiente, global
    bloqueada, pago sin destino y banco sin registros con global cerrada
    se distinguen con estados estructurados. Una incidencia exclusiva de
    Patagonia no bloquea BNA (D-032); bloqueos BNA distintos de P-09/P-10
    y revisiones BNA sin resolver no generan.
-   **P-09/P-10:** `LIQUIDACION_SIN_MAPEO` ya informado por F2 se
    consume tal cual y produce `MAPEO_NO_RESUELTO`, sin inferir
    descripciones, regex, códigos ni un `ContractStatus` nuevo.
-   **Contrato y política:** BNA-1 produce `CONTRATO_BNA_BLOQUEADO` con
    referencia a BNA-1 y un test inyectado demuestra que el serializer
    no se llama. Quitar BNA-1 en un test no habilita la política
    productiva: BNA-1, BNA-2, BNA-6, P-09/P-10 y BNA-11/P-17 siguen sin
    resolución y el resultado es `MAPEO_NO_RESUELTO`. Tests específicos
    comprueban que BNA-2, BNA-6 y BNA-11/P-17 no tienen defaults.
-   **Pagos:** `PagoBna[]` preserva orden y `SourceRef`; descarta filas
    Patagonia, sin maestro, con CBU inválido, neto no positivo o con
    incidencia bloqueante. No lee XLSX ni reimplementa F2.
-   **Bytes:** ningún error devuelve bytes, Blob ni descarga; un
    `SERIALIZACION_FALLIDA` no llama al inspector y un
    `INSPECCION_BNA_FALLIDA` no devuelve archivo. La generación sintética
    completa devuelve bytes inspeccionados y `PENDIENTE_DE_HOMOLOGACION`.
-   **Golden:** `tests/fixtures/synthetic/golden/bna-tecnico-sintetico.json`
    es 100 % sintético, con etiqueta **GOLDEN TÉCNICO SINTÉTICO — NO
    HOMOLOGADO POR BANCO NACIÓN**, política/aptitud exclusivas de test,
    LF, sin salto final, dos pagos, total `84000050` centavos, hex
    auditable separado por espacios y SHA-256. El test compara byte a
    byte y verifica la huella; no es un archivo aceptado por el banco.
-   **Privacidad:** no se agregan XLSX, datos reales, CUIL/CBU
    literales ni goldens productivos; `check:sensitive` sigue vigente.
-   **Guardrail:** `src/run/**` solo importa su subárbol, perfil,
    conciliación, API pública BNA, huella del maestro, domain o shared;
    no importa internals de fixed-width, Patagonia, UI, exportación,
    XLSX, React, ExcelJS ni builtins. La UI sigue sin poder importar
    `banks/**`; la fachada no está conectada a la UI ni a una descarga.
-   **Cobertura:** >= 95 % de statements, branches, functions y lines
    para `src/run/generacionBna.ts`, sin excluir ramas artificialmente.

## Privacidad y seguridad

-   Archivos y datos solo en memoria; no persistencia automática, no
    telemetría.
-   Evitar logs de datos personales o importes.
-   `.gitignore`: `*.xlsx`, `*.xls`, `*.txt` en carpetas de datos
    reales; usar fixtures sintéticos versionables en carpeta separada.
-   No usar servicios de IA con datos reales sin autorización expresa;
    compartir estructuras o ejemplos anonimizados.
-   Sin scripts remotos, CDNs, fuentes externas ni endpoints en runtime.
-   XLSX maestro es sensible aunque no haya base de datos: RRHH debe
    restringir acceso, mantener copia de respaldo protegida y controlar
    versiones.
-   Evitar exportar fórmula ejecutable al Excel (CSV/XLSX formula
    injection); escribir entradas de usuarios como texto.
-   La app no certifica titularidad de CBU ni valida que el banco acepte
    el pago; exige doble revisión operativa.
-   Playwright corre sin trazas, capturas ni videos. Ante una falla
    genera `test-results/**/error-context.md` con el árbol de
    accesibilidad de la página (ignorado por git): por eso los e2e usan
    solo datos sintéticos y la UI nunca muestra valores de celdas.
-   La prueba con el Excel real (T10) es local, opcional
    (`T10_FINNEGANS_PATH`), fuera de `npm test`, y solo imprime y compara
    agregados.

## Definición de terminado

`typecheck` + `lint` + `unit` + `e2e` + `build` en verde; validación
independiente de TXT; matriz trazable; sin bloqueantes abiertos del
banco para ese generador; reporte de riesgos y evidencia de homologación
antes de producción.
