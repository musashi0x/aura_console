/**
 * Combines class names. Filters out falsy values so you can write
 * `cn("base", isActive && "active")` and `isActive` can be `undefined`.
 */
export function cn(
  ...classes: (string | false | null | undefined)[]
): string {
  return classes.filter(Boolean).join(" ");
}