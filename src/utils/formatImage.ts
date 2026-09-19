/**
 * Formats image URLs so that both external HTTP/HTTPS URLs and local Windows file paths
 * render seamlessly in Electron via the custom 'media://' protocol.
 */
export function formatImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;

  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // External URLs or already formatted protocol URLs
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('media://')
  ) {
    return trimmed;
  }

  // Windows absolute path e.g. C:\... or C:/...
  const normalized = trimmed.replace(/\\/g, '/');
  return `media://${normalized}`;
}
