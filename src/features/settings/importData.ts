import { openCozyDB, type CozyFocusDatabase } from "../../storage";
import type { ExportBundle } from "./exportData";
import {
  decideDocMerge,
  decideNoteMerge,
  decideSessionMerge,
  decideSettingMerge,
  decideStatsMerge,
  decideTagMerge,
  decideTaskMerge,
  normalizeDocRecord,
  normalizeNoteRecord,
  normalizeTaskRecord,
  resolveSettingKey
} from "./mergeRules";
import {
  bulkPutTasks,
  getTaskById,
  bulkPutNotes,
  getNoteById,
  bulkPutDocs,
  getDocById,
  bulkPutSessions,
  getSessionById,
  bulkPutStats,
  getStatsById,
  bulkPutSettings,
  getSettingById,
  bulkPutTags,
  getAllTags
} from "../../storage";

export type MergePlan = {
  tasks: { add: number; update: number; skip: number };
  notes: { add: number; update: number; skip: number };
  sessions: { add: number; update: number; skip: number };
  stats: { add: number; update: number; skip: number };
  docs: { add: number; update: number; skip: number };
  settings: { add: number; update: number; skip: number };
  tags?: { add: number; update: number; skip: number };
};

type MergeChanges = {
  tasks: { add: Record<string, unknown>[]; update: Record<string, unknown>[] };
  notes: { add: Record<string, unknown>[]; update: Record<string, unknown>[] };
  sessions: { add: Record<string, unknown>[]; update: Record<string, unknown>[] };
  stats: { add: Record<string, unknown>[]; update: Record<string, unknown>[] };
  docs: { add: Record<string, unknown>[]; update: Record<string, unknown>[] };
  settings: { add: Array<{ key: string; value: Record<string, unknown> }>; update: Array<{ key: string; value: Record<string, unknown> }> };
  tags: { add: Record<string, unknown>[]; update: Record<string, unknown>[] };
};

type ImportOptions = {
  dbName?: string;
};

const createEmptyPlan = (): MergePlan => ({
  tasks: { add: 0, update: 0, skip: 0 },
  notes: { add: 0, update: 0, skip: 0 },
  sessions: { add: 0, update: 0, skip: 0 },
  stats: { add: 0, update: 0, skip: 0 },
  docs: { add: 0, update: 0, skip: 0 },
  settings: { add: 0, update: 0, skip: 0 }
});

const createEmptyChanges = (): MergeChanges => ({
  tasks: { add: [], update: [] },
  notes: { add: [], update: [] },
  sessions: { add: [], update: [] },
  stats: { add: [], update: [] },
  docs: { add: [], update: [] },
  settings: { add: [], update: [] },
  tags: { add: [], update: [] }
});

export const parseBundle = (text: string): ExportBundle => {
  const parsed = JSON.parse(text) as ExportBundle;
  if (!parsed || parsed.app !== "CozyFocus") {
    throw new Error("Import failed: invalid CozyFocus bundle.");
  }

  if (!parsed.data || typeof parsed.data !== "object") {
    throw new Error("Import failed: bundle data is missing.");
  }

  return parsed;
};

const computeMergePlan = async (
  db: CozyFocusDatabase,
  bundle: ExportBundle
): Promise<{ plan: MergePlan; changes: MergeChanges }> => {
  const plan = createEmptyPlan();
  const changes = createEmptyChanges();

  for (const task of bundle.data.tasks ?? []) {
    const normalized = normalizeTaskRecord(task);
    if (!normalized) {
      plan.tasks.skip += 1;
      continue;
    }
    const local = await getTaskById(db, normalized.id);
    const decision = decideTaskMerge(local ?? undefined, normalized);
    if (decision.action === "add" && decision.record) {
      plan.tasks.add += 1;
      changes.tasks.add.push(decision.record);
    } else if (decision.action === "update" && decision.record) {
      plan.tasks.update += 1;
      changes.tasks.update.push(decision.record);
    } else {
      plan.tasks.skip += 1;
    }
  }

  for (const note of bundle.data.notes ?? []) {
    const normalized = normalizeNoteRecord(note);
    if (!normalized) {
      plan.notes.skip += 1;
      continue;
    }
    const local = await getNoteById(db, normalized.id);
    const decision = decideNoteMerge(local ?? undefined, normalized);
    if (decision.action === "add" && decision.record) {
      plan.notes.add += 1;
      changes.notes.add.push(decision.record);
    } else if (decision.action === "update" && decision.record) {
      plan.notes.update += 1;
      changes.notes.update.push(decision.record);
    } else {
      plan.notes.skip += 1;
    }
  }

  for (const doc of bundle.data.docs ?? []) {
    const normalized = normalizeDocRecord(doc);
    if (!normalized) {
      plan.docs.skip += 1;
      continue;
    }
    const local = await getDocById(db, normalized.id);
    const decision = decideDocMerge(local ?? undefined, normalized);
    if (decision.action === "add" && decision.record) {
      plan.docs.add += 1;
      changes.docs.add.push(decision.record);
    } else if (decision.action === "update" && decision.record) {
      plan.docs.update += 1;
      changes.docs.update.push(decision.record);
    } else {
      plan.docs.skip += 1;
    }
  }

  for (const session of bundle.data.sessions ?? []) {
    if (!session || typeof session.id !== "string") {
      plan.sessions.skip += 1;
      continue;
    }
    const local = await getSessionById(db, session.id);
    const decision = decideSessionMerge(local ?? undefined, session as Record<string, unknown>);
    if (decision.action === "add" && decision.record) {
      plan.sessions.add += 1;
      changes.sessions.add.push(decision.record);
    } else if (decision.action === "update" && decision.record) {
      plan.sessions.update += 1;
      changes.sessions.update.push(decision.record);
    } else {
      plan.sessions.skip += 1;
    }
  }

  for (const stats of bundle.data.stats ?? []) {
    if (!stats || typeof stats.dayKey !== "string") {
      plan.stats.skip += 1;
      continue;
    }
    const local = await getStatsById(db, stats.dayKey);
    const decision = decideStatsMerge(local ?? undefined, stats as Record<string, unknown>);
    if (decision.action === "add" && decision.record) {
      plan.stats.add += 1;
      changes.stats.add.push(decision.record);
    } else if (decision.action === "update" && decision.record) {
      plan.stats.update += 1;
      changes.stats.update.push(decision.record);
    } else {
      plan.stats.skip += 1;
    }
  }

  for (const setting of bundle.data.settings ?? []) {
    const key = resolveSettingKey(setting);
    if (!key || !setting || typeof setting !== "object") {
      plan.settings.skip += 1;
      continue;
    }
    const local = await getSettingById(db, key);
    const decision = decideSettingMerge(
      local ?? undefined,
      setting as Record<string, unknown>
    );
    if (decision.action === "add" && decision.record) {
      plan.settings.add += 1;
      changes.settings.add.push({ key, value: decision.record });
    } else if (decision.action === "update" && decision.record) {
      plan.settings.update += 1;
      changes.settings.update.push({ key, value: decision.record });
    } else {
      plan.settings.skip += 1;
    }
  }

  if (bundle.data.tags) {
    if (!plan.tags) {
      plan.tags = { add: 0, update: 0, skip: 0 };
    }
    const existingTags = await getAllTags(db);
    const localNames = new Set(existingTags.map((tag) => tag.name.toLowerCase()));
    for (const tag of bundle.data.tags ?? []) {
      const decision = decideTagMerge(localNames, tag as Record<string, unknown>);
      if (decision.action === "add" && decision.record) {
        plan.tags!.add += 1;
        changes.tags.add.push(decision.record);
        const name = typeof decision.record.name === "string" ? decision.record.name : "";
        if (name) {
          localNames.add(name.toLowerCase());
        }
      } else if (decision.action === "update" && decision.record) {
        plan.tags!.update += 1;
        changes.tags.update.push(decision.record);
      } else {
        plan.tags!.skip += 1;
      }
    }
  }

  return { plan, changes };
};

export const buildMergePlan = async (
  bundle: ExportBundle,
  options: ImportOptions = {}
): Promise<MergePlan> => {
  const db = await openCozyDB(options.dbName);
  try {
    const { plan } = await computeMergePlan(db, bundle);
    return plan;
  } finally {
    db.close();
  }
};

export const applyMergePlan = async (
  bundle: ExportBundle,
  options: ImportOptions = {}
): Promise<{ plan: MergePlan }> => {
  const db = await openCozyDB(options.dbName);
  try {
    const { plan, changes } = await computeMergePlan(db, bundle);
    await bulkPutTasks(db, [...changes.tasks.add, ...changes.tasks.update]);
    await bulkPutNotes(db, [...changes.notes.add, ...changes.notes.update]);
    await bulkPutDocs(db, [...changes.docs.add, ...changes.docs.update]);
    await bulkPutSessions(db, [...changes.sessions.add, ...changes.sessions.update]);
    await bulkPutStats(db, [...changes.stats.add, ...changes.stats.update]);
    await bulkPutSettings(
      db,
      [...changes.settings.add, ...changes.settings.update] as Array<{
        key: string;
        value: CozyFocusDatabase["settings"]["value"];
      }>
    );
    await bulkPutTags(db, [...changes.tags.add, ...changes.tags.update]);
    return { plan };
  } finally {
    db.close();
  }
};
