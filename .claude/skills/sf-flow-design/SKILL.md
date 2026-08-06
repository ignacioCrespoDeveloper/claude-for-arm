---
name: sf-flow-design
description: Design a Salesforce Flow — pick the right flow type, define trigger and entry criteria, lay out elements with fault paths, and optionally generate the Flow metadata XML ready to deploy. Use when the user asks to build, design, review or fix a Flow, automation, record-triggered process, or screen flow.
---

# Salesforce Flow design

Two possible outputs, and you should confirm which before starting:

1. **A design spec** — trigger, criteria, element-by-element logic, fault handling, test
   cases. The developer builds it in Flow Builder.
2. **Deployable metadata** — the spec plus a `.flow-meta.xml` file. Only do this when there
   is a repo with `force-app/` or a connected org to deploy to; hand-written Flow XML is
   verbose and easy to get subtly wrong, so it must be validated (see step 6).

Default to the spec unless the user asks for the XML or the repo is clearly an SFDX project.

## 1. Pick the flow type

| Need | Type | Notes |
|------|------|-------|
| Update fields on the record being saved | **Record-triggered, before-save** | No DML, ~10× faster. Never use after-save for this. |
| Create/update *related* records, send email, call Apex | **Record-triggered, after-save** | |
| React to a delete | **Record-triggered, before-delete** | |
| Guided UI for a user | **Screen flow** | Surface it on a page, action, or Experience site |
| Run on a schedule over a set of records | **Scheduled-triggered** | Batches of 200; watch daily-interview limits |
| Called by other flows/Apex/REST | **Autolaunched (no trigger)** | Make it reusable, keep it single-purpose |
| React to a Platform Event | **Platform Event-triggered** | |

Then decide **run order** (`triggerOrder`, 1–2000) if the object already has other flows —
leave gaps of 10 so later flows can slot in.

## 2. Entry criteria do the filtering, not a Decision element

An entry condition that fails costs nothing. A Decision that fails still spun up an
interview. Push filtering as far up as it goes:

- Set the trigger to **"Only when a record is updated to meet the condition"** rather than
  re-checking prior values inside the flow.
- Use `$Record__Prior` for change detection, not a saved variable.
- Use a formula entry condition when the logic is more than a couple of ANDs.

Write the criteria out in plain language *and* as the actual field-level condition — the
gap between the two is where requirements get lost.

## 3. Element layout rules

- **No DML or Get Records inside a loop.** Ever. Build a collection variable inside the
  loop, then a single Update/Create after it. This is the single most common review
  rejection.
- **Get Records**: set the filter to return what you need, choose "First record" when you
  only want one, and select only the fields used — automatic field selection pulls
  everything and inflates heap.
- **Null-check every Get.** A Get that finds nothing returns null, and the next reference
  throws an unhandled error the user sees as a raw stack trace.
- **Assignment before Decision** — compute once, branch on the variable.
- **Subflows** for anything reused, and for anything past ~25 elements. A flow you cannot
  read on one screen is a flow nobody will maintain.
- **Fault paths** on every Create, Update, Delete, Get and Apex action. A fault path that
  goes nowhere is not fault handling: route it to a screen (screen flow) or to an error
  record / Platform Event / email (background flow), with `$Flow.FaultMessage` included.
- **Custom error** element (`Trigger.addError` equivalent) for before-save validation
  rather than a validation rule, when the message needs to be dynamic.

## 4. Naming and documentation

Because Flow is read by whoever is on call at 2am:

- Flow API name: `Object_Trigger_Purpose` — `Quote_AfterSave_Sync_Line_Totals`.
- Element labels are sentences: `Get open renewal opportunities`, not `Get_Records_1`.
- Description on the flow itself: what it does, what fires it, what it assumes.
- Variables: `varAccountId`, `colLinesToUpdate`, `recQuote` — a prefix that says the shape.

## 5. Write the design

```markdown
## Flow: <API_Name>

**Type** — <record-triggered, after-save> on `<Object>`
**Run order** — <n> (existing on this object: <list>)
**Purpose** — one sentence.

**Entry criteria**
Plain language, then: `Status__c = 'Approved' AND ISCHANGED(Status__c)`

**Variables**
| Name | Type | Collection | Input/Output | Purpose |

**Elements**
| # | Element | Type | Detail | Fault path |

**Fault handling** — where errors go and who sees them.

**Limits** — queries and DML per interview; behaviour at 200 records.

**Test cases** — positive, negative, bulk (200), each entry-criteria boundary,
and the recursion case if the flow updates its own object.
```

Include a mermaid `flowchart TD` of the branches. It is the fastest way for a reviewer to
spot a missing path.

## 6. If generating metadata XML

- Write to `force-app/main/default/flows/<API_Name>.flow-meta.xml`.
- Match the API version already used in the repo (`sfdx-project.json` / other flow files).
- Every `<connector>` must point at an element that exists; every element needs `<label>`,
  `<name>`, `<locationX>`, `<locationY>`.
- Set `<status>` to `Draft` unless the user asks for `Active`. Never deploy an untested
  flow as Active to a shared org.
- **Validate before claiming it works:**

```bash
sf project deploy start -d force-app/main/default/flows/<API_Name>.flow-meta.xml \
  --dry-run -o <alias>
```

  A dry-run failure means the XML is wrong — fix it, do not hand over unvalidated metadata.
  If no org is available, say plainly that the XML is unvalidated.

## 7. Reviewing an existing flow

When the ask is "why is this flow failing" or "review this flow", retrieve it first:

```bash
sf project retrieve start -m "Flow:<API_Name>" -o <alias>
```

Then check, in this order: DML/Get inside loops → missing null checks → missing fault paths
→ entry criteria that let too much through → recursion (flow updates the object that fires
it) → competing automation on the same object and its order → hardcoded ids.

Related: `/sf-ticket-solution` decides whether a Flow is even the right answer,
`/sf-tdd` documents it for approval.
