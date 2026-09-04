Tw33k Tools - Target Data (Walkthrough, v1.6.0)

A free Tampermonkey userscript that works on any browser that allows scripts. A mini-DevTools built for diagnosing what the frontend is doing - what it stores, what it sends, what it's built from - without opening real browser DevTools or writing any code. Built game-agnostic; the examples below happen to be from Torn, but nothing here is Torn-specific.

How it starts

Drops a single small floating button on any page (right edge, mid-screen by default - drag it anywhere).

Everything lives behind two dropdowns at the top of the panel. The first picks a category - Network & Traffic, Page & DOM, Storage & Data, Recon, Active Discovery, Testing & Automation, or Export / AI Briefing. Picking a category with more than one page shows a row of tabs underneath for the pages in it; picking a new category jumps to the first page in it. Switch freely between categories, tabs, or pages - nothing resets when you do, and several pages have shortcut buttons that jump straight to a related page elsewhere (the Element editor can jump into CSS Class Search with the picked element still live and vice versa; Active Discovery's Path/Endpoint Brute-force can send its hits straight into either the Same-Origin Crawler or Hidden Parameter Discovery - see below).

===========================
NETWORK & TRAFFIC
===========================

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
- Privileged uses GM_xmlhttpRequest, dispatched from the userscript manager rather than the page's own fetch/XHR - the only way either mode can attempt Cookie/Origin/Referer, via a browser-level trick (a blocking webRequest header swap) that Chrome removed in Manifest V3. Works depends entirely on your browser/manager version, and can fail silently-stripped or mangled; Cookie tends to append to the real jar rather than replace it. Host can't be touched by either mode - tied to the connection, not a header. These requests won't show in the page's own Network tab, and some sites can tell them apart from page-originated ones. Only available if the manager granted GM_xmlhttpRequest.

Test header pass-through - only in Privileged mode, for finding out what your setup actually does rather than trusting the description above. Sets a genuine "control" cookie on a public test domain via a real Set-Cookie response, then sends a probe carrying test Origin/Referer/Cookie values and reports what the far end received: each comes back as passed through cleanly / appended / stripped / mangled. Cookie gets a more detailed readout since "appended" and "genuinely overrode" look identical without a real cookie to compare against - the control cookie tells them apart. Host is shown for reference, labeled never-settable.

Sending always shows exactly which headers (if any) got stripped and why, and every result is tagged with which send mode actually carried it - never left ambiguous after the fact.

A Replay history list sits below the result: every send this session gets appended, and now persists across reloads (byte-budget capped in Settings - full response bodies can be sizable, so this cap matters more than most). Tapping a past entry reloads its draft and result back into the editor for another look, tweak, and send - that becomes its own new entry, nothing is overwritten. Sweep-originated entries carry a small "(sweep: value)" tag, red-highlighted and marked "flagged" if anomalous.

Parameter sweep - put a placeholder token (default {{VALUE}}) anywhere in the URL, headers, or body above, list out values (comma or newline separated, six rows of room in the box), and it sends one real request per value with that token substituted in, at least 150ms apart. Validates the placeholder actually appears somewhere before letting you run it, so a typo can't silently do nothing. Confirmed before it starts, since it's a real batch of live requests; stoppable mid-run.

Payload presets - a dropdown above the values box loads a ready-made list in one tap: SQLi, XSS, or path-traversal probes, for testing how an endpoint handles unexpected input. Selecting one overwrites the values box (confirmed first if it isn't empty). Same substitution/delay/confirm rules apply either way - presets are just a faster way to fill the list.

Anomaly flagging - the first successful response is the baseline; later ones flag when status changes, body length differs 15%+, response time is 2.5x+ (and 800ms+) slower (a possible time-based signal), or the body matches a Misconfig Audit verbose-error signature (traceback, DEBUG=True, Whoops, SQLSTATE, etc). Flagged rows show the exact reasons. Deltas worth a look, not confirmed vulnerabilities - a single-value sweep has nothing to compare against. This same anomaly-diff engine is reused by Hidden Parameter Discovery, below.

Tap a sweep result - opens the exact payload, the full substituted request (method/URL/headers/body), flag reasons if any, and the full response (status/headers/body, with its own copy button), instead of just the one-line log summary.

Every sweep step also lands in Replay history above, tagged with the value swept and flagged status - so a sweep run shows up in in-app Session history and Export/AI Briefing's Replay session history too, not just the sweep panel's own log.

Repeat / automation - sends the exact current draft on an interval instead of once: configurable interval (500ms floor, enforced regardless of what's typed) and a max-runs count, or 0 for "until stopped." Confirmed before starting, live run log, stop control. Both the sweep and automation get cleaned up automatically if you close the editor or open a different request.

Network waterfall gives the same data as a small timing chart; Hosts summary and Duplicate requests surface who the page talks to and any suspicious repeated-call bursts. Observed endpoints quietly builds a catalog of every distinct endpoint it's ever seen, persisted across page loads, so it gets more useful the more you browse. Any live-session catalog entry can show its full last response in an uncapped, copyable detail view.

Page load timing - a breakdown of the current page's own load (DNS, TCP, TLS, time to first byte, DOM processing, and so on) from the browser's own Navigation Timing data. Reflects the last real page load only - it won't update just because you clicked around within the same load.

Compare traffic across page loads - Traffic history is in-memory and clears on reload, so there's normally no way to see "before" vs "after" a page load by itself. This section saves a snapshot on demand (hosts contacted with counts, total/problem request counts, and an endpoint list) that survives reloads. Save one now, reload or navigate, save another, then diff any two saved snapshots against each other: hosts added/removed/changed with counts, and endpoints unique to each side. These snapshots have their own clear-all control in Settings.

WebSocket activity - the same idea for real-time connections instead of one-off requests: every WebSocket the page opens, every message in both directions, JSON messages decoded automatically.

Off by default. A WebSocket is often a continuous stream of a site's real-time state rather than a one-off request, so a toggle at the top turns capture on or off, persisted across reloads. Turning it on takes effect immediately; turning it off is confirmed first and takes effect next reload (an already-open connection keeps being tracked until then).

With capture on: a Hook status line and a Test connect button confirm the capture mechanism itself works, independent of whether the current site uses WebSockets - Test connect opens a real connection to a public echo server (wss://echo.websocket.org).

Closed connection history and the message-shape catalog persist across reloads (byte-budget capped, shared with other logs). For sites using Centrifugo-style push envelopes (a generic `{"push":{...}}` wrapper around every server-pushed event), the catalog digs into `pub.data.message.namespaces.<namespace>.actions.<action>` and shows the real event type (e.g. `push:tchat.onMessageReceived`) instead of grouping everything under one "push" bucket.

Same payload filter mini-language as Traffic works here too. Above the message list sits a message-flow timeline: every message as a colored tick positioned by its actual timestamp (green = received, blue = sent), so bursts and gaps are visible at a glance. Tapping a tick selects that message. "Copy all" respects the active filter.

A Connections / Message catalog / Send-Sequence set of tabs switches between three views:
- Connections - the usual per-connection message list, live and historical together.
- Message catalog - every message seen so far grouped by connection URL, direction, and shape - the WebSocket equivalent of Traffic's endpoint catalog.
- Send / Sequence - where sending lives. Pick a target connection (only ones still open can actually receive a send), then either:
  - Modify & resend - a text box prefilled with the connection's most recent message, editable, sent with one confirm. A "Resend..." shortcut on any message in Connections jumps straight here with it loaded.
  - Scripted sequence - build an ordered list of messages, each with its own delay-before-send, and run it against the live connection. Confirmed once for the whole run, stoppable mid-run, live log per step. Sequences save by name and reload later as an editable starting point, or delete - persisted across reloads. Stops automatically if a send fails or the connection closes.

===========================
PAGE & DOM
===========================

DOM (full page HTML) - the whole rendered page as one searchable, copyable text dump. Refresh re-scans; nothing here auto-updates.

Can also show a crawled page's HTML instead of the live one - see Active Discovery's Same-Origin Crawler below. When it is, a banner names which crawled page you're looking at and when it was fetched, with a "back to live page" link; Refresh always snaps back to the live page regardless.

Element inspector (pick from page) - tap Pick element and the panel shrinks into a small draggable box you can drag out of the way; tap anything on the actual page to inspect it. Shows tag, id, classes, attributes, dataset, its own text, its children, dimensions, and a couple of CSS selectors that would find it again.

Computed CSS is grouped into five categories - Layout, Box Model, Typography, Visual, Flex/Grid - covering roughly 40 properties, rather than one flat list.

Ancestors (possible event delegation targets) shows up to 10 parent elements as a color-coded chip list: each gets flagged "looks interactive" if it's a native interactive tag (a, button, input, etc.), has an interactive role, tabindex, an inline on= handler, or computes cursor: pointer. A heuristic, not proof - a real JS-attached listener (addEventListener) genuinely cannot be enumerated from a userscript in any browser; that's also why "associated events" below only shows inline handlers.

Associated events only ever shows inline on*="..." HTML attributes on the picked element itself - almost no modern site still attaches handlers that way. Don't read an empty list as "nothing happens when you click this."

Edit element - live editing against the actual picked node: attributes (one per line, `name="value"`, or a bare name for a boolean attribute - removed lines remove the attribute, matching lines set it), inline style (raw CSS), and text content (replaces the element's entire content, including children). A Remove element button deletes it from the page outright. All writes go straight to the live DOM immediately, exactly as real DevTools would - nothing persists past a reload.

Every save is checked ~250ms later against what's actually still on the element: if a JS framework (React, most commonly) silently reverted the change on re-render, the status line names which attribute(s)/property reverted rather than reporting a flat "Saved" that meant nothing. Every save also first checks the node is still attached to the document (`isConnected`) - if a framework replaced the element outright, editing the orphaned reference would otherwise "succeed" while touching nothing visible; this catches that with its own message.

Find a class... - a shortcut button on the attributes editor that jumps straight to CSS Class Search (below) with the picked element still live, so a class found there can be applied with one tap via "Add to picked element."

CSS Class Search - search every accessible stylesheet's class selectors for a substring match. Built for CSS-Modules-style class names (`stockOwned___VshhT` and similar) - the readable part is guessable, the hash suffix isn't, and this finds the whole thing from a fragment. Results group by distinct class name, not one row per CSS rule (a class is routinely referenced by many pseudo-state/compound selectors). Each group shows its rule count, up to 8 occurrences with selector and a properties preview, Copy, and "Add to picked element." Reports how many stylesheets it couldn't read (cross-origin, no CORS). The hash suffix is typically build-derived and can change on the next deploy - treat a found class as good for testing now, not for hardcoding into something meant to survive a release.

Event Debugger - a standalone panel for watching one specific element/event pair. Pick an element (same picker as Element inspector), choose a built-in event type or name a custom DOM event, and optionally list window globals to watch. Every firing logs the target, any diffs in the named globals (before -> after), and any network requests within 1.5 seconds after, cross-referenced against Traffic history. Multiple watches can run at once, each with its own Remove; Remove all / Clear log sit above. The log persists across reloads (byte-budget capped) - the watch itself can't (live element reference), so it needs re-adding after a reload, but what it already caught survives.

This does not accept or run any code you write - it only logs. For running code automatically on an event, see the JS Console's event-driven automation.

DOM Mutation Watcher - Event Debugger's sibling, for changes not tied to a user event: a value ticking up on a timer, an HP bar updating from WebSocket data, anything the game changes on its own. Pick an element, choose which kinds of change to watch (added/removed nodes, attributes, text, children), logged via the browser's native MutationObserver. Purely observational, never writes to the DOM. Same-batch mutations fold into one log entry rather than flooding it. Log persists across reloads, same watch-vs-log split as Event Debugger.

Script sources - every script tag on the page, inline content shown directly, external files fetched on request so you can read the real source. A "Run a script from any URL" card sits above the list - not limited to scripts this tool found on the current page; paste any script URL, fetch it (subject to the same CORS restrictions as any other fetch from here), and it gets the same actions as anything else found here. From any expanded script (or a fetched-from-anywhere one):
- Test in Sandbox - test-run it in isolation (see Script Sandbox, under Testing & Automation).
- Run on Live Page - runs it directly against the real page, the same way the JS Console does, with the same Page context / Isolated (bypass CSP) mode choice available here too - a small pill row above the script text picks which one, confirmed every time before it runs.
- Copy, as before.

Can also show the scripts referenced by a crawled page instead of the live one's - see Active Discovery's Same-Origin Crawler below. Same banner/back-to-live-page pattern as the DOM panel above; Refresh always snaps back to live.

===========================
STORAGE & DATA
===========================

window globals - a scan of everything sitting on `window` that isn't a normal browser API. Tap a row to copy its value. Each row also has a "Get/Set via Path access" button (or "Call via Path access" for a function) that jumps into the JS Console's Path Access mode with that key pre-filled - browse to discover what's there, one tap to act on it rather than needing to already know the exact path.

Can also arrive here highlighted from Tech Fingerprint (Recon, below): a signature matched via a specific global gets scrolled to and flagged "found via Tech Fingerprint" until you navigate away.

localStorage / sessionStorage - browse, edit, add, and delete keys directly against the live page's real storage, changes taking effect immediately (the same as the page's own JS calling setItem). Select a key to open it in an editable textarea with Save/Delete/Copy; "+ Add key" for a new one. "Copy all as JSON" respects whichever of the two (local vs session) is currently selected.

Cookies - the same editable pattern, for whichever cookies are readable from JS. httpOnly session cookies won't appear here and can never be touched from JS - a real security boundary, not a gap in this tool. Edits write with `path=/` by default, since a cookie's real path/domain/secure/sameSite attributes aren't visible from `document.cookie` - if the real cookie used a different path, an edit here may add a second cookie rather than cleanly replace it. Same caveat applies to Delete.

Can also arrive here with a specific cookie pre-selected, jumped to from a Misconfig Audit finding (Recon, below) - e.g. tapping "Cookie lacks HttpOnly" opens straight to that cookie's detail view.

Save to vault - both of the above have this button on a key's detail view, saving that specific key/value pair (with an optional label) to the Storage/Cookie Vault below.

Storage/Cookie Vault - a curated set of specific values you've deliberately kept, independent of whatever's currently live at that key - the same idea as the Token Vault below, for storage/cookie values. The live editors above only show the current value; this pins a value to reuse later, even after the live key changes or reloads. Each entry can be edited in place, applied back (optionally under a different key, so it can double as a reusable template), removed, or copied. Persists across reloads.

Storage/Cookie Watcher - for a chosen localStorage key, sessionStorage key, or cookie, polls on a 1-second interval and logs any change (old value -> new value). Polls rather than listening for a native event because there isn't one here - same-document storage writes and cookie changes don't fire anything observable (the browser's own "storage" event only fires in other tabs/windows). The key field is a dropdown of whatever keys are present right now for the chosen kind, with a manual Refresh for when the site writes a new key after the panel's open. Both the watch list and log persist across reloads - unlike its DOM-based siblings, a storage/cookie watch is just `{kind, key}`, no live element reference to lose, so it auto-resumes after a reload rather than needing to be re-added.

IndexedDB - browse every database the page's own scripts have created, drill into object stores, and view/edit/add/delete individual records. `indexedDB.databases()` isn't supported in every browser/webview; where it isn't, this panel says so plainly rather than silently showing nothing. Records are capped at 200 per store for browsing (a store can hold thousands; this is for inspecting/editing specific records, not a bulk dump), and stores show whether their key is inline (from a field in the value) or out-of-line (set separately) - the editor adapts accordingly. Editing only round-trips values that are plain JSON; IndexedDB legitimately allows Blobs, ArrayBuffers, Dates, Maps and similar, and anything that doesn't survive a `JSON.stringify`/`parse` cycle cleanly is shown read-only with an explicit note, rather than silently corrupting it.

===========================
RECON
===========================

All four pages here are entirely passive - they only read data the tool already has (live DOM, `window` globals, response headers already in Traffic history, flagged sweep results already in Replay history) or, in two opt-in cases (Misconfig Audit's own-page header check, GraphQL Introspection's check), make exactly one extra request you explicitly trigger. Nothing here batches requests or brute-forces - that's Active Discovery, next section.

Tech Fingerprint - signature-matches the page's DOM, script `src` paths, `window` globals, `<meta name="generator">`, and response headers already in Traffic history against roughly 30 known signatures: CMS platforms (WordPress, Shopify, Drupal, Wix, Squarespace, Joomla, Magento), JS frameworks/libraries (React, Next.js, Vue, Nuxt, Angular, Svelte, Ember, Alpine, htmx, jQuery, Lodash, Redux, Bootstrap), analytics/tracking (GA4, GTM, Meta Pixel, Sentry, Segment, Hotjar), security/captcha/payments (reCAPTCHA, hCaptcha, Cloudflare Turnstile, Stripe), and server/infra (Cloudflare, nginx, Apache, Vercel, CloudFront, Express, PHP, ASP.NET). Each match gets a confidence score - high/medium/low - by how many independent signals fired.

Outdated-library CVE awareness - where a version was actually extracted, it's checked against a small curated reference table of well-known, publicly-documented CVEs (currently jQuery, Bootstrap, WordPress, Drupal - more can be added over time). Reference lookup only: version threshold, CVE ID(s), disclosure date, one-line note - no payload, no PoC. A match gets a red-tinted row and an added line, e.g. "jQuery 1.8.2 - below patched version for CVE-2020-11022/CVE-2020-11023 (disclosed 2020-04-29): XSS via jQuery.htmlPrefilter() on untrusted HTML." Version extraction (script filenames, `?ver=` params, `window.X.version` globals, meta tags, headers) only succeeds for some signatures/sites - no version shown means no CVE check ran, not that the library is safe.

Tap a finding to jump to where it was actually found: a script-based match opens Script sources with that exact script expanded; a global-based match opens window globals with that key highlighted and scrolled into view; a header-based match (the infra/server category) opens Traffic history filtered to the current host, since headers live per-request rather than at one single place; anything else falls back to the DOM tab. Re-scan re-runs against the current state of the page (nothing here auto-refreshes); Copy all grabs the full result set as JSON.

Misconfig Audit - checks response headers already in Traffic history for missing security headers (CSP, X-Frame-Options, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, Permissions-Policy - HSTS only on https), flags an incomplete CSP (missing frame-ancestors), version-disclosing Server/X-Powered-By headers, every cookie visible via `document.cookie` as lacking HttpOnly (true by definition), scans captured 4xx/5xx bodies for verbose error signatures (Python tracebacks, Node/V8 stack traces, PHP fatals, Java stack traces, .NET exceptions, Django DEBUG=True, Laravel/Whoops, raw SQLSTATE), and checks CORS header pairings on observed cross-origin traffic - wildcard origin + credentials, "null" origin + credentials, or the request's own Origin reflected back with credentials all get flagged (the last one worth confirming from another origin directly, since a passive read can't tell reflection apart from a legitimate matching allowlist).

"Check this page's headers" is the one opt-in request this panel can make: a single same-origin GET to read the current document's own response headers, since fetch/XHR hooks only ever see calls made after the page already loaded, never the original navigation response. Shows a live "Checking..." state and an explicit result line afterward (headers found + when, or the specific error) rather than just silently updating. Tap a finding to jump to it: cookie findings open Cookies with that cookie pre-selected; header/disclosure/CORS findings open Traffic history filtered to the current host; verbose-error findings open Traffic history filtered to the specific URL that leaked it.

GraphQL Introspection - lists any endpoint that looks GraphQL-shaped from Observed Endpoints (a `/graphql`-ish path, or a POST body with a `query`/`mutation` field), and lets you send a deliberately minimal introspection probe against any of them - one POST asking only for the schema's root type name, not a full dump - confirmed first, naming exactly what's about to be sent. ENABLED means the full schema (every query, mutation, type, field) is very likely enumerable by anyone who can reach it, since this check only asked for one type name as a canary. Each endpoint's result (enabled/disabled/inconclusive, status, timestamp) is kept so revisiting the panel doesn't lose what was found.

Findings - rolls up Tech Fingerprint hits (including outdated-library CVE matches, scored as their own entries separate from the plain "tech detected" entry), Misconfig Audit findings (including CORS), GraphQL Introspection results, and flagged Parameter Sweep results into one list, sorted by a single 0-100 confidence score instead of several scales. Misconfig severity and Fingerprint confidence each map to a base score; CVE matches score a flat 80 (high); GraphQL introspection enabled scores medium; sweep anomalies score by signal type - a leaked error signature or failed request highest, status/timing next, length delta alone lowest - climbing further when independent signal types corroborate each other. A summary line shows the high/medium/low breakdown and total.

Re-scan re-runs Tech Fingerprint and Misconfig Audit fresh (also recomputing CVE matches) and re-pulls whatever's flagged in Replay history and checked in GraphQL Introspection; Copy all grabs the full scored list as JSON. Tap a finding to jump to it - fingerprint/CVE/misconfig findings use their own panels' locate behavior; a sweep-anomaly finding opens the same detail view as in the sweep log. Findings keeps its own cache separate from the source panels' - if a scan elsewhere turns up something new mid-session, use Findings' own Re-scan to pick it up.

===========================
ACTIVE DISCOVERY
===========================

Unlike Recon above, everything here sends real requests against the live server, using the current session/cookies. All three pages require an explicit confirmation naming exactly what's about to fire before anything runs, and enforce a 250ms floor between requests regardless of what's typed. May look at allowing edited session/cookies for this in the future.

Path/Endpoint Brute-force - GETs each path in a list against a base URL (defaults to current origin), one at a time, at least as far apart as the delay. A pulsing "Checking N/Total: /path" line shows what's in flight, so a long run doesn't look stalled. Only non-404 responses get written into Traffic history and Observed Endpoints. In the results panel, 404s are hidden by default (a checkbox un-hides them) so long results stay readable - the header always shows how many were hidden, and hits/tried counts are unaffected either way. Send mode is the same Standard (fetch) / Privileged (GM_xmlhttpRequest) choice as Replay/Edit.

The path list itself:
- Ships with a curated default (70 paths): config/secrets exposure (.env, wp-config.php.bak, .aws/credentials), VCS leftovers (.git/HEAD, .svn/entries), common admin/API surfaces (/wp-admin/, /api/v1/, /graphql, /swagger.json), standard discovery files (robots.txt, sitemap.xml, health/status/metrics).
- Editable in a textarea at any time, with a live "N parsed" count so what's about to run is never a surprise.
- Accepts CSV as well as a plain newline list: each line's first comma-separated field is the path, so a one-per-line list or a `path,description` spreadsheet export both work - extra columns are ignored.
- "Import CSV/TXT file" loads a list from disk via a file picker.
- Saved lists persist across reloads (named, one per partner/client/project) - "Save current as..." saves the textarea, tapping a saved list loads it back for editing, each has its own Delete.
- CMS plugin/theme wordlist presets - a dropdown loads common WordPress/Drupal/Joomla plugin, theme, and module slugs combined with known install-path patterns (e.g. `/wp-content/plugins/<slug>/`, `/sites/all/modules/<slug>/`, `/components/com_<slug>/`), appending the generated paths (deduped) rather than overwriting the list. Same engine, no separate mechanism.

A wordlist here is for path/endpoint existence checks (does this URL respond, and with what).

Recursive discovery - any hit that looks directory-shaped (path ends in `/`, response was 200 or 403) gets its own "Brute-force under this path" button on that result row (📂-labeled if the body looked like an open directory listing). Tapping it sets Base URL to that path and immediately starts a new run with whatever's in the wordlist box, through the same confirmation as the main Run button. Benefits the CMS presets too - a hit on a plugin's own directory can be recursed into with one tap.

Send to Hidden Params - the results header also has a button to queue every hit URL from the current run into Hidden Parameter Discovery (below) and jump there, same idea as "Send to Crawler" next to it. Since parameter fuzzing only ever targets one URL at a time, queued URLs show up there as a tappable list under the target field - tap one to load it as the active target.

Same-Origin Crawler - fetches whichever pages you select and extracts their same-origin links, feeding discovery from what a page actually links to. Two-phase:
1. "Scan this page for links" - pure DOM parsing, zero requests, populates a checkbox list of same-origin links found on the live page.
2. Select which ones to visit (individually, or Select all), then Crawl selected - each gets fetched for real, in order, at the configured delay. Every visited URL gets written into Traffic history and Observed Endpoints regardless of status, since a deliberately-chosen crawl target is always meaningful.

Links found inside a crawled page come back as a separate "new links found this round - not queued yet" list rather than being auto-added.

Inspect DOM/Scripts - once a page has been crawled, its log entry gets an "Inspect DOM/Scripts" button that loads its captured HTML into the DOM panel and script tags into Scripts (Page & DOM, above) - same viewers, pointed at a fetched-but-not-navigated page, with a banner and a one-tap way back to live. Scoped to just these two panels since they're pure HTML/text parsing; the element picker, console/script-exec modes, and Storage/Cookies/IndexedDB either need a real live document or are already origin-scoped, so none can meaningfully target a fetched-but-not-navigated page.

Hidden Parameter Discovery - a fuzzer sibling to Parameter Sweep rather than a modification of it: takes a single target URL (defaults to the current page, or fills in from the "Send to Hidden Params" shortcut above) and a wordlist of common parameter names (`debug`, `admin`, `redirect`, `callback`, `token`, and ~70 more covering auth/session, redirect/SSRF-shaped, admin/internal, and cache/verbosity-flag names), then sends one real GET per name, appended as `?name=1`. Reuses the exact same anomaly-diff engine as Parameter Sweep (status/length/timing deltas against the first-sent name as baseline, plus verbose-error signatures) to flag names that shift the response - deltas worth a look, not confirmed findings. Same pulsing "Checking N/Total" indicator as Path/Endpoint Brute-force.

===========================
TESTING & AUTOMATION
===========================

The JS Console

Runs directly against the live page - not a sandbox, so it can read and change anything the chosen mode has access to, including other scripts' data. There's no undo. Three execution modes, chosen explicitly each time:

- Page context - runs via the page's own eval(). Full, direct access to real globals with no prefix needed, but bound by that page's Content Security Policy - works fine on most pages, gets a flat CSP error on ones that don't allow 'unsafe-eval'. That's the page's own policy, not a bug.

- Isolated (bypass CSP) - compiles code in the userscript's own isolated JS context instead of the page's. Many browsers don't apply the page's CSP there, so this can work even where Page context is blocked. Reference the live page via unsafeWindow. A Test compile button reports plainly whether it works on the current page - on some setups it's blocked even here, meaning there's genuinely no way to run arbitrary typed code from a userscript on that page.

- Path access - for exactly the pages where both above are blocked. Reads, writes, or calls a single property path (e.g. `gameState.player.money`) via real property access rather than compiling code from a string, so CSP's 'unsafe-eval' restriction doesn't apply. Three operations: Get (no confirm), Set (confirmed, writes a JSON value), Call (confirmed, invokes a function with optional JSON args, awaits a returned promise up to 10s). Window Globals' "Get/Set/Call via Path access" buttons land here pre-filled. The tradeoff: no loops, no multi-statement logic - one path, one operation per run.

Event-driven automation - pick an element and event (same picker as Event Debugger), then arm whatever's currently in the code box, using whichever of Page context or Isolated is selected, to run automatically every time that event fires. One binding at a time; arming a new one replaces the last. Requires one explicit confirm when arming, since after that it runs unattended with no per-firing confirmation. Runs skip themselves while a previous run is still in flight. A live run log shows it's actually firing. In-memory only - cleared on reload.

Script Sandbox

Reachable from any expanded script via "Test in Sandbox," or from anything pasted directly into the Sandbox editor. Runs edited script text inside a sandbox="allow-scripts" iframe with no allow-same-origin - a genuinely separate opaque origin the parent page can't reach and vice versa. document/localStorage/sessionStorage inside it are limited fake stand-ins, explicitly labeled as such. Console output captured; capped at a 3-second hard timeout. A Recent snippets list keeps the last 15 run scripts (code only), persisted across reloads.

Investigation Recorder - opt-in only; nothing is watched until you tap Start recording. While on, it merges clicks, form activity (never the value typed - only that input happened), DOM changes, console output, uncaught errors, and network calls into one chronological timeline (timestamp order, not proof of causality). A continuing session survives a reload: state persists, and the recorder resumes and backfills the reload gap from the persisted traffic cache (marked as backfilled, since it's reconstructed). A `pagehide`/`beforeunload` flush covers a reload before the normal save fires.

Snapshots - a one-tap bundle of localStorage, sessionStorage, cookies, and window globals as they stand right now, optionally labeled. Capture a few at different points (before/after a reload, before/after an action) and diff any two of them against each other. Persists across reloads, capped at 10 snapshots (evicted whole, oldest first, never trimmed internally - a partially-trimmed snapshot would be a worse record than fewer complete ones).

Restore - each saved snapshot has a Restore button that writes its localStorage/sessionStorage/cookies back onto the live page right now, using the same edit functions as the Storage & Data panels. Deliberately an overlay, not a wipe-and-replace: keys that exist now but weren't in the snapshot are left alone. Window globals and IndexedDB are not restored - globals were only captured as string previews, not real values, and IndexedDB was never part of a snapshot to begin with.

(This is a different feature from "Compare traffic across page loads" - that one is traffic-only. Export/AI Briefing's DOM snapshot category covers taking a point-in-time storage dump somewhere permanent/shareable, separate from either.)

Value Tracer - type in a value you can see on the page (a price, a name, an id) and it finds every place that value shows up: DOM text, window globals, and JSON paths inside every response this session has captured. Substring match, case-sensitive, deliberately not fuzzy. Three modes: Live, History, Correlate.

Live runs a fresh trace and automatically saves it to History - persisted across page loads and sessions. History groups saved traces by hostname, newest first. History size is capped (default 150 entries, adjustable in Settings) and supports Export/Import via copy-paste (merges rather than replaces, deduplicated).

Correlate compares your own past traces against each other: Track one value (Persistent / Intermittent / New-or-Gone locations for a single term across its trace history) or Compare two values (which locations held both a "was" and an "is now" value, with a best-effort note on which was seen first, or "interleaved" if the data doesn't cleanly separate in time). Both modes are entirely a diff of your own saved trace history against itself.

Token Inspector - scans storage, cookies, and captured traffic for anything token-shaped (by name, or a well-formed JWT regardless of name). JWTs get fully decoded: header, payload, expiry status from the token's own exp claim. Payload anomaly flags run automatically (alg: none, inconsistent timestamps, missing exp, unusually long lifetime, sensitive-looking field names, missing sub/iss/aud, a path-like kid header, non-standard typ) - every flag is a flag, not a finding, since verifying a signature needs the issuing server's key.

A Scanned / Vault toggle switches between live scan results and a saved vault:
- Save to vault on any scanned token (with an optional label) keeps it around even after it rotates out of storage or falls out of traffic history. + Add manually pastes in a token from elsewhere entirely - useful for testing against something deliberately expired or malformed, not just what the scanner happened to find. Edit value on a saved entry changes it in place without removing and re-adding.
- The vault persists across reloads. This is real credential material - persistence is genuinely useful for reusing a token across a multi-reload flow. Treat this list with the same care as the tokens themselves.
- Send with this token... on any token (scanned or vaulted) opens Replay/Edit prefilled with the right header, so sending or replaying a specific credential reuses the same editor, history, sweep, and automation tools as everything else in Replay/Edit.

===========================
EXPORT / AI BRIEFING
===========================

Pulls together whatever you've captured into either raw structured JSON (for your own use), a condensed briefing meant to be pasted straight into an AI assistant for analysis, or CSV.

Each category has its own checkbox, disabled/greyed when there's nothing to export yet, with a colored dot showing whether it survives a reload, resets, or is always freshly regenerated - green for survives, most categories are green now. Two categories are off by default regardless of data: Token Vault and Storage/Cookie Vault, since both can carry raw credential or session-identifying values - checking them is an explicit opt-in, not part of checking "everything."

Categories: network requests, endpoint catalog, persisted traffic cache, recorder timeline, last picked element, page load timing, WebSocket activity, the WebSocket message catalog, Value Tracer history, last Replay result, Replay session history, last Sandbox run, Sandbox code history, DOM snapshot (localStorage + sessionStorage + cookies + IndexedDB, all in one flat set of source/key/value rows), the Event Debugger log, the DOM Mutation Watcher log, the Storage/Cookie Watcher log, Snapshots, the Token Vault, the Storage/Cookie Vault, Tech Fingerprint results (including CVE matches embedded per-hit), Misconfig Audit findings, GraphQL Introspection checks, Findings consolidated (including CVE and CORS/GraphQL entries), Path/Endpoint Brute-force results (last run only), and Hidden Parameter Discovery results (last run only, annotated with the same baseline/flagged data shown on-screen).

CSV export covers every category above except single point-in-time objects rather than lists (last picked element, page timing, last Replay result, last Sandbox run) - those stay JSON/briefing-only. Everything else, including the two newest categories, has a CSV table. Recorder timeline entries vary by kind, so CSV keeps Timestamp/Kind fixed and flattens the rest into one Detail column. WebSocket activity gets one row per message. Replay session history has SweepValue/Anomaly/AnomalyReasons columns, populated only on sweep-originated entries. Checking multiple CSV-eligible categories produces multiple tables in one copy, separated by headers, not merged.

Path/Endpoint Brute-force and Hidden Parameter Discovery results are "last run only" - unlike most categories, they don't accumulate, they hold whatever the most recent run produced, and reset (rather than survive) a reload. Export before starting another run or reloading if you want to keep it. Recursive discovery runs and CMS preset hits both feed the same Path/Endpoint Brute-force category, since they use the identical engine - no separate category needed. CVE-flagged fingerprint evidence needs none either: it round-trips automatically as part of Findings, since Findings exports generically regardless of source panel.

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

Saved Path/Endpoint wordlists (Active Discovery) are not currently covered by any Settings clear button - remove them individually via each list's own Delete button on the Path/Endpoint Brute-force page. Looking to add this to settings menu later.

None of the clear buttons touch the page's actual localStorage, sessionStorage, cookies, or IndexedDB - they only clear what this tool has captured/cached about itself. The Storage/Cookie and IndexedDB editors write to the real thing directly and are a separate concern from anything Settings clears.

Tw33k Tools - Target Data is a diagnostic tool intended for the user's own account/session, not for scraping or automating against other users. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
