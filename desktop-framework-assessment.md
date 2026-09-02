# Desktop framework assessment

Date: 2026-09-01

## Recommendation

Use Tauri 2 for the first desktop version. Keep the frontend portable so that Electron remains a practical fallback.

Tauri fits the trust model of this app. Pull request text, comments, and repository data are untrusted. The app also needs strong local powerslet's . It will read Git repositories and Codex traces, start a Codex process, store a GitHub token, and upload selected output. Tauri lets the webview call a small set of Rust commands through named capabilities. Its runtime rejects calls that do not have permission. The shell plugin also blocks dangerous commands until the app grants a scope. [Tauri capability reference](https://v2.tauri.app/reference/acl/capability/) [Tauri shell plugin](https://v2.tauri.app/plugin/shell/)

Electron is the safer schedule choice if the team wants to stay in TypeScript. It has the most mature desktop stack and one bundled Chromium version on all supported systems. It also puts more security work on the app. Electron warns that web bugs have more impact in a desktop app with system access. A secure app must keep Node.js out of the renderer, use context isolation and sandboxing, validate IPC senders, and expose a narrow preload API. [Electron security guide](https://www.electronjs.org/docs/latest/tutorial/security) [Electron process model](https://www.electronjs.org/docs/latest/tutorial/process-model)

Do not use GPUI for version one. GPUI can render large custom views, and Zed proves the model can support a code editor. The framework README still calls GPUI pre-1.0 and warns about frequent breaking changes. It also says that reading Zed source is still the best way to learn many APIs. That cost is hard to justify when this app needs a rich review interface, not a new native UI toolkit. [GPUI README](https://github.com/zed-industries/zed/blob/main/crates/gpui/README.md)

## Comparison

| Area | Electron | Tauri 2 | GPUI |
| --- | --- | --- | --- |
| Maturity | Highest. Electron has an eight-week major release cycle and supports the latest three stable releases. [Release policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines) | Stable since October 2024. Tauri 2 has active releases, official plugins, distribution tools, and security audits. [Tauri 2 stable release](https://v2.tauri.app/blog/tauri-20/) [Framework overview](https://v2.tauri.app/start/) | Lowest. It is version 0.2.2 and pre-1.0. Its README warns about breaking changes. [Manifest](https://github.com/zed-industries/zed/blob/main/crates/gpui/Cargo.toml) [README](https://github.com/zed-industries/zed/blob/main/crates/gpui/README.md) |
| Desktop reach | macOS, Windows, and Linux. Electron ships its own Chromium and Node.js. [Electron introduction](https://www.electronjs.org/docs/latest/) | macOS, Windows, and Linux. It uses WKWebView, WebView2, and WebKitGTK. [Tauri process model](https://v2.tauri.app/concept/process-model/) | macOS, Windows, Linux, and FreeBSD are in the current platform package. [GPUI README](https://github.com/zed-industries/zed/blob/main/crates/gpui/README.md) [Platform package](https://github.com/zed-industries/zed/blob/main/crates/gpui_platform/Cargo.toml) |
| Diff UI | Best browser consistency. Chromium supports the web component, syntax highlighting, selection, search, and list virtualization tools that a review UI needs. | Strong web UI support. Almost any frontend framework works. The system webview makes cross-system rendering less consistent, so the app must test each target. [Frontend support](https://v2.tauri.app/start/) [Webview versions](https://v2.tauri.app/reference/webview-versions/) | Full control and fast custom rendering. GPUI documents efficient views for large lists and custom editor layout. There is no DOM, CSS engine, or ready web diff stack. [GPUI README](https://github.com/zed-industries/zed/blob/main/crates/gpui/README.md) |
| Local files and processes | The main process has Node.js file and process APIs. A utility process can isolate long work. The renderer must use narrow IPC. [Utility process](https://www.electronjs.org/docs/latest/api/utility-process) | Rust commands can use native file, Git, HTTP, and process libraries. The shell plugin can start a child process with command and argument scopes. [Shell plugin](https://v2.tauri.app/plugin/shell/) | Rust code has direct access to native libraries and operating system APIs. GPUI does not add a separate privilege boundary between the UI and this code. |
| Security boundary | Chromium sandboxes renderers by default. The main process remains privileged. Electron gives detailed hardening guidance, but the app must apply it. [Sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox) [Security guide](https://www.electronjs.org/docs/latest/tutorial/security) | The runtime checks the origin, capability, command, and scope before it runs a native command. This maps well to separate Git, trace, GitHub, and Codex operations. [Runtime authority](https://v2.tauri.app/security/runtime-authority/) | There is no web renderer that can run injected JavaScript. There is also no documented capability system. The app must define all trust checks in Rust. This is an inference from GPUI's native application model. [GPUI README](https://github.com/zed-industries/zed/blob/main/crates/gpui/README.md) |
| GitHub token storage | `safeStorage` uses macOS Keychain, Windows DPAPI, and available Linux secret stores to protect encryption keys. The app stores the encrypted token itself. [safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) | Tauri has an official Stronghold encrypted vault. It is not the operating system keychain. For the stated requirement, add a small Rust keychain bridge and keep it outside the webview. [Stronghold plugin](https://v2.tauri.app/plugin/stronghold/) | GPUI has no credential store. Use a Rust keychain library or direct platform API. |
| Package size and memory | Electron bundles Chromium and Node.js. This raises the package and baseline process cost. Electron does not publish one standard app size or memory number that supports a fair comparison. [Electron introduction](https://www.electronjs.org/docs/latest/) | Tauri uses the installed system webview. Tauri says a minimal app can be less than 600 KB. That is not an estimate for this full app. [Tauri overview](https://v2.tauri.app/start/) | GPUI does not bundle Chromium. I found no official package size or memory figure. Do not use community benchmarks as a product estimate. |
| Updates and signing | Electron has signing guides and a built-in updater for macOS and Windows. Linux updates normally use the package manager. Open-source apps on GitHub can use Electron's update service. [Distribution](https://www.electronjs.org/docs/latest/tutorial/distribution-overview) [Updater](https://www.electronjs.org/docs/latest/api/auto-updater/) | Tauri creates system installers and has signing and notarization guides. Its updater supports all three desktop systems and requires a cryptographic update signature. [Distribution](https://v2.tauri.app/distribute/) [Updater plugin](https://v2.tauri.app/plugin/updater/) | GPUI provides UI and platform APIs, not a complete app distribution system. I found no GPUI-owned updater or signing workflow. The app would need separate packaging and update code. |
| Accessibility | HTML semantics feed Chromium's accessibility tree. Electron turns support on when it detects assistive technology. [Electron accessibility](https://www.electronjs.org/docs/latest/tutorial/accessibility) | Standard HTML semantics use the system webview accessibility tree. Results can vary with the operating system webview, so each release needs VoiceOver and screen reader tests. This is an inference from Tauri's system webview model. [Tauri process model](https://v2.tauri.app/concept/process-model/) | GPUI now uses AccessKit and supports roles, values, labels, and actions. Custom controls must add those details themselves. [GPUI accessibility guide](https://github.com/zed-industries/zed/blob/main/crates/gpui/src/_accessibility.rs) [Accessibility example](https://github.com/zed-industries/zed/blob/main/crates/gpui/examples/a11y.rs) |
| Tests and debugging | Chromium DevTools work in renderer processes. Electron documents automated testing, and Playwright supports Electron automation. [Debugging](https://www.electronjs.org/docs/latest/tutorial/application-debugging) [Automated testing](https://www.electronjs.org/docs/latest/tutorial/automated-testing) | Web Inspector and Rust tools cover local debugging. Tauri documents WebdriverIO tests on macOS, Windows, and Linux. [WebDriver tests](https://v2.tauri.app/develop/tests/webdriver/) | GPUI has a test macro, simulated input, headless contexts, profiling support, and an inspector feature. The end-to-end and release tooling is less complete. [GPUI README](https://github.com/zed-industries/zed/blob/main/crates/gpui/README.md) [GPUI manifest](https://github.com/zed-industries/zed/blob/main/crates/gpui/Cargo.toml) |
| Toolchain cost | JavaScript or TypeScript, Node.js, and system signing tools. This is the lowest language cost for a web team. | TypeScript for the UI, Rust for trusted local commands, and system build tools. Each target needs a native build runner. | Rust for the full app and native platform tools. The macOS setup requires Xcode. The team must build more controls and app services. [GPUI setup](https://github.com/zed-industries/zed/blob/main/crates/gpui/README.md) |
| License | MIT. [License](https://github.com/electron/electron/blob/main/LICENSE) | MIT or Apache-2.0. [License manifest](https://github.com/tauri-apps/tauri/blob/dev/LICENSE.spdx) | The GPUI crate declares Apache-2.0. [GPUI manifest](https://github.com/zed-industries/zed/blob/main/crates/gpui/Cargo.toml) |

There is no official, comparable memory benchmark for all three frameworks. Any useful number will come from this app and its real diff workload.

## Proposed Tauri shape

Keep the webview unprivileged. Put GitHub calls and all local access in the Rust core.

```text
Web review UI
  |
  | named commands with typed input
  v
Rust core
  |-- GitHub client and OAuth flow
  |-- Git repository reader
  |-- Codex trace reader
  |-- Codex process client
  |-- operating system keychain bridge
  `-- optional guide uploader
```

Do not grant a general shell permission to the webview. Add small commands such as `list_repositories`, `load_pull_request_diff`, `read_codex_trace`, and `start_codex_server`. Validate repository paths, process arguments, GitHub URLs, and upload targets in Rust.

## Staged choice

Start with one short Tauri spike. Use the same frontend packages that could run in Electron.

The spike must prove these paths:

1. Render and scroll a large real pull request with syntax highlighting, inline comments, search, long lines, and keyboard navigation.
2. Complete GitHub sign-in and store the token in macOS Keychain through a narrow Rust command.
3. Read one local repository and one Codex trace through scoped commands.
4. Start the planned Codex app-server or CLI, stream its output, cancel it, and clean up the child process.
5. Build, sign, notarize, install, and update a macOS package.

If the diff view fails because of WKWebView behavior, run the same web UI in Electron before changing the UI design. If Rust work delays the product more than it protects the local boundary, switch the shell to Electron and keep the command interface. Do not move to GPUI unless measurements show that both web shells fail and native rendering has become a core product requirement.

## Unknowns to resolve in the spike

- The Codex app-server or CLI contract may decide how much process supervision the shell needs.
- The token bridge needs a selected Rust keychain library and a security review. Stronghold alone does not meet the operating system keychain requirement.
- WebKit performance with the chosen diff and syntax packages is unknown.
- Linux support will need tests across WebKitGTK versions and secret-store setups.
- The app needs its own package size, idle memory, large-diff memory, startup time, and scroll latency measurements. Framework marketing numbers cannot answer those questions.
