# CP-F7-D1-B · Materialización local sintética y controlada

**Rama:** `f7-homologacion`.
**Base:** `a0b069e`.
**Alcance:** materialización local de bytes D1-A; no producción, envío ni homologación.

## Uso manual

Banco Nación:

```sh
npm run homologacion:sintetica -- --banco BNA --variante VALIDA
```

Banco Patagonia:

```sh
npm run homologacion:sintetica -- --banco PATAGONIA --variante VALIDA
```

La CLI exige banco y variante explícitos. No admite rutas, archivos, pagos, perfiles ni corridas
como parámetros. Una variante negativa admitida por D1-A se puede seleccionar para verificar el
rechazo, pero no produce bytes materializables.

## Vista previa y confirmación

Antes de cualquier escritura se muestran banco, variante, nombre, cantidad de bytes, SHA-256 y un
resumen de la inspección independiente, junto con la advertencia:

`ARCHIVO SINTÉTICO, NO PRODUCTIVO — NO HOMOLOGADO`

La herramienta imprime una frase que incluye nombre y hash. Solo una repetición exacta habilita la
escritura; cualquier otra entrada cancela sin crear el directorio.

## Directorio y nombres

El único destino de la CLI es:

`local-output/homologacion-sintetica/`

La ruta está ignorada por Git. No existe opción para cambiarla desde la línea de comandos.

- BNA: `PRUEBA_SINTETICA_BNA_GT200_NO_PRODUCTIVA.TXT`.
- Patagonia: `ACREXXXX.TXT`; `XXXX` se conserva como marcador y no se inventa un convenio real.
- Manifiesto: `<NOMBRE>.manifest.json`.

Se rechazan rutas relativas, traversal, symlinks, directorios resueltos fuera de su ruta y archivos
ya existentes. La apertura usa `wx` y permisos locales restrictivos; nunca sobrescribe.

## Integridad e inspección

D1-B vuelve a ejecutar la composición D1-A inmediatamente después de la confirmación. Compara los
bytes reinspeccionados con el plan presentado, recalcula SHA-256 inmediatamente antes de escribir y
calcula nuevamente el hash desde el TXT guardado. Cualquier alteración cancela y elimina únicamente
los archivos nuevos de esa operación.

El manifiesto contiene banco, variante, nombre, tamaño, hash, resultado resumido de inspección,
fecha y marcas `sintetico=true`, `productivo=false`, `homologado=false`. No contiene empleados,
CUIL, CBU, legajos ni importes individuales.

## Separación productiva

La implementación vive en `scripts/**` y `tests/**`; no modifica ni se importa desde `src/**`. El
comando no forma parte de `build`, pruebas ni `npm run verify`. Las compuertas productivas permanecen
en `false`, y no se agregan UI, reglas PAT-17, corresponsales ni decisiones bancarias.
