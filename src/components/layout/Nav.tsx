'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/cn';

import styles from './Nav.module.scss';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/create', label: 'Create' },
  { href: '/settings', label: 'Settings' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className={styles.nav}>
      <div className={styles.row}>
        <Link href="/" className={styles.brand}>
          <span className={styles.logo} aria-hidden>
            🎮
          </span>
          <span>Study Arcade</span>
        </Link>

        <nav className={styles.links} aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(styles.link, pathname === item.href && styles.linkActive)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
