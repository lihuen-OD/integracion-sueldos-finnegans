# 07 · Registro de decisiones (ADR) y preguntas

**Última actualización:** 14-10-2026 (cierre documental de F0, plan
aprobado con modificaciones).

## 1. Decisiones

| ID | Decisión | Estado | Detalle |
|---|---|---|---|
| D-001 | 100 % local, offline, sin backend/API/DB | APROBADA | — |
| D-002 | Finnegans XLSX como fuente de la liquidación | APROBADA | docs/03 §A |
| D-003 | Maestro bancario XLSX externo, administrado por RRHH, como persistencia | APROBADA | docs/03 §B |
| D-004 | Asociar por CUIL, controlar legajo, nunca por nombre | APROBADA | Refinada por D-017 |
| D-005 | Configuración de convenio/pago en pantalla | APROBADA | Ampliada por D-022 (perfil importable/exportable) |
| D-006 | Generadores separados BNA / Patagonia | MODIFICADA por D-027 | Cada banco es una especificación propia sobre un motor común |
| D-007 | React + TS strict + Vite, Zod, Vitest/RTL/Playwright, ESLint/Prettier; ExcelJS como candidato | APROBADA con modificaciones (14-10-2026) · ExcelJS: **spike superado, recomendación APROBAR** (15-10-2026), pendiente de confirmación del usuario y de T11 (P-26, P-27) | `docs/spikes/F1_XLSX.md` |
| D-008 | Tauri 2 como empaquetado final | PROPUESTA | Se decide en F8; alternativa: HTML único autocontenido (P-08) |
| D-009 | Sin persistencia automática de datos sensibles | APROBADA | — |
| D-010 | No generar pagos reales hasta la homologación | REQUISITO DE SEGURIDAD | Ver D-029, D-030 |
| D-011 | Cada archivo Finnegans corresponde a **una sola empresa / CUIT empleador**. El CUIT proviene del perfil de empresa. Un Excel con varios CUIT está fuera de alcance en v1 | APROBADA | docs/03 §A.1, §C |
| D-012 | La columna `Banco` de Finnegans determina el destino: `BANCO DE LA NACION ARGENTINA` → `BNA_GT_HABERES`; `BANCO PATAGONIA S.A.` → `PATAGONIA_B2`. Se generan dos TXT independientes | APROBADA | docs/03 §D.1 |
| D-013 | `Banco` vacío con importe a pagar: notificar; no asignar automáticamente; el operador indica BNA o Patagonia; la decisión se registra en la conciliación de la corrida; el Excel original no se modifica; hasta resolverlo, la fila queda pendiente y la conciliación no cierra | APROBADA | Nivel `REQUIERE_REVISION` (docs/03 §E.2, regla 9) |
| D-014 | Banco distinto de Nación o Patagonia: bloquear (banco no soportado); no reasignar | APROBADA | Regla 10 |
| D-015 | CUIL repetido en Finnegans: bloquear, notificar; **nunca** sumar ni fusionar registros | APROBADA | Regla 2 |
| D-016 | Neto = 0: no se genera el pago; se muestra como exclusión/información; cuenta en la conciliación (cantidades e importes) | APROBADA | Regla 4; ver P-16 |
| D-017 | Legajo: comparación **exacta**, sin normalizar (`007` ≠ `7`). Si el CUIL coincide y el legajo no, `REQUIERE_REVISION`; se muestran ambos valores; no se modifica ninguno | APROBADA | Regla 8 |
| D-018 | Fila Finnegans sin maestro: bloquear. Registro del maestro sin liquidación: informar, no bloquear. Banco Finnegans incompatible con los datos del maestro: bloquear | APROBADA | Reglas 6, 7, 11 |
| D-019 | Cuatro niveles visibles: `CORRECTO`, `INFORMACION`, `REQUIERE_REVISION`, `BLOQUEANTE`. Reemplaza `REQUIERE_DECISION` y `ADVERTENCIA` del plan F0 | APROBADA | docs/03 §E.1 y §H |
| D-020 | Conciliación obligatoria: Finnegans = BNA + Patagonia + excluidos, en cantidad y en centavos; sin pendientes, sin bloqueantes y con las revisiones resueltas | MODIFICADA por D-032 | La regla de todo-o-nada entre bancos se reemplazó por readiness independiente |
| D-021 | Nombre Patagonia: MAYÚSCULAS, sin acentos, `Ñ` → `N`, máx. 20; aviso si se transforma o trunca; nunca es clave de cruce | APROBADA | docs/03 §F; completada por D-033 y D-035; composición P-14 |
| D-022 | Perfil de empresa importable/exportable, sin nómina ni datos de empleados, separado del maestro | APROBADA | docs/03 §C; formato P-19 |
| D-023 | Se aceptan las posiciones BNA derivadas por suma de longitudes, con trazabilidad al PDF; las interpretaciones pendientes se mantienen documentadas | APROBADA | docs/04 §2.2 |
| D-024 | Se implementa la validación de DV de CUIL y CBU como **validación externa al layout bancario**; no se atribuye a los PDF bancarios; se incorporarán fuentes oficiales ARCA/BCRA | APROBADA | docs/04 §5; P-18 |
| D-025 | Patagonia: la especificación B.2 (PAT-DR) es la fuente principal del generador; el instructivo Excel (PAT-XL) es evidencia complementaria; las contradicciones se documentan y no se resuelven en silencio | APROBADA | docs/04 §3 |
| D-026 | Mapeo explícito y configurable `Descripcion` Finnegans → código BNA / código Patagonia. No se infieren códigos; no se asume que Agrario/Comercio/Directivos/Liq. Final sean tipos bancarios. Una descripción sin mapeo bloquea la generación del banco correspondiente | APROBADA (mecanismo) · códigos **PENDIENTES** de definición/homologación | docs/04 §4; P-09, P-10 |
| D-027 | Motor fixed-width genérico en `banks/fixed-width/` (`FieldSpec`, `RecordSpec`, `FixedWidthSerializer`, `FixedWidthParser`, `FixedWidthInspector`). Los layouts BNA y Patagonia se declaran como datos encima del motor. Las reglas bancarias quedan fuera de React; la UI no conoce posiciones ni construye TXT | APROBADA | docs/02 |
| D-028 | Hoja de ruta F0–F8: análisis · base y spike · parsers y dominio · conciliación y UI · motor fixed-width · BNA · Patagonia · homologación · empaquetado/producción. F1–F4 avanzan aunque haya bloqueos bancarios | APROBADA | docs/05 |
| D-029 | Los bloqueos e interpretaciones bancarias (como mínimo BNA-1, 2, 5, 6, 9 y PAT-1, PAT-2, más los demás que afecten bytes) no se resuelven sin respuesta del banco o decisión documentada. La generación productiva queda PENDIENTE DE HOMOLOGACION | APROBADA | docs/04 §6–7 |
| D-030 | Situación actual: los pagos se cargan manualmente persona por persona en ambos bancos. No hay TXT histórico que sirva de golden file. Cumplir 200 posiciones no garantiza la aceptación: homologación obligatoria con cada banco | APROBADA (contexto) | docs/04 §1, §8 |
| D-031 | Ajustes técnicos de la arquitectura evaluada en F0: dinero en `bigint` centavos (sin floats); fechas civiles `YYYY-MM-DD` sin cálculo de feriados (el operador ingresa la fecha); salida ASCII 0x20–0x7E; CSP con `connect-src 'none'` en el build; `autocomplete="off"` en la configuración; inspector independiente con round-trip | APROBADA (arquitectura aprobada con modificaciones) | docs/02 |
| D-032 | **Readiness independiente por banco.** Existen `GlobalReconciliationStatus`, `BnaReadiness` y `PatagoniaReadiness`. Una incidencia que afecta solo a un banco bloquea solo el TXT de ese banco. Las incidencias que impiden determinar el destino (o el importe) de una fila afectan la conciliación global. Resumen global: Finnegans = BNA + Patagonia + excluidos + pendientes; con pendientes = 0, Finnegans = BNA + Patagonia + excluidos. La descarga de cada banco exige sus filas conciliadas, cero bloqueantes y cero revisiones pendientes de ese banco, y su total y cantidad conciliados. Sin sacrificar trazabilidad | APROBADA (resuelve P-12) | docs/03 §E.1, §G; interpretaciones P-24, P-25 |
| D-033 | La normalización automática del nombre Patagonia es `INFORMACION` (no `REQUIERE_REVISION`). Se conservan para auditoría el valor original, el valor generado y la indicación de truncamiento. Nunca se modifica el archivo Finnegans | APROBADA (resuelve P-15) | docs/03 §F |
| D-034 | Neto = 0: se excluye del pago, se informa, **no** se exige maestro ni datos bancarios; se mantienen las validaciones estructurales mínimas para identificar la fila | APROBADA (resuelve P-16) | docs/03 §E.2 reglas 1–4 |
| D-035 | Si después de las transformaciones aprobadas quedan caracteres cuyo tratamiento no respalda el contrato bancario: `BLOQUEANTE`. No eliminar, reemplazar ni inventar transformaciones | APROBADA provisionalmente (resuelve P-13) | docs/03 §F |
| D-036 | El único motivo automático de exclusión es `NETO_CERO`. No se agregan motivos sin necesidad funcional confirmada | APROBADA para esta etapa (resuelve P-11) | docs/03 §G.1 |
| D-037 | Modelo conceptual de `Descripcion`: `descripcionOriginal` + `periodo` + `tipoLiquidacionNormalizado`; `JULIO Agrario` y `AGOSTO Agrario` no deben ser tipos distintos. La regla de extracción **no** se implementa en F1 ni se usan regex/heurísticas de producción hasta analizar todas las variantes reales | APROBADA (modelo) · regla **PENDIENTE** F2/F3 | docs/03 §A.4; P-10 |
| D-038 | Autorización F1: `git init` local, rama `f1-base-tecnica`, commits locales, **sin remoto ni push**; instalación de las dependencias propuestas; descarga de Chromium para Playwright; T10 solo local y con resultados agregados. ExcelJS aprobado solo como **candidato**, confinado a `src/import/xlsx/`; si no supera el spike, plan B | APROBADA | docs/05 F1 |
| D-039 | Decisiones técnicas de F1: TypeScript **6.0.3** (no 7.0: typescript-eslint 8.71 exige `< 6.1.0`); ESLint **9.39.5** (no 10: eslint-plugin-jsx-a11y 6.10 no declara soporte); `@types/node` 24 para Node 24; Vitest y el build usan el bundle de navegador de ExcelJS; guarda previa del zip con `fflate`; scripts de herramientas en TypeScript ejecutados por Node 24 sin compilación; fixtures generados en memoria (sin binarios versionados) | APROBADA dentro de la autorización F1 (D-038); revisable | `docs/spikes/F1_XLSX.md`, §3 de este documento |

## 2. Preguntas

### 2.1 Resueltas

| ID | Pregunta | Resolución |
|---|---|---|
| P-01 | Banco pagador | D-012 (destino por columna `Banco`) |
| P-02 | ¿Uno o varios CUIT por liquidación? | D-011 (uno; multi-CUIT fuera de alcance v1) |
| P-06 | Casos especiales | Neto cero D-016; sin banco D-013; CUIL repetido D-015. Liq. final y demás clasificaciones → P-09 |
| P-07 | Perfil empresarial exportable | D-022 |
| P-11 | Exclusiones distintas de neto 0 | D-036 (solo `NETO_CERO`) |
| P-12 | ¿Todo-o-nada entre bancos? | D-032 (readiness independiente) |
| P-13 | Caracteres no representables en el nombre Patagonia | D-035 (`BLOQUEANTE`, provisional) |
| P-15 | Nivel del aviso de nombre transformado | D-033 (`INFORMACION`, con auditoría) |
| P-16 | Neto 0 sin maestro ni datos bancarios | D-034 |

### 2.2 Abiertas

| ID | Pregunta | Responsable | Bloquea |
|---|---|---|---|
| P-03 | Patagonia: ¿el convenio contratado usa B.2 "cuenta confirmada"? Resolver PAT-1 y PAT-11 | Usuario / Banco Patagonia | F6 |
| P-04 | Patagonia: ¿quién provee cuenta, sucursal, banco, documento y dependencia por empleado? ¿Existen las respuestas de alta (A.2)? | Usuario / RRHH | Carga del maestro |
| P-05 | BNA: BNA-1, 2, 5, 6, 7, 9 y 11 | Usuario / BNA | F5 (habilitación) |
| P-08 | Operación: PCs, sistema operativo, navegador, permiso de instalación, respaldo del maestro | Usuario | F8 |
| P-09 | Código BNA (`0000`/`0003`) y código Patagonia (Anexo III) de cada clasificación (Agrario, Comercio, Directivos, Liq. Final) | Empresa / bancos | Generación BNA y Patagonia |
| P-10 | Regla de extracción de `periodo` y `tipoLiquidacionNormalizado` desde `Descripcion` (modelo aprobado en D-037). Analizar primero, de forma segura, todas las variantes reales; sin regex/heurísticas de producción hasta entonces | Usuario | F2/F3 (mapeo) |
| P-14 | Nombre Patagonia: composición `APELLIDO NOMBRE` con un espacio (propuesta F0) | Usuario | F6 |
| P-17 | BNA, campos libres: información criterio empresa, referencia unívoca, identificación del beneficiario (CUIL / legajo / vacío), datos de la empresa | Usuario | F5 |
| P-18 | Incorporar a `references/` las fuentes oficiales ARCA (CUIL) y BCRA (CBU) | Usuario | Trazabilidad de D-024 |
| P-19 | Formato del archivo de perfil de empresa (propuesto: JSON versionado) | Usuario | F3 |
| P-20 | Patagonia: un lote por envío o un lote por clasificación; numeración de lotes (PAT-13) | Usuario / Banco Patagonia | F6 |
| P-21 | Responsable y canal de las consultas a cada banco | Usuario | F5, F6, F7 |
| P-22 | La afirmación previa sobre "encriptación opcional" (web de Patagonia) no está en `references/`; se retiró de docs/04. Si es relevante, guardar la fuente | Usuario | — |
| P-23 | BNA: cantidad de dígitos del convenio (BNA-5) | Usuario | F5 |
| P-24 | Interpretación de D-032: la descarga de **cualquier** banco exige además la conciliación global cerrada (sin pendientes), porque una fila pendiente podría terminar en cualquiera de los dos bancos. Confirmar | Usuario | F3 |
| P-25 | Interpretación de D-032/D-034: un CUIL inválido o repetido en una fila sin destino o excluida (neto 0) tiene alcance global. Confirmar | Usuario | F3 |
| P-26 | T11: verificación manual de la plantilla de prueba en Excel (`docs/spikes/F1_XLSX.md` §8) | Usuario | Cierre de F1 |
| P-27 | Confirmar ExcelJS como librería XLSX (recomendación APROBAR con condiciones) y aceptar el riesgo residual de `uuid` (camino vulnerable no usado) | Usuario | Cierre de F1 |

## 3. Fuentes y versiones

Recibidas el 14-10-2026. Los PDF y el XLSX son de uso local y no se
versionan (`.gitignore`).

| Archivo en `references/` | SHA-256 | Observación |
|---|---|---|
| `BNA_Instructivo_Pago_Haberes_GT.pdf` | `d28ffbcc3cae01d56b48c8416d44c22a03d53b682800381b7a7d8dabe88f2f56` | Antes citado como "Instructivo diseño de archivo Pagos GT.pdf" |
| `Patagonia_Diseno_Registros_Plan_Sueldos.pdf` | `575a2a647c8ed32e37274c5eabee417c5371c99fe904f289526269a4850cc33e` | Origen: guía de implementación Patagonia Sueldo → "Descargar Diseño de Registro" |
| `Patagonia_Instructivo_Excel_Acreditaciones.pdf` | `e87506735c45914d664942cc79ed07925a73047470be6d9fa1290dc1794bbdf5` | Manual del aplicativo Excel del banco |
| `Finnegans_Reporte_Ejemplo.xlsx` | `7affbcec6099d93d1e5f72751a36690e525c0aa14feeb5b176f9eb08487e7d7a` | **Datos reales**; antes citado como `Reporte - 2026-10-14T114227.283.xlsx` |
| `LEEME.txt` | — | Instrucción de uso local de `references/` |

## 3.1 Dependencias directas (F1, versiones exactas)

Instaladas el 14-10-2026 con `save-exact`; el lockfile fija las
transitivas. `npm audit`: 2 advertencias moderadas por `uuid < 11.1.1`
vía ExcelJS (evaluación en `docs/spikes/F1_XLSX.md` §7).

| Dependencia | Versión | Licencia | Uso |
|---|---|---|---|
| `exceljs` | 4.4.0 | MIT | Adaptador XLSX (solo `src/import/xlsx/`) |
| `fflate` | 0.8.3 | MIT | Guarda previa del zip; fixtures |
| `react` / `react-dom` | 19.3.1 | MIT | UI |
| `vite` | 8.3.4 | MIT | Build y servidor local |
| `@vitejs/plugin-react` | 6.1.2 | MIT | Build |
| `typescript` | 6.0.3 | Apache-2.0 | Tipado estricto |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.3 | MIT | Estilos |
| `eslint` / `@eslint/js` | 9.39.5 | MIT | Lint |
| `typescript-eslint` | 8.71.2 | MIT | Lint con tipos |
| `eslint-plugin-react-hooks` | 7.1.1 | MIT | Lint |
| `eslint-plugin-jsx-a11y` | 6.10.2 | MIT | Accesibilidad |
| `eslint-config-prettier` | 10.1.8 | MIT | Lint |
| `globals` | 17.13.0 | MIT | Lint |
| `prettier` | 3.9.10 | MIT | Formato |
| `vitest` / `@vitest/coverage-v8` | 5.0.4 | MIT | Tests unitarios |
| `jsdom` | 30.1.2 | MIT | Tests de UI |
| `@testing-library/react` | 16.3.3 | MIT | Tests de UI |
| `@testing-library/dom` | 10.4.2 | MIT | Tests de UI |
| `@testing-library/jest-dom` | 7.0.1 | MIT | Tests de UI |
| `@testing-library/user-event` | 14.6.8 | MIT | Tests de UI |
| `@playwright/test` | 1.64.1 | Apache-2.0 | e2e (Chromium headless shell 156) |
| `@types/node` | 24.19.2 | MIT | Tipos |
| `@types/react` / `@types/react-dom` | 19.3.0 | MIT | Tipos |

## 4. Registro de respuestas bancarias

Registrar cada consulta y respuesta con fecha, fuente y prueba asociada.
Toda respuesta actualiza los estados de `04_CONTRATOS_BANCARIOS.md`.

| Fecha | Banco | ID consultado | Consulta | Respuesta | Evidencia | Prueba asociada |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |

## 5. Cambios documentales

| Fecha | Cambio |
|---|---|
| 14-10-2026 | Cierre documental de F0: contrato de datos y maestro v1 (docs/03), contratos bancarios con posiciones y estados (docs/04), decisiones D-011 a D-031 y preguntas P-09 a P-23 (docs/07), motor fixed-width (docs/02), hoja de ruta F0–F8 (docs/05), ajustes de consistencia en README, CLAUDE.md, docs/01 y docs/06 |
| 15-10-2026 | F1 técnica completada en la rama `f1-base-tecnica`: informe del spike XLSX (`docs/spikes/F1_XLSX.md`), D-039, dependencias, P-26 y P-27 |
| 14-10-2026 | F0 aprobada. Decisiones finales D-032 a D-038: readiness independiente por banco con conciliación global, auditoría del nombre Patagonia, neto 0, caracteres no respaldados, exclusiones, modelo de `Descripcion`, autorización de F1. docs/03 v2 (alcance de incidencias, §G reescrito, tipos) |
