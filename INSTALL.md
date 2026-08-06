# Installing the skills in your own Salesforce project

Ten minutes, most of it the first real test. You need [Claude Code](https://claude.com/claude-code)
and, ideally, a Salesforce org you can connect — the skills are markedly better with one.

---

## 1. Choose where they live

| | Use when | Updates |
|---|---|---|
| **Symlink into the project** ← *start here* | You are testing, and will tune the skills as you go | Edit in this repo, the change is live everywhere immediately |
| **Copy into the project** | Sharing with a team through that repo — everyone who clones gets them | Re-run the installer to update |
| **Copy globally** (`~/.claude/skills`) | You want them in every project, including ones you cannot commit to | Re-run the installer to update |

Project-level skills win over global ones with the same name, so you can install globally
and still override one per project.

## 2. Install

From a clone of this repo:

```bash
git clone <this-repo> rca-toolkit && cd rca-toolkit

# Recommended while testing — edits here are picked up by your project immediately
tools/install-skills.sh ~/code/my-sf-project --link

# Or a plain copy, to commit them into that repo
tools/install-skills.sh ~/code/my-sf-project

# Or everywhere on this machine
tools/install-skills.sh --global

# A subset
tools/install-skills.sh ~/code/my-sf-project --only sf-ticket-solution,sf-data-deploy
```

Existing skills of the same name are left alone; pass `--force` to replace them.
`tools/install-skills.sh --help` lists everything.

Manual equivalent, if you would rather see exactly what happens:

```bash
mkdir -p ~/code/my-sf-project/.claude/skills
cp -R .claude/skills/* ~/code/my-sf-project/.claude/skills/
```

## 3. Connect an org

Skip this and every skill degrades to generic advice with `(unverified)` on each API name —
which is the honest behaviour, but not the useful one.

```bash
cd ~/code/my-sf-project
sf org login web -a mysandbox      # or: sf org login web -a dev --instance-url https://test.salesforce.com
sf org list                        # confirm the alias is there
```

Tell Claude which alias to use the first time you run a skill: *"use the `mysandbox` org"*.
Better still, put it in the project's `CLAUDE.md` so you never say it again:

```markdown
# CLAUDE.md
Default Salesforce org alias: `mysandbox` (RCA sandbox, refreshed monthly).
Production alias `prod` — never write to it without asking.
```

## 4. Verify they loaded

**Open a new Claude Code session in that project** — skills are discovered at session start,
so a session that was already running will not see them.

```bash
cd ~/code/my-sf-project
claude
```

Type `/` and look for `sf-ticket-solution`, `sf-tdd`, `sf-flow-design`, `sf-data-deploy`.
If they are missing, jump to [Troubleshooting](#troubleshooting).

## 5. Test them for real

Run these in order. The first is the one to judge the toolkit on.

### `/sf-ticket-solution` — the main event

Paste a real ticket, or start with a symptom you already know the answer to, so you can
judge the output:

```
/sf-ticket-solution

Reps say the "Premium Support" product doesn't show up in Browse Catalog
when they build a quote, but it loaded fine last week. Sandbox: mysandbox.
```

**Good looks like:** it names the subsystem (catalog/discovery), runs SOQL against your org
to check the five visibility conditions one by one, tells you which one failed, and hands
back a Jira ticket in a single copyable block with numbered steps — including the decision
table refresh.

**Not good:** generic Salesforce advice, API names it never checked, or a wall of options
instead of a decision. If you get that, see [Troubleshooting](#the-output-is-generic).

Then try one that needs judgment rather than diagnosis:

```
/sf-ticket-solution

We need "Enterprise Support" to only be sellable to accounts in EMEA.
Currently every rep can add it.
```

Expect a qualification/disqualification design, the rejected alternative stated, and a
fail-closed acceptance criterion for accounts with no region.

### `/sf-data-deploy`

```
/sf-data-deploy

I need to move the product catalog from mysandbox into the new dev org `mydev`.
```

**Good looks like:** the 16-object RCA load order, external-ID upserts, a sample dry run
before full volume, and the post-load decision table refresh. It should confirm the target
alias with you before any write, and refuse to write to production without you saying so.

### `/sf-flow-design`

```
/sf-flow-design

Review the Quote_AfterSave_Sync_Totals flow — it fails on bulk loads.
```

**Good looks like:** it retrieves the flow, then checks DML/Get inside loops, null checks,
fault paths and competing automation, in that order.

### `/sf-tdd`

```
/sf-tdd

Write the TDD for the EMEA restriction we designed above.
```

**Good looks like:** the full template filled in, a design-decisions table where each row
names its rejected alternative, and assumptions marked `(assumed)` rather than asserted.

## 6. Reduce the permission prompts

The skills read your org constantly, so allow the read-only commands once. In the project,
`.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(sf org list)",
      "Bash(sf org display *)",
      "Bash(sf data query *)",
      "Bash(sf sobject describe *)",
      "Bash(sf sobject list *)",
      "Bash(sf project retrieve start *)"
    ]
  }
}
```

Deliberately **not** in that list: `sf data upsert`, `sf data delete`, `sf project deploy
start`. Anything that writes should keep asking.

## 7. Make them yours

The skills are markdown. That is the whole point — when one keeps getting something wrong
for your org, fix it once:

- Your org's naming conventions → add them to the relevant `SKILL.md`.
- A name in `references/rca-domain-map.md` marked ⚠︎ that turns out different in your
  release → correct it, and drop the marker.
- Recurring review feedback → add it to that skill's final checklist.
- Project-wide context (org aliases, sandbox names, house rules) belongs in the project's
  `CLAUDE.md`, not in a skill.

If you installed with `--link`, edits in this repo take effect in your SF project
immediately. If you copied, re-run the installer with `--force`.

---

## Troubleshooting

### The skills do not appear under `/`

1. Confirm the path — they must be at `<project>/.claude/skills/<name>/SKILL.md`, one
   folder per skill. A flat `.claude/skills/sf-tdd.md` will not be found.
2. Start a **new** session. Discovery happens at startup.
3. Check the frontmatter survived the copy — `head -4 .claude/skills/sf-tdd/SKILL.md`
   should show `---`, `name:`, `description:`, `---`.
4. With `--link`, confirm the symlink target still exists: `ls -l .claude/skills/`.

### The skill does not fire when I describe the task

Type the command explicitly (`/sf-ticket-solution`). If you want it to fire on its own more
often, widen the `description:` in its frontmatter with the words your team actually uses —
that field is what Claude matches against.

### The output is generic

Almost always one of:

- **No org connected.** Check `sf org list`. Without it the skill cannot verify anything and
  says so; it will not invent details.
- **The ticket lacked specifics.** Give it the product code, the account, the sandbox alias.
- **It never read its references.** For `/sf-ticket-solution`, the `references/` folder must
  have come along — `ls .claude/skills/sf-ticket-solution/references/` should list four
  files. A copy that missed them produces exactly this symptom.

### It named an object that does not exist in my org

Two possible causes, both worth knowing: your org is on a release that does not have it, or
the name shifted. Ask it to verify against your org, then **correct the reference file** so
it never happens again. Names in the domain map marked ⚠︎ are the ones most likely to drift.

### Uninstall

```bash
rm -rf ~/code/my-sf-project/.claude/skills/sf-*
```
