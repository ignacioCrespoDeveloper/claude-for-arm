import { useMemo, useState } from 'react';
import { SKILLS } from './data/tools';
import { SKILL_DOCS, splitFrontmatter } from './data/skillDocs';
import Markdown from './ui/Markdown';
import SiteShell from './ui/SiteShell';

/**
 * Reader for a skill. Renders the actual SKILL.md — the same text Claude reads — so the page
 * cannot describe behaviour the skill does not have.
 */
export default function SkillDoc({ command, go }: { command: string; go: (route: string) => void }) {
  const skill = SKILLS.find((s) => s.command === command) ?? SKILLS[0];
  const doc = SKILL_DOCS[skill.command];
  const [file, setFile] = useState<string>('skill');

  const reference = doc.references?.find((r) => r.name === file);
  const source = file === 'skill' || !reference ? doc.source : reference.source;
  const path = file === 'skill' || !reference ? doc.path : reference.path;

  const { frontmatter } = useMemo(() => splitFrontmatter(doc.source), [doc.source]);

  return (
    <SiteShell route={`/skills/${skill.command}`} go={go}>
      <div className="site-doc-head">
        <div className="site-eyebrow">Claude Code skill</div>
        <h1>{skill.name}</h1>
        <p>{frontmatter.description ?? skill.blurb}</p>
      </div>

      <div className="site-doc-bar">
        <code className="site-card-cmd">/{skill.command}</code>
        <span className="path">{path}</span>
        <span className="grow" />
        {doc.references && (
          <>
            <button
              className={file === 'skill' ? 'site-btn on' : 'site-btn'}
              onClick={() => setFile('skill')}
            >
              SKILL.md
            </button>
            {doc.references.map((r) => (
              <button
                key={r.name}
                className={file === r.name ? 'site-btn on' : 'site-btn'}
                onClick={() => setFile(r.name)}
              >
                {r.name}
              </button>
            ))}
          </>
        )}
        <CopyButton text={`/${skill.command}`} />
      </div>

      {/* The page header already carries the title, so the file's own H1 would double it. */}
      <Markdown source={source} hideTitle />
    </SiteShell>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="site-btn"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? 'Copied' : 'Copy command'}
    </button>
  );
}
