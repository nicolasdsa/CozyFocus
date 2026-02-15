import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { mountFilesView } from "../src/views/files/filesView";
import { getLocalDayKey, openCozyDB } from "../src/storage";

const createDbName = () => `cozyfocus-docs-test-${crypto.randomUUID()}`;

const createRoot = (): HTMLElement => {
  document.body.innerHTML = "<div id=\"files-root\"></div>";
  const root = document.querySelector<HTMLElement>("#files-root");
  if (!root) {
    throw new Error("Missing files root");
  }
  return root;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (check: () => boolean, attempts = 500, ms = 10) => {
  for (let index = 0; index < attempts; index += 1) {
    if (check()) {
      return;
    }
    await delay(ms);
  }
  throw new Error("Timed out waiting for UI update");
};

const seedDoc = async (dbName: string, doc: {
  id?: string;
  dayKey: string;
  title: string;
  markdown: string;
  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
}) => {
  const db = await openCozyDB(dbName);
  const now = Date.now();
  const record = {
    id: doc.id ?? crypto.randomUUID(),
    dayKey: doc.dayKey,
    title: doc.title,
    markdown: doc.markdown,
    tags: doc.tags ?? [],
    createdAt: doc.createdAt ?? now,
    updatedAt: doc.updatedAt ?? now
  };
  await db.put("docs", record);
  db.close();
  return record;
};

const formatTime = (timestamp: number, hour12: boolean): string =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12
  });

const saveTimeFormat = async (dbName: string, mode: "auto" | "12h" | "24h") => {
  const db = await openCozyDB(dbName);
  await db.put(
    "settings",
    {
      mode,
      updatedAt: Date.now()
    },
    "timeFormatPreference"
  );
  db.close();
};

describe("docs offline workflow", () => {
  it("changes day using date switcher arrows", async () => {
    const dbName = createDbName();
    const day = new Date(2026, 1, 14);
    const previousDay = new Date(2026, 1, 13);

    await seedDoc(dbName, {
      dayKey: getLocalDayKey(day),
      title: "Today Note",
      markdown: "Current day"
    });
    await seedDoc(dbName, {
      dayKey: getLocalDayKey(previousDay),
      title: "Previous Note",
      markdown: "Previous day"
    });

    const root = createRoot();
    mountFilesView(root, { dbName, dayKey: getLocalDayKey(day), debounceMs: 10 });
    await waitFor(() => root.querySelectorAll('[data-testid^="doc-item-"]').length === 1);

    const items = root.querySelectorAll('[data-testid^="doc-item-"]');
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain("Today Note");

    const prevButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="files-date-prev"]'
    );
    prevButton?.click();
    await waitFor(() => {
      const first = root.querySelector<HTMLElement>('[data-testid^="doc-item-"]');
      return first?.textContent?.includes("Previous Note") === true;
    });

    const prevItems = root.querySelectorAll('[data-testid^="doc-item-"]');
    expect(prevItems).toHaveLength(1);
    expect(prevItems[0]?.textContent).toContain("Previous Note");

  });

  it("only renders docs for today", async () => {
    const dbName = createDbName();
    const today = getLocalDayKey();
    const yesterday = getLocalDayKey(new Date(Date.now() - 86400000));

    await seedDoc(dbName, {
      dayKey: today,
      title: "Today Note",
      markdown: "Current plan"
    });
    await seedDoc(dbName, {
      dayKey: yesterday,
      title: "Yesterday Note",
      markdown: "Old plan"
    });

    const root = createRoot();
    mountFilesView(root, { dbName, dayKey: today, debounceMs: 10 });
    await waitFor(() => root.querySelectorAll('[data-testid^="doc-item-"]').length === 1);

    const items = root.querySelectorAll('[data-testid^="doc-item-"]');
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain("Today Note");

  });

  it("creates a new doc and focuses the editor", async () => {
    const dbName = createDbName();
    const root = createRoot();

    mountFilesView(root, { dbName, debounceMs: 10 });
    await waitFor(() => Boolean(root.querySelector("[data-testid=\"doc-new\"]")));

    const newButton = root.querySelector<HTMLButtonElement>("[data-testid=\"doc-new\"]");
    if (!newButton) {
      throw new Error("Missing new note button");
    }
    newButton.click();
    await waitFor(() => root.querySelectorAll('[data-testid^="doc-item-"]').length === 1);

    const items = root.querySelectorAll('[data-testid^="doc-item-"]');
    expect(items).toHaveLength(1);
    expect(items[0]?.classList.contains("is-active")).toBe(true);

    const titleInput = root.querySelector<HTMLInputElement>("[data-testid=\"doc-title\"]");
    expect(titleInput?.value).toBe("Untitled note");

    const editor = root.querySelector<HTMLTextAreaElement>("[data-testid=\"md-input\"]");
    expect(document.activeElement).toBe(editor);

  });

  it("renders note times using the persisted 12h format", async () => {
    const dbName = createDbName();
    const baseDate = new Date(2026, 1, 14, 13, 5, 0, 0);
    const dayKey = getLocalDayKey(baseDate);
    const updatedAt = baseDate.getTime();
    const createdAt = updatedAt - 60_000;

    await saveTimeFormat(dbName, "12h");
    await seedDoc(dbName, {
      dayKey,
      title: "Time format note",
      markdown: "Time format body",
      createdAt,
      updatedAt
    });

    const root = createRoot();
    mountFilesView(root, { dbName, dayKey, debounceMs: 10 });
    await waitFor(() => {
      const listTime = root.querySelector<HTMLElement>(".files-list-time");
      const meta = root.querySelector<HTMLElement>("[data-testid=\"doc-meta\"]");
      return Boolean(listTime?.textContent?.trim()) && Boolean(meta?.textContent?.trim());
    });

    const expectedTime = formatTime(updatedAt, true);
    const listTime = root.querySelector<HTMLElement>(".files-list-time");
    const meta = root.querySelector<HTMLElement>("[data-testid=\"doc-meta\"]");

    expect(listTime?.textContent).toBe(expectedTime);
    expect(meta?.textContent).toContain(expectedTime);
  });

  it("autosaves markdown edits and restores on reload", async () => {
    const dbName = createDbName();
    const dayKey = getLocalDayKey();

    await seedDoc(dbName, {
      dayKey,
      title: "Draft",
      markdown: "Start"
    });

    let root = createRoot();
    mountFilesView(root, { dbName, dayKey, debounceMs: 10 });
    await waitFor(() => {
      const editorReady = root.querySelector<HTMLTextAreaElement>("[data-testid=\"md-input\"]");
      const selected = root.querySelector<HTMLElement>('[data-testid^="doc-item-"]');
      return Boolean(editorReady) && Boolean(selected?.classList.contains("is-active"));
    });

    const editor = root.querySelector<HTMLTextAreaElement>("[data-testid=\"md-input\"]");
    if (!editor) {
      throw new Error("Missing markdown editor");
    }
    editor.value = "Persisted content";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    await delay(40);

    root = createRoot();
    mountFilesView(root, { dbName, dayKey, debounceMs: 10 });
    await waitFor(() => {
      const editorReloaded = root.querySelector<HTMLTextAreaElement>("[data-testid=\"md-input\"]");
      return editorReloaded?.value === "Persisted content";
    });

    const editorReloaded = root.querySelector<HTMLTextAreaElement>("[data-testid=\"md-input\"]");
    expect(editorReloaded?.value).toBe("Persisted content");

  });

  it("attaches and detaches tags via the picker", async () => {
    const dbName = createDbName();
    const dayKey = getLocalDayKey();
    await seedDoc(dbName, {
      dayKey,
      title: "Tagged Note",
      markdown: "Tags"
    });

    const root = createRoot();
    mountFilesView(root, { dbName, dayKey, debounceMs: 10 });
    await waitFor(() => {
      const tagsReady = Boolean(root.querySelector("[data-testid=\"doc-tags\"]"));
      const selectedDoc = Boolean(root.querySelector<HTMLElement>(".files-list-item.is-active"));
      return tagsReady && selectedDoc;
    });

    const tagsButton = root.querySelector<HTMLButtonElement>("[data-testid=\"doc-tags\"]");
    tagsButton?.click();
    await waitFor(() => Boolean(root.querySelector("[data-testid=\"doc-tags-input\"]")));

    const tagInput = root.querySelector<HTMLInputElement>("[data-testid=\"doc-tags-input\"]");
    if (!tagInput) {
      throw new Error("Missing tag input");
    }
    tagInput.value = "Focus";
    tagInput.dispatchEvent(new Event("input", { bubbles: true }));
    tagInput.dispatchEvent(new Event("blur", { bubbles: true }));
    await waitFor(() => Boolean(root.querySelector("[data-tag-name=\"Focus\"]")));

    const tagChip = root.querySelector<HTMLButtonElement>("[data-tag-name=\"Focus\"]");
    if (!tagChip) {
      throw new Error("Missing tag chip");
    }
    const docItem = root.querySelector<HTMLElement>('[data-testid^="doc-item-"]');
    if (!docItem) {
      throw new Error("Missing doc item");
    }
    const docId = docItem.dataset.docId;
    if (!docId) {
      throw new Error("Missing doc id");
    }
    expect(docItem.textContent).not.toContain("Focus");
    tagChip.click();
    await waitFor(() => {
      const refreshedItem = root.querySelector<HTMLElement>(`[data-testid="doc-item-${docId}"]`);
      return refreshedItem?.textContent?.includes("Focus") === true;
    });

    const refreshedChip = root.querySelector<HTMLButtonElement>("[data-tag-name=\"Focus\"]");
    refreshedChip?.click();
    await delay(20);
    const db = await openCozyDB(dbName);
    const updated = await db.get("docs", docId);
    db.close();

    expect(updated?.tags).toEqual([]);

  }, 10000);

  it("downloads markdown with a .md filename", async () => {
    const dbName = createDbName();
    const dayKey = getLocalDayKey();
    const markdown = "Hello **world**";
    await seedDoc(dbName, {
      dayKey,
      title: "Download Note",
      markdown
    });

    const root = createRoot();
    mountFilesView(root, { dbName, dayKey, debounceMs: 10 });
    await waitFor(() => {
      const hasButton = Boolean(root.querySelector("[data-testid=\"doc-download\"]"));
      const hasActiveDoc = Boolean(root.querySelector<HTMLElement>(".files-list-item.is-active"));
      return hasButton && hasActiveDoc;
    });

    if (!("createObjectURL" in URL)) {
      Object.defineProperty(URL, "createObjectURL", {
        writable: true,
        configurable: true,
        value: () => "blob:pre-mock"
      });
    }
    if (!("revokeObjectURL" in URL)) {
      Object.defineProperty(URL, "revokeObjectURL", {
        writable: true,
        configurable: true,
        value: () => undefined
      });
    }

    let createdBlob: Blob | null = null;
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      createdBlob = blob as Blob;
      return "blob:mock";
    });
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const originalCreate = document.createElement.bind(document);
    let anchor: HTMLAnchorElement | null = null;
    const createSpy = vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const el = originalCreate(tagName);
      if (tagName.toLowerCase() === "a") {
        anchor = el as HTMLAnchorElement;
      }
      return el;
    });

    const downloadButton = root.querySelector<HTMLButtonElement>(
      "[data-testid=\"doc-download\"]"
    );
    downloadButton?.click();
    await delay(10);

    expect(clickSpy).toHaveBeenCalled();
    expect(anchor?.download.endsWith(".md")).toBe(true);
    const blobArg = createObjectURL.mock.calls[0]?.[0] as Blob | undefined;
    if (!createdBlob || !blobArg) {
      throw new Error("Missing markdown blob");
    }
    expect(blobArg.type).toBe("text/markdown");
    expect(blobArg.size).toBeGreaterThan(0);

    createSpy.mockRestore();
    clickSpy.mockRestore();
    createObjectURL.mockRestore();
    revokeSpy.mockRestore();
  });
});
