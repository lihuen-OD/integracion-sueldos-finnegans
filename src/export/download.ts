// Descarga local de bytes generados en memoria. No hay red ni persistencia:
// el navegador guarda el archivo donde el usuario elija.

export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function downloadBytes(bytes: Uint8Array, fileName: string, mimeType: string): void {
  // Copia respaldada por ArrayBuffer propio (requisito de Blob).
  const blob = new Blob([bytes.slice()], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Se libera la URL temporal una vez iniciada la descarga.
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
