export type VisibilityHandler = (state: DocumentVisibilityState) => void;

export const onVisibilityChange = (handler: VisibilityHandler): (() => void) => {
  const listener = () => {
    handler(document.visibilityState);
  };

  document.addEventListener("visibilitychange", listener);
  return () => {
    document.removeEventListener("visibilitychange", listener);
  };
};
