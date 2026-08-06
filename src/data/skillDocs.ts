/**
 * The skill files themselves, imported as raw text.
 *
 * This is deliberate: the homepage renders the *same* markdown Claude reads, so the docs
 * can never drift from the behaviour. Editing a SKILL.md updates the page on the next build.
 */
import ticketSolution from '../../.claude/skills/sf-ticket-solution/SKILL.md?raw';
import rcaDomainMap from '../../.claude/skills/sf-ticket-solution/references/rca-domain-map.md?raw';
import rcaFailureModes from '../../.claude/skills/sf-ticket-solution/references/rca-failure-modes.md?raw';
import jiraTemplate from '../../.claude/skills/sf-ticket-solution/references/jira-ticket-template.md?raw';
import rcaDocs from '../../.claude/skills/sf-ticket-solution/references/rca-docs.md?raw';
import tdd from '../../.claude/skills/sf-tdd/SKILL.md?raw';
import tddTemplate from '../../.claude/skills/sf-tdd/references/tdd-template.md?raw';
import flowDesign from '../../.claude/skills/sf-flow-design/SKILL.md?raw';
import dataDeploy from '../../.claude/skills/sf-data-deploy/SKILL.md?raw';

export type SkillDoc = {
  /** The raw SKILL.md, frontmatter included. */
  source: string;
  /** Path in the repo, shown so you know which file to edit. */
  path: string;
  /** Extra files the skill reads. */
  references?: { name: string; path: string; source: string }[];
};

export const SKILL_DOCS: Record<string, SkillDoc> = {
  'sf-ticket-solution': {
    source: ticketSolution,
    path: '.claude/skills/sf-ticket-solution/SKILL.md',
    references: [
      {
        name: 'RCA domain map',
        path: '.claude/skills/sf-ticket-solution/references/rca-domain-map.md',
        source: rcaDomainMap,
      },
      {
        name: 'Failure modes',
        path: '.claude/skills/sf-ticket-solution/references/rca-failure-modes.md',
        source: rcaFailureModes,
      },
      {
        name: 'Jira template',
        path: '.claude/skills/sf-ticket-solution/references/jira-ticket-template.md',
        source: jiraTemplate,
      },
      {
        name: 'Docs index',
        path: '.claude/skills/sf-ticket-solution/references/rca-docs.md',
        source: rcaDocs,
      },
    ],
  },
  'sf-tdd': {
    source: tdd,
    path: '.claude/skills/sf-tdd/SKILL.md',
    references: [
      {
        name: 'tdd-template.md',
        path: '.claude/skills/sf-tdd/references/tdd-template.md',
        source: tddTemplate,
      },
    ],
  },
  'sf-flow-design': {
    source: flowDesign,
    path: '.claude/skills/sf-flow-design/SKILL.md',
  },
  'sf-data-deploy': {
    source: dataDeploy,
    path: '.claude/skills/sf-data-deploy/SKILL.md',
  },
};

/** Splits `---\n…\n---` off the front. Returns the frontmatter lines and the body. */
export function splitFrontmatter(md: string): { frontmatter: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
  if (!match) return { frontmatter: {}, body: md };

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const sep = line.indexOf(':');
    if (sep > 0) frontmatter[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  }
  return { frontmatter, body: md.slice(match[0].length) };
}
