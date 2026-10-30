/* =====================================================================
   PING MESSENGER  v1.0.0.0.1
   Appwrite backend · end-to-end encryption · WebRTC (P2P chat + calls)
   ===================================================================== */
(function () {
'use strict';

/* ------------------------------ CONFIG ------------------------------ */
const CFG = {
    endpoint: 'https://fra.cloud.appwrite.io/v1',
    project: '6ae1b2bc002257e5e2c2',
    database: '6ae1dd530001060d264b',
    // NOTE: Users table ID aur Database ID aapne same bheje the (6ae1dd930022f00a4480).
    // Agar aapka asli Users table ID alag hai to yahan badal do. setup-appwrite.mjs chalane par
    // ye table is ID se khud ban jati hai.
    tables: { users: '6ae1dd930022f00a4480', messages: '6ae1df41000faeef7c09', stories: '6ae1e29f000f611ba1e0' },
    bucket: '6ae1e1b90017e95db195',
    sdk: ['https://cdn.jsdelivr.net/npm/appwrite@16.0.2/dist/iife/sdk.js', 'https://unpkg.com/appwrite@16.0.2/dist/iife/sdk.js'],
    country: '+91',
    ringSec: 45, storyHours: 24, noteHours: 24,
    maxServerFileMB: 40, maxP2PFileMB: 1024,
    version: '1.0.0.0.1'
};
const TURN_USER = 'openrelayproject', TURN_PASS = 'openrelayproject';
const ICE = {
    iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302', 'stun:global.stun.twilio.com:3478', 'stun:stun.cloudflare.com:3478'] },
        { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp', 'turns:openrelay.metered.ca:443?transport=tcp'], username: TURN_USER, credential: TURN_PASS }
    ],
    iceCandidatePoolSize: 2
};
const REACTS = ['❤️', '😊', '😡', '😭', '😔', '😂', '👍'];
const EMOJIS = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','🙂','😉','😍','🥰','😘','😗','😋','😜','🤪','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','😶','😐','😑','😬','🙄','😯','😲','😴','🤤','😪','😷','🤒','🤕','🤢','🤮','🥴','😇','🤠','🤡','👻','💀','👽','🤖','💩','🙈','🙉','🙊','👍','👎','👌','✌️','🤞','🤟','🤘','👏','🙌','🙏','💪','👋','🤝','👀','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❣️','💕','💞','💓','💗','💖','💘','💝','🔥','✨','⭐','🌟','🎉','🎊','🎁','🎂','🍕','🍔','🍟','☕','🍫','🌹','🌸','🌈','☀️','🌙','⚡','💯','✅','❌','❓','❗'];
const SLICE = 4 * 1024 * 1024, CHUNK = 64 * 1024;

/* ------------------------------ HELPERS ------------------------------ */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uid = () => { const b = crypto.getRandomValues(new Uint8Array(10)); return Array.from(b, x => x.toString(36).padStart(2, '0')).join('').slice(0, 18); };
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
const fmtTime = ts => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dayKey = ts => { const d = new Date(ts); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); };
function dayLabel(ts) {
    const now = Date.now();
    if (dayKey(ts) === dayKey(now)) return 'Today';
    if (dayKey(ts) === dayKey(now - 864e5)) return 'Yesterday';
    return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}
function listTime(ts) {
    if (!ts) return '';
    if (dayKey(ts) === dayKey(Date.now())) return fmtTime(ts);
    if (dayKey(ts) === dayKey(Date.now() - 864e5)) return 'Yesterday';
    return new Date(ts).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fmtSize(b) { if (!b) return ''; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(0) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }
function fmtDur(ms) { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function durText(ms) { const s = Math.round(ms / 1000); if (s < 60) return Math.max(1, s) + ' sec'; const m = Math.floor(s / 60), x = s % 60; return m + ' min' + (x ? ' ' + x + ' sec' : ''); }
function extOf(type) {
    if (type.includes('mp4')) return type.startsWith('audio') ? 'm4a' : 'mp4';
    if (type.includes('ogg')) return 'ogg'; if (type.includes('webm')) return 'webm'; if (type.includes('mpeg')) return 'mp3';
    return 'bin';
}
function toast(t) {
    const el = document.createElement('div'); el.className = 'rd-toast'; el.textContent = t;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const utf8 = s => new TextEncoder().encode(s);
const unutf8 = u => new TextDecoder().decode(u);
const normUser = s => String(s || '').trim().replace(/^@+/, '').toLowerCase();
const validUser = s => /^[a-z0-9_.]{3,24}$/.test(s) && !/^[._]|[._]$|\.\./.test(s);
const hue = s => { let x = 0; for (const c of String(s || '')) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % 360; };
const vib = p => { try { if (navigator.vibrate && S.set.vibrate !== false) navigator.vibrate(p); } catch (e) {} };

// tiny event bus
const BUS = {};
const on = (n, f) => { (BUS[n] = BUS[n] || []).push(f); };
const emit = (n, ...a) => (BUS[n] || []).forEach(f => { try { f(...a); } catch (e) { console.error('[' + n + ']', e); } });

/* ------------------------------ ICONS ------------------------------ */
const ICONS = {
    back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
    'video-off': '<path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    more: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
    'mic-off': '<line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    file: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    undo: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    forward: '<polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>',
    reply: '<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    screen: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    flip: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    'bell-off': '<path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
    pin: '<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    bot: '<rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><circle cx="9" cy="14" r="1.2"/><circle cx="15" cy="14" r="1.2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
    p2p: '<path d="M3 8h15M14 4l4 4-4 4"/><path d="M21 16H6M10 12l-4 4 4 4"/>',
    volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
    'volume-x': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
    'arr-in': '<line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/>',
    'arr-out': '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    chev: '<polyline points="9 18 15 12 9 6"/>',
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    status: '<circle cx="12" cy="12" r="9" stroke-dasharray="3.2 3.2"/><circle cx="12" cy="12" r="3.2"/>',
    mail: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".6"/><circle cx="17.5" cy="10.5" r=".6"/><circle cx="8.5" cy="7.5" r=".6"/><circle cx="6.5" cy="12.5" r=".6"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.12a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    paperclip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>'
};
function ic(n, s) {
    s = s || 22;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[n] || '') + '</svg>';
}
const TICK = {
    pending: '<svg class="rd-tick" viewBox="0 0 16 16" width="15" height="15"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.2 1.4"/></svg>',
    sent: '<svg class="rd-tick" viewBox="0 0 16 11" width="16" height="11"><path d="M1.5 5.5l3.5 3.5L12 2"/></svg>',
    delivered: '<svg class="rd-tick" viewBox="0 0 18 11" width="18" height="11"><path d="M1.5 5.5l3.5 3.5L12 2"/><path d="M7 8.5l1 .9L16 2"/></svg>',
    seen: '<svg class="rd-tick seen" viewBox="0 0 18 11" width="18" height="11"><path d="M1.5 5.5l3.5 3.5L12 2"/><path d="M7 8.5l1 .9L16 2"/></svg>',
    failed: '<svg class="rd-tick fail" viewBox="0 0 16 16" width="15" height="15"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5M8 11v.01"/></svg>'
};
const RANK = { pending: 0, sent: 1, delivered: 2, seen: 3 };
const RANKN = ['pending', 'sent', 'delivered', 'seen'];

/* ------------------------------ GLOBAL STATE ------------------------------ */
const S = {
    me: null, ident: null, online: navigator.onLine,
    contacts: new Map(), chats: new Map(), bots: new Map(),
    msgs: [], byId: new Map(), byChat: new Map(),
    stories: [], seenStories: {}, set: {}, cur: null, tab: 'chats'
};
const DEFAULT_SET = { theme: 'auto', sound: true, vibrate: true, notif: true, preview: true, readReceipts: true, showLastSeen: true, typing: true, wall: { id: 'doodle', dim: 0 }, enterSend: false };
S.set = Object.assign({}, DEFAULT_SET);

/* ------------------------------ ASSETS ------------------------------ */
const AVATAR = 'data:image/webp;base64,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';
const ICON192 = 'data:image/webp;base64,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';

/* ------------------------------ CRYPTO (E2E) ------------------------------ */
const CR = (function () {
  const SUB = crypto.subtle;
  const EC = { name: 'ECDH', namedCurve: 'P-256' };

  async function genIdentity() {
    const kp = await SUB.generateKey(EC, false, ['deriveBits']); // public key is always exportable
    const raw = new Uint8Array(await SUB.exportKey('raw', kp.publicKey));
    return { priv: kp.privateKey, pub: b64(raw) };
  }

  async function aesFrom(bits, salt, info) {
    const base = await SUB.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
    return SUB.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: utf8(info) }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  // ctx = { sender, rcpt, mid, ts }
  const infoOf = (c) => 'ping/v1|' + c.sender + '|' + c.rcpt;
  const aadOf = (c) => utf8(c.mid + '|' + c.sender + '|' + c.rcpt + '|' + c.ts);

  const cat = (a, b) => { const o = new Uint8Array(a.byteLength + b.byteLength); o.set(new Uint8Array(a), 0); o.set(new Uint8Array(b), a.byteLength); return o; };
  const imp = (b64) => SUB.importKey('raw', unb64(b64), EC, false, []);

  // 2-DH: ephemeral->recipient (fresh key per message) + sender identity->recipient (authenticates the sender)
  async function seal(senderPriv, rcptPubB64, obj, ctx) {
    const eph = await SUB.generateKey(EC, true, ['deriveBits']);
    const ephRaw = new Uint8Array(await SUB.exportKey('raw', eph.publicKey));
    const rpub = await imp(rcptPubB64);
    const d1 = await SUB.deriveBits({ name: 'ECDH', public: rpub }, eph.privateKey, 256);
    const d2 = await SUB.deriveBits({ name: 'ECDH', public: rpub }, senderPriv, 256);
    const key = await aesFrom(cat(d1, d2), ephRaw, infoOf(ctx));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await SUB.encrypt({ name: 'AES-GCM', iv, additionalData: aadOf(ctx) }, key, utf8(JSON.stringify(obj))));
    return b64(ephRaw) + '.' + b64(iv) + '.' + b64(ct);
  }

  async function open(rcptPriv, senderPubB64, envelope, ctx) {
    const [e, i, c] = String(envelope).split('.');
    if (!e || !i || !c) throw new Error('bad envelope');
    const ephRaw = unb64(e);
    const d1 = await SUB.deriveBits({ name: 'ECDH', public: await SUB.importKey('raw', ephRaw, EC, false, []) }, rcptPriv, 256);
    const d2 = await SUB.deriveBits({ name: 'ECDH', public: await imp(senderPubB64) }, rcptPriv, 256);
    const key = await aesFrom(cat(d1, d2), ephRaw, infoOf(ctx));
    const pt = await SUB.decrypt({ name: 'AES-GCM', iv: unb64(i), additionalData: aadOf(ctx) }, key, unb64(c));
    return JSON.parse(unutf8(new Uint8Array(pt)));
  }

  // ---- files ----
  async function sealBlob(blob) {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await SUB.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
    const ct = await SUB.encrypt({ name: 'AES-GCM', iv }, key, await blob.arrayBuffer());
    return { blob: new Blob([ct], { type: 'application/octet-stream' }), key: b64(raw), iv: b64(iv) };
  }
  async function openBlob(buf, keyB64, ivB64, mime) {
    const key = await SUB.importKey('raw', unb64(keyB64), 'AES-GCM', false, ['decrypt']);
    const pt = await SUB.decrypt({ name: 'AES-GCM', iv: unb64(ivB64) }, key, buf);
    return new Blob([pt], { type: mime || 'application/octet-stream' });
  }

  // ---- verification codes ----
  async function sha(u8) { return new Uint8Array(await SUB.digest('SHA-256', u8)); }
  async function safetyNumber(pubA, pubB) {
    const [a, b] = [pubA, pubB].sort();
    const h = await sha(utf8('ping-safety|' + a + '|' + b));
    const g = [];
    for (let i = 0; i < 12; i++) g.push(String(((h[2 * i] << 8) | h[2 * i + 1]) % 100000).padStart(5, '0'));
    return g;
  }
  async function keyId(pub) {
    const h = await sha(unb64(pub));
    return Array.from(h.slice(0, 8), (x) => x.toString(16).padStart(2, '0')).join('').replace(/(.{4})/g, '$1 ').trim();
  }

  return { genIdentity, seal, open, sealBlob, openBlob, safetyNumber, keyId };
})();

/* ------------------------------ LOCAL STORE (IndexedDB) ------------------------------ */
let _db = null;
function idb() {
    if (_db) return _db;
    _db = new Promise((res, rej) => {
        const r = indexedDB.open('ping_v1', 1);
        r.onupgradeneeded = () => {
            const d = r.result;
            ['kv', 'blobs'].forEach(n => d.createObjectStore(n));
            ['msgs', 'contacts', 'chats', 'bots', 'outbox', 'seen', 'todel'].forEach(n => d.createObjectStore(n, { keyPath: 'id' }));
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    });
    return _db;
}
async function tx(store, mode, fn) {
    const d = await idb();
    return new Promise((res, rej) => {
        const t = d.transaction(store, mode);
        let rq;
        try { rq = fn(t.objectStore(store)); } catch (e) { rej(e); return; }
        t.oncomplete = () => res(rq ? rq.result : undefined);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
    });
}
const dbPut = (s, v, k) => tx(s, 'readwrite', o => k === undefined ? o.put(v) : o.put(v, k)).catch(e => console.warn('dbPut', s, e));
const dbGet = (s, k) => tx(s, 'readonly', o => o.get(k)).catch(() => undefined);
const dbDel = (s, k) => tx(s, 'readwrite', o => o.delete(k)).catch(() => {});
const dbAll = s => tx(s, 'readonly', o => o.getAll()).catch(() => []);
const kvGet = async (k, def) => { const v = await dbGet('kv', k); return v === undefined ? def : v; };
const kvSet = (k, v) => dbPut('kv', v, k);
async function dbWipe() {
    const d = await idb();
    const names = Array.from(d.objectStoreNames);
    const t = d.transaction(names, 'readwrite');
    names.forEach(n => t.objectStore(n).clear());
    return new Promise(r => { t.oncomplete = r; t.onerror = r; t.onabort = r; });
}

/* ------------------------------ APPWRITE BACKEND ------------------------------ */
function makeApi() {
    let client, account, databases, storage, A;
    const DB = CFG.database, T = CFG.tables, BK = CFG.bucket;
    const fileUrl = id => CFG.endpoint + '/storage/buckets/' + BK + '/files/' + id + '/view?project=' + CFG.project;
    const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
    async function retry(fn, n) {
        n = n == null ? 2 : n; let last;
        for (let i = 0; i <= n; i++) {
            try { return await fn(); } catch (e) {
                last = e;
                const net = !e || e.code === 0 || e.code === 429 || e.code >= 500 || /fetch|network/i.test(String(e.message));
                if (!net || i === n) break;
                await sleep(600 * (i + 1));
            }
        }
        throw last;
    }
    return {
        async init() {
            if (!window.Appwrite) {
                let err;
                for (const src of CFG.sdk) { try { await loadScript(src); err = null; break; } catch (e) { err = e; } }
                if (!window.Appwrite) throw err || new Error('SDK not loaded');
            }
            A = window.Appwrite;
            client = new A.Client().setEndpoint(CFG.endpoint).setProject(CFG.project);
            account = new A.Account(client); databases = new A.Databases(client); storage = new A.Storage(client);
        },
        async getAccount() { try { return await account.get(); } catch (e) { if (e && e.code === 401) return null; throw e; } },
        async sendOtp(kind, value) {
            const t = kind === 'email' ? await account.createEmailToken(A.ID.unique(), value) : await account.createPhoneToken(A.ID.unique(), value);
            return { userId: t.userId };
        },
        async verifyOtp(userId, code) { await account.createSession(userId, code); return account.get(); },
        async logout() { try { await account.deleteSession('current'); } catch (e) {} },

        async getUser(id) { try { return await databases.getDocument(DB, T.users, id); } catch (e) { if (e && e.code === 404) return null; throw e; } },
        async getUsers(ids) {
            const out = [];
            for (let i = 0; i < ids.length; i += 50) {
                const r = await retry(() => databases.listDocuments(DB, T.users, [A.Query.equal('$id', ids.slice(i, i + 50)), A.Query.limit(50)]));
                out.push(...r.documents);
            }
            return out;
        },
        async findByUsername(u) { const r = await retry(() => databases.listDocuments(DB, T.users, [A.Query.equal('username', u), A.Query.limit(1)])); return r.documents[0] || null; },
        async searchUsers(prefix) { const r = await retry(() => databases.listDocuments(DB, T.users, [A.Query.startsWith('username', prefix), A.Query.limit(15)])); return r.documents; },
        async createUser(id, data) {
            return databases.createDocument(DB, T.users, id, data, [A.Permission.read(A.Role.users()), A.Permission.update(A.Role.user(id)), A.Permission.delete(A.Role.user(id))]);
        },
        async createBotUser(data, ownerId) {
            return databases.createDocument(DB, T.users, A.ID.unique(), data, [A.Permission.read(A.Role.users()), A.Permission.update(A.Role.user(ownerId)), A.Permission.delete(A.Role.user(ownerId))]);
        },
        async updateUser(id, data) { return retry(() => databases.updateDocument(DB, T.users, id, data)); },
        async deleteUser(id) { return databases.deleteDocument(DB, T.users, id); },

        async uploadFile(blob, name, opts) {
            opts = opts || {};
            const file = new File([blob], name || 'blob.bin', { type: opts.type || 'application/octet-stream' });
            // Appwrite: client sirf apni hi role (any / users / apni user id) ko permission de sakta hai
            const perms = [A.Permission.read(A.Role.any()), A.Permission.delete(A.Role.users())];
            const f = await retry(() => storage.createFile(BK, A.ID.unique(), file, perms, opts.onProgress), 1);
            return f.$id;
        },
        fileUrl,
        async fetchFile(id) { const r = await fetch(fileUrl(id)); if (!r.ok) { const e = new Error('file ' + r.status); e.code = r.status; throw e; } return r.arrayBuffer(); },
        async deleteFile(id) { try { await storage.deleteFile(BK, id); } catch (e) { if (!e || e.code !== 404) throw e; } },

        // the server only HOLDS envelopes until the recipient device has them
        async sendMsg(doc, readFor, delFor) {
            // envelope end-to-end encrypted hai; rcpt field se sirf asli receiver hi kholta/uthata hai
            const perms = [A.Permission.read(A.Role.users()), A.Permission.delete(A.Role.users())];
            const d = await retry(() => databases.createDocument(DB, T.messages, A.ID.unique(), doc, perms), 2);
            return d.$id;
        },
        async listPending(rcptIds) {
            const out = [];
            for (const rid of rcptIds) {
                let cursor = null;
                for (let page = 0; page < 20; page++) {
                    const q = [A.Query.equal('rcpt', rid), A.Query.orderAsc('ts'), A.Query.limit(100)];
                    if (cursor) q.push(A.Query.cursorAfter(cursor));
                    const r = await retry(() => databases.listDocuments(DB, T.messages, q));
                    out.push(...r.documents);
                    if (r.documents.length < 100) break;
                    cursor = r.documents[r.documents.length - 1].$id;
                }
            }
            return out;
        },
        async deleteMsg(id) { try { await databases.deleteDocument(DB, T.messages, id); } catch (e) { if (!e || e.code !== 404) throw e; } },
        async markDelivered(id) { try { await databases.updateDocument(DB, T.messages, id, { dlv: true }); } catch (e) {} },

        async createStory(data, readIds, ownerId) {
            const perms = [A.Permission.read(A.Role.users()), A.Permission.delete(A.Role.user(ownerId))];
            return databases.createDocument(DB, T.stories, A.ID.unique(), data, perms);
        },
        async listStories() { const r = await retry(() => databases.listDocuments(DB, T.stories, [A.Query.greaterThan('exp', Date.now()), A.Query.orderDesc('ts'), A.Query.limit(100)])); return r.documents; },
        async deleteStory(id) { try { await databases.deleteDocument(DB, T.stories, id); } catch (e) { if (!e || e.code !== 404) throw e; } },

        subscribe(watch, cb) {
            const chans = [];
            const add = (kind, id) => {
                chans.push('databases.' + DB + '.collections.' + T[kind] + '.documents' + (id ? '.' + id : ''));
                chans.push('databases.' + DB + '.tables.' + T[kind] + '.rows' + (id ? '.' + id : ''));
            };
            add('messages'); add('stories');
            (watch.userIds || []).slice(0, 80).forEach(id => add('users', id));
            const recent = new Map();
            const unsub = client.subscribe(chans, ev => {
                try {
                    const e0 = (ev.events || []).find(x => /\.(create|update|delete)$/.test(x)) || '';
                    const op = e0.split('.').pop();
                    const kind = e0.includes('.' + T.messages + '.') ? 'msg' : e0.includes('.' + T.stories + '.') ? 'story' : e0.includes('.' + T.users + '.') ? 'user' : null;
                    if (!kind || !ev.payload) return;
                    const key = kind + ':' + op + ':' + ev.payload.$id, now = Date.now();
                    if (recent.has(key) && now - recent.get(key) < 4000) return;
                    recent.set(key, now);
                    if (recent.size > 300) recent.forEach((t, k) => { if (now - t > 10000) recent.delete(k); });
                    cb({ kind, op, doc: ev.payload });
                } catch (e) { console.error('rt', e); }
            });
            return typeof unsub === 'function' ? unsub : () => {};
        },
        async selfCheck() {
            const bad = [];
            for (const k of ['users', 'messages', 'stories']) {
                try { await databases.listDocuments(DB, T[k], [A.Query.limit(1)]); } catch (e) { bad.push(k + ' (' + T[k] + '): ' + (e.message || e.code)); }
            }
            return bad;
        }
    };
}
const API = window.PING_API_OVERRIDE ? window.PING_API_OVERRIDE() : makeApi();

/* ------------------------------ STATE: settings, contacts, chats, messages ------------------------------ */
async function loadSettings() {
    const s = await kvGet('settings', {});
    S.set = Object.assign({}, DEFAULT_SET, s);
    S.set.wall = Object.assign({}, DEFAULT_SET.wall, s.wall || {});
}
async function saveSettings(patch) { Object.assign(S.set, patch || {}); await kvSet('settings', S.set); emit('settings'); }

async function loadState() {
    const [contacts, chats, bots, msgs, seenSt] = await Promise.all([dbAll('contacts'), dbAll('chats'), dbAll('bots'), dbAll('msgs'), kvGet('storySeen', {})]);
    S.contacts = new Map(contacts.map(c => [c.id, c]));
    S.chats = new Map(chats.map(c => [c.id, c]));
    S.bots = new Map(bots.map(b => [b.id, b]));
    S.seenStories = seenSt;
    msgs.sort((a, b) => a.ts - b.ts);
    S.msgs = msgs; S.byId = new Map(); S.byChat = new Map();
    msgs.forEach(m => {
        S.byId.set(m.id, m);
        if (m.media && (m.media.state === 'up')) m.media.state = 'up';
        (S.byChat.get(m.chat) || S.byChat.set(m.chat, []).get(m.chat)).push(m);
    });
}

/* ---- contacts ---- */
const accountOf = c => (c && (c.owner || c.id)) || '';
const cname = c => (c ? c.nick || c.name || (c.username ? '@' + c.username : 'Unknown') : 'Unknown');
const isOnline = c => !!(c && c.lastSeen && Date.now() - c.lastSeen < 100000);
function contactFromDoc(d, old) {
    const c = Object.assign({}, old || {});
    c.id = d.$id; c.username = d.username; c.name = d.name || ''; c.bio = d.bio || ''; c.avatar = d.avatar || '';
    c.lastSeen = d.lastSeen || 0; c.note = d.note || ''; c.noteTs = d.noteTs || 0; c.music = d.music || '';
    c.isBot = !!d.isBot; c.owner = d.owner || '';
    if (old && old.pub && d.pub && old.pub !== d.pub) { c.keyWarn = true; c.verified = false; }
    c.pub = d.pub || (old && old.pub) || '';
    c.fetched = Date.now();
    return c;
}
async function saveContact(c) { S.contacts.set(c.id, c); await dbPut('contacts', c); }
async function upsertContact(d) {
    const old = S.contacts.get(d.$id), c = contactFromDoc(d, old);
    if (old && c.keyWarn && !old.keyWarn) addSys(c.id, '🔒 ' + cname(c) + "'s security code changed. Verify it in the chat profile.");
    await saveContact(c); emit('contacts', c.id); return c;
}
async function getContact(id, force) {
    let c = S.contacts.get(id);
    if (c && c.pub && !force && Date.now() - (c.fetched || 0) < 10 * 60 * 1000) return c;
    try {
        const d = await API.getUser(id);
        if (!d) { if (c) return c; throw Object.assign(new Error('no such user'), { code: 404 }); }
        return await upsertContact(d);
    } catch (e) { if (c) return c; throw e; }
}
async function refreshContacts(ids) {
    ids = ids || Array.from(S.contacts.keys());
    if (!ids.length || !S.online) return;
    try { const docs = await API.getUsers(ids); for (const d of docs) await upsertContact(d); } catch (e) { console.warn('refreshContacts', e); }
}

/* ---- chats ---- */
const chatOf = id => S.chats.get(id);
const isSelf = id => !!S.me && id === S.me.id;
async function saveChat(c) { S.chats.set(c.id, c); await dbPut('chats', c); emit('chat', c.id); }
async function ensureChat(id, init) {
    let c = S.chats.get(id);
    if (!c) {
        const grp = id.charAt(0) === 'g' && id.length > 16;
        c = Object.assign({ id, type: grp ? 'group' : 'dm', members: [], admins: [], pinned: 0, archived: false, muted: false, unread: 0, lastTs: 0, draft: '', wall: null }, init || {});
        await saveChat(c);
    } else if (init) { Object.assign(c, init); await saveChat(c); }
    return c;
}
function chatName(id) {
    const c = S.chats.get(id);
    if (isSelf(id)) return (S.me.name || S.me.username) + ' (You)';
    if (c && c.type === 'group') return c.name || 'Group';
    return cname(S.contacts.get(id));
}
const msgsOf = id => S.byChat.get(id) || [];
const lastMsgOf = id => { const a = msgsOf(id); return a[a.length - 1] || null; };
const lastVisible = id => { const a = msgsOf(id); for (let i = a.length - 1; i >= 0; i--) if (!a[i].hidden) return a[i]; return null; };
function sortedChats(filter) {
    return Array.from(S.chats.values()).filter(c => !c.deleted && (!filter || filter(c)))
        .sort((a, b) => (b.pinned || 0) - (a.pinned || 0) || (b.lastTs || 0) - (a.lastTs || 0));
}
const totalUnread = () => { let n = 0; S.chats.forEach(c => { if (!c.archived && !c.muted && !c.deleted) n += c.unread || 0; }); return n; };

/* ---- messages ---- */
const getMsg = id => S.byId.get(id);
const saveMsg = m => { dbPut('msgs', m); emit('msg', m); };
function addMsg(m) {
    if (S.byId.has(m.id)) return S.byId.get(m.id);
    S.byId.set(m.id, m);
    const ins = (arr) => { arr.push(m); if (arr.length > 1 && arr[arr.length - 2].ts > m.ts) arr.sort((a, b) => a.ts - b.ts); };
    ins(S.msgs);
    ins(S.byChat.get(m.chat) || S.byChat.set(m.chat, []).get(m.chat));
    dbPut('msgs', m);
    const c = S.chats.get(m.chat);
    if (c) {
        if (m.ts > (c.lastTs || 0)) c.lastTs = m.ts;
        if (m.from === 'peer' && !m.system && !m.read) c.unread = (c.unread || 0) + 1;
        if (c.archived && m.from === 'peer' && !m.system && !c.muted) c.archived = false;
        if (c.deleted) c.deleted = false;
        saveChat(c);
    }
    emit('msg', m, true);
    return m;
}
async function addSys(chat, text, sk) {
    await ensureChat(chat);
    return addMsg({ id: 'sys' + uid(), chat, from: 'me', ts: Date.now(), text, system: true, sk: sk || 'info', local: true, status: 'sent', read: true, reactions: {} });
}
function removeMsgLocal(id) {
    const m = S.byId.get(id); if (!m) return;
    S.byId.delete(id);
    S.msgs = S.msgs.filter(x => x.id !== id);
    const a = S.byChat.get(m.chat); if (a) S.byChat.set(m.chat, a.filter(x => x.id !== id));
    dbDel('msgs', id); dbDel('blobs', id);
    if (urlCache[id]) { URL.revokeObjectURL(urlCache[id]); delete urlCache[id]; }
    const c = S.chats.get(m.chat);
    if (c) { const l = lastMsgOf(m.chat); c.lastTs = l ? l.ts : c.lastTs; recountUnread(c); saveChat(c); }
}
function recountUnread(c) { c.unread = msgsOf(c.id).filter(m => m.from === 'peer' && !m.read && !m.system).length; }

/* ---- blobs / media urls ---- */
const urlCache = {}, memBlobs = {};
async function getURL(id) {
    if (urlCache[id]) return urlCache[id];
    const b = memBlobs[id] || await dbGet('blobs', id);
    if (b) return (urlCache[id] = URL.createObjectURL(b));
    return null;
}
async function saveBlob(id, blob) { await dbPut('blobs', blob, id); if (urlCache[id]) { URL.revokeObjectURL(urlCache[id]); delete urlCache[id]; } }

/* ---- avatars ---- */
function avInfo(id) {
    const c = S.chats.get(id), ct = S.contacts.get(id);
    if (isSelf(id)) return { photo: S.me.avatar ? API.fileUrl(S.me.avatar) : '', letter: (S.me.name || S.me.username || '?')[0].toUpperCase(), hue: hue(S.me.id), bot: false };
    if (c && c.type === 'group') return { photo: c.av ? API.fileUrl(c.av) : '', letter: (c.name || 'G')[0].toUpperCase(), hue: hue(c.id), group: true };
    const nm = cname(ct);
    return { photo: ct && ct.avatar ? API.fileUrl(ct.avatar) : '', letter: (nm.replace(/^@/, '')[0] || '?').toUpperCase(), hue: hue(id), bot: !!(ct && ct.isBot) };
}
function avHTML(id, extra) {
    const a = avInfo(id);
    const st = a.photo ? 'background-image:url(' + esc(a.photo) + ')' : 'background-color:hsl(' + a.hue + ',52%,46%)';
    return '<span class="rd-av' + (extra ? ' ' + extra : '') + '" data-avof="' + esc(id) + '" style="' + st + '">' + (a.photo ? '' : (a.group ? ic('users', 22) : a.bot ? ic('bot', 22) : esc(a.letter))) + '</span>';
}
function paintAv(el, id, extra) {
    if (!el) return;
    const a = avInfo(id);
    el.className = 'rd-av' + (extra ? ' ' + extra : '');
    el.dataset.avof = id;
    if (a.photo) { el.style.backgroundImage = 'url(' + a.photo + ')'; el.style.backgroundColor = ''; el.textContent = ''; }
    else { el.style.backgroundImage = ''; el.style.backgroundColor = 'hsl(' + a.hue + ',52%,46%)'; el.innerHTML = a.group ? ic('users', 22) : a.bot ? ic('bot', 22) : esc(a.letter); }
}

/* ------------------------------ ENGINE: send / receive / sync ------------------------------
   Server = sirf HOLD karta hai (encrypted). Receiver ke phone me message local save hote hi server se delete.
   Dono online + P2P link ban gaya = message seedha WebRTC data-channel se, server ko pata bhi nahi. */
let procQ = Promise.resolve(), unsubRt = null, subKey = '', timers = [], started = false;
const typingUntil = {};
const isNetErr = e => !e || e.code === 0 || e.code === 429 || e.code >= 500 || /fetch|network|Failed/i.test(String(e && e.message || ''));
const identOf = id => (id === S.me.id ? S.ident : (S.bots.get(id) || {}).ident);
const recipientsOf = c => (c.type === 'group' ? c.members.filter(x => x !== S.me.id) : [c.id]);

async function sealDoc(from, to, chat, payload, ts, mid, fileId, kind) {
    const c = await getContact(to);
    if (!c || !c.pub) throw new Error('no key for ' + to);
    const ct = await CR.seal(identOf(from).priv, c.pub, payload, { sender: from, rcpt: to, mid, ts });
    return { mid, sender: from, rcpt: to, chat: chat || '', kind: kind || 'm', ct, ts, fileId: fileId || '' };
}
async function dispatchTo(from, rcpts, chat, payload, o) {
    o = o || {};
    const mid = o.mid || uid(), ts = o.ts || Date.now();
    payload.mid = payload.mid || mid;
    const entries = [];
    for (const r of rcpts) {
        try {
            const doc = await sealDoc(from, r, chat, payload, ts, mid, o.fileId, o.kind);
            entries.push({ id: mid + ':' + r, mid, rcpt: r, readFor: accountOf(S.contacts.get(r)), doc, from, ts, tries: 0, q: 'm' });
        } catch (e) { console.warn('seal failed', r, e); if (o.local) setStatus(mid, r, 'failed'); }
    }
    for (const e of entries) await dbPut('outbox', e);
    entries.forEach(e => deliver(e));
    return { mid, ts };
}
async function deliver(e) {
    if (e.busy) return;
    e.busy = true;
    try {
        if (e.doc.kind !== 'sig' && LINK.open(e.rcpt)) {
            if (await LINK.sendDoc(e.rcpt, e.doc)) { await dbDel('outbox', e.id); await setStatus(e.mid, e.rcpt, 'delivered'); return; }
        }
        if (!S.online) return;
        const sid = await API.sendMsg(e.doc, e.readFor, [S.me.id]);
        e.sid = sid;
        await dbDel('outbox', e.id);
        await setStatus(e.mid, e.rcpt, 'sent', sid);
    } catch (err) {
        e.tries = (e.tries || 0) + 1;
        if (!isNetErr(err) || e.tries > 40) { console.warn('send failed', err); toast('Send fail: ' + String((err && err.message) || err).slice(0, 140)); await dbDel('outbox', e.id); await setStatus(e.mid, e.rcpt, 'failed'); }
    } finally { e.busy = false; }
}
async function setStatus(mid, rcpt, st, sid) {
    const m = getMsg(mid);
    if (!m || m.from !== 'me' || m.system) return;
    m.rs = m.rs || {};
    const cur = m.rs[rcpt];
    if (st === 'failed') { if (!cur) m.rs[rcpt] = 'failed'; }
    else if (!cur || cur === 'failed' || RANK[st] > RANK[cur]) m.rs[rcpt] = st;
    if (sid) { m.sids = m.sids || {}; m.sids[rcpt] = sid; }
    const c = chatOf(m.chat), rc = c ? recipientsOf(c) : [rcpt];
    const ok = rc.map(r => m.rs[r] || 'pending').filter(v => v !== 'failed');
    const next = ok.length ? RANKN[Math.min.apply(null, ok.map(v => RANK[v]))] : 'failed';
    m.status = next; saveMsg(m);
}
async function flushOutbox() {
    if (!S.online || !S.me) return;
    const list = (await dbAll('outbox')).sort((a, b) => a.ts - b.ts);
    for (const e of list) { if (e.q === 'up') await runUpload(e); else await deliver(e); }
    await flushTodel();
}

/* ---- sending ---- */
function replyRef(r) { return r ? { id: r.id, uid: r.uid || '', t: r.t } : undefined; }
async function sendMsg(chatId, o) {
    const c = await ensureChat(chatId);
    if (c.left) { toast('Aap is group me nahi ho'); return null; }
    const self = isSelf(chatId), file = o.file;
    if (file && !self && file.size > CFG.maxP2PFileMB * 1048576) { toast('File bahut badi hai (1 GB limit)'); return null; }
    const m = { id: uid(), chat: chatId, from: 'me', uid: S.me.id, ts: Date.now(), text: o.text || '', status: self ? 'sent' : 'pending', rs: {}, reactions: {}, read: true, voice: !!o.voice, fwd: !!o.fwd, reply: o.reply || undefined, album: o.album || undefined };
    if (file) {
        m.media = { name: file.name || ('file_' + Date.now()), type: file.type || 'application/octet-stream', size: file.size, state: self ? 'ok' : 'up', dur: o.dur || 0 };
        memBlobs[m.id] = file; await dbPut('blobs', file, m.id); delete memBlobs[m.id];
    }
    addMsg(m); emit('sent', m);
    if (self) return m;
    if (file) { const e = { id: 'up:' + m.id, q: 'up', mid: m.id, chat: chatId, ts: m.ts, tries: 0 }; await dbPut('outbox', e); runUpload(e); }
    else await dispatchTo(S.me.id, recipientsOf(c), c.type === 'group' ? c.id : '', msgPayload(m), { mid: m.id, ts: m.ts, local: true });
    recipientsOf(c).forEach(r => LINK.ensure(r));
    return m;
}
function msgPayload(m, mediaInfo) {
    const p = { t: 'msg', mid: m.id, text: m.text, voice: !!m.voice, fwd: !!m.fwd, reply: replyRef(m.reply), al: m.album || '' };
    if (mediaInfo) p.media = mediaInfo;
    return p;
}
async function runUpload(e) {
    if (e.busy) return;
    const m = getMsg(e.mid), c = chatOf(e.chat);
    if (!m || !c || m.deleted) { await dbDel('outbox', e.id); return; }
    e.busy = true;
    try {
        const blob = memBlobs[m.id] || await dbGet('blobs', m.id);
        if (!blob) { await dbDel('outbox', e.id); return; }
        const rcpts = recipientsOf(c);
        // 1) direct P2P (dm): koi size limit nahi
        if (c.type === 'dm' && LINK.open(c.id)) {
            try {
                const doc = await sealDoc(S.me.id, c.id, '', msgPayload(m, { name: m.media.name, type: m.media.type, size: m.media.size, dur: m.media.dur, p2p: 1 }), m.ts, m.id, '', 'm');
                m.media.prog = 0; saveMsg(m);
                await LINK.sendMedia(c.id, doc, blob, pr => { m.media.prog = pr; updateProg(m.id, pr, 'Sending'); });
                delete m.media.prog; m.media.state = 'ok'; saveMsg(m);
                await dbDel('outbox', e.id); await setStatus(m.id, c.id, 'delivered');
                return;
            } catch (err) { delete m.media.prog; saveMsg(m); }
        }
        // 2) server (encrypted, 40 MB tak) — receiver ke phone me aate hi server se delete
        if (!S.online) return;
        if (blob.size > CFG.maxServerFileMB * 1048576) {
            if (e.tries > 0 || !LINK.open(c.id)) { m.media.state = 'err'; m.status = 'failed'; m.media.reason = 'Badi file — dono online ho tab P2P se jaayegi'; saveMsg(m); await dbDel('outbox', e.id); }
            e.tries = (e.tries || 0) + 1; return;
        }
        const sealed = await CR.sealBlob(blob);
        const delIds = [S.me.id]; for (const r of rcpts) { const ct = S.contacts.get(r) || await getContact(r).catch(() => null); delIds.push(accountOf(ct)); }
        const fileId = await API.uploadFile(sealed.blob, 'e.bin', { del: delIds, onProgress: p => updateProg(m.id, Math.round(p.progress || 0), 'Uploading') });
        m.media.fileId = fileId; m.media.state = 'ok'; saveMsg(m);
        await dbDel('outbox', e.id);
        await dispatchTo(S.me.id, rcpts, c.type === 'group' ? c.id : '', msgPayload(m, { fileId, key: sealed.key, iv: sealed.iv, name: m.media.name, type: m.media.type, size: m.media.size, dur: m.media.dur }), { mid: m.id, ts: m.ts, fileId, local: true });
    } catch (err) {
        e.tries = (e.tries || 0) + 1;
        if (!isNetErr(err) || e.tries > 20) { toast('Upload fail: ' + String((err && err.message) || err).slice(0, 140)); m.media.reason = String((err && err.message) || 'Upload failed').slice(0, 90); await dbDel('outbox', e.id); m.media.state = 'err'; m.status = 'failed'; saveMsg(m); }
    } finally { e.busy = false; }
}
async function retryMsg(id) {
    const m = getMsg(id); if (!m || m.from !== 'me') return;
    const c = chatOf(m.chat); if (!c) return;
    m.status = 'pending'; m.rs = {}; if (m.media) m.media.state = 'up'; saveMsg(m);
    if (m.media) { const e = { id: 'up:' + m.id, q: 'up', mid: m.id, chat: m.chat, ts: m.ts, tries: 0 }; await dbPut('outbox', e); runUpload(e); }
    else await dispatchTo(S.me.id, recipientsOf(c), c.type === 'group' ? c.id : '', msgPayload(m), { mid: m.id, ts: m.ts, local: true });
}
async function control(chatId, payload) {
    const c = chatOf(chatId); if (!c || isSelf(chatId)) return;
    return dispatchTo(S.me.id, recipientsOf(c), c.type === 'group' ? c.id : '', payload, {});
}
async function editMsg(id, text) {
    const m = getMsg(id); text = String(text || '').trim();
    if (!m || m.from !== 'me' || !text || m.deleted) return;
    m.text = text; m.edited = true; delete m.lp; saveMsg(m);
    await control(m.chat, { t: 'edit', mid: id, text });
}
function wipeMsg(m) {
    m.deleted = true; m.text = ''; m.reactions = {}; delete m.lp; delete m.reply;
    if (m.media) { dbDel('blobs', m.id); if (urlCache[m.id]) { URL.revokeObjectURL(urlCache[m.id]); delete urlCache[m.id]; } m.media = null; }
    saveMsg(m);
}
async function unsend(m) {
    if (m.from !== 'me') return;
    if (m.sids) Object.values(m.sids).forEach(sid => API.deleteMsg(sid).catch(() => {}));
    for (const r of Object.keys(m.rs || {})) await dbDel('outbox', m.id + ':' + r);
    await dbDel('outbox', 'up:' + m.id);
    wipeMsg(m);
    await control(m.chat, { t: 'unsend', mid: m.id });
}
function deleteForMe(ids) { ids.forEach(removeMsgLocal); emit('msg'); }
async function reactTo(m, emoji) {
    if (!m || m.deleted || m.system) return;
    m.reactions = m.reactions || {};
    if (emoji) m.reactions[S.me.id] = emoji; else delete m.reactions[S.me.id];
    saveMsg(m);
    await control(m.chat, { t: 'react', mid: m.id, e: emoji || '' });
}
async function toggleStar(m) { m.star = m.star ? 0 : 1; saveMsg(m); }

/* ---- receipts ---- */
const rq = {};
function queueReceipt(sender, kind, mid, chat) {
    const key = sender + '|' + kind + '|' + (chat || '');
    const r = rq[key] = rq[key] || { sender, kind, chat: chat || '', mids: [], t: null };
    r.mids.push(mid); clearTimeout(r.t);
    r.t = setTimeout(async () => {
        delete rq[key];
        for (let i = 0; i < r.mids.length; i += 40) { try { await dispatchTo(S.me.id, [r.sender], r.chat, { t: 'ack', k: r.kind, mids: r.mids.slice(i, i + 40) }, {}); } catch (e) {} }
    }, 500);
}
function markRead(chatId) {
    const c = chatOf(chatId); if (!c || document.hidden) return;
    let any = false;
    msgsOf(chatId).forEach(m => {
        if (m.from === 'peer' && !m.read && !m.system) {
            m.read = true; any = true; dbPut('msgs', m);
            if (S.set.readReceipts && !isSelf(chatId)) queueReceipt(m.uid, 'r', m.id, c.type === 'group' ? c.id : '');
        } else if (m.from === 'peer' && !m.read) { m.read = true; dbPut('msgs', m); }
    });
    if (c.unread) { c.unread = 0; saveChat(c); } else if (any) emit('chat', chatId);
}

/* ---- typing (P2P only, never touches the server) ---- */
let typingSentAt = 0, typingOffT = 0;
function sendTyping(on) {
    const c = S.cur && chatOf(S.cur); if (!c || c.type !== 'dm' || isSelf(c.id) || !S.set.typing) return;
    LINK.sendTyping(c.id, on);
}
function typingPing() {
    const now = Date.now();
    if (now - typingSentAt > 1500) { typingSentAt = now; sendTyping(true); }
    clearTimeout(typingOffT);
    typingOffT = setTimeout(() => { typingSentAt = 0; sendTyping(false); }, 2500);
}

/* ---- groups ---- */
async function createGroup(name, memberIds, av) {
    const gid = 'g' + uid();
    const members = [S.me.id].concat(memberIds.filter(x => x !== S.me.id));
    const c = await ensureChat(gid, { type: 'group', name, members, admins: [S.me.id], av: av || '', ver: 1, createdBy: S.me.id });
    await addSys(gid, 'You created group “' + name + '”');
    await sendGroupInfo(c);
    return c;
}
async function sendGroupInfo(c, extraTo) {
    const rcpts = Array.from(new Set(recipientsOf(c).concat(extraTo || [])));
    await dispatchTo(S.me.id, rcpts, c.id, { t: 'grp', gid: c.id, name: c.name, members: c.members, admins: c.admins, av: c.av || '', ver: c.ver, by: S.me.id }, {});
}
async function updateGroup(c, patch, sysText) {
    const old = c.members.slice();
    Object.assign(c, patch); c.ver = (c.ver || 1) + 1;
    await saveChat(c);
    if (sysText) await addSys(c.id, sysText);
    await sendGroupInfo(c, old.filter(x => !c.members.includes(x)));
}
async function leaveGroup(c) {
    const members = c.members.filter(x => x !== S.me.id);
    const admins = c.admins.filter(x => x !== S.me.id);
    if (!admins.length && members.length) admins.push(members[0]);
    await dispatchTo(S.me.id, members, c.id, { t: 'grp', gid: c.id, name: c.name, members, admins, av: c.av || '', ver: (c.ver || 1) + 1, by: S.me.id }, {});
    c.left = true; c.members = members; await saveChat(c);
    await addSys(c.id, 'You left the group');
}
async function applyGroup(sender, p) {
    let c = chatOf(p.gid);
    if (c && c.type === 'group' && (c.ver || 0) >= p.ver) return;
    if (c && c.type === 'group' && !c.left && c.admins.length) {
        const isAdmin = c.admins.includes(sender.id);
        const selfLeave = p.members.length === c.members.length - 1 && c.members.filter(x => !p.members.includes(x)).join() === sender.id;
        if (!isAdmin && !selfLeave) return;
    }
    const prevMembers = c ? c.members.slice() : [], prevName = c && c.name, existed = !!(c && c.type === 'group' && c.ver > 0);
    c = await ensureChat(p.gid, { type: 'group', name: p.name, members: p.members, admins: p.admins, av: p.av || '', ver: p.ver, createdBy: (c && c.createdBy) || p.by });
    const who = cname(sender), nm = id => (id === S.me.id ? 'You' : cname(S.contacts.get(id)));
    if (!p.members.includes(S.me.id)) { if (!c.left) { c.left = true; await saveChat(c); await addSys(c.id, who + ' removed you'); } }
    else {
        if (c.left) { c.left = false; await saveChat(c); }
        if (!existed) await addSys(c.id, who + ' added you to “' + p.name + '”');
        else {
            if (prevName !== p.name) await addSys(c.id, who + ' renamed the group to “' + p.name + '”');
            for (const x of p.members.filter(x => !prevMembers.includes(x))) await addSys(c.id, who + ' added ' + nm(x));
            for (const x of prevMembers.filter(x => !p.members.includes(x))) await addSys(c.id, x === sender.id ? who + ' left' : who + ' removed ' + nm(x));
        }
    }
    refreshContacts(p.members.filter(x => x !== S.me.id)); subscribeSoon();
}

/* ---- receiving ---- */
async function downloadMedia(m) {
    const md = m.media;
    if (!md || !md.fileId || md.state === 'ok') return;
    try {
        const buf = await API.fetchFile(md.fileId);
        const blob = await CR.openBlob(buf, md.key, md.iv, md.type);
        await saveBlob(m.id, blob);
        md.state = 'ok'; delete md.key; delete md.iv; saveMsg(m);
        const c = chatOf(m.chat);
        if (c && c.type !== 'group') API.deleteFile(md.fileId).catch(() => {});
    } catch (e) { md.state = (e && (e.code === 404 || e.code === 401)) ? 'gone' : 'dl'; md.reason = md.state === 'gone' ? 'Server se file hat chuki hai' : 'Load nahi hua'; saveMsg(m); }
}
async function retryMedia() {
    if (!S.online) return;
    S.msgs.slice(-300).forEach(m => { if (m.from === 'peer' && m.media && m.media.state === 'dl' && m.media.fileId) downloadMedia(m); });
}
async function handlePayload(sender, p, doc, blob) {
    const gid = doc.chat || '';
    const chatId = gid || sender.id;
    switch (p.t) {
        case 'msg': {
            if (gid) {
                const g = chatOf(gid);
                if (g && g.type === 'group' && g.members.length && !g.members.includes(sender.id)) return;
                if (!g) await ensureChat(gid, { type: 'group', name: 'Group', members: [S.me.id, sender.id], admins: [], ver: 0 });
            } else await ensureChat(chatId);
            if (getMsg(p.mid)) { if (!gid) queueReceipt(sender.id, 'd', p.mid); return; }
            const viewing = S.cur === chatId && !document.hidden;
            const m = { id: p.mid, chat: chatId, from: 'peer', uid: sender.id, ts: doc.ts, text: p.text || '', voice: !!p.voice, fwd: !!p.fwd, album: p.al || undefined, status: 'sent', read: viewing, reactions: {} };
            if (p.reply) m.reply = { id: p.reply.id, uid: p.reply.uid, who: p.reply.uid === S.me.id ? 'me' : 'peer', t: p.reply.t };
            if (p.media) m.media = { name: p.media.name, type: p.media.type, size: p.media.size, dur: p.media.dur, fileId: p.media.fileId, key: p.media.key, iv: p.media.iv, state: blob ? 'ok' : 'dl' };
            if (blob) { if (!blob.type && m.media) blob = new Blob([blob], { type: m.media.type || 'application/octet-stream' }); await saveBlob(m.id, blob); }
            addMsg(m);
            queueReceipt(sender.id, viewing && S.set.readReceipts ? 'r' : 'd', m.id, gid);
            if (viewing) markRead(chatId);
            emit('inbound', m, chatOf(chatId), sender);
            if (m.media && !blob) downloadMedia(m);
            break;
        }
        case 'edit': { const m = getMsg(p.mid); if (m && m.uid === sender.id && !m.deleted) { m.text = String(p.text || ''); m.edited = true; delete m.lp; saveMsg(m); } break; }
        case 'unsend': { const m = getMsg(p.mid); if (m && m.uid === sender.id) wipeMsg(m); break; }
        case 'react': { const m = getMsg(p.mid); if (m && !m.deleted) { m.reactions = m.reactions || {}; if (p.e) m.reactions[sender.id] = p.e; else delete m.reactions[sender.id]; saveMsg(m); if (p.e && m.from === 'me') emit('reacted', m, sender, p.e); } break; }
        case 'ack': for (const mid of p.mids || []) await setStatus(mid, sender.id, p.k === 'r' ? 'seen' : 'delivered'); break;
        case 'grp': await applyGroup(sender, p); break;
        case 'sig':
            if (p.ch === 'data') { if (Date.now() - doc.ts < 60000) LINK.onSignal(sender, p); }
            else CALL.onSignal(sender, p, doc.ts);
            break;
    }
}
// returns 'ok' | 'dup' | 'drop' | 'retry' | 'skip'
async function ingest(doc, blob) {
    if (!S.me || !myIds().includes(doc.rcpt)) return 'skip';
    const seenKey = doc.mid + ':' + doc.rcpt;
    if (await dbGet('seen', seenKey)) return 'dup';
    const bot = doc.rcpt !== S.me.id ? S.bots.get(doc.rcpt) : null;
    const ident = bot ? bot.ident : S.ident;
    if (!ident) return 'drop';
    let sender;
    try { sender = await getContact(doc.sender); } catch (e) { return e && e.code === 404 ? 'drop' : 'retry'; }
    const ctx = { sender: doc.sender, rcpt: doc.rcpt, mid: doc.mid, ts: doc.ts };
    let payload = null;
    try { payload = await CR.open(ident.priv, sender.pub, doc.ct, ctx); }
    catch (e) { try { const f = await getContact(doc.sender, true); if (f && f.pub !== sender.pub) payload = await CR.open(ident.priv, f.pub, doc.ct, ctx); } catch (e2) {} }
    await dbPut('seen', { id: seenKey, ts: Date.now() });
    if (!payload) { if (!bot && doc.kind === 'm') await addSys(doc.chat || doc.sender, '⚠️ Ek message decrypt nahi hua (security keys badal gayi).'); return 'drop'; }
    try {
        if (bot) await BOTS.onInbound(bot, sender, payload, doc);
        else await handlePayload(sender, payload, doc, blob);
    } catch (e) { console.error('handlePayload', e, payload && payload.t); }
    return 'ok';
}
const myIds = () => [S.me.id].concat(Array.from(S.bots.keys()));
function ingestDirect(doc, blob) { procQ = procQ.then(() => ingest(doc, blob)).catch(e => console.error(e)); return procQ; }

async function removeServerDoc(id) {
    try { await API.deleteMsg(id); }
    catch (e) { if (isNetErr(e)) await dbPut('todel', { id }); else { try { await API.markDelivered(id); } catch (_) {} } }
}
async function flushTodel() { for (const t of await dbAll('todel')) { try { await API.deleteMsg(t.id); await dbDel('todel', t.id); } catch (e) { if (!isNetErr(e)) await dbDel('todel', t.id); } } }
function processDocs(docs) {
    docs.sort((a, b) => a.ts - b.ts);
    procQ = procQ.then(async () => {
        for (const d of docs) { try { const r = await ingest(d); if (r !== 'retry') await removeServerDoc(d.$id); } catch (e) { console.error('ingest', e); } }
    });
    return procQ;
}
let fetching = false;
async function fetchPending() {
    if (!S.online || !S.me || fetching) return;
    fetching = true;
    try { const docs = await API.listPending(myIds()); if (docs.length) await processDocs(docs); }
    catch (e) { if (!isNetErr(e)) console.warn('fetchPending', e); }
    fetching = false;
}

/* ---- realtime / presence / lifecycle ---- */
function onRealtime(ev) {
    const { kind, op, doc } = ev;
    if (kind === 'msg' && op === 'create') { if (myIds().includes(doc.rcpt)) processDocs([doc]); }
    else if (kind === 'user' && op !== 'delete') {
        if (S.contacts.has(doc.$id)) upsertContact(doc).then(c => { if (isOnline(c)) LINK.ensure(c.id, true); });
    } else if (kind === 'story') loadStoriesSoon();
}
function subscribeNow() {
    const ids = Array.from(S.contacts.keys()).sort(), key = ids.join(',');
    if (unsubRt && key === subKey) return;
    if (unsubRt) { try { unsubRt(); } catch (e) {} }
    subKey = key;
    try { unsubRt = API.subscribe({ userIds: ids }, onRealtime); } catch (e) { console.warn('subscribe', e); }
}
const subscribeSoon = debounce(subscribeNow, 800);
async function loadStories() {
    if (!S.online || !S.me) return;
    try { S.stories = (await API.listStories()).filter(d => d.exp > Date.now()); emit('stories'); } catch (e) { console.warn('stories', e); }
}
const loadStoriesSoon = debounce(loadStories, 600);
async function heartbeat() { if (!S.online || !S.me) return; try { await API.updateUser(S.me.id, { lastSeen: S.set.showLastSeen ? Date.now() : 0 }); } catch (e) {} }
async function janitor() {
    // meri expired stories + unki files hata do
    try {
        const mine = S.stories.filter(s => s.userId === S.me.id && s.exp < Date.now());
        for (const s of mine) { if (s.fileId) API.deleteFile(s.fileId).catch(() => {}); await API.deleteStory(s.$id); }
    } catch (e) {}
}
function setOnline(v) {
    if (S.online === v) return;
    S.online = v; emit('net', v);
    if (v) { flushOutbox(); fetchPending(); retryMedia(); loadStories(); refreshContacts(); heartbeat(); subscribeNow(); }
}
async function startNet() {
    if (started) return; started = true;
    on('contacts', subscribeSoon);
    window.addEventListener('online', () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
    document.addEventListener('visibilitychange', () => { if (!document.hidden && S.online) { heartbeat(); fetchPending(); flushOutbox(); if (S.cur) markRead(S.cur); } });
    if (S.online) { await flushOutbox().catch(() => {}); fetchPending(); retryMedia(); loadStories(); heartbeat(); refreshContacts(); janitor(); }
    subscribeNow();
    timers.push(setInterval(() => { if (!document.hidden) heartbeat(); }, 60000));
    timers.push(setInterval(() => { if (S.online) { fetchPending(); flushOutbox(); } }, 40000));
    timers.push(setInterval(() => { emit('tick'); }, 30000));
    timers.push(setInterval(() => { if (S.online) { janitor(); loadStories(); } }, 3600000));
    timers.push(setInterval(async () => { const lim = Date.now() - 14 * 864e5; for (const s of await dbAll('seen')) if (s.ts < lim) dbDel('seen', s.id); }, 3600000));
}
function stopNet() {
    started = false; timers.forEach(clearInterval); timers = [];
    if (unsubRt) { try { unsubRt(); } catch (e) {} unsubRt = null; subKey = ''; }
    LINK.closeAll();
}
let progT = 0;
function updateProg(id, pct, label) {
    const now = Date.now();
    if (pct < 100 && now - progT < 180) return;
    progT = now;
    const el = document.querySelector('[data-prog="' + id + '"]');
    if (!el) return;
    el.firstChild.textContent = label + ' ' + pct + '%';
    el.querySelector('i').style.width = pct + '%';
}
async function sendSignal(to, payload) {
    const mid = uid();
    if (payload.ch === 'call' && LINK.open(to)) { try { if (await LINK.sendSigDirect(to, payload)) return; } catch (e) {} }
    return dispatchTo(S.me.id, [to], '', Object.assign({ t: 'sig' }, payload), { mid, kind: 'sig' });
}

/* ------------------------------ P2P LINK (WebRTC data channel) ------------------------------
   Do online users ke beech direct link. Link ban gaya to message/typing/files seedha jaate hain.
   Link na ban paye to sab kuch server-hold se chalta hai — chat kabhi nahi ruki. */
const iceDone = (pc, ms) => new Promise(res => {
    if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); pc.removeEventListener('icegatheringstatechange', chk); res(); }
    function chk() { if (pc.iceGatheringState === 'complete') done(); }
    pc.addEventListener('icegatheringstatechange', chk);
});
const LINK = (function () {
    const links = new Map();
    const lastTry = {};
    const acks = new Map();            // mid -> resolve
    const rxMedia = {};                // peer -> {doc,size,got,acc,buf,bufBytes}
    const open = id => { const L = links.get(id); return !!(L && L.dc && L.dc.readyState === 'open'); };

    function ensure(id, force) {
        if (!S.me || isSelf(id) || !window.RTCPeerConnection) return;
        const c = S.contacts.get(id);
        if (!c || c.isBot || open(id)) return;
        const L = links.get(id);
        if (L && Date.now() - L.t0 < 25000) return;
        if (!force && !isOnline(c)) return;
        if (Date.now() - (lastTry[id] || 0) < 12000) return;
        lastTry[id] = Date.now();
        if (S.me.id < id) startOffer(id); else sendSignal(id, { ch: 'data', k: 'want' }).catch(() => {});
    }
    function mk(id, role, lid) {
        close(id, true);
        const L = { id, role, lid: lid || uid(), pc: null, dc: null, t0: Date.now(), lastRx: Date.now(), lastTx: Date.now(), ping: null };
        L.pc = new RTCPeerConnection(ICE);
        L.pc.onconnectionstatechange = () => {
            const s = L.pc.connectionState;
            if (s === 'failed' || s === 'closed') close(id);
        };
        links.set(id, L);
        return L;
    }
    async function startOffer(id) {
        try {
            const L = mk(id, 'init');
            setupDC(L, L.pc.createDataChannel('chat', { ordered: true }));
            await L.pc.setLocalDescription(await L.pc.createOffer());
            await iceDone(L.pc, 2500);
            if (links.get(id) !== L) return;
            await sendSignal(id, { ch: 'data', k: 'offer', lid: L.lid, sdp: L.pc.localDescription.sdp });
        } catch (e) { console.warn('offer', e); close(id); }
    }
    async function onSignal(sender, p) {
        const id = sender.id;
        try {
            if (p.k === 'want') { ensure(id, true); return; }
            if (p.k === 'offer') {
                const mine = links.get(id);
                if (mine && mine.role === 'init' && S.me.id < id && mine.t0 > Date.now() - 20000) return; // hum initiator hain
                const L = mk(id, 'answer', p.lid);
                L.pc.ondatachannel = e => setupDC(L, e.channel);
                await L.pc.setRemoteDescription({ type: 'offer', sdp: p.sdp });
                await L.pc.setLocalDescription(await L.pc.createAnswer());
                await iceDone(L.pc, 2500);
                if (links.get(id) !== L) return;
                await sendSignal(id, { ch: 'data', k: 'answer', lid: L.lid, sdp: L.pc.localDescription.sdp });
            } else if (p.k === 'answer') {
                const L = links.get(id);
                if (L && L.role === 'init' && L.lid === p.lid && L.pc.signalingState === 'have-local-offer') await L.pc.setRemoteDescription({ type: 'answer', sdp: p.sdp });
            }
        } catch (e) { console.warn('link signal', e); close(id); }
    }
    function setupDC(L, dc) {
        dc.binaryType = 'arraybuffer';
        L.dc = dc;
        dc.onopen = () => {
            if (L.dc !== dc) return;
            L.lastRx = L.lastTx = Date.now();
            clearInterval(L.ping);
            L.ping = setInterval(() => {
                if (dc.readyState !== 'open') return;
                try { dc.send('{"t":"ping"}'); } catch (e) {}
                const idle = Date.now() - L.lastRx;
                if (idle > 35000) close(L.id);
                else if (idle > 4 * 60000 && S.cur !== L.id && !call) close(L.id);
            }, 10000);
            emit('link', L.id, true);
            flushOutbox();
        };
        dc.onclose = () => { if (L.dc === dc) close(L.id); };
        dc.onmessage = ev => { L.lastRx = Date.now(); onData(L, ev.data); };
    }
    function close(id, silent) {
        const L = links.get(id);
        if (!L) return;
        links.delete(id);
        clearInterval(L.ping);
        try { L.dc && L.dc.close(); } catch (e) {}
        try { L.pc && L.pc.close(); } catch (e) {}
        delete rxMedia[id];
        if (!silent) emit('link', id, false);
    }
    function closeAll() { Array.from(links.keys()).forEach(id => close(id)); }

    async function onData(L, d) {
        if (typeof d !== 'string') {
            const r = rxMedia[L.id]; if (!r) return;
            r.buf.push(d); r.bufBytes += d.byteLength; r.got += d.byteLength;
            if (r.bufBytes >= 16 * 1024 * 1024) { r.acc.push(new Blob(r.buf)); r.buf = []; r.bufBytes = 0; } // disk-backed blobs, RAM bachti hai
            return;
        }
        let e; try { e = JSON.parse(d); } catch (x) { return; }
        switch (e.t) {
            case 'ping': try { L.dc.send('{"t":"pong"}'); } catch (x) {} break;
            case 'doc': { const r = await ingestDirect(e.doc); if (r === 'ok' || r === 'dup') try { L.dc.send(JSON.stringify({ t: 'ack', mid: e.doc.mid })); } catch (x) {} break; }
            case 'ack': { const f = acks.get(e.mid); if (f) { acks.delete(e.mid); f(true); } break; }
            case 'typing': typingUntil[L.id] = e.on ? Date.now() + 3500 : 0; emit('typing', L.id); if (e.on) setTimeout(() => emit('typing', L.id), 3600); break;
            case 'sig': { const c = await getContact(L.id).catch(() => null); if (c) CALL.onSignal(c, e.p, Date.now()); break; }
            case 'ms': rxMedia[L.id] = { doc: e.doc, size: e.size, got: 0, acc: [], buf: [], bufBytes: 0 }; break;
            case 'me': {
                const r = rxMedia[L.id]; delete rxMedia[L.id];
                if (!r || r.doc.mid !== e.mid) return;
                const blob = new Blob(r.acc.concat([new Blob(r.buf)]));
                const res = await ingestDirect(r.doc, blob);
                if (res === 'ok' || res === 'dup') try { L.dc.send(JSON.stringify({ t: 'ack', mid: e.mid })); } catch (x) {}
                break;
            }
        }
    }
    function sendDoc(id, doc) {
        const L = links.get(id);
        if (!open(id)) return Promise.resolve(false);
        return new Promise(res => {
            const t = setTimeout(() => { acks.delete(doc.mid); res(false); }, 3500);
            acks.set(doc.mid, ok => { clearTimeout(t); res(ok); });
            try { L.dc.send(JSON.stringify({ t: 'doc', doc })); L.lastTx = Date.now(); } catch (e) { clearTimeout(t); acks.delete(doc.mid); res(false); }
        });
    }
    async function sendSigDirect(id, p) { const L = links.get(id); if (!open(id)) return false; L.dc.send(JSON.stringify({ t: 'sig', p })); return true; }
    function sendTyping(id, on) { const L = links.get(id); if (open(id)) try { L.dc.send(JSON.stringify({ t: 'typing', on: !!on })); } catch (e) {} }
    function drain(dc) {
        if (dc.bufferedAmount < 16 * 1024 * 1024) return Promise.resolve();
        return new Promise(res => {
            dc.bufferedAmountLowThreshold = 4 * 1024 * 1024;
            const done = () => { dc.removeEventListener('bufferedamountlow', done); clearTimeout(t); res(); };
            const t = setTimeout(done, 1500);
            dc.addEventListener('bufferedamountlow', done);
        });
    }
    async function sendMedia(id, doc, blob, onProg) {
        const L = links.get(id);
        if (!open(id)) throw new Error('no link');
        const dc = L.dc, total = blob.size;
        let cs = CHUNK; try { cs = Math.max(16 * 1024, Math.min(256 * 1024, L.pc.sctp.maxMessageSize || CHUNK)); } catch (e) {}
        dc.send(JSON.stringify({ t: 'ms', doc, size: total }));
        for (let o = 0; o < total; o += SLICE) {
            const buf = await blob.slice(o, Math.min(o + SLICE, total)).arrayBuffer();
            for (let q = 0; q < buf.byteLength; q += cs) {
                if (dc.readyState !== 'open') throw new Error('closed');
                await drain(dc);
                dc.send(new Uint8Array(buf, q, Math.min(cs, buf.byteLength - q)));
            }
            if (onProg) onProg(Math.min(99, Math.floor((o + buf.byteLength) * 100 / total)));
        }
        await new Promise((res, rej) => {
            const t = setTimeout(() => { acks.delete(doc.mid); rej(new Error('no ack')); }, 20000);
            acks.set(doc.mid, () => { clearTimeout(t); res(); });
            dc.send(JSON.stringify({ t: 'me', mid: doc.mid }));
        });
    }
    return { open, ensure, onSignal, sendDoc, sendSigDirect, sendTyping, sendMedia, close, closeAll };
})();
const isTyping = id => (typingUntil[id] || 0) > Date.now();

/* ------------------------------ SOUND + NOTIFICATIONS ------------------------------ */
const SFX = (function () {
    let ctx = null, ringT = null, backT = null;
    const enabled = () => S.set.sound !== false;
    function ac() {
        if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
    }
    function tone(f, t0, d, v, type) {
        const c = ac(); if (!c) return;
        const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
        o.type = type || 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.05);
    }
    const api = {
        unlock() { ac(); },
        send() { if (enabled()) { tone(740, 0, .07, .10); tone(1109, .05, .09, .08); } },
        recv() { if (enabled()) { tone(587, 0, .11, .16); tone(880, .09, .16, .16); } },
        pop() { if (enabled()) tone(520, 0, .06, .08); },
        end() { if (enabled()) { tone(480, 0, .12, .14); tone(360, .12, .2, .14); } },
        ring() {
            api.stop();
            const play = () => { if (!enabled()) return; [[659, 0], [784, .18], [659, .36], [784, .54], [1047, .8]].forEach(([f, t]) => tone(f, t, .22, .22, 'triangle')); };
            play(); ringT = setInterval(play, 2300);
            const pat = () => vib([500, 250, 500, 250, 500]); pat(); api._v = setInterval(pat, 2300);
        },
        ringback() { api.stop(); const play = () => { if (enabled()) { tone(425, 0, .9, .09); tone(450, 0, .9, .09); } }; play(); backT = setInterval(play, 3200); },
        stop() { clearInterval(ringT); clearInterval(backT); clearInterval(api._v); ringT = backT = api._v = null; try { navigator.vibrate && navigator.vibrate(0); } catch (e) {} }
    };
    return api;
})();

async function sysNotify(title, body, o) {
    o = o || {};
    if (!('Notification' in window) || Notification.permission !== 'granted' || S.set.notif === false) return;
    const opts = { body, tag: o.tag, icon: ICON192, badge: ICON192, renotify: true, requireInteraction: !!o.sticky, vibrate: o.vibrate || [120, 60, 120], data: { chat: o.chat || '', call: !!o.call } };
    try {
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if (reg && reg.showNotification) { await reg.showNotification(title, opts); return; }
        const n = new Notification(title, opts); n.onclick = () => { window.focus(); if (o.chat) openChat(o.chat); n.close(); };
    } catch (e) {}
}
async function askNotifPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) {} }
    return Notification.permission;
}

/* ------------------------------ CALLS (HD voice / adaptive video up to 4K / screen share) ------------------------------
   Call apni alag WebRTC connection banati hai — signaling E2E-encrypted server docs se.
   Chat ka P2P link ho ya na ho, call lagti hai. Link khula ho to signaling usi se seedha jaati hai. */
const TIERS = [
    { n: '240p', w: 426, h: 240, f: 15, br: 250e3, need: 330e3 },
    { n: '360p', w: 640, h: 360, f: 20, br: 600e3, need: 760e3 },
    { n: '480p', w: 854, h: 480, f: 24, br: 1.1e6, need: 1.4e6 },
    { n: '720p HD', w: 1280, h: 720, f: 30, br: 2.8e6, need: 3.5e6 },
    { n: '1080p Full HD', w: 1920, h: 1080, f: 30, br: 6e6, need: 7.5e6 },
    { n: '4K Ultra HD', w: 3840, h: 2160, f: 30, br: 14e6, need: 18e6 }
];
const START_TIER = 3;
let call = null, callTimer = null, callTick = null, remoteStream = null;

const CALL = (function () {
    function tuneSDP(sdp) {
        const m = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i);
        if (!m) return sdp;
        const pt = m[1];
        const want = { useinbandfec: '1', usedtx: '0', stereo: '0', maxaveragebitrate: '128000', maxplaybackrate: '48000', minptime: '10', cbr: '0' };
        const re = new RegExp('a=fmtp:' + pt + ' ([^\\r\\n]*)');
        if (re.test(sdp)) {
            return sdp.replace(re, (all, params) => {
                const o = {};
                params.split(';').forEach(kv => { const i = kv.indexOf('='); if (i > 0) o[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
                Object.assign(o, want);
                return 'a=fmtp:' + pt + ' ' + Object.keys(o).map(k => k + '=' + o[k]).join(';');
            });
        }
        return sdp.replace(new RegExp('(a=rtpmap:' + pt + ' opus/48000/2\\r?\\n)'), '$1a=fmtp:' + pt + ' ' + Object.keys(want).map(k => k + '=' + want[k]).join(';') + '\r\n');
    }
    function preferCodecs(sender) {
        try {
            const tr = call.pc.getTransceivers().find(t => t.sender === sender);
            if (!tr || !tr.setCodecPreferences || !window.RTCRtpReceiver) return;
            const caps = RTCRtpReceiver.getCapabilities('video'); if (!caps) return;
            const rank = c => { const mt = c.mimeType.toLowerCase(); return mt === 'video/vp9' ? 0 : mt === 'video/h264' ? 1 : mt === 'video/vp8' ? 2 : mt === 'video/av1' ? 4 : 3; };
            tr.setCodecPreferences(caps.codecs.slice().sort((x, y) => rank(x) - rank(y)));
        } catch (e) {}
    }
    async function setParams(sender, mod) {
        if (!sender) return;
        try { const p = sender.getParameters(); if (!p.encodings || !p.encodings.length) return; mod(p); await sender.setParameters(p); } catch (e) {}
    }
    function tuneSenders() {
        if (!call || !call.pc) return;
        setParams(call.aSender, p => { p.encodings[0].maxBitrate = 128000; p.encodings[0].priority = 'high'; p.encodings[0].networkPriority = 'high'; });
        if (call.vSender) {
            if (call.share) setParams(call.vSender, p => { p.encodings[0].maxBitrate = 8e6; p.encodings[0].maxFramerate = 30; p.degradationPreference = 'maintain-resolution'; });
            else { const T = TIERS[call.tier]; setParams(call.vSender, p => { p.encodings[0].maxBitrate = T.br; p.encodings[0].maxFramerate = T.f; p.degradationPreference = 'balanced'; }); }
        }
    }

    /* ---- UI ---- */
    const setStatus = t => { $('rdCallStatus').textContent = t; };
    function banner(t) { const b = $('rdBanner'); if (!t) { b.hidden = true; return; } b.firstChild.textContent = t; b.hidden = false; }
    function names() {
        if (!call) return;
        ['rdCallName', 'rdInName'].forEach(i => { $(i).textContent = chatName(call.peer); });
        paintAv($('rdCallAv'), call.peer); paintAv($('rdInAv'), call.peer);
    }
    function refreshUI() {
        if (!call) return;
        $('rdCall').classList.toggle('aud', call.kind !== 'video' && !call.remoteShare);
        $('rdCall').classList.toggle('share', !!call.remoteShare);
        $('rdCallMute').className = 'rd-cbtn big' + (call.muted ? ' on' : '');
        $('rdCallMute').innerHTML = ic(call.muted ? 'mic-off' : 'mic', 36);
        $('rdCallCam').className = 'rd-cbtn' + (call.camOff ? ' on' : '');
        $('rdCallCam').innerHTML = ic(call.camOff ? 'video-off' : 'video', 26);
        $('rdCallFlip').innerHTML = ic('flip', 26);
        $('rdCallShare').className = 'rd-cbtn' + (call.share ? ' on' : '');
        $('rdCallShare').innerHTML = ic('screen', 26);
        $('rdInMute').className = 'rd-cbtn' + (call.muted ? ' on' : '');
        $('rdInMute').innerHTML = ic(call.muted ? 'mic-off' : 'mic', 28);
    }
    function showCall(status) { names(); refreshUI(); setStatus(status); $('rdLocal').dataset.size = '1'; $('rdQual').hidden = true; banner(''); $('rdCall').hidden = false; }
    function showIncoming() { names(); $('rdInKind').textContent = 'Incoming ' + (call.kind === 'video' ? 'video' : 'voice') + ' call…'; refreshUI(); $('rdIncoming').hidden = false; }
    const hideIncoming = () => { $('rdIncoming').hidden = true; };

    const newCall = (kind, dir, state) => ({ kind, dir, state, stream: null, camTrack: null, vSender: null, aSender: null, muted: false, camOff: false, facing: 'user', tier: START_TIER, share: null, remoteShare: false, gotTrack: false, negReady: false });
    const vconstraints = T => ({ facingMode: { ideal: call.facing }, width: { ideal: T.w }, height: { ideal: T.h }, frameRate: { ideal: T.f } });

    async function acquireLocal() {
        const video = call.kind === 'video';
        const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 };
        try {
            let s;
            try { s = await navigator.mediaDevices.getUserMedia({ audio, video: video ? vconstraints(TIERS[call.tier]) : false }); }
            catch (e) { if (!video) throw e; s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }); }
            if (!call) { s.getTracks().forEach(t => t.stop()); return false; }
            call.stream = s; call.camTrack = s.getVideoTracks()[0] || null;
            s.getAudioTracks().forEach(t => { t.enabled = !call.muted; try { t.contentHint = 'speech'; } catch (e) {} });
            if (call.camTrack) {
                call.camTrack.enabled = !call.camOff;
                try { call.camTrack.contentHint = 'motion'; } catch (e) {}
                try { const c = call.camTrack.getCapabilities(); call.maxW = (c.width && c.width.max) || 1280; } catch (e) { call.maxW = 1280; }
            }
            const lv = $('rdLocal'); lv.srcObject = s; lv.muted = true; lv.classList.toggle('noflip', call.facing === 'environment'); lv.play().catch(() => {});
            return true;
        } catch (e) { toast('Mic / Camera permission allow karo'); return false; }
    }
    function buildPC() {
        const pc = new RTCPeerConnection(ICE);
        call.pc = pc;
        pc.ontrack = e => {
            if (!remoteStream) remoteStream = new MediaStream();
            if (!remoteStream.getTracks().includes(e.track)) remoteStream.addTrack(e.track);
            const v = $('rdRemote'); if (v.srcObject !== remoteStream) v.srcObject = remoteStream;
            e.track.onended = () => { try { remoteStream && remoteStream.removeTrack(e.track); } catch (x) {} };
            playRemote();
            if (call && call.pc === pc) { call.gotTrack = true; maybeLive(); }
        };
        pc.onconnectionstatechange = () => {
            if (!call || call.pc !== pc) return;
            const s = pc.connectionState;
            if (s === 'connected') maybeLive();
            if (s === 'failed') { toast('Call connect nahi hui — network check karo'); end(true, false, 'failed'); }
            if (s === 'disconnected') setTimeout(() => { if (call && call.pc === pc && pc.connectionState === 'disconnected') end(true, false, 'failed'); }, 9000);
        };
        pc.onnegotiationneeded = async () => {
            if (!call || call.pc !== pc || !call.negReady || pc.signalingState !== 'stable') return;
            try {
                const o = await pc.createOffer(); o.sdp = tuneSDP(o.sdp);
                await pc.setLocalDescription(o); await iceDone(pc, 1500);
                sendSignal(call.peer, { ch: 'call', k: 'reneg', cid: call.id, sdp: pc.localDescription.sdp });
            } catch (e) {}
        };
        call.stream.getTracks().forEach(t => {
            const sender = pc.addTrack(t, call.stream);
            if (t.kind === 'video') { call.vSender = sender; preferCodecs(sender); } else call.aSender = sender;
        });
        return pc;
    }
    const sig = (p) => sendSignal(call.peer, Object.assign({ ch: 'call', cid: call.id }, p)).catch(() => {});

    async function start(peerId, kind) {
        if (call) { toast('Pehle se call chal rahi hai'); return; }
        const c = S.contacts.get(peerId);
        if (!c || c.isBot || isSelf(peerId)) { toast('Is chat me call nahi hoti'); return; }
        if (!window.RTCPeerConnection || !navigator.mediaDevices) { toast('Is browser me call support nahi hai'); return; }
        call = newCall(kind, 'out', 'calling'); call.id = uid(); call.peer = peerId;
        const me = call, cid = call.id;
        showCall(S.online ? 'Calling…' : 'Waiting for network…');
        if (!(await acquireLocal())) { if (call === me) end(false, true); return; }
        try {
            const pc = buildPC();
            const offer = await pc.createOffer(); offer.sdp = tuneSDP(offer.sdp);
            await pc.setLocalDescription(offer); await iceDone(pc, 3000);
            if (call !== me) return;
            await sendSignal(peerId, { ch: 'call', k: 'invite', cid, kind, sdp: pc.localDescription.sdp });
            SFX.ringback();
            setStatus(isOnline(c) || LINK.open(peerId) ? 'Ringing…' : 'Calling…');
            callTimer = setTimeout(() => { if (call === me && call.state === 'calling') { sig({ k: 'end' }); end(false, false, 'noans'); } }, CFG.ringSec * 1000);
        } catch (e) { console.warn('call start', e); if (call === me) { toast('Call start nahi hui'); end(false, true); } }
    }
    function missedNotify(sender, kind) {
        logCall(sender.id, kind, 'in', 'missed');
        sysNotify('Missed ' + (kind === 'video' ? 'video' : 'voice') + ' call', cname(sender), { tag: 'missed-' + sender.id, chat: sender.id });
    }
    async function onSignal(sender, p, ts) {
        try {
            if (p.k === 'invite') {
                if (Date.now() - ts > CFG.ringSec * 1000) { missedNotify(sender, p.kind === 'video' ? 'video' : 'audio'); return; }
                if (call) { if (call.id === p.cid) return; sendSignal(sender.id, { ch: 'call', k: 'busy', cid: p.cid }).catch(() => {}); logCall(sender.id, p.kind === 'video' ? 'video' : 'audio', 'in', 'missed'); return; }
                call = newCall(p.kind === 'video' ? 'video' : 'audio', 'in', 'ringing');
                call.id = p.cid; call.peer = sender.id; call.offer = p.sdp;
                showIncoming(); SFX.ring();
                if (document.hidden) sysNotify('Incoming ' + (call.kind === 'video' ? 'video' : 'voice') + ' call', cname(sender), { tag: 'call', sticky: true, call: true, chat: sender.id, vibrate: [400, 200, 400, 200, 400] });
                const me = call;
                callTimer = setTimeout(() => { if (call === me && call.state === 'ringing') { hideIncoming(); SFX.stop(); missedNotify(sender, me.kind); call = null; } }, Math.max(3000, CFG.ringSec * 1000 - (Date.now() - ts)));
                return;
            }
            if (!call || p.cid !== call.id || sender.id !== call.peer) return;
            if (p.k === 'answer') {
                if (call.dir === 'out' && call.state === 'calling') {
                    clearTimeout(callTimer); SFX.stop();
                    call.state = 'connecting'; setStatus('Connecting…');
                    await call.pc.setRemoteDescription({ type: 'answer', sdp: p.sdp });
                    call.negReady = true;
                    call.watch = setTimeout(() => { if (call && call.state !== 'live') { toast('Call connect nahi hui — network check karo'); end(true, false, 'failed'); } }, 25000);
                }
            } else if (p.k === 'reject') { if (call.dir === 'out') { logCall(call.peer, call.kind, 'out', 'declined'); end(false, true); } }
            else if (p.k === 'busy') { if (call.dir === 'out') { logCall(call.peer, call.kind, 'out', 'busy'); end(false, true); } }
            else if (p.k === 'screen') {
                call.remoteShare = !!p.on; refreshUI();
                banner(p.on ? chatName(call.peer) + ' is sharing screen' : ''); if (p.on) setTimeout(() => banner(''), 3500);
            } else if (p.k === 'reneg') {
                if (call.pc && call.pc.signalingState === 'stable') {
                    await call.pc.setRemoteDescription({ type: 'offer', sdp: p.sdp });
                    const a = await call.pc.createAnswer(); a.sdp = tuneSDP(a.sdp);
                    await call.pc.setLocalDescription(a); await iceDone(call.pc, 1500);
                    sig({ k: 'reneg-ans', sdp: call.pc.localDescription.sdp });
                }
            } else if (p.k === 'reneg-ans') { if (call.pc && call.pc.signalingState === 'have-local-offer') await call.pc.setRemoteDescription({ type: 'answer', sdp: p.sdp }); }
            else if (p.k === 'end') {
                if (call.state === 'ringing') { clearTimeout(callTimer); hideIncoming(); SFX.stop(); missedNotify(sender, call.kind); call = null; }
                else end(false);
            }
        } catch (e) { console.warn('call signal', e); }
    }
    async function accept() {
        if (!call || call.state !== 'ringing') return;
        clearTimeout(callTimer); SFX.stop(); hideIncoming();
        call.state = 'connecting'; showCall('Connecting…');
        const me = call;
        if (!(await acquireLocal())) { if (call === me) { sig({ k: 'end' }); end(false, true); } return; }
        try {
            const pc = buildPC();
            await pc.setRemoteDescription({ type: 'offer', sdp: call.offer });
            const ans = await pc.createAnswer(); ans.sdp = tuneSDP(ans.sdp);
            await pc.setLocalDescription(ans); await iceDone(pc, 3000);
            if (call !== me) return;
            await sig({ k: 'answer', sdp: pc.localDescription.sdp });
            call.negReady = true;
            call.watch = setTimeout(() => { if (call && call.state !== 'live') { toast('Call connect nahi hui — network check karo'); end(true, false, 'failed'); } }, 25000);
        } catch (e) { console.warn('accept', e); if (call === me) { sig({ k: 'end' }); end(false, true); } }
    }
    function reject() {
        if (!call || call.state !== 'ringing') return;
        clearTimeout(callTimer); SFX.stop();
        sig({ k: 'reject' });
        hideIncoming(); logCall(call.peer, call.kind, 'in', 'declined'); call = null;
    }
    function playRemote() {
        const v = $('rdRemote'), pr = v.play();
        if (pr && pr.catch) pr.catch(() => { toast('Awaaz ke liye screen par ek baar tap karo'); $('rdCall').addEventListener('click', () => v.play().catch(() => {}), { once: true }); });
    }
    function maybeLive() { if (call && call.state !== 'live' && call.gotTrack && call.pc && call.pc.connectionState === 'connected') live(); }
    function live() {
        if (!call || call.state === 'live') return;
        clearTimeout(call.watch); SFX.stop(); playRemote();
        call.state = 'live'; call.t0 = Date.now(); setStatus('00:00');
        clearInterval(callTick); callTick = setInterval(() => { if (call && call.t0) setStatus(fmtDur(Date.now() - call.t0)); }, 1000);
        tuneSenders(); setTimeout(tuneSenders, 1500);
        $('rdQual').hidden = false; $('rdQual').textContent = call.kind === 'video' ? TIERS[call.tier].n : 'HD Voice';
        clearInterval(call.qt); call.qt = setInterval(qualityTick, 2000);
        emit('calllive');
    }
    const maxTierByCamera = () => { const w = call.maxW || 1280; let m = 0; for (let i = 0; i < TIERS.length; i++) if (TIERS[i].w <= w * 1.05) m = i; return m; };
    async function setTier(i) {
        if (!call || !call.camTrack) return;
        call.tier = i; const T = TIERS[i];
        try { await call.camTrack.applyConstraints({ width: { ideal: T.w }, height: { ideal: T.h }, frameRate: { ideal: T.f } }); } catch (e) {}
        setParams(call.vSender, p => { p.encodings[0].maxBitrate = T.br; p.encodings[0].maxFramerate = T.f; p.degradationPreference = 'balanced'; });
    }
    // har 2 sec: network dekho — achha net = quality upar (4K tak), kamzor = neeche, bahut kamzor = video pause (voice chalti rahe)
    async function qualityTick() {
        if (!call || call.state !== 'live' || !call.pc) return;
        let st; try { st = await call.pc.getStats(); } catch (e) { return; }
        let selId = null; st.forEach(r => { if (r.type === 'transport' && r.selectedCandidatePairId) selId = r.selectedCandidatePairId; });
        const pair = selId ? st.get(selId) : null;
        const avail = (pair && pair.availableOutgoingBitrate) || 0, rtt = (pair && pair.currentRoundTripTime) || 0;
        let loss = 0, vBytes = 0;
        st.forEach(r => { if (r.type === 'remote-inbound-rtp' && typeof r.fractionLost === 'number') loss = Math.max(loss, r.fractionLost); if (r.type === 'outbound-rtp' && r.kind === 'video') vBytes += r.bytesSent || 0; });
        const now = Date.now(), rate = call.lastT ? (vBytes - call.lastBytes) * 8 / ((now - call.lastT) / 1000) : 0;
        call.lastBytes = vBytes; call.lastT = now;
        const weak = loss > 0.25 || rtt > 0.9, veryWeak = loss > 0.45 || rtt > 1.6 || (avail > 0 && avail < 150e3);
        call.weakN = weak ? (call.weakN || 0) + 1 : 0; call.vweakN = veryWeak ? (call.vweakN || 0) + 1 : 0;
        let label = 'HD Voice';
        if (call.kind === 'video' && call.camTrack && !call.share) {
            if (call.vweakN >= 2 && !call.autoPaused && !call.camOff) { call.autoPaused = true; call.camTrack.enabled = false; banner('Weak network — video pause, voice chal rahi hai'); }
            else if (call.autoPaused && call.weakN === 0) { call.recov = (call.recov || 0) + 1; if (call.recov >= 3) { call.autoPaused = false; call.recov = 0; call.camTrack.enabled = !call.camOff; banner(''); } }
            let target = call.tier;
            if (avail > 0) { target = 0; for (let i = 0; i < TIERS.length; i++) if (TIERS[i].need <= avail * 0.75) target = i; if (weak) target = Math.max(0, target - 2); }
            target = Math.min(target, maxTierByCamera());
            if (target < call.tier) { call.up = 0; await setTier(target); }
            else if (target > call.tier) { call.up = (call.up || 0) + 1; if (call.up >= 2) { call.up = 0; await setTier(Math.min(target, call.tier + 2)); } }
            label = call.autoPaused ? 'Audio only' : TIERS[call.tier].n;
        } else if (call.share) { label = 'Screen share'; setParams(call.vSender, p => { p.encodings[0].maxBitrate = weak ? 1.5e6 : 8e6; }); }
        $('rdQual').textContent = label + (rate > 20e3 ? ' • ' + (rate / 1e6).toFixed(1) + ' Mbps' : '') + (weak ? ' • weak net' : '');
    }
    function end(sendEnd, silent, result) {
        if (!call) return;
        const c = call; call = null;
        clearTimeout(callTimer); clearInterval(callTick); clearTimeout(c.watch); clearInterval(c.qt); SFX.stop();
        if (sendEnd) sendSignal(c.peer, { ch: 'call', k: 'end', cid: c.id }).catch(() => {});
        if (c.share) { try { c.share.track.onended = null; c.share.track.stop(); } catch (e) {} }
        if (c.stream) c.stream.getTracks().forEach(t => t.stop());
        try { c.pc && c.pc.close(); } catch (e) {}
        remoteStream = null;
        $('rdRemote').srcObject = null; $('rdLocal').srcObject = null;
        $('rdCall').hidden = true; $('rdQual').hidden = true; banner(''); hideIncoming();
        if (!silent) {
            if (c.t0) { logCall(c.peer, c.kind, c.dir, 'ok', Date.now() - c.t0); SFX.end(); }
            else logCall(c.peer, c.kind, c.dir, result || (c.state === 'calling' ? 'cancelled' : 'failed'));
        }
    }
    function toggleMute() { if (!call) return; call.muted = !call.muted; if (call.stream) call.stream.getAudioTracks().forEach(t => { t.enabled = !call.muted; }); refreshUI(); }
    function toggleCam() { if (!call || call.kind !== 'video') return; call.camOff = !call.camOff; if (call.camTrack && !call.autoPaused) call.camTrack.enabled = !call.camOff; refreshUI(); }
    async function flipCamera() {
        if (!call || call.kind !== 'video' || !call.stream) return;
        const next = call.facing === 'user' ? 'environment' : 'user';
        try {
            const T = TIERS[call.tier];
            const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: next }, width: { ideal: T.w }, height: { ideal: T.h }, frameRate: { ideal: T.f } } });
            const nt = ns.getVideoTracks()[0]; nt.enabled = !call.camOff && !call.autoPaused;
            try { nt.contentHint = 'motion'; } catch (e) {}
            const old = call.camTrack;
            if (call.vSender && !call.share) await call.vSender.replaceTrack(nt);
            if (old) { call.stream.removeTrack(old); old.stop(); }
            call.stream.addTrack(nt); call.camTrack = nt; call.facing = next;
            try { const c = nt.getCapabilities(); call.maxW = (c.width && c.width.max) || call.maxW; } catch (e) {}
            const lv = $('rdLocal'); lv.srcObject = call.stream; lv.classList.toggle('noflip', next === 'environment'); lv.play().catch(() => {});
        } catch (e) { toast('Camera switch nahi hui'); }
    }
    async function toggleShare() {
        if (!call) return;
        if (call.share) { stopShare(); return; }
        if (call.state !== 'live') { toast('Pehle call connect hone do'); return; }
        if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) { toast('Is device/browser me screen share support nahi hai (Android Chrome me nahi hota, laptop par hota hai)'); return; }
        let ds; try { ds = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); } catch (e) { return; }
        const track = ds.getVideoTracks()[0];
        try { track.contentHint = 'detail'; } catch (e) {}
        call.share = { stream: ds, track };
        if (call.vSender) { try { await call.vSender.replaceTrack(track); } catch (e) {} }
        else { call.vSender = call.pc.addTrack(track, ds); preferCodecs(call.vSender); call.shareAdded = true; }
        track.onended = () => stopShare();
        sig({ k: 'screen', on: true }); refreshUI(); banner('Screen share chal rahi hai'); setTimeout(() => banner(''), 3000);
        setTimeout(tuneSenders, 1200); setTimeout(tuneSenders, 3000);
    }
    async function stopShare() {
        if (!call || !call.share) return;
        const sh = call.share; call.share = null;
        try { sh.track.onended = null; sh.track.stop(); } catch (e) {}
        if (call.shareAdded) { try { call.pc.removeTrack(call.vSender); } catch (e) {} call.vSender = null; call.shareAdded = false; }
        else if (call.vSender && call.camTrack) { try { await call.vSender.replaceTrack(call.camTrack); } catch (e) {} }
        sig({ k: 'screen', on: false }); refreshUI(); banner(''); tuneSenders();
    }
    return { start, accept, reject, end, onSignal, toggleMute, toggleCam, flipCamera, toggleShare, active: () => !!call, cycleLocal() { const l = $('rdLocal'); l.dataset.size = String((Number(l.dataset.size) % 3) + 1); } };
})();

/* ---- call log (system message in the chat) ---- */
function clText(c) {
    const kt = c.kind === 'video' ? 'Video call' : 'Voice call';
    switch (c.result) {
        case 'ok': return kt + ' • ' + durText(c.dur || 0);
        case 'missed': return 'Missed ' + kt.toLowerCase();
        case 'declined': return 'Declined ' + kt.toLowerCase();
        case 'cancelled': return 'Cancelled ' + kt.toLowerCase();
        case 'noans': return kt + ' • No answer';
        case 'busy': return kt + ' • Busy';
        default: return kt + ' • Not connected';
    }
}
async function logCall(chat, kind, dir, result, dur) {
    await ensureChat(chat);
    const cl = { kind, dir, result, dur: dur || 0 };
    addMsg({ id: 'cl' + uid(), chat, from: dir === 'out' ? 'me' : 'peer', uid: dir === 'out' ? S.me.id : chat, ts: Date.now(), text: clText(cl), system: true, sk: 'call', cl, local: true, status: 'sent', read: dir === 'out' || result === 'ok', reactions: {} });
}

/* ------------------------------ BOTS ------------------------------
   Bot = apni alag identity (key) + user doc (isBot). Jab tak app khula hai owner ke browser me chalta hai.
   Rules (contains / equals / starts / regex) + welcome/fallback. Telegram / Discord / webhook forwarding. */
const BOTS = (function () {
    const tgPoll = {};
    const norm = s => String(s || '').toLowerCase().trim();
    function matchRule(r, text) {
        const t = norm(text), p = norm(r.pattern);
        if (!p && r.type !== 'any') return false;
        switch (r.type) {
            case 'equals': return t === p;
            case 'starts': return t.startsWith(p);
            case 'regex': try { return new RegExp(r.pattern, 'i').test(text); } catch (e) { return false; }
            case 'any': return true;
            default: return t.includes(p);
        }
    }
    const fill = (s, ctx) => String(s || '').replace(/\{name\}/g, ctx.name || '').replace(/\{username\}/g, ctx.username || '').replace(/\{time\}/g, new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })).replace(/\{date\}/g, new Date().toLocaleDateString());
    function answer(bot, text, ctx, first) {
        for (const r of bot.rules || []) { if (r.on !== false && r.reply && matchRule(r, text)) return fill(r.reply, ctx); }
        if (first && bot.welcome) return fill(bot.welcome, ctx);
        return bot.fallback ? fill(bot.fallback, ctx) : '';
    }
    async function tgSend(token, chat, text) {
        const r = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text }) });
        const j = await r.json().catch(() => ({})); if (!j.ok) throw new Error(j.description || 'Telegram error'); return j;
    }
    async function tgDetectChat(token) {
        const r = await fetch('https://api.telegram.org/bot' + token + '/getUpdates?limit=20'); const j = await r.json();
        if (!j.ok) throw new Error(j.description || 'Invalid token');
        const u = (j.result || []).reverse().find(x => x.message || x.channel_post || x.my_chat_member);
        const m = u && (u.message || u.channel_post || (u.my_chat_member && { chat: u.my_chat_member.chat }));
        return m && m.chat ? String(m.chat.id) : '';
    }
    async function forward(bot, sender, text) {
        const f = bot.fwd || {}, who = (sender.name || sender.username || 'user') + ' (@' + (sender.username || '?') + ')';
        const line = '[' + bot.name + '] ' + who + ': ' + text;
        const jobs = [];
        if (f.tgOn && f.tgToken) jobs.push((async () => {
            let chat = f.tgChat; if (!chat) { chat = await tgDetectChat(f.tgToken); if (chat) { f.tgChat = chat; save(bot); } }
            if (!chat) throw new Error('Telegram chat id nahi mili — bot ko pehle ek message bhejo');
            await tgSend(f.tgToken, chat, line);
        })());
        if (f.dcOn && f.dcUrl) jobs.push(fetch(f.dcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: line.slice(0, 1900), username: bot.name }) }));
        if (f.whOn && f.whUrl) jobs.push(fetch(f.whUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bot: bot.username, from: sender.username, name: sender.name, text, ts: Date.now() }) }).catch(() => fetch(f.whUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ bot: bot.username, from: sender.username, text }) })));
        await Promise.allSettled(jobs);
    }
    const save = b => dbPut('bots', { id: b.id, ident: b.ident, name: b.name, username: b.username, avatar: b.avatar || '', rules: b.rules, welcome: b.welcome, fallback: b.fallback, fwd: b.fwd, on: b.on, greeted: b.greeted || {}, bio: b.bio || '' });
    async function reply(bot, to, text) {
        if (!text) return;
        await dispatchTo(bot.id, [to], '', { t: 'msg', mid: uid(), text }, {});
    }
    return {
        save, matchRule, tgSend, tgDetectChat,
        async onInbound(bot, sender, p) {
            if (!bot.on || p.t !== 'msg') return;
            const text = String(p.text || '').trim();
            if (!text && !p.media) return;
            const ctx = { name: sender.name, username: sender.username };
            const first = !(bot.greeted || (bot.greeted = {}))[sender.id];
            bot.greeted[sender.id] = 1; save(bot);
            const rep = answer(bot, text, ctx, first);
            if (rep) { await sleep(500 + Math.random() * 600); await reply(bot, sender.id, rep); }
            forward(bot, sender, text || '[media]').catch(e => console.warn('bot forward', e));
        },
        async create(name, username) {
            const ident = await CR.genIdentity();
            const d = await API.createBotUser({ username, name, bio: 'Ping bot', avatar: '', pub: ident.pub, lastSeen: Date.now(), isBot: true, owner: S.me.id, note: '', noteTs: 0, music: '' }, S.me.id);
            const b = { id: d.$id, ident, name, username, avatar: '', rules: [], welcome: 'Hi {name}! 👋 Main {username} bot hoon.', fallback: '', fwd: {}, on: true, greeted: {}, bio: 'Ping bot' };
            S.bots.set(b.id, b); await save(b); emit('bots'); startBotPresence(); subscribeSoon();
            return b;
        },
        async remove(b) { try { await API.deleteUser(b.id); } catch (e) {} S.bots.delete(b.id); await dbDel('bots', b.id); stopTg(b.id); emit('bots'); },
        async update(b, patch) {
            Object.assign(b, patch); await save(b);
            if (patch.name != null || patch.avatar != null || patch.bio != null) { try { await API.updateUser(b.id, { name: b.name, avatar: b.avatar || '', bio: b.bio || '' }); } catch (e) {} }
            emit('bots');
        },
        // Telegram -> bot rules -> reply on Telegram (polling, jab tak app khula hai)
        startTg(b) {
            stopTg(b.id);
            const f = b.fwd || {}; if (!(f.tgPoll && f.tgToken)) return;
            const st = tgPoll[b.id] = { off: 0, stop: false };
            (async () => {
                while (!st.stop && S.bots.has(b.id) && b.fwd.tgPoll) {
                    try {
                        if (!S.online || b.on === false) { await sleep(5000); continue; }
                        const r = await fetch('https://api.telegram.org/bot' + f.tgToken + '/getUpdates?timeout=20&offset=' + st.off);
                        const j = await r.json();
                        if (!j.ok) { await sleep(8000); continue; }
                        for (const u of j.result || []) {
                            st.off = u.update_id + 1;
                            const m = u.message; if (!m || !m.text) continue;
                            if (!f.tgChat) { f.tgChat = String(m.chat.id); save(b); }
                            const ans = answer(b, m.text, { name: (m.from && m.from.first_name) || '', username: (m.from && m.from.username) || '' }, false);
                            if (ans) await tgSend(f.tgToken, m.chat.id, ans).catch(() => {});
                        }
                    } catch (e) { await sleep(6000); }
                }
            })();
        },
        stopTg: id => stopTg(id)
    };
    function stopTg(id) { if (tgPoll[id]) { tgPoll[id].stop = true; delete tgPoll[id]; } }
})();
async function botHeartbeat() { if (!S.online) return; for (const b of S.bots.values()) { try { await API.updateUser(b.id, { lastSeen: b.on === false ? 0 : Date.now() }); } catch (e) {} } }
let botHbT = null;
function startBotPresence() { if (botHbT || !S.bots.size) return; botHeartbeat(); botHbT = setInterval(botHeartbeat, 60000); }

/* ------------------------------ UI CORE: theme, nav, dialogs, crop, viewer ------------------------------ */
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme() {
    const t = S.set.theme || 'auto';
    const dark = t === 'dark' || (t === 'auto' && mq && mq.matches);
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('ping_theme', t); } catch (e) {}
    let m = document.querySelector('meta[name=theme-color]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    m.content = dark ? '#202c33' : '#ffffff';
}
if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (S.set.theme === 'auto') applyTheme(); });

/* ---- history-backed navigation stack (Android back button works) ---- */
const nav = (function () {
    const stack = []; let skip = 0, pend = 0;
    const doPush = () => { try { history.pushState({ pg: 1 }, ''); } catch (e) {} };
    function push(key, fn) { stack.push({ key, fn }); if (skip > 0) pend++; else doPush(); }
    function close(key) {
        const i = stack.findIndex(x => x.key === key); if (i < 0) return;
        const ent = stack.splice(i, 1)[0];
        try { ent.fn(); } catch (e) { console.error(e); }
        if (i === stack.length) { skip++; try { history.back(); } catch (e) { skip--; } }
    }
    window.addEventListener('popstate', () => {
        if (skip > 0) { skip--; if (skip === 0 && pend > 0) { for (let i = 0; i < pend; i++) doPush(); pend = 0; } return; }
        const ent = stack.pop();
        if (ent) { try { ent.fn(); } catch (e) { console.error(e); } }
        else if (S.me) { doPush(); }
    });
    return { push, close, has: k => stack.some(x => x.key === k), top: () => stack.length ? stack[stack.length - 1].key : null, size: () => stack.length };
})();

function openPage(title, o) {
    o = o || {};
    const el = document.createElement('div'); el.className = 'pg-page';
    el.innerHTML = '<div class="rd-head"><button class="rd-ibtn" data-b>' + ic('back', 24) + '</button><h2>' + esc(title) + '</h2>' + (o.right || '') + '</div><div class="pg-body"></div>';
    $('rdApp').appendChild(el);
    const P = { el, body: el.querySelector('.pg-body'), setTitle: t => { el.querySelector('h2').textContent = t; }, close: () => nav.close(P) };
    el.querySelector('[data-b]').onclick = () => nav.close(P);
    nav.push(P, () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); if (o.onClose) o.onClose(); });
    return P;
}

/* ---- popups, dialogs, sheets (inside #rdLayer) ---- */
let layerClose = null;
function closeLayer() { const L = $('rdLayer'); L.hidden = true; L.innerHTML = ''; const f = layerClose; layerClose = null; if (f) f(); }
function openLayer(inner, onClose) {
    const L = $('rdLayer'); layerClose = null; L.innerHTML = '<div class="rd-back" data-x></div>' + inner; L.hidden = false; layerClose = onClose || null;
    L.querySelector('[data-x]').onclick = closeLayer; return L;
}
function menu(items, o) {
    o = o || {};
    const html = '<div class="rd-pop" style="top:calc(56px + env(safe-area-inset-top));right:10px">' + (o.title ? '<div class="ttl">' + esc(o.title) + '</div>' : '') +
        items.filter(Boolean).map((it, i) => '<button data-i="' + i + '" style="' + (it.danger ? 'color:#e53935' : '') + '">' + (it.icon ? ic(it.icon, 20) : '') + esc(it.label) + '</button>').join('') + '</div>';
    const L = openLayer(html), list = items.filter(Boolean);
    L.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { closeLayer(); list[+b.dataset.i].fn && list[+b.dataset.i].fn(); });
}
function dialog(title, msg, buttons, o) {
    o = o || {};
    return new Promise(res => {
        let done = false; const fin = v => { if (done) return; done = true; res(v); };
        const html = '<div class="pg-dlg"><h3 style="margin:0 0 8px;font-size:19px">' + esc(title) + '</h3>' + (msg ? '<p style="margin:0 0 10px;color:var(--sub);font-size:15px;line-height:1.4">' + esc(msg) + '</p>' : '') +
            (o.input ? '<input class="pg-in" id="pgDlgIn" style="width:100%;margin:4px 0 8px" placeholder="' + esc(o.placeholder || '') + '" value="' + esc(o.value || '') + '" maxlength="' + (o.max || 200) + '">' : '') +
            '<div class="pg-dbtns">' + buttons.map((b, i) => '<button data-i="' + i + '" class="' + (b.danger ? 'red' : '') + '">' + esc(b.label) + '</button>').join('') + '</div></div>';
        const L = openLayer(html, () => fin(null));
        L.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const v = o.input ? $('pgDlgIn').value : buttons[+b.dataset.i].val; const bv = buttons[+b.dataset.i].val; closeLayer(); fin(o.input ? (bv === false || bv === null ? null : v) : bv); });
        if (o.input) setTimeout(() => { const i = $('pgDlgIn'); if (i) { i.focus(); i.select(); } }, 60);
    });
}
const confirmBox = (t, m, ok, danger) => dialog(t, m, [{ label: 'Cancel', val: false }, { label: ok || 'OK', val: true, danger }]).then(v => v === true);
const promptBox = (t, ph, val, max) => dialog(t, '', [{ label: 'Cancel', val: null }, { label: 'OK', val: true }], { input: true, placeholder: ph, value: val, max });
function sheet(items) {
    const html = '<div class="rd-sheet">' + items.map((it, i) => '<button data-i="' + i + '"><i style="background:' + it.color + '">' + ic(it.icon, 26) + '</i>' + esc(it.label) + '</button>').join('') + '</div>';
    const L = openLayer(html);
    L.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { closeLayer(); items[+b.dataset.i].fn(); });
}
function pickFile(accept, multiple) {
    return new Promise(res => {
        const i = document.createElement('input'); i.type = 'file'; i.accept = accept || ''; i.multiple = !!multiple; i.style.display = 'none';
        i.onchange = () => { const f = Array.from(i.files || []); i.remove(); res(f); };
        i.oncancel = () => { i.remove(); res([]); };
        document.body.appendChild(i); i.click();
    });
}
const blobToDataURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
async function downscale(file, max, q) {
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
        const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return await new Promise(r => c.toBlob(r, 'image/jpeg', q || .85));
    } finally { URL.revokeObjectURL(url); }
}

/* ---- Instagram-style crop ---- */
function cropImage(file) {
    return new Promise(async resolve => {
        const url = URL.createObjectURL(file);
        const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
        if (!img) { URL.revokeObjectURL(url); toast('Photo khul nahi payi'); resolve(null); return; }
        const root = $('rdCrop'), box = $('rdCropBox'), cv = $('rdCropCv'), zoom = $('rdCropZoom'), N = 640;
        const size = Math.floor(Math.min(innerWidth - 40, innerHeight * .52, 380));
        box.style.width = box.style.height = size + 'px'; cv.width = cv.height = N;
        let rot = 0, z = 1, ox = 0, oy = 0, finished = false;
        zoom.value = 1;
        const dims = () => (rot % 2 ? [img.height, img.width] : [img.width, img.height]);
        const base = () => { const [w, h] = dims(); return Math.max(N / w, N / h); };
        function clamp() { const [w, h] = dims(), s = base() * z, mx = Math.max(0, (w * s - N) / 2), my = Math.max(0, (h * s - N) / 2); ox = Math.max(-mx, Math.min(mx, ox)); oy = Math.max(-my, Math.min(my, oy)); }
        function draw(c, n) {
            const g = c.getContext('2d'), k = n / N; g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
            g.save(); g.translate(n / 2 + ox * k, n / 2 + oy * k); g.rotate(rot * Math.PI / 2); const s = base() * z * k; g.scale(s, s); g.drawImage(img, -img.width / 2, -img.height / 2); g.restore();
        }
        const render = () => { clamp(); draw(cv, N); };
        let pid = null, lx = 0, ly = 0;
        box.onpointerdown = e => { pid = e.pointerId; lx = e.clientX; ly = e.clientY; try { box.setPointerCapture(pid); } catch (x) {} };
        box.onpointermove = e => { if (e.pointerId !== pid) return; const k = N / size; ox += (e.clientX - lx) * k; oy += (e.clientY - ly) * k; lx = e.clientX; ly = e.clientY; render(); };
        box.onpointerup = box.onpointercancel = () => { pid = null; };
        box.onwheel = e => { e.preventDefault(); z = Math.max(1, Math.min(4, z - e.deltaY * .002)); zoom.value = z; render(); };
        zoom.oninput = () => { z = +zoom.value; render(); };
        $('rdCropRot').onclick = () => { rot = (rot + 1) % 4; ox = oy = 0; render(); };
        const end = out => { if (finished) return; finished = true; root.hidden = true; URL.revokeObjectURL(url); resolve(out); };
        $('rdCropBack').onclick = () => nav.close('crop');
        $('rdCropOk').onclick = () => {
            const o = document.createElement('canvas'); o.width = o.height = 512; draw(o, 512);
            o.toBlob(b => { nav.close('crop'); end(b); }, 'image/jpeg', .9);
        };
        root.hidden = false; render();
        nav.push('crop', () => end(null));
    });
}

/* ---- image / video viewer ---- */
function openViewer(src, kind, letterEl) {
    const v = $('rdViewer'), img = $('rdViewerImg'); let vid = $('rdViewerVid');
    if (!vid) { vid = document.createElement('video'); vid.id = 'rdViewerVid'; vid.controls = true; vid.playsInline = true; v.appendChild(vid); }
    const isVid = kind === 'video';
    img.hidden = isVid || !src; vid.hidden = !isVid; $('rdViewerLetter').hidden = true;
    if (isVid) { vid.src = src; vid.play().catch(() => {}); } else { img.src = src; }
    v.hidden = false;
    nav.push('viewer', () => { v.hidden = true; try { vid.pause(); } catch (e) {} vid.removeAttribute('src'); img.removeAttribute('src'); });
}
function openPlayer(id, title) {
    let p = $('rdPlayer');
    if (!p) { p = document.createElement('div'); p.id = 'rdPlayer'; p.hidden = true; $('rdApp').appendChild(p); }
    p.innerHTML = '<div class="ph"><button class="rd-ibtn" id="rdPlayerX">' + ic('back', 22) + '</button><b>' + esc(title || 'Video') + '</b></div><iframe allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen src="https://www.youtube.com/embed/' + encodeURIComponent(id) + '?autoplay=1&playsinline=1&rel=0"></iframe>';
    p.hidden = false; p.style.zIndex = 165;
    $('rdPlayerX').onclick = () => nav.close('player');
    nav.push('player', () => { p.hidden = true; p.innerHTML = ''; });
}

/* ---- links ---- */
function ytId(u) {
    try {
        const x = new URL(u); const h = x.hostname.replace(/^www\.|^m\.|^music\./, '');
        if (h === 'youtu.be') return x.pathname.slice(1).split('/')[0] || '';
        if (h === 'youtube.com') { if (x.pathname === '/watch') return x.searchParams.get('v') || ''; const m = x.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/); return m ? m[2] : ''; }
    } catch (e) {}
    return '';
}
const isYT = u => { try { return /(^|\.)(youtube\.com|youtu\.be)$/.test(new URL(u).hostname); } catch (e) { return false; } };
function openLink(u, title) { const id = ytId(u); if (id) openPlayer(id, title || 'YouTube'); else window.open(u, '_blank', 'noopener'); }
function firstUrl(t) { const m = String(t || '').match(/https?:\/\/[^\s<>"']+/i); return m ? m[0].replace(/[).,!?]+$/, '') : ''; }
function linkify(escaped) { return escaped.replace(/(https?:\/\/[^\s<>"']+)/gi, u => { const cl = u.replace(/[).,!?]+$/, ''); return '<a class="rd-a" data-href="' + cl + '">' + cl + '</a>' + u.slice(cl.length); }); }

/* ---- wallpapers ---- */
const WALLS = [
    { id: 'doodle', n: 'Doodle' },
    { id: 'plain', n: 'Plain', l: '#efeae2', d: '#0b141a' },
    { id: 'mint', n: 'Mint', l: 'linear-gradient(160deg,#d9fdd3,#a8e6cf)', d: 'linear-gradient(160deg,#0b3d33,#0b141a)' },
    { id: 'sky', n: 'Sky', l: 'linear-gradient(160deg,#e0f2ff,#b6c8ff)', d: 'linear-gradient(160deg,#16243d,#0b141a)' },
    { id: 'sunset', n: 'Sunset', l: 'linear-gradient(160deg,#ffe3d1,#ffb8c6)', d: 'linear-gradient(160deg,#3d1f2b,#0b141a)' },
    { id: 'lav', n: 'Lavender', l: 'linear-gradient(160deg,#ece3ff,#cfc2ff)', d: 'linear-gradient(160deg,#272047,#0b141a)' },
    { id: 'night', n: 'Night', l: 'linear-gradient(160deg,#243b55,#141e30)', d: 'linear-gradient(160deg,#0a1220,#000)' }
];
const WALLIMG = {};
async function wallImg(key) { if (WALLIMG[key] === undefined) WALLIMG[key] = (await kvGet('wallimg:' + key, '')) || ''; return WALLIMG[key]; }
async function applyWall(chatId) {
    const el = $('rdMsgs'); if (!el) return;
    const c = chatId && chatOf(chatId), w = (c && c.wall) || S.set.wall || { id: 'doodle' }, key = c && c.wall ? chatId : 'all';
    const dark = document.documentElement.classList.contains('dark');
    el.style.background = ''; el.style.backgroundSize = '';
    if (w.id === 'img') { const u = await wallImg(key); if (u) { el.style.background = 'linear-gradient(rgba(0,0,0,' + (dark ? .35 : .08) + '),rgba(0,0,0,' + (dark ? .35 : .08) + ')),url(' + u + ') center/cover'; } return; }
    const p = WALLS.find(x => x.id === w.id);
    if (p && p.l) el.style.background = dark ? p.d : p.l;
}
function wallSheet(chatId) {
    const cur = (chatId && chatOf(chatId) && chatOf(chatId).wall) || (!chatId && S.set.wall) || null;
    const dark = document.documentElement.classList.contains('dark');
    const sw = WALLS.map(w => '<div class="rd-bgsw ' + (cur && cur.id === w.id || (!cur && w.id === 'doodle') ? 'on' : '') + '" data-w="' + w.id + '" style="background:' + (w.l ? (dark ? w.d : w.l) : 'var(--bg)') + '"><span>' + w.n + '</span></div>').join('') +
        '<div class="rd-bgsw ' + (cur && cur.id === 'img' ? 'on' : '') + '" data-w="__up" style="background:var(--bar);color:var(--tx)"><span>' + ic('image', 14) + ' Gallery</span></div>';
    const L = openLayer('<div class="rd-bgsheet"><h3>Chat wallpaper</h3><div class="rd-bggrid">' + sw + '</div>' + (chatId ? '<button class="pg-btn ghost" id="wReset" style="margin:10px 0 0;width:100%">Use default for this chat</button>' : '') + '</div>');
    const set = async w => {
        if (chatId) { const c = chatOf(chatId); c.wall = w; await saveChat(c); } else await saveSettings({ wall: w });
        closeLayer(); applyWall(S.cur);
    };
    L.querySelectorAll('[data-w]').forEach(b => b.onclick = async () => {
        if (b.dataset.w === '__up') {
            const f = (await pickFile('image/*'))[0]; if (!f) return;
            const du = await blobToDataURL(await downscale(f, 1400, .8)), key = chatId || 'all';
            await kvSet('wallimg:' + key, du); WALLIMG[key] = du; await set({ id: 'img' });
        } else set({ id: b.dataset.w });
    });
    const r = $('wReset'); if (r) r.onclick = async () => { const c = chatOf(chatId); c.wall = null; await saveChat(c); closeLayer(); applyWall(S.cur); };
}

/* ---- avatars upload ---- */
async function pickAndCropPhoto() {
    const f = (await pickFile('image/*'))[0]; if (!f) return null;
    return cropImage(f);
}
async function uploadAvatar(blob) {
    const id = await API.uploadFile(blob, 'avatar.jpg', { type: 'image/jpeg', del: [S.me.id] });
    return id;
}

/* ------------------------------ UI: chat list + chat screen ------------------------------ */
const CHAT = { win: 80, sel: new Set(), edit: null, reply: null, rec: null };
const chatKey = { k: 'chat' };

function showScreen(id) { document.querySelectorAll('#rdApp > .rd-screen').forEach(s => s.classList.toggle('active', s.id === id)); }
const isImg = m => m.media && /^image\//.test(m.media.type || '');
const isVid = m => m.media && /^video\//.test(m.media.type || '');
const isAud = m => m.media && /^audio\//.test(m.media.type || '');
function previewText(m) {
    if (!m) return '';
    if (m.system) return m.text;
    if (m.deleted) return 'This message was deleted';
    if (m.media) return (isImg(m) ? '📷 Photo' : isVid(m) ? '🎥 Video' : m.voice ? '🎤 Voice message' : isAud(m) ? '🎵 Audio' : '📄 ' + (m.media.name || 'File')) + (m.text ? ' · ' + m.text : '');
    return m.text;
}
const nameOfUid = uid => (uid === S.me.id ? 'You' : cname(S.contacts.get(uid)));

/* ======================= CHAT LIST ======================= */
let chatQ = '';
function storyMap() {
    const mp = new Map();
    (S.stories || []).forEach(s => { if (s.exp < Date.now()) return; if (s.userId !== S.me.id && !S.contacts.has(s.userId)) return; const a = mp.get(s.userId) || []; a.push(s); mp.set(s.userId, a); });
    mp.forEach(a => a.sort((x, y) => x.ts - y.ts));
    return mp;
}
const hasUnseen = a => a.some(s => !S.seenStories[s.$id]);
function ringedAv(id, sm) {
    const a = sm && sm.get(id);
    if (!a) return avHTML(id);
    return '<span class="pg-ring ' + (hasUnseen(a) ? '' : 'seen') + '" data-story="' + esc(id) + '">' + avHTML(id) + '</span>';
}
function renderChats() {
    const box = $('rdChatList'); if (!box) return;
    const q = chatQ.trim().toLowerCase(), sm = storyMap(), arch = !!S.showArchived;
    let list = sortedChats(c => !!c.archived === arch && (!q || chatName(c.id).toLowerCase().includes(q)) && (c.lastTs || c.type === 'group' || isSelf(c.id) || msgsOf(c.id).length));
    if (q) { const extra = sortedChats(c => !!c.archived !== arch && chatName(c.id).toLowerCase().includes(q)); list = list.concat(extra); }
    const archN = sortedChats(c => c.archived).length;
    let h = '';
    if (arch) h += '<div class="pg-row" data-arch="0"><div class="ri">' + ic('back', 20) + '</div><div class="rm"><b>Archived chats</b><small>Tap to go back</small></div></div>';
    else if (archN && !q) h += '<div class="pg-row" data-arch="1"><div class="ri">' + ic('archive', 20) + '</div><div class="rm"><b>Archived</b></div><b style="color:var(--ac)">' + archN + '</b></div>';
    h += list.map(c => {
        const l = lastVisible(c.id), typ = isTyping(c.id), ct = S.contacts.get(c.id);
        let sub;
        if (typ) sub = '<span class="rd-typ">typing…</span>';
        else if (c.draft && S.cur !== c.id) sub = '<span style="color:#e53935;font-weight:700">Draft: </span>' + esc(c.draft);
        else if (l) {
            let pre = '';
            if (l.from === 'me' && !l.system) pre = (TICK[l.status] || '') + ' ';
            else if (c.type === 'group' && l.from === 'peer' && !l.system) pre = esc(nameOfUid(l.uid)) + ': ';
            sub = pre + esc(previewText(l)).slice(0, 90);
        } else sub = c.type === 'group' ? 'Group' : '<i>Say hi 👋</i>';
        const on = c.type === 'dm' && isOnline(ct) && !isSelf(c.id);
        return '<div class="rd-item ' + (CHAT.lsel && CHAT.lsel.has(c.id) ? 'sel' : '') + '" data-id="' + esc(c.id) + '"><div class="pg-avw">' + ringedAv(c.id, sm) + (on ? '<i class="dot"></i>' : '') + '</div>' +
            '<div class="rd-it-mid"><b><em>' + esc(chatName(c.id)) + '</em>' + (ct && ct.isBot ? '<span class="pg-tag">BOT</span>' : '') + (c.pinned ? '<span class="pg-ico">' + ic('pin', 14) + '</span>' : '') + (c.muted ? '<span class="pg-ico">' + ic('bell-off', 14) + '</span>' : '') + '</b><span>' + sub + '</span></div>' +
            '<div class="rd-it-r ' + (c.unread ? 'unread' : '') + '"><small>' + (c.lastTs ? listTime(c.lastTs) : '') + '</small>' + (c.unread ? '<span class="rd-badge" style="' + (c.muted ? 'background:#8696a0' : '') + '">' + c.unread + '</span>' : '') + '</div></div>';
    }).join('');
    if (!list.length && !arch) h += '<div class="rd-empty">' + ic('chat', 48) + '<br><br><b>No chats yet</b><br>Tap the green button to start a chat by username.</div>';
    box.innerHTML = h;
    const n = totalUnread(); const b = $('navBadge'); if (b) { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; }
    document.title = (n ? '(' + n + ') ' : '') + 'Ping';
    try { if (navigator.setAppBadge) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()); } catch (e) {}
}
const renderChatsSoon = debounce(renderChats, 60);

function wireChatList() {
    const box = $('rdChatList'); let lp = null, lpFired = false, sx = 0, sy = 0;
    const toggleSel = id => { CHAT.lsel = CHAT.lsel || new Set(); CHAT.lsel.has(id) ? CHAT.lsel.delete(id) : CHAT.lsel.add(id); updListSel(); };
    box.addEventListener('pointerdown', e => {
        const it = e.target.closest('.rd-item'); if (!it) return;
        lpFired = false; sx = e.clientX; sy = e.clientY;
        lp = setTimeout(() => { lpFired = true; vib(20); toggleSel(it.dataset.id); }, 420);
    });
    const cancel = () => clearTimeout(lp);
    box.addEventListener('pointermove', e => { if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) cancel(); });
    box.addEventListener('pointerup', cancel); box.addEventListener('pointercancel', cancel); box.addEventListener('scroll', cancel);
    box.addEventListener('click', e => {
        if (lpFired) { lpFired = false; return; }
        const ar = e.target.closest('[data-arch]'); if (ar) { S.showArchived = ar.dataset.arch === '1'; renderChats(); return; }
        const it = e.target.closest('.rd-item'); if (!it) return;
        const id = it.dataset.id;
        if (CHAT.lsel && CHAT.lsel.size) { toggleSel(id); return; }
        const st = e.target.closest('[data-story]');
        if (st) { openStories(st.dataset.story); return; }
        openChat(id);
    });
    box.addEventListener('contextmenu', e => e.preventDefault());
    $('lsCancel').onclick = () => { CHAT.lsel = new Set(); updListSel(); };
    const sel = () => Array.from(CHAT.lsel || []).map(chatOf).filter(Boolean);
    $('lsPin').onclick = async () => { const a = sel(), un = a.every(c => c.pinned); for (const c of a) { c.pinned = un ? 0 : Date.now(); await saveChat(c); } CHAT.lsel = new Set(); updListSel(); };
    $('lsMute').onclick = async () => { const a = sel(), un = a.every(c => c.muted); for (const c of a) { c.muted = !un; await saveChat(c); } CHAT.lsel = new Set(); updListSel(); };
    $('lsArch').onclick = async () => { for (const c of sel()) { c.archived = !S.showArchived; c.pinned = 0; await saveChat(c); } toast(S.showArchived ? 'Unarchived' : 'Archived'); CHAT.lsel = new Set(); updListSel(); };
    $('lsDel').onclick = async () => {
        const a = sel(); if (!a.length) return;
        if (!(await confirmBox('Delete ' + a.length + ' chat' + (a.length > 1 ? 's' : '') + '?', 'Messages sirf is device se hategi.', 'Delete', true))) return;
        for (const c of a) await deleteChatLocal(c, true);
        CHAT.lsel = new Set(); updListSel();
    };
    $('lsMore').onclick = () => menu([
        { label: 'Mark as read', icon: 'check', fn: async () => { for (const c of sel()) { msgsOf(c.id).forEach(m => { if (!m.read) { m.read = true; dbPut('msgs', m); } }); c.unread = 0; await saveChat(c); } CHAT.lsel = new Set(); updListSel(); } },
        { label: 'Select all', icon: 'list', fn: () => { CHAT.lsel = new Set(sortedChats(c => !!c.archived === !!S.showArchived).map(c => c.id)); updListSel(); } }
    ]);
    const s = $('rdSearch'); s.oninput = () => { chatQ = s.value; renderChats(); };
}
function updListSel() {
    const n = CHAT.lsel ? CHAT.lsel.size : 0;
    $('mainHead').hidden = !!n; $('lsBar').hidden = !n; $('lsCount').textContent = n;
    renderChats();
}
async function deleteChatLocal(c, keepSelf) {
    for (const m of msgsOf(c.id).slice()) removeMsgLocal(m.id);
    c.deleted = true; c.unread = 0; c.lastTs = 0; c.draft = ''; c.archived = false; c.pinned = 0;
    if (c.type === 'group' && !c.left) { /* group stays known so new messages still come */ }
    await saveChat(c); emit('msg');
}

/* ======================= CHAT SCREEN ======================= */
function headSub() {
    const id = S.cur, c = id && chatOf(id); if (!c) return '';
    if (c.type === 'group') {
        if (c.left) return 'You left';
        const t = c.members.filter(x => x !== S.me.id && isTyping(x));
        if (t.length) return '<span class="rd-typ">' + esc(cname(S.contacts.get(t[0]))) + ' is typing…</span>';
        return esc(c.members.map(x => x === S.me.id ? 'You' : cname(S.contacts.get(x))).join(', ')).slice(0, 80);
    }
    if (isSelf(id)) return 'Message yourself';
    const ct = S.contacts.get(id);
    if (isTyping(id)) return '<span class="rd-typ">typing…</span>';
    if (ct && ct.isBot) return 'bot';
    if (LINK.open(id)) return '<span class="pg-p2p" title="Direct P2P link">' + ic('p2p', 18) + ' online</span>';
    if (isOnline(ct) && S.online) return '<span class="pg-on">online</span>';
    return ct && ct.lastSeen ? 'last seen ' + listTime(ct.lastSeen) : '';
}
function updHead() {
    if (!S.cur) return;
    const id = S.cur, c = chatOf(id); if (!c) return;
    $('rdName').textContent = chatName(id);
    paintAv($('rdAv'), id);
    const sub = $('rdSub'); sub.innerHTML = headSub(); sub.classList.remove('typing');
    const dm = c.type === 'dm' && !isSelf(id) && !(S.contacts.get(id) || {}).isBot;
    $('rdVid').hidden = $('rdAud').hidden = !dm;
    const ct = S.contacts.get(id), strip = $('pgNote');
    if (dm && ct && ct.note && Date.now() - ct.noteTs < CFG.noteHours * 36e5) {
        strip.hidden = false; strip.innerHTML = ic('status', 18) + '<span><b>Note:</b> ' + esc(ct.note) + '</span>' + (ct.music ? '<button class="pg-music" data-music="' + esc(ct.music) + '">' + ic('music', 14) + ' Play</button>' : '');
    } else strip.hidden = true;
    const inp = $('rdComp'); const left = c.left; inp.style.opacity = left ? .5 : 1; $('rdInput').disabled = !!left;
}
function msgHTML(m, prev, c) {
    const mine = m.from === 'me';
    if (m.system) {
        if (m.sk === 'call' && m.cl) {
            const bad = m.cl.result !== 'ok';
            return '<div class="rd-row ' + (mine ? 'out' : 'in') + '" data-id="' + m.id + '"><div class="rd-call ' + (bad ? 'bad' : 'ok') + '"><span class="rd-call-ic">' + ic(m.cl.kind === 'video' ? 'video' : 'phone', 16) + '</span><div class="rd-call-t"><b>' + esc(m.text) + '</b><span>' + (mine ? 'Outgoing' : 'Incoming') + '</span></div><time>' + fmtTime(m.ts) + '</time></div></div>';
        }
        return '<div class="rd-sys" data-id="' + m.id + '">' + esc(m.text) + '</div>';
    }
    const first = !prev || prev.system || prev.from !== m.from || prev.uid !== m.uid || m.ts - prev.ts > 120000;
    let b = '';
    if (c.type === 'group' && !mine && first) b += '<div class="pg-sender" style="color:hsl(' + hue(m.uid) + ',60%,45%)">' + esc(nameOfUid(m.uid)) + '</div>';
    if (m.deleted) b += '<div class="rd-del">' + ic('x', 14) + ' ' + (mine ? 'You deleted this message' : 'This message was deleted') + '</div>';
    else {
        if (m.fwd) b += '<div class="rd-fwd">' + ic('forward', 13) + ' Forwarded</div>';
        if (m.reply) {
            const o = getMsg(m.reply.id), nm = m.reply.uid === S.me.id ? 'You' : nameOfUid(m.reply.uid);
            b += '<div class="rd-quote" data-goto="' + esc(m.reply.id) + '"><b>' + esc(nm) + '</b><span>' + esc(o ? previewText(o) : (m.reply.t || '')) + '</span></div>';
        }
        if (m.media) {
            const md = m.media;
            if (md.state === 'up' || md.state === 'dl') b += '<div class="rd-prog" data-prog="' + m.id + '"><span>' + (md.state === 'up' ? 'Sending' : 'Downloading') + (md.prog != null ? ' ' + md.prog + '%' : '…') + ' · ' + esc(md.name || '') + '</span><div class="rd-pbar"><i style="width:' + (md.prog || 0) + '%"></i></div></div>';
            else if (md.state === 'err' || md.state === 'gone') b += '<div class="rd-fail" data-retry="' + m.id + '">' + ic('info', 18) + '<span>' + esc(md.reason || 'Failed') + (md.state === 'err' ? ' · tap to retry' : '') + '</span></div>';
            else if (isImg(m)) b += '<img class="rd-img" data-hy="' + m.id + '" alt="">';
            else if (isVid(m)) b += '<video class="rd-vid" data-hy="' + m.id + '" controls preload="metadata" playsinline></video>';
            else if (isAud(m)) b += '<audio class="rd-aud" data-hy="' + m.id + '" controls preload="metadata"></audio>';
            else b += '<a class="rd-file" data-file="' + m.id + '">' + ic('file', 22) + '<span>' + esc(md.name || 'File') + '<br><small>' + fmtSize(md.size) + '</small></span></a>';
        }
        if (m.text) {
            b += '<div class="rd-txt">' + linkify(esc(m.text)) + '</div>';
            const u = firstUrl(m.text), id = u && ytId(u);
            if (id) b += '<div class="rd-lp" data-href="' + esc(u) + '"><div class="rd-lpth" style="background-image:url(https://i.ytimg.com/vi/' + esc(id) + '/hqdefault.jpg)"></div><div class="rd-play">▶</div><div class="rd-lpb"><b>YouTube</b><small>' + esc(u) + '</small></div></div>';
        }
    }
    const rs = m.reactions ? Object.values(m.reactions) : [];
    const react = rs.length ? '<span class="rd-react">' + Array.from(new Set(rs)).join('') + (rs.length > 1 ? ' ' + rs.length : '') + '</span>' : '';
    const meta = '<span class="rd-meta">' + (m.star ? '<span class="rd-star">' + ic('star', 12) + '</span>' : '') + (m.edited && !m.deleted ? 'edited ' : '') + fmtTime(m.ts) + (mine ? ' ' + (TICK[isSelf(c.id) ? 'sent' : (m.status || 'pending')] || '') : '') + '</span>';
    return '<div class="rd-row ' + (mine ? 'out' : 'in') + (first ? ' first' : '') + (CHAT.sel.has(m.id) ? ' sel' : '') + '" data-id="' + m.id + '"><div class="rd-bub">' + b + meta + react + '</div></div>';
}
let renderAF = 0;
function renderMessages(opt) {
    if (!S.cur) return;
    cancelAnimationFrame(renderAF);
    renderAF = requestAnimationFrame(() => doRender(opt));
}
function doRender(opt) {
    opt = opt || {};
    const id = S.cur, c = id && chatOf(id), box = $('rdMsgs'); if (!c) return;
    const all = msgsOf(id).filter(m => !m.hidden), start = Math.max(0, all.length - CHAT.win), arr = all.slice(start);
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120, prevH = box.scrollHeight, prevT = box.scrollTop;
    let h = '', prev = null, lastDay = '';
    if (start > 0) h += '<div class="rd-more" id="rdMore2">Load older messages</div>';
    if (!all.length) h += '<div class="rd-sys">' + ic('lock', 14) + ' Messages are end-to-end encrypted. No one outside this chat, not even the server, can read them.</div>';
    arr.forEach(m => {
        const dk = dayKey(m.ts); if (dk !== lastDay) { h += '<div class="rd-day">' + dayLabel(m.ts) + '</div>'; lastDay = dk; prev = null; }
        h += msgHTML(m, prev, c); prev = m;
    });
    const ct = S.contacts.get(id);
    if (ct && ct.keyWarn) h = '<div class="pg-warn">' + ic('shield', 14) + ' ' + esc(cname(ct)) + "'s security code changed. Tap to verify." + '</div>' + h;
    if (isTyping(id)) h += '<div class="rd-typing"><i></i><i></i><i></i></div>';
    box.innerHTML = h;
    hydrate(box);
    if (opt.goto) { const r = box.querySelector('[data-id="' + opt.goto + '"]'); if (r) { r.scrollIntoView({ block: 'center' }); r.classList.add('flash'); setTimeout(() => r.classList.remove('flash'), 1400); return; } }
    if (opt.bottom || nearBottom) box.scrollTop = box.scrollHeight; else if (opt.keepTop) box.scrollTop = prevT + (box.scrollHeight - prevH);
    else box.scrollTop = prevT;
}
function hydrate(root) {
    root.querySelectorAll('[data-hy]').forEach(async el => {
        const u = await getURL(el.dataset.hy);
        if (u) { el.src = u; if (el.tagName === 'IMG') el.onload = () => {}; }
        else if (el.parentNode) { el.outerHTML = '<div class="rd-fail">' + ic('info', 18) + '<span>Media not available</span></div>'; }
    });
}
function openChat(id, o) {
    o = o || {};
    if (!S.me) return;
    if (S.cur && S.cur !== id) nav.close(chatKey);
    ensureChat(id).then(c => {
        if (c.deleted) { c.deleted = false; saveChat(c); }
        const was = S.cur === id;
        S.cur = id; CHAT.sel = new Set(); CHAT.edit = null; CHAT.reply = null; CHAT.win = 80;
        showScreen('rdChat'); closeLayer();
        $('rdInput').value = c.draft || ''; autoGrow(); updSend(); updBars(); updHead(); applyWall(id);
        if (!was) nav.push(chatKey, closeChatUI);
        if (isOnline(S.contacts.get(id)) || c.type === 'dm') LINK.ensure(id, true);
        doRender({ bottom: true, goto: o.goto });
        markRead(id);
        if (c.type === 'dm' && !S.contacts.get(id)) getContact(id).then(() => { updHead(); renderMessages(); }).catch(() => {});
        if (c.type === 'group') refreshContacts(c.members.filter(x => x !== S.me.id));
    });
}
function closeChatUI() {
    const id = S.cur; if (!id) return;
    const c = chatOf(id); if (c) { c.draft = $('rdInput').value; saveChat(c); }
    sendTyping(false); S.cur = null; CHAT.sel = new Set(); $('rdEmojiPanel').hidden = true; stopRec(true);
    showScreen('rdMain'); renderChats();
}
function closeChat() { nav.close(chatKey); }

function autoGrow() { const t = $('rdInput'); t.style.height = 'auto'; t.style.height = Math.min(130, t.scrollHeight) + 'px'; }
function updSend() {
    const has = $('rdInput').value.trim().length > 0 || CHAT.edit;
    $('rdSendBtn').innerHTML = ic(has ? (CHAT.edit ? 'check' : 'send') : 'mic', 22);
    $('rdSendBtn').dataset.mode = has ? 'send' : 'mic';
    $('rdCamBtn').hidden = !!has;
}
function updBars() {
    const e = CHAT.edit, r = CHAT.reply;
    $('rdEditBar').hidden = !e; if (e) $('rdEditTxt').textContent = 'Edit message';
    $('rdReplyBar').hidden = !r;
    if (r) $('rdReplyTxt').innerHTML = '<b>' + esc(nameOfUid(r.uid)) + '</b>' + esc(previewText(r).slice(0, 80));
    const n = CHAT.sel.size;
    $('rdHead').hidden = !!n; $('rdSelBar').hidden = !n; $('rdSelCount').textContent = n;
    const one = n === 1 ? getMsg(Array.from(CHAT.sel)[0]) : null;
    $('rdSelReply').hidden = !one || !!one.deleted;
    $('rdReactBar') && $('rdReactBar').remove();
    if (one && !one.deleted) showReactBar(one);
}
function showReactBar(m) {
    const row = $('rdMsgs').querySelector('[data-id="' + m.id + '"]'); if (!row) return;
    const app = $('rdApp').getBoundingClientRect(), r = row.getBoundingClientRect();
    const bar = document.createElement('div'); bar.id = 'rdReactBar'; bar.className = 'rd-reacts';
    bar.innerHTML = REACTS.map(e => '<button class="' + ((m.reactions || {})[S.me.id] === e ? 'on' : '') + '" data-e="' + e + '">' + e + '</button>').join('');
    let top = r.top - app.top - 56; if (top < 70) top = r.bottom - app.top + 6;
    bar.style.top = top + 'px'; bar.style.left = '50%'; bar.style.transform = 'translateX(-50%)';
    $('rdApp').appendChild(bar);
    bar.onclick = e => { const b = e.target.closest('[data-e]'); if (!b) return; reactTo(m, (m.reactions || {})[S.me.id] === b.dataset.e ? '' : b.dataset.e); CHAT.sel = new Set(); updBars(); renderMessages(); };
}
function selMsgs() { return Array.from(CHAT.sel).map(getMsg).filter(Boolean).sort((a, b) => a.ts - b.ts); }
function clearSel() { CHAT.sel = new Set(); updBars(); renderMessages(); }

async function doSend() {
    const t = $('rdInput'), text = t.value.trim();
    if (CHAT.edit) {
        const m = CHAT.edit; CHAT.edit = null;
        if (text && text !== m.text) await editMsg(m.id, text);
        t.value = ''; autoGrow(); updSend(); updBars(); renderMessages(); return;
    }
    if (!text) return;
    const reply = CHAT.reply ? { id: CHAT.reply.id, uid: CHAT.reply.uid, who: CHAT.reply.from, t: previewText(CHAT.reply).slice(0, 120) } : null;
    t.value = ''; CHAT.reply = null; autoGrow(); updSend(); updBars();
    const c = chatOf(S.cur); if (c) { c.draft = ''; }
    sendTyping(false); SFX.send();
    await sendMsg(S.cur, { text, reply });
}
async function sendFiles(files) {
    for (const f of files) {
        const reply = CHAT.reply ? { id: CHAT.reply.id, uid: CHAT.reply.uid, t: previewText(CHAT.reply).slice(0, 120) } : null;
        CHAT.reply = null; updBars();
        await sendMsg(S.cur, { file: f, reply });
    }
    SFX.send();
}

/* ---- voice recording ---- */
async function startRec() {
    if (CHAT.rec || !navigator.mediaDevices) { toast('Mic available nahi'); return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mt = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find(x => window.MediaRecorder && MediaRecorder.isTypeSupported(x)) || '';
        const mr = new MediaRecorder(stream, mt ? { mimeType: mt } : undefined), chunks = [], t0 = Date.now();
        mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        const R = CHAT.rec = { mr, stream, chunks, t0, cancel: false, tm: setInterval(() => { $('rdRecTime').textContent = fmtDur(Date.now() - t0).replace(/^0/, ''); }, 300) };
        mr.onstop = async () => {
            clearInterval(R.tm); stream.getTracks().forEach(x => x.stop());
            if (!R.cancel && chunks.length && S.cur) { const type = (mr.mimeType || mt || 'audio/webm').split(';')[0]; const blob = new Blob(chunks, { type }); await sendMsg(S.cur, { file: new File([blob], 'voice.' + extOf(type), { type }), voice: true, dur: Date.now() - t0 }); SFX.send(); }
        };
        mr.start(); $('rdComp').hidden = true; $('rdRecComp').hidden = false; $('rdRecTime').textContent = '0:00';
    } catch (e) { toast('Mic permission do'); }
}
function stopRec(cancel) {
    const R = CHAT.rec; if (!R) return; CHAT.rec = null; R.cancel = !!cancel;
    try { R.mr.state !== 'inactive' && R.mr.stop(); } catch (e) {}
    $('rdRecComp').hidden = true; $('rdComp').hidden = false;
}

/* ---- forward picker ---- */
function pickChats(title, cb, exclude) {
    const P = openPage(title), sel = new Set(), list = sortedChats(c => !(exclude || []).includes(c.id));
    P.body.innerHTML = '<div style="background:#fff;margin-top:8px" class="pg-card" id="pcl"></div><button class="pg-btn" id="pcGo" disabled>Send</button>';
    const draw = () => {
        $('pcl').innerHTML = list.map(c => '<div class="pg-row" data-id="' + esc(c.id) + '">' + avHTML(c.id) + '<div class="rm"><b>' + esc(chatName(c.id)) + '</b></div><span class="pg-chk ' + (sel.has(c.id) ? 'on' : '') + '">' + (sel.has(c.id) ? ic('check', 14) : '') + '</span></div>').join('') || '<div class="rd-empty">No chats</div>';
        $('pcGo').disabled = !sel.size; $('pcGo').textContent = 'Send' + (sel.size ? ' (' + sel.size + ')' : '');
    };
    P.body.onclick = e => { const r = e.target.closest('[data-id]'); if (r) { sel.has(r.dataset.id) ? sel.delete(r.dataset.id) : sel.add(r.dataset.id); draw(); } };
    $('pcGo').onclick = async () => { const ids = Array.from(sel); P.close(); await cb(ids); };
    draw();
}
async function forwardMsgs(msgs, ids) {
    for (const cid of ids) {
        for (const m of msgs) {
            if (m.deleted || m.system) continue;
            let file = null;
            if (m.media && m.media.state === 'ok') { const b = await dbGet('blobs', m.id); if (b) file = new File([b], m.media.name || 'file', { type: m.media.type }); }
            if (m.media && !file) continue;
            await sendMsg(cid, { text: m.text, file, voice: m.voice, fwd: true, dur: m.media && m.media.dur });
        }
    }
    toast('Forwarded');
}

/* ---- wiring ---- */
function wireChat() {
    const box = $('rdMsgs'), inp = $('rdInput');
    inp.addEventListener('input', () => { autoGrow(); updSend(); typingPing(); const c = chatOf(S.cur); if (c) { c.draft = inp.value; } });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && S.set.enterSend) { e.preventDefault(); doSend(); } });
    $('rdSendBtn').onclick = () => { if ($('rdSendBtn').dataset.mode === 'send') doSend(); else startRec(); };
    $('rdRecCancel').onclick = () => stopRec(true);
    $('rdRecSend').onclick = () => stopRec(false);
    $('rdBack').onclick = closeChat;
    $('rdHead').querySelector('.rd-title').onclick = () => S.cur && openInfo(S.cur);
    $('rdAv').onclick = () => S.cur && openInfo(S.cur);
    $('rdVid').onclick = () => S.cur && CALL.start(S.cur, 'video');
    $('rdAud').onclick = () => S.cur && CALL.start(S.cur, 'audio');
    $('pgNote').onclick = e => { const m = e.target.closest('[data-music]'); if (m) openLink(m.dataset.music, 'Music'); };
    $('rdEditX').onclick = () => { CHAT.edit = null; $('rdInput').value = ''; autoGrow(); updSend(); updBars(); };
    $('rdReplyX').onclick = () => { CHAT.reply = null; updBars(); };
    $('rdEmojiBtn').onclick = () => {
        const p = $('rdEmojiPanel');
        if (!p.hidden) { p.hidden = true; return; }
        p.innerHTML = '<div class="rd-ehead"><span>Emoji</span><button id="rdEmX">' + '✕' + '</button></div><div class="rd-egrid">' + EMOJIS.map(e => '<button>' + e + '</button>').join('') + '</div>';
        p.hidden = false; $('rdEmX').onclick = () => { p.hidden = true; };
        p.querySelector('.rd-egrid').onclick = e => { const b = e.target.closest('button'); if (!b) return; const s = inp.selectionStart || inp.value.length; inp.value = inp.value.slice(0, s) + b.textContent + inp.value.slice(inp.selectionEnd || s); inp.selectionStart = inp.selectionEnd = s + b.textContent.length; updSend(); autoGrow(); };
    };
    $('rdAttachBtn').onclick = () => sheet([
        { label: 'Gallery', icon: 'image', color: '#7f66ff', fn: () => $('rdFileMedia').click() },
        { label: 'Camera', icon: 'camera', color: '#ff2e74', fn: () => $('rdFileCam').click() },
        { label: 'Audio', icon: 'music', color: '#ff7a1a', fn: () => $('rdFileAudio').click() },
        { label: 'Document', icon: 'file', color: '#2f80ed', fn: () => $('rdFileDoc').click() }
    ]);
    $('rdCamBtn').onclick = () => $('rdFileCam').click();
    ['rdFileMedia', 'rdFileCam', 'rdFileAudio', 'rdFileDoc'].forEach(id => { $(id).onchange = e => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length && S.cur) sendFiles(f); }; });
    $('rdMore').onclick = () => { const c = chatOf(S.cur); if (!c) return; menu([
        { label: c.type === 'group' ? 'Group info' : 'Contact info', icon: 'info', fn: () => openInfo(c.id) },
        { label: 'Wallpaper', icon: 'palette', fn: () => wallSheet(c.id) },
        { label: 'Starred messages', icon: 'star', fn: () => openStarred(c.id) },
        { label: c.muted ? 'Unmute' : 'Mute notifications', icon: c.muted ? 'bell' : 'bell-off', fn: async () => { c.muted = !c.muted; await saveChat(c); toast(c.muted ? 'Muted' : 'Unmuted'); } },
        { label: c.archived ? 'Unarchive' : 'Archive chat', icon: 'archive', fn: async () => { c.archived = !c.archived; await saveChat(c); toast(c.archived ? 'Archived' : 'Unarchived'); closeChat(); } },
        { label: 'Clear chat', icon: 'trash', fn: async () => { if (await confirmBox('Clear this chat?', 'Sirf aapke device se hategi.', 'Clear', true)) { for (const m of msgsOf(c.id).slice()) removeMsgLocal(m.id); renderMessages(); renderChats(); } } },
        { label: 'Delete chat', icon: 'trash', danger: true, fn: async () => { if (await confirmBox('Delete this chat?', 'Chat aur messages is device se hat jayenge.', 'Delete', true)) { await deleteChatLocal(c); closeChat(); } } }
    ]); };
    // selection bar
    $('rdSelCancel').onclick = clearSel;
    $('rdSelReply').onclick = () => { const m = selMsgs()[0]; if (m) { CHAT.reply = m; CHAT.edit = null; clearSel(); updBars(); $('rdInput').focus(); } };
    $('rdSelCopy').onclick = async () => { const t = selMsgs().map(m => m.text).filter(Boolean).join('\n'); try { await navigator.clipboard.writeText(t); toast('Copied'); } catch (e) { toast('Copy nahi hua'); } clearSel(); };
    $('rdSelFwd').onclick = () => { const ms = selMsgs(); clearSel(); pickChats('Forward to…', ids => forwardMsgs(ms, ids)); };
    $('rdSelDel').onclick = async () => {
        const ms = selMsgs(); if (!ms.length) return;
        const all = ms.every(m => m.from === 'me' && !m.system && !m.deleted && !isSelf(m.chat));
        const btns = [{ label: 'Cancel', val: 0 }, { label: 'Delete for me', val: 1 }]; if (all) btns.push({ label: 'Delete for everyone', val: 2, danger: true });
        const v = await dialog('Delete ' + ms.length + ' message' + (ms.length > 1 ? 's' : '') + '?', '', btns);
        if (v === 1) { deleteForMe(ms.map(m => m.id)); clearSel(); }
        else if (v === 2) { for (const m of ms) await unsend(m); clearSel(); }
    };
    $('rdSelMore').onclick = () => {
        const ms = selMsgs(), one = ms.length === 1 ? ms[0] : null; if (!ms.length) return;
        menu([
            { label: ms.every(m => m.star) ? 'Unstar' : 'Star', icon: 'star', fn: () => { const un = ms.every(m => m.star); ms.forEach(m => { m.star = un ? 0 : 1; saveMsg(m); }); clearSel(); } },
            one && one.from === 'me' && !one.media && !one.deleted && !one.system ? { label: 'Edit', icon: 'edit', fn: () => { CHAT.edit = one; CHAT.reply = null; $('rdInput').value = one.text; clearSel(); autoGrow(); updSend(); updBars(); $('rdInput').focus(); } } : null,
            one && one.media && one.media.state === 'ok' ? { label: 'Save to device', icon: 'download', fn: async () => { const b = await dbGet('blobs', one.id); if (b) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = one.media.name || 'file'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } clearSel(); } } : null,
            one && one.from === 'me' && one.status === 'failed' ? { label: 'Retry send', icon: 'undo', fn: () => { retryMsg(one.id); clearSel(); } } : null
        ]);
    };
    // message list interactions
    let lp = null, fired = false, sx = 0, sy = 0, tx0 = 0, swipe = null;
    box.addEventListener('pointerdown', e => {
        const row = e.target.closest('.rd-row'); if (!row || e.target.closest('video,audio,a,button')) return;
        fired = false; sx = e.clientX; sy = e.clientY;
        lp = setTimeout(() => { fired = true; vib(18); toggleMsgSel(row.dataset.id); }, 380);
    });
    const cancel = () => clearTimeout(lp);
    box.addEventListener('pointermove', e => { if (Math.abs(e.clientX - sx) > 9 || Math.abs(e.clientY - sy) > 9) cancel(); });
    box.addEventListener('pointerup', cancel); box.addEventListener('pointercancel', cancel);
    box.addEventListener('scroll', cancel, { passive: true });
    function toggleMsgSel(id) { const m = getMsg(id); if (!m || m.system && m.sk !== 'call') { return; } CHAT.sel.has(id) ? CHAT.sel.delete(id) : CHAT.sel.add(id); updBars(); renderMessages(); }
    box.addEventListener('click', e => {
        if (fired) { fired = false; return; }
        const a = e.target.closest('[data-href]'); if (a) { openLink(a.dataset.href); return; }
        if (e.target.closest('.pg-warn')) { const c = S.contacts.get(S.cur); if (c) openInfo(c.id); return; }
        if (e.target.id === 'rdMore2') { CHAT.win += 80; doRender({ keepTop: true }); return; }
        const rt = e.target.closest('[data-retry]'); if (rt) { const m = getMsg(rt.dataset.retry); if (m) { if (m.from === 'me') retryMsg(m.id); else { m.media.state = 'dl'; saveMsg(m); downloadMedia(m); } } return; }
        const g = e.target.closest('[data-goto]'); if (g) { const r = box.querySelector('[data-id="' + g.dataset.goto + '"]'); if (r) { r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r.classList.add('flash'); setTimeout(() => r.classList.remove('flash'), 1400); } return; }
        const row = e.target.closest('.rd-row'); const id = row && row.dataset.id;
        if (CHAT.sel.size && id) { toggleMsgSel(id); return; }
        const im = e.target.closest('img.rd-img'); if (im) { openViewer(im.src, 'image'); return; }
        const f = e.target.closest('[data-file]'); if (f) { dbGet('blobs', f.dataset.file).then(b => { const m = getMsg(f.dataset.file); if (b && m) { const x = document.createElement('a'); x.href = URL.createObjectURL(b); x.download = m.media.name || 'file'; x.click(); setTimeout(() => URL.revokeObjectURL(x.href), 4000); } }); return; }
        const sys = e.target.closest('.rd-sys'); if (sys) return;
        if (id) { const m = getMsg(id); if (m && m.sk === 'call' && m.cl && S.cur) { menu([{ label: 'Voice call', icon: 'phone', fn: () => CALL.start(S.cur, 'audio') }, { label: 'Video call', icon: 'video', fn: () => CALL.start(S.cur, 'video') }]); } }
    });
    // swipe right on a message = reply
    box.addEventListener('touchstart', e => { const row = e.target.closest('.rd-row'); if (!row || row.querySelector('.rd-call') || e.target.closest('audio,video,input')) { swipe = null; return; } swipe = { row, x: e.touches[0].clientX, y: e.touches[0].clientY, go: false }; }, { passive: true });
    box.addEventListener('touchmove', e => {
        if (!swipe) return; const dx = e.touches[0].clientX - swipe.x, dy = e.touches[0].clientY - swipe.y;
        if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) { swipe.row.style.transform = ''; swipe = null; return; }
        if (dx > 8) { const d = Math.min(70, dx); swipe.row.style.transform = 'translateX(' + d + 'px)'; swipe.go = d > 56; }
    }, { passive: true });
    const endSwipe = () => { if (!swipe) return; const s = swipe; swipe = null; s.row.style.transition = 'transform .2s'; s.row.style.transform = ''; setTimeout(() => { s.row.style.transition = ''; }, 220); if (s.go) { const m = getMsg(s.row.dataset.id); if (m && !m.deleted && !m.system) { vib(12); CHAT.reply = m; updBars(); $('rdInput').focus(); } } };
    box.addEventListener('touchend', endSwipe); box.addEventListener('touchcancel', endSwipe);
}

/* ---- starred ---- */
function openStarred(chatId) {
    const P = openPage('Starred messages');
    const list = S.msgs.filter(m => m.star && !m.deleted && (!chatId || m.chat === chatId)).sort((a, b) => b.ts - a.ts);
    P.body.innerHTML = list.length ? '<div class="pg-card">' + list.map(m => '<div class="pg-row" data-id="' + m.id + '" data-chat="' + esc(m.chat) + '"><div class="rm"><b>' + esc(m.from === 'me' ? 'You' : nameOfUid(m.uid)) + ' <small style="color:var(--sub);font-weight:500"> in ' + esc(chatName(m.chat)) + ' · ' + listTime(m.ts) + '</small></b><small>' + esc(previewText(m)) + '</small></div>' + ic('star', 16) + '</div>').join('') + '</div>' : '<div class="rd-empty">' + ic('star', 40) + '<br><br>No starred messages.<br>Select a message and use ⋯ → Star.</div>';
    P.body.onclick = e => { const r = e.target.closest('[data-id]'); if (!r) return; P.close(); setTimeout(() => openChat(r.dataset.chat, { goto: r.dataset.id }), 260); };
}

/* ------------------------------ UI: main tabs, updates, calls, profile, settings, bots ------------------------------ */
const TABS = { chats: 'Ping', updates: 'Updates', calls: 'Calls', you: 'You' };
function setTab(t) {
    S.tab = t;
    document.querySelectorAll('.pg-pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + t));
    document.querySelectorAll('.pg-nav button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    $('mainTitle').textContent = TABS[t];
    $('mainMenu').hidden = t !== 'chats';
    const fab = $('pgFab'), fab2 = $('pgFab2');
    fab.hidden = t === 'you'; fab2.hidden = t !== 'updates';
    fab.innerHTML = ic(t === 'chats' ? 'chat' : t === 'updates' ? 'camera' : 'phone', 26);
    fab2.innerHTML = ic('edit', 20);
    if (t === 'updates') renderUpdates(); if (t === 'calls') renderCalls(); if (t === 'you') renderYou(); if (t === 'chats') renderChats();
}
function renderAllSoon() { renderChatsSoon(); if (S.tab === 'updates') renderUpdates(); if (S.tab === 'calls') renderCallsSoon(); if (S.tab === 'you') renderYouSoon(); }

function wireMain() {
    document.querySelectorAll('.pg-nav button').forEach(b => b.onclick = () => setTab(b.dataset.t));
    $('pgFab').onclick = () => {
        if (S.tab === 'chats') newChatPage();
        else if (S.tab === 'updates') sheet([{ label: 'Gallery', icon: 'image', color: '#7f66ff', fn: () => composeMediaStory(false) }, { label: 'Camera', icon: 'camera', color: '#ff2e74', fn: () => composeMediaStory(true) }, { label: 'Text', icon: 'type', color: '#00a884', fn: composeTextStory }, { label: 'Note', icon: 'status', color: '#ff7a1a', fn: noteEditor }]);
        else if (S.tab === 'calls') { const i = $('callUser'); i.focus(); i.scrollIntoView({ block: 'center' }); }
    };
    $('pgFab2').onclick = composeTextStory;
    $('mainMenu').onclick = () => menu([
        { label: 'New chat', icon: 'chat', fn: newChatPage },
        { label: 'New group', icon: 'users', fn: newGroupFlow },
        { label: 'Starred messages', icon: 'star', fn: () => openStarred() },
        { label: 'Settings', icon: 'settings', fn: openSettings }
    ]);
    wireChatList();
    $('callGo').onclick = () => callByUsername('audio'); $('callGoV').onclick = () => callByUsername('video');
    $('paneUpd').addEventListener('click', e => {
        const s = e.target.closest('[data-story]'); if (s) { openStories(s.dataset.story); return; }
        const m = e.target.closest('[data-music]'); if (m) { openLink(m.dataset.music, 'Music'); return; }
        const n = e.target.closest('[data-chat]'); if (n) { openChat(n.dataset.chat); return; }
        const a = e.target.closest('[data-act]'); if (!a) return;
        if (a.dataset.act === 'mystory') { const mine = storyMap().get(S.me.id); if (mine) openStories(S.me.id); else $('pgFab').click(); }
        if (a.dataset.act === 'note') noteEditor();
    });
    $('paneCalls').addEventListener('click', e => {
        const b = e.target.closest('[data-call]'); if (b) { CALL.start(b.dataset.call, b.dataset.kind); return; }
        const r = e.target.closest('[data-open]'); if (r) openChat(r.dataset.open);
    });
}
async function callByUsername(kind) {
    const u = normUser($('callUser').value); if (!validUser(u)) { toast('Sahi username daalo'); return; }
    if (!S.online) { toast('Call ke liye internet chahiye'); return; }
    if (u === S.me.username) { toast('Apne aap ko call nahi kar sakte'); return; }
    try {
        const d = await API.findByUsername(u); if (!d) { toast('@' + u + ' nahi mila'); return; }
        const c = await upsertContact(d); await ensureChat(c.id); CALL.start(c.id, kind);
    } catch (e) { toast('Dhoondh nahi paye'); }
}

/* ======================= UPDATES ======================= */
function renderUpdates() {
    const box = $('paneUpd'); if (!box) return;
    const sm = storyMap(), mine = sm.get(S.me.id), me = S.me;
    const noteOn = me.note && Date.now() - me.noteTs < CFG.noteHours * 36e5;
    let h = '<div class="pg-row" data-act="mystory"><div style="position:relative">' + (mine ? '<span class="pg-ring ' + (hasUnseen(mine) ? '' : 'seen') + '">' + avHTML(me.id) + '</span>' : '<span class="pg-ring dash">' + avHTML(me.id) + '</span><span class="pg-plus">+</span>') + '</div><div class="rm"><b>My status</b><small>' + (mine ? mine.length + ' update' + (mine.length > 1 ? 's' : '') + ' · ' + listTime(mine[mine.length - 1].ts) : 'Tap to add a status update') + '</small></div></div>';
    h += '<div class="pg-row" data-act="note"><div class="ri">' + ic('status', 20) + '</div><div class="rm"><b>My note</b><small>' + (noteOn ? esc(me.note) : 'Share a short note or a song (YouTube / YouTube Music)') + '</small></div>' + (noteOn && me.music ? '<span class="pg-ico" style="color:#e53935">' + ic('music', 18) + '</span>' : '') + '</div>';
    const others = Array.from(sm.entries()).filter(([id]) => id !== me.id).sort((a, b) => b[1][b[1].length - 1].ts - a[1][a[1].length - 1].ts);
    const fresh = others.filter(([, a]) => hasUnseen(a)), seen = others.filter(([, a]) => !hasUnseen(a));
    const row = ([id, a]) => '<div class="pg-row" data-story="' + esc(id) + '"><span class="pg-ring ' + (hasUnseen(a) ? '' : 'seen') + '">' + avHTML(id) + '</span><div class="rm"><b>' + esc(cname(S.contacts.get(id))) + '</b><small>' + a.length + ' update' + (a.length > 1 ? 's' : '') + ' · ' + listTime(a[a.length - 1].ts) + '</small></div></div>';
    if (fresh.length) h += '<div class="pg-sec">Recent updates</div>' + fresh.map(row).join('');
    if (seen.length) h += '<div class="pg-sec">Viewed updates</div>' + seen.map(row).join('');
    const notes = Array.from(S.contacts.values()).filter(c => c.note && Date.now() - c.noteTs < CFG.noteHours * 36e5 && !c.isBot).sort((a, b) => b.noteTs - a.noteTs);
    if (notes.length) h += '<div class="pg-sec">Notes</div>' + notes.map(c => '<div class="pg-notecard"><div style="display:flex;align-items:center;gap:10px" data-chat="' + esc(c.id) + '">' + avHTML(c.id) + '<b>' + esc(cname(c)) + '</b><small style="margin-left:auto;color:var(--sub)">' + listTime(c.noteTs) + '</small></div><p>' + esc(c.note) + '</p>' + (c.music ? '<span class="pg-music" data-music="' + esc(c.music) + '">' + ic('music', 15) + ' Play song</span>' : '') + '</div>').join('');
    if (!fresh.length && !seen.length && !notes.length) h += '<div class="rd-empty">' + ic('status', 44) + '<br><br>No updates yet.<br>Status aur notes sirf unhi ko dikhte hain jinse aapki chat hai.</div>';
    box.innerHTML = h;
}
async function noteEditor() {
    const P = openPage('Note'), me = S.me, on = me.note && Date.now() - me.noteTs < CFG.noteHours * 36e5;
    const chips = ['Available', 'Busy', 'At work', 'In a meeting', 'Sleeping', 'Battery low', 'Out of town'];
    P.body.innerHTML = '<div class="pg-card"><span class="pg-lbl">Your note (24 hours)</span><textarea class="pg-in" id="nTxt" maxlength="80" placeholder="What\'s on your mind?">' + esc(on ? me.note : '') + '</textarea>' +
        '<div class="pg-bgs" style="flex-wrap:wrap;overflow:visible">' + chips.map(c => '<span class="pg-pill" style="cursor:pointer;padding:7px 12px;font-size:13px" data-chip="' + c + '">' + c + '</span>').join('') + '</div>' +
        '<span class="pg-lbl">Song (YouTube / YouTube Music link)</span><input class="pg-in" id="nMusic" placeholder="https://music.youtube.com/watch?v=…" value="' + esc(on ? me.music : '') + '" autocapitalize="none" autocomplete="off">' +
        '<p class="pg-hint">Note aur song unhe dikhega jinse aapki chat hai — updates tab me aur chat ke upar.</p><button class="pg-btn" id="nGo">Share note</button>' + (on ? '<button class="pg-btn ghost" id="nDel">Remove note</button>' : '') + '</div>';
    P.body.querySelectorAll('[data-chip]').forEach(c => c.onclick = () => { $('nTxt').value = c.dataset.chip; });
    const save = async (note, music) => {
        try { await API.updateUser(S.me.id, { note, noteTs: Date.now(), music }); Object.assign(S.me, { note, noteTs: Date.now(), music }); await kvSet('me', stripMe()); toast(note ? 'Note shared' : 'Note removed'); P.close(); renderAllSoon(); }
        catch (e) { toast('Save nahi hua: ' + (e.message || '')); }
    };
    $('nGo').onclick = () => {
        const music = $('nMusic').value.trim(); if (music && !/^https?:\/\//i.test(music)) { toast('Link https:// se shuru hona chahiye'); return; }
        const note = $('nTxt').value.trim(); if (!note && !music) { toast('Kuch likho'); return; }
        save(note, music);
    };
    if ($('nDel')) $('nDel').onclick = () => save('', '');
}

/* ---- stories ---- */
const STORY_BG = ['#00a884', '#128c7e', '#7f66ff', '#ff2e74', '#ff7a1a', '#2f80ed', '#111b21', '#8e24aa'];
async function postStory(o) {
    if (!S.online) { toast('Status ke liye internet chahiye'); return false; }
    toast('Posting…');
    try {
        let fileId = '', key = '', iv = '';
        if (o.blob) {
            if (o.blob.size > CFG.maxServerFileMB * 1048576) { toast('File badi hai (40 MB tak)'); return false; }
            const sealed = await CR.sealBlob(o.blob); fileId = await API.uploadFile(sealed.blob, 's.bin', { del: [S.me.id] }); key = sealed.key; iv = sealed.iv;
        }
        const readIds = Array.from(new Set(Array.from(S.contacts.values()).filter(c => !c.isBot && !isSelf(c.id)).map(accountOf)));
        await API.createStory({ userId: S.me.id, kind: o.kind, fileId, key, iv, mime: o.mime || '', caption: o.caption || '', bg: o.bg || '', ts: Date.now(), exp: Date.now() + CFG.storyHours * 36e5 }, readIds, S.me.id);
        await loadStories(); toast('Status posted'); return true;
    } catch (e) { console.warn(e); toast('Post nahi hua: ' + (e.message || '')); return false; }
}
async function composeMediaStory(cam) {
    const f = (await pickFile('image/*,video/*'))[0]; if (!f) return;
    const isV = f.type.startsWith('video/'), src = URL.createObjectURL(f);
    const P = openPage('New status', { onClose: () => URL.revokeObjectURL(src) });
    P.body.innerHTML = '<div style="background:#000;display:flex;justify-content:center;max-height:55vh">' + (isV ? '<video src="' + src + '" controls playsinline style="max-width:100%;max-height:55vh"></video>' : '<img src="' + src + '" style="max-width:100%;max-height:55vh">') + '</div><div class="pg-card"><span class="pg-lbl">Caption</span><input class="pg-in" id="sCap" maxlength="140" placeholder="Add a caption…"><button class="pg-btn" id="sGo">Share status</button></div>';
    $('sGo').onclick = async () => {
        $('sGo').disabled = true; const blob = isV ? f : await downscale(f, 1600, .85);
        if (await postStory({ kind: isV ? 'video' : 'image', blob, mime: isV ? f.type : 'image/jpeg', caption: $('sCap').value.trim() })) P.close(); else $('sGo').disabled = false;
    };
}
function composeTextStory() {
    const P = openPage('Text status'); let bg = STORY_BG[0];
    P.body.innerHTML = '<div class="pg-tstory" id="tsPrev" style="background:' + bg + '">Type something…</div><div class="pg-bgs" id="tsBgs">' + STORY_BG.map((c, i) => '<i data-c="' + c + '" class="' + (i ? '' : 'on') + '" style="background:' + c + '"></i>').join('') + '</div><div class="pg-card"><textarea class="pg-in" id="tsTxt" maxlength="200" placeholder="Write a status…" style="margin-top:12px"></textarea><button class="pg-btn" id="tsGo">Share status</button></div>';
    $('tsTxt').oninput = () => { $('tsPrev').textContent = $('tsTxt').value || 'Type something…'; };
    $('tsBgs').onclick = e => { const i = e.target.closest('i'); if (!i) return; bg = i.dataset.c; $('tsPrev').style.background = bg; $('tsBgs').querySelectorAll('i').forEach(x => x.classList.toggle('on', x === i)); };
    $('tsGo').onclick = async () => { const t = $('tsTxt').value.trim(); if (!t) { toast('Kuch likho'); return; } $('tsGo').disabled = true; if (await postStory({ kind: 'text', caption: t, bg })) P.close(); else $('tsGo').disabled = false; };
}
const storyBlobs = {};
async function storyURL(s) {
    if (storyBlobs[s.$id]) return storyBlobs[s.$id];
    const buf = await API.fetchFile(s.fileId), b = await CR.openBlob(buf, s.key, s.iv, s.mime);
    return (storyBlobs[s.$id] = URL.createObjectURL(b));
}
function openStories(uid) {
    const items = storyMap().get(uid); if (!items || !items.length) return;
    let i = items.findIndex(s => !S.seenStories[s.$id]); if (i < 0) i = 0;
    let el = $('pgStory'); if (el) el.remove();
    el = document.createElement('div'); el.id = 'pgStory'; $('rdApp').appendChild(el);
    let timer = null, t0 = 0, dur = 5000, paused = false, alive = true, vid = null;
    const mineS = uid === S.me.id;
    function stop() { clearInterval(timer); timer = null; if (vid) { try { vid.pause(); } catch (e) {} } }
    async function show() {
        stop(); const s = items[i]; if (!s) { nav.close('story'); return; }
        S.seenStories[s.$id] = 1; kvSet('storySeen', S.seenStories);
        el.innerHTML = '<div class="bars">' + items.map((x, k) => '<i><b style="width:' + (k < i ? 100 : 0) + '%"></b></i>').join('') + '</div><div class="top"><button class="rd-ibtn" id="stBack" style="color:#fff">' + ic('back', 22) + '</button>' + avHTML(uid) + '<div><b>' + esc(mineS ? 'My status' : cname(S.contacts.get(uid))) + '</b><small>' + listTime(s.ts) + '</small></div>' + (mineS ? '<button class="rd-ibtn" id="stDel" style="color:#fff">' + ic('trash', 22) + '</button>' : '') + '</div><div class="stage" id="stStage"><div class="rd-empty" style="color:#fff">Loading…</div></div><div class="hit" style="left:0" data-d="-1"></div><div class="hit" style="right:0" data-d="1"></div>' +
            (s.caption && s.kind !== 'text' ? '<div class="cap">' + esc(s.caption) + '</div>' : '') + (mineS ? '' : '<div class="rep"><input id="stRep" placeholder="Reply…" autocomplete="off"><button class="rd-send" id="stSend">' + ic('send', 20) + '</button></div>');
        $('stBack').onclick = () => nav.close('story');
        if ($('stDel')) $('stDel').onclick = async () => { if (await confirmBox('Delete this status?', '', 'Delete', true)) { stop(); if (s.fileId) API.deleteFile(s.fileId).catch(() => {}); await API.deleteStory(s.$id).catch(() => {}); S.stories = S.stories.filter(x => x.$id !== s.$id); items.splice(i, 1); if (!items.length) { nav.close('story'); renderAllSoon(); } else { i = Math.min(i, items.length - 1); show(); } } };
        if ($('stRep')) { const rin = $('stRep'); rin.onfocus = () => { paused = true; if (vid) vid.pause(); }; rin.onblur = () => { paused = false; if (vid && alive) vid.play().catch(() => {}); }; $('stSend').onclick = async () => { const t = rin.value.trim(); if (!t) return; rin.value = ''; await sendMsg(uid, { text: '↩️ Status reply: ' + t }); toast('Reply sent'); }; }
        el.querySelectorAll('.hit').forEach(h => h.onclick = () => go(+h.dataset.d));
        const stage = $('stStage'); vid = null; dur = 5000;
        try {
            if (s.kind === 'text') stage.innerHTML = '<div class="tx" style="background:' + esc(s.bg || '#00a884') + '">' + esc(s.caption) + '</div>';
            else {
                const u = await storyURL(s); if (!alive || items[i] !== s) return;
                if (s.kind === 'video') { stage.innerHTML = '<video id="stVid" src="' + u + '" playsinline autoplay></video>'; vid = $('stVid'); vid.onloadedmetadata = () => { dur = Math.min(60000, (vid.duration || 8) * 1000); }; vid.onended = () => go(1); vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); }); }
                else stage.innerHTML = '<img src="' + u + '">';
            }
        } catch (e) { stage.innerHTML = '<div class="rd-empty" style="color:#fff">Status load nahi hua</div>'; }
        t0 = Date.now();
        timer = setInterval(() => {
            if (paused) { t0 += 100; return; }
            const el0 = el.querySelectorAll('.bars b')[i]; const p = vid && vid.duration ? vid.currentTime / vid.duration : (Date.now() - t0) / dur;
            if (el0) el0.style.width = Math.min(100, p * 100) + '%'; if (p >= 1) go(1);
        }, 100);
    }
    function go(d) { i += d; if (i < 0) i = 0; if (i >= items.length) { nav.close('story'); return; } show(); }
    nav.push('story', () => { alive = false; stop(); el.remove(); renderAllSoon(); });
    show();
}

/* ======================= CALLS ======================= */
function renderCalls() {
    const box = $('callLog'); if (!box) return;
    const log = S.msgs.filter(m => m.sk === 'call' && m.cl && !S.chats.get(m.chat).deleted).sort((a, b) => b.ts - a.ts).slice(0, 80);
    box.innerHTML = log.length ? log.map(m => {
        const bad = m.cl.result !== 'ok' && m.cl.dir === 'in', out = m.cl.dir === 'out';
        return '<div class="pg-row" data-open="' + esc(m.chat) + '">' + avHTML(m.chat) + '<div class="rm"><b style="' + (bad ? 'color:#e53935' : '') + '">' + esc(chatName(m.chat)) + '</b><small>' + ic(out ? 'arr-out' : 'arr-in', 13) + ' ' + esc(m.text) + ' · ' + listTime(m.ts) + '</small></div><button class="rd-ibtn" style="color:var(--ac)" data-call="' + esc(m.chat) + '" data-kind="' + (m.cl.kind === 'video' ? 'video' : 'audio') + '">' + ic(m.cl.kind === 'video' ? 'video' : 'phone', 22) + '</button></div>';
    }).join('') : '<div class="rd-empty">' + ic('phone', 44) + '<br><br>No calls yet.<br>Username daalo aur seedha call karo — chat ki zarurat nahi.</div>';
}
const renderCallsSoon = debounce(renderCalls, 100);

/* ======================= YOU / PROFILE ======================= */
function renderYou() {
    const box = $('paneYou'); if (!box) return;
    const me = S.me, sm = storyMap(), noteOn = me.note && Date.now() - me.noteTs < CFG.noteHours * 36e5;
    const bots = Array.from(S.bots.values());
    box.innerHTML = '<div class="rd-prof-top" style="margin-bottom:8px;position:relative"><div style="display:inline-block;position:relative">' + (noteOn ? '<div class="pg-note" style="max-width:150px;font-size:12px">' + esc(me.note) + '</div>' : '') +
        '<span class="rd-av big" id="youAv" style="cursor:pointer"></span></div><button class="rd-prof-photo" id="youPhoto">Change photo</button><div class="rd-prof-name">' + esc(me.name || me.username) + '</div><div class="rd-prof-st">@' + esc(me.username) + '</div><div style="color:var(--sub);margin-top:6px">' + esc(me.bio || '') + '</div></div>' +
        '<div class="pg-card"><div class="pg-row" data-y="edit"><div class="ri">' + ic('edit', 20) + '</div><div class="rm"><b>Edit profile</b><small>Name, bio</small></div></div>' +
        '<div class="pg-row" data-y="note"><div class="ri">' + ic('status', 20) + '</div><div class="rm"><b>Note & status</b><small>' + (noteOn ? esc(me.note) : 'Share a note or song') + '</small></div></div>' +
        '<div class="pg-row" data-y="self"><div class="ri">' + ic('bookmark', 20) + '</div><div class="rm"><b>Message yourself</b><small>Notes & files for you</small></div></div>' +
        '<div class="pg-row" data-y="star"><div class="ri">' + ic('star', 20) + '</div><div class="rm"><b>Starred messages</b></div></div>' +
        '<div class="pg-row" data-y="arch"><div class="ri">' + ic('archive', 20) + '</div><div class="rm"><b>Archived chats</b></div></div></div>' +
        '<div class="pg-card"><h4>BOTS</h4>' + bots.map(b => '<div class="pg-row" data-bot="' + b.id + '">' + avHTML(b.id) + '<div class="rm"><b>' + esc(b.name) + '</b><small>@' + esc(b.username) + ' · ' + (b.on === false ? 'off' : 'running') + '</small></div>' + ic('chev', 18) + '</div>').join('') +
        '<div class="pg-row" data-y="newbot"><div class="ri">' + ic('bot', 20) + '</div><div class="rm"><b>Create bot</b><small>Auto-reply, Telegram, Discord & more</small></div></div></div>' +
        '<div class="pg-card"><div class="pg-row" data-y="set"><div class="ri">' + ic('settings', 20) + '</div><div class="rm"><b>Settings</b><small>Theme, sound, notifications, wallpaper, privacy</small></div></div>' +
        '<div class="pg-row" data-y="out"><div class="ri red">' + ic('logout', 20) + '</div><div class="rm"><b style="color:#e53935">Log out</b></div></div></div><div class="rd-foot" style="background:transparent">Ping v' + CFG.version + ' · end-to-end encrypted</div>';
    paintAv($('youAv'), S.me.id, 'big');
    const av = $('youAv'); if (sm.get(S.me.id)) av.style.boxShadow = '0 0 0 4px var(--ac)';
}
const renderYouSoon = debounce(renderYou, 100);
async function changeMyPhoto() {
    const blob = await pickAndCropPhoto(); if (!blob) return;
    if (!S.online) { toast('Internet chahiye'); return; }
    toast('Uploading…');
    try {
        const old = S.me.avatar, id = await uploadAvatar(blob);
        await API.updateUser(S.me.id, { avatar: id }); S.me.avatar = id; await kvSet('me', stripMe());
        if (old) API.deleteFile(old).catch(() => {});
        toast('Photo updated'); renderAllSoon(); updHead();
    } catch (e) { toast('Upload nahi hua: ' + (e.message || '')); }
}
function editProfile() {
    const P = openPage('Edit profile');
    P.body.innerHTML = '<div class="pg-card"><div style="text-align:center;padding:18px"><span class="rd-av big" id="epAv"></span><br><button class="rd-prof-photo" id="epPh">Change photo</button></div><span class="pg-lbl">Name</span><input class="pg-in" id="epName" maxlength="40" value="' + esc(S.me.name) + '"><span class="pg-lbl">Bio</span><textarea class="pg-in" id="epBio" maxlength="140">' + esc(S.me.bio) + '</textarea><span class="pg-lbl">Username</span><input class="pg-in" value="@' + esc(S.me.username) + '" disabled style="opacity:.6"><p class="pg-hint">Username baad me change nahi hota.</p><button class="pg-btn" id="epGo">Save</button></div>';
    paintAv($('epAv'), S.me.id, 'big'); $('epPh').onclick = async () => { await changeMyPhoto(); paintAv($('epAv'), S.me.id, 'big'); };
    $('epGo').onclick = async () => {
        const name = $('epName').value.trim(), bio = $('epBio').value.trim(); if (!name) { toast('Naam likho'); return; }
        try { await API.updateUser(S.me.id, { name, bio }); S.me.name = name; S.me.bio = bio; await kvSet('me', stripMe()); toast('Saved'); P.close(); renderAllSoon(); } catch (e) { toast('Save nahi hua'); }
    };
}
function wireYou() {
    $('paneYou').addEventListener('click', e => {
        if (e.target.closest('#youAv')) { const sm = storyMap(); if (sm.get(S.me.id)) openStories(S.me.id); else { const u = avInfo(S.me.id).photo; if (u) openViewer(u, 'image'); } return; }
        if (e.target.closest('#youPhoto')) { changeMyPhoto(); return; }
        const b = e.target.closest('[data-bot]'); if (b) { manageBot(S.bots.get(b.dataset.bot)); return; }
        const r = e.target.closest('[data-y]'); if (!r) return;
        ({ edit: editProfile, note: noteEditor, self: () => openChat(S.me.id), star: () => openStarred(), arch: () => { S.showArchived = true; setTab('chats'); }, newbot: createBotPage, set: openSettings, out: doLogout })[r.dataset.y]();
    });
}

/* ======================= NEW CHAT / GROUP ======================= */
function userRow(c, extra) { return '<div class="pg-row" data-id="' + esc(c.id) + '">' + avHTML(c.id) + '<div class="rm"><b>' + esc(cname(c)) + (c.isBot ? ' <span class="pg-tag">BOT</span>' : '') + '</b><small>@' + esc(c.username) + (c.bio ? ' · ' + esc(c.bio) : '') + '</small></div>' + (extra || '') + '</div>'; }
function newChatPage() {
    const P = openPage('New chat');
    P.body.innerHTML = '<div class="pg-card"><span class="pg-lbl">Find by username</span><input class="pg-in" id="ncQ" placeholder="@username" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false"></div><div class="pg-card" id="ncRes"></div>';
    const draw = (found) => {
        const q = normUser($('ncQ').value);
        let h = '';
        if (!q) h += '<div class="pg-row" data-new="group"><div class="ri">' + ic('users', 20) + '</div><div class="rm"><b>New group</b></div></div><div class="pg-row" data-new="self"><div class="ri">' + ic('bookmark', 20) + '</div><div class="rm"><b>Message yourself</b></div></div><div class="pg-row" data-new="bot"><div class="ri">' + ic('bot', 20) + '</div><div class="rm"><b>Create a bot</b></div></div>';
        const seen = new Set();
        (found || []).forEach(c => { if (!seen.has(c.id) && c.id !== S.me.id) { seen.add(c.id); h += userRow(c); } });
        if (!q) { h += '<div class="pg-sec">Contacts</div>'; Array.from(S.contacts.values()).filter(c => c.id !== S.me.id && !seen.has(c.id)).sort((a, b) => cname(a).localeCompare(cname(b))).forEach(c => { h += userRow(c); }); }
        else if (!seen.size) h += '<div class="rd-empty">' + (validUser(q) ? 'No user "@' + esc(q) + '"' : 'Username: 3-24 letters, numbers, . _') + '</div>';
        $('ncRes').innerHTML = h;
    };
    const search = debounce(async () => {
        const q = normUser($('ncQ').value); if (q.length < 3) { draw(null); return; }
        if (!S.online) { draw(Array.from(S.contacts.values()).filter(c => c.username && c.username.startsWith(q))); return; }
        try { const docs = await API.searchUsers(q), cs = []; for (const d of docs) cs.push(await upsertContact(d)); draw(cs); } catch (e) { draw([]); }
    }, 350);
    $('ncQ').oninput = () => { if (normUser($('ncQ').value).length < 3) draw(null); else search(); };
    P.body.onclick = async e => {
        const n = e.target.closest('[data-new]');
        if (n) { P.close(); setTimeout(() => ({ group: newGroupFlow, self: () => openChat(S.me.id), bot: createBotPage })[n.dataset.new](), 240); return; }
        const r = e.target.closest('[data-id]'); if (!r) return;
        P.close(); setTimeout(() => openChat(r.dataset.id), 240);
    };
    draw(null); setTimeout(() => $('ncQ').focus(), 300);
}
function pickPeople(title, exclude, cb, btn) {
    const P = openPage(title), sel = new Set(), extra = new Map();
    P.body.innerHTML = '<div class="pg-card"><span class="pg-lbl">Add by username</span><input class="pg-in" id="ppQ" placeholder="@username" autocapitalize="none" autocomplete="off"></div><div class="pg-card" id="ppL"></div><button class="pg-btn" id="ppGo" disabled>' + esc(btn || 'Next') + '</button>';
    const list = () => { const m = new Map(); S.contacts.forEach(c => { if (!c.isBot && c.id !== S.me.id && !exclude.includes(c.id)) m.set(c.id, c); }); extra.forEach((c, id) => { if (!exclude.includes(id)) m.set(id, c); }); return Array.from(m.values()).sort((a, b) => cname(a).localeCompare(cname(b))); };
    const draw = () => { $('ppL').innerHTML = list().map(c => userRow(c, '<span class="pg-chk ' + (sel.has(c.id) ? 'on' : '') + '">' + (sel.has(c.id) ? ic('check', 14) : '') + '</span>')).join('') || '<div class="rd-empty">Username se kisi ko dhoondh ke add karo</div>'; $('ppGo').disabled = !sel.size; $('ppGo').textContent = (btn || 'Next') + (sel.size ? ' (' + sel.size + ')' : ''); };
    $('ppQ').oninput = debounce(async () => {
        const q = normUser($('ppQ').value); if (q.length < 3 || !S.online) return;
        try { for (const d of await API.searchUsers(q)) { if (d.$id !== S.me.id && !d.isBot) { const c = await upsertContact(d); extra.set(c.id, c); } } draw(); } catch (e) {}
    }, 350);
    P.body.onclick = e => { const r = e.target.closest('[data-id]'); if (r) { sel.has(r.dataset.id) ? sel.delete(r.dataset.id) : sel.add(r.dataset.id); draw(); } };
    $('ppGo').onclick = async () => { const ids = Array.from(sel); P.close(); setTimeout(() => cb(ids), 250); };
    draw();
}
function newGroupFlow() {
    pickPeople('New group', [], async ids => {
        const name = await promptBox('Group name', 'e.g. Family', '', 40); if (!name || !name.trim()) return;
        const c = await createGroup(name.trim(), ids); openChat(c.id);
    }, 'Next');
}

/* ======================= CONTACT / GROUP INFO ======================= */
async function openInfo(id) {
    const c = chatOf(id); if (!c) return;
    if (c.type === 'group') return groupInfo(id);
    const ct = S.contacts.get(id) || {}, self = isSelf(id), P = openPage(self ? 'You' : 'Contact info');
    const draw = async () => {
        const ct = S.contacts.get(id) || {}; const noteOn = ct.note && Date.now() - ct.noteTs < CFG.noteHours * 36e5;
        const media = msgsOf(id).filter(m => m.media && m.media.state === 'ok' && (isImg(m) || isVid(m))).slice(-30).reverse();
        let sn = '';
        if (!self && ct.pub) { const g = await CR.safetyNumber(S.ident.pub, ct.pub); sn = '<div class="pg-code">' + g.map(x => '<span>' + x + '</span>').join('') + '</div><p class="pg-hint">Ye number dono ke phone par same dikhna chahiye. Call ya mil kar match karo — match ho to chat 100% secure hai.</p>'; }
        P.body.innerHTML = '<div class="rd-prof-top" style="margin-bottom:0"><span class="rd-av big" id="ciAv"></span><div class="rd-prof-name">' + esc(chatName(id)) + '</div><div class="rd-prof-st">' + (ct.username ? '@' + esc(ct.username) : '') + '</div><div style="color:var(--sub);margin-top:6px">' + esc(ct.bio || '') + '</div>' +
            (!self && !ct.isBot ? '<div style="display:flex;gap:12px;justify-content:center;margin-top:16px"><button class="pg-btn sm" data-a="a">' + ic('phone', 16) + ' Voice</button><button class="pg-btn sm" data-a="v">' + ic('video', 16) + ' Video</button></div>' : '') + '</div>' +
            (noteOn ? '<div class="pg-notecard"><b>Note</b><p>' + esc(ct.note) + '</p>' + (ct.music ? '<span class="pg-music" data-music="' + esc(ct.music) + '">' + ic('music', 15) + ' Play song</span>' : '') + '</div>' : '') +
            (!self ? '<div class="pg-card"><div class="pg-row" data-a="nick"><div class="ri">' + ic('edit', 20) + '</div><div class="rm"><b>Nickname</b><small>' + esc(ct.nick || 'Add nickname (only you see it)') + '</small></div></div></div>' : '') +
            '<div class="pg-card"><div class="pg-row" data-a="mute"><div class="ri">' + ic('bell-off', 20) + '</div><div class="rm"><b>Mute notifications</b></div><button class="pg-sw ' + (c.muted ? 'on' : '') + '"></button></div><div class="pg-row" data-a="star"><div class="ri">' + ic('star', 20) + '</div><div class="rm"><b>Starred messages</b></div></div></div>' +
            (!self ? '<div class="pg-card"><h4>ENCRYPTION</h4>' + (ct.keyWarn ? '<div class="pg-warn">' + ic('shield', 14) + ' Security code changed. Verify before trusting.</div>' : '') + '<div style="padding:6px 16px 0;color:var(--tx);font-size:14px">' + ic('lock', 14) + ' Messages & calls are end-to-end encrypted. Har message ki alag key hoti hai.</div>' + sn + '<div style="padding:4px 16px 0;color:var(--sub);font-size:12.5px">Key ID: <span style="font-family:monospace">' + esc(ct.pub ? await CR.keyId(ct.pub) : '-') + '</span> ' + (ct.verified ? '<span class="pg-pill">Verified</span>' : '') + '</div>' +
                '<button class="pg-btn sm" style="margin:12px 16px" data-a="verify">' + (ct.verified ? 'Remove verified mark' : 'Mark as verified') + '</button>' + (ct.keyWarn ? ' <button class="pg-btn sm red" data-a="trust">Accept new key</button>' : '') + '</div>' : '') +
            (media.length ? '<div class="pg-card"><h4>MEDIA</h4><div class="rd-pgrid" id="ciMedia">' + media.map(m => '<div class="rd-pcell" data-m="' + m.id + '">' + (isVid(m) ? '<video data-hy="' + m.id + '" preload="metadata"></video><span class="pl">▶</span>' : '<img data-hy="' + m.id + '">') + '</div>').join('') + '</div></div>' : '') +
            (ct.isBot && ct.owner === S.me.id ? '<div class="pg-card"><div class="pg-row" data-a="bot"><div class="ri">' + ic('bot', 20) + '</div><div class="rm"><b>Manage bot</b></div></div></div>' : '');
        paintAv($('ciAv'), id, 'big'); hydrate(P.body);
    };
    await draw();
    P.body.onclick = async e => {
        if (e.target.closest('#ciAv')) { const u = avInfo(id).photo; if (u) openViewer(u, 'image'); return; }
        const mu = e.target.closest('[data-music]'); if (mu) { openLink(mu.dataset.music, 'Music'); return; }
        const mm = e.target.closest('[data-m]'); if (mm) { const u = await getURL(mm.dataset.m), m = getMsg(mm.dataset.m); if (u) openViewer(u, isVid(m) ? 'video' : 'image'); return; }
        const a = e.target.closest('[data-a]'); if (!a) return; const ct = S.contacts.get(id) || {};
        switch (a.dataset.a) {
            case 'a': P.close(); CALL.start(id, 'audio'); break;
            case 'v': P.close(); CALL.start(id, 'video'); break;
            case 'nick': { const v = await promptBox('Nickname', cname(Object.assign({}, ct, { nick: '' })), ct.nick || '', 30); if (v !== null) { ct.nick = v.trim(); await saveContact(ct); emit('contacts', id); await draw(); updHead(); } break; }
            case 'mute': c.muted = !c.muted; await saveChat(c); await draw(); break;
            case 'star': P.close(); setTimeout(() => openStarred(id), 240); break;
            case 'verify': ct.verified = !ct.verified; await saveContact(ct); await draw(); break;
            case 'trust': ct.keyWarn = false; await saveContact(ct); await draw(); renderMessages(); break;
            case 'bot': P.close(); setTimeout(() => manageBot(S.bots.get(id)), 240); break;
        }
    };
}
function groupInfo(id) {
    const c = chatOf(id), P = openPage('Group info');
    const draw = () => {
        const admin = c.admins.includes(S.me.id) && !c.left;
        P.body.innerHTML = '<div class="rd-prof-top" style="margin-bottom:0"><span class="rd-av big" id="giAv"></span><div class="rd-prof-name">' + esc(c.name) + '</div><div class="rd-prof-st">' + c.members.length + ' members</div>' + (admin ? '<button class="rd-prof-photo" data-a="photo">Change group photo</button> <button class="rd-prof-photo" data-a="rename">Rename</button>' : '') + '</div>' +
            '<div class="pg-card"><div class="pg-row" data-a="mute"><div class="ri">' + ic('bell-off', 20) + '</div><div class="rm"><b>Mute notifications</b></div><button class="pg-sw ' + (c.muted ? 'on' : '') + '"></button></div></div>' +
            '<div class="pg-card"><h4>MEMBERS</h4>' + (admin ? '<div class="pg-row" data-a="add"><div class="ri">' + ic('user-plus', 20) + '</div><div class="rm"><b>Add members</b></div></div>' : '') +
            c.members.map(m => '<div class="pg-row" data-mem="' + esc(m) + '">' + avHTML(m) + '<div class="rm"><b>' + esc(m === S.me.id ? 'You' : cname(S.contacts.get(m))) + '</b><small>' + (S.contacts.get(m) && S.contacts.get(m).username ? '@' + esc(S.contacts.get(m).username) : '') + '</small></div>' + (c.admins.includes(m) ? '<span class="pg-pill">Admin</span>' : '') + '</div>').join('') + '</div>' +
            '<div class="pg-card">' + (!c.left ? '<div class="pg-row" data-a="leave"><div class="ri red">' + ic('logout', 20) + '</div><div class="rm"><b style="color:#e53935">Leave group</b></div></div>' : '') + '<div class="pg-row" data-a="del"><div class="ri red">' + ic('trash', 20) + '</div><div class="rm"><b style="color:#e53935">Delete chat</b></div></div></div>';
        paintAv($('giAv'), id, 'big');
    };
    draw();
    P.body.onclick = async e => {
        if (e.target.closest('#giAv')) { const u = avInfo(id).photo; if (u) openViewer(u, 'image'); return; }
        const mem = e.target.closest('[data-mem]');
        if (mem) {
            const m = mem.dataset.mem, admin = c.admins.includes(S.me.id) && !c.left; if (m === S.me.id) return;
            const items = [{ label: 'Message', icon: 'chat', fn: () => { P.close(); setTimeout(() => openChat(m), 240); } }];
            if (admin) { items.push({ label: c.admins.includes(m) ? 'Remove admin' : 'Make admin', icon: 'shield', fn: async () => { await updateGroup(c, { admins: c.admins.includes(m) ? c.admins.filter(x => x !== m) : c.admins.concat(m) }); draw(); } }); items.push({ label: 'Remove from group', icon: 'x', danger: true, fn: async () => { await updateGroup(c, { members: c.members.filter(x => x !== m), admins: c.admins.filter(x => x !== m) }, 'You removed ' + cname(S.contacts.get(m))); draw(); } }); }
            menu(items); return;
        }
        const a = e.target.closest('[data-a]'); if (!a) return;
        switch (a.dataset.a) {
            case 'mute': c.muted = !c.muted; await saveChat(c); draw(); break;
            case 'rename': { const v = await promptBox('Group name', '', c.name, 40); if (v && v.trim() && v.trim() !== c.name) { await updateGroup(c, { name: v.trim() }, 'You renamed the group to “' + v.trim() + '”'); draw(); updHead(); } break; }
            case 'photo': { const b = await pickAndCropPhoto(); if (b) { try { const f = await uploadAvatar(b); await updateGroup(c, { av: f }, 'You changed the group photo'); draw(); updHead(); } catch (er) { toast('Upload nahi hua'); } } break; }
            case 'add': P.close(); setTimeout(() => pickPeople('Add members', c.members, async ids => { await updateGroup(c, { members: c.members.concat(ids) }, 'You added ' + ids.map(x => cname(S.contacts.get(x))).join(', ')); subscribeSoon(); }, 'Add'), 240); break;
            case 'leave': if (await confirmBox('Leave group?', '', 'Leave', true)) { await leaveGroup(c); draw(); updHead(); } break;
            case 'del': if (await confirmBox('Delete this chat?', '', 'Delete', true)) { await deleteChatLocal(c); P.close(); closeChat(); } break;
        }
    };
}

/* ======================= SETTINGS ======================= */
function openSettings() {
    const P = openPage('Settings');
    const sw = (k, on) => '<button class="pg-sw ' + (on ? 'on' : '') + '" data-sw="' + k + '"></button>';
    const draw = () => {
        const s = S.set;
        P.body.innerHTML = '<div class="pg-card"><h4>APPEARANCE</h4><div style="padding:8px 16px 14px"><div class="pg-seg" id="stTheme">' + [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].map(([k, n]) => '<button data-t="' + k + '" class="' + (s.theme === k ? 'on' : '') + '">' + n + '</button>').join('') + '</div></div>' +
            '<div class="pg-row" data-a="wall"><div class="ri">' + ic('palette', 20) + '</div><div class="rm"><b>Chat wallpaper</b><small>Presets or upload from gallery</small></div>' + ic('chev', 18) + '</div></div>' +
            '<div class="pg-card"><h4>SOUND & NOTIFICATIONS</h4>' +
            '<div class="pg-row"><div class="ri">' + ic(s.sound ? 'volume' : 'volume-x', 20) + '</div><div class="rm"><b>Sounds</b><small>Message & call tones (mute all)</small></div>' + sw('sound', s.sound) + '</div>' +
            '<div class="pg-row"><div class="ri">' + ic('phone', 20) + '</div><div class="rm"><b>Vibration</b></div>' + sw('vibrate', s.vibrate) + '</div>' +
            '<div class="pg-row"><div class="ri">' + ic('bell', 20) + '</div><div class="rm"><b>Notifications</b><small>' + (('Notification' in window) ? 'Permission: ' + Notification.permission : 'Not supported here') + '</small></div>' + sw('notif', s.notif) + '</div>' +
            '<div class="pg-row"><div class="ri">' + ic('eye', 20) + '</div><div class="rm"><b>Message preview</b><small>Show text in notifications</small></div>' + sw('preview', s.preview) + '</div></div>' +
            '<div class="pg-card"><h4>PRIVACY</h4>' +
            '<div class="pg-row"><div class="ri">' + ic('check', 20) + '</div><div class="rm"><b>Read receipts</b><small>Blue ticks</small></div>' + sw('readReceipts', s.readReceipts) + '</div>' +
            '<div class="pg-row"><div class="ri">' + ic('user', 20) + '</div><div class="rm"><b>Show online / last seen</b></div>' + sw('showLastSeen', s.showLastSeen) + '</div>' +
            '<div class="pg-row"><div class="ri">' + ic('type', 20) + '</div><div class="rm"><b>Typing indicator</b></div>' + sw('typing', s.typing) + '</div>' +
            '<div class="pg-row"><div class="ri">' + ic('send', 20) + '</div><div class="rm"><b>Enter key sends</b></div>' + sw('enterSend', s.enterSend) + '</div></div>' +
            '<div class="pg-card"><h4>SECURITY</h4><div class="pg-row" data-a="key"><div class="ri">' + ic('key', 20) + '</div><div class="rm"><b>My security code</b><small>Key ID for verification</small></div>' + ic('chev', 18) + '</div></div>' +
            '<div class="pg-card"><div class="pg-row" data-a="out"><div class="ri red">' + ic('logout', 20) + '</div><div class="rm"><b style="color:#e53935">Log out</b></div></div></div><div class="rd-foot" style="background:transparent">Ping v' + CFG.version + '</div>';
    };
    draw();
    P.body.onclick = async e => {
        const t = e.target.closest('[data-t]'); if (t) { await saveSettings({ theme: t.dataset.t }); applyTheme(); applyWall(S.cur); draw(); return; }
        const w = e.target.closest('[data-sw]');
        if (w) {
            const k = w.dataset.sw, v = !S.set[k];
            if (k === 'notif' && v) { const r = await askNotifPermission(); if (r !== 'granted') { toast('Browser settings me notification allow karo'); } }
            await saveSettings({ [k]: v }); if (k === 'sound' && v) { SFX.unlock(); SFX.pop(); } if (k === 'showLastSeen') heartbeat(); draw(); return;
        }
        const a = e.target.closest('[data-a]'); if (!a) return;
        if (a.dataset.a === 'wall') wallSheet(null);
        if (a.dataset.a === 'out') doLogout();
        if (a.dataset.a === 'key') { const k = await CR.keyId(S.ident.pub); dialog('My security code', 'Key ID: ' + k + '\n\nIs device ki private key kabhi bahar nahi jati.', [{ label: 'OK', val: true }]); }
    };
}
async function doLogout() {
    if (!(await confirmBox('Log out?', 'Is device se saari chats, keys aur media hat jayegi (messages server par save nahi hote). Dobara login karne par purani chats wapas nahi aayengi.', 'Log out', true))) return;
    stopNet(); try { await API.logout(); } catch (e) {}
    try { if (S.me) await Promise.all(Array.from(S.bots.keys()).map(id => API.deleteUser(id).catch(() => {}))); } catch (e) {}
    await dbWipe(); try { navigator.clearAppBadge && navigator.clearAppBadge(); } catch (e) {}
    location.replace(location.pathname);
}

/* ======================= BOT UI ======================= */
function createBotPage() {
    const P = openPage('Create bot');
    P.body.innerHTML = '<div class="pg-card"><p class="pg-hint" style="margin-top:12px">Bot ek alag Ping account hota hai jiska apna key hai. Koi bhi uska username daal ke usse chat kar sakta hai. Bot tab jawab deta hai jab aapka Ping app khula ho.</p><span class="pg-lbl">Bot name</span><input class="pg-in" id="cbName" maxlength="30" placeholder="Support Bot"><span class="pg-lbl">Bot username</span><input class="pg-in" id="cbUser" maxlength="24" placeholder="mysupport_bot" autocapitalize="none" autocomplete="off"><div class="pg-err" id="cbErr"></div><button class="pg-btn" id="cbGo">Create bot</button></div>';
    $('cbGo').onclick = async () => {
        const name = $('cbName').value.trim(), u = normUser($('cbUser').value), err = $('cbErr'); err.textContent = '';
        if (!name) { err.textContent = 'Bot ka naam likho'; return; } if (!validUser(u)) { err.textContent = 'Username: 3-24 letters, numbers, . _'; return; }
        if (!S.online) { err.textContent = 'Internet chahiye'; return; }
        $('cbGo').disabled = true;
        try {
            if (await API.findByUsername(u)) { err.textContent = 'Ye username le liya gaya hai'; $('cbGo').disabled = false; return; }
            const b = await BOTS.create(name, u); P.close(); setTimeout(() => manageBot(b), 250); toast('Bot ban gaya 🎉');
        } catch (e) { err.textContent = 'Nahi bana: ' + (e.message || ''); $('cbGo').disabled = false; }
    };
}
function manageBot(b) {
    if (!b) return;
    const P = openPage(b.name);
    const draw = () => {
        const f = b.fwd || {};
        P.body.innerHTML = '<div class="rd-prof-top" style="margin-bottom:0"><span class="rd-av big" id="mbAv"></span><div class="rd-prof-name">' + esc(b.name) + '</div><div class="rd-prof-st">@' + esc(b.username) + '</div><button class="rd-prof-photo" data-a="photo">Change photo</button> <button class="rd-prof-photo" data-a="rename">Rename</button></div>' +
            '<div class="pg-card"><div class="pg-row"><div class="ri">' + ic('bot', 20) + '</div><div class="rm"><b>Bot is ' + (b.on === false ? 'OFF' : 'ON') + '</b><small>Runs while Ping is open</small></div><button class="pg-sw ' + (b.on === false ? '' : 'on') + '" data-a="on"></button></div><div class="pg-row" data-a="chat"><div class="ri">' + ic('chat', 20) + '</div><div class="rm"><b>Open chat with bot</b><small>Test it yourself</small></div></div></div>' +
            '<div class="pg-card"><h4>MESSAGES</h4><span class="pg-lbl">Welcome message (first message)</span><textarea class="pg-in" id="mbWel">' + esc(b.welcome || '') + '</textarea><span class="pg-lbl">Fallback (no rule matched)</span><textarea class="pg-in" id="mbFb" placeholder="Leave empty = no reply">' + esc(b.fallback || '') + '</textarea><p class="pg-hint">Variables: {name} {username} {time} {date}</p><button class="pg-btn sm" style="margin:10px 16px" data-a="savemsg">Save messages</button></div>' +
            '<div class="pg-card"><h4>RULES (' + (b.rules || []).length + ')</h4>' + (b.rules || []).map((r, i) => '<div class="pg-row" data-rule="' + i + '"><div class="ri">' + ic('chat', 18) + '</div><div class="rm"><b>' + esc(r.type === 'any' ? 'any message' : r.type + ': ' + r.pattern) + '</b><small>' + esc(r.reply) + '</small></div><button class="pg-sw ' + (r.on === false ? '' : 'on') + '" data-rsw="' + i + '"></button></div>').join('') + '<div class="pg-row" data-a="addrule"><div class="ri">' + ic('plus', 20) + '</div><div class="rm"><b>Add rule</b></div></div></div>' +
            '<div class="pg-card"><h4>CROSS-PLATFORM</h4>' +
            '<div class="pg-row" data-a="tg"><div class="ri" style="background:rgba(34,158,217,.15);color:#229ed9">' + ic('send', 20) + '</div><div class="rm"><b>Telegram</b><small>' + (f.tgToken ? (f.tgOn ? 'Forwarding ON' : 'Saved · off') + (f.tgChat ? ' · chat ' + esc(f.tgChat) : ' · chat id auto') : 'Bot token + chat id (optional)') + '</small></div>' + ic('chev', 18) + '</div>' +
            '<div class="pg-row" data-a="dc"><div class="ri" style="background:rgba(88,101,242,.15);color:#5865f2">' + ic('chat', 20) + '</div><div class="rm"><b>Discord</b><small>' + (f.dcUrl ? (f.dcOn ? 'Webhook ON' : 'Saved · off') : 'Channel webhook URL') + '</small></div>' + ic('chev', 18) + '</div>' +
            '<div class="pg-row" data-a="wh"><div class="ri" style="background:rgba(255,122,26,.15);color:#ff7a1a">' + ic('link', 20) + '</div><div class="rm"><b>Instagram / X / any (webhook)</b><small>' + (f.whUrl ? (f.whOn ? 'Webhook ON' : 'Saved · off') : 'Make / Zapier / n8n relay URL') + '</small></div>' + ic('chev', 18) + '</div>' +
            '<p class="pg-hint">Tokens sirf is device me save hote hain. Instagram aur X browser se seedha API nahi dete — webhook relay (Make.com, Zapier, n8n) use karo.</p></div>' +
            '<div class="pg-card"><div class="pg-row" data-a="del"><div class="ri red">' + ic('trash', 20) + '</div><div class="rm"><b style="color:#e53935">Delete bot</b></div></div></div>';
        paintAv($('mbAv'), b.id, 'big');
    };
    draw();
    P.body.onclick = async e => {
        const sw = e.target.closest('[data-rsw]'); if (sw) { const r = b.rules[+sw.dataset.rsw]; r.on = r.on === false; await BOTS.save(b); draw(); return; }
        const rl = e.target.closest('[data-rule]'); if (rl) { ruleEditor(b, +rl.dataset.rule, draw); return; }
        const a = e.target.closest('[data-a]'); if (!a) return;
        switch (a.dataset.a) {
            case 'on': b.on = b.on === false; await BOTS.save(b); botHeartbeat(); draw(); break;
            case 'chat': P.close(); setTimeout(() => openChat(b.id), 240); break;
            case 'rename': { const v = await promptBox('Bot name', '', b.name, 30); if (v && v.trim()) { await BOTS.update(b, { name: v.trim() }); draw(); P.setTitle(b.name); } break; }
            case 'photo': { const bl = await pickAndCropPhoto(); if (bl) { try { const id = await uploadAvatar(bl); await BOTS.update(b, { avatar: id }); draw(); } catch (er) { toast('Upload nahi hua'); } } break; }
            case 'savemsg': await BOTS.update(b, { welcome: $('mbWel').value, fallback: $('mbFb').value }); toast('Saved'); break;
            case 'addrule': ruleEditor(b, -1, draw); break;
            case 'tg': tgEditor(b, draw); break; case 'dc': urlEditor(b, 'dc', 'Discord webhook', 'https://discord.com/api/webhooks/…', 'Discord: Channel settings → Integrations → Webhooks → Copy URL.', draw); break;
            case 'wh': urlEditor(b, 'wh', 'Webhook (Instagram / X / other)', 'https://hook.eu1.make.com/…', 'Har incoming message JSON {bot, from, name, text, ts} me POST hota hai. Make/Zapier/n8n me Instagram DM ya X post ka scenario banao.', draw); break;
            case 'del': if (await confirmBox('Delete bot?', '@' + b.username + ' hamesha ke liye hat jayega.', 'Delete', true)) { await BOTS.remove(b); P.close(); renderAllSoon(); } break;
        }
    };
}
function ruleEditor(b, idx, done) {
    const r = idx >= 0 ? b.rules[idx] : { type: 'contains', pattern: '', reply: '', on: true };
    const P = openPage(idx >= 0 ? 'Edit rule' : 'New rule');
    P.body.innerHTML = '<div class="pg-card"><span class="pg-lbl">When message…</span><div style="padding:0 16px"><div class="pg-seg" id="ruT" style="flex-wrap:wrap">' + [['contains', 'contains'], ['equals', 'equals'], ['starts', 'starts with'], ['regex', 'regex'], ['any', 'anything']].map(([k, n]) => '<button data-k="' + k + '" class="' + (r.type === k ? 'on' : '') + '">' + n + '</button>').join('') + '</div></div><div id="ruP"><span class="pg-lbl">Text / pattern</span><input class="pg-in" id="ruPat" value="' + esc(r.pattern) + '" placeholder="hello" autocapitalize="none"></div><span class="pg-lbl">Bot replies</span><textarea class="pg-in" id="ruRep" placeholder="Hi {name}!">' + esc(r.reply) + '</textarea><p class="pg-hint">Variables: {name} {username} {time} {date}</p><button class="pg-btn" id="ruGo">Save rule</button>' + (idx >= 0 ? '<button class="pg-btn ghost red" id="ruDel" style="color:#e53935">Delete rule</button>' : '') + '</div>';
    const upd = () => { $('ruP').hidden = r.type === 'any'; };
    $('ruT').onclick = e => { const k = e.target.closest('[data-k]'); if (!k) return; r.type = k.dataset.k; $('ruT').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === k)); upd(); }; upd();
    $('ruGo').onclick = async () => {
        r.pattern = $('ruPat').value.trim(); r.reply = $('ruRep').value;
        if (r.type !== 'any' && !r.pattern) { toast('Pattern likho'); return; } if (!r.reply.trim()) { toast('Reply likho'); return; }
        if (r.type === 'regex') { try { new RegExp(r.pattern); } catch (e) { toast('Regex galat hai'); return; } }
        if (idx < 0) b.rules.push(r); await BOTS.save(b); P.close(); done();
    };
    if ($('ruDel')) $('ruDel').onclick = async () => { b.rules.splice(idx, 1); await BOTS.save(b); P.close(); done(); };
}
function tgEditor(b, done) {
    const f = b.fwd = b.fwd || {}, P = openPage('Telegram');
    P.body.innerHTML = '<div class="pg-card"><p class="pg-hint" style="margin-top:12px">@BotFather se bot banao aur token copy karo. Chat ID optional hai: khali chhodo to pehle bot ko Telegram me ek message bhejo, app khud chat id dhoondh lega.</p><span class="pg-lbl">Bot token</span><input class="pg-in" id="tgTok" value="' + esc(f.tgToken || '') + '" placeholder="123456:ABC-DEF…" autocapitalize="none" autocomplete="off"><span class="pg-lbl">Chat ID (optional)</span><input class="pg-in" id="tgChat" value="' + esc(f.tgChat || '') + '" placeholder="e.g. 123456789 or -100…" inputmode="numeric">' +
        '<div class="pg-row"><div class="rm"><b>Forward Ping messages to Telegram</b></div><button class="pg-sw ' + (f.tgOn ? 'on' : '') + '" id="tgOn"></button></div><div class="pg-row"><div class="rm"><b>Telegram → bot auto-reply</b><small>Telegram me aaye msgs par rules chalao</small></div><button class="pg-sw ' + (f.tgPoll ? 'on' : '') + '" id="tgPoll"></button></div><div class="pg-err" id="tgErr"></div><button class="pg-btn" id="tgGo">Save</button><button class="pg-btn ghost" id="tgTest">Send test message</button><button class="pg-btn ghost" id="tgDetect">Detect chat ID</button></div>';
    const tog = id => { $(id).onclick = () => $(id).classList.toggle('on'); }; tog('tgOn'); tog('tgPoll');
    const read = () => { f.tgToken = $('tgTok').value.trim(); f.tgChat = $('tgChat').value.trim(); f.tgOn = $('tgOn').classList.contains('on'); f.tgPoll = $('tgPoll').classList.contains('on'); };
    $('tgGo').onclick = async () => { read(); await BOTS.save(b); BOTS.startTg(b); toast('Saved'); P.close(); done(); };
    $('tgDetect').onclick = async () => { read(); try { const c = await BOTS.tgDetectChat(f.tgToken); if (c) { $('tgChat').value = c; toast('Chat ID: ' + c); } else $('tgErr').textContent = 'Pehle Telegram me bot ko ek message bhejo'; } catch (e) { $('tgErr').textContent = e.message; } };
    $('tgTest').onclick = async () => { read(); try { let c = f.tgChat || await BOTS.tgDetectChat(f.tgToken); if (!c) throw new Error('Chat ID nahi mili — bot ko pehle message bhejo'); await BOTS.tgSend(f.tgToken, c, '✅ Ping bot "' + b.name + '" connected'); $('tgChat').value = c; $('tgErr').textContent = ''; toast('Test bheja'); } catch (e) { $('tgErr').textContent = e.message; } };
}
function urlEditor(b, key, title, ph, hint, done) {
    const f = b.fwd = b.fwd || {}, P = openPage(title), kUrl = key + 'Url', kOn = key + 'On';
    P.body.innerHTML = '<div class="pg-card"><p class="pg-hint" style="margin-top:12px">' + esc(hint) + '</p><span class="pg-lbl">URL</span><input class="pg-in" id="uuUrl" value="' + esc(f[kUrl] || '') + '" placeholder="' + esc(ph) + '" autocapitalize="none" autocomplete="off"><div class="pg-row"><div class="rm"><b>Forward messages here</b></div><button class="pg-sw ' + (f[kOn] ? 'on' : '') + '" id="uuOn"></button></div><button class="pg-btn" id="uuGo">Save</button><button class="pg-btn ghost" id="uuTest">Send test</button></div>';
    $('uuOn').onclick = () => $('uuOn').classList.toggle('on');
    const read = () => { f[kUrl] = $('uuUrl').value.trim(); f[kOn] = $('uuOn').classList.contains('on'); };
    $('uuGo').onclick = async () => { read(); if (f[kUrl] && !/^https:\/\//i.test(f[kUrl])) { toast('URL https:// hona chahiye'); return; } await BOTS.save(b); toast('Saved'); P.close(); done(); };
    $('uuTest').onclick = async () => { read(); try { await fetch(f[kUrl], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(key === 'dc' ? { content: '✅ Ping bot "' + b.name + '" connected' } : { bot: b.username, test: true, text: 'Ping test' }) }); toast('Test bheja'); } catch (e) { toast('Request fail (CORS/URL)'); } };
}

/* ------------------------------ AUTH: phone / email OTP, profile setup ------------------------------ */
const AUTH = { kind: 'phone', value: '', userId: '', acct: null, photo: null, t: 0 };
const stripMe = () => ({ id: S.me.id, username: S.me.username, name: S.me.name, bio: S.me.bio, avatar: S.me.avatar, note: S.me.note, noteTs: S.me.noteTs, music: S.me.music, pub: S.me.pub });
const meFrom = d => ({ id: d.$id || d.id, username: d.username, name: d.name || '', bio: d.bio || '', avatar: d.avatar || '', note: d.note || '', noteTs: d.noteTs || 0, music: d.music || '', pub: d.pub || '' });
function authErr(e) {
    const m = String((e && e.message) || e || '');
    if (/network|fetch|Failed/i.test(m) || (e && e.code === 0)) return 'Internet nahi hai ya server tak nahi pahunch pa rahe.';
    if (/provider|sms|messaging|phone.*not|not.*configured/i.test(m)) return 'Appwrite me SMS provider (Messaging) set nahi hai. Appwrite Console → Messaging → Providers me SMS provider on karo, ya Email se login karo.';
    if (/Invalid token|invalid.*(secret|code)|Invalid credentials/i.test(m) || (e && e.code === 401)) return 'OTP galat ya expire ho gaya. Dobara try karo.';
    if (/rate|too many/i.test(m) || (e && e.code === 429)) return 'Bahut zyada try. Thodi der baad dobara karo.';
    if (/platform|origin|CORS/i.test(m)) return 'Is website ka domain Appwrite → Overview → Platforms me Web platform ke roop me add karo.';
    return m || 'Kuch galat hua';
}
function showAuth(msg) { showScreen('authScr'); authStart(msg); }
function normPhone(v) {
    let s = String(v || '').trim().replace(/[\s()-]/g, '');
    if (s.startsWith('+')) return /^\+\d{8,15}$/.test(s) ? s : '';
    s = s.replace(/^0+/, '');
    return /^\d{6,14}$/.test(s) ? CFG.country + s : '';
}
function authStart(msg) {
    const k = AUTH.kind, box = $('authBox');
    box.innerHTML = '<div style="padding:0 16px 10px"><div class="pg-seg"><button data-k="phone" class="' + (k === 'phone' ? 'on' : '') + '">Phone</button><button data-k="email" class="' + (k === 'email' ? 'on' : '') + '">Email</button></div></div>' +
        '<span class="pg-lbl">' + (k === 'phone' ? 'Phone number' : 'Email address') + '</span>' +
        (k === 'phone' ? '<div class="pg-phone"><span>' + CFG.country + '</span><input id="auVal" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="98765 43210" value="' + esc(AUTH.raw || '') + '"></div>' : '<input class="pg-in" id="auVal" type="email" inputmode="email" autocomplete="email" autocapitalize="none" placeholder="you@example.com" value="' + esc(AUTH.raw || '') + '">') +
        '<div class="pg-err" id="auErr">' + esc(msg || '') + '</div><button class="pg-btn" id="auGo">Send OTP</button><p class="pg-hint" style="text-align:center;margin-bottom:14px">Account nahi hai? Pehli baar OTP verify karte hi ban jayega.</p>';
    box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { AUTH.kind = b.dataset.k; AUTH.raw = ''; authStart(); });
    const go = async () => {
        const raw = $('auVal').value.trim(); AUTH.raw = raw; const err = $('auErr'); err.textContent = '';
        const val = k === 'phone' ? normPhone(raw) : (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw.toLowerCase() : '');
        if (!val) { err.textContent = k === 'phone' ? 'Sahi phone number daalo' : 'Sahi email daalo'; return; }
        if (!navigator.onLine) { err.textContent = 'Login ke liye internet chahiye'; return; }
        $('auGo').disabled = true; $('auGo').textContent = 'Sending…';
        try { const r = await API.sendOtp(k, val); AUTH.value = val; AUTH.userId = r.userId; AUTH.t = Date.now(); authOtp(); }
        catch (e) { err.textContent = authErr(e); $('auGo').disabled = false; $('auGo').textContent = 'Send OTP'; }
    };
    $('auGo').onclick = go; $('auVal').onkeydown = e => { if (e.key === 'Enter') go(); };
}
function authOtp() {
    const box = $('authBox');
    box.innerHTML = '<div style="padding:0 16px;text-align:center;color:var(--tx)"><b style="font-size:18px">Enter OTP</b><p class="pg-hint" style="margin:6px 0 14px">6-digit code ' + esc(AUTH.value) + ' par bheja gaya</p></div><input class="pg-otp" id="auOtp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"><div class="pg-err" id="auErr"></div><button class="pg-btn" id="auGo">Verify & continue</button><div style="display:flex;justify-content:space-between;padding:0 10px 10px"><button class="pg-link" id="auBack">Change ' + (AUTH.kind === 'phone' ? 'number' : 'email') + '</button><button class="pg-link" id="auRe" disabled>Resend</button></div>';
    let busy = false;
    const verify = async () => {
        const code = $('auOtp').value.replace(/\D/g, ''); if (code.length !== 6 || busy) return; busy = true;
        $('auGo').disabled = true; $('auGo').textContent = 'Verifying…'; $('auErr').textContent = '';
        try { const acct = await API.verifyOtp(AUTH.userId, code); await afterLogin(acct); }
        catch (e) { $('auErr').textContent = authErr(e); $('auGo').disabled = false; $('auGo').textContent = 'Verify & continue'; busy = false; $('auOtp').select(); }
    };
    $('auOtp').oninput = () => { $('auOtp').value = $('auOtp').value.replace(/\D/g, '').slice(0, 6); if ($('auOtp').value.length === 6) verify(); };
    $('auGo').onclick = verify; $('auBack').onclick = () => authStart();
    const re = $('auRe'); let n = 30; re.textContent = 'Resend in ' + n + 's';
    const tm = setInterval(() => { if (!$('auRe')) { clearInterval(tm); return; } n--; if (n <= 0) { clearInterval(tm); re.disabled = false; re.textContent = 'Resend'; } else re.textContent = 'Resend in ' + n + 's'; }, 1000);
    re.onclick = async () => { re.disabled = true; try { const r = await API.sendOtp(AUTH.kind, AUTH.value); AUTH.userId = r.userId; toast('OTP dobara bheja'); n = 30; authOtp(); } catch (e) { $('auErr').textContent = authErr(e); re.disabled = false; } };
    setTimeout(() => $('auOtp').focus(), 100);
}
async function afterLogin(acct) {
    AUTH.acct = acct;
    const cached = await kvGet('me', null);
    if (cached && cached.id !== acct.$id) { await dbWipe(); }
    let doc = null;
    try { doc = await API.getUser(acct.$id); } catch (e) { throw e; }
    if (doc && doc.username) { await startApp(doc); } else authSetup();
}
function authSetup() {
    showScreen('authScr');
    const box = $('authBox'); AUTH.photo = null;
    box.innerHTML = '<div style="text-align:center;padding:0 16px"><b style="font-size:20px;color:var(--tx)">Set up your profile</b></div><div style="text-align:center;margin:14px 0 4px"><span class="rd-av big" id="suAv" style="width:104px;height:104px;font-size:40px;background:var(--bar);color:var(--sub)">' + ic('camera', 36) + '</span></div><div style="text-align:center"><button class="pg-link" id="suPh">Add photo</button></div>' +
        '<span class="pg-lbl">Name</span><input class="pg-in" id="suName" maxlength="40" placeholder="Your name" autocomplete="name"><span class="pg-lbl">Username (unique)</span><input class="pg-in" id="suUser" maxlength="24" placeholder="e.g. rahul_01" autocapitalize="none" autocomplete="off" autocorrect="off" spellcheck="false"><div class="pg-hint" id="suHint">Log aapko is username se dhoondhenge aur call karenge. 3-24: a-z 0-9 . _</div><span class="pg-lbl">Bio (optional)</span><input class="pg-in" id="suBio" maxlength="140" placeholder="Hey there! I am using Ping"><div class="pg-err" id="suErr"></div><button class="pg-btn" id="suGo">Create account</button>';
    let ok = false, chk = 0;
    const check = debounce(async () => {
        const u = normUser($('suUser').value), h = $('suHint'), my = ++chk; ok = false;
        if (!u) { h.className = 'pg-hint'; h.textContent = 'Log aapko is username se dhoondhenge aur call karenge. 3-24: a-z 0-9 . _'; return; }
        if (!validUser(u)) { h.className = 'pg-err'; h.textContent = '3-24 characters: a-z, 0-9, . _ (shuru/ant me . _ nahi)'; return; }
        h.className = 'pg-hint'; h.textContent = 'Checking…';
        try { const d = await API.findByUsername(u); if (my !== chk) return; if (d && d.$id !== AUTH.acct.$id) { h.className = 'pg-err'; h.textContent = '@' + u + ' pehle se liya hua hai'; } else { ok = true; h.className = 'pg-hint pg-ok'; h.textContent = '✓ @' + u + ' available hai'; } }
        catch (e) { if (my === chk) { h.className = 'pg-hint'; h.textContent = 'Check nahi ho paya — Create dabao'; ok = true; } }
    }, 400);
    $('suUser').oninput = check;
    const pick = async () => { const b = await pickAndCropPhoto(); if (b) { AUTH.photo = b; const a = $('suAv'); a.innerHTML = ''; a.style.backgroundImage = 'url(' + URL.createObjectURL(b) + ')'; } };
    $('suAv').onclick = pick; $('suPh').onclick = pick;
    $('suGo').onclick = async () => {
        const name = $('suName').value.trim(), u = normUser($('suUser').value), bio = $('suBio').value.trim(), err = $('suErr'); err.textContent = '';
        if (!name) { err.textContent = 'Naam likho'; return; } if (!validUser(u)) { err.textContent = 'Sahi username daalo'; return; }
        $('suGo').disabled = true; $('suGo').textContent = 'Creating…';
        try {
            const id = AUTH.acct.$id; let ident = await kvGet('ident:' + id, null); if (!ident) { ident = await CR.genIdentity(); await kvSet('ident:' + id, ident); }
            let avatar = ''; if (AUTH.photo) { try { avatar = await uploadAvatar(AUTH.photo); } catch (e) { toast('Photo upload fail: ' + String((e && e.message) || e).slice(0, 120)); } }
            const doc = await API.createUser(id, { username: u, name, bio, avatar, pub: ident.pub, lastSeen: Date.now(), isBot: false, owner: '', note: '', noteTs: 0, music: '' });
            await startApp(doc);
        } catch (e) {
            err.textContent = (e && e.code === 409) ? 'Ye username/account pehle se hai — doosra username try karo' : authErr(e);
            $('suGo').disabled = false; $('suGo').textContent = 'Create account';
        }
    };
}

/* ------------------------------ BOOT ------------------------------ */
let banT = 0;
function showBanner(title, body, chatId) {
    const b = $('pgBan'); b.innerHTML = '<span class="pg-avw">' + avHTML(chatId) + '</span><div><b>' + esc(title) + '</b><span>' + esc(body) + '</span></div>';
    b.dataset.chat = chatId; b.classList.add('on'); clearTimeout(banT); banT = setTimeout(() => b.classList.remove('on'), 4200);
}
function onInbound(m, chat, sender) {
    if (!chat || m.system) return;
    const viewing = S.cur === chat.id && !document.hidden;
    if (viewing) { SFX.pop(); return; }
    if (chat.muted) return;
    const title = chat.type === 'group' ? chat.name : cname(sender);
    const body = S.set.preview === false ? 'New message' : ((chat.type === 'group' ? cname(sender) + ': ' : '') + previewText(m)).slice(0, 140);
    if (document.hidden) { sysNotify(title, body, { tag: 'chat-' + chat.id, chat: chat.id }); vib([60, 40, 60]); }
    else { SFX.recv(); vib(40); showBanner(title, body, chat.id); }
}
function wireEvents() {
    on('msg', m => { if (!m || m.chat === S.cur) renderMessages(); renderAllSoon(); });
    on('sent', m => { if (m.chat === S.cur) renderMessages({ bottom: true }); });
    on('chat', id => { renderChatsSoon(); if (id === S.cur) updHead(); });
    on('contacts', () => { renderAllSoon(); updHead(); if (S.cur) renderMessages(); });
    on('typing', id => { updHead(); renderChatsSoon(); if (id === S.cur) renderMessages(); });
    on('link', id => { if (id === S.cur) updHead(); });
    on('tick', () => { updHead(); renderChatsSoon(); });
    on('stories', () => { renderAllSoon(); });
    on('bots', () => { renderYouSoon(); });
    on('settings', () => { applyTheme(); });
    on('inbound', onInbound);
    on('reacted', m => { if (S.cur !== m.chat) SFX.pop(); });
    on('net', v => { $('pgOff').classList.toggle('on', !v); updHead(); if (!v) LINK.closeAll(); else { toast('Back online'); } });
    $('pgBan').onclick = () => { $('pgBan').classList.remove('on'); if ($('pgBan').dataset.chat) openChat($('pgBan').dataset.chat); };
}
function wireCall() {
    const set = (id, f) => { $(id).onclick = f; };
    set('rdCallMute', () => CALL.toggleMute()); set('rdCallCam', () => CALL.toggleCam()); set('rdCallFlip', () => CALL.flipCamera()); set('rdCallShare', () => CALL.toggleShare());
    set('rdCallEnd', () => CALL.end(true)); set('rdInReject', () => CALL.reject()); set('rdInAccept', () => CALL.accept()); set('rdInMute', () => CALL.toggleMute());
    $('rdLocal').onclick = () => CALL.cycleLocal();
    if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) $('rdCallShare').hidden = true;
    $('rdViewerX').onclick = () => nav.close('viewer');
    $('rdViewer').addEventListener('click', e => { if (e.target === $('rdViewer')) nav.close('viewer'); });
}
function fillIcons() {
    document.querySelectorAll('[data-ic]').forEach(el => { el.innerHTML = ic(el.dataset.ic, +el.dataset.s || 22); });
}
async function startApp(doc, offline) {
    S.me = meFrom(doc);
    let ident = await kvGet('ident:' + S.me.id, null);
    if (!ident) { ident = await CR.genIdentity(); await kvSet('ident:' + S.me.id, ident); }
    S.ident = ident;
    if (!offline && doc.pub !== ident.pub) { try { await API.updateUser(S.me.id, { pub: ident.pub }); } catch (e) { console.warn('pub update', e); } }
    S.me.pub = ident.pub;
    await kvSet('me', stripMe());
    await loadState();
    try { history.pushState({ root: 1 }, ''); } catch (e) {}
    showScreen('rdMain'); setTab('chats');
    startNet(); startBotPresence(); S.bots.forEach(b => BOTS.startTg(b));
    const first = () => { SFX.unlock(); if (S.set.notif !== false && 'Notification' in window && Notification.permission === 'default') askNotifPermission(); };
    document.addEventListener('click', first, { once: true });
    $('pgOff').classList.toggle('on', !S.online);
    try { const q = new URLSearchParams(location.search).get('chat'); if (q) { history.replaceState(null, '', location.pathname); openChat(q); } } catch (e) {}
}
function setupPWA() {
    const add = (rel, href, extra) => { const l = document.createElement('link'); l.rel = rel; l.href = href; Object.assign(l, extra || {}); document.head.appendChild(l); };
    add('icon', ICON192); 
    const logo = 'url(' + AVATAR + ')'; $('authLogo').style.backgroundImage = logo; $('spLogo').style.backgroundImage = logo;
    if (window.visualViewport) { const f = () => { $('rdApp').style.height = window.visualViewport.height + 'px'; if (window.visualViewport.offsetTop) window.scrollTo(0, 0); }; window.visualViewport.addEventListener('resize', f); window.visualViewport.addEventListener('scroll', f); f(); }
}
function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    const had = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.register('sw.js').then(reg => { try { reg.update(); } catch (e) {} setInterval(() => { try { reg.update(); } catch (e) {} }, 3600000); }).catch(e => console.warn('sw', e));
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!had || reloaded) return; reloaded = true; if (!(S.me && CALL.active())) location.reload(); });
    navigator.serviceWorker.addEventListener('message', e => { const d = e.data || {}; if (d.type === 'open' && d.chat && S.me) { openChat(d.chat); } });
}
async function boot() {
    setupPWA(); fillIcons(); registerSW();
    document.addEventListener('contextmenu', e => { if (!e.target.closest('input,textarea')) e.preventDefault(); });
    document.addEventListener('selectstart', e => { if (!e.target.closest || !e.target.closest('input,textarea')) e.preventDefault(); });
    document.addEventListener('dragstart', e => e.preventDefault());
    window.addEventListener('unhandledrejection', e => { console.warn('unhandled', e.reason); });
    await loadSettings(); applyTheme();
    wireEvents(); wireMain(); wireChat(); wireYou(); wireCall();
    $('pgOff').classList.toggle('on', !navigator.onLine);
    let acct = null, netFail = false;
    try { await API.init(); } catch (e) { netFail = true; }
    if (!netFail) { try { acct = await API.getAccount(); } catch (e) { netFail = true; } }
    const cached = await kvGet('me', null);
    if (acct) {
        if (cached && cached.id !== acct.$id) await dbWipe();
        let doc = null;
        try { doc = await API.getUser(acct.$id); } catch (e) { if (cached && cached.id === acct.$id) { await startApp(cached, true); return; } }
        if (doc && doc.username) await startApp(doc); else { AUTH.acct = acct; authSetup(); }
    } else if (netFail && cached) { S.online = false; await startApp(cached, true); }
    else if (netFail) { showAuth('Pehli baar login ke liye internet chahiye.'); }
    else showAuth(cached ? 'Session khatam ho gaya — dobara login karo.' : '');
    let apiOK = !netFail;
    window.addEventListener('online', async () => { if (apiOK) return; try { await API.init(); apiOK = true; } catch (e) {} });
}
boot().catch(e => { console.error('boot', e); const s = $('splash'); if (s) s.innerHTML = '<div class="pg-auth"><h1>Ping</h1><p class="s">Start nahi ho paya: ' + esc(e && e.message) + '<br>Page reload karo.</p><button class="pg-btn" onclick="location.reload()">Reload</button></div>'; });
})();
