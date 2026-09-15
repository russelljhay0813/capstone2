/**
 * Generates a unique identifier for local records.
 * Combines a timestamp and a random string.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}