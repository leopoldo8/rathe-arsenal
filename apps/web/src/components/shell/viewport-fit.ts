const FIT_VIEWPORT_PREFIXES = ['/chat'];

export function fitsViewport(pathname: string): boolean {
  return FIT_VIEWPORT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
