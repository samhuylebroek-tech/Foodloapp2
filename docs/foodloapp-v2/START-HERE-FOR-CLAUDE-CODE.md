# Start here — Claude Code execution prompt

You are the lead product-minded engineer for Foodloapp V2. Read `CLAUDE.md` and `docs/foodloapp-v2/CLAUDE-CODE-HANDOFF.md` first. Inspect the actual local workspace and the user's existing `foodloapp-v2-planning/` folder.

The owner wants an exceptional, accessible, commercially scalable product and minimal technical involvement. Do not ask them to repeat information already in the planning files.

## Product north star — non-negotiable
Create one coherent cooking ecosystem that:
- A 70-year-old beginner can use confidently without technical help.
- A 20-year-old food influencer finds beautiful, fast, expressive and powerful.
- Has premium mobile-first responsive UX, plain language, readable typography, strong contrast, large touch targets, predictable navigation and WCAG 2.2 AA as a target.
- Makes recipe capture/import → organize/search → meal planning → shopping → pantry-aware choices → cooking → feedback feel like one effortless journey.
- Preserves existing functionality and customer data.

## Commercial north star
Design the domain and architecture now for food creators to build an audience and offer free and paid subscriber-only recipes, collections, meal plans, cooking videos/classes and community benefits. Think creator subscriptions/memberships, transparent pricing, access entitlements, platform commission, creator revenue share, refunds, churn, payouts/KYC, VAT/tax, fraud and consumer rights. This is a food-focused membership concept, not a copy of another platform.

Card payments are a future milestone, not a Phase 0 launch. Prepare a provider-neutral payment adapter and evaluate PCI-compliant hosted checkout options for Belgium/EU, recurring subscriptions and creator payouts. Never store raw card data. Do not activate live payments without explicit owner approval and legal/tax/security review.

Make scalability affordable: measure unit costs per active user, creator, AI action and media asset; minimize unnecessary AI calls; cache and deduplicate; use efficient queries, pagination, async jobs, quotas, rate limits, budget alerts and graceful degradation. Avoid overbuilding infrastructure before demand exists.

## Safety boundaries
- Preserve all uncommitted local changes. Start with `git status --short --branch`; do not reset, clean, checkout over, stash or discard anything.
- Confirm branch and remote. Do not work on `main`. Use `v2/claude-code-ready` as handoff base and create a dedicated child branch only after confirming local changes are safe.
- Never push to main, deploy, run production migrations, rewrite Git history, or change Lovable production configuration.
- Never print or expose secret values.
- Database, RLS/permissions, credits/billing, secret rotation and payment activation are approval gates.

## Work in this order
1. **Workspace recovery:** locate the real Git clone and planning folder. Do not overwrite the old ZIP export or any local work.
2. **Toolchain check:** check Node.js, npm, pnpm, lockfile and scripts. If Node is missing, offer one simple installation path.
3. **Planning reconciliation:** read all existing planning docs and `phase-0-staging/`; keep originals and produce one authoritative current plan.
4. **Source audit:** map routes, modules, data access, auth, permissions, RLS, migrations, integrations, email, AI credits, realtime, i18n, tests and CI. Verify prior claims.
5. **Baseline:** run available install/build/lint/test/typecheck commands after confirming package manager and environment. Record exact output; do not claim unrun checks passed.
6. **Quality plan:** define acceptance criteria for both beginner and creator personas; include accessibility, responsive, security, data integrity, performance, resilience and cost.
7. **10-pass verification:** for each meaningful feature/change, plan and run at least 10 distinct relevant checks (unit, integration, E2E, accessibility, responsive/device, security/authorization, data integrity/rollback in staging, error/offline/recovery, performance/load, cost/AI/observability/regression). Ten identical reruns do not count. Keep a bug register; reproduce, prioritize, fix and retest all confirmed bugs. Never promise zero bugs; disclose residual risks.
8. **Phase 0 implementation:** begin with safe, reversible code changes and tests on a child branch. Do not apply old staged adapters/migrations blindly.
9. **Handoff:** report changes, actual test results, unresolved blockers and only the specific owner action that is genuinely unavoidable.

Do not activate subscriptions, collect payments, run production migrations, change production permissions, deploy or merge. Continue independent safe work while documenting approval gates. Begin now with read-only inspection; do not ask the owner questions until repository and planning evidence is exhausted.
