# F7 · BNA — Definiciones e hipótesis técnicas

**Checkpoint:** CP-F7-BNA-Hipotesis-A1.
**Rama:** `f7-homologacion`. **HEAD de referencia:** `49f4b14`.
**Fecha:** 05-11-2026.
**Estado:** registro de hipótesis técnicas provisionales. **No** homologa, **no** cierra el contrato BNA, **no** habilita generación productiva y **no** autoriza pagos reales.

## 1. Alcance y límites

Este documento registra las hipótesis H-BNA-1, H-BNA-2 y H-BNA-6 usadas por la política aislada `POLITICA_BNA_HIPOTESIS_TECNICA` (`src/banks/bna/politicaHipotesis.ts`). Su único fin es demostrar capacidad técnica y trazabilidad con datos sintéticos.

Límites explícitos:

- La política de hipótesis **no** se usa desde `generarBna`.
- `POLITICA_BNA_PRODUCTIVA` no cambia: sigue devolviendo `SIN_RESOLUCION` para BNA-1, BNA-2, BNA-6, BNA-11/P-17 y P-09/P-10.
- `ISSUES_BNA` no cambia: BNA-1 sigue `BLOQUEADA`; BNA-2, BNA-6 y BNA-11 siguen `INTERPRETACION_PENDIENTE`.
- No se modifica la geometría (`spec.ts`), el mapper (`mapeo.ts`), la serialización, la autorización ni la fachada.
- No se implementan BNA-11/P-17 ni P-09/P-10.
- No se usan datos reales, no se lee `references/**` y no se genera ningún TXT de pagos.

## 2. Clases de evidencia

Se conserva la taxonomía de `docs/04` §3.5.1 y se agrega una clase explícita para la evidencia visual:

| Código | Nombre | Qué autoriza | Qué no autoriza |
|---|---|---|---|
| **D** | Diseño/documentación existente en `docs/**` | Lo que el instructivo GT 200 fija literalmente, según la transcripción de `docs/04` §2.2 | Completar lo que el documento no dice |
| **V** | Evidencia visual informada del video enviado por Banco Nación, no autenticada ni transcripta en `docs/**` | Una hipótesis técnica provisional y comprobable | Presentarla como respuesta escrita, homologación o regla confirmada |
| **DR** | Contradicción documental conservada | Nada por sí sola; obliga a decisión o confirmación | Resolver por mayoría de ejemplos |
| **DE** | Decisión empresarial pendiente (RRHH/Usuario) | Nada por sí sola; identifica una decisión que el banco delegó o que depende de la empresa | Suplirla con un default o con el valor de un ejemplo |
| **PH** | Pendiente de homologación bancaria | Nada por sí sola; recuerda que un test local no homologa | Considerar que un `C` contractual o un test verde equivale a aceptación bancaria |

Regla central: **V ≠ RC**. El video no es una respuesta escrita del banco y no cierra BNA-1, BNA-2 ni BNA-6.

## 3. BNA-1 — Tipo de documento del beneficiario

### 3.1 Evidencia del diseño documentado

`docs/04` §2.2, registro 2, campo 10 (posiciones 73–74, tipo `N`):

> “p.9: `96` para DNI. p.11: `02` con clave fiscal. p.15: `96` con CUIL. Otros códigos remiten a un documento no disponible”.

Campos relacionados:

- Campo 9, clase de documento (posición 72): “`1` clave fiscal · `2` otros documentos”.
- Campo 11, número de documento (posiciones 75–85): “CUIL (11 dígitos) o `000` + documento”.

`docs/04` §6.1, BNA-1, estado **B (BLOQUEADA)**:

> “`96` para DNI (p.9) vs clase `1` + tipo `02` + CUIL (p.11) vs clase `1` + tipo `96` + CUIL (p.15). Otros códigos en un documento no disponible. **No se elige `02` ni `96` como default**”.

### 3.2 Evidencia visual informada

La revisión visual del video de Banco Nación, informada por el usuario, muestra:

- Clase `1` = clave fiscal, tipo `02`.
- Clase `2` = otros documentos, tipo `96`.
- Con clave fiscal, el ejemplo usa CUIL de 11 dígitos.
- Con otros documentos, muestra un número documental con ceros a la izquierda.
- Otra imagen de ejemplo combina clase `1` y tipo `96`.

Esta evidencia **no** está transcripta en `docs/**` ni autenticada como respuesta del banco. Se registra como `V` y no reemplaza a los PDF.

### 3.3 Hipótesis H-BNA-1

**H-BNA-1 (implementada en la política de hipótesis):** para el caso de clave fiscal con CUIL, informar clase `1` y tipo `02`; el número de documento es el CUIL completo de 11 dígitos ya validado en la fila.

La hipótesis se apoya en la combinación que el video muestra para clave fiscal y en el ejemplo de `docs/04` p.11. No se implementa la clase `2/96`: requiere un número documental distinto del CUIL que el modelo BNA actual no transporta, y introducirlo excedería este checkpoint.

### 3.4 Contradicciones que siguen pendientes

- La imagen clase `1` + tipo `96` no se explica por el texto ni por el video. No se selecciona ni se descarta por mayoría.
- La clase `2` + tipo `96` con número documental con ceros a la izquierda no está implementada.
- No hay respuesta escrita de Banco Nación que fije el par clase/tipo para un beneficiario identificado por CUIL.
- BNA-1 sigue `BLOQUEADA`; la hipótesis no cambia el contrato.

## 4. BNA-2 — CBU del registro individual

### 4.1 Evidencia del diseño documentado

`docs/04` §2.2, registro 2, campo 5 (posiciones 11–24, tipo `N`):

> “Dígitos 9–22. El texto dice ‘CBU **de la empresa**’; el ejemplo usa el CBU del beneficiario”.

`docs/04` §6.1, BNA-2, estado **I**:

> “El texto dice ‘2do bloque del CBU de la empresa’; el ejemplo usa el CBU del beneficiario. **Nunca** copiar el CBU de origen al destino”.

El registro 1, campo 4 (posiciones 17–30), sigue usando el bloque 2 del CBU de la empresa.

### 4.2 Evidencia visual informada

El video muestra:

- Registro 1 con el CBU de la empresa.
- Registro 2 con un CBU distinto, correspondiente al beneficiario del ejemplo.
- El campo del registro 2 se llama “CBU cuenta a acreditar”.

### 4.3 Hipótesis H-BNA-2

**H-BNA-2 (implementada en la política de hipótesis):** el registro individual usa el CBU validado del beneficiario; el registro de cabecera conserva exclusivamente el CBU empresarial.

La hipótesis se apoya en el ejemplo documentado, en el nombre del campo y en la evidencia visual. No se presenta como confirmación bancaria: la descripción textual contradictoria sigue sin respuesta.

### 4.4 Contradicciones que siguen pendientes

- El texto “CBU de la empresa” no fue corregido por el banco.
- Si el banco esperara el CBU empresarial en el registro individual, todos los pagos quedarían mal.
- La regla de seguridad “nunca copiar el CBU de origen al destino” se conserva, pero no responde por sí sola qué CBU debe ir en posiciones 11–24.

## 5. BNA-6 — Entidad y sucursal

### 5.1 Evidencia del diseño documentado

`docs/04` §2.2:

- Registro 1, campo 3 (posiciones 13–16): “`0 + código BCRA`; en el ejemplo coincide con los dígitos 4–7 del CBU de la empresa”.
- Registro 2, campo 2 (posiciones 2–5): “`0 + código BCRA de la entidad`; en el ejemplo = `0` + dígitos 1–3 del CBU”.
- Registro 2, campo 3 (posiciones 6–9): “`0 + código BCRA de la sucursal`; en el ejemplo = dígitos 4–7 del CBU”.
- Registro 2, campo 4 (posición 10): “Último dígito del bloque 1 (dígito 8)”.

`docs/04` §6.1, BNA-6, estado **I**:

> “‘0 + código BCRA’ vs dígitos del CBU (la sucursal del CBU ya tiene 4 dígitos)”.

### 5.2 Evidencia visual informada

El ejemplo del registro 2 comienza con la secuencia:

> tipo `2`, entidad `0011`, sucursal `0599`, dígito verificador `8`.

Si el CBU del beneficiario comienza `01105998…`, la secuencia es consistente con:

- entidad = `0` + `011` = `0011`;
- sucursal = `0599` (posiciones 4–7 del CBU);
- DV = `8` (posición 8 del CBU).

### 5.3 Análisis de la ambigüedad

La sucursal `0599` **no discrimina** entre dos lecturas:

1. “`0` + código BCRA de 3 dígitos `599`” → `0599`.
2. “Los 4 dígitos de la sucursal del CBU” → `0599`.

Ambas producen el mismo valor porque la sucursal comienza con cero. Una sucursal como `1234` sí discrimina:

- “`0` + `234`” daría `0234`;
- “los 4 dígitos del CBU” da `1234`.

Por eso **no se generaliza una regla a partir de una sola sucursal de ejemplo**. La hipótesis implementada elige los 4 dígitos del CBU y se prueba expresamente con `1234`.

### 5.4 Hipótesis H-BNA-6

**H-BNA-6 (implementada en la política de hipótesis):**

- Entidad del beneficiario = `0` + los tres primeros dígitos del CBU.
- Sucursal del beneficiario = posiciones 4–7 del CBU, conservando sus cuatro dígitos.
- DV del primer bloque = posición 8 del CBU, mediante la lógica existente del mapper.
- Sucursal de la empresa = posiciones 4–7 del CBU empresarial.

No se modifica el mapper: ya consume estos valores y ya deriva el DV con `cbu.slice(7, 8)`.

### 5.5 Contradicciones que siguen pendientes

- La descripción “`0 + código BCRA`” no aclara si el código de sucursal es de 3 o 4 dígitos.
- No se confirmó qué se informa si el CBU del beneficiario corresponde a otra entidad.
- No se confirmó si la sucursal de la empresa se deriva igual que la del beneficiario.
- BNA-6 sigue `INTERPRETACION_PENDIENTE`.

## 6. Puntos que siguen sin resolución

| Punto | Estado en la política de hipótesis | Motivo |
|---|---|---|
| BNA-11 / P-17 | `SIN_RESOLUCION('BNA-11/P-17')` | El contenido y la obligatoriedad de los campos libres son decisión interna; la aceptación bancaria del vacío no está confirmada |
| P-09 / P-10 | `SIN_RESOLUCION('P-09/P-10')` | El mapeo de descripciones reales a `0000`/`0003` requiere decisión explícita de RRHH; no se infiere por palabras como AGRARIO, COMERCIO o LIQ FINAL |

Las pruebas que necesitan recorrer el camino técnico completo usan overrides sintéticos explícitos para estos dos puntos, fuera de `src/`. Esos overrides no son reglas de producción ni defaults.

## 7. Hipótesis técnica, confirmación bancaria, homologación y autorización

| Nivel | Qué significa | Estado BNA |
|---|---|---|
| Hipótesis técnica | Una regla provisional, explícita y comprobable, derivada de `D` o `V` | Implementada en `POLITICA_BNA_HIPOTESIS_TECNICA` |
| Confirmación bancaria | Una frase escrita del banco que fija el valor o la regla | No existe para BNA-1/2/6; `C confirmado = 0` |
| Homologación | Un archivo aceptado por el banco, con evidencia registrada | No iniciada |
| Autorización interna | Una decisión humana no falsificable que habilita producción | No otorgada; `produccionBnaHabilitada()` devuelve `false` |

Cadena explícita: **hipótesis técnica ≠ regla confirmada ≠ archivo aceptado ≠ banco homologado ≠ autorización de producción**.

## 8. Implementación y pruebas

- Política: `src/banks/bna/politicaHipotesis.ts` (`POLITICA_BNA_HIPOTESIS_TECNICA`).
- Pruebas: `tests/unit/banks/bna/politicaHipotesis.test.ts`.
- Datos: 100 % sintéticos, generados con los oráculos de `tests/fixtures/synthetic/identities.ts`; los CBU se validan con `parseCbu`.
- No se copian como golden los ejemplos inconsistentes del video (`66.876,54` / `80.545,23`, cantidad 1); `docs/04` BNA-3 ya registra esa inconsistencia.
- La fachada `generarBna` no acepta la política de hipótesis y sigue devolviendo un estado no generado.

## 9. Fuentes

- `docs/04_CONTRATOS_BANCARIOS.md` §2.1, §2.2, §3.5.1 y §6.1.
- `docs/informes/F7_CONSULTAS_BANCARIAS.md` §3.3 y §4.2–§4.9.
- `docs/informes/F7_HOMOLOGACION.md` §5.1 y §11.
- `docs/07_DECISIONES_Y_PENDIENTES.md` D-090 y D-095.
- Evidencia visual informada del video de Banco Nación (clase `V`), no transcripta en `docs/**`.

## 10. Declaración final

Este documento **no** presenta el video como archivo homologado, **no** altera decisiones históricas, **no** cierra BNA-1, BNA-2 ni BNA-6 y **no** habilita producción. La producción BNA sigue cerrada por construcción y la salida sigue pendiente de homologación.
