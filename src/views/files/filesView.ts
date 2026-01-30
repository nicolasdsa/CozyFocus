import type { DocRecord, TagRecord } from "../../storage";
import { qs } from "../../ui/dom";
import { createDocsService, type DocsService } from "../../features/docs/docsService";
import { mountMarkdownEditor } from "./editor/editorView";

interface FilesViewOptions {
  dbName?: string;
  dayKey?: string;
  debounceMs?: number;
  service?: DocsService;
}

interface FilesState {
  docs: DocRecord[];
  tags: TagRecord[];
  selectedId: string | null;
  search: string;
  tagPickerOpen: boolean;
  isCreatingTag: boolean;
  tagDraft: string;
  isCreatingDoc: boolean;
  pendingTitle: string;
  pendingMarkdown: string;
}

const formatTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

const formatDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

const getSnippet = (markdown: string): string => {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim());
  const firstLine = lines.find((line) => line.length > 0) ?? "";
  if (firstLine) {
    return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
  }
  const fallback = markdown.replace(/\s+/g, " ").trim();
  if (!fallback) {
    return "Start writing...";
  }
  return fallback.length > 80 ? `${fallback.slice(0, 80)}…` : fallback;
};

const sanitizeFilename = (value: string): string => {
  const trimmed = value.trim() || "note";
  const normalized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "note";
};

const sortDocs = (docs: DocRecord[]): DocRecord[] => {
  return [...docs].sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) {
      return b.updatedAt - a.updatedAt;
    }
    return b.id.localeCompare(a.id);
  });
};

export const mountFilesView = (root: HTMLElement, options: FilesViewOptions = {}): void => {
  root.innerHTML = `
    <section class="files-view" data-testid="files-view">
      <aside class="files-aside">
        <div class="files-aside-header">
          <div>
            <p class="files-overline">Archive</p>
            <h2 class="files-title">Today</h2>
          </div>
          <button class="files-icon-btn" type="button" aria-label="Filter notes">
            Filter
          </button>
        </div>
        <label class="files-search" aria-label="Search today's notes">
          <span class="files-search-label">Search</span>
          <input
            class="files-search-input"
            type="search"
            placeholder="Search today's notes..."
            data-testid="files-search"
          />
        </label>
        <div class="files-list" data-testid="files-list"></div>
        <div class="files-aside-footer">
          <button class="files-primary-btn" type="button" data-testid="doc-new">New Note</button>
        </div>
      </aside>
      <main class="files-main" data-testid="files-editor">
        <div class="files-main-header">
          <div class="files-title-block">
            <p class="files-overline">Archive / Today</p>
            <input
              class="files-doc-title-input"
              type="text"
              placeholder="Untitled note"
              data-testid="doc-title"
            />
            <div class="files-title-actions">
              <button class="files-icon-btn" type="button" data-testid="doc-tags">Tags</button>
              <div class="files-tag-picker" data-testid="doc-tags-picker" hidden></div>
            </div>
          </div>
          <div class="files-actions">
            <button class="files-icon-btn" type="button" data-testid="doc-download">Download</button>
            <button class="files-icon-btn is-danger" type="button" data-testid="doc-delete">Delete</button>
          </div>
        </div>
        <div class="files-meta" data-testid="doc-meta"></div>
        <div class="files-editor-shell" data-testid="files-editor-shell"></div>
      </main>
    </section>
  `;

  const editorRoot = qs<HTMLElement>(root, "files-editor-shell");
  const listRoot = qs<HTMLElement>(root, "files-list");
  const searchInput = qs<HTMLInputElement>(root, "files-search");
  const titleInput = qs<HTMLInputElement>(root, "doc-title");
  const tagsButton = qs<HTMLButtonElement>(root, "doc-tags");
  const tagsPicker = qs<HTMLDivElement>(root, "doc-tags-picker");
  const newButton = qs<HTMLButtonElement>(root, "doc-new");
  const downloadButton = qs<HTMLButtonElement>(root, "doc-download");
  const meta = qs<HTMLDivElement>(root, "doc-meta");

  const service = options.service ?? createDocsService({
    dbName: options.dbName,
    dayKey: options.dayKey,
    debounceMs: options.debounceMs
  });

  let state: FilesState = {
    docs: [],
    tags: [],
    selectedId: service.getSelectedId(),
    search: "",
    tagPickerOpen: false,
    isCreatingTag: false,
    tagDraft: "",
    isCreatingDoc: false,
    pendingTitle: "",
    pendingMarkdown: ""
  };

  const editor = mountMarkdownEditor(editorRoot, {
    initialValue: "",
    onInput: (value) => {
      void handleMarkdownInput(value);
    }
  });

  const renderMeta = () => {
    const selected = state.docs.find((doc) => doc.id === state.selectedId);
    if (!selected) {
      meta.innerHTML = "";
      return;
    }
    const tags = selected.tags
      .map((tag) => `<span class="files-pill">${tag}</span>`)
      .join("");
    meta.innerHTML = `
      <span>${formatDate(selected.createdAt)}</span>
      <span>${formatTime(selected.updatedAt)}</span>
      ${tags}
    `;
  };

  const setTagsPickerVisibility = (open: boolean) => {
    tagsPicker.hidden = !open;
    tagsPicker.style.display = open ? "flex" : "none";
  };

  const renderTagsPicker = () => {
    if (!state.tagPickerOpen) {
      setTagsPickerVisibility(false);
      return;
    }
    const selected = state.docs.find((doc) => doc.id === state.selectedId);
    const selectedTags = new Set(selected?.tags ?? []);
    const usedTags = new Set<string>();
    state.docs.forEach((doc) => {
      doc.tags.forEach((tag) => usedTags.add(tag));
    });
    const chips = state.tags
      .map((tag) => {
        const isActive = selectedTags.has(tag.name);
        const canDelete = !usedTags.has(tag.name);
        return `
          <div class="files-tag-chip-wrap">
            <button
              type="button"
              class="files-tag-chip ${isActive ? "is-active" : ""}"
              data-tag-name="${tag.name}"
            >${tag.name}</button>
            ${
              canDelete
                ? `<button class="files-tag-chip-delete" type="button" data-tag-delete="${tag.name}" aria-label="Remove tag">×</button>`
                : ""
            }
          </div>
        `;
      })
      .join("");
    const tagInput = `
      <input
        class="files-tag-chip files-tag-input"
        type="text"
        placeholder="+ New tag"
        data-testid="doc-tags-input"
      />
    `;
    tagsPicker.innerHTML = `
      <div class="files-tag-picker-header">
        <span>Tags</span>
        <button class="files-tag-picker-close" type="button" aria-label="Close tags" data-testid="doc-tags-close">×</button>
      </div>
      <div class="files-tag-picker-list">
        ${chips}
        ${tagInput}
      </div>
    `;
    setTagsPickerVisibility(true);
    const input = tagsPicker.querySelector<HTMLInputElement>("[data-testid=\"doc-tags-input\"]");
    if (input) {
      input.value = state.tagDraft;
    }
    if (input && state.isCreatingTag) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  };

  const closeTagsPicker = () => {
    state = {
      ...state,
      tagPickerOpen: false,
      isCreatingTag: false,
      tagDraft: ""
    };
    setTagsPickerVisibility(false);
  };

  const renderList = () => {
    const term = state.search.trim().toLowerCase();
    const docs = term
      ? state.docs.filter((doc) => {
          const text = `${doc.title} ${doc.markdown} ${doc.tags.join(" ")}`.toLowerCase();
          return text.includes(term);
        })
      : state.docs;

    listRoot.innerHTML = "";
    docs.forEach((doc) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "files-list-item";
      button.dataset.docId = doc.id;
      button.setAttribute("data-testid", `doc-item-${doc.id}`);
      if (doc.id === state.selectedId) {
        button.classList.add("is-active");
      }
      const tags = doc.tags
        .map((tag) => `<span class="files-tag">${tag}</span>`)
        .join("");
      button.innerHTML = `
        <div class="files-list-row">
          <span class="files-list-title">${doc.title || "Untitled note"}</span>
          <span class="files-list-time">${formatTime(doc.updatedAt)}</span>
        </div>
        <p class="files-list-snippet">${getSnippet(doc.markdown)}</p>
        <div class="files-tag-row">${tags}</div>
      `;
      listRoot.appendChild(button);
    });
  };

  const updateSelection = (docId: string | null) => {
    state = {
      ...state,
      selectedId: docId
    };
    service.setSelectedId(docId);
    const selected = state.docs.find((doc) => doc.id === docId);
    titleInput.value = selected?.title ?? "";
    editor.setValue(selected?.markdown ?? "");
    renderList();
    renderMeta();
    renderTagsPicker();
  };

  const refresh = async () => {
    const [docs, tags] = await Promise.all([service.getDocs(), service.getTags()]);
    state = {
      ...state,
      docs: sortDocs(docs),
      tags
    };
    if (!state.selectedId && docs.length > 0) {
      updateSelection(docs[0]?.id ?? null);
    } else {
      renderList();
      renderMeta();
      renderTagsPicker();
    }
  };

  const createDoc = async (title: string, markdown: string) => {
    const doc = await service.createDoc(title, markdown);
    state = {
      ...state,
      docs: sortDocs([doc, ...state.docs])
    };
    updateSelection(doc.id);
    editor.focus();
  };

  const ensureDocExists = async (seed: { title?: string; markdown?: string }) => {
    if (state.selectedId || state.isCreatingDoc) {
      return;
    }
    state = { ...state, isCreatingDoc: true };
    const title = seed.title?.trim() || "Untitled note";
    const markdown = seed.markdown ?? editor.getValue();
    const doc = await service.createDoc(title, markdown);
    state = {
      ...state,
      isCreatingDoc: false,
      docs: sortDocs([doc, ...state.docs])
    };
    updateSelection(doc.id);
    const pendingTitle = state.pendingTitle;
    const pendingMarkdown = state.pendingMarkdown;
    if (pendingTitle) {
      state = { ...state, pendingTitle: "" };
      updateTitle(pendingTitle);
    }
    if (pendingMarkdown) {
      state = { ...state, pendingMarkdown: "" };
      await handleMarkdownInput(pendingMarkdown);
    }
  };

  const handleMarkdownInput = async (value: string) => {
    if (!state.selectedId) {
      state = { ...state, pendingMarkdown: value };
      await ensureDocExists({ markdown: value, title: titleInput.value });
    }
    const selected = state.docs.find((doc) => doc.id === state.selectedId);
    if (!selected) {
      return;
    }
    const updatedAt = Date.now();
    state = {
      ...state,
      docs: sortDocs(
        state.docs.map((doc) =>
          doc.id === selected.id ? { ...doc, markdown: value, updatedAt } : doc
        )
      )
    };
    service.scheduleAutosave(selected.id, { markdown: value });
    renderList();
    renderMeta();
  };

  const handleTitleInput = async (value: string) => {
    if (!state.selectedId) {
      state = { ...state, pendingTitle: value };
      await ensureDocExists({ title: value, markdown: editor.getValue() });
    }
    updateTitle(value);
  };

  const updateTitle = (value: string) => {
    const selected = state.docs.find((doc) => doc.id === state.selectedId);
    if (!selected) {
      return;
    }
    const updatedAt = Date.now();
    state = {
      ...state,
      docs: sortDocs(
        state.docs.map((doc) =>
          doc.id === selected.id ? { ...doc, title: value, updatedAt } : doc
        )
      )
    };
    service.scheduleAutosave(selected.id, { title: value });
    renderList();
    renderMeta();
  };

  const toggleTag = async (tagName: string) => {
    const selected = state.docs.find((doc) => doc.id === state.selectedId);
    if (!selected) {
      return;
    }
    const updated = await service.toggleTag(selected.id, tagName);
    if (!updated) {
      return;
    }
    state = {
      ...state,
      docs: sortDocs(state.docs.map((doc) => (doc.id === updated.id ? updated : doc)))
    };
    renderList();
    renderMeta();
    renderTagsPicker();
  };

  const addTag = async (rawValue?: string) => {
    const value = (rawValue ?? state.tagDraft).trim();
    if (!value) {
      state = { ...state, isCreatingTag: false, tagDraft: "" };
      renderTagsPicker();
      return;
    }
    const tag = await service.addTag(value);
    state = {
      ...state,
      tags: state.tags.some((item) => item.name === tag.name)
        ? state.tags
        : [...state.tags, tag],
      isCreatingTag: false,
      tagDraft: ""
    };
    renderTagsPicker();
  };

  const deleteTag = async (tagName: string) => {
    const isUsed = state.docs.some((doc) => doc.tags.includes(tagName));
    if (isUsed) {
      return;
    }
    await service.deleteTag(tagName);
    state = {
      ...state,
      tags: state.tags.filter((tag) => tag.name !== tagName)
    };
    renderTagsPicker();
  };

  const deleteDoc = async () => {
    const selected = state.docs.find((doc) => doc.id === state.selectedId);
    if (!selected) {
      return;
    }
    const remaining = state.docs.filter((doc) => doc.id !== selected.id);
    state = {
      ...state,
      docs: remaining,
      selectedId: remaining[0]?.id ?? null
    };
    renderList();
    updateSelection(state.selectedId);
    await service.deleteDoc(selected.id);
  };

  const downloadDoc = () => {
    const selected = state.docs.find((doc) => doc.id === state.selectedId);
    if (!selected) {
      return;
    }
    const blob = new Blob([selected.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sanitizeFilename(selected.title)}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  searchInput.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    state = {
      ...state,
      search: target.value
    };
    renderList();
  });

  titleInput.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    void handleTitleInput(target.value);
  });

  listRoot.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const button = target.closest<HTMLElement>("[data-doc-id]");
    if (button?.dataset.docId) {
      updateSelection(button.dataset.docId);
    }
  });

  newButton.addEventListener("click", () => {
    void createDoc("Untitled note", "");
  });

  tagsButton.addEventListener("click", () => {
    const nextOpen = !state.tagPickerOpen;
    state = {
      ...state,
      tagPickerOpen: nextOpen,
      isCreatingTag: nextOpen
    };
    renderTagsPicker();
  });

  tagsPicker.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.closest('[data-testid="doc-tags-close"]')) {
      event.preventDefault();
      closeTagsPicker();
    }
  });

  tagsPicker.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const deleteButton = target.closest<HTMLElement>("[data-tag-delete]");
    if (deleteButton?.dataset.tagDelete) {
      void deleteTag(deleteButton.dataset.tagDelete);
      return;
    }
    const tagButton = target.closest<HTMLElement>("[data-tag-name]");
    if (tagButton?.dataset.tagName) {
      void toggleTag(tagButton.dataset.tagName);
    }
  });

  tagsPicker.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      state = { ...state, isCreatingTag: true, tagDraft: target.value };
      void addTag(target.value);
    }
  });

  tagsPicker.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    state = { ...state, tagDraft: target.value, isCreatingTag: true };
  });

  tagsPicker.addEventListener("blur", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    state = { ...state, tagDraft: target.value, isCreatingTag: true };
    void addTag(target.value);
  }, true);

  const handleDocumentPointer = (event: PointerEvent) => {
    if (!state.tagPickerOpen) {
      return;
    }
    const path = event.composedPath();
    const isInside = path.includes(tagsPicker) || path.includes(tagsButton);
    if (!isInside) {
      closeTagsPicker();
    }
  };

  const handleDocumentKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && state.tagPickerOpen) {
      closeTagsPicker();
    }
  };

  document.addEventListener("pointerdown", handleDocumentPointer, true);
  document.addEventListener("keydown", handleDocumentKey, true);

  downloadButton.addEventListener("click", downloadDoc);
  const deleteButton = qs<HTMLButtonElement>(root, "doc-delete");
  deleteButton.addEventListener("click", () => {
    void deleteDoc();
  });

  void refresh();
  updateSelection(state.selectedId);
  renderMeta();
  renderTagsPicker();
};
