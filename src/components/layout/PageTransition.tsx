'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

import { initGSAP } from '@/lib/gsap';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gsap = initGSAP();
    gsap.killTweensOf(node);

    if (prefersReducedMotion) {
      gsap.set(node, { autoAlpha: 1, y: 0, clearProps: 'filter' });
      return;
    }

    gsap.fromTo(
      node,
      { autoAlpha: 0, y: 12, filter: 'blur(8px)' },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.42, ease: 'power2.out', clearProps: 'filter' },
    );
  }, [pathname]);

  return <div ref={ref} className="will-change-transform">{children}</div>;
}
