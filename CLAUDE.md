# Claude Code instructions — Foodloapp

## Mission
Prepare and deliver Foodloapp V2 as a premium, reliable, accessible cooking ecosystem. Treat the existing product as a functioning live service: preserve working features and data; improve incrementally and verify every change.

## Mandatory safety boundaries
- Never push to `main`, deploy, run production migrations, alter production secrets, or change Lovable production settings.
- Work only on a dedicated feature branch. The prepared handoff branch is `v2/claude-code-ready`; create your own child branch from it before implementation.
- Do not rewrite published Git history or force-push. The repository is connected to Lovable; published commits may sync to the Lovable project.
- Never print, log, paste, or commit environment variable values. Never ask the user to paste secrets into chat.
- Treat `.env` as local-only. `.env` and `.env.*` are ignored; `.env.example` may contain names and safe placeholders only.
- Do not run database migrations against production. Use a separate staging Supabase project and a verified backup before any migration rehearsal.
- Do not make security-sensitive authorization/RLS changes without tests, a documented rollback, and explicit user approval.
- Avoid destructive data changes and broad rewrites. Preserve existing behavior unless a change is proven safe.

## Required workflow
1. Read `docs/foodloapp-v2/CLAUDE-CODE-HANDOFF.md` and the user's existing `foodloapp-v2-planning/` documents if present in the workspace.
2. Inspect repository status, branches, package manager lockfiles, scripts, source structure, Supabase migrations, RLS policies, auth, permissions, integrations, tests and CI. Do not assume prior audit numbers without re-verifying them.
3. Start with a read-only baseline: build/lint/test status where available, schema/migration drift, security review and dependency map. Record exact commands and results.
4. Produce a concise execution plan with dependencies, risks, acceptance criteria and rollback for each task.
5. Implement only reversible, isolated Phase 0 fixes on a feature branch. Add tests. Do not deploy.
6. Run all available checks and report failures honestly. Never claim tests passed if they were not run.
7. Present a review summary and wait for explicit approval before any database migration, permission/RLS change, secret rotation, merge to main or deployment.

## Product principles
- Mobile-first responsive web; native-first rebuild is deferred.
- Keep user-facing complexity low; prioritize accessibility for older and less technical users.
- Core loop: capture/import recipe → find/organize → plan → shopping list → pantry-aware decisions → cook → rate/annotate.
- AI assists; it never silently overwrites user data. AI-extracted data must be reviewable.
- Preserve current supermarket integration behavior; make future providers modular.
- Core UI translations should be static and professionally reviewed; use AI only for dynamic recipe content where appropriate.

## Engineering expectations
- Follow existing conventions and architecture; do not introduce a new framework without a written case.
- Check group/household isolation server-side and in database policies.
- Treat authentication, authorization, RLS, credits/billing and personal data as high risk.
- Include loading, empty, error, offline and accessibility states for user-facing changes.
- Keep changes small, reviewable and testable. Document assumptions and deferred work.
