export type AmbientTrackId = "campfire" | "coffee_place" | "fireplace" | "wind" | "rain";

export interface AmbientTrack {
  id: AmbientTrackId;
  label: string;
  src: string;
  icon: string;
}

export const AMBIENT_TRACKS: readonly AmbientTrack[] = [
  {
    id: "campfire",
    label: "Park Ambience",
    src: "/audio/summer.mp3",
    icon: "/icons/ambient/summer.svg"
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
  },
  {
    id: "rain",
    label: "Rain",
    src: "/audio/rain.mp3",
    icon: "/icons/ambient/rain.svg"
  }
] as const;
