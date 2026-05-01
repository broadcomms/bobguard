# `.bob/` starter folder

Drop-in Bob configuration for the BobGuard hackathon project.

## How to install into the repo

After you create the public hackathon repo (Phase 0.3 in the execution playbook), copy this folder in:

```bash
cd ~/code/bobguard
cp -R ~/ibm-dev-day/bobguard/dot-bob/ ./.bob/
git add .bob
git commit -m "feat(bob): add Compliance Officer mode, skills, MCP config, and rules"
```

Then restart Bob IDE in the repo. Bob auto-loads `.bob/AGENTS.md` and `.bob/rules.md` on every conversation, surfaces `.bob/modes/*.yaml` in the mode picker, registers `.bob/mcp.json` MCP servers, surfaces `.bob/skills/*/skill.md` for auto-activation by description match, and exposes `.bob/commands/*.md` as slash commands.

## What's in here

| File | Purpose |
|---|---|
| `AGENTS.md` | Persistent project context. Loaded on every Bob conversation. |
| `rules.md` | Team rules — refusal language, citation discipline, hygiene. |
| `mcp.json` | Two MCP servers: custom `bob-guard`, and `github`. |
| `modes/compliance-officer.yaml` | The custom mode that runs at PR time. |
| `skills/pr-block-with-citation/skill.md` | The deterministic refusal-language skill. **Most important skill — variance reduction lives here.** |
| `skills/control-mapper/skill.md` | Wraps `bob-guard.controls.scan` and formats as a markdown table. |
| `skills/audit-evidence-generator/skill.md` | Orchestrator — runs the full evidence pipeline end-to-end. |
| `skills/data-flow-tracer/skill.md` | Generates the Mermaid ePHI flow diagram. |
| `skills/nprm-forward-compat-check/skill.md` | Adds the 2024 NPRM forward-compat narrative. |
| `commands/audit-pr.md` | The `/audit-pr` slash command — runs the full audit on the current branch. |

## After install — a 5-minute smoke test

1. Open Bob in the repo. Confirm `Compliance Officer` is in the mode dropdown.
2. Open a Bob chat. Type `@AGENTS` — autocomplete should suggest `AGENTS.md`. Reference it: "Summarize what we're building per @AGENTS.md." Bob should mention BobGuard, the $84K stat, the NPRM, and the file map.
3. Type `@bob-guard.controls.lookup` — autocomplete should show the tool. (Won't run until P3 is done; just confirm it's registered.)
4. Type `/` — `/audit-pr` should appear.
5. Switch to **Compliance Officer** mode. Bob's response should now use the refusal language template.

If any of these fail, validate the `.bob/` folder paths against your Bob IDE version's expected schema. Bob's exact frontmatter keys may differ slightly between versions.

## What to edit before shipping

- `mcp.json`: confirm env-var names match what your shell exports.
- `AGENTS.md`: update the team list and any architecture details that drift during the build.
- `rules.md`: add team coding-style preferences as you discover them.
- The five skills: tighten language as you tune for variance during Phase 6 dry runs.

## What NOT to edit

- The exact refusal-language template in `skills/pr-block-with-citation/skill.md` — variance reduction.
- The "Trust is built by saying no" phrase — the demo-line tie-in to Marcus Biel's keynote.
- The forward-compat callout structure — it's been engineered to score creativity points.
