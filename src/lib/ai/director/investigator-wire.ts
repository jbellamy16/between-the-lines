/** Lossless JSON tables for the shared catalogue and whole evidence bundles.
 * Repeated object shapes and string values are interned; no facts or caveats
 * are trimmed. This is a wire encoding, never a verification input. */
export function investigationWire(input: unknown) {
  const strings: string[] = [];
  const stringIds = new Map<string, number>();
  const shapes: string[][] = [];
  const shapeIds = new Map<string, number>();
  const counts = new Map<string, number>();
  const count = (value: unknown) => {
    if (value && typeof value === "object") {
      const key = JSON.stringify(value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      for (const item of Object.values(value)) count(item);
    }
  };
  count(input);
  const values: unknown[] = [];
  const valueIds = new Map<string, number>();
  const encode = (value: unknown, inline = false): unknown => {
    if (!inline && value && typeof value === "object") {
      const key = JSON.stringify(value);
      if (key.length > 30 && (counts.get(key) ?? 0) > 1) {
        let ref = valueIds.get(key);
        if (ref === undefined) {
          ref = values.length;
          valueIds.set(key, ref);
          values.push(null);
          values[ref] = encode(value, true);
        }
        return `v${ref}`;
      }
    }
    if (typeof value === "string") {
      let ref = stringIds.get(value);
      if (ref === undefined) {
        ref = strings.length;
        stringIds.set(value, ref);
        strings.push(value);
      }
      return `s${ref}`;
    }
    if (Array.isArray(value)) return value.map((item) => encode(item));
    if (value !== null && typeof value === "object") {
      const entries = Object.entries(value).filter(([, v]) => v !== undefined);
      const keys = entries.map(([k]) => k);
      const identity = JSON.stringify(keys);
      let ref = shapeIds.get(identity);
      if (ref === undefined) {
        ref = shapes.length;
        shapeIds.set(identity, ref);
        shapes.push(keys);
      }
      return [`r${ref}`, ...entries.map(([, v]) => encode(v))];
    }
    return value;
  };
  const data = encode(input);
  return { encoding: "catalogue-tables-1", strings, shapes, values, data };
}
