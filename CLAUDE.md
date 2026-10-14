# Instrucciones permanentes para Claude Code

Leé `README.md` y todos los documentos `docs/` antes de planificar o
modificar código.

## Prioridades

1.  **Exactitud de pagos y trazabilidad por encima de velocidad y
    estética.**
2.  No inferir posiciones, longitudes, códigos, rellenos o reglas
    bancarias. Cada regla debe apuntar al documento, sección/página y
    estado: `CONFIRMADA`, `INTERPRETACIÓN_PENDIENTE` o `BLOQUEADA`.
3.  Trabajar **en modo plan primero**. Proponer hitos pequeños,
    criterios de aceptación y pruebas antes de programar.
4.  No usar Internet como fuente de nuevos formatos bancarios. Toda
    regla bancaria debe rastrearse a un documento de `references/`
    (inventario en `docs/07` §3). Si falta un dato, preguntar.
5.  **Nunca** inventar un CBU, DNI, cuenta, sucursal, dependencia,
    convenio, fecha, código o importe para completar un archivo real.
6.  No hacer matching por nombre; CUIL exacto normalizado y control de
    legajo **exacto** (`007` ≠ `7`, sin normalizar). Diferencias se
    revisan manualmente (`REQUIERE_REVISION`).
7.  No cambiar importes silenciosamente; representarlos como **centavos
    enteros**. No usar `number` de coma flotante para sumar dinero.
8.  No persistir nóminas/CBU/archivos en localStorage, IndexedDB,
    cookies, archivos temporales, logs o telemetría. Estado solo en
    memoria hasta cerrar.
9.  Sin backend ni llamadas a Internet en runtime. Recursos locales y
    dependencias empaquetadas.
10. Ningún TXT se considera listo para producción sin prueba de
    homologación y autorización del banco.

## Forma de trabajar

-   Antes de cada fase: presentar plan, archivos a modificar, riesgos,
    casos de prueba y criterios de salida.
-   Cada cambio: TypeScript strict, validaciones, tests de caso feliz y
    error, y comandos reproducibles.
-   Al terminar: indicar lo implementado, lo NO implementado, lo que
    falta confirmar, pruebas ejecutadas y resultados.
-   No introducir frameworks/servicios no aprobados ni refactorizaciones
    grandes no relacionadas.
-   Usar datos **sintéticos** en fixtures, capturas y commits. Agregar
    patrones de datos reales a `.gitignore`.
-   No conectar GitHub, publicar o desplegar sin autorización explícita.

## Contratos bancarios

-   BNA: **Pagos GT / Haberes** (tipo de pago `SUE`, clase `1`,
    registros `1/2/3`, 200 posiciones).
-   Patagonia: **Plan Sueldos B.2**, registros `0/1/2`, 200 posiciones;
    revisar contradicción del relleno del registro detalle antes de
    generar TXT.
-   Las especificaciones y dudas viven en
    `docs/04_CONTRATOS_BANCARIOS.md`.
-   Layouts declarados como datos (`FieldSpec`/`RecordSpec`) sobre el
    motor genérico `src/banks/fixed-width/`. La UI no conoce posiciones
    ni construye TXT; las reglas bancarias no van en React.
-   Los bloqueos e interpretaciones de `docs/04` §6 (BNA-1, 2, 5, 6, 9;
    PAT-1, PAT-2 y demás que afecten bytes) **no se resuelven** sin
    respuesta del banco o decisión documentada del usuario. La generación
    productiva queda PENDIENTE DE HOMOLOGACION.
-   Niveles de incidencia: `CORRECTO`, `INFORMACION`,
    `REQUIERE_REVISION`, `BLOQUEANTE` (`docs/03` §E).

## Seguridad operativa

-   La app prepara archivos; nunca inicia pagos.
-   Mostrar totales, cantidad, origen, destino, fecha y excepciones
    antes de habilitar descarga.
-   No ocultar registros inválidos ni permitir exportaciones parciales
    por defecto. Si se habilita un subconjunto, debe ser una acción
    explícita con conciliación y confirmación.
