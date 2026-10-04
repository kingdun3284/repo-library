---
read-when: When adopting repo-library in a repository, or upgrading a repository to a newer edition.
---

# Adopting repo-library

## Adopt

1. Copy [`repo-library.mjs`](../repo-library.mjs) unchanged to `scripts/repo-library.mjs` in the repository, and
   exclude it from formatters and linters so the copy stays identical to its edition. It needs Node.js 20 or later and
   git, and no packages.
2. Give the root `AGENTS.md` the hand-written sections the specification expects, followed by the block markers:

   ```markdown
   # Agent instructions

   ## Language

   Documentation is written in English.

   ## Names

   | Use | Not |
   | --- | --- |

   <!-- repo-library:begin -->
   <!-- repo-library:end -->
   ```

3. Audit what the repository and its agents already know, and move each piece to its place as the
   [specification](specification.md#where-knowledge-lives) describes:
   - Delete history from documents. Rewrite a past event that still binds as a present-tense constraint with its reason.
   - Merge duplicated facts into the document that owns the subject, and link to it.
   - Split documents that mix subjects, and turn growing logs into collections.
   - Move rules that apply only inside one folder to that folder's `AGENTS.md`.
   - Move project rules held in agent memory into documents, and pending items held in documents or memory into
     issues; then remove them from memory.
   - Translate documents into the declared language.
4. Give every document under `docs/` and every `AGENTS.md` below the root a cover, except collection items.
5. Run `node scripts/repo-library.mjs write`, and make the merge gate run `node scripts/repo-library.mjs check`.

## Upgrade

Copy the newer `repo-library.mjs` over the old one and run `write`. Review the diff of the rules summary, and apply
any changed rule to the documents in the same change.
