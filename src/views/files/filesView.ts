import type { DocRecord, TagRecord } from "../../storage";
import { getLocalDayKey } from "../../storage/dayKey";
import { qs } from "../../ui/dom";
import { createDocsService, type DocsService } from "../../features/docs/docsService";
import { mountMarkdownEditor } from "./editor/editorView";

interface FilesViewOptions {
  dbName?: string;
  dayKey?: string;
  debounceMs?: number;
  service?: DocsService;
}

type DateMode = "day" | "week" | "month" | "range";

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
  dateMode: DateMode;
  anchorDate: Date;
  rangeFrom: string;
  rangeTo: string;
  datePopoverOpen: boolean;
}

const TITLE_MAX_CHARS = 54;
const SNIPPET_MAX_CHARS = 80;

const DAY_MS = 24 * 60 * 60 * 1000;

const truncateWithDots = (value: string, maxChars: number): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars).trimEnd()}...` : trimmed;
};

const formatTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

const formatDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

const parseDayKey = (value: string): Date | null => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
};

const toDayKey = (date: Date): string => getLocalDayKey(date);

const addDays = (date: Date, amount: number): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
};

const startOfWeek = (date: Date): Date => {
  const weekday = (date.getDay() + 6) % 7;
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -weekday);
};

const endOfWeek = (date: Date): Date => addDays(startOfWeek(date), 6);

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

const endOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const isSameWeek = (left: Date, right: Date): boolean =>
  isSameDay(startOfWeek(left), startOfWeek(right));

const formatDayLabel = (date: Date): string =>
  date.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });

const formatMonthLabel = (date: Date): string =>
  date.toLocaleDateString([], { month: "short", year: "numeric" });

const formatRangeLabel = (start: Date, end: Date): string => {
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start
      .toLocaleDateString([], { day: "2-digit" })}-${end.toLocaleDateString([], {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })}`;
  }
  return `${start.toLocaleDateString([], {
    day: "2-digit",
    month: "short"
  })}-${end.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}`;
};

const getDateWindow = (state: Pick<FilesState, "dateMode" | "anchorDate" | "rangeFrom" | "rangeTo">) => {
  const today = new Date();

  if (state.dateMode === "day") {
    const start = new Date(state.anchorDate.getFullYear(), state.anchorDate.getMonth(), state.anchorDate.getDate());
    return {
      start,
      end: start,
      label: isSameDay(start, today) ? "Today" : formatDayLabel(start),
      chipLabel: isSameDay(start, today) ? "Today" : formatDayLabel(start)
    };
  }

  if (state.dateMode === "week") {
    const start = startOfWeek(state.anchorDate);
    const end = endOfWeek(state.anchorDate);
    return {
      start,
      end,
      label: isSameWeek(state.anchorDate, today) ? "This week" : formatRangeLabel(start, end),
      chipLabel: isSameWeek(state.anchorDate, today) ? "This week" : formatRangeLabel(start, end)
    };
  }

  if (state.dateMode === "month") {
    const start = startOfMonth(state.anchorDate);
    const end = endOfMonth(state.anchorDate);
    return {
      start,
      end,
      label: formatMonthLabel(state.anchorDate),
      chipLabel: formatMonthLabel(state.anchorDate)
    };
  }

  const parsedFrom = parseDayKey(state.rangeFrom);
  const parsedTo = parseDayKey(state.rangeTo);
  const fallback = new Date(state.anchorDate.getFullYear(), state.anchorDate.getMonth(), state.anchorDate.getDate());
  const from = parsedFrom ?? fallback;
  const to = parsedTo ?? from;
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;

  return {
    start,
    end,
    label: formatRangeLabel(start, end),
    chipLabel: formatRangeLabel(start, end)
  };
};

const getSnippet = (markdown: string): string => {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim());
  const firstLine = lines.find((line) => line.length > 0) ?? "";
  if (firstLine) {
    return truncateWithDots(firstLine, SNIPPET_MAX_CHARS);
  }
  const fallback = markdown.replace(/\s+/g, " ").trim();
  if (!fallback) {
    return "Start writing...";
  }
  return truncateWithDots(fallback, SNIPPET_MAX_CHARS);
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
          <p class="files-overline">Archive</p>
          <div class="files-date-switcher" data-testid="files-date-switcher">
            <button class="files-icon-btn" type="button" data-testid="files-date-prev" aria-label="Previous period">◀</button>
            <button class="files-date-trigger" type="button" data-testid="files-date-trigger" aria-haspopup="dialog" aria-expanded="false">
              <span data-testid="files-date-label">Today</span>
              <span aria-hidden="true">▼</span>
            </button>
            <button class="files-icon-btn" type="button" data-testid="files-date-next" aria-label="Next period">▶</button>
          </div>
          <div class="files-mode-segment" role="tablist" aria-label="Date mode">
            <button type="button" class="files-mode-btn is-active" data-testid="files-mode-day" data-mode="day">Day</button>
            <button type="button" class="files-mode-btn" data-testid="files-mode-week" data-mode="week">Week</button>
            <button type="button" class="files-mode-btn" data-testid="files-mode-month" data-mode="month">Month</button>
            <button type="button" class="files-mode-btn" data-testid="files-mode-range" data-mode="range">Range</button>
          </div>
          <div class="files-date-popover" data-testid="files-date-popover" hidden></div>
        </div>
        <label class="files-search" aria-label="Search notes">
          <span class="files-search-label">Search</span>
          <input
            class="files-search-input"
            type="search"
            placeholder="Search notes..."
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
            <p class="files-overline" data-testid="files-main-context">Archive / Today</p>
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
  const mainContext = qs<HTMLElement>(root, "files-main-context");
  const dateLabel = qs<HTMLElement>(root, "files-date-label");
  const dateTrigger = qs<HTMLButtonElement>(root, "files-date-trigger");
  const datePopover = qs<HTMLDivElement>(root, "files-date-popover");
  const datePrev = qs<HTMLButtonElement>(root, "files-date-prev");
  const dateNext = qs<HTMLButtonElement>(root, "files-date-next");
  const modeButtons = root.querySelectorAll<HTMLButtonElement>("[data-mode]");

  const service = options.service ?? createDocsService({
    dbName: options.dbName,
    dayKey: options.dayKey,
    debounceMs: options.debounceMs
  });

  const initialAnchor = parseDayKey(options.dayKey ?? "") ?? new Date();

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
    pendingMarkdown: "",
    dateMode: "day",
    anchorDate: new Date(initialAnchor.getFullYear(), initialAnchor.getMonth(), initialAnchor.getDate()),
    rangeFrom: toDayKey(initialAnchor),
    rangeTo: toDayKey(initialAnchor),
    datePopoverOpen: false
  };

  const editor = mountMarkdownEditor(editorRoot, {
    initialValue: "",
    onInput: (value) => {
      void handleMarkdownInput(value);
    }
  });

  const setDatePopoverVisibility = (open: boolean) => {
    state = { ...state, datePopoverOpen: open };
    datePopover.hidden = !open;
    datePopover.style.display = open ? "flex" : "none";
    dateTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const renderDateControls = () => {
    const windowInfo = getDateWindow(state);
    dateLabel.textContent = windowInfo.label;
    mainContext.textContent = `Archive / ${windowInfo.label}`;

    modeButtons.forEach((button) => {
      const active = button.dataset.mode === state.dateMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  };

  const renderDatePopover = () => {
    if (!state.datePopoverOpen) {
      setDatePopoverVisibility(false);
      return;
    }

    const windowInfo = getDateWindow(state);
    const dayValue = toDayKey(state.anchorDate);

    if (state.dateMode === "range") {
      datePopover.innerHTML = `
        <p class="files-date-popover-title">Select range</p>
        <label class="files-date-input-wrap">
          <span>From</span>
          <input type="date" data-testid="files-range-from" value="${state.rangeFrom}" />
        </label>
        <label class="files-date-input-wrap">
          <span>To</span>
          <input type="date" data-testid="files-range-to" value="${state.rangeTo}" />
        </label>
      `;
    } else {
      datePopover.innerHTML = `
        <p class="files-date-popover-title">Select date</p>
        <label class="files-date-input-wrap">
          <span>Date</span>
          <input type="date" data-testid="files-day-input" value="${dayValue}" />
        </label>
        <p class="files-date-popover-hint">Range: ${windowInfo.chipLabel}</p>
      `;
    }

    setDatePopoverVisibility(true);
  };

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

  const closeDatePopover = () => {
    setDatePopoverVisibility(false);
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
          <span class="files-list-title">${truncateWithDots(doc.title || "Untitled note", TITLE_MAX_CHARS)}</span>
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
    const windowInfo = getDateWindow(state);
    const [docs, tags] = await Promise.all([
      service.getDocsByDayRange(toDayKey(windowInfo.start), toDayKey(windowInfo.end)),
      service.getTags()
    ]);
    const sorted = sortDocs(docs);
    const hasSelected = sorted.some((doc) => doc.id === state.selectedId);
    state = {
      ...state,
      docs: sorted,
      tags,
      selectedId: hasSelected ? state.selectedId : sorted[0]?.id ?? null
    };
    service.setSelectedId(state.selectedId);
    const selected = state.docs.find((doc) => doc.id === state.selectedId);
    titleInput.value = selected?.title ?? "";
    editor.setValue(selected?.markdown ?? "");
    renderDateControls();
    renderDatePopover();
    renderList();
    renderMeta();
    renderTagsPicker();
  };

  const createDoc = async (title: string, markdown: string) => {
    const windowInfo = getDateWindow(state);
    const dayKey = toDayKey(windowInfo.end);
    const doc = await service.createDoc(title, markdown, dayKey);
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
    const windowInfo = getDateWindow(state);
    const doc = await service.createDoc(title, markdown, toDayKey(windowInfo.end));
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

  const shiftCurrentRange = (direction: -1 | 1) => {
    if (state.dateMode === "day") {
      state = { ...state, anchorDate: addDays(state.anchorDate, direction) };
      return;
    }

    if (state.dateMode === "week") {
      state = { ...state, anchorDate: addDays(state.anchorDate, direction * 7) };
      return;
    }

    if (state.dateMode === "month") {
      const next = new Date(
        state.anchorDate.getFullYear(),
        state.anchorDate.getMonth() + direction,
        1
      );
      state = { ...state, anchorDate: next };
      return;
    }

    const from = parseDayKey(state.rangeFrom);
    const to = parseDayKey(state.rangeTo);
    if (!from || !to) {
      return;
    }
    const start = from <= to ? from : to;
    const end = from <= to ? to : from;
    const span = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
    const nextStart = addDays(start, direction * span);
    const nextEnd = addDays(end, direction * span);
    state = {
      ...state,
      rangeFrom: toDayKey(nextStart),
      rangeTo: toDayKey(nextEnd),
      anchorDate: nextEnd
    };
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

  datePrev.addEventListener("click", () => {
    shiftCurrentRange(-1);
    void refresh();
  });

  dateNext.addEventListener("click", () => {
    shiftCurrentRange(1);
    void refresh();
  });

  dateTrigger.addEventListener("click", () => {
    const next = !state.datePopoverOpen;
    setDatePopoverVisibility(next);
    if (next) {
      renderDatePopover();
    }
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode as DateMode | undefined;
      if (!mode || mode === state.dateMode) {
        return;
      }
      const updates: Partial<FilesState> = {
        dateMode: mode,
        datePopoverOpen: mode === "range"
      };
      if (mode === "range") {
        const anchorKey = toDayKey(state.anchorDate);
        updates.rangeFrom = state.rangeFrom || anchorKey;
        updates.rangeTo = state.rangeTo || anchorKey;
      }
      state = { ...state, ...updates };
      void refresh();
    });
  });

  datePopover.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (target.dataset.testid === "files-day-input") {
      const parsed = parseDayKey(target.value);
      if (!parsed) {
        return;
      }
      state = {
        ...state,
        anchorDate: parsed,
        rangeFrom: target.value,
        rangeTo: target.value
      };
      void refresh();
      return;
    }

    if (target.dataset.testid === "files-range-from") {
      state = { ...state, rangeFrom: target.value };
      void refresh();
      return;
    }

    if (target.dataset.testid === "files-range-to") {
      state = { ...state, rangeTo: target.value };
      void refresh();
    }
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

  tagsPicker.addEventListener(
    "blur",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      state = { ...state, tagDraft: target.value, isCreatingTag: true };
      void addTag(target.value);
    },
    true
  );

  const handleDocumentPointer = (event: PointerEvent) => {
    const path = event.composedPath();

    if (state.tagPickerOpen) {
      const isInsideTag = path.includes(tagsPicker) || path.includes(tagsButton);
      if (!isInsideTag) {
        closeTagsPicker();
      }
    }

    if (state.datePopoverOpen) {
      const isInsideDate = path.includes(datePopover) || path.includes(dateTrigger);
      if (!isInsideDate) {
        closeDatePopover();
      }
    }
  };

  const handleDocumentKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      if (state.tagPickerOpen) {
        closeTagsPicker();
      }
      if (state.datePopoverOpen) {
        closeDatePopover();
      }
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
  renderDateControls();
  renderDatePopover();
  renderMeta();
  renderTagsPicker();
};
