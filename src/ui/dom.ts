export const qs = <T extends Element>(
  root: ParentNode,
  testId: string
): T => {
  const el = root.querySelector<T>(`[data-testid="${testId}"]`);
  if (!el) {
    throw new Error(`Missing element with data-testid="${testId}"`);
  }
  return el;
};

export const create = <T extends HTMLElement>(tag: string, className?: string): T => {
  const el = document.createElement(tag) as T;
  if (className) {
    el.className = className;
  }
  return el;
};
