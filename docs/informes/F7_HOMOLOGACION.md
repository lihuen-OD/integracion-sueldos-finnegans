# F7 · Homologación bancaria — documento operativo

**Estado:** CP-F7-0 aprobado (auditoría humana); CP-F7-0-B ejecutado,
**pendiente de auditoría humana**.
**Rama:** `f7-homologacion`.
**Base:** `main` en `d8be143ca3dc34fc9a0aa39246ba279204748b3b`.
**Fecha:** 27-10-2026.

F5 y F6 están **técnicamente cerradas e integradas**, pero **ninguna está
homologada**. La aplicación sigue **NO apta para pagos reales** y F8 no se
inicia.

## 1. Objetivo

Dejar el repositorio preparado para homologar Banco Nación y Banco Patagonia
sin confundir tres cosas distintas: resolver el contrato, generar bytes y
obtener aceptación bancaria.

CP-F7-0 no resuelve preguntas bancarias, no modifica código, no genera
archivos, no contacta bancos y no cambia estados `B`/`I`/`C`.

## 2. Estado inicial

| Banco | Implementación técnica | Contrato documental | Generación productiva | Homologación |
|---|---|---|---|---|
| BNA | Cerrada (F5) | Abierto: 1 `B` + 8 `I` | Bloqueada (`BNA-1`) | No |
| Patagonia | Cerrada (F6) | Abierto: 2 `B` + 15 `I` | Bloqueada (`PAT-1`, `PAT-2`) | No |

Ambas fachadas devuelven bytes **solo en memoria** y terminan en
`CONTRATO_BNA_BLOQUEADO` / `CONTRATO_PATAGONIA_BLOQUEADO` antes de
serializar. Desde CP-F7-0-B, la fachada BNA acepta perfiles v2 y v3 usando
solo la sección `bna`; v1 sigue siendo `PERFIL_VERSION_INCOMPATIBLE`.
Aceptar v3 no habilita la generación productiva. Los goldens existentes son
técnicos, sintéticos y **no homologados**.

## 3. Separación contrato / homologación

**Nivel 1 — resolución contractual.** Un `B`/`I` pasa a regla confirmada con
evidencia suficiente: documentación bancaria oficial, respuesta escrita del
banco o decisión humana autorizada. No exige un archivo aceptado por cada
campo.

**Nivel 2 — homologación bancaria.** Etapa posterior e integral. Un único
archivo aceptado puede validar muchas reglas a la vez.

Cadena explícita:

> resolver contrato **≠** generar archivo **≠** inspeccionar **≠** enviar
> **≠** archivo aceptado **≠** banco homologado **≠** autorización interna
> para producción.

## 4. Taxonomía A–E

| Categoría | Significado |
|---|---|
| **A** | Resoluble internamente: documentación disponible, decisión de producto/arquitectura, configuración explícita o decisión de negocio |
| **B** | Requiere confirmación explícita de Banco Nación o Banco Patagonia |
| **C** | Requiere archivo, ejemplo homologado, prueba, acuse o resultado del canal para resolver **esa** incertidumbre |
| **D** | Requiere dato de la empresa: convenio, número de empresa, modalidad, cuenta, altas, clasificaciones |
| **E** | Requiere fuente oficial externa no incorporada (ARCA, BCRA, calendario) |

Un ítem puede tener varias categorías. Los estados contractuales `B`/`I`/`C`
son otra dimensión y no se mezclan con esta taxonomía.

### 4.1 Roll-up (41 ítems = 26 contractuales + 15 P)

| Categoría | Total |
|---|---|
| A | 8 |
| B | 33 |
| C confirmado | 0 |
| C contingente | 3 (BNA-9, PAT-10, PAT-14) |
| D | 13 |
| E | 3 |
| Exclusivamente interno | 4 (P-08, P-14, P-21, P-22) |

**C contingente** significa: solo pasará a C si el banco responde que la
incertidumbre no puede resolverse documentalmente y debe verificarse por
ingesta. No cambia `ContractStatus` ni `docs/04`.

## 5. Readiness

### 5.1 BNA

| # | Estado | Valor |
|---|---|---|
| 1 | Implementación técnica existente | Sí |
| 2 | Contrato documental resuelto | No |
| 3 | Configuración de empresa | Parcial |
| 4 | Generación técnicamente posible | Sí, por capas técnicas |
| 5 | Generación productiva habilitada | No |
| 6 | Archivo materializable para prueba | No |
| 7 | Archivo enviado al banco | No |
| 8 | Aceptación bancaria | No |
| 9 | Homologación | No |
| 10 | Autorización interna para producción | No |

### 5.2 Patagonia

| # | Estado | Valor |
|---|---|---|
| 1 | Implementación técnica existente | Sí |
| 2 | Contrato documental resuelto | No |
| 3 | Configuración de empresa | Parcial |
| 4 | Generación técnicamente posible | Sí, por capas técnicas |
| 5 | Generación productiva habilitada | No |
| 6 | Archivo materializable para prueba | No |
| 7 | Archivo enviado al banco | No |
| 8 | Aceptación bancaria | No |
| 9 | Homologación | No |
| 10 | Autorización interna para producción | No |

Capacidad técnica ≠ generación productiva ≠ homologación.

## 6. Política de evidencia

| Artefacto | Qué es | Regla |
|---|---|---|
| Golden técnico sintético | Fixture de regresión 100 % sintético | Inmutable; no prueba aceptación bancaria |
| Fixture contractual confirmado | Caso sintético derivado de una respuesta bancaria | Opcional; solo si aporta valor, es 100 % sintético, pasa `check:sensitive` y hay aprobación explícita |
| Evidencia bancaria | Respuesta, acuse, fecha, canal, SHA-256, resultado, observaciones | No es fixture; si contiene datos reales, el original no se versiona |

Una aceptación bancaria no obliga a crear un golden nuevo. No se fijan
todavía nombres definitivos de archivos de evidencia.

## 7. Política de privacidad

- Preferencia por datos de empleados 100 % sintéticos.
- Si el banco exige datos reales, se usan **solo localmente** para la prueba.
- Nunca en fixture ni en repo: CUIL real, CBU real de empleado, nombres
  reales, legajos reales, importes reales, nómina real ni TXT real.
- La configuración empresarial real necesaria para formar bytes puede usarse
  localmente, pero no se convierte automáticamente en fixture ni en
  documentación pública.
- La evidencia versionada debe estar redactada/sanitizada.

## 8. Diseño del harness (solo diseño)

Herramienta local, separada de la UI, que:

- importa **exclusivamente** `generarBna` y `generarPatagonia`;
- no importa mapper/serializer internos;
- no inyecta política ni aptitud, no usa mocks;
- no bypassa readiness ni conciliación;
- materializa exactamente los bytes que produciría la aplicación;
- ejecuta/recibe la inspección productiva;
- calcula SHA-256 e informa tamaño y cantidades/totales sin PII;
- escribe el TXT fuera del repositorio;
- nunca sube ni envía automáticamente.

No es ruta productiva, no forma parte del bundle/UI. Se implementa en
CP-F7-D1, no en CP-F7-0.

## 9. Checkpoints

| CP | Alcance | Estado |
|---|---|---|
| CP-F7-0 | Decisiones y documentación | Ejecutado y aprobado (auditoría humana) |
| CP-F7-0-B | Implementación G-1 (v2 + v3 en BNA, motivo de versión incompatible, tests) | Ejecutado; pendiente de auditoría |
| CP-F7-A | Paquete de consultas + trazabilidad; STOP antes de enviar | No iniciado |
| CP-F7-B | Respuestas BNA | No iniciado |
| CP-F7-C | Respuestas Patagonia | No iniciado |
| CP-F7-D1 | Harness local | No iniciado |
| CP-F7-D2 | Materialización y envío controlado (acto humano) | No iniciado |
| CP-F7-E | Evidencia, iteraciones y cierre | No iniciado |

## 10. Pendientes humanos

| ID | Pendiente | Estado |
|---|---|---|
| P-14 | Composición exacta del nombre Patagonia | Abierta |
| P-21 | Responsable y canal de contacto con cada banco | Abierta |
| — | Datos reales del convenio BNA (número, dígitos, CBU empresa, moneda) | Pendiente |
| — | Datos reales del convenio Patagonia (número de empresa, modalidad B.2) | Pendiente |
| — | Altas A.2 y origen de datos por empleado (P-04) | Pendiente |
| — | Política interna sobre evidencia redactada | Pendiente |
| — | Autorización para usar datos sintéticos en la homologación | Pendiente |

P-21 no bloquea F7 documental; sí bloquea enviar consultas, registrar un
canal real e iniciar una prueba externa.

## 11. Pendientes BNA

| ID | Tema | Estado | Cat. |
|---|---|---|---|
| BNA-1 | Tipo de documento del beneficiario | BLOQUEADA | B |
| BNA-2 | Bloque 2 del CBU en el detalle | I | B |
| BNA-5 | Convenio: relleno y longitud | I | B + D |
| BNA-6 | Entidad y sucursal derivadas del CBU | I | B |
| BNA-7 | Fecha de compensación | I | B + E |
| BNA-8 | Alfabeto y mayúsculas | I | B |
| BNA-9 | Fin de línea / salto final | I | B (C contingente) |
| BNA-10 | Mismo CBU en dos beneficiarios | I | A + B |
| BNA-11 | Campos libres vacíos | I | B + D |

## 12. Pendientes Patagonia

| ID | Tema | Estado | Cat. |
|---|---|---|---|
| PAT-1 | Relleno final del detalle (93 vs 96) | BLOQUEADA | B |
| PAT-2 | Código de dependencia (`N` vs `A`) | BLOQUEADA | B + D |
| PAT-3 | Campos que deben coincidir con el alta | I | B |
| PAT-4 | Provincia cuando el tipo no es `004` | I | B |
| PAT-5 | Número de envío | I | B |
| PAT-6 | Número de empresa vs convenio | I | B + D |
| PAT-7 | Anexo III | I | B + D |
| PAT-8 | Anexo I (`004`) | I | B |
| PAT-9 | Apellido y nombre | I | B |
| PAT-10 | Nombre de archivo | I | B (C contingente) |
| PAT-11 | Variante B.2 | I | B + D |
| PAT-12 | Caracteres en concepto | I | B |
| PAT-13 | Loteo | I | A + B |
| PAT-14 | Encoding y fin de línea | I | B (C contingente) |
| PAT-15 | Versión del registro 1 | I | B |
| PAT-16 | Comprobante no informado | I | B |
| PAT-17 | Código de banco del R2 | I | B + D |

PAT-17 no autoriza modificar `src/reconciliation/**` ni la regla `034`
congelada por D-086.

## 13. Registro futuro de pruebas y hashes (sin PII)

Se completa en CP-F7-D2/CP-F7-E. Columnas previstas:

| Fecha | Banco | Archivo (referencia local) | SHA-256 | Bytes | Registros / lotes | Total (centavos) | Canal | Acuse | Resultado | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — | — | — |

Reglas: sin CUIL, CBU, nombres, legajos ni importes individuales; el archivo
original queda fuera del repositorio; la evidencia versionada es redactada.

## 14. Lo que este documento no afirma

- No afirma que BNA o Patagonia hayan aceptado ningún archivo.
- No afirma que la aplicación sea apta para pagos reales.
- No afirma que las reglas `B`/`I` estén resueltas.
- No convierte una respuesta documental en homologación.
