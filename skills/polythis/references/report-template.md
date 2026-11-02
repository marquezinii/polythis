# Report template

Fill this in. Keep the summary to one screen. Drop sections that do not apply rather than padding them.

```markdown
# Language-fit audit: <repo or scope>

**Goal assumed:** <throughput | latency | memory | startup | safety | maintainability | cost | general health check>
**Constraints:** <deployment targets, team languages, platforms>
**Stack today:** <languages with % of code, runtimes, deployment>
**Evidence available:** <what was measured, profiled, or only read>

## Verdicts

| # | Module / path | Workload | Current | Verdict | Target & boundary | Expected gain | Confidence |
|---|---|---|---|---|---|---|---|
| 1 | `src/imaging/` | CPU-bound pixels | TypeScript | EXTRACT | Rust via napi-rs, one call per image | ~3–5× end-to-end export time [benchmarked] | medium |
| 2 | `api/` | I/O-bound | TypeScript | KEEP | n/a | n/a | high |
| 3 | `scripts/*.py` | tooling | Python | CONSOLIDATE | rewrite in TypeScript, drop Python from CI | one fewer toolchain | high |

**Do first:** <the single most valuable next step, concrete enough to start today>

## 1. <module>: <VERDICT>

**What it does:** <one or two sentences>
**Why it is a candidate:** <signals, each labelled [measured] [benchmarked] [profiled] [history] [inferred]>
**Amdahl check:** <share of end-to-end time → best-case overall speedup>

**Options considered**

| Rung | Option | Outcome |
|---|---|---|
| 1 | Optimize in place: <what> | <why it is or is not enough> |
| 2 | Adopt library: <which> | <why it is or is not enough> |
| 3 | Extract to <language> via <mechanism> | <chosen / rejected and why> |

**Score:** Gain _ ×2 + Fit _ + Pain _ − (Boundary _ + Migration _ + Ops _ + Team _) = **net _** → <verdict>; gates applied: <none | which gate capped it>

**Boundary design:** <signature in, signature out, batching, threading, error mapping>
**Distribution:** <targets, prebuilt strategy, fallback>
**Risks:** <parity, ops, people> and how each is mitigated
**Next step:** <first PR-sized task, e.g. "add a benchmark on 20 real images and record the baseline">
**Pilot success metric (if PILOT):** <metric, threshold, input, time box>

## What not to rewrite

<Modules that look tempting but should stay, and the one-line reason for each. This section prevents future churn.>

## Open questions

<Only questions whose answers would change a verdict, with who can answer them.>
```

## Writing rules

- Every number carries an evidence label. No label, no number.
- Confidence: **high** only with `[measured]` or `[benchmarked]` evidence on representative input (synthetic input caps confidence at medium); **medium** with `[profiled]` or strong `[history]`; **low** with `[inferred]` only.
- Name the boundary concretely: mechanism, call granularity, and data format.
- "Expected gain" is end-to-end, after the Amdahl check, not the module's isolated speedup.
- If everything is KEEP, say so plainly and list the cheap in-place improvements you found. A clean bill of health is a valid result.
