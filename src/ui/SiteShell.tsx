import { type ReactNode } from 'react';
import { APPS, SKILLS } from '../data/tools';

export type Section = { id: string; label: string };

/**
 * The chrome shared by every documentation page: sticky top bar, sticky left nav, one
 * content column. The nav is built from the tool registry, so a new skill appears here the
 * moment it is registered.
 *
 * In-page anchors are scrolled programmatically rather than with `href="#id"` — the app
 * routes on the hash, so a real anchor would navigate instead of scroll.
 */
export default function SiteShell({
  route,
  go,
  sections,
  activeSection,
  children,
}: {
  route: string;
  go: (route: string) => void;
  sections?: Section[];
  activeSection?: string;
  children: ReactNode;
}) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onHome = route === '/';

  return (
    <div className="site">
      <header className="site-bar">
        <button className="site-brand" onClick={() => go('/')}>
          <span className="mark">RCA</span>
          <span className="wordmark">Revenue Cloud toolkit</span>
        </button>

        <nav>
          <button className={onHome ? 'on' : ''} onClick={() => go('/')}>
            Overview
          </button>
          <button
            className={route.startsWith('/skills/') ? 'on' : ''}
            onClick={() => go(`/skills/${SKILLS[0].command}`)}
          >
            Skills
          </button>
          <button className={route === '/install' ? 'on' : ''} onClick={() => go('/install')}>
            Install
          </button>
          <button
            className={route === APPS[0].route ? 'on' : ''}
            onClick={() => go(APPS[0].route)}
          >
            Product Builder
          </button>
        </nav>
      </header>

      <div className="site-body">
        <aside className="site-nav">
          {sections && sections.length > 0 && (
            <div className="site-nav-group">
              <h4>On this page</h4>
              {sections.map((s) => (
                <button
                  key={s.id}
                  className={activeSection === s.id ? 'on' : ''}
                  onClick={() => scrollTo(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div className="site-nav-group">
            <h4>Skills</h4>
            {SKILLS.map((s) => (
              <button
                key={s.id}
                className={route === `/skills/${s.command}` ? 'on' : ''}
                onClick={() => go(`/skills/${s.command}`)}
              >
                <span className="mono">/{s.command}</span>
              </button>
            ))}
          </div>

          <div className="site-nav-group">
            <h4>Guides</h4>
            <button className={route === '/install' ? 'on' : ''} onClick={() => go('/install')}>
              Install in your project
            </button>
          </div>

          <div className="site-nav-group">
            <h4>Browser tools</h4>
            {APPS.map((a) => (
              <button
                key={a.id}
                className={route === a.route ? 'on' : ''}
                onClick={() => go(a.route)}
              >
                {a.name}
              </button>
            ))}
          </div>
        </aside>

        <main className="site-main">{children}</main>
      </div>
    </div>
  );
}
