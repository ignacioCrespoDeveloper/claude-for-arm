/**
 * The registry behind the homepage.
 *
 * Two kinds of entry:
 *  - `app`   — a tool that runs in this browser app, reachable at its own hash route.
 *  - `skill` — a Claude Code skill living in `.claude/skills/<command>/SKILL.md`. It runs in
 *              the editor, not here; the homepage documents it so the team knows it exists.
 *
 * Adding a skill means adding its folder AND a row here. Keep the two in step — the point of
 * the homepage is that nobody has to go spelunking in `.claude/` to find out what we have.
 */

export type ToolStatus = 'live' | 'planned';

export type AppTool = {
  kind: 'app';
  id: string;
  /** Hash route, without the leading `#`. */
  route: string;
  name: string;
  blurb: string;
  /** What you walk away with. */
  produces: string;
  bullets: string[];
  status: ToolStatus;
};

export type SkillTool = {
  kind: 'skill';
  id: string;
  /** Slash command and folder name under `.claude/skills/`. */
  command: string;
  name: string;
  blurb: string;
  produces: string;
  /** Phrasings that make Claude reach for this skill on its own. */
  triggers: string[];
  bullets: string[];
  status: ToolStatus;
};

export type Tool = AppTool | SkillTool;

export const APPS: AppTool[] = [
  {
    kind: 'app',
    id: 'product-builder',
    route: '/product-builder',
    name: 'RCA Product Builder',
    blurb:
      'Design a Revenue Cloud Advanced catalog — categories, attributes, classifications, bundles and pricing — preview it exactly as Browse Catalog will render it, then export a load-ready workbook.',
    produces: '.xlsx workbook, 16 tabs in dependency order',
    bullets: [
      'Preview replicates Browse Products and the product configurator',
      'Validation blocks the mistakes that actually fail on import',
      'Flags products that load cleanly and still stay invisible, with the reason',
      'Nothing leaves the browser',
    ],
    status: 'live',
  },
];

export const SKILLS: SkillTool[] = [
  {
    kind: 'skill',
    id: 'ticket-solution',
    command: 'sf-ticket-solution',
    name: 'RCA ticket → Jira-ready solution',
    blurb:
      'Turns a Revenue Cloud ticket into a Jira ticket body a developer can paste and work from: root cause with the query that proves it, the chosen mechanism and the one it rejected, numbered steps with full Setup paths, and testable acceptance criteria.',
    produces: 'A paste-ready Jira ticket, in one copyable block',
    triggers: [
      'paste an RCA ticket',
      '"why is this product not showing"',
      '"why is the price wrong"',
      '"estimate this"',
    ],
    bullets: [
      'Ships the RCA domain map — catalog, Context Definitions, Pricing Procedures, qualification and disqualification, configuration rules, decision tables',
      'Failure-mode table: symptom → cause → the SOQL that confirms it, ordered by what it actually turns out to be',
      'API names are verified against the org or the developer guide, or marked unverified — never invented',
      'Activation and decision-table refreshes are numbered steps, because that is what reopens these tickets',
    ],
    status: 'live',
  },
  {
    kind: 'skill',
    id: 'pricing-procedure',
    command: 'sf-pricing-procedure',
    name: 'Pricing procedures',
    blurb:
      'Reads an existing pricing procedure out of the org and explains what it actually does to a price, element by element — then tells you exactly what to add, and where in the sequence, to get the pricing outcome you want.',
    produces: 'A procedure walkthrough, or an add-this-element plan',
    triggers: [
      '"explain this pricing procedure"',
      '"how do I add a volume discount"',
      '"why did this line price at X"',
    ],
    bullets: [
      'Pulls the real procedure — ExpressionSetDefinition plus its version — instead of describing it from its name',
      'All fifteen elements catalogued: what each reads and writes, its decision table, and its prerequisites',
      'Recipes from goal to element: volume vs. true tiering, segment pricing, attribute pricing, floors, proration, rounding',
      'Order is treated as the design — every answer says where in the sequence and why there',
    ],
    status: 'live',
  },
  {
    kind: 'skill',
    id: 'tdd',
    command: 'sf-tdd',
    name: 'TDD authoring',
    blurb:
      'Writes a Technical Design Document against a consistent template — scope, data model, component design, integrations, security, limits, test and deployment strategy.',
    produces: 'docs/tdd/<TICKET>-<slug>.md, with mermaid ERD and sequence diagrams',
    triggers: ['"write a TDD"', '"technical design for"', '"document this design"'],
    bullets: [
      'Every design decision states the alternative it rejected',
      'Order-of-execution table for any object with competing automation',
      'Assumptions are marked `(assumed)` rather than dressed as facts',
      'Deployment section separates manual post-steps from deployable components',
    ],
    status: 'live',
  },
  {
    kind: 'skill',
    id: 'flow-design',
    command: 'sf-flow-design',
    name: 'Flow design',
    blurb:
      'Picks the right flow type, defines trigger and entry criteria, lays out elements with fault paths and test cases — and can emit deployable Flow metadata XML.',
    produces: 'A flow spec, optionally a ready-to-validate .flow-meta.xml',
    triggers: ['"build a flow that…"', '"review this flow"', '"why is this flow failing"'],
    bullets: [
      'Before-save for same-record updates; the ladder is explicit',
      'No DML or Get inside a loop — the most common review rejection',
      'Fault path on every element that can fail, routed somewhere real',
      'Writes the XML into the repo and hands over the validation command — it never deploys',
    ],
    status: 'live',
  },
  {
    kind: 'skill',
    id: 'data-deploy',
    command: 'sf-data-deploy',
    name: 'Data deployment & migration',
    blurb:
      'Plans a data load as a runbook someone can execute: dependency order, external IDs, the sf CLI commands, per-step validation, and a rollback that actually rolls back.',
    produces: 'A load plan with copy-pasteable commands and checks',
    triggers: ['"load this into the sandbox"', '"migrate this data"', '"seed the org"'],
    bullets: [
      'Ships the full 16-object RCA load order, including the two-pass self-lookups',
      'External-ID upsert by default, so a re-run fixes instead of duplicating',
      'Lists what automation to suspend — and the step that turns it back on',
      'A runbook the operator executes: sample load first, checks between steps, never run for you',
    ],
    status: 'live',
  },
];
