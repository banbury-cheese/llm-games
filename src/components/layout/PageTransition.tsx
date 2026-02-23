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

    const gsap = initGSAP();
    gsap.fromTo(
      node,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' },
    );
  }, [pathname]);

  return <div ref={ref}>{children}</div>;
}
