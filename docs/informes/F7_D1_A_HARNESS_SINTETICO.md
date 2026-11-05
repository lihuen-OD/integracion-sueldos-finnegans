# CP-F7-D1-A · Harness técnico sintético en memoria

**Rama:** `f7-homologacion`.
**Base:** `1930698`.
**Alcance:** pruebas técnicas locales; no producción, no materialización y no envío.

## Mecanismo

Desde CP-F8-B, la composición vive en
`src/run/composicionHomologacionSintetica.ts`; el archivo histórico
`tests/harness/homologacionSintetica.ts` fue retirado. El módulo es browser-safe y reutilizable por
la aplicación y D1-B, pero no está conectado a la UI. No acepta corridas, perfiles, pagos, CUIL,
CBU, archivos ni parámetros empresariales externos. Solo admite una variante cerrada por llamada;
rechaza ausencia de argumento, objetos y argumentos extra. Todos los datos ficticios se crean
dentro de un catálogo inmutable del propio módulo.

La salida exitosa contiene únicamente `Uint8Array` en memoria, totales e inspección independiente.
No expone ruta, nombre de archivo, `Blob`, descarga ni API de escritura. Los resultados se etiquetan
`TECNICO SINTETICO · NO HOMOLOGADO · NO PRODUCTIVO`.

## Banco Nación GT 200

La política del harness se compone sin modificar políticas productivas:

- **Hipótesis técnica:** `POLITICA_BNA_HIPOTESIS_TECNICA` aporta BNA-1, BNA-2 y BNA-6.
- **Decisión explícita por corrida:** BNA-B1/B2 aporta P-09/P-10 mediante snapshot, huella,
  `SourceRef`, cobertura y revisión coincidentes.
- **Decisión interna provisional:** `POLITICA_BNA_PRODUCTIVA` aporta únicamente las funciones P-17
  ya aprobadas: criterio explícito, CUIL validado y datos de empresa vacíos.
- **Implementado y verificado:** mapper, serializador, inspector, totales, orden y cobertura.
- **Pendiente:** BNA-1, BNA-2, BNA-6 y BNA-11 siguen sin confirmación/homologación bancaria. A1 no
  se promueve a producción y P-17 no confirma BNA-11.

La composición rechaza huellas vencidas, selección incompleta, revisión distinta, referencias
duplicadas, pérdida de cobertura y parámetros inválidos antes de devolver bytes.

## Banco Patagonia B.2

El primer alcance queda restringido a cuentas de Banco Patagonia `034`:

- **Confirmado por respuesta escrita e implementado:** PAT-2 alfanumérica y PAT-8 limitado al tipo
  de documento `001`.
- **Decisiones internas provisionales:** PAT-4, PAT-9/P-14, PAT-15, PAT-16 y P-20, reutilizadas desde
  `POLITICA_PATAGONIA_PRODUCTIVA`.
- **Selección provisional explícita:** PAT-7/P-09/P-10 se resuelve únicamente desde el snapshot
  validado y su revisión coincidente; el catálogo no se presenta como confirmado por el banco.
- **Implementado y verificado:** evaluación `evaluarAptitudTecnicaPatagonia`, cobertura, mapper,
  serializador, inspector, totales, loteo y orden.
- **Pendiente:** homologación completa y PAT-17. El harness no modela corresponsales ni la regla de
  acreditación diferida.

## Separación de producción

`produccionBnaHabilitada()` y `produccionPatagoniaHabilitada()` continúan devolviendo `false`. El
compositor comprueba ambas compuertas y falla si alguna estuviera abierta. Las fachadas normales no se
modifican y siguen sin generar bytes productivos.

## Límite de D1-A y paso D1-B

D1-A demuestra composición e inspección completas exclusivamente en memoria. D1-B ya define el
acto local, explícito y revisado para materializar esos mismos bytes sintéticos, con nombres
controlados, hash y confirmación humana. CP-F8-B no cambia ese acto: solo hace que D1-A y D1-B
consuman el mismo compositor. La identidad previa queda fijada por 803 bytes y SHA-256
`b72a7e942249a75298bb6041e96b7b4d6505775d22a21f23e600adff40b426de` (BNA) y
`004140b216b76fc56b7a08ac3edde1524df8e7dd8f860ed7fbabed0ddd671a4d` (Patagonia).
