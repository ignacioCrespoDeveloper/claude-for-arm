---
name: sf-context-mapping
description: Answer "how do I get this field from X to Y" in Salesforce Revenue Cloud — the correct Context Definition path, node, attribute and the two mappings per hop — or say plainly that Context Definitions are not needed for it, or that the flow is not possible. Use when the user asks to map a field between Quote, QuoteLineItem, Order, OrderItem, Asset or Contract, mentions context definitions, attributes, tags or entity mappings, asks why a mapped field arrives blank, or asks how to show a custom field in the Transaction Line Editor.
---

# Context Definition mappings — the right path, or the honest no

The question is always some form of *"I want the value of field A on object X to end up in
field B on object Y."* There are exactly three honest answers, and deciding which one
applies **is the skill**:

1. **A Context Definition mapping, with a specific path** — nodes, attribute, two mappings
   per hop, activation. Most cross-object flows in the transaction lifecycle.
2. **CD is the wrong tool** — a formula, a Flow, a report join or a data load does it
   cheaper. Say so and give that instead.
3. **Not possible as asked** — backwards flows, live sync after creation, incompatible
   types. Say so first, then offer the nearest thing that is possible.

Read `references/mapping-paths.md` before answering anything — it holds the verified flow
graph, the per-hop recipes, and the not-needed / not-possible tables. Do not answer from
memory: a wrong node name produces a mapping that saves cleanly and silently does nothing,
which costs more than no answer.

## Read-only: design the mapping, never build it in the org

**You do not modify the org.** Not the data, not the metadata, not a setting. You produce
the mapping plan; a person executes it.

Use freely — these only read:
`sf org list` · `sf org display` · `sf data query` · `sf sobject describe` ·
`sf sobject list` · `sf project retrieve start`

Never run: `sf data create/update/upsert/delete/import`, `sf project deploy start`
(including `--dry-run`, which still registers a deployment), `sf apex run`, or anything
that creates a context definition version, edits a mapping, or activates anything. This
matters more than usual here: **one bad mapping can block quote-to-order conversion
org-wide**, so the person applying it should be reading your plan with the org in front of
them — not discovering what an agent already changed.

The only exception is the user explicitly telling you, in the current message, to execute a
specific command against a named org. Never infer that instruction from context, from
earlier approval, or from the task seeming to call for it.

## 1. Establish the real question

Get these before designing — each one changes the answer:

- **Source field and target field**, with API names and data types. Type mismatch is a
  hard stop the org enforces at save.
- **When should the value travel?** Mappings fire at lifecycle operations — quote create,
  order create, asset create, asset update — not continuously. If the user expects the
  Asset to change when the Quote is edited *after* ordering, the answer is "not how this
  works" and it is better said now.
- **Who reads the value at the destination** — a human on a layout, the pricing engine, a
  report? If nothing in the engine or the lifecycle reads it, CD may be overkill (§2).
- **Header or line?** Quote→Order is the **Sales Transaction** node; QuoteLineItem→
  OrderItem is **Sales Transaction Item**. Picking the wrong node is the classic
  silent-blank failure.

Then check the org rather than assuming:

```bash
sf data query -o <alias> -q "SELECT Id,Name,DeveloperName FROM ContextDefinition"
sf sobject describe -o <alias> -s QuoteLineItem   # field exists? type?
sf sobject describe -o <alias> -s Asset
```

Also check whether the field is **already in the predefined standard mappings** — RLM ships
a set, and re-mapping one of those is wasted work at best.

## 2. Decide: is CD even the right tool?

Walk this ladder and stop at the first rung that satisfies the requirement. State the rung
you chose and the one you rejected.

| The requirement is really… | Then use | Not CD because |
|---|---|---|
| See the value in a report or list view | SOQL / report joins (`OrderItem.QuoteLineItemId` exists) | Nothing needs to be copied |
| Backfill records that already exist | A one-time data load (`/sf-data-deploy`) | Mappings only fire on future operations, never retroactively |
| Derive a value on the same object | Formula field or before-save Flow | No hop between objects at all |
| Copy for display only, after the fact | Record-triggered Flow on the target's create | Acceptable for display; **not** for anything the pricing engine or TLE reads |
| Feed a field into a pricing procedure or show it in the Transaction Line Editor | **CD** — attribute on the right node, mapped | The engine reads the context, not the record |
| Carry a value across a lifecycle hop (quote→order, order→asset) | **CD** — this is exactly what it is for | — |

The trap to name explicitly: a Flow that copies the field *after* the engine ran looks like
it works, until pricing or the TLE needs the value and reads the context instead of the
record. If the value participates in the transaction, it goes through the context.

## 3. Design the path

Every mapping is: **source field → context attribute → target field**. One hop = two
mappings on one attribute. A multi-hop request (QuoteLineItem → Asset) chains hops, each
fired by its own lifecycle operation:

```
QuoteLineItem ── order creation ──▶ OrderItem ── order activation ──▶ Asset
      hop 1: Sales Transaction Item          hop 2: asset creation mapping
```

The per-hop recipes, node names and the worked QLI→Asset example live in
`references/mapping-paths.md`. The rules that hold for every hop:

- **Extend, never edit.** The standard Sales Transaction Context is read-only; work in an
  extended definition. ⚠︎ Verify in the org which extended definition is already active —
  orgs should have exactly one, and creating a second is a finding, not a step.
- **One attribute per value**, on the node matching its level, with a unique tag and both
  **Input and Output enabled** — one toggle missing is the other classic silent blank.
- **Two mappings per hop**: source entity mapping (field → attribute), target entity
  mapping (attribute → field), both in the definition's **Map Data** tab.
- **Activate the definition version** at the end. An unactivated version is the RCA-wide
  "my change did nothing".

## 4. Write the plan

```markdown
## Map <Source.Field__c> → <Target.Field__c>

**Verdict** — CD mapping / CD not needed (use X) / not possible as asked (nearest: Y)
**Travels at** — <the lifecycle operation(s) that fire it>
**Does not** — <the expectation this plan will not meet, e.g. "re-sync after ordering">

**Path**
<source> ─ <operation> ▶ <intermediate> ─ <operation> ▶ <target>

**Per hop**
| # | Node | Attribute tag | Source mapping | Target mapping |

**Steps**
1. `Setup → Context Service → Context Definitions → <extended definition>` …
N. **Activate** the new version.

**Prerequisites** — fields exist, types match, extended definition identified.

**Verify**
- Quote → order → activate on a test record; value present at each hop.
- Negative: edit the quote field *after* order creation; confirm (and tell the user)
  the asset does not change.
- Sandbox first, always: a bad mapping can block conversion org-wide.

**Rollback** — deactivate the version; the previous one resumes.
```

## 5. Quality bar

- [ ] Verdict stated first — mapping, not-needed, or not-possible. Never a menu.
- [ ] Both field types confirmed against the org, or marked `(unverified)`.
- [ ] Node named per hop, and header-vs-line justified in one line.
- [ ] Input/Output toggles and activation are explicit numbered steps.
- [ ] The plan says when the value travels **and when it does not** — the after-the-fact
      edit expectation is addressed, not left to be discovered in UAT.
- [ ] Anything ⚠︎ in the reference that ended up in the plan was checked in the org first.

Related: `/sf-ticket-solution` when this arrived as a ticket and needs the Jira write-up,
`/sf-pricing-procedure` when the attribute feeds a pricing element, `/sf-flow-design` when
the honest answer was a Flow.
