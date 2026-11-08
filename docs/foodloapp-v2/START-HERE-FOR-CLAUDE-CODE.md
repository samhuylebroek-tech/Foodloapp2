# Start here — Claude Code execution prompt

You are the lead engineer for Foodloapp V2. Read `CLAUDE.md` and `docs/foodloapp-v2/CLAUDE-CODE-HANDOFF.md` first. Then inspect the actual local workspace and the user's existing `foodloapp-v2-planning/` folder.

The owner explicitly wants the preparation completed so implementation can begin with minimal manual work. Do not ask the owner to repeat information already in the planning files. Do not make them run a long sequence of terminal commands.

## Non-negotiable safety
- Preserve all uncommitted local changes. Start with `git status --short --branch`; do not reset, clean, checkout over, stash or discard anything.
- Confirm current branch and remote. Do not work on `main`. Use `v2/claude-code-ready` as the handoff base and create a dedicated child branch for implementation only after confirming local changes are safe.
- Never push to main, deploy, run production migrations, rewrite Git history, or change Lovable production configuration.
- Never print or expose secret values.
- Database, RLS/permissions, credits/billing, and secret rotation are approval gates.

## Work in this order
1. **Workspace recovery:** locate the real Git clone and planning folder. If Claude Code opened the old ZIP export, switch to the actual clone without overwriting it. Report exact folder paths.
2. **Toolchain check:** check installed Node.js, npm, pnpm, package manager lockfile and project scripts. If Node is missing, give the owner one simple installation path (prefer a supported installer / guided UI); do not assume npm is installed.
3. **Planning reconciliation:** read all existing planning docs and the `phase-0-staging/` artifacts. Identify stale, duplicate or contradictory docs. Keep originals; produce one authoritative current plan.
4. **Source audit:** map routes, modules, database access, auth, group membership, permissions, RLS, migrations, integrations, email, AI credits, realtime subscriptions, i18n, tests and build scripts. Verify every historical audit claim against source.
5. **Baseline:** run available install/build/lint/test/typecheck commands only after confirming package manager and environment. Record actual output and blockers. Never claim a check passed if not run.
6. **Phase 0 readiness:** identify low-risk, reversible changes that can be implemented safely on the child branch. For each: scope, reason, files, acceptance criteria, tests, rollback. Do not apply old staged adapters or migrations without revalidation.
7. **Implementation:** start with isolated P0 code changes and tests only when they are clearly safe. Do not change production services or database state. If a task requires credentials, staging project access, or an owner decision, document exactly one specific blocker and continue with independent work.
8. **Handoff:** provide a concise status, changed files, tests actually run, unresolved blockers, and the single next action (if any) for the owner.

## Product north star
Deliver a premium, calm, mobile-first responsive cooking ecosystem. Keep the interface simple and accessible to both younger and older users. The core journey is recipe capture/import → organize/search → plan → combined shopping → pantry-aware choices → cook → feedback. Preserve existing functionality and data; do not do a big-bang rewrite.

Begin now with read-only inspection. Do not ask the owner questions until you have exhausted the information in the repository and planning folder.
