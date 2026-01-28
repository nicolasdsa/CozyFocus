export type PlatformId = "spotify" | "youtube";

export interface PlatformAdapter {
  id: PlatformId | string;
  match: (input: string) => boolean;
  normalize: (input: string) => string;
  buildEmbedUrl: (input: string) => string;
  getDisplayName: () => string;
}
