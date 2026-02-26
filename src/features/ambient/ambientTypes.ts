export type AmbientTrackId = "campfire" | "coffee_place" | "fireplace" | "wind";

export interface AmbientTrack {
  id: AmbientTrackId;
  label: string;
  src: string;
  icon: string;
}

export const AMBIENT_TRACKS: readonly AmbientTrack[] = [
  {
    id: "campfire",
    label: "Campfire",
    src: "/audio/campfire.mp3",
    icon: "/icons/ambient/campfire.svg"
  },
  {
    id: "coffee_place",
    label: "Coffee Place",
    src: "/audio/coffee_place.mp3",
    icon: "/icons/ambient/coffee_place.svg"
  },
  {
    id: "fireplace",
    label: "Fireplace",
    src: "/audio/fireplace.mp3",
    icon: "/icons/ambient/fireplace.svg"
  },
  {
    id: "wind",
    label: "Wind",
    src: "/audio/wind.mp3",
    icon: "/icons/ambient/wind.svg"
  }
] as const;
