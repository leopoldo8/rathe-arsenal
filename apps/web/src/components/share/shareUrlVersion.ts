const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a(text: string): number {
  let hash = FNV_OFFSET;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * WhatsApp keeps the preview of an address it has already shown, so a link sent again after the list changed would
 * show the old cards. The query changes with the content; the page ignores it.
 */
export function versionShareUrl(url: string, content: string): string {
  return `${url}?v=${fnv1a(content).toString(36)}`;
}
