'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/analyze', label: 'Analyze' },
  { href: '/timing', label: 'Compare timing' },
  { href: '/value', label: 'Align value' },
  { href: '/field-form', label: 'Field form' },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="no-print sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-mint-border bg-canvas/95 px-4 text-ink backdrop-blur sm:px-8" aria-label="Primary">
      <Link href="/" className="flex items-center gap-2">
        <span aria-hidden className="inline-block h-4 w-4 rounded-full bg-primary shadow-[8px_-5px_0_0_#7bd4b5]" />
        <span className="text-lg" style={{ fontWeight: 480, letterSpacing: '0.01em' }}>SolarAlign</span>
      </Link>
      <ul className="hidden items-center gap-1 lg:flex">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return <li key={link.href}><Link href={link.href} aria-current={active ? 'page' : undefined} className={`pill h-9 text-sm ${active ? 'pill-tint text-primary' : 'text-ink-secondary hover:bg-mint-soft'}`}>{link.label}</Link></li>;
        })}
      </ul>
      <Link href="/analyze" className="pill pill-primary">Start analysis</Link>
    </nav>
  );
}
