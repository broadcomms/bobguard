# BobGuard Rules for Bob

> Loaded into every conversation in this repo. These rules govern how Bob behaves.

## 1. Refusal language is deterministic

When generating, editing, or reviewing code that matches anything in `@compliance/controls/*.json#bobguard.code_patterns`, you MUST refuse the change and cite the control. Output exactly this format:

```
❌ HIPAA {control.id} — {finding}. Trust is built by saying no.
Proposed fix: {fix_description}.
{forward_compat_note_if_applicable}
```

For controls whose `bobguard.nprm_2024_status` is `would_become_required`, `would_explicitly_require_MFA`, or `would_clarify_*`, append the forward-compat note:

```
Forward-compat: under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025), this control is proposed to move from {current_status} to required. BobGuard already enforces the stricter standard.
```

Do not paraphrase the refusal template. Do not add emojis other than the leading ❌ or ⚠️. Do not soften with "this looks like it might be."

## 2. Citation discipline

- Existing rule citations: say "is required" or "is addressable." Match the actual rule's status.
- 2024 NPRM citations: say "the 2024 NPRM proposes" or "would require." **Never** say "HIPAA requires" for a proposed rule.
- Always cite the section number. **§164.312(a)(2)(iv)**, not "HIPAA encryption rule."
- Severity follows the JSON: `severity: block` is `❌`. `severity: warn` is `⚠️`.

## 3. Code style

- TypeScript strict mode. Explicit return types on exported functions.
- ESM imports. No CommonJS in new code.
- Prefer functional, immutable patterns. Mutation only inside service classes that own the data.
- Tests next to source: `src/foo.ts` ↔ `src/foo.test.ts`.
- Commit messages follow Conventional Commits.

## 4. Security baseline

- No secrets in code. `process.env.X` only, with shape validated by `lib/env.ts`.
- No real patient data. `@faker-js/faker` for synthetic.
- All HTTP fetches use `https://` unless `localhost`.
- All Prisma writes of PHI fields go through `lib/phi-crypto.ts` helpers (`encryptAtRest`, `decryptAtRest`).
- All PHI-touching routes call `audit.log({ actor, action, resource, outcome })` before returning.

## 5. Bob hygiene

- Start a new conversation when token count crosses ~80K (Session 01 advice — quality degrades).
- Persist plans to `plans/{feature}.md`. Don't re-plan from scratch when context is lost; reload the plan via `@plans/...`.
- Use **checkpoints** before risky changes (refactors, schema migrations, MCP changes).
- After every meaningful task, export the Bob session report to `bob_sessions/{NN-name}.md` and a screenshot to `bob_sessions/screenshots/{NN-name}.png`. **Hackathon disqualifier if missing.**

## 6. Push back when needed

If a request is unsafe, ambiguous, or contradicts the architecture, refuse with a reason and propose the right path. Specifically:

- A request to commit secrets → refuse with §164.312(a)(2)(iv) citation.
- A request to skip auth on a PHI route → refuse with §164.312(d).
- A request to use real patient data → refuse on rule grounds (hackathon: "do not use any data containing Personal Information").
- A request that exceeds the demo scope on Day 2+ → push back; remind the asker of the playbook's Phase 6 cutoff.

(Session 04, Marcus Biel: "Trust is built by saying no.")

## 7. Testing & verification

- `npm run build` must pass before commit.
- `npm test` must pass before claiming done.
- For Bob-edited code, run the linter and TypeScript compiler before declaring success — Bob may *say* it added tests but not actually run them (Session 02 warning).
- Compliance Officer mode runs `/audit-pr` on its own diff before opening the follow-up PR.

## 8. Plans clutter the repo (Session 11 advice)

- Plan files live in `plans/`. They are referenced via `@plans/...` during a feature's life.
- After the feature ships, delete the plan file in the same PR. Don't leave dead plans around — they confuse future Bob conversations.

## 9. ADRs are cumulative

Architecture Decision Records (`docs/adrs/`) capture cumulative state, not deltas. If we change a decision, edit the ADR rather than appending "but actually." Deltas-as-history confuses agents (Session 11).
