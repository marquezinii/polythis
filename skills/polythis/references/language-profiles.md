# Language profiles

Use these profiles to pick a **target** language for a candidate module and to sanity-check the current one. Each profile lists strengths, costs, and the integration story, because a language you cannot integrate cleanly is the wrong choice regardless of raw speed.

Generalizations hold for typical workloads. A profile never overrides a measurement.

## Contents

- [Comparison matrix](#comparison-matrix)
- [Systems languages](#systems-languages): C, C++, Rust, Zig
- [Managed compiled languages](#managed-compiled-languages): Go, C#/.NET, Java/Kotlin, Swift
- [Dynamic languages](#dynamic-languages): JavaScript/TypeScript, Python, Ruby, PHP, Lua
- [Specialized targets](#specialized-targets): Elixir/Erlang, Julia, SQL, GPU languages, WebAssembly
- [Choosing between close candidates](#choosing-between-close-candidates)

## Comparison matrix

Ratings are relative (5 = best on that axis) for typical production use.

| Language | Raw CPU | Latency predictability | Memory efficiency | Memory safety | Concurrency | Build & distribution ease | Iteration speed | Talent pool |
|---|---|---|---|---|---|---|---|---|
| C | 5 | 5 | 5 | 1 | 2 | 3 | 2 | 4 |
| C++ | 5 | 5 | 5 | 2 | 3 | 2 | 2 | 4 |
| Rust | 5 | 5 | 5 | 5 | 5 | 3 | 2 | 3 |
| Zig | 5 | 5 | 5 | 3 | 3 | 4 | 3 | 1 |
| Go | 4 | 4 | 4 | 4 | 5 | 5 | 4 | 4 |
| C# / .NET | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 |
| Java / Kotlin | 4 | 3 | 3 | 5 | 5 | 4 | 4 | 5 |
| Swift | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 3 |
| TypeScript / JS | 3 | 2 | 2 | 4 | 3 | 5 | 5 | 5 |
| Python | 1 | 2 | 2 | 4 | 2 | 4 | 5 | 5 |
| Ruby / PHP | 1 | 2 | 2 | 4 | 2 | 4 | 5 | 4 |
| Elixir / Erlang | 2 | 4 | 3 | 5 | 5 | 3 | 4 | 2 |
| Julia | 5 | 3 | 3 | 4 | 4 | 2 | 4 | 1 |

Latency predictability means freedom from GC pauses and JIT warm-up, not average speed.

## Systems languages

### C
- **Strengths:** universal ABI; every language can call C. Tiny binaries, predictable performance, runs anywhere including microcontrollers.
- **Costs:** no memory safety; undefined behavior; manual everything. Needs sanitizers, fuzzing, and careful review for any untrusted input.
- **Pick when:** you need the thinnest possible ABI layer, embedded targets, or you are wrapping an existing C library.
- **Avoid for:** new parsers of untrusted data, business logic.

### C++
- **Strengths:** top performance with high-level abstractions; huge ecosystem in games, media, finance, HPC, and GUI toolkits (Qt). First-class for Node addons (node-addon-api), Python (pybind11/nanobind), and Electron native modules.
- **Costs:** memory safety depends on discipline; build systems (CMake, vcpkg, Conan) and cross-platform binary distribution are real work; slow compiles; ABI fragility across compilers.
- **Pick when:** the team already knows C++, the domain library is C++ (OpenCV, FFmpeg wrappers, game engines, Aeron C++ client, HFT stacks), or you need SIMD intrinsics and full control of layout.
- **Avoid for:** teams without C++ experience; code handling untrusted input without fuzzing.

### Rust
- **Strengths:** C++-class speed with memory and data-race safety; excellent tooling (cargo); first-class bindings: napi-rs (Node/Electron), PyO3 + maturin (Python), uniffi (Swift/Kotlin), wasm-bindgen (browser), magnus/rb-sys (Ruby), cbindgen (C ABI for anything else).
- **Costs:** learning curve; slower iteration for exploratory code; compile times; prebuilt binaries per target still needed.
- **Pick when:** CPU-bound kernels, parsers, codecs, and protocol code where safety matters; shared cores across platforms; WASM targets.
- **Avoid for:** fast-changing business glue or UI-heavy code.

### Zig
- **Strengths:** C interop without bindings, superb cross-compilation, small binaries, explicit allocation.
- **Costs:** pre-1.0 language with breaking changes; small talent pool and ecosystem.
- **Pick when:** replacing C in a build or embedded context where cross-compilation is the pain. Rarely the default for a product module.

## Managed compiled languages

### Go
- **Strengths:** simple, fast to build, single static binaries, great for network services and CLIs; goroutines make concurrency approachable; low ops cost.
- **Costs:** GC (low-pause but present); cgo calls are expensive and complicate cross-compilation; less expressive for numeric kernels; no SIMD intrinsics without assembly.
- **Pick when:** high-concurrency services, infrastructure tools, CLIs, sidecars that replace a slow Node/Python/Ruby service.
- **Avoid for:** in-process native addons for other runtimes (shipping the Go runtime inside Node/Python is awkward), hard real-time paths.

### C# / .NET
- **Strengths:** high performance with `Span<T>`, SIMD (`Vector<T>`, hardware intrinsics), NativeAOT for fast startup and single binaries; outstanding Windows, desktop (WPF, WinUI, Avalonia, MAUI), Unity, and Office/COM integration; P/Invoke makes calling C easy. Aeron.NET, ASP.NET Core, and Orleans cover low-latency and server workloads.
- **Costs:** GC (tunable; zero-allocation code is possible but takes discipline); hosting .NET inside Node or Python is possible (edge-js, pythonnet) but heavier than a C ABI module.
- **Pick when:** Windows-heavy products, desktop apps, game logic in Unity, enterprise services, replacing a slow dynamic-language service with a team that knows C#.
- **Avoid for:** tiny in-process addons for other runtimes; prefer Rust/C++ there, or run .NET as a sidecar.

### Java / Kotlin
- **Strengths:** mature JIT, huge ecosystem, virtual threads for massive concurrency, strong observability (JFR); Kotlin adds concise syntax and Multiplatform for sharing logic with mobile. Aeron's reference implementation is Java.
- **Costs:** JIT warm-up and memory footprint; GC tuning for low latency (ZGC/Shenandoah help); native interop via JNI is painful (Panama FFM is better).
- **Pick when:** large backend services, data platforms, Android, and low-latency systems with zero-allocation discipline.
- **Avoid for:** CLIs and serverless where startup matters (unless GraalVM native-image), small native addons.

### Swift
- **Strengths:** native on Apple platforms, ARC gives predictable memory without GC pauses, good C/C++ interop.
- **Costs:** weaker on Linux/Windows; ecosystem centered on Apple.
- **Pick when:** Apple-platform apps and frameworks. For logic shared with Android, prefer a Rust/C++/KMP core.

## Dynamic languages

### JavaScript / TypeScript
- **Strengths:** one language across browser, server, desktop (Electron), and mobile (React Native); V8 JIT is fast for typical code; massive ecosystem; fastest iteration.
- **Costs:** single-threaded event loop (CPU work blocks everything), GC pauses, no integer types beyond `BigInt`, numeric loops slower than native by roughly 2 to 10×, sometimes more.
- **Keep for:** UI, API glue, orchestration, I/O-bound services.
- **Move out:** image/audio/video processing, compression, crypto, heavy parsing, physics, search indexes. Use existing native packages first, then a Rust/C++ addon, or WASM in the browser.

### Python
- **Strengths:** fastest path from idea to working code; best-in-class data, ML, and scientific ecosystem (mostly native underneath).
- **Costs:** pure-Python loops are slow (often 10 to 100× slower than native); the GIL limits CPU parallelism in threads (free-threaded builds are emerging but not universal); slow startup for big imports.
- **Keep for:** orchestration, ML training scripts, data analysis, glue around native libraries.
- **Move out:** custom numeric kernels that NumPy/Polars cannot express, hot parsers, latency-critical serving. Rust (PyO3) or C++ (pybind11/nanobind) as an extension module; Cython for incremental speedups.

### Ruby and PHP
- **Strengths:** productive web frameworks (Rails, Laravel); fine for request/response CRUD.
- **Costs:** CPU-bound work is slow; per-worker memory.
- **Move out:** heavy processing into extensions or a Go/Rust/C# sidecar or job worker.

### Lua
- **Strengths:** tiny, embeddable, fast with LuaJIT; standard for game and plugin scripting.
- **Move out:** hot loops back into the host engine (C/C++/C#/Rust).

## Specialized targets

### Elixir / Erlang (BEAM)
- **Strengths:** massive concurrency, fault tolerance, soft real-time messaging, hot code reload.
- **Costs:** weak at raw CPU; NIFs (native functions) can crash the VM unless written with Rustler.
- **Pick when:** chat, presence, telephony, and many-connection stateful systems.

### Julia
- **Strengths:** near-C numeric speed with high-level syntax; excellent for scientific computing.
- **Costs:** JIT latency, smaller ecosystem, deployment as a service is less common.
- **Pick when:** numerical research code that outgrew Python but must stay readable by scientists.

### SQL / the database
- **Strengths:** set-based operations, indexes, and query planners beat hand-written loops in any language.
- **Pick when:** app code loads rows to filter, join, or aggregate. Moving logic into a query or a materialized view is often the biggest "language change" available. Embedded engines (SQLite, DuckDB) bring this in-process.

### GPU languages (CUDA, Metal, WGSL/WebGPU, compute shaders)
- **Pick when:** massively parallel numeric work (image filters, ML inference, simulations) where a CPU port would still be too slow. Check data-transfer overhead first.

### WebAssembly
- **Not a language but a target.** Compile Rust, C/C++, Zig, Go (TinyGo), or C# to WASM.
- **Pick when:** the module must run in the browser, or you need a sandboxed, portable plugin format on the server (Wasmtime, Wasmer).
- **Costs:** copying data across the JS/WASM boundary; no direct access to DOM or threads without extra setup; usually 1 to 2× slower than native, still much faster than JS for tight numeric loops.

## Choosing between close candidates

| Situation | Prefer | Because |
|---|---|---|
| Node/Electron addon, team has no native experience | Rust (napi-rs) | safety, cargo, prebuilt-binary tooling via `@napi-rs/cli` |
| Node/Electron addon, team knows C++, or wrapping a C++ library | C++ (node-addon-api) | direct access to the library, no extra binding layer |
| Python extension | Rust (PyO3 + maturin) or C++ (nanobind) | maturin builds wheels for every platform with little effort |
| Replacing a slow dynamic-language **service** | Go or C# (or Java/Kotlin) | lower learning curve than Rust; GC is fine for services |
| Windows desktop or Office/COM integration | C# | platform libraries, tooling, and P/Invoke |
| Browser-side heavy compute | Rust → WASM | best WASM tooling (wasm-bindgen, wasm-pack) |
| Ultra-low-latency messaging, trading, market data | C++ or Java/C# with zero-allocation discipline (e.g. Aeron clients exist in Java, C, C++, .NET) | depends on team and existing stack; measure tail latency |
| Shared mobile + desktop core | Rust (uniffi) or Kotlin Multiplatform | one implementation, idiomatic bindings |
