import EasyMDE from "easymde";
import "easymde/dist/easymde.min.css";
import { qs } from "../../../ui/dom";

type EasyMdeWithMarkdown = EasyMDE & {
  markdown: (value: string) => string;
};

const defaultContent = `# Morning Warmup\n\nStretch to reset. Capture the next small wins. Stay soft on the plan and hard on the focus.\n\n- Warm tea + 10-minute settle\n- Two high-leverage tasks, one nice-to-have\n- Break before meeting at 10:30\n\n> "Stay gentle with the plan; stay fierce with the practice."\n`;

interface MarkdownEditorOptions {
  initialValue?: string;
  onInput?: (value: string) => void;
}

export interface MarkdownEditorHandle {
  setValue: (value: string) => void;
  focus: () => void;
  getValue: () => string;
}

export const mountMarkdownEditor = (
  root: HTMLElement,
  options: MarkdownEditorOptions = {}
): MarkdownEditorHandle => {
  root.innerHTML = `
    <div class="files-toolbar files-markdown-toolbar" data-testid="md-toolbar">
      <button class="files-icon-btn" type="button" data-testid="md-bold" aria-label="Bold">Bold</button>
      <button class="files-icon-btn" type="button" data-testid="md-italic" aria-label="Italic">Italic</button>
      <button class="files-icon-btn" type="button" data-testid="md-strike" aria-label="Strikethrough">Strike</button>
      <span class="files-toolbar-divider"></span>
      <button class="files-icon-btn" type="button" data-testid="md-h1" aria-label="Heading 1">H1</button>
      <button class="files-icon-btn" type="button" data-testid="md-h2" aria-label="Heading 2">H2</button>
      <span class="files-toolbar-divider"></span>
      <button class="files-icon-btn" type="button" data-testid="md-bullet" aria-label="Bullet list">List</button>
      <button class="files-icon-btn" type="button" data-testid="md-task" aria-label="Task list">Task</button>
      <button class="files-icon-btn" type="button" data-testid="md-quote" aria-label="Quote">Quote</button>
      <button class="files-icon-btn" type="button" data-testid="md-code" aria-label="Code block">Code</button>
      <button class="files-icon-btn" type="button" data-testid="md-link" aria-label="Link">Link</button>
    </div>
    <div class="files-editor files-markdown-editor">
      <div class="files-editor-pane files-editor-pane--input">
        <h3>Draft</h3>
        <textarea
          class="files-md-input"
          data-testid="md-input"
          spellcheck="false"
          aria-label="Markdown editor"
        ></textarea>
      </div>
      <div class="files-editor-pane files-editor-pane--preview is-preview">
        <h3>Preview</h3>
        <div class="markdown-body files-md-preview" data-testid="md-preview"></div>
      </div>
    </div>
  `;

  const textarea = qs<HTMLTextAreaElement>(root, "md-input");
  const preview = qs<HTMLDivElement>(root, "md-preview");
  const sanitizePreviewHtml = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const blockedTags = ["script", "style", "iframe", "object", "embed", "link", "meta"];
    blockedTags.forEach((tag) => {
      doc.querySelectorAll(tag).forEach((el) => el.remove());
    });

    doc.querySelectorAll("*").forEach((el) => {
      [...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value;
        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
        }
        if ((name === "href" || name === "src") && /^\s*javascript:/i.test(value)) {
          el.removeAttribute(attr.name);
        }
      });
    });

    doc.querySelectorAll("a[href]").forEach((anchor) => {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    });

    return doc.body.innerHTML;
  };

  const easyMde = new EasyMDE({
    element: textarea,
    toolbar: false,
    status: false,
    spellChecker: false,
    autoDownloadFontAwesome: false,
    forceSync: true
  }) as EasyMdeWithMarkdown;

  const getValue = (): string => easyMde.value();
  let syncingProgrammaticValue = false;

  const updatePreview = (value: string) => {
    preview.innerHTML = sanitizePreviewHtml(easyMde.markdown(value));
  };

  const emitChange = (value: string) => {
    updatePreview(value);
    options.onInput?.(value);
  };

  const withSelection = (apply: (selected: string) => string) => {
    const doc = easyMde.codemirror.getDoc();
    const range = doc.listSelections()[0];
    if (!range) {
      return;
    }
    const from = range.from();
    const to = range.to();
    const selected = doc.getRange(from, to);
    const next = apply(selected);
    doc.replaceRange(next, from, to);
  };

  const wrapSelection = (prefix: string, suffix: string) => {
    const doc = easyMde.codemirror.getDoc();
    const range = doc.listSelections()[0];
    if (!range) {
      return;
    }
    const from = range.from();
    const to = range.to();
    const selected = doc.getRange(from, to);
    const next = `${prefix}${selected}${suffix}`;
    doc.replaceRange(next, from, to);

    if (selected.length > 0) {
      doc.setSelection(
        { line: from.line, ch: from.ch + prefix.length },
        { line: to.line, ch: to.ch + prefix.length }
      );
      return;
    }
    doc.setCursor({ line: from.line, ch: from.ch + prefix.length });
  };

  const prefixLine = (prefix: string) => {
    const doc = easyMde.codemirror.getDoc();
    const cursor = doc.getCursor("from");
    doc.replaceRange(prefix, { line: cursor.line, ch: 0 });
    doc.setCursor({ line: cursor.line, ch: cursor.ch + prefix.length });
  };

  const buttons = {
    bold: qs<HTMLButtonElement>(root, "md-bold"),
    italic: qs<HTMLButtonElement>(root, "md-italic"),
    strike: qs<HTMLButtonElement>(root, "md-strike"),
    h1: qs<HTMLButtonElement>(root, "md-h1"),
    h2: qs<HTMLButtonElement>(root, "md-h2"),
    bullet: qs<HTMLButtonElement>(root, "md-bullet"),
    task: qs<HTMLButtonElement>(root, "md-task"),
    quote: qs<HTMLButtonElement>(root, "md-quote"),
    code: qs<HTMLButtonElement>(root, "md-code"),
    link: qs<HTMLButtonElement>(root, "md-link")
  };

  buttons.bold.addEventListener("click", () => wrapSelection("**", "**"));
  buttons.italic.addEventListener("click", () => wrapSelection("*", "*"));
  buttons.strike.addEventListener("click", () => wrapSelection("~~", "~~"));
  buttons.h1.addEventListener("click", () => prefixLine("# "));
  buttons.h2.addEventListener("click", () => prefixLine("## "));
  buttons.bullet.addEventListener("click", () => prefixLine("- "));
  buttons.task.addEventListener("click", () => prefixLine("- [ ] "));
  buttons.quote.addEventListener("click", () => prefixLine("> "));
  buttons.code.addEventListener("click", () => wrapSelection("```\n", "\n```"));
  buttons.link.addEventListener("click", () => {
    const selected = easyMde.codemirror.getSelection();
    const linkText = selected ? `[${selected}]()` : "[]()";
    withSelection(() => linkText);
  });

  easyMde.value(options.initialValue ?? defaultContent);
  textarea.value = getValue();
  easyMde.codemirror.on("change", () => {
    const value = getValue();
    textarea.value = value;
    if (syncingProgrammaticValue) {
      updatePreview(value);
      return;
    }
    emitChange(value);
  });

  textarea.addEventListener("input", () => {
    const value = textarea.value;
    if (getValue() !== value) {
      syncingProgrammaticValue = true;
      easyMde.value(value);
      syncingProgrammaticValue = false;
      return;
    }
    emitChange(value);
  });
  updatePreview(getValue());

  return {
    setValue: (value: string) => {
      syncingProgrammaticValue = true;
      easyMde.value(value);
      syncingProgrammaticValue = false;
      textarea.value = value;
      updatePreview(value);
    },
    focus: () => {
      const doc = easyMde.codemirror.getDoc();
      const lastLine = doc.lastLine();
      const lastChar = doc.getLine(lastLine)?.length ?? 0;
      doc.setCursor({ line: lastLine, ch: lastChar });
      easyMde.codemirror.focus();
    },
    getValue
  };
};
