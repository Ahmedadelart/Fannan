// Editing one text field of a block from the canvas: "heading", "items.2.title"…

/** A copy of `obj` with the value at `path` replaced (arrays and objects copied along the way). */
export function setPath<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const key: string | number = /^\d+$/.test(head) ? Number(head) : head;
  const src = obj as unknown as Record<string | number, unknown>;
  const next = rest.length ? setPath(src[key], rest.join("."), value) : value;
  if (Array.isArray(obj)) {
    const copy = [...obj];
    copy[key as number] = next;
    return copy as unknown as T;
  }
  return { ...(obj as object), [key]: next } as T;
}
