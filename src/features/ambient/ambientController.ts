import type { AmbientStore } from "./ambientStore";
import { AMBIENT_TRACKS, type AmbientTrack, type AmbientTrackId } from "./ambientTypes";

export interface AmbientController {
  play: (trackId: AmbientTrackId) => Promise<void>;
  pause: (trackId: AmbientTrackId) => void;
  toggle: (trackId: AmbientTrackId) => Promise<void>;
  togglePlay: (trackId: AmbientTrackId) => Promise<void>;
  setVolume: (trackId: AmbientTrackId, volume0to1: number) => void;
  setMasterVolume: (volume0to1: number) => void;
}

interface AmbientControllerOptions {
  store: AmbientStore;
  createAudio?: (src: string) => HTMLAudioElement;
}

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
};

export const createAmbientController = (
  options: AmbientControllerOptions
): AmbientController => {
  const { store } = options;
  const createAudio = options.createAudio ?? ((src) => new Audio(src));
  const trackById = new Map<AmbientTrackId, AmbientTrack>(
    AMBIENT_TRACKS.map((track) => [track.id, track])
  );

  // lazy initialization + on-demand audio loading + deferred loading
  // Each HTMLAudioElement is reused through an audio instance cache (in-memory map).
  const audioInstanceCache = new Map<AmbientTrackId, HTMLAudioElement>();

  const applyEffectiveVolume = (trackId: AmbientTrackId, audio?: HTMLAudioElement) => {
    const target = audio ?? audioInstanceCache.get(trackId);
    if (!target) {
      return;
    }
    const state = store.getState();
    const effectiveVolume = clamp01(state.trackVolumes[trackId] * state.masterVolume);
    target.volume = effectiveVolume;
  };

  const getAudio = (trackId: AmbientTrackId): HTMLAudioElement => {
    const cached = audioInstanceCache.get(trackId);
    if (cached) {
      return cached;
    }

    const track = trackById.get(trackId);
    if (!track) {
      throw new Error(`Unknown ambient track: ${trackId}`);
    }

    const audio = createAudio(track.src);
    audio.preload = "none";
    audio.loop = true;
    applyEffectiveVolume(trackId, audio);
    audioInstanceCache.set(trackId, audio);
    return audio;
  };

  const play = async (trackId: AmbientTrackId): Promise<void> => {
    const audio = getAudio(trackId);
    applyEffectiveVolume(trackId, audio);
    try {
      await audio.play();
      store.setTrackPlaying(trackId, true);
    } catch {
      store.setTrackPlaying(trackId, false);
    }
  };

  const pause = (trackId: AmbientTrackId): void => {
    const audio = audioInstanceCache.get(trackId);
    if (audio) {
      audio.pause();
    }
    store.setTrackPlaying(trackId, false);
  };

  const togglePlay = async (trackId: AmbientTrackId): Promise<void> => {
    const isPlaying = store.getState().playing[trackId];
    if (isPlaying) {
      pause(trackId);
      return;
    }
    await play(trackId);
  };

  return {
    play,
    pause,
    togglePlay,
    toggle: (trackId) => togglePlay(trackId),
    setVolume: (trackId, volume0to1) => {
      store.setTrackVolume(trackId, clamp01(volume0to1));
      applyEffectiveVolume(trackId);
    },
    setMasterVolume: (volume0to1) => {
      store.setMasterVolume(clamp01(volume0to1));
      AMBIENT_TRACKS.forEach((track) => {
        applyEffectiveVolume(track.id);
      });
    }
  };
};
