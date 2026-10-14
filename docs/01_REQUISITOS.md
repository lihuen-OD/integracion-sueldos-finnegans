# 01 · Alcance y requisitos

## Alcance MVP

1.  Importar liquidación XLSX Finnegans y detectar estructura esperada.
2.  Importar maestro bancario XLSX y validar identidad, cuentas y campos
    propios de cada banco.
3.  Conciliar **CUIL** y comprobar legajo, banco y presencia de datos
    requeridos.
4.  Mostrar tabla de conciliación, excepciones, totales, filtros, vista
    previa y reporte descargable de errores.
5.  Cargar o completar el perfil de empresa (importable/exportable, sin
    datos de empleados, D-022) y los parámetros de envío de cada banco.
    El destino de cada empleado lo determina la columna `Banco` de
    Finnegans (D-012).
6.  Generar TXT GT Haberes de Nación y TXT Plan Sueldos B.2 de Patagonia
    **solo con contratos confirmados**.
7.  Autovalidar archivo generado: campos, longitudes, bytes, cantidades,
    sumas, orden y caracteres.
8.  Descargar TXT y reporte de conciliación. No subir información a
    terceros.
9.  Descargar plantilla maestro y, opcionalmente, **prellenar
    identificadores y nombres** desde Finnegans; completar datos
    bancarios fuera de la app.

## Fuera de alcance

-   Transferencias o conexión a home banking.
-   Integración API con Finnegans o bancos.
-   Altas/bajas de cuentas bancarias en Patagonia; solo acreditación
    B.2.
-   Multiusuario, sincronización, base de datos, cloud, servidor, login.
-   Procesar TXT concatenado de Finnegans en el MVP.
-   Un mismo Excel Finnegans con varios CUIT empleadores (D-011).
-   Homologación bancaria automática.

## Flujos

**Preparación inicial:** RRHH obtiene el maestro, carga CBU y datos
específicos, lo conserva como archivo de trabajo.

**Cada liquidación:** abrir app offline → cargar Finnegans XLSX → cargar
maestro XLSX → cargar perfil de empresa y completar parámetros de envío
→ conciliar → revisar incidencias (corregir fuentes ante `BLOQUEANTE`,
resolver `REQUIERE_REVISION`) → vista previa → descargar TXT y reporte →
subir manualmente a cada banco.

**Situación actual (D-030):** hoy los pagos se cargan manualmente
persona por persona en BNA y en Patagonia. La app busca reemplazar esa
carga por archivos masivos homologados.

## Requisitos no funcionales

-   Funcionar sin conexión de red durante toda la operación.
-   Sin retención automática de datos sensibles.
-   Accesibilidad básica, navegación con teclado, estados de error
    claros.
-   Trazabilidad de errores por fila y columna de origen.
-   No permitir importes negativos, CBU inválidos, identidades
    duplicadas o filas huérfanas sin intervención.
-   Protección ante XLSX malformado, fórmulas, archivos enormes,
    encabezados alterados y celdas interpretadas como números.
-   Validación de salida independiente del generador (round-trip parser
    o inspector).
-   Mecanismo de comprobación de totales contra Finnegans, contra
    maestro y contra TXT.

## Preguntas

Resueltas y abiertas en `07_DECISIONES_Y_PENDIENTES.md` §2. Resumen:

-   Banco destino: columna `Banco` de Finnegans (D-012).
-   Una empresa/CUIT por archivo (D-011).
-   Sin banco → el operador asigna destino (D-013); neto cero → excluido
    (D-016); CUIL repetido → bloqueo, sin fusionar (D-015).
-   Abiertas: mapeo de liquidaciones a códigos bancarios (P-09, P-10),
    datos de convenio y cuenta de origen, variante B.2 contratada (P-03)
    y datos Patagonia por empleado (P-04).
