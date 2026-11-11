/* FEFCO SOLUTIONS PWA — wires the Google Stitch screens to Supabase (schema dash). */
(function () {
'use strict';
var SB_URL = 'https://lnhddullabrzkyhmogjc.supabase.co';
var SB_KEY = 'sb_publishable_3iRiCjIUTkn4J8TLOQbYIw_1cVcXGDW';
var BASE = '.';
var FILE = window.FEFCO_FILE || function (n) { return './' + n; };
var TZ = 'Asia/Dubai';
var POLL_MS = 45000;
var VERSION = 'v1.0';

/* ---------- storage (works even when the page is sandboxed) ---------- */
var mem = {};
var HAS_LS = (function () { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; } catch (e) { return false; } })();
function sget(k) { try { if (HAS_LS) { var v = localStorage.getItem(k); return v != null ? v : sessionStorage.getItem(k); } } catch (e) {} return mem[k] != null ? mem[k] : null; }
function sset(k, v, session) { mem[k] = v; try { if (HAS_LS) { if (session) { sessionStorage.setItem(k, v); localStorage.removeItem(k); } else localStorage.setItem(k, v); } } catch (e) {} }
function sdel(k) { delete mem[k]; try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) {} }
function remember() { return sget('fefco_remember') !== '0'; }
var authStorage = {
  getItem: function (k) { return sget(k); },
  setItem: function (k, v) { sset(k, v, !remember()); },
  removeItem: function (k) { sdel(k); }
};

var sb = window.supabase.createClient(SB_URL, SB_KEY, {
  db: { schema: 'dash' },
  auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
});

var S = { session: null, me: null, settings: null, cache: {}, rid: 0, ctl: null, arg: '', openAlerts: 0, needsReply: 0,
  f: { q: '', sources: [], services: [], areas: [], statuses: [], date: 'all', from: '', to: '', sort: 'desc', tab: 'all' },
  homeRange: 'today', bk: { mode: 'today', day: null }, adsRange: '7d', remTab: 'queue', showResolved: true, deferredPrompt: null, recovery: false };

/* ---------- helpers ---------- */
function $(r, s) { return (r || document).querySelector(s); }
function $$(r, s) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function txt(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
function byText(root, sel, t, starts) { return $$(root, sel).filter(function (e) { var x = txt(e); return starts ? x.indexOf(t) === 0 : x === t; })[0] || null; }
function cap(s) { s = String(s || '').replace(/[-_]+/g, ' ').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function initials(n) { var p = String(n || '').trim().split(/\s+/).filter(Boolean); if (!p.length) return '?'; return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : (p[0][1] || ''))).toUpperCase(); }
function fmt(d, o) { try { return new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: TZ }, o)).format(new Date(d)); } catch (e) { return ''; } }
function fmtTime(d) { if (!d) return ''; return new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(d)); }
function fmtDay(d) { return d ? fmt(d, { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '') : ''; }
function dDate(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d || Date.now())); }
function today() { return dDate(); }
function addDays(ds, n) { var d = new Date(ds + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function dayStartISO(ds) { return new Date(ds + 'T00:00:00+04:00').toISOString(); }
function rel(d) { if (!d) return ''; var s = (Date.now() - new Date(d).getTime()) / 1000; if (s < -60) { var m = Math.round(-s / 60); return m < 60 ? 'in ' + m + ' min' : (m < 1440 ? 'in ' + Math.round(m / 60) + ' h' : fmtDay(d)); } if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return fmtDay(d); }
function dayLabel(d) { if (!d) return ''; var x = dDate(d); if (x === today()) return fmtTime(d); if (x === addDays(today(), -1)) return 'Yesterday'; return fmtDay(d); }
function dur(sec) { sec = Math.round(Number(sec) || 0); if (!sec) return '0:00'; return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function aed(usd) { return 'AED ' + (num(usd) * 3.6725).toFixed(2); }
function phoneFmt(p) { return p ? String(p) : ''; }
function waLink(p) { return p ? 'https://wa.me/' + String(p).replace(/\D/g, '') : '#'; }
function telLink(p) { return p ? 'tel:' + String(p).replace(/[^\d+]/g, '') : '#'; }
function isSite(t) { return /site|visit/i.test(t || ''); }
function greet() { var h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date())); return h < 12 ? 'Good morning' : (h < 17 ? 'Good afternoon' : 'Good evening'); }
function go(h) { if (location.hash === h) route(); else location.hash = h; }
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isStandalone() { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
function icon(n, cls, fill) { return '<span class="material-symbols-outlined ' + (cls || '') + '"' + (fill ? ' style="font-variation-settings: \'FILL\' 1;"' : '') + '>' + n + '</span>'; }

var toastTimer;
function toast(msg, ic) {
  var t = $(document, '#toastNotification'); if (!t) return;
  $(t, '#toastMessage').textContent = msg; $(t, '#toastIcon').textContent = ic || 'verified';
  t.classList.remove('opacity-0', '-translate-y-12', 'pointer-events-none'); t.classList.add('opacity-100', 'translate-y-0');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.add('opacity-0', '-translate-y-12', 'pointer-events-none'); t.classList.remove('opacity-100', 'translate-y-0'); }, 3800);
}

/* ---------- data ---------- */
async function q(table, build) {
  try { var qb = sb.from(table).select('*'); if (build) qb = build(qb); var r = await qb; if (r.error) { console.warn('[dash.' + table + ']', r.error.message); return []; } return r.data || []; }
  catch (e) { console.warn('[dash.' + table + ']', e.message); return []; }
}
var ST_MSG = {
  wa: { queued: 'Message queued — it goes out on WhatsApp shortly', outside_window: '24h reply window is closed — send the booking link template instead.', opted_out: 'This customer opted out of WhatsApp messages', test_mode: 'Test mode is ON — only test numbers get messages, so this was not sent', not_connected: 'WhatsApp API is not connected yet — message not sent', invalid: 'Message not sent — check the text (empty or too long)', not_found: 'Lead not found — refresh and try again' },
  alert: { resolved: 'Alert resolved', already_resolved: 'This alert was already resolved', not_found: 'Alert not found — it may have been removed' },
  rem: { requeued: 'Reminder re-queued — it will send in a moment', too_late: 'Too late to resend — the meeting time has passed', too_early: 'Too early — it will send at its scheduled time', meeting_cancelled: 'Meeting was cancelled, so the reminder was not resent', meeting_moved: 'Meeting was moved — new reminders follow the new time', already_queued: 'Already queued — nothing to do', already_sent: 'Already sent — not sending twice', outcome_unknown: 'Delivery status unknown — check WhatsApp before resending', step_disabled: 'This reminder step is turned off in Settings', opted_out: 'Customer opted out of WhatsApp messages', test_mode: 'Test mode is ON — only test numbers get reminders', not_retryable: 'This reminder cannot be retried', not_found: 'Reminder not found — refresh and try again' },
  set: { updated: 'Setting saved', no_change: 'Already set — no change', owner_only: 'Only the owner or an admin can change test mode', calls_locked: 'Outbound calls are switched off for this system', read_only: 'Your login can view settings but not change them', invalid: 'That setting could not be changed' }
};
var ST_OK = ['ok', 'queued', 'resolved', 'already_resolved', 'requeued', 'already_queued', 'already_sent', 'updated', 'no_change'];
function stMsg(kind, r) { r = r || {}; var s = r.status || (r.ok === false ? 'error' : 'ok'); var m = (ST_MSG[kind] || {})[s]; if (kind === 'wa' && s === 'queued' && r.duplicate) m = 'Already queued — not sent twice'; return { s: s, ok: ST_OK.indexOf(s) >= 0, msg: m || r.message || cap(s) || 'Done' }; }
async function rpc(fn, args) { var r = await sb.rpc(fn, args || {}); if (r.error) throw r.error; return r.data; }
async function kpis(from, to) { try { return (await rpc('kpis', { p_from: from, p_to: to, p_include_test: !!(S.settings && S.settings.test_mode) })) || {}; } catch (e) { console.warn('kpis', e.message); return {}; } }
var ODOO_DEFAULT = 'https://fefco-electro-mechanical-services-llc.odoo.com';
async function loadSettings() {
  var res = await Promise.all([q('app_settings'), q('settings_public', function (b) { return b.limit(1); })]);
  var s = res[0][0] || { test_mode: true, team: [], templates: {}, vapi: {} }, p = res[1][0] || null;
  if (p) {
    s.pub = p; if (p.test_mode != null) s.test_mode = p.test_mode; if (p.booking_url) s.booking_url = p.booking_url;
    if (p.whatsapp_api_connected != null) s.whatsapp_api_connected = p.whatsapp_api_connected;
    var o = p.odoo || {}; if (o.base_url || o.url) s.odoo_base_url = o.base_url || o.url; s.odoo = o;
    if (p.message_templates) { s.templates = {}; Object.keys(p.message_templates).forEach(function (k) { s.templates[k] = p.message_templates[k] && p.message_templates[k].approved; }); }
    if (p.quiet_hours) { s.calling_from = num(p.quiet_hours.wake_from) || s.calling_from; s.calling_until = num(p.quiet_hours.wake_until) || s.calling_until; }
  }
  S.settings = s;
}
async function loadGlobals() {
  try { var r = await sb.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'open'); S.openAlerts = r.count || 0; } catch (e) {}
}
async function odooFor(leads) {
  if (!leads.length) return leads;
  if (leads[0].hasOwnProperty('odoo_synced_at') || leads[0].hasOwnProperty('odoo_lead_id')) return leads;
  var ids = leads.map(function (l) { return l.id; });
  var rows = await q('app_lead_odoo', function (b) { return ids.length < 150 ? b.in('id', ids) : b; });
  var m = {}; rows.forEach(function (r) { m[r.id] = r; });
  leads.forEach(function (l) { var o = m[l.id]; if (o) { l.odoo_lead_id = o.odoo_lead_id; l.odoo_synced_at = o.odoo_synced_at; l.odoo_sync_error = o.odoo_sync_error; } });
  return leads;
}
function odooUrl(l) { if (l && l.odoo_url) return l.odoo_url; var b = (S.settings && S.settings.odoo_base_url) || ODOO_DEFAULT; return String(b).replace(/\/+$/, '') + '/odoo/crm'; }
function odooState(l) { var s = String((l && l.odoo_sync_state) || '').toLowerCase(); if (!s) s = l && l.odoo_sync_error ? 'error' : l && l.odoo_synced_at ? 'synced' : 'not-synced'; return s; }
function isIn(m) { return m && (m.direction === 'in' || m.direction === 'inbound'); }

/* ---------- chips & mappings ---------- */
var STATUS = {
  new: ['New', 'bg-surface-container-highest text-on-surface-variant font-bold', 'bg-surface-container-high text-on-surface-variant'],
  contacted: ['Contacted', 'bg-secondary-fixed text-on-secondary-fixed-variant', 'bg-secondary-fixed text-on-secondary-fixed'],
  qualified: ['Contacted', 'bg-secondary-fixed text-on-secondary-fixed-variant', 'bg-secondary-fixed text-on-secondary-fixed'],
  booked: ['Booked', 'bg-primary-fixed text-on-primary-fixed-variant', 'bg-primary-fixed text-on-primary-fixed-variant'],
  upcoming: ['Booked', 'bg-primary-fixed text-on-primary-fixed-variant', 'bg-primary-fixed text-on-primary-fixed-variant'],
  attended: ['Attended', 'bg-tertiary-fixed text-on-tertiary-fixed-variant', 'bg-tertiary-fixed text-on-tertiary-fixed-variant'],
  missed: ['Missed', 'bg-error-container text-on-error-container', 'bg-error-container text-on-error-container'],
  rescheduled: ['Rescheduled', 'bg-surface-container-high text-on-surface-variant', 'bg-surface-variant text-on-surface'],
  won: ['Won', 'bg-tertiary-fixed text-on-tertiary-fixed-variant font-bold', 'bg-tertiary-fixed text-on-tertiary-fixed-variant'],
  lost: ['Lost', 'bg-surface-container text-on-surface-variant', 'bg-surface-container text-on-surface-variant'],
  cancelled: ['Cancelled', 'bg-surface-container text-on-surface-variant', 'bg-surface-container text-on-surface-variant']
};
var AVATAR = { booked: 'bg-primary-fixed text-on-primary-fixed-variant', attended: 'bg-tertiary-fixed text-on-tertiary-fixed-variant', contacted: 'bg-surface-container-high text-on-surface-variant', new: 'bg-secondary-fixed text-on-secondary-fixed', missed: 'bg-error-container text-on-error-container' };
var AI_LABEL = { booked: 'text-on-primary-fixed-variant', attended: 'text-tertiary', contacted: 'text-secondary', new: 'text-primary-container', missed: 'text-error' };
function st(s) { var k = String(s || 'new').toLowerCase(); return STATUS[k] || [cap(k), 'bg-surface-container text-on-surface-variant', 'bg-surface-container text-on-surface-variant']; }
function statusChip(s) { var x = st(s); return '<span class="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full font-label-sm text-label-sm ' + x[1] + '">' + esc(x[0]) + '</span>'; }
function srcInfo(src) {
  var s = String(src || '').toLowerCase();
  if (/web(site)?|site-form|wordpress/.test(s)) return { key: 'website', label: 'Website', icon: 'language', cls: 'bg-secondary-fixed text-on-secondary-fixed' };
  if (/book/.test(s)) return { key: 'booking', label: 'Booking page', icon: 'event_available', cls: 'bg-primary-fixed/50 text-primary' };
  if (/whatsapp|ctwa|^wa$|^wa[-_]/.test(s)) return { key: 'whatsapp', label: 'WhatsApp ad · 786', icon: 'forum', cls: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' };
  if (/insta|facebook|social|tiktok|^fb|^ig/.test(s)) return { key: 'social', label: /insta|^ig/.test(s) ? 'Instagram' : 'Social DM', icon: 'share', cls: 'bg-surface-container-high text-on-surface-variant' };
  if (/form|instant|leadgen|lead-ad/.test(s)) return { key: 'form', label: 'Instant Form', icon: 'assignment', cls: 'bg-[#2D9CDB]/15 text-[#1B7DB5]' };
  if (/call|inbound|phone|vapi|2521/.test(s)) return { key: 'call', label: 'Call ad · 2521', icon: 'call', cls: 'bg-primary-fixed text-on-primary-fixed-variant' };
  if (/team|manual|staff|admin|app/.test(s)) return { key: 'team', label: 'Team-added', icon: 'person_add', cls: 'bg-surface-container text-on-surface-variant' };
  if (/test/.test(s)) return { key: 'test', label: 'Test', icon: 'science', cls: 'bg-secondary-fixed/50 text-on-secondary-fixed-variant' };
  return { key: 'other', label: cap(src || 'Unknown'), icon: 'label', cls: 'bg-surface-container text-on-surface-variant' };
}
function sourceChip(src) { var x = srcInfo(src); return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-label-sm text-label-sm shrink-0 ' + x.cls + '">' + icon(x.icon, 'text-[13px]') + esc(x.label) + '</span>'; }
function typeChip(t) { return isSite(t) ? '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm bg-primary-fixed/60 text-on-primary-fixed-variant">' + icon('location_on', 'text-[13px]') + 'Site visit</span>' : '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm bg-surface-container text-on-surface-variant">' + icon('call', 'text-[13px]') + 'Phone consult</span>'; }
function serviceIcon(s) { s = String(s || '').toLowerCase(); return /heater/.test(s) ? 'water_heater' : /plumb|tank/.test(s) ? 'plumbing' : /amc|contract/.test(s) ? 'description' : 'solar_power'; }
var AGENTS = [
  { key: 'inbound', name: 'Sara', role: 'Inbound receptionist · answers missed calls on 2521', purposes: ['inbound'], bar: 'bg-primary-container', box: 'bg-primary-fixed/30 text-primary-container', av: 'bg-primary-fixed text-on-primary-fixed', ic: 'support_agent' },
  { key: 'callback', name: 'Lead callback', role: 'Calls back WhatsApp & form leads', purposes: ['lead-callback', 'callback'], bar: 'bg-[#2D9CDB]', box: 'bg-[#2D9CDB]/15 text-[#1B7DB5]', av: 'bg-surface-container-highest text-on-surface', ic: 'phone_callback' },
  { key: 'reminder', name: 'Reminder caller', role: '1-hour reminder calls', purposes: ['reminder', 'reminder-call'], bar: 'bg-[#22B573]', box: 'bg-[#22B573]/15 text-[#1A8F5B]', av: 'bg-tertiary-fixed text-on-tertiary-fixed', ic: 'notifications_active' },
  { key: 'rebook', name: 'Rebook caller', role: 'Rebooks missed visits', purposes: ['rebook', 'rebook-call'], bar: 'bg-[#8E7CF0]', box: 'bg-[#8E7CF0]/15 text-[#6B5BD0]', av: 'bg-surface-variant text-on-surface', ic: 'event_repeat' },
  { key: 'team', name: 'Team caller', role: 'Calls the team on urgent bookings', purposes: ['team', 'team-call'], bar: 'bg-secondary-container', box: 'bg-secondary-fixed/60 text-secondary', av: 'bg-secondary-fixed text-on-secondary-fixed', ic: 'groups' }
];
function agentOf(purpose) { var p = String(purpose || '').toLowerCase(); for (var i = 0; i < AGENTS.length; i++) if (AGENTS[i].purposes.indexOf(p) >= 0) return AGENTS[i]; if (/inbound/.test(p)) return AGENTS[0]; if (/rebook/.test(p)) return AGENTS[3]; if (/remind/.test(p)) return AGENTS[2]; if (/team/.test(p)) return AGENTS[4]; return AGENTS[1]; }
function callOutcome(c) {
  var er = String(c.ended_reason || '').toLowerCase(), stt = String(c.status || '').toLowerCase();
  if (/queued|ringing|in-progress|scheduled/.test(stt) && !c.ended_at) return ['In progress', 'bg-secondary-fixed text-on-secondary-fixed'];
  if (c.meeting_id && /inbound|callback|lead/.test(c.purpose || '')) return ['Booked', 'bg-tertiary-fixed text-on-tertiary-container'];
  if (c.reached === false || /no-answer|busy|voicemail|failed|did-not-answer/.test(er)) return ['No answer', 'bg-surface-container-high text-on-surface-variant'];
  if (/forward|transfer/.test(er)) return ['Handed off', 'bg-primary-fixed text-on-primary-fixed-variant'];
  return ['Info saved', 'bg-[#2D9CDB]/15 text-[#1B7DB5]'];
}
var STEP = { 'confirmation': 'Booking confirmation', 'day-before': '24h before', 'short-reminder': '3h before', 'reminder-call': '1h reminder call', 'rebook-call': 'Missed-visit rebook call', 'missed-sorry': 'Missed-visit message', 'booking-link': 'Booking link', 'follow-up': 'Follow-up', 'cancel-ack': 'Cancellation note', 'reschedule-confirmation': 'Reschedule confirmation', 'meeting-start-site-visit': 'Visit starting', 'meeting-start-online': 'Consult starting' };
function stepLabel(s) { s = String(s || ''); if (STEP[s]) return STEP[s]; if (/^team-/.test(s)) return 'Team alert · ' + cap(s.replace(/^team-/, '')); return cap(s || 'Message'); }
var REM = {
  scheduled: ['Scheduled', 'bg-surface-container-low text-primary', 'schedule'], pending: ['Scheduled', 'bg-surface-container-low text-primary', 'schedule'], queued: ['Scheduled', 'bg-surface-container-low text-primary', 'schedule'], retry: ['Retrying', 'bg-secondary-fixed text-on-secondary-fixed', 'replay'], sending: ['Sending', 'bg-surface-container-low text-primary', 'send'],
  sent: ['Sent', 'bg-tertiary-fixed text-on-tertiary-fixed-variant', 'check_circle'], delivered: ['Delivered', 'bg-tertiary-fixed text-on-tertiary-fixed-variant', 'done_all'], read: ['Read', 'bg-tertiary-fixed text-on-tertiary-fixed-variant', 'done_all'],
  skipped: ['Skipped', 'bg-surface-container-high text-on-surface-variant', 'block'], failed: ['Failed', 'bg-error-container text-error font-bold', 'warning'], cancelled: ['Cancelled', 'bg-surface-container-high text-on-surface-variant', 'block']
};
function remChip(s) { var x = REM[String(s || '').toLowerCase()] || [cap(s), 'bg-surface-container-high text-on-surface-variant', 'info']; return '<span class="px-2.5 py-1 rounded-full font-label-sm text-[11px] ' + x[1] + ' flex items-center gap-1 shrink-0">' + icon(x[2], 'text-[13px]') + esc(x[0]) + '</span>'; }
function remGroup(s) { s = String(s || '').toLowerCase(); if (/sent|delivered|read/.test(s)) return 'sent'; if (/skip|cancel/.test(s)) return 'skipped'; if (/fail/.test(s)) return 'failed'; return 'queue'; }
function aiSummary(l) {
  var qd = l.qualification;
  if (qd && typeof qd === 'object') {
    if (qd.summary) return String(qd.summary);
    var parts = []; Object.keys(qd).slice(0, 4).forEach(function (k) { var v = qd[k]; if (v != null && v !== '' && typeof v !== 'object') parts.push(cap(k) + ': ' + v); });
    if (parts.length) return parts.join(' · ');
  }
  return l.last_activity_summary || '';
}
function emptyCard(ic, title, sub) { return '<div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-surface-container-low text-primary-container flex items-center justify-center shrink-0">' + icon(ic, 'text-[20px]') + '</div><div class="min-w-0"><p class="font-label-md text-on-surface">' + esc(title) + '</p><p class="font-body-sm text-on-surface-variant">' + esc(sub || '') + '</p></div></div>'; }
function loadingCard() { return '<div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-2 animate-pulse"><div class="h-4 w-1/2 rounded bg-surface-container"></div><div class="h-3 w-3/4 rounded bg-surface-container-low"></div></div>'; }
function audioRow(url, sec) { return '<div class="flex items-center gap-2 bg-surface-container-low rounded-xl px-2 py-1.5 flex-1 min-w-0"><button type="button" class="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0 active:scale-95" data-audio="' + esc(url) + '">' + icon('play_arrow', 'text-[20px]', true) + '</button><div class="flex-1 h-1.5 rounded-full bg-surface-container-high overflow-hidden"><div class="h-full bg-primary-container" style="width:0%" data-prog></div></div><span class="font-label-sm text-on-surface-variant shrink-0" data-time>' + dur(sec) + '</span></div>'; }

/* ---------- audio player (one at a time) ---------- */
var player = { a: null, btn: null };
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-audio]'); if (!b) return;
  e.stopPropagation(); e.preventDefault();
  if (player.btn === b && player.a) { if (player.a.paused) { player.a.play(); setIc(b, 'pause'); } else { player.a.pause(); setIc(b, 'play_arrow'); } return; }
  if (player.a) { player.a.pause(); if (player.btn) setIc(player.btn, 'play_arrow'); }
  var a = new Audio(b.getAttribute('data-audio')); player = { a: a, btn: b }; setIc(b, 'pause');
  var row = b.parentElement, prog = $(row, '[data-prog]'), tm = $(row, '[data-time]');
  a.addEventListener('timeupdate', function () { if (a.duration) { prog.style.width = (100 * a.currentTime / a.duration) + '%'; tm.textContent = dur(a.currentTime) + ' / ' + dur(a.duration); } });
  a.addEventListener('ended', function () { setIc(b, 'play_arrow'); });
  a.play().catch(function () { toast('Recording could not be played', 'error'); setIc(b, 'play_arrow'); });
}, true);
function setIc(b, n) { var s = $(b, '.material-symbols-outlined'); if (s) s.textContent = n; }

/* ---------- screen loading ---------- */
async function screenFrag(name) {
  if (!S.cache[name]) {
    var r = await fetch(FILE('screen-' + name + '.html'), { cache: 'no-cache' });
    if (!r.ok) throw new Error('Screen ' + name + ' not found');
    S.cache[name] = await r.text();
  }
  var t = document.createElement('template'); t.innerHTML = S.cache[name];
  $$(t.content, 'script').forEach(function (s) { s.remove(); });
  $$(t.content, '*').forEach(function (el) {
    Array.prototype.slice.call(el.attributes).forEach(function (a) { if (/^on/i.test(a.name)) el.removeAttribute(a.name); });
    if (el.tagName === 'A' && el.getAttribute('href') === '#') { el.removeAttribute('href'); el.style.cursor = 'pointer'; }
  });
  return t.content;
}

function wireFrame(root, title) {
  var header = $(root, 'header');
  if (header) {
    if (title) { var h1 = $(header, 'h1'); if (h1) h1.textContent = title; }
    $$(header, 'span').forEach(function (s) {
      var x = txt(s);
      if (x === 'TEST' || x === 'TEST MODE') s.classList.toggle('hidden', !(S.settings && S.settings.test_mode));
      if (/^Dubai \d/.test(x)) s.textContent = 'Dubai ' + fmtTime(new Date());
    });
    var bell = $(header, 'button[aria-label="Notifications"]');
    if (bell) { bell.addEventListener('click', function () { go('#/reminders/alerts'); }); var c = $(bell, 'span.absolute'); if (c) { c.textContent = S.openAlerts > 99 ? '99+' : String(S.openAlerts); c.classList.toggle('hidden', !S.openAlerts); } }
    var av = $(header, 'div.w-8.h-8.rounded-full'); if (av) { av.style.cursor = 'pointer'; av.addEventListener('click', function () { go('#/more'); }); }
    var back = $(header, 'button[aria-label="Go Back"]'); if (back) back.addEventListener('click', function () { if (history.length > 1) history.back(); else go('#/home'); });
  }
  var MAP = { Home: '#/home', Leads: '#/leads', Inbox: '#/calls', Bookings: '#/bookings', More: '#/more' };
  $$(root, 'nav a').forEach(function (a) {
    var lab = txt($(a, 'span.font-label-sm')) || txt(a);
    Object.keys(MAP).forEach(function (k) { if (lab.indexOf(k) >= 0) { a.setAttribute('href', MAP[k]); a.style.cursor = 'pointer'; } });
    if (lab.indexOf('Inbox') >= 0) { var dot = $(a, 'span.absolute'); if (dot) dot.classList.toggle('hidden', !S.needsReply); }
  });
}

async function mount(def, arg) {
  var rid = ++S.rid;
  var frag = await screenFrag(def.file);
  if (rid !== S.rid) return;
  closeOverlays();
  var app = $(document, '#app'); app.replaceChildren(frag);
  document.body.classList.toggle('pt-safe', def.file === 'login'); document.body.classList.toggle('pb-safe', def.file === 'login');
  window.scrollTo(0, 0);
  S.ctl = def; S.arg = arg || '';
  wireFrame(app, def.title);
  try { if (def.setup) def.setup(app, arg || ''); } catch (e) { console.error(e); }
  await refresh(rid);
}
async function refresh(rid) {
  rid = rid || S.rid; var def = S.ctl; if (!def || !def.refresh) return;
  try { await def.refresh($(document, '#app'), S.arg, rid); } catch (e) { console.error(e); toast('Could not load data: ' + (e.message || e), 'error'); }
}
function stale(rid) { return rid !== S.rid; }
function closeOverlays() { $$(document, '[data-overlay]').forEach(function (o) { o.remove(); }); }

/* =====================================================================
   LOGIN
   ===================================================================== */
var Login = { file: 'login', setup: function (root, arg) {
  var form = $(root, '#fefco-login-form'), email = $(root, '#email-input'), pw = $(root, '#password-input'), btn = $(root, '#signin-btn');
  var msg = document.createElement('p'); msg.className = 'hidden font-body-sm text-body-sm text-error text-center'; msg.id = 'login-msg'; btn.parentNode.insertBefore(msg, btn);
  function say(t, ok) { msg.textContent = t; msg.classList.remove('hidden'); msg.classList.toggle('text-error', !ok); msg.classList.toggle('text-tertiary', !!ok); }
  var eye = $(root, '#toggle-password-btn'); if (eye) eye.addEventListener('click', function () { var isPw = pw.type === 'password'; pw.type = isPw ? 'text' : 'password'; $(root, '#eye-icon').textContent = isPw ? 'visibility_off' : 'visibility'; });
  var rem = $(root, '#remember-me-toggle'); if (rem) { rem.checked = remember(); rem.addEventListener('change', function () { sset('fefco_remember', rem.checked ? '1' : '0'); }); }
  var pill = byText(root, 'span', 'v2.4.0 (PWA) · GST Synced'); if (pill) pill.textContent = VERSION + ' (PWA) · Dubai time';
  var forgot = byText(root, 'button', 'Forgot password?');
  if (S.me && S.me.is_team === false && S.session) say('This login is not on the FEFCO team list. Ask the admin to add your email.');
  if (S.recovery) {
    email.closest('.flex.flex-col').classList.add('hidden'); email.required = false;
    if (forgot) forgot.parentElement.classList.add('hidden');
    var lab = $(root, 'label[for="password-input"]'); if (lab) lab.textContent = 'New password';
    $(btn, 'span').textContent = 'Set new password'; pw.autocomplete = 'new-password';
  }
  if (forgot) forgot.addEventListener('click', async function () {
    var e = (email.value || '').trim(); if (!e) { say('Type your work email first, then tap "Forgot password?"'); email.focus(); return; }
    try { var r = await sb.auth.resetPasswordForEmail(e, { redirectTo: location.origin + location.pathname }); if (r.error) throw r.error; say('Password reset email sent to ' + e + '. Open the link on this phone.', true); }
    catch (er) { say(er.message || 'Could not send reset email'); }
  });
  form.addEventListener('submit', async function (ev) {
    ev.preventDefault(); var orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = icon('progress_activity', 'animate-spin text-lg') + '<span>Signing in…</span>'; msg.classList.add('hidden');
    try {
      if (S.recovery) { var u = await sb.auth.updateUser({ password: pw.value }); if (u.error) throw u.error; S.recovery = false; toast('Password updated'); S.me = null; go('#/home'); return; }
      sset('fefco_remember', rem && !rem.checked ? '0' : '1');
      var r = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pw.value });
      if (r.error) throw r.error;
      S.session = r.data.session; S.me = null; pw.value = '';
      go('#/home');
    } catch (er) { say(er.message === 'Invalid login credentials' ? 'Wrong email or password.' : (er.message || 'Sign in failed')); }
    finally { btn.disabled = false; btn.innerHTML = orig; }
  });
} };

/* =====================================================================
   HOME
   ===================================================================== */
function kpiCard(root, label) { var p = byText(root, 'p', label); return p ? p.closest('.rounded-2xl') : null; }
function trend(el, d) { if (!el) return; el.innerHTML = icon(d < 0 ? 'trending_down' : 'trending_up', 'text-[13px]') + (d > 0 ? '+' : '') + d; el.classList.toggle('text-error', d < 0); el.classList.toggle('text-tertiary', d >= 0); }
function visitRow(m) {
  var host = m.host_name || 'Unassigned';
  return '<div class="bg-surface-container-lowest rounded-2xl p-3.5 shadow-sm flex flex-col gap-2.5 cursor-pointer" data-lead="' + esc(m.lead_id) + '">' +
    '<div class="flex items-center justify-between"><div class="flex items-center gap-2"><span class="font-label-currency px-2 py-0.5 rounded-lg bg-surface-container text-on-surface flex items-center gap-1">' + icon('schedule', 'text-[14px] text-primary-container') + esc(fmtTime(m.start_at)) + '</span>' +
    (isSite(m.meeting_type) ? '<span class="font-label-sm px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary font-bold">Site visit</span>' : '<span class="font-label-sm px-2.5 py-0.5 rounded-full bg-surface-variant text-on-surface font-bold">Phone consult</span>') + '</div>' + statusChip(m.status) + '</div>' +
    '<div class="flex items-start justify-between"><div><h4 class="font-headline-sm text-on-surface text-[15px]">' + esc(m.lead_name || m.lead_phone || 'Customer') + '</h4><p class="font-body-sm text-on-surface-variant flex items-center gap-1 mt-0.5">' + icon('location_on', 'text-[14px] text-outline') + esc(m.area || m.location || 'Area not set') + '</p></div>' +
    '<div class="w-8 h-8 rounded-full bg-surface-container text-primary-container flex items-center justify-center">' + icon(serviceIcon(m.service), 'text-[18px]') + '</div></div>' +
    '<div class="pt-1.5 flex items-center justify-between text-on-surface-variant font-label-sm bg-surface-container-low/60 rounded-xl px-2.5 py-1.5"><span class="truncate">' + esc(m.service || 'Service not set') + '</span><div class="flex items-center gap-1 shrink-0 ml-2"><span class="w-6 h-6 rounded-full bg-primary-container/20 text-primary-container flex items-center justify-center font-bold text-[10px]">' + esc(initials(host)) + '</span><span class="text-on-surface text-[11px] font-semibold">' + esc(host) + '</span></div></div></div>';
}
function actItem(ic, box, html, sub, right) { return '<div class="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container-low transition-colors"><div class="w-9 h-9 rounded-xl ' + box + ' flex items-center justify-center shrink-0">' + icon(ic, 'text-[18px]') + '</div><div class="flex-1 min-w-0"><p class="font-label-sm text-on-surface truncate">' + html + '</p><span class="font-body-sm text-on-surface-variant text-[11px]">' + esc(sub) + '</span></div>' + (right || '') + '</div>'; }
var DONUT = ['#ff8a00', '#32bf7c', '#006d41', '#fec73c', '#2D9CDB', '#8E7CF0', '#8a7362', '#F2545B'];
var Home = { file: 'home', title: 'Dashboard', setup: function (root) {
  var banner = $(root, '#pwa-install-banner');
  if (banner) {
    var bs = $$(banner, 'button'); var dis = Number(sget('fefco_install_dismissed') || 0);
    if (isStandalone() || Date.now() - dis < 14 * 864e5) banner.classList.add('hidden');
    if (bs[0]) bs[0].addEventListener('click', openInstall);
    if (bs[1]) bs[1].addEventListener('click', function () { sset('fefco_install_dismissed', String(Date.now())); banner.classList.add('hidden'); });
  }
  var h3 = byText(root, 'h3', 'Leads by source');
  if (h3) { $$(h3.parentElement, 'button').forEach(function (b) { b.addEventListener('click', function () { S.homeRange = txt(b) === '7d' ? '7d' : txt(b) === '30d' ? '30d' : 'today'; refresh(); }); }); }
  var miss = kpiCard(root, 'Missed'); if (miss) { miss.style.cursor = 'pointer'; miss.addEventListener('click', function () { go('#/bookings'); }); }
  var fleet = byText(root, 'span', 'Dubai Fleet Coverage'); if (fleet) { var card = fleet.closest('.rounded-2xl'); card.style.cursor = 'pointer'; card.addEventListener('click', function () { go('#/leads'); }); }
  root.addEventListener('click', function (e) { var c = e.target.closest('[data-lead]'); if (c && c.getAttribute('data-lead')) go('#/lead/' + c.getAttribute('data-lead')); });
  var vh = byText(root, 'h3', "Today's visits"); if (vh) { var list = vh.closest('.flex.items-center.justify-between').nextElementSibling; list.innerHTML = loadingCard(); }
  var lh = byText(root, 'h3', 'Live activity'); if (lh) lh.parentElement.nextElementSibling.innerHTML = loadingCard();
  $$(root, '.font-kpi-metric').forEach(function (k) { k.textContent = '–'; });
}, refresh: async function (root, arg, rid) {
  var t = today(), y = addDays(t, -1), w = addDays(t, -6), rf = S.homeRange === '30d' ? addDays(t, -29) : S.homeRange === '7d' ? w : t;
  var res = await Promise.all([kpis(t, t), kpis(y, y), kpis(w, t), kpis(rf, t),
    q('meetings', function (b) { return b.eq('date_dubai', t).neq('status', 'cancelled').order('start_at'); }),
    q('meetings', function (b) { return b.eq('status', 'upcoming').gte('start_at', new Date().toISOString()).order('start_at').limit(1); }),
    q('calls', function (b) { return b.order('occurred_at', { ascending: false }).limit(6); }),
    q('whatsapp_messages', function (b) { return b.order('occurred_at', { ascending: false }).limit(6); }),
    q('alerts', function (b) { return b.order('created_at', { ascending: false }).limit(4); }),
    q('leads', function (b) { return b.order('created_at', { ascending: false }).limit(200); })]);
  if (stale(rid)) return;
  var kT = res[0], kY = res[1], kW = res[2], kR = res[3], meets = res[4], next = res[5][0], calls = res[6], msgs = res[7], alerts = res[8], leads = res[9];
  var me = S.me || {};
  var h2 = $(root, 'main h2'); if (h2) h2.textContent = greet() + ', ' + String(me.name || 'team').split(' ')[0];
  var dp = byText(root, 'main p', 'Tue, 10 Nov 2026 · Dubai (GST)') || (h2 && h2.closest('div').parentElement.querySelector('p'));
  if (dp) dp.innerHTML = icon('calendar_today', 'text-[15px] text-primary-container') + ' ' + esc(fmt(new Date(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(',', '')) + ' · Dubai (GST)';
  var ops = byText(root, 'span', 'Villa Ops Active') || byText(root, 'span', 'Next visit');
  if (ops) { ops.textContent = 'Next visit'; var op = ops.nextElementSibling; if (op) op.textContent = next ? (next.lead_name || 'Customer') + ' · ' + fmtDay(next.start_at) + ', ' + fmtTime(next.start_at) + (next.area ? ' · ' + next.area : '') : 'No upcoming visits booked yet'; }
  function setK(label, v, color) { var c = kpiCard(root, label); if (!c) return null; var k = $(c, '.font-kpi-metric'); if (k) k.textContent = v; return c; }
  var c1 = setK('New leads today', num(kT.new_leads)); if (c1) trend($(c1, 'span.font-label-sm.text-tertiary, span.font-label-sm.text-error'), num(kT.new_leads) - num(kY.new_leads));
  var c2 = setK('Booked today', num(kT.booked)); if (c2) trend($(c2, 'span.font-label-sm.text-tertiary, span.font-label-sm.text-error'), num(kT.booked) - num(kY.booked));
  var c3 = setK('Attended visits', num(kT.attended)); if (c3) { var ch = $(c3, 'span.font-label-sm'); if (ch) ch.textContent = num(kT.meetings_in_period) + ' due today'; }
  setK('Missed', num(kT.missed));
  var pipe = kT.pipeline_by_status, nCont = pipe ? num(pipe.contacted) : leads.filter(function (l) { return String(l.status || '').toLowerCase() === 'contacted' && (!l.is_test || !!(S.settings && S.settings.test_mode)); }).length;
  if (c1) { var cx = $(c1, '[data-contacted]'); if (!cx) { var lp = byText(c1, 'p', 'New leads today'); if (lp) { cx = document.createElement('p'); cx.setAttribute('data-contacted', '1'); cx.className = 'font-label-sm text-secondary font-semibold cursor-pointer'; cx.addEventListener('click', function (ev) { ev.stopPropagation(); S.f.tab = 'contacted'; go('#/leads'); }); lp.after(cx); } } if (cx) { cx.textContent = nCont + ' contacted · not booked'; cx.classList.toggle('hidden', !nCont); } }
  var su = byText(root, 'span', 'Show-up rate'); if (su) { var card = su.closest('.rounded-2xl'); var pct = kW.show_up_pct == null ? null : Math.round(num(kW.show_up_pct)); var att = num(kW.attended), mis = num(kW.missed);
    $(card, '.font-kpi-metric').textContent = pct == null ? '–' : pct + '%';
    var tr = $(card, '.font-kpi-metric').nextElementSibling; if (tr) tr.classList.add('hidden');
    var sp = $(card, 'p.font-body-sm'); if (sp) sp.textContent = att + ' of ' + (att + mis) + ' visits kept · last 7 days';
    var ring = $(card, 'circle[stroke-dasharray]'); if (ring) ring.setAttribute('stroke-dashoffset', String((119.38 * (1 - (pct || 0) / 100)).toFixed(2)));
    var cen = $(card, 'span.absolute'); if (cen) cen.textContent = pct == null ? '–' : pct + '%'; }
  var c6 = setK('AI calls handled', num(kT.ai_calls)); if (c6) { var a6 = $(c6, 'span.font-label-sm'); var avg = num(kT.ai_calls) ? num(kT.ai_call_minutes) * 60 / num(kT.ai_calls) : 0; if (a6) a6.textContent = 'Avg ' + Math.floor(avg / 60) + 'm ' + Math.round(avg % 60) + 's'; }
  var c7 = setK('WhatsApp sent', num(kT.whatsapp_sent)); if (c7) { var a7 = $(c7, 'span.font-label-sm'); if (a7) a7.textContent = (num(kT.whatsapp_sent) ? Math.round(100 * num(kT.whatsapp_read) / num(kT.whatsapp_sent)) : 0) + '% read'; }
  // today's visits
  var vh = byText(root, 'h3', "Today's visits");
  if (vh) { var hd = vh.closest('.flex.items-center.justify-between'); var badge = $(hd, 'span.w-5'); if (badge) badge.textContent = meets.length; var sa = $(hd, 'a'); if (sa) { $(sa, 'span').textContent = 'See all (' + meets.length + ')'; sa.setAttribute('href', '#/bookings'); }
    hd.nextElementSibling.innerHTML = meets.length ? meets.slice(0, 5).map(visitRow).join('') : emptyCard('event_available', 'No visits today', 'New bookings appear here automatically'); }
  // live activity
  var ev = [];
  calls.forEach(function (c) { var o = callOutcome(c); ev.push({ t: c.occurred_at, h: actItem('smart_toy', 'bg-primary-fixed text-primary', esc(agentOf(c.purpose).name) + ' (AI) call — <span class="font-bold">' + esc(c.lead_name || c.lead_phone || 'caller') + '</span>', rel(c.occurred_at) + ' · ' + o[0], o[0] === 'Booked' ? icon('check_circle', 'text-[16px] text-tertiary shrink-0') : ''), lead: c.lead_id }); });
  msgs.forEach(function (m) { var inb = isIn(m); ev.push({ t: m.occurred_at, h: actItem(inb ? 'chat' : 'done_all', 'bg-tertiary-fixed/30 text-tertiary', (inb ? 'WhatsApp from ' : 'WhatsApp ' + esc(stepLabel(m.step)).toLowerCase() + ' ' + esc(m.status || '') + ' — ') + '<span class="font-bold">' + esc(m.lead_name || m.phone || '') + '</span>', rel(m.occurred_at) + (m.audience === 'team' ? ' · Team' : '')), lead: m.lead_id }); });
  leads.slice(0, 6).forEach(function (l) { ev.push({ t: l.created_at, h: actItem('assignment', 'bg-surface-container-high text-primary', 'New ' + esc(srcInfo(l.source).label) + ' lead — <span class="font-bold">' + esc(l.name || l.phone) + '</span>', rel(l.created_at) + (l.area ? ' · ' + l.area : ''), '<span class="w-2 h-2 rounded-full bg-primary-container shrink-0"></span>'), lead: l.id }); });
  alerts.forEach(function (a) { ev.push({ t: a.created_at, h: actItem(a.status === 'open' ? 'campaign' : 'task_alt', a.status === 'open' ? 'bg-secondary-fixed/40 text-secondary' : 'bg-tertiary-fixed/30 text-tertiary', esc(cap(a.kind)) + ' — ' + esc(String(a.detail || '').slice(0, 80)), rel(a.created_at) + ' · ' + cap(a.status)), lead: a.lead_id }); });
  ev.sort(function (a, b) { return new Date(b.t) - new Date(a.t); });
  var lh = byText(root, 'h3', 'Live activity');
  if (lh) lh.parentElement.nextElementSibling.innerHTML = ev.length ? ev.slice(0, 5).map(function (e) { return '<div data-lead="' + esc(e.lead || '') + '" class="' + (e.lead ? 'cursor-pointer' : '') + '">' + e.h + '</div>'; }).join('') : emptyCard('bolt', 'No activity yet', 'Calls, WhatsApp and new leads show up here live');
  // leads by source
  var h3 = byText(root, 'h3', 'Leads by source');
  if (h3) {
    $$(h3.parentElement, 'button').forEach(function (b) { var on = (txt(b) === 'Today' && S.homeRange === 'today') || (txt(b) === '7d' && S.homeRange === '7d') || (txt(b) === '30d' && S.homeRange === '30d'); b.className = on ? 'px-2.5 py-1 rounded-lg bg-primary-container text-on-primary font-bold shadow-xs' : 'px-2.5 py-1 rounded-lg text-on-surface-variant hover:text-on-surface'; });
    var by = {}; Object.keys(kR.leads_by_source || {}).forEach(function (s) { var lab = srcInfo(s).label; by[lab] = (by[lab] || 0) + num(kR.leads_by_source[s]); });
    var items = Object.keys(by).map(function (k) { return [k, by[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    var total = items.reduce(function (s, x) { return s + x[1]; }, 0);
    var card = h3.parentElement.nextElementSibling; var svg = $(card, 'svg');
    if (svg) { var circ = 238.8, off = 0, html = '<circle class="text-surface-container" cx="50" cy="50" fill="none" r="38" stroke="currentColor" stroke-width="12"></circle>';
      items.forEach(function (x, i) { var len = total ? circ * x[1] / total : 0; html += '<circle cx="50" cy="50" fill="none" r="38" stroke="' + DONUT[i % DONUT.length] + '" stroke-dasharray="' + len.toFixed(1) + ' ' + circ + '" stroke-dashoffset="' + (-off).toFixed(1) + '" stroke-width="12"></circle>'; off += len; });
      svg.innerHTML = html; }
    var tot = $(card, '.font-headline-lg'); if (tot) tot.textContent = total;
    var grid = $(card, '.grid.grid-cols-2');
    if (grid) grid.innerHTML = items.length ? items.map(function (x, i) { return '<div class="flex items-center gap-2 p-2 rounded-xl bg-surface-container-low/50"><div class="w-3 h-3 rounded-full shrink-0" style="background:' + DONUT[i % DONUT.length] + '"></div><div class="min-w-0"><p class="font-label-sm text-on-surface truncate">' + esc(x[0]) + '</p><p class="font-label-currency text-on-surface-variant text-[11px]">' + (total ? Math.round(100 * x[1] / total) : 0) + '% <span class="text-on-surface font-normal">(' + x[1] + ' lead' + (x[1] === 1 ? '' : 's') + ')</span></p></div></div>'; }).join('') : '<p class="col-span-2 text-center font-body-sm text-on-surface-variant py-2">No leads in this period yet</p>';
  }
  var fleet = byText(root, 'span', 'Dubai Fleet Coverage') || byText(root, 'span', 'Top areas');
  if (fleet) { fleet.textContent = 'Top areas'; var ac = {}; leads.forEach(function (l) { if (l.area) ac[l.area] = (ac[l.area] || 0) + 1; }); var top = Object.keys(ac).sort(function (a, b) { return ac[b] - ac[a]; }).slice(0, 3); var p = fleet.parentElement.querySelector('p'); if (p) p.textContent = top.length ? top.map(function (a) { return a + ' (' + ac[a] + ')'; }).join(' · ') : 'Areas appear as leads come in'; }
} };

/* =====================================================================
   LEADS LIST + FILTER SHEET
   ===================================================================== */
var SERVICE_RX = {
  'Solar PV system – new installation': /^(?!.*(heater|car ?park|carport|charger|charging|\bev\b)).*(\bpv\b|install)/i,
  'Solar panel cleaning': /clean/i,
  'Solar maintenance & repair': /^(?!.*(heater|plumb|tank|charger)).*(maint|repair|inverter)/i,
  'Solar water heater – new installation': /heater.*(new|install)|(new|install).*heater/i,
  'Solar water heater service & repair': /^(?!.*(new|install)).*heater/i,
  'Solar car park installation': /car ?park|carport/i,
  'EV charger installation': /\bev\b|charger|charging/i,
  'Water tank': /tank/i,
  'Plumbing': /plumb/i,
  'AMC contract': /amc|contract/i,
  'Other': /other/i
};
function svcNorm(v) { return String(v || '').toLowerCase().replace(/[\u2013\u2014-]/g, '-').replace(/\s+/g, ' ').trim(); }
function svcMatch(s, v) { var n = svcNorm(v); if (n && n === svcNorm(s)) return true; if (s === 'Other') return !n || SERVICE_RX.Other.test(n) || !Object.keys(SERVICE_RX).some(function (k) { return k !== 'Other' && (svcNorm(k) === n || SERVICE_RX[k].test(n)); }); return !!(SERVICE_RX[s] && SERVICE_RX[s].test(n)); }
var AREAS = ['Arabian Ranches', 'Jumeirah Islands', 'Emirates Hills', 'The Springs', 'The Meadows', 'Jumeirah Park'];
var SRC_FILTER = { 'Call ad · 2521': 'call', 'Instant Form': 'form', 'WhatsApp ad · 786': 'whatsapp', 'Website': 'website', 'Answered by Sara': 'sara', 'Booking page': 'booking', 'Instagram / social': 'social', 'Team-added': 'team' };
function dateRange(f) {
  var t = today();
  switch (f.date) { case 'today': return [t, t]; case 'yesterday': var y = addDays(t, -1); return [y, y]; case '7d': return [addDays(t, -6), t]; case '30d': return [addDays(t, -29), t]; case 'custom': return [f.from || '0000-01-01', f.to || '9999-12-31']; default: return null; }
}
function applyFilters(all, f, ignoreTab) {
  var qq = f.q.toLowerCase(), dr = dateRange(f);
  var out = all.filter(function (l) {
    if (qq && [l.name, l.phone, l.area, l.service, l.email].join(' ').toLowerCase().indexOf(qq) < 0) return false;
    if (f.sources.length) { var k = srcInfo(l.source).key; var ok = f.sources.indexOf(k) >= 0 || (f.sources.indexOf('sara') >= 0 && S.saraLeads && S.saraLeads[l.id]); if (!ok) return false; }
    if (f.services.length && !f.services.some(function (s) { return svcMatch(s, l.service); })) return false;
    if (f.areas.length && !f.areas.some(function (a) { return a === 'Other' ? !AREAS.some(function (x) { return String(l.area || '').toLowerCase().indexOf(x.toLowerCase()) >= 0; }) : String(l.area || '').toLowerCase().indexOf(a.toLowerCase()) >= 0; })) return false;
    if (f.statuses.length && f.statuses.indexOf(String(l.status || 'new').toLowerCase()) < 0) return false;
    if (dr) { var d = dDate(l.created_at); if (d < dr[0] || d > dr[1]) return false; }
    if (!ignoreTab && f.tab !== 'all' && String(l.status || 'new').toLowerCase() !== f.tab) return false;
    return true;
  });
  out.sort(function (a, b) { return (new Date(b.created_at) - new Date(a.created_at)) * (f.sort === 'asc' ? -1 : 1); });
  return out;
}
function leadCard(l) {
  var s = String(l.status || 'new').toLowerCase(), sum = aiSummary(l);
  var sub = l.next_meeting_at ? 'Next: ' + fmtDay(l.next_meeting_at) + ' ' + fmtTime(l.next_meeting_at) : (l.campaign_name || l.form_name || '');
  return '<div class="lead-card bg-surface-container-lowest rounded-xl p-space-md shadow-[0_4px_20px_-2px_rgba(255,138,0,0.06),0_2px_8px_rgba(31,41,55,0.04)] transition-all active:scale-[0.99] cursor-pointer" data-lead="' + esc(l.id) + '">' +
    '<div class="flex items-start justify-between gap-space-sm mb-space-xs"><div class="flex items-center gap-space-sm min-w-0"><div class="w-10 h-10 rounded-full ' + (AVATAR[s] || 'bg-surface-container text-on-surface-variant') + ' flex items-center justify-center font-headline-sm text-headline-sm shrink-0">' + esc(initials(l.name || l.phone)) + '</div><div class="min-w-0"><h3 class="font-headline-sm text-headline-sm text-on-surface truncate leading-tight">' + esc(l.name || phoneFmt(l.phone) || 'Unknown') + '</h3><p class="font-body-sm text-body-sm text-on-surface-variant truncate">' + esc([l.area || 'Area not set', l.service || 'Service not set'].join(' · ')) + '</p></div></div>' + statusChip(s) + '</div>' +
    '<div class="flex items-center justify-between text-on-surface-variant pt-space-xs pb-space-xs gap-2"><div class="flex items-center gap-space-xs min-w-0">' + sourceChip(l.source) + '<span class="font-label-sm text-label-sm text-on-surface-variant truncate">' + esc(sub) + '</span></div><span class="font-label-sm text-label-sm text-on-surface-variant font-semibold shrink-0">' + esc(dayLabel(l.created_at)) + '</span></div>' +
    (sum ? '<div class="bg-surface-container-low p-2.5 rounded-lg mt-space-xs flex items-start gap-space-xs"><span class="text-base leading-none shrink-0 mt-0.5">🤖</span><p class="font-body-sm text-body-sm text-on-surface line-clamp-2"><span class="font-label-md text-label-md ' + (AI_LABEL[s] || 'text-on-surface-variant') + '">AI:</span> ' + esc(sum) + '</p></div>' : '') +
    '<div class="flex items-center justify-end gap-space-xs mt-space-sm pt-space-xs">' + (l.phone ? '<a class="h-9 px-3 rounded-lg bg-surface-container text-on-surface-variant hover:bg-surface-container-high font-label-sm text-label-sm flex items-center gap-1 transition-colors" href="' + waLink(l.phone) + '" target="_blank" rel="noopener">' + icon('chat', 'text-[16px]') + 'WhatsApp</a><a class="h-9 px-3 rounded-lg bg-primary-container text-on-primary font-label-sm text-label-sm flex items-center gap-1 shadow-sm active:scale-95 transition-transform" href="' + telLink(l.phone) + '">' + icon('call', 'text-[16px]') + 'Call</a>' : '') + '</div></div>';
}
var TAB_DOT = { new: 'bg-surface-tint', contacted: 'bg-secondary', booked: 'bg-primary-container', attended: 'bg-tertiary', missed: 'bg-error' };
var Leads = { file: 'leads', title: 'Leads', setup: function (root) {
  var search = $(root, '#lead-search-input'); search.value = S.f.q; search.addEventListener('input', function () { S.f.q = search.value; Leads.render(root); });
  var sort = $(root, 'button[aria-label="Sort Leads"]'); if (sort) sort.addEventListener('click', function () { S.f.sort = S.f.sort === 'desc' ? 'asc' : 'desc'; toast(S.f.sort === 'desc' ? 'Newest first' : 'Oldest first', 'swap_vert'); Leads.render(root); });
  var exp = $(root, 'button[aria-label="Export Data"]'); if (exp) exp.addEventListener('click', function () { exportCsv(applyFilters(S.leadsAll || [], S.f)); });
  var tune = $(root, 'button[aria-label="Refine Filters"]'); if (tune) tune.addEventListener('click', openFilter);
  var chipRow = byText(root, 'button span', 'Source').closest('div');
  $$(chipRow, 'button').forEach(function (b) { b.addEventListener('click', function (e) { if (txt(b).indexOf('Date') === 0 && e.target.textContent === 'close') { S.f.date = 'all'; Leads.render(root); return; } openFilter(); }); });
  var tabsRow = byText(root, 'button span', 'All').closest('div');
  if (!byText(tabsRow, 'button span', 'Contacted')) { var nwb = byText(tabsRow, 'button span', 'New'); nwb = nwb && nwb.closest('button'); if (nwb) { var ctb = nwb.cloneNode(true); $$(ctb, 'span').forEach(function (s) { if (txt(s) === 'New') s.textContent = 'Contacted'; }); nwb.after(ctb); } }
  $$(tabsRow, 'button').forEach(function (b) { var k = txt($(b, 'span:not(.w-1\\.5)')).toLowerCase(); b.setAttribute('data-tab', k); b.addEventListener('click', function () { S.f.tab = k; Leads.render(root); }); });
  var fab = $(root, '#quick-add-lead-btn'); if (fab) fab.addEventListener('click', openAddLead);
  var kp = byText(root, 'span', 'Active Inbound Queue'); if (kp) kp.textContent = 'Live lead queue';
  var list = $(root, '.space-y-space-md.pb-24'); list.innerHTML = loadingCard();
  list.addEventListener('click', function (e) { if (e.target.closest('a')) return; var c = e.target.closest('[data-lead]'); if (c) go('#/lead/' + c.getAttribute('data-lead')); });
  var cnt = $(root, 'h2 + span'); if (cnt) cnt.textContent = '–';
}, refresh: async function (root, arg, rid) {
  var res = await Promise.all([q('leads', function (b) { return b.order('created_at', { ascending: false }).limit(1000); }), q('calls', function (b) { return b.eq('purpose', 'inbound').not('lead_id', 'is', null).limit(1000); })]);
  if (stale(rid)) return;
  S.leadsAll = await odooFor(res[0]); S.saraLeads = {}; res[1].forEach(function (c) { S.saraLeads[c.lead_id] = 1; });
  var upd = byText(root, 'span', 'Dubai GST • Auto-sync', true) || byText(root, 'span', 'Updated', true); if (upd) upd.textContent = 'Updated ' + fmtTime(new Date());
  Leads.render(root);
}, render: function (root) {
  if (!S.leadsAll) return;
  var all = S.leadsAll, base = applyFilters(all, S.f, true), shown = applyFilters(all, S.f);
  var cnt = $(root, 'h2 + span'); if (cnt) cnt.textContent = all.length;
  var chipRow = byText(root, 'button span', 'Source'); chipRow = chipRow && chipRow.closest('div');
  if (chipRow) { var dateBtn = $$(chipRow, 'button').filter(function (b) { return txt(b).indexOf('Date') === 0; })[0];
    if (dateBtn) { var lab = { all: 'All time', today: 'Today', yesterday: 'Yesterday', '7d': '7 days', '30d': '30 days', custom: 'Custom' }[S.f.date];
      var active = S.f.date !== 'all'; dateBtn.className = active ? 'shrink-0 font-label-md text-label-md px-space-md py-1.5 rounded-full flex items-center gap-1 bg-primary-fixed text-on-primary-fixed-variant shadow-sm font-bold' : 'shrink-0 font-label-md text-label-md px-space-md py-1.5 rounded-full flex items-center gap-1 bg-surface-container-lowest text-on-surface shadow-sm';
      dateBtn.innerHTML = '<span>Date: ' + lab + '</span>' + icon(active ? 'close' : 'expand_more', 'text-[16px] ' + (active ? 'text-on-primary-fixed-variant' : 'text-outline')); }
    $$(chipRow, 'button').forEach(function (b) { var t = txt($(b, 'span')); var n = { Source: S.f.sources.length, Service: S.f.services.length, Area: S.f.areas.length, Status: S.f.statuses.length }[t]; if (n == null) return;
      b.className = n ? 'shrink-0 font-label-md text-label-md px-space-md py-1.5 rounded-full flex items-center gap-1 bg-primary-fixed text-on-primary-fixed-variant shadow-sm font-bold' : 'shrink-0 font-label-md text-label-md px-space-md py-1.5 rounded-full flex items-center gap-1 bg-surface-container-lowest text-on-surface shadow-sm'; });
  }
  $$(root, '[data-tab]').forEach(function (b) { var k = b.getAttribute('data-tab'); var n = k === 'all' ? base.length : base.filter(function (l) { return String(l.status || 'new').toLowerCase() === k; }).length; var on = S.f.tab === k; var nm = cap(k);
    b.className = on ? 'shrink-0 font-label-sm text-label-sm px-3.5 py-2 rounded-xl bg-primary-container text-on-primary font-bold shadow-[0_2px_8px_rgba(255,138,0,0.25)] flex items-center gap-1' : 'shrink-0 font-label-sm text-label-sm px-3 py-2 rounded-xl bg-surface-container-lowest text-on-surface shadow-sm flex items-center gap-1';
    b.innerHTML = (on || !TAB_DOT[k] ? '' : '<span class="w-1.5 h-1.5 rounded-full ' + TAB_DOT[k] + '"></span>') + '<span>' + nm + '</span><span class="' + (on ? 'opacity-90' : 'text-on-surface-variant font-bold') + '">(' + n + ')</span>'; });
  var list = $(root, '.space-y-space-md.pb-24');
  list.innerHTML = shown.length ? shown.slice(0, 300).map(leadCard).join('') : emptyCard('person_search', all.length ? 'No leads match these filters' : 'No leads yet', all.length ? 'Reset the filters to see all leads' : 'New leads from ads, WhatsApp, forms and the booking page show here');
} };
function exportCsv(rows) {
  var cols = ['created_at', 'name', 'phone', 'email', 'area', 'service', 'source', 'status', 'lead_score', 'next_meeting_dubai', 'odoo_lead_id'];
  var csv = cols.join(',') + '\n' + rows.map(function (r) { return cols.map(function (c) { return '"' + String(r[c] == null ? '' : r[c]).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
  try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'fefco-leads-' + today() + '.csv'; document.body.appendChild(a); a.click(); a.remove(); toast('Exported ' + rows.length + ' leads', 'ios_share'); } catch (e) { toast('Export not available here', 'error'); }
}
var CHIP_ON = 'filter-chip is-selected min-h-[44px] px-space-md py-space-xs rounded-full flex items-center gap-space-xs font-label-sm bg-primary-fixed/30 text-on-primary-container shadow-sm transition-all';
var CHIP_OFF = 'filter-chip min-h-[44px] px-space-md py-space-xs rounded-full flex items-center gap-space-xs font-label-sm bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-all';
function chipHtml(label, on) { return (on ? '<span class="material-symbols-outlined text-[16px] text-primary-container" style="font-variation-settings: \'FILL\' 1;">check</span>' : '<span class="material-symbols-outlined text-[16px] hidden">check</span>') + '<span>' + esc(label) + '</span>'; }
async function openFilter() {
  closeOverlays();
  var frag = await screenFrag('filter');
  var ov = $(frag, 'div.absolute.inset-0'); if (!ov) return;
  ov.classList.remove('absolute'); ov.classList.add('fixed', 'z-[60]'); ov.setAttribute('data-overlay', '1');
  document.body.appendChild(ov);
  var f = JSON.parse(JSON.stringify(S.f));
  // extra source chips for every lead source
  var srcWrap = $$(ov, '.filter-chip[data-category="source"]')[0].parentElement;
  ['Booking page', 'Instagram / social', 'Team-added'].forEach(function (l) { var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-category', 'source'); b.className = CHIP_OFF; b.innerHTML = chipHtml(l, false); srcWrap.appendChild(b); });
  var svcFirst = $$(ov, '.filter-chip[data-category="service"]')[0]; if (svcFirst) { var svcWrap = svcFirst.parentElement; svcWrap.innerHTML = Object.keys(SERVICE_RX).map(function (l) { return '<button type="button" data-category="service" class="' + CHIP_OFF + '">' + chipHtml(l, false) + '</button>'; }).join(''); }
  var areaOther = byText(ov, '.filter-chip span', 'Other Dubai Areas'); if (areaOther) areaOther.textContent = 'Other';
  function listFor(cat) { return cat === 'source' ? f.sources : cat === 'service' ? f.services : f.areas; }
  function valOf(b) { var l = txt($$(b, 'span').pop()); return b.getAttribute('data-category') === 'source' ? SRC_FILTER[l] : l; }
  $$(ov, '.filter-chip[data-category]').forEach(function (b) { b.addEventListener('click', function () { var arr = listFor(b.getAttribute('data-category')), v = valOf(b), i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); paint(); }); });
  var stBase = {}; $$(ov, '.status-chip').forEach(function (b) { stBase[b.getAttribute('data-status')] = b.className.replace(/\bis-selected\b/, '').replace(/\bshadow-sm\b/, ''); b.addEventListener('click', function () { var k = b.getAttribute('data-status'), i = f.statuses.indexOf(k); if (i >= 0) f.statuses.splice(i, 1); else f.statuses.push(k); paint(); }); });
  var DMAP = { 'Today': 'today', 'Yesterday': 'yesterday', '7 days': '7d', '30 days': '30d', 'Custom range': 'custom' };
  $$(ov, '.date-chip').forEach(function (b) { b.addEventListener('click', function () { var k = DMAP[txt($$(b, 'span').pop())]; f.date = f.date === k ? 'all' : k; paint(); }); });
  var boxes = $$(ov, '.grid.grid-cols-2.gap-space-sm > div');
  boxes.forEach(function (bx, i) { var sp = $(bx, 'span.font-label-md'); if (!sp) return; var inp = document.createElement('input'); inp.type = 'date'; inp.className = 'font-label-md text-on-surface bg-transparent outline-none w-full'; inp.value = i === 0 ? f.from : f.to; inp.addEventListener('change', function () { if (i === 0) f.from = inp.value; else f.to = inp.value; f.date = 'custom'; paint(); }); sp.replaceWith(inp); });
  $(ov, '#resetFiltersBtn').addEventListener('click', function () { f.sources = []; f.services = []; f.areas = []; f.statuses = []; f.date = 'all'; f.from = ''; f.to = ''; $$(ov, 'input[type=date]').forEach(function (i) { i.value = ''; }); paint(); });
  function close() { ov.remove(); }
  ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  var handle = $(ov, '.cursor-grab'); if (handle) handle.addEventListener('click', close);
  $(ov, '#applyFiltersBtn').addEventListener('click', function () { f.q = S.f.q; f.tab = S.f.tab; f.sort = S.f.sort; S.f = f; close(); if (S.ctl === Leads) Leads.render($(document, '#app')); else go('#/leads'); });
  function paint() {
    $$(ov, '.filter-chip[data-category]').forEach(function (b) { var on = listFor(b.getAttribute('data-category')).indexOf(valOf(b)) >= 0; var l = txt($$(b, 'span').pop()); b.className = on ? CHIP_ON : CHIP_OFF; b.innerHTML = chipHtml(l, on); });
    $$(ov, '.status-chip').forEach(function (b) { var on = f.statuses.indexOf(b.getAttribute('data-status')) >= 0; b.className = stBase[b.getAttribute('data-status')] + (on ? ' is-selected ring-2 ring-primary-container shadow-sm' : ''); var ck = $$(b, 'span.material-symbols-outlined').pop(); if (ck) { ck.classList.toggle('hidden', !on); ck.classList.toggle('text-primary-container', on); } });
    $$(ov, '.date-chip').forEach(function (b) { var l = txt($$(b, 'span').pop()); var on = DMAP[l] === f.date; b.className = 'date-chip ' + (on ? CHIP_ON : CHIP_OFF).replace('filter-chip ', ''); b.innerHTML = on ? chipHtml(l, true) : '<span>' + esc(l) + '</span>'; });
    var n = f.sources.length + f.services.length + f.areas.length + f.statuses.length + (f.date !== 'all' ? 1 : 0);
    var badge = $(ov, '#activeCountBadge'); if (badge) { badge.textContent = '(' + n + ' active)'; badge.classList.toggle('hidden', !n); }
    var cnt = applyFilters(S.leadsAll || [], Object.assign({}, f, { q: S.f.q }), true).length;
    $$($(ov, '#applyFiltersBtn'), 'span').pop().textContent = 'Show ' + cnt + ' lead' + (cnt === 1 ? '' : 's');
  }
  if (!S.leadsAll) { S.leadsAll = await odooFor(await q('leads', function (b) { return b.order('created_at', { ascending: false }).limit(1000); })); }
  paint();
}

/* =====================================================================
   LEAD DETAIL (built from Stitch components; Stitch export missing)
   ===================================================================== */
function tlItem(e, lead) {
  var d = e.detail || {}, dot = 'bg-primary-container', body = '', title = e.title || cap(e.kind), right = esc(fmtDay(e.occurred_at) + ' · ' + fmtTime(e.occurred_at));
  if (e.source === 'call') {
    var ag = agentOf(d.purpose); var o = callOutcome({ purpose: d.purpose, reached: d.reached, ended_reason: d.ended_reason, meeting_id: e.meeting_id, status: e.status, ended_at: d.ended_at });
    title = ag.name + ' (AI) · ' + (d.purpose === 'inbound' ? 'inbound call' : 'outbound call');
    var sec = d.started_at && d.ended_at ? (new Date(d.ended_at) - new Date(d.started_at)) / 1000 : 0;
    body = (d.summary ? '<p class="font-body-sm text-on-surface">' + esc(d.summary) + '</p>' : '<p class="font-body-sm text-on-surface-variant">No summary yet</p>') +
      '<div class="flex items-center gap-2 flex-wrap"><span class="px-2.5 py-0.5 rounded-full font-label-sm font-bold ' + o[1] + '">' + o[0] + '</span><span class="font-label-sm text-on-surface-variant">' + icon('timer', 'text-[13px] align-middle') + ' ' + dur(sec) + '</span></div>' +
      (d.recording_url ? '<div class="flex">' + audioRow(d.recording_url, sec) + '</div>' : '');
  } else if (e.source === 'message') {
    dot = e.status === 'failed' ? 'bg-error' : 'bg-tertiary'; var team = /^team/.test(d.step || '');
    title = (team ? 'Team alert' : 'WhatsApp') + ' · ' + stepLabel(d.step) + (d.template ? '' : '');
    var tick = e.status === 'read' || d.read_at ? icon('done_all', 'text-[15px] text-sky-500 font-bold') + ' Read' : e.status === 'delivered' || d.delivered_at ? icon('done_all', 'text-[15px] text-outline') + ' Delivered' : e.status === 'failed' ? icon('error', 'text-[15px] text-error') + ' Failed' : icon('check', 'text-[15px] text-outline') + ' ' + cap(e.status || 'sent');
    body = '<div class="bg-primary-fixed/30 p-2.5 rounded-xl"><div class="flex items-center gap-1.5 text-primary mb-1">' + icon('smart_toy', 'text-[14px]') + '<span class="font-label-sm uppercase tracking-wider text-[10px] font-bold">' + (team ? 'Team copy' : 'Bot') + '</span></div><p class="font-body-sm text-on-surface">' + esc(d.preview || (d.template ? 'Template: ' + d.template : e.title)) + '</p></div><div class="flex items-center justify-end gap-1 font-label-sm text-on-surface-variant text-[11px]">' + tick + '</div>' + (d.error ? '<p class="font-body-sm text-error text-[11px]">' + esc(d.error) + '</p>' : '');
  } else if (e.source === 'reminder') {
    dot = /fail/.test(e.status) ? 'bg-error' : /skip/.test(e.status) ? 'bg-outline-variant' : 'bg-[#2D9CDB]';
    title = 'Reminder · ' + stepLabel(e.kind) + ' (' + (d.channel || '') + ')';
    body = '<div class="flex items-center justify-between gap-2">' + remChip(e.status) + '<span class="font-label-sm text-on-surface-variant text-[11px]">' + (d.due_at ? 'Due ' + esc(fmtDay(d.due_at) + ' ' + fmtTime(d.due_at)) : '') + '</span></div>' + (d.skip_reason ? '<p class="font-body-sm text-on-surface-variant text-[11px]">Reason: ' + esc(cap(d.skip_reason)) + '</p>' : '') + (d.last_error ? '<p class="font-body-sm text-error text-[11px]">' + esc(d.last_error) + '</p>' : '');
  } else if (/note/.test(e.kind || '')) {
    dot = 'bg-secondary-container'; title = 'Note' + (d.by ? ' · ' + d.by : (d.author ? ' · ' + d.author : ''));
    body = '<p class="font-body-sm text-on-surface">' + esc(d.text || e.title) + '</p>';
  } else {
    dot = 'bg-surface-tint'; body = d && d.summary ? '<p class="font-body-sm text-on-surface-variant">' + esc(d.summary) + '</p>' : '';
  }
  return '<div class="relative"><span class="absolute -left-[22px] top-4 w-3 h-3 rounded-full ' + dot + ' ring-4 ring-surface"></span><div class="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm flex flex-col gap-1.5"><div class="flex items-start justify-between gap-2"><span class="font-label-md text-on-surface">' + esc(title) + '</span><span class="font-label-sm text-on-surface-variant text-[11px] shrink-0">' + right + '</span></div>' + body + '</div></div>';
}
function bookingCard(m, compact) {
  var s = String(m.status || '').toLowerCase(), tr = esc(fmtTime(m.start_at) + (m.end_at ? ' – ' + fmtTime(m.end_at) : ''));
  var head = '<div class="flex items-center justify-between"><div class="flex items-center gap-1.5">' + icon('schedule', (s === 'upcoming' ? 'text-primary-container' : 'text-outline') + ' text-[18px]') + '<span class="font-label-lg font-bold text-on-surface">' + (compact ? esc(fmtDay(m.start_at)) + ' · ' : '') + tr + '</span></div><div class="flex items-center gap-1">' + (s === 'upcoming' && num(m.version) > 1 ? '<span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-label-sm bg-secondary-fixed text-on-secondary-fixed-variant">' + icon('update', 'text-[13px]') + 'Moved</span>' : '') + typeChip(m.meeting_type) + '</div></div>';
  var who = '<div class="flex flex-col"><div class="flex items-center justify-between gap-2"><h2 class="font-headline-sm text-on-surface font-bold cursor-pointer" data-lead="' + esc(m.lead_id) + '">' + esc(m.lead_name || m.lead_phone || 'Customer') + '</h2>' + (s === 'upcoming' ? (m.lead_score ? '<span class="font-label-sm text-primary-container font-semibold">' + esc(cap(m.lead_score)) + '</span>' : '') : statusChip(s)) + '</div><p class="font-body-sm text-on-surface-variant mt-0.5">' + esc(m.area || m.location || 'Area not set') + ' — <span class="text-on-surface font-medium">' + esc(m.service || 'Service not set') + '</span></p></div>';
  var host = m.host_name ? '<div class="flex items-center justify-between py-1 px-2 rounded-lg bg-surface-container-low"><div class="flex items-center gap-2"><div class="w-6 h-6 rounded-full bg-primary-container/20 text-on-primary-container font-label-sm flex items-center justify-center font-bold">' + esc(initials(m.host_name)) + '</div><span class="font-label-sm text-on-surface font-semibold">' + esc(m.host_name) + '</span></div>' + icon('electric_bolt', 'text-primary-container text-[18px]') + '</div>' : '';
  var rem = '<div class="flex items-center gap-1.5 text-on-tertiary-container font-label-sm">' + icon(num(m.reminders_failed) ? 'error' : 'check_circle', 'text-[16px] ' + (num(m.reminders_failed) ? 'text-error' : 'text-tertiary')) + '<span>Reminders: ' + num(m.reminders_sent) + ' sent · ' + num(m.reminders_planned) + ' scheduled' + (num(m.reminders_failed) ? ' · ' + num(m.reminders_failed) + ' failed' : '') + (m.reminder_call_outcome ? ' · call: ' + esc(m.reminder_call_outcome) : '') + '</span></div>';
  var actions = '';
  if (s === 'upcoming' && new Date(m.start_at) > Date.now()) actions = '<div class="flex flex-col gap-1.5 pt-1"><button class="min-h-[44px] px-2 rounded-xl bg-surface-container text-on-surface-variant font-label-md flex items-center justify-center gap-1 active:bg-surface-container-high" type="button" data-resched="' + esc(m.lead_id) + '">' + icon('update', 'text-[18px]') + 'Send rebooking link</button><p class="font-label-sm text-on-surface-variant text-center text-[11px]">Attended / Missed can be marked from the visit time</p></div>';
  else if (s === 'upcoming') actions = '<div class="grid grid-cols-3 gap-2 pt-1"><button class="min-h-[44px] px-2 rounded-xl bg-tertiary text-on-tertiary font-label-md flex items-center justify-center gap-1 shadow-sm active:opacity-90" type="button" data-mark="attended" data-m="' + esc(m.id) + '">' + icon('done', 'text-[18px]') + 'Attended</button><button class="min-h-[44px] px-2 rounded-xl bg-error-container/60 text-error font-label-md flex items-center justify-center gap-1 active:bg-error-container" type="button" data-mark="missed" data-m="' + esc(m.id) + '">' + icon('close', 'text-[18px]') + 'Missed</button><button class="min-h-[44px] px-2 rounded-xl bg-surface-container text-on-surface-variant font-label-md flex items-center justify-center gap-1 active:bg-surface-container-high" type="button" data-resched="' + esc(m.lead_id) + '">' + icon('update', 'text-[18px]') + 'Reschedule</button></div>';
  else if (s === 'attended') actions = '<div class="flex items-center gap-2 p-2.5 rounded-xl bg-tertiary-fixed/30 text-on-tertiary-fixed-variant font-label-md mt-1">' + icon('check_circle', 'text-[18px] text-tertiary', true) + '<span>Attended' + (m.updated_at ? ' · marked ' + esc(fmtTime(m.updated_at)) : '') + '</span></div>';
  else if (s === 'missed') actions = '<div class="flex items-center justify-between p-2.5 rounded-xl bg-secondary-fixed/50 text-on-secondary-fixed font-label-sm"><div class="flex items-center gap-1.5">' + icon('autorenew', 'text-[16px] text-secondary') + '<span>' + (num(m.reminders_planned) ? 'Missed-visit follow-up scheduled' : 'Send a booking link to rebook') + '</span></div></div><a class="w-full min-h-[44px] rounded-xl bg-primary-fixed text-on-primary-fixed-variant font-label-md flex items-center justify-center gap-2 active:bg-primary-container active:text-on-primary transition-all" href="' + telLink(m.lead_phone) + '">' + icon('phone_forwarded', 'text-[18px]') + 'Call back now</a>';
  return '<div class="rounded-2xl bg-surface-container-lowest p-space-md shadow-[0_4px_20px_-2px_rgba(255,138,0,0.06),0_2px_8px_rgba(31,41,55,0.04)] flex flex-col gap-space-sm">' + head + who + host + (s === 'upcoming' ? rem : '') + actions + '</div>';
}
async function markMeeting(id, outcome) { try { var r = await rpc('mark_meeting', { p_meeting: id, p_outcome: outcome }); if (r && r.ok === false) throw new Error(r.error || r.result || 'Not updated'); toast('Marked ' + outcome, outcome === 'attended' ? 'task_alt' : 'event_busy'); refresh(); } catch (e) { toast(e.message || 'Could not update', 'error'); } }
async function sendBookingLink(leadId) {
  if (!leadId) return; toast('Sending booking link…', 'send');
  try { var r = await rpc('app_send_booking_link', { p_lead: leadId }) || {};
    if (r.result === 'LINK_SENT') toast('Booking link queued' + (S.settings && S.settings.test_mode ? ' (test mode: test numbers only)' : ''), 'add_link');
    else if (r.result === 'LINK_PENDING') toast('Template not approved yet — team alerted to send the link by hand', 'campaign');
    else toast(r.error || 'Booking link not sent', 'error');
    refresh();
  } catch (e) { toast(e.message || 'Booking link failed', 'error'); }
}
document.addEventListener('click', function (e) {
  var m = e.target.closest && e.target.closest('[data-mark]'); if (m) { e.preventDefault(); markMeeting(m.getAttribute('data-m'), m.getAttribute('data-mark')); return; }
  var r = e.target.closest && e.target.closest('[data-resched]'); if (r) { e.preventDefault(); if (!confirm('Send the booking link on WhatsApp?\n\nThe customer books a NEW slot. The current visit stays booked until it is cancelled in the calendar.')) return; sendBookingLink(r.getAttribute('data-resched')); }
});
var LeadDetail = { file: 'chat', title: 'Lead', setup: function (root, id) {
  var more = $(root, 'button[aria-label="More options"]'); if (more) more.addEventListener('click', function () { go('#/chat/' + id); });
  var main = $(root, 'main'); main.className = 'flex-1 flex flex-col relative w-full pt-16 pb-24 bg-surface';
  main.innerHTML = '<div class="flex flex-col w-full px-margin pt-space-md pb-space-xl gap-space-md" id="ld">' + loadingCard() + loadingCard() + '</div>' +
    '<div class="fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md pt-2 pb-3 px-margin shadow-[0_-2px_12px_rgba(0,0,0,0.05)] pb-safe"><form class="flex items-center gap-2" id="note-form"><div class="flex-1 min-h-[46px] bg-surface-container-low rounded-2xl px-3.5 py-2 flex items-center gap-2 shadow-xs focus-within:ring-2 focus-within:ring-primary-container"><input id="note-input" class="w-full bg-transparent border-none outline-none font-body-md text-on-surface placeholder:text-on-surface-variant/70" placeholder="Add a note…" type="text" maxlength="2000"/></div><button aria-label="Save note" class="w-11 h-11 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-md active:bg-primary active:scale-95 transition-all shrink-0" type="submit">' + icon('send', 'text-[20px] translate-x-0.5') + '</button></form></div>';
  $(root, '#note-form').addEventListener('submit', async function (e) { e.preventDefault(); var inp = $(root, '#note-input'), v = inp.value.trim(); if (!v) return; try { await rpc('add_note', { p_lead: id, p_text: v }); inp.value = ''; toast('Note saved', 'sticky_note_2'); refresh(); } catch (er) { toast(er.message || 'Note not saved', 'error'); } });
  main.addEventListener('click', function (e) { var b = e.target.closest('[data-sendlink]'); if (b) { e.preventDefault(); sendBookingLink(id); } if (e.target.closest('[data-odoo-retry]')) { toast('Odoo email sync retries automatically; the team is alerted if it keeps failing', 'sync_problem'); } });
}, refresh: async function (root, id, rid) {
  var res = await Promise.all([q('leads', function (b) { return b.eq('id', id).limit(1); }), q('meetings', function (b) { return b.eq('lead_id', id).order('start_at', { ascending: false }).limit(5); }), sb.rpc('lead_timeline', { p_lead: id, p_limit: 80 }), q('calls', function (b) { return b.eq('lead_id', id).eq('purpose', 'inbound').limit(1); })]);
  if (stale(rid)) return;
  var l = (await odooFor(res[0]))[0], box = $(root, '#ld');
  if (!l) { box.innerHTML = emptyCard('person_off', 'Lead not found', 'It may have been merged or you may not have access'); return; }
  var meets = res[1], tl = (res[2] && res[2].data) || [], sara = res[3].length > 0;
  var s = String(l.status || 'new').toLowerCase(), next = meets.filter(function (m) { return m.status === 'upcoming'; }).sort(function (a, b) { return new Date(a.start_at) - new Date(b.start_at); })[0] || meets[0];
  var ou = odooUrl(l), os = odooState(l);
  var oline = os === 'synced' ? 'Sent to Odoo CRM · ' + (dDate(l.odoo_synced_at) === today() ? fmtTime(l.odoo_synced_at) : fmtDay(l.odoo_synced_at) + ' ' + fmtTime(l.odoo_synced_at)) : os === 'error' ? 'Send failed — retry' : os === 'pending' ? 'Sending to Odoo CRM…' : 'Not sent yet';
  var ocls = os === 'synced' ? 'text-tertiary' : os === 'error' ? 'text-error' : 'text-on-surface-variant';
  var oic = os === 'synced' ? 'mark_email_read' : os === 'error' ? 'sync_problem' : os === 'pending' ? 'schedule_send' : 'outgoing_mail';
  var sum = aiSummary(l), q2 = l.qualification && typeof l.qualification === 'object' ? l.qualification : null;
  var html = '<section class="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-[0_4px_20px_-2px_rgba(255,138,0,0.06),0_2px_8px_rgba(31,41,55,0.04)] relative overflow-hidden"><div class="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-primary-fixed/20 pointer-events-none blur-2xl"></div>' +
    '<div class="flex items-center gap-space-md relative z-10"><div class="w-14 h-14 rounded-full ' + (AVATAR[s] || 'bg-primary-fixed text-on-primary-fixed-variant') + ' flex items-center justify-center font-headline-md shrink-0">' + esc(initials(l.name || l.phone)) + '</div><div class="flex-1 min-w-0"><div class="flex items-center gap-2 flex-wrap mb-1"><h2 class="font-headline-sm text-on-surface truncate">' + esc(l.name || 'Unknown') + '</h2>' + statusChip(s) + '</div>' +
    (l.phone ? '<a class="font-body-sm text-primary font-semibold" href="' + telLink(l.phone) + '">' + esc(phoneFmt(l.phone)) + '</a>' : '') + '<p class="font-body-sm text-on-surface-variant truncate">Villa · ' + esc(l.area || 'Area not set') + ' — ' + esc(l.service || 'Service not set') + '</p></div></div>' +
    '<div class="flex items-center gap-space-xs flex-wrap mt-space-sm relative z-10">' + sourceChip(l.source) + (sara ? '<span class="px-1.5 py-0.5 rounded-md bg-secondary-fixed text-on-secondary-fixed font-label-sm text-[10px] flex items-center gap-0.5">' + icon('smart_toy', 'text-[11px]') + 'Answered by Sara (AI)</span>' : '') + (l.is_test ? '<span class="px-1.5 py-0.5 rounded-md bg-secondary-fixed/60 text-on-secondary-fixed-variant font-label-sm text-[10px]">Test lead</span>' : '') + (l.do_not_contact ? '<span class="px-1.5 py-0.5 rounded-md bg-error-container text-on-error-container font-label-sm text-[10px]">Do not contact</span>' : '') + '<span class="font-label-sm text-on-surface-variant ml-auto">Created ' + esc(dayLabel(l.created_at)) + (dDate(l.created_at) === today() ? '' : ' ' + esc(fmtTime(l.created_at))) + '</span></div></section>';
  html += '<div class="grid grid-cols-3 gap-2"><a class="min-h-[52px] px-2 rounded-xl bg-tertiary text-on-tertiary font-label-md flex flex-col items-center justify-center gap-0.5 shadow-sm active:opacity-90" href="' + telLink(l.phone) + '">' + icon('call', 'text-[20px]', true) + 'Call</a><a class="min-h-[52px] px-2 rounded-xl bg-tertiary/10 text-tertiary font-label-md flex flex-col items-center justify-center gap-0.5 active:bg-tertiary/20" href="' + waLink(l.phone) + '" target="_blank" rel="noopener">' + icon('chat', 'text-[20px]', true) + 'WhatsApp</a><button class="min-h-[52px] px-2 rounded-xl bg-primary-container text-on-primary font-label-md flex flex-col items-center justify-center gap-0.5 shadow-sm active:scale-95 disabled:opacity-50" type="button" data-sendlink="1"' + (l.do_not_contact ? ' disabled' : '') + '>' + icon('add_link', 'text-[20px]') + 'Send booking link</button></div>';
  html += '<div class="p-space-sm rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-between gap-2"><div class="flex items-center gap-space-sm min-w-0"><div class="w-9 h-9 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary-container shrink-0">' + icon(oic, 'text-[20px]') + '</div><div class="flex flex-col min-w-0"><span class="font-label-md ' + ocls + ' truncate"' + (l.odoo_sync_error ? ' title="' + esc(l.odoo_sync_error) + '"' : '') + '>' + esc(oline) + '</span><span class="font-body-sm text-on-surface-variant truncate">Email sync · one-way (app is the master)</span></div></div>' +
    (os === 'error' ? '<button type="button" class="shrink-0 px-2.5 py-1 rounded-lg bg-error-container/60 text-error font-label-sm text-[11px] font-bold" data-odoo-retry="1">Retry</button>' : '<a class="shrink-0 font-label-md text-[#1B7DB5] flex items-center gap-1 hover:underline" href="' + esc(ou) + '" target="_blank" rel="noopener">Open Odoo CRM' + icon('open_in_new', 'text-[14px]') + '</a>') + '</div>';
  if (next) html += '<div class="flex items-center justify-between pt-1"><h3 class="font-headline-sm text-on-surface font-bold">' + (next.status === 'upcoming' ? 'Next booking' : 'Last booking') + '</h3><a class="font-label-sm text-primary flex items-center gap-0.5" href="#/bookings">All bookings' + icon('arrow_forward', 'text-[14px]') + '</a></div>' + bookingCard(next, true);
  if (sum || q2) { var kv = q2 ? Object.keys(q2).filter(function (k) { return k !== 'summary' && q2[k] != null && q2[k] !== '' && typeof q2[k] !== 'object'; }).slice(0, 8).map(function (k) { return '<span class="px-2 py-0.5 rounded-full bg-surface-container-lowest font-label-sm text-on-surface-variant">' + esc(cap(k)) + ': <span class="text-on-surface">' + esc(q2[k]) + '</span></span>'; }).join('') : '';
    html += '<div class="bg-surface-container-low p-2.5 rounded-lg flex flex-col gap-2"><div class="flex items-start gap-space-xs"><span class="text-base leading-none shrink-0 mt-0.5">🤖</span><p class="font-body-sm text-body-sm text-on-surface"><span class="font-label-md text-label-md ' + (AI_LABEL[s] || 'text-on-primary-fixed-variant') + '">AI summary:</span> ' + esc(sum || 'Qualification details below') + '</p></div>' + (kv ? '<div class="flex flex-wrap gap-1.5">' + kv + '</div>' : '') + '</div>'; }
  if (l.notes) html += '<div class="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm"><span class="font-label-md text-on-surface flex items-center gap-1">' + icon('sticky_note_2', 'text-[16px] text-secondary') + 'Notes</span><p class="font-body-sm text-on-surface-variant whitespace-pre-line mt-1">' + esc(l.notes) + '</p></div>';
  html += '<div class="flex items-center justify-between pt-1"><h3 class="font-headline-sm text-on-surface font-bold">Timeline</h3><span class="font-label-sm text-on-surface-variant">' + tl.length + ' events</span></div>';
  html += tl.length ? '<div class="relative pl-6 flex flex-col gap-3"><div class="absolute left-[9px] top-2 bottom-2 w-0.5 bg-surface-container-high"></div>' + tl.map(function (e) { return tlItem(e, l); }).join('') + '</div>' : emptyCard('timeline', 'No activity yet', 'Calls, WhatsApp, reminders and notes appear here');
  box.innerHTML = html;
} };

/* =====================================================================
   INBOX: CALLS (built on the Stitch WhatsApp frame) & WHATSAPP
   ===================================================================== */
var SEG_ON = 'flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 font-label-md text-on-primary bg-primary-container shadow-md transition-all';
var SEG_OFF = 'flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 font-label-md text-on-surface-variant hover:text-on-surface transition-all';
var CH_ON = 'shrink-0 h-8 px-3.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm flex items-center gap-1.5 shadow-sm';
var CH_OFF = 'shrink-0 h-8 px-3.5 rounded-full bg-surface-container-lowest text-on-surface-variant font-label-sm flex items-center gap-1.5 shadow-sm hover:bg-surface-container transition-colors';
function inboxParts(root) {
  var seg = $(root, 'main .p-1.rounded-xl'); var segBtns = seg ? $$(seg, 'button') : [];
  var chips = $(root, 'main .overflow-x-auto.no-scrollbar');
  var banner = $(root, 'main .px-3\\.5.py-2\\.5.rounded-xl');
  var row = $(root, 'main [role="button"]'); var list = row ? row.parentElement : null;
  var fab = $(root, 'main .fixed.bottom-20');
  return { segBtns: segBtns, chips: chips, banner: banner, list: list, search: $(root, 'main input[type="text"]'), fab: fab, tune: $(root, 'button[aria-label="Toggle chat filters"]') };
}
function callCard(c) {
  var ag = agentOf(c.purpose), o = callOutcome(c), inb = c.direction === 'inbound';
  return '<div class="w-full p-3.5 rounded-2xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-all flex items-start gap-3 cursor-pointer" data-call="' + esc(c.id) + '">' +
    '<div class="relative shrink-0"><div class="w-12 h-12 rounded-full ' + ag.av + ' flex items-center justify-center font-headline-sm font-bold shadow-inner">' + esc(initials(ag.name)) + '</div><span class="absolute -bottom-0.5 -right-1 px-1 rounded-md bg-secondary-fixed text-on-secondary-fixed font-label-sm text-[9px] font-bold shadow-sm">AI</span></div>' +
    '<div class="flex-1 min-w-0"><div class="flex items-center justify-between gap-1"><div class="flex items-center gap-1.5 truncate"><span class="font-headline-sm text-on-surface truncate font-semibold">' + esc(c.lead_name || c.lead_phone || 'Unknown caller') + '</span>' + icon(inb ? 'call_received' : 'call_made', 'text-[16px] shrink-0 ' + (inb ? 'text-tertiary' : 'text-primary-container')) + '</div><span class="font-label-sm text-on-surface-variant shrink-0">' + esc(dayLabel(c.occurred_at)) + '</span></div>' +
    '<p class="font-body-sm text-on-surface-variant truncate mt-0.5">' + esc(ag.name + ' · ' + (c.lead_phone || '') + ' · ' + dur(c.duration_sec)) + '</p>' +
    '<p class="font-body-sm text-on-surface mt-1 line-clamp-2" data-sum>' + esc(c.summary || 'No AI summary yet') + '</p>' +
    '<div class="flex items-center justify-between mt-2 pt-1.5 bg-surface-container-low/50 -mx-1 px-2 py-1 rounded-lg gap-2">' + (c.recording_url ? audioRow(c.recording_url, c.duration_sec) : '<span class="font-label-sm text-on-surface-variant flex items-center gap-1">' + icon('mic_off', 'text-[14px]') + 'No recording</span>') + '<span class="px-2.5 py-0.5 rounded-full font-label-sm font-bold shrink-0 ' + o[1] + '">' + o[0] + '</span></div>' +
    '<div class="hidden flex-col gap-2 pt-2" data-more>' + (c.transcript ? '<div class="bg-surface-container-low rounded-xl p-2.5"><p class="font-label-sm text-on-surface-variant mb-1">Transcript</p><p class="font-body-sm text-on-surface whitespace-pre-line max-h-60 overflow-y-auto">' + esc(String(c.transcript).slice(0, 3000)) + '</p></div>' : '') +
    '<div class="flex items-center justify-end gap-2">' + (c.lead_id ? '<a class="h-9 px-3 rounded-lg bg-surface-container text-on-surface-variant font-label-sm flex items-center gap-1" href="#/lead/' + esc(c.lead_id) + '">' + icon('person', 'text-[16px]') + 'Open lead</a>' : '') + (c.lead_phone ? '<a class="h-9 px-3 rounded-lg bg-primary-container text-on-primary font-label-sm flex items-center gap-1 shadow-sm" href="' + telLink(c.lead_phone) + '">' + icon('phone_forwarded', 'text-[16px]') + 'Call back</a>' : '') + '</div></div></div></div>';
}
var Calls = { file: 'whatsapp', title: 'Calls', setup: function (root, arg) {
  var p = inboxParts(root); S.callAgent = arg || 'all';
  if (p.segBtns.length === 2) { p.segBtns[0].className = SEG_ON; p.segBtns[1].className = SEG_OFF; var ic = $(p.segBtns[0], '.material-symbols-outlined'); if (ic) ic.style.fontVariationSettings = "'FILL' 1"; $$(p.segBtns[1], 'span').forEach(function (s) { s.classList.remove('font-bold'); if (s.classList.contains('animate-pulse')) s.classList.add('hidden'); }); $$(p.segBtns[0], 'span')[1].classList.add('font-bold'); var wi = $(p.segBtns[1], '.material-symbols-outlined'); if (wi) wi.style.fontVariationSettings = "'FILL' 0"; p.segBtns[1].addEventListener('click', function () { go('#/whatsapp'); }); }
  if (p.search) { p.search.placeholder = 'Search calls, names, phones...'; p.search.addEventListener('input', function () { Calls.render(root); }); }
  if (p.tune) p.tune.addEventListener('click', function () { p.search && p.search.focus(); });
  if (p.fab) p.fab.classList.add('hidden');
  if (p.list) { p.list.innerHTML = loadingCard(); p.list.addEventListener('click', function (e) { if (e.target.closest('a,button')) return; var c = e.target.closest('[data-call]'); if (!c) return; var m = $(c, '[data-more]'); var open = m.classList.contains('hidden'); m.classList.toggle('hidden', !open); m.classList.toggle('flex', open); $(c, '[data-sum]').classList.toggle('line-clamp-2', !open); }); }
  if (p.chips) p.chips.addEventListener('click', function (e) { var b = e.target.closest('[data-agent]'); if (b) { S.callAgent = b.getAttribute('data-agent'); Calls.render(root); } });
}, refresh: async function (root, arg, rid) {
  var calls = await q('calls', function (b) { return b.order('occurred_at', { ascending: false }).limit(300); }); if (stale(rid)) return;
  calls.forEach(function (c) { c.lead_phone = c.lead_phone || c.customer_number; }); S.calls = calls; Calls.render(root);
}, render: function (root) {
  var p = inboxParts(root), all = S.calls || [], t = today();
  if (p.chips) p.chips.innerHTML = [{ key: 'all', name: 'All calls' }, AGENTS[0]].map(function (a) { var on = S.callAgent === a.key; var n = a.key === 'all' ? all.length : all.filter(function (c) { return agentOf(c.purpose).key === a.key; }).length; return '<button type="button" data-agent="' + a.key + '" class="' + (on ? CH_ON : CH_OFF) + '">' + (a.key === 'all' ? '' : icon('smart_toy', 'text-[15px] text-secondary')) + '<span>' + esc(a.name) + '</span>' + (on ? '<span class="px-1.5 py-0.5 rounded-full bg-primary-container text-on-primary text-[10px] font-bold">' + n + '</span>' : '') + '</button>'; }).join('');
  var td = all.filter(function (c) { return dDate(c.occurred_at) === t; }), bk = td.filter(function (c) { return callOutcome(c)[0] === 'Booked'; }).length, avg = td.length ? td.reduce(function (s, c) { return s + num(c.duration_sec); }, 0) / td.length : 0;
  if (p.banner) { var sp = $(p.banner, 'span.font-body-sm'); if (sp) sp.innerHTML = td.length + ' calls today · ' + bk + ' booked · <strong class="font-bold">avg ' + dur(avg) + '</strong>'; }
  var qq = p.search ? p.search.value.toLowerCase() : '';
  var list = all.filter(function (c) { return (S.callAgent === 'all' || agentOf(c.purpose).key === S.callAgent) && (!qq || [c.lead_name, c.lead_phone, c.summary, c.agent].join(' ').toLowerCase().indexOf(qq) >= 0); });
  if (p.list) p.list.innerHTML = list.length ? list.slice(0, 100).map(callCard).join('') : emptyCard('call', 'No calls yet', 'Sara answers unanswered calls on 2521 — summaries & recordings appear here');
} };
function threadsFrom(msgs, leadsById) {
  var th = {};
  msgs.forEach(function (m) { if (m.audience === 'team') return; var k = m.lead_id || m.phone; if (!k) return; (th[k] = th[k] || { key: k, lead_id: m.lead_id, phone: m.phone, msgs: [] }).msgs.push(m); });
  return Object.keys(th).map(function (k) { var t = th[k]; t.msgs.sort(function (a, b) { return new Date(b.occurred_at) - new Date(a.occurred_at); }); t.last = t.msgs[0]; t.lead = leadsById[t.lead_id] || {};
    var unread = 0; for (var i = 0; i < t.msgs.length; i++) { if (isIn(t.msgs[i])) unread++; else break; } t.unread = unread; t.needsReply = unread > 0; t.bot = !t.needsReply && !!(t.last.template || t.last.step); t.failed = t.msgs.some(function (m) { return m.status === 'failed'; }); return t; })
    .sort(function (a, b) { return new Date(b.last.occurred_at) - new Date(a.last.occurred_at); });
}
function threadRow(t) {
  var l = t.lead, nm = l.name || t.last.lead_name || t.phone || 'Unknown', s = String(l.status || '').toLowerCase(), x = st(s), ch = String(t.last.channel || '');
  var via = /786/.test(ch) ? ['sim_card', 'via 786'] : /2521/.test(ch) ? ['phone_forwarded', 'via 2521'] : ['api', 'via API number'];
  var prev = t.last.body || (t.last.template ? 'Template: ' + t.last.template : stepLabel(t.last.step));
  return '<div class="w-full p-3.5 rounded-2xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-all active:scale-[0.99] flex items-start gap-3 cursor-pointer" role="button" tabindex="0" data-thread="' + esc(t.key) + '"><div class="relative shrink-0"><div class="w-12 h-12 rounded-full ' + (AVATAR[s] || 'bg-surface-container-highest text-on-surface') + ' flex items-center justify-center font-headline-sm font-bold shadow-inner">' + esc(initials(nm)) + '</div>' + (t.needsReply ? '<span class="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-tertiary-container shadow-sm"></span>' : '') + '</div>' +
    '<div class="flex-1 min-w-0"><div class="flex items-center justify-between gap-1"><div class="flex items-center gap-1.5 truncate"><span class="font-headline-sm text-on-surface truncate ' + (t.needsReply ? 'font-bold' : 'font-semibold') + '">' + esc(nm) + '</span>' + (t.bot ? '<span class="px-1.5 py-0.5 rounded-md bg-secondary-fixed text-on-secondary-fixed font-label-sm text-[10px] flex items-center gap-0.5 shrink-0">' + icon('smart_toy', 'text-[11px]') + 'Bot</span>' : '') + '</div><span class="font-label-sm shrink-0 ' + (t.needsReply ? 'text-tertiary-container font-bold' : 'text-on-surface-variant') + '">' + esc(dayLabel(t.last.occurred_at)) + '</span></div>' +
    '<div class="flex items-center justify-between gap-2 mt-0.5"><p class="' + (t.needsReply ? 'font-body-md font-semibold text-on-surface' : 'font-body-sm text-on-surface-variant') + ' truncate">' + (t.last.status === 'failed' ? icon('error', 'text-[14px] text-error align-middle') + ' ' : '') + esc(prev) + '</p>' + (t.unread ? '<span class="px-2 py-0.5 rounded-full bg-tertiary-container text-on-primary font-label-sm text-[11px] font-bold shrink-0 shadow-sm">' + t.unread + '</span>' : '') + '</div>' +
    '<div class="flex items-center justify-between mt-2 pt-1.5 bg-surface-container-low/50 -mx-1 px-2 rounded-lg"><span class="font-label-sm text-on-surface-variant flex items-center gap-1">' + icon(via[0], 'text-[14px]') + via[1] + '</span>' + (s ? '<span class="px-2.5 py-0.5 rounded-full ' + x[2] + ' font-label-sm font-bold">' + esc(x[0]) + '</span>' : '') + '</div></div></div>';
}
var WhatsApp = { file: 'whatsapp', title: 'WhatsApp', setup: function (root) {
  var p = inboxParts(root); S.waFilter = S.waFilter || 'all';
  if (p.segBtns.length === 2) p.segBtns[0].addEventListener('click', function () { go('#/calls'); });
  if (p.search) p.search.addEventListener('input', function () { WhatsApp.render(root); });
  if (p.tune) p.tune.addEventListener('click', function () { p.search && p.search.focus(); });
  if (p.fab) p.fab.addEventListener('click', function () { toast('Pick a lead, then use WhatsApp or Send booking link', 'chat'); go('#/leads'); });
  if (p.chips) { var vip = byText(p.chips, 'button span', 'VIP AMC'); if (vip) vip.textContent = 'Failed';
    $$(p.chips, 'button').forEach(function (b, i) { b.setAttribute('data-wf', ['all', 'needs', 'bot', 'unread', 'failed'][i] || 'all'); b.addEventListener('click', function () { S.waFilter = b.getAttribute('data-wf'); WhatsApp.render(root); }); }); }
  if (p.list) { p.list.innerHTML = loadingCard(); p.list.addEventListener('click', function (e) { var r = e.target.closest('[data-thread]'); if (r) go('#/chat/' + encodeURIComponent(r.getAttribute('data-thread'))); }); }
}, refresh: async function (root, arg, rid) {
  var res = await Promise.all([q('whatsapp_messages', function (b) { return b.order('occurred_at', { ascending: false }).limit(800); }), q('leads', function (b) { return b.order('created_at', { ascending: false }).limit(1000); })]);
  if (stale(rid)) return; var by = {}; res[1].forEach(function (l) { by[l.id] = l; });
  S.wa = threadsFrom(res[0], by); S.waMsgs = res[0]; S.needsReply = S.wa.filter(function (t) { return t.needsReply; }).length; WhatsApp.render(root);
}, render: function (root) {
  var p = inboxParts(root), all = S.wa || [], t = today();
  var counts = { all: all.length, needs: all.filter(function (x) { return x.needsReply; }).length, bot: all.filter(function (x) { return x.bot; }).length, unread: all.filter(function (x) { return x.unread; }).length, failed: all.filter(function (x) { return x.failed; }).length };
  if (p.chips) $$(p.chips, 'button').forEach(function (b) { var k = b.getAttribute('data-wf'); var on = S.waFilter === k; b.className = on ? CH_ON : CH_OFF; var badge = $$(b, 'span').filter(function (s) { return /^\d+$/.test(txt(s)); })[0]; if (badge) badge.textContent = counts[k]; });
  var sent = (S.waMsgs || []).filter(function (m) { return dDate(m.occurred_at) === t && !isIn(m); }), read = sent.filter(function (m) { return m.status === 'read' || m.read_at; }).length;
  if (p.banner) { var sp = $(p.banner, 'span.font-body-sm'); if (sp) sp.innerHTML = 'WhatsApp API · ' + sent.length + ' sent today • <strong class="font-bold">' + read + ' read</strong>'; }
  var qq = p.search ? p.search.value.toLowerCase() : '';
  var list = all.filter(function (x) { var f = S.waFilter; if (f === 'needs' && !x.needsReply) return false; if (f === 'bot' && !x.bot) return false; if (f === 'unread' && !x.unread) return false; if (f === 'failed' && !x.failed) return false; return !qq || [x.lead.name, x.phone, x.lead.area, x.last.body].join(' ').toLowerCase().indexOf(qq) >= 0; });
  if (p.list) p.list.innerHTML = list.length ? list.slice(0, 150).map(threadRow).join('') : emptyCard('chat', 'No conversations yet', 'Booking links, confirmations, reminders and replies appear here');
} };
var Chat = { file: 'chat', title: 'WhatsApp', setup: function (root, key) {
  var main = $(root, 'main'); var canvas = $(main, '.flex-1.px-margin'); if (canvas) canvas.innerHTML = loadingCard();
  var more = $(root, 'button[aria-label="More options"]'); if (more) more.addEventListener('click', function () { if (S.chatLead) go('#/lead/' + S.chatLead.id); });
  var info = $(root, 'button[aria-label="Customer profile details"]'); if (info) info.addEventListener('click', function () { if (S.chatLead) go('#/lead/' + S.chatLead.id); });
  var callB = $(root, 'button[aria-label="Call customer"]'); if (callB) callB.addEventListener('click', function () { var ph = (S.chatLead && S.chatLead.phone) || key; if (ph) location.href = telLink(ph); });
  var dock = $(main, '.sticky.bottom-0');
  if (dock) {
    $$(dock, '.overflow-x-auto button').forEach(function (b) { var t = txt(b); b.addEventListener('click', function () { if (/booking link|Reschedule/.test(t)) { if (S.chatLead) sendBookingLink(S.chatLead.id); else toast('No lead linked to this chat', 'error'); } else toast('"' + t.replace(/^\S+\s/, '') + '" is not enabled yet', 'info'); }); });
    var att = $(dock, 'button[aria-label="Add attachment"]'), mic = $(dock, 'button[aria-label="Add voice note"]');
    [att, mic].forEach(function (b) { if (b) b.addEventListener('click', function () { toast('Attachments & voice notes are not enabled in the app', 'info'); }); });
    var inp = $(dock, 'input'), send = $(dock, 'button[aria-label="Send message"]');
    if (inp) inp.placeholder = 'Type a WhatsApp message…';
    async function doSend() {
      var v = (inp.value || '').trim(); if (!v) return; if (!S.chatLead) { toast('No lead linked to this chat', 'error'); return; }
      var canvas = $(main, '.flex-1.px-margin'), bub = document.createElement('div');
      bub.className = 'flex flex-col items-end max-w-[86%] self-end';
      bub.innerHTML = '<div class="bg-primary-fixed/40 text-on-surface p-3.5 rounded-2xl rounded-tr-sm shadow-sm space-y-1"><div class="flex items-center justify-between pb-0.5"><span class="font-label-sm font-bold text-on-primary-fixed-variant flex items-center gap-1">' + icon('support_agent', 'text-[14px]') + 'FEFCO team</span></div><p class="font-body-md text-on-surface leading-relaxed whitespace-pre-line">' + esc(v) + '</p><div class="flex items-center justify-end gap-1"><span class="font-label-sm text-on-surface-variant text-[10px]" data-st>Sending…</span>' + icon('schedule', 'text-[15px] text-outline') + '</div></div>';
      if (canvas) { if (canvas.querySelector('.bg-surface-container-lowest.rounded-2xl.p-space-md')) canvas.innerHTML = ''; canvas.appendChild(bub); }
      window.scrollTo(0, document.body.scrollHeight); inp.value = '';
      var st = $(bub, '[data-st]');
      try {
        var r = (await rpc('app_send_whatsapp', { p_lead: S.chatLead.id, p_text: v })) || {}, m = stMsg('wa', r);
        if (m.s === 'queued' || m.s === 'ok') { st.textContent = (r.duplicate ? 'Already queued · ' : 'Queued · ') + fmtTime(new Date()); toast(m.msg, 'send'); }
        else if (m.s === 'outside_window') {
          st.textContent = 'Not sent';
          bub.insertAdjacentHTML('beforeend', '<div class="mt-1 p-2.5 rounded-xl bg-secondary-fixed/50 text-on-secondary-fixed font-label-sm flex flex-col gap-2"><span>' + esc(m.msg) + '</span><button type="button" class="self-end px-3 py-1.5 rounded-lg bg-primary-container text-on-primary font-label-sm font-bold" data-chat-link>Send booking link</button></div>');
          $(bub, '[data-chat-link]').addEventListener('click', function () { sendBookingLink(S.chatLead.id); });
        }
        else { st.textContent = ({ opted_out: 'Opted out', test_mode: 'Not sent · test mode', not_connected: 'Not sent · not connected' })[m.s] || 'Not sent'; toast(m.msg, m.s === 'error' ? 'error' : 'info'); }
      } catch (e) { st.textContent = 'Failed'; toast(e.message || 'Not sent', 'error'); }
    }
    if (send) send.addEventListener('click', doSend); if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSend(); } });
  }
}, refresh: async function (root, key, rid) {
  var isId = /^[0-9a-f-]{36}$/i.test(key);
  var res = await Promise.all([isId ? q('leads', function (b) { return b.eq('id', key).limit(1); }) : q('leads', function (b) { return b.eq('phone', key).limit(1); }),
    q('whatsapp_messages', function (b) { return (isId ? b.eq('lead_id', key) : b.eq('phone', key)).order('occurred_at', { ascending: true }).limit(500); })]);
  if (stale(rid)) return;
  var l = res[0][0] || {}, msgs = res[1].filter(function (m) { return m.audience !== 'team'; }); S.chatLead = l.id ? l : null;
  var main = $(root, 'main'), sub = $(main, '.sticky.top-16');
  if (sub) { var nm = l.name || (msgs[0] && msgs[0].lead_name) || key; var av = $(sub, '.w-10.h-10'); if (av) av.textContent = initials(nm); var h2 = $(sub, 'h2'); if (h2) h2.textContent = nm;
    var chip = h2 && h2.nextElementSibling; if (chip) { if (l.status) chip.textContent = st(l.status)[0]; else chip.classList.add('hidden'); }
    var pp = $(sub, 'p.font-body-sm'); if (pp) pp.textContent = [l.area || 'Area not set', l.service || 'Service not set'].join(' · ');
    var lastIn = msgs.filter(isIn).pop(); var rib = byText(sub, 'span', '24h WhatsApp reply window', true);
    if (rib) { if (lastIn && Date.now() - new Date(lastIn.occurred_at) < 864e5) rib.textContent = '24h WhatsApp reply window open · closes ' + fmtTime(new Date(new Date(lastIn.occurred_at).getTime() + 864e5)); else rib.textContent = lastIn ? '24h reply window closed · templates only' : 'No customer reply yet · templates only'; } }
  var canvas = $(main, '.flex-1.px-margin'); if (!canvas) return;
  if (!msgs.length) { canvas.innerHTML = emptyCard('chat', 'No WhatsApp messages yet', 'Automatic booking links, confirmations and reminders will show here'); return; }
  var html = '', lastDay = '';
  msgs.forEach(function (m) {
    var d = dDate(m.occurred_at); if (d !== lastDay) { lastDay = d; html += '<div class="flex items-center justify-center my-1"><span class="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm shadow-xs">' + (d === today() ? 'Today, ' : '') + esc(fmt(m.occurred_at, { day: 'numeric', month: 'long' })) + '</span></div>'; }
    var body = esc(m.body || (m.template ? 'Template: ' + m.template : stepLabel(m.step))), tm = '<span class="font-label-sm text-on-surface-variant text-[10px]">' + esc(fmtTime(m.occurred_at)) + '</span>';
    if (isIn(m)) { html += '<div class="flex flex-col items-start max-w-[85%] self-start"><div class="bg-surface-container-lowest text-on-surface p-3.5 rounded-2xl rounded-tl-sm shadow-sm space-y-1"><p class="font-body-md text-on-surface leading-relaxed whitespace-pre-line">' + body + '</p><div class="flex items-center justify-end">' + tm + '</div></div></div>'; return; }
    if (m.status === 'failed') { html += '<div class="flex flex-col items-end max-w-[86%] self-end"><div class="bg-error-container/50 text-on-error-container p-3 rounded-2xl rounded-tr-sm shadow-sm space-y-1 w-full"><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-1.5 text-error font-label-md">' + icon('error', 'text-[16px]') + '<span class="font-semibold">' + esc(stepLabel(m.step)) + ' failed</span></div>' + tm + '</div><p class="font-body-sm text-on-surface">' + body + '</p><div class="flex items-center justify-between pt-1"><span class="font-body-sm text-on-surface-variant">' + esc(m.error || 'Delivery failed') + '</span><button class="inline-flex items-center gap-1 font-label-sm text-error font-bold" type="button" data-retry="1">' + icon('replay', 'text-[14px]') + 'Failed — retry</button></div></div></div>'; return; }
    var tick = m.status === 'read' || m.read_at ? icon('done_all', 'text-[15px] text-sky-500 font-bold') : m.status === 'delivered' || m.delivered_at ? icon('done_all', 'text-[15px] text-outline') : /queued|pending|scheduled/.test(m.status || '') ? icon('schedule', 'text-[15px] text-outline') : icon('check', 'text-[15px] text-outline');
    var bot = !!(m.template || m.step), reminder = /before|reminder|day-before|short/.test(m.step || '');
    if (m.step === 'booking-link') { html += '<div class="flex flex-col items-end max-w-[90%] self-end"><div class="bg-primary-fixed/40 p-3.5 rounded-2xl rounded-tr-sm shadow-sm space-y-2.5 w-full"><div class="flex items-center justify-between"><div class="flex items-center gap-1.5 text-primary">' + icon('verified', 'text-[16px]') + '<span class="font-label-md font-bold text-on-primary-fixed-variant">Booking link</span></div><span class="px-2 py-0.5 rounded bg-primary/10 text-primary font-label-sm text-[10px] font-semibold">Bot</span></div><p class="font-body-md text-on-surface">' + body + '</p><a class="w-full bg-surface-container-lowest text-primary p-2.5 rounded-xl shadow-xs flex items-center justify-center gap-2 font-label-md" href="' + esc((S.settings && S.settings.booking_url) || '#') + '" target="_blank" rel="noopener">' + icon('calendar_month', 'text-[18px]') + '<span>Choose a visit time →</span></a><div class="flex items-center justify-end gap-1 pt-0.5">' + tm + tick + '</div></div></div>'; return; }
    html += '<div class="flex flex-col items-end max-w-[86%] self-end"><div class="' + (bot ? 'bg-primary-fixed/30' : 'bg-primary-fixed/40') + ' text-on-surface p-3.5 rounded-2xl rounded-tr-sm shadow-sm space-y-1.5">' + (bot ? '<div class="flex items-center gap-1.5 text-primary">' + icon(reminder ? 'notifications' : 'smart_toy', 'text-[15px]') + '<span class="font-label-sm uppercase tracking-wider text-[10px] font-bold">' + (reminder ? 'Reminder Bot' : 'FEFCO Bot') + '</span></div>' : '<div class="flex items-center justify-between pb-0.5"><span class="font-label-sm font-bold text-on-primary-fixed-variant flex items-center gap-1">' + icon('support_agent', 'text-[14px]') + 'FEFCO team</span></div>') + '<p class="font-body-md text-on-surface leading-relaxed whitespace-pre-line">' + body + '</p><div class="flex items-center justify-end gap-1">' + tm + tick + '</div></div></div>';
  });
  canvas.innerHTML = html;
  $$(canvas, '[data-retry]').forEach(function (b) { b.addEventListener('click', function () { toast('Failed messages are retried automatically by the reminder runner', 'replay'); }); });
  window.scrollTo(0, document.body.scrollHeight);
} };

/* =====================================================================
   BOOKINGS
   ===================================================================== */
function weekStart(ds) { var d = new Date(ds + 'T12:00:00Z'); var wd = (d.getUTCDay() + 6) % 7; return addDays(ds, -wd); }
var Bookings = { file: 'bookings', title: 'Bookings', setup: function (root) {
  S.bk.day = S.bk.day || today();
  var tog = $$(root, 'main .p-1.rounded-xl button');
  tog.forEach(function (b, i) { b.addEventListener('click', function () { S.bk.mode = i === 0 ? 'today' : 'week'; if (i === 0) S.bk.day = today(); Bookings.render(root); refresh(); }); });
  var cards = Bookings.cards(root); if (cards) { cards.innerHTML = loadingCard(); cards.addEventListener('click', function (e) { var c = e.target.closest('[data-lead]'); if (c && !e.target.closest('button,a')) go('#/lead/' + c.getAttribute('data-lead')); }); }
  var strip = Bookings.strip(root); if (strip) strip.addEventListener('click', function (e) { var wk = e.target.closest('[data-wk]'); if (wk) { S.bk.day = addDays(S.bk.day || today(), Number(wk.getAttribute('data-wk'))); S.bk.mode = 'week'; Bookings.render(root); return; } var b = e.target.closest('[data-day]'); if (b) { S.bk.day = b.getAttribute('data-day'); S.bk.mode = 'today'; Bookings.render(root); } });
}, strip: function (root) { var b = $(root, 'main .overflow-x-auto.no-scrollbar.py-1'); return b; },
cards: function (root) { var x = $$(root, 'main .px-margin.pt-space-md.flex.flex-col.gap-space-md'); return x[x.length - 1]; },
refresh: async function (root, arg, rid) {
  var ws = weekStart(S.bk.day || today());
  var rows = await q('meetings', function (b) { return b.gte('start_at', dayStartISO(ws)).lt('start_at', dayStartISO(addDays(ws, 7))).order('start_at'); });
  if (stale(rid)) return; S.bkRows = rows.filter(function (m) { return m.status !== 'cancelled'; }); S.bkWeek = ws; Bookings.render(root);
}, render: function (root) {
  var rows = S.bkRows || [], ws = weekStart(S.bk.day || today()), t = today();
  if (S.bkWeek && S.bkWeek !== ws) { refresh(); return; }
  var tog = $$(root, 'main .p-1.rounded-xl button');
  tog.forEach(function (b, i) { var on = (i === 0) === (S.bk.mode === 'today'); b.className = on ? 'flex-1 py-2 px-space-sm rounded-lg bg-surface-container-lowest text-on-surface font-label-md flex items-center justify-center gap-1.5 shadow-sm transition-all' : 'flex-1 py-2 px-space-sm rounded-lg text-on-surface-variant hover:text-on-surface font-label-md flex items-center justify-center gap-1.5 transition-all'; b.innerHTML = (on ? '<span class="w-2 h-2 rounded-full bg-primary-container"></span> ' : '') + (i === 0 ? (S.bk.day === t ? 'Today' : fmtDay(S.bk.day + 'T08:00:00Z')) : 'Week'); });
  var strip = Bookings.strip(root);
  if (strip) { var h = ''; for (var i = 0; i < 7; i++) { var d = addDays(ws, i), n = rows.filter(function (m) { return m.date_dubai === d; }).length, sel = S.bk.mode === 'today' && d === S.bk.day, dots = ''; for (var k = 0; k < Math.min(n, 6); k++) dots += '<span class="w-1 h-1 rounded-full ' + (sel ? 'bg-surface-container-lowest' : d < t ? 'bg-outline-variant' : 'bg-primary-container/60') + '"></span>';
      var wd = fmt(d + 'T08:00:00Z', { weekday: 'short' }), dn = Number(d.slice(8));
      h += sel ? '<button data-day="' + d + '" class="flex flex-col items-center justify-center min-w-[46px] py-2 px-1 rounded-xl bg-primary-container text-on-primary shadow-[0_4px_14px_rgba(255,138,0,0.35)] relative scale-105"><span class="font-label-sm text-on-primary/90 font-bold uppercase tracking-wider text-[10px]">' + (d === t ? 'Today' : wd) + '</span><span class="font-headline-sm font-bold text-on-primary mt-0.5">' + dn + '</span><div class="flex items-center gap-0.5 mt-1.5 h-1.5">' + dots + '</div></button>'
        : '<button data-day="' + d + '" class="flex flex-col items-center justify-center min-w-[42px] py-2 rounded-xl hover:bg-surface-container transition-colors"><span class="font-label-sm ' + (d === t ? 'text-primary-container font-bold' : 'text-on-surface-variant') + '">' + (d === t ? 'Today' : wd) + '</span><span class="font-headline-sm text-on-surface mt-0.5">' + dn + '</span><div class="flex items-center gap-0.5 mt-1.5 h-1.5">' + dots + '</div></button>'; }
    var wkb = function (n, ic) { return '<button type="button" data-wk="' + n + '" aria-label="' + (n < 0 ? 'Previous' : 'Next') + ' week" class="shrink-0 w-8 h-12 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container">' + icon(ic, 'text-[20px]') + '</button>'; };
    strip.innerHTML = wkb(-7, 'chevron_left') + h + wkb(7, 'chevron_right'); }
  var shown = S.bk.mode === 'today' ? rows.filter(function (m) { return m.date_dubai === S.bk.day; }) : rows;
  var site = shown.filter(function (m) { return isSite(m.meeting_type); }).length;
  var chips = $$(root, 'main .px-margin.pt-space-sm.flex.items-center.gap-space-xs > div');
  if (chips[0]) $(chips[0], 'span.font-label-md').textContent = shown.length + ' booking' + (shown.length === 1 ? '' : 's');
  if (chips[1]) $(chips[1], 'span.font-label-md').textContent = site + ' site visit' + (site === 1 ? '' : 's');
  if (chips[2]) $(chips[2], 'span.font-label-md').textContent = (shown.length - site) + ' phone consult' + (shown.length - site === 1 ? '' : 's');
  var sync = byText(root, 'span', 'Synced with Google Calendar') || byText(root, 'span', 'Live bookings');
  if (sync) { var gc = rows.some(function (m) { return m.external_ref; }); sync.textContent = gc ? 'Synced with Google Calendar' : 'Live bookings from FEFCO booking system'; var r = sync.closest('.flex.items-center.justify-between'); var tsp = r && r.lastElementChild; if (tsp) tsp.textContent = fmtTime(new Date()) + ' GST'; }
  var cards = Bookings.cards(root); if (!cards) return;
  if (!shown.length) { cards.innerHTML = emptyCard('event_available', S.bk.mode === 'today' ? 'No bookings on this day' : 'No bookings this week', 'Bookings from Sara, the booking page and the team appear here'); return; }
  var html = '', last = '';
  shown.forEach(function (m) { if (S.bk.mode === 'week' && m.date_dubai !== last) { last = m.date_dubai; html += '<div class="flex items-center justify-center my-1"><span class="px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm shadow-xs">' + esc(fmtDay(m.start_at)) + '</span></div>'; } html += '<div data-lead="' + esc(m.lead_id) + '">' + bookingCard(m) + '</div>'; });
  cards.innerHTML = html;
} };

/* =====================================================================
   AI AGENTS (built on the Stitch Ads frame — Stitch export missing)
   ===================================================================== */
function toggleHtml(on) { return '<span role="switch" aria-checked="' + on + '" aria-disabled="true" class="w-11 h-6 ' + (on ? 'bg-tertiary-container' : 'bg-surface-variant') + ' rounded-full p-0.5 relative flex items-center shrink-0 shadow-inner"><span class="toggle-knob ' + (on ? 'translate-x-5' : 'translate-x-0') + ' inline-block w-5 h-5 rounded-full bg-surface-container-lowest shadow-md transform transition-transform"></span></span>'; }
function stat5(label, val, cls) { return '<div class="flex flex-col items-center"><span class="font-label-sm text-[10px] text-on-surface-variant">' + label + '</span><span class="' + (cls || 'font-headline-sm text-[13px] text-on-surface font-bold') + ' mt-0.5">' + val + '</span></div>'; }
var Agents = { file: 'ads', title: 'AI Agents', setup: function (root) {
  var wrap = $(root, 'main > div'); wrap.innerHTML = '<div id="ag" class="flex flex-col gap-space-md pt-space-xs">' + loadingCard() + '</div>';
}, refresh: async function (root, arg, rid) {
  var rows = await q('agents', function (b) { return b.order('sort'); }); if (stale(rid)) return;
  if (!rows.length) rows = AGENTS.map(function (a, i) { return { agent: a.key, name: a.name, description: a.role, enabled: i === 0, status_note: i === 0 ? 'live' : 'off: no outbound caller line yet', calls_today: 0, sort: i }; });
  var on = rows.filter(function (r) { return r.enabled; }), callsT = rows.reduce(function (s, r) { return s + num(r.calls_today); }, 0), costT = rows.reduce(function (s, r) { return s + num(r.cost_usd_today); }, 0);
  var kpi = function (label, val, unit, note) { return '<div class="bg-surface-container-lowest rounded-xl p-3 shadow-[0_4px_20px_-2px_rgba(255,138,0,0.06),0_2px_8px_rgba(31,41,55,0.04)] flex flex-col justify-between"><span class="font-label-sm text-on-surface-variant truncate">' + label + '</span><div class="mt-1">' + (unit ? '<span class="font-label-currency text-[10px] text-on-surface-variant">' + unit + '</span>' : '') + '<p class="font-headline-sm text-on-surface font-extrabold tracking-tight">' + val + '</p></div><span class="font-label-sm text-tertiary text-[10px] font-bold mt-1 truncate">' + note + '</span></div>'; };
  var html = '<div class="flex items-center justify-between bg-surface-container-low px-space-md py-space-xs rounded-xl"><div class="flex items-center gap-space-xs text-on-tertiary-container"><span class="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span><span class="font-label-sm text-label-sm">' + on.length + ' agent' + (on.length === 1 ? '' : 's') + ' live · ' + callsT + ' calls today · ' + aed(costT) + ' today</span></div></div>';
  html += '<div class="grid grid-cols-3 gap-space-sm">' + kpi('Agents on', on.length + ' of ' + rows.length, '', on.map(function (r) { return r.name; }).join(', ') || 'none') + kpi('Calls today', callsT, '', rows.reduce(function (s, r) { return s + num(r.bookings_today); }, 0) + ' booked') + kpi('Cost today', (costT * 3.6725).toFixed(2), 'AED', 'Vapi usage') + '</div>';
  html += '<div class="flex items-center justify-between pt-1"><div class="flex items-center gap-2"><h2 class="font-headline-sm text-on-surface">Voice agents</h2><span class="px-2 py-0.5 rounded-full font-label-sm bg-surface-container-high text-on-surface-variant font-bold">Vapi</span></div><span class="font-label-sm text-on-surface-variant">Dubai time</span></div>';
  rows.forEach(function (r) {
    var a = AGENTS.filter(function (x) { return x.key === r.agent; })[0] || AGENTS[1], live = !!r.enabled;
    var c7 = num(r.calls_7d), rate = c7 ? Math.round(100 * num(r.bookings_7d) / c7) + '%' : '–';
    html += '<div class="bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_-2px_rgba(255,138,0,0.06),0_2px_8px_rgba(31,41,55,0.04)] overflow-hidden relative ' + (live ? '' : 'opacity-60') + '"><div class="absolute left-0 top-0 bottom-0 w-1 ' + (live ? a.bar : 'bg-outline-variant') + '"></div><div class="p-space-md pl-space-lg flex flex-col gap-space-sm">' +
      '<div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2 min-w-0"><span class="w-8 h-8 rounded-lg ' + a.box + ' flex items-center justify-center shrink-0">' + icon(a.ic, 'text-[18px]') + '</span><div class="min-w-0"><h3 class="font-label-lg text-on-surface font-bold">' + esc(r.name) + '</h3><p class="font-label-sm text-on-surface-variant font-normal truncate">' + esc(r.description || a.role) + '</p></div></div><div class="flex items-center gap-1.5 shrink-0"><span class="font-label-sm uppercase tracking-wider ' + (live ? 'text-tertiary' : 'text-on-surface-variant') + ' font-extrabold text-[10px]">' + (live ? 'Live' : 'Off') + '</span>' + toggleHtml(live) + '</div></div>' +
      (live ? '<div class="grid grid-cols-5 gap-1.5 bg-surface-container-low p-2.5 rounded-xl text-center">' + stat5('Today', num(r.calls_today)) + stat5('Booked', rate, 'font-headline-sm text-[13px] text-tertiary font-bold') + stat5('Avg', r.avg_duration_sec_7d ? dur(r.avg_duration_sec_7d) : '–', 'font-label-currency text-[12px] text-on-surface') + stat5('Cost', 'AED ' + (num(r.cost_usd_today) * 3.6725).toFixed(2), 'font-label-currency text-[11px] text-on-surface') + stat5('Last', r.last_call_at ? esc(dayLabel(r.last_call_at)) : '–', 'font-label-currency text-[11px] text-on-surface') + '</div>' : '') +
      '<div class="flex items-center justify-between pt-1">' + (live ? '<span class="font-label-sm text-tertiary flex items-center gap-1">' + icon('check_circle', 'text-[14px]') + esc(cap(r.status_note || 'Live')) + '</span><a class="font-label-sm text-primary font-bold flex items-center gap-0.5" href="#/calls/' + a.key + '">View calls' + icon('chevron_right', 'text-[16px]') + '</a>' : '<span class="px-2 py-0.5 rounded-full font-label-sm bg-secondary-fixed text-on-secondary-fixed-variant flex items-center gap-1">' + icon('sim_card_alert', 'text-[13px]') + 'Needs an outbound calling line</span>') + '</div></div></div>';
  });
  $(root, '#ag').innerHTML = html;
} };

/* =====================================================================
   ADS
   ===================================================================== */
function pick(r, keys) { for (var i = 0; i < keys.length; i++) if (r[keys[i]] != null && r[keys[i]] !== '') return r[keys[i]]; return null; }
var Ads = { file: 'ads', title: 'Ads', setup: function (root) {
  $$(root, '#dateFilterChips .date-chip').forEach(function (b) { b.addEventListener('click', function () { var r = b.getAttribute('data-range'); if (r === 'custom') { toast('Custom range: use 30 days for now', 'tune'); r = '30d'; } S.adsRange = r; refresh(); }); });
  var sync = $(root, '#refreshSyncBtn'); if (sync) sync.addEventListener('click', function () { refresh(); toast('Refreshed', 'cached'); });
  var bud = byText(root, 'p', 'Budget reallocation suggested'); if (bud) bud.closest('.rounded-2xl').classList.add('hidden');
  var tip = byText(root, 'span', 'Peak response on', true); if (tip) tip.closest('.rounded-xl').classList.add('hidden');
  var cc = $(root, '#campaignsContainer'); if (cc) { cc.innerHTML = loadingCard(); cc.addEventListener('click', function (e) { var b = e.target.closest('.campaign-toggle'); if (!b) return; var t = $(cc, '#' + b.getAttribute('data-target')); if (!t) return; var open = t.classList.contains('hidden'); t.classList.toggle('hidden', !open); t.classList.toggle('flex', open); var ic = $(b, '.material-symbols-outlined'); if (ic) ic.style.transform = open ? 'rotate(180deg)' : ''; }); }
}, refresh: async function (root, arg, rid) {
  var t = today(), from = S.adsRange === 'today' ? t : S.adsRange === '30d' ? addDays(t, -29) : addDays(t, -6);
  var res = await Promise.all([q('ad_performance'), q('leads', function (b) { return b.gte('created_at', dayStartISO(from)).limit(2000); }), q('meetings', function (b) { return b.gte('booked_at', dayStartISO(from)).limit(2000); })]);
  if (stale(rid)) return;
  var ads = res[0].filter(function (r) { var d = pick(r, ['date', 'day', 'stat_date', 'date_start', 'report_date']); return !d || String(d).slice(0, 10) >= from; });
  var leads = res[1], meets = res[2], hasAds = ads.length > 0;
  $$(root, '#dateFilterChips .date-chip').forEach(function (b) { var on = b.getAttribute('data-range') === S.adsRange; b.className = 'date-chip shrink-0 px-space-md py-2 rounded-full font-label-md shadow-sm transition-all focus:outline-none ' + (on ? 'bg-primary-container text-on-primary shadow-primary-container/20 font-bold' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high') + (b.getAttribute('data-range') === 'custom' ? ' flex items-center gap-1' : ''); });
  var upd = byText(root, 'span', 'Meta Ads ·', true); if (upd) { var lu = ads.map(function (r) { return pick(r, ['updated_at', 'synced_at', 'fetched_at']); }).filter(Boolean).sort().pop(); upd.innerHTML = hasAds ? 'Meta Ads · updated <span class="text-on-surface font-semibold">' + esc(lu ? fmtDay(lu) + ' ' + fmtTime(lu) : 'recently') + '</span>' : 'Meta Ads · <span class="text-on-surface font-semibold">not connected yet</span> — leads & bookings are live'; }
  var paid = leads.filter(function (l) { return ['call', 'form', 'whatsapp'].indexOf(srcInfo(l.source).key) >= 0; });
  var spend = ads.reduce(function (s, r) { return s + num(pick(r, ['spend_aed', 'spend', 'amount_spent', 'cost'])); }, 0);
  var aLeads = hasAds ? ads.reduce(function (s, r) { return s + num(pick(r, ['crm_leads', 'meta_leads', 'leads', 'results'])); }, 0) : paid.length;
  var leadIds = {}; paid.forEach(function (l) { leadIds[l.id] = 1; });
  var aBook = hasAds && ads.some(function (r) { return r.crm_booked_leads != null; }) ? ads.reduce(function (s, r) { return s + num(r.crm_booked_leads); }, 0) : meets.filter(function (m) { return leadIds[m.lead_id]; }).length;
  var cpl = hasAds && aLeads ? spend / aLeads : null, cpb = hasAds && aBook ? spend / aBook : null;
  function setCard(label, val, note) { var s = byText(root, 'span', label) || byText(root, 'span', label.toUpperCase()); var c = s && s.closest('.rounded-xl'); if (!c) return; var v = $(c, '.font-kpi-metric-sm, p.font-headline-sm'); if (v) v.textContent = val; var n = $$(c, 'span.font-label-sm.text-tertiary').pop(); if (n && note != null) { n.textContent = note; } }
  setCard('Total Spend', hasAds ? Math.round(spend) : '–', hasAds ? 'Meta Ads' : 'No spend data');
  setCard('Leads', aLeads, paid.length + ' from ads');
  setCard('Cost / Lead', cpl == null ? '–' : cpl.toFixed(1), cpl == null ? 'Needs spend data' : cpl <= 30 ? 'Within cap' : 'Over cap');
  setCard('Bookings', aBook, meets.length + ' total');
  setCard('Cost / Book', cpb == null ? '–' : cpb.toFixed(1), cpb == null ? 'Needs spend data' : cpb <= 100 ? 'Under limit' : 'Over limit');
  // targets
  var callSpend = ads.filter(function (r) { return /call/i.test(String(pick(r, ['ad_type', 'campaign_name', 'campaign']) || '')); }).reduce(function (s, r) { return s + num(pick(r, ['spend_aed', 'spend', 'amount_spent', 'cost'])); }, 0);
  var callLeads = paid.filter(function (l) { return srcInfo(l.source).key === 'call'; }).length, cpc = hasAds && callLeads ? callSpend / callLeads : null;
  [['Cost per call ≤ AED 30', cpc, 30], ['Cost per booked job ≤ AED 100', cpb, 100]].forEach(function (x) { var s = byText(root, 'span.font-bold', x[0]); if (!s) return; var box = s.closest('.rounded-xl'), p = s.parentElement, ok = x[1] != null && x[1] <= x[2];
    box.className = 'flex items-center gap-2.5 px-space-md py-2.5 rounded-xl shadow-sm ' + (x[1] == null ? 'bg-surface-container-low text-on-surface-variant' : ok ? 'bg-tertiary-fixed/40 text-on-tertiary-container' : 'bg-error-container/50 text-on-error-container');
    var dot = $(box, 'span.w-5'); if (dot) { dot.className = 'flex items-center justify-center w-5 h-5 rounded-full text-[12px] font-bold shrink-0 ' + (x[1] == null ? 'bg-outline-variant text-on-surface' : ok ? 'bg-tertiary text-on-tertiary' : 'bg-error text-on-error'); dot.textContent = x[1] == null ? '–' : ok ? '✓' : '!'; }
    p.innerHTML = '<span class="font-bold">' + esc(x[0]) + '</span> — ' + (x[1] == null ? 'waiting for ad spend data' : (ok ? 'On target' : 'Over target') + ' (<span class="font-bold ' + (ok ? 'text-tertiary' : 'text-error') + '">AED ' + x[1].toFixed(1) + '</span>)'); });
  // chart
  var svg = $(root, 'main svg[viewBox="0 0 320 150"], main svg[viewbox="0 0 320 150"]');
  var days = []; for (var d = from; d <= t; d = addDays(d, 1)) days.push(d);
  var ld = days.map(function (d) { return leads.filter(function (l) { return dDate(l.created_at) === d; }).length; }), bd = days.map(function (d) { return meets.filter(function (m) { return dDate(m.booked_at) === d; }).length; });
  if (svg) { var mx = Math.max(1, Math.max.apply(null, ld.concat(bd))), W = 300, x0 = 14, H = 110, bw = (W - x0) / days.length, g = '';
    for (var i = 0; i <= 2; i++) { var yy = 10 + H * i / 2; g += '<line x1="' + x0 + '" x2="318" y1="' + yy + '" y2="' + yy + '" stroke="#eef0f4" stroke-width="1"></line><text x="0" y="' + (yy + 3) + '" font-size="8" fill="#8a7362">' + Math.round(mx * (1 - i / 2)) + '</text>'; }
    days.forEach(function (d, i) { var cx = x0 + i * bw, w = Math.max(2, bw * 0.32), h1 = H * ld[i] / mx, h2 = H * bd[i] / mx; g += '<rect x="' + (cx + bw * 0.14).toFixed(1) + '" y="' + (10 + H - h1).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h1.toFixed(1) + '" rx="2" fill="#ff8a00"></rect><rect x="' + (cx + bw * 0.14 + w + 1).toFixed(1) + '" y="' + (10 + H - h2).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h2.toFixed(1) + '" rx="2" fill="#22B573"></rect>'; if (days.length <= 7 || i % 5 === 0) g += '<text x="' + (cx + bw / 2).toFixed(1) + '" y="140" font-size="8" text-anchor="middle" fill="#564334">' + (days.length <= 7 ? fmt(d + 'T08:00:00Z', { weekday: 'short' }) : Number(d.slice(8))) + '</text>'; });
    svg.innerHTML = g; }
  var sub = byText(root, 'p', 'Leads vs bookings (Last 7 days)', true) || byText(root, 'p', 'Leads vs bookings', true); if (sub) sub.textContent = 'Leads vs bookings (' + (S.adsRange === 'today' ? 'today' : S.adsRange === '30d' ? 'last 30 days' : 'last 7 days') + ')';
  // campaigns
  var cc = $(root, '#campaignsContainer'); if (!cc) return;
  var groups = [];
  if (hasAds) { var gm = {}; ads.forEach(function (r) { var name = pick(r, ['campaign_name', 'campaign']) || 'Campaign'; var g2 = gm[name] = gm[name] || { name: name, spend: 0, leads: 0, bookings: 0, ads: {}, status: pick(r, ['status', 'campaign_status']) || 'Active', number: [cap(r.ad_type || ''), r.phone_number || ''].filter(Boolean).join(' · '), key: r.ad_type || name }; g2.spend += num(pick(r, ['spend_aed', 'spend', 'amount_spent', 'cost'])); g2.leads += num(pick(r, ['crm_leads', 'meta_leads', 'leads'])); g2.bookings += num(r.crm_booked_leads); var an = pick(r, ['ad_name', 'ad']); if (an) { g2.ads[an] = g2.ads[an] || { l: 0, s: 0 }; g2.ads[an].l += num(pick(r, ['leads', 'results'])); g2.ads[an].s += num(pick(r, ['spend_aed', 'spend', 'amount_spent'])); } }); groups = Object.keys(gm).map(function (k) { return gm[k]; }); }
  else { [['call', 'Call ads · 2521', 'Meta call ads → 2521 / Sara'], ['form', 'Instant Form · 2521', 'Meta lead form → callback'], ['whatsapp', 'Click-to-WhatsApp · 786', 'WhatsApp ads → 786']].forEach(function (x) { var ls = paid.filter(function (l) { return srcInfo(l.source).key === x[0]; }); var ids = {}; ls.forEach(function (l) { ids[l.id] = 1; }); groups.push({ name: x[1], desc: x[2], spend: null, leads: ls.length, bookings: meets.filter(function (m) { return ids[m.lead_id]; }).length, ads: {}, status: 'No spend data', key: x[0] }); }); }
  var hdr = byText(root, 'h2', 'Campaign Breakdown'); if (hdr) { var badge = hdr.nextElementSibling; if (badge) badge.textContent = groups.length + (hasAds ? ' campaigns' : ' sources'); var r2 = hdr.closest('.flex.items-center.justify-between'); if (r2 && r2.lastElementChild) r2.lastElementChild.textContent = hasAds ? 'Meta Ads' : 'From live leads'; }
  cc.innerHTML = groups.length ? groups.map(function (g2, i) { var si = srcInfo(g2.key || g2.name), bar = si.key === 'form' ? 'bg-[#2D9CDB]' : si.key === 'whatsapp' ? 'bg-[#22B573]' : 'bg-primary-container'; var adsN = Object.keys(g2.ads);
    var cplv = g2.spend != null && g2.leads ? (g2.spend / g2.leads).toFixed(1) : '–', cpbv = g2.spend != null && g2.bookings ? 'AED ' + Math.round(g2.spend / g2.bookings) : '–';
    return '<div class="bg-surface-container-lowest rounded-2xl shadow-[0_4px_20px_-2px_rgba(255,138,0,0.06),0_2px_8px_rgba(31,41,55,0.04)] overflow-hidden relative"><div class="absolute left-0 top-0 bottom-0 w-1 ' + bar + '"></div><div class="p-space-md pl-space-lg flex flex-col gap-space-sm"><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2 min-w-0"><span class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ' + si.cls + '">' + icon(si.key === 'call' ? 'phone_in_talk' : si.key === 'whatsapp' ? 'chat' : 'assignment', 'text-[18px]') + '</span><div class="min-w-0"><h3 class="font-label-lg text-on-surface font-bold truncate">' + esc(g2.name) + '</h3><p class="font-label-sm text-on-surface-variant font-normal truncate">' + esc(g2.desc || g2.number || 'Meta Ads campaign') + '</p></div></div><span class="px-2.5 py-0.5 rounded-full font-label-sm ' + (g2.spend == null ? 'bg-surface-container-high text-on-surface-variant' : 'bg-tertiary-fixed text-on-tertiary-container') + ' font-bold flex items-center gap-1 shrink-0"><span class="w-1.5 h-1.5 rounded-full ' + (g2.spend == null ? 'bg-outline' : 'bg-tertiary') + '"></span>' + esc(cap(g2.status)) + '</span></div>' +
      '<div class="grid grid-cols-5 gap-1.5 bg-surface-container-low p-2.5 rounded-xl text-center">' + stat5('Spend', g2.spend == null ? '–' : 'AED ' + Math.round(g2.spend), 'font-label-currency text-[12px] text-on-surface') + stat5('Leads', g2.leads) + stat5('CPL', cplv, 'font-label-currency text-[12px] text-on-surface') + stat5('Bookings', g2.bookings, 'font-headline-sm text-[13px] text-tertiary font-bold') + stat5('Cost / Bk', cpbv, 'font-label-currency text-[12px] text-on-surface') + '</div>' +
      (adsN.length ? '<button aria-expanded="false" class="campaign-toggle w-full flex items-center justify-between pt-1 text-primary focus:outline-none" data-target="subads-' + i + '" type="button"><span class="font-label-sm text-primary font-bold flex items-center gap-1">' + icon('expand_more', 'text-[16px] transition-transform duration-200') + '<span class="toggle-text">' + adsN.length + ' ads</span></span><span class="font-label-sm text-on-surface-variant">Tap to see ads</span></button><div class="hidden flex-col gap-2 pt-2" id="subads-' + i + '">' + adsN.map(function (an) { var a = g2.ads[an]; return '<div class="flex items-center justify-between p-2 rounded-xl bg-surface-container-lowest shadow-sm"><div class="flex items-center gap-2 min-w-0"><span class="w-2 h-2 rounded-full ' + bar + ' shrink-0"></span><span class="font-body-sm text-[12px] font-semibold text-on-surface truncate">' + esc(an) + '</span></div><span class="font-label-sm text-on-surface-variant shrink-0">' + a.l + ' leads' + (a.l ? ' · AED ' + (a.s / a.l).toFixed(1) : '') + '</span></div>'; }).join('') + '</div>' : '') + '</div></div>'; }).join('') : emptyCard('campaign', 'No ad data yet', 'Spend appears once the Meta Ads sync runs');
} };

/* =====================================================================
   MORE
   ===================================================================== */
var More = { file: 'more', title: 'More', setup: function (root) {
  function tile(h, fn) { var x = byText(root, 'h3', h); if (x) x.closest('button').addEventListener('click', fn); }
  tile('AI Agents', function () { go('#/agents'); }); tile('Ads', function () { go('#/ads'); }); tile('Reminders', function () { go('#/reminders'); }); tile('Settings', function () { go('#/settings'); });
  var inst = byText(root, 'span', 'Install app on this phone'); if (inst) inst.closest('button').addEventListener('click', openInstall);
  var help = byText(root, 'span', 'Help & how-to'); if (help) help.closest('button').addEventListener('click', function () { toast('Tap a lead to call, WhatsApp or send a booking link. Mark visits in Bookings.', 'help'); });
  var so = byText(root, 'span', 'Sign out'); if (so) so.closest('button').addEventListener('click', signOut);
  var badge = $(root, 'button[aria-label="Quick profile switch"]'); if (badge) badge.addEventListener('click', function () { go('#/settings'); });
}, refresh: async function (root, arg, rid) {
  var res = await Promise.all([q('reminders', function (b) { return b.eq('is_current_plan', true).in('status', ['scheduled', 'pending', 'queued', 'retry']).limit(500); }), q('ad_performance')]); if (stale(rid)) return;
  var me = S.me || {}, nm = me.name || me.email || 'Team member', role = cap(me.app_role || me.role || 'team');
  var sec = $(root, 'main section'); if (sec) { var imgBox = $(sec, '.w-14.h-14'); if (imgBox) imgBox.innerHTML = '<div class="w-full h-full bg-primary-fixed text-on-primary-fixed-variant flex items-center justify-center font-headline-sm">' + esc(initials(nm)) + '</div>'; var h2 = $(sec, 'h2'); if (h2) h2.textContent = nm; var r1 = h2 && h2.nextElementSibling; if (r1) r1.textContent = '(' + role + ')'; var chip = r1 && r1.nextElementSibling; if (chip) chip.textContent = /owner|admin/i.test(me.role || '') ? 'Admin' : 'Team'; }
  var ag = byText(root, 'h3', 'AI Agents'); if (ag) { var s = $(ag.parentElement, 'span.font-label-md'); if (s) s.textContent = '1 of 5 on'; }
  var ads = byText(root, 'h3', 'Ads'); if (ads) { var p = $(ads.parentElement, 'p'); var td = res[1].filter(function (r) { return String(pick(r, ['date', 'day', 'stat_date', 'date_start']) || '').slice(0, 10) === today(); }); var sp = td.reduce(function (s2, r) { return s2 + num(pick(r, ['spend_aed', 'spend', 'amount_spent'])); }, 0); if (p) p.textContent = res[1].length ? 'AED ' + Math.round(sp) + ' today' : 'Meta Ads not connected yet'; }
  var rm = byText(root, 'h3', 'Reminders'); if (rm) { var b = rm.closest('button'); var al = $(b, 'span.inline-flex'); if (al) { al.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-primary-container"></span> ' + S.openAlerts + ' alert' + (S.openAlerts === 1 ? '' : 's'); al.classList.toggle('hidden', !S.openAlerts); } var p2 = $(rm.parentElement, 'p'); if (p2) p2.textContent = res[0].length + ' scheduled'; }
  var stg = byText(root, 'h3', 'Settings'); if (stg) { var b2 = stg.closest('button'); var tm = byText(b2, 'span', 'Test mode'); if (tm) tm.classList.toggle('hidden', !(S.settings && S.settings.test_mode)); var p3 = $(stg.parentElement, 'p'); if (p3) p3.textContent = 'Team, numbers & templates'; }
  var uv = byText(root, 'span', 'Dubai Solar UV Index:', true) || byText(root, 'span', 'Test mode', true); var sec2 = uv && uv.closest('section');
  if (sec2) { var on = S.settings && S.settings.test_mode; var spn = $(sec2, 'span.font-label-md'); if (spn) spn.innerHTML = on ? 'Test mode: <strong class="text-on-surface">ON</strong> — messages & calls go to test numbers only' : 'Live mode — messages go to real customers'; var right = $(sec2, 'span.font-label-sm'); if (right) right.textContent = 'Safety'; var ic = $(sec2, '.material-symbols-outlined'); if (ic) ic.textContent = on ? 'science' : 'verified_user'; }
} };

/* =====================================================================
   REMINDERS & ALERTS
   ===================================================================== */
function remCard(r) {
  var ch = String(r.channel || '').toLowerCase(), g = remGroup(r.status), team = /team/.test(r.audience || '') || /^team/.test(r.step || '');
  var ic = /call|voice|phone/.test(ch) ? ['phone_in_talk', 'bg-primary-container/15 text-primary'] : /mail/.test(ch) ? ['mail', 'bg-[#2D9CDB]/15 text-[#1B7DB5]'] : ['chat', 'bg-tertiary-container/20 text-tertiary'];
  if (g === 'failed') ic = ['sms_failed', 'bg-error-container text-error']; if (g === 'skipped') ic = ['block', 'bg-surface-container text-on-surface-variant'];
  var when = g === 'queue' ? (r.next_retry_at || r.due_at) : (r.done_at || r.due_at);
  var foot = g === 'failed' ? '<span class="font-body-sm text-error text-[11px] truncate mr-2">' + esc(r.last_error || 'Delivery failed') + '</span><button class="min-h-[38px] px-3.5 rounded-lg bg-primary-container text-on-primary font-label-sm flex items-center gap-1.5 shadow-sm active:scale-95 transition-all" type="button" data-rretry="' + esc(r.id) + '">' + icon('refresh', 'text-[16px]') + '<span>Retry</span></button>'
    : g === 'skipped' ? '<span class="font-body-sm text-on-surface-variant text-[11px]">Reason: ' + esc(cap(r.skip_reason || 'not needed')) + '</span>'
    : '<span class="font-body-sm text-on-surface-variant text-[11px] flex items-center gap-1">' + icon(/call/.test(ch) ? 'support_agent' : 'smart_toy', 'text-[14px] text-tertiary') + (/call/.test(ch) ? 'AI voice reminder' : 'Automatic WhatsApp') + (r.attempts ? ' · ' + r.attempts + ' attempt' + (r.attempts > 1 ? 's' : '') : '') + '</span>' + (r.lead_id ? '<a class="font-label-sm text-primary flex items-center gap-0.5 hover:underline" href="#/lead/' + esc(r.lead_id) + '"><span>Open lead</span>' + icon('chevron_right', 'text-[14px]') + '</a>' : '');
  return '<div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm transition-all hover:shadow-md' + (g === 'skipped' ? ' opacity-90' : '') + '"><div class="flex items-start justify-between gap-space-sm"><div class="flex items-center gap-space-sm min-w-0"><div class="w-10 h-10 rounded-full ' + ic[1] + ' flex items-center justify-center shrink-0">' + icon(ic[0], 'text-[20px]') + '</div><div class="flex flex-col min-w-0"><div class="flex items-center gap-space-xs"><h2 class="font-headline-sm text-headline-sm text-on-surface truncate">' + esc(r.lead_name || r.lead_phone || 'Customer') + '</h2><span class="px-2 py-0.5 rounded-full ' + (team ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant') + ' font-label-sm text-[10px] shrink-0">' + (team ? 'Team' : 'Customer') + '</span></div><p class="font-body-sm text-body-sm text-on-surface-variant truncate">' + esc(r.meeting_start_at ? fmtDay(r.meeting_start_at) + ' · ' + fmtTime(r.meeting_start_at) + ' · ' + (isSite(r.meeting_type) ? 'Site visit' : 'Phone consult') : 'No booking linked') + '</p></div></div>' + remChip(r.status) + '</div>' +
    '<div class="' + (g === 'failed' ? 'bg-error-container/30' : 'bg-surface-container-low/60') + ' rounded-lg p-space-sm flex items-center justify-between text-[12px]"><div class="flex items-center gap-1.5 ' + (g === 'failed' ? 'text-error' : 'text-on-surface-variant') + '">' + icon(/call/.test(ch) ? 'notifications' : 'chat_bubble', 'text-[15px] ' + (g === 'failed' ? '' : 'text-primary')) + '<span class="font-label-md">' + esc(stepLabel(r.step)) + ' · ' + esc(ch || 'whatsapp') + '</span></div><div class="flex items-center gap-1 font-label-sm ' + (g === 'queue' ? 'text-primary' : 'text-on-surface-variant') + '">' + icon(g === 'queue' ? 'hourglass_top' : 'schedule', 'text-[14px]') + '<span>' + esc(dayLabel(when) === fmtTime(when) ? 'Today ' + fmtTime(when) : fmtDay(when) + ' ' + fmtTime(when)) + '</span></div></div>' +
    '<div class="flex items-center justify-between pt-1">' + foot + '</div></div>';
}
function alertCard(a) {
  var sev = String(a.severity || '').toLowerCase(), open = a.status === 'open';
  var bar = !open ? 'bg-tertiary' : /crit|high|error/.test(sev) ? 'bg-error' : /warn|med/.test(sev) ? 'bg-secondary-container' : 'bg-primary-container';
  var ic = !open ? ['task_alt', 'text-tertiary'] : /crit|high|error/.test(sev) ? ['error_outline', 'text-error'] : ['schedule', 'text-secondary'];
  return '<div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-xs relative overflow-hidden transition-all hover:shadow-md"><div class="absolute left-0 top-0 bottom-0 w-1.5 ' + bar + '"></div><div class="pl-space-xs flex flex-col gap-space-xs"><div class="flex items-start justify-between gap-space-sm"><div class="flex items-start gap-2 min-w-0">' + icon(ic[0], ic[1] + ' text-[18px] shrink-0 mt-0.5') + '<div class="flex flex-col min-w-0"><p class="font-label-md text-label-md text-on-surface">' + esc(cap(a.kind)) + (a.lead_name ? ' · ' + esc(a.lead_name) : '') + ' — ' + esc(String(a.detail || '').slice(0, 220)) + '</p><span class="font-body-sm text-[11px] text-on-surface-variant mt-0.5">' + esc((a.created_dubai || fmtDay(a.created_at) + ' ' + fmtTime(a.created_at)) + ' · ' + cap(sev || 'info') + (a.notify_status ? ' · team ' + a.notify_status : '')) + '</span></div></div>' +
    (open ? '<button class="shrink-0 px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant font-label-sm text-[11px] hover:bg-error-container hover:text-error transition-colors" type="button" data-resolve="' + esc(a.id) + '">Mark resolved</button>' : '<span class="shrink-0 px-2 py-0.5 rounded-full font-label-sm text-[10px] bg-tertiary-fixed text-on-tertiary-fixed-variant flex items-center gap-1 font-bold"><span class="w-1.5 h-1.5 rounded-full bg-tertiary"></span>Resolved</span>') + '</div></div></div>';
}
var Reminders = { file: 'reminders', title: 'Reminders & Alerts', setup: function (root, arg) {
  var tr = $(root, '#tab-reminders'), ta = $(root, '#tab-alerts');
  S.remMain = arg === 'alerts' ? 'alerts' : 'reminders';
  if (tr) tr.addEventListener('click', function () { S.remMain = 'reminders'; Reminders.tabs(root); });
  if (ta) ta.addEventListener('click', function () { S.remMain = 'alerts'; Reminders.tabs(root); });
  var sync = $(root, 'main button .material-symbols-outlined'); $$(root, 'main button').forEach(function (b) { if (txt(b) === 'sync') b.addEventListener('click', function () { refresh(); toast('Refreshed', 'sync'); }); });
  var keys = ['queue', 'sent', 'skipped', 'failed']; $$(root, '.status-filter-btn').forEach(function (b, i) { b.setAttribute('data-rf', keys[i]); b.addEventListener('click', function () { S.remTab = keys[i]; Reminders.render(root); }); });
  var sr = $(root, '#section-reminders .px-margin.py-space-sm'); if (sr) { sr.innerHTML = loadingCard(); sr.addEventListener('click', function (e) { var rr = e.target.closest('[data-rretry]'); if (rr) { rr.disabled = true; rpc('app_retry_reminder', { p_reminder: rr.getAttribute('data-rretry') }).then(function (r) { var m = stMsg('rem', r); if (!m.ok) rr.disabled = false; toast(m.msg, m.s === 'requeued' ? 'refresh' : m.ok ? 'check_circle' : 'info'); refresh(); }).catch(function (er) { rr.disabled = false; toast(er.message || 'Retry failed', 'error'); }); } }); }
  var sa = $(root, '#section-alerts .px-margin.py-space-sm'); if (sa) sa.addEventListener('click', function (e) { var rb = e.target.closest('[data-resolve]'); if (rb) { rb.disabled = true; var aid = rb.getAttribute('data-resolve'); rpc('app_resolve_alert', { p_alert: /^\d+$/.test(aid) ? Number(aid) : aid, p_note: 'Resolved in app' }).then(function (r) { var m = stMsg('alert', r); if (!m.ok) rb.disabled = false; toast(m.msg, m.ok ? 'task_alt' : 'info'); refresh(); }).catch(function (er) { rb.disabled = false; toast(er.message || 'Not resolved', 'error'); }); } });
  var clr = byText(root, 'button', 'Clear resolved'); if (clr) clr.addEventListener('click', function () { S.showResolved = !S.showResolved; clr.textContent = S.showResolved ? 'Hide resolved' : 'Show resolved'; Reminders.render(root); });
  if (clr) clr.textContent = S.showResolved ? 'Hide resolved' : 'Show resolved';
  Reminders.tabs(root);
}, tabs: function (root) {
  var on = 'flex-1 py-2 px-space-md rounded-lg font-label-lg text-label-lg transition-all flex items-center justify-center gap-space-xs bg-primary-container text-on-primary shadow-sm', off = 'flex-1 py-2 px-space-md rounded-lg font-label-lg text-label-lg transition-all flex items-center justify-center gap-space-xs text-on-surface-variant hover:text-on-surface';
  var tr = $(root, '#tab-reminders'), ta = $(root, '#tab-alerts'); if (tr) tr.className = S.remMain === 'reminders' ? on : off; if (ta) ta.className = S.remMain === 'alerts' ? on : off;
  var sr = $(root, '#section-reminders'); if (sr) sr.classList.toggle('hidden', S.remMain === 'alerts');
}, refresh: async function (root, arg, rid) {
  var since = new Date(Date.now() - 7 * 864e5).toISOString();
  var res = await Promise.all([q('reminders', function (b) { return b.eq('is_current_plan', true).or('due_at.gte.' + since + ',done_at.gte.' + since).order('due_at', { ascending: false }).limit(500); }), q('alerts', function (b) { return b.order('created_at', { ascending: false }).limit(60); })]);
  if (stale(rid)) return; S.rem = res[0]; S.alerts = res[1]; S.openAlerts = res[1].filter(function (a) { return a.status === 'open'; }).length; Reminders.render(root);
}, render: function (root) {
  var rem = S.rem || [], al = S.alerts || [], t = today();
  var groups = { queue: [], sent: [], skipped: [], failed: [] }; rem.forEach(function (r) { groups[remGroup(r.status)].push(r); });
  groups.queue.sort(function (a, b) { return new Date(a.due_at) - new Date(b.due_at); });
  var tr = $(root, '#tab-reminders'); if (tr) { var c = $$(tr, 'span').pop(); if (c) c.textContent = groups.queue.length; }
  var open = al.filter(function (a) { return a.status === 'open'; }); var ta = $(root, '#tab-alerts'); if (ta) { var c2 = $$(ta, 'span').pop(); if (c2) { c2.textContent = open.length; c2.classList.toggle('hidden', !open.length); } }
  $$(root, '.status-filter-btn').forEach(function (b) { var k = b.getAttribute('data-rf'); var cnt = $$(b, 'span').pop(); if (cnt) cnt.textContent = groups[k].length; b.classList.toggle('ring-2', S.remTab === k); b.classList.toggle('ring-primary-container', S.remTab === k); });
  var soon = groups.queue.filter(function (r) { return new Date(r.due_at) - Date.now() < 36e5; }).length, late = groups.queue.filter(function (r) { return new Date(r.due_at) < Date.now() - 5 * 6e4; }).length;
  var as = byText(root, 'span', 'Auto-scheduler active') || byText(root, 'span', 'Reminder runner active'); if (as) { as.textContent = 'Reminder runner active'; var sub = as.nextElementSibling; if (sub) sub.textContent = soon + ' due in the next hour · ' + late + ' running late'; }
  var sr = $(root, '#section-reminders .px-margin.py-space-sm'); var list = groups[S.remTab];
  if (sr) sr.innerHTML = list.length ? list.slice(0, 100).map(remCard).join('') : emptyCard('alarm', 'Nothing here', S.remTab === 'queue' ? 'No reminders scheduled — they are created automatically for each booking' : 'No ' + S.remTab + ' reminders in the last 7 days');
  var wk = byText(root, 'h3', 'Watchdog', true); if (wk) { var res7 = al.filter(function (a) { return a.status !== 'open' && new Date(a.created_at) > Date.now() - 7 * 864e5; }).length, tot = res7 + open.length, pct = tot ? Math.round(100 * res7 / tot) : 100;
    wk.textContent = 'Watchdog — ' + open.length + ' open · ' + res7 + ' resolved (7 days)'; var card = wk.closest('.rounded-xl'); var pc = $(card, 'span.font-label-sm.text-tertiary.font-bold'); if (pc) pc.textContent = pct + '%'; var bar = $(card, '[style*="width"]'); if (bar) { bar.style.width = pct + '%'; bar.className = 'h-full rounded-full transition-all duration-500 ' + (open.length ? 'bg-secondary-container' : 'bg-tertiary-container'); }
    var foot = $$(card, '.text-\\[11px\\] > span'); if (foot[0]) foot[0].innerHTML = icon(open.length ? 'warning' : 'check_circle', 'text-[13px] ' + (open.length ? 'text-secondary' : 'text-tertiary')) + (open.length ? ' Needs attention' : ' All clear'); if (foot[1]) foot[1].innerHTML = icon('update', 'text-[13px] text-primary') + ' Updated ' + fmtTime(new Date()); }
  var sa = $(root, '#section-alerts .px-margin.py-space-sm'); if (sa) { var first = sa.firstElementChild; var shown = al.filter(function (a) { return S.showResolved || a.status === 'open'; }).slice(0, 25); $$(sa, ':scope > div').forEach(function (d, i) { if (i > 0) d.remove(); }); sa.insertAdjacentHTML('beforeend', shown.length ? shown.map(alertCard).join('') : emptyCard('verified', 'No alerts', 'The watchdog raises alerts here when something needs attention')); }
  var doneToday = rem.filter(function (r) { return r.done_at && dDate(r.done_at) === t; }).length, sent = groups.sent.length, failed = groups.failed.length, lateM = groups.sent.filter(function (r) { return r.done_at && r.due_at; }).map(function (r) { return Math.max(0, (new Date(r.done_at) - new Date(r.due_at)) / 6e4); });
  var stats = $$(root, '.font-kpi-metric-sm'); if (stats[0]) stats[0].textContent = doneToday; if (stats[1]) stats[1].textContent = (sent + failed ? (100 * sent / (sent + failed)).toFixed(1) : '100') + '%'; if (stats[2]) stats[2].textContent = (lateM.length ? (lateM.reduce(function (a, b) { return a + b; }, 0) / lateM.length).toFixed(1) : '0') + 'm';
  var lbl = $$(root, '.font-kpi-metric-sm + span'); if (lbl[2]) lbl[2].textContent = 'Avg delay';
  Reminders.tabs(root);
} };

/* =====================================================================
   SETTINGS
   ===================================================================== */
var TPL = { booking_link: 'booking-link', booking_confirmed: 'confirmation', reminder_24h: 'day-before', reminder_3h: 'short-reminder', missed_rebook: 'missed-sorry', team_new_booking: 'team-booked' };
function switchHtml(on) { return '<button aria-checked="' + on + '" class="w-10 h-6 ' + (on ? 'bg-primary-container' : 'bg-surface-variant') + ' rounded-full p-0.5 transition-colors relative flex items-center shrink-0 cursor-pointer shadow-inner" role="switch" type="button"><span class="toggle-knob ' + (on ? 'translate-x-4' : 'translate-x-0') + ' inline-block w-5 h-5 rounded-full bg-surface-container-lowest shadow-md transform transition-transform"></span></button>'; }
function connHtml(ic, box, name, sub, ok, label, when) { return '<div class="p-space-sm rounded-lg bg-surface-container-low/60 flex items-center justify-between"><div class="flex items-center gap-space-sm min-w-0"><div class="w-9 h-9 rounded-lg ' + box + ' flex items-center justify-center shrink-0">' + icon(ic, 'text-[20px]') + '</div><div class="flex flex-col truncate"><span class="font-label-md text-on-surface truncate">' + esc(name) + '</span><span class="font-body-sm text-on-surface-variant truncate">' + esc(sub) + '</span></div></div><div class="flex flex-col items-end shrink-0"><span class="inline-flex items-center gap-1 font-label-sm ' + (ok ? 'text-tertiary' : 'text-on-surface-variant') + ' font-bold"><span class="w-2 h-2 rounded-full ' + (ok ? 'bg-tertiary animate-pulse' : 'bg-outline-variant') + '"></span> ' + esc(label) + '</span><span class="text-[11px] text-on-surface-variant font-label-sm">' + esc(when || '') + '</span></div></div>'; }
var Settings = { file: 'settings', title: 'Settings', setup: function (root) {
  root.addEventListener('click', async function (e) {
    var sw = e.target.closest('button[role="switch"]'); if (!sw) return; e.preventDefault(); e.stopPropagation();
    var on = sw.getAttribute('aria-checked') === 'true', sec = sw.closest('section'), patch = null;
    var lab = txt(sw.parentElement && sw.parentElement.querySelector('span.font-body-md'));
    if (sec && byText(sec, 'span', 'Test mode')) { if (S.me && S.me.can_change_test_mode === false) { toast(ST_MSG.set.owner_only, 'lock'); return; } patch = { test_mode: !on }; }
    else { var KEY = { 'Booking link': 'booking_link', 'Booking confirmation': 'confirmation', '24h before reminder': 'day_before', '3h before reminder': 'short_reminder', 'Meeting start message': 'meeting_start', 'Missed-visit follow-up': 'follow_up', 'Team alerts to 2521 & 786': 'team_copies' }[lab]; if (KEY) { patch = { steps: {} }; patch.steps[KEY] = { enabled: !on }; } }
    if (!patch) { toast('This switch is not linked to a setting', 'info'); return; }
    sw.disabled = true;
    try { var m = stMsg('set', await rpc('app_update_settings', { p_patch: patch })); toast(m.msg, m.ok ? 'check_circle' : 'lock'); refresh(); }
    catch (er) { toast(er.message || 'Not saved', 'error'); } finally { sw.disabled = false; }
  }, true);
  var inv = $$(root, 'button').filter(function (b) { return /Invite member/.test(txt(b)); })[0]; if (inv) inv.addEventListener('click', function () { toast('Admin adds team logins in Supabase Auth + the team list', 'person_add'); });
  $$(root, 'button').filter(function (b) { return /Sign out/.test(txt(b)); }).forEach(function (b) { b.addEventListener('click', signOut); });
  var chk = $$(root, 'button').filter(function (b) { return /Check all/.test(txt(b)); })[0]; if (chk) chk.addEventListener('click', function () { refresh(); toast('Checked', 'sync'); });
  var ver = byText(root, 'span', 'FEFCO SOLUTIONS App v2.4.1'); if (ver) ver.textContent = 'FEFCO SOLUTIONS ' + VERSION;
  var gm = byText(root, 'span', 'Live System Control'); if (gm) gm.textContent = 'Live system';
  var hd = byText(root, 'span', 'Settings & Dispatch Rules'); if (hd) hd.textContent = 'Settings';
  var ra = byText(root, 'span', 'Reminders & Automation'); if (ra) { ra.textContent = 'Reminders (WhatsApp)'; var sub = ra.nextElementSibling; if (sub) sub.textContent = 'Customer + team alerts to 2521 & 786'; }
  var cx = byText(root, 'span', 'System Connections'); if (cx) cx.textContent = 'Connections';
  var w786 = byText(root, 'p', 'Click-to-WhatsApp ads triage · inbound lead queue', true); if (w786) w786.lastChild.textContent = ' Click-to-WhatsApp ads';
  var api = byText(root, 'span', 'WhatsApp API — Official Meta Cloud'); if (api) api.textContent = 'WhatsApp API line';
}, refresh: async function (root, arg, rid) {
  await loadSettings();
  var res = await Promise.all([q('calls', function (b) { return b.order('occurred_at', { ascending: false }).limit(1); }), q('reminders', function (b) { return b.not('done_at', 'is', null).order('done_at', { ascending: false }).limit(1); }), q('meetings', function (b) { return b.not('external_ref', 'is', null).order('updated_at', { ascending: false }).limit(1); }), q('leads', function (b) { return b.not('odoo_synced_at', 'is', null).order('odoo_synced_at', { ascending: false }).limit(1); }), q('ad_performance', function (b) { return b.limit(1); }), q('leads', function (b) { return b.in('source', ['meta-form', 'meta-call']).limit(1); })]);
  if (stale(rid)) return; var s = S.settings || {}, pub = s.pub || {}, steps = pub.reminder_steps || {};
  var tm = byText(root, 'span', 'Test mode'); if (tm) { var sec = tm.closest('section'); var sw = $(sec, 'button[role="switch"]'); if (sw) { sw.className = 'w-12 h-7 ' + (s.test_mode ? 'bg-primary-container' : 'bg-surface-variant') + ' rounded-full p-0.5 transition-colors relative flex items-center shrink-0 cursor-pointer shadow-inner focus:outline-none'; sw.setAttribute('aria-checked', String(!!s.test_mode)); var tmLock = !!(S.me && S.me.can_change_test_mode === false); sw.disabled = tmLock; sw.classList.toggle('opacity-40', tmLock); sw.classList.toggle('cursor-not-allowed', tmLock); sw.title = tmLock ? 'Only the owner or an admin can change test mode' : ''; var k = $(sw, '.toggle-knob'); if (k) { k.classList.toggle('translate-x-5', !!s.test_mode); k.classList.toggle('translate-x-0', !s.test_mode); } }
    var p = $(sec, 'p'); if (p) p.innerHTML = s.test_mode ? 'Messages and calls go only to <span class="font-semibold text-on-surface">test numbers</span>' + (pub.test_contacts_count ? ' (' + pub.test_contacts_count + ')' : '') + ' and admin devices. Live clients are untouched.' : 'LIVE: messages go to real customers.'; var sbx = byText(sec, 'span', 'Sandbox') || byText(sec, 'span', 'ON') || byText(sec, 'span', 'OFF'); if (sbx) sbx.textContent = s.test_mode ? 'ON' : 'OFF'; }
  // team
  var th = byText(root, 'span', 'Team members'); if (th) { var card = th.closest('section'), team = (s.team || []).filter(function (m) { return m.active !== false; }), cnt = th.nextElementSibling; if (cnt) cnt.textContent = team.length; var list = $(card, '.flex.flex-col.gap-space-sm');
    if (list) list.innerHTML = team.length ? team.map(function (m) { var r = String(m.role || 'team').toLowerCase(), rc = /owner/.test(r) ? 'bg-primary-fixed text-on-primary-fixed-variant' : /admin/.test(r) ? 'bg-surface-variant text-on-surface' : 'bg-surface-container-highest text-on-surface-variant';
      var btn = function (ok, href, ic, cls, lab) { return ok ? '<a aria-label="' + lab + '" class="w-9 h-9 rounded-lg flex items-center justify-center ' + cls + ' transition-colors" href="' + esc(href) + '"' + (/^https/.test(href) ? ' target="_blank" rel="noopener"' : '') + '>' + icon(ic, 'text-[18px]') + '</a>' : '<span class="w-9 h-9 flex items-center justify-center opacity-30 text-outline">' + icon('block', 'text-[18px]') + '</span>'; };
      return '<div class="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low/70"><div class="flex items-center gap-space-sm min-w-0"><div class="relative shrink-0"><div class="w-11 h-11 rounded-full ' + (/owner/.test(r) ? 'bg-primary-fixed text-primary' : 'bg-surface-container-high text-on-surface') + ' flex items-center justify-center font-headline-sm">' + esc(initials(m.name)) + '</div><span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ' + (m.has_login ? 'bg-tertiary-container' : 'bg-surface-variant') + ' rounded-full ring-2 ring-surface-container-lowest"></span></div><div class="flex flex-col min-w-0 truncate"><div class="flex items-center gap-space-xs"><span class="font-label-lg text-on-surface truncate">' + esc(m.name || m.email) + '</span><span class="px-2 py-0.5 rounded-full font-label-sm ' + rc + '">' + esc(cap(r)) + '</span></div><span class="font-body-sm text-on-surface-variant truncate">' + esc(m.whatsapp || m.email || '') + (m.has_login ? '' : ' · no app login yet') + '</span></div></div><div class="flex items-center gap-1 shrink-0">' + btn(!!m.whatsapp, waLink(m.whatsapp), 'chat', 'bg-tertiary/10 text-tertiary hover:bg-tertiary/20', 'WhatsApp') + btn(!!m.whatsapp, telLink(m.whatsapp), 'call', 'bg-primary-container/10 text-primary-container hover:bg-primary-container/20', 'Call') + btn(!!m.email, 'mailto:' + (m.email || ''), 'mail', 'bg-surface-variant/60 text-on-surface-variant hover:bg-surface-variant', 'Email') + '</div></div>'; }).join('') : emptyCard('group', 'No team members', 'Add team members to fefco_team_members'); }
  // numbers: WhatsApp API line
  var api = byText(root, 'span', 'WhatsApp API line'); if (api) { var chip = api.nextElementSibling; if (chip && !s.whatsapp_api_connected) { chip.className = 'px-2 py-0.5 rounded-full font-label-sm bg-secondary-fixed text-on-secondary-fixed-variant font-bold flex items-center gap-1'; chip.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-secondary"></span> Pending number'; } }
  // reminders: WhatsApp only
  var ra = byText(root, 'span', 'Reminders (WhatsApp)'); if (ra) { var rsec = ra.closest('section'), rl = $(rsec, '.flex.flex-col.gap-space-xs'), en = function (k) { return !steps[k] || steps[k].enabled !== false; };
    var rows = [['add_link', 'bg-primary-fixed/60 text-primary', 'Booking link', en('booking_link')], ['done_all', 'bg-primary-fixed/60 text-primary', 'Booking confirmation', en('confirmation')], ['schedule', 'bg-surface-container text-on-surface', '24h before reminder', en('day_before')], ['alarm', 'bg-surface-container text-on-surface', '3h before reminder', en('short_reminder')], ['play_circle', 'bg-secondary-fixed/50 text-on-secondary-fixed', 'Meeting start message', en('meeting_start')], ['event_repeat', 'bg-surface-variant text-on-surface-variant', 'Missed-visit follow-up', en('follow_up')], ['emergency_share', 'bg-tertiary-container/30 text-tertiary', 'Team alerts to 2521 & 786', en('team_copies')]];
    if (rl) rl.innerHTML = rows.map(function (r) { return '<div class="flex items-center justify-between py-2 px-space-xs rounded-lg hover:bg-surface-container-low transition-colors"><div class="flex items-center gap-space-sm"><div class="w-8 h-8 rounded-full ' + r[1] + ' flex items-center justify-center">' + icon(r[0], 'text-[18px]') + '</div><span class="font-body-md text-on-surface">' + esc(r[2]) + '</span></div>' + switchHtml(r[3]) + '</div>'; }).join('');
    var lk = $(rsec, '.bg-surface-container-high\\/60 p'); if (lk && s.calling_from != null) { var h12 = function (h) { return (h % 12 || 12) + ':00 ' + (h < 12 ? 'AM' : 'PM'); }; lk.innerHTML = '<span class="font-semibold text-on-surface">Messages ' + h12(s.calling_from) + ' – ' + h12(s.calling_until) + ' (UAE rule)</span> — anything outside this window waits until the next morning.'; } }
  // templates
  $$(root, 'span.font-mono').forEach(function (sp) { var key = TPL[txt(sp)]; if (!key) return; var v = (s.templates || {})[key]; var chip = sp.closest('.flex.items-center.justify-between').lastElementChild; if (!chip) return;
    if (v === true) { chip.className = 'px-2.5 py-0.5 rounded-full font-label-sm bg-tertiary/15 text-tertiary font-bold shrink-0 flex items-center gap-1'; chip.innerHTML = icon('check_circle', 'text-[13px]') + ' Approved'; }
    else if (v === false) { chip.className = 'px-2.5 py-0.5 rounded-full font-label-sm bg-secondary-container/50 text-on-secondary-container font-bold shrink-0 flex items-center gap-1'; chip.innerHTML = icon('hourglass_empty', 'text-[13px]') + ' Pending review'; }
    else { chip.className = 'px-2.5 py-0.5 rounded-full font-label-sm bg-surface-container-high text-on-surface-variant font-bold shrink-0 flex items-center gap-1'; chip.innerHTML = icon('remove_circle_outline', 'text-[13px]') + ' Not set up'; } });
  // connections
  var cx = byText(root, 'span', 'Connections'); if (cx) { var grid = $(cx.closest('section'), '.grid'); var v = pub.vapi || {}, od = res[3][0], o = s.odoo || {};
    if (grid) grid.innerHTML = connHtml('database', 'bg-tertiary/10 text-tertiary', 'Supabase', 'Database · master CRM', true, 'Connected', fmtTime(new Date())) +
      connHtml('schema', 'bg-tertiary/10 text-tertiary', 'n8n', 'Automation workflows', true, 'Running', res[1][0] ? 'Last run ' + rel(res[1][0].done_at) : '') +
      connHtml('graphic_eq', 'bg-primary-fixed text-primary', 'Vapi — Sara inbound', 'Answers unanswered calls on 2521', !!v.inbound_enabled, v.inbound_enabled ? 'Connected' : 'Not set up', res[0][0] ? 'Last call ' + rel(res[0][0].occurred_at) : 'No calls yet') +
      connHtml('calendar_month', 'bg-secondary-fixed/50 text-secondary', 'Google Calendar', 'Team bookings', !!res[2][0], res[2][0] ? 'Connected' : 'Not linked', res[2][0] ? rel(res[2][0].updated_at) : '') +
      connHtml('campaign', 'bg-surface-variant text-on-surface', 'Meta Ads & Lead forms', 'Call ads, Instant Forms, ad stats', !!(res[4].length || res[5].length), res[4].length ? 'Connected' : res[5].length ? 'Leads live' : 'Pending', res[4].length ? 'Ad stats syncing' : 'Ad stats pending') +
      connHtml('chat', 'bg-tertiary/10 text-tertiary', 'WhatsApp API', 'Booking links, confirmations & reminders', !!s.whatsapp_api_connected, s.whatsapp_api_connected ? 'Connected' : 'Pending number', '') +
      connHtml('receipt_long', 'bg-primary-container/10 text-primary-container', 'Odoo CRM — Email sync, one-way', 'Each new lead is emailed to Odoo', !!(o.enabled || od), o.enabled || od ? 'Connected' : 'Pending', od ? 'Last sent ' + rel(od.odoo_synced_at) : ''); }
} };

/* ---------- add lead sheet (dash.add_lead) — built from Stitch filter-sheet + login field classes ---------- */
var INP = 'w-full min-h-[48px] px-3.5 py-3 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none transition-all duration-150';
function fieldHtml(label, inner) { return '<div class="flex flex-col gap-1.5"><label class="font-label-md text-label-md text-on-surface-variant">' + label + '</label>' + inner + '</div>'; }
function openAddLead() {
  closeOverlays();
  var ov = document.createElement('div'); ov.setAttribute('data-overlay', '1');
  ov.className = 'fixed inset-0 bg-[#1F2937]/35 backdrop-blur-[2px] transition-opacity duration-300 z-[60] flex flex-col justify-end';
  var opts = function (arr) { return arr.map(function (x) { return '<option value="' + esc(x[0]) + '">' + esc(x[1]) + '</option>'; }).join(''); };
  ov.innerHTML = '<div class="w-full bg-surface-container-lowest rounded-t-[24px] shadow-[0_-8px_30px_rgba(255,138,0,0.12),0_-4px_16px_rgba(31,41,55,0.08)] flex flex-col max-h-[92vh] overflow-hidden pb-safe"><div class="w-full flex justify-center pt-space-sm pb-space-xs cursor-grab" data-close><div class="w-12 h-1.5 rounded-full bg-surface-variant"></div></div>' +
    '<div class="px-margin pt-space-xs pb-space-md flex items-center justify-between shrink-0"><h2 class="font-headline-md text-on-surface">Add lead</h2><button class="h-11 px-space-sm inline-flex items-center justify-center font-label-lg text-primary-container" type="button" data-close>Cancel</button></div>' +
    '<form class="flex-1 overflow-y-auto px-margin space-y-space-md pb-space-xl" id="add-lead-form">' +
    fieldHtml('Phone (with country code)', '<input class="' + INP + '" name="phone" type="tel" required placeholder="+971 50 123 4567" autocomplete="off"/>') +
    fieldHtml('Name', '<input class="' + INP + '" name="name" type="text" placeholder="Customer name"/>') +
    '<div class="grid grid-cols-2 gap-space-sm">' + fieldHtml('Area', '<input class="' + INP + '" name="area" list="area-list" placeholder="Arabian Ranches"/><datalist id="area-list">' + AREAS.map(function (a) { return '<option value="' + a + '">'; }).join('') + '</datalist>') +
    fieldHtml('Service', '<select class="' + INP + '" name="service"><option value="">Select…</option>' + opts(Object.keys(SERVICE_RX).map(function (k) { return [k, k]; })) + '</select>') + '</div>' +
    fieldHtml('Source', '<select class="' + INP + '" name="source">' + opts([['manual', 'Team-added'], ['meta-call', 'Call ad · 2521'], ['meta-form', 'Instant Form'], ['whatsapp', 'WhatsApp ad · 786'], ['website-form', 'Website'], ['booking-page', 'Booking page'], ['social-dm', 'Instagram / social DM']]) + '</select>') +
    fieldHtml('Email (optional)', '<input class="' + INP + '" name="email" type="email" placeholder="name@example.com"/>') +
    fieldHtml('Note', '<textarea class="' + INP + ' min-h-[80px]" name="note" placeholder="What does the customer need?"></textarea>') +
    '<label class="relative flex items-center justify-between gap-2.5 cursor-pointer select-none py-1"><span class="font-label-md text-label-md text-on-surface">Send welcome WhatsApp &amp; follow up automatically</span><span class="relative inline-flex items-center"><input class="sr-only peer" name="auto" type="checkbox"/><div class="w-11 h-6 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:bg-tertiary-container transition-colors"></div></span></label>' +
    '<p class="hidden font-body-sm text-error" id="add-lead-msg"></p></form>' +
    '<div class="p-margin bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.03)] shrink-0"><button class="w-full h-12 bg-primary-container active:scale-[0.98] transition-all rounded-xl text-on-primary font-headline-sm flex items-center justify-center gap-space-xs shadow-[0_4px_16px_rgba(255,138,0,0.24)]" form="add-lead-form" type="submit">' + icon('person_add', 'text-[20px]') + '<span>Save lead</span></button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-close]')) ov.remove(); });
  var form = $(ov, '#add-lead-form'), msg = $(ov, '#add-lead-msg');
  form.addEventListener('submit', async function (e) {
    e.preventDefault(); var fd = new FormData(form), p = {};
    ['phone', 'name', 'email', 'area', 'service', 'source', 'note'].forEach(function (k) { var v = String(fd.get(k) || '').trim(); if (v) p[k] = v; });
    p.auto_follow_up = !!fd.get('auto');
    var btn = $(ov, 'button[type=submit]'); btn.disabled = true;
    try { var r = await rpc('add_lead', { p: p }) || {}; if (r.ok === false) throw new Error(r.error || 'Lead not saved');
      ov.remove(); toast('Lead saved' + (p.auto_follow_up && S.settings && S.settings.test_mode ? ' (test mode: messages go to test numbers)' : ''), 'person_add'); S.leadsAll = null;
      var id = r.lead_id || r.id; if (id) go('#/lead/' + id); else refresh();
    } catch (er) { msg.textContent = er.message || 'Lead not saved'; msg.classList.remove('hidden'); btn.disabled = false; }
  });
}

/* ---------- install sheet ---------- */
async function openInstall() {
  closeOverlays(); var frag = await screenFrag('install'); var bd = $(frag, '#installBackdrop'), sh = $(frag, '#installSheet'); if (!bd || !sh) return;
  var wrap = document.createElement('div'); wrap.setAttribute('data-overlay', '1'); wrap.appendChild(bd); wrap.appendChild(sh); bd.classList.add('z-[70]'); sh.classList.add('z-[71]'); document.body.appendChild(wrap);
  function close() { wrap.remove(); }
  bd.addEventListener('click', close); $(sh, '#btnDismiss').addEventListener('click', function () { sset('fefco_install_dismissed', String(Date.now())); close(); });
  var help = $(sh, '.bg-\\[\\#f0f9ff\\]'); if (help && !isIOS()) help.classList.add('hidden');
  if (isStandalone()) { $$(sh, '#btnInstall span').pop().textContent = 'Already installed'; }
  $(sh, '#btnInstall').addEventListener('click', async function () {
    if (S.deferredPrompt) { S.deferredPrompt.prompt(); try { var c = await S.deferredPrompt.userChoice; if (c && c.outcome === 'accepted') toast('Installing FEFCO SOLUTIONS…', 'download'); } catch (e) {} S.deferredPrompt = null; close(); }
    else if (isIOS()) { if (help) help.classList.remove('hidden'); toast('On iPhone: Share → Add to Home Screen', 'ios_share'); }
    else toast(isStandalone() ? 'Already installed' : 'Use the browser menu → "Install app" / "Add to Home screen"', 'install_mobile');
  });
}
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.deferredPrompt = e; });
window.addEventListener('appinstalled', function () { toast('FEFCO SOLUTIONS installed', 'task_alt'); });

/* ---------- auth & routing ---------- */
async function signOut() { try { await sb.auth.signOut(); } catch (e) {} S.session = null; S.me = null; S.settings = null; S.leadsAll = null; go('#/login'); }
var ROUTES = { login: Login, home: Home, leads: Leads, lead: LeadDetail, calls: Calls, whatsapp: WhatsApp, chat: Chat, bookings: Bookings, agents: Agents, ads: Ads, more: More, reminders: Reminders, settings: Settings };
function parseHash() { var h = location.hash.replace(/^#\/?/, ''); if (/access_token=|error_description=|type=recovery/.test(h)) return { name: '__auth' }; var parts = h.split('/'); return { name: parts[0] || 'home', arg: parts.slice(1).join('/') ? decodeURIComponent(parts.slice(1).join('/')) : '' }; }
var routing = false;
async function route() {
  var r = parseHash(); if (r.name === '__auth') return;
  if (routing) { setTimeout(route, 50); return; } routing = true;
  try {
    if (!S.session) { await mount(Login); return; }
    if (!S.me) { try { S.me = (await rpc('me')) || { is_team: false }; } catch (e) { S.me = { is_team: false, error: e.message }; } }
    if (!S.me.is_team) { await mount(Login); return; }
    if (!S.settings) { await loadSettings(); await loadGlobals(); }
    if (r.name === 'login') { location.replace('#/home'); return; }
    var def = ROUTES[r.name] || Home; await mount(def, r.arg);
  } catch (e) { console.error(e); toast(e.message || 'Something went wrong', 'error'); }
  finally { routing = false; }
}
async function tick() { if (document.hidden || !S.session || !S.me || !S.me.is_team || !S.ctl || S.ctl === Login) return; await loadGlobals(); wireBadges(); refresh(); }
function wireBadges() { var app = $(document, '#app'); var bell = $(app, 'header button[aria-label="Notifications"] span.absolute'); if (bell) { bell.textContent = String(S.openAlerts); bell.classList.toggle('hidden', !S.openAlerts); } }

async function boot() {
  if ('serviceWorker' in navigator && self.origin !== 'null') { navigator.serviceWorker.register(FILE('sw.js'), { scope: window.FEFCO_SW_SCOPE || './' }).catch(function (e) { console.warn('SW not registered:', e.message); }); }
  sb.auth.onAuthStateChange(function (ev, session) {
    S.session = session;
    if (ev === 'PASSWORD_RECOVERY') { S.recovery = true; location.hash = '#/login'; setTimeout(route, 0); }
    if (ev === 'SIGNED_OUT') { S.me = null; }
  });
  try { var r = await sb.auth.getSession(); S.session = r.data.session; } catch (e) { S.session = null; }
  if (/access_token=|type=recovery/.test(location.hash)) { history.replaceState(null, '', location.pathname + location.search + (S.recovery ? '#/login' : '#/home')); }
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  setInterval(tick, POLL_MS);
  route();
}
boot();
})();
