# TTTargetData
Tw33k Tools - Target Data (Walkthrough, v1.4.0)

A free Tampermonkey userscript that works on any browser that allows scripts. A mini-DevTools built for diagnosing what the frontend is doing - what it stores, what it sends, what it's built from - without opening real browser DevTools or writing any code. Built game-agnostic; the examples below happen to be from Torn, but nothing here is Torn-specific.

How it starts

Drops a single small floating button on any page (right edge, mid-screen by default - drag it anywhere).

Everything lives behind two dropdowns at the top of the panel. The first picks a category - Network & Traffic, Page & DOM, Storage & Data, Testing & Automation, or Export / AI Briefing. Picking a category that holds more than one page shows a row of tabs underneath it for the individual pages inside that category; picking a new category jumps to the first page in it. Switch freely between categories, tabs, or pages - nothing resets when you do, and several pages have their own shortcut buttons that jump straight to a related page elsewhere (the Element editor can jump straight into CSS Class Search with the picked element still live, for instance, and vice versa).

═══════════════════════════
NETWORK & TRAFFIC
═══════════════════════════

Traffic history - every network request the page makes, any host, as it happens. Each entry shows full request/response headers (collapsed by default), body, timing, and where in the page's own code the call came from when that's detectable.

Two filter tools work together, all narrowing the same list (AND, not OR):
- The existing URL search box and the "recorded only" / "problems only" (4xx/5xx, or slower than a second) checkboxes.
- A separate Payload filter box supporting a small query language, space-separated terms, all of which must match:
- a plain word - substring match against request/response body
- key=value - matches any JSON key at any depth (case-insensitive)
- key>N / key=N / key<=N - numeric comparison against any JSON key
- key:N-M - inclusive numeric range

Matched entries show a green "matched: ..." badge naming exactly which term hit and its actual value - never a silent filter. "Copy all" respects whatever's currently filtered, so a filtered copy never accidentally includes the rest.

Persisted traffic cache - Traffic history above is in-memory and clears on reload; this is the part of it that doesn't. Automatically keeps up to 10 distinct actions per endpoint pattern (deduped by a `step=`/`q=`/`action=`/`p=` param when present, falling back to the first body key or the URL), with request/response bodies, surviving reload. Byte-budget capped (Settings), oldest evicted first. This is what makes "the tool already knows this endpoint" possible across a fresh page load without you having to re-trigger everything by hand.

Replay / Edit - from any Traffic entry's detail view, edit its method, URL, headers, or body and fire it against the live server, with a confirmation prompt first naming exactly what's about to happen.

Send mode - a Standard / Privileged toggle at the top of the editor, chosen explicitly each time (defaults back to Standard whenever the editor opens fresh):
- Standard uses the page's own fetch(). Cookie, Host, Origin, Referer, and a handful of other headers are blocked by the Fetch spec itself here - typing them into the headers box does nothing, and that's the browser's restriction, not this tool's.
- Privileged uses GM_xmlhttpRequest, dispatched from the userscript manager rather than the page's own fetch/XHR. This is the only way either mode can even attempt Cookie/Origin/Referer, but it's worth understanding what's actually happening: userscript managers get these past the browser via a browser-level trick (a blocking webRequest header swap), and Chrome removed the API that trick depends on in Manifest V3. Whether it works at all depends entirely on your specific browser and userscript manager version, and it can fail two different ways - silently stripped, or sent with a mangled/salted header name instead of the real one. Cookie specifically tends to append to the real cookie jar rather than replacing it, even in the cases where it does work. Host still can't be touched by either mode - that's tied to the connection itself, not a header value. Requests sent this way won't show up in the page's own Network tab, and some sites can tell an extension-originated request apart from a page-originated one. Only available if the userscript manager granted GM_xmlhttpRequest; the option is disabled otherwise.

Test header pass-through - a button that appears only in Privileged mode, for finding out what your specific setup actually does instead of trusting the description above. Runs two real steps: first sets a genuine "control" cookie on a public test domain via a real Set-Cookie response, so there's an actual cookie in the jar to test against rather than an empty one; then sends a probe request carrying test Origin/Referer/Cookie values and reports exactly what the far end received. Origin and Referer each come back as one of passed through cleanly / appended / stripped / mangled. Cookie gets a more detailed readout specifically because "appended" and "genuinely overrode" look identical without a real cookie to compare against - the control-cookie step tells them apart, reporting separately whether the control cookie survived and whether the typed-in value made it through. Host is shown for reference alongside the results, labeled clearly as never-settable by either mode.

Sending always shows exactly which headers (if any) got stripped and why, and every result is tagged with which send mode actually carried it - never left ambiguous after the fact.

A Replay history list sits below the result: every send this session gets appended, and now persists across reloads (byte-budget capped in Settings - full response bodies can be sizable, so this cap matters more than most). Tapping a past entry reloads its draft and the result it got back into the editor, so you can see what happened and then tweak and send again - that becomes its own new entry, nothing is overwritten.

Parameter sweep - put a placeholder token (default {{VALUE}}) anywhere in the URL, headers, or body above, list out values (comma or newline separated), and it sends one real request per value with that token substituted in, at least 150ms apart. Validates the placeholder actually appears somewhere before letting you run it, so a typo can't silently do nothing. Confirmed before it starts, since it's a real batch of live requests; stoppable mid-run; results logged per value (status/duration, or the error).

Repeat / automation - sends the exact current draft on an interval instead of once: configurable interval (500ms floor, enforced regardless of what's typed) and a max-runs count, or 0 for "until stopped." Confirmed before starting, live run log, stop control. Both the sweep and automation get cleaned up automatically if you close the editor or open a different request.

Network waterfall gives the same data as a small timing chart; Hosts summary and Duplicate requests surface who the page talks to and any suspicious repeated-call bursts. Observed endpoints quietly builds a catalog of every distinct endpoint it's ever seen, persisted across page loads, so it gets more useful the more you browse. Any live-session catalog entry can show its full last response in an uncapped, copyable detail view.

Page load timing - a breakdown of the current page's own load (DNS, TCP, TLS, time to first byte, DOM processing, and so on) from the browser's own Navigation Timing data. Reflects the last real page load only - it won't update just because you clicked around within the same load.

Compare traffic across page loads - Traffic history is in-memory and clears on reload, so there's normally no way to see "before" vs "after" a page load by itself. This section saves a snapshot on demand (hosts contacted with counts, total/problem request counts, and an endpoint list) that survives reloads. Save one now, reload or navigate, save another, then diff any two saved snapshots against each other: hosts added/removed/changed with counts, and endpoints unique to each side. These snapshots have their own clear-all control in Settings.

WebSocket activity - the same idea for real-time connections instead of one-off requests: every WebSocket the page opens, every message in both directions, JSON messages decoded automatically.

Off by default. A WebSocket is often a continuous stream of a website's real-time state rather than a one-off request, so capturing it out of the box was judged a little too invasive - a toggle at the top of this panel turns it on or off, and the choice persists across reloads. Turning it on takes effect immediately, no reload needed. Turning it off is confirmed first and takes effect on the next reload (a connection already open keeps being tracked until then).

With capture on: a Hook status line and a Test connect button let you confirm the capture mechanism itself is working, independent of whether the specific site you're on happens to use WebSockets at all - Test connect opens a real connection to a public echo server (wss://echo.websocket.org), so this can be checked on literally any page, not just one that opens its own WebSocket.

Closed connection history and the message-shape catalog now both persist across reloads (byte-budget capped in Settings, shared with a few other logs below) - the live connection itself obviously can't survive a reload (the browser kills the socket outright), but what it already captured does. For sites using Centrifugo-style push envelopes (a generic `{"push":{...}}` wrapper around every server-pushed event, regardless of what actually happened), the catalog digs into `pub.data.message.namespaces.<namespace>.actions.<action>` and shows the real event type (e.g. `push:tchat.onMessageReceived`) as the shape, instead of grouping every push under one meaningless "push" bucket.

Same payload filter mini-language as Traffic works here too (keyword / key=value / numeric compare / range), applied to each message's text/JSON. Above the message list sits a message-flow timeline: every message as a small colored tick positioned by its actual timestamp along the connection's observed span (green = received, blue = sent), so bursts and gaps in traffic are visible at a glance rather than only readable by scrolling a chronological list. Tapping a tick selects that message, same as tapping its row in the list below. "Copy all" respects the active filter.

A Connections / Message catalog / Send-Sequence set of tabs switches between three views:
- Connections - the usual per-connection message list, live and historical together.
- Message catalog - every message seen so far grouped by connection URL, direction, and shape - the WebSocket equivalent of Traffic's endpoint catalog.
- Send / Sequence - where sending lives. Pick a target connection (only ones still open can actually receive a send), then either:
  - Modify & resend - a text box prefilled with the connection's most recent message, editable, sent with one confirm. A "Resend..." shortcut on any individual message in the Connections view jumps straight here with that message loaded.
  - Scripted sequence - build an ordered list of messages, each with its own delay-before-send, and run the whole sequence against the live connection. Confirmed once before it starts (not per-step, since that would defeat the point of automation), stoppable mid-run, live log of each step's result. Sequences can be saved by name and reloaded later (loading a saved one drops its steps back into the live editable working list, so it's a starting point you can adjust, not a locked template), or deleted - persisted across reloads. Stops automatically if a send fails or the connection closes.

═══════════════════════════
PAGE & DOM
═══════════════════════════

DOM (full page HTML) - the whole rendered page as one searchable, copyable text dump. Refresh re-scans; nothing here auto-updates.

Element inspector (pick from page) - tap Pick element and the panel shrinks into a small draggable box you can drag out of the way; tap anything on the actual page to inspect it. Shows tag, id, classes, attributes, dataset, its own text, its children, dimensions, and a couple of CSS selectors that would find it again.

Computed CSS is grouped into five categories - Layout, Box Model, Typography, Visual, Flex/Grid - covering roughly 40 properties, rather than one flat list.

Ancestors (possible event delegation targets) shows up to 10 parent elements as a compact color-coded chip list above the usual text dump: each ancestor gets flagged "looks interactive" if it's a native interactive tag (a, button, input, etc.), has an interactive role, has tabindex, has an inline on= handler, or computes cursor: pointer. This is a heuristic, not proof - a real JS-attached listener (addEventListener) genuinely cannot be enumerated from a userscript in any browser; that limitation is the same reason "associated events" below only ever shows inline handlers.

Associated events only ever shows inline on*="..." HTML attributes on the picked element itself - almost no modern site still attaches handlers that way. Don't read an empty list as "nothing happens when you click this."

Edit element - live editing, added after the initial read-only version of this panel. Three text-editable blocks against the actual picked node: attributes (one per line, `name="value"`, or a bare name for a boolean attribute - lines removed from the text get removed from the element, matching lines get set), inline style (raw CSS, e.g. `color: red;`), and text content (replaces the element's entire content, including any child elements - not for elements you want to keep children on). A Remove element button deletes it from the page outright. All of it writes straight to the live DOM, immediately, exactly as if done through real DevTools - nothing here persists past a reload.

Every save is checked ~250ms later against what's actually still on the element: if a JS framework (React, most commonly) silently reverted the change the moment it re-rendered, the status line says so directly and names which specific attribute(s)/property reverted, rather than reporting a flat "Saved" that turns out to mean nothing happened where it counts. Separately, every save first checks whether the picked node is still attached to the document at all (`isConnected`) - if a framework replaced the element outright rather than just updating it, editing the old orphaned reference would otherwise "succeed" silently while touching nothing visible; this catches that case with its own explicit message instead.

Find a class... - a shortcut button on the attributes editor that jumps straight to CSS Class Search (below) with the picked element still live, so a class found there can be applied with one tap via "Add to picked element."

CSS Class Search - search every accessible stylesheet's class selectors for a substring match. Built specifically for CSS-Modules-style class names (`stockOwned___VshhT` and similar) - the readable part is guessable, the hash suffix isn't, and this finds the whole thing from a fragment. Results are grouped by distinct class name, not one row per CSS rule - a single class routinely gets referenced by many pseudo-state/compound selectors (`:hover`, `:last-child`, combined with ancestors), and a flat per-rule list would make one class look like many different results. Each group shows its rule count, up to 8 of its actual occurrences with selector and a properties preview, a Copy button, and an "Add to picked element" button wired to whatever's currently picked in Element inspector. Reports how many stylesheets it couldn't read (cross-origin, no CORS headers) rather than silently under-reporting - so a thin or empty result tells you something rather than leaving you unsure whether the search was actually complete. That hash suffix is typically build-derived and can change on Torn's (or any target's) next deploy - treat a found class as good for testing right now, not something to hardcode into a script meant to survive a release.

Event Debugger - a standalone panel, separate from the Investigation Recorder, for watching one specific element/event pair at a time. Pick an element (same picker as Element inspector), choose a built-in event type or name a custom DOM event, and optionally list window globals to watch. Every firing logs the target, any diffs in the globals you named (before -> after), and any network requests that landed within 1.5 seconds afterward, cross-referenced against Traffic history. Multiple watches can run at once; each has its own Remove button, and Remove all / Clear log sit above the watch list and log respectively. The log now persists across reloads (byte-budget capped, shared with a few other logs in Settings) - the watch itself can't (it holds a live element reference that dies at reload, same limitation as any DOM-node-based watch), so a watch needs re-adding after a reload, but what it already caught survives.

This does not accept or run any code you write - it only logs. For running code automatically on an event, see the JS Console's event-driven automation.

DOM Mutation Watcher - Event Debugger's sibling, for changes that aren't tied to any specific user-triggered event at all: a value that ticks up on a timer, an HP bar that updates in response to something arriving over WebSocket, anything the game changes on its own that Event Debugger can't catch since nothing "fires" on it in the DOM-event sense. Pick an element, choose which kinds of change to watch (added/removed nodes, attribute changes, text changes, and whether to include the element's children), and it logs a summary of what changed via the browser's native MutationObserver. Purely observational, reads the DOM, never writes to it. Same-batch mutations are folded into one log entry rather than flooding the log with near-duplicates. The log persists across reloads, same watch-vs-log split as Event Debugger above and for the same reason.

Script sources - every script tag on the page, inline content shown directly, external files fetched on request so you can read the real source. A "Run a script from any URL" card sits above the list - not limited to scripts this tool found on the current page; paste any script URL, fetch it (subject to the same CORS restrictions as any other fetch from here), and it gets the same actions as anything else found here. From any expanded script (or a fetched-from-anywhere one):
- Test in Sandbox - test-run it in isolation (see Script Sandbox, under Testing & Automation).
- Run on Live Page - runs it directly against the real page, the same way the JS Console does, with the same Page context / Isolated (bypass CSP) mode choice available here too - a small pill row above the script text picks which one, confirmed every time before it runs.
- Copy, as before.

═══════════════════════════
STORAGE & DATA
═══════════════════════════

window globals - a scan of everything sitting on `window` that isn't a normal browser API. Tap a row to copy its value. Each row also has a "Get/Set via Path access" button (or "Call via Path access" if it's a function) that jumps straight into the JS Console's Path Access mode with that key pre-filled - browse Globals to discover what's there, one tap to act on it (read it, overwrite it, or run it if it's callable) rather than needing to already know and type the exact path.

localStorage / sessionStorage - browse, edit, add, and delete keys directly against the live page's real storage, changes taking effect immediately (the same as the page's own JS calling setItem). Select a key to open it in an editable textarea with Save/Delete/Copy; "+ Add key" for a new one. "Copy all as JSON" respects whichever of the two (local vs session) is currently selected.

Cookies - the same editable pattern, for whichever cookies are readable from JS. httpOnly session cookies won't appear here and can never be touched from JS, by browser design - that's not a gap in this tool, it's a real security boundary no client-side script can cross. Edits write with `path=/` by default, since the original cookie's real path/domain/secure/sameSite attributes aren't visible from `document.cookie` at all - if the real cookie used a different path, an edit here may add a second cookie rather than cleanly replace it. Same caveat applies to Delete.

Save to vault - both of the above have this button on a key's detail view, saving that specific key/value pair (with an optional label) to the Storage/Cookie Vault below.

Storage/Cookie Vault - a curated set of specific values you've deliberately kept, independent of whatever's currently live at that key - the same idea as the Token Vault below, applied to storage/cookie values instead of tokens. The live editors above only ever show the current value; this is for pinning a specific value you want to hang onto and reuse later, even after the live key changes or the page reloads. Each saved entry can be edited in place, applied back to the live page (optionally under a different key than it was saved from, so an entry can double as a reusable template rather than only a restore point), removed, or copied. Persists across reloads.

Storage/Cookie Watcher - for a chosen localStorage key, sessionStorage key, or cookie, polls on a 1-second interval and logs any change (old value -> new value). Polls rather than listening for a native event because there isn't one to listen for in this document - same-document storage writes and cookie changes don't fire anything observable here (the browser's own "storage" event only fires in other tabs/windows). The key field is a dropdown of whatever keys are actually present right now for the chosen kind, with a manual Refresh next to it for when the site writes a new key after the panel's already open. Both the watch list and the log persist across reloads - unlike its DOM-based siblings above, a storage/cookie watch is just `{kind, key}`, with no live element reference to lose, so it genuinely auto-resumes watching the same key after a reload rather than needing to be re-added.

IndexedDB - browse every database the page's own scripts have created, drill into object stores, and view/edit/add/delete individual records. `indexedDB.databases()` isn't supported in every browser/webviews; where it isn't, this panel says so plainly rather than silently showing nothing. Records are capped at 200 per store for browsing (a store can hold thousands; this is for inspecting/editing specific records, not a bulk dump) and stores show whether their key is inline (derived from a field in the value itself) or out-of-line (set separately) - the editor adapts which key field it shows accordingly. Editing only round-trips values that are plain JSON; IndexedDB legitimately allows Blobs, ArrayBuffers, Dates, Maps and similar, and anything that doesn't survive a `JSON.stringify`/`parse` cycle cleanly is shown read-only with an explicit note, rather than silently corrupting it.

═══════════════════════════
TESTING & AUTOMATION
═══════════════════════════

The JS Console

Runs directly against the live page - not a sandbox, so it can read and change anything the chosen mode has access to, including other scripts' data. There's no undo. Three execution modes, chosen explicitly each time:

- Page context - runs via the page's own eval(). Full, direct access to the page's real globals with no prefix needed, but bound by whatever Content Security Policy that specific page sets. This works fine on most pages and gets flatly rejected with a CSP error on ones that don't allow 'unsafe-eval'. That's the page's own policy, not a bug.

- Isolated (bypass CSP) - compiles code in the userscript's own isolated JavaScript context instead of the page's. Many browsers don't apply the page's CSP to that separate context, so this can work even where Page context is CSP-blocked. Reference the live page via the unsafeWindow variable. A Test compile button runs a trivial check and reports plainly whether it actually works on the current page. On some setups compilation is blocked even here, in which case the error says so directly: there is genuinely no way to run arbitrary typed code on that page from a userscript.

- Path access - for exactly the pages where both of the above are blocked. Reads, writes, or calls a single property path (e.g. `gameState.player.money`) using real property access rather than compiling any code from a string - CSP's 'unsafe-eval' restriction only governs the latter, so this is unaffected by any page's CSP, guaranteed. Three operations: Get (read a value, no confirm needed), Set (write a JSON value to that path, confirmed first), and Call (invoke a function at that path with optional JSON arguments, confirmed first, awaits a returned promise up to 10s). Window Globals' "Get/Set/Call via Path access" buttons land here, pre-filled. The real tradeoff: no loops, no multi-statement logic, no arbitrary expressions - one path, one operation per run.

Event-driven automation - pick an element and event (same picker as Event Debugger), then arm whatever's currently in the code box, using whichever of Page context or Isolated is selected, to run automatically every time that event fires. One binding at a time; arming a new one replaces the last. Requires one explicit confirm when arming, since after that it runs unattended with no per-firing confirmation. Runs skip themselves while a previous run is still in flight. A live run log shows it's actually firing. In-memory only - cleared on reload.

Script Sandbox

Reachable from any expanded script in Script sources via "Test in Sandbox," or from anything pasted or typed directly into the Sandbox editor. Runs edited script text inside a sandbox="allow-scripts" iframe with no allow-same-origin - a genuinely separate opaque origin the parent page cannot reach into and vice versa. document/localStorage/sessionStorage inside it are limited fake stand-ins, explicitly labeled as such, not a faithful DOM. Console output is captured; capped at a 3-second hard timeout per run. A Recent snippets list keeps the last 15 run scripts (code only, not results), persisted across reloads.

Investigation Recorder - opt-in only; nothing is watched until you tap Start recording. While it's on, it merges clicks, form activity (never the value typed - only that input happened), DOM changes, console output, uncaught errors, and network calls into one chronological timeline. Ordering is by timestamp, not proof of cause and effect. A continuing recording session now survives a reload: state (entries, recording flag, start time) persists, and on the next page load the recorder resumes and backfills the reload gap in the timeline from the persisted traffic cache (marked as backfilled, since it's reconstructed rather than directly observed). A `pagehide`/`beforeunload` flush covers the case where a reload happens before the normal save would have fired.

Snapshots - a one-tap bundle of localStorage, sessionStorage, cookies, and window globals as they stand right now, optionally labeled. Capture a few at different points (before/after a reload, before/after an action) and diff any two of them against each other. Persists across reloads, capped at 10 snapshots (evicted whole, oldest first, never trimmed internally - a partially-trimmed snapshot would be a worse record than fewer complete ones).

Restore - each saved snapshot has a Restore button that writes its localStorage/sessionStorage/cookies back onto the live page right now, using the same edit functions as the Storage & Data panels. Deliberately an overlay, not a wipe-and-replace: keys that exist now but weren't in the snapshot are left alone, since deleting them risks wiping legitimate data unrelated to whatever's being tested. Window globals and IndexedDB are not restored - globals were only ever captured as string previews, not real values, so reassigning them wouldn't be meaningful, and IndexedDB was never part of a snapshot to begin with.

(This is a different feature from "Compare traffic across page loads" - that one is traffic-only. Export/AI Briefing's DOM snapshot category covers taking a point-in-time storage dump somewhere permanent/shareable, separate from either.)

Value Tracer - type in a value you can see on the page (a price, a name, an id) and it finds every place that value shows up: DOM text, window globals, and JSON paths inside every response this session has captured. Substring match, case-sensitive, deliberately not fuzzy. Three modes: Live, History, Correlate.

Live runs a fresh trace and automatically saves it to History - persisted across page loads and sessions. History groups saved traces by hostname, newest first. History size is capped (default 150 entries, adjustable in Settings) and supports Export/Import via copy-paste (merges rather than replaces, deduplicated).

Correlate compares your own past traces against each other: Track one value (Persistent / Intermittent / New-or-Gone locations for a single term across its trace history) or Compare two values (which locations held both a "was" and an "is now" value, with a best-effort note on which was seen first, or "interleaved" if the data doesn't cleanly separate in time). Both modes are entirely a diff of your own saved trace history against itself.

Token Inspector - scans storage, cookies, and captured traffic for anything token-shaped (by name, or by being a well-formed JWT regardless of name). JWTs get fully decoded: header, payload, and an expiry status computed from the token's own exp claim. Payload anomaly flags run automatically alongside every decoded JWT (alg: none, inconsistent timestamps, missing exp, unusually long lifetime, sensitive-looking field names, missing sub/iss/aud, a path-like kid header, non-standard typ) - every flag is a flag, not a finding, since verifying a signature needs the issuing server's key and isn't available client-side.

A Scanned / Vault toggle switches between live scan results and a saved vault:
- Save to vault on any scanned token (with an optional label) keeps it around even after it rotates out of storage or falls out of traffic history. + Add manually pastes in a token from elsewhere entirely - useful for testing against something deliberately expired or malformed, not just what the scanner happened to find. Edit value on a saved entry changes it in place without removing and re-adding.
- The vault persists across reloads. This is real credential material - it was originally deliberately in-memory-only for exactly that reason, and was reconsidered: persistence is genuinely useful for reusing a token across a multi-reload flow, and the tradeoff is a deliberate choice, not an oversight. Treat this list with the same care as the tokens themselves.
- Send with this token... on any token (scanned or vaulted) opens Replay/Edit prefilled with the right header, so sending or replaying a specific credential reuses the same editor, history, sweep, and automation tools as everything else in Replay/Edit.

═══════════════════════════
EXPORT / AI BRIEFING
═══════════════════════════

Pulls together whatever you've captured into either raw structured JSON (for your own use), a condensed briefing meant to be pasted straight into an AI assistant for analysis, or CSV.

Each category has its own checkbox, disabled and greyed out when there's nothing to export yet, with a colored dot showing whether that category survives a reload or resets - green for survives, and most categories are green now. Two categories are deliberately off by default regardless of whether they have data: Token Vault and Storage/Cookie Vault, both of which can carry raw credential or session-identifying values - checking them is an explicit opt-in, not something that happens by checking "everything."

Categories: network requests, endpoint catalog, persisted traffic cache, recorder timeline, last picked element, page load timing, WebSocket activity, the WebSocket message catalog, Value Tracer history, last Replay result, Replay session history, last Sandbox run, Sandbox code history, DOM snapshot (localStorage + sessionStorage + cookies + IndexedDB, all in one flat set of source/key/value rows), the Event Debugger log, the DOM Mutation Watcher log, the Storage/Cookie Watcher log, Snapshots, the Token Vault, and the Storage/Cookie Vault.

CSV export covers every category above except the ones that are single point-in-time objects rather than lists (last picked element, page timing, last Replay result, last Sandbox run) - those stay JSON/briefing-only, since there's nothing tabular to build from a single snapshot. Everything else, including ones that used to be JSON/briefing-only (endpoint catalog, recorder timeline, WebSocket activity, Snapshots, Replay history, Token Vault, Storage/Cookie Vault), now has a CSV table. Recorder timeline entries vary by kind (click/input/network/console/error/pick), so CSV keeps Timestamp/Kind as fixed columns and flattens everything else into one Detail column rather than forcing every kind into the same schema. WebSocket activity gets one CSV row per message, not per connection, since the messages are the actually-tabular part. Checking more than one CSV-eligible category at once produces multiple tables in a single clipboard copy, separated by clear headers, not one merged table.

Settings

Tap the gear icon.
- Theme switches light/dark.
- Trace history cap - how many Value Tracer History entries to keep before the oldest drop off (default 150).
- Persisted traffic cache budget - bytes, approximate serialized size, lower it if writes fail on your userscript host (default 250,000).
- Recorder cross-reload budget - bytes, caps how much of a continued recording session survives a reload (default 100,000).
- Secondary logs budget - bytes, applied independently to the DOM Mutation Watcher log, WebSocket message catalog, WebSocket connection history, Storage/Cookie Watcher log, and Event Debugger log - worst case roughly 5x this number combined, since it's per-stream, not shared (default 50,000).
- Snapshots budget - bytes; snapshots are evicted whole, oldest first, never trimmed internally (default 150,000).
- Replay history budget - bytes; Replay/Edit history can carry full response bodies per entry (default 100,000).
- Clear endpoint catalog + console + sandbox history.
- Clear traffic + persisted cache + recorder + snapshots + watch logs + replay history - one combined button; leaves active watches and the Token Vault untouched (the vault has its own Clear button in its own panel).
- Clear trace history - separate from the above, wipes only the Value Tracer's saved traces.
- Clear saved WebSocket sequences - wipes named sequences saved from WebSocket Send/Sequence.
- Clear page-load traffic snapshots - wipes everything saved from Compare traffic across page loads.

None of the clear buttons touch the page's actual localStorage, sessionStorage, cookies, or IndexedDB - they only clear what this tool has captured/cached about itself. The Storage/Cookie and IndexedDB editors write to the real thing directly and are a separate concern from anything Settings clears.

What it doesn't do

A meaningfully larger share of this tool writes to the live page now than it did at v1.0.4 - editing localStorage/sessionStorage/cookies/IndexedDB, editing DOM element attributes/style/text, and restoring a Snapshot back onto the page are all real, immediate writes now, not just observation. Every one of them is still gated behind an explicit action in its own panel, and the higher-stakes/batch ones still carry an explicit confirmation naming what's about to happen:
- The JS Console, including its event-driven automation - one confirm when armed, not per firing.
- Replay / Edit, including its parameter sweep and repeat/automation modes, and its Standard/Privileged send-mode choice - single sends confirmed individually; sweeps and automation get one confirm for the whole run.
- Run on Live Page (Script sources) - confirmed every time.
- WebSocket Send/Sequence - confirmed before firing, sequences once for the whole run.
- Snapshot Restore, Element removal, and Storage/Cookie/IndexedDB key deletion - each confirmed individually, naming what's about to be removed or overwritten.

Direct field edits (a storage value, a DOM attribute, an IndexedDB record) apply immediately without an extra confirmation dialog on top of the Save action itself - the deliberate tap to open the editor and press Save is treated as the confirmation, consistent with how any live text field works.

Everything else - Traffic, WebSocket connections/catalog observation, DOM/element inspection (short of the Edit element block), Value Tracer, Token Inspector's scan side, Script Sandbox, Event Debugger, DOM Mutation Watcher, CSS Class Search, Storage/Cookie Watcher's own observation, Snapshots' capture side, the Recorder, Export - stays read-only.

Tw33k Tools - Target Data is a diagnostic tool intended for the user's own account/session, not for scraping or automating against other users. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

