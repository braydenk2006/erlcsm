import { createId, init } from "@paralleldrive/cuid2";

const createShortId = init({ length: 24 });

/** Globally unique public IDs that do not expose sequential database identifiers. */
export function createPublicId(prefix?: string): string {
  const id = createShortId();
  return prefix ? `${prefix}_${id}` : id;
}

export function isPublicId(value: string, prefix?: string): boolean {
  if (prefix) {
    return value.startsWith(`${prefix}_`) && value.length > prefix.length + 10;
  }
  return createId.length > 0 && /^[a-z][a-z0-9_]*_[a-z0-9]+$/i.test(value);
}
