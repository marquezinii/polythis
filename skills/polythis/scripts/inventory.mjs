#!/usr/bin/env node
// polythis inventory: read-only language-fit snapshot of a repository.
// Usage: node inventory.mjs [repo-root] [--months 12] [--top 15] [--json]
// Zero dependencies. Requires Node 18+. Uses git when available.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const opt = { root: ".", months: 12, top: 15, json: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--json") opt.json = true;
  else if (a === "--months") opt.months = Number(args[++i]) || opt.months;
  else if (a === "--top") opt.top = Number(args[++i]) || opt.top;
  else if (a === "-h" || a === "--help") {
    console.log("Usage: node inventory.mjs [repo-root] [--months 12] [--top 15] [--json]");
    process.exit(0);
  } else opt.root = a;
}
const ROOT = resolve(opt.root);
if (!existsSync(ROOT)) {
  console.error(`Path not found: ${ROOT}`);
  process.exit(1);
}

const LANGS = {
  ".js": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript", ".jsx": "JavaScript",
  ".ts": "TypeScript", ".tsx": "TypeScript", ".mts": "TypeScript", ".cts": "TypeScript",
  ".vue": "Vue", ".svelte": "Svelte", ".astro": "Astro",
  ".py": "Python", ".pyx": "Cython", ".pyi": "Python",
  ".rb": "Ruby", ".php": "PHP", ".lua": "Lua", ".pl": "Perl", ".r": "R", ".jl": "Julia",
  ".java": "Java", ".kt": "Kotlin", ".kts": "Kotlin", ".scala": "Scala", ".groovy": "Groovy", ".clj": "Clojure",
  ".cs": "C#", ".fs": "F#", ".vb": "Visual Basic",
  ".go": "Go", ".rs": "Rust", ".zig": "Zig", ".swift": "Swift", ".m": "Objective-C", ".mm": "Objective-C++",
  ".c": "C", ".h": "C/C++ header", ".cc": "C++", ".cpp": "C++", ".cxx": "C++", ".hpp": "C++", ".hh": "C++", ".hxx": "C++",
  ".cu": "CUDA", ".wgsl": "WGSL", ".glsl": "GLSL", ".hlsl": "HLSL", ".metal": "Metal",
  ".dart": "Dart", ".ex": "Elixir", ".exs": "Elixir", ".erl": "Erlang", ".hs": "Haskell", ".ml": "OCaml",
  ".nim": "Nim", ".cr": "Crystal", ".d": "D", ".v": "V", ".odin": "Odin",
  ".sql": "SQL", ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell", ".ps1": "PowerShell", ".bat": "Batch", ".cmd": "Batch",
  ".asm": "Assembly", ".s": "Assembly", ".wat": "WebAssembly text", ".sol": "Solidity", ".gd": "GDScript",
};

const MANIFESTS = {
  "package.json": "Node/npm", "deno.json": "Deno", "bun.lockb": "Bun", "bun.lock": "Bun",
  "pyproject.toml": "Python", "requirements.txt": "Python", "setup.py": "Python", "Pipfile": "Python",
  "Cargo.toml": "Rust", "go.mod": "Go", "Gemfile": "Ruby", "composer.json": "PHP",
  "pom.xml": "Java/Maven", "build.gradle": "JVM/Gradle", "build.gradle.kts": "JVM/Gradle",
  "CMakeLists.txt": "C/C++ CMake", "Makefile": "Make", "meson.build": "Meson", "build.zig": "Zig",
  "binding.gyp": "Node native addon (node-gyp)", "Package.swift": "Swift", "pubspec.yaml": "Dart/Flutter",
  "mix.exs": "Elixir", "Dockerfile": "Docker", "electron-builder.yml": "Electron", "forge.config.js": "Electron",
  "vcpkg.json": "C/C++ vcpkg", "conanfile.txt": "C/C++ Conan", "conanfile.py": "C/C++ Conan",
};
const MANIFEST_EXT = { ".csproj": ".NET", ".fsproj": ".NET", ".sln": ".NET", ".vcxproj": "MSVC C++" };

const INTEROP = [
  ["Node N-API addon", /\b(node-addon-api|napi\.h|NAPI_MODULE|napi_module_register|#\[napi\]|@napi-rs\/|napi-derive)\b/],
  ["Node dynamic FFI", /\b(ffi-napi|koffi|node-ffi)\b/],
  ["Neon (Rust↔Node)", /\bneon::/],
  ["Python ext (PyO3/pybind/nanobind)", /\b(#\[pyfunction\]|#\[pymodule\]|pyo3|PYBIND11_MODULE|NB_MODULE|nanobind)\b/],
  ["Python ctypes/cffi", /\b(import ctypes|from ctypes|import cffi|from cffi|ffi\.cdef)\b/],
  [".NET P/Invoke", /\[(DllImport|LibraryImport)\(/],
  ["JNI / Panama", /(System\.loadLibrary|JNIEXPORT|java\.lang\.foreign|\bnative\s+\w+\s*\()/],
  ["cgo", /^\s*import\s+"C"\s*$/m],
  ["Rust C ABI", /extern\s+"C"\s*(\{|fn)|#\[no_mangle\]|#\[unsafe\(no_mangle\)\]/],
  ["WebAssembly", /\b(wasm_bindgen|WebAssembly\.(instantiate|compile)|wasm-pack|emscripten|EMSCRIPTEN_KEEPALIVE)\b/],
  ["Sidecar / subprocess", /\b(child_process|execFile\(|spawn\(|subprocess\.(run|Popen|call)|Process\.Start\(|exec\.Command\(|utilityProcess)\b/],
  ["gRPC / IPC", /(@grpc\/|\bgrpc\b|\bgRPC\b|\bprotobuf\b|\bzeromq\b|\bzmq\b|\bnanomsg\b|\bio\.aeron\b|\bAdaptive\.Aeron\b|\baeron\.h\b|\bAeron\.(connect|Context)\b)/],
];

const DYNAMIC = new Set(["JavaScript", "TypeScript", "Python", "Ruby", "PHP", "Lua", "Perl", "R"]);
const COMPUTE = /\b(Uint8Array|Uint8ClampedArray|Int16Array|Int32Array|Uint32Array|Float32Array|Float64Array|DataView|Buffer\.alloc\w*|Math\.(sqrt|sin|cos|atan2|pow|floor|round)|struct\.(un)?pack|bytearray|memoryview|range\(len\()|Math\.(min|max)|charCodeAt|>>>|<<\s*\d|&\s*0x[0-9a-f]+/gi;
const TOOLING = /(^|\/)(scripts?|tools?|ci|\.github|hack|devtools)\//i;
const RELATIVE_IMPORT = /(?:require\(\s*|import\(\s*|\bfrom\s+|^\s*import\s+)['"](\.{1,2}\/[^'"]+)['"]/gm;
const RESOLVE_EXT = ["", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".mts", ".cts", ".json", ".node", "/index.js", "/index.ts", "/index.mjs", "/index.tsx"];

// Loop lines that follow another loop line within 3 lines: a cheap proxy for nested loops.
function nestedLoops(lines) {
  let n = 0, last = -10;
  lines.forEach((l, i) => {
    const hits = (l.match(/\b(for|while)\b\s*[\s(]/g) || []).length;
    if (hits === 0) return;
    if (hits > 1 || i - last <= 3) n++;
    last = i;
  });
  return n;
}

const SKIP_DIRS = new Set([
  ".git", "node_modules", "dist", "build", "out", "target", "vendor", "bin", "obj", ".next", ".nuxt", ".svelte-kit",
  ".venv", "venv", "env", "__pycache__", ".tox", ".mypy_cache", ".pytest_cache", "coverage", ".gradle", ".idea",
  ".vscode", "Pods", "DerivedData", ".turbo", ".cache", "third_party", "external", "deps", "release",
]);
const GENERATED = /(\.min\.(js|css)$|\.bundle\.js$|\.map$|\.lock$|-lock\.(json|yaml)$|\.pb\.(go|cc|h)$|_pb2\.py$|\.g\.(cs|dart)$|\.designer\.cs$|\.generated\.\w+$|\.d\.ts$|(^|\/)generated\/)/i;
const MAX_BYTES = 1_000_000;
const TEST = /(^|\/)(tests?|__tests__|spec|specs|fixtures|testdata|e2e|benchmarks?)\/|\.(test|spec|bench)\.\w+$|_test\.(go|py)$|(^|\/)test_[^/]+\.py$|Tests?\.cs$|Test\.(java|kt)$/i;
const FAMILY = {
  JavaScript: "JS/TS", TypeScript: "JS/TS", Vue: "JS/TS", Svelte: "JS/TS", Astro: "JS/TS",
  C: "C/C++", "C++": "C/C++", "C/C++ header": "C/C++", "Objective-C": "C/C++", "Objective-C++": "C/C++",
  Python: "Python", Cython: "Python", Java: "JVM", Kotlin: "JVM", Scala: "JVM", Groovy: "JVM", Clojure: "JVM",
  "C#": ".NET", "F#": ".NET", "Visual Basic": ".NET", Elixir: "BEAM", Erlang: "BEAM",
};
const NO_TOOLCHAIN = /^(SQL|Shell|PowerShell|Batch|WGSL|GLSL|HLSL|Metal|WebAssembly text)$/;

function git(argv) {
  try {
    return execFileSync("git", ["-C", ROOT, ...argv], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

// Vendored directories are not scanned, but are reported: a vendored pure-language codec or parser is a prime candidate.
const VENDOR_DIRS = new Set(["vendor", "third_party", "external", "deps"]);
const vendored = new Map();

function listFiles() {
  const out = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
  if (out !== null) {
    const all = out.split("\0").filter(Boolean);
    for (const f of all) {
      const parts = f.split("/");
      const i = parts.findIndex((p) => VENDOR_DIRS.has(p));
      if (i >= 0 && LANGS[extname(f).toLowerCase()]) {
        const dir = parts.slice(0, i + 1).join("/");
        vendored.set(dir, (vendored.get(dir) || 0) + 1);
      }
    }
    return { viaGit: true, files: all.filter((f) => !f.split("/").some((p) => SKIP_DIRS.has(p))) };
  }
  const files = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (VENDOR_DIRS.has(e.name)) vendored.set(relative(ROOT, join(dir, e.name)).split(sep).join("/"), 0);
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(join(dir, e.name));
      }
      else if (e.isFile()) files.push(relative(ROOT, join(dir, e.name)).split(sep).join("/"));
    }
  };
  walk(ROOT);
  return { viaGit: false, files };
}

function moduleOf(file) {
  const parts = file.split("/");
  if (parts.length <= 1) return "(root)";
  const containers = new Set(["src", "lib", "packages", "apps", "services", "crates", "cmd", "internal", "pkg", "modules", "native", "libs", "app"]);
  return containers.has(parts[0]) && parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts[0];
}

const { viaGit, files } = listFiles();
const perFile = new Map();
const langs = new Map();
const manifests = [];
const interop = new Map();
const modules = new Map();
const unresolved = [];

for (const f of files) {
  const name = basename(f);
  if (MANIFESTS[name]) manifests.push({ file: f, ecosystem: MANIFESTS[name] });
  else if (MANIFEST_EXT[extname(name).toLowerCase()]) manifests.push({ file: f, ecosystem: MANIFEST_EXT[extname(name).toLowerCase()] });

  const lang = LANGS[extname(name).toLowerCase()];
  if (!lang || GENERATED.test(f)) continue;
  const abs = join(ROOT, f);
  let text;
  try {
    if (statSync(abs).size > MAX_BYTES) continue;
    text = readFileSync(abs, "utf8");
  } catch { continue; }
  if (text.includes("\0")) continue;

  const lines = text.split(/\r?\n/);
  const code = lines.filter((l) => l.trim().length > 0).length;
  if (code > 0 && text.length / code > 400) continue; // minified or generated blob
  const compute = DYNAMIC.has(lang) ? (text.match(COMPUTE) || []).length + 3 * nestedLoops(lines) : 0;
  if (lang === "JavaScript" || lang === "TypeScript") {
    for (const m of new Map([...text.matchAll(RELATIVE_IMPORT)].map((x) => [x[1], x])).values()) {
      const target = join(ROOT, f, "..", m[1]);
      const base = target.replace(/\.(js|mjs|cjs|jsx)$/, "");
      if (!RESOLVE_EXT.some((ext) => existsSync(target + ext) || existsSync(base + ext))) unresolved.push({ file: f, import: m[1] });
    }
  }
  perFile.set(f, { file: f, lang, code, compute, test: TEST.test(f), commits: 0, fixes: 0, perf: 0 });

  const L = langs.get(lang) || { lang, files: 0, code: 0 };
  L.files++; L.code += code; langs.set(lang, L);

  const m = moduleOf(f);
  const M = modules.get(m) || { module: m, code: 0, langs: new Map(), commits: 0, fixes: 0, perf: 0 };
  M.code += code; M.langs.set(lang, (M.langs.get(lang) || 0) + code); modules.set(m, M);

  for (const [mechanism, re] of INTEROP) {
    if (re.test(text)) {
      // Subprocess calls in scripts/tooling are shell-outs, not a process boundary in the product.
      const label = mechanism === "Sidecar / subprocess" && TOOLING.test(f) ? "Shell-out in tooling (not a sidecar)" : mechanism;
      const I = interop.get(label) || { mechanism: label, files: [] };
      I.files.push(f); interop.set(label, I);
    }
  }
}

// Churn, bug-fix and perf-fix density from git history.
const FIX = /\b(fix(e[sd])?|bug|crash|leak|race|deadlock|overflow|segfault|panic|hotfix|regression|null|undefined)\b/i;
const PERF = /\b(perf|performance|slow\w*|optimi[sz]\w*|speed(up)?|latency|memory|oom|freez\w*|froze\w*|hang\w*|lag|lags|laggy|lagging|jank\w*|stutter\w*|timeout\w*|cpu|gc|block(s|ed|ing)?)\b/i;
let history = { available: false, commits: 0 };
const log = viaGit ? git(["log", `--since=${opt.months}.months`, "--no-merges", "--format=\u0001%s", "--name-only"]) : null;
if (log) {
  history = { available: true, commits: 0 };
  for (const chunk of log.split("\u0001").slice(1)) {
    const [subject, ...rest] = chunk.split("\n");
    history.commits++;
    const isFix = FIX.test(subject), isPerf = PERF.test(subject);
    const touched = new Set();
    for (const f of rest.map((s) => s.trim()).filter(Boolean)) {
      const pf = perFile.get(f);
      if (!pf) continue;
      pf.commits++; if (isFix) pf.fixes++; if (isPerf) pf.perf++;
      touched.add(moduleOf(f));
    }
    for (const m of touched) { // each commit counts once per module
      const M = modules.get(m);
      M.commits++; if (isFix) M.fixes++; if (isPerf) M.perf++;
    }
  }
}

const totalCode = [...langs.values()].reduce((s, l) => s + l.code, 0) || 1;
const pct = (n) => `${((100 * n) / totalCode).toFixed(1)}%`;
const top = (arr, key, n = opt.top) => [...arr].sort((a, b) => b[key] - a[key]).slice(0, n);

const languageRows = top(langs.values(), "code", 100).map((l) => ({ ...l, share: pct(l.code) }));
const moduleRows = top(modules.values(), "code").map((m) => ({
  module: m.module, code: m.code, commits: m.commits, fixes: m.fixes, perf: m.perf,
  languages: [...m.langs.entries()].sort((a, b) => b[1] - a[1]).map(([l, c]) => `${l} ${Math.round((100 * c) / (m.code || 1))}%`).join(", "),
}));
const prod = [...perFile.values()].filter((p) => !p.test);
const hotspots = top(prod.map((p) => ({ ...p, score: p.code * Math.max(p.commits, history.available ? 0 : 1) })).filter((p) => p.score > 0), "score");
const computeRows = top(prod.filter((p) => p.compute >= 4).map((p) => ({ ...p, density: +(p.compute / Math.max(p.code, 1) * 100).toFixed(1) })), "compute");
const interopRows = [...interop.values()].map((i) => ({ mechanism: i.mechanism, count: i.files.length, examples: i.files.slice(0, 3) }));
// A family (toolchain) other than the dominant one with little code is a consolidation lead.
const families = new Map();
for (const l of languageRows) {
  if (NO_TOOLCHAIN.test(l.lang)) continue;
  const fam = FAMILY[l.lang] || l.lang;
  const F = families.get(fam) || { lang: fam, code: 0, files: 0 };
  F.code += l.code; F.files += l.files; families.set(fam, F);
}
const mainFamily = top(families.values(), "code", 1)[0];
const minorLangs = [...families.values()].filter((f) => f !== mainFamily && f.code < 1000);

const result = {
  root: ROOT, source: viaGit ? "git" : "filesystem", months: opt.months, totals: { files: perFile.size, code: totalCode },
  languages: languageRows, manifests, interop: interopRows, modules: moduleRows, hotspots, computeHeavyDynamicFiles: computeRows,
  smallFootprintLanguages: minorLangs.map((l) => l.lang), history,
  vendoredDirs: [...vendored.entries()].map(([dir, sourceFiles]) => ({ dir, sourceFiles })),
  unresolvedRelativeImports: unresolved,
};

if (opt.json) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const table = (headers, rows) => {
  if (!rows.length) return "_none found_\n";
  return [`| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n") + "\n";
};
const out = [];
out.push(`# polythis inventory: ${basename(ROOT)}\n`);
out.push(`Source: ${result.source} · ${perFile.size} source files · ${totalCode} non-blank lines · history window: ${history.available ? `${opt.months} months, ${history.commits} commits` : "unavailable"}\n`);
out.push(`## Languages\n`);
out.push(table(["Language", "Files", "Lines", "Share"], languageRows.map((l) => [l.lang, l.files, l.code, l.share])));
out.push(`## Build manifests\n`);
out.push(table(["File", "Ecosystem"], manifests.slice(0, 40).map((m) => [`\`${m.file}\``, m.ecosystem])));
out.push(`## Existing interop and process boundaries\n`);
out.push(table(["Mechanism", "Files", "Examples"], interopRows.map((i) => [i.mechanism, i.count, i.examples.map((e) => `\`${e}\``).join(", ")])));
out.push(`## Modules (largest first)\n`);
out.push(table(["Module", "Lines", "Languages", "Commits", "Fix commits", "Perf commits"], moduleRows.map((m) => [`\`${m.module}\``, m.code, m.languages, m.commits, m.fixes, m.perf])));
out.push(`## Hotspots (${history.available ? "lines × commits" : "largest files; no git history"}, tests excluded)\n`);
out.push(table(["File", "Language", "Lines", "Commits", "Fixes", "Perf"], hotspots.map((h) => [`\`${h.file}\``, h.lang, h.code, h.commits, h.fixes, h.perf])));
out.push(`## Compute-heavy patterns in dynamic languages (heuristic)\n`);
out.push(table(["File", "Language", "Lines", "Pattern hits", "Hits per 100 lines"], computeRows.map((c) => [`\`${c.file}\``, c.lang, c.code, c.compute, c.density])));
out.push(`## Small-footprint languages (consolidation candidates)\n`);
out.push(minorLangs.length ? minorLangs.map((l) => `- ${l.lang}: ${l.code} lines in ${l.files} files (main toolchain: ${mainFamily.lang})`).join("\n") + "\n" : "_none_\n");
out.push(`## Vendored code (not scanned)\n`);
out.push(vendored.size ? [...vendored.entries()].map(([d, n]) => `- \`${d}\`${n ? `: ${n} source files` : ""}`).join("\n") + "\n" : "_none_\n");
out.push(`## Unresolved relative imports (JS/TS)\n`);
out.push(unresolved.length ? unresolved.slice(0, 20).map((u) => `- \`${u.file}\` → \`${u.import}\``).join("\n") + "\n" : "_none_\n");
out.push(`\n> Heuristic snapshot. Signals mark candidates, not verdicts. Confirm with profiles, benchmarks, and the SKILL.md workflow.`);
console.log(out.join("\n"));
