# Calibration cases

Short worked examples showing what good verdicts look like. The first set is illustrative; the second set summarizes widely reported public migrations, for calibration only. Do not cite their numbers as predictions for this repo.

## Illustrative verdicts

### 1. Electron photo editor: filters in TypeScript → EXTRACT to Rust addon

- **Signals:** export of a 24 MP image freezes the UI for seconds `[profiled]`; 80% of export time is self-time in `applyFilter` loops over `Uint8ClampedArray` `[profiled]`; repeated "UI freeze" fixes `[history]`.
- **Ladder:** in-place fixes (moving the loop to a worker) removed the freeze but not the slowness. `sharp` covers resize and encode but not the custom filters.
- **Calibration note:** this verdict depends on the filters being custom. If an existing library (`sharp`/libvips, OpenCV bindings) covers the filters you need, the answer is `OPTIMIZE IN PLACE → ADOPT LIBRARY` and no new language at all. Always move blocking work off the main process first.
- **Amdahl:** p = 0.8 → best case 5× overall.
- **Boundary:** one N-API call per image with a `Buffer` in and out, run on the addon's thread pool and returned as a promise; napi-rs prebuilt packages for win/mac/linux x64+arm64; keep the TS implementation as a fallback for one release.
- **Score:** Gain 4×2 + Fit 5 + Pain 3 − (Boundary 1 + Migration 2 + Ops 3 + Team 3) = **+7 → EXTRACT**.

### 2. Node REST API that "feels slow" → KEEP, fix queries

- **Signals:** p95 400 ms; traces show 85% of request time in Postgres `[measured]`; N+1 queries in two ORM calls `[profiled]`.
- **Verdict:** KEEP. A Go or Rust rewrite would shave the remaining ~15% at most. Fix the N+1 queries and add an index; expected p95 under 100 ms.

### 3. Python ETL job, 6 hours nightly → OPTIMIZE IN PLACE, then re-evaluate

- **Signals:** row-by-row Python loops over CSV data `[inferred]`, confirmed with py-spy `[profiled]`.
- **Ladder:** rung 2 (Polars or DuckDB) is expected to give large gains with no new language. Porting to Rust now would skip a cheaper rung.
- **Verdict:** ADOPT LIBRARY; re-audit only if the job stays over its time budget.

### 4. Go service with cgo calls to a C image library per pixel row → restructure boundary

- **Signals:** cgo overhead visible in profiles `[profiled]`; the C library is fast but called ~4,000 times per image.
- **Verdict:** KEEP both languages, change the boundary: one cgo call per image. The language was fine; the boundary was chatty.

### 5. C++ protocol parser with recurring memory-safety CVEs → PILOT Rust replacement

- **Signals:** three CVEs in two years in the parser `[history]`; fuzzing finds new crashes `[measured]`; parser is stable and well specified.
- **Score:** Gain 3×2 + Fit 5 + Pain 5 − (Boundary 2 + Migration 3 + Ops 2 + Team 4) = **+5 → PILOT** (team has no Rust experience).
- **Pilot:** rewrite the parser behind the same C ABI with cbindgen, diff-fuzz both implementations for two weeks, decide based on the crash count and throughput parity.

### 6. Repo with 40k lines of TypeScript and 600 lines of Python scripts → CONSOLIDATE

- **Signals:** Python is used only for release scripts; CI installs Python only for them; one maintainer knows them.
- **Verdict:** CONSOLIDATE into TypeScript; remove a toolchain from CI and onboarding.

### 7. Low-latency market data in Java with GC spikes → OPTIMIZE IN PLACE before C++

- **Signals:** p99.9 spikes aligned with GC logs `[measured]`; allocation profile shows boxing and per-message objects `[profiled]`.
- **Ladder:** zero-allocation message handling with flyweights, off-heap buffers, an Aeron-style messaging layer, and ZGC; rewriting in C++ is held as rung 3 if tail latency stays over target after these changes.
- **Verdict:** OPTIMIZE IN PLACE with a target metric; PILOT C++ only for the decoder if p99.9 is still too high.

## Public migrations (for calibration)

| Project | Move | Why it worked |
|---|---|---|
| Discord "Read States" service | Go → Rust | latency spikes from GC on a large in-memory cache; workload was memory- and latency-critical |
| Figma multiplayer server | TypeScript → Rust | CPU and memory pressure in a single-threaded runtime on a hot, well-defined service |
| Dropbox sync engine | Python → Rust | correctness-critical concurrent core rewritten with a test oracle; years of investment |
| TypeScript compiler (`tsc`) | TypeScript → Go native port | CPU-bound, highly parallelizable compiler; Go chosen for structural similarity to the existing code, which kept the port mechanical |
| esbuild, SWC, Biome, Ruff, uv | JS/Python tooling rewritten in Go/Rust | CPU-bound tools where startup and parallelism dominate user experience |

Common thread: each was CPU-, memory-, or latency-bound, measured before moving, scoped to a well-defined component, and had a team willing to own the new language. Counter-lesson: whole-product rewrites without these properties (the classic Netscape 6 story) tend to stall for years while the old product stagnates.
