// Parser de MAESTRO_CUENTAS_EMPLEADOS.xlsx (docs/03 §B): contrato del adaptador XLSX →
// MasterRecord + hallazgos localizados. CUIL por N-02; LEGAJO, CBU y campos PAT_* sin normalizar
// (D-046). Los campos bancarios conservan su estado (VACIO / VALIDO / INVALIDO con motivo) y NO
// generan hallazgos aquí: su nivel depende del destino de la fila que use el registro (D-048) y lo
// resuelve la conciliación. Los hallazgos de registro (objetivo REGISTRO) se informan como
// INFORMACION si ninguna fila los usa (§B.3). Ningún detalle incluye valores de celdas.
import { parseCuil } from '../../domain/cuil';
import type { Hallazgo, NivelIncidencia } from '../../domain/incidencias';
import {
  validarCamposBancarios,
  VERSION_CONTRATO_MAESTRO,
  type CampoBancario,
  type LecturaMaestro,
  type MasterRecord,
  type ValorLeido,
} from '../../domain/maestro';
import {
  analizarEncabezados,
  celdaEn,
  crearHallazgo,
  crearHoja,
  filasVaciasIntermedias,
  leerValor,
  normalizarEncabezado,
  revisarEncabezados,
  type Hoja,
} from '../comun';
import type { Row, Sheet, Workbook } from '../xlsx';
import {
  CLAVE_VERSION_CONTRATO,
  COLUMNA_OPCIONAL,
  COLUMNAS_MAESTRO,
  HOJA_CONTROL,
  HOJA_EMPLEADOS,
  type ColumnaMaestro,
} from './contrato';

/** Hojas cuyo nombre coincide por N-01 (sin distinguir mayúsculas, acentos ni espacios). */
function hojasLlamadas(libro: Workbook, nombre: string): Sheet[] {
  const buscado = normalizarEncabezado(nombre);
  return libro.sheets.filter((hoja) => normalizarEncabezado(hoja.name) === buscado);
}

function versionNoSoportada(motivo: string, detalle: string, hoja?: Hoja): Hallazgo {
  return crearHallazgo(
    'VERSION_MAESTRO_NO_SOPORTADA',
    'BLOQUEANTE',
    'GLOBAL',
    [hoja === undefined ? { archivo: 'MAESTRO' } : hoja.ref()],
    { motivo, detalle },
  );
}

/** Lee VERSION_CONTRATO de la hoja Control (D-051): debe ser el texto `1`. */
function leerVersion(libro: Workbook, hallazgos: Hallazgo[]): string | null {
  const [control, ...otras] = hojasLlamadas(libro, HOJA_CONTROL);
  if (control === undefined || otras.length > 0) {
    hallazgos.push(
      versionNoSoportada(
        control === undefined ? 'SIN_HOJA_CONTROL' : 'VARIAS_HOJAS_CONTROL',
        control === undefined
          ? 'Falta la hoja Control: no se puede verificar la versión del contrato.'
          : 'Hay más de una hoja Control: no se elige ninguna.',
      ),
    );
    return null;
  }
  const hoja = crearHoja('MAESTRO', control.name);
  const fila = control.rows.find((row) => {
    const clave = leerValor(celdaEn(row, 1));
    return clave.tipo === 'TEXTO' && clave.texto === CLAVE_VERSION_CONTRATO;
  });
  if (fila === undefined) {
    hallazgos.push(
      versionNoSoportada('SIN_VERSION', 'La hoja Control no tiene VERSION_CONTRATO.', hoja),
    );
    return null;
  }
  const valor = leerValor(celdaEn(fila, 2));
  const version = valor.tipo === 'TEXTO' ? valor.texto : null;
  if (version !== VERSION_CONTRATO_MAESTRO) {
    hallazgos.push(
      versionNoSoportada(
        'VERSION_INCOMPATIBLE',
        `VERSION_CONTRATO no es compatible: se espera el texto ${VERSION_CONTRATO_MAESTRO}.`,
        hoja,
      ),
    );
  }
  return version;
}

/**
 * Verifica la hoja Empleados y sus columnas. `hoja` es null si no hay una única hoja Empleados;
 * `lectura` es null si la hoja no puede leerse (columnas faltantes o encabezado duplicado).
 */
function leerEncabezados(
  candidatas: readonly Sheet[],
  hallazgos: Hallazgo[],
): {
  readonly hoja: Hoja | null;
  readonly lectura: { datos: readonly Row[]; columnas: ReadonlyMap<string, number> } | null;
} {
  const [empleados, ...otras] = candidatas;
  if (empleados === undefined || otras.length > 0) {
    hallazgos.push(
      crearHallazgo('ESTRUCTURA_INVALIDA', 'BLOQUEANTE', 'GLOBAL', [{ archivo: 'MAESTRO' }], {
        motivo: empleados === undefined ? 'HOJA_NO_ENCONTRADA' : 'VARIAS_HOJAS_CANDIDATAS',
        detalle:
          empleados === undefined
            ? 'Falta la hoja Empleados del maestro.'
            : 'Hay más de una hoja Empleados: no se elige ninguna.',
      }),
    );
    return { hoja: null, lectura: null };
  }
  const hoja = crearHoja('MAESTRO', empleados.name);
  const datos = empleados.rows.filter((fila) => fila.rowNumber > 1);
  const encabezados = analizarEncabezados(empleados, COLUMNAS_MAESTRO);
  const legible = revisarEncabezados(hoja, datos, encabezados, hallazgos);
  const faltantes = encabezados.faltantes.filter((columna) => columna !== COLUMNA_OPCIONAL);
  for (const columna of faltantes) {
    hallazgos.push(
      crearHallazgo('ESTRUCTURA_INVALIDA', 'BLOQUEANTE', 'GLOBAL', [hoja.ref(1)], {
        campo: columna,
        motivo: 'COLUMNA_FALTANTE',
        detalle: 'Falta una columna requerida del maestro.',
      }),
    );
  }
  return {
    hoja,
    lectura: legible && faltantes.length === 0 ? { datos, columnas: encabezados.columnas } : null,
  };
}

class LectorRegistro {
  private readonly hoja: Hoja;
  private readonly fila: Row;
  private readonly columnas: ReadonlyMap<string, number>;
  private readonly hallazgos: Hallazgo[];

  constructor(hoja: Hoja, fila: Row, columnas: ReadonlyMap<string, number>, hallazgos: Hallazgo[]) {
    this.hoja = hoja;
    this.fila = fila;
    this.columnas = columnas;
    this.hallazgos = hallazgos;
  }

  /** Una columna ausente (solo puede faltar la opcional) se lee como celda vacía. */
  valor(columna: ColumnaMaestro): ValorLeido {
    const numero = this.columnas.get(columna);
    return numero === undefined
      ? { tipo: 'TEXTO', texto: '' }
      : leerValor(celdaEn(this.fila, numero));
  }

  agregar(
    codigo: Hallazgo['codigo'],
    nivel: NivelIncidencia,
    columna: ColumnaMaestro,
    extra: { motivo?: string; valores?: Hallazgo['valores'] } = {},
  ): void {
    this.hallazgos.push(
      crearHallazgo(
        codigo,
        nivel,
        'REGISTRO',
        [this.hoja.ref(this.fila.rowNumber, this.columnas.get(columna))],
        { campo: columna, ...extra },
      ),
    );
  }

  /**
   * Texto de CUIL, LEGAJO o APELLIDO_NOMBRE_REF. Una celda que no es de texto genera un
   * hallazgo de registro con el nivel indicado y devuelve null.
   */
  texto(columna: 'CUIL' | 'LEGAJO' | 'APELLIDO_NOMBRE_REF', nivel: NivelIncidencia): string | null {
    const valor = this.valor(columna);
    switch (valor.tipo) {
      case 'TEXTO':
        return valor.texto;
      case 'NUMERO':
        this.agregar('CELDA_NUMERICA_EN_TEXTO', nivel, columna, {
          valores: { maestro: valor.texto },
        });
        return null;
      case 'FORMULA':
        this.agregar('FORMULA_EN_CELDA', nivel, columna);
        return null;
      case 'OTRO':
        this.agregar('TIPO_CELDA_INVALIDO', nivel, columna);
        return null;
    }
  }

  leer(): MasterRecord {
    const valorCuil = this.valor('CUIL');
    const cuilLegible = this.texto('CUIL', 'BLOQUEANTE');
    let cuil: MasterRecord['cuil'] = null;
    if (cuilLegible !== null) {
      const resultado = parseCuil(cuilLegible);
      if (resultado.ok) {
        cuil = resultado.value;
      } else {
        this.agregar('CUIL_INVALIDO', 'BLOQUEANTE', 'CUIL', {
          motivo: resultado.error,
          valores: { maestro: cuilLegible },
        });
      }
    }
    const legajo = this.texto('LEGAJO', 'BLOQUEANTE');
    if (legajo === '') {
      this.agregar('CAMPO_REQUERIDO_FALTANTE', 'BLOQUEANTE', 'LEGAJO');
    }
    const bancarios: Partial<Record<CampoBancario, ValorLeido>> = {};
    for (const columna of COLUMNAS_MAESTRO.slice(3) as readonly CampoBancario[]) {
      bancarios[columna] = this.valor(columna);
    }
    const { cbu, patagonia } = validarCamposBancarios(bancarios);
    return {
      ref: this.hoja.ref(this.fila.rowNumber),
      // Texto original; si la celda era numérica, el número leído (para mostrarlo).
      cuilTexto: valorCuil.tipo === 'TEXTO' || valorCuil.tipo === 'NUMERO' ? valorCuil.texto : '',
      cuil,
      legajo: legajo === '' ? null : legajo,
      // Nunca se usa: un tipo de celda inválido solo se informa.
      apellidoNombreRef: this.texto('APELLIDO_NOMBRE_REF', 'INFORMACION') ?? '',
      cbu,
      patagonia,
    };
  }
}

/** Duplicados (regla 3): se marcan todos los registros involucrados; nunca se elige uno. */
function marcarDuplicados(
  registros: readonly MasterRecord[],
  clave: (registro: MasterRecord) => string | null,
  codigo: 'CUIL_REPETIDO_MAESTRO' | 'LEGAJO_REPETIDO_MAESTRO',
  campo: 'CUIL' | 'LEGAJO',
  hallazgos: Hallazgo[],
): void {
  const grupos = new Map<string, MasterRecord[]>();
  for (const registro of registros) {
    const valor = clave(registro);
    if (valor !== null) {
      grupos.set(valor, [...(grupos.get(valor) ?? []), registro]);
    }
  }
  for (const [valor, grupo] of grupos) {
    if (grupo.length < 2) {
      continue;
    }
    for (const registro of grupo) {
      hallazgos.push(
        crearHallazgo(
          codigo,
          'BLOQUEANTE',
          'REGISTRO',
          [registro.ref, ...grupo.filter((otro) => otro !== registro).map((otro) => otro.ref)],
          {
            campo,
            valores: { maestro: campo === 'CUIL' ? registro.cuilTexto : valor },
          },
        ),
      );
    }
  }
}

/** Lee el maestro. Nunca lo modifica. Un maestro sin filas (plantilla vacía) es válido. */
export function parseMaestro(libro: Workbook): LecturaMaestro {
  const hallazgos: Hallazgo[] = [];
  const versionContrato = leerVersion(libro, hallazgos);
  const { hoja, lectura } = leerEncabezados(hojasLlamadas(libro, HOJA_EMPLEADOS), hallazgos);
  if (hoja === null || lectura === null) {
    // La hoja se informa si es única, aunque no pueda leerse.
    return { hoja: hoja?.nombre ?? null, versionContrato, registros: [], hallazgos };
  }
  const vacias = filasVaciasIntermedias(lectura.datos);
  if (vacias > 0) {
    hallazgos.push(
      crearHallazgo('FILAS_VACIAS_IGNORADAS', 'INFORMACION', 'GLOBAL', [hoja.ref()], {
        detalle: `${String(vacias)} fila(s) totalmente vacía(s) ignorada(s).`,
      }),
    );
  }
  const registros = lectura.datos.map((fila) =>
    new LectorRegistro(hoja, fila, lectura.columnas, hallazgos).leer(),
  );
  marcarDuplicados(
    registros,
    (registro) => registro.cuil,
    'CUIL_REPETIDO_MAESTRO',
    'CUIL',
    hallazgos,
  );
  marcarDuplicados(
    registros,
    (registro) => registro.legajo,
    'LEGAJO_REPETIDO_MAESTRO',
    'LEGAJO',
    hallazgos,
  );
  return { hoja: hoja.nombre, versionContrato, registros, hallazgos };
}
