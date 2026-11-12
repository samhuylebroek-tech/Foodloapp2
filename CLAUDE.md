# Claude Code instructions — Foodloapp

## Snel starten (lees dit eerst)
- **Installeren:** `npm install` (of `bun install --frozen-lockfile`; `bun.lock` is leidend, voeg geen `package-lock.json` toe).
- **App bekijken met verzonnen gegevens:** `npm run demo` → http://127.0.0.1:4319, aanmelden met `demo@foodlo.be` / `demo1234`. Gebruikt een nep-databank (`tests/e2e/fake-supabase.mjs`); nooit productie.
- `npm run dev` start alleen de app en heeft een `.env` nodig (namen in `.env.example`). Gebruik in de cloud altijd `npm run demo`.
- **Controleren:** `npm run typecheck`, `npm test` (unit), `npx playwright test --project=<telefoon|desktop|mobiel-360|mobiel-390|tablet-768>` (E2E tegen de nep-databank), `npm run schermen` (visuele rondgang), `node scripts/lint-ratchet.mjs origin/main`.
- **Structuur:**
  - `src/routes` (schermen, TanStack Start);
  - `src/components`;
  - `src/lib` (logica; `src/lib/intelligentie` = voorstellen, `src/lib/veiligheid.ts` = allergie- en dieetregels);
  - `supabase/migrations` (schema; voorstellen in `docs/foodloapp-v2`);
  - `tests/e2e` (Playwright);
  - `tests/rls` (databankregels met PGlite);
  - `docs/foodloapp-v2` (plannen, bugregister, beslissingen).
- **Afspraken:**
  - geen productiegegevens of echte sleutels;
  - geen migraties naar productie of staging zonder akkoord van de eigenaar;
  - niets wijzigen aan Lovable, aan `main` of aan de oorspronkelijke repository `samhuylebroek-tech/dinner-dialogue-hub`;
  - werk op `v2/dev` of een `v2/<onderwerp>`-branch;
  - nooit force-pushen.

## Mission
Build Foodloapp into an exceptional, commercially sustainable cooking ecosystem: instantly understandable to a 70-year-old beginner and delightful, expressive and powerful for a 20-year-old food creator. Preserve the functioning live product, its useful features and customer data; improve incrementally and verify every change.

## Non-negotiable safety boundaries
- Never push to `main`, deploy, run production migrations, alter production secrets, or change Lovable production settings.
- Work only on a dedicated feature branch. The V2 integration branch is `v2/dev` (it contains `v2/claude-code-ready`). In cloud sessions, create a child branch `v2/<onderwerp>` from `v2/dev` and open a pull request into `v2/dev`, never into `main`.
- Do not rewrite published Git history or force-push. The repository is connected to Lovable; published commits may sync to the Lovable project.
- Never print, log, paste, or commit environment variable values. Never ask the user to paste secrets into chat.
- Treat `.env` as local-only. `.env` and `.env.*` are ignored; `.env.example` may contain names and safe placeholders only.
- Do not run database migrations against production. Use a separate staging Supabase project and a verified backup before any migration rehearsal.
- Do not make security-sensitive authorization/RLS changes without tests, a documented rollback, and explicit user approval.
- Avoid destructive data changes and broad rewrites. Preserve existing behavior unless a change is proven safe.

## Product quality bar — applies to every decision
- Dual-audience design: effortless for a 70-year-old novice, inspiring and efficient for a 20-year-old food influencer. One coherent product, not two disconnected apps.
- Accessibility is core product quality: readable type, strong contrast, large touch targets, plain language, predictable navigation, forgiving forms, clear confirmations, undo/recovery where possible, keyboard/screen-reader support and WCAG 2.2 AA as the target.
- Premium visual craft without sacrificing clarity: responsive/mobile-first, fast, calm, warm, modern, content-led, polished interaction details.
- Every core journey must be tested end-to-end: sign-up/login, recipe import/capture, edit/save, search/organize, meal planning, shopping list, pantry, cooking mode, collaboration/sharing, creator discovery/following and (when implemented) subscriptions/payments.
- AI must be useful, cost-aware, observable and controllable. Never silently overwrite user data. Cache/reuse results where safe, use the smallest adequate model, rate-limit, meter usage and provide non-AI fallbacks.
- Commercial model must be designed into the architecture now, while paid checkout can be deferred: creator profiles, public/private content, free/paid tiers, subscription entitlements, access control, creator revenue share, platform fees, refunds/cancellations, taxes/VAT, payout/KYC provider requirements, fraud/chargebacks and analytics. Do not hard-code a single payment provider or launch paid flows before legal, tax, security and product review.
- Explore a creator subscription model inspired by membership platforms: fans can subscribe to individual food creators for exclusive recipes, meal plans, collections, videos/classes or community benefits. Keep it food-focused, safe, transparent and compliant; do not copy another platform's branding or assume the business model is validated.
- Design payment readiness for card payments through a reputable PCI-compliant provider (e.g. hosted checkout/payment elements); never store raw card details. Choose provider after geography, fees, marketplace/payout and tax requirements are evaluated.
- Commercial scalability: measure unit economics per active user, creator, AI action, storage, image/video processing, email and database operation. Prefer modular services, efficient queries, caching, asynchronous jobs, quotas, observability and graceful degradation. Avoid expensive always-on AI and unnecessary infrastructure.

## Required workflow
1. Read `docs/foodloapp-v2/CLAUDE-CODE-HANDOFF.md`, `docs/foodloapp-v2/START-HERE-FOR-CLAUDE-CODE.md` and all available planning documents.
2. Inspect repository status, branches, lockfiles, scripts, source, migrations, RLS, auth, permissions, integrations, tests and CI. Re-verify prior audit findings.
3. Establish a read-only baseline and record exact commands/results before edits.
4. Create a risk-ranked execution plan with dependencies, acceptance criteria, tests, cost implications and rollback for every task.
5. Implement small, reversible changes on a feature branch. Add automated tests and run them. Do not deploy.
6. For every meaningful change, perform at least 10 distinct verification passes across relevant layers (unit, integration, end-to-end, accessibility, responsive, security/authorization, data integrity, error/loading/offline states, performance/cost and regression as applicable). Ten repeated identical runs do not count as ten passes. Report what was actually tested; never promise zero bugs or claim unrun tests passed.
7. Maintain a living bug register. Reproduce, prioritize, fix and retest each confirmed bug. No known critical/high-severity issue may be marked complete without resolution or an explicitly approved mitigation. State residual risk honestly.
8. Wait for explicit approval before production migrations, permission/RLS changes, secret rotation, merge to main, payment activation or deployment.

## Product principles
- Mobile-first responsive web; native-first rebuild is deferred.
- Core loop: capture/import recipe → find/organize → plan → shopping list → pantry-aware decisions → cook → rate/annotate.
- AI assists; it never silently overwrites user data. AI-extracted data must be reviewable.
- Preserve current supermarket integration behavior; make future providers modular.
- Core UI translations should be static and professionally reviewed; use AI only for dynamic recipe content where appropriate.
- Design creator monetization and payment-provider abstraction now; defer charging real customers until approved.

## Engineering expectations
- Follow existing conventions and architecture; do not introduce a new framework without a written case.
- Check group/household isolation server-side and in database policies.
- Treat authentication, authorization, RLS, credits/billing, creator entitlements and personal data as high risk.
- Include loading, empty, error, offline and accessibility states for user-facing changes.
- Keep changes small, reviewable and testable. Document assumptions and deferred work.

## Visual-first workflow (cloud and desktop)
The owner judges progress by the real screens, not by reports. For every user-facing change:
1. Before editing, run `npm run schermen` and keep a copy of `docs/foodloapp-v2/schermen/actueel/` as "voor" (outside the repo or in the PR's first commit).
2. Make the change. Look at the screenshots yourself (read the JPGs) at 390 px in the light theme and in "Extra duidelijk" with large text; fix truncation, overlap, contrast and spacing problems you see.
3. Run `npm run schermen` again, then `SCHERMEN_VOOR=<voor-map> node scripts/schermen-galerij.mjs` for a before/after gallery. Commit only the JPGs of the screens that changed, plus the gallery README, so the PR shows them on GitHub.
4. In the PR description: what the user notices, the before/after images, which tests ran (real exit codes), and open questions in plain Dutch for a non-technical owner.
- Cloud sessions run the app only against the fake Supabase (`npm run demo`, `tests/e2e/fake-supabase.mjs`); they never receive real keys. Playwright uses the preinstalled Chrome via `CHROME_PATH`.
- Before any push, run `npm run controle-voor-push`. Pushing still requires the owner's explicit approval; never push to `main`, never force-push.
- Prefer small visible improvements over backend work; keep the safety rules (allergies, diet, privacy) intact in every UI change.
