/**
 * Utilitários de download.
 *
 * Ficam separados do componente por dois motivos: são testáveis sem montar
 * nenhuma tela e são reaproveitados por qualquer exportação futura.
 */

/** Extrai o nome do arquivo do cabeçalho Content-Disposition. */
export function filenameFromContentDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;

  // RFC 5987 (filename*=UTF-8''nome.xlsx) tem prioridade sobre o formato simples.
  const encoded = /filename\*=\s*UTF-8''([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // Cabeçalho malformado: seguimos para o formato simples.
    }
  }

  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  const candidate = plain?.[1]?.trim();
  return candidate ? candidate : fallback;
}

/** Dispara o download de um blob no navegador e libera a URL temporária. */
export function downloadBlob(blob: Blob, filename: string, doc: Document = document): void {
  const url = URL.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  doc.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
