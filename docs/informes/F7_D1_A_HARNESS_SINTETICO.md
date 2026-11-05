# CP-F7-D1-A · Harness técnico sintético en memoria

**Rama:** `f7-homologacion`.
**Base:** `1930698`.
**Alcance:** pruebas técnicas locales; no producción, no materialización y no envío.

## Mecanismo

El harness vive exclusivamente en `tests/harness/homologacionSintetica.ts`. No forma parte de
`src/`, no se exporta a la aplicación y no acepta corridas, perfiles, pagos ni archivos externos.
Solo admite una lista cerrada de variantes sintéticas construidas internamente con generadores de
CUIL, CBU, cuentas, legajos, nombres e importes de prueba.

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
harness comprueba ambas compuertas y falla si alguna estuviera abierta. Las fachadas normales no se
modifican y siguen sin generar bytes productivos.

## Límite de D1-A y paso D1-B

D1-A demuestra composición e inspección completas exclusivamente en memoria. D1-B deberá definir
un acto local, explícito y revisado para materializar los bytes sintéticos, asignar nombres de
archivo controlados, registrar hash y ubicación, y exigir confirmación humana. No deberá reutilizar
la fachada productiva, aceptar corridas reales ni modificar las compuertas de producción.
