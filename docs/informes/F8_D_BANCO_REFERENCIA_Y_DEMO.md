# CP-F8-D · Banco de referencia y demostración integral

**Rama:** `f7-homologacion`.
**Base verificada:** `115a043`.
**Alcance:** plantilla maestro y fixtures XLSX sintéticos; sin cambios en formatos bancarios,
serializadores, mappers ni compuertas productivas.

## Banco de referencia observado

El reporte Finnegans aceptado por la aplicación contiene `Banco` entre sus 14 encabezados
obligatorios. `parseFinnegans` ya lo leía como texto y lo exponía literalmente en
`PayrollLine.bancoFinnegans`; no fue necesario ampliar ni reinterpretar la estructura XLSX.

La plantilla prellenada agrega `BANCO_REFERENCIA` después de `APELLIDO_NOMBRE_REF`:

- coincidencia exacta `BANCO DE LA NACION ARGENTINA` → `Banco Nación`;
- coincidencia exacta `BANCO PATAGONIA S.A.` → `Banco Patagonia`;
- vacío, ilegible o cualquier otro texto → `Dato pendiente de identificar`.

La clasificación reutiliza el catálogo cerrado vigente. No usa nombre, CUIL, legajo, CBU ni
campos Patagonia. La columna es opcional al importar, no pertenece a `CAMPOS_BANCARIOS` y no
interviene en conciliación, selección de destino ni generación. Por eso los maestros v1 anteriores
siguen siendo válidos.

## Columnas efectivamente necesarias por banco

Comunes a todos los registros:

- `CUIL`: requerido, DV válido; clave de cruce.
- `LEGAJO`: requerido y comparado exactamente, incluidos ceros iniciales.
- `APELLIDO_NOMBRE_REF`: opcional e informativo.
- `BANCO_REFERENCIA`: opcional e informativo.

Banco Nación:

- `CBU`: requerido, exactamente 22 dígitos y con ambos dígitos verificadores válidos.
- En la conciliación, la entidad del CBU debe coincidir con `011` para el catálogo Nación.
- Ningún campo `PAT_*` es consumido por este destino.

Banco Patagonia:

- requeridos: `PAT_TIPO_CUENTA`, `PAT_NUMERO_CUENTA`, `PAT_CODIGO_BANCO`,
  `PAT_CODIGO_SUCURSAL`, `PAT_TIPO_DOCUMENTO`, `PAT_NUMERO_DOCUMENTO` y
  `PAT_CODIGO_DEPENDENCIA`;
- `PAT_PROVINCIA_DOCUMENTO` solo es requerido con tipo de documento `004`; con los demás tipos
  debe quedar vacío;
- tipo de cuenta: `1` o `2`; cuenta: 1–10 dígitos; banco: 3 dígitos; sucursal: 1–5 dígitos;
  número de documento: 1–17 dígitos; provincia: catálogo Anexo II;
- la conciliación exige que `PAT_CODIGO_BANCO` coincida con `034` para el catálogo Patagonia;
- el catálogo general reconoce `001`, `002`, `003`, `004` y `006`, pero el validador del flujo
  confirmado por Banco Patagonia acepta exclusivamente `001`. La demo válida usa solo `001`;
  `002` aparece únicamente en el par negativo para probar el diagnóstico de “no confirmado”;
- el validador bancario de dependencia confirmado exige 1–15 caracteres alfanuméricos ASCII. El
  maestro conserva el texto y el validador bancario vuelve a comprobarlo antes de mapear.

`CBU` no es consumido por Patagonia. Una cuenta Patagonia tampoco se deriva del CBU ni del CUIL.

## Demo local

Generación:

```sh
npm run fixtures:synthetic
```

Los archivos quedan en `tests/fixtures/synthetic/generated/`, directorio ignorado por Git:

- `demo_integral_finnegans_valido.xlsx`;
- `demo_integral_maestro_valido.xlsx`;
- `demo_integral_finnegans_con_errores.xlsx`;
- `demo_integral_maestro_con_errores.xlsx`;
- `demo_maestro_v1_anterior_compatible.xlsx`;
- `DEMO_INTEGRAL_LEEME.md`.

La corrida válida contiene 156 identidades ficticias: 116 referencias Nación, 39 Patagonia y una
pendiente. Reproduce Agrario, Comercio, Directivos y Liquidación Final; incluye una fila Patagonia
con neto cero. Los CUIL/DNI, legajos, cuentas e importes se generan determinísticamente en runtime.
Los datos bancarios solo satisfacen validaciones estructurales y no se presentan como cuentas
reales.

La pareja negativa contiene seis identidades distintas y combina CBU inválido, provincia
incompatible con documento `001`, documento `002` conocido pero no confirmado para el flujo,
componentes que no cuadran, banco no catalogado y banco vacío.

## Carga paso a paso

1. Ejecutar `npm run dev` y abrir la URL local informada por Vite.
2. En “Liquidación de Finnegans”, elegir `demo_integral_finnegans_valido.xlsx`.
3. En “Maestro de empleados”, elegir `demo_integral_maestro_valido.xlsx`.
4. Presionar “Conciliar”.
5. Clasificar explícitamente cada descripción de Agrario, Comercio, Directivos y Liquidación Final.
6. Resolver la única fila con banco pendiente desde la acción explícita de la UI y volver a
   conciliar.
7. Repetir con la pareja “con_errores” para observar los diagnósticos.
8. Cargar `demo_maestro_v1_anterior_compatible.xlsx` para comprobar compatibilidad sin la nueva
   columna.

El botón de demo de desarrollo usa la misma corrida válida en memoria. Ninguno de estos pasos abre
una ruta de pagos reales: las descargas sintéticas de homologación siguen siendo independientes de
la corrida y ambas compuertas productivas permanecen cerradas.
