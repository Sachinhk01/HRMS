/**
 * Safely opens a PDF in a new tab.
 *
 * Large `data:application/pdf;base64,...` URLs (the kind FileReader
 * produces for a local file preview) routinely fail to render when used
 * directly as an <a href> / window.open target — the tab opens but shows
 * a blank page once the base64 string gets long, because browsers cap how
 * much a `data:` URL can carry through navigation.
 *
 * Converting the same bytes into a Blob and using `URL.createObjectURL`
 * instead avoids that limit entirely and renders reliably. Real backend
 * URLs (http/https) are opened as-is, unchanged.
 */
export function openPdfDocument(url) {
  if (!url) return;

  if (url.startsWith('data:')) {
    try {
      const [header, base64] = url.split(',');
      const mimeMatch = header.match(/data:([^;]+)/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';

      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: mime });
      const blobUrl = URL.createObjectURL(blob);

      window.open(blobUrl, '_blank', 'noopener,noreferrer');

      // Give the new tab time to actually load the blob before revoking it.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    } catch {
      // Fall through and try opening the raw URL as a last resort.
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}