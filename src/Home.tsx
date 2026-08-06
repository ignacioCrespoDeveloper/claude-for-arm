import { useEffect, useMemo, useState } from 'react';
import { useStore, modelOf } from './model/store';
import { APPS, SKILLS } from './data/tools';
import SiteShell, { type Section } from './ui/SiteShell';

const SECTIONS: Section[] = [
  { id: 'start', label: 'Start here' },
  { id: 'skills', label: 'Skills' },
  { id: 'tools', label: 'Browser tools' },
  { id: 'reference', label: 'Reference' },
];

export default function Home({ go }: { go: (route: string) => void }) {
  const store = useStore();
  const model = useMemo(() => modelOf(store), [store]);
  const active = useScrollSpy(SECTIONS.map((s) => s.id));

  /** Shown on the Product Builder card so you can see there is work in progress. */
  const draft =
    model.products.length > 0 || model.categories.length > 0
      ? `${model.products.length} product${model.products.length === 1 ? '' : 's'} · ${
          model.categories.length
        } categor${model.categories.length === 1 ? 'y' : 'ies'} saved`
      : null;

  return (
    <SiteShell route="/" go={go} sections={SECTIONS} activeSection={active}>
      <div className="site-hero">
        <div className="site-eyebrow">Revenue Cloud Advanced</div>
        <h1>
          Design it, document it,
          <br />
          deploy it.
        </h1>
        <p className="site-lead">
          The tools we use on RCA engagements. Five Claude Code skills that turn a ticket into a
          Jira-ready solution, read and extend a pricing procedure, write the TDD, design the Flow
          and plan the data load — plus a browser tool that builds a load-ready catalog workbook.
        </p>
      </div>

      <section className="site-section" id="start">
        <h2>Start here</h2>
        <p className="site-sub">
          Three steps, about ten minutes, most of it the first real test.
        </p>

        <div className="site-steps">
          <div className="site-step">
            <div className="num">01</div>
            <div>
              <h3>Install the skills into your Salesforce project</h3>
              <p>
                <code className="tick">--link</code> symlinks them, so any edit here reaches
                every project immediately — the mode you want while you are still tuning them.
              </p>
              <pre className="term">
                <span className="p">$ </span>tools/install-skills.sh ~/code/my-sf-project --link
              </pre>
            </div>
          </div>

          <div className="site-step">
            <div className="num">02</div>
            <div>
              <h3>Connect an org</h3>
              <p>
                Every skill verifies API names against a real org instead of guessing. Without one
                they still work, but everything comes back marked{' '}
                <code className="tick">(unverified)</code>.
              </p>
              <pre className="term">
                <span className="p">$ </span>sf org login web -a mysandbox
              </pre>
            </div>
          </div>

          <div className="site-step">
            <div className="num">03</div>
            <div>
              <h3>Open a new session and run one</h3>
              <p>
                Skills are discovered at startup, so a session that was already running will not
                see them. Type the command, or just describe the task — the descriptions are
                written so Claude reaches for the right skill unprompted.
              </p>
              <pre className="term">
                <span className="p">&gt; </span>/sf-ticket-solution{'\n'}
                <span className="c">
                  {'  '}Premium Support doesn&apos;t show in Browse Catalog since Tuesday
                </span>
              </pre>
              <button className="site-btn" onClick={() => go('/install')}>
                Full install guide →
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="site-section" id="skills">
        <h2>Skills</h2>
        <p className="site-sub">
          Markdown files in <code className="tick">.claude/skills/</code>. They run in the
          editor, in whichever repo you are working in. Click one to read the whole thing.
          <br />
          <strong>None of them write to your org</strong> — they read it, and hand you the steps.
        </p>

        <div className="site-cards two">
          {SKILLS.map((s) => (
            <button
              key={s.id}
              className="site-card"
              onClick={() => go(`/skills/${s.command}`)}
            >
              <div className="site-card-top">
                <h3>{s.name}</h3>
                <code className="site-card-cmd">/{s.command}</code>
              </div>
              <p>{s.blurb}</p>
              <ul>
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <div className="site-card-foot">
                <div>
                  <span className="site-meta-label">Produces</span>
                  {s.produces}
                </div>
                <div className="site-go">Read the skill →</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="site-section" id="tools">
        <h2>Browser tools</h2>
        <p className="site-sub">No install, nothing leaves the tab.</p>

        <div className="site-cards">
          {APPS.map((t) => (
            <button key={t.id} className="site-card" onClick={() => go(t.route)}>
              <div className="site-card-top">
                <h3>{t.name}</h3>
                <span className="site-tag">{t.status === 'live' ? 'Live' : 'Planned'}</span>
              </div>
              <p>{t.blurb}</p>
              <ul>
                {t.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <div className="site-card-foot">
                <div>
                  <span className="site-meta-label">Produces</span>
                  {t.produces}
                </div>
                {draft && (
                  <div>
                    <span className="site-meta-label">In this browser</span>
                    {draft}
                  </div>
                )}
                <div className="site-go">Open →</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="site-section" id="reference">
        <h2>Reference</h2>
        <p className="site-sub">Every command, and what you get back.</p>

        <table className="site-table">
          <thead>
            <tr>
              <th>Command</th>
              <th>Fires on</th>
              <th>Produces</th>
            </tr>
          </thead>
          <tbody>
            {SKILLS.map((s) => (
              <tr key={s.id}>
                <td className="mono">/{s.command}</td>
                <td>{s.triggers.join(' · ')}</td>
                <td>{s.produces}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="site-foot">
        <span>Skills version with this repo — clone it and you have them.</span>
        <span>Nothing typed into the browser tools leaves the browser.</span>
      </footer>
    </SiteShell>
  );
}

/** Highlights the nav entry for whichever section is nearest the top of the viewport. */
function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // `ids` is a module-level constant mapped inline; identity churn is not a concern here.
  }, [ids.join(',')]);

  return active;
}
