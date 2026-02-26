import type { AmbientTrackId } from "./ambientTypes";

export type AmbientMixerSetting = {
  masterVolume: number;
  trackVolumes: Record<AmbientTrackId, number>;
  updatedAt: number;
};
