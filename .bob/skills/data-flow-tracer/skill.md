---
name: data-flow-tracer
description: >
  Generate a Mermaid graph showing the path of electronic protected health information (ePHI)
  through the code changed in this PR. Renders to PNG for inclusion in the auditor PDF.
  Activate when the Compliance Officer mode needs the data-flow artifact for an evidence pack.
inputs:
  - diff: unified diff text
  - files_touched: list of file paths
outputs:
  - compliance/evidence/PR-{n}/data-flow.mmd  (Mermaid source)
  - compliance/evidence/PR-{n}/data-flow.png  (rendered)
---

# data-flow-tracer

## Procedure

1. For each file in `files_touched`, parse it (read with `read_file`) and identify:
   - **Sources** of ePHI: HTTP request bodies, file reads, queue receivers, DB reads.
   - **Sinks**: DB writes, HTTP response bodies, log lines, outbound HTTP calls, file writes.
   - **Transforms**: encrypt / decrypt / hash / anonymize / serialize calls.
2. Build a directed graph from sources → transforms → sinks.
3. Color-code:
   - 🔴 red: ePHI present in plaintext at this node
   - 🟡 yellow: ePHI present but only briefly in memory
   - 🟢 green: ePHI encrypted at this node
4. Render as Mermaid `graph LR` to `compliance/evidence/PR-{n}/data-flow.mmd`.
5. Run `mmdc -i data-flow.mmd -o data-flow.png` to render the PNG.

## Mermaid template

```mermaid
graph LR
  classDef plaintext fill:#fee,stroke:#c00,color:#900
  classDef transient fill:#ffe,stroke:#cc0,color:#660
  classDef encrypted fill:#efe,stroke:#0a0,color:#060

  Client[Client App]:::plaintext
  TLS[TLS 1.2+ Tunnel]:::encrypted
  API[POST /patients]:::plaintext
  Encrypt["encryptAtRest( )"]:::encrypted
  DB[(Postgres patient table)]:::encrypted
  Audit[audit-log emission]:::encrypted

  Client -->|patient JSON| TLS
  TLS -->|plaintext in memory| API
  API --> Encrypt
  Encrypt --> DB
  API --> Audit
```

## Output requirements

- The diagram must show every file in `files_touched`.
- Each ePHI field that appears at any node must be labeled on its source edge.
- If an unencrypted DB write is detected, the edge to the DB node MUST be red and labeled with the control violation: `❌ §164.312(a)(2)(iv)`.
- If a plain-HTTP sink is detected, the edge MUST be red with `❌ §164.312(e)(1)`.

## Notes

- Mermaid is sufficient — do not invest time in d2 or graphviz; PDF rendering will use the PNG.
- If the file content is genuinely too complex to trace cleanly, output a simplified diagram with one node per file and add a note in `threat-delta.md` flagging the simplification.
