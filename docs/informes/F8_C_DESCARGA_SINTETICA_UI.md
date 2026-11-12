# CP-F8-C · Descarga sintética desde React

**Rama:** `f7-homologacion`
**Base:** `62865a4`
**Alcance:** preparación, vista previa y descarga local de los archivos cerrados F8-B; sin datos
reales ni generación productiva.

## Integración

El panel `PanelDescargaHomologacionSintetica` aparece como paso 7, al final del flujo vigente. No
recibe props ni consulta `EstadoCorrida`: sus únicas opciones son Banco Nación y Banco Patagonia y
usa exclusivamente la variante sintética `VALIDA`.

`preparacionDescargaHomologacionSintetica.ts` es la fachada browser-safe. Su API acepta exactamente
`(banco, variante)` enumerados, compone mediante F8-B y devuelve bytes en memoria, nombre sugerido,
cantidad, SHA-256 e inspección segura. Objetos, argumentos extra, bancos o variantes desconocidos se
rechazan antes de componer.

## Nombres y advertencia

- BNA: `PRUEBA_SINTETICA_BNA_GT200_NO_PRODUCTIVA.TXT`.
- Patagonia: `ACREXXXX.TXT`.
- Advertencia: **ARCHIVO SINTÉTICO, NO PRODUCTIVO — NO HOMOLOGADO**.

Los nombres y la advertencia tienen una única fuente browser-safe compartida con D1-B.

## Integridad y confirmación

Preparar no descarga. La vista previa muestra banco, nombre, registros, bytes, SHA-256 e inspección.
El operador debe confirmar o cancelar en un segundo acto. Al confirmar, la aplicación vuelve a
componer y calcular la huella, compara nombre, tamaño, hash y bytes contra la vista previa y solo
entonces llama a `downloadBytes` para crear el Blob.

Los bytes y huellas F8-B vigentes son:

| Banco | Bytes | SHA-256 |
|---|---:|---|
| BNA | 808 | `87d55ec2bdcec1f8ecd22103c95ce78c7d36720ee26db9ef9ea15b6e2011d123` |
| Patagonia | 803 | `004140b216b76fc56b7a08ac3edde1524df8e7dd8f860ed7fbabed0ddd671a4d` |

BNA usa CRLF con salto final por la hipótesis técnica BNA-9; no es una homologación.

## Aislamiento

- El panel no recibe corrida, conciliación, perfil, importaciones, pagos ni empleados.
- Cargar o conciliar datos de RRHH no cambia los bytes sintéticos.
- No se usan las fachadas productivas ni se abren compuertas.
- No hay backend, red, persistencia, `node:*`, scripts ni fixtures de tests en el bundle.
- Los TXT descargados no contienen empleados ni importes cargados por RRHH.

## Limitación del navegador

El atributo `download` permite sugerir un nombre, pero el navegador y el sistema operativo deciden
el directorio, las colisiones y el nombre final. La aplicación tampoco puede releer el archivo una
vez guardado. Por eso F8-C verifica hasta los bytes entregados al Blob; D1-B sigue siendo la
herramienta que puede confinar una ruta y verificar el archivo después de escribirlo.
