import type { PlatformAdapter } from "./types";

export const resolveAdapter = (
  input: string,
  adapters: PlatformAdapter[]
): PlatformAdapter | null => {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  return adapters.find((adapter) => adapter.match(trimmed)) ?? null;
};
