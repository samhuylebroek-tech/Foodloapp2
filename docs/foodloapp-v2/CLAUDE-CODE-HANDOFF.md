# Foodloapp V2 — Claude Code handoff

Date prepared: 2026-11-08  
Repository: `samhuylebroek-tech/dinner-dialogue-hub`  
Default branch: `main`  
Prepared branch: `v2/claude-code-ready`

## Executive direction
Foodloapp is a connected cooking ecosystem, not just a recipe box. Deliver a premium consumer experience with a simple, mobile-first responsive web UI. The key loop is recipe capture/import → organize/search → meal planning → combined shopping list → pantry-aware choices → cooking mode → feedback/history. Existing features and customer data must be preserved.

No Figma. Do not start with a visual mockup-only phase. Audit the real app and then improve it directly in working code with tests and reviewable increments.

## Product decisions already established
- Keep V1/live untouched while V2 is developed in isolation.
- Retain the current stack and abstract Lovable-dependent services gradually; do not do a wholesale platform rewrite.
- Responsive web first; defer native-first rebuild.
- Preserve working supermarket integration; expansion is a business-development track.
- Validate pantry-loop usefulness cheaply before building a large engine.
- Static, professionally reviewed translations for core UI; AI only for dynamic recipe content when suitable.
- Defer subscription/pricing decisions until usage evidence exists.
- Unify permissions only after mapping real usage and adding a safe dual-read/write or staged migration plan.
- Reconcile schema drift and admin-owner trigger issues only after current schema and migrations are independently verified.

## Previously prepared planning material
The user reports a local `foodloapp-v2-planning/` folder containing:
- `00-executive-summary.md` through `14-env-security-audit.md`
- `10-foodloapp-v2-master-plan.md`
- `11-strategic-decisions.md`
- `12-phase-0-implementation-plan.md`
- `13-local-development-setup-guide.md`
- `14-env-security-audit.md`
- `phase-0-staging/` with draft tests, migration/rollback drafts, adapters, CI draft and analysis documents
- `15-github-repo-connection-guide.md`

Read the actual files if they exist in the user's workspace. Treat them as prior analysis, not unquestionable truth; verify findings against current source and database metadata. In particular, an earlier audit was corrected from 69 tables to 52 actual tables; the prior RESTRICTIVE policy count was corrected to 6 tables / 14 policies; the announcements migration exists in a separate Supabase CLI track, leaving two tables previously believed to lack migration history. Reconfirm all counts.

## Known risks requiring verification
1. Schema drift between live Supabase schema and repository migration history.
2. Authorization model uses two permission systems; mapping of `shares` and other permission dependencies is required before changes.
3. Realtime subscriptions and manually cleaned-up handlers may be shared across features; avoid route-by-route rewrites that drop shared behavior.
4. AI credit flow may charge credits even if a post-success step discards the result; reproduce and test before changing.
5. Loading states and i18n patterns are inconsistent.
6. Historical environment file was committed. Current known variable names were Supabase project ID, Supabase URL, Supabase publishable keys and public app/marketing URLs only; no service-role or mail/AI secret was identified in the current file. Do not expose values. Historical contents must be treated as potentially sensitive until independently verified.
7. Earlier staged `ai-gateway.adapter.ts` imported an unexported `admin` helper from credits server. Do not apply staged adapters blindly.
8. Actual email implementation was identified in `mail.server.ts` and `welkom-mail.functions.ts`; do not rely on earlier incorrect attribution.

## Repository safety and current branch state
- The GitHub repository is connected to Lovable. Commits pushed to the connected branch sync into Lovable. Never push to `main` or rewrite published history.
- This handoff branch is `v2/claude-code-ready`, created from `main`.
- On this branch, `.env` was removed from the branch tip and `.gitignore` was updated to ignore `.env`, `.env.*`, with `!.env.example` exception.
- This does NOT erase historical copies of `.env` from Git history. Do not force-push or rewrite history. Since the variable names previously inspected appear to contain only publishable/public configuration, assess risk carefully; do not rotate credentials without evidence of an exposed secret and explicit owner approval.
- The user's local checkout may have a separate branch `chore/secure-env-files` with an uncommitted staged deletion of `.env` and modified `.gitignore`. Do not discard, reset, stash or overwrite those local changes. Inspect `git status` first and coordinate carefully.
- User had difficulty installing Xcode Command Line Tools but successfully installed them; Git now works. npm was not found. Check Node/npm availability without asking user to paste secrets.

## Immediate execution request
The user wants the preparation completed so Claude Code can begin with minimal manual involvement. Begin by:
1. Inspecting local workspace and repository status without modifying or discarding user changes.
2. Locating and reading `foodloapp-v2-planning/` and all staged Phase 0 artifacts.
3. Verifying this branch and its changes, and ensuring no accidental edits to `main`.
4. Checking Node/npm/pnpm and lockfile. Recommend the smallest setup step if missing; do not ask for broad environment reinstall.
5. Establishing a baseline of build, lint, tests, routes, dependencies, Supabase migrations, RLS, auth, credits, mail and realtime subscriptions.
6. Resolving any documentation inconsistencies and producing a single current `V2-IMPLEMENTATION-PLAN.md`.
7. Preparing safe, reversible Phase 0 implementation tasks with tests and rollback notes.
8. Do not execute production migrations, change production permissions, deploy, or merge. Ask approval at those gates.

## Definition of ready for implementation
- Claude Code has opened the actual Git clone, not the old ZIP export.
- Existing local uncommitted work is preserved.
- The correct working branch is confirmed.
- Planning documents and staged artifacts are reconciled with current source.
- Environment files are excluded from new commits.
- Baseline checks and blockers are documented honestly.
- A task-by-task implementation plan has acceptance criteria, tests and rollback.
