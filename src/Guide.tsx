import install from '../INSTALL.md?raw';
import Markdown from './ui/Markdown';
import SiteShell from './ui/SiteShell';

/** The install guide, rendered from the repo's INSTALL.md so the two cannot drift. */
export default function Guide({ go }: { go: (route: string) => void }) {
  return (
    <SiteShell route="/install" go={go}>
      <div className="site-doc-head">
        <div className="site-eyebrow">Guide</div>
      </div>
      <Markdown source={install} />
    </SiteShell>
  );
}
