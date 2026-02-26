import { AMBIENT_TRACKS, type AmbientTrackId } from "./ambientTypes";

export interface AmbientStoreState {
  drawerOpen: boolean;
  masterVolume: number;
  trackVolumes: Record<AmbientTrackId, number>;
  playing: Record<AmbientTrackId, boolean>;
}

type AmbientListener = (state: AmbientStoreState) => void;

export interface AmbientStore {
  getState: () => AmbientStoreState;
  subscribe: (listener: AmbientListener) => () => void;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
  setTrackVolume: (trackId: AmbientTrackId, volume0to1: number) => void;
  setTrackPlaying: (trackId: AmbientTrackId, playing: boolean) => void;
  setMasterVolume: (volume0to1: number) => void;
}

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
};

const buildTrackVolumeRecord = (defaultVolume: number): Record<AmbientTrackId, number> => {
  const volume = clamp01(defaultVolume);
  return {
    campfire: volume,
    coffee_place: volume,
    fireplace: volume,
    wind: volume
  };
};

const buildPlayingRecord = (): Record<AmbientTrackId, boolean> => {
  return {
    campfire: false,
    coffee_place: false,
    fireplace: false,
    wind: false
  };
};

export const createAmbientStore = (
  initialState?: Partial<AmbientStoreState>
): AmbientStore => {
  const listeners = new Set<AmbientListener>();

  const knownTrackIds = new Set<AmbientTrackId>(AMBIENT_TRACKS.map((track) => track.id));
  if (knownTrackIds.size !== AMBIENT_TRACKS.length) {
    throw new Error("Ambient track ids must be unique.");
  }

  let state: AmbientStoreState = {
    drawerOpen: Boolean(initialState?.drawerOpen),
    masterVolume: clamp01(initialState?.masterVolume ?? 1),
    trackVolumes: {
      ...buildTrackVolumeRecord(0.55),
      ...initialState?.trackVolumes
    },
    playing: {
      ...buildPlayingRecord(),
      ...initialState?.playing
    }
  };

  const emit = () => {
    listeners.forEach((listener) => {
      listener(state);
    });
  };

  const setState = (nextState: AmbientStoreState) => {
    state = nextState;
    emit();
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      listener(state);
      return () => {
        listeners.delete(listener);
      };
    },
    setDrawerOpen: (open) => {
      if (state.drawerOpen === open) {
        return;
      }
      setState({
        ...state,
        drawerOpen: open
      });
    },
    toggleDrawer: () => {
      setState({
        ...state,
        drawerOpen: !state.drawerOpen
      });
    },
    setTrackVolume: (trackId, volume0to1) => {
      const nextVolume = clamp01(volume0to1);
      if (state.trackVolumes[trackId] === nextVolume) {
        return;
      }
      setState({
        ...state,
        trackVolumes: {
          ...state.trackVolumes,
          [trackId]: nextVolume
        }
      });
    },
    setTrackPlaying: (trackId, isPlaying) => {
      if (state.playing[trackId] === isPlaying) {
        return;
      }
      setState({
        ...state,
        playing: {
          ...state.playing,
          [trackId]: isPlaying
        }
      });
    },
    setMasterVolume: (volume0to1) => {
      const nextVolume = clamp01(volume0to1);
      if (state.masterVolume === nextVolume) {
        return;
      }
      setState({
        ...state,
        masterVolume: nextVolume
      });
    }
  };
};
