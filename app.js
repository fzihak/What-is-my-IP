// ============================================================
// app.js — What is My IP? Advanced IP Intelligence Tool
// Uses: ipwho.is API + flag-icons + Leaflet.js
// ============================================================

const API_BASE = 'https://ipwho.is/';

// IDs of elements populated from the API (will get skeleton on re-lookup)
const API_SKELETON_IDS = [
  'qs-country', 'qs-city', 'qs-isp', 'qs-tz', 'qs-asn', 'ip-type-badge',
  'd-country', 'd-region', 'd-city', 'd-postal', 'd-continent', 'd-capital',
  'd-calling', 'd-coords', 'd-timezone', 'd-utc', 'd-local-time', 'd-eu',
  'd-coords-display',
  'n-ip', 'n-type', 'n-asn', 'n-isp', 'n-org', 'n-domain',
  'sec-type', 'sec-asn',
];

// ── State ──
let currentData = null;
let ipMap       = null;
let mapMarker   = null;

// ── DOM helpers ──
const $ = id => document.getElementById(id);

const setValue = (id, value) => {
  const el = $(id);
  if (!el) return;
  el.classList.remove('skeleton');
  el.textContent = value || '—';
};

// ── Theme ──
const applyTheme = theme => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const icon = $('theme-icon');
  if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
};

const toggleTheme = () => {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
};

// ── Toast ──
const showToast = (msg, type = 'success') => {
  const t = $('toast');
  if (!t) return;
  t.querySelector('.toast-msg').textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
};

// ── Copy ──
const copyText = (text, label = '') => {
  if (!text || text === '—') return;
  navigator.clipboard.writeText(text)
    .then(() => showToast(label ? `${label} copied!` : 'Copied!'))
    .catch(() => showToast('Copy failed', 'error'));
};

const copyIP = () => {
  const ip = $('ip-display')?.textContent?.trim();
  copyText(ip, 'IP address');
};

const copyField = (id, label) => {
  const val = $(id)?.textContent?.trim();
  copyText(val, label || 'Value');
};

// ── Export JSON ──
const exportJSON = () => {
  if (!currentData) { showToast('No data yet — wait for lookup to finish', 'error'); return; }
  const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ip-${currentData.ip}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast('JSON file downloaded!');
};

// ── Share ──
const shareIP = async () => {
  if (!currentData) return;
  const text = `IP: ${currentData.ip} | ${currentData.city || ''}, ${currentData.country || ''}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'My IP Info', text, url: location.href }); }
    catch (_) { /* user cancelled or not supported */ }
  } else {
    copyText(location.href, 'Page URL');
  }
};

// ── Tabs ──
const switchTab = tabId => {
  document.querySelectorAll('.tab-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-pane')
    .forEach(p => p.classList.toggle('active', p.id === tabId));
  // Leaflet needs a size hint when its container becomes visible
  if (tabId === 'tab-location' && ipMap) setTimeout(() => ipMap.invalidateSize(), 120);
};

// ── Map ──
const initMap = (lat, lng, city, country) => {
  if (ipMap) {
    ipMap.setView([lat, lng], 11);
    mapMarker?.setLatLng([lat, lng]);
    mapMarker?.getPopup()?.setContent(`<b>${city || '?'}</b><br>${country || ''}`);
    return;
  }
  ipMap = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(ipMap);

  // Accuracy radius circle
  L.circle([lat, lng], {
    radius: 28000, color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.06, weight: 1,
  }).addTo(ipMap);

  // Custom pulsing marker
  const icon = L.divIcon({
    className: '',
    html: '<div class="map-pin"><div class="map-pin-dot"></div></div>',
    iconSize: [22, 22], iconAnchor: [11, 11],
  });
  mapMarker = L.marker([lat, lng], { icon })
    .addTo(ipMap)
    .bindPopup(`<b>${city || '?'}</b><br>${country || ''}`)
    .openPopup();
};

// ── Browser / Device detection ──
const getBrowserInfo = () => {
  const ua = navigator.userAgent;

  let browser = 'Unknown', bVer = '';
  if      (/Edg\//.test(ua))     { browser = 'Microsoft Edge';  bVer = ua.match(/Edg\/(\d+)/)?.[1]    || ''; }
  else if (/OPR\//.test(ua))     { browser = 'Opera';           bVer = ua.match(/OPR\/(\d+)/)?.[1]    || ''; }
  else if (/Firefox\//.test(ua)) { browser = 'Mozilla Firefox'; bVer = ua.match(/Firefox\/(\d+)/)?.[1]|| ''; }
  else if (/Chrome\//.test(ua))  { browser = 'Google Chrome';   bVer = ua.match(/Chrome\/(\d+)/)?.[1] || ''; }
  else if (/Safari\//.test(ua))  { browser = 'Apple Safari';    bVer = ua.match(/Version\/(\d+)/)?.[1]|| ''; }

  let os = 'Unknown';
  if      (/Windows NT 1[01]/.test(ua))   os = 'Windows 10 / 11';
  else if (/Windows NT 6\.3/.test(ua))    os = 'Windows 8.1';
  else if (/Windows NT 6\.1/.test(ua))    os = 'Windows 7';
  else if (/Mac OS X ([\d_]+)/.test(ua))  os = `macOS ${RegExp.$1.replace(/_/g, '.')}`;
  else if (/Android ([\d.]+)/.test(ua))   os = `Android ${RegExp.$1}`;
  else if (/iPhone|iPad/.test(ua))        os = 'iOS';
  else if (/Linux/.test(ua))              os = 'Linux';

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  return {
    browser:   bVer ? `${browser} ${bVer}` : browser,
    os,
    platform:  navigator.platform || '—',
    language:  navigator.language || '—',
    languages: (navigator.languages || [navigator.language]).join(', '),
    screen:    `${screen.width} × ${screen.height} px`,
    colorDepth:`${screen.colorDepth}-bit`,
    timezone:  Intl.DateTimeFormat().resolvedOptions().timeZone,
    cookies:   navigator.cookieEnabled ? 'Enabled' : 'Disabled',
    dnt:       navigator.doNotTrack === '1' ? 'Enabled' : 'Disabled',
    conn:      conn ? (conn.effectiveType || '—').toUpperCase() : 'Unknown',
    downlink:  conn?.downlink ? `~${conn.downlink} Mbps` : '—',
    rtt:       conn?.rtt      ? `${conn.rtt} ms`         : '—',
    memory:    navigator.deviceMemory      ? `${navigator.deviceMemory} GB`       : '—',
    cores:     navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : '—',
    touch:     navigator.maxTouchPoints > 0 ? `${navigator.maxTouchPoints} touch point(s)` : 'None',
  };
};

const populateBrowser = info => {
  [
    ['br-browser',   info.browser],
    ['br-os',        info.os],
    ['br-platform',  info.platform],
    ['br-language',  info.language],
    ['br-languages', info.languages],
    ['br-screen',    info.screen],
    ['br-color',     info.colorDepth],
    ['br-timezone',  info.timezone],
    ['br-cookies',   info.cookies],
    ['br-dnt',       info.dnt],
    ['br-conn',      info.conn],
    ['br-downlink',  info.downlink],
    ['br-rtt',       info.rtt],
    ['br-memory',    info.memory],
    ['br-cores',     info.cores],
    ['br-touch',     info.touch],
  ].forEach(([id, val]) => setValue(id, val));
};

// ── Security heuristics (client-side, based on ISP/org name) ──
const setSecBadge = (id, active, labelTrue, labelFalse, activeClass = 'warn') => {
  const el = $(id);
  if (!el) return;
  el.textContent = active ? labelTrue : labelFalse;
  el.className   = `sec-badge ${active ? activeClass : 'safe'}`;
};

const analyzeSecurityFromData = data => {
  const combined = `${data.connection?.isp || ''} ${data.connection?.org || ''}`.toLowerCase();
  const hostingKw = [
    'amazon','aws','google','microsoft','azure','digitalocean','linode','vultr',
    'ovh','hetzner','cloudflare','fastly','leaseweb','equinix','akamai',
    'hosting','server','datacenter','data center','colocation','cdn',
  ];
  const vpnKw = [
    'vpn','nordvpn','expressvpn','protonvpn','mullvad','pia','private internet',
    'hide.me','ipvanish','cyberghost','tunnel','anonymous','privacy',
  ];
  return {
    isHosting: hostingKw.some(k => combined.includes(k)),
    isVPN:     vpnKw.some(k => combined.includes(k)),
    isEU:      !!data.is_eu,
  };
};

// ── Populate all UI from API data ──
const populateData = data => {
  // ── Hero ──
  const ipEl = $('ip-display');
  if (ipEl) { ipEl.classList.remove('loading'); ipEl.textContent = data.ip || '—'; }
  setValue('ip-type-badge', data.type || 'IPv4');

  // Country flag (flag-icons)
  const flagEl = $('country-flag');
  if (flagEl && data.country_code) {
    flagEl.className = `fi fi-${data.country_code.toLowerCase()} flag-icon`;
  }

  // ── Quick stats row ──
  setValue('qs-country', data.country);
  setValue('qs-city',    [data.city, data.region].filter(Boolean).join(', '));
  setValue('qs-isp',     data.connection?.isp || data.connection?.org);
  setValue('qs-tz',      data.timezone?.id);
  setValue('qs-asn',     data.connection?.asn ? `AS${data.connection.asn}` : '—');

  // ── Location tab ──
  const cc = data.country_code ? ` (${data.country_code})` : '';
  setValue('d-country',    `${data.country || ''}${cc}`.trim() || '—');
  setValue('d-region',     data.region);
  setValue('d-city',       data.city);
  setValue('d-postal',     data.postal);
  setValue('d-continent',  data.continent);
  setValue('d-capital',    data.capital);
  setValue('d-calling',    data.calling_code ? `+${data.calling_code}` : '—');
  setValue('d-coords',     `${data.latitude}, ${data.longitude}`);
  setValue('d-timezone',   data.timezone?.id);
  setValue('d-utc',        data.timezone?.utc);
  const lt = data.timezone?.current_time;
  setValue('d-local-time', lt ? lt.replace('T', ' ').slice(0, 19) : '—');
  setValue('d-eu',         data.is_eu ? 'Yes — GDPR Applies' : 'No');
  setValue('d-coords-display', `${data.latitude}, ${data.longitude}`);

  // ── Network tab ──
  setValue('n-ip',     data.ip);
  setValue('n-type',   data.type);
  setValue('n-asn',    data.connection?.asn ? `AS${data.connection.asn}` : '—');
  setValue('n-isp',    data.connection?.isp);
  setValue('n-org',    data.connection?.org);
  setValue('n-domain', data.connection?.domain);

  // ── Map ──
  const lat = parseFloat(data.latitude);
  const lng = parseFloat(data.longitude);
  if (!isNaN(lat) && !isNaN(lng)) initMap(lat, lng, data.city, data.country);

  // ── Security tab ──
  const sec = analyzeSecurityFromData(data);
  setSecBadge('sec-vpn',     sec.isVPN,     'Likely VPN / Proxy', 'Not Detected');
  setSecBadge('sec-hosting', sec.isHosting, 'Hosting / Cloud',    'Residential / ISP');
  setSecBadge('sec-eu',      sec.isEU,      'EU — GDPR Applies',  'Non-EU', 'info');
  setValue('sec-type', data.type || 'IPv4');
  setValue('sec-asn',  data.connection?.asn ? `AS${data.connection.asn}` : '—');

  // HTTPS detection
  const httpsEl = $('sec-https');
  if (httpsEl) {
    const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    httpsEl.textContent = secure ? 'Yes — Encrypted' : 'No — Insecure';
    httpsEl.className   = `sec-badge ${secure ? 'safe' : 'warn'}`;
  }
};

// ── Loading state ──
const setLoading = on => {
  const ipEl = $('ip-display');
  if (!ipEl) return;
  if (on) {
    ipEl.textContent = '';
    ipEl.classList.add('loading');
    // Clear flag
    const flagEl = $('country-flag');
    if (flagEl) flagEl.className = 'fi flag-icon';
    // Skeleton API-backed values
    API_SKELETON_IDS.forEach(id => {
      const el = $(id);
      if (!el) return;
      el.textContent = '';
      el.classList.add('skeleton');
    });
    // Reset security badges to "Checking…"
    ['sec-vpn', 'sec-hosting', 'sec-eu'].forEach(id => {
      const el = $(id);
      if (el) { el.textContent = 'Checking…'; el.className = 'sec-badge neutral'; }
    });
    const httpsEl = $('sec-https');
    if (httpsEl) { httpsEl.textContent = '—'; httpsEl.className = 'sec-badge neutral'; }
  } else {
    ipEl.classList.remove('loading');
  }
};

// ── Fetch with timeout ──
const fetchWithTimeout = (url, ms = 9000) => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

// ── Main IP lookup ──
const lookupIP = async (ip = '') => {
  setLoading(true);
  // Sanitise: only allow IP chars and valid domain chars
  const safeIP = ip.replace(/[^a-zA-Z0-9.\-:]/g, '');
  const url    = safeIP ? `${API_BASE}${encodeURIComponent(safeIP)}` : API_BASE;
  try {
    const res  = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Lookup failed');
    currentData = data;
    populateData(data);
    showToast(safeIP ? `Lookup for ${data.ip} complete!` : 'Your IP detected!');
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Failed to fetch');
    showToast(msg, 'error');
    setLoading(false);
    const ipEl = $('ip-display');
    if (ipEl) { ipEl.classList.remove('loading'); ipEl.textContent = 'Error'; }
  }
};

// ── Search handler ──
const handleSearch = e => {
  e?.preventDefault();
  const q = $('ip-search')?.value?.trim() || '';
  if (!q) { lookupIP(); return; }
  // Only allow alphanumeric, dots, hyphens, colons (IPv4 / IPv6 / domain)
  if (!/^[a-zA-Z0-9.\-:]+$/.test(q)) {
    showToast('Enter a valid IP address or domain name', 'error');
    return;
  }
  lookupIP(q);
};

// ── Realtime clock ──
const startClock = () => {
  const el = $('realtime-clock');
  if (!el) return;
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };
  tick();
  setInterval(tick, 1000);
};

// ── Bootstrap ──
window.addEventListener('DOMContentLoaded', () => {
  applyTheme(localStorage.getItem('theme') || 'dark');
  populateBrowser(getBrowserInfo());
  startClock();
  lookupIP();
});
