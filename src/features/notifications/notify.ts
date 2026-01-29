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

export const playSoundNTimes = async (
  audioEl: HTMLAudioElement,
  times: number,
  gapMs: number = 200
): Promise<void> => {
  const count = Math.max(0, Math.floor(times));
  if (count === 0) {
    return;
  }

  const waitForEnded = () =>
    new Promise<void>((resolve) => {
      const onEnded = () => {
        audioEl.removeEventListener("ended", onEnded);
        resolve();
      };
      audioEl.addEventListener("ended", onEnded);
      try {
        const result = audioEl.play();
        if (result && typeof result.catch === "function") {
          void result.catch(() => {
            // Ignore autoplay errors.
          });
        }
      } catch {
        // Ignore unsupported playback environments (e.g. jsdom).
      }
    });

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      if (ms <= 0) {
        resolve();
        return;
      }
      window.setTimeout(resolve, ms);
    });

  for (let index = 0; index < count; index += 1) {
    audioEl.currentTime = 0;
    await waitForEnded();
    if (index < count - 1) {
      await sleep(gapMs);
    }
  }
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
  void playSoundNTimes(chimeAudio, 5);
};
