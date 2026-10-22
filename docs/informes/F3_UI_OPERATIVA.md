# Informe F3 · UI operativa (CP-F3-A/B/C)

**Fecha:** 21-10-2026 · **Rama:** `f3-ui-operativa` · **Checkpoint
técnico (correctivo de auditoría):** `204e34c` · **Microcorrectivo
código:** `5bc412c` · **Decisiones:** D-062 a
D-067 (docs/07) · **Estado:** F3 cerrado en la rama con el correctivo de
auditoría; pendiente de aprobación humana para merge a `main`.

Este informe no contiene datos personales. Todos los ejemplos son
sintéticos y la base de comparación con datos reales es de conteos (no
importes).

## 1. Alcance

**Implementado (T3-1 a T3-14):**

- F2 reutilizada tal cual: dominio, parsers, conciliación, decisiones y
  readiness **sin cambios de contratos** (solo el puente añadido, ver
  §2). Cero archivos retoqueteados del motor (diff de `src/reconciliation`
  en F3: solo `tipos.ts` añade el patrón de decisiones ya aprobado).
- Zona de carga y corrida completa en memoria: sin backend, sin
  persistencia (localStorage/IndexedDB/cookies/logs), sin red en
  runtime.
- Conciliación visible: recorrido con «Conciliar» explícito,
  re-conciliación automática tras cada decisión del operador y tras cada
  edición del maestro (detalle queda abierto; D-066).
- Proyección presentacional de incidencias (única fuente:
  `proyeccion.ts`, siempre derivada del motor; key determinista).
- Paneles: Acción (solo resolubles), Incidencias (bloqueos agrupados con
  valor diferenciador colapsado, información, resueltas), Resumen
  (totales por grupo, comprobaciones), Readiness simétrico BNA /
  Patagonia, Decisiones aplicadas/no aplicadas con rótulos humanos (sin
  ids `d-N` visibles).
- Tabla de empleados con búsqueda, filtros (acción, bloqueantes,
  información, BNA, Patagonia, excluidos, pendientes, todos),
  paginación de 20 y detalle por empleado con decisiones y editor de
  maestro.
- Editor UPDATE-only del maestro (T3-11, D-066): 8 campos bancarios
  editables (sin identidad ni `PAT_CODIGO_DEPENDENCIA`), validados
  EXACTAMENTE con los validadores F2 (`VALIDADORES_TEXTO` en
  `src/domain/maestro.ts`, movidos a una única fuente para el parser y
  el editor), revisiones N → N+1 solo si la representación cambia
  (`revisionTrasEdicion`), sin revisión artificial ante «sin cambios» ni
  ante error.
- Re-conciliación por la revisión vigente (sin caminos paralelos):
  `lecturaMaestroVigente()` alimenta la conciliación desde
  `estado.maestroRevision.registros`; el archivo original no se
  reinterpreta, la huella de archivo no se redefinida.
- D-063 intacto con un único mecanismo: el `Observado` del maestro trae
  la huella de la REVISIÓN lógica; las decisiones solo-Finnegans
  sobreviven a las revisiones, la que observó el maestro queda no
  aplicada (DATOS_CAMBIARON), con su motivo visible.
- Exportación del maestro editado (T3-12): XLSX generado con el
  adaptador (ExcelJS confinado en `src/import/xlsx`, D-038/D-040),
  contenido = revisión vigente campo por campo (update-only, sin
  reinterpretar celdas), con hoja `Control` (VERSION_CONTRATO = 1, TIPO
  = EDITADO, número de revisión) y nombre con fecha y revisión. La
  descarga entra por `ZonaCarga` (como la plantilla) con nombre
  sugerido.
- Escala (T3-13): 300 filas funcionales (grupos, búsqueda, filtros,
  páginas, edición, exportación) y corrida exploratoria de 5.000 filas
  en local (sin SLA; tiempos medidos, §4).
- Accesibilidad (T3-14): foco visible con teclado (`:focus-visible`
  global), etiquetas `label`-asociadas en el editor, mensajes de error
  con `role="alert"`/`aria-live`, `data-testid` estables.

**No implementado (por decisión):** TXT bancarios (F5/F6, pendientes de
homologación), ADD/DELETE de registros del maestro (D-066: solo
UPDATE), edición de identidad o `PAT_CODIGO_DEPENDENCIA` (PAT-2),
esquema de sesiones (sin storage), Typeform de homologación.

**Correctivo de auditoría (post CP-F3-C):**

- FIX 1 (+ microcorrectivo): el par tipo/provincia queda gobernado por
  el cruce documentado ÚNICAMENTE en el editor UPDATE-only. Una edición
  NUEVA de `PAT_TIPO_DOCUMENTO` o `PAT_PROVINCIA_DOCUMENTO` se rechaza
  sin revisión si el RESULTADO del par sigue en
  `NO_CORRESPONDE_AL_TIPO_DOCUMENTO`, incluso cuando la incompatibilidad
  ya venía del maestro importado. Solo se permiten los UPDATEs que
  corrigen o son compatibles: vaciar la provincia, poner un tipo que
  revalida la provincia (idem 004) o una provincia compatible con el
  tipo vigente. La representación del ESTADO IMPORTADO inválido no pasa
  por el editor: el parser de F2 la carga tal cual se leyó (sin
  normalizar ni rechazar). El cruce (`cruzarProvinciaConTipoDocumento`)
  y las reglas F2 NO cambian.
- FIX 2: el feedback de edición (`estadoEdicion`) vive solo con el
  detalle de ese empleado abierto: se descarta al abrir/cerrar detalle,
  al reemplazar Finnegans/maestro/perfil/demo y al reiniciar la corrida.
  Nunca migra entre empleados ni reaparece en una corrida nueva; sin
  persistencia ni ids visibles.
- Prueba de integración explícita extra: revisión 0 → edición válida →
  revisión 1 → `conciliarCorrida()` → segunda edición válida → revisión
  2 → `conciliarCorrida()`, con `estado.maestro.registros` = archivo
  original todo el recorrido (ruta única: `lecturaMaestroVigente()` →
  `estado.maestroRevision.registros` → `conciliar()`).

## 2. Estructura añadida

``` text
src/ui/                  App · TablaFilas (con DetalleFila) · EditorMaestro
                         PanelAccion · PanelIncidencias · PanelResumen
                         PanelReadiness · PanelDecisiones · PanelPerfil
                         ZonaCarga · proyeccion · etiquetas · orquestacion
                         demo (solo-dev)
src/run/                 corrida · decision (D-044 aprobadas) · revision
                         puente (huellas CONCILIACIÓN:maestro por revisión)
src/import/master/       contrato · plantillaMaestro · parseMaestro
                         maestroRevisionXlsx (SALIDA del maestro editado)
```

`orquestacion.ts` sigue siendo el único punto de contacto UI ↔ motor;
las huellas/fingerprints no se abren a la UI.

## 3. Decisiones de la fase

| id | Decisión |
|---|---|
| D-062 | Huellas separadas: `FileFingerprint` de archivos leídos; `MasterRevisionFingerprint` de la revisión lógica (registros + número). El archivo importado no se redefine. |
| D-063 | Regla conservadora con F2 vigente: el `Observado` del maestro trae la huella de revisión; decisión solo-Finnegans sobrevive; decisión que observó el maestro → `DATOS_CAMBIARON` no aplicada, visible. |
| D-065 | «Conciliar» es explícito (reset de la conciliación visible en carga/perfil/decisiones) y la UI NO concilia sola al subir archivos; la re-conciliación automática es solo después de decidir/editar. |
| D-066 | Editor UPDATE-only de 8 campos bancarios, con validadores F2 exactos y rechazo de valores inválidos; identidad y `PAT_CODIGO_DEPENDENCIA` fuera de alcance (PAT-2). Sin ADD/DELETE. |
| D-067 | Simetría BNA/Patagonia en la UI: misma mecánica de conciliación/paneles; el editor acepta a todos los bancos con los mismos validadores; el readiness sigue por banco. |

## 4. Pruebas ejecutadas (21-10-2026)

| Suite | Resultado |
|---|---|
| `npm run verify` COMPLETO (typecheck · lint · format:check · check:sensitive · coverage · build · check:dist · e2e) | **OK de punta a punta** |
| `npx vitest run` (unit + integration, 42 archivos) | **628 passed**, 0 fallidos (incluye pruebas A–F del microcorrectivo del par tipo/provincia) |
| `npx playwright test` (e2e build de producción, 4 specs) | **23 passed** (7 cp-f3-c, 8 cp-f3-b, 7 escala incl. 300/5.000, privacidad, xlsx) |
| `npm run check:sensitive` | sin hallazgos (160 archivos: repositorio completo tras el correctivo) |
| `npm run check:dist` | OK (sin nombres de datos ni formas de CUIL/CBU) |
| Almacenamiento/red (privacidad.spec.ts) | 0 storage· 0 pedidos fuera del origen local· CSP sin violaciones |

**Escala local (macOS ARM, Chromium, build de producción, datos
sintéticos; sin SLA):**

- 300 filas: conciliación + recorrido completo < 1,1 s end-to-end.
- 5.000 filas: conciliación ≈ 474 ms de motor (vitest ya medía lo
  mismo); recorrido e2e completo ≈ 8,8 s impuesto por la importación
  XLSX y la paginación forzada de 250 páginas en la prueba. La vista
  siempre responde: grupos colapsados, ninguna lista de 5.000 filas
  a la vez.

**e2e nuevos (cp-f3-c.spec.ts):**

1. Edición del CBU a otro banco → revisión 1 y detalle visible
   (re-conciliación automática).
2. Valor inválido fuera de catálogo → motivo en palabras, revisión 0
   intacta.
3. CUIL/PAT_CODIGO_DEPENDENCIA sin botón de editar (solo referencia).
4. Segunda edición en otro campo → revisión 2 (nunca se sobrescribe la
   historia: numero + contenido definen la identidad).
5. «Sin cambios» → mensaje alcanzable por `role`,
   revisión sin correr.
6. Exportar → descarga con nombre
   `MAESTRO_CUENTAS_EMPLEADOS_<fecha>_editado_r<N>.xlsx`.
7. Accesibilidad: etiqueta asociada al input; foco visible con Tab.

## 5. Cómo abrir la app

``` bash
npm install && npm run dev
```

La app queda en `http://localhost:5173` (de producción usa
`npm run build && npm run preview`). La corrida demo solo aparece en
desarrollo con datos sintéticos.

## 6. Pendientes para el operador

- Homologación bancaria de TXT (BNA-1, BNA-2, BNA-5/6/9; PAT-1, PAT-2).
- Respuesta del banco para los valores/schemas de `PAT_TIPO_DOCUMENTO`,
  `PAT_PROVINCIA_DOCUMENTO`, `PAT_CODIGO_DEPENDENCIA` (Anexos I/II).
- Decisión de merge de `f3-ui-operativa` a `main` (autorización del
  usuario).
