// Constructores de specs sintéticas para los tests del motor fixed-width.
// Ids neutrales (R1, R2, A, B…), longitudes pequeñas; ningún layout BNA/Patagonia.
import type {
  EstructuraArchivo,
  FieldSpec,
  FieldType,
  RecordSpec,
} from '../../../../src/banks/fixed-width';

export function campo(
  id: string,
  start: number,
  end: number,
  tipo: FieldType = 'A',
  extra: Partial<FieldSpec> = {},
): FieldSpec {
  return {
    id,
    name: `campo ${id}`,
    start,
    end,
    declaredLength: end - start + 1,
    type: tipo,
    padding: tipo === 'N' ? { kind: 'ZERO_LEFT' } : { kind: 'SPACE_RIGHT' },
    status: 'CONFIRMADA',
    ...extra,
  };
}

/** Campo con `fixedValue` que ocupa exactamente end-start+1 bytes. */
export function fijo(
  id: string,
  start: number,
  end: number,
  valor: string,
  tipo: FieldType = 'A',
  extra: Partial<FieldSpec> = {},
): FieldSpec {
  return campo(id, start, end, tipo, { fixedValue: valor, ...extra });
}

export function registro(
  id: string,
  recordLength: number,
  campos: readonly FieldSpec[],
): RecordSpec {
  return { id, recordLength, fields: campos };
}

export function registroAuto(id: string, campos: readonly FieldSpec[]): RecordSpec {
  const maxLength = Math.max(...campos.map((c) => c.end));
  return registro(id, maxLength, campos);
}

export function nodoRegistro(recordId: string): EstructuraArchivo {
  return { kind: 'registro', recordId };
}

export function secuencia(...partes: readonly EstructuraArchivo[]): EstructuraArchivo {
  return { kind: 'secuencia', partes };
}

export function repeticion(parte: EstructuraArchivo, min = 1): EstructuraArchivo {
  return { kind: 'repeticion', parte, min };
}
