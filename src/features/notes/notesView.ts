import type { NoteRecord } from "../../storage";
import { getLocalDayKey } from "../../storage/dayKey";
import { create, qs } from "../../ui/dom";
import { createNotesService, type NotesService } from "./notesService";
import type { NotesViewState } from "./notesTypes";

interface NotesViewOptions {
  dayKey?: string;
  dbName?: string;
  debounceMs?: number;
  service?: NotesService;
}

export interface NotesViewHandle {
  refresh: () => Promise<void>;
  destroy: () => Promise<void>;
}

export const mountNotesView = async (
  root: HTMLElement,
  options: NotesViewOptions = {}
): Promise<NotesViewHandle> => {
  root.innerHTML = `
    <div class="card-header">
      <div class="card-title">Quick Notes</div>
      <button class="icon-btn" aria-label="Add note" data-testid="notes-add">+</button>
    </div>
    <div class="card-body notes-body">
      <div class="notes-list" data-testid="notes-container"></div>
    </div>
  `;

  const service = options.service ?? createNotesService({ dbName: options.dbName });
  const dayKey = options.dayKey ?? getLocalDayKey();
  const debounceMs = options.debounceMs ?? 300;
  const list = qs<HTMLDivElement>(root, "notes-container");
  const body = root.querySelector<HTMLElement>(".notes-body");
  if (!body) {
    throw new Error("Missing notes body");
  }

  let state: NotesViewState = {
    notes: [],
    selectedId: null,
    editingId: null
  };
  const saveTimers = new Map<string, number>();
  const pendingAdds = new Map<string, Promise<NoteRecord>>();
  const resolvedTempIds = new Map<string, string>();
  const deletedTempIds = new Set<string>();

  const focusEditor = (noteId: string) => {
    const editor = root.querySelector<HTMLTextAreaElement>(
      `[data-testid="note-editor-${noteId}"]`
    );
    if (editor) {
      editor.focus();
      editor.setSelectionRange(editor.value.length, editor.value.length);
    }
  };

  const renderNotes = () => {
    list.innerHTML = "";

    state.notes.forEach((note) => {
      const card = create<HTMLDivElement>("div", "note-card");
      card.dataset.noteId = note.id;
      card.setAttribute("data-testid", `note-${note.id}`);
      if (state.selectedId === note.id) {
        card.classList.add("is-selected");
      }
      if (state.editingId === note.id) {
        card.classList.add("is-editing");
      }

      const editor = create<HTMLTextAreaElement>(
        "textarea",
        "note-editor note-content--with-trash-gap"
      );
      editor.value = note.content;
      editor.textContent = note.content;
      editor.readOnly = state.editingId !== note.id;
      editor.setAttribute("data-testid", `note-editor-${note.id}`);
      editor.placeholder = "Jot down a thought...";
      editor.addEventListener("input", () => {
        if (state.editingId !== note.id) {
          return;
        }
        const content = editor.value;
        state = {
          ...state,
          notes: state.notes.map((item) =>
            item.id === note.id ? { ...item, content } : item
          )
        };
        const existing = saveTimers.get(note.id);
        if (existing) {
          window.clearTimeout(existing);
        }
        const timeout = window.setTimeout(async () => {
          saveTimers.delete(note.id);
          let noteId = note.id;
          if (noteId.startsWith("temp-")) {
            const pending = pendingAdds.get(noteId);
            if (pending) {
              const persisted = await pending;
              noteId = persisted.id;
            } else {
              const resolved = resolvedTempIds.get(noteId);
              if (resolved) {
                noteId = resolved;
              } else {
                return;
              }
            }
          }
          await service.updateNote(noteId, content);
        }, debounceMs);
        saveTimers.set(note.id, timeout);
      });

      card.appendChild(editor);

      const trash = create<HTMLButtonElement>("button", "trash-btn note-trash--bl");
      trash.type = "button";
      trash.dataset.noteId = note.id;
      trash.setAttribute("aria-label", "Delete note");
      trash.setAttribute("data-testid", `note-delete-${note.id}`);
      trash.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"></path>
        </svg>
      `;

      card.appendChild(trash);
      list.appendChild(card);
    });
  };

  const refresh = async () => {
    const notes = await service.getNotes(dayKey);
    state = {
      ...state,
      notes
    };
    renderNotes();
  };

  const selectNote = (noteId: string) => {
    state = {
      ...state,
      selectedId: noteId,
      editingId: state.editingId === noteId ? noteId : null
    };
    renderNotes();
  };

  const enterEditMode = (noteId: string) => {
    state = {
      ...state,
      selectedId: noteId,
      editingId: noteId
    };
    renderNotes();
    focusEditor(noteId);
  };

  const createNote = async () => {
    const now = Date.now();
    const tempNote: NoteRecord = {
      id: `temp-${crypto.randomUUID()}`,
      dayKey,
      content: "",
      updatedAt: now
    };
    state = {
      ...state,
      notes: [...state.notes, tempNote],
      selectedId: tempNote.id,
      editingId: tempNote.id
    };
    renderNotes();
    focusEditor(tempNote.id);

    const addPromise = service.addNote("", dayKey);
    pendingAdds.set(tempNote.id, addPromise);
    const persisted = await addPromise;
    pendingAdds.delete(tempNote.id);

    if (deletedTempIds.has(tempNote.id)) {
      deletedTempIds.delete(tempNote.id);
      await service.deleteNote(persisted.id);
      return;
    }

    resolvedTempIds.set(tempNote.id, persisted.id);
    state = {
      ...state,
      notes: state.notes.map((item) => (item.id === tempNote.id ? persisted : item)),
      selectedId: state.selectedId === tempNote.id ? persisted.id : state.selectedId,
      editingId: state.editingId === tempNote.id ? persisted.id : state.editingId
    };
    renderNotes();
    if (state.editingId === persisted.id) {
      focusEditor(persisted.id);
    }
  };

  const resolveNoteId = async (noteId: string): Promise<string | null> => {
    if (!noteId.startsWith("temp-")) {
      return noteId;
    }
    const pending = pendingAdds.get(noteId);
    if (pending) {
      const persisted = await pending;
      return persisted.id;
    }
    const resolved = resolvedTempIds.get(noteId);
    return resolved ?? null;
  };

  const selectMostRecent = (notes: NoteRecord[]) => {
    const latest = notes[notes.length - 1];
    if (latest) {
      state = {
        ...state,
        selectedId: latest.id,
        editingId: state.editingId === latest.id ? latest.id : null
      };
      renderNotes();
      return;
    }
    state = {
      ...state,
      selectedId: null,
      editingId: null
    };
    renderNotes();
  };

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest('[data-testid="notes-add"]')) {
      void createNote();
      return;
    }

    const deleteButton = target.closest<HTMLButtonElement>(".trash-btn");
    if (deleteButton?.dataset.noteId) {
      const noteId = deleteButton.dataset.noteId;
      const existingTimer = saveTimers.get(noteId);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
        saveTimers.delete(noteId);
      }
      state = {
        ...state,
        notes: state.notes.filter((note) => note.id !== noteId),
        selectedId: state.selectedId === noteId ? null : state.selectedId,
        editingId: state.editingId === noteId ? null : state.editingId
      };
      const remaining = state.notes;
      if (state.selectedId === null) {
        selectMostRecent(remaining);
      } else {
        renderNotes();
      }

      if (noteId.startsWith("temp-")) {
        deletedTempIds.add(noteId);
        return;
      }
      void (async () => {
        const resolved = await resolveNoteId(noteId);
        if (resolved) {
          await service.deleteNote(resolved);
        }
      })();
      return;
    }

    const card = target.closest<HTMLElement>("[data-note-id]");
    if (card?.dataset.noteId) {
      if (card.dataset.noteId !== state.selectedId) {
        selectNote(card.dataset.noteId);
      }
    }
  });

  list.addEventListener("mouseover", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const button = target.closest<HTMLButtonElement>(".trash-btn");
    if (button) {
      button.dataset.hover = "true";
    }
  });

  list.addEventListener("mouseout", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const button = target.closest<HTMLButtonElement>(".trash-btn");
    if (button) {
      delete button.dataset.hover;
    }
  });

  body.addEventListener("dblclick", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const card = target.closest<HTMLElement>("[data-note-id]");
    if (card?.dataset.noteId) {
      enterEditMode(card.dataset.noteId);
      return;
    }

    void createNote();
  });

  await refresh();

  return {
    refresh,
    destroy: async () => {
      saveTimers.forEach((timeout) => window.clearTimeout(timeout));
      root.innerHTML = "";
      await service.close();
    }
  };
};
