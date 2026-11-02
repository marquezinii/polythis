# Signal catalog

Signals point at **candidates**, not verdicts. One signal justifies a look. A verdict needs evidence (see SKILL.md step 4).

## Contents

- [Universal signals](#universal-signals)
- [Signals by current language](#signals-by-current-language)
- [Counter-signals: reasons to keep](#counter-signals-reasons-to-keep)
- [Consolidation signals](#consolidation-signals)
- [Search patterns](#search-patterns)

## Universal signals

### Performance

- A profiler attributes most self-time to a few functions in user code rather than in I/O waits or native libraries.
- Tight loops over numbers, bytes, pixels, audio samples, vertices, or characters.
- Hand-written codecs, compressors, hashes, image filters, diff algorithms, tokenizers, or physics.
- Work moved to worker threads or processes only to keep a UI or event loop responsive.
- Caching layers added only because the computation is too slow to run on demand.
- Commit messages: `perf`, `slow`, `optimize`, `timeout`, `OOM`, `freeze`, `jank`, `blocking`.
- Timeouts raised repeatedly in config or tests.

### Memory and latency

- GC pauses visible in p99/p999 latency; GC tuning flags in launch scripts.
- Object pools, manual buffer reuse, or arena-like tricks in a GC language (the code is fighting the runtime).
- Container memory limits raised repeatedly; heap dumps in issues.
- Startup time matters (CLI, serverless, desktop launch) and runtime boot dominates.

### Correctness

- Repeated fixes of the same bug class: null/undefined, type coercion, integer overflow, use-after-free, buffer overrun, data race.
- Large amounts of defensive runtime type checks a static type system would make unnecessary.
- Security advisories in hand-written C/C++ parsing code.
- Floating-point or money bugs from implicit numeric types (JS `number` for currency, for example).

### Maintainability

- A module re-implements in the app language what a mature library in another ecosystem already does (and the gap is large).
- The module's domain has its best tooling elsewhere: numerical work in Python/Julia, Windows integration in C#, GPU in CUDA/WGSL, statistics in R.
- The module is stable (low churn) and well specified. Stable, specified code is the cheapest to port and the safest to freeze behind an interface.

## Signals by current language

| Current language | Look for | Common better homes |
|---|---|---|
| JavaScript / TypeScript (Node, Electron, browser) | `Buffer`/`TypedArray` loops, hand-rolled image/audio/crypto/compression, `JSON.parse` of huge payloads on the main thread, event-loop lag, `worker_threads` used as a band-aid, Electron main-process freezes | Rust via napi-rs, C++ via node-addon-api, WASM in the browser, existing native libs (sharp, better-sqlite3) |
| Python | pure-Python loops over arrays, `struct.unpack` in loops, GIL contention, multiprocessing used to dodge the GIL, slow import/startup for CLIs | NumPy/Polars first; then Rust via PyO3/maturin, C++ via pybind11/nanobind, Cython |
| Ruby | CPU-heavy work in request cycle, memory bloat per worker | Rust via magnus/rb-sys, C extensions, a Go/Rust sidecar |
| PHP | image or PDF processing in userland, long-running workers leaking memory | existing extensions (imagick, vips), a sidecar service |
| Java / Kotlin | GC pause tuning, off-heap `ByteBuffer` tricks, JNI wrappers that crash | tune GC/ZGC, Panama FFM, Rust/C++ only for a proven hot kernel |
| C# / .NET | `unsafe` blocks everywhere, P/Invoke to custom C++ for speed | `Span<T>`, SIMD (`Vector<T>`), NativeAOT; C++/Rust only for proven hot kernels |
| Go | cgo for speed (cgo call overhead is high), GC pauses in latency-critical paths, generics workarounds | pure-Go optimization, Rust/C++ for proven hot kernels without fine-grained calls |
| C / C++ | memory-safety CVEs, sanitizer findings, parsing untrusted input, slow feature velocity on non-hot code | Rust for unsafe-input parsers; a managed language (C#, Go, Java) for non-hot business logic |
| Rust | very slow iteration on UI or business glue that is not hot | a higher-level language for the glue, keeping Rust for the core |
| Swift / Kotlin (mobile) | duplicated business logic across iOS and Android | shared core in Rust (uniffi), C++, or Kotlin Multiplatform |
| Lua / embedded scripting | game or plugin logic that became hot | move the hot part into the host engine language |
| Shell | scripts over ~200 lines, parsing structured data with `sed`/`awk`, cross-platform breakage | the repo's main language, or Python/Go for tooling |
| R / MATLAB | production serving of models built in notebooks | Python or a compiled service for serving; keep R for analysis |

## Counter-signals: reasons to keep

- Time is dominated by I/O: network, database, disk, external APIs.
- The heavy lifting already happens in native code (NumPy, sharp, database engine, browser APIs).
- The module changes weekly; porting a moving target is expensive and freezes velocity.
- The boundary would be crossed per item, per request field, or per frame with rich objects.
- There are no tests or reference outputs.
- Nobody on the team writes the target language.
- Native builds would break a key distribution channel (pure-JS npm package, serverless zip limits, app store rules).
- The pain is architectural (N+1 queries, missing index, sync calls in a loop). A language change will not fix it.

## Consolidation signals

- A toolchain (language family) other than the main one with fewer than ~1,000 lines in total, especially when used only for tooling or scripts. Even a 5-line script counts if it is the only reason CI installs a runtime.
- A script that duplicates a built-in command of the platform (`npm version`, `cargo release`, `dotnet format`). The verdict is REMOVE, not CONSOLIDATE.
- Two implementations of the same logic in two languages (validation duplicated in backend and frontend, for example).
- A service in a language only one person knows.
- A toolchain kept in CI solely for one small component.

Consolidation is a valid recommendation: removing a language often improves maintainability more than adding one.

## Search patterns

Starting points for `grep`/`rg`. Hits are leads, not proof.

| Intent | Pattern (regex) | Where |
|---|---|---|
| Byte/number crunching in JS/TS | `new (Uint8\|Int16\|Int32\|Float32\|Float64)Array\|Buffer\.alloc\|DataView` | `*.js,*.ts` |
| Bit twiddling | `>>>\|<<\s*\d\|\^\s*0x` | dynamic languages |
| Python hot loops | `for .+ in range\(` inside another loop, `struct\.(un)?pack` | `*.py` |
| Existing interop | `napi\|node-addon-api\|ffi-napi\|koffi\|pyo3\|pybind11\|ctypes\|cffi\|DllImport\|LibraryImport\|System\.loadLibrary\|import "C"\|wasm_bindgen\|WebAssembly\.instantiate` | all |
| Sidecars | `child_process\|spawn\(\|execFile\|subprocess\.(run\|Popen)\|Process\.Start` | all |
| Event-loop/GIL workarounds | `worker_threads\|new Worker\(\|multiprocessing\|ProcessPoolExecutor` | JS, Python |
| GC fighting | `ArrayPool\|ObjectPool\|stackalloc\|-XX:\|GOGC\|sync\.Pool` | .NET, JVM, Go |
| Unsafe code | `unsafe\s*\{\|reinterpret_cast\|memcpy\|malloc\(` | C#, Rust, C/C++ |
| Perf complaints in history | `git log -i --grep='perf\|slow\|optimi\|latency\|oom\|freeze\|timeout' --oneline` | git |
