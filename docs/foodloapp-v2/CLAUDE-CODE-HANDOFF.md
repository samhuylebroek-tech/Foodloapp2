# Foodloapp V2 — Claude Code handoff

Date prepared: 2026-11-08  
Repository: `samhuylebroek-tech/dinner-dialogue-hub`  
Default branch: `main`  
Prepared branch: `v2/claude-code-ready`

## Product ambition and quality bar
Build a category-leading, commercially viable cooking ecosystem. It must be effortless for a 70-year-old who is not technically confident and exciting, expressive and powerful for a 20-year-old food influencer. One coherent product should adapt its depth to the user's needs without overwhelming beginners.

### Experience principles
- Accessible by default: WCAG 2.2 AA target, readable typography, high contrast, generous touch targets, clear labels, plain language, predictable navigation, keyboard and screen-reader support, forgiving forms and recovery/undo for mistakes.
- Premium but clear: warm, modern, content-rich visual design; excellent mobile-first responsive behavior; fast interactions; minimal friction.
- Test the whole user journey, not just isolated screens. Include beginner usability and creator workflow usability in research and acceptance criteria.
- Keep core tasks obvious: save a recipe, find it again, plan meals, build a shopping list and cook from it.

### Creator economy and monetization (architecture now, launch later)
Foodloapp should explore a food-focused creator membership model. Creators may offer free public content and paid subscriber-only content such as exclusive recipes, collections, meal plans, cooking videos/classes and community benefits. Users may subscribe to individual creators, with transparent pricing and clear cancellation. This is a strategic product hypothesis to validate, not a final pricing decision.

Prepare the architecture for:
- Creator profiles, audience/follow relationships and creator publishing tools.
- Public, follower-only and paid/subscriber-only content visibility.
- Subscription products, entitlements, access checks and subscription lifecycle states.
- Platform commission and creator revenue share, refunds, cancellations, failed payments, chargebacks and payout reconciliation.
- Creator identity verification/KYC and payout provider constraints.
- Tax/VAT, consumer rights, privacy, content moderation and fraud controls for relevant launch markets.
- Analytics for creator conversion, retention, churn, gross merchandise value, net revenue and creator earnings.

Do not activate paid subscriptions or collect money in Phase 0. Avoid premature overengineering: document the domain model and provider seams, validate demand, and implement in staged milestones.

### Card payments (future-ready)
Design for card payments using a reputable PCI-compliant provider and hosted checkout/payment elements. Foodloapp must never store or log raw card numbers or CVC. Provider selection must consider Belgium/EU availability, marketplace/connected-account payouts, recurring billing, fees, VAT/tax support, refunds, chargebacks, KYC and developer experience. Compare realistic providers (for example Stripe Connect and alternatives) before recommending one. Keep payment-provider-specific code behind an adapter and use verified webhooks, idempotency keys and auditable transaction states. Real payment activation requires explicit owner approval and legal/tax/security review.

### Cost-efficient scale and unit economics
Build a cost model for database/storage/egress, image and video processing, AI inference, email, background jobs, observability and payment fees. Prefer efficient queries, indexes, pagination, caching, deduplication, async jobs, rate limits, quotas, budget alerts and graceful degradation. Use AI only where it creates clear user value; select the least expensive model/tool that meets quality needs, cache deterministic outputs and prevent duplicate charges. Track cost per active user, recipe import, AI action, creator and paying subscriber. Avoid expensive infrastructure before demand justifies it.

## Executive direction
Foodloapp is a connected cooking ecosystem, not just a recipe box. The key loop is recipe capture/import → organize/search → meal planning → combined shopping list → pantry-aware choices → cooking mode → feedback/history. Existing features and customer data must be preserved.

No Figma. Do not start with a visual mockup-only phase. Audit the real app and then improve it directly in working code with tests and reviewable increments.

## Product decisions already established
- Keep V1/live untouched while V2 is developed in isolation.
- Retain the current stack and abstract Lovable-dependent services gradually; do not do a wholesale platform rewrite.
- Responsive web first; defer native-first rebuild.
- Preserve working supermarket integration; expansion is a business-development track.
- Validate pantry-loop usefulness cheaply before building a large engine.
- Static, professionally reviewed translations for core UI; AI only for dynamic recipe content when suitable.
- Defer final subscription pricing and real-money activation until demand, legal/tax and unit economics are validated; design creator entitlements and payment seams from the beginning.
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

Read the actual files if they exist in the user's workspace. Treat them as prior analysis, not unquestionable truth; verify findings against current source and database metadata. Reconfirm schema/policy/migration counts.

## Known risks requiring verification
1. Schema drift between live Supabase schema and repository migration history.
2. Authorization model uses two permission systems; map `shares` and other permission dependencies before changes.
3. Realtime subscriptions and manual cleanup handlers may be shared across features; avoid rewrites that drop shared behavior.
4. AI credit flow may charge credits even if a post-success step discards the result; reproduce and test before changing.
5. Loading states and i18n patterns are inconsistent.
6. Historical environment file was committed. Current known variable names appeared to be Supabase project ID, URL, publishable keys and public app/marketing URLs only; no service-role or mail/AI secret was identified in the current file. Historical contents remain unverified. Never expose values or rotate credentials without evidence and owner approval.
7. Earlier staged `ai-gateway.adapter.ts` imported an unexported `admin` helper from credits server. Do not apply staged adapters blindly.
8. Actual email implementation was identified in `mail.server.ts` and `welkom-mail.functions.ts`; verify against current source.

## Repository safety and current branch state
- GitHub repository is connected to Lovable. Commits pushed to the connected branch may sync into Lovable. Never push to `main` or rewrite published history.
- Handoff branch `v2/claude-code-ready` was created from `main`.
- On this branch, `.env` was removed from the branch tip and `.gitignore` ignores `.env`, `.env.*`, with `!.env.example` exception.
- This does NOT erase historical copies of `.env` from Git history. Do not rewrite history.
- The user's local checkout may have a separate branch `chore/secure-env-files` with an uncommitted staged deletion of `.env` and modified `.gitignore`. Do not discard, reset, stash or overwrite those local changes. Inspect `git status` first.
- Git works locally; npm was not found at last check. Verify current Node/npm/pnpm availability without asking the user to paste secrets.

## Immediate execution request
The user wants the preparation completed so Claude Code can begin with minimal manual involvement. Begin by:
1. Inspecting local workspace and repository status without modifying or discarding user changes.
2. Locating and reading `foodloapp-v2-planning/` and all staged Phase 0 artifacts.
3. Verifying branch and changes; ensure no accidental edits to `main`.
4. Checking Node/npm/pnpm and lockfile. Recommend the smallest setup step if missing.
5. Establishing baseline build, lint, tests, routes, dependencies, Supabase migrations, RLS, auth, credits, mail and realtime subscriptions.
6. Reconciling docs into one authoritative `V2-IMPLEMENTATION-PLAN.md`.
7. Adding accessibility, beginner usability, creator economy, payments readiness, unit economics and cost controls to the plan and acceptance criteria.
8. Preparing safe, reversible Phase 0 tasks with tests and rollback notes.
9. Do not execute production migrations, change production permissions, deploy, activate payments or merge. Ask approval at those gates.

## Testing standard
For each significant feature/change, define at least 10 distinct, relevant verification passes, not ten identical reruns. Build a test matrix covering as applicable:
1. Unit and component behavior.
2. Integration and API contracts.
3. End-to-end critical user journey.
4. Accessibility (automated plus manual keyboard/screen-reader checks).
5. Responsive layouts and touch targets across representative devices.
6. Authentication, authorization, household isolation and abuse cases.
7. Data integrity, migrations and rollback in isolated staging only.
8. Error, loading, empty, offline and recovery states.
9. Performance, load and resource usage.
10. Cost, AI usage, quotas, observability and regression.
Include creator/subscriber entitlements and payment webhooks in later milestone tests. Maintain a bug register. Reproduce and fix confirmed bugs; rerun relevant suites. Never promise literally zero bugs. No known critical/high issue may be called done without resolution or explicitly approved mitigation. Report test coverage and residual risks honestly.

## Definition of ready
- Claude Code opened the actual Git clone, not the ZIP export.
- Existing local uncommitted work is preserved.
- Correct working branch is confirmed.
- Planning documents reconciled with source.
- Environment files excluded from new commits.
- Baseline checks and blockers documented.
- Task-by-task plan has acceptance criteria, 10-pass verification strategy, cost impact and rollback.
