import { createAmbientController } from "../features/ambient/ambientController";
import { createAmbientStore } from "../features/ambient/ambientStore";

export const appAmbientStore = createAmbientStore();
export const appAmbientController = createAmbientController({
  store: appAmbientStore
});
