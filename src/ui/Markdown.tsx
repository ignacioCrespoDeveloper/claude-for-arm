import { useMemo } from 'react';
import { marked } from 'marked';
import { splitFrontmatter } from '../data/skillDocs';

marked.use({ gfm: true, breaks: false });

/**
 * Renders one of the repo's own markdown files. The source is bundled at build time from
 * this repo, so the HTML is trusted — there is no user input path into here.
 */
export default function Markdown({
  source,
  hideTitle = false,
}: {
  source: string;
  /** Drop the leading `# …` when the page already shows the title in its header. */
  hideTitle?: boolean;
}) {
  const html = useMemo(() => {
    let body = splitFrontmatter(source).body;
    if (hideTitle) body = body.replace(/^\s*#\s+.*\r?\n/, '');
    return marked.parse(body) as string;
  }, [source, hideTitle]);

  return <article className="doc" dangerouslySetInnerHTML={{ __html: html }} />;
}
