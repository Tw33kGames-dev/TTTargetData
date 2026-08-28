Tw33k Tools - Target Data (Walkthrough, v1.0.4)

A free Tampermonkey userscript that works on any browser that allows scripts. A mini-DevTools built for diagnosing what the frontend is doing - what it stores, what it sends, what it's built from - without opening real browser DevTools or writing any code.

How it starts
Drops a single small floating button on any page (right edge, mid-screen by default - drag it anywhere). 

Everything lives behind one dropdown at the top of the panel. Sections are grouped loosely below by what they're for; switch freely, nothing resets when you do.

Reading the page itself

DOM (full page HTML) - the whole rendered page as one searchable, copyable text dump. Refresh re-scans; nothing here auto-updates.

Element inspector (pick from page) - tap Pick element and the panel shrinks into a small draggable box you can drag out of the way; tap anything on the actual page to inspect it. Shows tag, id, classes, attributes, dataset, its own text, its children, dimensions, and a couple of CSS selectors that would find it again.

Computed CSS is grouped into five categories - Layout, Box Model, Typography, Visual, Flex/Grid - covering roughly 40 properties, rather than one flat list.

Ancestors (possible event delegation targets) shows up to 10 parent elements as a compact color-coded chip list above the usual text dump: each ancestor gets flagged "looks interactive" if it's a native interactive tag (a, button, input, etc.), has an interactive role, has tabindex, has an inline on= handler, or computes cursor: pointer. This is a heuristic, not proof - a real JS-attached listener (addEventListener) genuinely cannot be enumerated from a userscript in any browser; that limitation is the same reason "associated events" below only ever shows inline handlers. "Looks interactive" tells you where a click is plausible, not confirmed.

Associated events only ever shows inline on*="..." HTML attributes on the picked element itself - almost no modern site still attaches handlers that way. Don't read an empty list as "nothing happens when you click this."

window globals / localStorage & sessionStorage / Cookies - straightforward browse-and-copy views of what the page has sitting in each.

Watching what it does

Traffic history - every network request the page makes, any host, as it happens. Each entry shows full request/response headers (collapsed by default), body, timing, and where in the page's own code the call came from when that's detectable.

Two filter tools work together, all narrowing the same list (AND, not OR):
- The existing URL search box and the "recorded only" / "problems only" (4xx/5xx, or slower than a second) checkboxes.
- A separate Payload filter box supporting a small query language, space-separated terms, all of which must match:
- a plain word - substring match against request/response body
- key=value - matches any JSON key at any depth (case-insensitive)
- key>N / key=N / key<=N - numeric comparison against any JSON key
- key:N-M - inclusive numeric range

Matched entries show a green "matched: ..." badge naming exactly which term hit and its actual value - never a silent filter. "Copy all" respects whatever's currently filtered, so a filtered copy never accidentally includes the rest.

Replay / Edit - from any Traffic entry's detail view, edit its method, URL, headers, or body and fire it against the live server, with a confirmation prompt first naming exactly what's about to happen.

Send mode - a Standard / Privileged toggle at the top of the editor, chosen explicitly each time (defaults back to Standard whenever the editor opens fresh):
- Standard uses the page's own fetch(). Cookie, Host, Origin, Referer, and a handful of other headers are blocked by the Fetch spec itself here - typing them into the headers box does nothing, and that's the browser's restriction, not this tool's.
- Privileged uses GM_xmlhttpRequest, dispatched from the userscript manager rather than the page's own fetch/XHR. This is the only way either mode can even attempt Cookie/Origin/Referer, but it's worth understanding what's actually happening: userscript managers get these past the browser via a browser-level trick (a blocking webRequest header swap), and Chrome removed the API that trick depends on in Manifest V3. Whether it works at all depends entirely on your specific browser and userscript manager version, and it can fail two different ways - silently stripped, or sent with a mangled/salted header name instead of the real one. Cookie specifically tends to append to the real cookie jar rather than replacing it, even in the cases where it does work. Host still can't be touched by either mode - that's tied to the connection itself, not a header value. Requests sent this way won't show up in the page's own Network tab, and some sites can tell an extension-originated request apart from a page-originated one. Only available if the userscript manager granted GM_xmlhttpRequest; the option is disabled otherwise.

Test header pass-through - a button that appears only in Privileged mode, for finding out what your specific setup actually does instead of trusting the description above. Runs two real steps: first sets a genuine "control" cookie on a public test domain via a real Set-Cookie response, so there's an actual cookie in the jar to test against rather than an empty one; then sends a probe request carrying test Origin/Referer/Cookie values and reports exactly what the far end received. Origin and Referer each come back as one of passed through cleanly / appended / stripped / mangled. Cookie gets a more detailed readout specifically because "appended" and "genuinely overrode" look identical without a real cookie to compare against - the control-cookie step tells them apart, reporting separately whether the control cookie survived and whether the typed-in value made it through. Host is shown for reference alongside the results, labeled clearly as never-settable by either mode.

Sending always shows exactly which headers (if any) got stripped and why, and every result is tagged with which send mode actually carried it - never left ambiguous after the fact.

A Session history list sits below the result: every send this session gets appended (in-memory only, cleared on page reload). Tapping a past entry reloads its draft and the result it got back into the editor, so you can see what happened and then tweak and send again - that becomes its own new entry, nothing is overwritten.

Parameter sweep - put a placeholder token (default {{VALUE}}) anywhere in the URL, headers, or body above, list out values (comma or newline separated), and it sends one real request per value with that token substituted in, at least 150ms apart. Validates the placeholder actually appears somewhere before letting you run it, so a typo can't silently do nothing. Confirmed before it starts, since it's a real batch of live requests; stoppable mid-run; results logged per value (status/duration, or the error).

Repeat / automation - sends the exact current draft on an interval instead of once: configurable interval (500ms floor, enforced regardless of what's typed) and a max-runs count, or 0 for "until stopped." Confirmed before starting, live run log, stop control. Both the sweep and automation get cleaned up automatically if you close the editor or open a different request.

Network waterfall gives the same data as a small timing chart; Hosts summary and Duplicate requests surface who the page talks to and any suspicious repeated-call bursts. Observed endpoints quietly builds a catalog of every distinct endpoint it's ever seen, persisted across page loads, so it gets more useful the more you browse.

Compare traffic across page loads - Traffic history is in-memory and clears on reload, so there's normally no way to see "before" vs "after" a page load. This section saves a snapshot on demand (hosts contacted with counts, total/problem request counts, and an endpoint list) that survives reloads - unlike Traffic history itself. Save one now, reload or navigate, save another, then diff any two saved snapshots against each other: hosts added/removed/changed with counts, and endpoints unique to each side. Snapshots persist across reloads and have their own clear-all control in Settings.

WebSocket activity - the same idea for real-time connections instead of one-off requests: every WebSocket the page opens, every message in both directions, JSON messages decoded automatically.

Off by default. A WebSocket is often a continuous stream of a website's real-time state rather than a one-off request, so capturing it out of the box was judged a little too invasive - a toggle at the top of this panel turns it on or off, and the choice persists across reloads. Turning it on takes effect immediately, no reload needed. Turning it off is confirmed first and takes effect on the next reload (a connection already open keeps being tracked until then); already-captured connections and messages stay visible either way until you reload or clear them.

With capture on: a Hook status line and a Test connect button let you confirm the capture mechanism itself is working, independent of whether the specific site you're on happens to use WebSockets at all - Test connect opens a real connection to a public echo server (wss://echo.websocket.org), so this can be checked on literally any page, not just one that opens its own WebSocket.

Same payload filter mini-language as Traffic works here too (keyword / key=value / numeric compare / range), applied to each message's text/JSON. Above the message list sits a message-flow timeline: every message as a small colored tick positioned by its actual timestamp along the connection's observed span (green = received, blue = sent), so bursts and gaps in traffic are visible at a glance rather than only readable by scrolling a chronological list. Tapping a tick selects that message, same as tapping its row in the list below. "Copy all" respects the active filter.

A Connections / Message catalog / Send-Sequence set of tabs switches between three views:
- Connections - the usual per-connection message list.
- Message catalog - every message seen so far grouped by connection URL, direction, and shape (its sorted top-level JSON keys, or a plain marker for non-JSON/binary messages) - the WebSocket equivalent of Traffic's endpoint catalog, computed live from whatever's currently captured rather than stored separately.
- Send / Sequence - where sending lives. Pick a target connection (only ones still open can actually receive a send), then either:
  - Modify & resend - a text box prefilled with the connection's most recent message, editable, sent with one confirm. A "Resend..." shortcut on any individual message in the Connections view jumps straight here with that message loaded.
  - Scripted sequence - build an ordered list of messages, each with its own delay-before-send, and run the whole sequence against the live connection. Confirmed once before it starts (not per-step, since that would defeat the point of automation), stoppable mid-run, live log of each step's result. Sequences can be saved by name and reloaded later, or deleted - persisted across reloads. Stops automatically if a send fails or the connection closes.

Page load timing - a breakdown of the current page's own load (DNS, TCP, TLS, time to first byte, DOM processing, and so on) from the browser's own Navigation Timing data. Reflects the last real page load only - it won't update just because you clicked around within the same load.

Script sources - every script tag on the page, inline content shown directly, external files fetched on request so you can read the real source. A "Run a script from any URL" card sits above the list - not limited to scripts this tool found on the current page; paste any script URL, fetch it (subject to the same CORS restrictions as any other fetch from here), and it gets the same actions as anything else found here. From any expanded script (or a fetched-from-anywhere one):
- Test in Sandbox - test-run it in isolation (see Script Sandbox below).
- Run on Live Page - runs it directly against the real page, the same way the JS Console does, with the same Page context / Isolated (bypass CSP) mode choice available here too - a small pill row above the script text picks which one, confirmed every time before it runs.
- Copy, as before.

Finding specific things

Value Tracer - type in a value you can see on the page (a price, a name, an id) and it finds every place that value shows up: DOM text, window globals, and JSON paths inside every response this session has captured. Substring match, case-sensitive, deliberately not fuzzy. Three modes at the top: Live, History, Correlate.

Live runs a fresh trace and, every run, automatically saves it to History - persisted across page loads and sessions, unlike Traffic and Replay history, this one survives a refresh. History groups saved traces by hostname (same hostname counts as one group regardless of path, since a "session" has no other natural boundary for a cross-domain tool), newest first. Tapping a past trace expands it read-only using the exact same results view a live trace uses. The full snapshot is kept - not just network hits - so DOM/window-global matches stay part of the historical record even though they can't be re-verified on a later page load. History size is capped (default 150 entries, adjustable in Settings) and supports Export/Import via copy-paste (merges rather than replaces, deduplicated).

Correlate compares your own past traces against each other, in one of two modes:
- Track one value - pick a hostname, then a term that's been traced 2+ times against it, and see: Persistent (locations - a DOM selector, a window global, a network URL+JSON path - that showed up in every trace), Intermittent (showed up sometimes, not always), and New / Gone since your first trace (comparing your earliest and most recent trace of that term specifically).
- Compare two values - pick two different previously-traced terms (a "was" and an "is now," e.g. a stat that read 100 and later read 150) and see which locations held both at different points, with a best-effort note on which was seen first - or "interleaved" if your traces of the two don't cleanly separate in time, rather than asserting an order the data doesn't actually support.

Both modes are entirely a diff of your own saved trace history against itself. Timing and recurrence are hints worth following.

Token Inspector - scans storage, cookies, and captured traffic for anything token-shaped (by name - session, auth, bearer, and the like - or by being a well-formed JWT regardless of name). JWTs get fully decoded: header, payload, and an expiry status computed straight from the token's own exp claim.

Payload anomaly flags run automatically alongside every decoded JWT - heuristic checks against the token's own unsigned claims: alg: none, internally-inconsistent exp/iat/nbf timestamps, a missing exp claim, an unusually long lifetime, sensitive-looking field names sitting in the payload (a reminder that JWT payloads are encoded, not encrypted), missing sub/iss/aud claims, a path-like kid header (a known pattern associated with kid-injection attacks against poorly-implemented verifiers), and non-standard typ values. Every flag is exactly that - a flag, not a finding: none of this verifies a signature, which needs the issuing server's key and isn't available client-side, so treat both the payload and the anomaly flags as "what this token claims," not "confirmed genuine" or "confirmed broken."

Anything that isn't a real JWT (most session ids) shows as-is with an honest note that it can't be decoded further. Find where sent runs a fresh search against captured traffic for whichever token you're looking at.

A Scanned / Vault toggle at the top switches between the live scan results and a saved vault:
- Save to vault on any scanned token (with an optional label) keeps it around even after it rotates out of storage or falls out of traffic history.
- The vault is deliberately in-memory only, never written to disk - unlike most of this tool's other saved data, since this is real credential material. It's cleared on reload, same as if you'd never saved it.
- Send with this token... on any token (scanned or vaulted) opens Replay/Edit prefilled with the right header - reconstructs Authorization: Bearer <token> if it came from an Authorization header, or the exact header name/value otherwise - so sending and replaying a specific credential reuses the same editor, session history, sweep, and automation tools described above rather than a separate mechanism.

This is real credential material for whatever's logged into the current page - treat a decoded token, or anything sent with it, the way you'd treat a password.

Event Debugger - a standalone panel, separate from the Investigation Recorder below, for watching one specific element/event pair at a time. Pick an element (same picker as Element inspector), choose a built-in event type or name a custom DOM event, and optionally list window globals to watch. Every firing logs the target, any diffs in the globals you named (before -> after), and any network requests that landed within 1.5 seconds afterward, cross-referenced against Traffic history and linked straight to the matching entry there - with the same "timing is a hint, not proof" caveat as everything else that correlates by timestamp in this tool. Multiple watches can run at once; each has its own Remove button, and Remove all / Clear log sit above the watch list and log respectively, independent of each other.

This does not accept or run any code you write - it only logs. For running code automatically on an event, see the JS Console's event-driven automation below.

DOM Mutation Watcher - Event Debugger's sibling, for changes that aren't tied to any specific user-triggered event at all: a value that ticks up on a timer, an HP bar that updates in response to something arriving over WebSocket, anything the game changes on its own that Event Debugger can't catch since nothing "fires" on it in the DOM-event sense. Pick an element, choose which kinds of change to watch (added/removed nodes, attribute changes, text changes, and whether to include the element's children), and it logs a summary of what changed via the browser's native MutationObserver. Purely observational, reads the DOM, never writes to it. Same-batch mutations (a single re-render can fire dozens of individual change records) are folded into one log entry rather than flooding the log with near-duplicates.

Storage/Cookie Watcher - the third sibling, for a chosen localStorage key, sessionStorage key, or cookie. Unlike its two siblings this one polls on a 1-second interval rather than listening for a native event, because there isn't one to listen for: same-document storage writes and cookie changes don't fire anything observable in this document (the browser's own "storage" event only fires in other tabs/windows). The key field is a dropdown of whatever keys are actually present right now for the chosen kind, with a manual Refresh next to it for when the site writes a new key after the panel's already open - nothing to remember or retype exactly.

Snapshots - a one-tap bundle of localStorage, sessionStorage, cookies, and window globals as they stand right now, optionally labeled. Capture a few at different points (before/after a reload, before/after an action) and diff any two of them against each other - added/removed/changed values, organized by where they came from. In-memory only, capped at 10; this is meant for quick before/after comparisons, not a long-term archive. (This is a different feature from "Compare traffic across page loads" above - this one bundles storage/cookies/globals and doesn't survive a reload; that one is traffic-only and persists specifically so it can survive one. Export/AI Briefing's DOM snapshot category covers taking a point-in-time storage dump somewhere permanent.)

Script Sandbox

Reachable from any expanded script in Script sources (including one fetched from any URL) via "Test in Sandbox," or from anything pasted or typed directly into the Sandbox editor. Runs edited script text inside a sandbox="allow-scripts" iframe with no allow-same-origin - a genuinely separate opaque origin the parent page cannot reach into and vice versa, talking only via postMessage.

document/localStorage/sessionStorage are limited fake stand-ins (fake elements with no-op methods, in-memory storage) - explicitly labeled in the UI as a limited stub, not a faithful DOM. A script that explicitly writes window.document.foo bypasses the stand-in and hits the sandbox's own real-but-blank document instead.

Console output (log/warn/error/info) is captured and shown. Capped at a 3-second hard timeout per run; each run tears down and rebuilds a fresh iframe, so nothing carries over between runs. A Recent snippets list below the editor keeps the last 15 run scripts (persisted across reloads, same as the JS Console's own history) - tap one to reload it back into the editor.

Send to Console - the editor also has a button that copies whatever's in the text box straight into the JS Console's input and switches you there. It does not run anything by itself; the Console's own Run button is still a separate tap.

Recording what happened

Investigation Recorder - opt-in only; nothing is watched until you tap Start recording. While it's on, it merges clicks, form activity (never the value you typed - only that input happened, so it can't capture a password or a chat message), DOM changes, console output, uncaught errors, and network calls into one chronological timeline. Worth saying plainly: this is ordering by timestamp, not proof of cause and effect. Two things happening close together is a hint worth following, not a confirmed link.

Export / AI Briefing - pulls together whatever you've captured into either raw structured JSON (for your own use), a condensed briefing meant to be pasted straight into an AI assistant for analysis, or CSV.

Categories available: network requests, endpoint catalog, recorder timeline, last picked element, page load timing, WebSocket activity, the WebSocket message catalog, Value Tracer history, last Replay result, Replay session history, last Sandbox run, DOM snapshot (localStorage + sessionStorage + cookies combined), the Event Debugger log, the DOM Mutation Watcher log, the Storage/Cookie Watcher log, and Snapshots. Each has its own checkbox, disabled and greyed out when there's nothing to export yet. (Script Sandbox's run history is deliberately not a category here - it's a list of past code snippets, not investigation data, and "last Sandbox run" already covers the one result worth exporting. The Token Vault and saved WebSocket sequences aren't export categories either, for the same reason plus the vault's own deliberate no-persistence policy.)

CSV export is scoped to the categories that are actually tabular: network traffic, DOM snapshot, Value Tracer history, the Event Debugger log, the DOM Mutation Watcher log, the Storage/Cookie Watcher log, and the WebSocket message catalog. The rest (endpoint catalog, recorder timeline, WebSocket connections, replay, sandbox runs, Snapshots) stay JSON/briefing-only, since they're nested/tree-shaped data that would either flatten misleadingly or produce a CSV nobody could read. Checking more than one CSV-eligible category at once produces multiple tables in a single clipboard copy, separated by clear headers - not one merged table, since the columns genuinely differ.

The JS Console

Runs directly against the live page - not a sandbox, so it can read and change anything the chosen mode has access to, including other scripts' data. There's no undo. Three execution modes, chosen explicitly each time:

- Page context - runs via the page's own eval(). Full, direct access to the page's real globals with no prefix needed, but bound by whatever Content Security Policy that specific page sets. Different sites, and even different pages on the same site, can have genuinely different CSPs - this works fine on most pages and gets flatly rejected with a CSP error on ones that don't allow 'unsafe-eval'. That's the page's own policy, not a bug.

- Isolated (bypass CSP) - compiles code in the userscript's own isolated JavaScript context instead of the page's. Many browsers don't apply the page's CSP to that separate context, so this can work even where Page context is CSP-blocked. Reference the live page via the unsafeWindow variable (e.g. unsafeWindow.gameState) - a bare "window" here means this isolated context's own window, not the page's. Whether this genuinely bypasses CSP depends on the browser/userscript manager - a Test compile button runs a trivial check and reports plainly whether it actually works on the current page, rather than assuming. On some setups (certain mobile Tampermonkey builds in particular) compilation is blocked even in this isolated context, in which case the error says so directly: there is genuinely no way to run arbitrary typed code on that page from a userscript.

- Path access - for exactly the pages where both of the above are blocked. Reads, writes, or calls a single property path (e.g. gameState.player.money) using real property access rather than compiling any code from a string - CSP's 'unsafe-eval' restriction only governs the latter, so this is unaffected by any page's CSP, guaranteed. Three operations: Get (read a value, no confirm needed), Set (write a JSON value to that path, confirmed first), and Call (invoke a function at that path with optional JSON arguments, confirmed first, awaits a returned promise up to 10s). The real tradeoff: no loops, no multi-statement logic, no arbitrary expressions - one path, one operation per run. Event-driven automation isn't available in this mode, since it arms a full code snippet rather than a single operation.

Event-driven automation - pick an element and event (same picker as Event Debugger), then arm whatever's currently in the code box, using whichever of Page context or Isolated is selected, to run automatically - via the same live-page execution as the Run button above - every time that event fires. One binding at a time; arming a new one replaces the last. Requires one explicit confirm when arming, since after that it runs unattended with no per-firing confirmation, until disarmed or the page reloads. Runs skip themselves while a previous run is still in flight, so a fast-firing event can't stack overlapping executions. A live run log (ok/error, timestamp, truncated result) shows it's actually firing, and the armed status line shows which mode it's using. In-memory only, like the other watchers - cleared on reload.

Settings

Tap the gear icon.
- Theme switches light/dark.
- Trace history cap - how many Value Tracer History entries to keep before the oldest drop off (default 150).
- Clear endpoint catalog + console + sandbox history.
- Clear trace history - separate from the above, wipes only the Value Tracer's saved traces.
- Clear saved WebSocket sequences - wipes named sequences saved from WebSocket Send/Sequence.
- Clear page-load traffic snapshots - wipes everything saved from Compare traffic across page loads.

What it doesn't do

Browse and capture by default, with explicit, clearly-labeled exceptions where this tool touches the live page or fires a real request or message - every one of them gated behind an explicit action and a confirmation naming what's about to happen:
- The JS Console, including its event-driven automation - the automation case gets one confirm when armed rather than one per firing, since per-firing confirmation would defeat the point, but nothing runs until that initial arm.
- Replay / Edit, including its parameter sweep and repeat/automation modes, and its Standard/Privileged send-mode choice - single sends are confirmed individually; sweeps and automation get one confirm describing the whole run before it starts.
- Run on Live Page (Script sources), covering scripts found on the current page and scripts fetched from any URL - confirmed every time.
- WebSocket Send/Sequence - modify-and-resend and scripted sequences are both confirmed before they fire, sequences once for the whole run rather than per-step.

Everything else - Traffic, WebSocket connections/catalog, DOM/element inspection, Value Tracer, Token Inspector, Script Sandbox, Event Debugger, DOM Mutation Watcher, Storage/Cookie Watcher, Snapshots, the Recorder, Export - stays read-only.

Tw33k Tools - Target Data is a diagnostic tool intended for the user's own account/session, not for scraping or automating against other users. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
