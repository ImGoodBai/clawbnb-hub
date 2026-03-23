# Contributing to WeClawBot-ex

Before changing code, read these documents in order:

1. `moltApp/docs/SYSTEM-OVERVIEW.md`
2. `moltApp/docs/standards/AI-EXECUTION-BASELINE.md`
3. `moltApp/docs/standards/OPENCLAW-PLUGIN-COLLABORATION-BASELINE.md`
4. `openclaw-main/docs/molthuman/README.md`
5. `openclaw-main/docs/molthuman/weclawbot-fork-governance.md`

## Working rules

1. Treat upstream-derived runtime/protocol files as frozen by default.
2. Do not perform repository-wide renames without an approved plan.
3. Keep new product and management-console logic in first-party files whenever possible.
4. Use controlled patch files only when the change cannot be implemented outside the upstream-derived layer.

## Typical safe areas

1. `src/service/`
2. README and installation docs
3. Repository metadata
4. New adapter files with clear boundaries

## Before opening a change

1. List the exact files you plan to touch.
2. State which files are frozen, which are controlled patch files, and why.
3. Record the verification steps and rollback point.

## Minimum verification

Run these in the repository before opening a PR:

1. `npm run test:unit`
2. `npm run test:smoke`
3. `npm run test:gate`
4. `npm run test:gate:full` when the branch also updates upstream-derived imports or packaging behavior

## References

1. Main collaboration baseline: `moltApp/docs/standards/OPENCLAW-PLUGIN-COLLABORATION-BASELINE.md`
2. Fork governance: `openclaw-main/docs/molthuman/weclawbot-fork-governance.md`
