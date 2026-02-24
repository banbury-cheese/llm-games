import { gsap } from 'gsap';
import { Draggable } from 'gsap/dist/Draggable';
import { InertiaPlugin } from 'gsap/dist/InertiaPlugin';

let initialized = false;

export function initGSAP() {
  if (initialized) return gsap;

  gsap.config({
    nullTargetWarn: false,
  });
  gsap.registerPlugin(Draggable, InertiaPlugin);

  initialized = true;
  return gsap;
}

export { gsap };
