# AIQ Rewrite

AIQ is being rebuilt as a TypeScript monorepo with one reusable engine and thin adapters.

## What matters now

- Product direction lives in `docs/aiq-rewrite.md` and `docs/rewrite-plan.md`.
- Rewrite execution is tracked in `docs/rewrite-issues.md` and the GitHub issue queue for this repo.
- The current packages live under `packages/`.

## Rewrite principles

- one engine, many adapters
- file-manifest-first execution
- package-first distribution
- Node runtime baseline, Bun-friendly integrations
- canonical JSON artifacts under `.aiq/out/`

## Current packages

- `packages/engine` - engine contracts, manifest normalization, planning, artifact writing
- `packages/config-schema` - rewrite-era config types and defaults
- `packages/reporters` - JSON and TTY formatting for plans and run results
- `packages/cli` - new `aiq` CLI surface for `run`, `bench`, and `plan`

## Commands

```bash
npm install
npm run build
npm run bench
npm test
npm run test:smoke
npm run lint
npm exec --package ./packages/cli -- aiq -- --help
node packages/cli/dist/bin/aiq.js bench --tag ci --format json
npm exec --package ./packages/cli -- aiq -- run test-projects/typescript/src/index.ts --format text
npm exec --package ./packages/cli -- aiq -- plan test-projects/typescript/src/index.ts --format json
node packages/cli/dist/bin/aiq.js plan test-projects/typescript/src/index.ts --format json
```
