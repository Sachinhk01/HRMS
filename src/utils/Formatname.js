/**
 * Capitalizes the first letter of every word in a name, leaving the rest of
 */
export function capitalizeName(name) {
  if (!name) return '';
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}