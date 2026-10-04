---
read-when: Before adding, rewriting, moving or deleting documentation, or deciding where a piece of project knowledge belongs, in a repository that follows repo-library; and before changing this specification.
---

# repo-library specification

repo-library organises the knowledge in a repository so that an agent finds what applies to its task, can trust what
it finds, and can skip what does not apply. A library classification works because every library that adopts it puts
the same kind of book in the same place and catalogues it the same way; this specification does that for repositories.

## The reader

Every rule follows from how an agent reads:

- It starts each session with no memory. Only the entry file is always loaded, so knowledge the entry file does not
  lead to is, for the agent, absent.
- It does not browse. It follows the catalog or searches literally, so every document needs a precise trigger and
  consistent wording.
- Everything it reads stays in its working context and competes for attention, so a document holds only what its
  reader needs.
- It cannot tell outdated text from current text unless the text says so, so documents hold only what is true now.

Human readers gain from the same properties.

## Where knowledge lives

| Place | Holds | Library equivalent |
| --- | --- | --- |
| Entry file: the root `AGENTS.md` | Loaded in every session: the documentation language, controlled names, the generated rules summary and catalog, and the few rules nearly every task needs | Reference desk |
| `docs/` | Current rules, procedures and reference that span folders, one subject per file | Open stacks |
| Collection: a folder under `docs/` with an `AGENTS.md` | A subject that grows item by item: one file per item, with the cover and the collection's rules in its `AGENTS.md` | Series shelf |
| Folder rules: an `AGENTS.md` in any other folder | Rules that apply only to work inside that folder | Notice on a reading-room door |
| Code, scripts, configuration, schemas and tests | Exact behaviour and commands. Documents link to them and never restate them | Primary sources |
| Git history | Every earlier state, the record of events, and why each change was made | Closed archive |
| Issue tracker | Pending work and open questions | Request register |
| Agent memory | Tips specific to one agent tool, and transient conversation state; never project rules | A librarian's private notebook |

A `README.md` may describe a folder to people browsing the repository host, but it holds no rule an agent needs.

## Writing documents

- **Present only.** A document describes what is true now. It records no history, earlier states or decision dates;
  git keeps them. When a past event still constrains the present, state the constraint in the present tense with a
  one-line reason.
- **One fact, one place.** Each fact lives in one document, and other documents link to it. A generated copy, such as
  the catalog, is not a duplicate, because the script keeps it identical.
- **One subject per document.** An agent reads a document in full, so a document covers one subject that a task needs
  as a whole. Split a document when tasks regularly need only part of it, and make a subject that grows by items a
  collection.
- **Reasons.** Give the reason for a non-obvious rule in one sentence next to the rule.
- **Executable sources.** Do not restate commands, configuration, schemas or code behaviour; link to the file that
  defines them.
- **Language.** The entry file declares one documentation language, and every document uses it. Identifiers,
  commands, paths and quoted interface text keep their original form.
- **Controlled names.** When something has several possible names, the entry file lists the name to use. Documents use
  only the listed names.

## Covers

Every document under `docs/` and every `AGENTS.md` below the root starts with a cover, except collection items:

```markdown
---
read-when: Before changing components, layout or styles in apps/web.
until: The new checkout flow replaces the old one in production.
---

# Title
```

- `read-when` (required) names the task that requires reading the document, phrased so an agent can match it against
  its own task. The catalog shows it.
- `until` (temporary documents only) names the condition that ends the document. When it holds, move what is still
  true into permanent documents and delete the document.
- A cover records nothing that git records: no dates, authors, versions, status or change log. A document has no table
  of contents; its headings are its contents.
- Values are single-line YAML strings. Quote a value that contains `: ` or ` #`, or that starts with punctuation, with
  double quotes.

An agent that opens a document reads its cover first and stops when `read-when` does not match its task. A search hit
is judged the same way: the cover of the file says whether the matched line applies.

## The catalog

The entry file contains a block between `<!-- repo-library:begin -->` and `<!-- repo-library:end -->`. The script
[`repo-library.mjs`](../repo-library.mjs) generates it from the covers: the rules summary of its edition, then one line
per covered document with its `read-when`, its path and, for a temporary document, its `until`. The script's `check`
command fails when a cover is missing or malformed or the block is out of date, and the repository's merge gate runs it.
The script checks only covers and the block; every other rule needs judgement.

The catalog stays in the entry file because an agent does not look for documents it does not know exist.

## Lifecycle

- Create a document when a subject has rules or reference that no document covers; give it a cover and regenerate the
  catalog.
- When the project owner states a rule, record it in the document that owns the subject, in the same change.
- Record work deferred out of a change, and questions waiting for a decision, as issues.
- Delete a document when nothing in it is current, or when its `until` holds.
- When a task shows that a `read-when` misled or failed to trigger, correct the cover in the same change.

## Editions

The script carries the edition number, and the generated block names it. A repository adopts an edition by copying
the script unchanged, and upgrades by copying a newer script and regenerating the block, so the diff of the rules
summary shows what changed. A major edition changes a rule, a minor edition adds one, and a patch edition changes
wording or fixes the script.
