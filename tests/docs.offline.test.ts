import "fake-indexeddb/auto";
import { deleteDB } from "idb";
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

const seedDoc = async (dbName: string, doc: {
  id?: string;
  dayKey: string;
  title: string;
  markdown: string;
  tags?: string[];
}) => {
  const db = await openCozyDB(dbName);
  const now = Date.now();
  const record = {
    id: doc.id ?? crypto.randomUUID(),
    dayKey: doc.dayKey,
    title: doc.title,
    markdown: doc.markdown,
    tags: doc.tags ?? [],
    createdAt: now,
    updatedAt: now
  };
  await db.put("docs", record);
  db.close();
  return record;
};

describe("docs offline workflow", () => {
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
    await delay(20);

    const items = root.querySelectorAll('[data-testid^="doc-item-"]');
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain("Today Note");

    await deleteDB(dbName);
  });

  it("creates a new doc and focuses the editor", async () => {
    const dbName = createDbName();
    const root = createRoot();

    mountFilesView(root, { dbName, debounceMs: 10 });
    await delay(20);

    const newButton = root.querySelector<HTMLButtonElement>("[data-testid=\"doc-new\"]");
    if (!newButton) {
      throw new Error("Missing new note button");
    }
    newButton.click();
    await delay(20);

    const items = root.querySelectorAll('[data-testid^="doc-item-"]');
    expect(items).toHaveLength(1);
    expect(items[0]?.classList.contains("is-active")).toBe(true);

    const titleInput = root.querySelector<HTMLInputElement>("[data-testid=\"doc-title\"]");
    expect(titleInput?.value).toBe("Untitled note");

    const editor = root.querySelector<HTMLTextAreaElement>("[data-testid=\"md-input\"]");
    expect(document.activeElement).toBe(editor);

    await deleteDB(dbName);
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
    await delay(20);

    const editor = root.querySelector<HTMLTextAreaElement>("[data-testid=\"md-input\"]");
    if (!editor) {
      throw new Error("Missing markdown editor");
    }
    editor.value = "Persisted content";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    await delay(20);

    root = createRoot();
    mountFilesView(root, { dbName, dayKey, debounceMs: 10 });
    await delay(20);

    const editorReloaded = root.querySelector<HTMLTextAreaElement>("[data-testid=\"md-input\"]");
    expect(editorReloaded?.value).toBe("Persisted content");

    await deleteDB(dbName);
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
    await delay(20);

    const tagsButton = root.querySelector<HTMLButtonElement>("[data-testid=\"doc-tags\"]");
    tagsButton?.click();
    await delay(20);

    const tagInput = root.querySelector<HTMLInputElement>("[data-testid=\"doc-tags-input\"]");
    if (!tagInput) {
      throw new Error("Missing tag input");
    }
    tagInput.value = "Focus";
    tagInput.dispatchEvent(new Event("input", { bubbles: true }));
    tagInput.dispatchEvent(new Event("blur", { bubbles: true }));
    await delay(40);

    const tagChip = root.querySelector<HTMLButtonElement>("[data-tag-name=\"Focus\"]");
    if (!tagChip) {
      throw new Error("Missing tag chip");
    }
    const docItem = root.querySelector<HTMLElement>('[data-testid^="doc-item-"]');
    if (!docItem) {
      throw new Error("Missing doc item");
    }
    expect(docItem.textContent).not.toContain("Focus");
    tagChip.click();
    await delay(20);
    expect(docItem.textContent).toContain("Focus");

    tagChip.click();
    await delay(20);

    const docId = docItem.dataset.docId;
    if (!docId) {
      throw new Error("Missing doc id");
    }
    const db = await openCozyDB(dbName);
    const updated = await db.get("docs", docId);
    db.close();

    expect(updated?.tags).toEqual([]);

    await deleteDB(dbName);
  });

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
    await delay(0);

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
    await delay(0);

    expect(clickSpy).toHaveBeenCalled();
    expect(anchor?.download.endsWith(".md")).toBe(true);
    if (!createdBlob) {
      throw new Error("Missing markdown blob");
    }
    const content = await createdBlob.text();
    expect(content).toBe(markdown);

    createSpy.mockRestore();
    clickSpy.mockRestore();
    createObjectURL.mockRestore();
    revokeSpy.mockRestore();
    await deleteDB(dbName);
  });
});
