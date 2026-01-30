import { renderMarkdown } from "../../../features/markdown/markdownRender";
import { insertBlock, prefixLine, wrapSelection } from "../../../features/markdown/toolbarActions";
import { qs } from "../../../ui/dom";

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

  textarea.value = options.initialValue ?? defaultContent;

  const updatePreview = () => {
    preview.innerHTML = renderMarkdown(textarea.value);
  };

  const applyAction = (action: () => void) => {
    action();
    updatePreview();
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

  buttons.bold.addEventListener("click", () => applyAction(() => wrapSelection(textarea, "**", "**")));
  buttons.italic.addEventListener("click", () => applyAction(() => wrapSelection(textarea, "*", "*")));
  buttons.strike.addEventListener("click", () => applyAction(() => wrapSelection(textarea, "~~", "~~")));
  buttons.h1.addEventListener("click", () => applyAction(() => prefixLine(textarea, "# ")));
  buttons.h2.addEventListener("click", () => applyAction(() => prefixLine(textarea, "## ")));
  buttons.bullet.addEventListener("click", () => applyAction(() => prefixLine(textarea, "- ")));
  buttons.task.addEventListener("click", () => applyAction(() => prefixLine(textarea, "- [ ] ")));
  buttons.quote.addEventListener("click", () => applyAction(() => prefixLine(textarea, "> ")));
  buttons.code.addEventListener("click", () =>
    applyAction(() => wrapSelection(textarea, "```\n", "\n```") )
  );
  buttons.link.addEventListener("click", () => {
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const value = textarea.value;
    const selected = value.slice(start, end) || "link text";
    const url = window.prompt("Enter URL", "https://");
    if (!url) {
      return;
    }
    const linkText = `[${selected}](${url})`;
    applyAction(() => insertBlock(textarea, linkText));
  });

  textarea.addEventListener("input", () => {
    updatePreview();
    options.onInput?.(textarea.value);
  });
  updatePreview();

  return {
    setValue: (value: string) => {
      textarea.value = value;
      updatePreview();
    },
    focus: () => {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    },
    getValue: () => textarea.value
  };
};
