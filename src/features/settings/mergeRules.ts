type MergeAction = "add" | "update" | "skip";

export type MergeDecision<T> = {
  action: MergeAction;
  record?: T;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const toNumberOrFallback = (value: unknown, fallback: number): number => {
  return typeof value === "number" ? value : fallback;
};

const hashString = (value: string): string => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

const mergePreferDefined = <T extends Record<string, unknown>>(
  base: T,
  incoming: T
): T => {
  const merged = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
};

const ensureLegacyId = <T extends Record<string, unknown>>(
  record: T,
  fingerprint: string
): T & { id: string } => {
  if (typeof record.id === "string" && record.id.length > 0) {
    return record as T & { id: string };
  }
  // Legacy fallback: generate a stable ID from a fingerprint when no id exists.
  return { ...record, id: `legacy:${fingerprint}` } as T & { id: string };
};

const taskFingerprint = (record: Record<string, unknown>): string => {
  return hashString(
    `${record.dayKey ?? ""}|${record.title ?? ""}|${record.createdAt ?? ""}`
  );
};

const noteFingerprint = (record: Record<string, unknown>): string => {
  const content = typeof record.content === "string" ? record.content : "";
  return hashString(
    `${record.dayKey ?? ""}|${content.slice(0, 50)}|${record.createdAt ?? ""}`
  );
};

const docFingerprint = (record: Record<string, unknown>): string => {
  return hashString(
    `${record.dayKey ?? ""}|${record.title ?? ""}|${record.createdAt ?? ""}`
  );
};

export const normalizeTaskRecord = (
  record: unknown
): (Record<string, unknown> & { id: string }) | null => {
  if (!isRecord(record)) {
    return null;
  }
  return ensureLegacyId(record, taskFingerprint(record));
};

export const normalizeNoteRecord = (
  record: unknown
): (Record<string, unknown> & { id: string }) | null => {
  if (!isRecord(record)) {
    return null;
  }
  return ensureLegacyId(record, noteFingerprint(record));
};

export const normalizeDocRecord = (
  record: unknown
): (Record<string, unknown> & { id: string }) | null => {
  if (!isRecord(record)) {
    return null;
  }
  return ensureLegacyId(record, docFingerprint(record));
};

export const decideTaskMerge = (
  local: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>
): MergeDecision<Record<string, unknown>> => {
  if (!local) {
    return { action: "add", record: incoming };
  }

  const localUpdatedAt = toNumberOrFallback(local.updatedAt, Number.NEGATIVE_INFINITY);
  const incomingUpdatedAt = toNumberOrFallback(
    incoming.updatedAt,
    Number.NEGATIVE_INFINITY
  );

  if (incomingUpdatedAt > localUpdatedAt) {
    return {
      action: "update",
      record: mergePreferDefined(local, incoming)
    };
  }

  return { action: "skip" };
};

export const decideNoteMerge = (
  local: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>
): MergeDecision<Record<string, unknown>> => {
  if (!local) {
    return { action: "add", record: incoming };
  }

  const localUpdatedAt = toNumberOrFallback(local.updatedAt, Number.NEGATIVE_INFINITY);
  const incomingUpdatedAt = toNumberOrFallback(
    incoming.updatedAt,
    Number.NEGATIVE_INFINITY
  );

  if (incomingUpdatedAt > localUpdatedAt) {
    return { action: "update", record: incoming };
  }

  return { action: "skip" };
};

export const decideDocMerge = (
  local: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>
): MergeDecision<Record<string, unknown>> => {
  if (!local) {
    return { action: "add", record: incoming };
  }

  const localUpdatedAt = toNumberOrFallback(local.updatedAt, Number.NEGATIVE_INFINITY);
  const incomingUpdatedAt = toNumberOrFallback(
    incoming.updatedAt,
    Number.NEGATIVE_INFINITY
  );

  if (incomingUpdatedAt > localUpdatedAt) {
    const merged = mergePreferDefined(local, incoming);
    const localTags = Array.isArray(local.tags) ? local.tags : [];
    const incomingTags = Array.isArray(incoming.tags) ? incoming.tags : [];
    merged.tags = Array.from(new Set([...localTags, ...incomingTags]));
    return { action: "update", record: merged };
  }

  return { action: "skip" };
};

export const decideSessionMerge = (
  local: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>
): MergeDecision<Record<string, unknown>> => {
  if (!local) {
    return { action: "add", record: incoming };
  }

  const localCompleted = local.completed === true;
  const incomingCompleted = incoming.completed === true;
  if (!localCompleted && incomingCompleted) {
    return { action: "update", record: incoming };
  }

  return { action: "skip" };
};

export const decideStatsMerge = (
  local: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>
): MergeDecision<Record<string, unknown>> => {
  if (!local) {
    return { action: "add", record: incoming };
  }

  const merged = { ...local };
  const fields = [
    "focusCompletedCount",
    "shortBreakCompletedCount",
    "longBreakCompletedCount",
    "totalFocusMs",
    "totalBreakMs"
  ];

  for (const field of fields) {
    merged[field] = Math.max(
      toNumberOrFallback(local[field], 0),
      toNumberOrFallback(incoming[field], 0)
    );
  }

  const changed = fields.some((field) => merged[field] !== local[field]);
  if (changed) {
    return { action: "update", record: merged };
  }

  return { action: "skip" };
};

export const resolveSettingKey = (record: unknown): string | null => {
  if (!isRecord(record)) {
    return null;
  }

  if (typeof record.key === "string" && record.key.length > 0) {
    return record.key;
  }

  if (
    typeof record.focus === "number" &&
    typeof record.shortBreak === "number" &&
    typeof record.longBreak === "number"
  ) {
    return "pomodoroDefaults";
  }

  if (
    typeof record.rawInput === "string" &&
    typeof record.embedUrl === "string" &&
    typeof record.platformId === "string"
  ) {
    return "mediaPlayer";
  }

  if (typeof record.dayKey === "string" && "taskId" in record) {
    return `tasks.currentFocus.${record.dayKey}`;
  }

  return null;
};

export const decideSettingMerge = (
  local: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>
): MergeDecision<Record<string, unknown>> => {
  if (!local) {
    return { action: "add", record: incoming };
  }

  const localUpdatedAt = toNumberOrFallback(local.updatedAt, Number.NEGATIVE_INFINITY);
  const incomingUpdatedAt = toNumberOrFallback(
    incoming.updatedAt,
    Number.NEGATIVE_INFINITY
  );

  if (incomingUpdatedAt > localUpdatedAt) {
    return { action: "update", record: incoming };
  }

  return { action: "skip" };
};

export const decideTagMerge = (
  localTagNames: Set<string>,
  incoming: Record<string, unknown>
): MergeDecision<Record<string, unknown>> => {
  const name = typeof incoming.name === "string" ? incoming.name.trim() : "";
  if (!name) {
    return { action: "skip" };
  }

  const normalized = name.toLowerCase();
  if (localTagNames.has(normalized)) {
    return { action: "skip" };
  }

  return {
    action: "add",
    record: { ...incoming, name }
  };
};
