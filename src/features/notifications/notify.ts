let permissionRequested = false;
let chimeAudio: HTMLAudioElement | null = null;

const chimeUrl = new URL("../../assets/chime.wav", import.meta.url).toString();

const isNotificationAvailable = (): boolean => {
  return typeof Notification !== "undefined";
};

export const ensureNotificationPermission = async (): Promise<boolean> => {
  if (!isNotificationAvailable()) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  if (!permissionRequested) {
    permissionRequested = true;
    const result = await Notification.requestPermission();
    return result === "granted";
  }

  return Notification.permission === "granted";
};

export const notify = (title: string, options?: NotificationOptions): boolean => {
  if (!isNotificationAvailable()) {
    return false;
  }
  if (Notification.permission !== "granted") {
    return false;
  }
  new Notification(title, options);
  return true;
};

export const playCompletionSound = (): void => {
  if (typeof Audio === "undefined") {
    return;
  }
  if (!chimeAudio) {
    chimeAudio = new Audio(chimeUrl);
    chimeAudio.preload = "auto";
    chimeAudio.volume = 0.4;
  }
  chimeAudio.currentTime = 0;
  try {
    const result = chimeAudio.play();
    if (result && typeof result.catch === "function") {
      void result.catch(() => {
        // Ignore autoplay errors.
      });
    }
  } catch {
    // Ignore unsupported playback environments (e.g. jsdom).
  }
};
