# Interop and boundary design

A port is only as good as its boundary. Choose the mechanism, then design the interface so it is crossed **rarely** and with **simple data**.

## Contents

- [Boundary mechanisms by cost](#boundary-mechanisms-by-cost)
- [Host × guest matrix](#host--guest-matrix)
- [Designing a coarse interface](#designing-a-coarse-interface)
- [Electron specifics](#electron-specifics)
- [Distribution checklist](#distribution-checklist)

## Boundary mechanisms by cost

Orders of magnitude for one call, excluding the work itself. Use them to judge whether a boundary design is viable, not as benchmarks.

| Mechanism | Per-call overhead | Isolation | Notes |
|---|---|---|---|
| Same-language function call | ~ns | none | baseline |
| In-process FFI / native addon (N-API, PyO3, P/Invoke, JNI, Panama) | ~10 ns to ~1 µs plus marshalling | none: a crash takes the host down | best for hot kernels called with large batches |
| WebAssembly in-process | ~10 to 100 ns plus copying into linear memory | sandboxed | copying large buffers dominates; pass views when possible |
| cgo (Go ↔ C) | ~tens to hundreds of ns, scheduler effects | none | avoid fine-grained calls |
| Shared memory / ring buffer IPC (e.g. Aeron IPC, memory-mapped files) | ~sub-µs to µs | process | for low-latency streaming between processes |
| Local process over stdio / pipes / Unix sockets (JSON-RPC, MessagePack) | ~10 to 100 µs | process: crashes are contained | simple, language-agnostic; good default for sidecars |
| Local HTTP / gRPC | ~100 µs to ~1 ms | process | easy to observe and version |
| Remote service | ~1 ms and up | full | only when the module needs separate scaling or ownership |

Rule of thumb: the cost of one crossing should be under ~1% of the work done per crossing. If it is not, batch more work per call.

## Host × guest matrix

| Host runtime | Guest language | Recommended mechanism | Tooling |
|---|---|---|---|
| Node.js / Electron | Rust | N-API addon | napi-rs (`@napi-rs/cli` builds and publishes per-platform packages), neon |
| Node.js / Electron | C / C++ | N-API addon | node-addon-api, cmake-js or node-gyp, prebuildify / prebuild-install |
| Node.js / Electron | C / any C-ABI lib | dynamic FFI | koffi (no compile step; slower per call) |
| Node.js / Electron | C# / .NET | sidecar (stdio/gRPC) or in-process hosting | sidecar is simpler; edge-js / node-api-dotnet for in-process |
| Node.js / Electron | Go | sidecar process | Go static binary over stdio or gRPC |
| Browser | Rust / C / C++ / Zig | WebAssembly module | wasm-bindgen + wasm-pack, Emscripten, `zig build -Dtarget=wasm32` |
| Python | Rust | extension module | PyO3 + maturin (wheels for all platforms) |
| Python | C++ | extension module | nanobind or pybind11, scikit-build-core |
| Python | C | extension or FFI | cffi, ctypes (simple, slower), Cython |
| Python | Go / C# / Java | sidecar or service | gRPC, stdio JSON-RPC |
| JVM (Java/Kotlin) | C / C++ / Rust | Foreign Function & Memory API (Panama), JNI | jextract, JNA (slower, easier) |
| .NET | C / C++ / Rust | P/Invoke (`LibraryImport`) | C ABI via cbindgen for Rust; C++/CLI on Windows only |
| Go | C / C++ / Rust | cgo with coarse calls | or a sidecar to keep cross-compilation simple |
| Ruby | Rust / C | native extension | magnus + rb-sys, C extensions, ffi gem |
| PHP | C / Rust | extension or FFI | PHP FFI, ext-php-rs |
| Swift / Kotlin (mobile) | Rust / C++ | generated bindings | uniffi, djinni, Kotlin/Native cinterop |
| Elixir / Erlang | Rust | NIF | Rustler (avoids crashing the VM on panics; mark long work as dirty) |
| Any | Any | process boundary | gRPC, stdio JSON-RPC, message queue, Aeron for low-latency streams |

## Designing a coarse interface

- **Batch:** pass the whole image, file, array, or request batch; never one pixel, row, or field per call.
- **Flat data:** byte buffers, typed arrays, numbers, and strings cross cheaply. Object graphs, callbacks, and per-field getters do not.
- **Zero-copy where offered:** N-API external buffers, Python buffer protocol / memoryview, `Span<T>` with pinned memory, WASM views into linear memory.
- **Own the threading:** never block the host's event loop or UI thread. Run native work on a thread pool (N-API `AsyncWorker` or napi-rs `AsyncTask`, release the GIL in PyO3 with `allow_threads`, `Task.Run` in .NET) and return a promise/future.
- **Errors as values:** map native errors to host exceptions at the boundary; never let a panic or C++ exception cross FFI unhandled.
- **Version the interface:** a sidecar protocol needs a version field; a native addon needs ABI-stable APIs (N-API, not raw V8).
- **Keep a fallback** in the original language while the native path proves itself, when distribution coverage is incomplete.

## Electron specifics

- Use **N-API** addons; they are ABI-stable across Node and Electron versions. Raw V8/NAN addons must be rebuilt for every Electron release.
- Rebuild or download prebuilt binaries for Electron's runtime with `@electron/rebuild` or ship prebuilds per platform/arch.
- Heavy work belongs off the main process: a `utilityProcess`, a worker thread, or the addon's own thread pool. A blocked main process freezes every window.
- Package `.node` binaries outside the asar archive (`asarUnpack`) so they can be loaded.
- Code-sign native binaries on macOS and Windows along with the app.
- Consider a sidecar binary (Rust/Go/C#) when the native code is large, crashes would be catastrophic, or the team prefers a process boundary.

## Distribution checklist

Count each item in the **Ops** score.

- Target matrix: Windows x64/arm64, macOS x64/arm64 (universal?), Linux x64/arm64, glibc vs musl (Alpine), mobile ABIs, browsers.
- CI jobs to build and test each target, or cross-compilation (cargo-zigbuild, cross, zig cc).
- Prebuilt artifacts per target (npm optional dependencies per platform, Python wheels, NuGet runtime packages) so users never compile.
- Source fallback or pure-language fallback when no prebuilt exists.
- Code signing and notarization for desktop apps.
- License compatibility of native dependencies.
- Container image size and base image (distroless, Alpine/musl compatibility).
- Debuggability: symbols, crash reporting across the boundary, logging from native code into the host's logger.
