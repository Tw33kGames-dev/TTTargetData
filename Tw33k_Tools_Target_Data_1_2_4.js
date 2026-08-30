// ==UserScript==
// @name         Tw33k Tools - Target Data
// @namespace    https://github.com/Tw33k
// @version      1.2.4
// @description  A general-purpose dev/diagnostic tool for browser-based games: DOM/element inspection, storage/cookies, network traffic (catalog+persisted cache, diffing, filtering, waterfall), WebSocket (catalog, resend, sequences), page timing, script exec (sandboxed, run-anywhere, page/isolated/CSP-proof path-access modes), JS console, Token Inspector, Recorder, Event/DOM/Storage watchers, Snapshots, Value Tracer, Replay/Edit (sweeps, automation, privileged send), page-load diffing, Export/AI Briefing.
// @author       Tw33k
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-start
// @license      GPL-3.0-or-later
// ==/UserScript==

/*
 * Tw33k Tools - Target Data
 * Copyright (C) 2026 Tw33k
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

(function () {
    'use strict';

    const APP = {
        id: 'ttd',
        name: 'Tw33k Tools - Target Data',
        version: '1.2.4'
    };

    const Storage = {
        lastWriteError: null,
        get(key, fallback) {
            if (fallback === undefined) fallback = null;
            try { return GM_getValue(key, fallback); } catch { return fallback; }
        },
        // Returns true/false so callers doing budgeted or best-effort writes (e.g. persisted
        // traffic cache) can react to a failed write instead of silently assuming it landed -
        // storage ceilings vary a lot across userscript engines/hosts.
        set(key, value) {
            try {
                GM_setValue(key, value);
                this.lastWriteError = null;
                return true;
            } catch (e) {
                this.lastWriteError = { key, message: (e && e.message) || String(e), timestamp: Date.now() };
                return false;
            }
        },
        delete(key) {
            try { GM_deleteValue(key); } catch {  }
        }
    };

    const Theme = {
        light: {
            panelBg: '#ffffff', panelText: '#222', rowBg: '#ffffff', rowText: '#222',
            rowBorder: '#ececec', secondaryBtnBg: '#f5f5f5', cardDesc: '#888',
            statusOk: '#2e7d32', statusBad: '#c0392b', statusNeutral: '#999', statusWarn: '#b8860b',
            selectBg: '#ffffff', selectText: '#222', selectBorder: '#ccc'
        },
        dark: {
            panelBg: '#1c1c1e', panelText: '#eee', rowBg: '#1c1c1e', rowText: '#eee',
            rowBorder: '#333333', secondaryBtnBg: '#262626', cardDesc: '#999',
            statusOk: '#4caf50', statusBad: '#e57373', statusNeutral: '#999', statusWarn: '#d4a72c',
            selectBg: '#242424', selectText: '#eee', selectBorder: '#444444'
        },
        get palette() {
            return Config.theme === 'dark' ? Theme.dark : Theme.light;
        }
    };

    const Config = {
        get theme() {
            return Storage.get('ttd_theme', 'light');
        },
        set theme(value) {
            Storage.set('ttd_theme', value);
        },

        get jsConsoleHistory() {
            return Storage.get('ttd_console_history', []) || [];
        },
        set jsConsoleHistory(value) {
            Storage.set('ttd_console_history', (value || []).slice(-15));
        },

        get sandboxCodeHistory() {
            return Storage.get('ttd_sandbox_history', []) || [];
        },
        set sandboxCodeHistory(value) {
            Storage.set('ttd_sandbox_history', (value || []).slice(-15));
        },

        get panelPos() {
            return Storage.get('ttd_panel_pos', null);
        },
        set panelPos(value) {
            Storage.set('ttd_panel_pos', value);
        },

        get traceHistory() {
            return Storage.get('ttd_trace_history', []) || [];
        },
        set traceHistory(value) {
            Storage.set('ttd_trace_history', value || []);
        },

        get traceHistoryCap() {
            const v = Storage.get('ttd_trace_history_cap', 150);
            const n = Number(v);
            return Number.isFinite(n) && n > 0 ? Math.floor(n) : 150;
        },
        set traceHistoryCap(value) {
            const n = Number(value);
            Storage.set('ttd_trace_history_cap', Number.isFinite(n) && n > 0 ? Math.floor(n) : 150);
        },

        // Soft ceiling (approx. bytes, measured as serialized string length - not exact for
        // non-ASCII but close enough for a safety margin) for the persisted traffic cache.
        // Kept low by default since this writes via GM_setValue, whose real ceiling varies
        // a lot by userscript engine/host and isn't something this tool tries to detect.
        get persistedTrafficBudgetBytes() {
            const v = Storage.get('ttd_persisted_traffic_budget', 250000);
            const n = Number(v);
            return Number.isFinite(n) && n > 0 ? Math.floor(n) : 250000;
        },
        set persistedTrafficBudgetBytes(value) {
            const n = Number(value);
            Storage.set('ttd_persisted_traffic_budget', Number.isFinite(n) && n > 0 ? Math.floor(n) : 250000);
        },

        // Soft ceiling for the Recorder's cross-reload resume state. Kept modest by default -
        // individual entries (clicks, mutations, console lines) are small compared to full API
        // responses, but a long multi-reload session could still add up.
        get recorderPersistBudgetBytes() {
            const v = Storage.get('ttd_recorder_persist_budget', 100000);
            const n = Number(v);
            return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100000;
        },
        set recorderPersistBudgetBytes(value) {
            const n = Number(value);
            Storage.set('ttd_recorder_persist_budget', Number.isFinite(n) && n > 0 ? Math.floor(n) : 100000);
        },

        // Shared budget for the lower-priority persisted streams (DOM Mutation Watcher log,
        // WebSocket message catalog, WebSocket connection history) - applied independently to
        // each rather than split between them, so it's one dial instead of three, but the
        // worst-case combined size is roughly 3x this number.
        get secondaryLogsBudgetBytes() {
            const v = Storage.get('ttd_secondary_logs_budget', 50000);
            const n = Number(v);
            return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50000;
        },
        set secondaryLogsBudgetBytes(value) {
            const n = Number(value);
            Storage.set('ttd_secondary_logs_budget', Number.isFinite(n) && n > 0 ? Math.floor(n) : 50000);
        },

        get wsCaptureEnabled() {
            return Storage.get('ttd_ws_capture_enabled', false) === true;
        },
        set wsCaptureEnabled(value) {
            Storage.set('ttd_ws_capture_enabled', value === true);
        },

        get wsSequences() {
            return Storage.get('ttd_ws_sequences', []) || [];
        },
        set wsSequences(value) {
            Storage.set('ttd_ws_sequences', (value || []).slice(-30));
        },

        get pageLoadSnapshots() {
            return Storage.get('ttd_pageload_snapshots', []) || [];
        },
        set pageLoadSnapshots(value) {
            Storage.set('ttd_pageload_snapshots', (value || []).slice(-40));
        }
    };

    async function copyToClipboard(text) {
        try {
            GM_setClipboard(text);
            return true;
        } catch {
            try {
                if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                    await navigator.clipboard.writeText(text);
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        }
    }

    function getRealWindow() {
        try {
            if (typeof unsafeWindow !== 'undefined' && unsafeWindow) return unsafeWindow;
        } catch {  }
        return window;
    }

    const JsonTree = {
        MAX_ARRAY_ITEMS: 200,
        MAX_STRING_DISPLAY: 300,

        createState(root) {
            return { root, expanded: new Set(['']), search: '' }; 
        },

        render(containerEl, state, t) {
            containerEl.innerHTML = '';
            containerEl.style.fontFamily = 'monospace';
            containerEl.style.fontSize = '11px';

            const term = state.search.trim().toLowerCase();
            const matchInfo = term ? this._computeMatches(state.root, term) : null;

            const rootEl = this._renderNode('', null, state.root, state, t, matchInfo, 0, containerEl);
            containerEl.appendChild(rootEl);
        },

        _computeMatches(root, term) {
            const expandPaths = new Set();
            const matchPaths = new Set();

            const childPath = (parent, key, isArray) => {
                if (parent === '') return isArray ? `[${key}]` : String(key);
                return isArray ? `${parent}[${key}]` : `${parent}.${key}`;
            };

            const walk = (path, key, value) => {
                let selfMatches = key !== null && String(key).toLowerCase().includes(term);
                if (value !== null && typeof value === 'object') {
                    let childMatched = false;
                    if (Array.isArray(value)) {
                        value.forEach((v, i) => {
                            if (walk(childPath(path, i, true), i, v)) childMatched = true;
                        });
                    } else {
                        Object.keys(value).forEach((k) => {
                            if (walk(childPath(path, k, false), k, value[k])) childMatched = true;
                        });
                    }
                    if (childMatched) { expandPaths.add(path); selfMatches = true; }
                } else if (String(value).toLowerCase().includes(term)) {
                    selfMatches = true;
                }
                if (selfMatches) matchPaths.add(path);
                return selfMatches;
            };

            walk('', null, root);
            return { expandPaths, matchPaths };
        },

        _typeColor(t, type) {
            if (type === 'string') return t.statusOk;
            if (type === 'number') return '#4a90d9';
            if (type === 'boolean') return t.statusWarn;
            if (type === 'null') return t.cardDesc;
            return t.rowText;
        },

        _formatPrimitive(value) {
            if (value === null) return 'null';
            if (value === undefined) return 'undefined';
            if (typeof value === 'string') {
                const truncated = value.length > this.MAX_STRING_DISPLAY;
                const shown = truncated ? value.slice(0, this.MAX_STRING_DISPLAY) + '...' : value;
                return `"${shown}"`;
            }
            return String(value);
        },

        _highlightIfMatch(text, path, matchInfo, t) {
            const escaped = Helpers._escape(text);
            if (!matchInfo || !matchInfo.matchPaths.has(path)) return escaped;
            return `<span style="background:${t.statusWarn};color:#000;border-radius:2px;padding:0 2px;">${escaped}</span>`;
        },

        _copyBtn(label, getText, t) {
            const btn = document.createElement('span');
            btn.textContent = label;
            btn.style.cssText = `cursor:pointer;color:${t.cardDesc};font-size:9px;text-decoration:underline;margin-left:8px;white-space:nowrap;`;
            btn.onclick = async (e) => {
                e.stopPropagation();
                const ok = await copyToClipboard(getText());
                btn.textContent = ok ? 'copied' : 'failed';
                setTimeout(() => { btn.textContent = label; }, 900);
            };
            return btn;
        },

        _renderNode(path, key, value, state, t, matchInfo, depth, rootContainerEl) {
            const wrapper = document.createElement('div');
            const isObject = value !== null && typeof value === 'object';
            const isArray = Array.isArray(value);

            const row = document.createElement('div');
            row.style.cssText = `display:flex;justify-content:space-between;align-items:flex-start;padding:1px 0;padding-left:${depth * 12}px;`;

            const left = document.createElement('span');
            left.style.cssText = 'word-break:break-word;flex:1;min-width:0;';

            if (isObject) {
                const forcedOpen = matchInfo && matchInfo.expandPaths.has(path);
                const isExpanded = forcedOpen || state.expanded.has(path);
                const count = isArray ? value.length : Object.keys(value).length;
                const summary = isArray ? `Array[${count}]` : `Object{${count}}`;
                const toggle = document.createElement('span');
                toggle.style.cssText = 'cursor:pointer;user-select:none;';
                toggle.innerHTML = `<span style="display:inline-block;width:12px;color:${t.cardDesc};">${isExpanded ? '\u25BC' : '\u25B6'}</span>${key !== null ? `<b>${this._highlightIfMatch(String(key), path, matchInfo, t)}</b>: ` : ''}<span style="color:${t.cardDesc};">${summary}</span>`;

                toggle.onclick = () => {
                    if (state.expanded.has(path)) state.expanded.delete(path); else state.expanded.add(path);
                    JsonTree.render(rootContainerEl, state, t);
                };
                left.appendChild(toggle);
                row.appendChild(left);
                row.appendChild(this._copyBtn('copy path', () => path || '(root)', t));
                row.appendChild(this._copyBtn('copy value', () => JSON.stringify(value, null, 2), t));
                wrapper.appendChild(row);

                if (isExpanded) {
                    const childPath = (k, arr) => (path === '' ? (arr ? `[${k}]` : String(k)) : (arr ? `${path}[${k}]` : `${path}.${k}`));
                    if (isArray) {
                        value.slice(0, this.MAX_ARRAY_ITEMS).forEach((v, i) => {
                            wrapper.appendChild(this._renderNode(childPath(i, true), i, v, state, t, matchInfo, depth + 1, rootContainerEl));
                        });
                        if (value.length > this.MAX_ARRAY_ITEMS) {
                            const more = document.createElement('div');
                            more.style.cssText = `padding-left:${(depth + 1) * 12}px;color:${t.cardDesc};font-size:10px;`;
                            more.textContent = `... ${value.length - this.MAX_ARRAY_ITEMS} more items (use copy value on the array above to get everything)`;
                            wrapper.appendChild(more);
                        }
                    } else {
                        Object.keys(value).forEach((k) => {
                            wrapper.appendChild(this._renderNode(childPath(k, false), k, value[k], state, t, matchInfo, depth + 1, rootContainerEl));
                        });
                    }
                }
            } else {
                const type = value === null ? 'null' : typeof value;
                left.innerHTML = `${key !== null ? `<b>${this._highlightIfMatch(String(key), path, matchInfo, t)}</b>: ` : ''}<span style="color:${this._typeColor(t, type)};">${this._highlightIfMatch(this._formatPrimitive(value), path, matchInfo, t)}</span>`;
                row.appendChild(left);
                row.appendChild(this._copyBtn('copy path', () => path || '(root)', t));
                row.appendChild(this._copyBtn('copy value', () => (value === null || value === undefined ? String(value) : String(value)), t));
                wrapper.appendChild(row);
            }

            return wrapper;
        }
    };

    const ResponseDiff = {
        MAX_CHANGES: 200,

        diff(oldVal, newVal) {
            const changes = [];
            this._walk(oldVal, newVal, '', changes);
            if (changes.length > this.MAX_CHANGES) {
                const truncatedCount = changes.length - this.MAX_CHANGES;
                changes.length = this.MAX_CHANGES;
                changes.push({ path: '...', type: 'truncated', note: `${truncatedCount} more change${truncatedCount === 1 ? '' : 's'} not shown` });
            }
            return changes;
        },

        _walk(oldVal, newVal, path, changes) {
            if (changes.length > this.MAX_CHANGES) return; 

            const oldIsObj = oldVal !== null && typeof oldVal === 'object';
            const newIsObj = newVal !== null && typeof newVal === 'object';

            if (!oldIsObj || !newIsObj) {
                if (oldVal !== newVal) changes.push({ path: path || '(root)', type: 'changed', oldValue: oldVal, newValue: newVal });
                return;
            }

            const oldIsArr = Array.isArray(oldVal);
            const newIsArr = Array.isArray(newVal);
            if (oldIsArr !== newIsArr) {
                changes.push({ path: path || '(root)', type: 'changed', oldValue: oldVal, newValue: newVal });
                return;
            }

            if (oldIsArr) {
                const maxLen = Math.max(oldVal.length, newVal.length);
                for (let i = 0; i < maxLen; i++) {
                    const childPath = path ? `${path}[${i}]` : `[${i}]`;
                    if (i >= oldVal.length) changes.push({ path: childPath, type: 'added', newValue: newVal[i] });
                    else if (i >= newVal.length) changes.push({ path: childPath, type: 'removed', oldValue: oldVal[i] });
                    else this._walk(oldVal[i], newVal[i], childPath, changes);
                }
                return;
            }

            const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
            allKeys.forEach((k) => {
                const childPath = path ? `${path}.${k}` : k;
                const hasOld = Object.prototype.hasOwnProperty.call(oldVal, k);
                const hasNew = Object.prototype.hasOwnProperty.call(newVal, k);
                if (!hasOld) changes.push({ path: childPath, type: 'added', newValue: newVal[k] });
                else if (!hasNew) changes.push({ path: childPath, type: 'removed', oldValue: oldVal[k] });
                else this._walk(oldVal[k], newVal[k], childPath, changes);
            });
        },

        formatValue(v) {
            if (v === undefined) return '(none)';
            if (v === null) return 'null';
            if (typeof v === 'string') return v.length > 150 ? `"${v.slice(0, 150)}..."` : `"${v}"`;
            if (typeof v === 'object') {
                try {
                    const s = JSON.stringify(v);
                    return s.length > 150 ? s.slice(0, 150) + '...' : s;
                } catch { return '[object]'; }
            }
            return String(v);
        }
    };

    const InvestigationRecorder = {
        MAX_ENTRIES: 500,
        RECORDER_STATE_KEY: 'ttd_recorder_state',
        _recording: false,
        _recordingStartedAt: 0,
        // Set on resume() to the moment *this* page instance picked the recording back up -
        // used to backfill the network-activity gap left by a reload (Traffic history itself
        // never survives a reload, so without this a continued recording would show a silent
        // hole where pre-reload requests should be).
        _resumedAt: 0,
        _entries: [],
        _mutationObserver: null,
        _lastInputRecordedAt: null,
        _originalConsole: null,
        _saveTimer: null,

        isRecording() { return this._recording; },

        // Called once at page load (mirrors ObservedTraffic.install()/WebSocketMonitor.install()).
        // If a recording was in progress when the page last unloaded, picks it back up with the
        // same _recordingStartedAt (so newly captured network entries still correlate to the
        // same session) and whatever entries had been persisted.
        resume() {
            const stored = Storage.get(this.RECORDER_STATE_KEY, null);
            if (!stored || !stored.recording) return;
            this._entries = Array.isArray(stored.entries) ? stored.entries : [];
            this._recordingStartedAt = stored.recordingStartedAt || Date.now();
            this._resumedAt = Date.now();
            this._recording = true;
            this._lastInputRecordedAt = new WeakMap();
            this._installListeners();
            this._installMutationObserver();
            this._installConsoleHooks();
            this._installErrorHooks();
            this._installUnloadFlush();
        },

        start() {
            if (this._recording) return;
            this._recording = true;
            this._recordingStartedAt = Date.now();
            this._resumedAt = this._recordingStartedAt; 
            this._entries = [];
            this._lastInputRecordedAt = new WeakMap();
            this._installListeners();
            this._installMutationObserver();
            this._installConsoleHooks();
            this._installErrorHooks();
            this._installUnloadFlush();
            // Persist immediately (not debounced) so a reload happening right after Start still
            // has something to resume from.
            this._persistState();
        },

        stop() {
            if (!this._recording) return;
            this._recording = false;
            this._removeListeners();
            if (this._mutationObserver) { this._mutationObserver.disconnect(); this._mutationObserver = null; }
            this._removeConsoleHooks();
            this._removeErrorHooks();
            this._removeUnloadFlush();
            if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
            // Clears the persisted resume flag - a stopped recording should stay stopped on the
            // next page load, not silently resume.
            Storage.set(this.RECORDER_STATE_KEY, { recording: false, recordingStartedAt: this._recordingStartedAt, entries: [] });
        },

        clear() {
            this._entries = [];
            this._scheduleSave();
        },

        _scheduleSave() {
            if (this._saveTimer) return;
            this._saveTimer = setTimeout(() => {
                this._saveTimer = null;
                this._persistState();
            }, 2000);
        },

        _persistState() {
            const budget = Config.recorderPersistBudgetBytes;
            const entries = this._entries.slice();
            const measure = () => { try { return JSON.stringify(entries).length; } catch { return 0; } };
            while (entries.length && measure() > budget) entries.shift();
            Storage.set(this.RECORDER_STATE_KEY, {
                recording: this._recording,
                recordingStartedAt: this._recordingStartedAt,
                entries
            });
        },

        // Best-effort flush right before the page unloads, since the normal 2s debounce has no
        // guarantee of running before that happens. Same caveat as the form-submit flush: not a
        // hard guarantee on every browser/userscript engine, just the closest available option.
        _installUnloadFlush() {
            this._onUnload = () => {
                if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
                this._persistState();
            };
            window.addEventListener('pagehide', this._onUnload);
            window.addEventListener('beforeunload', this._onUnload);
        },

        _removeUnloadFlush() {
            if (this._onUnload) {
                window.removeEventListener('pagehide', this._onUnload);
                window.removeEventListener('beforeunload', this._onUnload);
                this._onUnload = null;
            }
        },

        recordPick(el) {
            if (!this._recording) return;
            this._record({ kind: 'pick', target: this._describeElement(el) });
        },

        _record(entry) {
            if (!this._recording) return;
            this._entries.push({ timestamp: Date.now(), ...entry });
            if (this._entries.length > this.MAX_ENTRIES) this._entries.shift();
            this._scheduleSave();
        },

        _isOwnUI(el) {
            return !!(el && el.closest && el.closest('#ttd-panel, #ttd-launcher'));
        },

        _describeElement(el) {
            if (!el || el.nodeType !== 1) return '(unknown)';
            const cls = el.className && typeof el.className === 'string' && el.className.trim()
                ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
                : '';
            return `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls}>`;
        },

        _installListeners() {
            this._onClick = (e) => {
                if (this._isOwnUI(e.target)) return;
                this._record({ kind: 'click', target: this._describeElement(e.target) });
            };
            this._onInput = (e) => {
                if (this._isOwnUI(e.target)) return;

                const now = Date.now();
                const last = this._lastInputRecordedAt.get(e.target) || 0;
                if (now - last < 300) return;
                this._lastInputRecordedAt.set(e.target, now);
                this._record({ kind: 'input', target: this._describeElement(e.target), inputType: (e.target && e.target.type) || null });
            };
            this._onChange = (e) => {
                if (this._isOwnUI(e.target)) return;
                const t = e.target;
                const safeToShowValue = t && (t.type === 'checkbox' || t.type === 'radio' || t.tagName === 'SELECT');
                this._record({
                    kind: 'change',
                    target: this._describeElement(t),
                    value: safeToShowValue ? (t.type === 'checkbox' ? t.checked : t.value) : null
                });
            };
            this._onSubmit = (e) => {
                if (this._isOwnUI(e.target)) return;
                this._record({ kind: 'submit', target: this._describeElement(e.target) });
            };
            document.addEventListener('click', this._onClick, true);
            document.addEventListener('input', this._onInput, true);
            document.addEventListener('change', this._onChange, true);
            document.addEventListener('submit', this._onSubmit, true);
        },

        _removeListeners() {
            document.removeEventListener('click', this._onClick, true);
            document.removeEventListener('input', this._onInput, true);
            document.removeEventListener('change', this._onChange, true);
            document.removeEventListener('submit', this._onSubmit, true);
        },

        _installMutationObserver() {
            this._mutationObserver = new MutationObserver((mutations) => {
                if (!this._recording) return;

                let added = 0, removed = 0;
                const roots = new Set();
                mutations.forEach((m) => {
                    if (this._isOwnUI(m.target)) return;
                    added += m.addedNodes.length;
                    removed += m.removedNodes.length;
                    if (m.addedNodes.length || m.removedNodes.length) roots.add(this._describeElement(m.target));
                });
                if (added === 0 && removed === 0) return;
                this._record({ kind: 'mutation', added, removed, roots: Array.from(roots).slice(0, 5) });
            });
            try {
                this._mutationObserver.observe(document.body, { childList: true, subtree: true });
            } catch {  }
        },

        _installConsoleHooks() {
            this._originalConsole = { log: console.log, warn: console.warn, error: console.error };
            const wrap = (level) => {
                return (...args) => {
                    this._originalConsole[level].apply(console, args);
                    if (this._recording) {
                        this._record({ kind: 'console', level, message: args.map((a) => this._formatConsoleArg(a)).join(' ') });
                    }
                };
            };
            console.log = wrap('log');
            console.warn = wrap('warn');
            console.error = wrap('error');
        },

        _removeConsoleHooks() {
            if (this._originalConsole) {
                console.log = this._originalConsole.log;
                console.warn = this._originalConsole.warn;
                console.error = this._originalConsole.error;
                this._originalConsole = null;
            }
        },

        _formatConsoleArg(arg) {
            try {
                if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
                if (typeof arg === 'string') return arg.length > 300 ? arg.slice(0, 300) + '...' : arg;
                if (typeof arg === 'object' && arg !== null) {
                    const seen = new WeakSet();
                    const json = JSON.stringify(arg, (k, v) => {
                        if (typeof v === 'object' && v !== null) {
                            if (seen.has(v)) return '[circular]';
                            seen.add(v);
                        }
                        if (typeof v === 'function') return '[function]';
                        return v;
                    });
                    if (!json) return String(arg);
                    return json.length > 300 ? json.slice(0, 300) + '...' : json;
                }
                return String(arg);
            } catch (e) {
                return `[error formatting: ${e.message}]`;
            }
        },

        _installErrorHooks() {
            this._onError = (e) => {
                this._record({
                    kind: 'error',
                    message: e.message || (e.error && e.error.message) || 'Unknown error',
                    source: e.filename ? `${e.filename.split('/').pop()}:${e.lineno}:${e.colno}` : null
                });
            };
            this._onRejection = (e) => {
                let message;
                try { message = e.reason instanceof Error ? e.reason.message : String(e.reason); } catch { message = 'Unhandled rejection'; }
                this._record({ kind: 'error', message: `Unhandled promise rejection: ${message}`, source: null });
            };
            window.addEventListener('error', this._onError);
            window.addEventListener('unhandledrejection', this._onRejection);
        },

        _removeErrorHooks() {
            if (this._onError) window.removeEventListener('error', this._onError);
            if (this._onRejection) window.removeEventListener('unhandledrejection', this._onRejection);
            this._onError = null;
            this._onRejection = null;
        },

        timeline() {
            const networkEntries = ObservedTraffic.all()
                .filter((e) => e.recordingSession === this._recordingStartedAt)
                .map((e) => ({ timestamp: e.timestamp, kind: 'network', method: e.method, url: e.url, status: e.status, durationMs: e.durationMs }));

            // Traffic history (ObservedTraffic.all()) never survives a reload, so a recording
            // that continued across one would otherwise show a silent network gap between
            // _recordingStartedAt and whenever this page instance resumed. Backfill that gap
            // from the persisted traffic cache, which does survive - lower fidelity (last-N
            // distinct actions per endpoint, truncated bodies, no exact duration) than live
            // capture, but better than a hole. Only applies to entries strictly before the
            // resume point, so nothing gets double-counted against the live entries above.
            const backfill = (this._resumedAt && this._resumedAt > this._recordingStartedAt)
                ? ObservedTraffic.persistedTrafficEntries()
                    .filter((e) => e.timestamp >= this._recordingStartedAt && e.timestamp < this._resumedAt)
                    .map((e) => ({
                        timestamp: e.timestamp,
                        kind: 'network',
                        method: e.method,
                        url: `${e.host}${e.pathPattern}`,
                        status: e.status,
                        durationMs: null,
                        backfilled: true
                    }))
                : [];

            const combined = [...this._entries, ...networkEntries, ...backfill];
            combined.sort((a, b) => a.timestamp - b.timestamp);
            return combined;
        }
    };

    const EventDebugger = {
        MAX_LOG: 300,

        NETWORK_WINDOW_MS: 1500,

        _watches: [],
        _log: [],
        _nextWatchId: 1,
        _onLogChanged: null, 

        addWatch(el, eventType, globalNames) {
            const id = this._nextWatchId++;
            const cleanNames = (globalNames || []).map((n) => n.trim()).filter(Boolean);
            const handler = (e) => this._onFire(id, e);
            el.addEventListener(eventType, handler, true);
            const watch = {
                id,
                el,
                eventType,
                globalNames: cleanNames,
                describe: this._describeElement(el),
                handler,
                lastSnapshot: this._snapshotGlobals(cleanNames),
                firedCount: 0
            };
            this._watches.push(watch);
            return watch;
        },

        removeWatch(id) {
            const w = this._watches.find((x) => x.id === id);
            if (!w) return;
            w.el.removeEventListener(w.eventType, w.handler, true);
            this._watches = this._watches.filter((x) => x.id !== id);
        },

        removeAllWatches() {
            this._watches.forEach((w) => w.el.removeEventListener(w.eventType, w.handler, true));
            this._watches = [];
        },

        clearLog() {
            this._log = [];
        },

        all() {
            return this._watches;
        },

        log() {
            return this._log;
        },

        _snapshotGlobals(names) {
            const snap = {};
            names.forEach((n) => {
                try { snap[n] = window[n]; } catch { snap[n] = undefined; }
            });
            return snap;
        },

        _sameValue(a, b) {
            if (a === b) return true;
            try { return JSON.stringify(a) === JSON.stringify(b); } catch { return String(a) === String(b); }
        },

        _preview(value) {
            try {
                if (value === null) return 'null';
                if (value === undefined) return 'undefined';
                const t = typeof value;
                if (t === 'function') return `function ${value.name || '(anonymous)'}()`;
                if (t === 'string') return value.length > 150 ? value.slice(0, 150) + '...' : value;
                if (t === 'number' || t === 'boolean') return String(value);
                const json = JSON.stringify(value);
                if (!json) return String(value);
                return json.length > 300 ? json.slice(0, 300) + '...' : json;
            } catch (e) {
                return `[unreadable: ${e.message}]`;
            }
        },

        _describeElement(el) {
            if (!el || el.nodeType !== 1) return '(unknown)';
            const cls = el.className && typeof el.className === 'string' && el.className.trim()
                ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
                : '';
            return `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls}>`;
        },

        _onFire(watchId, e) {
            const w = this._watches.find((x) => x.id === watchId);
            if (!w) return; 

            const before = w.lastSnapshot;
            const after = this._snapshotGlobals(w.globalNames);
            const diffs = [];
            w.globalNames.forEach((name) => {
                if (!this._sameValue(before[name], after[name])) {
                    diffs.push({ key: name, from: this._preview(before[name]), to: this._preview(after[name]) });
                }
            });
            w.lastSnapshot = after;
            w.firedCount++;

            const firedAt = Date.now();
            const entry = {
                watchId,
                timestamp: firedAt,
                watchDescribe: w.describe,
                eventType: w.eventType,
                targetDescribe: this._describeElement(e.target),
                diffs,
                networkHits: null 
            };
            this._log.push(entry);
            if (this._log.length > this.MAX_LOG) this._log.shift();
            if (this._onLogChanged) this._onLogChanged();

            setTimeout(() => {
                entry.networkHits = ObservedTraffic.all()
                    .filter((t) => t.timestamp >= firedAt && t.timestamp <= firedAt + this.NETWORK_WINDOW_MS)
                    .map((t) => ({ method: t.method, url: t.url, status: t.status, timestamp: t.timestamp }));
                if (this._onLogChanged) this._onLogChanged();
            }, this.NETWORK_WINDOW_MS + 50);
        }
    };

    
    const ConsoleAutomation = {
        MAX_LOG: 100,
        _binding: null, 
        _onLogChanged: null,

        isActive() {
            return !!this._binding;
        },

        current() {
            return this._binding;
        },

        
        start(el, eventType, code, mode) {
            this.stop();
            const binding = {
                id: Date.now(),
                describe: EventDebugger._describeElement(el),
                eventType,
                code,
                mode: mode || 'page',
                runCount: 0,
                running: false,
                startedAt: Date.now(),
                log: [],
                _el: el,
                _handler: null
            };
            binding._handler = (e) => this._onFire(e);
            el.addEventListener(eventType, binding._handler, true);
            this._binding = binding;
            return binding;
        },

        stop() {
            if (this._binding) {
                try { this._binding._el.removeEventListener(this._binding.eventType, this._binding._handler, true); } catch {  }
                this._binding = null;
            }
        },

        async _onFire() {
            const b = this._binding;
            if (!b || b.running) return; 
            b.running = true;
            b.runCount++;
            const firedAt = Date.now();

            const result = await PageInspector.executeWithMode(b.code, b.mode);

            
            if (this._binding !== b) return;
            b.running = false;
            b.log.push({ timestamp: firedAt, ok: result.ok, value: result.ok ? result.value : null, error: result.ok ? null : result.error });
            if (b.log.length > this.MAX_LOG) b.log.shift();
            if (this._onLogChanged) this._onLogChanged();
        }
    };

    const DomMutationWatcher = {
        MAX_LOG: 300,
        LOG_KEY: 'ttd_dom_mutation_log',

        _watches: [],
        _log: [],
        _nextWatchId: 1,
        _onLogChanged: null,
        _saveTimer: null,

        // Only the log persists - a watch targets a live DOM element, and a reload rebuilds
        // the entire DOM from scratch, so any stored element reference would be meaningless.
        // Watches have to be re-added by hand after each reload; the record of what they
        // already saw doesn't have to be lost along with them.
        install() {
            this.load();
            const flush = () => {
                if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
                this._persistLog();
            };
            window.addEventListener('pagehide', flush);
            window.addEventListener('beforeunload', flush);
        },

        load() {
            const stored = Storage.get(this.LOG_KEY, null);
            if (Array.isArray(stored)) this._log = stored;
        },

        _scheduleSave() {
            if (this._saveTimer) return;
            this._saveTimer = setTimeout(() => {
                this._saveTimer = null;
                this._persistLog();
            }, 2000);
        },

        _persistLog() {
            const budget = Config.secondaryLogsBudgetBytes;
            const log = this._log.slice();
            const measure = () => { try { return JSON.stringify(log).length; } catch { return 0; } };
            while (log.length && measure() > budget) log.shift();
            Storage.set(this.LOG_KEY, log);
        },

        addWatch(el, options) {
            const id = this._nextWatchId++;
            const opts = {
                childList: options.childList !== false,
                attributes: options.attributes !== false,
                characterData: options.characterData !== false,
                subtree: options.subtree !== false
            };
            const observer = new MutationObserver((mutations) => this._onMutations(id, mutations));
            observer.observe(el, opts);
            const watch = {
                id,
                el,
                describe: EventDebugger._describeElement(el),
                options: opts,
                observer,
                mutationCount: 0
            };
            this._watches.push(watch);
            return watch;
        },

        removeWatch(id) {
            const w = this._watches.find((x) => x.id === id);
            if (!w) return;
            w.observer.disconnect();
            this._watches = this._watches.filter((x) => x.id !== id);
        },

        removeAllWatches() {
            this._watches.forEach((w) => w.observer.disconnect());
            this._watches = [];
        },

        clearLog() {
            this._log = [];
            this._scheduleSave();
        },

        all() {
            return this._watches;
        },

        log() {
            return this._log;
        },

        _onMutations(watchId, mutations) {
            const w = this._watches.find((x) => x.id === watchId);
            if (!w) return;
            w.mutationCount += mutations.length;

            const summary = { childList: 0, attributes: 0, characterData: 0 };
            const attributeNames = new Set();
            mutations.forEach((m) => {
                summary[m.type] = (summary[m.type] || 0) + 1;
                if (m.type === 'attributes' && m.attributeName) attributeNames.add(m.attributeName);
            });

            const entry = {
                watchId,
                timestamp: Date.now(),
                watchDescribe: w.describe,
                summary,
                attributeNames: Array.from(attributeNames),
                recordCount: mutations.length
            };
            this._log.push(entry);
            if (this._log.length > this.MAX_LOG) this._log.shift();
            this._scheduleSave();
            if (this._onLogChanged) this._onLogChanged();
        }
    };

    const StorageWatcher = {
        MAX_LOG: 300,
        POLL_INTERVAL_MS: 1000,

        _watches: [],
        _log: [],
        _nextWatchId: 1,
        _pollTimer: null,
        _onLogChanged: null,

        addWatch(kind, key) {
            const id = this._nextWatchId++;
            const watch = { id, kind, key, lastValue: this._readValue(kind, key) };
            this._watches.push(watch);
            this._ensurePolling();
            return watch;
        },

        removeWatch(id) {
            this._watches = this._watches.filter((w) => w.id !== id);
            if (!this._watches.length) this._stopPolling();
        },

        removeAllWatches() {
            this._watches = [];
            this._stopPolling();
        },

        clearLog() {
            this._log = [];
        },

        all() {
            return this._watches;
        },

        log() {
            return this._log;
        },

        _readValue(kind, key) {
            try {
                if (kind === 'local') return window.localStorage.getItem(key);
                if (kind === 'session') return window.sessionStorage.getItem(key);
                if (kind === 'cookie') {
                    const prefix = `${key}=`;
                    const match = document.cookie.split('; ').find((row) => row.startsWith(prefix));
                    return match ? decodeURIComponent(match.slice(prefix.length)) : null;
                }
            } catch {
                return undefined; 
            }
            return undefined;
        },

        listKeys(kind) {
            try {
                if (kind === 'local') return Object.keys(window.localStorage).sort();
                if (kind === 'session') return Object.keys(window.sessionStorage).sort();
                if (kind === 'cookie') {
                    return document.cookie.split('; ')
                        .filter(Boolean)
                        .map((pair) => pair.slice(0, pair.indexOf('=') === -1 ? pair.length : pair.indexOf('=')))
                        .filter(Boolean)
                        .sort();
                }
            } catch {  }
            return [];
        },

        _ensurePolling() {
            if (this._pollTimer) return;
            this._pollTimer = setInterval(() => this._poll(), this.POLL_INTERVAL_MS);
        },

        _stopPolling() {
            if (this._pollTimer) {
                clearInterval(this._pollTimer);
                this._pollTimer = null;
            }
        },

        _poll() {
            let changed = false;
            this._watches.forEach((w) => {
                const current = this._readValue(w.kind, w.key);
                if (current !== w.lastValue) {
                    changed = true;
                    const entry = {
                        watchId: w.id,
                        timestamp: Date.now(),
                        kind: w.kind,
                        key: w.key,
                        from: this._preview(w.lastValue),
                        to: this._preview(current)
                    };
                    this._log.push(entry);
                    if (this._log.length > this.MAX_LOG) this._log.shift();
                    w.lastValue = current;
                }
            });
            if (changed && this._onLogChanged) this._onLogChanged();
        },

        _preview(v) {
            if (v === null) return '(not set)';
            if (v === undefined) return '(unreadable)';
            return v.length > 200 ? v.slice(0, 200) + '...' : v;
        }
    };

    const SnapshotManager = {
        MAX_SNAPSHOTS: 10,
        _snapshots: [],
        _nextId: 1,

        capture(label) {
            const id = this._nextId++;
            const data = {
                localStorage: this._dumpStorage(() => window.localStorage),
                sessionStorage: this._dumpStorage(() => window.sessionStorage),
                cookies: this._dumpCookies(),

                globals: this._dumpGlobals()
            };
            const snap = { id, label: (label || '').trim() || `Snapshot ${id}`, timestamp: Date.now(), url: location.href, data };
            this._snapshots.push(snap);
            if (this._snapshots.length > this.MAX_SNAPSHOTS) this._snapshots.shift();
            return snap;
        },

        remove(id) {
            this._snapshots = this._snapshots.filter((s) => s.id !== id);
        },

        clear() {
            this._snapshots = [];
        },

        all() {
            return this._snapshots.slice().reverse();
        },

        get(id) {
            return this._snapshots.find((s) => s.id === id) || null;
        },

        diff(idA, idB) {
            const a = this.get(idA);
            const b = this.get(idB);
            if (!a || !b) return null;
            return { a, b, changes: ResponseDiff.diff(a.data, b.data) };
        },

        _dumpStorage(getStore) {
            const out = {};
            try {
                const store = getStore();
                for (let i = 0; i < store.length; i++) {
                    const k = store.key(i);
                    out[k] = store.getItem(k);
                }
            } catch {  }
            return out;
        },

        _dumpCookies() {
            const out = {};
            try {
                document.cookie.split('; ').forEach((pair) => {
                    if (!pair) return;
                    const idx = pair.indexOf('=');
                    if (idx === -1) return;
                    out[pair.slice(0, idx)] = decodeURIComponent(pair.slice(idx + 1));
                });
            } catch {  }
            return out;
        },

        _dumpGlobals() {
            const out = {};
            PageInspector.getExtraWindowGlobals().forEach((g) => { out[g.key] = g.preview; });
            return out;
        }
    };

    const ValueTracer = {
        MAX_PER_SOURCE: 20,

        trace(value) {
            const term = String(value).trim();
            if (!term) return { term, dom: [], globals: [], network: [] };
            return {
                term,
                dom: this._traceDom(term),
                globals: this._traceGlobals(term),
                network: this._traceNetwork(term)
            };
        },

        _traceDom(term) {
            const results = [];
            try {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                let node;
                while ((node = walker.nextNode()) && results.length < this.MAX_PER_SOURCE) {
                    const text = node.textContent;
                    if (!text || !text.includes(term)) continue;
                    const parentEl = node.parentElement;
                    if (!parentEl) continue;
                    if (parentEl.closest && parentEl.closest('#ttd-panel, #ttd-launcher')) continue;
                    const selectors = PageInspector._generateSelectors(parentEl);
                    results.push({ selector: selectors[0] || parentEl.tagName.toLowerCase(), snippet: text.trim().slice(0, 120) });
                }
            } catch {  }
            return results;
        },

        _traceGlobals(term) {
            const results = [];
            try {
                PageInspector.getExtraWindowGlobals().forEach((g) => {
                    if (results.length >= this.MAX_PER_SOURCE) return;
                    if (g.full && String(g.full).includes(term)) results.push({ key: g.key, preview: g.preview });
                });
            } catch {  }
            return results;
        },

        _traceNetwork(term) {
            const results = [];
            try {
                for (const entry of ObservedTraffic.all()) {
                    if (results.length >= this.MAX_PER_SOURCE) break;
                    if (entry.json) {
                        const paths = this._findPathsInJson(entry.json, term);
                        if (paths.length) results.push({ url: entry.url, method: entry.method, timestamp: entry.timestamp, paths: paths.slice(0, 10) });
                    } else if (entry.rawText && entry.rawText.includes(term)) {
                        results.push({ url: entry.url, method: entry.method, timestamp: entry.timestamp, paths: ['(raw text match, not JSON)'] });
                    }
                }
            } catch {  }
            return results;
        },

        _findPathsInJson(root, term) {
            const matches = [];
            const MAX = 20;
            const walk = (value, path) => {
                if (matches.length >= MAX) return;
                if (value !== null && typeof value === 'object') {
                    if (Array.isArray(value)) value.forEach((v, i) => walk(v, path ? `${path}[${i}]` : `[${i}]`));
                    else Object.keys(value).forEach((k) => walk(value[k], path ? `${path}.${k}` : k));
                } else if (String(value).includes(term)) {
                    matches.push(path || '(root)');
                }
            };
            walk(root, '');
            return matches;
        }
    };

    const TraceHistory = {
        save(traceResult) {
            if (!traceResult || !traceResult.term) return;
            const entry = {
                term: traceResult.term,
                hostname: location.hostname,
                url: location.href,
                timestamp: Date.now(),
                dom: traceResult.dom,
                globals: traceResult.globals,
                network: traceResult.network
            };
            const cap = Config.traceHistoryCap;
            const list = Config.traceHistory;
            list.push(entry);
            Config.traceHistory = list.length > cap ? list.slice(list.length - cap) : list;
            return entry;
        },

        all() {

            return Config.traceHistory.slice().reverse();
        },

        forHostname(hostname) {
            return this.all().filter((e) => e.hostname === hostname);
        },

        hostnames() {
            const seen = new Map(); 
            for (const e of this.all()) {
                const cur = seen.get(e.hostname);
                if (cur) cur.count += 1;
                else seen.set(e.hostname, { count: 1, mostRecent: e.timestamp });
            }
            return Array.from(seen.entries())
                .map(([hostname, info]) => ({ hostname, ...info }))
                .sort((a, b) => b.mostRecent - a.mostRecent);
        },

        clear() {
            Config.traceHistory = [];
        },

        termsForHostname(hostname) {
            const seen = new Map(); 
            for (const e of this.forHostname(hostname)) {
                const cur = seen.get(e.term);
                if (cur) cur.count += 1;
                else seen.set(e.term, { count: 1, mostRecent: e.timestamp });
            }
            return Array.from(seen.entries())
                .map(([term, info]) => ({ term, ...info }))
                .sort((a, b) => b.mostRecent - a.mostRecent);
        },

        exportJson() {
            return JSON.stringify(Config.traceHistory, null, 2);
        },

        importJson(jsonText) {
            let incoming;
            try { incoming = JSON.parse(jsonText); } catch { return { ok: false, error: 'Not valid JSON.' }; }
            if (!Array.isArray(incoming)) return { ok: false, error: 'Expected a JSON array of trace entries.' };

            const existing = Config.traceHistory;
            const keyOf = (e) => `${e.term}\u0000${e.hostname}\u0000${e.timestamp}`;
            const existingKeys = new Set(existing.map(keyOf));

            let added = 0;
            for (const e of incoming) {
                if (!e || typeof e.term !== 'string' || typeof e.hostname !== 'string' || typeof e.timestamp !== 'number') continue;
                const k = keyOf(e);
                if (existingKeys.has(k)) continue;
                existingKeys.add(k);
                existing.push(e);
                added += 1;
            }
            existing.sort((a, b) => a.timestamp - b.timestamp);
            const cap = Config.traceHistoryCap;
            Config.traceHistory = existing.length > cap ? existing.slice(existing.length - cap) : existing;
            return { ok: true, added, skipped: incoming.length - added };
        }
    };

    const TraceCorrelator = {

        _signaturesForEntry(entry) {
            const sigs = new Set();
            (entry.dom || []).forEach((d) => sigs.add(`dom\u0000${d.selector}`));
            (entry.globals || []).forEach((g) => sigs.add(`global\u0000${g.key}`));
            (entry.network || []).forEach((n) => {
                const shortUrl = Helpers._shortenUrl(n.url);
                (n.paths || []).forEach((p) => sigs.add(`network\u0000${n.method} ${shortUrl} :: ${p}`));
            });
            return sigs;
        },

        correlate(hostname, term) {
            const entries = TraceHistory.forHostname(hostname)
                .filter((e) => e.term === term)
                .sort((a, b) => a.timestamp - b.timestamp); 
            if (entries.length < 2) return null;

            const perEntrySigs = entries.map((e) => this._signaturesForEntry(e));
            const totalTraces = entries.length;

            const occurrences = new Map();
            perEntrySigs.forEach((sigSet, i) => {
                sigSet.forEach((sig) => {
                    if (!occurrences.has(sig)) occurrences.set(sig, []);
                    occurrences.get(sig).push(entries[i].timestamp);
                });
            });

            const signatures = Array.from(occurrences.entries()).map(([sig, timestamps]) => {
                const [kind, label] = sig.split('\u0000');
                return { kind, label, timestamps, seenCount: timestamps.length, persistent: timestamps.length === totalTraces };
            }).sort((a, b) => b.seenCount - a.seenCount || a.label.localeCompare(b.label));

            const firstSigs = perEntrySigs[0];
            const lastSigs = perEntrySigs[perEntrySigs.length - 1];
            const droppedSinceFirst = signatures.filter((s) => firstSigs.has(`${s.kind}\u0000${s.label}`) && !lastSigs.has(`${s.kind}\u0000${s.label}`));
            const appearedSinceFirst = signatures.filter((s) => !firstSigs.has(`${s.kind}\u0000${s.label}`) && lastSigs.has(`${s.kind}\u0000${s.label}`));

            return {
                hostname, term, totalTraces,
                firstTimestamp: entries[0].timestamp,
                lastTimestamp: entries[entries.length - 1].timestamp,
                signatures,
                persistent: signatures.filter((s) => s.persistent),
                intermittent: signatures.filter((s) => !s.persistent),
                droppedSinceFirst,
                appearedSinceFirst
            };
        },

        compareTerms(hostname, termA, termB) {
            if (termA === termB) return null; 
            const entriesA = TraceHistory.forHostname(hostname).filter((e) => e.term === termA).sort((a, b) => a.timestamp - b.timestamp);
            const entriesB = TraceHistory.forHostname(hostname).filter((e) => e.term === termB).sort((a, b) => a.timestamp - b.timestamp);
            if (!entriesA.length || !entriesB.length) return null;

            const buildOccurrences = (entries) => {
                const map = new Map();
                entries.forEach((e) => {
                    this._signaturesForEntry(e).forEach((sig) => {
                        if (!map.has(sig)) map.set(sig, []);
                        map.get(sig).push(e.timestamp);
                    });
                });
                return map;
            };
            const occA = buildOccurrences(entriesA);
            const occB = buildOccurrences(entriesB);

            const commonSigs = Array.from(occA.keys()).filter((sig) => occB.has(sig));
            const changes = commonSigs.map((sig) => {
                const [kind, label] = sig.split('\u0000');
                const timesA = occA.get(sig);
                const timesB = occB.get(sig);
                return {
                    kind, label,
                    firstSeenAsA: Math.min(...timesA), lastSeenAsA: Math.max(...timesA),
                    firstSeenAsB: Math.min(...timesB), lastSeenAsB: Math.max(...timesB),

                    clearOrder: Math.max(...timesA) < Math.min(...timesB) ? 'a-then-b' : (Math.max(...timesB) < Math.min(...timesA) ? 'b-then-a' : 'interleaved')
                };
            }).sort((a, b) => a.label.localeCompare(b.label));

            return { hostname, termA, termB, changes };
        }
    };

    const TokenInspector = {
        TOKEN_NAME_HINTS: ['token', 'access_token', 'refresh_token', 'id_token', 'session', 'sid', 'sessionid', 'auth', 'authorization', 'bearer', 'apikey', 'api_key', 'jwt'],

        _base64UrlDecode(str) {
            try {
                let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
                while (b64.length % 4) b64 += '=';
                const binary = atob(b64);
                try {
                    return decodeURIComponent(binary.split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                } catch {
                    return binary; 
                }
            } catch {
                return null;
            }
        },

        isJwt(value) {
            if (typeof value !== 'string') return false;
            const parts = value.split('.');
            if (parts.length !== 3) return false;
            return parts.every((p) => p.length > 0 && /^[A-Za-z0-9_-]+$/.test(p));
        },

        decodeJwt(value) {
            const parts = value.split('.');
            if (parts.length !== 3) return null;
            let header = null, payload = null;
            try { header = JSON.parse(this._base64UrlDecode(parts[0])); } catch {  }
            try { payload = JSON.parse(this._base64UrlDecode(parts[1])); } catch {  }
            if (!header && !payload) return null;

            const now = Math.floor(Date.now() / 1000);
            const exp = payload && typeof payload.exp === 'number' ? payload.exp : null;
            const iat = payload && typeof payload.iat === 'number' ? payload.iat : null;
            const nbf = payload && typeof payload.nbf === 'number' ? payload.nbf : null;

            let expiryStatus = 'unknown'; 
            if (exp !== null) {
                if (exp < now) expiryStatus = 'expired';
                else if (exp - now < 300) expiryStatus = 'expiring-soon'; 
                else expiryStatus = 'valid';
            }

            return {
                header, payload,
                hasSignature: parts[2].length > 0,
                exp, iat, nbf,
                expiryStatus,
                expiresInSeconds: exp !== null ? exp - now : null
            };
        },

        analyzeJwtAnomalies(decoded) {
            const flags = [];
            if (!decoded) return flags;
            const { header, payload, exp, iat, nbf } = decoded;
            const now = Math.floor(Date.now() / 1000);

            if (header && header.alg && String(header.alg).toLowerCase() === 'none') {
                flags.push({ severity: 'warn', label: 'alg: none', detail: 'The header claims no signing algorithm. If a server actually accepts a token like this, signature verification may not be enforced at all for it - a well-known JWT misconfiguration class. This only reflects what the token claims; it says nothing about whether the issuing server actually honors it.' });
            }
            if (exp === null) {
                flags.push({ severity: 'info', label: 'No exp claim', detail: 'This token never expires by its own payload. The server may still enforce expiry some other way (a server-side session record, a revocation list), but nothing in the token itself indicates that.' });
            }
            if (exp !== null && iat !== null && exp <= iat) {
                flags.push({ severity: 'warn', label: 'exp <= iat', detail: 'The expiry timestamp is at or before the issued-at timestamp - this token is internally inconsistent and, read literally, was already expired the moment it was issued.' });
            }
            if (nbf !== null && exp !== null && nbf > exp) {
                flags.push({ severity: 'warn', label: 'nbf > exp', detail: '"Not valid before" is after the expiry time - by these claims, there is no window during which this token is ever actually valid.' });
            }
            if (iat !== null && iat > now + 60) {
                flags.push({ severity: 'warn', label: 'iat is in the future', detail: `Issued-at is ${Math.round((iat - now) / 60)}m ahead of this device's clock. Could be ordinary clock skew between this device and the issuer, or the token was hand-crafted with an arbitrary iat.` });
            }
            if (exp !== null && iat !== null && (exp - iat) > 60 * 60 * 24 * 365) {
                flags.push({ severity: 'info', label: 'Very long lifetime', detail: `Valid for roughly ${Math.round((exp - iat) / (60 * 60 * 24 * 365))} year(s) from issue to expiry. Most short-lived access tokens are minutes-to-hours; a lifetime this long is more typical of a refresh token or an API key than a session token - worth confirming this is the token type you expect.` });
            }
            if (payload && typeof payload === 'object') {
                const sensitiveNamePattern = /password|secret|private[_-]?key|ssn|social[_-]?security|credit[_-]?card|cvv/i;
                Object.keys(payload).forEach((k) => {
                    if (sensitiveNamePattern.test(k)) {
                        flags.push({ severity: 'warn', label: `Sensitive-looking field: ${k}`, detail: 'JWT payloads are base64-encoded, not encrypted - anyone who can read this token (including this diagnostic tool, or anything else on this page) can read this field in plain text. Worth confirming this data is actually meant to travel inside a JWT.' });
                    }
                });
                const missingStandardClaims = ['sub', 'iss', 'aud'].filter((c) => !(c in payload));
                if (missingStandardClaims.length === 3) {
                    flags.push({ severity: 'info', label: 'No sub/iss/aud claims', detail: 'None of the standard subject/issuer/audience claims are present. These are optional per the JWT spec, so this isn\'t necessarily wrong, but most identity-provider-issued tokens include at least one - worth confirming this token\'s shape is what your auth flow expects.' });
                }
            }
            if (header && typeof header.kid === 'string' && /(\.\.\/|^\/|^https?:)/i.test(header.kid)) {
                flags.push({ severity: 'warn', label: 'kid header looks path-like', detail: 'The "kid" (key id) header contains something that looks like a file path or URL rather than a plain key identifier. Path/URL-like kid values are a documented pattern associated with kid-injection attacks against poorly-implemented verifiers - informational only, this describes the token\'s own claim, not a confirmed issue with whatever server issued it.' });
            }
            if (header && header.typ && String(header.typ).toUpperCase() !== 'JWT') {
                flags.push({ severity: 'info', label: `Unusual typ: ${header.typ}`, detail: 'The header\'s "typ" claim is present but isn\'t the conventional "JWT" - not a spec violation, just worth noting if you weren\'t expecting a different token type here.' });
            }

            return flags;
        },

        _looksLikeToken(name, value) {            if (!value || typeof value !== 'string' || value.length < 16) return false;
            const n = (name || '').toLowerCase();
            if (this.TOKEN_NAME_HINTS.some((hint) => n.includes(hint))) return true;
            if (this.isJwt(value)) return true;
            return false;
        },

        _stripBearerPrefix(v) {
            const m = /^Bearer\s+(.+)$/i.exec(v);
            return m ? m[1] : v;
        },

        _scanJsonForTokens(obj, sourceLabel, results, path, depth) {
            path = path || '';
            depth = depth || 0;
            if (obj === null || typeof obj !== 'object' || depth > 6) return; 
            Object.keys(obj).forEach((k) => {
                const v = obj[k];
                const childPath = path ? `${path}.${k}` : k;
                if (typeof v === 'string' && this._looksLikeToken(k, v)) {
                    results.push({ source: 'response body', location: `${sourceLabel} - ${childPath}`, value: v });
                } else if (v && typeof v === 'object') {
                    this._scanJsonForTokens(v, sourceLabel, results, childPath, depth + 1);
                }
            });
        },

        scan() {
            const results = [];

            ['local', 'session'].forEach((kind) => {
                let storageObj;
                try { storageObj = kind === 'local' ? localStorage : sessionStorage; } catch { storageObj = null; }
                if (!storageObj) return;
                PageInspector.getStorageDump(storageObj).forEach((item) => {
                    if (this._looksLikeToken(item.key, item.value)) {
                        results.push({ source: `${kind}Storage`, location: item.key, value: item.value });
                    }
                });
            });

            PageInspector.getCookies().forEach((c) => {
                if (this._looksLikeToken(c.key, c.value)) {
                    results.push({ source: 'cookie', location: c.key, value: c.value });
                }
            });

            ObservedTraffic.all().forEach((entry) => {
                const scanHeaders = (headers, label) => {
                    if (!headers) return;
                    Object.keys(headers).forEach((name) => {
                        if (this._looksLikeToken(name, headers[name])) {
                            results.push({
                                source: label,
                                location: `${entry.method} ${Helpers._shortenUrl(entry.url)} - ${name}`,
                                value: this._stripBearerPrefix(headers[name])
                            });
                        }
                    });
                };
                scanHeaders(entry.requestHeaders, 'request header');
                scanHeaders(entry.responseHeaders, 'response header');
                if (entry.json) this._scanJsonForTokens(entry.json, `${entry.method} ${Helpers._shortenUrl(entry.url)}`, results);
            });

            const seen = new Set();
            return results.filter((r) => {
                if (seen.has(r.value)) return false;
                seen.add(r.value);
                return true;
            });
        },

        findOccurrences(tokenValue) {
            if (!tokenValue) return [];
            const hits = [];
            ObservedTraffic.all().forEach((entry) => {
                const checkHeaders = (headers, label) => {
                    if (!headers) return;
                    Object.keys(headers).forEach((name) => {
                        if (headers[name] && headers[name].includes(tokenValue)) {
                            hits.push({ where: `${label}: ${name}`, url: entry.url, method: entry.method, timestamp: entry.timestamp });
                        }
                    });
                };
                checkHeaders(entry.requestHeaders, 'request header');
                checkHeaders(entry.responseHeaders, 'response header');
                if (entry.url && entry.url.includes(tokenValue)) {
                    hits.push({ where: 'URL / query param', url: entry.url, method: entry.method, timestamp: entry.timestamp });
                }
                if (entry.requestBody && entry.requestBody.includes(tokenValue)) {
                    hits.push({ where: 'request body', url: entry.url, method: entry.method, timestamp: entry.timestamp });
                }
                if (entry.json) {
                    let jsonStr = '';
                    try { jsonStr = JSON.stringify(entry.json); } catch { jsonStr = ''; }
                    if (jsonStr.includes(tokenValue)) hits.push({ where: 'response body', url: entry.url, method: entry.method, timestamp: entry.timestamp });
                } else if (entry.rawText && entry.rawText.includes(tokenValue)) {
                    hits.push({ where: 'response body (raw)', url: entry.url, method: entry.method, timestamp: entry.timestamp });
                }
            });
            return hits;
        }
    };

    
    const TokenVault = {
        MAX: 20,
        _entries: [],
        _nextId: 1,

        add(tok, label) {
            const existing = this._entries.find((e) => e.value === tok.value);
            if (existing) {
                existing.label = (label || '').trim() || existing.label;
                existing.savedAt = Date.now();
                return existing;
            }
            const entry = {
                id: this._nextId++,
                label: (label || '').trim() || null,
                source: tok.source,
                location: tok.location,
                value: tok.value,
                savedAt: Date.now()
            };
            this._entries.push(entry);
            if (this._entries.length > this.MAX) this._entries.shift();
            return entry;
        },

        all() {
            return this._entries.slice().reverse();
        },

        remove(id) {
            this._entries = this._entries.filter((e) => e.id !== id);
        },

        clear() {
            this._entries = [];
        }
    };

    const InvestigationExport = {
        gather(categories) {
            const data = {};
            if (categories.traffic) data.traffic = ObservedTraffic.all();
            if (categories.catalog) {
                data.catalog = ObservedTraffic.catalogEntries().map((c) => ({
                    ...c,
                    paramsObserved: Array.from(c.paramsObserved),
                    statusesObserved: Array.from(c.statusesObserved),
                    contentTypesObserved: Array.from(c.contentTypesObserved)
                }));
            }
            if (categories.persistedTraffic) data.persistedTraffic = ObservedTraffic.persistedTrafficEntries();
            if (categories.recorder) data.recorderTimeline = InvestigationRecorder.timeline();
            if (categories.element && PageInspectorUI._pickedElement) {
                data.pickedElement = PageInspector.inspectElement(PageInspectorUI._pickedElement);
            }

            if (categories.pageTiming) {
                data.pageTiming = PageInspectorUI._pageTiming || PageInspector.getNavigationTiming();
            }

            if (categories.websocket) data.websocket = WebSocketMonitor.all();

            if (categories.traceHistory) data.traceHistory = TraceHistory.all();
            if (categories.replay && PageInspectorUI._replayResult) {
                data.replay = {
                    draft: PageInspectorUI._replayDraft,
                    original: PageInspectorUI._replayOriginalEntry,
                    result: PageInspectorUI._replayResult
                };
            }

            if (categories.replayHistory) data.replayHistory = ReplayHistory.all();

            if (categories.domSnapshot) {
                const local = PageInspector.getStorageDump(localStorage).map((e) => ({ source: 'localStorage', key: e.key, value: e.value }));
                const session = PageInspector.getStorageDump(sessionStorage).map((e) => ({ source: 'sessionStorage', key: e.key, value: e.value }));
                const cookies = PageInspector.getCookies().map((e) => ({ source: 'cookie', key: e.key, value: e.value }));
                data.domSnapshot = [...local, ...session, ...cookies];
            }

            if (categories.sandboxRun && PageInspectorUI._sandboxResult) {
                data.sandboxRun = {
                    code: PageInspectorUI._sandboxCode,
                    result: PageInspectorUI._sandboxResult
                };
            }
            // Code only, no results - results were never persisted per-run, only the code
            // that was typed (same as the JS Console's history). If you want past run
            // *outputs* preserved too, that'd need a separate change to actually store them.
            if (categories.sandboxHistory) data.sandboxHistory = Config.sandboxCodeHistory;

            if (categories.eventDebugLog) data.eventDebugLog = EventDebugger.log();
            if (categories.domMutationLog) data.domMutationLog = DomMutationWatcher.log();
            if (categories.storageWatchLog) data.storageWatchLog = StorageWatcher.log();
            if (categories.wsMessageCatalog) data.wsMessageCatalog = WebSocketMonitor.catalog();
            if (categories.snapshots) data.snapshots = SnapshotManager.all();
            return data;
        },

        rawExport(categories) {
            return JSON.stringify(this.gather(categories), null, 2);
        },

        _csvEscape(value) {
            const s = value === null || value === undefined ? '' : String(value);

            if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
            return s;
        },

        _csvRow(fields) {
            return fields.map((f) => this._csvEscape(f)).join(',');
        },

        toCSV(categories) {
            const data = this.gather(categories);
            const tables = [];

            if (categories.traffic && data.traffic && data.traffic.length) {
                const rows = [this._csvRow(['Timestamp', 'Method', 'URL', 'Status', 'DurationMs', 'SizeBytes'])];
                data.traffic.forEach((e) => {
                    rows.push(this._csvRow([new Date(e.timestamp).toISOString(), e.method, e.url, e.status ?? '', e.durationMs ?? '', e.size ?? '']));
                });
                tables.push(`## Network traffic (${data.traffic.length})\n${rows.join('\n')}`);
            }

            if (categories.persistedTraffic && data.persistedTraffic && data.persistedTraffic.length) {
                const rows = [this._csvRow(['Timestamp', 'Method', 'Host', 'PathPattern', 'ActionKey', 'Status', 'RequestBody', 'ResponseBody'])];
                data.persistedTraffic.forEach((e) => {
                    rows.push(this._csvRow([new Date(e.timestamp).toISOString(), e.method, e.host, e.pathPattern, e.actionKey || '', e.status ?? '', e.requestBody || '', e.responseBody || '']));
                });
                tables.push(`## Persisted traffic cache (${data.persistedTraffic.length})\n${rows.join('\n')}`);
            }

            if (categories.domSnapshot && data.domSnapshot && data.domSnapshot.length) {
                const rows = [this._csvRow(['Source', 'Key', 'Value'])];
                data.domSnapshot.forEach((e) => { rows.push(this._csvRow([e.source, e.key, e.value])); });
                tables.push(`## DOM snapshot (${data.domSnapshot.length})\n${rows.join('\n')}`);
            }

            if (categories.sandboxHistory && data.sandboxHistory && data.sandboxHistory.length) {
                const rows = [this._csvRow(['Code'])];
                data.sandboxHistory.forEach((code) => { rows.push(this._csvRow([code])); });
                tables.push(`## Sandbox code history (${data.sandboxHistory.length})\n${rows.join('\n')}`);
            }

            if (categories.traceHistory && data.traceHistory && data.traceHistory.length) {
                const rows = [this._csvRow(['Timestamp', 'Term', 'Hostname', 'URL', 'DomMatches', 'GlobalMatches', 'NetworkMatches'])];
                data.traceHistory.forEach((e) => {
                    const networkMatches = (e.network || []).reduce((sum, n) => sum + (n.paths ? n.paths.length : 0), 0);
                    rows.push(this._csvRow([
                        new Date(e.timestamp).toISOString(), e.term, e.hostname, e.url,
                        (e.dom || []).length, (e.globals || []).length, networkMatches
                    ]));
                });
                tables.push(`## Value Tracer history (${data.traceHistory.length})\n${rows.join('\n')}`);
            }

            if (categories.eventDebugLog && data.eventDebugLog && data.eventDebugLog.length) {
                const rows = [this._csvRow(['Timestamp', 'EventType', 'Target', 'GlobalDiffs', 'NetworkHits'])];
                data.eventDebugLog.forEach((e) => {
                    rows.push(this._csvRow([new Date(e.timestamp).toISOString(), e.eventType, e.targetDescribe, e.diffs.length, e.networkHits ? e.networkHits.length : 0]));
                });
                tables.push(`## Event Debugger log (${data.eventDebugLog.length})\n${rows.join('\n')}`);
            }

            if (categories.domMutationLog && data.domMutationLog && data.domMutationLog.length) {
                const rows = [this._csvRow(['Timestamp', 'Watch', 'NodeChanges', 'AttributeChanges', 'TextChanges'])];
                data.domMutationLog.forEach((e) => {
                    rows.push(this._csvRow([new Date(e.timestamp).toISOString(), e.watchDescribe, e.summary.childList || 0, e.summary.attributes || 0, e.summary.characterData || 0]));
                });
                tables.push(`## DOM Mutation Watcher log (${data.domMutationLog.length})\n${rows.join('\n')}`);
            }

            if (categories.storageWatchLog && data.storageWatchLog && data.storageWatchLog.length) {
                const rows = [this._csvRow(['Timestamp', 'Kind', 'Key', 'From', 'To'])];
                data.storageWatchLog.forEach((e) => {
                    rows.push(this._csvRow([new Date(e.timestamp).toISOString(), e.kind, e.key, e.from, e.to]));
                });
                tables.push(`## Storage/Cookie Watcher log (${data.storageWatchLog.length})\n${rows.join('\n')}`);
            }

            if (categories.wsMessageCatalog && data.wsMessageCatalog && data.wsMessageCatalog.length) {
                const rows = [this._csvRow(['Direction', 'URL', 'Shape', 'Count', 'LastSeen'])];
                data.wsMessageCatalog.forEach((e) => {
                    rows.push(this._csvRow([e.direction, e.url, e.shape, e.count, new Date(e.lastSeen).toISOString()]));
                });
                tables.push(`## WebSocket message catalog (${data.wsMessageCatalog.length})\n${rows.join('\n')}`);
            }

            if (!tables.length) return null; 
            return tables.join('\n\n');
        },

        briefing(categories) {
            const data = this.gather(categories);
            const lines = ['FRONTEND INVESTIGATION', ''];

            if (data.catalog && data.catalog.length) {
                lines.push('OBSERVED ENDPOINTS:');
                data.catalog.slice().sort((a, b) => b.callCount - a.callCount).slice(0, 20).forEach((c) => {
                    lines.push(`- ${c.method} ${c.host}${c.pathPattern} (${c.callCount} calls, statuses: ${c.statusesObserved.join(',') || 'none'})`);
                    if (c.paramsObserved.length) lines.push(`    params: ${c.paramsObserved.join(', ')}`);
                });
                lines.push('');
            }

            if (data.traffic && data.traffic.length) {
                let hosts;
                try { hosts = new Set(data.traffic.map((e) => new URL(e.url).host)); } catch { hosts = new Set(); }

                const recordedCount = data.traffic.filter((e) => e.recordingSession).length;
                lines.push(`NETWORK ACTIVITY: ${data.traffic.length} requests captured across ${hosts.size} host${hosts.size === 1 ? '' : 's'} (${Array.from(hosts).join(', ')})${recordedCount ? ` - ${recordedCount} captured during a recording session` : ''}`);

                const clusters = ObservedTraffic.findDuplicateClusters(5000).filter((c) => data.traffic.some((e) => e.url === c.url && e.method === c.method));
                if (clusters.length) {
                    lines.push(`  ${clusters.length} repeated-request burst${clusters.length === 1 ? '' : 's'} detected (same method+URL fired within 5s): ${clusters.slice(0, 5).map((c) => `${c.method} ${c.url} x${c.count}`).join('; ')}`);
                }
                lines.push('');
            }

            if (data.persistedTraffic && data.persistedTraffic.length) {
                lines.push(`PERSISTED TRAFFIC CACHE (survives reload, up to ${ObservedTraffic.PERSISTED_ENTRIES_PER_KEY} distinct actions kept per endpoint pattern, ${data.persistedTraffic.length} total entr${data.persistedTraffic.length === 1 ? 'y' : 'ies'}):`);
                data.persistedTraffic.forEach((e) => {
                    lines.push(`- ${e.method} ${e.host}${e.pathPattern}${e.actionKey ? ` [${e.actionKey}]` : ''} - status ${e.status}, last seen ${new Date(e.timestamp).toLocaleString()}`);
                    if (e.requestBody) lines.push(`    request body: ${e.requestBody}`);
                });
                lines.push('');
            }

            if (data.pageTiming) {
                const pt = data.pageTiming;
                lines.push(`PAGE LOAD (${pt.type}): TTFB ${Math.round(pt.ttfb)}ms, DOM Complete ${Math.round(pt.domComplete)}ms, Total ${Math.round(pt.total)}ms`);
                lines.push('');
            }

            if (data.websocket && data.websocket.length) {
                const totalMessages = data.websocket.reduce((s, c) => s + c.messages.length, 0);
                lines.push(`WEBSOCKET ACTIVITY: ${data.websocket.length} connection${data.websocket.length === 1 ? '' : 's'}, ${totalMessages} messages total`);
                data.websocket.forEach((c) => {
                    lines.push(`- ${c.status} ${c.url} (${c.messages.length} messages${c.closeCode ? `, closed code ${c.closeCode}` : ''})`);
                });
                lines.push('');
            }

            if (data.recorderTimeline && data.recorderTimeline.length) {
                lines.push('INTERACTION TIMELINE (timing-based order, not verified causality):');
                data.recorderTimeline.forEach((entry) => {
                    lines.push(`${new Date(entry.timestamp).toLocaleTimeString()}  ${PageInspectorUI._timelineKindLabel(entry)}`);
                });
                lines.push('');
            }

            if (data.pickedElement) {
                const el = data.pickedElement;
                lines.push('INSPECTED ELEMENT:');
                lines.push(`<${el.tag}>${el.id ? ' #' + el.id : ''}${el.classes.length ? ' .' + el.classes.join('.') : ''}`);
                if (el.selectors.length) lines.push(`Selectors: ${el.selectors.join(' | ')}`);
                lines.push('');
            }

            if (data.traceHistory && data.traceHistory.length) {
                const byHost = {};
                data.traceHistory.forEach((e) => { (byHost[e.hostname] = byHost[e.hostname] || []).push(e); });
                lines.push(`VALUE TRACER HISTORY: ${data.traceHistory.length} saved trace${data.traceHistory.length === 1 ? '' : 's'} across ${Object.keys(byHost).length} host${Object.keys(byHost).length === 1 ? '' : 's'}:`);
                Object.keys(byHost).forEach((host) => {
                    const terms = byHost[host].map((e) => e.term).slice(0, 10);
                    lines.push(`- ${host}: ${byHost[host].length} trace${byHost[host].length === 1 ? '' : 's'} (${terms.join(', ')}${byHost[host].length > terms.length ? ', ...' : ''})`);
                });
                lines.push('');
            }

            if (data.replay) {
                const { draft, original, result } = data.replay;
                lines.push('REQUEST REPLAY (most recent):');
                lines.push(`- Sent: ${draft.method} ${draft.url}`);
                if (original) lines.push(`  Original was: ${original.method} ${original.status} - ${original.durationMs}ms`);
                if (result.ok) lines.push(`  Replay result: ${result.status} ${result.statusText || ''} - ${result.durationMs}ms`);
                else lines.push(`  Replay failed: ${result.error}`);
                lines.push('');
            }

            if (data.replayHistory && data.replayHistory.length) {
                const chronological = data.replayHistory.slice().reverse();
                lines.push(`REQUEST REPLAY SESSION HISTORY: ${chronological.length} send${chronological.length === 1 ? '' : 's'} this session:`);
                chronological.slice(0, 15).forEach((entry, i) => {
                    const status = entry.result.ok ? `${entry.result.status} - ${entry.result.durationMs}ms` : `failed: ${entry.result.error}`;
                    lines.push(`${i + 1}. ${entry.draft.method} ${entry.draft.url} -> ${status}`);
                });
                if (chronological.length > 15) lines.push(`...(${chronological.length - 15} more not shown)`);
                lines.push('');
            }

            if (data.sandboxRun) {
                const { result } = data.sandboxRun;
                lines.push('SCRIPT SANDBOX (most recent run):');
                lines.push(`- ${result.logs.length} console line${result.logs.length === 1 ? '' : 's'}, ${result.durationMs}ms${result.timedOut ? ' (timed out)' : ''}`);
                if (result.error) lines.push(`  Threw: ${result.error}`);
                result.logs.slice(0, 15).forEach((l) => lines.push(`  [${l.level}] ${l.text}`));
                if (result.logs.length > 15) lines.push(`  ...(${result.logs.length - 15} more not shown)`);
                lines.push('');
            }

            if (data.sandboxHistory && data.sandboxHistory.length) {
                lines.push(`SANDBOX CODE HISTORY (survives reload, code only - no run output): ${data.sandboxHistory.length} entr${data.sandboxHistory.length === 1 ? 'y' : 'ies'}:`);
                data.sandboxHistory.slice(-15).reverse().forEach((code) => {
                    lines.push(`- ${code.length > 200 ? code.slice(0, 200) + '...' : code}`);
                });
                lines.push('');
            }

            if (data.domSnapshot && data.domSnapshot.length) {
                const bySource = {};
                data.domSnapshot.forEach((e) => { (bySource[e.source] = bySource[e.source] || []).push(e); });
                lines.push(`DOM SNAPSHOT: ${data.domSnapshot.length} key${data.domSnapshot.length === 1 ? '' : 's'} across localStorage/sessionStorage/cookies:`);
                Object.keys(bySource).forEach((source) => {
                    const keys = bySource[source];
                    lines.push(`${source} (${keys.length}):`);
                    keys.slice(0, 20).forEach((k) => lines.push(`  ${k.key}: ${k.value.length > 100 ? k.value.slice(0, 100) + '...' : k.value}`));
                    if (keys.length > 20) lines.push(`  ...(${keys.length - 20} more not shown)`);
                });
                lines.push('');
            }

            if (data.eventDebugLog && data.eventDebugLog.length) {
                lines.push(`EVENT DEBUGGER LOG: ${data.eventDebugLog.length} firing${data.eventDebugLog.length === 1 ? '' : 's'} logged:`);
                data.eventDebugLog.slice(-15).forEach((e) => {
                    const netNote = e.networkHits ? `, ${e.networkHits.length} network hit${e.networkHits.length === 1 ? '' : 's'} within window` : '';
                    lines.push(`- ${new Date(e.timestamp).toLocaleTimeString()} ${e.eventType} on ${e.targetDescribe} - ${e.diffs.length} global diff${e.diffs.length === 1 ? '' : 's'}${netNote}`);
                });
                if (data.eventDebugLog.length > 15) lines.push(`...(${data.eventDebugLog.length - 15} more not shown)`);
                lines.push('');
            }

            if (data.domMutationLog && data.domMutationLog.length) {
                lines.push(`DOM MUTATION WATCHER LOG: ${data.domMutationLog.length} batch${data.domMutationLog.length === 1 ? '' : 'es'} logged:`);
                data.domMutationLog.slice(-15).forEach((e) => {
                    const parts = [];
                    if (e.summary.childList) parts.push(`${e.summary.childList} node`);
                    if (e.summary.attributes) parts.push(`${e.summary.attributes} attribute`);
                    if (e.summary.characterData) parts.push(`${e.summary.characterData} text`);
                    lines.push(`- ${new Date(e.timestamp).toLocaleTimeString()} ${e.watchDescribe} - ${parts.join(', ') || 'change'}`);
                });
                if (data.domMutationLog.length > 15) lines.push(`...(${data.domMutationLog.length - 15} more not shown)`);
                lines.push('');
            }

            if (data.storageWatchLog && data.storageWatchLog.length) {
                lines.push(`STORAGE/COOKIE WATCHER LOG: ${data.storageWatchLog.length} change${data.storageWatchLog.length === 1 ? '' : 's'} logged:`);
                data.storageWatchLog.slice(-15).forEach((e) => {
                    lines.push(`- ${new Date(e.timestamp).toLocaleTimeString()} ${e.kind}:${e.key} - ${e.from} -> ${e.to}`);
                });
                if (data.storageWatchLog.length > 15) lines.push(`...(${data.storageWatchLog.length - 15} more not shown)`);
                lines.push('');
            }

            if (data.wsMessageCatalog && data.wsMessageCatalog.length) {
                lines.push(`WEBSOCKET MESSAGE CATALOG: ${data.wsMessageCatalog.length} distinct message shape${data.wsMessageCatalog.length === 1 ? '' : 's'}:`);
                data.wsMessageCatalog.slice(0, 15).forEach((e) => {
                    lines.push(`- ${e.direction === 'in' ? 'received' : 'sent'} x${e.count} ${e.url} - shape: ${e.shape}`);
                });
                if (data.wsMessageCatalog.length > 15) lines.push(`...(${data.wsMessageCatalog.length - 15} more not shown)`);
                lines.push('');
            }

            if (data.snapshots && data.snapshots.length) {
                lines.push(`SNAPSHOTS: ${data.snapshots.length} saved:`);
                data.snapshots.forEach((s) => {
                    const counts = `${Object.keys(s.data.localStorage).length} localStorage, ${Object.keys(s.data.sessionStorage).length} sessionStorage, ${Object.keys(s.data.cookies).length} cookies, ${Object.keys(s.data.globals).length} globals`;
                    lines.push(`- "${s.label}" (${new Date(s.timestamp).toLocaleTimeString()}, ${s.url}) - ${counts}`);
                });
                lines.push('');
            }

            lines.push('NOTE: timeline ordering reflects timing only, not verified causality.');
            return lines.join('\n');
        }
    };

    const WebSocketMonitor = {
        MAX_CONNECTIONS: 20,
        MAX_MESSAGES_PER_CONNECTION: 200,
        CATALOG_KEY: 'ttd_ws_catalog',
        CONNECTIONS_KEY: 'ttd_ws_connections',
        MAX_PERSISTED_CONNECTIONS: 20,
        MAX_PERSISTED_MESSAGES_PER_CONNECTION: 20,
        _connections: [],
        // Accumulating message-shape catalog, keyed the same way as the old on-demand version
        // but built incrementally and persisted - so it keeps growing across reloads instead of
        // being recomputed from (and limited to) whatever's still in _connections.
        _catalogMap: {},
        // Trimmed history of past connections (this session's, once closed, plus whatever
        // survived from before the last reload) - a live WebSocket always dies at reload
        // regardless of anything this tool does, so "persisted" here means "the record of what
        // happened," not "the connection itself."
        _persistedConnections: [],
        _installed: false,
        _nextId: 1,
        _saveTimer: null,

        install() {
            // Persisted catalog/history should be visible even if live capture happens to be
            // off right now - loading is cheap and unconditional; only the live hook itself is
            // gated behind the enabled flag.
            this.load();
            if (this._installed) return;
            if (!Config.wsCaptureEnabled) return;
            this._installed = true;
            this._hookWebSocket();
            this._installUnloadFlush();
        },

        load() {
            const storedCatalog = Storage.get(this.CATALOG_KEY, null);
            if (storedCatalog && typeof storedCatalog === 'object') this._catalogMap = storedCatalog;
            const storedConns = Storage.get(this.CONNECTIONS_KEY, null);
            if (Array.isArray(storedConns)) this._persistedConnections = storedConns;
        },

        _scheduleSave() {
            if (this._saveTimer) return;
            this._saveTimer = setTimeout(() => {
                this._saveTimer = null;
                this._persistState();
            }, 2000);
        },

        _persistState() {
            const budget = Config.secondaryLogsBudgetBytes;

            const catalogKeys = Object.keys(this._catalogMap).sort((a, b) => this._catalogMap[a].lastSeen - this._catalogMap[b].lastSeen);
            const catalogObj = { ...this._catalogMap };
            const measureCatalog = () => { try { return JSON.stringify(catalogObj).length; } catch { return 0; } };
            while (catalogKeys.length && measureCatalog() > budget) delete catalogObj[catalogKeys.shift()];
            Storage.set(this.CATALOG_KEY, catalogObj);

            const conns = this._persistedConnections.slice();
            const measureConns = () => { try { return JSON.stringify(conns).length; } catch { return 0; } };
            while (conns.length && measureConns() > budget) conns.shift();
            Storage.set(this.CONNECTIONS_KEY, conns);
        },

        // Best-effort flush right before the page unloads - same caveat as everywhere else this
        // pattern's used: not a hard guarantee on every browser/userscript engine. Also pushes
        // any still-open connections into history, since a normal 'close' event may never fire
        // before a navigation-triggered unload.
        _installUnloadFlush() {
            this._onUnload = () => {
                this._connections.forEach((c) => this._pushToHistory(c));
                if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
                this._persistState();
            };
            window.addEventListener('pagehide', this._onUnload);
            window.addEventListener('beforeunload', this._onUnload);
        },

        _pushToHistory(entry) {
            if (entry._persisted) return;
            entry._persisted = true;
            const trimmedMessages = entry.messages.slice(-this.MAX_PERSISTED_MESSAGES_PER_CONNECTION).map((m) => ({
                direction: m.direction,
                timestamp: m.timestamp,
                text: m.text && m.text.length > 500 ? m.text.slice(0, 500) + '...' : m.text,
                size: m.size
            }));
            this._persistedConnections.push({
                url: entry.url,
                openedAt: entry.openedAt,
                closedAt: entry.closedAt,
                closeCode: entry.closeCode,
                closeReason: entry.closeReason,
                status: entry.status,
                messages: trimmedMessages
            });
            if (this._persistedConnections.length > this.MAX_PERSISTED_CONNECTIONS) this._persistedConnections.shift();
            this._scheduleSave();
        },

        enable() {
            Config.wsCaptureEnabled = true;
            this.install();
        },

        disable() {
            Config.wsCaptureEnabled = false;
        },

        _hookWebSocket() {
            const OriginalWebSocket = window.WebSocket;
            if (!OriginalWebSocket) return;
            const monitor = this;

            function HookedWebSocket(url, protocols) {
                const ws = protocols !== undefined ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
                const entry = {
                    id: monitor._nextId++,
                    url: String(url),
                    protocols: protocols || null,
                    openedAt: Date.now(),
                    closedAt: null,
                    closeCode: null,
                    closeReason: null,
                    status: 'connecting',
                    messages: [],
                    wsRef: ws 
                };
                monitor._connections.push(entry);
                if (monitor._connections.length > monitor.MAX_CONNECTIONS) monitor._connections.shift();

                ws.addEventListener('open', () => { entry.status = 'open'; });
                ws.addEventListener('close', (e) => {
                    entry.status = 'closed';
                    entry.closedAt = Date.now();
                    entry.closeCode = e.code;
                    entry.closeReason = e.reason;
                    entry.wsRef = null; 
                    monitor._pushToHistory(entry);
                });
                ws.addEventListener('error', () => { entry.status = 'error'; });
                ws.addEventListener('message', (e) => { monitor._recordMessage(entry, 'in', e.data); });

                const originalSend = ws.send.bind(ws);
                ws.send = (data) => {
                    monitor._recordMessage(entry, 'out', data);
                    return originalSend(data);
                };

                return ws;
            }
            HookedWebSocket.prototype = OriginalWebSocket.prototype;
            ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach((k) => { HookedWebSocket[k] = OriginalWebSocket[k]; });

            HookedWebSocket.__ttdHooked = true;

            window.WebSocket = HookedWebSocket;
        },

        _recordMessage(entry, direction, data) {
            const parsed = this._safeMessagePreview(data);
            const message = {
                direction,
                timestamp: Date.now(),
                text: parsed.text,
                json: parsed.json,
                size: typeof data === 'string' ? data.length : ((data && data.byteLength) || (data && data.size) || 0)
            };
            entry.messages.push(message);
            if (entry.messages.length > this.MAX_MESSAGES_PER_CONNECTION) entry.messages.shift();
            this._updateCatalog(entry, message);
        },

        // Incremental, accumulating version of what used to be computed fresh from
        // _connections on every catalog() call - this way distinct message shapes keep
        // building up across reloads instead of being limited to whatever's still in memory.
        _updateCatalog(conn, m) {
            const shape = this._messageShape(m);
            const key = `${conn.url}\u0000${m.direction}\u0000${shape}`;
            let g = this._catalogMap[key];
            if (!g) {
                g = { url: conn.url, direction: m.direction, shape, count: 0, lastSeen: 0, sample: '' };
                this._catalogMap[key] = g;
            }
            g.count++;
            if (m.timestamp > g.lastSeen) g.lastSeen = m.timestamp;
            g.sample = m.text && m.text.length > 200 ? m.text.slice(0, 200) + '...' : m.text;
            this._scheduleSave();
        },

        _safeMessagePreview(data) {
            try {
                if (typeof data === 'string') {
                    let json = null;
                    try { json = JSON.parse(data); } catch {  }
                    return { text: data.length > 3000 ? data.slice(0, 3000) + '...' : data, json };
                }
                if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) return { text: `[ArrayBuffer, ${data.byteLength} bytes]`, json: null };
                if (typeof Blob !== 'undefined' && data instanceof Blob) return { text: `[Blob, ${data.size} bytes]`, json: null };
                return { text: String(data), json: null };
            } catch (e) {
                return { text: `[error reading message: ${e.message}]`, json: null };
            }
        },

        all() {
            return [...this._connections.slice().reverse(), ...this._persistedConnections.slice().reverse()];
        },

        catalog() {
            return Object.values(this._catalogMap).sort((a, b) => b.count - a.count);
        },

        _messageShape(m) {
            if (m.json && typeof m.json === 'object') {
                if (Array.isArray(m.json)) return `[array, ${m.json.length} items]`;
                const keys = Object.keys(m.json).sort();
                if (keys.length === 1 && keys[0] === 'push') {
                    const detail = this._pushActionDetail(m.json.push);
                    if (detail) return `push:${detail}`;
                }
                return keys.length ? keys.join(',') : '{empty object}';
            }
            if (m.text.startsWith('[ArrayBuffer') || m.text.startsWith('[Blob')) return '[binary]';
            return '[non-JSON text]';
        },

        // Every Centrifugo push shares the same generic {"push":{...}} wrapper regardless of
        // what actually happened - a chain update, an incoming chat message, and a presence
        // event are all indistinguishable at that level. The useful distinction lives inside
        // pub.data.message.namespaces.<namespace>.actions.<actionName>, so dig that out and use
        // it as the shape instead, e.g. "push:tchat.onMessageReceived" rather than just "push".
        // Falls back to null (caller uses the generic "push" key) for push types that don't
        // match this exact chat/notification structure - Centrifugo pushes can carry other
        // kinds of data (join/leave/unsubscribe events, etc.) this doesn't attempt to parse.
        _pushActionDetail(push) {
            try {
                const namespaces = push && push.pub && push.pub.data && push.pub.data.message && push.pub.data.message.namespaces;
                if (!namespaces || typeof namespaces !== 'object') return null;
                const parts = [];
                Object.keys(namespaces).forEach((ns) => {
                    const actions = namespaces[ns] && namespaces[ns].actions;
                    if (actions && typeof actions === 'object') {
                        Object.keys(actions).forEach((action) => parts.push(`${ns}.${action}`));
                    }
                });
                return parts.length ? parts.join('+') : null;
            } catch {
                return null;
            }
        },

        canSend(entry) {
            return !!(entry && entry.wsRef && entry.status === 'open');
        },

        
        send(entry, text) {
            if (!this.canSend(entry)) return { ok: false, error: 'Connection is not open (or was reloaded away) - can\'t send on it anymore.' };
            try {
                entry.wsRef.send(text);
                
                return { ok: true };
            } catch (e) {
                return { ok: false, error: e && e.message ? e.message : String(e) };
            }
        },

        
        runSequence(entry, steps, callbacks) {
            callbacks = callbacks || {};
            let stopped = false;
            let idx = 0;

            const runNext = () => {
                if (stopped) { callbacks.onDone && callbacks.onDone(stopped); return; }
                if (idx >= steps.length) { callbacks.onDone && callbacks.onDone(false); return; }
                const step = steps[idx];
                const stepIndex = idx;
                idx++;

                const doSend = () => {
                    if (stopped) { callbacks.onDone && callbacks.onDone(true); return; }
                    const result = this.send(entry, step.text);
                    callbacks.onStep && callbacks.onStep(stepIndex, result);
                    if (!result.ok) { callbacks.onDone && callbacks.onDone(false, result.error); return; }
                    runNext();
                };

                const delay = Math.max(0, Number(step.delayMs) || 0);
                if (delay > 0) setTimeout(doSend, delay);
                else doSend();
            };

            runNext();
            return { stop() { stopped = true; } };
        }
    };

    const ObservedTraffic = {
        MAX_ENTRIES: 300,
        CATALOG_KEY: 'ttd_observed_catalog',
        PERSISTED_TRAFFIC_KEY: 'ttd_persisted_traffic',
        // Per-entry truncation for the *persisted* copy only - the live in-memory Traffic
        // history entries keep their normal (much larger) request/response detail. This is
        // deliberately small: it's what actually crosses into GM_setValue, kept per catalog
        // key (method+host+pathPattern) so it stays cheap regardless of how many times that
        // endpoint gets hit.
        PERSISTED_BODY_TRUNC: 500,
        // Each catalog key keeps a small ring of *distinct actions*, not just the latest hit -
        // a multi-step flow (e.g. a trade: start, load your items, load their items, confirm,
        // accept) fires several different requests against the same pathPattern across several
        // page refreshes, and a single overwritten slot would only ever show the last step.
        // "Distinct" is keyed on the request's action signature (see _actionKeyFor) where one
        // can be found, not full-body equality - so a step=useItem dispatcher endpoint reserves
        // one slot per distinct step regardless of which itemID/amount/start varies hit to hit,
        // rather than burning slots on parameter noise. Falls back to full-body equality for
        // endpoints with no detectable action param. Repeats of the same action just refresh
        // the timestamp on the existing item instead of growing the ring.
        PERSISTED_ENTRIES_PER_KEY: 10,

        _entries: [],
        _catalog: {},
        _persistedTraffic: {},
        _installed: false,
        _catalogSaveTimer: null,
        _persistedTrafficSaveTimer: null,
        _persistedTrafficWriteFailed: false,

        install() {
            if (this._installed) return;
            this._installed = true;
            try { Error.stackTraceLimit = 50; } catch {  }
            this._loadCatalog();
            this._loadPersistedTraffic();
            this._hookFetch();
            this._hookXHR();
            this._hookFormSubmit();
        },

        _loadPersistedTraffic() {
            const stored = Storage.get(this.PERSISTED_TRAFFIC_KEY, null);
            if (!stored || typeof stored !== 'object') return;
            // Migrate v1.0.5's single-object-per-key format (pre-ring-buffer) into arrays,
            // so upgrading doesn't throw away whatever was already persisted.
            const migrated = {};
            Object.keys(stored).forEach((k) => {
                migrated[k] = Array.isArray(stored[k]) ? stored[k] : [stored[k]];
            });
            this._persistedTraffic = migrated;
        },

        _loadCatalog() {
            const stored = Storage.get(this.CATALOG_KEY, null);
            if (stored && typeof stored === 'object') {

                Object.keys(stored).forEach((k) => {
                    const raw = stored[k];
                    this._catalog[k] = {
                        ...raw,
                        paramsObserved: new Set(raw.paramsObserved || []),
                        statusesObserved: new Set(raw.statusesObserved || []),
                        contentTypesObserved: new Set(raw.contentTypesObserved || [])
                    };
                });
            }
        },

        _extractCallerFile(stackText) {
            if (!stackText) return null;
            const lines = stackText.split('\n').slice(1); 
            for (const line of lines) {
                if (/ObservedTraffic|Tw33k_Tools_Target_Data/i.test(line)) continue;
                const match = line.match(/([^\s/\\()]+\.js)(?::\d+:\d+)?/);
                if (match) return match[1];
            }
            return null;
        },

        _resolveOrigin(stackText) {
            const filename = this._extractCallerFile(stackText);
            if (filename) return { label: filename, confidence: 'stack' };
            return { label: 'Unknown', confidence: 'none' };
        },

        _hookFetch() {
            const original = window.fetch;
            if (typeof original !== 'function') return;

            this._originalFetch = original;
            window.fetch = async function (input, init) {
                const url = typeof input === 'string' ? input : (input && input.url) || '';

                const originStack = new Error().stack || '';
                const requestBody = ObservedTraffic.safeBodyPreview(init && init.body);
                const requestHeaders = ObservedTraffic.normalizeRequestHeaders(init && init.headers);
                const startedAt = performance.now();
                const response = await original.apply(this, arguments);
                try {
                    const clone = response.clone();
                    const durationMs = performance.now() - startedAt;
                    const origin = ObservedTraffic._resolveOrigin(originStack);
                    const responseHeaders = ObservedTraffic.responseHeadersFromFetch(response.headers);
                    const contentType = ObservedTraffic.getHeader(responseHeaders, 'content-type') || '';
                    clone.text().then((text) => {
                        let json = null;
                        try { json = JSON.parse(text); } catch {  }
                        const entry = {
                            transport: 'fetch',
                            origin,
                            originStackDebug: origin.confidence === 'stack' ? null : originStack.slice(0, 800),
                            method: (init && init.method) || 'GET',
                            url,
                            status: response.status,
                            contentType,
                            requestHeaders,
                            responseHeaders,
                            requestBody,
                            size: text.length,
                            durationMs: Math.round(durationMs),
                            timestamp: Date.now(),
                            recordingSession: InvestigationRecorder.isRecording() ? InvestigationRecorder._recordingStartedAt : null,
                            json,
                            rawText: json ? null : text.slice(0, 4000)
                        };
                        ObservedTraffic.record(entry);
                    }).catch(() => {  });
                } catch {  }
                return response;
            };
        },

        _hookXHR() {
            const OriginalXHR = window.XMLHttpRequest;
            if (!OriginalXHR) return;
            const openOriginal = OriginalXHR.prototype.open;
            const sendOriginal = OriginalXHR.prototype.send;
            const setRequestHeaderOriginal = OriginalXHR.prototype.setRequestHeader;

            OriginalXHR.prototype.open = function (method, url) {
                this._ttdMethod = method;
                this._ttdUrl = url;
                this._ttdRequestHeaders = {}; 
                return openOriginal.apply(this, arguments);
            };

            OriginalXHR.prototype.setRequestHeader = function (name, value) {
                if (!this._ttdRequestHeaders) this._ttdRequestHeaders = {};
                this._ttdRequestHeaders[name] = value;
                return setRequestHeaderOriginal.apply(this, arguments);
            };

            OriginalXHR.prototype.send = function (body) {

                const originStack = new Error().stack || '';
                const requestBody = ObservedTraffic.safeBodyPreview(body);
                const requestHeaders = this._ttdRequestHeaders || {};
                const startedAt = performance.now();
                this.addEventListener('loadend', () => {
                    try {
                        const durationMs = performance.now() - startedAt;
                        let json = null;
                        try { json = JSON.parse(this.responseText); } catch {  }
                        const origin = ObservedTraffic._resolveOrigin(originStack);
                        let responseHeaders = {};
                        try { responseHeaders = ObservedTraffic.parseXhrResponseHeaders(this.getAllResponseHeaders()); } catch {  }
                        const entry = {
                            transport: 'xhr',
                            origin,
                            originStackDebug: origin.confidence === 'stack' ? null : originStack.slice(0, 800),
                            method: this._ttdMethod || 'GET',
                            url: this._ttdUrl,
                            status: this.status,
                            contentType: ObservedTraffic.getHeader(responseHeaders, 'content-type') || '',
                            requestHeaders,
                            responseHeaders,
                            requestBody,
                            size: (this.responseText || '').length,
                            durationMs: Math.round(durationMs),
                            timestamp: Date.now(),
                            recordingSession: InvestigationRecorder.isRecording() ? InvestigationRecorder._recordingStartedAt : null,
                            json,
                            rawText: json ? null : (this.responseText || '').slice(0, 4000)
                        };
                        ObservedTraffic.record(entry);
                    } catch {  }
                });
                return sendOriginal.apply(this, arguments);
            };
        },

        // Captures the *request* side of a real (non-AJAX) <form> submission - some game
        // flows (e.g. Trade) still use a classic form POST that reloads the page, which never
        // touches window.fetch or XMLHttpRequest and so is otherwise fully invisible to this
        // tool. We can't see the response (the page navigates away before one would arrive),
        // but capturing method/action/body and flushing immediately (see record()'s
        // flushImmediately option) is enough to get it into the catalog and persisted cache
        // before the page unloads.
        _hookFormSubmit() {
            document.addEventListener('submit', (e) => {
                try {
                    const form = e.target;
                    if (!(form instanceof HTMLFormElement)) return;
                    const { method, url, body } = this._serializeFormSubmit(form);
                    const entry = {
                        transport: 'form-submit',
                        origin: { label: 'form submit (page navigation)', confidence: 'dom' },
                        originStackDebug: null,
                        method,
                        url,
                        status: null,
                        contentType: '',
                        requestHeaders: {},
                        responseHeaders: {},
                        requestBody: body,
                        size: 0,
                        durationMs: 0,
                        timestamp: Date.now(),
                        recordingSession: InvestigationRecorder.isRecording() ? InvestigationRecorder._recordingStartedAt : null,
                        json: null,
                        rawText: null
                    };
                    ObservedTraffic.record(entry, { flushImmediately: true });
                } catch {  }
            }, true); 
        },

        // GET forms serialize their fields onto the action URL (no body, matching what the
        // browser will actually send); everything else keeps them as a urlencoded body.
        _serializeFormSubmit(form) {
            const method = (form.getAttribute('method') || 'GET').toUpperCase();
            let action;
            try { action = form.action || location.href; } catch { action = location.href; }
            let body = null;
            try {
                const fd = new FormData(form);
                if (method === 'GET') {
                    const u = new URL(action, location.href);
                    for (const [k, v] of fd.entries()) {
                        if (typeof v === 'string') u.searchParams.set(k, v);
                    }
                    action = u.toString();
                } else {
                    const parts = [];
                    for (const [k, v] of fd.entries()) {
                        parts.push(`${encodeURIComponent(k)}=${typeof v === 'string' ? encodeURIComponent(v) : '[file]'}`);
                    }
                    body = parts.join('&');
                }
            } catch {  }
            return { method, url: action, body };
        },

        _normalizePath(pathname) {
            const parts = pathname.split('/').map((seg) => (/^\d+$/.test(seg) ? '{id}' : seg));
            return parts.join('/') || '/';
        },

        _parseQuery(url) {
            const obj = {};
            try {
                const u = new URL(url, location.href); 
                u.searchParams.forEach((v, k) => { if (k !== 'key') obj[k] = v; }); 
            } catch {  }
            return obj;
        },

        // `opts.flushImmediately` bypasses the normal 2s debounced save and writes to
        // GM storage synchronously instead - needed for entries captured right before a page
        // navigation (e.g. a real <form> submit), since a setTimeout-deferred write has no
        // guarantee of running before the page unloads. Best-effort, not a hard guarantee:
        // GM_setValue itself isn't spec'd as synchronous-to-disk on every userscript engine.
        record(entry, opts) {
            opts = opts || {};
            // This tool's own Export "download file" flow creates a blob: URL and something
            // (confirmed via a real capture: Torn PDA's webview reads it back with a plain
            // fetch() rather than relying on the native <a download> click) ends up fetching
            // it - the response body is literally the JSON we just exported, so it was
            // recording itself. blob:/data: URLs can never be real page/game traffic either
            // way, so they're excluded outright rather than trying to detect "who" is doing it.
            if (/^(blob|data):/i.test(entry.url || '')) return;

            this._entries.push(entry);
            if (this._entries.length > this.MAX_ENTRIES) this._entries.shift();

            let host, pathname;
            try {
                // Base against location.href so same-origin relative URLs (e.g. the game's own
                // "/sidebarAjaxAction.php?..." or even a bare "page.php?...") resolve instead
                // of throwing - previously these were captured in raw Traffic history but never
                // reached the catalog or persisted cache at all.
                const u = new URL(entry.url, location.href);
                host = u.host;
                pathname = u.pathname;
            } catch {
                return; 
            }

            // Normalize casing so "post" and "POST" against the same endpoint collapse into one
            // catalog key instead of silently forking into two.
            const method = (entry.method || 'GET').toUpperCase();
            const pattern = this._normalizePath(pathname);
            const catalogKey = `${method} ${host}${pattern}`;
            const params = this._parseQuery(entry.url);

            let catEntry = this._catalog[catalogKey];
            if (!catEntry) {
                catEntry = {
                    method,
                    host,
                    pathPattern: pattern,
                    callCount: 0,
                    firstSeen: entry.timestamp,
                    lastSeen: entry.timestamp,
                    paramsObserved: new Set(),
                    statusesObserved: new Set(),
                    contentTypesObserved: new Set(),
                    exampleUrl: entry.url,
                    exampleResponsePreview: null
                };
                this._catalog[catalogKey] = catEntry;
            }
            catEntry.callCount += 1;
            catEntry.lastSeen = entry.timestamp;
            catEntry.exampleUrl = entry.url;
            Object.keys(params).forEach((p) => catEntry.paramsObserved.add(p));
            if (entry.status !== null && entry.status !== undefined) catEntry.statusesObserved.add(entry.status);
            if (entry.contentType) catEntry.contentTypesObserved.add(entry.contentType);
            if (entry.json) {
                try { catEntry.exampleResponsePreview = JSON.stringify(entry.json).slice(0, 500); } catch {  }

                catEntry.previousFullResponse = catEntry.lastFullResponse !== undefined ? catEntry.lastFullResponse : null;
                catEntry.lastFullResponse = entry.json;
            } else if (entry.rawText) {
                catEntry.exampleResponsePreview = entry.rawText.slice(0, 500);
            }

            this._updatePersistedTraffic(catalogKey, entry, host, pattern, method);

            if (opts.flushImmediately) {
                if (this._catalogSaveTimer) { clearTimeout(this._catalogSaveTimer); this._catalogSaveTimer = null; }
                if (this._persistedTrafficSaveTimer) { clearTimeout(this._persistedTrafficSaveTimer); this._persistedTrafficSaveTimer = null; }
                this._persistCatalog();
                this._persistTrafficCache();
            } else {
                this._scheduleCatalogSave();
                this._schedulePersistedTrafficSave();
            }
        },

        _truncateForPersist(value, max) {
            if (value === null || value === undefined) return null;
            let str;
            if (typeof value === 'string') str = value;
            else { try { str = JSON.stringify(value); } catch { return null; } }
            return str.length > max ? str.slice(0, max) + `...(truncated, ${str.length} chars total)` : str;
        },

        // Tries to find a dispatcher-style action name for a request - the common Torn pattern
        // of one endpoint handling many operations via a "step"/"q"/"action"/"p" field, either
        // in a urlencoded/JSON body or (for GET dispatchers like city.php?step=mapData) in the
        // query string. Falls back to the body's first key if none of the known names match, so
        // an unfamiliar dispatcher param still gets *something* distinguishing rather than
        // nothing. Returns null if no body and no recognized query param - i.e. this isn't a
        // dispatcher-style request at all.
        _ACTION_PARAM_NAMES: ['step', 'q', 'action', 'p'],
        _actionKeyFromParams(getter, hasFn) {
            for (const name of this._ACTION_PARAM_NAMES) {
                if (hasFn(name)) return `${name}=${getter(name)}`;
            }
            return null;
        },
        _actionKeyFromBody(bodyStr) {
            if (!bodyStr) return null;
            const trimmed = bodyStr.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    const obj = JSON.parse(trimmed);
                    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                        const fromKnown = this._actionKeyFromParams((n) => obj[n], (n) => n in obj);
                        if (fromKnown) return fromKnown;
                        const firstKey = Object.keys(obj)[0];
                        return firstKey ? `key:${firstKey}` : null;
                    }
                } catch {  }
                return null;
            }
            try {
                const params = new URLSearchParams(trimmed);
                const fromKnown = this._actionKeyFromParams((n) => params.get(n), (n) => params.has(n));
                if (fromKnown) return fromKnown;
                const firstKey = trimmed.split('&')[0].split('=')[0];
                return firstKey ? `key:${firstKey}` : null;
            } catch {
                return null;
            }
        },
        _actionKeyFor(entry) {
            const fromBody = this._actionKeyFromBody(entry.requestBody);
            if (fromBody) return fromBody;
            try {
                const u = new URL(entry.url, location.href);
                return this._actionKeyFromParams((n) => u.searchParams.get(n), (n) => u.searchParams.has(n));
            } catch {
                return null;
            }
        },

        // Keeps up to PERSISTED_ENTRIES_PER_KEY distinct *actions* per catalog key, so a
        // multi-step flow that reuses the same pathPattern across several page refreshes
        // (start/your-items/their-items/confirm/accept for a trade, say) keeps each step
        // instead of the last one clobbering the rest - and a dispatcher endpoint like
        // item.php reserves one slot per distinct step= value rather than one per parameter
        // combination, so pagination/ID noise doesn't crowd out real action diversity.
        // Repeating the same action just refreshes the timestamp on the existing item.
        _updatePersistedTraffic(catalogKey, entry, host, pattern, method) {
            const trunc = this.PERSISTED_BODY_TRUNC;
            const requestBody = this._truncateForPersist(entry.requestBody, trunc);
            const responseBody = this._truncateForPersist(
                (entry.json !== null && entry.json !== undefined) ? entry.json : entry.rawText,
                trunc
            );
            // Computed from the raw (pre-truncation) body/url so a >500-char body doesn't risk
            // a broken JSON.parse right at the point that determines identity.
            const actionKey = this._actionKeyFor(entry);
            const identity = actionKey !== null ? `ak:${actionKey}` : `body:${requestBody || ''}`;

            const ring = this._persistedTraffic[catalogKey] || [];
            const dupeIndex = ring.findIndex((e) => {
                const eIdentity = (e.actionKey !== null && e.actionKey !== undefined) ? `ak:${e.actionKey}` : `body:${e.requestBody || ''}`;
                return eIdentity === identity;
            });

            if (dupeIndex !== -1) {
                // Same action seen before for this key - refresh it in place (moves it to the
                // front) rather than storing a near-duplicate.
                ring.splice(dupeIndex, 1);
            }

            ring.unshift({
                method,
                host,
                pathPattern: pattern,
                url: entry.url,
                status: entry.status,
                contentType: entry.contentType || '',
                timestamp: entry.timestamp,
                actionKey,
                requestBody,
                responseBody
            });

            this._persistedTraffic[catalogKey] = ring.slice(0, this.PERSISTED_ENTRIES_PER_KEY);
        },

        _schedulePersistedTrafficSave() {
            if (this._persistedTrafficSaveTimer) return;
            this._persistedTrafficSaveTimer = setTimeout(() => {
                this._persistedTrafficSaveTimer = null;
                this._persistTrafficCache();
            }, 2000);
        },

        // Enforces a soft byte budget by dropping the single oldest item across *all* keys
        // at a time (not a whole key at once), so under space pressure many partial
        // sequences degrade gracefully instead of a few keys surviving intact while others
        // get wiped outright. Re-measures after each drop; n is small (tens of keys, up to
        // PERSISTED_ENTRIES_PER_KEY items each), so this stays cheap in practice.
        _enforceByteBudget(map, budgetBytes) {
            const working = {};
            Object.keys(map).forEach((k) => { working[k] = (map[k] || []).slice(); });

            const measure = () => { try { return JSON.stringify(working).length; } catch { return 0; } };
            let size = measure();

            while (size > budgetBytes) {
                let victimKey = null;
                let victimTs = Infinity;
                Object.keys(working).forEach((k) => {
                    const arr = working[k];
                    const oldest = arr[arr.length - 1];
                    if (oldest && oldest.timestamp < victimTs) { victimTs = oldest.timestamp; victimKey = k; }
                });
                if (!victimKey) break; 
                working[victimKey].pop();
                if (working[victimKey].length === 0) delete working[victimKey];
                size = measure();
            }
            return working;
        },

        _persistTrafficCache() {
            const budget = Config.persistedTrafficBudgetBytes;
            const trimmed = this._enforceByteBudget(this._persistedTraffic, budget);
            const ok = Storage.set(this.PERSISTED_TRAFFIC_KEY, trimmed);
            this._persistedTrafficWriteFailed = !ok;
            if (ok) this._persistedTraffic = trimmed;
        },

        // Flat, most-recent-first list of every persisted item across every key - used by
        // Export. Each item carries its own catalogKey so items from the same endpoint
        // pattern can still be told apart/grouped downstream.
        persistedTrafficEntries() {
            const flat = [];
            Object.keys(this._persistedTraffic).forEach((k) => {
                (this._persistedTraffic[k] || []).forEach((e) => flat.push({ catalogKey: k, ...e }));
            });
            return flat.sort((a, b) => b.timestamp - a.timestamp);
        },

        // All persisted items for one catalog key, most recent first - used by the Endpoints
        // detail view.
        persistedTrafficFor(catalogKey) {
            return (this._persistedTraffic[catalogKey] || []).map((e) => ({ catalogKey, ...e }));
        },

        persistedTrafficByteSize() {
            try { return JSON.stringify(this._persistedTraffic).length; } catch { return 0; }
        },

        clearPersistedTraffic() {
            this._persistedTraffic = {};
            this._persistedTrafficWriteFailed = false;
            Storage.set(this.PERSISTED_TRAFFIC_KEY, {});
        },

        diffFor(catalogKey) {
            const c = this._catalog[catalogKey];
            if (!c || !c.previousFullResponse || !c.lastFullResponse) return null;
            if (c.previousFullResponse === c.lastFullResponse) return []; 
            return ResponseDiff.diff(c.previousFullResponse, c.lastFullResponse);
        },

        _scheduleCatalogSave() {
            if (this._catalogSaveTimer) return;
            this._catalogSaveTimer = setTimeout(() => {
                this._catalogSaveTimer = null;
                this._persistCatalog();
            }, 2000);
        },

        _persistCatalog() {
            const plain = {};
            Object.keys(this._catalog).forEach((k) => {
                const c = this._catalog[k];
                plain[k] = {
                    method: c.method,
                    host: c.host,
                    pathPattern: c.pathPattern,
                    callCount: c.callCount,
                    firstSeen: c.firstSeen,
                    lastSeen: c.lastSeen,
                    paramsObserved: Array.from(c.paramsObserved),
                    statusesObserved: Array.from(c.statusesObserved),
                    contentTypesObserved: Array.from(c.contentTypesObserved),
                    exampleUrl: c.exampleUrl,
                    exampleResponsePreview: c.exampleResponsePreview
                };
            });
            Storage.set(this.CATALOG_KEY, plain);
        },

        all() {
            return this._entries.slice().reverse();
        },

        catalogEntries() {
            return Object.keys(this._catalog).map((k) => this._catalog[k]).sort((a, b) => b.lastSeen - a.lastSeen);
        },

        clearCatalog() {
            this._catalog = {};
            Storage.set(this.CATALOG_KEY, {});
        },

        clearEntries() {
            this._entries = [];
        },

        safeBodyPreview(body) {
            try {
                if (body == null) return null;
                if (typeof body === 'string') return body.length > 2000 ? body.slice(0, 2000) + '...' : body;
                if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return body.toString();
                if (typeof FormData !== 'undefined' && body instanceof FormData) {
                    const parts = [];
                    for (const [k, v] of body.entries()) parts.push(`${k}=${typeof v === 'string' ? v : '[File/Blob]'}`);
                    return parts.join('&');
                }
                return '[body type not readable synchronously - Blob/ArrayBuffer/stream]';
            } catch (e) {
                return `[error reading body: ${e.message}]`;
            }
        },

        normalizeRequestHeaders(headersInit) {
            const obj = {};
            try {
                if (!headersInit) return obj;
                if (typeof Headers !== 'undefined' && headersInit instanceof Headers) {
                    headersInit.forEach((v, k) => { obj[k] = v; });
                } else if (Array.isArray(headersInit)) {
                    headersInit.forEach((pair) => { if (pair && pair.length >= 2) obj[pair[0]] = pair[1]; });
                } else if (typeof headersInit === 'object') {
                    Object.keys(headersInit).forEach((k) => { obj[k] = headersInit[k]; });
                }
            } catch {  }
            return obj;
        },

        responseHeadersFromFetch(headers) {
            const obj = {};
            try { headers.forEach((v, k) => { obj[k] = v; }); } catch {  }
            return obj;
        },

        parseXhrResponseHeaders(raw) {
            const obj = {};
            try {
                (raw || '').trim().split(/[\r\n]+/).forEach((line) => {
                    if (!line) return;
                    const idx = line.indexOf(':');
                    if (idx === -1) return;
                    obj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
                });
            } catch {  }
            return obj;
        },

        getHeader(headersObj, name) {
            if (!headersObj) return null;
            const target = name.toLowerCase();
            const key = Object.keys(headersObj).find((k) => k.toLowerCase() === target);
            return key ? headersObj[key] : null;
        },

        hostSummary() {
            const map = {};
            this._entries.forEach((entry) => {
                let host;
                try { host = new URL(entry.url, location.href).host; } catch { host = '(unparseable URL)'; }
                if (!map[host]) map[host] = { host, count: 0, firstSeen: entry.timestamp, lastSeen: entry.timestamp };
                map[host].count += 1;
                map[host].firstSeen = Math.min(map[host].firstSeen, entry.timestamp);
                map[host].lastSeen = Math.max(map[host].lastSeen, entry.timestamp);
            });
            return Object.values(map).sort((a, b) => b.count - a.count);
        },

        findDuplicateClusters(windowMs) {
            windowMs = windowMs || 5000;
            const byKey = {};
            this._entries.slice().sort((a, b) => a.timestamp - b.timestamp).forEach((entry) => {
                const key = `${entry.method} ${entry.url}`;
                if (!byKey[key]) byKey[key] = [];
                byKey[key].push(entry);
            });

            const clusters = [];
            Object.keys(byKey).forEach((key) => {
                const list = byKey[key];
                let clusterStart = 0;
                for (let i = 1; i <= list.length; i++) {
                    if (i === list.length || list[i].timestamp - list[i - 1].timestamp > windowMs) {
                        const clusterEntries = list.slice(clusterStart, i);
                        if (clusterEntries.length >= 2) {
                            clusters.push({
                                method: clusterEntries[0].method,
                                url: clusterEntries[0].url,
                                count: clusterEntries.length,
                                firstSeen: clusterEntries[0].timestamp,
                                lastSeen: clusterEntries[clusterEntries.length - 1].timestamp
                            });
                        }
                        clusterStart = i;
                    }
                }
            });
            clusters.sort((a, b) => b.count - a.count);
            return clusters;
        }
    };

    
    const PageLoadSnapshots = {
        MAX: 40,

        capture(label) {
            const hosts = ObservedTraffic.hostSummary();
            const all = ObservedTraffic.all();
            const entry = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                timestamp: Date.now(),
                label: (label || '').trim() || null,
                url: location.href,
                hostname: location.hostname,
                totalRequests: all.length,
                problemCount: all.filter((e) => (e.status >= 400) || e.durationMs > 1000).length,
                hosts: hosts.map((h) => ({ host: h.host, count: h.count })),
                endpoints: Array.from(new Set(all.map((e) => `${e.method} ${Helpers._shortenUrl(e.url)}`))).slice(0, 500)
            };
            const list = this.all();
            list.push(entry);
            Config.pageLoadSnapshots = list;
            return entry;
        },

        all() {
            return Config.pageLoadSnapshots.slice().sort((a, b) => b.timestamp - a.timestamp);
        },

        remove(id) {
            Config.pageLoadSnapshots = Config.pageLoadSnapshots.filter((s) => s.id !== id);
        },

        clear() {
            Config.pageLoadSnapshots = [];
        },

        
        diff(snapA, snapB) {
            const hostMapA = new Map(snapA.hosts.map((h) => [h.host, h.count]));
            const hostMapB = new Map(snapB.hosts.map((h) => [h.host, h.count]));
            const allHosts = new Set([...hostMapA.keys(), ...hostMapB.keys()]);

            const hostRows = Array.from(allHosts).map((host) => {
                const a = hostMapA.has(host) ? hostMapA.get(host) : null;
                const b = hostMapB.has(host) ? hostMapB.get(host) : null;
                let kind = 'unchanged';
                if (a === null) kind = 'added'; 
                else if (b === null) kind = 'removed'; 
                else if (a !== b) kind = 'changed';
                return { host, a, b, kind };
            }).sort((r1, r2) => {
                const order = { added: 0, removed: 1, changed: 2, unchanged: 3 };
                if (order[r1.kind] !== order[r2.kind]) return order[r1.kind] - order[r2.kind];
                return r1.host.localeCompare(r2.host);
            });

            const setA = new Set(snapA.endpoints || []);
            const setB = new Set(snapB.endpoints || []);
            const endpointsAdded = (snapB.endpoints || []).filter((e) => !setA.has(e));
            const endpointsRemoved = (snapA.endpoints || []).filter((e) => !setB.has(e));

            return { hostRows, endpointsAdded, endpointsRemoved };
        }
    };

    const PayloadFilter = {
        parseQuery(query) {
            return (query || '').trim().split(/\s+/).filter(Boolean).map((term) => this._parseTerm(term));
        },

        _parseTerm(term) {
            let m;
            if ((m = term.match(/^(.+?):(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/))) {
                return { type: 'range', key: m[1].toLowerCase(), min: parseFloat(m[2]), max: parseFloat(m[3]), raw: term };
            }
            if ((m = term.match(/^(.+?)(>=|<=|>|<)(-?\d+(?:\.\d+)?)$/))) {
                return { type: 'compare', key: m[1].toLowerCase(), op: m[2], value: parseFloat(m[3]), raw: term };
            }
            if ((m = term.match(/^(.+?)=(.+)$/))) {
                return { type: 'keyvalue', key: m[1].toLowerCase(), value: m[2].toLowerCase(), raw: term };
            }
            return { type: 'keyword', value: term.toLowerCase(), raw: term };
        },

        _collectPairs(root, out, depth) {
            if (depth > 12 || root === null || typeof root !== 'object') return; 
            if (Array.isArray(root)) {
                root.forEach((v) => this._collectPairs(v, out, depth + 1));
                return;
            }
            Object.keys(root).forEach((k) => {
                out.push({ key: k.toLowerCase(), value: root[k] });
                this._collectPairs(root[k], out, depth + 1);
            });
        },

        test(entry, parsedTerms) {
            if (!parsedTerms.length) return { matched: true, reasons: [] };

            let requestJson = null;
            if (entry.requestBody) { try { requestJson = JSON.parse(entry.requestBody); } catch {  } }
            const pairs = [];
            if (requestJson) this._collectPairs(requestJson, pairs, 0);
            if (entry.json) this._collectPairs(entry.json, pairs, 0);

            const haystack = [
                entry.url || '',
                entry.requestBody || '',
                entry.json ? JSON.stringify(entry.json) : (entry.rawText || '')
            ].join(' ').toLowerCase();

            const reasons = [];
            for (const term of parsedTerms) {
                if (term.type === 'keyword') {
                    if (!haystack.includes(term.value)) return { matched: false, reasons: [] };
                    continue;
                }
                const matchingPairs = pairs.filter((p) => p.key === term.key);
                if (!matchingPairs.length) return { matched: false, reasons: [] };

                if (term.type === 'keyvalue') {
                    const hit = matchingPairs.find((p) => String(p.value).toLowerCase().includes(term.value));
                    if (!hit) return { matched: false, reasons: [] };
                    reasons.push(`${term.key}=${hit.value}`);
                } else if (term.type === 'compare') {
                    const hit = matchingPairs.find((p) => {
                        const n = Number(p.value);
                        if (!Number.isFinite(n)) return false;
                        if (term.op === '>') return n > term.value;
                        if (term.op === '<') return n < term.value;
                        if (term.op === '>=') return n >= term.value;
                        return n <= term.value; 
                    });
                    if (!hit) return { matched: false, reasons: [] };
                    reasons.push(`${term.key}${term.op}${term.value} (was ${hit.value})`);
                } else if (term.type === 'range') {
                    const hit = matchingPairs.find((p) => {
                        const n = Number(p.value);
                        return Number.isFinite(n) && n >= term.min && n <= term.max;
                    });
                    if (!hit) return { matched: false, reasons: [] };
                    reasons.push(`${term.key} in [${term.min}, ${term.max}] (was ${hit.value})`);
                }
            }
            return { matched: true, reasons };
        }
    };

    const RequestReplay = {

        FORBIDDEN_HEADERS: new Set([
            'accept-charset', 'accept-encoding', 'access-control-request-headers',
            'access-control-request-method', 'connection', 'content-length',
            'cookie', 'cookie2', 'date', 'dnt', 'expect', 'host', 'keep-alive',
            'origin', 'referer', 'set-cookie', 'te', 'trailer', 'transfer-encoding',
            'upgrade', 'via'
        ]),

        
        PRIVILEGED_FORBIDDEN_HEADERS: new Set(['host', 'content-length']),

        isForbiddenHeader(name) {
            const lower = String(name).toLowerCase().trim();
            return this.FORBIDDEN_HEADERS.has(lower) || lower.startsWith('proxy-') || lower.startsWith('sec-');
        },

        isForbiddenPrivilegedHeader(name) {
            return this.PRIVILEGED_FORBIDDEN_HEADERS.has(String(name).toLowerCase().trim());
        },

        privilegedAvailable() {
            return typeof GM_xmlhttpRequest === 'function';
        },

        draftFromEntry(entry) {
            const headers = entry.requestHeaders || {};
            const headersText = Object.keys(headers)
                .map((k) => `${k}: ${headers[k]}`)
                .join('\n');
            return {
                method: entry.method || 'GET',
                url: entry.url || '',
                headersText,
                body: entry.requestBody || ''
            };
        },

        _parseHeadersText(text, mode) {
            const obj = {};
            const stripped = [];
            const isForbidden = (name) => mode === 'privileged' ? this.isForbiddenPrivilegedHeader(name) : this.isForbiddenHeader(name);
            (text || '').split('\n').forEach((line) => {
                const idx = line.indexOf(':');
                if (idx === -1) return;
                const name = line.slice(0, idx).trim();
                const value = line.slice(idx + 1).trim();
                if (!name) return;
                if (isForbidden(name)) { stripped.push(name); return; }
                obj[name] = value;
            });
            return { headers: obj, stripped };
        },

        async send(draft) {
            const method = (draft.method || 'GET').toUpperCase();
            const { headers, stripped } = this._parseHeadersText(draft.headersText);
            const canHaveBody = method !== 'GET' && method !== 'HEAD';
            const init = { method, headers };
            if (canHaveBody && draft.body) init.body = draft.body;

            const original = ObservedTraffic._originalFetch;
            if (typeof original !== 'function') {
                return { ok: false, error: 'Original fetch reference is unavailable - ObservedTraffic may not have installed correctly.', strippedHeaders: stripped };
            }

            const startedAt = performance.now();
            try {
                const response = await original(draft.url, init);
                const durationMs = Math.round(performance.now() - startedAt);
                const responseHeaders = {};
                try { response.headers.forEach((v, k) => { responseHeaders[k] = v; }); } catch {  }
                const text = await response.text();
                let json = null;
                try { json = JSON.parse(text); } catch {  }
                return {
                    ok: true,
                    status: response.status,
                    statusText: response.statusText,
                    durationMs,
                    responseHeaders,
                    json,
                    rawText: json ? null : text,
                    strippedHeaders: stripped,
                    privileged: false
                };
            } catch (e) {
                return { ok: false, error: e && e.message ? e.message : String(e), durationMs: Math.round(performance.now() - startedAt), strippedHeaders: stripped, privileged: false };
            }
        },

        
        sendPrivileged(draft) {
            return new Promise((resolve) => {
                if (!this.privilegedAvailable()) {
                    resolve({ ok: false, error: 'GM_xmlhttpRequest is not available - this userscript manager may have blocked the grant, or this build wasn\'t granted it.', strippedHeaders: [], privileged: true });
                    return;
                }
                const method = (draft.method || 'GET').toUpperCase();
                const { headers, stripped } = this._parseHeadersText(draft.headersText, 'privileged');
                const canHaveBody = method !== 'GET' && method !== 'HEAD';
                const startedAt = performance.now();

                try {
                    GM_xmlhttpRequest({
                        method,
                        url: draft.url,
                        headers,
                        data: canHaveBody ? (draft.body || undefined) : undefined,
                        anonymous: false,
                        onload: (response) => {
                            const durationMs = Math.round(performance.now() - startedAt);
                            const responseHeaders = {};
                            try {
                                (response.responseHeaders || '').split('\r\n').forEach((line) => {
                                    const idx = line.indexOf(':');
                                    if (idx === -1) return;
                                    responseHeaders[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
                                });
                            } catch {  }
                            let json = null;
                            try { json = JSON.parse(response.responseText); } catch {  }
                            resolve({
                                ok: true,
                                status: response.status,
                                statusText: response.statusText || '',
                                durationMs,
                                responseHeaders,
                                json,
                                rawText: json ? null : response.responseText,
                                strippedHeaders: stripped,
                                privileged: true
                            });
                        },
                        onerror: () => {
                            resolve({ ok: false, error: 'Request failed (network error, or blocked - GM_xmlhttpRequest errors don\'t always include detail).', durationMs: Math.round(performance.now() - startedAt), strippedHeaders: stripped, privileged: true });
                        },
                        ontimeout: () => {
                            resolve({ ok: false, error: 'Request timed out.', durationMs: Math.round(performance.now() - startedAt), strippedHeaders: stripped, privileged: true });
                        }
                    });
                } catch (e) {
                    resolve({ ok: false, error: e && e.message ? e.message : String(e), durationMs: Math.round(performance.now() - startedAt), strippedHeaders: stripped, privileged: true });
                }
            });
        },

        
        sendWithMode(draft, mode) {
            return mode === 'privileged' ? this.sendPrivileged(draft) : this.send(draft);
        },

        
        substitutePlaceholder(text, placeholder, value) {
            if (!text || !placeholder) return text;
            return text.split(placeholder).join(value);
        },

        buildDraftForValue(template, placeholder, value) {
            return {
                method: template.method,
                url: this.substitutePlaceholder(template.url, placeholder, value),
                headersText: this.substitutePlaceholder(template.headersText, placeholder, value),
                body: this.substitutePlaceholder(template.body, placeholder, value)
            };
        },

        MIN_SWEEP_DELAY_MS: 150,

        
        runSweep(template, placeholder, values, delayMs, mode, callbacks) {
            callbacks = callbacks || {};
            let stopped = false;
            let idx = 0;
            const wait = Math.max(this.MIN_SWEEP_DELAY_MS, Number(delayMs) || 0);

            const runNext = () => {
                if (stopped) { callbacks.onDone && callbacks.onDone(true); return; }
                if (idx >= values.length) { callbacks.onDone && callbacks.onDone(false); return; }
                const value = values[idx];
                const stepIndex = idx;
                idx++;

                const doSend = async () => {
                    if (stopped) { callbacks.onDone && callbacks.onDone(true); return; }
                    const draft = this.buildDraftForValue(template, placeholder, value);
                    const result = await this.sendWithMode(draft, mode);
                    callbacks.onStep && callbacks.onStep(stepIndex, value, result);
                    runNext();
                };

                if (stepIndex === 0) doSend();
                else setTimeout(doSend, wait);
            };

            runNext();
            return { stop() { stopped = true; } };
        },

        MIN_AUTOMATION_INTERVAL_MS: 500,

        
        runAutomation(template, intervalMs, maxRuns, mode, callbacks) {
            callbacks = callbacks || {};
            let stopped = false;
            let count = 0;
            const wait = Math.max(this.MIN_AUTOMATION_INTERVAL_MS, Number(intervalMs) || 0);
            const limit = maxRuns > 0 ? maxRuns : Infinity;

            const tick = async () => {
                if (stopped || count >= limit) { callbacks.onDone && callbacks.onDone(stopped); return; }
                count++;
                const result = await this.sendWithMode(template, mode);
                if (stopped) { callbacks.onStep && callbacks.onStep(count, result); callbacks.onDone && callbacks.onDone(true); return; }
                callbacks.onStep && callbacks.onStep(count, result);
                if (count >= limit) { callbacks.onDone && callbacks.onDone(false); return; }
                setTimeout(tick, wait);
            };

            tick();
            return { stop() { stopped = true; } };
        },

        
        _gmRequest(opts) {
            return new Promise((resolve) => {
                try {
                    GM_xmlhttpRequest({
                        ...opts,
                        onload: (response) => resolve({ ok: true, response }),
                        onerror: () => resolve({ ok: false, error: 'Request failed (network error, or blocked).' }),
                        ontimeout: () => resolve({ ok: false, error: 'Request timed out.' })
                    });
                } catch (e) {
                    resolve({ ok: false, error: (e && e.message) || String(e) });
                }
            });
        },

        
        async testHeaderPassthrough() {
            if (!this.privilegedAvailable()) {
                return { ok: false, error: 'GM_xmlhttpRequest is not available in this userscript manager/build.' };
            }

            const controlName = 'ttd_ctrl';
            const controlValue = 'realcookie123';
            const probeCookie = 'ttd_probe=spoofed456';

            
            const setStep = await this._gmRequest({ method: 'GET', url: `https://httpbin.org/cookies/set/${controlName}/${controlValue}` });
            if (!setStep.ok) {
                return { ok: false, error: `Couldn't set up the test - the control-cookie step failed: ${setStep.error}` };
            }

            const probe = {
                Origin: 'https://ttd-header-test.invalid',
                Referer: 'https://ttd-header-test.invalid/probe',
                Cookie: probeCookie
            };
            const probeStep = await this._gmRequest({ method: 'GET', url: 'https://httpbin.org/headers', headers: probe });

            
            this._gmRequest({ method: 'GET', url: `https://httpbin.org/cookies/delete?${controlName}` });

            if (!probeStep.ok) {
                return { ok: false, error: probeStep.error };
            }

            let json = null;
            try { json = JSON.parse(probeStep.response.responseText); } catch {  }
            if (!json || !json.headers) {
                return { ok: false, error: `Probe completed (status ${probeStep.response.status}) but the response wasn't the expected JSON shape - httpbin may be having issues. Try again.` };
            }

            const received = json.headers;
            const findReceived = (name) => received[name] || received[name.toLowerCase()] || received[name.toUpperCase()] || null;

            const nonCookieResults = ['Origin', 'Referer'].map((name) => {
                const sent = probe[name];
                const got = findReceived(name);
                let status;
                if (got === sent) status = 'passed';
                else if (got && got.includes(sent)) status = 'appended';
                else if (!got) status = 'stripped';
                else status = 'mangled';
                return { name, sent, got, status };
            });

            const cookieReceived = findReceived('Cookie') || '';
            const hasControl = cookieReceived.includes(`${controlName}=${controlValue}`);
            const hasProbe = cookieReceived.includes(probeCookie);
            let cookieStatus;
            if (hasControl && hasProbe) cookieStatus = 'appended';
            else if (hasProbe && !hasControl) cookieStatus = 'overridden';
            else if (hasControl && !hasProbe) cookieStatus = 'ignored';
            else cookieStatus = 'stripped';

            const cookieResult = {
                name: 'Cookie',
                sent: probeCookie,
                got: cookieReceived || null,
                status: cookieStatus,
                controlName,
                controlValue,
                hasControl,
                hasProbe
            };

            const hostSeen = findReceived('Host');
            return { ok: true, results: [...nonCookieResults, cookieResult], hostSeen };
        }
    };

    const ReplayHistory = {
        MAX_ENTRIES: 50,
        _entries: [],

        add(draft, original, result) {

            const entry = {
                timestamp: Date.now(),
                draft: { method: draft.method, url: draft.url, headersText: draft.headersText, body: draft.body },
                original: original || null,
                result
            };
            this._entries.push(entry);
            if (this._entries.length > this.MAX_ENTRIES) this._entries = this._entries.slice(this._entries.length - this.MAX_ENTRIES);
            return entry;
        },

        all() {
            return this._entries.slice().reverse(); 
        },

        clear() {
            this._entries = [];
        }
    };

    const ScriptSandbox = {
        TIMEOUT_MS: 3000,
        _runCounter: 0,

        _buildSrcdoc(userCode, token) {
            const safeUserCode = String(userCode).replace(/<\/script/gi, '<\\/script');
            const parts = [];
            parts.push('<!DOCTYPE html><html><head></head><body><script>');
            parts.push('(function(){');
            parts.push('function makeFakeElement(tag){');
            parts.push('  var classes = [];');
            parts.push('  var el = {');
            parts.push('    tagName: (tag || "DIV").toUpperCase(), nodeType: 1,');
            parts.push('    id: "", className: "", style: {}, attributes: {},');
            parts.push('    children: [], childNodes: [], textContent: "", innerText: "", innerHTML: "", value: "", dataset: {},');
            parts.push('    appendChild: function(c){ this.children.push(c); this.childNodes.push(c); return c; },');
            parts.push('    removeChild: function(c){ var i = this.children.indexOf(c); if (i !== -1) this.children.splice(i, 1); return c; },');
            parts.push('    insertBefore: function(c){ this.children.push(c); return c; },');
            parts.push('    setAttribute: function(k, v){ this.attributes[k] = String(v); },');
            parts.push('    getAttribute: function(k){ return this.attributes.hasOwnProperty(k) ? this.attributes[k] : null; },');
            parts.push('    removeAttribute: function(k){ delete this.attributes[k]; },');
            parts.push('    hasAttribute: function(k){ return this.attributes.hasOwnProperty(k); },');
            parts.push('    addEventListener: function(){}, removeEventListener: function(){}, dispatchEvent: function(){ return true; },');
            parts.push('    querySelector: function(){ return null; }, querySelectorAll: function(){ return []; },');
            parts.push('    closest: function(){ return null; }, click: function(){}, focus: function(){}, blur: function(){}, remove: function(){},');
            parts.push('    cloneNode: function(){ return makeFakeElement(this.tagName); },');
            parts.push('    classList: {');
            parts.push('      add: function(){ for (var i=0;i<arguments.length;i++){ if (classes.indexOf(arguments[i]) === -1) classes.push(arguments[i]); } },');
            parts.push('      remove: function(){ for (var i=0;i<arguments.length;i++){ var j = classes.indexOf(arguments[i]); if (j !== -1) classes.splice(j,1); } },');
            parts.push('      contains: function(c){ return classes.indexOf(c) !== -1; },');
            parts.push('      toggle: function(c){ var j = classes.indexOf(c); if (j === -1) { classes.push(c); return true; } classes.splice(j,1); return false; }');
            parts.push('    }');
            parts.push('  };');
            parts.push('  return el;');
            parts.push('}');
            parts.push('function makeFakeStorage(){');
            parts.push('  var s = {};');
            parts.push('  return {');
            parts.push('    getItem: function(k){ return s.hasOwnProperty(k) ? s[k] : null; },');
            parts.push('    setItem: function(k, v){ s[k] = String(v); },');
            parts.push('    removeItem: function(k){ delete s[k]; },');
            parts.push('    clear: function(){ s = {}; },');
            parts.push('    key: function(i){ return Object.keys(s)[i] || null; }');
            parts.push('  };');
            parts.push('}');
            parts.push('var fakeBody = makeFakeElement("body");');
            parts.push('var fakeHtml = makeFakeElement("html");');
            parts.push('var mockDocument = {');
            parts.push('  createElement: function(tag){ return makeFakeElement(tag); },');
            parts.push('  createTextNode: function(text){ return { nodeType: 3, textContent: String(text) }; },');
            parts.push('  getElementById: function(){ return null; },');
            parts.push('  querySelector: function(){ return null; },');
            parts.push('  querySelectorAll: function(){ return []; },');
            parts.push('  getElementsByClassName: function(){ return []; },');
            parts.push('  getElementsByTagName: function(){ return []; },');
            parts.push('  body: fakeBody, documentElement: fakeHtml,');
            parts.push('  addEventListener: function(){}, removeEventListener: function(){},');
            parts.push('  cookie: "", title: "", readyState: "complete"');
            parts.push('};');
            parts.push('var mockLocalStorage = makeFakeStorage();');
            parts.push('var mockSessionStorage = makeFakeStorage();');
            parts.push('var TOKEN = ' + JSON.stringify(token) + ';');
            parts.push('function send(kind, payload){ try { var msg = { __ttdSandboxToken: TOKEN, kind: kind }; for (var k in payload) { msg[k] = payload[k]; } parent.postMessage(msg, "*"); } catch(e){} }');
            parts.push('function stringifyArg(v){');
            parts.push('  try {');
            parts.push('    if (v === null) return "null";');
            parts.push('    if (v === undefined) return "undefined";');
            parts.push('    if (typeof v === "string") return v;');
            parts.push('    if (typeof v === "function") return "function " + (v.name || "(anonymous)") + "()";');
            parts.push('    if (v instanceof Error) return v.name + ": " + v.message;');
            parts.push('    return JSON.stringify(v);');
            parts.push('  } catch (e2) { return String(v); }');
            parts.push('}');
            parts.push('["log","warn","error","info"].forEach(function(level){');
            parts.push('  console[level] = function(){');
            parts.push('    var text = Array.prototype.map.call(arguments, stringifyArg).join(" ");');
            parts.push('    send("log", { level: level, text: text });');
            parts.push('  };');
            parts.push('});');
            parts.push('window.onerror = function(msg, src, line){ send("log", { level: "error", text: "Uncaught: " + msg + " (line " + line + ")" }); return true; };');
            parts.push('(function(document, localStorage, sessionStorage){');
            parts.push('  try {');
            parts.push(safeUserCode);
            parts.push('  } catch (e) {');
            parts.push('    send("error", { text: (e && e.message) ? e.message : String(e) });');
            parts.push('  }');
            parts.push('})(mockDocument, mockLocalStorage, mockSessionStorage);');
            parts.push('setTimeout(function(){ send("done", {}); }, 250);'); 
            parts.push('})();');
            parts.push('</script></body></html>');
            return parts.join('\n');
        },

        run(code) {
            return new Promise((resolve) => {
                const token = `ttd-sandbox-${++this._runCounter}-${Date.now()}`;
                const logs = [];
                let errorText = null;
                let settled = false;
                let iframe = null;
                const startedAt = performance.now();

                const cleanup = () => {
                    window.removeEventListener('message', onMessage);
                    clearTimeout(hardTimeout);
                    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
                };

                const finish = (timedOut) => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    resolve({ logs, error: errorText, timedOut, durationMs: Math.round(performance.now() - startedAt) });
                };

                const onMessage = (event) => {
                    const data = event.data;
                    if (!data || data.__ttdSandboxToken !== token) return; 
                    if (data.kind === 'log') logs.push({ level: data.level, text: data.text });
                    else if (data.kind === 'error') errorText = data.text;
                    else if (data.kind === 'done') finish(false);
                };
                window.addEventListener('message', onMessage);

                const hardTimeout = setTimeout(() => finish(true), this.TIMEOUT_MS);

                iframe = document.createElement('iframe');
                iframe.setAttribute('sandbox', 'allow-scripts');
                iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;left:-9999px;top:-9999px;';
                iframe.srcdoc = this._buildSrcdoc(code, token);
                document.body.appendChild(iframe);
            });
        }
    };

    const PageInspector = {
        getDomHtml() {
            try {
                return document.documentElement.outerHTML;
            } catch (e) {
                return `(failed to read DOM: ${e.message})`;
            }
        },

        _baselineWindowKeys: null,
        _getBaselineWindowKeys() {
            if (this._baselineWindowKeys) return this._baselineWindowKeys;
            const keys = new Set();
            try {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
                Object.keys(iframe.contentWindow).forEach(k => keys.add(k));
                iframe.remove();
            } catch {  }
            this._baselineWindowKeys = keys;
            return keys;
        },

        getExtraWindowGlobals() {
            const baseline = this._getBaselineWindowKeys();
            const extras = [];
            let keys;
            try { keys = Object.keys(window); } catch { keys = []; }
            for (const key of keys) {
                if (baseline.has(key)) continue;
                if (/^(webkit|__|tw33k|ttd)/i.test(key)) continue; 
                let value, type;
                try {
                    value = window[key];
                    type = typeof value;
                } catch {
                    type = 'unreadable';
                    value = undefined;
                }

                extras.push({ key, type, preview: this._safePreview(value), full: this._safeFull(value) });
            }
            extras.sort((a, b) => a.key.localeCompare(b.key));
            return extras;
        },

        _safePreview(value, depth) {
            depth = depth || 0;
            try {
                if (value === null) return 'null';
                if (value === undefined) return 'undefined';
                const t = typeof value;
                if (t === 'function') return `function ${value.name || '(anonymous)'}()`;
                if (t === 'string') return value.length > 200 ? value.slice(0, 200) + '...' : value;
                if (t === 'number' || t === 'boolean') return String(value);
                if (Array.isArray(value)) return `Array(${value.length})`;
                if (t === 'object') {
                    if (depth >= 1) return '[object]';
                    const seen = new WeakSet();
                    const json = JSON.stringify(value, (k, v) => {
                        if (typeof v === 'object' && v !== null) {
                            if (seen.has(v)) return '[circular]';
                            seen.add(v);
                        }
                        if (typeof v === 'function') return '[function]';
                        return v;
                    });
                    if (!json) return '[unserializable object]';
                    return json.length > 400 ? json.slice(0, 400) + '...' : json;
                }
                return String(value);
            } catch (e) {
                return `[error reading value: ${e.message}]`;
            }
        },

        _safeFull(value) {
            try {
                if (value === null) return 'null';
                if (value === undefined) return 'undefined';
                const t = typeof value;
                if (t === 'function') {
                    try { return value.toString(); } catch { return `function ${value.name || '(anonymous)'}() { /* source unavailable */ }`; }
                }
                if (t === 'string') return value;
                if (t === 'number' || t === 'boolean') return String(value);
                if (t === 'object') {
                    const seen = new WeakSet();
                    let json;
                    try {
                        json = JSON.stringify(value, (k, v) => {
                            if (typeof v === 'object' && v !== null) {
                                if (seen.has(v)) return '[circular]';
                                seen.add(v);
                            }
                            if (typeof v === 'function') return `[function ${v.name || 'anonymous'}]`;
                            return v;
                        }, 2);
                    } catch (e) { json = null; }
                    if (json == null) {
                        try { return String(value); } catch { return '[unserializable object]'; }
                    }
                    return json.length > 100000 ? json.slice(0, 100000) + '\n... (truncated at 100,000 characters)' : json;
                }
                return String(value);
            } catch (e) {
                return `[error reading full value: ${e.message}]`;
            }
        },

        getStorageDump(storageObj) {
            const entries = [];
            try {
                for (let i = 0; i < storageObj.length; i++) {
                    const key = storageObj.key(i);
                    let value;
                    try { value = storageObj.getItem(key); } catch { value = '(unreadable)'; }
                    entries.push({ key, value: value == null ? '' : value });
                }
            } catch {  }
            entries.sort((a, b) => a.key.localeCompare(b.key));
            return entries;
        },

        // Writes go straight to the page's real storage - same effect as the page's own JS
        // calling setItem, live immediately. { ok, error } rather than throwing, since a quota
        // overflow or a site that's disabled storage shouldn't crash the panel.
        setStorageItem(storageObj, key, value) {
            try {
                storageObj.setItem(key, value);
                return { ok: true };
            } catch (e) {
                return { ok: false, error: (e && e.message) || String(e) };
            }
        },

        removeStorageItem(storageObj, key) {
            try {
                storageObj.removeItem(key);
                return { ok: true };
            } catch (e) {
                return { ok: false, error: (e && e.message) || String(e) };
            }
        },

        getCookies() {
            let raw = '';
            try { raw = document.cookie || ''; } catch {  }
            if (!raw.trim()) return [];
            return raw.split(';').map((pair) => {
                const idx = pair.indexOf('=');
                if (idx === -1) return { key: pair.trim(), value: '' };
                return { key: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim() };
            }).filter(c => c.key);
        },

        // Cookie writes are inherently best-effort: document.cookie only ever exposes key=value,
        // never the original path/domain/secure/sameSite attributes the page set it with - so an
        // "edit" can't guarantee it's replacing the exact same cookie, it writes a new one with
        // path=/ by default instead, which may create a second cookie of the same name scoped
        // differently rather than truly overwriting the original. httpOnly cookies never appear
        // here at all and can't be touched from JS under any circumstances - that's a browser
        // security boundary, not a gap in this tool.
        setCookie(key, value, path) {
            try {
                document.cookie = `${key}=${encodeURIComponent(value)}; path=${path || '/'}`;
                return { ok: true };
            } catch (e) {
                return { ok: false, error: (e && e.message) || String(e) };
            }
        },

        deleteCookie(key, path) {
            try {
                document.cookie = `${key}=; path=${path || '/'}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                return { ok: true };
            } catch (e) {
                return { ok: false, error: (e && e.message) || String(e) };
            }
        },

        // All four of these mutate the *live page DOM* directly - exactly as if done through
        // DevTools. No undo, nothing persisted (a reload reverts everything since it's just live
        // state), and no protection against breaking whatever the page's own JS expects to find.
        setElementAttributesFromText(el, text) {
            try {
                const wanted = {};
                text.split('\n').forEach((line) => {
                    line = line.trim();
                    if (!line) return;
                    const eq = line.indexOf('=');
                    if (eq === -1) { wanted[line] = ''; return; }
                    const name = line.slice(0, eq).trim();
                    let value = line.slice(eq + 1).trim();
                    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    if (name) wanted[name] = value;
                });
                Array.from(el.attributes).map((a) => a.name).forEach((name) => {
                    if (!(name in wanted)) el.removeAttribute(name);
                });
                Object.keys(wanted).forEach((name) => el.setAttribute(name, wanted[name]));
                return { ok: true };
            } catch (e) {
                return { ok: false, error: (e && e.message) || String(e) };
            }
        },

        setElementInlineStyle(el, text) {
            try {
                el.setAttribute('style', text);
                return { ok: true };
            } catch (e) {
                return { ok: false, error: (e && e.message) || String(e) };
            }
        },

        // Replaces all content (text and any child elements) with plain text - if the element
        // has child elements worth keeping, this isn't the right tool for that edit.
        setElementText(el, text) {
            try {
                el.textContent = text;
                return { ok: true };
            } catch (e) {
                return { ok: false, error: (e && e.message) || String(e) };
            }
        },

        removeElement(el) {
            try {
                el.remove();
                return { ok: true };
            } catch (e) {
                return { ok: false, error: (e && e.message) || String(e) };
            }
        },

        getResourceEntries(filter) {
            let entries = [];
            try { entries = performance.getEntriesByType('resource'); } catch { entries = []; }
            let hostname = '';
            try { hostname = location.hostname; } catch {  }
            return entries
                .filter((e) => {
                    if (filter === 'same-origin' && hostname) return e.name.includes(hostname);
                    return true;
                })
                .map((e) => ({
                    name: e.name,
                    initiatorType: e.initiatorType,
                    duration: Math.round(e.duration),
                    transferSize: e.transferSize || 0,
                    startTime: Math.round(e.startTime)
                }))
                .sort((a, b) => b.startTime - a.startTime);
        },

        getInlineScripts() {
            const results = [];
            try {
                const scripts = document.scripts;
                for (let i = 0; i < scripts.length; i++) {
                    const s = scripts[i];
                    if (s.src) {
                        results.push({ index: i, external: true, src: s.src, length: null, preview: null, hints: [], full: null, fetchError: null });
                        continue;
                    }
                    const text = s.textContent || '';
                    if (!text.trim()) continue;

                    const hints = [];
                    const assignRe = /(?:var|let|const|window\.)\s*([A-Za-z_$][\w$]*)\s*=\s*(\{|\[)/g;
                    let match;
                    while ((match = assignRe.exec(text)) && hints.length < 8) {
                        hints.push(match[1]);
                    }
                    results.push({ index: i, external: false, src: null, length: text.length, preview: text.slice(0, 300), hints, full: text, fetchError: null });
                }
            } catch {  }
            return results;
        },

        async fetchExternalScriptText(src) {
            try {
                const response = await fetch(src);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return { ok: true, text: await response.text() };
            } catch (e) {
                return { ok: false, error: e.message || 'Fetch failed (possibly blocked by CORS)' };
            }
        },

        RESULT_KEY: '__ttd_exec_result__',

        async executeOnPage(code) {
            const key = this.RESULT_KEY;

            const realWindow = getRealWindow();
            try { delete realWindow[key]; } catch {  }

            const stringifyHelper = `
                function __ttdStringify(v, depth) {
                    depth = depth || 0;
                    try {
                        if (v === null) return 'null';
                        if (v === undefined) return 'undefined';
                        var t = typeof v;
                        if (t === 'function') return 'function ' + (v.name || '(anonymous)') + '()';
                        if (t === 'string') return v.length > 3000 ? v.slice(0, 3000) + '...' : v;
                        if (t === 'number' || t === 'boolean') return String(v);
                        if (typeof Node !== 'undefined' && v instanceof Node) return '[DOM ' + v.nodeName + ']';
                        if (Array.isArray(v)) {
                            if (depth >= 2) return 'Array(' + v.length + ')';
                            return '[' + v.slice(0, 50).map(function(x){ return __ttdStringify(x, depth + 1); }).join(', ') + (v.length > 50 ? ', ...' : '') + ']';
                        }
                        if (t === 'object') {
                            if (depth >= 2) return '[object]';
                            var seen = [];
                            var json;
                            try {
                                json = JSON.stringify(v, function(k, val) {
                                    if (typeof val === 'object' && val !== null) {
                                        if (seen.indexOf(val) !== -1) return '[circular]';
                                        seen.push(val);
                                    }
                                    if (typeof val === 'function') return '[function]';
                                    return val;
                                }, 2);
                            } catch (e) { json = null; }
                            if (!json) return String(v);
                            return json.length > 4000 ? json.slice(0, 4000) + '...' : json;
                        }
                        return String(v);
                    } catch (e) {
                        return '[error stringifying: ' + e.message + ']';
                    }
                }
            `;

            const wrapped = `
                (function(){
                    var W = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
                    W['${key}_started'] = true;
                    ${stringifyHelper}
                    (async function(){
                        try {
                            var AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                            var __fn;
                            try {
                                __fn = new AsyncFunction(${JSON.stringify('return (\n' + code + '\n);')});
                            } catch (e1) {
                                __fn = new AsyncFunction(${JSON.stringify(code)});
                            }
                            var __result = await __fn();
                            W['${key}'] = { ok: true, value: __ttdStringify(__result) };
                        } catch (runErr) {
                            var __msg = (runErr && runErr.message) || String(runErr);
                            var __hint = /unsafe-eval|eval|content security policy|csp/i.test(__msg)
                                ? ' - this page\\'s Content Security Policy is likely blocking dynamic code execution (AsyncFunction/eval), not a bug in the code you entered'
                                : '';
                            W['${key}'] = { ok: false, error: __msg + __hint, stack: (runErr && runErr.stack) || '' };
                        } finally {
                            W['${key}_done'] = true;
                        }
                    })();
                })();
            `;

            try {
                delete realWindow[`${key}_done`];
                delete realWindow[`${key}_started`];
            } catch {  }

            const cspViolations = [];
            const cspListener = (e) => {
                cspViolations.push(`${e.violatedDirective || e.effectiveDirective || '?'} (blocked: ${e.blockedURI || 'inline'})`);
            };
            document.addEventListener('securitypolicyviolation', cspListener);

            try {
                realWindow.eval(wrapped);
            } catch (e) {
                document.removeEventListener('securitypolicyviolation', cspListener);
                const isCsp = /unsafe-eval|eval|content security policy|csp/i.test(e.message || '');
                return {
                    ok: false,
                    error: `eval() itself was rejected: ${e.message}${isCsp ? ' - this page\'s CSP blocks \'unsafe-eval\' in the page\'s own context. Try Isolated mode - it compiles in the userscript\'s own context instead, which many browsers don\'t subject to the page\'s CSP.' : ''}`,
                    stack: '',
                    mode: 'page'
                };
            }

            const doneKey = `${key}_done`;
            const maxWaitMs = 10000;
            const pollMs = 30;
            const startedAt = Date.now();
            while (!realWindow[doneKey] && Date.now() - startedAt < maxWaitMs) {
                await new Promise((resolve) => setTimeout(resolve, pollMs));
            }

            document.removeEventListener('securitypolicyviolation', cspListener);
            const timedOut = !realWindow[doneKey];

            const everStarted = !!realWindow[`${key}_started`];
            const result = realWindow[key];
            try { delete realWindow[key]; delete realWindow[doneKey]; delete realWindow[`${key}_started`]; } catch {  }

            if (timedOut) {
                const cspNote = cspViolations.length
                    ? ` CSP violation(s) detected during this attempt: ${cspViolations.join('; ')} - this page's Content Security Policy is blocking something needed here.`
                    : '';

                const startNote = everStarted
                    ? ' The evaluated code DID start running (the very first line executed) but never finished - something inside it is genuinely hanging, most likely your code itself (an infinite loop, a promise that never resolves) rather than the execution mechanism.'
                    : ' The evaluated code never started executing at all, even though eval() itself did not throw synchronously - unusual, and not explained by a confirmed CSP block (see below). Worth reporting back if this happens again on this eval-based approach specifically.';
                return {
                    ok: false,
                    error: `Timed out after ${maxWaitMs / 1000}s waiting for the code to finish.${startNote}${cspNote}`,
                    stack: '',
                    mode: 'page'
                };
            }
            if (!result) {
                const cspNote = cspViolations.length
                    ? ` CSP violation(s) detected: ${cspViolations.join('; ')}.`
                    : '';
                return {
                    ok: false,
                    error: `No result came back.${cspNote} Other possibilities: the injected <script> tag itself was blocked without a catchable JS exception, or the code threw before it could report anything.`,
                    stack: '',
                    mode: 'page'
                };
            }
            return { ...result, mode: 'page' };
        },

        
        _isolatedStringify(v, depth) {
            depth = depth || 0;
            try {
                if (v === null) return 'null';
                if (v === undefined) return 'undefined';
                const t = typeof v;
                if (t === 'function') return `function ${v.name || '(anonymous)'}()`;
                if (t === 'string') return v.length > 3000 ? v.slice(0, 3000) + '...' : v;
                if (t === 'number' || t === 'boolean') return String(v);
                if (typeof Node !== 'undefined' && v instanceof Node) return `[DOM ${v.nodeName}]`;
                if (Array.isArray(v)) {
                    if (depth >= 2) return `Array(${v.length})`;
                    return '[' + v.slice(0, 50).map((x) => this._isolatedStringify(x, depth + 1)).join(', ') + (v.length > 50 ? ', ...' : '') + ']';
                }
                if (t === 'object') {
                    if (depth >= 2) return '[object]';
                    const seen = [];
                    let json;
                    try {
                        json = JSON.stringify(v, (k, val) => {
                            if (typeof val === 'object' && val !== null) {
                                if (seen.indexOf(val) !== -1) return '[circular]';
                                seen.push(val);
                            }
                            if (typeof val === 'function') return '[function]';
                            return val;
                        }, 2);
                    } catch (e) { json = null; }
                    if (!json) return String(v);
                    return json.length > 4000 ? json.slice(0, 4000) + '...' : json;
                }
                return String(v);
            } catch (e) {
                return `[error stringifying: ${e.message}]`;
            }
        },

        
        async executeIsolated(code) {
            const realWindow = getRealWindow();
            const startedAt = performance.now();
            try {
                let fn;
                try {
                    fn = new Function('unsafeWindow', 'return (async () => { return (\n' + code + '\n); })();');
                } catch (e1) {
                    fn = new Function('unsafeWindow', 'return (async () => {\n' + code + '\n})();');
                }

                let result;
                let timedOut = false;
                const TIMEOUT_MS = 10000;
                await Promise.race([
                    (async () => { result = await fn(realWindow); })(),
                    new Promise((resolve) => setTimeout(() => { timedOut = true; resolve(); }, TIMEOUT_MS))
                ]);

                if (timedOut) {
                    return { ok: false, error: `Timed out after ${TIMEOUT_MS / 1000}s waiting for the code to finish - most likely an unresolved promise/await. (A genuinely synchronous infinite loop would freeze this panel entirely rather than time out cleanly - same real JS/browser limitation Script Sandbox notes.)`, stack: '', mode: 'isolated' };
                }
                return { ok: true, value: this._isolatedStringify(result), mode: 'isolated' };
            } catch (e) {
                const msg = (e && e.message) || String(e);
                const isCsp = /unsafe-eval|eval|content security policy|csp/i.test(msg);
                return {
                    ok: false,
                    error: msg + (isCsp
                        ? ' - this page\'s CSP is blocking code compilation even in the userscript\'s own isolated context, not just the page\'s. That means there is genuinely no way to run arbitrary typed code here from a userscript - Page context would fail the same way.'
                        : ''),
                    stack: (e && e.stack) || '',
                    mode: 'isolated',
                    durationMs: Math.round(performance.now() - startedAt)
                };
            }
        },

        
        testIsolatedCompile() {
            return this.executeIsolated('1 + 1');
        },

        
        executeWithMode(code, mode) {
            return mode === 'isolated' ? this.executeIsolated(code) : this.executeOnPage(code);
        },

        CSS_GROUPS: {
            Layout: ['display', 'position', 'top', 'right', 'bottom', 'left', 'float', 'clear', 'zIndex', 'overflow'],
            'Box Model': ['width', 'height', 'boxSizing', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle', 'borderColor', 'borderRadius'],
            Typography: ['fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'textAlign', 'color', 'letterSpacing', 'textDecoration', 'whiteSpace', 'textOverflow'],
            Visual: ['backgroundColor', 'opacity', 'visibility', 'boxShadow', 'cursor', 'pointerEvents', 'transform'],
            'Flex/Grid': ['flexDirection', 'justifyContent', 'alignItems', 'alignContent', 'flexWrap', 'gap', 'gridTemplateColumns', 'gridTemplateRows']
        },

        NATIVE_INTERACTIVE_TAGS: new Set(['a', 'button', 'input', 'select', 'textarea', 'label', 'summary', 'details', 'option']),
        INTERACTIVE_ROLES: new Set(['button', 'link', 'tab', 'menuitem', 'checkbox', 'radio', 'switch']),

        _describeInteractivity(el, computedCursor) {
            const reasons = [];
            const tag = el.tagName ? el.tagName.toLowerCase() : '';
            if (this.NATIVE_INTERACTIVE_TAGS.has(tag)) reasons.push(`native <${tag}>`);
            let role = null;
            try { role = el.getAttribute ? el.getAttribute('role') : null; } catch {  }
            if (role && this.INTERACTIVE_ROLES.has(role.toLowerCase())) reasons.push(`role="${role}"`);
            try { if (el.hasAttribute && el.hasAttribute('tabindex')) reasons.push('tabindex present'); } catch {  }
            try {
                const inlineHandlers = Array.from(el.attributes || []).filter((a) => a.name.startsWith('on'));
                if (inlineHandlers.length) reasons.push(`inline ${inlineHandlers.map((a) => a.name).join(', ')}`);
            } catch {  }
            if (computedCursor === 'pointer') reasons.push('cursor: pointer');
            return { looksInteractive: reasons.length > 0, reasons };
        },

        _generateSelectors(el) {
            const selectors = [];
            if (el.id) selectors.push(`#${el.id}`);
            if (el.className && typeof el.className === 'string' && el.className.trim()) {
                const classes = el.className.trim().split(/\s+/).slice(0, 3).map((c) => `.${c}`).join('');
                selectors.push(`${el.tagName.toLowerCase()}${classes}`);
            }

            const path = [];
            let node = el;
            let depth = 0;
            while (node && node.nodeType === 1 && depth < 5) {
                let piece = node.tagName.toLowerCase();
                if (node.id) { path.unshift(`#${node.id}`); break; }
                const parent = node.parentElement;
                if (parent) {
                    const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
                    if (siblings.length > 1) piece += `:nth-of-type(${siblings.indexOf(node) + 1})`;
                }
                path.unshift(piece);
                node = parent;
                depth++;
            }
            selectors.push(path.join(' > '));
            return Array.from(new Set(selectors));
        },

        inspectElement(el) {
            if (!el || el.nodeType !== 1) return null;
            let rect = { top: 0, left: 0, width: 0, height: 0 };
            try {
                const r = el.getBoundingClientRect();
                rect = { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
            } catch {  }

            const cssGroups = {};
            try {
                const computed = window.getComputedStyle(el);
                Object.keys(this.CSS_GROUPS).forEach((group) => {
                    const props = {};
                    this.CSS_GROUPS[group].forEach((prop) => { try { props[prop] = computed[prop]; } catch {  } });
                    cssGroups[group] = props;
                });
            } catch {  }

            const attributes = {};
            try { Array.from(el.attributes || []).forEach((a) => { attributes[a.name] = a.value; }); } catch {  }

            const dataset = {};
            try { if (el.dataset) Object.keys(el.dataset).forEach((k) => { dataset[k] = el.dataset[k]; }); } catch {  }

            const inlineEventAttributes = Object.keys(attributes).filter((n) => n.startsWith('on'));

            const parents = [];
            const ancestorContext = [];
            try {
                let p = el.parentElement;
                while (p && parents.length < 10) {
                    const classList = p.className && typeof p.className === 'string' && p.className.trim() ? p.className.trim().split(/\s+/) : [];
                    const breadcrumb = `${p.tagName.toLowerCase()}${p.id ? '#' + p.id : ''}${classList.length ? '.' + classList.join('.') : ''}`;
                    parents.push(breadcrumb);

                    let cursor = null;
                    try { cursor = window.getComputedStyle(p).cursor; } catch {  }
                    const { looksInteractive, reasons } = this._describeInteractivity(p, cursor);
                    ancestorContext.push({ tag: p.tagName.toLowerCase(), id: p.id || null, classes: classList, breadcrumb, looksInteractive, reasons });

                    p = p.parentElement;
                }
            } catch {  }

            const children = [];
            try {
                Array.from(el.children || []).slice(0, 30).forEach((c) => { children.push(`${c.tagName.toLowerCase()}${c.id ? '#' + c.id : ''}`); });
            } catch {  }

            let ownText = '';
            try {
                el.childNodes.forEach((n) => { if (n.nodeType === 3) ownText += n.textContent; });
                ownText = ownText.trim().slice(0, 500);
            } catch {  }

            return {
                tag: el.tagName.toLowerCase(),
                id: el.id || null,
                classes: el.className && typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean) : [],
                attributes,
                dataset,
                ownText,
                parents,
                ancestorContext,
                childCount: el.children ? el.children.length : 0,
                children,
                cssGroups,
                rect,
                inlineEventAttributes,
                selectors: this._generateSelectors(el)
            };
        },

        getNavigationTiming() {
            try {
                const entries = performance.getEntriesByType('navigation');
                if (entries && entries.length) {
                    return this._deriveNavigationPhases(entries[entries.length - 1]);
                }
            } catch {  }
            try {
                if (performance.timing) {
                    return this._deriveLegacyNavigationPhases(performance.timing);
                }
            } catch {  }
            return null;
        },

        _finalizePhases(phases, total) {
            const sum = phases.reduce((s, p) => s + p.ms, 0);
            const unaccounted = Math.max(0, total - sum);
            if (unaccounted > 0.5) phases.push({ label: 'Other/unaccounted', ms: unaccounted });
            return phases;
        },

        _deriveNavigationPhases(nav) {
            const redirect = Math.max(0, nav.redirectEnd - nav.redirectStart);
            const dns = Math.max(0, nav.domainLookupEnd - nav.domainLookupStart);
            const tcp = Math.max(0, nav.connectEnd - nav.connectStart);
            const tls = nav.secureConnectionStart > 0 ? Math.max(0, nav.connectEnd - nav.secureConnectionStart) : 0;
            const request = Math.max(0, nav.responseStart - nav.requestStart);
            const response = Math.max(0, nav.responseEnd - nav.responseStart);
            const domProcessing = Math.max(0, nav.domComplete - nav.responseEnd);
            const loadEvent = Math.max(0, nav.loadEventEnd - nav.loadEventStart);
            const total = Math.max(0, nav.loadEventEnd - nav.startTime);
            return {
                type: nav.type || 'unknown',
                phases: this._finalizePhases([
                    { label: 'Redirect', ms: redirect },
                    { label: 'DNS', ms: dns },
                    { label: 'TCP', ms: tcp },
                    { label: 'TLS', ms: tls },
                    { label: 'Request (TTFB)', ms: request },
                    { label: 'Response download', ms: response },
                    { label: 'DOM processing', ms: domProcessing },
                    { label: 'Load event', ms: loadEvent }
                ], total),
                ttfb: Math.max(0, nav.responseStart - nav.startTime),
                domInteractive: Math.max(0, nav.domInteractive - nav.startTime),
                domContentLoaded: Math.max(0, nav.domContentLoadedEventEnd - nav.startTime),
                domComplete: Math.max(0, nav.domComplete - nav.startTime),
                total,
                transferSize: nav.transferSize || 0,
                encodedBodySize: nav.encodedBodySize || 0,
                decodedBodySize: nav.decodedBodySize || 0
            };
        },

        _deriveLegacyNavigationPhases(t) {
            const redirect = Math.max(0, t.redirectEnd - t.redirectStart);
            const dns = Math.max(0, t.domainLookupEnd - t.domainLookupStart);
            const tcp = Math.max(0, t.connectEnd - t.connectStart);
            const tls = t.secureConnectionStart > 0 ? Math.max(0, t.connectEnd - t.secureConnectionStart) : 0;
            const request = Math.max(0, t.responseStart - t.requestStart);
            const response = Math.max(0, t.responseEnd - t.responseStart);
            const domProcessing = Math.max(0, t.domComplete - t.responseEnd);
            const loadEvent = Math.max(0, t.loadEventEnd - t.loadEventStart);
            const total = Math.max(0, t.loadEventEnd - t.navigationStart);
            return {
                type: 'legacy (performance.timing)',
                phases: this._finalizePhases([
                    { label: 'Redirect', ms: redirect },
                    { label: 'DNS', ms: dns },
                    { label: 'TCP', ms: tcp },
                    { label: 'TLS', ms: tls },
                    { label: 'Request (TTFB)', ms: request },
                    { label: 'Response download', ms: response },
                    { label: 'DOM processing', ms: domProcessing },
                    { label: 'Load event', ms: loadEvent }
                ], total),
                ttfb: Math.max(0, t.responseStart - t.navigationStart),
                domInteractive: Math.max(0, t.domInteractive - t.navigationStart),
                domContentLoaded: Math.max(0, t.domContentLoadedEventEnd - t.navigationStart),
                domComplete: Math.max(0, t.domComplete - t.navigationStart),
                total,
                transferSize: 0,
                encodedBodySize: 0,
                decodedBodySize: 0
            };
        }
    };

    // IndexedDB values are structured-clonable, not JSON - a page can legitimately store Blobs,
    // ArrayBuffers, Dates, Maps, Sets, etc. This inspector reads/writes anything, but the *edit*
    // UI only round-trips values that are plain JSON; anything else is shown read-only rather
    // than silently corrupting it via a lossy JSON.stringify/parse cycle.
    const IndexedDBInspector = {
        supported() {
            return typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function';
        },

        async listDatabases() {
            if (!this.supported()) return [];
            try {
                const dbs = await indexedDB.databases();
                return (dbs || []).map((d) => ({ name: d.name, version: d.version })).filter((d) => d.name);
            } catch {
                return [];
            }
        },

        _openDB(name) {
            return new Promise((resolve, reject) => {
                let req;
                try { req = indexedDB.open(name); } catch (e) { reject(e); return; }
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error || new Error('Failed to open database'));
                req.onblocked = () => reject(new Error('Open blocked - another tab may have this database open with a pending version change'));
            });
        },

        _reqToPromise(req) {
            return new Promise((resolve, reject) => {
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error || new Error('Request failed'));
            });
        },

        _txDone(tx) {
            return new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
                tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
            });
        },

        async listObjectStores(dbName) {
            const db = await this._openDB(dbName);
            try {
                const names = Array.from(db.objectStoreNames);
                if (!names.length) return [];
                const tx = db.transaction(names, 'readonly');
                return names.map((n) => {
                    const store = tx.objectStore(n);
                    return { name: n, keyPath: store.keyPath, autoIncrement: store.autoIncrement, indexNames: Array.from(store.indexNames) };
                });
            } finally {
                db.close();
            }
        },

        // Capped read - a store could hold thousands of records, and pulling all of them into
        // this panel isn't the point (it's for inspecting/editing specific records, not bulk
        // dumping). getAllKeys/getAll iterate the same default key order per spec, so pairing
        // them by index is safe.
        async getRecords(dbName, storeName, limit) {
            const db = await this._openDB(dbName);
            try {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const keys = await this._reqToPromise(store.getAllKeys(undefined, limit));
                const values = await this._reqToPromise(store.getAll(undefined, limit));
                const total = await this._reqToPromise(store.count());
                return { keys, values, total };
            } finally {
                db.close();
            }
        },

        // For stores with an inline key (keyPath set), pass key as undefined - put() derives it
        // from the value's own field, and passing one explicitly throws a DataError.
        async putRecord(dbName, storeName, value, key) {
            let db;
            try {
                db = await this._openDB(dbName);
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                key === undefined ? store.put(value) : store.put(value, key);
                await this._txDone(tx);
                return { ok: true };
            } catch (e) {
                return { ok: false, error: (e && e.message) || String(e) };
            } finally {
                if (db) db.close();
            }
        },

        async deleteRecord(dbName, storeName, key) {
            let db;
            try {
                db = await this._openDB(dbName);
                const tx = db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).delete(key);
                await this._txDone(tx);
                return { ok: true };
            } catch (e) {
                return { ok: false, error: (e && e.message) || String(e) };
            } finally {
                if (db) db.close();
            }
        }
    };

    
    const PathAccess = {
        TIMEOUT_MS: 10000,

        
        parsePath(path) {
            const segments = [];
            const s = (path || '').trim();
            if (!s) return segments;
            let i = 0;
            let cur = '';
            const flush = () => { if (cur) { segments.push(cur); cur = ''; } };
            while (i < s.length) {
                const ch = s[i];
                if (ch === '.') { flush(); i++; continue; }
                if (ch === '[') {
                    flush();
                    const close = s.indexOf(']', i);
                    if (close === -1) throw new Error(`Unmatched "[" in path at position ${i}.`);
                    let inner = s.slice(i + 1, close).trim();
                    if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'"))) {
                        inner = inner.slice(1, -1);
                    }
                    if (!inner) throw new Error('Empty [] in path.');
                    segments.push(inner);
                    i = close + 1;
                    continue;
                }
                cur += ch;
                i++;
            }
            flush();
            if (!segments.length) throw new Error('Path is empty.');
            return segments;
        },

        _resolve(root, segments) {
            let cur = root;
            let walked = '';
            for (const seg of segments) {
                if (cur === null || cur === undefined) {
                    throw new Error(`"${walked || '(root)'}" is ${cur === null ? 'null' : 'undefined'} - can't go further to reach "${seg}".`);
                }
                cur = cur[seg];
                walked = walked ? `${walked}.${seg}` : seg;
            }
            return cur;
        },

        get(path) {
            try {
                const segments = this.parsePath(path);
                const value = this._resolve(getRealWindow(), segments);
                return { ok: true, value: PageInspector._isolatedStringify(value), rawType: typeof value };
            } catch (e) {
                return { ok: false, error: (e && e.message) || String(e) };
            }
        },

        set(path, valueJson) {
            try {
                const segments = this.parsePath(path);
                const last = segments[segments.length - 1];
                const parent = segments.length > 1 ? this._resolve(getRealWindow(), segments.slice(0, -1)) : getRealWindow();
                if (parent === null || parent === undefined) {
                    return { ok: false, error: `Can't set "${last}" - the parent path resolved to ${parent === null ? 'null' : 'undefined'}.` };
                }
                let parsedValue;
                const trimmed = (valueJson || '').trim();
                if (!trimmed) return { ok: false, error: 'Enter a value first - JSON, e.g. 500, "text", true, or {"a":1}.' };
                try { parsedValue = JSON.parse(trimmed); } catch (e) {
                    return { ok: false, error: `Value must be valid JSON - strings need quotes (e.g. "text", not text). Parse error: ${e.message}` };
                }
                parent[last] = parsedValue;
                return { ok: true, value: PageInspector._isolatedStringify(parsedValue), rawType: typeof parsedValue };
            } catch (e) {
                return { ok: false, error: (e && e.message) || String(e) };
            }
        },

        async call(path, argsJson) {
            try {
                const segments = this.parsePath(path);
                const last = segments[segments.length - 1];
                const parent = segments.length > 1 ? this._resolve(getRealWindow(), segments.slice(0, -1)) : getRealWindow();
                if (parent === null || parent === undefined) {
                    return { ok: false, error: `Can't call "${last}" - the parent path resolved to ${parent === null ? 'null' : 'undefined'}.` };
                }
                const fn = parent[last];
                if (typeof fn !== 'function') {
                    return { ok: false, error: `"${path}" is not a function (got ${fn === null ? 'null' : typeof fn}).` };
                }

                let args = [];
                const trimmed = (argsJson || '').trim();
                if (trimmed) {
                    let parsed;
                    try { parsed = JSON.parse(trimmed); } catch (e) {
                        return { ok: false, error: `Arguments must be valid JSON, e.g. an array like [1,"two",true]. Parse error: ${e.message}` };
                    }
                    args = Array.isArray(parsed) ? parsed : [parsed];
                }

                let result = fn.apply(parent, args);
                if (result && typeof result.then === 'function') {
                    let timedOut = false;
                    result = await Promise.race([
                        result,
                        new Promise((resolve) => setTimeout(() => { timedOut = true; resolve(undefined); }, this.TIMEOUT_MS))
                    ]);
                    if (timedOut) {
                        return { ok: false, error: `Called successfully, but the returned promise hadn't resolved after ${this.TIMEOUT_MS / 1000}s - gave up waiting on it. The call itself already happened.` };
                    }
                }
                return { ok: true, value: PageInspector._isolatedStringify(result), rawType: typeof result };
            } catch (e) {
                return { ok: false, error: (e && e.message) || String(e) };
            }
        }
    };

    const ElementPicker = {
        _active: false,
        _overlay: null,
        _onClickBound: null,

        start(onPick) {
            if (this._active) return;
            this._active = true;
            if (!this._overlay) {
                this._overlay = document.createElement('div');
                this._overlay.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #ff5555;background:rgba(255,85,85,0.2);z-index:999999;display:none;';
                document.body.appendChild(this._overlay);
            }
            this._onClickBound = (e) => {
                if (e.target.closest('#ttd-panel, #ttd-launcher')) {
                    return; 
                }
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                const el = e.target;
                this._flash(el);
                this.stop();
                if (onPick) onPick(el);
            };
            document.addEventListener('click', this._onClickBound, true);
        },

        stop() {
            this._active = false;
            if (this._onClickBound) {
                document.removeEventListener('click', this._onClickBound, true);
                this._onClickBound = null;
            }
            if (this._overlay) this._overlay.style.display = 'none';
        },

        _flash(el) {
            try {
                const rect = el.getBoundingClientRect();
                this._overlay.style.top = `${rect.top}px`;
                this._overlay.style.left = `${rect.left}px`;
                this._overlay.style.width = `${rect.width}px`;
                this._overlay.style.height = `${rect.height}px`;
                this._overlay.style.display = 'block';
                setTimeout(() => { if (this._overlay) this._overlay.style.display = 'none'; }, 1200);
            } catch {  }
        }
    };

    const Helpers = {
        _cardStyle(t) {
            return `background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:10px;padding:10px;margin-bottom:10px;`;
        },
        _pillStyle(t, active) {
            return `flex:1;padding:6px;border-radius:8px;border:1px solid ${t.rowBorder};cursor:pointer;font-size:11px;font-weight:700;background:${active ? 'linear-gradient(135deg, #3f8296, #1e4550)' : t.panelBg};color:${active ? '#fff' : t.panelText};`;
        },
        _primaryBtnStyle() {
            return 'width:100%;padding:8px;background:linear-gradient(135deg, #3f8296, #1e4550);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;';
        },
        _secondaryBtnStyle(t) {
            return `padding:4px 8px;background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};color:${t.panelText};border-radius:6px;cursor:pointer;font-size:11px;`;
        },
        _noteStyle() {
            return 'font-size:12px;opacity:.85;';
        },
        _escape(str) {
            const div = document.createElement('div');
            div.textContent = str == null ? '' : String(str);
            return div.innerHTML;
        },

        _originBadge(origin, t) {
            if (!origin) return '';
            const color = origin.confidence === 'stack' ? t.statusOk : t.statusNeutral;
            return `<span style="color:${color};font-size:10px;">from ${this._escape(origin.label)}</span>`;
        },

        downloadFile(filename, content, mimeType) {
            try {
                const blob = new Blob([content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 2000);
                return true;
            } catch {
                return false;
            }
        },

        _exportFilename(ext) {
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            return `target-data-export-${ts}.${ext}`;
        },

        _shortenUrl(url) {
            if (!url) return '(no URL)';
            try {
                const u = new URL(url, location.href);
                ['key', 'token', 'api_key', 'apikey', 'access_token', 'auth'].forEach((p) => u.searchParams.delete(p));
                return `${u.pathname.replace(/^\//, '')}${u.search}`;
            } catch {
                return url;
            }
        },

        _timeAgo(timestamp) {
            if (!timestamp) return '';
            const seconds = Math.round((Date.now() - timestamp) / 1000);
            if (seconds < 60) return `${seconds}s ago`;
            const minutes = Math.round(seconds / 60);
            if (minutes < 60) return `${minutes}m ago`;
            return `${Math.round(minutes / 60)}h ago`;
        }
    };

    const PageInspectorUI = {
        _section: 'dom',
        _domSnapshot: null,
        _pickedElement: null,
        _pageTiming: null,
        _selectedTimelineEntry: null,
        _recorderTreeState: null,
        _traceValue: '',
        _traceResult: null,
        _tokenScanResults: null,
        _selectedToken: null,
        _tokenViewMode: 'scanned',
        _tokenVaultLabel: '',
        _tokenOccurrences: null,
        _tokenPayloadTreeState: null,
        _exportCategories: { traffic: true, catalog: true, persistedTraffic: true, recorder: true, element: true, pageTiming: true, websocket: true, traceHistory: true, replay: true, replayHistory: true, sandboxRun: true, sandboxHistory: true, domSnapshot: true, eventDebugLog: true, domMutationLog: true, storageWatchLog: true, wsMessageCatalog: true, snapshots: true },
        _globalsSnapshot: null,
        _storageType: 'local',
        _networkFilter: 'same-origin',
        _networkTypeFilter: 'all',
        _networkSnapshot: null,
        _scriptsSnapshot: null,
        _expandedScriptIndex: null,
        _consoleCode: '',
        _consoleResult: null,
        _consoleExecMode: 'page',
        _consoleTestCompileResult: null,
        _consoleAutoPicked: null,
        _consoleAutoCode: '',

        _pathAccessOp: 'get',
        _pathAccessPath: '',
        _pathAccessValue: '',
        _pathAccessArgs: '',
        _pathAccessResult: null,

        _scriptExecMode: 'page',
        _scriptAnywhereUrl: '',
        _scriptAnywhereFetching: false,
        _scriptAnywhereResult: null,
        _trafficSearch: '',

        _jumpToTraffic(url) {
            this._trafficSearch = Helpers._shortenUrl(url);
            this._section = 'traffic';
            this.render();
        },

        _trafficPayloadFilter: '',
        _selectedTrafficEntry: null,
        _trafficRecordedOnly: false,
        _trafficProblemsOnly: false,
        _selectedWsConnection: null,
        _selectedWsMessage: null,
        _wsPayloadFilter: '',
        _wsTreeState: null,
        _wsResendDraft: null,
        _wsResendSending: false,
        _wsResendResult: null,
        _wsSequenceSteps: [],
        _wsSequenceNewText: '',
        _wsSequenceNewDelay: 500,
        _wsSequenceRunning: null,
        _wsSequenceLog: [],
        _wsSequenceName: '',

        _pageLoadCompareA: null,
        _pageLoadCompareB: null,
        _pageLoadSaveLabel: '',

        _replaySendMode: 'standard',

        _replaySweepPlaceholder: '{{VALUE}}',
        _replaySweepValuesText: '',
        _replaySweepDelay: 500,
        _replaySweepRunning: null,
        _replaySweepLog: [],

        _replayAutoInterval: 2000,
        _replayAutoMaxRuns: 10,
        _replayAutoRunning: null,
        _replayAutoLog: [],

        _trafficTreeState: null,
        _trafficViewMode: 'tree',
        _endpointSearch: '',
        _selectedEndpointKey: null,

        render() {
            const t = Theme.palette;
            const body = document.getElementById('ttd-body');
            if (!body) return;

            body.innerHTML = `
                <div style="${Helpers._cardStyle(t)}">
                    <select id="ttd-pi-section" style="width:100%;padding:7px;margin-bottom:8px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">
                        <option value="dom" ${this._section === 'dom' ? 'selected' : ''}>DOM (full page HTML)</option>
                        <option value="element" ${this._section === 'element' ? 'selected' : ''}>Element inspector (pick from page)</option>
                        <option value="eventdebug" ${this._section === 'eventdebug' ? 'selected' : ''}>Event Debugger</option>
                        <option value="domwatch" ${this._section === 'domwatch' ? 'selected' : ''}>DOM Mutation Watcher</option>
                        <option value="storagewatch" ${this._section === 'storagewatch' ? 'selected' : ''}>Storage/Cookie Watcher</option>
                        <option value="snapshots" ${this._section === 'snapshots' ? 'selected' : ''}>Snapshots (compare)</option>
                        <option value="recorder" ${this._section === 'recorder' ? 'selected' : ''}>Investigation Recorder</option>
                        <option value="tracer" ${this._section === 'tracer' ? 'selected' : ''}>Value Tracer</option>
                        <option value="tokens" ${this._section === 'tokens' ? 'selected' : ''}>Token Inspector</option>
                        <option value="export" ${this._section === 'export' ? 'selected' : ''}>Export / AI Briefing</option>
                        <option value="globals" ${this._section === 'globals' ? 'selected' : ''}>window globals</option>
                        <option value="storage" ${this._section === 'storage' ? 'selected' : ''}>localStorage / sessionStorage</option>
                        <option value="cookies" ${this._section === 'cookies' ? 'selected' : ''}>Cookies</option>
                        <option value="indexeddb" ${this._section === 'indexeddb' ? 'selected' : ''}>IndexedDB</option>
                        <option value="network" ${this._section === 'network' ? 'selected' : ''}>Network / resource timing</option>
                        <option value="pageload" ${this._section === 'pageload' ? 'selected' : ''}>Page load timing</option>
                        <option value="traffic" ${this._section === 'traffic' ? 'selected' : ''}>Traffic history (all requests)</option>
                        <option value="websocket" ${this._section === 'websocket' ? 'selected' : ''}>WebSocket activity${Config.wsCaptureEnabled ? '' : ' (off)'}</option>
                        <option value="waterfall" ${this._section === 'waterfall' ? 'selected' : ''}>Network waterfall</option>
                        <option value="pageloadcompare" ${this._section === 'pageloadcompare' ? 'selected' : ''}>Compare traffic across page loads</option>
                        <option value="hosts" ${this._section === 'hosts' ? 'selected' : ''}>Hosts summary</option>
                        <option value="duplicates" ${this._section === 'duplicates' ? 'selected' : ''}>Duplicate requests</option>
                        <option value="endpoints" ${this._section === 'endpoints' ? 'selected' : ''}>Observed endpoints (auto-catalog)</option>
                        <option value="scripts" ${this._section === 'scripts' ? 'selected' : ''}>Script sources (inline + external)</option>
                        <option value="console" ${this._section === 'console' ? 'selected' : ''}>JS Console</option>
                    </select>
                    <div id="ttd-pi-content"></div>
                </div>
            `;

            document.getElementById('ttd-pi-section').onchange = (e) => {
                if (this._section === 'element' || this._section === 'eventdebug' || this._section === 'domwatch' || this._section === 'console') ElementPicker.stop(); 
                if (this._section === 'eventdebug') EventDebugger._onLogChanged = null; 
                if (this._section === 'domwatch') DomMutationWatcher._onLogChanged = null; 
                if (this._section === 'storagewatch') StorageWatcher._onLogChanged = null; 
                if (this._section === 'console') ConsoleAutomation._onLogChanged = null; 
                if (this._section === 'websocket' && this._wsSequenceRunning) { this._wsSequenceRunning.stop(); this._wsSequenceRunning = null; } 
                this._section = e.target.value;
                this.render();
            };
            this._renderSection();
        },

        _renderSection() {
            if (this._section === 'dom') return this._renderDom();
            if (this._section === 'element') return this._renderElement();
            if (this._section === 'eventdebug') return this._renderEventDebugger();
            if (this._section === 'domwatch') return this._renderDomWatcher();
            if (this._section === 'storagewatch') return this._renderStorageWatcher();
            if (this._section === 'snapshots') return this._renderSnapshots();
            if (this._section === 'recorder') return this._renderRecorder();
            if (this._section === 'tracer') return this._renderValueTracer();
            if (this._section === 'tokens') return this._renderTokens();
            if (this._section === 'export') return this._renderExport();
            if (this._section === 'globals') return this._renderGlobals();
            if (this._section === 'storage') return this._renderStorage();
            if (this._section === 'cookies') return this._renderCookies();
            if (this._section === 'indexeddb') return this._renderIndexedDB();
            if (this._section === 'network') return this._renderNetwork();
            if (this._section === 'pageload') return this._renderPageTiming();
            if (this._section === 'traffic') return this._renderTraffic();
            if (this._section === 'websocket') return this._renderWebSocket();
            if (this._section === 'waterfall') return this._renderWaterfall();
            if (this._section === 'pageloadcompare') return this._renderPageLoadCompare();
            if (this._section === 'hosts') return this._renderHostsSummary();
            if (this._section === 'duplicates') return this._renderDuplicates();
            if (this._section === 'endpoints') return this._renderEndpoints();
            if (this._section === 'scripts') return this._renderScripts();
            if (this._section === 'console') return this._renderConsole();
        },

        _renderDom() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            if (!this._domSnapshot) this._domSnapshot = PageInspector.getDomHtml();
            const html = this._domSnapshot;
            const preview = html.length > 20000
                ? html.slice(0, 20000) + `\n\n... (truncated in view - ${html.length.toLocaleString()} total characters, Copy grabs everything)`
                : html;

            area.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:11px;color:${t.cardDesc};">${html.length.toLocaleString()} characters</span>
                    <div>
                        <button id="ttd-pi-dom-refresh" style="${Helpers._secondaryBtnStyle(t)}">Refresh</button>
                        <button id="ttd-pi-dom-copy" style="${Helpers._secondaryBtnStyle(t)}">Copy all</button>
                    </div>
                </div>
                <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:320px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0;">${Helpers._escape(preview)}</pre>
            `;

            document.getElementById('ttd-pi-dom-refresh').onclick = () => { this._domSnapshot = PageInspector.getDomHtml(); this._renderDom(); };
            document.getElementById('ttd-pi-dom-copy').onclick = async (e) => {
                const ok = await copyToClipboard(this._domSnapshot);
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy all'; }, 1200);
            };
        },

        _renderEventDebugger() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Watch a specific element for a specific event, and log what happens - target description, any window globals you name (diffed before/after), and any network requests that land within ${(EventDebugger.NETWORK_WINDOW_MS / 1000).toFixed(1)}s afterward. This only ever logs; it never runs code of your own and never triggers anything back at the page - timing next to an event is a hint worth following, not proof of cause and effect, same caveat Investigation Recorder gives its own timeline.</div>

                <div style="${Helpers._cardStyle(t)}">
                    <div style="font-size:11px;font-weight:700;margin-bottom:6px;">Add a watch</div>
                    <button id="ttd-evtdbg-pick" style="${Helpers._secondaryBtnStyle(t)}width:100%;margin-bottom:6px;">${this._evtdbgPicked ? 'Change element' : 'Pick element'}</button>
                    ${this._evtdbgPicked ? `<div style="font-size:10px;color:${t.statusOk};margin-bottom:6px;word-break:break-all;">Picked: ${Helpers._escape(EventDebugger._describeElement(this._evtdbgPicked))}</div>` : ''}
                    <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Event type</div>
                    <select id="ttd-evtdbg-eventtype" style="width:100%;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">
                        <option value="click">click</option>
                        <option value="input">input</option>
                        <option value="change">change</option>
                        <option value="submit">submit</option>
                        <option value="mouseenter">mouseenter</option>
                        <option value="mouseleave">mouseleave</option>
                        <option value="focus">focus</option>
                        <option value="blur">blur</option>
                        <option value="__custom">custom event name...</option>
                    </select>
                    <input id="ttd-evtdbg-customtype" type="text" placeholder="custom event name" style="display:none;width:100%;box-sizing:border-box;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">
                    <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Window globals to watch (comma-separated, optional)</div>
                    <input id="ttd-evtdbg-globals" type="text" placeholder="e.g. gameState, currentUser.gold" style="width:100%;box-sizing:border-box;padding:6px;margin-bottom:8px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;font-family:monospace;">
                    <button id="ttd-evtdbg-add" style="${Helpers._primaryBtnStyle()}" ${this._evtdbgPicked ? '' : 'disabled'}>Add watch</button>
                </div>

                <div id="ttd-evtdbg-watches-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"></div>
                <div id="ttd-evtdbg-watches" style="margin-bottom:10px;"></div>

                <div id="ttd-evtdbg-log-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"></div>
                <div id="ttd-evtdbg-log" style="max-height:320px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;"></div>
            `;

            document.getElementById('ttd-evtdbg-pick').onclick = () => {
                UI.enterPickMode((el) => {
                    if (el) this._evtdbgPicked = el;

                });
            };
            const typeSelect = document.getElementById('ttd-evtdbg-eventtype');
            const customInput = document.getElementById('ttd-evtdbg-customtype');
            typeSelect.onchange = () => {
                customInput.style.display = typeSelect.value === '__custom' ? 'block' : 'none';
            };
            document.getElementById('ttd-evtdbg-add').onclick = () => {
                if (!this._evtdbgPicked) return;
                const eventType = typeSelect.value === '__custom' ? (customInput.value || '').trim() : typeSelect.value;
                if (!eventType) { customInput.style.borderColor = t.statusBad; return; }
                const globalsRaw = document.getElementById('ttd-evtdbg-globals').value || '';
                const globalNames = globalsRaw.split(',').map((s) => s.trim()).filter(Boolean);
                EventDebugger.addWatch(this._evtdbgPicked, eventType, globalNames);
                this._evtdbgPicked = null; 
                this._renderEventDebugger();
            };

            EventDebugger._onLogChanged = () => {
                if (this._section !== 'eventdebug') { EventDebugger._onLogChanged = null; return; }
                this._renderEvtdbgHeaders();
                this._renderEvtdbgWatchList();
                this._renderEvtdbgLog();
            };
            this._renderEvtdbgHeaders();
            this._renderEvtdbgWatchList();
            this._renderEvtdbgLog();
        },

        _renderEvtdbgHeaders() {
            const t = Theme.palette;
            const watchHeader = document.getElementById('ttd-evtdbg-watches-header');
            const logHeader = document.getElementById('ttd-evtdbg-log-header');
            if (!watchHeader || !logHeader) return;
            const watches = EventDebugger.all();
            const log = EventDebugger.log();

            watchHeader.innerHTML = `
                <span style="font-size:11px;font-weight:700;">Active watches (${watches.length})</span>
                ${watches.length ? `<button id="ttd-evtdbg-removeall" style="${Helpers._secondaryBtnStyle(t)}">Remove all</button>` : ''}
            `;
            logHeader.innerHTML = `
                <span style="font-size:11px;font-weight:700;">Log (${log.length})</span>
                ${log.length ? `<button id="ttd-evtdbg-clearlog" style="${Helpers._secondaryBtnStyle(t)}">Clear log</button>` : ''}
            `;
            document.getElementById('ttd-evtdbg-removeall')?.addEventListener('click', () => {
                if (!confirm('Remove all active watches? Logged entries so far are kept - use "Clear log" separately if you want those gone too.')) return;
                EventDebugger.removeAllWatches();
                this._renderEvtdbgHeaders();
                this._renderEvtdbgWatchList();
            });
            document.getElementById('ttd-evtdbg-clearlog')?.addEventListener('click', () => {
                EventDebugger.clearLog();
                this._renderEvtdbgHeaders();
                this._renderEvtdbgLog();
            });
        },

        _renderEvtdbgWatchList() {
            const t = Theme.palette;
            const listEl = document.getElementById('ttd-evtdbg-watches');
            if (!listEl) return;
            const watches = EventDebugger.all();
            if (!watches.length) {
                listEl.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">No active watches.</div>`;
                return;
            }
            listEl.innerHTML = watches.map((w) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:4px;font-size:11px;">
                    <div style="word-break:break-all;">
                        <span style="font-weight:700;">${Helpers._escape(w.eventType)}</span> on ${Helpers._escape(w.describe)}
                        <br><span style="font-size:10px;color:${t.cardDesc};">${w.globalNames.length ? 'watching: ' + w.globalNames.map((n) => Helpers._escape(n)).join(', ') : 'no globals watched'} - fired ${w.firedCount}x</span>
                    </div>
                    <button data-remove-watch="${w.id}" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;margin-left:6px;">Remove</button>
                </div>
            `).join('');
            listEl.querySelectorAll('[data-remove-watch]').forEach((btn) => {
                btn.onclick = () => {
                    EventDebugger.removeWatch(parseInt(btn.getAttribute('data-remove-watch'), 10));
                    this._renderEvtdbgHeaders(); 
                    this._renderEvtdbgWatchList();
                };
            });
        },

        _renderEvtdbgLog() {
            const t = Theme.palette;
            const listEl = document.getElementById('ttd-evtdbg-log');
            if (!listEl) return;
            const log = EventDebugger.log();
            if (!log.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">Nothing logged yet.</div>`;
                return;
            }
            listEl.innerHTML = log.slice().reverse().map((entry) => {
                const diffLines = entry.diffs.length
                    ? entry.diffs.map((d) => `<div style="font-size:10px;">${Helpers._escape(d.key)}: ${Helpers._escape(d.from)} -&gt; ${Helpers._escape(d.to)}</div>`).join('')
                    : `<div style="font-size:10px;color:${t.cardDesc};">no watched globals changed</div>`;
                const networkLines = entry.networkHits === null
                    ? `<div style="font-size:10px;color:${t.cardDesc};">checking for related network activity...</div>`
                    : entry.networkHits.length
                        ? entry.networkHits.map((h, i) => `<div style="font-size:10px;color:${t.statusOk};">${Helpers._escape(h.method)} ${Helpers._escape(Helpers._shortenUrl(h.url))} (${h.status}) <span data-jump-traffic="${Helpers._escape(h.url)}" style="text-decoration:underline;cursor:pointer;color:${t.linkColor || t.statusOk};">view in Traffic</span></div>`).join('')
                        : `<div style="font-size:10px;color:${t.cardDesc};">no network activity in the following ${(EventDebugger.NETWORK_WINDOW_MS / 1000).toFixed(1)}s</div>`;
                return `
                    <div style="padding:6px 8px;border-bottom:1px solid ${t.rowBorder};font-size:11px;">
                        <div><span style="font-weight:700;">${Helpers._escape(entry.eventType)}</span> on ${Helpers._escape(entry.targetDescribe)} <span style="color:${t.cardDesc};font-size:10px;">${Helpers._timeAgo(entry.timestamp)}</span></div>
                        ${diffLines}
                        ${networkLines}
                    </div>
                `;
            }).join('');
            listEl.querySelectorAll('[data-jump-traffic]').forEach((elLink) => {
                elLink.onclick = () => this._jumpToTraffic(elLink.getAttribute('data-jump-traffic'));
            });
        },

        _renderDomWatcher() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Watches an element (and, by default, its children) for DOM changes the game makes on its own - not tied to any click or event, so this catches things Event Debugger can't, like a value that updates on a timer or in response to something arriving over WebSocket. Purely observational: this reads the DOM, it never writes to it.</div>

                <div style="${Helpers._cardStyle(t)}">
                    <div style="font-size:11px;font-weight:700;margin-bottom:6px;">Add a watch</div>
                    <button id="ttd-domwatch-pick" style="${Helpers._secondaryBtnStyle(t)}width:100%;margin-bottom:6px;">${this._domwatchPicked ? 'Change element' : 'Pick element'}</button>
                    ${this._domwatchPicked ? `<div style="font-size:10px;color:${t.statusOk};margin-bottom:6px;word-break:break-all;">Picked: ${Helpers._escape(EventDebugger._describeElement(this._domwatchPicked))}</div>` : ''}
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px;"><input type="checkbox" id="ttd-domwatch-subtree" checked> Include children (subtree)</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px;"><input type="checkbox" id="ttd-domwatch-childlist" checked> Watch added/removed nodes</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px;"><input type="checkbox" id="ttd-domwatch-attributes" checked> Watch attribute changes</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:8px;"><input type="checkbox" id="ttd-domwatch-chardata" checked> Watch text content changes</label>
                    <button id="ttd-domwatch-add" style="${Helpers._primaryBtnStyle()}" ${this._domwatchPicked ? '' : 'disabled'}>Add watch</button>
                </div>

                <div id="ttd-domwatch-watches-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"></div>
                <div id="ttd-domwatch-watches" style="margin-bottom:10px;"></div>

                <div id="ttd-domwatch-log-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"></div>
                <div id="ttd-domwatch-log" style="max-height:320px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;"></div>
            `;

            document.getElementById('ttd-domwatch-pick').onclick = () => {
                UI.enterPickMode((el) => {
                    if (el) this._domwatchPicked = el;

                });
            };
            document.getElementById('ttd-domwatch-add').onclick = () => {
                if (!this._domwatchPicked) return;
                DomMutationWatcher.addWatch(this._domwatchPicked, {
                    subtree: document.getElementById('ttd-domwatch-subtree').checked,
                    childList: document.getElementById('ttd-domwatch-childlist').checked,
                    attributes: document.getElementById('ttd-domwatch-attributes').checked,
                    characterData: document.getElementById('ttd-domwatch-chardata').checked
                });
                this._domwatchPicked = null; 
                this._renderDomWatcher();
            };

            DomMutationWatcher._onLogChanged = () => {
                if (this._section !== 'domwatch') { DomMutationWatcher._onLogChanged = null; return; }
                this._renderDomWatchHeaders();
                this._renderDomWatchList();
                this._renderDomWatchLog();
            };
            this._renderDomWatchHeaders();
            this._renderDomWatchList();
            this._renderDomWatchLog();
        },

        _renderDomWatchHeaders() {
            const t = Theme.palette;
            const watchHeader = document.getElementById('ttd-domwatch-watches-header');
            const logHeader = document.getElementById('ttd-domwatch-log-header');
            if (!watchHeader || !logHeader) return;
            const watches = DomMutationWatcher.all();
            const log = DomMutationWatcher.log();

            watchHeader.innerHTML = `
                <span style="font-size:11px;font-weight:700;">Active watches (${watches.length})</span>
                ${watches.length ? `<button id="ttd-domwatch-removeall" style="${Helpers._secondaryBtnStyle(t)}">Remove all</button>` : ''}
            `;
            logHeader.innerHTML = `
                <span style="font-size:11px;font-weight:700;">Log (${log.length})</span>
                ${log.length ? `<button id="ttd-domwatch-clearlog" style="${Helpers._secondaryBtnStyle(t)}">Clear log</button>` : ''}
            `;
            document.getElementById('ttd-domwatch-removeall')?.addEventListener('click', () => {
                if (!confirm('Remove all active watches? Logged entries so far are kept - use "Clear log" separately if you want those gone too.')) return;
                DomMutationWatcher.removeAllWatches();
                this._renderDomWatchHeaders();
                this._renderDomWatchList();
            });
            document.getElementById('ttd-domwatch-clearlog')?.addEventListener('click', () => {
                DomMutationWatcher.clearLog();
                this._renderDomWatchHeaders();
                this._renderDomWatchLog();
            });
        },

        _renderDomWatchList() {
            const t = Theme.palette;
            const listEl = document.getElementById('ttd-domwatch-watches');
            if (!listEl) return;
            const watches = DomMutationWatcher.all();
            if (!watches.length) {
                listEl.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">No active watches.</div>`;
                return;
            }
            listEl.innerHTML = watches.map((w) => {
                const opts = [];
                if (w.options.childList) opts.push('nodes');
                if (w.options.attributes) opts.push('attrs');
                if (w.options.characterData) opts.push('text');
                if (w.options.subtree) opts.push('subtree');
                return `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:4px;font-size:11px;">
                        <div style="word-break:break-all;">
                            ${Helpers._escape(w.describe)}
                            <br><span style="font-size:10px;color:${t.cardDesc};">watching: ${opts.join(', ') || 'nothing selected'} - ${w.mutationCount} raw mutation${w.mutationCount === 1 ? '' : 's'} seen</span>
                        </div>
                        <button data-remove-domwatch="${w.id}" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;margin-left:6px;">Remove</button>
                    </div>
                `;
            }).join('');
            listEl.querySelectorAll('[data-remove-domwatch]').forEach((btn) => {
                btn.onclick = () => {
                    DomMutationWatcher.removeWatch(parseInt(btn.getAttribute('data-remove-domwatch'), 10));
                    this._renderDomWatchHeaders(); 
                    this._renderDomWatchList();
                };
            });
        },

        _renderDomWatchLog() {
            const t = Theme.palette;
            const listEl = document.getElementById('ttd-domwatch-log');
            if (!listEl) return;
            const log = DomMutationWatcher.log();
            if (!log.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">Nothing logged yet.</div>`;
                return;
            }
            listEl.innerHTML = log.slice().reverse().map((entry) => {
                const parts = [];
                if (entry.summary.childList) parts.push(`${entry.summary.childList} node change${entry.summary.childList === 1 ? '' : 's'}`);
                if (entry.summary.attributes) parts.push(`${entry.summary.attributes} attribute change${entry.summary.attributes === 1 ? '' : 's'}${entry.attributeNames.length ? ` (${entry.attributeNames.map((n) => Helpers._escape(n)).join(', ')})` : ''}`);
                if (entry.summary.characterData) parts.push(`${entry.summary.characterData} text change${entry.summary.characterData === 1 ? '' : 's'}`);
                return `
                    <div style="padding:6px 8px;border-bottom:1px solid ${t.rowBorder};font-size:11px;">
                        <div>${Helpers._escape(entry.watchDescribe)} <span style="color:${t.cardDesc};font-size:10px;">${Helpers._timeAgo(entry.timestamp)}</span></div>
                        <div style="font-size:10px;color:${t.cardDesc};">${parts.join(' - ') || `${entry.recordCount} mutation(s)`}</div>
                    </div>
                `;
            }).join('');
        },

        _renderStorageWatcher() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Watches a localStorage/sessionStorage key or a cookie for changes. Unlike DOM Mutation Watcher, there's no native browser event for this - same-page storage writes and cookie changes don't fire anything observable, so this checks every ${(StorageWatcher.POLL_INTERVAL_MS / 1000).toFixed(0)}s and logs when the value differs from last check. Purely observational: this reads storage, it never writes to it.</div>

                <div style="${Helpers._cardStyle(t)}">
                    <div style="font-size:11px;font-weight:700;margin-bottom:6px;">Add a watch</div>
                    <select id="ttd-storagewatch-kind" style="width:100%;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">
                        <option value="local">localStorage key</option>
                        <option value="session">sessionStorage key</option>
                        <option value="cookie">cookie name</option>
                    </select>
                    <div style="display:flex;gap:6px;margin-bottom:8px;">
                        <select id="ttd-storagewatch-key" style="flex:1;min-width:0;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;"></select>
                        <button id="ttd-storagewatch-refresh-keys" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;flex:0 0 auto;" title="Re-scan for keys">Refresh</button>
                    </div>
                    <button id="ttd-storagewatch-add" style="${Helpers._primaryBtnStyle()}" disabled>Add watch</button>
                </div>

                <div id="ttd-storagewatch-watches-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"></div>
                <div id="ttd-storagewatch-watches" style="margin-bottom:10px;"></div>

                <div id="ttd-storagewatch-log-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"></div>
                <div id="ttd-storagewatch-log" style="max-height:320px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;"></div>
            `;

            const kindSelect = document.getElementById('ttd-storagewatch-kind');
            const keySelect = document.getElementById('ttd-storagewatch-key');
            const addBtn = document.getElementById('ttd-storagewatch-add');

            const refreshKeyOptions = () => {
                const keys = StorageWatcher.listKeys(kindSelect.value);
                keySelect.innerHTML = keys.length
                    ? keys.map((k) => `<option value="${Helpers._escape(k)}">${Helpers._escape(k)}</option>`).join('')
                    : `<option value="" disabled selected>(nothing found)</option>`;
                addBtn.disabled = !keys.length;
            };
            refreshKeyOptions();

            kindSelect.onchange = refreshKeyOptions;
            document.getElementById('ttd-storagewatch-refresh-keys').onclick = refreshKeyOptions;

            addBtn.onclick = () => {
                const kind = kindSelect.value;
                const key = keySelect.value;
                if (!key) return;
                StorageWatcher.addWatch(kind, key);
                refreshKeyOptions(); 
                this._renderStorageWatchHeaders();
                this._renderStorageWatchList();
            };

            StorageWatcher._onLogChanged = () => {
                if (this._section !== 'storagewatch') { StorageWatcher._onLogChanged = null; return; }
                this._renderStorageWatchHeaders();
                this._renderStorageWatchList();
                this._renderStorageWatchLog();
            };
            this._renderStorageWatchHeaders();
            this._renderStorageWatchList();
            this._renderStorageWatchLog();
        },

        _renderStorageWatchHeaders() {
            const t = Theme.palette;
            const watchHeader = document.getElementById('ttd-storagewatch-watches-header');
            const logHeader = document.getElementById('ttd-storagewatch-log-header');
            if (!watchHeader || !logHeader) return;
            const watches = StorageWatcher.all();
            const log = StorageWatcher.log();

            watchHeader.innerHTML = `
                <span style="font-size:11px;font-weight:700;">Active watches (${watches.length})</span>
                ${watches.length ? `<button id="ttd-storagewatch-removeall" style="${Helpers._secondaryBtnStyle(t)}">Remove all</button>` : ''}
            `;
            logHeader.innerHTML = `
                <span style="font-size:11px;font-weight:700;">Log (${log.length})</span>
                ${log.length ? `<button id="ttd-storagewatch-clearlog" style="${Helpers._secondaryBtnStyle(t)}">Clear log</button>` : ''}
            `;
            document.getElementById('ttd-storagewatch-removeall')?.addEventListener('click', () => {
                if (!confirm('Remove all active watches? Logged entries so far are kept - use "Clear log" separately if you want those gone too.')) return;
                StorageWatcher.removeAllWatches();
                this._renderStorageWatchHeaders();
                this._renderStorageWatchList();
            });
            document.getElementById('ttd-storagewatch-clearlog')?.addEventListener('click', () => {
                StorageWatcher.clearLog();
                this._renderStorageWatchHeaders();
                this._renderStorageWatchLog();
            });
        },

        _renderStorageWatchList() {
            const t = Theme.palette;
            const listEl = document.getElementById('ttd-storagewatch-watches');
            if (!listEl) return;
            const watches = StorageWatcher.all();
            const kindLabel = { local: 'localStorage', session: 'sessionStorage', cookie: 'cookie' };
            if (!watches.length) {
                listEl.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">No active watches.</div>`;
                return;
            }
            listEl.innerHTML = watches.map((w) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:4px;font-size:11px;">
                    <div style="word-break:break-all;">
                        <span style="font-weight:700;">${Helpers._escape(kindLabel[w.kind])}</span>: ${Helpers._escape(w.key)}
                    </div>
                    <button data-remove-storagewatch="${w.id}" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;margin-left:6px;">Remove</button>
                </div>
            `).join('');
            listEl.querySelectorAll('[data-remove-storagewatch]').forEach((btn) => {
                btn.onclick = () => {
                    StorageWatcher.removeWatch(parseInt(btn.getAttribute('data-remove-storagewatch'), 10));
                    this._renderStorageWatchHeaders();
                    this._renderStorageWatchList();
                };
            });
        },

        _renderStorageWatchLog() {
            const t = Theme.palette;
            const listEl = document.getElementById('ttd-storagewatch-log');
            if (!listEl) return;
            const log = StorageWatcher.log();
            const kindLabel = { local: 'localStorage', session: 'sessionStorage', cookie: 'cookie' };
            if (!log.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">Nothing logged yet.</div>`;
                return;
            }
            listEl.innerHTML = log.slice().reverse().map((entry) => `
                <div style="padding:6px 8px;border-bottom:1px solid ${t.rowBorder};font-size:11px;">
                    <div><span style="font-weight:700;">${Helpers._escape(kindLabel[entry.kind])}</span>: ${Helpers._escape(entry.key)} <span style="color:${t.cardDesc};font-size:10px;">${Helpers._timeAgo(entry.timestamp)}</span></div>
                    <div style="font-size:10px;color:${t.cardDesc};word-break:break-all;">${Helpers._escape(entry.from)} -&gt; ${Helpers._escape(entry.to)}</div>
                </div>
            `).join('');
        },

        _snapshotSelectedA: null,
        _snapshotSelectedB: null,

        _renderSnapshots() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            const snaps = SnapshotManager.all();

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Captures localStorage, sessionStorage, cookies, and window globals as they stand right now, so you can diff two points in time against each other later - before/after a reload, before/after an action. In-memory only (cleared on page reload), capped at ${SnapshotManager.MAX_SNAPSHOTS} - for anything you want to keep longer, use Export/AI Briefing's DOM snapshot category instead.</div>

                <div style="display:flex;gap:6px;margin-bottom:10px;">
                    <input id="ttd-snapshot-label" type="text" placeholder="optional label, e.g. 'before reload'" style="flex:1;min-width:0;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">
                    <button id="ttd-snapshot-capture" style="padding:8px 12px;background:linear-gradient(135deg, #3f8296, #1e4550);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;flex:0 0 auto;">Capture now</button>
                </div>

                <div style="font-size:11px;font-weight:700;margin-bottom:4px;">Saved (${snaps.length})</div>
                <div id="ttd-snapshot-list" style="margin-bottom:10px;"></div>

                <div id="ttd-snapshot-compare" style="${snaps.length >= 2 ? '' : 'display:none;'}"></div>
            `;

            document.getElementById('ttd-snapshot-capture').onclick = () => {
                const labelInput = document.getElementById('ttd-snapshot-label');
                SnapshotManager.capture(labelInput.value);
                this._renderSnapshots();
            };

            this._renderSnapshotList();
            if (snaps.length >= 2) this._renderSnapshotCompare();
        },

        _renderSnapshotList() {
            const t = Theme.palette;
            const listEl = document.getElementById('ttd-snapshot-list');
            if (!listEl) return;
            const snaps = SnapshotManager.all();
            if (!snaps.length) {
                listEl.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">No snapshots yet.</div>`;
                return;
            }
            listEl.innerHTML = snaps.map((s) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:4px;font-size:11px;">
                    <div style="word-break:break-all;">
                        <span style="font-weight:700;">${Helpers._escape(s.label)}</span>
                        <br><span style="font-size:10px;color:${t.cardDesc};">${Helpers._timeAgo(s.timestamp)} - ${Helpers._escape(Helpers._shortenUrl(s.url))}</span>
                    </div>
                    <button data-remove-snapshot="${s.id}" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;margin-left:6px;">Remove</button>
                </div>
            `).join('');
            listEl.querySelectorAll('[data-remove-snapshot]').forEach((btn) => {
                btn.onclick = () => {
                    SnapshotManager.remove(parseInt(btn.getAttribute('data-remove-snapshot'), 10));
                    this._renderSnapshots(); 
                };
            });
        },

        _renderSnapshotCompare() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-snapshot-compare');
            if (!el) return;
            const snaps = SnapshotManager.all();

            if (!this._snapshotSelectedA || !snaps.some((s) => s.id === this._snapshotSelectedA)) this._snapshotSelectedA = snaps[1].id;
            if (!this._snapshotSelectedB || !snaps.some((s) => s.id === this._snapshotSelectedB)) this._snapshotSelectedB = snaps[0].id;

            const optionsHtml = (selected) => snaps.map((s) => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${Helpers._escape(s.label)} (${Helpers._timeAgo(s.timestamp)})</option>`).join('');
            el.innerHTML = `
                <div style="font-size:11px;font-weight:700;margin-bottom:6px;">Compare</div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">From</div>
                <select id="ttd-snapshot-select-a" style="width:100%;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">${optionsHtml(this._snapshotSelectedA)}</select>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">To</div>
                <select id="ttd-snapshot-select-b" style="width:100%;padding:6px;margin-bottom:8px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">${optionsHtml(this._snapshotSelectedB)}</select>
                <div id="ttd-snapshot-diff"></div>
            `;
            document.getElementById('ttd-snapshot-select-a').onchange = (e) => { this._snapshotSelectedA = parseInt(e.target.value, 10); this._renderSnapshotDiff(); };
            document.getElementById('ttd-snapshot-select-b').onchange = (e) => { this._snapshotSelectedB = parseInt(e.target.value, 10); this._renderSnapshotDiff(); };
            this._renderSnapshotDiff();
        },

        _renderSnapshotDiff() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-snapshot-diff');
            if (!el) return;

            if (this._snapshotSelectedA === this._snapshotSelectedB) {
                el.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">Pick two different snapshots to compare.</div>`;
                return;
            }
            const result = SnapshotManager.diff(this._snapshotSelectedA, this._snapshotSelectedB);
            if (!result) { el.innerHTML = ''; return; }

            const typeColors = { added: t.statusOk, removed: t.statusBad, changed: t.statusWarn };
            const typeLabels = { added: 'added', removed: 'removed', changed: 'changed' };
            const changeLines = result.changes.length
                ? result.changes.map((c) => {
                    if (c.type === 'truncated') return `<div style="font-size:10px;color:${t.cardDesc};padding:2px 0;">${Helpers._escape(c.note)}</div>`;
                    const valPreview = (v) => v === undefined ? '(none)' : (typeof v === 'string' && v.length > 100 ? v.slice(0, 100) + '...' : JSON.stringify(v));
                    return `<div style="font-size:10px;padding:3px 0;border-bottom:1px solid ${t.rowBorder};word-break:break-all;"><span style="color:${typeColors[c.type]};font-weight:700;">${typeLabels[c.type]}</span> ${Helpers._escape(c.path)}${c.type === 'changed' ? `: ${Helpers._escape(valPreview(c.oldValue))} -&gt; ${Helpers._escape(valPreview(c.newValue))}` : c.type === 'added' ? `: ${Helpers._escape(valPreview(c.newValue))}` : `: ${Helpers._escape(valPreview(c.oldValue))}`}</div>`;
                }).join('')
                : `<div style="font-size:11px;color:${t.statusOk};">No differences.</div>`;

            el.innerHTML = `<div style="font-size:11px;font-weight:700;margin-bottom:4px;">${result.changes.filter((c) => c.type !== 'truncated').length} change(s)</div><div style="max-height:280px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;padding:6px;">${changeLines}</div>`;
        },

        _renderElement() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            const info = this._pickedElement ? PageInspector.inspectElement(this._pickedElement) : null;

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Tap "Pick element" - this panel shrinks into a small draggable box you can move out of the way, then tap anywhere on the page to inspect that element. "Associated events" is limited to inline on*="..." attributes - addEventListener-registered handlers aren't discoverable from page script, so most modern client-rendered elements will show none even if they do have click handlers.</div>
                <div style="display:flex;gap:6px;">
                    <button id="ttd-pi-element-pick" style="${Helpers._secondaryBtnStyle(t)}flex:1;">${info ? 'Pick a different element' : 'Pick element'}</button>
                    ${info ? `<button id="ttd-pi-element-edit-toggle" style="${Helpers._secondaryBtnStyle(t)}">${this._editingElement ? 'Stop editing' : 'Edit element'}</button>` : ''}
                </div>
                <div id="ttd-pi-element-detail" style="margin-top:8px;"></div>
            `;

            document.getElementById('ttd-pi-element-pick').onclick = () => {
                UI.enterPickMode((el) => {
                    if (el) { this._pickedElement = el; this._editingElement = false; }
                });
            };
            const editToggle = document.getElementById('ttd-pi-element-edit-toggle');
            if (editToggle) editToggle.onclick = () => { this._editingElement = !this._editingElement; this._renderElement(); };

            if (info) this._renderElementDetail(info, t);
        },

        _renderElementEditor(pickedEl, t) {
            const attrText = Array.from(pickedEl.attributes).map((a) => `${a.name}="${a.value}"`).join('\n');
            const styleText = pickedEl.getAttribute('style') || '';
            const textContent = pickedEl.textContent || '';

            return `
                <div style="border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;margin-bottom:8px;">
                    <div style="font-size:11px;font-weight:700;margin-bottom:2px;">Edit element</div>
                    <div style="font-size:10px;color:${t.statusBad};margin-bottom:8px;">Live edits to the actual page DOM - can break rendering, event listeners, or whatever page state the site's own JS expects to find. Nothing here persists past a reload, exactly as if done through DevTools.</div>

                    <div style="font-size:10px;font-weight:700;margin-bottom:2px;">Attributes (one per line: name="value", or just name for a boolean attribute)</div>
                    <textarea id="ttd-pi-element-edit-attrs" style="width:100%;box-sizing:border-box;height:80px;padding:6px;margin-bottom:4px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:10px;font-family:monospace;">${Helpers._escape(attrText)}</textarea>
                    <button id="ttd-pi-element-save-attrs" style="${Helpers._secondaryBtnStyle(t)}margin-bottom:8px;">Save attributes</button>

                    <div style="font-size:10px;font-weight:700;margin-bottom:2px;">Inline style (CSS syntax, e.g. color: red;)</div>
                    <textarea id="ttd-pi-element-edit-style" style="width:100%;box-sizing:border-box;height:60px;padding:6px;margin-bottom:4px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:10px;font-family:monospace;">${Helpers._escape(styleText)}</textarea>
                    <button id="ttd-pi-element-save-style" style="${Helpers._secondaryBtnStyle(t)}margin-bottom:8px;">Save style</button>

                    <div style="font-size:10px;font-weight:700;margin-bottom:2px;">Text content</div>
                    <div style="font-size:9px;color:${t.cardDesc};margin-bottom:2px;">Replaces ALL of this element's content, including any child elements, with plain text. Don't use this if there are child elements worth keeping.</div>
                    <textarea id="ttd-pi-element-edit-text" style="width:100%;box-sizing:border-box;height:60px;padding:6px;margin-bottom:4px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:10px;font-family:monospace;">${Helpers._escape(textContent)}</textarea>
                    <button id="ttd-pi-element-save-text" style="${Helpers._secondaryBtnStyle(t)}margin-bottom:8px;">Save text</button>

                    <button id="ttd-pi-element-remove" style="${Helpers._secondaryBtnStyle(t)}">Remove element</button>
                    <div id="ttd-pi-element-edit-status" style="font-size:10px;margin-top:4px;"></div>
                </div>
            `;
        },

        _wireElementEditor(pickedEl, t) {
            const statusEl = () => document.getElementById('ttd-pi-element-edit-status');
            const report = (result) => {
                const s = statusEl();
                if (!s) return;
                s.textContent = result.ok ? 'Saved.' : result.error;
                s.style.color = result.ok ? t.statusOk : t.statusBad;
            };

            document.getElementById('ttd-pi-element-save-attrs').onclick = () => {
                const text = document.getElementById('ttd-pi-element-edit-attrs').value;
                report(PageInspector.setElementAttributesFromText(pickedEl, text));
                this._renderElement();
            };
            document.getElementById('ttd-pi-element-save-style').onclick = () => {
                const text = document.getElementById('ttd-pi-element-edit-style').value;
                report(PageInspector.setElementInlineStyle(pickedEl, text));
                this._renderElement();
            };
            document.getElementById('ttd-pi-element-save-text').onclick = () => {
                const text = document.getElementById('ttd-pi-element-edit-text').value;
                report(PageInspector.setElementText(pickedEl, text));
                this._renderElement();
            };
            document.getElementById('ttd-pi-element-remove').onclick = () => {
                if (!confirm('Remove this element from the page? This changes the live DOM immediately and can\'t be undone short of a reload.')) return;
                const result = PageInspector.removeElement(pickedEl);
                if (result.ok) {
                    this._pickedElement = null;
                    this._editingElement = false;
                    this._renderElement();
                }
            };
        },

        _renderElementDetail(info, t) {
            const el = document.getElementById('ttd-pi-element-detail');
            if (!el) return;

            const attrLines = Object.keys(info.attributes).length
                ? Object.keys(info.attributes).map((k) => `${k}="${info.attributes[k]}"`).join('\n')
                : '(none)';
            const datasetLines = Object.keys(info.dataset).length
                ? Object.keys(info.dataset).map((k) => `data-${k}: ${info.dataset[k]}`).join('\n')
                : '(none)';

            const cssLines = Object.keys(info.cssGroups).map((group) => {
                const props = info.cssGroups[group];
                const propLines = Object.keys(props).map((k) => `  ${k}: ${props[k]}`).join('\n');
                return `${group}:\n${propLines}`;
            }).join('\n\n');
            const eventLines = info.inlineEventAttributes.length
                ? info.inlineEventAttributes.join(', ')
                : 'none found (see the note above about addEventListener not being discoverable)';

            const ancestorLines = info.ancestorContext.length
                ? info.ancestorContext.map((a) => `${a.breadcrumb}${a.looksInteractive ? ` [looks interactive: ${a.reasons.join(', ')}]` : ''}`).join('\n')
                : '(none - already at document root)';

            const summary = `<${info.tag}>${info.id ? ' #' + info.id : ''}${info.classes.length ? ' .' + info.classes.join('.') : ''}`;
            const fullText = [
                summary,
                `Size: ${info.rect.width}x${info.rect.height} at (${info.rect.left}, ${info.rect.top})`,
                `Children: ${info.childCount}`,
                info.ownText ? `Own text: "${info.ownText}"` : null,
                '',
                'Candidate selectors:',
                info.selectors.join('\n'),
                '',
                'Attributes:',
                attrLines,
                '',
                'Dataset:',
                datasetLines,
                '',
                'Computed CSS (grouped):',
                cssLines,
                '',
                `Ancestors, closest first, up to 10 ("looks interactive" is a heuristic - native tag, role, tabindex, inline handler, or cursor:pointer - not proof of an attached listener):`,
                ancestorLines,
                '',
                `Children (${info.childCount}${info.childCount > 30 ? ', first 30 shown' : ''}):`,
                info.children.join('\n') || '(none)',
                '',
                `Inline event attributes: ${eventLines}`
            ].filter((line) => line !== null).join('\n');

            const ancestorChips = info.ancestorContext.length
                ? info.ancestorContext.map((a) => `
                    <div style="display:flex;align-items:center;gap:6px;padding:3px 6px;font-size:10px;border-left:3px solid ${a.looksInteractive ? t.statusOk : t.rowBorder};margin-bottom:2px;word-break:break-all;">
                        <span>${Helpers._escape(a.breadcrumb)}</span>
                        ${a.looksInteractive ? `<span style="color:${t.statusOk};font-size:9px;white-space:nowrap;">looks interactive</span>` : ''}
                    </div>
                `).join('')
                : `<div style="font-size:10px;color:${t.cardDesc};">(none - already at document root)</div>`;

            el.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-size:12px;font-weight:700;">${Helpers._escape(summary)}</span>
                    <button id="ttd-pi-element-copy" style="${Helpers._secondaryBtnStyle(t)}">Copy all</button>
                </div>
                ${this._editingElement ? this._renderElementEditor(this._pickedElement, t) : ''}
                <div style="font-size:10px;font-weight:700;margin-bottom:4px;">Ancestors (possible event delegation targets)</div>
                <div style="max-height:140px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;padding:4px 2px;margin-bottom:8px;">${ancestorChips}</div>
                <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:320px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0;">${Helpers._escape(fullText)}</pre>
            `;
            document.getElementById('ttd-pi-element-copy').onclick = async (e) => {
                const ok = await copyToClipboard(fullText);
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy all'; }, 1200);
            };
            if (this._editingElement) this._wireElementEditor(this._pickedElement, t);
        },

        _renderRecorder() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            const recording = InvestigationRecorder.isRecording();
            const timeline = InvestigationRecorder.timeline();

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Records clicks, form input/change/submit (never the typed value - only that input happened, to avoid capturing passwords, API keys, chat, or trade amounts), DOM changes (additions/removals only), network calls, page console output, and uncaught JS errors into one chronological timeline while active. This is timing-based ordering, not verified causality - close together in time is a hint, not proof, that one thing caused the next.</div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Recording now continues across page reloads automatically - Stop is what actually ends a session. Network activity during a reload gap is backfilled from the persisted traffic cache where possible, at lower fidelity (last-10-per-endpoint, truncated bodies) than live capture.</div>
                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <button id="ttd-pi-rec-toggle" style="flex:1;padding:8px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;border:none;${recording ? `background:${t.statusBad};color:#fff;` : 'background:linear-gradient(135deg, #3f8296, #1e4550);color:#fff;'}">${recording ? 'Stop recording' : 'Start recording'}</button>
                    <button id="ttd-pi-rec-clear" style="${Helpers._secondaryBtnStyle(t)}">Clear</button>
                    <button id="ttd-pi-rec-copy" style="${Helpers._secondaryBtnStyle(t)}">Copy</button>
                </div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">${recording ? '\u{1F534} Recording' : 'Stopped'} - ${timeline.length} of up to ${InvestigationRecorder.MAX_ENTRIES} entries</div>
                <div id="ttd-pi-rec-list" style="max-height:220px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:8px;"></div>
                <div id="ttd-pi-rec-detail"></div>
            `;

            document.getElementById('ttd-pi-rec-toggle').onclick = () => {
                if (recording) InvestigationRecorder.stop(); else InvestigationRecorder.start();
                this._selectedTimelineEntry = null;
                this._renderRecorder();
            };
            document.getElementById('ttd-pi-rec-clear').onclick = () => {
                InvestigationRecorder.clear();
                this._selectedTimelineEntry = null;
                this._renderRecorder();
            };
            document.getElementById('ttd-pi-rec-copy').onclick = async (e) => {
                const text = InvestigationRecorder.timeline().map((en) => this._formatTimelineLine(en)).join('\n');
                const ok = await copyToClipboard(text || '(nothing recorded)');
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy'; }, 1200);
            };

            const listEl = document.getElementById('ttd-pi-rec-list');
            if (!timeline.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">${recording ? 'Recording - interact with the page normally and this fills in.' : 'Nothing recorded yet - tap Start recording, then use the page.'}</div>`;
                return;
            }
            timeline.slice(-300).forEach((entry) => {
                const row = document.createElement('div');
                const isSelected = entry === this._selectedTimelineEntry;
                const clickable = entry.kind === 'network' && !entry.backfilled;
                row.style.cssText = `padding:5px 8px;font-size:11px;border-bottom:1px solid ${t.rowBorder};word-break:break-all;background:${isSelected ? t.secondaryBtnBg : 'transparent'};${clickable ? 'cursor:pointer;' : ''}`;
                row.innerHTML = this._renderTimelineRowHtml(entry, t);
                if (clickable) row.onclick = () => { this._selectedTimelineEntry = entry; this._renderRecorder(); };
                listEl.appendChild(row);
            });

            if (this._selectedTimelineEntry && this._selectedTimelineEntry.kind === 'network') {
                this._renderTimelineNetworkDetail(this._selectedTimelineEntry, t);
            }
        },

        _timelineKindLabel(entry) {
            if (entry.kind === 'click') return `CLICK ${entry.target}`;
            if (entry.kind === 'input') return `INPUT${entry.inputType ? ` (${entry.inputType})` : ''} ${entry.target}`;
            if (entry.kind === 'change') return `CHANGE ${entry.target}${entry.value !== null && entry.value !== undefined ? ' = ' + entry.value : ''}`;
            if (entry.kind === 'submit') return `SUBMIT ${entry.target}`;
            if (entry.kind === 'mutation') return `DOM changed (+${entry.added} -${entry.removed}) in ${entry.roots.join(', ') || '(unknown)'}`;
            if (entry.kind === 'network') {
                return entry.backfilled
                    ? `${entry.method} ${Helpers._shortenUrl(entry.url)} -> ${entry.status ?? '?'} (backfilled from persisted cache, no detail available)`
                    : `${entry.method} ${Helpers._shortenUrl(entry.url)} -> ${entry.status ?? '?'} (${entry.durationMs}ms)`;
            }

            if (entry.kind === 'pick') return `PICKED ${entry.target}`;

            if (entry.kind === 'console') return `CONSOLE.${entry.level.toUpperCase()} ${entry.message}`;
            if (entry.kind === 'error') return `ERROR ${entry.message}${entry.source ? ` (${entry.source})` : ''}`;
            return entry.kind;
        },

        _formatTimelineLine(entry) {
            const time = new Date(entry.timestamp).toLocaleTimeString();
            return `${time}  ${this._timelineKindLabel(entry)}`;
        },

        _renderTimelineRowHtml(entry, t) {
            let color;
            if (entry.kind === 'console') {
                color = entry.level === 'error' ? t.statusBad : entry.level === 'warn' ? t.statusWarn : t.cardDesc;
            } else if (entry.kind === 'error') {
                color = t.statusBad;
            } else {
                const colors = {
                    click: '#4a90d9',
                    input: t.statusOk,
                    change: t.statusOk,
                    submit: t.statusWarn,
                    mutation: t.cardDesc,
                    pick: '#b565d9',
                    network: entry.status >= 200 && entry.status < 300 ? t.statusOk : t.statusBad
                };
                color = colors[entry.kind] || t.rowText;
            }
            const time = new Date(entry.timestamp).toLocaleTimeString();
            return `<span style="color:${t.cardDesc};">${time}</span> <span style="color:${color};font-weight:700;">${Helpers._escape(this._timelineKindLabel(entry))}</span>`;
        },

        _renderTimelineNetworkDetail(entry, t) {
            const el = document.getElementById('ttd-pi-rec-detail');
            if (!el) return;
            const full = ObservedTraffic.all().find((e) => e.timestamp === entry.timestamp && e.url === entry.url);
            if (!full) {
                el.innerHTML = `<div style="font-size:10px;color:${t.cardDesc};">Full detail no longer available (fell out of the traffic history buffer).</div>`;
                return;
            }

            const pretty = full.json ? JSON.stringify(full.json, null, 2) : (full.rawText || '(no body)');
            if (full.json && this._recorderTreeState?.root !== full.json) {
                this._recorderTreeState = JsonTree.createState(full.json);
            }

            el.innerHTML = `
                <div style="font-size:11px;font-weight:700;margin-bottom:4px;word-break:break-all;">${Helpers._escape(full.method)} ${Helpers._escape(full.url)}</div>
                ${full.json
                    ? `<div id="ttd-pi-rec-tree" style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:200px;overflow:auto;"></div>`
                    : `<pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0;">${Helpers._escape(pretty)}</pre>`}
            `;
            if (full.json) JsonTree.render(document.getElementById('ttd-pi-rec-tree'), this._recorderTreeState, t);
        },

        _traceViewMode: 'live', 
        _traceHistorySelectedHostname: null,
        _traceHistoryExpandedKey: null, 

        _traceEntryKey(e) {
            return `${e.term}\u0000${e.hostname}\u0000${e.timestamp}`;
        },

        _renderValueTracer() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');

            area.innerHTML = `
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <button id="ttd-pi-trace-mode-live" style="${Helpers._pillStyle(t, this._traceViewMode === 'live')}flex:1;">Live</button>
                    <button id="ttd-pi-trace-mode-history" style="${Helpers._pillStyle(t, this._traceViewMode === 'history')}flex:1;">History (${TraceHistory.all().length})</button>
                    <button id="ttd-pi-trace-mode-correlate" style="${Helpers._pillStyle(t, this._traceViewMode === 'correlate')}flex:1;">Correlate</button>
                </div>
                <div id="ttd-pi-trace-body"></div>
            `;

            document.getElementById('ttd-pi-trace-mode-live').onclick = () => { this._traceViewMode = 'live'; this._renderValueTracer(); };
            document.getElementById('ttd-pi-trace-mode-history').onclick = () => { this._traceViewMode = 'history'; this._renderValueTracer(); };
            document.getElementById('ttd-pi-trace-mode-correlate').onclick = () => { this._traceViewMode = 'correlate'; this._renderValueTracer(); };

            if (this._traceViewMode === 'live') this._renderTraceLive();
            else if (this._traceViewMode === 'history') this._renderTraceHistory();
            else this._renderTraceCorrelate();
        },

        _renderTraceLive() {
            const t = Theme.palette;
            const body = document.getElementById('ttd-pi-trace-body');
            body.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Enter a value you see on the page (a price, a name, an id) and find every place it shows up - DOM text, window globals, and JSON paths inside captured network responses. Substring match, case-sensitive. Every trace run here is also saved to History for this hostname.</div>
                <input id="ttd-pi-trace-input" type="text" placeholder="e.g. 49500" value="${Helpers._escape(this._traceValue)}" style="width:100%;box-sizing:border-box;padding:7px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">
                <button id="ttd-pi-trace-run" style="${Helpers._primaryBtnStyle()}margin-bottom:8px;">Trace</button>
                <div id="ttd-pi-trace-results"></div>
            `;

            const input = document.getElementById('ttd-pi-trace-input');
            input.oninput = (e) => { this._traceValue = e.target.value; };
            input.onkeydown = (e) => { if (e.key === 'Enter') this._runTrace(); };
            document.getElementById('ttd-pi-trace-run').onclick = () => this._runTrace();

            if (this._traceResult) this._renderTraceResults();
        },

        _runTrace() {
            const value = (this._traceValue || '').trim();
            const el = document.getElementById('ttd-pi-trace-results');
            if (!value) { if (el) el.innerHTML = `<div style="${Helpers._noteStyle()}">Enter a value first.</div>`; return; }
            this._traceResult = ValueTracer.trace(value);
            TraceHistory.save(this._traceResult);
            this._renderTraceResults();
        },

        _renderTraceHistory() {
            const t = Theme.palette;
            const body = document.getElementById('ttd-pi-trace-body');
            const groups = TraceHistory.hostnames();

            if (!this._traceHistorySelectedHostname && groups.length) {
                this._traceHistorySelectedHostname = groups[0].hostname;
            }

            const groupPills = groups.map((g) => `
                <button data-hostname="${Helpers._escape(g.hostname)}" style="${Helpers._pillStyle(t, this._traceHistorySelectedHostname === g.hostname)}white-space:nowrap;">${Helpers._escape(g.hostname)} (${g.count})</button>
            `).join('');

            body.innerHTML = `
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <button id="ttd-pi-trace-export" style="${Helpers._secondaryBtnStyle(t)}flex:1;">Copy export</button>
                    <button id="ttd-pi-trace-import" style="${Helpers._secondaryBtnStyle(t)}flex:1;">Import...</button>
                    <button id="ttd-pi-trace-clear" style="${Helpers._secondaryBtnStyle(t)}flex:1;">Clear all</button>
                </div>
                ${groups.length ? `<div style="display:flex;gap:4px;overflow-x:auto;margin-bottom:8px;padding-bottom:2px;">${groupPills}</div>` : ''}
                <div id="ttd-pi-trace-history-list"></div>
            `;

            document.getElementById('ttd-pi-trace-export').onclick = async (e) => {
                const ok = await copyToClipboard(TraceHistory.exportJson());
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy export'; }, 1200);
            };
            document.getElementById('ttd-pi-trace-import').onclick = () => this._promptTraceImport();
            document.getElementById('ttd-pi-trace-clear').onclick = () => {
                if (!confirm('Clear all trace history? This cannot be undone.')) return;
                TraceHistory.clear();
                this._traceHistoryExpandedKey = null;
                this._renderValueTracer();
            };

            body.querySelectorAll('[data-hostname]').forEach((btn) => {
                btn.onclick = () => {
                    this._traceHistorySelectedHostname = btn.getAttribute('data-hostname');
                    this._traceHistoryExpandedKey = null;
                    this._renderTraceHistory();
                };
            });

            this._renderTraceHistoryList();
        },

        _renderTraceHistoryList() {
            const t = Theme.palette;
            const listEl = document.getElementById('ttd-pi-trace-history-list');
            if (!listEl) return;
            const entries = TraceHistory.forHostname(this._traceHistorySelectedHostname);

            if (!entries.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">No saved traces yet. Run a trace from the Live tab - every run is saved automatically.</div>`;
                return;
            }

            const rows = entries.map((e, i) => {
                const total = e.dom.length + e.globals.length + e.network.reduce((s, n) => s + n.paths.length, 0);
                const expanded = this._traceHistoryExpandedKey === this._traceEntryKey(e);
                return `
                    <div>
                        <div data-idx="${i}" style="padding:6px 8px;font-size:11px;cursor:pointer;border-bottom:1px solid ${t.rowBorder};background:${expanded ? t.secondaryBtnBg : 'transparent'};word-break:break-all;">
                            <b>${Helpers._escape(e.term)}</b> <span style="color:${t.cardDesc};">- ${total} match${total === 1 ? '' : 'es'} - ${Helpers._timeAgo(e.timestamp)}</span><br>
                            <span style="font-size:10px;color:${t.cardDesc};">${Helpers._escape(Helpers._shortenUrl(e.url))}</span>
                        </div>
                        ${expanded ? `<div id="ttd-pi-trace-history-detail" style="padding:6px 8px;border-bottom:1px solid ${t.rowBorder};"></div>` : ''}
                    </div>
                `;
            }).join('');

            listEl.innerHTML = `<div style="max-height:320px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;">${rows}</div>`;

            listEl.querySelectorAll('[data-idx]').forEach((row) => {
                row.onclick = () => {
                    const idx = Number(row.getAttribute('data-idx'));
                    const key = this._traceEntryKey(entries[idx]);
                    this._traceHistoryExpandedKey = this._traceHistoryExpandedKey === key ? null : key;
                    this._renderTraceHistoryList();
                };
            });

            if (this._traceHistoryExpandedKey) {
                const target = entries.find((e) => this._traceEntryKey(e) === this._traceHistoryExpandedKey);
                const detailEl = document.getElementById('ttd-pi-trace-history-detail');
                if (detailEl && target) this._renderTraceResultsInto(detailEl, target);
            }
        },

        _traceCorrelateSelectedTerm: null,
        _traceCorrelateMode: 'track', 
        _traceCorrelateTermA: null,
        _traceCorrelateTermB: null,

        _renderTraceCorrelate() {
            const t = Theme.palette;
            const body = document.getElementById('ttd-pi-trace-body');
            const groups = TraceHistory.hostnames();

            if (!this._traceHistorySelectedHostname && groups.length) {
                this._traceHistorySelectedHostname = groups[0].hostname;
            }

            if (!groups.length) {
                body.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">No trace history yet - run some traces from Live first, on more than one occasion, to have anything to correlate.</div>`;
                return;
            }

            const groupPills = groups.map((g) => `
                <button data-hostname="${Helpers._escape(g.hostname)}" style="${Helpers._pillStyle(t, this._traceHistorySelectedHostname === g.hostname)}white-space:nowrap;">${Helpers._escape(g.hostname)} (${g.count})</button>
            `).join('');

            body.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Compares your own past traces against each other - either the same value's consistency over time, or two different values to see where one turned into the other (a stat that was 100 and is now 150). This looks at nothing but your own saved trace history; it doesn't infer anything about how the game's server works.</div>
                <div style="display:flex;gap:4px;overflow-x:auto;margin-bottom:8px;padding-bottom:2px;">${groupPills}</div>
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <button id="ttd-pi-correlate-mode-track" style="${Helpers._pillStyle(t, this._traceCorrelateMode === 'track')}flex:1;">Track one value</button>
                    <button id="ttd-pi-correlate-mode-compare" style="${Helpers._pillStyle(t, this._traceCorrelateMode === 'compare')}flex:1;">Compare two values</button>
                </div>
                <div id="ttd-pi-correlate-terms"></div>
                <div id="ttd-pi-correlate-result" style="margin-top:8px;"></div>
            `;

            body.querySelectorAll('[data-hostname]').forEach((btn) => {
                btn.onclick = () => {
                    this._traceHistorySelectedHostname = btn.getAttribute('data-hostname');
                    this._traceCorrelateSelectedTerm = null;
                    this._traceCorrelateTermA = null;
                    this._traceCorrelateTermB = null;
                    this._renderTraceCorrelate();
                };
            });
            document.getElementById('ttd-pi-correlate-mode-track').onclick = () => { this._traceCorrelateMode = 'track'; this._renderTraceCorrelate(); };
            document.getElementById('ttd-pi-correlate-mode-compare').onclick = () => { this._traceCorrelateMode = 'compare'; this._renderTraceCorrelate(); };

            if (this._traceCorrelateMode === 'compare') this._renderTraceCompareTermPickers();
            else this._renderTraceTrackTermPicker();
        },

        _renderTraceTrackTermPicker() {
            const t = Theme.palette;
            const termsEl = document.getElementById('ttd-pi-correlate-terms');
            const terms = TraceHistory.termsForHostname(this._traceHistorySelectedHostname).filter((tm) => tm.count >= 2);

            if (!terms.length) {
                termsEl.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">No term has been traced more than once for this hostname yet - trace the same value again later (or on a return visit) to correlate it.</div>`;
                document.getElementById('ttd-pi-correlate-result').innerHTML = '';
                return;
            }
            if (!this._traceCorrelateSelectedTerm || !terms.some((tm) => tm.term === this._traceCorrelateSelectedTerm)) {
                this._traceCorrelateSelectedTerm = terms[0].term;
            }
            termsEl.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Term (traced 2+ times for this hostname)</div>
                <select id="ttd-pi-correlate-term-select" style="width:100%;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">
                    ${terms.map((tm) => `<option value="${Helpers._escape(tm.term)}" ${tm.term === this._traceCorrelateSelectedTerm ? 'selected' : ''}>${Helpers._escape(tm.term)} (${tm.count} traces)</option>`).join('')}
                </select>
            `;
            document.getElementById('ttd-pi-correlate-term-select').onchange = (e) => {
                this._traceCorrelateSelectedTerm = e.target.value;
                this._renderTraceCorrelateResult();
            };
            this._renderTraceCorrelateResult();
        },

        _renderTraceCompareTermPickers() {
            const t = Theme.palette;
            const termsEl = document.getElementById('ttd-pi-correlate-terms');
            const terms = TraceHistory.termsForHostname(this._traceHistorySelectedHostname);

            if (terms.length < 2) {
                termsEl.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">Need at least two different traced values for this hostname to compare - trace another value first.</div>`;
                document.getElementById('ttd-pi-correlate-result').innerHTML = '';
                return;
            }
            if (!this._traceCorrelateTermA || !terms.some((tm) => tm.term === this._traceCorrelateTermA)) this._traceCorrelateTermA = terms[0].term;
            if (!this._traceCorrelateTermB || !terms.some((tm) => tm.term === this._traceCorrelateTermB) || this._traceCorrelateTermB === this._traceCorrelateTermA) {
                this._traceCorrelateTermB = terms.find((tm) => tm.term !== this._traceCorrelateTermA)?.term || null;
            }
            const optionsHtml = (selected) => terms.map((tm) => `<option value="${Helpers._escape(tm.term)}" ${tm.term === selected ? 'selected' : ''}>${Helpers._escape(tm.term)} (${tm.count} trace${tm.count === 1 ? '' : 's'})</option>`).join('');
            termsEl.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Was (term A)</div>
                <select id="ttd-pi-correlate-term-a" style="width:100%;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">${optionsHtml(this._traceCorrelateTermA)}</select>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Is now (term B)</div>
                <select id="ttd-pi-correlate-term-b" style="width:100%;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">${optionsHtml(this._traceCorrelateTermB)}</select>
            `;
            document.getElementById('ttd-pi-correlate-term-a').onchange = (e) => { this._traceCorrelateTermA = e.target.value; this._renderTraceCompareResult(); };
            document.getElementById('ttd-pi-correlate-term-b').onchange = (e) => { this._traceCorrelateTermB = e.target.value; this._renderTraceCompareResult(); };
            this._renderTraceCompareResult();
        },

        _renderTraceCompareResult() {
            const t = Theme.palette;
            const resultEl = document.getElementById('ttd-pi-correlate-result');
            if (!resultEl) return;

            if (this._traceCorrelateTermA === this._traceCorrelateTermB) {
                resultEl.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">Pick two different values to compare - for tracking one value's consistency over time, use "Track one value" instead.</div>`;
                return;
            }
            const result = TraceCorrelator.compareTerms(this._traceHistorySelectedHostname, this._traceCorrelateTermA, this._traceCorrelateTermB);
            if (!result || !result.changes.length) {
                resultEl.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">No shared location found where both "${Helpers._escape(this._traceCorrelateTermA)}" and "${Helpers._escape(this._traceCorrelateTermB)}" showed up - they may just be unrelated values, or one hasn't been traced somewhere the other was.</div>`;
                return;
            }

            const orderLabel = { 'a-then-b': `${Helpers._escape(result.termA)} seen first, then ${Helpers._escape(result.termB)}`, 'b-then-a': `${Helpers._escape(result.termB)} seen first, then ${Helpers._escape(result.termA)} (opposite of the A/B order picked above)`, 'interleaved': 'traced back and forth - no single clear order' };

            resultEl.innerHTML = `
                <div style="${Helpers._cardStyle(t)}">
                    <div style="font-size:11px;margin-bottom:8px;">${result.changes.length} location${result.changes.length === 1 ? '' : 's'} held both "<b>${Helpers._escape(result.termA)}</b>" and "<b>${Helpers._escape(result.termB)}</b>" at different points on ${Helpers._escape(result.hostname)}.</div>
                    ${result.changes.map((c) => `
                        <div style="padding:6px 0;border-bottom:1px solid ${t.rowBorder};font-size:11px;">
                            <div><span style="color:${t.cardDesc};font-size:10px;">[${c.kind}]</span> <span style="word-break:break-all;">${Helpers._escape(c.label)}</span></div>
                            <div style="font-size:10px;color:${t.cardDesc};">${orderLabel[c.clearOrder]}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        },

        _renderTraceCorrelateResult() {
            const t = Theme.palette;
            const resultEl = document.getElementById('ttd-pi-correlate-result');
            if (!resultEl) return;

            const result = TraceCorrelator.correlate(this._traceHistorySelectedHostname, this._traceCorrelateSelectedTerm);
            if (!result) {
                resultEl.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">Not enough traces of this term yet.</div>`;
                return;
            }

            const renderSigList = (sigs, emptyText) => {
                if (!sigs.length) return `<div style="font-size:10px;color:${t.cardDesc};">${emptyText}</div>`;
                return sigs.map((s) => `<div style="font-size:11px;padding:3px 0;word-break:break-all;"><span style="color:${t.cardDesc};font-size:10px;">[${s.kind}]</span> ${Helpers._escape(s.label)} <span style="color:${t.cardDesc};font-size:10px;">(seen in ${s.seenCount}/${result.totalTraces})</span></div>`).join('');
            };

            resultEl.innerHTML = `
                <div style="${Helpers._cardStyle(t)}">
                    <div style="font-size:11px;margin-bottom:8px;">${result.totalTraces} traces of "<b>${Helpers._escape(result.term)}</b>" on ${Helpers._escape(result.hostname)}, from ${Helpers._timeAgo(result.firstTimestamp)} to ${Helpers._timeAgo(result.lastTimestamp)}.</div>

                    <div style="font-size:11px;font-weight:700;margin-bottom:4px;">Persistent - seen in every trace (${result.persistent.length})</div>
                    ${renderSigList(result.persistent, 'Nothing showed up in every single trace.')}

                    <div style="font-size:11px;font-weight:700;margin:10px 0 4px;">Intermittent - seen in some but not all (${result.intermittent.length})</div>
                    ${renderSigList(result.intermittent, 'Nothing was intermittent - every location was either persistent or one-off.')}

                    <div style="font-size:11px;font-weight:700;margin:10px 0 4px;">New since your first trace (${result.appearedSinceFirst.length})</div>
                    ${renderSigList(result.appearedSinceFirst, 'No new locations since the first trace.')}

                    <div style="font-size:11px;font-weight:700;margin:10px 0 4px;">Gone since your first trace (${result.droppedSinceFirst.length})</div>
                    ${renderSigList(result.droppedSinceFirst, 'Nothing from the first trace has disappeared.')}
                </div>
            `;
        },

        _promptTraceImport() {
            const t = Theme.palette;
            document.getElementById('ttd-trace-import-panel')?.remove();
            const panel = document.createElement('div');
            panel.id = 'ttd-trace-import-panel';
            panel.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:280px;max-width:88vw;background:${t.panelBg};color:${t.panelText};border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.6);z-index:999999;padding:16px;font-size:13px;`;
            panel.innerHTML = `
                <div style="font-size:13px;font-weight:700;margin-bottom:8px;">Import trace history</div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Paste a previously exported JSON array. Entries are merged with what's already saved (deduped, not replaced) and the cap is re-applied afterward.</div>
                <textarea id="ttd-trace-import-text" style="width:100%;height:100px;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;margin-bottom:8px;"></textarea>
                <div id="ttd-trace-import-status" style="font-size:10px;margin-bottom:8px;"></div>
                <div style="display:flex;gap:6px;">
                    <button id="ttd-trace-import-cancel" style="${Helpers._secondaryBtnStyle(t)}flex:1;">Cancel</button>
                    <button id="ttd-trace-import-go" style="${Helpers._primaryBtnStyle()}flex:1;">Import</button>
                </div>
            `;
            document.body.appendChild(panel);
            document.getElementById('ttd-trace-import-cancel').onclick = () => panel.remove();
            document.getElementById('ttd-trace-import-go').onclick = () => {
                const text = document.getElementById('ttd-trace-import-text').value;
                const result = TraceHistory.importJson(text);
                const statusEl = document.getElementById('ttd-trace-import-status');
                if (!result.ok) {
                    statusEl.style.color = t.statusBad;
                    statusEl.textContent = result.error;
                    return;
                }
                statusEl.style.color = t.statusOk;
                statusEl.textContent = `Imported ${result.added} new entr${result.added === 1 ? 'y' : 'ies'} (${result.skipped} duplicate${result.skipped === 1 ? '' : 's'} skipped).`;
                setTimeout(() => { panel.remove(); this._renderValueTracer(); }, 900);
            };
        },

        _renderTraceResults() {
            const el = document.getElementById('ttd-pi-trace-results');
            if (!el || !this._traceResult) return;
            this._renderTraceResultsInto(el, this._traceResult);
        },

        _renderTraceResultsInto(el, r) {
            const t = Theme.palette;
            const networkHits = r.network.reduce((sum, n) => sum + n.paths.length, 0);
            const total = r.dom.length + r.globals.length + networkHits;

            if (total === 0) {
                el.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">No matches for "${Helpers._escape(r.term)}" in DOM text, window globals, or captured network responses.</div>`;
                return;
            }

            const sections = [];
            if (r.dom.length) {
                sections.push(`<div style="font-size:11px;font-weight:700;margin:6px 0 4px;">DOM (${r.dom.length})</div>`);
                r.dom.forEach((d) => {
                    sections.push(`<div data-copy="${Helpers._escape(d.selector)}" style="padding:4px 0;border-bottom:1px solid ${t.rowBorder};font-size:10px;cursor:pointer;word-break:break-all;"><b>${Helpers._escape(d.selector)}</b><br><span style="color:${t.cardDesc};">${Helpers._escape(d.snippet)}</span></div>`);
                });
            }
            if (r.globals.length) {
                sections.push(`<div style="font-size:11px;font-weight:700;margin:6px 0 4px;">window globals (${r.globals.length})</div>`);
                r.globals.forEach((g) => {
                    sections.push(`<div data-copy="${Helpers._escape(g.key)}" style="padding:4px 0;border-bottom:1px solid ${t.rowBorder};font-size:10px;cursor:pointer;word-break:break-all;"><b>${Helpers._escape(g.key)}</b><br><span style="color:${t.cardDesc};">${Helpers._escape(g.preview)}</span></div>`);
                });
            }
            if (r.network.length) {
                sections.push(`<div style="font-size:11px;font-weight:700;margin:6px 0 4px;">Network responses (${r.network.length})</div>`);
                r.network.forEach((n) => {
                    sections.push(`<div style="padding:4px 0;border-bottom:1px solid ${t.rowBorder};font-size:10px;word-break:break-all;"><b>${Helpers._escape(n.method)} ${Helpers._escape(Helpers._shortenUrl(n.url))}</b> <span style="color:${t.cardDesc};">- ${Helpers._timeAgo(n.timestamp)}</span> <span data-jump-traffic="${Helpers._escape(n.url)}" style="text-decoration:underline;cursor:pointer;color:${t.statusOk};">view in Traffic</span></div>`);
                    n.paths.forEach((p) => {
                        sections.push(`<div data-copy="${Helpers._escape(p)}" style="padding-left:8px;cursor:pointer;color:${t.statusOk};font-size:10px;">${Helpers._escape(p)}</div>`);
                    });
                });
            }

            el.innerHTML = `<div style="max-height:280px;overflow-y:auto;">${sections.join('')}</div>`;
            el.querySelectorAll('[data-copy]').forEach((rowEl) => {
                rowEl.onclick = async () => { await copyToClipboard(rowEl.getAttribute('data-copy')); };
            });
            el.querySelectorAll('[data-jump-traffic]').forEach((elLink) => {
                elLink.onclick = (ev) => { ev.stopPropagation(); this._jumpToTraffic(elLink.getAttribute('data-jump-traffic')); };
            });
        },

        _renderTokens() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            if (!this._tokenScanResults) this._tokenScanResults = TokenInspector.scan();
            const tokens = this._tokenScanResults;

            area.innerHTML = `
                <div style="font-size:10px;color:${t.statusWarn};margin-bottom:8px;">This shows real credential material for whatever's logged in on this page - treat a decoded token or its raw value the way you'd treat a password. Nothing here is sent anywhere unless you explicitly use "Send with this token".</div>
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <button id="ttd-pi-tokens-mode-scanned" style="${Helpers._pillStyle(t, this._tokenViewMode !== 'vault')}flex:1;">Scanned (${tokens.length})</button>
                    <button id="ttd-pi-tokens-mode-vault" style="${Helpers._pillStyle(t, this._tokenViewMode === 'vault')}flex:1;">Vault (${TokenVault.all().length})</button>
                </div>
                <div id="ttd-pi-tokens-scanned" style="${this._tokenViewMode === 'vault' ? 'display:none;' : ''}"></div>
                <div id="ttd-pi-tokens-vault" style="${this._tokenViewMode === 'vault' ? '' : 'display:none;'}"></div>
            `;

            document.getElementById('ttd-pi-tokens-mode-scanned').onclick = () => { this._tokenViewMode = 'scanned'; this._selectedToken = null; this._renderTokens(); };
            document.getElementById('ttd-pi-tokens-mode-vault').onclick = () => { this._tokenViewMode = 'vault'; this._selectedToken = null; this._renderTokens(); };

            if (this._tokenViewMode === 'vault') { this._renderTokenVault(); return; }
            this._renderScannedTokens();
        },

        _renderScannedTokens() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-tokens-scanned');
            if (!area) return;
            const tokens = this._tokenScanResults;

            area.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:10px;color:${t.cardDesc};">${tokens.length} distinct token${tokens.length === 1 ? '' : 's'} found</span>
                    <button id="ttd-pi-tokens-refresh" style="${Helpers._secondaryBtnStyle(t)}">Refresh</button>
                </div>
                <div id="ttd-pi-tokens-list" style="max-height:180px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:8px;"></div>
                <div id="ttd-pi-tokens-detail"></div>
            `;

            document.getElementById('ttd-pi-tokens-refresh').onclick = () => {
                this._tokenScanResults = TokenInspector.scan();
                this._selectedToken = null;
                this._tokenOccurrences = null;
                this._renderTokens();
            };

            const listEl = document.getElementById('ttd-pi-tokens-list');
            if (!tokens.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">No token-shaped values found yet - browse around (log in, load some data) and refresh.</div>`;
                return;
            }
            if (!this._selectedToken || !tokens.includes(this._selectedToken)) {
                this._selectedToken = tokens[0];
            }

            tokens.forEach((tok) => {
                const isSelected = tok === this._selectedToken;
                const isJwt = TokenInspector.isJwt(tok.value);
                const row = document.createElement('div');
                row.style.cssText = `padding:6px 8px;font-size:11px;cursor:pointer;border-bottom:1px solid ${t.rowBorder};background:${isSelected ? t.secondaryBtnBg : 'transparent'};word-break:break-all;`;
                row.innerHTML = `<span style="font-weight:700;color:${isJwt ? t.statusOk : t.rowText};">${isJwt ? 'JWT' : 'token'}</span> <span style="color:${t.cardDesc};">${Helpers._escape(tok.source)}</span> - ${Helpers._escape(tok.location)}<br><span style="font-size:10px;color:${t.cardDesc};">${Helpers._escape(tok.value.slice(0, 60))}${tok.value.length > 60 ? '...' : ''}</span>`;
                row.onclick = () => { this._selectedToken = tok; this._tokenOccurrences = null; this._renderTokenDetail(); };
                listEl.appendChild(row);
            });

            this._renderTokenDetail();
        },

        _renderTokenVault() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-tokens-vault');
            if (!area) return;
            const entries = TokenVault.all();

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">Deliberately in-memory only - cleared on reload, never written to disk, unlike most of this tool's other saved data. This is real credential material, so nothing here survives longer than it has to.</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:10px;color:${t.cardDesc};">${entries.length} of up to ${TokenVault.MAX} saved</span>
                    ${entries.length ? `<button id="ttd-pi-tokens-vault-clear" style="${Helpers._secondaryBtnStyle(t)}">Clear vault</button>` : ''}
                </div>
                <div id="ttd-pi-tokens-vault-list" style="max-height:180px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:8px;"></div>
                <div id="ttd-pi-tokens-detail"></div>
            `;

            const clearBtn = document.getElementById('ttd-pi-tokens-vault-clear');
            if (clearBtn) clearBtn.onclick = () => {
                if (!confirm('Clear all saved tokens from the vault? This cannot be undone.')) return;
                TokenVault.clear();
                this._selectedToken = null;
                this._renderTokens();
            };

            const listEl = document.getElementById('ttd-pi-tokens-vault-list');
            if (!entries.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">Nothing saved yet - open a scanned token and tap "Save to vault" to keep it around even after it rotates or falls out of traffic history.</div>`;
                document.getElementById('ttd-pi-tokens-detail').innerHTML = '';
                return;
            }
            if (!this._selectedToken || !entries.includes(this._selectedToken)) {
                this._selectedToken = entries[0];
            }

            entries.forEach((entry) => {
                const isSelected = entry === this._selectedToken;
                const isJwt = TokenInspector.isJwt(entry.value);
                const row = document.createElement('div');
                row.style.cssText = `padding:6px 8px;font-size:11px;cursor:pointer;border-bottom:1px solid ${t.rowBorder};background:${isSelected ? t.secondaryBtnBg : 'transparent'};word-break:break-all;`;
                row.innerHTML = `<span style="font-weight:700;color:${isJwt ? t.statusOk : t.rowText};">${isJwt ? 'JWT' : 'token'}</span> ${entry.label ? `<span style="color:${t.statusOk};">${Helpers._escape(entry.label)}</span> - ` : ''}<span style="color:${t.cardDesc};">saved ${Helpers._timeAgo(entry.savedAt)}</span><br><span style="font-size:10px;color:${t.cardDesc};">${Helpers._escape(entry.value.slice(0, 60))}${entry.value.length > 60 ? '...' : ''}</span>`;
                row.onclick = () => { this._selectedToken = entry; this._tokenOccurrences = null; this._renderTokenDetail(); };
                listEl.appendChild(row);
            });

            this._renderTokenDetail();
        },

        _renderTokenDetail() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-tokens-detail');
            if (!el) return;
            const tok = this._selectedToken;
            if (!tok) { el.innerHTML = ''; return; }

            const decoded = TokenInspector.isJwt(tok.value) ? TokenInspector.decodeJwt(tok.value) : null;

            const expiryColors = { expired: t.statusBad, 'expiring-soon': t.statusWarn, valid: t.statusOk, unknown: t.cardDesc };
            const expiryLabels = {
                expired: 'Expired',
                'expiring-soon': 'Expiring soon',
                valid: 'Valid',
                unknown: 'No exp claim - can\'t determine expiry'
            };

            let body = '';
            if (decoded) {
                if (decoded.payload && this._tokenPayloadTreeState?.root !== decoded.payload) {
                    this._tokenPayloadTreeState = JsonTree.createState(decoded.payload);
                }
                const expiryLine = decoded.exp !== null
                    ? `<div style="font-size:11px;color:${expiryColors[decoded.expiryStatus]};font-weight:700;margin-bottom:6px;">${expiryLabels[decoded.expiryStatus]} - exp ${new Date(decoded.exp * 1000).toLocaleString()}${decoded.expiryStatus !== 'expired' ? ` (in ${Math.round(decoded.expiresInSeconds / 60)}m)` : ` (${Math.round(-decoded.expiresInSeconds / 60)}m ago)`}</div>`
                    : `<div style="font-size:11px;color:${t.cardDesc};margin-bottom:6px;">${expiryLabels.unknown}</div>`;
                const iatLine = decoded.iat !== null ? `<div style="font-size:10px;color:${t.cardDesc};">Issued: ${new Date(decoded.iat * 1000).toLocaleString()}</div>` : '';
                const nbfLine = decoded.nbf !== null ? `<div style="font-size:10px;color:${t.cardDesc};">Not valid before: ${new Date(decoded.nbf * 1000).toLocaleString()}</div>` : '';
                const algLine = decoded.header && decoded.header.alg ? `<div style="font-size:10px;color:${t.cardDesc};">Algorithm: ${Helpers._escape(decoded.header.alg)}${decoded.header.typ ? ' - ' + Helpers._escape(decoded.header.typ) : ''}</div>` : '';

                const anomalies = TokenInspector.analyzeJwtAnomalies(decoded);
                const anomalyColors = { warn: t.statusWarn, info: t.statusNeutral };
                const anomalyBlock = anomalies.length
                    ? `
                        <div style="font-size:10px;color:${t.cardDesc};margin:8px 0 2px;">Payload anomaly flags (heuristic, unsigned-claim-based - not a verification result)</div>
                        <div style="border:1px solid ${t.rowBorder};border-radius:6px;padding:6px 8px;margin-bottom:6px;">
                            ${anomalies.map((a) => `<div style="font-size:11px;margin-bottom:4px;"><span style="color:${anomalyColors[a.severity]};font-weight:700;">${a.severity === 'warn' ? '\u26A0' : '\u2139'} ${Helpers._escape(a.label)}</span><br><span style="font-size:10px;color:${t.cardDesc};">${Helpers._escape(a.detail)}</span></div>`).join('')}
                        </div>
                    `
                    : `<div style="font-size:10px;color:${t.statusOk};margin:8px 0 6px;">No anomaly flags - nothing about this token's own claims looked internally inconsistent or unusual by these heuristics.</div>`;

                body = `
                    <div style="font-size:11px;font-weight:700;margin-bottom:2px;">Decoded JWT</div>
                    ${expiryLine}
                    ${algLine}
                    ${iatLine}
                    ${nbfLine}
                    ${anomalyBlock}
                    <div style="font-size:10px;color:${t.cardDesc};margin:6px 0 2px;">Payload</div>
                    <div id="ttd-pi-token-tree" style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:180px;overflow:auto;"></div>
                    <div style="font-size:10px;color:${t.cardDesc};margin-top:6px;">Signature present but not verified - checking a JWT's signature needs the issuer's secret/public key, which isn't available client-side. This only decodes the payload; it doesn't confirm the token is genuine.</div>
                `;
            } else {
                body = `<div style="font-size:11px;color:${t.cardDesc};margin-bottom:6px;">Not a JWT - this is an opaque token (a proprietary session id or similar). There's no public spec for its structure, so it can't be decoded client-side the way a JWT can.</div>`;
            }

            el.innerHTML = `
                <div style="font-size:11px;font-weight:700;margin-bottom:2px;">${Helpers._escape(tok.source)} - ${Helpers._escape(tok.location)}</div>
                <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:80px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:4px 0 8px;">${Helpers._escape(tok.value)}</pre>
                ${body}
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
                    <button id="ttd-pi-token-copy" style="${Helpers._secondaryBtnStyle(t)}">Copy raw value</button>
                    <button id="ttd-pi-token-find" style="${Helpers._secondaryBtnStyle(t)}">Find where sent</button>
                    <button id="ttd-pi-token-send" style="${Helpers._secondaryBtnStyle(t)}color:${t.statusWarn};">Send with this token...</button>
                    ${this._tokenViewMode === 'vault'
                        ? `<button id="ttd-pi-token-vault-remove" style="${Helpers._secondaryBtnStyle(t)}color:${t.statusBad};">Remove from vault</button>`
                        : `<button id="ttd-pi-token-vault-save" style="${Helpers._secondaryBtnStyle(t)}">Save to vault</button>`}
                </div>
                <div id="ttd-pi-token-occurrences" style="margin-top:8px;"></div>
            `;

            if (decoded && decoded.payload) JsonTree.render(document.getElementById('ttd-pi-token-tree'), this._tokenPayloadTreeState, t);

            document.getElementById('ttd-pi-token-copy').onclick = async (e) => {
                const ok = await copyToClipboard(tok.value);
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy raw value'; }, 1200);
            };
            document.getElementById('ttd-pi-token-find').onclick = () => {
                this._tokenOccurrences = TokenInspector.findOccurrences(tok.value);
                this._renderTokenOccurrences();
            };
            document.getElementById('ttd-pi-token-send').onclick = () => this._openReplayEditorWithToken(tok);

            const vaultSaveBtn = document.getElementById('ttd-pi-token-vault-save');
            if (vaultSaveBtn) vaultSaveBtn.onclick = () => {
                const label = prompt('Optional label for this saved token (e.g. "admin session"):', this._tokenVaultLabel || '');
                if (label === null) return; 
                TokenVault.add(tok, label);
                vaultSaveBtn.textContent = 'Saved!';
                setTimeout(() => { if (vaultSaveBtn.isConnected) vaultSaveBtn.textContent = 'Save to vault'; }, 1200);
            };
            const vaultRemoveBtn = document.getElementById('ttd-pi-token-vault-remove');
            if (vaultRemoveBtn) vaultRemoveBtn.onclick = () => {
                TokenVault.remove(tok.id);
                this._selectedToken = null;
                this._renderTokens();
            };

            if (this._tokenOccurrences) this._renderTokenOccurrences();
        },

        _renderTokenOccurrences() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-token-occurrences');
            if (!el) return;
            const hits = this._tokenOccurrences;
            if (!hits) { el.innerHTML = ''; return; }

            if (!hits.length) {
                el.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">No occurrences found in currently-held traffic history - it may have been used before capture started, or only ever stored (never sent) so far.</div>`;
                return;
            }
            const lines = hits.map((h) => `<div style="padding:4px 0;border-bottom:1px solid ${t.rowBorder};font-size:10px;word-break:break-all;"><b>${Helpers._escape(h.where)}</b><br>${Helpers._escape(h.method)} ${Helpers._escape(Helpers._shortenUrl(h.url))} - ${Helpers._timeAgo(h.timestamp)}</div>`).join('');
            el.innerHTML = `
                <div style="font-size:11px;font-weight:700;margin-bottom:4px;">${hits.length} occurrence${hits.length === 1 ? '' : 's'} found</div>
                <div style="max-height:150px;overflow-y:auto;">${lines}</div>
            `;
        },

        // Small colored dot + label matching the legend at the top of the Export panel, so each
        // category's reload behavior is visible right next to it rather than needing to be
        // remembered or looked up separately.
        _survivalDot(status, t) {
            const map = {
                survives: [t.statusOk, 'survives reload'],
                resets: [t.statusBad, 'resets on reload'],
                fresh: [t.cardDesc, 'always fresh']
            };
            const [color, label] = map[status] || map.resets;
            return `<span style="color:${color};font-size:9px;white-space:nowrap;">\u25CF ${label}</span>`;
        },

        _renderExport() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            const cats = this._exportCategories;

            const trafficCount = ObservedTraffic.all().length;
            const catalogCount = ObservedTraffic.catalogEntries().length;
            const persistedTrafficCount = ObservedTraffic.persistedTrafficEntries().length;
            const recorderCount = InvestigationRecorder.timeline().length;
            const hasElement = !!this._pickedElement;
            
            const hasPageTiming = !!(this._pageTiming || PageInspector.getNavigationTiming());
            
            const websocketCount = WebSocketMonitor.all().length;

            const traceHistoryCount = TraceHistory.all().length;
            const hasReplay = !!this._replayResult;
            
            const replayHistoryCount = ReplayHistory.all().length;
            
            const hasSandboxRun = !!this._sandboxResult;
            const sandboxHistoryCount = Config.sandboxCodeHistory.length;
            
            const domSnapshotCount = PageInspector.getStorageDump(localStorage).length + PageInspector.getStorageDump(sessionStorage).length + PageInspector.getCookies().length;
            
            const eventDebugLogCount = EventDebugger.log().length;
            const domMutationLogCount = DomMutationWatcher.log().length;
            const storageWatchLogCount = StorageWatcher.log().length;
            const wsMessageCatalogCount = WebSocketMonitor.catalog().length;
            const snapshotsCount = SnapshotManager.all().length;

            const persistedTrafficBytes = ObservedTraffic.persistedTrafficByteSize();
            const persistedTrafficWarning = ObservedTraffic._persistedTrafficWriteFailed
                ? `<div style="font-size:10px;color:${t.statusBad};margin-bottom:8px;">\u26A0 Last write to the persisted traffic cache failed (storage may be full/unavailable here) - what's shown below may be stale. See Settings for the budget and Storage.lastWriteError for detail.</div>`
                : '';

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Pick what to include, then export as raw structured JSON (for further processing), CSV (for the categories that are actually tabular), or a condensed briefing meant to be pasted into an AI assistant for analysis.</div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Persisted traffic cache: ${persistedTrafficCount} total entr${persistedTrafficCount === 1 ? 'y' : 'ies'} (up to ${ObservedTraffic.PERSISTED_ENTRIES_PER_KEY} distinct actions kept per endpoint pattern), ~${(persistedTrafficBytes / 1024).toFixed(1)}KB of ${(Config.persistedTrafficBudgetBytes / 1024).toFixed(0)}KB budget - survives page reloads without needing Traffic history to stay open.</div>
                ${persistedTrafficWarning}
                <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:9px;color:${t.cardDesc};margin-bottom:8px;padding:6px 8px;background:${t.secondaryBtnBg};border-radius:6px;">
                    <span><span style="color:${t.statusOk};">\u25CF</span> survives a page reload</span>
                    <span><span style="color:${t.statusBad};">\u25CF</span> lost on reload - export before reloading if you need it</span>
                    <span><span style="color:${t.cardDesc};">\u25CF</span> always regenerated fresh - reload doesn't matter</span>
                </div>
                <div style="margin-bottom:8px;">
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${trafficCount ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-traffic" ${cats.traffic ? 'checked' : ''} ${trafficCount ? '' : 'disabled'}> Network requests (${trafficCount}) ${this._survivalDot('resets', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${catalogCount ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-catalog" ${cats.catalog ? 'checked' : ''} ${catalogCount ? '' : 'disabled'}> Endpoint catalog (${catalogCount}) ${this._survivalDot('survives', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${persistedTrafficCount ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-persistedTraffic" ${cats.persistedTraffic ? 'checked' : ''} ${persistedTrafficCount ? '' : 'disabled'}> Persisted traffic cache - survives reload (${persistedTrafficCount} entries) ${this._survivalDot('survives', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${recorderCount ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-recorder" ${cats.recorder ? 'checked' : ''} ${recorderCount ? '' : 'disabled'}> Recorder timeline (${recorderCount}) ${this._survivalDot('survives', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${hasElement ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-element" ${cats.element ? 'checked' : ''} ${hasElement ? '' : 'disabled'}> Last picked element${hasElement ? '' : ' (none picked yet)'} ${this._survivalDot('resets', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${hasPageTiming ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-pageTiming" ${cats.pageTiming ? 'checked' : ''} ${hasPageTiming ? '' : 'disabled'}> Page load timing${hasPageTiming ? '' : ' (unavailable)'} ${this._survivalDot('fresh', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${websocketCount ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-websocket" ${cats.websocket ? 'checked' : ''} ${websocketCount ? '' : 'disabled'}> WebSocket activity (${websocketCount}) ${this._survivalDot('survives', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:9px;color:${t.cardDesc};padding:0 0 4px 24px;">Connection history survives - a live connection itself always dies at reload regardless.</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${wsMessageCatalogCount ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-wsMessageCatalog" ${cats.wsMessageCatalog ? 'checked' : ''} ${wsMessageCatalogCount ? '' : 'disabled'}> WebSocket message catalog (${wsMessageCatalogCount}) ${this._survivalDot('survives', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${traceHistoryCount ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-traceHistory" ${cats.traceHistory ? 'checked' : ''} ${traceHistoryCount ? '' : 'disabled'}> Value Tracer history (${traceHistoryCount}) ${this._survivalDot('survives', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${hasReplay ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-replay" ${cats.replay ? 'checked' : ''} ${hasReplay ? '' : 'disabled'}> Last Replay result${hasReplay ? '' : ' (none sent yet)'} ${this._survivalDot('resets', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${replayHistoryCount ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-replayHistory" ${cats.replayHistory ? 'checked' : ''} ${replayHistoryCount ? '' : 'disabled'}> Replay session history (${replayHistoryCount}) ${this._survivalDot('resets', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${hasSandboxRun ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-sandboxRun" ${cats.sandboxRun ? 'checked' : ''} ${hasSandboxRun ? '' : 'disabled'}> Last Sandbox run${hasSandboxRun ? '' : ' (none run yet)'} ${this._survivalDot('resets', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${sandboxHistoryCount ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-sandboxHistory" ${cats.sandboxHistory ? 'checked' : ''} ${sandboxHistoryCount ? '' : 'disabled'}> Sandbox code history - code only, no output (${sandboxHistoryCount}) ${this._survivalDot('survives', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${domSnapshotCount ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-domSnapshot" ${cats.domSnapshot ? 'checked' : ''} ${domSnapshotCount ? '' : 'disabled'}> DOM snapshot - storage/cookies (${domSnapshotCount}) ${this._survivalDot('fresh', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${eventDebugLogCount ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-eventDebugLog" ${cats.eventDebugLog ? 'checked' : ''} ${eventDebugLogCount ? '' : 'disabled'}> Event Debugger log (${eventDebugLogCount}) ${this._survivalDot('resets', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${domMutationLogCount ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-domMutationLog" ${cats.domMutationLog ? 'checked' : ''} ${domMutationLogCount ? '' : 'disabled'}> DOM Mutation Watcher log (${domMutationLogCount}) ${this._survivalDot('survives', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:9px;color:${t.cardDesc};padding:0 0 4px 24px;">Log survives - active watches don't, since a reload rebuilds the DOM and any watched element is gone. Re-add watches after each reload.</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${storageWatchLogCount ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-storageWatchLog" ${cats.storageWatchLog ? 'checked' : ''} ${storageWatchLogCount ? '' : 'disabled'}> Storage/Cookie Watcher log (${storageWatchLogCount}) ${this._survivalDot('resets', t)}</label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 0;${snapshotsCount ? '' : 'opacity:0.5;'}"><input type="checkbox" id="ttd-pi-export-snapshots" ${cats.snapshots ? 'checked' : ''} ${snapshotsCount ? '' : 'disabled'}> Snapshots (${snapshotsCount}) ${this._survivalDot('resets', t)}</label>
                </div>
                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <button id="ttd-pi-export-raw" style="${Helpers._secondaryBtnStyle(t)}flex:1;">Copy raw JSON</button>
                    <button id="ttd-pi-export-brief" style="${Helpers._primaryBtnStyle()}flex:1;">Copy AI briefing</button>
                </div>
                <button id="ttd-pi-export-csv" style="${Helpers._secondaryBtnStyle(t)}width:100%;margin-bottom:10px;">Copy as CSV (tabular categories only)</button>

                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:4px;">A large export can be too big for the clipboard to hold reliably (or too big to paste somewhere useful) - these save it as an actual file instead.</div>
                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <button id="ttd-pi-export-raw-file" style="${Helpers._secondaryBtnStyle(t)}flex:1;">Download JSON (.txt)</button>
                    <button id="ttd-pi-export-brief-file" style="${Helpers._secondaryBtnStyle(t)}flex:1;">Download briefing (.txt)</button>
                </div>
                <button id="ttd-pi-export-csv-file" style="${Helpers._secondaryBtnStyle(t)}width:100%;">Download CSV</button>
            `;

            ['traffic', 'catalog', 'persistedTraffic', 'recorder', 'element', 'pageTiming', 'websocket', 'wsMessageCatalog', 'traceHistory', 'replay', 'replayHistory', 'sandboxRun', 'sandboxHistory', 'domSnapshot', 'eventDebugLog', 'domMutationLog', 'storageWatchLog', 'snapshots'].forEach((key) => {
                const cb = document.getElementById(`ttd-pi-export-${key}`);
                if (cb) cb.onchange = (e) => { this._exportCategories[key] = e.target.checked; };
            });

            document.getElementById('ttd-pi-export-raw').onclick = async (e) => {
                const ok = await copyToClipboard(InvestigationExport.rawExport(this._exportCategories));
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy raw JSON'; }, 1200);
            };
            document.getElementById('ttd-pi-export-brief').onclick = async (e) => {
                const ok = await copyToClipboard(InvestigationExport.briefing(this._exportCategories));
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy AI briefing'; }, 1200);
            };
            document.getElementById('ttd-pi-export-csv').onclick = async (e) => {
                const csv = InvestigationExport.toCSV(this._exportCategories);
                const label = 'Copy as CSV (tabular categories only)';
                if (!csv) {
                    e.target.textContent = 'Nothing to export - check a tabular category';
                    setTimeout(() => { e.target.textContent = label; }, 1800);
                    return;
                }
                const ok = await copyToClipboard(csv);
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = label; }, 1200);
            };

            document.getElementById('ttd-pi-export-raw-file').onclick = (e) => {
                const ok = Helpers.downloadFile(Helpers._exportFilename('txt'), InvestigationExport.rawExport(this._exportCategories), 'text/plain');
                e.target.textContent = ok ? 'Downloaded!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Download JSON (.txt)'; }, 1200);
            };
            document.getElementById('ttd-pi-export-brief-file').onclick = (e) => {
                const ok = Helpers.downloadFile(Helpers._exportFilename('txt'), InvestigationExport.briefing(this._exportCategories), 'text/plain');
                e.target.textContent = ok ? 'Downloaded!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Download briefing (.txt)'; }, 1200);
            };
            document.getElementById('ttd-pi-export-csv-file').onclick = (e) => {
                const csv = InvestigationExport.toCSV(this._exportCategories);
                const label = 'Download CSV';
                if (!csv) {
                    e.target.textContent = 'Nothing to export - check a tabular category';
                    setTimeout(() => { e.target.textContent = label; }, 1800);
                    return;
                }
                const ok = Helpers.downloadFile(Helpers._exportFilename('csv'), csv, 'text/csv');
                e.target.textContent = ok ? 'Downloaded!' : 'Failed';
                setTimeout(() => { e.target.textContent = label; }, 1200);
            };
        },

        _renderGlobals() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            if (!this._globalsSnapshot) this._globalsSnapshot = PageInspector.getExtraWindowGlobals();
            const globals = this._globalsSnapshot;

            area.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:11px;color:${t.cardDesc};">${globals.length} non-standard window keys</span>
                    <div>
                        <button id="ttd-pi-globals-refresh" style="${Helpers._secondaryBtnStyle(t)}">Refresh</button>
                        <button id="ttd-pi-globals-copyall" style="${Helpers._secondaryBtnStyle(t)}">Copy all</button>
                    </div>
                </div>
                <div id="ttd-pi-globals-list" style="max-height:320px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;"></div>
            `;

            document.getElementById('ttd-pi-globals-refresh').onclick = () => { this._globalsSnapshot = PageInspector.getExtraWindowGlobals(); this._renderGlobals(); };
            document.getElementById('ttd-pi-globals-copyall').onclick = async (e) => {

                const obj = {};
                globals.forEach((g) => { obj[g.key] = { type: g.type, value: g.full }; });
                const ok = await copyToClipboard(JSON.stringify(obj, null, 2));
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy all'; }, 1200);
            };

            const listEl = document.getElementById('ttd-pi-globals-list');
            if (!globals.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">No non-standard window keys detected.</div>`;
                return;
            }
            globals.forEach((g) => {
                const row = document.createElement('div');
                row.style.cssText = `padding:6px 8px;font-size:11px;border-bottom:1px solid ${t.rowBorder};cursor:pointer;word-break:break-all;`;
                row.innerHTML = `<span style="font-weight:700;">${Helpers._escape(g.key)}</span> <span style="color:${t.cardDesc};">(${Helpers._escape(g.type)})</span><br><span style="font-size:10px;color:${t.cardDesc};">${Helpers._escape(g.preview)}</span>`;

                row.onclick = async () => { await copyToClipboard(g.full); };
                listEl.appendChild(row);
            });
        },

        _renderStorage() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            const store = this._storageType === 'local' ? localStorage : sessionStorage;
            const entries = PageInspector.getStorageDump(store);

            if (this._selectedStorageKey && !entries.some((en) => en.key === this._selectedStorageKey)) {
                this._selectedStorageKey = null;
            }

            area.innerHTML = `
                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <button id="ttd-pi-storage-local" style="${Helpers._pillStyle(t, this._storageType === 'local')}">localStorage</button>
                    <button id="ttd-pi-storage-session" style="${Helpers._pillStyle(t, this._storageType === 'session')}">sessionStorage</button>
                </div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">Edits write straight to the page's real storage, live immediately - same effect as the page's own code calling setItem.</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:6px;">
                    <span style="font-size:11px;color:${t.cardDesc};">${entries.length} keys</span>
                    <div style="display:flex;gap:6px;">
                        <button id="ttd-pi-storage-add" style="${Helpers._secondaryBtnStyle(t)}">+ Add key</button>
                        <button id="ttd-pi-storage-copy" style="${Helpers._secondaryBtnStyle(t)}">Copy all as JSON</button>
                    </div>
                </div>
                <div id="ttd-pi-storage-list" style="max-height:170px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:8px;"></div>
                <div id="ttd-pi-storage-detail"></div>
            `;

            document.getElementById('ttd-pi-storage-local').onclick = () => { this._storageType = 'local'; this._selectedStorageKey = null; this._addingStorageKey = false; this._renderStorage(); };
            document.getElementById('ttd-pi-storage-session').onclick = () => { this._storageType = 'session'; this._selectedStorageKey = null; this._addingStorageKey = false; this._renderStorage(); };
            document.getElementById('ttd-pi-storage-copy').onclick = async (e) => {
                const obj = {};
                entries.forEach((en) => { obj[en.key] = en.value; });
                const ok = await copyToClipboard(JSON.stringify(obj, null, 2));
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy all as JSON'; }, 1200);
            };
            document.getElementById('ttd-pi-storage-add').onclick = () => {
                this._addingStorageKey = true;
                this._selectedStorageKey = null;
                this._renderStorageDetail(store, entries);
            };

            const listEl = document.getElementById('ttd-pi-storage-list');
            if (!entries.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">Empty.</div>`;
            } else {
                entries.forEach((en) => {
                    const isSelected = !this._addingStorageKey && en.key === this._selectedStorageKey;
                    const row = document.createElement('div');
                    row.style.cssText = `padding:6px 8px;font-size:11px;border-bottom:1px solid ${t.rowBorder};cursor:pointer;word-break:break-all;background:${isSelected ? t.secondaryBtnBg : 'transparent'};`;
                    const preview = en.value.length > 100 ? en.value.slice(0, 100) + '...' : en.value;
                    row.innerHTML = `<span style="font-weight:700;">${Helpers._escape(en.key)}</span><br><span style="font-size:10px;color:${t.cardDesc};">${Helpers._escape(preview)}</span>`;
                    row.onclick = () => {
                        this._addingStorageKey = false;
                        this._selectedStorageKey = en.key;
                        this._renderStorageDetail(store, entries);
                    };
                    listEl.appendChild(row);
                });
            }

            this._renderStorageDetail(store, entries);
        },

        _renderStorageDetail(store, entries) {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-storage-detail');
            if (!area) return;

            if (this._addingStorageKey) {
                area.innerHTML = `
                    <div style="font-size:11px;font-weight:700;margin-bottom:4px;">New key</div>
                    <input id="ttd-pi-storage-new-key" placeholder="key" style="width:100%;box-sizing:border-box;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                    <textarea id="ttd-pi-storage-new-value" placeholder="value" style="width:100%;box-sizing:border-box;height:100px;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;font-family:monospace;"></textarea>
                    <div style="display:flex;gap:6px;">
                        <button id="ttd-pi-storage-save-new" style="${Helpers._primaryBtnStyle()}">Save</button>
                        <button id="ttd-pi-storage-cancel-new" style="${Helpers._secondaryBtnStyle(t)}">Cancel</button>
                    </div>
                    <div id="ttd-pi-storage-new-status" style="font-size:10px;margin-top:4px;"></div>
                `;
                document.getElementById('ttd-pi-storage-cancel-new').onclick = () => { this._addingStorageKey = false; this._renderStorage(); };
                document.getElementById('ttd-pi-storage-save-new').onclick = () => {
                    const key = document.getElementById('ttd-pi-storage-new-key').value.trim();
                    const value = document.getElementById('ttd-pi-storage-new-value').value;
                    const statusEl = document.getElementById('ttd-pi-storage-new-status');
                    if (!key) { statusEl.textContent = 'Key required.'; statusEl.style.color = t.statusBad; return; }
                    const result = PageInspector.setStorageItem(store, key, value);
                    if (result.ok) {
                        this._addingStorageKey = false;
                        this._selectedStorageKey = key;
                        this._renderStorage();
                    } else {
                        statusEl.textContent = result.error;
                        statusEl.style.color = t.statusBad;
                    }
                };
                return;
            }

            if (!this._selectedStorageKey) {
                area.innerHTML = `<div style="font-size:10px;color:${t.cardDesc};">Select a key to view or edit it, or Add key to create one.</div>`;
                return;
            }

            const entry = entries.find((en) => en.key === this._selectedStorageKey);
            if (!entry) { area.innerHTML = ''; return; }

            area.innerHTML = `
                <div style="font-size:11px;font-weight:700;margin-bottom:4px;word-break:break-all;">${Helpers._escape(entry.key)}</div>
                <textarea id="ttd-pi-storage-edit-value" style="width:100%;box-sizing:border-box;height:120px;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;font-family:monospace;">${Helpers._escape(entry.value)}</textarea>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button id="ttd-pi-storage-save" style="${Helpers._primaryBtnStyle()}">Save</button>
                    <button id="ttd-pi-storage-delete" style="${Helpers._secondaryBtnStyle(t)}">Delete key</button>
                    <button id="ttd-pi-storage-copy-value" style="${Helpers._secondaryBtnStyle(t)}">Copy value</button>
                </div>
                <div id="ttd-pi-storage-edit-status" style="font-size:10px;margin-top:4px;"></div>
            `;

            document.getElementById('ttd-pi-storage-save').onclick = () => {
                const value = document.getElementById('ttd-pi-storage-edit-value').value;
                const statusEl = document.getElementById('ttd-pi-storage-edit-status');
                const result = PageInspector.setStorageItem(store, entry.key, value);
                statusEl.textContent = result.ok ? 'Saved.' : result.error;
                statusEl.style.color = result.ok ? t.statusOk : t.statusBad;
            };
            document.getElementById('ttd-pi-storage-delete').onclick = () => {
                if (!confirm(`Delete "${entry.key}" from ${this._storageType === 'local' ? 'localStorage' : 'sessionStorage'}? This changes the live page state immediately.`)) return;
                const result = PageInspector.removeStorageItem(store, entry.key);
                if (result.ok) { this._selectedStorageKey = null; this._renderStorage(); }
            };
            document.getElementById('ttd-pi-storage-copy-value').onclick = async (e) => {
                const ok = await copyToClipboard(entry.value);
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy value'; }, 1200);
            };
        },

        _renderCookies() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            const cookies = PageInspector.getCookies();

            if (this._selectedCookieKey && !cookies.some((c) => c.key === this._selectedCookieKey)) {
                this._selectedCookieKey = null;
            }

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">Only cookies readable from JS - httpOnly session cookies won't appear here and can never be touched from JS, by browser design. Edits write path=/ by default since the original path/domain aren't visible from here - if the real cookie used a different path, this may add a second cookie rather than replace it.</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:6px;">
                    <span style="font-size:11px;color:${t.cardDesc};">${cookies.length} cookies</span>
                    <div style="display:flex;gap:6px;">
                        <button id="ttd-pi-cookies-add" style="${Helpers._secondaryBtnStyle(t)}">+ Add cookie</button>
                        <button id="ttd-pi-cookies-copy" style="${Helpers._secondaryBtnStyle(t)}">Copy all</button>
                    </div>
                </div>
                <div id="ttd-pi-cookies-list" style="max-height:170px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:8px;"></div>
                <div id="ttd-pi-cookies-detail"></div>
            `;

            document.getElementById('ttd-pi-cookies-copy').onclick = async (e) => {
                const text = cookies.map((c) => `${c.key}=${c.value}`).join('\n');
                const ok = await copyToClipboard(text);
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy all'; }, 1200);
            };
            document.getElementById('ttd-pi-cookies-add').onclick = () => {
                this._addingCookie = true;
                this._selectedCookieKey = null;
                this._renderCookieDetail(cookies);
            };

            const listEl = document.getElementById('ttd-pi-cookies-list');
            if (!cookies.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">No JS-readable cookies.</div>`;
            } else {
                cookies.forEach((c) => {
                    const isSelected = !this._addingCookie && c.key === this._selectedCookieKey;
                    const row = document.createElement('div');
                    row.style.cssText = `padding:6px 8px;font-size:11px;border-bottom:1px solid ${t.rowBorder};cursor:pointer;word-break:break-all;background:${isSelected ? t.secondaryBtnBg : 'transparent'};`;
                    row.innerHTML = `<span style="font-weight:700;">${Helpers._escape(c.key)}</span> = ${Helpers._escape(c.value)}`;
                    row.onclick = () => {
                        this._addingCookie = false;
                        this._selectedCookieKey = c.key;
                        this._renderCookieDetail(cookies);
                    };
                    listEl.appendChild(row);
                });
            }

            this._renderCookieDetail(cookies);
        },

        _renderCookieDetail(cookies) {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-cookies-detail');
            if (!area) return;

            if (this._addingCookie) {
                area.innerHTML = `
                    <div style="font-size:11px;font-weight:700;margin-bottom:4px;">New cookie</div>
                    <input id="ttd-pi-cookie-new-key" placeholder="name" style="width:100%;box-sizing:border-box;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                    <input id="ttd-pi-cookie-new-value" placeholder="value" style="width:100%;box-sizing:border-box;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                    <div style="display:flex;gap:6px;">
                        <button id="ttd-pi-cookie-save-new" style="${Helpers._primaryBtnStyle()}">Save</button>
                        <button id="ttd-pi-cookie-cancel-new" style="${Helpers._secondaryBtnStyle(t)}">Cancel</button>
                    </div>
                    <div id="ttd-pi-cookie-new-status" style="font-size:10px;margin-top:4px;"></div>
                `;
                document.getElementById('ttd-pi-cookie-cancel-new').onclick = () => { this._addingCookie = false; this._renderCookies(); };
                document.getElementById('ttd-pi-cookie-save-new').onclick = () => {
                    const key = document.getElementById('ttd-pi-cookie-new-key').value.trim();
                    const value = document.getElementById('ttd-pi-cookie-new-value').value;
                    const statusEl = document.getElementById('ttd-pi-cookie-new-status');
                    if (!key) { statusEl.textContent = 'Name required.'; statusEl.style.color = t.statusBad; return; }
                    const result = PageInspector.setCookie(key, value);
                    if (result.ok) {
                        this._addingCookie = false;
                        this._selectedCookieKey = key;
                        this._renderCookies();
                    } else {
                        statusEl.textContent = result.error;
                        statusEl.style.color = t.statusBad;
                    }
                };
                return;
            }

            if (!this._selectedCookieKey) {
                area.innerHTML = `<div style="font-size:10px;color:${t.cardDesc};">Select a cookie to view or edit it, or Add cookie to create one.</div>`;
                return;
            }

            const cookie = cookies.find((c) => c.key === this._selectedCookieKey);
            if (!cookie) { area.innerHTML = ''; return; }

            area.innerHTML = `
                <div style="font-size:11px;font-weight:700;margin-bottom:4px;word-break:break-all;">${Helpers._escape(cookie.key)}</div>
                <input id="ttd-pi-cookie-edit-value" value="${Helpers._escape(cookie.value)}" style="width:100%;box-sizing:border-box;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button id="ttd-pi-cookie-save" style="${Helpers._primaryBtnStyle()}">Save</button>
                    <button id="ttd-pi-cookie-delete" style="${Helpers._secondaryBtnStyle(t)}">Delete cookie</button>
                    <button id="ttd-pi-cookie-copy-value" style="${Helpers._secondaryBtnStyle(t)}">Copy value</button>
                </div>
                <div id="ttd-pi-cookie-edit-status" style="font-size:10px;margin-top:4px;"></div>
            `;

            document.getElementById('ttd-pi-cookie-save').onclick = () => {
                const value = document.getElementById('ttd-pi-cookie-edit-value').value;
                const statusEl = document.getElementById('ttd-pi-cookie-edit-status');
                const result = PageInspector.setCookie(cookie.key, value);
                statusEl.textContent = result.ok ? 'Saved.' : result.error;
                statusEl.style.color = result.ok ? t.statusOk : t.statusBad;
            };
            document.getElementById('ttd-pi-cookie-delete').onclick = () => {
                if (!confirm(`Delete cookie "${cookie.key}"? This attempts path=/ - if the real cookie used a different path, this may not remove it.`)) return;
                PageInspector.deleteCookie(cookie.key);
                this._selectedCookieKey = null;
                this._renderCookies();
            };
            document.getElementById('ttd-pi-cookie-copy-value').onclick = async (e) => {
                const ok = await copyToClipboard(cookie.value);
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy value'; }, 1200);
            };
        },

        // Drill-down: databases -> object stores -> records -> record editor. State
        // (_idbSelectedDb/_idbSelectedStore/etc.) persists across leaving and re-entering the
        // section, same as the storage panel remembering local vs session.
        _renderIndexedDB() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');

            if (!IndexedDBInspector.supported()) {
                area.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};padding:8px;">indexedDB.databases() isn't available here - some browsers/webviews don't support it, or IndexedDB itself may be disabled for this page.</div>`;
                return;
            }

            if (this._idbSelectedStore) { this._renderIndexedDBRecords(); return; }
            if (this._idbSelectedDb) { this._renderIndexedDBStores(); return; }

            area.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};padding:8px;">Loading databases...</div>`;
            IndexedDBInspector.listDatabases().then((dbs) => {
                this._idbDatabases = dbs;
                this._renderIndexedDBDatabases();
            });
        },

        _renderIndexedDBDatabases() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            const dbs = this._idbDatabases || [];

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Databases this page's own scripts have created. Edits write straight to IndexedDB, live immediately.</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:11px;color:${t.cardDesc};">${dbs.length} database${dbs.length === 1 ? '' : 's'}</span>
                    <button id="ttd-pi-idb-refresh" style="${Helpers._secondaryBtnStyle(t)}">Refresh</button>
                </div>
                <div id="ttd-pi-idb-list" style="max-height:260px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;"></div>
            `;
            document.getElementById('ttd-pi-idb-refresh').onclick = () => { this._renderIndexedDB(); };

            const listEl = document.getElementById('ttd-pi-idb-list');
            if (!dbs.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">No databases found.</div>`;
                return;
            }
            dbs.forEach((d) => {
                const row = document.createElement('div');
                row.style.cssText = `padding:8px;font-size:11px;border-bottom:1px solid ${t.rowBorder};cursor:pointer;`;
                row.innerHTML = `<span style="font-weight:700;">${Helpers._escape(d.name)}</span> <span style="color:${t.cardDesc};">v${d.version}</span>`;
                row.onclick = () => {
                    this._idbSelectedDb = d.name;
                    this._idbSelectedStore = null;
                    this._renderIndexedDB();
                };
                listEl.appendChild(row);
            });
        },

        _renderIndexedDBStores() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            area.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};padding:8px;">Loading object stores...</div>`;

            IndexedDBInspector.listObjectStores(this._idbSelectedDb).then((stores) => {
                this._idbStores = stores;
                area.innerHTML = `
                    <button id="ttd-pi-idb-back-db" style="${Helpers._secondaryBtnStyle(t)}margin-bottom:8px;">&larr; Databases</button>
                    <div style="font-size:11px;font-weight:700;margin-bottom:6px;word-break:break-all;">${Helpers._escape(this._idbSelectedDb)}</div>
                    <div style="font-size:11px;color:${t.cardDesc};margin-bottom:6px;">${stores.length} object store${stores.length === 1 ? '' : 's'}</div>
                    <div id="ttd-pi-idb-stores-list" style="max-height:260px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;"></div>
                `;
                document.getElementById('ttd-pi-idb-back-db').onclick = () => { this._idbSelectedDb = null; this._renderIndexedDB(); };

                const listEl = document.getElementById('ttd-pi-idb-stores-list');
                if (!stores.length) {
                    listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">No object stores.</div>`;
                    return;
                }
                stores.forEach((s) => {
                    const row = document.createElement('div');
                    row.style.cssText = `padding:8px;font-size:11px;border-bottom:1px solid ${t.rowBorder};cursor:pointer;`;
                    row.innerHTML = `<span style="font-weight:700;">${Helpers._escape(s.name)}</span><br><span style="font-size:10px;color:${t.cardDesc};">keyPath: ${s.keyPath ? Helpers._escape(JSON.stringify(s.keyPath)) : '(none - out-of-line keys)'}${s.autoIncrement ? ', autoIncrement' : ''}</span>`;
                    row.onclick = () => {
                        this._idbSelectedStore = s.name;
                        this._idbSelectedRecordIndex = null;
                        this._idbAddingRecord = false;
                        this._renderIndexedDB();
                    };
                    listEl.appendChild(row);
                });
            }).catch((e) => {
                area.innerHTML = `<div style="font-size:11px;color:${t.statusBad};padding:8px;">Failed to open database: ${Helpers._escape((e && e.message) || String(e))}</div>`;
            });
        },

        _renderIndexedDBRecords() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            area.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};padding:8px;">Loading records...</div>`;

            const RECORD_LIMIT = 200;
            const store = (this._idbStores || []).find((s) => s.name === this._idbSelectedStore);

            IndexedDBInspector.getRecords(this._idbSelectedDb, this._idbSelectedStore, RECORD_LIMIT).then((data) => {
                this._idbRecords = data;
                area.innerHTML = `
                    <button id="ttd-pi-idb-back-store" style="${Helpers._secondaryBtnStyle(t)}margin-bottom:8px;">&larr; ${Helpers._escape(this._idbSelectedDb)}</button>
                    <div style="font-size:11px;font-weight:700;margin-bottom:4px;word-break:break-all;">${Helpers._escape(this._idbSelectedStore)}</div>
                    <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">${data.total > data.values.length ? `Showing first ${data.values.length} of ${data.total} records.` : `${data.total} record${data.total === 1 ? '' : 's'}.`}</div>
                    <div style="display:flex;justify-content:flex-end;margin-bottom:6px;">
                        <button id="ttd-pi-idb-add-record" style="${Helpers._secondaryBtnStyle(t)}">+ Add record</button>
                    </div>
                    <div id="ttd-pi-idb-records-list" style="max-height:170px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:8px;"></div>
                    <div id="ttd-pi-idb-record-detail"></div>
                `;
                document.getElementById('ttd-pi-idb-back-store').onclick = () => { this._idbSelectedStore = null; this._idbRecords = null; this._renderIndexedDB(); };
                document.getElementById('ttd-pi-idb-add-record').onclick = () => {
                    this._idbAddingRecord = true;
                    this._idbSelectedRecordIndex = null;
                    this._renderIndexedDBRecordDetail(store);
                };

                const listEl = document.getElementById('ttd-pi-idb-records-list');
                if (!data.values.length) {
                    listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">Empty.</div>`;
                } else {
                    data.values.forEach((v, i) => {
                        const isSelected = !this._idbAddingRecord && i === this._idbSelectedRecordIndex;
                        const row = document.createElement('div');
                        row.style.cssText = `padding:6px 8px;font-size:11px;border-bottom:1px solid ${t.rowBorder};cursor:pointer;word-break:break-all;background:${isSelected ? t.secondaryBtnBg : 'transparent'};`;
                        let preview;
                        try { preview = JSON.stringify(v); } catch { preview = String(v); }
                        if (preview && preview.length > 100) preview = preview.slice(0, 100) + '...';
                        row.innerHTML = `<span style="font-weight:700;">${Helpers._escape(String(data.keys[i]))}</span><br><span style="font-size:10px;color:${t.cardDesc};">${Helpers._escape(preview || '')}</span>`;
                        row.onclick = () => {
                            this._idbAddingRecord = false;
                            this._idbSelectedRecordIndex = i;
                            this._renderIndexedDBRecordDetail(store);
                        };
                        listEl.appendChild(row);
                    });
                }
                this._renderIndexedDBRecordDetail(store);
            }).catch((e) => {
                area.innerHTML = `<div style="font-size:11px;color:${t.statusBad};padding:8px;">Failed to read records: ${Helpers._escape((e && e.message) || String(e))}</div>`;
            });
        },

        _renderIndexedDBRecordDetail(store) {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-idb-record-detail');
            if (!area) return;
            const keyPath = store ? store.keyPath : null;
            const hasInlineKey = !!keyPath;

            if (this._idbAddingRecord) {
                area.innerHTML = `
                    <div style="font-size:11px;font-weight:700;margin-bottom:4px;">New record</div>
                    ${hasInlineKey
                        ? `<div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">This store uses an inline key (${Helpers._escape(JSON.stringify(keyPath))}) - include it as a field in the JSON value below rather than setting it separately.</div>`
                        : `<input id="ttd-pi-idb-new-key" placeholder="key (JSON, or a plain string)" style="width:100%;box-sizing:border-box;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">`}
                    <textarea id="ttd-pi-idb-new-value" placeholder="value (JSON)" style="width:100%;box-sizing:border-box;height:120px;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;font-family:monospace;"></textarea>
                    <div style="display:flex;gap:6px;">
                        <button id="ttd-pi-idb-save-new" style="${Helpers._primaryBtnStyle()}">Save</button>
                        <button id="ttd-pi-idb-cancel-new" style="${Helpers._secondaryBtnStyle(t)}">Cancel</button>
                    </div>
                    <div id="ttd-pi-idb-new-status" style="font-size:10px;margin-top:4px;"></div>
                `;
                document.getElementById('ttd-pi-idb-cancel-new').onclick = () => { this._idbAddingRecord = false; this._renderIndexedDB(); };
                document.getElementById('ttd-pi-idb-save-new').onclick = async () => {
                    const statusEl = document.getElementById('ttd-pi-idb-new-status');
                    let value;
                    try { value = JSON.parse(document.getElementById('ttd-pi-idb-new-value').value); }
                    catch { statusEl.textContent = 'Value must be valid JSON.'; statusEl.style.color = t.statusBad; return; }
                    let key;
                    if (!hasInlineKey) {
                        const keyRaw = document.getElementById('ttd-pi-idb-new-key').value.trim();
                        if (!keyRaw) { statusEl.textContent = 'Key required for this store.'; statusEl.style.color = t.statusBad; return; }
                        try { key = JSON.parse(keyRaw); } catch { key = keyRaw; }
                    }
                    const result = await IndexedDBInspector.putRecord(this._idbSelectedDb, this._idbSelectedStore, value, key);
                    if (result.ok) { this._idbAddingRecord = false; this._renderIndexedDB(); }
                    else { statusEl.textContent = result.error; statusEl.style.color = t.statusBad; }
                };
                return;
            }

            if (this._idbSelectedRecordIndex === null || this._idbSelectedRecordIndex === undefined) {
                area.innerHTML = `<div style="font-size:10px;color:${t.cardDesc};">Select a record to view or edit it, or Add record to create one.</div>`;
                return;
            }

            const i = this._idbSelectedRecordIndex;
            const records = this._idbRecords;
            if (!records || records.values[i] === undefined) { area.innerHTML = ''; return; }
            const key = records.keys[i];
            const value = records.values[i];
            let valueText;
            let isEditable = true;
            try { valueText = JSON.stringify(value, null, 2); } catch { valueText = String(value); isEditable = false; }
            if (valueText === undefined) { valueText = String(value); isEditable = false; } 

            area.innerHTML = `
                <div style="font-size:11px;font-weight:700;margin-bottom:4px;word-break:break-all;">Key: ${Helpers._escape(JSON.stringify(key))}</div>
                ${isEditable ? '' : `<div style="font-size:10px;color:${t.statusBad};margin-bottom:6px;">This value isn't plain JSON (likely a Blob, ArrayBuffer, Date, Map, or similar) - shown read-only, editing isn't supported for it here.</div>`}
                <textarea id="ttd-pi-idb-edit-value" ${isEditable ? '' : 'readonly'} style="width:100%;box-sizing:border-box;height:150px;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;font-family:monospace;">${Helpers._escape(valueText)}</textarea>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${isEditable ? `<button id="ttd-pi-idb-save" style="${Helpers._primaryBtnStyle()}">Save</button>` : ''}
                    <button id="ttd-pi-idb-delete" style="${Helpers._secondaryBtnStyle(t)}">Delete record</button>
                    <button id="ttd-pi-idb-copy-value" style="${Helpers._secondaryBtnStyle(t)}">Copy value</button>
                </div>
                <div id="ttd-pi-idb-edit-status" style="font-size:10px;margin-top:4px;"></div>
            `;

            if (isEditable) {
                document.getElementById('ttd-pi-idb-save').onclick = async () => {
                    const statusEl = document.getElementById('ttd-pi-idb-edit-status');
                    let newValue;
                    try { newValue = JSON.parse(document.getElementById('ttd-pi-idb-edit-value').value); }
                    catch { statusEl.textContent = 'Value must be valid JSON.'; statusEl.style.color = t.statusBad; return; }
                    const putKey = hasInlineKey ? undefined : key;
                    const result = await IndexedDBInspector.putRecord(this._idbSelectedDb, this._idbSelectedStore, newValue, putKey);
                    statusEl.textContent = result.ok ? 'Saved.' : result.error;
                    statusEl.style.color = result.ok ? t.statusOk : t.statusBad;
                };
            }
            document.getElementById('ttd-pi-idb-delete').onclick = async () => {
                if (!confirm(`Delete this record (key: ${JSON.stringify(key)})? This changes the live page state immediately.`)) return;
                const result = await IndexedDBInspector.deleteRecord(this._idbSelectedDb, this._idbSelectedStore, key);
                if (result.ok) { this._idbSelectedRecordIndex = null; this._renderIndexedDB(); }
            };
            document.getElementById('ttd-pi-idb-copy-value').onclick = async (e) => {
                const ok = await copyToClipboard(valueText);
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy value'; }, 1200);
            };
        },

        _renderNetwork() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            if (!this._networkSnapshot) this._networkSnapshot = PageInspector.getResourceEntries(this._networkFilter);
            const domainFiltered = this._networkSnapshot;

            const types = ['all', ...Array.from(new Set(domainFiltered.map((e) => e.initiatorType || '(none)'))).sort()];
            if (!types.includes(this._networkTypeFilter)) this._networkTypeFilter = 'all';
            const filtered = this._networkTypeFilter === 'all'
                ? domainFiltered
                : domainFiltered.filter((e) => (e.initiatorType || '(none)') === this._networkTypeFilter);

            area.innerHTML = `
                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <select id="ttd-pi-network-filter" style="flex:1;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                        <option value="same-origin" ${this._networkFilter === 'same-origin' ? 'selected' : ''}>This page's own host</option>
                        <option value="all" ${this._networkFilter === 'all' ? 'selected' : ''}>Everything the page loaded</option>
                    </select>
                    <button id="ttd-pi-network-refresh" style="${Helpers._secondaryBtnStyle(t)}">Refresh</button>
                </div>
                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <select id="ttd-pi-network-type" style="flex:1;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                        ${types.map((ty) => `<option value="${Helpers._escape(ty)}" ${ty === this._networkTypeFilter ? 'selected' : ''}>${ty === 'all' ? 'All types' : Helpers._escape(ty)}</option>`).join('')}
                    </select>
                    <button id="ttd-pi-network-copyall" style="${Helpers._secondaryBtnStyle(t)}">Copy all</button>
                </div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:4px;">${filtered.length} of ${domainFiltered.length} entries - the browser only keeps a limited buffer (often the last ~150-250), so older ones may already be gone</div>
                <div id="ttd-pi-network-list" style="max-height:300px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;"></div>
            `;

            document.getElementById('ttd-pi-network-filter').onchange = (e) => { this._networkFilter = e.target.value; this._networkSnapshot = null; this._networkTypeFilter = 'all'; this._renderNetwork(); };
            document.getElementById('ttd-pi-network-type').onchange = (e) => { this._networkTypeFilter = e.target.value; this._renderNetwork(); };
            document.getElementById('ttd-pi-network-refresh').onclick = () => { this._networkSnapshot = PageInspector.getResourceEntries(this._networkFilter); this._renderNetwork(); };
            document.getElementById('ttd-pi-network-copyall').onclick = async (e) => {
                const ok = await copyToClipboard(JSON.stringify(filtered, null, 2));
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy all'; }, 1200);
            };

            const listEl = document.getElementById('ttd-pi-network-list');
            if (!filtered.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">No matching entries.</div>`;
                return;
            }
            filtered.slice(0, 150).forEach((en) => {
                const row = document.createElement('div');
                row.style.cssText = `padding:6px 8px;font-size:11px;border-bottom:1px solid ${t.rowBorder};cursor:pointer;word-break:break-all;`;
                row.innerHTML = `<span style="font-weight:700;">${Helpers._escape(en.initiatorType)}</span> <span style="color:${t.cardDesc};">${en.duration}ms</span><br>${Helpers._escape(en.name)}`;
                row.onclick = async () => { await copyToClipboard(en.name); };
                listEl.appendChild(row);
            });
        },

        _renderPageTiming() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            if (!this._pageTiming) this._pageTiming = PageInspector.getNavigationTiming();
            const timing = this._pageTiming;

            if (!timing) {
                area.innerHTML = `
                    <div style="font-size:11px;color:${t.cardDesc};margin-bottom:8px;">No navigation timing data available - neither the modern Navigation Timing API nor the legacy performance.timing fallback returned anything on this page.</div>
                    <button id="ttd-pi-pageload-refresh" style="${Helpers._secondaryBtnStyle(t)}">Refresh</button>
                `;
                document.getElementById('ttd-pi-pageload-refresh').onclick = () => { this._pageTiming = PageInspector.getNavigationTiming(); this._renderPageTiming(); };
                return;
            }

            const maxMs = Math.max(1, timing.total);

            const colors = ['#888888', '#4a90d9', '#7a5fd9', '#d9a04a', t.statusWarn, t.statusOk, '#5fb5d9', '#b565d9', '#cc6688'];

            const barSegments = timing.phases.map((p, i) => {
                const widthPct = (p.ms / maxMs) * 100;
                return `<div title="${Helpers._escape(p.label)}: ${Math.round(p.ms)}ms" style="width:${widthPct}%;background:${colors[i % colors.length]};height:100%;"></div>`;
            }).join('');

            const legend = timing.phases.map((p, i) => `<span style="display:inline-block;margin-right:10px;margin-bottom:2px;font-size:9px;color:${t.cardDesc};"><span style="display:inline-block;width:8px;height:8px;background:${colors[i % colors.length]};border-radius:2px;margin-right:3px;"></span>${Helpers._escape(p.label)}: ${Math.round(p.ms)}ms</span>`).join('');

            const sizeLine = (timing.transferSize || timing.encodedBodySize || timing.decodedBodySize)
                ? `<div style="font-size:10px;color:${t.cardDesc};margin-top:6px;">Transfer: ${timing.transferSize.toLocaleString()} bytes - Encoded: ${timing.encodedBodySize.toLocaleString()} - Decoded: ${timing.decodedBodySize.toLocaleString()}</div>`
                : '';

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Timing for the page's own load (type: ${Helpers._escape(timing.type)}) via the Navigation Timing API - reflects the last full page load, not any in-page navigation since then.</div>
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <button id="ttd-pi-pageload-refresh" style="${Helpers._secondaryBtnStyle(t)}">Refresh</button>
                    <button id="ttd-pi-pageload-copy" style="${Helpers._secondaryBtnStyle(t)}">Copy</button>
                </div>
                <div style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:10px;margin-bottom:8px;">
                    <div style="font-size:11px;margin-bottom:3px;">TTFB: <b>${Math.round(timing.ttfb)}ms</b></div>
                    <div style="font-size:11px;margin-bottom:3px;">DOM Interactive: <b>${Math.round(timing.domInteractive)}ms</b></div>
                    <div style="font-size:11px;margin-bottom:3px;">DOM Content Loaded: <b>${Math.round(timing.domContentLoaded)}ms</b></div>
                    <div style="font-size:11px;margin-bottom:3px;">DOM Complete: <b>${Math.round(timing.domComplete)}ms</b></div>
                    <div style="font-size:11px;">Total load: <b>${Math.round(timing.total)}ms</b></div>
                    ${sizeLine}
                </div>
                <div style="display:flex;height:16px;border-radius:4px;overflow:hidden;margin-bottom:8px;">${barSegments}</div>
                <div style="line-height:1.9;">${legend}</div>
            `;

            document.getElementById('ttd-pi-pageload-refresh').onclick = () => { this._pageTiming = PageInspector.getNavigationTiming(); this._renderPageTiming(); };
            document.getElementById('ttd-pi-pageload-copy').onclick = async (e) => {
                const lines = [
                    `Navigation type: ${timing.type}`,
                    `TTFB: ${Math.round(timing.ttfb)}ms`,
                    `DOM Interactive: ${Math.round(timing.domInteractive)}ms`,
                    `DOM Content Loaded: ${Math.round(timing.domContentLoaded)}ms`,
                    `DOM Complete: ${Math.round(timing.domComplete)}ms`,
                    `Total load: ${Math.round(timing.total)}ms`,
                    '',
                    ...timing.phases.map((p) => `${p.label}: ${Math.round(p.ms)}ms`)
                ];
                const ok = await copyToClipboard(lines.join('\n'));
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy'; }, 1200);
            };
        },

        _renderTraffic() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');

            area.innerHTML = `
                <div id="ttd-pi-traffic-count" style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;"></div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
                    <input id="ttd-pi-traffic-search" type="text" placeholder="Filter by URL" value="${Helpers._escape(this._trafficSearch)}" style="flex:1 1 140px;min-width:0;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                    <button id="ttd-pi-traffic-refresh" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;padding:4px 12px;">Refresh</button>
                    <button id="ttd-pi-traffic-copyall" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;">Copy all</button>
                </div>
                <input id="ttd-pi-traffic-payload-filter" type="text" placeholder="Payload filter: keyword, key=value, key&gt;100, key:100-500" value="${Helpers._escape(this._trafficPayloadFilter)}" style="width:100%;box-sizing:border-box;padding:6px;margin-bottom:2px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                <div style="font-size:9px;color:${t.cardDesc};margin-bottom:6px;">Space-separated terms, all must match. Checks request/response body and JSON keys at any depth (not just top-level).</div>
                <label style="display:flex;align-items:center;gap:6px;font-size:10px;color:${t.cardDesc};margin-bottom:4px;">
                    <input type="checkbox" id="ttd-pi-traffic-recorded-only" ${this._trafficRecordedOnly ? 'checked' : ''}>
                    Only show traffic captured during a recording session (\u{1F534})
                </label>
                <label style="display:flex;align-items:center;gap:6px;font-size:10px;color:${t.cardDesc};margin-bottom:6px;">
                    <input type="checkbox" id="ttd-pi-traffic-problems-only" ${this._trafficProblemsOnly ? 'checked' : ''}>
                    Only show problems (4xx/5xx, or slower than 1s)
                </label>
                <div id="ttd-pi-traffic-list" style="max-height:180px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:8px;"></div>
                <div id="ttd-pi-traffic-detail"></div>
            `;

            document.getElementById('ttd-pi-traffic-search').oninput = (e) => { this._trafficSearch = e.target.value; this._updateTrafficList(); };
            document.getElementById('ttd-pi-traffic-payload-filter').oninput = (e) => { this._trafficPayloadFilter = e.target.value; this._updateTrafficList(); };
            document.getElementById('ttd-pi-traffic-refresh').onclick = () => this._updateTrafficList();
            document.getElementById('ttd-pi-traffic-recorded-only').onchange = (e) => { this._trafficRecordedOnly = e.target.checked; this._updateTrafficList(); };
            
            document.getElementById('ttd-pi-traffic-problems-only').onchange = (e) => { this._trafficProblemsOnly = e.target.checked; this._updateTrafficList(); };
            document.getElementById('ttd-pi-traffic-copyall').onclick = async (e) => {
                const { filtered } = this._applyTrafficFilters(ObservedTraffic.all());
                const ok = await copyToClipboard(JSON.stringify(filtered, null, 2));
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy all'; }, 1200);
            };

            this._updateTrafficList();
        },

        _isTrafficProblem(entry) {
            return (entry.status >= 400) || entry.durationMs > 1000;
        },

        _applyTrafficFilters(all) {
            const search = this._trafficSearch.toLowerCase();
            let filtered = search ? all.filter((en) => en.url.toLowerCase().includes(search)) : all;
            if (this._trafficRecordedOnly) filtered = filtered.filter((en) => en.recordingSession);
            if (this._trafficProblemsOnly) filtered = filtered.filter((en) => this._isTrafficProblem(en));

            const reasonsByEntry = new Map();
            const payloadTerms = PayloadFilter.parseQuery(this._trafficPayloadFilter);
            if (payloadTerms.length) {
                filtered = filtered.filter((en) => {
                    const result = PayloadFilter.test(en, payloadTerms);
                    if (result.matched && result.reasons.length) reasonsByEntry.set(en, result.reasons);
                    return result.matched;
                });
            }
            return { filtered, reasonsByEntry };
        },

        _updateTrafficList() {
            const t = Theme.palette;
            const listEl = document.getElementById('ttd-pi-traffic-list');
            const detailEl = document.getElementById('ttd-pi-traffic-detail');
            const countEl = document.getElementById('ttd-pi-traffic-count');
            if (!listEl) return;

            const all = ObservedTraffic.all();
            const { filtered, reasonsByEntry } = this._applyTrafficFilters(all);
            const anyFilterActive = this._trafficSearch || this._trafficRecordedOnly || this._trafficProblemsOnly || this._trafficPayloadFilter;

            if (countEl) countEl.textContent = `${all.length} of up to ${ObservedTraffic.MAX_ENTRIES} kept, in-memory only (cleared on page reload). Excludes this tool's own blob:/data: URL noise (e.g. its Export downloads); everything else it can see gets captured, including its own network calls.`;

            if (this._selectedTrafficEntry && !filtered.includes(this._selectedTrafficEntry)) {
                this._selectedTrafficEntry = null;
            }

            if (!filtered.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">No traffic captured yet${anyFilterActive ? ' matching that filter' : ''}.</div>`;
                if (detailEl) detailEl.innerHTML = '';
                return;
            }
            if (!this._selectedTrafficEntry) this._selectedTrafficEntry = filtered[0];

            listEl.innerHTML = '';
            filtered.slice(0, 200).forEach((entry) => {
                const isSelected = entry === this._selectedTrafficEntry;
                const statusColor = entry.transport === 'form-submit' ? t.statusNeutral : (entry.status >= 200 && entry.status < 300 ? t.statusOk : t.statusBad);
                const row = document.createElement('div');
                row.style.cssText = `padding:6px 8px;font-size:11px;cursor:pointer;border-bottom:1px solid ${t.rowBorder};background:${isSelected ? t.secondaryBtnBg : 'transparent'};word-break:break-all;`;
                const recordedBadge = entry.recordingSession ? ' \u{1F534}' : '';

                const reasons = reasonsByEntry.get(entry);
                const reasonLine = reasons && reasons.length
                    ? `<br><span style="font-size:9px;color:${t.statusOk};">matched: ${reasons.map((r) => Helpers._escape(r)).join(', ')}</span>`
                    : '';
                row.innerHTML = `<span style="font-weight:700;">${Helpers._escape(entry.method)}</span> <span style="color:${statusColor};">${entry.status ?? (entry.transport === 'form-submit' ? 'navigated' : '?')}</span> ${Helpers._escape(Helpers._shortenUrl(entry.url))}${recordedBadge} <span style="color:${t.cardDesc};">- ${Helpers._timeAgo(entry.timestamp)}</span>${reasonLine}`;
                row.onclick = () => { this._selectedTrafficEntry = entry; this._updateTrafficList(); };
                listEl.appendChild(row);
            });

            this._renderTrafficDetail();
        },

        _renderTrafficDetail() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-traffic-detail');
            if (!el) return;
            const entry = this._selectedTrafficEntry;
            if (!entry) { el.innerHTML = ''; return; }

            const pretty = entry.json ? JSON.stringify(entry.json, null, 2) : (entry.rawText || '(no body captured)');
            const statusColor = entry.transport === 'form-submit' ? t.statusNeutral : (entry.status >= 200 && entry.status < 300 ? t.statusOk : t.statusBad);
            const hasJson = !!entry.json;
            if (hasJson && this._trafficTreeState?.root !== entry.json) {
                this._trafficTreeState = JsonTree.createState(entry.json);
            }
            if (!hasJson) this._trafficViewMode = 'raw';

            el.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-size:11px;color:${statusColor};font-weight:700;">${entry.method} ${entry.status ?? (entry.transport === 'form-submit' ? 'navigated' : '?')} - ${entry.durationMs}ms - ${entry.size?.toLocaleString() ?? '?'} bytes</span>
                    <div style="display:flex;gap:6px;">
                        <button id="ttd-pi-traffic-replay" style="${Helpers._secondaryBtnStyle(t)}">Replay / Edit</button>
                        <button id="ttd-pi-traffic-copy" style="${Helpers._secondaryBtnStyle(t)}">Copy</button>
                    </div>
                </div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:4px;word-break:break-all;">${Helpers._escape(entry.url)}</div>
                ${entry.transport === 'form-submit' ? `<div style="font-size:10px;color:${t.statusNeutral};margin-bottom:4px;">A real form submission, not fetch/XHR - the page navigated away before any response could be observed, so only the request side is captured.</div>` : ''}
                ${entry.contentType ? `<div style="font-size:10px;color:${t.cardDesc};margin-bottom:4px;">Content-Type: ${Helpers._escape(entry.contentType)}</div>` : ''}
                ${entry.recordingSession ? `<div style="font-size:10px;color:${t.statusBad};margin-bottom:4px;">\u{1F534} Captured during a recording session (started ${Helpers._timeAgo(entry.recordingSession)})</div>` : ''}
                ${Helpers._originBadge(entry.origin, t)}
                ${entry.requestBody ? `
                <div style="font-size:11px;font-weight:700;margin:6px 0 4px;">Request body</div>
                <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:100px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0;">${Helpers._escape(entry.requestBody)}</pre>` : ''}
                ${this._renderHeadersToggle(entry, t)}
                <div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0 4px;">
                    <span style="font-size:11px;font-weight:700;">Response</span>
                </div>
                ${hasJson ? `
                <div style="display:flex;gap:6px;margin-bottom:4px;">
                    <button id="ttd-pi-traffic-view-tree" style="${Helpers._pillStyle(t, this._trafficViewMode === 'tree')}padding:3px 8px;font-size:10px;">Tree</button>
                    <button id="ttd-pi-traffic-view-raw" style="${Helpers._pillStyle(t, this._trafficViewMode === 'raw')}padding:3px 8px;font-size:10px;">Raw</button>
                    ${this._trafficViewMode === 'tree' ? `<input id="ttd-pi-traffic-tree-search" type="text" placeholder="Search response" value="${Helpers._escape(this._trafficTreeState.search)}" style="flex:1;min-width:0;padding:3px 6px;font-size:10px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:4px;">` : ''}
                </div>` : ''}
                ${this._trafficViewMode === 'tree' && hasJson
                    ? `<div id="ttd-pi-traffic-tree" style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:220px;overflow:auto;"></div>`
                    : `<pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0;">${Helpers._escape(pretty)}</pre>`}
            `;

            if (hasJson) {
                document.getElementById('ttd-pi-traffic-view-tree').onclick = () => { this._trafficViewMode = 'tree'; this._renderTrafficDetail(); };
                document.getElementById('ttd-pi-traffic-view-raw').onclick = () => { this._trafficViewMode = 'raw'; this._renderTrafficDetail(); };
            }
            if (this._trafficViewMode === 'tree' && hasJson) {
                const treeEl = document.getElementById('ttd-pi-traffic-tree');
                JsonTree.render(treeEl, this._trafficTreeState, t);
                const searchInput = document.getElementById('ttd-pi-traffic-tree-search');
                searchInput.oninput = (e) => {
                    this._trafficTreeState.search = e.target.value;
                    JsonTree.render(treeEl, this._trafficTreeState, t);
                };
            }

            document.getElementById('ttd-pi-traffic-replay').onclick = () => this._openReplayEditor(entry);

            document.getElementById('ttd-pi-traffic-copy').onclick = async (e) => {

                const reqHeaderLines = entry.requestHeaders && Object.keys(entry.requestHeaders).length
                    ? Object.keys(entry.requestHeaders).map((k) => `  ${k}: ${entry.requestHeaders[k]}`).join('\n')
                    : '  (none set explicitly by the page)';
                const resHeaderLines = entry.responseHeaders && Object.keys(entry.responseHeaders).length
                    ? Object.keys(entry.responseHeaders).map((k) => `  ${k}: ${entry.responseHeaders[k]}`).join('\n')
                    : '  (none captured)';
                const combined = `${entry.method} ${entry.url}\nRequest headers:\n${reqHeaderLines}\nResponse headers:\n${resHeaderLines}\n${entry.requestBody ? `Request body: ${entry.requestBody}\n` : ''}\n${pretty}`;
                const ok = await copyToClipboard(combined);
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy'; }, 1200);
            };

            const headersToggle = document.getElementById('ttd-pi-traffic-headers-toggle');
            if (headersToggle) {
                headersToggle.onclick = () => {
                    const body = document.getElementById('ttd-pi-traffic-headers-body');
                    const showing = body.style.display !== 'none';
                    body.style.display = showing ? 'none' : 'block';
                    headersToggle.textContent = showing ? 'Show headers' : 'Hide headers';
                };
            }
        },

        _openReplayEditor(entry) {
            if (this._replaySweepRunning) { this._replaySweepRunning.stop(); this._replaySweepRunning = null; }
            if (this._replayAutoRunning) { this._replayAutoRunning.stop(); this._replayAutoRunning = null; }
            this._replaySweepLog = [];
            this._replayAutoLog = [];
            this._replaySendMode = 'standard';
            this._replayDraft = RequestReplay.draftFromEntry(entry);
            this._replayOriginalEntry = entry;
            this._replayResult = null;
            this._replaySending = false;
            this._renderReplayEditor();
        },

        
        _openReplayEditorWithToken(tok) {
            if (this._replaySweepRunning) { this._replaySweepRunning.stop(); this._replaySweepRunning = null; }
            if (this._replayAutoRunning) { this._replayAutoRunning.stop(); this._replayAutoRunning = null; }
            this._replaySweepLog = [];
            this._replayAutoLog = [];
            this._replaySendMode = 'standard';
            const headerName = (tok.source === 'request header' || tok.source === 'response header') && tok.location.includes(' - ')
                ? tok.location.split(' - ').pop()
                : 'Authorization';
            const looksBearer = /^authorization$/i.test(headerName) && !/^Bearer\s/i.test(tok.value);
            const headerValue = looksBearer ? `Bearer ${tok.value}` : tok.value;

            this._replayDraft = {
                method: 'GET',
                url: location.origin,
                headersText: `${headerName}: ${headerValue}`,
                body: ''
            };
            this._replayOriginalEntry = null;
            this._replayResult = null;
            this._replaySending = false;
            this._renderReplayEditor();
        },

        _renderReplayEditor() {
            const t = Theme.palette;
            document.getElementById('ttd-replay-panel')?.remove();
            const draft = this._replayDraft;

            const panel = document.createElement('div');
            panel.id = 'ttd-replay-panel';
            panel.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:320px;max-width:92vw;max-height:85vh;overflow-y:auto;background:${t.panelBg};color:${t.panelText};border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.6);z-index:999999;padding:16px;font-size:13px;`;
            panel.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:14px;font-weight:700;">Replay / Edit request</span>
                    <button id="ttd-replay-close" style="background:none;border:none;color:${t.panelText};cursor:pointer;font-size:20px;line-height:1;">\u00D7</button>
                </div>
                <div style="font-size:10px;color:${t.statusWarn};margin-bottom:10px;">Sending fires one real request against the live server, using this page's current session/cookies. Nothing is queued or repeated automatically - each send is a single action you trigger.</div>

                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Send mode</div>
                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <button id="ttd-replay-mode-standard" style="${Helpers._pillStyle(t, this._replaySendMode !== 'privileged')}flex:1;">Standard (fetch)</button>
                    <button id="ttd-replay-mode-privileged" style="${Helpers._pillStyle(t, this._replaySendMode === 'privileged')}flex:1;" ${RequestReplay.privilegedAvailable() ? '' : 'disabled'}>Privileged (GM)</button>
                </div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:10px;">${this._replaySendMode === 'privileged'
                    ? (RequestReplay.privilegedAvailable()
                        ? 'Uses GM_xmlhttpRequest instead of the page\'s fetch/XHR. For Cookie/Origin/Referer specifically, userscript managers rely on a browser-level trick (a blocking webRequest swap) to get these past the browser at all - Chrome removed the API that trick depends on in Manifest V3, so whether it actually works depends entirely on your browser and userscript manager version, and can fail two different ways: silently stripped, or sent with a mangled/salted header name instead of the real one. Cookie specifically appends to the real cookie jar rather than replacing it, even when it does work. Host still can\'t be touched by either mode - that\'s tied to the connection itself. Use Test header pass-through below to see exactly what your setup actually does, rather than trusting this description.'
                        : 'GM_xmlhttpRequest isn\'t available in this build/manager - falling back to Standard.')
                    : 'Uses the page\'s own fetch() - Cookie, Host, Origin, Referer, and a few other headers are blocked by the Fetch spec itself here, regardless of what\'s typed below. Switch to Privileged to attempt most of those (results vary by setup - see its own note).'}</div>
                ${this._replaySendMode === 'privileged' && RequestReplay.privilegedAvailable() ? `
                <div style="margin-bottom:10px;">
                    <button id="ttd-replay-test-headers" style="${Helpers._secondaryBtnStyle(t)}width:100%;">Test header pass-through</button>
                    <div id="ttd-replay-test-headers-result" style="margin-top:6px;"></div>
                </div>` : ''}

                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Method</div>
                <select id="ttd-replay-method" style="width:100%;padding:6px;margin-bottom:8px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">
                    ${['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => `<option value="${m}" ${draft.method.toUpperCase() === m ? 'selected' : ''}>${m}</option>`).join('')}
                </select>

                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">URL</div>
                <input id="ttd-replay-url" type="text" value="${Helpers._escape(draft.url)}" style="width:100%;box-sizing:border-box;padding:6px;margin-bottom:8px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;word-break:break-all;">

                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Headers (one per line, "Name: Value")${this._replaySendMode === 'privileged'
                    ? ' - Cookie, Origin, and Referer are attempted in this mode, but reliability depends on your browser/manager (see Test header pass-through above) - Cookie in particular tends to append to the real cookie jar rather than replacing it, even when it "works". Host still gets stripped (tied to the actual connection, not a header this or any client-side tool can override). Sending shows exactly what got dropped.'
                    : ' - you can type Cookie, Host, Origin, and other browser-controlled headers here, but they\'ll be silently stripped by the browser itself before sending regardless of what\'s typed - that\'s a Fetch spec restriction no userscript can override in this mode. Switch to Privileged send above to attempt most of these. Sending shows exactly which ones (if any) got dropped.'}</div>
                <textarea id="ttd-replay-headers" style="width:100%;height:70px;box-sizing:border-box;padding:6px;margin-bottom:8px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:10px;font-family:monospace;">${Helpers._escape(draft.headersText)}</textarea>

                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Body${draft.method === 'GET' ? ' (ignored for GET)' : ''}</div>
                <textarea id="ttd-replay-body" style="width:100%;height:80px;box-sizing:border-box;padding:6px;margin-bottom:10px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:10px;font-family:monospace;">${Helpers._escape(draft.body)}</textarea>

                <button id="ttd-replay-send" style="${Helpers._primaryBtnStyle()}width:100%;margin-bottom:10px;" ${this._replaySending ? 'disabled' : ''}>${this._replaySending ? 'Sending...' : 'Send request'}</button>

                <div id="ttd-replay-result"></div>

                <div style="border-top:1px solid ${t.rowBorder};margin:12px 0;"></div>

                <div style="font-size:12px;font-weight:700;margin-bottom:4px;">Parameter sweep</div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">Put a placeholder token anywhere in the URL, headers, or body above, then send one real request per value in the list below with that token substituted in. Each send is still a real request to the live server - this just automates repeating it.</div>
                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <input id="ttd-replay-sweep-placeholder" type="text" value="${Helpers._escape(this._replaySweepPlaceholder)}" placeholder="{{VALUE}}" style="flex:1;min-width:0;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;font-family:monospace;">
                    <input id="ttd-replay-sweep-delay" type="number" min="${RequestReplay.MIN_SWEEP_DELAY_MS}" step="50" value="${this._replaySweepDelay}" title="delay between sends (ms)" style="width:80px;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                </div>
                <textarea id="ttd-replay-sweep-values" rows="2" placeholder="Values to sweep, comma or newline separated (e.g. 1,2,3 or a,b,c)" style="width:100%;box-sizing:border-box;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;font-family:monospace;">${Helpers._escape(this._replaySweepValuesText)}</textarea>
                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <button id="ttd-replay-sweep-run" style="${Helpers._primaryBtnStyle()}flex:1;" ${this._replaySweepRunning ? 'disabled' : ''}>${this._replaySweepRunning ? 'Running...' : 'Run sweep'}</button>
                    ${this._replaySweepRunning ? `<button id="ttd-replay-sweep-stop" style="${Helpers._secondaryBtnStyle(t)}color:${t.statusBad};">Stop</button>` : ''}
                </div>
                <div id="ttd-replay-sweep-log" style="${this._replaySweepLog.length ? '' : 'display:none;'}"></div>

                <div style="border-top:1px solid ${t.rowBorder};margin:12px 0;"></div>

                <div style="font-size:12px;font-weight:700;margin-bottom:4px;">Repeat / automation</div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">Sends the exact request above repeatedly on an interval - a poller, not a one-off. Minimum interval ${RequestReplay.MIN_AUTOMATION_INTERVAL_MS}ms, enforced here so this can't be used to hammer a server faster than that regardless of what's typed.</div>
                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <div style="flex:1;">
                        <div style="font-size:9px;color:${t.cardDesc};margin-bottom:2px;">interval (ms)</div>
                        <input id="ttd-replay-auto-interval" type="number" min="${RequestReplay.MIN_AUTOMATION_INTERVAL_MS}" step="100" value="${this._replayAutoInterval}" style="width:100%;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                    </div>
                    <div style="flex:1;">
                        <div style="font-size:9px;color:${t.cardDesc};margin-bottom:2px;">max runs (0 = until stopped)</div>
                        <input id="ttd-replay-auto-maxruns" type="number" min="0" step="1" value="${this._replayAutoMaxRuns}" style="width:100%;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                    </div>
                </div>
                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <button id="ttd-replay-auto-run" style="${Helpers._primaryBtnStyle()}flex:1;" ${this._replayAutoRunning ? 'disabled' : ''}>${this._replayAutoRunning ? 'Running...' : 'Start'}</button>
                    ${this._replayAutoRunning ? `<button id="ttd-replay-auto-stop" style="${Helpers._secondaryBtnStyle(t)}color:${t.statusBad};">Stop</button>` : ''}
                </div>
                <div id="ttd-replay-auto-log" style="${this._replayAutoLog.length ? '' : 'display:none;'}"></div>

                <div style="border-top:1px solid ${t.rowBorder};margin:12px 0;"></div>

                <div id="ttd-replay-history-section"></div>
            `;
            document.body.appendChild(panel);

            document.getElementById('ttd-replay-close').onclick = () => {
                if (this._replaySweepRunning) { this._replaySweepRunning.stop(); this._replaySweepRunning = null; }
                if (this._replayAutoRunning) { this._replayAutoRunning.stop(); this._replayAutoRunning = null; }
                panel.remove();
                this._renderTrafficDetail();
            };
            document.getElementById('ttd-replay-method').onchange = (e) => { this._replayDraft.method = e.target.value; this._renderReplayEditor(); };
            document.getElementById('ttd-replay-mode-standard').onclick = () => { this._replaySendMode = 'standard'; this._renderReplayEditor(); };
            const privilegedBtn = document.getElementById('ttd-replay-mode-privileged');
            if (privilegedBtn && !privilegedBtn.disabled) privilegedBtn.onclick = () => { this._replaySendMode = 'privileged'; this._renderReplayEditor(); };
            const testHeadersBtn = document.getElementById('ttd-replay-test-headers');
            if (testHeadersBtn) testHeadersBtn.onclick = () => this._runTestHeaderPassthrough();
            document.getElementById('ttd-replay-url').oninput = (e) => { this._replayDraft.url = e.target.value; };
            document.getElementById('ttd-replay-headers').oninput = (e) => { this._replayDraft.headersText = e.target.value; };
            document.getElementById('ttd-replay-body').oninput = (e) => { this._replayDraft.body = e.target.value; };
            document.getElementById('ttd-replay-send').onclick = () => this._sendReplay();

            document.getElementById('ttd-replay-sweep-placeholder').oninput = (e) => { this._replaySweepPlaceholder = e.target.value; };
            document.getElementById('ttd-replay-sweep-delay').oninput = (e) => { this._replaySweepDelay = e.target.value; };
            document.getElementById('ttd-replay-sweep-values').oninput = (e) => { this._replaySweepValuesText = e.target.value; };
            document.getElementById('ttd-replay-sweep-run').onclick = () => this._runReplaySweep();
            const sweepStopBtn = document.getElementById('ttd-replay-sweep-stop');
            if (sweepStopBtn) sweepStopBtn.onclick = () => {
                if (this._replaySweepRunning) this._replaySweepRunning.stop();
                this._replaySweepRunning = null;
                this._renderReplayEditor();
            };

            document.getElementById('ttd-replay-auto-interval').oninput = (e) => { this._replayAutoInterval = e.target.value; };
            document.getElementById('ttd-replay-auto-maxruns').oninput = (e) => { this._replayAutoMaxRuns = e.target.value; };
            document.getElementById('ttd-replay-auto-run').onclick = () => this._runReplayAutomation();
            const autoStopBtn = document.getElementById('ttd-replay-auto-stop');
            if (autoStopBtn) autoStopBtn.onclick = () => {
                if (this._replayAutoRunning) this._replayAutoRunning.stop();
                this._replayAutoRunning = null;
                this._renderReplayEditor();
            };

            this._renderReplaySweepLog();
            this._renderReplayAutoLog();

            if (this._replayResult) this._renderReplayResult();
            this._renderReplayHistorySection();
        },

        async _runTestHeaderPassthrough() {
            const t = Theme.palette;
            const btn = document.getElementById('ttd-replay-test-headers');
            const resultEl = document.getElementById('ttd-replay-test-headers-result');
            if (btn) { btn.disabled = true; btn.textContent = 'Testing...'; }
            if (resultEl) resultEl.innerHTML = `<div style="${Helpers._noteStyle()}">Setting a real control cookie, then sending a probe request to httpbin.org to see what actually arrives...</div>`;

            const result = await RequestReplay.testHeaderPassthrough();

            if (btn) { btn.disabled = false; btn.textContent = 'Test header pass-through'; }
            if (!resultEl) return;

            if (!result.ok) {
                resultEl.innerHTML = `<div style="font-size:11px;color:${t.statusBad};">${Helpers._escape(result.error)}</div>`;
                return;
            }

            const statusColor = { passed: t.statusOk, appended: t.statusWarn, overridden: t.statusWarn, ignored: t.statusBad, stripped: t.statusBad, mangled: t.statusBad };
            const statusLabel = {
                passed: 'passed through cleanly',
                appended: 'appended (real value also present)',
                overridden: 'genuinely overrode the real cookie',
                ignored: 'ignored - only the real cookie went out',
                stripped: 'stripped',
                mangled: 'mangled - received something, not what was sent'
            };

            const genericRows = result.results.filter((r) => r.name !== 'Cookie').map((r) => `
                <div style="padding:6px 8px;border-bottom:1px solid ${t.rowBorder};font-size:11px;">
                    <div><b>${Helpers._escape(r.name)}</b> - <span style="color:${statusColor[r.status]};font-weight:700;">${statusLabel[r.status]}</span></div>
                    <div style="font-size:10px;color:${t.cardDesc};word-break:break-all;margin-top:2px;">sent: ${Helpers._escape(r.sent)}</div>
                    <div style="font-size:10px;color:${t.cardDesc};word-break:break-all;">received: ${r.got ? Helpers._escape(r.got) : '(nothing)'}</div>
                </div>
            `).join('');

            const cookieRow = result.results.find((r) => r.name === 'Cookie');
            const cookieHtml = cookieRow ? `
                <div style="padding:6px 8px;border-bottom:1px solid ${t.rowBorder};font-size:11px;">
                    <div><b>Cookie</b> - <span style="color:${statusColor[cookieRow.status]};font-weight:700;">${statusLabel[cookieRow.status]}</span></div>
                    <div style="font-size:10px;color:${t.cardDesc};margin-top:2px;">A real "control" cookie (${Helpers._escape(cookieRow.controlName)}=${Helpers._escape(cookieRow.controlValue)}) was set via a genuine Set-Cookie response first, so this checks against your actual cookie jar rather than an empty one.</div>
                    <div style="font-size:10px;margin-top:4px;color:${cookieRow.hasControl ? t.statusOk : t.statusBad};">control cookie present: ${cookieRow.hasControl ? 'yes' : 'no'}</div>
                    <div style="font-size:10px;color:${cookieRow.hasProbe ? t.statusOk : t.statusBad};">typed-in value present: ${cookieRow.hasProbe ? 'yes' : 'no'}</div>
                    <div style="font-size:10px;color:${t.cardDesc};word-break:break-all;margin-top:4px;">received Cookie header: ${cookieRow.got ? Helpers._escape(cookieRow.got) : '(nothing)'}</div>
                </div>
            ` : '';

            resultEl.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">What httpbin.org actually saw, this run, on this browser/manager:</div>
                <div style="border:1px solid ${t.rowBorder};border-radius:6px;">
                    ${genericRows}
                    ${cookieHtml}
                </div>
                <div style="font-size:10px;color:${t.cardDesc};margin-top:6px;">Host, for reference (never settable by either mode): ${Helpers._escape(result.hostSeen || '(not reported)')}</div>
            `;
        },

        _parseSweepValues(text) {
            return (text || '')
                .split(/[\n,]/)
                .map((v) => v.trim())
                .filter((v) => v.length > 0);
        },

        _runReplaySweep() {
            const values = this._parseSweepValues(this._replaySweepValuesText);
            if (!values.length) { alert('Enter at least one value to sweep.'); return; }
            const placeholder = (this._replaySweepPlaceholder || '').trim();
            if (!placeholder) { alert('Enter a placeholder token first (e.g. {{VALUE}}).'); return; }
            const usesPlaceholder = [this._replayDraft.url, this._replayDraft.headersText, this._replayDraft.body].some((s) => (s || '').includes(placeholder));
            if (!usesPlaceholder) { alert(`The placeholder "${placeholder}" doesn't appear anywhere in the URL, headers, or body above - nothing would actually vary between sends.`); return; }
            if (!confirm(`Run this sweep against the live server using ${this._replaySendMode === 'privileged' ? 'Privileged (GM_xmlhttpRequest)' : 'Standard (fetch)'} send? It'll send ${values.length} real request${values.length === 1 ? '' : 's'}, one per value, ${Math.max(RequestReplay.MIN_SWEEP_DELAY_MS, Number(this._replaySweepDelay) || 0)}ms apart.`)) return;

            const template = { ...this._replayDraft };
            this._replaySweepLog = [];
            this._replaySweepRunning = RequestReplay.runSweep(template, placeholder, values, this._replaySweepDelay, this._replaySendMode, {
                onStep: (stepIndex, value, result) => {
                    this._replaySweepLog.push({ value, ok: result.ok, status: result.ok ? result.status : null, durationMs: result.durationMs, error: result.ok ? null : result.error, timestamp: Date.now() });
                    this._renderReplaySweepLog();
                },
                onDone: () => {
                    this._replaySweepRunning = null;
                    this._renderReplayEditor();
                }
            });
            this._renderReplayEditor();
        },

        _renderReplaySweepLog() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-replay-sweep-log');
            if (!el) return;
            if (!this._replaySweepLog.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
            el.style.display = '';
            el.innerHTML = `
                <div style="font-size:11px;font-weight:700;margin:6px 0 4px;">Sweep results (${this._replaySweepLog.length})</div>
                <div style="max-height:140px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;">
                    ${this._replaySweepLog.slice().reverse().map((l) => `
                        <div style="padding:5px 8px;border-bottom:1px solid ${t.rowBorder};font-size:10px;">
                            <b>${Helpers._escape(String(l.value))}</b> - ${l.ok ? `<span style="color:${l.status >= 200 && l.status < 300 ? t.statusOk : t.statusBad};">${l.status}</span> - ${l.durationMs}ms` : `<span style="color:${t.statusBad};">${Helpers._escape(l.error)}</span>`}
                        </div>
                    `).join('')}
                </div>
            `;
        },

        _runReplayAutomation() {
            const maxRuns = Number(this._replayAutoMaxRuns) || 0;
            const interval = Math.max(RequestReplay.MIN_AUTOMATION_INTERVAL_MS, Number(this._replayAutoInterval) || 0);
            const runsDesc = maxRuns > 0 ? `${maxRuns} times` : 'indefinitely, until you stop it';
            if (!confirm(`Start sending this exact request every ${interval}ms, ${runsDesc}, using ${this._replaySendMode === 'privileged' ? 'Privileged (GM_xmlhttpRequest)' : 'Standard (fetch)'} send? Each send is a real request against the live server.`)) return;

            const template = { ...this._replayDraft };
            this._replayAutoLog = [];
            this._replayAutoRunning = RequestReplay.runAutomation(template, interval, maxRuns, this._replaySendMode, {
                onStep: (count, result) => {
                    this._replayAutoLog.push({ count, ok: result.ok, status: result.ok ? result.status : null, durationMs: result.durationMs, error: result.ok ? null : result.error, timestamp: Date.now() });
                    this._renderReplayAutoLog();
                },
                onDone: () => {
                    this._replayAutoRunning = null;
                    this._renderReplayEditor();
                }
            });
            this._renderReplayEditor();
        },

        _renderReplayAutoLog() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-replay-auto-log');
            if (!el) return;
            if (!this._replayAutoLog.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
            el.style.display = '';
            el.innerHTML = `
                <div style="font-size:11px;font-weight:700;margin:6px 0 4px;">Run log (${this._replayAutoLog.length})</div>
                <div style="max-height:140px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;">
                    ${this._replayAutoLog.slice().reverse().map((l) => `
                        <div style="padding:5px 8px;border-bottom:1px solid ${t.rowBorder};font-size:10px;">
                            <b>#${l.count}</b> - ${l.ok ? `<span style="color:${l.status >= 200 && l.status < 300 ? t.statusOk : t.statusBad};">${l.status}</span> - ${l.durationMs}ms` : `<span style="color:${t.statusBad};">${Helpers._escape(l.error)}</span>`} <span style="color:${t.cardDesc};">- ${Helpers._timeAgo(l.timestamp)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        },

        _renderReplayHistorySection() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-replay-history-section');
            if (!el) return;
            const entries = ReplayHistory.all();

            if (!entries.length) {
                el.innerHTML = `<div style="font-size:10px;color:${t.cardDesc};margin-top:10px;">No sends yet this session.</div>`;
                return;
            }

            const rows = entries.map((entry, i) => {
                const statusText = entry.result.ok ? `${entry.result.status} - ${entry.result.durationMs}ms` : `failed: ${entry.result.error}`;
                const statusColor = entry.result.ok && entry.result.status >= 200 && entry.result.status < 300 ? t.statusOk : t.statusBad;
                return `
                    <div data-idx="${i}" style="padding:6px 8px;font-size:10px;cursor:pointer;border-bottom:1px solid ${t.rowBorder};word-break:break-all;">
                        <b>${Helpers._escape(entry.draft.method)}</b> ${Helpers._escape(Helpers._shortenUrl(entry.draft.url))}<br>
                        <span style="color:${statusColor};">${Helpers._escape(statusText)}</span> <span style="color:${t.cardDesc};">- ${Helpers._timeAgo(entry.timestamp)}</span>
                    </div>
                `;
            }).join('');

            el.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;margin-bottom:4px;">
                    <span style="font-size:11px;font-weight:700;">Session history (${entries.length})</span>
                    <button id="ttd-replay-history-clear" style="${Helpers._secondaryBtnStyle(t)}font-size:10px;padding:3px 8px;">Clear</button>
                </div>
                <div style="max-height:160px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;">${rows}</div>
            `;

            document.getElementById('ttd-replay-history-clear').onclick = () => {
                if (!confirm('Clear this session\'s replay history? This cannot be undone.')) return;
                ReplayHistory.clear();
                this._renderReplayHistorySection();
            };

            el.querySelectorAll('[data-idx]').forEach((row) => {
                row.onclick = () => {
                    const entry = entries[Number(row.getAttribute('data-idx'))];

                    this._replayDraft = { method: entry.draft.method, url: entry.draft.url, headersText: entry.draft.headersText, body: entry.draft.body };
                    this._replayOriginalEntry = entry.original;
                    this._replayResult = entry.result;
                    this._renderReplayEditor();
                };
            });
        },

        async _sendReplay() {
            if (this._replaySending) return; 
            const modeLabel = this._replaySendMode === 'privileged' ? 'Privileged (GM_xmlhttpRequest)' : 'Standard (fetch, this page\'s current session)';
            if (!confirm(`Send this request to the live server now, using ${modeLabel}? This is a real, one-time request - nothing is repeated automatically.`)) return;
            this._replaySending = true;
            this._replayResult = null;
            this._renderReplayEditor();

            const result = await RequestReplay.sendWithMode(this._replayDraft, this._replaySendMode);

            this._replaySending = false;
            this._replayResult = result;
            ReplayHistory.add(this._replayDraft, this._replayOriginalEntry, result);
            this._renderReplayEditor();
        },

        _renderReplayResult() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-replay-result');
            if (!el) return;
            const r = this._replayResult;
            const original = this._replayOriginalEntry;
            const modeTag = r.privileged ? 'Privileged (GM_xmlhttpRequest)' : 'Standard (fetch)';
            const strippedNote = (r.strippedHeaders && r.strippedHeaders.length)
                ? `<div style="font-size:10px;color:${t.statusWarn};margin-bottom:6px;">${r.privileged ? 'Still can\'t be set even in Privileged mode' : 'Stripped by the browser before sending in Standard mode'}: ${r.strippedHeaders.map((h) => Helpers._escape(h)).join(', ')}</div>`
                : '';
            const modeNote = `<div style="font-size:9px;color:${t.cardDesc};margin-bottom:4px;">Sent via ${modeTag}</div>`;

            if (!r.ok) {
                el.innerHTML = `<div style="font-size:11px;color:${t.statusBad};font-weight:700;margin-bottom:4px;">Request failed</div>${modeNote}${strippedNote}<div style="font-size:10px;color:${t.cardDesc};">${Helpers._escape(r.error)}</div>`;
                return;
            }

            const pretty = r.json ? JSON.stringify(r.json, null, 2) : (r.rawText || '(empty body)');
            const statusColor = r.status >= 200 && r.status < 300 ? t.statusOk : t.statusBad;
            const originalStatusColor = original && original.status >= 200 && original.status < 300 ? t.statusOk : t.statusBad;

            el.innerHTML = `
                <div style="font-size:11px;font-weight:700;margin-bottom:2px;">Replay response</div>
                ${modeNote}
                <div style="font-size:11px;color:${statusColor};font-weight:700;margin-bottom:4px;">${r.status} ${Helpers._escape(r.statusText || '')} - ${r.durationMs}ms</div>
                ${original ? `<div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">Original was <span style="color:${originalStatusColor};font-weight:700;">${original.status}</span> - ${original.durationMs}ms</div>` : ''}
                ${strippedNote}
                <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0 0 8px;">${Helpers._escape(pretty)}</pre>
                <button id="ttd-replay-copy-result" style="${Helpers._secondaryBtnStyle(t)}width:100%;">Copy replay response</button>
            `;

            document.getElementById('ttd-replay-copy-result').onclick = async (e) => {
                const ok = await copyToClipboard(pretty);
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy replay response'; }, 1200);
            };
        },

        _renderHeadersToggle(entry, t) {
            const reqLines = entry.requestHeaders && Object.keys(entry.requestHeaders).length
                ? Object.keys(entry.requestHeaders).map((k) => `${k}: ${entry.requestHeaders[k]}`).join('\n')
                : '(none set explicitly by the page - browser-added headers like Cookie are never visible to script)';
            const resLines = entry.responseHeaders && Object.keys(entry.responseHeaders).length
                ? Object.keys(entry.responseHeaders).map((k) => `${k}: ${entry.responseHeaders[k]}`).join('\n')
                : '(none captured)';
            return `
                <div style="margin:4px 0;">
                    <span id="ttd-pi-traffic-headers-toggle" style="font-size:10px;text-decoration:underline;cursor:pointer;color:${t.cardDesc};">Show headers</span>
                    <div id="ttd-pi-traffic-headers-body" style="display:none;margin-top:4px;">
                        <div style="font-size:10px;font-weight:700;margin-bottom:2px;">Request</div>
                        <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:6px;max-height:100px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0 0 6px;">${Helpers._escape(reqLines)}</pre>
                        <div style="font-size:10px;font-weight:700;margin-bottom:2px;">Response</div>
                        <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:6px;max-height:100px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0;">${Helpers._escape(resLines)}</pre>
                    </div>
                </div>
            `;
        },

        _renderWebSocket() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            const enabled = Config.wsCaptureEnabled;

            const toggleBlock = `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:8px;">
                    <div>
                        <div style="font-size:11px;font-weight:700;">WebSocket capture: ${enabled ? 'ON' : 'OFF'}</div>
                        <div style="font-size:10px;color:${t.cardDesc};">Off by default - a WebSocket is often a continuous stream of a game's real-time state, more than a one-off request. This setting persists across reloads.</div>
                    </div>
                    <button id="ttd-pi-ws-toggle" style="${enabled ? Helpers._secondaryBtnStyle(t) : Helpers._primaryBtnStyle()}white-space:nowrap;margin-left:8px;flex:0 0 auto;width:auto;">${enabled ? 'Turn off' : 'Turn on'}</button>
                </div>
            `;

            if (!enabled) {
                area.innerHTML = `
                    ${toggleBlock}
                    <div style="font-size:11px;color:${t.cardDesc};">Capture is off, so nothing is being hooked or recorded right now. Turn it on above to start watching this page's WebSocket connections - takes effect immediately, no reload needed.</div>
                `;
                document.getElementById('ttd-pi-ws-toggle').onclick = () => {
                    WebSocketMonitor.enable();
                    this._renderWebSocket();
                };
                return;
            }

            const connections = WebSocketMonitor.all();

            const isHooked = typeof window.WebSocket === 'function' && window.WebSocket.__ttdHooked === true;

            area.innerHTML = `
                ${toggleBlock}
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">${connections.length} of up to ${WebSocketMonitor.MAX_CONNECTIONS} connections kept, in-memory only (cleared on page reload) - up to ${WebSocketMonitor.MAX_MESSAGES_PER_CONNECTION} messages per connection.</div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">If a page's own real-time connection isn't showing up here, it may not have opened one yet, may use a non-WebSocket transport, or its library may check window.WebSocket only once at load time (if this hook installed before that, it should still be caught - see Hook status below).</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:10px;color:${isHooked ? t.statusOk : t.statusBad};font-weight:700;">Hook status: ${isHooked ? 'installed' : 'NOT installed (window.WebSocket is not our wrapper right now)'}</span>
                    <button id="ttd-pi-ws-test" style="${Helpers._secondaryBtnStyle(t)}">Test connect</button>
                </div>
                <div id="ttd-pi-ws-test-result" style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;"></div>
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <button id="ttd-pi-ws-mode-connections" style="${Helpers._pillStyle(t, this._wsViewMode !== 'catalog' && this._wsViewMode !== 'send')}flex:1;">Connections</button>
                    <button id="ttd-pi-ws-mode-catalog" style="${Helpers._pillStyle(t, this._wsViewMode === 'catalog')}flex:1;">Message catalog (${WebSocketMonitor.catalog().length})</button>
                    <button id="ttd-pi-ws-mode-send" style="${Helpers._pillStyle(t, this._wsViewMode === 'send')}flex:1;">Send / Sequence</button>
                </div>
                <div id="ttd-pi-ws-list" style="max-height:150px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:8px;${this._wsViewMode === 'catalog' || this._wsViewMode === 'send' ? 'display:none;' : ''}"></div>
                <div id="ttd-pi-ws-messages" style="${this._wsViewMode === 'catalog' || this._wsViewMode === 'send' ? 'display:none;' : ''}"></div>
                <div id="ttd-pi-ws-detail" style="margin-top:8px;${this._wsViewMode === 'catalog' || this._wsViewMode === 'send' ? 'display:none;' : ''}"></div>
                <div id="ttd-pi-ws-catalog" style="${this._wsViewMode === 'catalog' ? '' : 'display:none;'}"></div>
                <div id="ttd-pi-ws-send" style="${this._wsViewMode === 'send' ? '' : 'display:none;'}"></div>
            `;

            document.getElementById('ttd-pi-ws-mode-connections').onclick = () => { this._wsViewMode = 'connections'; this._renderWebSocket(); };
            document.getElementById('ttd-pi-ws-mode-catalog').onclick = () => { this._wsViewMode = 'catalog'; this._renderWebSocket(); };
            document.getElementById('ttd-pi-ws-mode-send').onclick = () => { this._wsViewMode = 'send'; this._renderWebSocket(); };
            if (this._wsViewMode === 'catalog') this._renderWsCatalog();
            if (this._wsViewMode === 'send') this._renderWsSendPanel();

            document.getElementById('ttd-pi-ws-toggle').onclick = () => {
                if (!confirm('Turn off WebSocket capture? This takes effect on the next page reload - connections already open right now will keep being tracked until then. Already-captured connections and messages stay visible until you reload or clear them.')) return;
                WebSocketMonitor.disable();
                this._renderWebSocket();
            };

            document.getElementById('ttd-pi-ws-test').onclick = () => {
                const resultEl = document.getElementById('ttd-pi-ws-test-result');
                const cspViolations = [];
                const cspListener = (e) => {
                    if (e.violatedDirective && e.violatedDirective.indexOf('connect-src') !== -1) {
                        cspViolations.push(e.violatedDirective);
                    }
                };
                document.addEventListener('securitypolicyviolation', cspListener);

                try {
                    
                    new window.WebSocket('wss://echo.websocket.org');
                    resultEl.textContent = 'Test connection attempted - check the list below for its status.';
                    resultEl.style.color = t.statusOk;
                } catch (e) {
                    resultEl.textContent = `Failed to open test connection: ${e.message}`;
                    resultEl.style.color = t.statusBad;
                }

                setTimeout(() => {
                    document.removeEventListener('securitypolicyviolation', cspListener);
                    if (cspViolations.length) {
                        resultEl.textContent = `Confirmed: blocked by this page's connect-src CSP (${cspViolations.join(', ')}) - echo.websocket.org isn't an allowed destination here, not a hook problem. The hook still correctly intercepted and tracked the attempt (see the list below), which is the actual thing this test was checking.`;
                        resultEl.style.color = t.statusWarn;
                    }
                    this._renderWebSocket();
                }, 500); 
            };

            const listEl = document.getElementById('ttd-pi-ws-list');
            if (!connections.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">No WebSocket connections observed yet.</div>`;
                return;
            }
            if (!this._selectedWsConnection || !connections.includes(this._selectedWsConnection)) {
                this._selectedWsConnection = connections[0];
            }

            const statusColors = { connecting: t.statusWarn, open: t.statusOk, closed: t.cardDesc, error: t.statusBad };
            connections.forEach((c) => {
                const isSelected = c === this._selectedWsConnection;
                const row = document.createElement('div');
                row.style.cssText = `padding:6px 8px;font-size:11px;cursor:pointer;border-bottom:1px solid ${t.rowBorder};background:${isSelected ? t.secondaryBtnBg : 'transparent'};word-break:break-all;`;
                row.innerHTML = `<span style="color:${statusColors[c.status] || t.rowText};font-weight:700;">${Helpers._escape(c.status)}</span> ${Helpers._escape(c.url)}<br><span style="font-size:10px;color:${t.cardDesc};">${c.messages.length} messages - opened ${Helpers._timeAgo(c.openedAt)}</span>`;
                row.onclick = () => { this._selectedWsConnection = c; this._selectedWsMessage = null; this._renderWebSocket(); };
                listEl.appendChild(row);
            });

            this._renderWsMessages();
        },

        _renderWsCatalog() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-ws-catalog');
            if (!el) return;
            const entries = WebSocketMonitor.catalog();
            if (!entries.length) {
                el.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">No messages captured yet.</div>`;
                return;
            }
            el.innerHTML = entries.map((e) => `
                <div style="padding:6px 8px;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:6px;font-size:11px;">
                    <div><span style="color:${e.direction === 'in' ? t.statusOk : t.statusWarn};font-weight:700;">${e.direction === 'in' ? 'received' : 'sent'}</span> - ${e.count}x - ${Helpers._escape(Helpers._shortenUrl(e.url))} <span style="color:${t.cardDesc};font-size:10px;">last ${Helpers._timeAgo(e.lastSeen)}</span></div>
                    <div style="font-size:10px;color:${t.cardDesc};word-break:break-all;">shape: ${Helpers._escape(e.shape)}</div>
                    <div style="font-size:10px;color:${t.cardDesc};word-break:break-all;margin-top:2px;">sample: ${Helpers._escape(e.sample)}</div>
                </div>
            `).join('');
        },

        
        _renderWsSendPanel() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-ws-send');
            if (!el) return;

            const connections = WebSocketMonitor.all();
            if (!this._selectedWsConnection || !connections.includes(this._selectedWsConnection)) {
                this._selectedWsConnection = connections[0] || null;
            }
            const conn = this._selectedWsConnection;
            if (this._wsResendDraft === null && conn && conn.messages.length) {
                this._wsResendDraft = conn.messages[conn.messages.length - 1].text;
            }

            const connOptions = connections.map((c, i) => `<option value="${i}" ${c === conn ? 'selected' : ''}>${c.status} - ${Helpers._escape(Helpers._shortenUrl(c.url))} (${c.messages.length} msgs)</option>`).join('');
            const canSend = WebSocketMonitor.canSend(conn);

            el.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Sends real messages out over a live connection this page opened, using the same .send() the page itself would call. There's no undo - the other end (usually a game server) receives it exactly as sent.</div>
                <div style="margin-bottom:8px;">
                    <div style="font-size:10px;color:${t.cardDesc};margin-bottom:3px;">Target connection</div>
                    ${connections.length
                        ? `<select id="ttd-pi-ws-send-target" style="width:100%;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">${connOptions}</select>`
                        : `<div style="font-size:11px;color:${t.cardDesc};">No connections observed yet.</div>`}
                    ${conn ? `<div style="font-size:10px;margin-top:3px;color:${canSend ? t.statusOk : t.statusBad};">${canSend ? 'Open - ready to send' : `Not open (status: ${Helpers._escape(conn.status)}) - can't send here anymore.`}</div>` : ''}
                </div>

                <div style="${Helpers._cardStyle(t)}margin-bottom:8px;">
                    <div style="font-size:11px;font-weight:700;margin-bottom:6px;">Modify &amp; resend</div>
                    <div style="font-size:10px;color:${t.cardDesc};margin-bottom:4px;">Prefilled with the connection's most recent message - edit freely, or paste anything.</div>
                    <textarea id="ttd-pi-ws-resend-text" rows="4" style="width:100%;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;font-family:monospace;margin-bottom:6px;" placeholder="Message text to send">${Helpers._escape(this._wsResendDraft || '')}</textarea>
                    <button id="ttd-pi-ws-resend-send" style="${Helpers._primaryBtnStyle()}width:100%;" ${canSend && !this._wsResendSending ? '' : 'disabled'}>${this._wsResendSending ? 'Sending...' : 'Send this message'}</button>
                    <div id="ttd-pi-ws-resend-result" style="font-size:10px;margin-top:6px;"></div>
                </div>

                <div style="${Helpers._cardStyle(t)}">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <span style="font-size:11px;font-weight:700;">Scripted sequence</span>
                        ${this._wsSequenceRunning ? `<button id="ttd-pi-ws-seq-stop" style="${Helpers._secondaryBtnStyle(t)}color:${t.statusBad};padding:3px 10px;">Stop</button>` : ''}
                    </div>
                    <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">Build an ordered list of messages, each with a delay before it fires, then run it against the target connection above. Stops automatically if a send fails or the connection closes.</div>
                    <div id="ttd-pi-ws-seq-steps" style="border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:6px;${this._wsSequenceSteps.length ? '' : 'display:none;'}"></div>
                    <div style="display:flex;gap:6px;margin-bottom:6px;">
                        <textarea id="ttd-pi-ws-seq-newtext" rows="2" style="flex:1;min-width:0;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;font-family:monospace;" placeholder="Message text">${Helpers._escape(this._wsSequenceNewText)}</textarea>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
                        <span style="font-size:10px;color:${t.cardDesc};white-space:nowrap;">delay before send (ms)</span>
                        <input id="ttd-pi-ws-seq-newdelay" type="number" min="0" step="50" value="${this._wsSequenceNewDelay}" style="width:80px;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                        <button id="ttd-pi-ws-seq-add" style="${Helpers._secondaryBtnStyle(t)}flex:1;">Add step</button>
                    </div>
                    <button id="ttd-pi-ws-seq-run" style="${Helpers._primaryBtnStyle()}width:100%;margin-bottom:6px;" ${canSend && this._wsSequenceSteps.length && !this._wsSequenceRunning ? '' : 'disabled'}>${this._wsSequenceRunning ? 'Running...' : `Run sequence (${this._wsSequenceSteps.length} step${this._wsSequenceSteps.length === 1 ? '' : 's'})`}</button>
                    <div style="display:flex;gap:6px;margin-bottom:6px;">
                        <input id="ttd-pi-ws-seq-name" type="text" placeholder="Name to save this sequence as" value="${Helpers._escape(this._wsSequenceName)}" style="flex:1;min-width:0;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                        <button id="ttd-pi-ws-seq-save" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;" ${this._wsSequenceSteps.length ? '' : 'disabled'}>Save</button>
                    </div>
                    ${this._renderWsSequenceSavedPicker(t)}
                    <div id="ttd-pi-ws-seq-log" style="margin-top:8px;${this._wsSequenceLog.length ? '' : 'display:none;'}"></div>
                </div>
            `;

            if (connections.length) {
                document.getElementById('ttd-pi-ws-send-target').onchange = (e) => {
                    this._selectedWsConnection = connections[Number(e.target.value)] || null;
                    this._wsResendDraft = null; 
                    this._renderWsSendPanel();
                };
            }

            const resendTextEl = document.getElementById('ttd-pi-ws-resend-text');
            resendTextEl.oninput = (e) => { this._wsResendDraft = e.target.value; };

            const resendBtn = document.getElementById('ttd-pi-ws-resend-send');
            if (resendBtn) resendBtn.onclick = async () => {
                if (!confirm('Send this message on the live connection now? This is real traffic to whatever this page is talking to.')) return;
                this._wsResendSending = true;
                this._renderWsSendPanel();
                const result = WebSocketMonitor.send(this._selectedWsConnection, resendTextEl.value);
                this._wsResendSending = false;
                this._renderWsSendPanel();
                const resultEl = document.getElementById('ttd-pi-ws-resend-result');
                if (resultEl) {
                    resultEl.textContent = result.ok ? 'Sent.' : `Failed: ${result.error}`;
                    resultEl.style.color = result.ok ? t.statusOk : t.statusBad;
                }
            };

            this._renderWsSequenceSteps();
            this._renderWsSequenceLog();

            document.getElementById('ttd-pi-ws-seq-newtext').oninput = (e) => { this._wsSequenceNewText = e.target.value; };
            document.getElementById('ttd-pi-ws-seq-newdelay').oninput = (e) => { this._wsSequenceNewDelay = e.target.value; };
            document.getElementById('ttd-pi-ws-seq-add').onclick = () => {
                if (!this._wsSequenceNewText.trim()) return;
                this._wsSequenceSteps.push({ text: this._wsSequenceNewText, delayMs: Number(this._wsSequenceNewDelay) || 0 });
                this._wsSequenceNewText = '';
                this._renderWsSendPanel();
            };

            const seqStopBtn = document.getElementById('ttd-pi-ws-seq-stop');
            if (seqStopBtn) seqStopBtn.onclick = () => {
                if (this._wsSequenceRunning) this._wsSequenceRunning.stop();
                this._wsSequenceRunning = null;
                this._renderWsSendPanel();
            };

            const seqRunBtn = document.getElementById('ttd-pi-ws-seq-run');
            if (seqRunBtn) seqRunBtn.onclick = () => {
                if (!confirm(`Run this ${this._wsSequenceSteps.length}-step sequence against the live connection now? Each step sends a real message, in order.`)) return;
                this._wsSequenceLog = [];
                this._wsSequenceRunning = WebSocketMonitor.runSequence(this._selectedWsConnection, this._wsSequenceSteps, {
                    onStep: (stepIndex, result) => {
                        this._wsSequenceLog.push({ stepIndex, ok: result.ok, error: result.error || null, timestamp: Date.now() });
                        this._renderWsSequenceLog();
                    },
                    onDone: (wasStopped, error) => {
                        this._wsSequenceRunning = null;
                        this._renderWsSendPanel();
                    }
                });
                this._renderWsSendPanel();
            };

            const seqNameEl = document.getElementById('ttd-pi-ws-seq-name');
            seqNameEl.oninput = (e) => { this._wsSequenceName = e.target.value; };
            const seqSaveBtn = document.getElementById('ttd-pi-ws-seq-save');
            if (seqSaveBtn) seqSaveBtn.onclick = () => {
                const name = this._wsSequenceName.trim() || `Sequence ${new Date().toLocaleTimeString()}`;
                const saved = Config.wsSequences;
                saved.push({ id: `${Date.now()}`, name, steps: this._wsSequenceSteps.slice() });
                Config.wsSequences = saved;
                this._wsSequenceName = '';
                this._renderWsSendPanel();
            };

            const loadSel = document.getElementById('ttd-pi-ws-seq-load');
            if (loadSel) loadSel.onchange = (e) => {
                if (!e.target.value) return;
                const saved = Config.wsSequences.find((s) => s.id === e.target.value);
                if (saved) { this._wsSequenceSteps = saved.steps.map((s) => ({ ...s })); this._renderWsSendPanel(); }
            };
            const delBtn = document.getElementById('ttd-pi-ws-seq-delete');
            if (delBtn) delBtn.onclick = () => {
                const sel = document.getElementById('ttd-pi-ws-seq-load');
                if (!sel || !sel.value) return;
                Config.wsSequences = Config.wsSequences.filter((s) => s.id !== sel.value);
                this._renderWsSendPanel();
            };
        },

        _renderWsSequenceSavedPicker(t) {
            const saved = Config.wsSequences;
            if (!saved.length) return '';
            const opts = saved.map((s) => `<option value="${s.id}">${Helpers._escape(s.name)} (${s.steps.length} step${s.steps.length === 1 ? '' : 's'})</option>`).join('');
            return `
                <div style="display:flex;gap:6px;margin-bottom:4px;">
                    <select id="ttd-pi-ws-seq-load" style="flex:1;min-width:0;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                        <option value="">Load a saved sequence...</option>
                        ${opts}
                    </select>
                    <button id="ttd-pi-ws-seq-delete" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;">Delete</button>
                </div>
            `;
        },

        _renderWsSequenceSteps() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-ws-seq-steps');
            if (!el) return;
            if (!this._wsSequenceSteps.length) { el.innerHTML = ''; return; }
            el.innerHTML = this._wsSequenceSteps.map((s, i) => `
                <div style="padding:5px 8px;font-size:10px;border-bottom:1px solid ${t.rowBorder};display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
                    <div style="min-width:0;"><span style="color:${t.cardDesc};">#${i + 1} - ${s.delayMs}ms delay -</span> <span style="word-break:break-all;">${Helpers._escape(s.text.length > 80 ? s.text.slice(0, 80) + '...' : s.text)}</span></div>
                    <span data-remove-step="${i}" style="color:${t.statusBad};cursor:pointer;white-space:nowrap;">remove</span>
                </div>
            `).join('');
            el.querySelectorAll('[data-remove-step]').forEach((btn) => {
                btn.onclick = () => {
                    this._wsSequenceSteps.splice(Number(btn.getAttribute('data-remove-step')), 1);
                    this._renderWsSendPanel();
                };
            });
        },

        _renderWsSequenceLog() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-ws-seq-log');
            if (!el) return;
            if (!this._wsSequenceLog.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
            el.style.display = '';
            el.innerHTML = `
                <div style="font-size:11px;font-weight:700;margin-bottom:4px;">Run log</div>
                <div style="max-height:120px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;">
                    ${this._wsSequenceLog.map((l) => `
                        <div style="padding:4px 8px;font-size:10px;border-bottom:1px solid ${t.rowBorder};color:${l.ok ? t.statusOk : t.statusBad};">
                            step #${l.stepIndex + 1} - ${l.ok ? 'sent' : `failed: ${Helpers._escape(l.error || '')}`} <span style="color:${t.cardDesc};">- ${Helpers._timeAgo(l.timestamp)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        },

        _filteredWsMessages(conn) {
            const terms = PayloadFilter.parseQuery(this._wsPayloadFilter);
            if (!terms.length) return conn.messages;
            return conn.messages.filter((m) => {
                const adapted = { url: '', requestBody: null, json: m.json, rawText: m.text };
                return PayloadFilter.test(adapted, terms).matched;
            });
        },

        _renderWsTimeline(messages) {
            const t = Theme.palette;
            if (!messages.length) return '';
            const timestamps = messages.map((m) => m.timestamp);
            const start = Math.min(...timestamps);
            const end = Math.max(...timestamps);
            const span = Math.max(end - start, 1); 

            const ticks = messages.map((m, i) => {
                const pct = ((m.timestamp - start) / span) * 100;
                const color = m.direction === 'in' ? t.statusOk : '#4a90d9';
                const isSelected = m === this._selectedWsMessage;
                return `<div data-tick-idx="${i}" title="${Helpers._escape(new Date(m.timestamp).toLocaleTimeString())} - ${m.direction === 'in' ? 'received' : 'sent'}" style="position:absolute;left:${pct}%;top:0;width:${isSelected ? '3px' : '2px'};height:100%;background:${color};opacity:${isSelected ? '1' : '0.6'};cursor:pointer;"></div>`;
            }).join('');

            return `
                <div style="font-size:9px;color:${t.cardDesc};display:flex;justify-content:space-between;margin-bottom:2px;">
                    <span>${Helpers._escape(new Date(start).toLocaleTimeString())}</span>
                    <span style="display:flex;gap:8px;"><span style="color:${t.statusOk};">\u2190 received</span><span style="color:#4a90d9;">\u2192 sent</span></span>
                    <span>${Helpers._escape(new Date(end).toLocaleTimeString())}</span>
                </div>
                <div id="ttd-pi-ws-timeline" style="position:relative;height:20px;background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:4px;margin-bottom:8px;">${ticks}</div>
            `;
        },

        _renderWsMessages() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-ws-messages');
            if (!el) return;
            const conn = this._selectedWsConnection;
            if (!conn) { el.innerHTML = ''; return; }

            const closedNote = conn.closedAt
                ? `<div style="font-size:10px;color:${t.cardDesc};margin-bottom:4px;">Closed ${Helpers._timeAgo(conn.closedAt)} - code ${conn.closeCode}${conn.closeReason ? ` (${Helpers._escape(conn.closeReason)})` : ''}</div>`
                : '';

            el.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-size:11px;font-weight:700;">Messages</span>
                    <button id="ttd-pi-ws-copyall" style="${Helpers._secondaryBtnStyle(t)}">Copy all</button>
                </div>
                ${closedNote}
                <input id="ttd-pi-ws-payload-filter" type="text" placeholder="Filter messages: keyword, key=value, key&gt;100, key:100-500" value="${Helpers._escape(this._wsPayloadFilter)}" style="width:100%;box-sizing:border-box;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                <div id="ttd-pi-ws-timeline-wrap"></div>
                <div id="ttd-pi-ws-message-list" style="max-height:180px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;"></div>
            `;

            document.getElementById('ttd-pi-ws-payload-filter').oninput = (e) => { this._wsPayloadFilter = e.target.value; this._updateWsMessageList(); };

            document.getElementById('ttd-pi-ws-copyall').onclick = async (e) => {
                const filtered = this._filteredWsMessages(conn);
                const text = filtered.map((m) => `${new Date(m.timestamp).toLocaleTimeString()} ${m.direction === 'in' ? '<-' : '->'} ${m.text}`).join('\n');
                const ok = await copyToClipboard(text || '(no messages)');
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy all'; }, 1200);
            };

            this._updateWsMessageList();
        },

        _updateWsMessageList() {
            const t = Theme.palette;
            const conn = this._selectedWsConnection;
            const listEl = document.getElementById('ttd-pi-ws-message-list');
            const timelineWrap = document.getElementById('ttd-pi-ws-timeline-wrap');
            if (!listEl || !conn) return;

            if (!conn.messages.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">No messages yet on this connection.</div>`;
                document.getElementById('ttd-pi-ws-detail').innerHTML = '';
                return;
            }

            const filtered = this._filteredWsMessages(conn);
            if (!filtered.length) {
                timelineWrap.innerHTML = '';
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">No messages matching that filter.</div>`;
                document.getElementById('ttd-pi-ws-detail').innerHTML = '';
                return;
            }

            if (!this._selectedWsMessage || !filtered.includes(this._selectedWsMessage)) {
                this._selectedWsMessage = filtered[filtered.length - 1];
            }

            timelineWrap.innerHTML = this._renderWsTimeline(filtered);
            timelineWrap.querySelectorAll('[data-tick-idx]').forEach((tick) => {
                tick.onclick = () => {
                    this._selectedWsMessage = filtered[Number(tick.getAttribute('data-tick-idx'))];
                    this._updateWsMessageList();
                };
            });

            listEl.innerHTML = '';
            filtered.slice().reverse().forEach((m) => {
                const isSelected = m === this._selectedWsMessage;
                const row = document.createElement('div');
                row.style.cssText = `padding:5px 8px;font-size:10px;cursor:pointer;border-bottom:1px solid ${t.rowBorder};background:${isSelected ? t.secondaryBtnBg : 'transparent'};word-break:break-all;`;
                const arrow = m.direction === 'in' ? '\u2190' : '\u2192';
                const arrowColor = m.direction === 'in' ? t.statusOk : '#4a90d9';
                row.innerHTML = `<span style="color:${arrowColor};font-weight:700;">${arrow}</span> <span style="color:${t.cardDesc};">${new Date(m.timestamp).toLocaleTimeString()}</span> ${Helpers._escape(m.text.slice(0, 100))}`;
                row.onclick = () => { this._selectedWsMessage = m; this._updateWsMessageList(); };
                listEl.appendChild(row);
            });

            this._renderWsMessageDetail();
        },

        _renderWsMessageDetail() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-ws-detail');
            if (!el) return;
            const m = this._selectedWsMessage;
            if (!m) { el.innerHTML = ''; return; }

            const hasJson = !!m.json;
            if (hasJson && this._wsTreeState?.root !== m.json) {
                this._wsTreeState = JsonTree.createState(m.json);
            }

            el.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-size:11px;font-weight:700;">${m.direction === 'in' ? 'Received' : 'Sent'} - ${m.size.toLocaleString()} bytes</span>
                    <div style="display:flex;gap:6px;">
                        <button id="ttd-pi-ws-msg-resend" style="${Helpers._secondaryBtnStyle(t)}">Resend...</button>
                        <button id="ttd-pi-ws-msg-copy" style="${Helpers._secondaryBtnStyle(t)}">Copy</button>
                    </div>
                </div>
                ${hasJson
                    ? `<div id="ttd-pi-ws-msg-tree" style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:200px;overflow:auto;"></div>`
                    : `<pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0;">${Helpers._escape(m.text)}</pre>`}
            `;
            if (hasJson) JsonTree.render(document.getElementById('ttd-pi-ws-msg-tree'), this._wsTreeState, t);
            document.getElementById('ttd-pi-ws-msg-copy').onclick = async (e) => {
                const ok = await copyToClipboard(m.text);
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy'; }, 1200);
            };
            document.getElementById('ttd-pi-ws-msg-resend').onclick = () => {
                this._wsResendDraft = m.text;
                this._wsViewMode = 'send';
                this._renderWebSocket();
            };
        },

        _renderWaterfall() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            const entries = ObservedTraffic.all().slice(0, 60).reverse(); 

            if (!entries.length) {
                area.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">No traffic captured yet.</div>`;
                return;
            }

            const minStart = Math.min(...entries.map((e) => e.timestamp));
            const maxEnd = Math.max(...entries.map((e) => e.timestamp + (e.durationMs || 0)));
            const range = Math.max(1, maxEnd - minStart);
            const MIN_WIDTH_PCT = 1.5; 

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Most recent ${entries.length} requests, oldest at top. Bar position = when it started, bar width = how long it took, relative to this window only (not a fixed time scale).</div>
                <div id="ttd-pi-waterfall-rows"></div>
            `;

            const rowsEl = document.getElementById('ttd-pi-waterfall-rows');
            entries.forEach((entry) => {
                const leftPct = ((entry.timestamp - minStart) / range) * 100;
                const widthPct = Math.max(MIN_WIDTH_PCT, ((entry.durationMs || 0) / range) * 100);
                const color = entry.status >= 400 ? t.statusBad : (entry.status >= 200 && entry.status < 300 ? t.statusOk : t.statusWarn);

                const row = document.createElement('div');
                row.style.cssText = 'margin-bottom:6px;';
                row.innerHTML = `
                    <div style="font-size:9px;color:${t.cardDesc};word-break:break-all;">${Helpers._escape(entry.method)} ${Helpers._escape(Helpers._shortenUrl(entry.url))} - ${entry.durationMs}ms</div>
                    <div style="position:relative;height:10px;background:${t.secondaryBtnBg};border-radius:3px;margin-top:2px;">
                        <div style="position:absolute;left:${leftPct}%;width:${widthPct}%;height:100%;background:${color};border-radius:3px;"></div>
                    </div>
                `;
                rowsEl.appendChild(row);
            });
        },

        
        _renderPageLoadCompare() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            const all = ObservedTraffic.all();

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Traffic history is in-memory and clears on reload, so there's normally no way to compare "before" vs "after" a page load. This saves a snapshot (hosts contacted, request counts, endpoint list) that survives reloads, so you can diff any two saved snapshots against each other.</div>
                <div style="${Helpers._cardStyle(t)}margin-bottom:8px;">
                    <div style="font-size:11px;font-weight:700;margin-bottom:6px;">Save current traffic as a snapshot</div>
                    <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">${all.length} request${all.length === 1 ? '' : 's'} currently held. Save now, then reload/navigate and do it again to get a second point to compare.</div>
                    <div style="display:flex;gap:6px;">
                        <input id="ttd-pi-pageload-save-label" type="text" placeholder="Optional label (e.g. 'before patch')" value="${Helpers._escape(this._pageLoadSaveLabel)}" style="flex:1;min-width:0;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                        <button id="ttd-pi-pageload-save" style="${Helpers._primaryBtnStyle()}white-space:nowrap;flex:0 0 auto;width:auto;padding:8px 16px;" ${all.length ? '' : 'disabled'}>Save snapshot</button>
                    </div>
                </div>
                <div id="ttd-pi-pageload-compare-body"></div>
            `;

            document.getElementById('ttd-pi-pageload-save-label').oninput = (e) => { this._pageLoadSaveLabel = e.target.value; };
            document.getElementById('ttd-pi-pageload-save').onclick = () => {
                PageLoadSnapshots.capture(this._pageLoadSaveLabel);
                this._pageLoadSaveLabel = '';
                this._renderPageLoadCompare();
            };

            this._renderPageLoadCompareBody();
        },

        _renderPageLoadCompareBody() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-pageload-compare-body');
            if (!el) return;

            const snapshots = PageLoadSnapshots.all();
            if (snapshots.length < 2) {
                el.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">${snapshots.length} snapshot${snapshots.length === 1 ? '' : 's'} saved so far - save at least 2 (e.g. one now, one after a reload or a game action) to compare them.</div>`;
                return;
            }

            if (!this._pageLoadCompareA || !snapshots.find((s) => s.id === this._pageLoadCompareA)) this._pageLoadCompareA = snapshots[Math.min(1, snapshots.length - 1)].id;
            if (!this._pageLoadCompareB || !snapshots.find((s) => s.id === this._pageLoadCompareB)) this._pageLoadCompareB = snapshots[0].id;

            const label = (s) => `${s.label ? s.label + ' - ' : ''}${s.hostname} - ${new Date(s.timestamp).toLocaleString()} (${s.totalRequests} req)`;
            const opts = snapshots.map((s) => `<option value="${s.id}">${Helpers._escape(label(s))}</option>`).join('');

            el.innerHTML = `
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:9px;color:${t.cardDesc};margin-bottom:2px;">A (older / baseline)</div>
                        <select id="ttd-pi-pageload-select-a" style="width:100%;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:10px;">${opts}</select>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:9px;color:${t.cardDesc};margin-bottom:2px;">B (newer / compare against)</div>
                        <select id="ttd-pi-pageload-select-b" style="width:100%;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:10px;">${opts}</select>
                    </div>
                </div>
                <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
                    <button id="ttd-pi-pageload-clear" style="${Helpers._secondaryBtnStyle(t)}font-size:10px;padding:3px 10px;">Clear all saved snapshots (${snapshots.length})</button>
                </div>
                <div id="ttd-pi-pageload-diff"></div>
            `;

            document.getElementById('ttd-pi-pageload-select-a').value = this._pageLoadCompareA;
            document.getElementById('ttd-pi-pageload-select-b').value = this._pageLoadCompareB;
            document.getElementById('ttd-pi-pageload-select-a').onchange = (e) => { this._pageLoadCompareA = e.target.value; this._renderPageLoadDiff(); };
            document.getElementById('ttd-pi-pageload-select-b').onchange = (e) => { this._pageLoadCompareB = e.target.value; this._renderPageLoadDiff(); };
            document.getElementById('ttd-pi-pageload-clear').onclick = () => {
                if (!confirm('Clear all saved page-load traffic snapshots? This cannot be undone.')) return;
                PageLoadSnapshots.clear();
                this._pageLoadCompareA = null;
                this._pageLoadCompareB = null;
                this._renderPageLoadCompareBody();
            };

            this._renderPageLoadDiff();
        },

        _renderPageLoadDiff() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-pageload-diff');
            if (!el) return;
            const snapshots = PageLoadSnapshots.all();
            const snapA = snapshots.find((s) => s.id === this._pageLoadCompareA);
            const snapB = snapshots.find((s) => s.id === this._pageLoadCompareB);
            if (!snapA || !snapB) { el.innerHTML = ''; return; }

            if (snapA.id === snapB.id) {
                el.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">Pick two different snapshots to see a diff.</div>`;
                return;
            }

            const { hostRows, endpointsAdded, endpointsRemoved } = PageLoadSnapshots.diff(snapA, snapB);
            const kindColor = { added: t.statusOk, removed: t.statusBad, changed: t.statusWarn, unchanged: t.cardDesc };
            const kindLabel = { added: 'new in B', removed: 'gone in B', changed: 'count changed', unchanged: 'unchanged' };

            const hostRowsHtml = hostRows.map((r) => `
                <div style="padding:5px 8px;font-size:10px;border-bottom:1px solid ${t.rowBorder};display:flex;justify-content:space-between;">
                    <span style="word-break:break-all;">${Helpers._escape(r.host)}</span>
                    <span style="color:${kindColor[r.kind]};white-space:nowrap;margin-left:8px;">${r.a ?? '-'} \u2192 ${r.b ?? '-'} (${kindLabel[r.kind]})</span>
                </div>
            `).join('');

            el.innerHTML = `
                <div style="font-size:11px;font-weight:700;margin-bottom:4px;">Requests: ${snapA.totalRequests} \u2192 ${snapB.totalRequests}${snapA.problemCount || snapB.problemCount ? ` &nbsp;|&nbsp; problems: ${snapA.problemCount} \u2192 ${snapB.problemCount}` : ''}</div>
                <div style="font-size:11px;font-weight:700;margin-top:8px;margin-bottom:4px;">Hosts (${hostRows.length})</div>
                <div style="border:1px solid ${t.rowBorder};border-radius:6px;max-height:150px;overflow-y:auto;margin-bottom:8px;">${hostRowsHtml || `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">No hosts in either snapshot.</div>`}</div>
                <div style="font-size:11px;font-weight:700;margin-bottom:4px;">Endpoints only in B (${endpointsAdded.length})</div>
                <div style="border:1px solid ${t.rowBorder};border-radius:6px;max-height:110px;overflow-y:auto;margin-bottom:8px;font-size:10px;">${endpointsAdded.length ? endpointsAdded.map((e) => `<div style="padding:4px 8px;border-bottom:1px solid ${t.rowBorder};color:${t.statusOk};word-break:break-all;">${Helpers._escape(e)}</div>`).join('') : `<div style="padding:8px;color:${t.cardDesc};">None.</div>`}</div>
                <div style="font-size:11px;font-weight:700;margin-bottom:4px;">Endpoints only in A (${endpointsRemoved.length})</div>
                <div style="border:1px solid ${t.rowBorder};border-radius:6px;max-height:110px;overflow-y:auto;font-size:10px;">${endpointsRemoved.length ? endpointsRemoved.map((e) => `<div style="padding:4px 8px;border-bottom:1px solid ${t.rowBorder};color:${t.statusBad};word-break:break-all;">${Helpers._escape(e)}</div>`).join('') : `<div style="padding:8px;color:${t.cardDesc};">None.</div>`}</div>
            `;
        },

        _renderHostsSummary() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            const hosts = ObservedTraffic.hostSummary();

            if (!hosts.length) {
                area.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">No traffic captured yet.</div>`;
                return;
            }

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">${hosts.length} distinct host${hosts.length === 1 ? '' : 's'} contacted, from currently-held traffic history.</div>
                <div id="ttd-pi-hosts-list" style="border:1px solid ${t.rowBorder};border-radius:6px;overflow:hidden;"></div>
            `;
            const listEl = document.getElementById('ttd-pi-hosts-list');
            hosts.forEach((h) => {
                const row = document.createElement('div');
                row.style.cssText = `padding:6px 8px;font-size:11px;border-bottom:1px solid ${t.rowBorder};cursor:pointer;word-break:break-all;`;
                row.innerHTML = `<span style="font-weight:700;">${Helpers._escape(h.host)}</span> <span style="color:${t.cardDesc};">- ${h.count} call${h.count === 1 ? '' : 's'}</span><br><span style="font-size:10px;color:${t.cardDesc};">First: ${Helpers._timeAgo(h.firstSeen)} - Last: ${Helpers._timeAgo(h.lastSeen)}</span>`;
                row.onclick = async () => { await copyToClipboard(h.host); };
                listEl.appendChild(row);
            });
        },

        _renderDuplicates() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            const clusters = ObservedTraffic.findDuplicateClusters(5000);

            area.innerHTML = `
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Groups of identical method+URL requests fired within 5 seconds of each other, from currently-held traffic history. A burst doesn't necessarily mean a bug - some polling is intentional - but it's worth a look.</div>
                <div id="ttd-pi-duplicates-list"></div>
            `;
            const listEl = document.getElementById('ttd-pi-duplicates-list');
            if (!clusters.length) {
                listEl.innerHTML = `<div style="font-size:11px;color:${t.cardDesc};">No repeated-in-a-burst requests found.</div>`;
                return;
            }
            clusters.forEach((c) => {
                const row = document.createElement('div');
                row.style.cssText = `padding:6px 8px;font-size:11px;border-bottom:1px solid ${t.rowBorder};cursor:pointer;word-break:break-all;`;
                row.innerHTML = `<span style="font-weight:700;color:${t.statusWarn};">${c.count}x</span> <span style="font-weight:700;">${Helpers._escape(c.method)}</span> ${Helpers._escape(Helpers._shortenUrl(c.url))}<br><span style="font-size:10px;color:${t.cardDesc};">${Helpers._timeAgo(c.firstSeen)} to ${Helpers._timeAgo(c.lastSeen)}</span>`;
                row.onclick = async () => { await copyToClipboard(`${c.method} ${c.url}`); };
                listEl.appendChild(row);
            });
        },

        _renderEndpoints() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');

            area.innerHTML = `
                <div id="ttd-pi-endpoints-count" style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;"></div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
                    <input id="ttd-pi-endpoints-search" type="text" placeholder="Filter by host or path" value="${Helpers._escape(this._endpointSearch)}" style="flex:1 1 140px;min-width:0;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                    <button id="ttd-pi-endpoints-refresh" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;padding:4px 12px;">Refresh</button>
                    <button id="ttd-pi-endpoints-copyall" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;">Copy all</button>
                    <button id="ttd-pi-endpoints-clear" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;">Clear</button>
                </div>
                <div id="ttd-pi-endpoints-list" style="max-height:180px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:8px;"></div>
                <div id="ttd-pi-endpoints-detail"></div>
            `;

            document.getElementById('ttd-pi-endpoints-search').oninput = (e) => { this._endpointSearch = e.target.value; this._updateEndpointsList(); };
            document.getElementById('ttd-pi-endpoints-refresh').onclick = () => this._updateEndpointsList();
            document.getElementById('ttd-pi-endpoints-copyall').onclick = async (e) => {
                const all = ObservedTraffic.catalogEntries();
                const search = this._endpointSearch.toLowerCase();
                const filtered = search ? all.filter((c) => `${c.host}${c.pathPattern}`.toLowerCase().includes(search)) : all;
                const plain = filtered.map((c) => ({
                    ...c,
                    paramsObserved: Array.from(c.paramsObserved),
                    statusesObserved: Array.from(c.statusesObserved),
                    contentTypesObserved: Array.from(c.contentTypesObserved)
                }));
                const ok = await copyToClipboard(JSON.stringify(plain, null, 2));
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy all'; }, 1200);
            };
            document.getElementById('ttd-pi-endpoints-clear').onclick = () => {
                ObservedTraffic.clearCatalog();
                this._selectedEndpointKey = null;
                this._updateEndpointsList();
            };

            this._updateEndpointsList();
        },

        _updateEndpointsList() {
            const t = Theme.palette;
            const listEl = document.getElementById('ttd-pi-endpoints-list');
            const detailEl = document.getElementById('ttd-pi-endpoints-detail');
            const countEl = document.getElementById('ttd-pi-endpoints-count');
            if (!listEl) return;

            const all = ObservedTraffic.catalogEntries();
            const search = this._endpointSearch.toLowerCase();
            const filtered = search ? all.filter((e) => `${e.host}${e.pathPattern}`.toLowerCase().includes(search)) : all;

            if (countEl) countEl.textContent = `${all.length} distinct endpoints observed - persists across page loads, builds up the more you browse. Metadata only, though - for actual request/response bodies that survive a reload, see the "Persisted traffic cache" category in Export.`;

            if (this._selectedEndpointKey && !filtered.some((e) => `${e.method} ${e.host}${e.pathPattern}` === this._selectedEndpointKey)) {
                this._selectedEndpointKey = null;
            }

            if (!filtered.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">Nothing observed yet${search ? ' matching that filter' : ''} - browse around and it fills in.</div>`;
                if (detailEl) detailEl.innerHTML = '';
                return;
            }
            if (!this._selectedEndpointKey) this._selectedEndpointKey = `${filtered[0].method} ${filtered[0].host}${filtered[0].pathPattern}`;

            listEl.innerHTML = '';
            filtered.forEach((c) => {
                const key = `${c.method} ${c.host}${c.pathPattern}`;
                const isSelected = key === this._selectedEndpointKey;
                const row = document.createElement('div');
                row.style.cssText = `padding:6px 8px;font-size:11px;cursor:pointer;border-bottom:1px solid ${t.rowBorder};background:${isSelected ? t.secondaryBtnBg : 'transparent'};word-break:break-all;`;
                row.innerHTML = `<span style="font-weight:700;">${Helpers._escape(c.method)} ${Helpers._escape(c.pathPattern)}</span> <span style="color:${t.cardDesc};">- ${c.callCount} call${c.callCount === 1 ? '' : 's'}</span><br><span style="font-size:10px;color:${t.cardDesc};">${Helpers._escape(c.host)}</span>`;
                row.onclick = () => { this._selectedEndpointKey = key; this._updateEndpointsList(); };
                listEl.appendChild(row);
            });

            this._renderEndpointDetail(filtered);
        },

        _renderEndpointDetail(filtered) {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-endpoints-detail');
            if (!el) return;
            const c = filtered.find((e) => `${e.method} ${e.host}${e.pathPattern}` === this._selectedEndpointKey);
            if (!c) { el.innerHTML = ''; return; }

            const params = Array.from(c.paramsObserved);
            const statuses = Array.from(c.statusesObserved);
            const contentTypes = Array.from(c.contentTypesObserved);

            const catalogKey = `${c.method} ${c.host}${c.pathPattern}`;
            const diff = ObservedTraffic.diffFor(catalogKey);
            const persisted = ObservedTraffic.persistedTrafficFor(catalogKey);

            el.innerHTML = `
                <div style="font-size:11px;font-weight:700;margin-bottom:4px;">${Helpers._escape(c.method)} ${Helpers._escape(c.host)}${Helpers._escape(c.pathPattern)}</div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">First seen: ${Helpers._timeAgo(c.firstSeen)} - Last seen: ${Helpers._timeAgo(c.lastSeen)} - ${c.callCount} call${c.callCount === 1 ? '' : 's'}</div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Statuses: ${statuses.join(', ') || 'none'}</div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Content types: ${Helpers._escape(contentTypes.join(', ')) || 'none'}</div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">Params observed: ${params.length ? Helpers._escape(params.join(', ')) : 'none'}</div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:4px;word-break:break-all;">Example: ${Helpers._escape(c.exampleUrl)}</div>
                ${c.exampleResponsePreview ? `<pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:150px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0;">${Helpers._escape(c.exampleResponsePreview)}</pre>` : ''}
                ${this._renderFullResponseSection(c, t)}
                ${this._renderPersistedTrafficSection(persisted, t)}
                ${this._renderDiffSection(diff, t)}
            `;

            const copyFullBtn = document.getElementById('ttd-pi-endpoint-full-copy');
            if (copyFullBtn) {
                copyFullBtn.onclick = async (e) => {
                    let text;
                    try { text = JSON.stringify(c.lastFullResponse, null, 2); } catch { text = String(c.lastFullResponse); }
                    const ok = await copyToClipboard(text);
                    e.target.textContent = ok ? 'Copied!' : 'Failed';
                    setTimeout(() => { e.target.textContent = 'Copy full response'; }, 1200);
                };
            }

            const copyDiffBtn = document.getElementById('ttd-pi-endpoint-diff-copy');
            if (copyDiffBtn && diff) {
                copyDiffBtn.onclick = async (e) => {
                    const text = diff.map((chg) => this._formatDiffLine(chg)).join('\n');
                    const ok = await copyToClipboard(text);
                    e.target.textContent = ok ? 'Copied!' : 'Failed';
                    setTimeout(() => { e.target.textContent = 'Copy diff'; }, 1200);
                };
            }
        },

        // `c.lastFullResponse` is the uncapped in-memory JSON response - never persisted (see
        // _persistCatalog, which deliberately excludes it), so this is only available for the
        // current page session and disappears on reload. Wrapped in <details> rather than
        // always rendered inline since some responses (item lists, war data) run to tens of KB.
        _renderFullResponseSection(c, t) {
            if (c.lastFullResponse === undefined || c.lastFullResponse === null) return '';
            let text;
            try { text = JSON.stringify(c.lastFullResponse, null, 2); } catch { text = String(c.lastFullResponse); }
            return `
                <details style="margin-top:6px;">
                    <summary style="font-size:10px;cursor:pointer;color:${t.cardDesc};">Full last response (${text.length.toLocaleString()} chars, live only - resets on reload)</summary>
                    <div style="margin-top:4px;">
                        <button id="ttd-pi-endpoint-full-copy" style="${Helpers._secondaryBtnStyle(t)}margin-bottom:4px;">Copy full response</button>
                        <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:300px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0;">${Helpers._escape(text)}</pre>
                    </div>
                </details>
            `;
        },

        // `entries` is most-recent-first from ObservedTraffic.persistedTrafficFor() - could be
        // several distinct request bodies for the same pathPattern (e.g. each step of a
        // multi-refresh flow like Trade), so render all of them, not just the latest.
        _renderPersistedTrafficSection(entries, t) {
            if (!entries || !entries.length) return '';
            const items = entries.map((e, i) => {
                const bodyBlock = e.requestBody
                    ? `<pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:150px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:4px 0 0;">${Helpers._escape(e.requestBody)}</pre>`
                    : `<div style="font-size:10px;color:${t.cardDesc};margin-top:2px;">No request body captured (likely a GET, or the body was empty).</div>`;
                const actionLabel = e.actionKey ? ` - <span style="color:${t.statusOk};">${Helpers._escape(e.actionKey)}</span>` : '';
                return `
                    <div style="font-size:10px;color:${t.cardDesc};margin-top:${i === 0 ? '2' : '10'}px;margin-bottom:2px;">${i === 0 ? 'Most recent' : `${i + 1} back`} - ${Helpers._timeAgo(e.timestamp)} - status ${e.status ?? 'unknown'}${actionLabel}</div>
                    ${bodyBlock}
                `;
            }).join('');
            return `
                <div style="font-size:11px;font-weight:700;margin-top:8px;margin-bottom:2px;">Persisted traffic cache (survives reload) - ${entries.length} distinct action${entries.length === 1 ? '' : 's'} kept for this endpoint (up to ${ObservedTraffic.PERSISTED_ENTRIES_PER_KEY})</div>
                ${items}
            `;
        },

        _renderDiffSection(diff, t) {
            if (diff === null) {
                return `<div style="font-size:10px;color:${t.cardDesc};margin-top:8px;">Response diffing needs two JSON responses for this endpoint in the current session - only one observed so far.</div>`;
            }
            if (diff.length === 0) {
                return `<div style="font-size:10px;color:${t.statusOk};margin-top:8px;">No change from the previous response.</div>`;
            }
            const lines = diff.map((chg) => this._formatDiffLine(chg));
            return `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;margin-bottom:4px;">
                    <span style="font-size:11px;font-weight:700;">Changed since previous response</span>
                    <button id="ttd-pi-endpoint-diff-copy" style="${Helpers._secondaryBtnStyle(t)}">Copy diff</button>
                </div>
                <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:180px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0;">${Helpers._escape(lines.join('\n'))}</pre>
            `;
        },

        _formatDiffLine(chg) {
            if (chg.type === 'truncated') return `... ${chg.note}`;
            if (chg.type === 'added') return `${chg.path}: + ${ResponseDiff.formatValue(chg.newValue)}`;
            if (chg.type === 'removed') return `${chg.path}: - ${ResponseDiff.formatValue(chg.oldValue)}`;
            return `${chg.path}: ${ResponseDiff.formatValue(chg.oldValue)} -> ${ResponseDiff.formatValue(chg.newValue)}`;
        },

        _renderScripts() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            if (!this._scriptsSnapshot) this._scriptsSnapshot = PageInspector.getInlineScripts();
            const scripts = this._scriptsSnapshot;

            if (this._expandedScriptIndex !== null) {
                const s = scripts.find((sc) => sc.index === this._expandedScriptIndex);
                if (s) {

                    if (s.external && s.full === null) {
                        area.innerHTML = `
                            <button id="ttd-pi-script-back" style="${Helpers._secondaryBtnStyle(t)}margin-bottom:6px;">Back to list</button>
                            <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;word-break:break-all;">${Helpers._escape(s.src)}</div>
                            ${s.fetchError ? `<div style="color:${t.statusBad};font-size:11px;margin-bottom:6px;">${Helpers._escape(s.fetchError)}</div>` : ''}
                            <button id="ttd-pi-script-fetch" style="${Helpers._primaryBtnStyle()}">Fetch &amp; view</button>
                        `;
                        document.getElementById('ttd-pi-script-back').onclick = () => { this._expandedScriptIndex = null; this._renderScripts(); };
                        document.getElementById('ttd-pi-script-fetch').onclick = async (e) => {
                            e.target.textContent = 'Fetching...';
                            e.target.disabled = true;
                            const result = await PageInspector.fetchExternalScriptText(s.src);
                            if (result.ok) {
                                s.full = result.text;
                                s.length = result.text.length;
                                s.fetchError = null;
                            } else {
                                s.fetchError = result.error;
                            }
                            this._renderScripts();
                        };
                        return;
                    }

                    area.innerHTML = `
                        <button id="ttd-pi-script-back" style="${Helpers._secondaryBtnStyle(t)}margin-bottom:6px;">Back to list</button>
                        ${s.external ? `<div style="font-size:10px;color:${t.cardDesc};margin-bottom:4px;word-break:break-all;">${Helpers._escape(s.src)}</div>` : ''}
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <span style="font-size:11px;color:${t.cardDesc};">${s.length.toLocaleString()} characters</span>
                            <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
                                <button id="ttd-pi-script-sandbox" style="${Helpers._secondaryBtnStyle(t)}">Test in Sandbox</button>
                                <button id="ttd-pi-script-live" style="${Helpers._secondaryBtnStyle(t)}color:${t.statusWarn};">Run on Live Page</button>
                                <button id="ttd-pi-script-copy" style="${Helpers._secondaryBtnStyle(t)}">Copy</button>
                            </div>
                        </div>
                        ${this._renderScriptExecModeRow(t)}
                        <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:300px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0;">${Helpers._escape(s.full.slice(0, 20000))}</pre>
                        <div id="ttd-pi-script-liverun-result" style="margin-top:8px;"></div>
                    `;
                    document.getElementById('ttd-pi-script-back').onclick = () => { this._expandedScriptIndex = null; this._renderScripts(); };
                    document.getElementById('ttd-pi-script-sandbox').onclick = () => this._openSandboxEditor(s.full);

                    document.getElementById('ttd-pi-script-live').onclick = () => this._runScriptOnLivePage(s.full);
                    this._wireScriptExecModeRow(() => this._renderScripts());
                    document.getElementById('ttd-pi-script-copy').onclick = async (e) => {
                        const ok = await copyToClipboard(s.full);
                        e.target.textContent = ok ? 'Copied!' : 'Failed';
                        setTimeout(() => { e.target.textContent = 'Copy'; }, 1200);
                    };
                    return;
                }
            }

            const inlineCount = scripts.filter((s) => !s.external).length;
            const externalCount = scripts.length - inlineCount;

            area.innerHTML = `
                <div style="${Helpers._cardStyle(t)}margin-bottom:8px;">
                    <div style="font-size:11px;font-weight:700;margin-bottom:6px;">Run a script from any URL</div>
                    <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">Not limited to scripts this tool found on the current page - fetch and inspect/run any script URL, subject to the same CORS restrictions as any other fetch from here.</div>
                    <div style="display:flex;gap:6px;margin-bottom:6px;">
                        <input id="ttd-pi-script-anywhere-url" type="text" placeholder="https://example.com/script.js" value="${Helpers._escape(this._scriptAnywhereUrl)}" style="flex:1;min-width:0;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:11px;">
                        <button id="ttd-pi-script-anywhere-fetch" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;" ${this._scriptAnywhereFetching ? 'disabled' : ''}>${this._scriptAnywhereFetching ? 'Fetching...' : 'Fetch'}</button>
                    </div>
                    <div id="ttd-pi-script-anywhere-result"></div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:11px;color:${t.cardDesc};">${inlineCount} inline, ${externalCount} external</span>
                    <div>
                        <button id="ttd-pi-scripts-refresh" style="${Helpers._secondaryBtnStyle(t)}">Refresh</button>
                        <button id="ttd-pi-scripts-copyall" style="${Helpers._secondaryBtnStyle(t)}">Copy all</button>
                    </div>
                </div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:6px;">External scripts show their URL only until you tap in and fetch them - not fetched up front for every script tag.</div>
                <div id="ttd-pi-scripts-list" style="max-height:320px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;"></div>
            `;

            document.getElementById('ttd-pi-script-anywhere-url').oninput = (e) => { this._scriptAnywhereUrl = e.target.value; };
            document.getElementById('ttd-pi-script-anywhere-fetch').onclick = async () => {
                const url = (this._scriptAnywhereUrl || '').trim();
                if (!url) return;
                this._scriptAnywhereFetching = true;
                this._scriptAnywhereResult = null;
                this._renderScripts();
                const result = await PageInspector.fetchExternalScriptText(url);
                this._scriptAnywhereFetching = false;
                this._scriptAnywhereResult = result;
                this._renderScripts();
            };
            this._renderScriptAnywhereResult();

            document.getElementById('ttd-pi-scripts-refresh').onclick = () => { this._scriptsSnapshot = PageInspector.getInlineScripts(); this._renderScripts(); };
            document.getElementById('ttd-pi-scripts-copyall').onclick = async (e) => {

                const combined = scripts.map((s) => {
                    const header = s.external
                        ? `--- Script #${s.index} (external: ${s.src}) ---`
                        : `--- Script #${s.index} (inline, ${s.length.toLocaleString()} chars) ---`;
                    const body = s.full !== null ? s.full : '(not fetched - open this entry and tap "Fetch & view" first)';
                    return `${header}\n${body}`;
                }).join('\n\n');
                const ok = await copyToClipboard(combined);
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy all'; }, 1200);
            };

            const listEl = document.getElementById('ttd-pi-scripts-list');
            if (!scripts.length) {
                listEl.innerHTML = `<div style="padding:8px;font-size:11px;color:${t.cardDesc};">No scripts found.</div>`;
                return;
            }
            scripts.forEach((s) => {
                const row = document.createElement('div');
                row.style.cssText = `padding:6px 8px;font-size:11px;border-bottom:1px solid ${t.rowBorder};cursor:pointer;word-break:break-all;`;
                if (s.external) {
                    const fetchedTag = s.full !== null ? ` <span style="color:${t.statusOk};font-size:10px;">(fetched, ${s.length.toLocaleString()} chars)</span>` : '';
                    row.innerHTML = `<span style="font-weight:700;">Script #${s.index} (external)</span>${fetchedTag}<br><span style="font-size:10px;color:${t.cardDesc};">${Helpers._escape(s.src)}</span>`;
                } else {
                    const hintText = s.hints.length ? `<br><span style="font-size:10px;color:${t.statusWarn};">possible vars (unverified guess): ${s.hints.map((h) => Helpers._escape(h)).join(', ')}</span>` : '';
                    row.innerHTML = `<span style="font-weight:700;">Script #${s.index}</span> <span style="color:${t.cardDesc};">(${s.length.toLocaleString()} chars)</span>${hintText}<br><span style="font-size:10px;color:${t.cardDesc};">${Helpers._escape(s.preview)}</span>`;
                }
                row.onclick = () => { this._expandedScriptIndex = s.index; this._renderScripts(); };
                listEl.appendChild(row);
            });
        },

        _renderScriptAnywhereResult() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-script-anywhere-result');
            if (!el) return;
            const r = this._scriptAnywhereResult;
            if (!r) { el.innerHTML = ''; return; }

            if (!r.ok) {
                el.innerHTML = `<div style="font-size:11px;color:${t.statusBad};margin-top:4px;">${Helpers._escape(r.error)}</div>`;
                return;
            }

            el.innerHTML = `
                <div style="font-size:11px;color:${t.cardDesc};margin-bottom:4px;">${r.text.length.toLocaleString()} characters fetched</div>
                <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:10px;margin:0 0 6px;">${Helpers._escape(r.text.slice(0, 20000))}</pre>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
                    <button id="ttd-pi-script-anywhere-sandbox" style="${Helpers._secondaryBtnStyle(t)}">Test in Sandbox</button>
                    <button id="ttd-pi-script-anywhere-live" style="${Helpers._secondaryBtnStyle(t)}color:${t.statusWarn};">Run on Live Page</button>
                    <button id="ttd-pi-script-anywhere-copy" style="${Helpers._secondaryBtnStyle(t)}">Copy</button>
                </div>
                ${this._renderScriptExecModeRow(t)}
                <div id="ttd-pi-script-anywhere-liverun-result"></div>
            `;
            document.getElementById('ttd-pi-script-anywhere-sandbox').onclick = () => this._openSandboxEditor(r.text);
            document.getElementById('ttd-pi-script-anywhere-live').onclick = () => this._runScriptOnLivePage(r.text, 'ttd-pi-script-anywhere-liverun-result');
            this._wireScriptExecModeRow(() => this._renderScriptAnywhereResult());
            document.getElementById('ttd-pi-script-anywhere-copy').onclick = async (e) => {
                const ok = await copyToClipboard(r.text);
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy'; }, 1200);
            };
        },

        _renderScriptExecModeRow(t) {
            return `
                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <button id="ttd-pi-script-execmode-page" style="${Helpers._pillStyle(t, this._scriptExecMode !== 'isolated')}flex:1;font-size:10px;padding:4px 8px;">Page context</button>
                    <button id="ttd-pi-script-execmode-isolated" style="${Helpers._pillStyle(t, this._scriptExecMode === 'isolated')}flex:1;font-size:10px;padding:4px 8px;">Isolated (bypass CSP)</button>
                </div>
            `;
        },

        _wireScriptExecModeRow(rerenderFn) {
            const pageBtn = document.getElementById('ttd-pi-script-execmode-page');
            const isoBtn = document.getElementById('ttd-pi-script-execmode-isolated');
            if (pageBtn) pageBtn.onclick = () => { this._scriptExecMode = 'page'; rerenderFn(); };
            if (isoBtn) isoBtn.onclick = () => { this._scriptExecMode = 'isolated'; rerenderFn(); };
        },

        async _runScriptOnLivePage(code, resultElId) {
            resultElId = resultElId || 'ttd-pi-script-liverun-result';
            const resultEl = document.getElementById(resultElId);
            const modeLabel = this._scriptExecMode === 'isolated' ? 'Isolated (bypass CSP)' : 'Page context';
            if (!confirm(`Run this script directly on the live page, using ${modeLabel}? This can read and change anything that mode has access to, including other scripts' data, and there's no undo.`)) return;

            if (resultEl) resultEl.innerHTML = `<div style="${Helpers._noteStyle()}">Running...</div>`;
            const result = await PageInspector.executeWithMode(code, this._scriptExecMode);
            if (!resultEl) return; 
            this._renderLiveRunResult(result, resultElId);
        },

        _renderLiveRunResult(r, resultElId) {
            const t = Theme.palette;
            const resultEl = document.getElementById(resultElId || 'ttd-pi-script-liverun-result');
            if (!resultEl) return;
            const modeNote = `<div style="font-size:9px;color:${t.cardDesc};margin-bottom:4px;">Ran via ${r.mode === 'isolated' ? 'Isolated (bypass CSP)' : 'Page context'}</div>`;

            if (!r.ok) {
                resultEl.innerHTML = `
                    <div style="color:${t.statusBad};font-size:12px;margin-bottom:4px;font-weight:700;">Error</div>
                    ${modeNote}
                    <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:11px;margin:0;">${Helpers._escape(r.error || 'Unknown error')}${r.stack ? '\n\n' + Helpers._escape(r.stack) : ''}</pre>
                `;
                return;
            }

            resultEl.innerHTML = `
                <div style="font-size:11px;color:${t.statusOk};font-weight:700;margin-bottom:4px;">Ran - result</div>
                ${modeNote}
                <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:11px;margin:0;">${Helpers._escape(r.value == null ? 'undefined' : String(r.value))}</pre>
            `;
        },

        _openSandboxEditor(code) {
            this._sandboxCode = code;
            this._sandboxResult = null;
            this._sandboxRunning = false;
            this._renderSandboxEditor();
        },

        _renderSandboxEditor() {
            const t = Theme.palette;
            document.getElementById('ttd-sandbox-panel')?.remove();
            const sandboxHistory = Config.sandboxCodeHistory;

            const panel = document.createElement('div');
            panel.id = 'ttd-sandbox-panel';
            panel.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:320px;max-width:92vw;max-height:85vh;overflow-y:auto;background:${t.panelBg};color:${t.panelText};border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.6);z-index:999999;padding:16px;font-size:13px;`;
            panel.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:14px;font-weight:700;">Script Sandbox</span>
                    <button id="ttd-sandbox-close" style="background:none;border:none;color:${t.panelText};cursor:pointer;font-size:20px;line-height:1;">\u00D7</button>
                </div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:10px;">Runs in an isolated sandboxed iframe - it cannot touch this page's real DOM, cookies, or network. "document"/"localStorage"/"sessionStorage" are limited fake stand-ins (fake elements with no-op methods, in-memory storage), not a faithful DOM - a script using "window.document" explicitly bypasses the stand-in and hits the sandbox's own real-but-blank document instead. Capped at ${(ScriptSandbox.TIMEOUT_MS / 1000).toFixed(0)}s per run; each run starts fresh, nothing carries over from the last one.</div>

                <textarea id="ttd-sandbox-code" style="width:100%;height:160px;box-sizing:border-box;padding:6px;margin-bottom:8px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:10px;font-family:monospace;">${Helpers._escape(this._sandboxCode)}</textarea>

                <div style="display:flex;gap:6px;margin-bottom:10px;">
                    <button id="ttd-sandbox-run" style="${Helpers._primaryBtnStyle()}flex:1;" ${this._sandboxRunning ? 'disabled' : ''}>${this._sandboxRunning ? 'Running...' : 'Run'}</button>
                    <button id="ttd-sandbox-to-console" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;">Send to Console</button>
                </div>
                <div style="font-size:10px;color:${t.cardDesc};margin-top:-6px;margin-bottom:10px;">"Send to Console" only fills in the JS Console's input with whatever's in this box right now - it does not run anything itself. This is the one place a script from anywhere (pasted, edited here, or opened from Script sources) can reach live-page execution, and it always goes through the Console's own explicit Run action on whatever page you're on when you tap it - never automatically.</div>

                <div id="ttd-sandbox-output"></div>
                ${sandboxHistory.length ? `
                <div style="margin-top:10px;">
                    <div style="font-size:11px;font-weight:700;margin-bottom:4px;">Recent snippets</div>
                    ${sandboxHistory.slice().reverse().map((h, i) => `<div data-sandbox-history-idx="${i}" style="padding:5px 0;border-bottom:1px solid ${t.rowBorder};font-size:11px;cursor:pointer;word-break:break-all;font-family:monospace;">${Helpers._escape(h.length > 80 ? h.slice(0, 80) + '...' : h)}</div>`).join('')}
                </div>` : ''}
            `;
            document.body.appendChild(panel);

            document.getElementById('ttd-sandbox-close').onclick = () => panel.remove();
            document.getElementById('ttd-sandbox-code').oninput = (e) => { this._sandboxCode = e.target.value; };
            document.getElementById('ttd-sandbox-run').onclick = () => this._runSandbox();

            document.getElementById('ttd-sandbox-to-console').onclick = () => {
                this._consoleCode = this._sandboxCode;
                panel.remove();
                this._section = 'console';
                this.render(); 
            };

            const reversedSandboxHistory = sandboxHistory.slice().reverse();
            panel.querySelectorAll('[data-sandbox-history-idx]').forEach((el) => {
                el.onclick = () => {
                    const idx = parseInt(el.getAttribute('data-sandbox-history-idx'), 10);
                    this._sandboxCode = reversedSandboxHistory[idx];
                    this._renderSandboxEditor();
                };
            });

            if (this._sandboxResult) this._renderSandboxOutput();
        },

        async _runSandbox() {
            if (this._sandboxRunning) return; 
            this._sandboxRunning = true;
            this._sandboxResult = null;
            this._renderSandboxEditor();

            const result = await ScriptSandbox.run(this._sandboxCode);

            const code = (this._sandboxCode || '').trim();
            if (code) {
                const historyList = Config.sandboxCodeHistory.filter((h) => h !== code);
                historyList.push(code);
                Config.sandboxCodeHistory = historyList;
            }

            this._sandboxRunning = false;
            this._sandboxResult = result;
            this._renderSandboxEditor();
        },

        _renderSandboxOutput() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-sandbox-output');
            if (!el) return;
            const r = this._sandboxResult;

            const levelColors = { log: t.rowText, info: t.statusOk, warn: t.statusWarn, error: t.statusBad };
            const logLines = r.logs.length
                ? r.logs.map((l) => `<div style="color:${levelColors[l.level] || t.rowText};font-size:10px;padding:2px 0;border-bottom:1px solid ${t.rowBorder};word-break:break-word;"><b>${Helpers._escape(l.level)}</b> ${Helpers._escape(l.text)}</div>`).join('')
                : `<div style="font-size:10px;color:${t.cardDesc};padding:4px 0;">No console output.</div>`;

            el.innerHTML = `
                ${r.timedOut ? `<div style="font-size:11px;color:${t.statusBad};font-weight:700;margin-bottom:6px;">Timed out after ${ScriptSandbox.TIMEOUT_MS / 1000}s - a synchronous loop's currently-executing statement can't be interrupted mid-run by removing the iframe; that's a real JS/browser limitation, not specific to this sandbox.</div>` : ''}
                ${r.error ? `<div style="font-size:11px;color:${t.statusBad};font-weight:700;margin-bottom:6px;">Threw: ${Helpers._escape(r.error)}</div>` : ''}
                <div style="font-size:11px;font-weight:700;margin-bottom:4px;">Console output (${r.logs.length})</div>
                <div style="max-height:200px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;padding:6px;margin-bottom:8px;">${logLines}</div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">${r.durationMs}ms${r.timedOut ? ' (hit the timeout)' : ''}</div>
                <button id="ttd-sandbox-copy-output" style="${Helpers._secondaryBtnStyle(t)}width:100%;">Copy output</button>
            `;

            document.getElementById('ttd-sandbox-copy-output').onclick = async (e) => {
                const text = (r.error ? `Threw: ${r.error}\n` : '') + (r.timedOut ? `Timed out after ${ScriptSandbox.TIMEOUT_MS / 1000}s\n` : '') + r.logs.map((l) => `[${l.level}] ${l.text}`).join('\n');
                const ok = await copyToClipboard(text || '(no output)');
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy output'; }, 1200);
            };
        },

        _renderConsole() {
            const t = Theme.palette;
            const area = document.getElementById('ttd-pi-content');
            const history = Config.jsConsoleHistory;

            area.innerHTML = `
                <div style="font-size:10px;color:${t.statusWarn};margin-bottom:8px;">Runs directly against the live page - it can read and change anything the chosen mode has access to, including other scripts' data and storage. There's no undo.</div>

                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Execution mode</div>
                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <button id="ttd-pi-console-mode-page" style="${Helpers._pillStyle(t, this._consoleExecMode === 'page')}flex:1;font-size:11px;">Page context</button>
                    <button id="ttd-pi-console-mode-isolated" style="${Helpers._pillStyle(t, this._consoleExecMode === 'isolated')}flex:1;font-size:11px;">Isolated</button>
                    <button id="ttd-pi-console-mode-path" style="${Helpers._pillStyle(t, this._consoleExecMode === 'path')}flex:1;font-size:11px;">Path access</button>
                </div>
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">${
                    this._consoleExecMode === 'isolated'
                    ? 'Compiles your code in the userscript\'s own isolated JavaScript context rather than the page\'s - many browsers don\'t apply the page\'s CSP to that context, so this often still works when Page context is CSP-blocked. Reference the live page via the <code>unsafeWindow</code> variable (e.g. unsafeWindow.gameState) - a bare "window" here means this isolated context\'s own window, not the page\'s. Whether this genuinely bypasses CSP depends on your browser/userscript manager - use Test compile to check for certain on this page, rather than assuming.'
                    : this._consoleExecMode === 'path'
                    ? 'Reads, writes, or calls a single property path directly (e.g. gameState.player.money) using real property access rather than compiling any code from a string - CSP\'s \'unsafe-eval\' restriction only governs the latter, so this works even where both other modes are CSP-blocked. The tradeoff: no loops, no multi-statement logic, no arbitrary expressions - one path, one operation.'
                    : 'Runs via the page\'s own eval() - full, direct access to the page\'s real globals with no prefix needed, but bound by whatever Content Security Policy this specific page sets. Different sites (and even different pages on the same site) can differ here; a CSP rejection is that page\'s own policy, not a bug. If you hit one, try Isolated, or Path access for simple reads/writes/calls.'
                }</div>
                ${this._consoleExecMode === 'isolated' ? `
                <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
                    <button id="ttd-pi-console-test-compile" style="${Helpers._secondaryBtnStyle(t)}">Test compile</button>
                    <span id="ttd-pi-console-test-compile-result" style="font-size:10px;"></span>
                </div>` : ''}

                <div id="ttd-pi-console-input-area"></div>
                <div id="ttd-pi-console-result" style="margin-top:8px;"></div>

                ${this._consoleExecMode !== 'path' ? `
                <div style="${Helpers._cardStyle(t)}margin-top:10px;">
                    <div style="font-size:11px;font-weight:700;margin-bottom:4px;">Event-driven automation</div>
                    <div style="font-size:10px;color:${t.cardDesc};margin-bottom:8px;">Pick an element and event, then arm this box's current code (and current execution mode) to run automatically - via the same live-page execution as Run above - every time that event fires. One binding at a time. Runs skip themselves while a previous run is still in flight, so a fast-firing event can't pile up overlapping executions.</div>
                    <div id="ttd-pi-console-auto-body"></div>
                </div>` : `
                <div style="font-size:10px;color:${t.cardDesc};margin-top:10px;">Event-driven automation arms a code snippet, which Path access doesn't have - switch to Page context or Isolated mode to use it.</div>
                `}

                ${history.length && this._consoleExecMode !== 'path' ? `
                <div style="margin-top:10px;">
                    <div style="font-size:11px;font-weight:700;margin-bottom:4px;">Recent snippets</div>
                    ${history.slice().reverse().map((h, i) => `<div data-console-history-idx="${i}" style="padding:5px 0;border-bottom:1px solid ${t.rowBorder};font-size:11px;cursor:pointer;word-break:break-all;font-family:monospace;">${Helpers._escape(h.length > 80 ? h.slice(0, 80) + '...' : h)}</div>`).join('')}
                </div>` : ''}
            `;

            document.getElementById('ttd-pi-console-mode-page').onclick = () => { this._consoleExecMode = 'page'; this._renderConsole(); };
            document.getElementById('ttd-pi-console-mode-isolated').onclick = () => { this._consoleExecMode = 'isolated'; this._renderConsole(); };
            document.getElementById('ttd-pi-console-mode-path').onclick = () => { this._consoleExecMode = 'path'; this._renderConsole(); };
            const testCompileBtn = document.getElementById('ttd-pi-console-test-compile');
            if (testCompileBtn) testCompileBtn.onclick = async () => {
                const resultEl = document.getElementById('ttd-pi-console-test-compile-result');
                testCompileBtn.disabled = true;
                if (resultEl) { resultEl.textContent = 'Testing...'; resultEl.style.color = t.cardDesc; }
                const result = await PageInspector.testIsolatedCompile();
                testCompileBtn.disabled = false;
                if (!resultEl) return;
                if (result.ok) {
                    resultEl.textContent = 'Works here - isolated compilation is not blocked by this page\'s CSP.';
                    resultEl.style.color = t.statusOk;
                } else {
                    resultEl.textContent = `Also blocked here: ${result.error}`;
                    resultEl.style.color = t.statusBad;
                }
            };

            this._renderConsoleInputArea();

            const reversedHistory = history.slice().reverse();
            area.querySelectorAll('[data-console-history-idx]').forEach((el) => {
                el.onclick = () => {
                    const idx = parseInt(el.getAttribute('data-console-history-idx'), 10);
                    this._consoleCode = reversedHistory[idx];
                    this._consoleExecMode = this._consoleExecMode === 'path' ? 'page' : this._consoleExecMode;
                    this._renderConsole();
                };
            });

            if (this._consoleExecMode === 'path') {
                if (this._pathAccessResult) this._renderPathAccessResult();
            } else {
                if (this._consoleResult) this._renderConsoleResult();
                ConsoleAutomation._onLogChanged = () => {
                    if (this._section !== 'console') { ConsoleAutomation._onLogChanged = null; return; }
                    this._renderConsoleAutomation();
                };
                this._renderConsoleAutomation();
            }
        },

        _renderConsoleInputArea() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-console-input-area');
            if (!el) return;

            if (this._consoleExecMode === 'path') {
                el.innerHTML = `
                    <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Path</div>
                    <input id="ttd-pi-path-input" type="text" value="${Helpers._escape(this._pathAccessPath)}" placeholder="e.g. gameState.player.money" style="width:100%;box-sizing:border-box;padding:7px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;font-family:monospace;">
                    <div style="display:flex;gap:6px;margin-bottom:6px;">
                        <button id="ttd-pi-path-op-get" style="${Helpers._pillStyle(t, this._pathAccessOp === 'get')}flex:1;">Get</button>
                        <button id="ttd-pi-path-op-set" style="${Helpers._pillStyle(t, this._pathAccessOp === 'set')}flex:1;">Set</button>
                        <button id="ttd-pi-path-op-call" style="${Helpers._pillStyle(t, this._pathAccessOp === 'call')}flex:1;">Call</button>
                    </div>
                    ${this._pathAccessOp === 'set' ? `
                    <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">New value (JSON - strings need quotes)</div>
                    <input id="ttd-pi-path-value" type="text" value="${Helpers._escape(this._pathAccessValue)}" placeholder='e.g. 500, "text", true, {"a":1}' style="width:100%;box-sizing:border-box;padding:7px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;font-family:monospace;">
                    ` : ''}
                    ${this._pathAccessOp === 'call' ? `
                    <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Arguments (JSON array, optional)</div>
                    <input id="ttd-pi-path-args" type="text" value="${Helpers._escape(this._pathAccessArgs)}" placeholder='e.g. [1,"two",true] - leave blank for none' style="width:100%;box-sizing:border-box;padding:7px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;font-family:monospace;">
                    ` : ''}
                    <button id="ttd-pi-path-run" style="${Helpers._primaryBtnStyle()}">${this._pathAccessOp === 'get' ? 'Get' : this._pathAccessOp === 'set' ? 'Set' : 'Call'}</button>
                `;

                document.getElementById('ttd-pi-path-input').oninput = (e) => { this._pathAccessPath = e.target.value; };
                document.getElementById('ttd-pi-path-op-get').onclick = () => { this._pathAccessOp = 'get'; this._renderConsoleInputArea(); };
                document.getElementById('ttd-pi-path-op-set').onclick = () => { this._pathAccessOp = 'set'; this._renderConsoleInputArea(); };
                document.getElementById('ttd-pi-path-op-call').onclick = () => { this._pathAccessOp = 'call'; this._renderConsoleInputArea(); };
                const valueInput = document.getElementById('ttd-pi-path-value');
                if (valueInput) valueInput.oninput = (e) => { this._pathAccessValue = e.target.value; };
                const argsInput = document.getElementById('ttd-pi-path-args');
                if (argsInput) argsInput.oninput = (e) => { this._pathAccessArgs = e.target.value; };
                document.getElementById('ttd-pi-path-run').onclick = () => this._runPathAccess();
                return;
            }

            el.innerHTML = `
                <textarea id="ttd-pi-console-code" rows="5" placeholder="e.g. document.title" style="width:100%;box-sizing:border-box;padding:7px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;font-family:monospace;resize:vertical;">${Helpers._escape(this._consoleCode)}</textarea>
                <div style="display:flex;gap:6px;margin-top:6px;">
                    <button id="ttd-pi-console-run" style="${Helpers._primaryBtnStyle()}">Run</button>
                    <button id="ttd-pi-console-copycode" style="${Helpers._secondaryBtnStyle(t)}white-space:nowrap;">Copy code</button>
                </div>
            `;
            document.getElementById('ttd-pi-console-code').oninput = (e) => { this._consoleCode = e.target.value; };
            document.getElementById('ttd-pi-console-run').onclick = () => this._runConsole();
            document.getElementById('ttd-pi-console-copycode').onclick = async (e) => {
                const ok = await copyToClipboard(this._consoleCode);
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy code'; }, 1200);
            };
        },

        async _runPathAccess() {
            const resultEl = document.getElementById('ttd-pi-console-result');
            const path = (this._pathAccessPath || '').trim();
            if (!path) { if (resultEl) resultEl.innerHTML = `<div style="${Helpers._noteStyle()}">Enter a path first.</div>`; return; }

            let result;
            if (this._pathAccessOp === 'get') {
                result = PathAccess.get(path);
            } else if (this._pathAccessOp === 'set') {
                if (!confirm(`Set "${path}" to this value on the live page? This directly writes into the page's real JS state - no undo.`)) return;
                if (resultEl) resultEl.innerHTML = `<div style="${Helpers._noteStyle()}">Setting...</div>`;
                result = PathAccess.set(path, this._pathAccessValue);
            } else {
                if (!confirm(`Call "${path}(...)" on the live page? This directly invokes a real function - it can do anything that function's own code allows, no undo.`)) return;
                if (resultEl) resultEl.innerHTML = `<div style="${Helpers._noteStyle()}">Calling...</div>`;
                result = await PathAccess.call(path, this._pathAccessArgs);
            }

            this._pathAccessResult = result;
            this._renderPathAccessResult();
        },

        _renderPathAccessResult() {
            const t = Theme.palette;
            const resultEl = document.getElementById('ttd-pi-console-result');
            if (!resultEl) return;
            const r = this._pathAccessResult;
            if (!r) { resultEl.innerHTML = ''; return; }
            const modeNote = `<div style="font-size:9px;color:${t.cardDesc};margin-bottom:4px;">Ran via Path access (${this._pathAccessOp}) - never compiles code from a string, unaffected by any page's CSP</div>`;

            if (!r.ok) {
                resultEl.innerHTML = `
                    <div style="color:${t.statusBad};font-size:12px;margin-bottom:4px;font-weight:700;">Error</div>
                    ${modeNote}
                    <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:11px;margin:0;">${Helpers._escape(r.error || 'Unknown error')}</pre>
                `;
                return;
            }

            resultEl.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-size:11px;color:${t.statusOk};font-weight:700;">Result <span style="color:${t.cardDesc};font-weight:400;">(${Helpers._escape(r.rawType)})</span></span>
                    <button id="ttd-pi-path-copyresult" style="${Helpers._secondaryBtnStyle(t)}">Copy</button>
                </div>
                ${modeNote}
                <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:11px;margin:0;">${Helpers._escape(r.value == null ? 'undefined' : String(r.value))}</pre>
            `;
            document.getElementById('ttd-pi-path-copyresult').onclick = async (e) => {
                const ok = await copyToClipboard(String(r.value));
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy'; }, 1200);
            };
        },

        _renderConsoleAutomation() {
            const t = Theme.palette;
            const el = document.getElementById('ttd-pi-console-auto-body');
            if (!el) return;
            const binding = ConsoleAutomation.current();

            if (binding) {
                const recent = binding.log.slice().reverse().slice(0, 20);
                el.innerHTML = `
                    <div style="padding:6px 8px;border:1px solid ${t.rowBorder};border-radius:6px;margin-bottom:8px;">
                        <div style="font-size:11px;"><span style="color:${t.statusOk};font-weight:700;">Armed</span> - "${Helpers._escape(binding.eventType)}" on ${Helpers._escape(binding.describe)} <span style="color:${t.cardDesc};font-size:10px;">(${binding.mode === 'isolated' ? 'Isolated' : 'Page context'})</span></div>
                        <div style="font-size:10px;color:${t.cardDesc};margin-top:2px;">${binding.runCount} run${binding.runCount === 1 ? '' : 's'} since ${Helpers._timeAgo(binding.startedAt)}${binding.running ? ' - running now...' : ''}</div>
                        <div style="font-size:10px;color:${t.cardDesc};margin-top:4px;word-break:break-all;font-family:monospace;">${Helpers._escape(binding.code.length > 100 ? binding.code.slice(0, 100) + '...' : binding.code)}</div>
                    </div>
                    <button id="ttd-pi-console-auto-disarm" style="${Helpers._secondaryBtnStyle(t)}color:${t.statusBad};width:100%;margin-bottom:8px;">Disarm</button>
                    ${recent.length ? `
                    <div style="font-size:11px;font-weight:700;margin-bottom:4px;">Run log</div>
                    <div style="max-height:160px;overflow-y:auto;border:1px solid ${t.rowBorder};border-radius:6px;">
                        ${recent.map((l) => `
                            <div style="padding:5px 8px;border-bottom:1px solid ${t.rowBorder};font-size:10px;">
                                <span style="color:${l.ok ? t.statusOk : t.statusBad};font-weight:700;">${l.ok ? 'ok' : 'error'}</span> <span style="color:${t.cardDesc};">- ${Helpers._timeAgo(l.timestamp)}</span><br>
                                <span style="word-break:break-word;">${Helpers._escape(String(l.ok ? (l.value == null ? 'undefined' : l.value) : l.error).slice(0, 200))}</span>
                            </div>
                        `).join('')}
                    </div>` : ''}
                `;
                document.getElementById('ttd-pi-console-auto-disarm').onclick = () => {
                    ConsoleAutomation.stop();
                    this._renderConsoleAutomation();
                };
                return;
            }

            el.innerHTML = `
                <button id="ttd-pi-console-auto-pick" style="${Helpers._secondaryBtnStyle(t)}width:100%;margin-bottom:6px;">${this._consoleAutoPicked ? 'Change element' : 'Pick element'}</button>
                ${this._consoleAutoPicked ? `<div style="font-size:10px;color:${t.statusOk};margin-bottom:6px;word-break:break-all;">Picked: ${Helpers._escape(EventDebugger._describeElement(this._consoleAutoPicked))}</div>` : ''}
                <div style="font-size:10px;color:${t.cardDesc};margin-bottom:2px;">Event type</div>
                <select id="ttd-pi-console-auto-eventtype" style="width:100%;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">
                    <option value="click">click</option>
                    <option value="input">input</option>
                    <option value="change">change</option>
                    <option value="submit">submit</option>
                    <option value="mouseenter">mouseenter</option>
                    <option value="mouseleave">mouseleave</option>
                    <option value="focus">focus</option>
                    <option value="blur">blur</option>
                    <option value="__custom">custom event name...</option>
                </select>
                <input id="ttd-pi-console-auto-customtype" type="text" placeholder="custom event name" style="display:none;width:100%;box-sizing:border-box;padding:6px;margin-bottom:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">
                <button id="ttd-pi-console-auto-arm" style="${Helpers._primaryBtnStyle()}" ${this._consoleAutoPicked ? '' : 'disabled'}>Arm with current code</button>
            `;

            document.getElementById('ttd-pi-console-auto-pick').onclick = () => {
                UI.enterPickMode((pickedEl) => {
                    if (pickedEl) this._consoleAutoPicked = pickedEl;
                });
            };
            const typeSelect = document.getElementById('ttd-pi-console-auto-eventtype');
            const customInput = document.getElementById('ttd-pi-console-auto-customtype');
            typeSelect.onchange = () => {
                customInput.style.display = typeSelect.value === '__custom' ? 'block' : 'none';
            };
            document.getElementById('ttd-pi-console-auto-arm').onclick = () => {
                if (!this._consoleAutoPicked) return;
                const eventType = typeSelect.value === '__custom' ? (customInput.value || '').trim() : typeSelect.value;
                if (!eventType) { customInput.style.borderColor = t.statusBad; return; }
                const code = (this._consoleCode || '').trim();
                if (!code) { alert('Enter some code in the box above first.'); return; }
                if (!confirm(`Arm this code to run automatically every time "${eventType}" fires on the picked element? It'll keep running - unattended, no confirmation each time - until you disarm it or reload the page.`)) return;
                ConsoleAutomation.start(this._consoleAutoPicked, eventType, code, this._consoleExecMode);
                this._consoleAutoPicked = null;
                this._renderConsoleAutomation();
            };
        },

        async _runConsole() {
            const code = (this._consoleCode || '').trim();
            const resultEl = document.getElementById('ttd-pi-console-result');
            if (!code) { resultEl.innerHTML = `<div style="${Helpers._noteStyle()}">Enter some JavaScript first.</div>`; return; }

            resultEl.innerHTML = `<div style="${Helpers._noteStyle()}">Running...</div>`;
            const result = await PageInspector.executeWithMode(code, this._consoleExecMode);
            this._consoleResult = result;

            const historyList = Config.jsConsoleHistory.filter((h) => h !== code);
            historyList.push(code);
            Config.jsConsoleHistory = historyList;

            this._renderConsole(); 
        },

        _renderConsoleResult() {
            const t = Theme.palette;
            const resultEl = document.getElementById('ttd-pi-console-result');
            if (!resultEl) return;
            const r = this._consoleResult;
            if (!r) { resultEl.innerHTML = ''; return; }
            const modeNote = `<div style="font-size:9px;color:${t.cardDesc};margin-bottom:4px;">Ran via ${r.mode === 'isolated' ? 'Isolated (bypass CSP)' : 'Page context'}</div>`;

            if (!r.ok) {
                resultEl.innerHTML = `
                    <div style="color:${t.statusBad};font-size:12px;margin-bottom:4px;font-weight:700;">Error</div>
                    ${modeNote}
                    <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:11px;margin:0;">${Helpers._escape(r.error || 'Unknown error')}${r.stack ? '\n\n' + Helpers._escape(r.stack) : ''}</pre>
                `;
                return;
            }

            resultEl.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <span style="font-size:11px;color:${t.statusOk};font-weight:700;">Result</span>
                    <button id="ttd-pi-console-copyresult" style="${Helpers._secondaryBtnStyle(t)}">Copy</button>
                </div>
                ${modeNote}
                <pre style="background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};border-radius:6px;padding:8px;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:11px;margin:0;">${Helpers._escape(r.value == null ? 'undefined' : String(r.value))}</pre>
            `;
            document.getElementById('ttd-pi-console-copyresult').onclick = async (e) => {
                const ok = await copyToClipboard(String(r.value));
                e.target.textContent = ok ? 'Copied!' : 'Failed';
                setTimeout(() => { e.target.textContent = 'Copy'; }, 1200);
            };
        }
    };

    const UI = {
        PANEL_WIDTH: 380,
        PANEL_HEIGHT: 580,
        DRAG_THRESHOLD_PX: 6,

        mount() {
            if (!document.getElementById('ttd-launcher')) UI.renderLauncher();
        },

        renderLauncher() {
            document.getElementById('ttd-launcher')?.remove();

            const launcher = document.createElement('div');
            launcher.id = 'ttd-launcher';
            launcher.title = 'Target Data - tap to open';
            launcher.style.cssText = `
                position:fixed; right:0; bottom:120px; width:36px; height:36px;
                background:linear-gradient(180deg, #3f8296, #1e4550);
                color:#fff; border-radius:10px 0 0 10px;
                box-shadow:-2px 2px 8px rgba(0,0,0,0.5); display:flex; align-items:center;
                justify-content:center; font-size:18px; cursor:pointer;
                z-index:999998; user-select:none;
            `;
            launcher.textContent = '\u{1F9EA}';
            launcher.onclick = () => UI.togglePanel();
            document.body.appendChild(launcher);
        },

        togglePanel() {
            const existing = document.getElementById('ttd-panel');
            if (existing) { existing.remove(); return; }
            UI.renderPanel();
        },

        _defaultPos() {
            const vw = window.innerWidth || 400;
            const vh = window.innerHeight || 800;
            return {
                x: Math.max(8, vw - UI.PANEL_WIDTH - 8),
                y: Math.max(8, vh - UI.PANEL_HEIGHT - 90)
            };
        },

        _clampPos(x, y, w, h) {
            const vw = window.innerWidth || 400;
            const vh = window.innerHeight || 800;
            return {
                x: Math.min(Math.max(8, x), Math.max(8, vw - w - 8)),
                y: Math.min(Math.max(8, y), Math.max(8, vh - h - 8))
            };
        },

        renderPanel() {
            document.getElementById('ttd-panel')?.remove();

            const t = Theme.palette;
            const stored = Config.panelPos;
            const pos = stored ? UI._clampPos(stored.x, stored.y, UI.PANEL_WIDTH, UI.PANEL_HEIGHT) : UI._defaultPos();

            const panel = document.createElement('div');
            panel.id = 'ttd-panel';
            panel.style.cssText = `
                position:fixed; left:${pos.x}px; top:${pos.y}px;
                width:${UI.PANEL_WIDTH}px; max-width:92vw;
                height:min(${UI.PANEL_HEIGHT}px, 82vh); max-height:82vh;
                background:${t.panelBg}; color:${t.panelText};
                border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,0.5);
                z-index:999997; display:flex; flex-direction:column; overflow:hidden;
                font-size:13px;
            `;

            panel.innerHTML = `
                <div id="ttd-panel-titlebar" style="padding:10px 12px;background:linear-gradient(135deg, #3f8296, #1e4550);display:flex;justify-content:space-between;align-items:center;cursor:grab;touch-action:none;user-select:none;">
                    <span style="font-size:15px;font-weight:700;color:#fff;">\u{1F9EA} Target Data <span style="font-size:11px;font-weight:400;opacity:.8;">v${APP.version}</span></span>
                    <div>
                        <button id="ttd-open-settings" style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;line-height:1;padding:0 6px;">\u2699\uFE0F</button>
                        <button id="ttd-close-panel" style="background:none;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;padding:0 2px;">\u00D7</button>
                    </div>
                </div>
                <div id="ttd-body" style="padding:12px;overflow-y:auto;flex:1;"></div>
            `;

            document.body.appendChild(panel);

            document.getElementById('ttd-close-panel').onclick = () => panel.remove();
            document.getElementById('ttd-open-settings').onclick = () => SettingsUI.show();

            UI._wireDrag(panel, document.getElementById('ttd-panel-titlebar'));

            PageInspectorUI.render();
        },

        _wireDrag(panel, handle) {
            let dragging = false;
            let moved = false;
            let startX = 0, startY = 0, origX = 0, origY = 0;

            const onDown = (e) => {
                if (e.target.closest('button')) return; 
                dragging = true;
                moved = false;
                startX = e.clientX;
                startY = e.clientY;
                const rect = panel.getBoundingClientRect();
                origX = rect.left;
                origY = rect.top;
                try { handle.setPointerCapture?.(e.pointerId); } catch {  }
                e.preventDefault();
            };

            const onMove = (e) => {
                if (!dragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                if (Math.abs(dx) > UI.DRAG_THRESHOLD_PX || Math.abs(dy) > UI.DRAG_THRESHOLD_PX) moved = true;
                if (!moved) return;

                const rect = panel.getBoundingClientRect();
                const p = UI._clampPos(origX + dx, origY + dy, rect.width, rect.height);
                panel.style.left = `${p.x}px`;
                panel.style.top = `${p.y}px`;
            };

            const onUp = () => {
                if (!dragging) return;
                dragging = false;
                handle.style.cursor = 'grab';
                if (moved) {
                    const rect = panel.getBoundingClientRect();
                    Config.panelPos = { x: rect.left, y: rect.top };
                }
            };

            handle.addEventListener('pointerdown', (e) => { onDown(e); handle.style.cursor = 'grabbing'; });
            handle.addEventListener('pointermove', onMove);
            handle.addEventListener('pointerup', onUp);
            handle.addEventListener('pointercancel', () => { dragging = false; handle.style.cursor = 'grab'; });
        },

        enterPickMode(onDone) {
            const panel = document.getElementById('ttd-panel');
            if (!panel) return;
            const t = Theme.palette;

            panel.style.width = '190px';
            panel.style.height = 'auto';
            panel.innerHTML = `
                <div id="ttd-panel-titlebar" style="padding:8px 10px;background:linear-gradient(135deg, #3f8296, #1e4550);display:flex;align-items:center;gap:6px;cursor:grab;touch-action:none;user-select:none;border-radius:12px 12px 0 0;">
                    <span style="font-size:12px;font-weight:700;color:#fff;">\u{1F3AF} Picking...</span>
                </div>
                <div style="padding:10px;">
                    <div style="font-size:11px;color:${t.panelText};margin-bottom:8px;">Drag this box out of the way, then tap anywhere on the page.</div>
                    <button id="ttd-pick-cancel" style="width:100%;padding:6px;background:${t.secondaryBtnBg};border:1px solid ${t.rowBorder};color:${t.panelText};border-radius:6px;cursor:pointer;font-size:12px;">Cancel</button>
                </div>
            `;

            UI._wireDrag(panel, document.getElementById('ttd-panel-titlebar'));

            document.getElementById('ttd-pick-cancel').onclick = () => {
                ElementPicker.stop();
                UI.exitPickMode(null, onDone);
            };

            ElementPicker.start((el) => UI.exitPickMode(el, onDone));
        },

        exitPickMode(pickedEl, onDone) {

            if (pickedEl) InvestigationRecorder.recordPick(pickedEl);
            if (onDone) onDone(pickedEl);
            UI.renderPanel(); 
        }
    };

    const SettingsUI = {
        show() {
            document.getElementById('ttd-settings-panel')?.remove();
            const t = Theme.palette;

            const panel = document.createElement('div');
            panel.id = 'ttd-settings-panel';
            panel.style.cssText = `
                position:fixed; top:50%; left:50%; transform:translate(-50%, -50%);
                width:280px; max-width:88vw; background:${t.panelBg}; color:${t.panelText};
                border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,0.6);
                z-index:999999; padding:16px; font-size:13px;
            `;
            panel.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <span style="font-size:15px;font-weight:700;">Settings</span>
                    <button id="ttd-settings-close" style="background:none;border:none;color:${t.panelText};cursor:pointer;font-size:20px;line-height:1;">\u00D7</button>
                </div>
                <div style="margin-bottom:12px;">
                    <div style="font-size:11px;color:${t.cardDesc};margin-bottom:4px;">Theme</div>
                    <div style="display:flex;gap:6px;">
                        <button id="ttd-settings-light" style="${Helpers._pillStyle(t, Config.theme === 'light')}">Light</button>
                        <button id="ttd-settings-dark" style="${Helpers._pillStyle(t, Config.theme === 'dark')}">Dark</button>
                    </div>
                </div>
                <div style="margin-bottom:12px;">
                    <div style="font-size:11px;color:${t.cardDesc};margin-bottom:4px;">Trace history cap</div>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <input id="ttd-settings-trace-cap" type="number" min="1" step="1" value="${Config.traceHistoryCap}" style="width:80px;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">
                        <span style="font-size:10px;color:${t.cardDesc};">saved traces (oldest dropped past this)</span>
                    </div>
                </div>
                <div style="margin-bottom:12px;">
                    <div style="font-size:11px;color:${t.cardDesc};margin-bottom:4px;">Persisted traffic cache budget</div>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <input id="ttd-settings-persisted-traffic-budget" type="number" min="1000" step="1000" value="${Config.persistedTrafficBudgetBytes}" style="width:90px;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">
                        <span style="font-size:10px;color:${t.cardDesc};">bytes (~serialized size, not exact) - lower this if writes fail on your userscript host</span>
                    </div>
                </div>
                <div style="margin-bottom:12px;">
                    <div style="font-size:11px;color:${t.cardDesc};margin-bottom:4px;">Recorder cross-reload budget</div>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <input id="ttd-settings-recorder-budget" type="number" min="1000" step="1000" value="${Config.recorderPersistBudgetBytes}" style="width:90px;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">
                        <span style="font-size:10px;color:${t.cardDesc};">bytes - caps how much of a continued recording session survives a reload</span>
                    </div>
                </div>
                <div style="margin-bottom:12px;">
                    <div style="font-size:11px;color:${t.cardDesc};margin-bottom:4px;">Secondary logs budget</div>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <input id="ttd-settings-secondary-logs-budget" type="number" min="1000" step="1000" value="${Config.secondaryLogsBudgetBytes}" style="width:90px;box-sizing:border-box;padding:6px;background:${t.selectBg};color:${t.selectText};border:1px solid ${t.selectBorder};border-radius:6px;font-size:12px;">
                        <span style="font-size:10px;color:${t.cardDesc};">bytes - applied independently to the DOM Mutation Watcher log, WebSocket message catalog, and WebSocket connection history (worst case ~3x this number combined)</span>
                    </div>
                </div>
                <div style="margin-bottom:12px;">
                    <div style="font-size:11px;color:${t.cardDesc};margin-bottom:4px;">Data</div>
                    <button id="ttd-settings-clear" style="${Helpers._secondaryBtnStyle(t)}width:100%;margin-bottom:6px;">Clear endpoint catalog + console + sandbox history</button>
                    <button id="ttd-settings-clear-captured" style="${Helpers._secondaryBtnStyle(t)}width:100%;margin-bottom:6px;">Clear traffic + persisted cache + recorder + snapshots (${ObservedTraffic.all().length + ObservedTraffic.persistedTrafficEntries().length + InvestigationRecorder.timeline().length + SnapshotManager.all().length})</button>
                    <button id="ttd-settings-clear-traces" style="${Helpers._secondaryBtnStyle(t)}width:100%;margin-bottom:6px;">Clear trace history (${TraceHistory.all().length})</button>
                    <button id="ttd-settings-clear-ws-sequences" style="${Helpers._secondaryBtnStyle(t)}width:100%;margin-bottom:6px;">Clear saved WebSocket sequences (${Config.wsSequences.length})</button>
                    <button id="ttd-settings-clear-pageload-snapshots" style="${Helpers._secondaryBtnStyle(t)}width:100%;">Clear page-load traffic snapshots (${Config.pageLoadSnapshots.length})</button>
                    <div style="font-size:10px;color:${t.cardDesc};margin-top:6px;">These only clear what this tool has captured/cached itself - none of them touch the page's actual localStorage, sessionStorage, or cookies (the "DOM snapshot" export category reads those live; there's nothing of this tool's own to clear there).</div>
                </div>
                <div style="font-size:10px;color:${t.cardDesc};margin-top:12px;text-align:center;">Tw33k Tools - Target Data v${APP.version} - GPLv3</div>
            `;
            document.body.appendChild(panel);

            document.getElementById('ttd-settings-close').onclick = () => panel.remove();
            document.getElementById('ttd-settings-light').onclick = () => { Config.theme = 'light'; SettingsUI.show(); UI.renderPanel(); };
            document.getElementById('ttd-settings-dark').onclick = () => { Config.theme = 'dark'; SettingsUI.show(); UI.renderPanel(); };
            document.getElementById('ttd-settings-clear').onclick = (e) => {
                ObservedTraffic.clearCatalog();
                Config.jsConsoleHistory = [];
                Config.sandboxCodeHistory = []; 
                e.target.textContent = 'Cleared!';
                setTimeout(() => { e.target.textContent = 'Clear endpoint catalog + console + sandbox history'; }, 1200);
            };

            document.getElementById('ttd-settings-clear-captured').onclick = (e) => {
                if (!confirm('Clear captured Traffic history, the persisted traffic cache, the Recorder timeline, and saved Snapshots? This does not touch the page\'s real localStorage, sessionStorage, or cookies.')) return;
                ObservedTraffic.clearEntries();
                ObservedTraffic.clearPersistedTraffic();
                InvestigationRecorder.clear();
                SnapshotManager.clear();
                e.target.textContent = 'Cleared!';
                setTimeout(() => { e.target.textContent = 'Clear traffic + persisted cache + recorder + snapshots (0)'; }, 1200);
            };

            const commitPersistedTrafficBudget = () => {
                const input = document.getElementById('ttd-settings-persisted-traffic-budget');
                if (!input) return;
                Config.persistedTrafficBudgetBytes = input.value;
                input.value = Config.persistedTrafficBudgetBytes;
                ObservedTraffic._persistTrafficCache(); 
            };
            document.getElementById('ttd-settings-persisted-traffic-budget').onblur = commitPersistedTrafficBudget;
            document.getElementById('ttd-settings-persisted-traffic-budget').onkeydown = (e) => { if (e.key === 'Enter') { commitPersistedTrafficBudget(); e.target.blur(); } };

            const commitRecorderBudget = () => {
                const input = document.getElementById('ttd-settings-recorder-budget');
                if (!input) return;
                Config.recorderPersistBudgetBytes = input.value;
                input.value = Config.recorderPersistBudgetBytes;
                if (InvestigationRecorder.isRecording()) InvestigationRecorder._persistState();
            };
            document.getElementById('ttd-settings-recorder-budget').onblur = commitRecorderBudget;
            document.getElementById('ttd-settings-recorder-budget').onkeydown = (e) => { if (e.key === 'Enter') { commitRecorderBudget(); e.target.blur(); } };

            const commitSecondaryLogsBudget = () => {
                const input = document.getElementById('ttd-settings-secondary-logs-budget');
                if (!input) return;
                Config.secondaryLogsBudgetBytes = input.value;
                input.value = Config.secondaryLogsBudgetBytes;
                DomMutationWatcher._persistLog();
                WebSocketMonitor._persistState();
            };
            document.getElementById('ttd-settings-secondary-logs-budget').onblur = commitSecondaryLogsBudget;
            document.getElementById('ttd-settings-secondary-logs-budget').onkeydown = (e) => { if (e.key === 'Enter') { commitSecondaryLogsBudget(); e.target.blur(); } };

            const commitCap = () => {
                const input = document.getElementById('ttd-settings-trace-cap');
                if (!input) return;
                Config.traceHistoryCap = input.value;
                input.value = Config.traceHistoryCap; 
            };
            document.getElementById('ttd-settings-trace-cap').onblur = commitCap;
            document.getElementById('ttd-settings-trace-cap').onkeydown = (e) => { if (e.key === 'Enter') { commitCap(); e.target.blur(); } };
            document.getElementById('ttd-settings-clear-traces').onclick = (e) => {
                TraceHistory.clear();
                e.target.textContent = 'Cleared!';
                setTimeout(() => { e.target.textContent = `Clear trace history (0)`; }, 1200);
            };
            document.getElementById('ttd-settings-clear-ws-sequences').onclick = (e) => {
                Config.wsSequences = [];
                e.target.textContent = 'Cleared!';
                setTimeout(() => { e.target.textContent = 'Clear saved WebSocket sequences (0)'; }, 1200);
            };
            document.getElementById('ttd-settings-clear-pageload-snapshots').onclick = (e) => {
                PageLoadSnapshots.clear();
                e.target.textContent = 'Cleared!';
                setTimeout(() => { e.target.textContent = 'Clear page-load traffic snapshots (0)'; }, 1200);
            };
        }
    };

    ObservedTraffic.install();
    WebSocketMonitor.install();
    InvestigationRecorder.resume();
    DomMutationWatcher.install();

    if (document.body) {
        UI.mount();
    } else {
        document.addEventListener('DOMContentLoaded', () => UI.mount(), { once: true });
    }

})();
