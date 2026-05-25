# AIQ

AIQ is the TypeScript monorepo for the `@tjalve/aiq` code quality runner.

## Repository Workflow

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
pnpm run lint
pnpm test
pnpm run bench:ci
pnpm run test:publish-readiness
pnpm run test:smoke
```

Use `pnpm run build` before packaging so workspace packages have fresh `dist` output. Use `pnpm test` for the full Vitest suite, `pnpm run bench:ci` for the CI benchmark subset, and `pnpm run test:publish-readiness` for the packed npm UX gate.

## Workspace Packages

| Package | Purpose |
|---|---|
| `@tjalve/aiq` | Published CLI package |
| `@tjalve/aiq-engine` | Stage planning and runner execution |
| `@tjalve/aiq-config-schema` | Config, progress, and surface resolution |
| `@tjalve/aiq-model` | Shared contracts and IDs |
| `@tjalve/aiq-reporters` | Text and JSON output formatting |
| `@tjalve/aiq-benchmark` | Benchmark scenarios |
| `@tjalve/aiq-hook` | Hook adapter |
| `@tjalve/aiq-action` | GitHub Action adapter |
| `@tjalve/aiq-lsp` | LSP adapter |
| `@tjalve/aiq-mcp` | MCP adapter |
| `@tjalve/aiq-opencode` | OpenCode adapter |

## Package Checks

```bash
npm pack --workspace @tjalve/aiq --dry-run
node scripts/run-smoke-tests.mjs
```

`packages/cli/README.md` is the published npm README for `@tjalve/aiq`. Keep user-facing CLI onboarding there and keep this root README focused on contributor workflow. `pnpm run test:publish-readiness` packs and installs the workspace packages before checking the npm-facing CLI contract.

## Publishing

Push a `publish-*` tag from a commit reachable from `main` to start the npm staging workflow. The publish job uses npm Trusted Publishing with the `npm-publish` environment and stages packages for npm approval; it does not use an npm token.
