const updateSelection = (
  textarea: HTMLTextAreaElement,
  nextValue: string,
  selectionStart: number,
  selectionEnd: number
) => {
  textarea.value = nextValue;
  textarea.setSelectionRange(selectionStart, selectionEnd);
  textarea.focus();
};

export const wrapSelection = (
  textarea: HTMLTextAreaElement,
  before: string,
  after: string
): void => {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const value = textarea.value;
  const selected = value.slice(start, end);
  const nextValue = value.slice(0, start) + before + selected + after + value.slice(end);
  const nextStart = start + before.length;
  const nextEnd = nextStart + selected.length;
  updateSelection(textarea, nextValue, nextStart, nextEnd);
};

export const prefixLine = (textarea: HTMLTextAreaElement, prefix: string): void => {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const value = textarea.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const nextValue = value.slice(0, lineStart) + prefix + value.slice(lineStart);
  updateSelection(textarea, nextValue, start + prefix.length, end + prefix.length);
};

export const insertBlock = (
  textarea: HTMLTextAreaElement,
  blockText: string
): void => {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const value = textarea.value;
  const nextValue = value.slice(0, start) + blockText + value.slice(end);
  const nextCursor = start + blockText.length;
  updateSelection(textarea, nextValue, nextCursor, nextCursor);
};
