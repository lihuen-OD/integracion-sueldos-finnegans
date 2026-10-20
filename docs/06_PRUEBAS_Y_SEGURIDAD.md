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

-   Longitud por registro **exactamente 200 bytes**.
-   Motor fixed-width (D-027), sobre cada spec: posiciones contiguas,
    longitud declarada vs `fin − inicio + 1`, longitud real del valor,
    relleno, caracteres admitidos, longitud final del registro y
    parse/inspect independiente del serializador.
-   Posiciones 1-based exactas de todos los campos; ceros/espacios sin
    corrimiento.
-   Archivo con registro de cabecera, detalles y cierre/lotes correctos
    según banco.
-   Totales y cantidades exactas frente a los empleados incluidos.
-   Saltos de línea y codificación documentados; solo caracteres
    admitidos.
-   Inspector independiente capaz de rechazar un archivo
    intencionalmente alterado.
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
