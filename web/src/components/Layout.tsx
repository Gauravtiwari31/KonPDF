import type { ReactNode } from 'react';
import site from '../../site.config.json';
import { Icon } from './Icon';

const NAV = [
  { href: '/', label: 'Tools' },
  { href: '/nw', label: 'Ask NW' },
  { href: '/download', label: 'Get the app' },
];

export function Layout({ path, children }: { path: string; children: ReactNode }) {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="site-head">
        <div className="wrap head-row">
          <a className="brand" href="/" aria-label="KonPDF home">
            <img src="/favicon.png" width={32} height={32} alt="" />
            <span>KonPDF</span>
          </a>
          <nav aria-label="Main">
            {NAV.map(n => (
              <a key={n.href} href={n.href} aria-current={n.href === path ? 'page' : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" className="wrap">
        {children}
      </main>
      <footer className="site-foot">
        <div className="wrap foot-grid">
          <div>
            <a className="brand" href="/">
              <img src="/favicon.png" width={28} height={28} alt="" />
              <span>KonPDF</span>
            </a>
            <p className="muted">Convert anything. Resize everything. Free, no sign-up.</p>
          </div>
          <nav aria-label="Tools">
            <h2 className="label">Tools</h2>
            <a href="/convert">Convert files</a>
            <a href="/resize">Resize images</a>
            <a href="/enhance">Enhance photos</a>
            <a href="/pdf-tools">PDF tools</a>
            <a href="/nw">Ask NW</a>
          </nav>
          <nav aria-label="About">
            <h2 className="label">KonPDF</h2>
            <a href="/about">About and contact</a>
            <a href="/download">Android app</a>
            <a href="/privacy">Privacy policy</a>
            <a href="/app-privacy">App privacy policy</a>
            <a href="/terms">Terms of use</a>
          </nav>
        </div>
        <div className="wrap foot-base">
          <span>
            © {new Date().getFullYear()} <a href={site.org}>NotWork.world</a>
          </span>
          <a href={site.repo} className="foot-gh">
            <Icon name="github" size={18} /> Open source on GitHub
          </a>
        </div>
      </footer>
    </>
  );
}
