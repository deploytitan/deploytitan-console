import { nanoid } from "nanoid";
export function createPrefixedId(prefix: string): string {
  const uuid = nanoid();
  return `${prefix}_${uuid}`;
}
