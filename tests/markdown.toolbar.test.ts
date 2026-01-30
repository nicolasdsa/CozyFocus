import { describe, expect, it } from "vitest";
import { prefixLine, wrapSelection } from "../src/features/markdown/toolbarActions";
import { renderMarkdown } from "../src/features/markdown/markdownRender";

const createTextarea = (value: string): HTMLTextAreaElement => {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  document.body.appendChild(textarea);
  return textarea;
};

describe("markdown toolbar actions", () => {
  it("bold wraps selection with **", () => {
    const textarea = createTextarea("Hello world");
    textarea.setSelectionRange(6, 11);

    wrapSelection(textarea, "**", "**");

    expect(textarea.value).toBe("Hello **world**");
  });

  it("H1 prefixes current line with #", () => {
    const textarea = createTextarea("Title\nNext");
    textarea.setSelectionRange(1, 1);

    prefixLine(textarea, "# ");

    expect(textarea.value).toBe("# Title\nNext");
  });

  it("Task list inserts - [ ] at line start", () => {
    const textarea = createTextarea("Do the thing");
    textarea.setSelectionRange(0, 0);

    prefixLine(textarea, "- [ ] ");

    expect(textarea.value).toBe("- [ ] Do the thing");
  });
});

describe("markdown preview", () => {
  it("renders sanitized HTML", () => {
    const html = renderMarkdown("Hello <script>alert(1)</script>");

    expect(html).toContain("Hello");
    expect(html.toLowerCase()).not.toContain("<script");
  });
});
