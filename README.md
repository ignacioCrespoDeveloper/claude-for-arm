# Salesforce Revenue Cloud toolkit

Two kinds of tool, one home page.

**Browser tools** run in the app — open the page and use them. Today that is the **RCA Product
Builder**.

**Claude Code skills** live in [.claude/skills/](.claude/skills/) and run in the editor, in whichever
repo you are working in. Cloning this repo installs them.

```bash
git clone https://github.com/ignacioCrespoDeveloper/claude-for-arm.git
cd claude-for-arm

npm run dev      # http://localhost:5173
npm run build    # type check + production bundle
```

The homepage lists everything and is the front door: [src/Home.tsx](src/Home.tsx) renders from
[src/data/tools.ts](src/data/tools.ts), and routing is a hash route
([src/App.tsx](src/App.tsx)) so `#/product-builder` survives a refresh and a pasted link with no
server rewrites.

Clicking a skill opens it at `#/skills/<command>`, which renders the **actual `SKILL.md`** —
[src/data/skillDocs.ts](src/data/skillDocs.ts) imports the files with Vite's `?raw` and
[src/SkillDoc.tsx](src/SkillDoc.tsx) renders them with `marked`. The page therefore cannot describe
behaviour the skill does not have: edit the markdown and the page changes with it. The `/sf-tdd`
page has a second tab for its template.

## The skills

| Command | What it does | Produces |
|---------|--------------|----------|
| [`/sf-ticket-solution`](.claude/skills/sf-ticket-solution/SKILL.md) | **RCA-specific.** Ticket → root cause with the query that proves it, the chosen mechanism and the rejected one, numbered steps with full Setup paths | A **Jira ticket body**, in one copyable block |
| [`/sf-pricing-procedure`](.claude/skills/sf-pricing-procedure/SKILL.md) | **RCA-specific.** Reads a pricing procedure out of the org and explains what it does to a price, element by element — then what to add, and where in the sequence, to get an outcome | A walkthrough, or an add-this-element plan |
| [`/sf-tdd`](.claude/skills/sf-tdd/SKILL.md) | Technical Design Document against a fixed template — data model, components, integrations, security, limits, test and deployment strategy | `docs/tdd/<TICKET>-<slug>.md` with mermaid diagrams |
| [`/sf-flow-design`](.claude/skills/sf-flow-design/SKILL.md) | Flow type, trigger, entry criteria, elements with fault paths, test cases — optionally the metadata XML | A flow spec, optionally a ready-to-validate `.flow-meta.xml` |
| [`/sf-data-deploy`](.claude/skills/sf-data-deploy/SKILL.md) | Load and migration planning — object order, external IDs, `sf` CLI commands, per-step validation, rollback | A load plan with copy-pasteable commands |

You can type the command, or just describe the task — each skill's `description` frontmatter is
written so Claude reaches for the right one unprompted.

**None of them write to your org.** Every skill queries, describes and retrieves as much as it
needs, then hands the change over as a command to paste or a numbered Setup step. No data loads,
no deploys, no activating a version or refreshing a decision table — not even
`sf project deploy start --dry-run`, which still registers a deployment. Writing files in your
repo (a TDD, a `.flow-meta.xml`, CSV templates) is expected; the org is what is off limits. Each
`SKILL.md` carries the rule as its own section near the top, with one narrow exception: you
telling it explicitly, in the moment, to run a named command against a named org.

### What `/sf-pricing-procedure` knows about pricing

Two reference files, read before it answers anything:

| File | Contents |
|------|----------|
| [`pricing-elements.md`](.claude/skills/sf-pricing-procedure/references/pricing-elements.md) | All fifteen elements — what each reads and writes, the decision table behind it, its prerequisites and its gotchas. Plus the order pricing runs in, the decision-table names that matter at deployment, context tags vs. fields, and the org-level switches in Salesforce Pricing Setup that change what a procedure appears to do |
| [`recipes.md`](.claude/skills/sf-pricing-procedure/references/recipes.md) | Goal → element, position, prerequisites, verification. Volume vs. true tiering, segment and negotiated pricing, attribute and bundle pricing, discount floors, deal-level distribution, subscription proration, rounding, and what to do when nothing fits |

It pulls the real procedure — `ExpressionSetDefinition` **and** `ExpressionSetDefinitionVersion`,
since the definition without its version is a shell — rather than describing one from its name. The
skill also carries the known CLI trap: retrieving or deploying `ExpressionSetDefinitionVersion` and
`DecisionMatrixDefinitionVersion` has documented failures, and a half-deployed pricing procedure is
worse than one that did not deploy.

### What `/sf-ticket-solution` knows about RCA

It is not general Salesforce advice. Four reference files ship with it and are read before it
designs anything:

| File | Contents |
|------|----------|
| [`rca-domain-map.md`](.claude/skills/sf-ticket-solution/references/rca-domain-map.md) | The five layers a quote passes through — discovery, qualification, configuration, pricing, lifecycle — with the objects in each. Catalog load order, the five visibility conditions, Context Definitions (`Sales Transaction` / `Product Discovery`, nodes, attributes, versioning), pricing procedures and their elements, `ProductQualification` / `ProductDisqualification`, `ProductConfigurationRule`, decision tables |
| [`rca-failure-modes.md`](.claude/skills/sf-ticket-solution/references/rca-failure-modes.md) | Symptom → cause → the SOQL that confirms it, ordered by what it actually turns out to be. "Product doesn't appear", "price is wrong", "my change had no effect", "it worked in the sandbox" |
| [`jira-ticket-template.md`](.claude/skills/sf-ticket-solution/references/jira-ticket-template.md) | The output format, plus a fully worked example |
| [`rca-docs.md`](.claude/skills/sf-ticket-solution/references/rca-docs.md) | Official developer-guide URLs to `WebFetch` when it needs authoritative detail, and the URL pattern for constructing an object page |

Names in the domain map are marked **✓ verified** against the Revenue Cloud Developer Guide or
**⚠︎ verify** where they shift between releases. The skill is instructed never to put a ⚠︎ name in
a ticket without checking the org or the docs first — an invented API name costs a developer an
afternoon and the next ticket its credibility.

Two things make the output markedly better:

- **Connect an org.** `sf org login web -a <alias>` — every skill verifies API names against a real
  org or repo metadata rather than guessing, and says which source it used.
- **Edit them.** A skill is a markdown file with YAML frontmatter. When a review keeps catching the
  same thing, add it to that skill's checklist and it stops happening.

To use them in a client's SFDX repo:

```bash
tools/install-skills.sh ~/code/my-sf-project --link    # symlink — edits here are live there
tools/install-skills.sh ~/code/my-sf-project           # copy, to commit into that repo
tools/install-skills.sh --global                       # ~/.claude/skills, every project
```

**[INSTALL.md](INSTALL.md)** is the full guide — connecting an org, verifying the skills loaded, a
smoke test per skill with what good output looks like, the read-only permission allowlist, and what
to check when one does not fire. It is also served in the app at `#/install`.

### Adding a skill

```
.claude/skills/<command-name>/
├── SKILL.md              # frontmatter: name + description. The description is what makes
│                         # Claude pick it; write it in terms of when to use it.
└── references/           # optional templates the skill reads, e.g. tdd-template.md
```

Then add a row to [`SKILLS`](src/data/tools.ts) so it shows on the homepage. Keeping those two in
step is the whole point — nobody should have to go spelunking in `.claude/` to find out what exists.

---

# RCA Product Builder

A guided UI for designing a Salesforce Revenue Cloud Advanced product catalog, previewing it the way
Browse Catalog will render it, and exporting a load-ready `.xlsx`.

Nothing leaves the browser. State is kept in `localStorage`, so a refresh does not lose work.

## The flow

1. **Catalog & categories** — the shelf and its aisles. Products only appear in Browse Catalog once
   they are published to a category.
2. **Picklists** — reusable value sets. "Paste a list" fills codes and display values from one value
   per line.
3. **Attributes** — org-wide attribute definitions, plus the optional categories that become sections
   in the configurator.
4. **Classifications** — the bridge between attributes and products. Every product based on a
   classification inherits its attributes, and a bundle can point a component group at a
   classification instead of naming one product.
5. **Products** — a bundle is just a product with `Type = Bundle`.
6. **Bundles** — component groups and their contents.
7. **Selling models & pricing** — `ProductSellingModel`, `Pricebook2`, `ProductSellingModelOption`
   and `PricebookEntry`. See below: this is what actually makes a product reachable.
8. **Preview catalog** — a replica of the Browse Products modal a rep sees inside a quote: category
   nav, search, multi-select with **Add Selection to Quote**, per-product quantity steppers, the gear
   that opens the configurator, and a running quote line item count. Rendered strictly from the
   model, so a product missing here is missing in the org too.

   The gear opens a replica of the **product configurator**
   ([`src/preview/Configurator.tsx`](src/preview/Configurator.tsx)): attribute categories become the
   first tab strip, component groups the second, with the Product Validation / Instant Pricing /
   Compact Mode toggles, the error-warning-info summary, and a totals panel bucketed into One Time,
   Monthly, Quarterly, Semi-Annual and Annual by each product's selling model. With Instant Pricing
   off, totals stay blank until **Update Prices** — same as the real screen.

   It configures for real: pick attribute values, add components from a group (a classification
   component offers every product of that kind), change quantities. Required attributes, unmet group
   minimums, exceeded maximums and missing required components all raise messages, and **Save & Exit**
   is blocked while errors remain.
9. **Review & export** — validation, the post-load checklist, then the workbook.

## What makes a product visible

Publishing to a category is necessary but not sufficient. A product appears in Browse Catalog only
when **all** of these hold:

1. `IsActive` is true
2. its record type is Commercial
3. it is published to a category in the catalog (`ProductCategoryProduct`)
4. it offers a selling model (`ProductSellingModelOption`)
5. it has an active `PricebookEntry` in the price book for that selling model

…and, after loading, the **PricebookEntry decision table has been refreshed**. Until that runs the
catalog resolves no price and products stay hidden even though every record imported cleanly.

[`src/model/visibility.ts`](src/model/visibility.ts) owns that rule. Both the preview and the
validator call it, so they can never disagree about what a rep will see. The preview lists every
product that would load cleanly and still not appear, with the specific reason.

One consequence worth knowing: a bundle component with `DoesBundlePriceIncludeChild = false` carries
its own price, so it needs its own selling model and price entry even though it is never browsable on
its own. The validator checks this.

Load the sample catalog from the sidebar to see a worked example: a configurable bundle, two static
variants, classification-based component groups and picklist-driven attributes.

## What the export produces

One tab per Salesforce object, one header row of real API names, in dependency order. Lookups use the
`Field:Object:ExternalKey` syntax the Revenue Cloud import understands, so records resolve by name or
code and you never paste an id.

| # | Tab | Resolves by |
|---|-----|-------------|
| 1 | `ProductCatalog` | — |
| 2 | `ProductCategory` | catalog code, parent category code |
| 3 | `AttributePicklist` | — |
| 4 | `AttributePicklistValue` | picklist name |
| 5 | `AttributeCategory` | — |
| 6 | `AttributeDefinition` | picklist name |
| 7 | `ProductClassification` | — |
| 8 | `ProductClassificationAttr` | classification code, attribute API name, attribute category code |
| 9 | `ProductSellingModel` | — |
| 10 | `Pricebook2` | — |
| 11 | `Product2` | classification name, record type, unit of measure |
| 12 | `ProductCategoryProduct` | category code, product code |
| 13 | `ProductSellingModelOption` | product name, selling model name, proration policy name |
| 14 | `PricebookEntry` | price book name, product name, selling model name |
| 15 | `ProductComponentGroup` | bundle product name |
| 16 | `ProductRelatedComponent` | bundle name, group code, child product name **or** classification name |

A `_ReadMe` tab carries the same order with a note per object, followed by the post-load steps —
including the decision table refresh.

`RecordType`, `UnitOfMeasure` and `ProrationPolicy` are resolved against records that already exist
in the org — the workbook references them by name but does not create them. Standard selling models
and the standard price book usually exist too; match their names exactly rather than duplicating
them.

## Validation

The **Review & export** step blocks on the mistakes that actually fail on import, rather than style
preferences: duplicate codes and API names, picklists with no values, attributes typed `Picklist`
with no picklist attached, defaults that are not a value of their own picklist, component groups
whose minimum exceeds the number of components defined, components that set both a product and a
classification, quantity bounds that contradict the starting quantity, and bundles that contain each
other in a loop.

Warnings cover the things that import cleanly but surprise you later — a product in no category, a
required component that is not included by default, a bundle that cannot be configured during sale.

## Working with existing workbooks

```bash
npm run dump                      # every .xlsx in ./xlsx → tab-separated text in ./xlsx/_dump
node tools/dump-xlsx.mjs a.xlsx   # or one file
```

`tools/verify-export.mjs` bundles the model and export code for Node, runs it against the sample
catalog, checks that every cross-tab lookup resolves to a real row, round-trips a real workbook, and
asserts the visibility rules still fire — removing a selling model option, removing a price entry, or
deactivating one must each hide the product and raise an error — and checks that every selling model
type lands in the right summary bucket:

```bash
node tools/verify-export.mjs
```

## Deploying

The app is entirely client-side — no server, no database, no API calls. It builds to static files that
any host can serve. [`vercel.json`](vercel.json) is set up for Vercel.

**Straight from this folder**, no Git host needed:

```bash
npm i -g vercel
vercel login
vercel          # preview URL
vercel --prod   # production URL
```

**Or wire it to a repo** so every push redeploys — better for a shared tool:

```bash
git add -A
git commit -m "RCA product builder"
gh repo create rca-product-builder --private --source=. --push
```

Then import the repo at vercel.com. It picks up the Vite preset; no environment variables to set.

### Two things to know before sharing the link

**Everyone gets their own workspace.** State lives in each person's `localStorage`, so two people
opening the same URL do not see the same catalog and cannot edit one together. Sharing a catalog means
**Save as JSON** → send the file → **Load JSON**. Real collaboration would need a backend, which this
does not have.

**Nothing you type is transmitted.** Catalogs never leave the browser and the export is generated
client-side, so a public URL does not expose customer data — it only exposes the tool. That said,
check **Deployment Protection** in the Vercel project settings if you want the URL restricted to your
team; the options available depend on your plan.

Customer workbooks in [xlsx/](xlsx/) are gitignored so they are never pushed or bundled. Remove the
`xlsx/*` lines from [.gitignore](.gitignore) if you deliberately want one committed.

## Layout

```
src/App.tsx      hash router — homepage or a tool
src/Home.tsx     the landing page
src/ui/SiteShell.tsx  top bar + left nav, shared by every docs page
src/site.css     the docs design layer (see below)
src/data/tools.ts   registry the nav and the homepage render from (apps + skills)

src/ProductBuilder.tsx   the wizard shell
src/model/       types, store (zustand + localStorage), validation, visibility, pricing buckets
src/steps/       one component per wizard step
src/preview/     Browse Catalog and the product configurator
src/export/      workbook builder and API-name mapping
src/data/        sample catalog

.claude/skills/  the Claude Code skills
INSTALL.md       install guide, also rendered at #/install
tools/           install-skills.sh, xlsx dump, export verification
```

A second browser tool goes in its own file next to `ProductBuilder.tsx`, with a route added to
`APPS` and a branch in `App.tsx`.

### Two style sheets, on purpose

[`styles.css`](src/styles.css) dresses the Product Builder as Salesforce — SLDS-ish blues, rounded
cards, the Browse Catalog and configurator replicas. It has to keep looking like the org.

[`site.css`](src/site.css) is the documentation surface: homepage, skill reader, install guide. It
is a docs layout — sticky top bar, sticky left nav, one content column — with square corners, a
single accent (`#0176d3`, the same blue), and hierarchy carried by size and weight rather than
decoration. Everything in it is scoped under `.site`, so the two never argue.

If you add a page to the docs side, wrap it in
[`SiteShell`](src/ui/SiteShell.tsx) and it inherits the nav, which builds itself from `tools.ts`.
