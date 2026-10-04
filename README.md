# repo-library

A classification scheme for the knowledge in a software repository, written for AI agents and the people who work
with them.

A library classification lets a reader find a book in any library that uses it. repo-library does the same for
repositories: every repository that adopts it keeps each kind of knowledge in the same place, starts every document
with a cover that says when to read it, and generates a catalog that agents see in every session.

- [Specification](docs/specification.md): the rules and the reasoning behind them.
- [Adoption](docs/adoption.md): how to adopt repo-library in a repository, and how to upgrade.
- [`repo-library.mjs`](repo-library.mjs): generates the catalog from the covers and checks it. Its tests run with
  `node --test`.
