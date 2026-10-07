import "server-only";

// In-memory state shared by every part of one server process. Webpack builds can load a module
// once per route bundle, so plain module-level Maps would not be shared between, say, a server
// action that publishes and the page that reads the site.

const g = globalThis as unknown as { __fannan?: Record<string, unknown> };

export function sharedMap<K, V>(name: string): Map<K, V> {
  g.__fannan ??= {};
  return (g.__fannan[name] ??= new Map<K, V>()) as Map<K, V>;
}
