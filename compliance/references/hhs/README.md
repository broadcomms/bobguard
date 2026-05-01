# HHS Reference Library — Public Domain

These are official public U.S. Department of Health and Human Services publications used as **citation evidence** in BobGuard's auditor PDF and as the source of truth for the HIPAA Security Rule sections cited by `bob-guard.controls.lookup()`.

All documents are **U.S. public domain** under 17 U.S.C. § 105 (works of the U.S. Government are not copyrightable).

## Files

| File | Source | Topic |
|---|---|---|
| `security101.pdf` | CMS / HHS, HIPAA Security Series Paper 1 | Security Rule overview |
| `adminsafeguards.pdf` | CMS / HHS, HIPAA Security Series Paper 2 | §164.308 — Administrative Safeguards |
| `physsafeguards.pdf` | CMS / HHS, HIPAA Security Series Paper 3 | §164.310 — Physical Safeguards |
| `techsafeguards.pdf` | CMS / HHS, HIPAA Security Series Paper 4 | **§164.312 — Technical Safeguards** (BobGuard's primary reference) |
| `pprequirements.pdf` | CMS / HHS, HIPAA Security Series Paper 5 | §164.316 — Policies, Procedures, Documentation |
| `riskassessment.pdf` | CMS / HHS, HIPAA Security Series Paper 6 | Basics of Risk Analysis and Risk Management |
| `smallprovider.pdf` | CMS / HHS, HIPAA Security Series Paper 7 | Implementation for small providers |
| `rafinalguidancepdf.pdf` | OCR / HHS | Final guidance on risk analysis |
| `RansomwareFactSheet.pdf` | OCR / HHS | Fact sheet on ransomware and HIPAA |
| `remoteuse.pdf` | CMS / HHS | Remote use of and access to ePHI |
| `hipaa-simplification-201303.pdf` | OCR / HHS | HIPAA Administrative Simplification (2013 omnibus) |
| `2024-30983.pdf` | HHS OCR | **2024 HIPAA Security Rule NPRM** (RIN 0945-AA22, *Fed. Reg.* Vol. 90 No. 3, Jan. 6, 2025) — BobGuard's forward-compatibility anchor |

## How BobGuard cites these

The MCP tool `bob-guard.controls.lookup({ control_id })` returns the control's `bobguard.hhs_source` field, which references the relevant file in this folder. The auditor PDF embeds page-level references (e.g., "*Source: §164.312, techsafeguards.pdf p. 4*").

## Important — citation framing

- **Existing rule** citations (Security Series papers 1–7) describe the *current* HIPAA Security Rule (2003, last revised 2013). Use phrasing like "is required" or "is addressable."
- **2024 NPRM** citations (`2024-30983.pdf`) describe a *proposed* rule. **Always** use phrasing like "the 2024 NPRM proposes" or "would require." Never say "HIPAA requires" for NPRM content.
