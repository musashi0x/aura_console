import { createHash } from "node:crypto";

/**
 * Deterministic event ids.
 *
 * The ACP SDK exposes no per-entry identifier, so every id this module writes
 * is derived from content. That is what makes a re-delivered entry a no-op at
 * the primary key instead of a duplicate row, and it is why the derivation has
 * to be stable to the byte.
 */

/**
 * Fixed namespace. Changing it renames every id and would re-append the whole
 * history, so it is a constant, never configuration.
 */
const ACP_UUID_NAMESPACE = "6f1d0b6e-6f1a-5c2e-9a3b-0d1e2f3a4b5c";

/**
 * Sorts keys recursively so an id cannot change with key order. Only used for
 * hashing, never for storage.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);

  return `{${entries.join(",")}}`;
}

/** RFC 4122 name-based UUID, version 5. */
export function uuidV5(name: string, namespace: string = ACP_UUID_NAMESPACE): string {
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(namespaceBytes).update(Buffer.from(name, "utf8")).digest();

  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The id every derived event uses: a uuidv5 over its canonicalised content. */
export function derivedEventId(content: unknown): string {
  return uuidV5(canonicalJson(content));
}
