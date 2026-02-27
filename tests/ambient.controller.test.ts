import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAmbientController } from "../src/features/ambient/ambientController";
import { createAmbientStore } from "../src/features/ambient/ambientStore";

class FakeAudio {
  static created: FakeAudio[] = [];
  loop = false;
  preload = "auto";
  volume = 1;
  readonly play = vi.fn().mockResolvedValue(undefined);
  readonly pause = vi.fn();

  constructor(public readonly src: string) {
    FakeAudio.created.push(this);
  }

  static reset(): void {
    FakeAudio.created = [];
  }
}

describe("ambient controller", () => {
  const originalAudio = globalThis.Audio;

  beforeEach(() => {
    FakeAudio.reset();
    // @ts-expect-error - test override for HTMLAudioElement constructor behavior.
    globalThis.Audio = FakeAudio;
  });

  afterEach(() => {
    // @ts-expect-error - restore original constructor.
    globalThis.Audio = originalAudio;
  });

  it("uses lazy initialization and avoids creating audio on setVolume before play", () => {
    const store = createAmbientStore();
    const controller = createAmbientController({ store });

    controller.setVolume("campfire", 0.5);
    expect(FakeAudio.created).toHaveLength(0);
  });

  it("creates one audio instance on first play and reuses cache for repeated play", async () => {
    const store = createAmbientStore();
    const controller = createAmbientController({ store });

    await controller.play("campfire");
    expect(FakeAudio.created).toHaveLength(1);
    expect(FakeAudio.created[0]?.src).toBe("/audio/summer.mp3");

    await controller.play("campfire");
    expect(FakeAudio.created).toHaveLength(1);
  });

  it("sets loop and preload for deferred loading", async () => {
    const store = createAmbientStore();
    const controller = createAmbientController({ store });

    await controller.play("campfire");

    expect(FakeAudio.created[0]?.loop).toBe(true);
    expect(FakeAudio.created[0]?.preload).toBe("none");
  });

  it("toggles play/pause and reuses the same HTMLAudioElement instance", async () => {
    const store = createAmbientStore();
    const controller = createAmbientController({ store });

    await controller.togglePlay("campfire");
    const audio = FakeAudio.created[0];
    if (!audio) {
      throw new Error("Expected fake audio to be created");
    }
    expect(audio.play).toHaveBeenCalledTimes(1);

    await controller.togglePlay("campfire");
    expect(audio.pause).toHaveBeenCalledTimes(1);

    await controller.togglePlay("campfire");
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(FakeAudio.created).toHaveLength(1);
  });

  it("applies per-track volume multiplied by master volume", async () => {
    const store = createAmbientStore();
    const controller = createAmbientController({ store });

    controller.setVolume("campfire", 0.4);
    controller.setMasterVolume(0.5);
    await controller.play("campfire");

    const audio = FakeAudio.created[0];
    expect(audio?.volume).toBeCloseTo(0.2);

    controller.setMasterVolume(0.25);
    expect(audio?.volume).toBeCloseTo(0.1);
  });
});
