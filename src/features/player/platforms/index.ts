import { spotifyAdapter } from "./spotify";
import { youtubeAdapter } from "./youtube";
import type { PlatformAdapter } from "./types";

export const ALL_ADAPTERS: PlatformAdapter[] = [spotifyAdapter, youtubeAdapter];

export { spotifyAdapter, youtubeAdapter };
