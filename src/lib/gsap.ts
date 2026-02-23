import { gsap } from 'gsap';

let initialized = false;

export function initGSAP() {
  if (initialized) return gsap;

  gsap.config({
    nullTargetWarn: false,
  });

  initialized = true;
  return gsap;
}

export { gsap };
