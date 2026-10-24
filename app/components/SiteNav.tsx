'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Start' },
  { href: '/evidence', label: 'Evidence' },
  { href: '/timing', label: 'Timing' },
  { href: '/value', label: 'Value' },
  { href: '/brief', label: 'Brief' },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav
      className="sticky top-0 z-40 flex h-[72px] items-center justify-between bg-night px-4 text-on-dark sm:px-8"
      aria-label="Primary"
    >
      <Link href="/" className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-4 w-4 rounded-full"
          style={{ background: 'linear-gradient(135deg,#5266eb,#9cb4e8)' }}
        />
        <span className="text-lg" style={{ fontWeight: 480, letterSpacing: '0.01em' }}>
          SolarAlign
        </span>
      </Link>
      <ul className="hidden items-center gap-1 md:flex">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`pill ${active ? 'pill-glass' : ''} text-on-dark`}
                style={!active ? { background: 'transparent' } : undefined}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/evidence" className="pill pill-primary">
        Launch demo
      </Link>
    </nav>
  );
}
