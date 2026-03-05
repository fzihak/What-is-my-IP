// ============================================================
// app.js — What is My IP? Advanced IP Intelligence Tool
// Multi-API fallback: ipwho.is → ipapi.co → geoiplookup.io
// ============================================================

// ── API chain (tried in order until one succeeds) ──
const APIS = [
  {
    url: ip => ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : 'https://ipwho.is/',
    ok:  d  => d && d.success === true,
    map: d  => ({
      ip:            d.ip,
      type:          d.type || 'IPv4',
      country:       d.country,
      country_code:  (d.country_code || '').toLowerCase(),
      region:        d.region,
      city:          d.city,
      postal:        d.postal,
      continent:     d.continent,
      capital:       d.capital,
      calling_code:  d.calling_code ? `+${d.calling_code}` : '—',
      latitude:      d.latitude,
      longitude:     d.longitude,
      is_eu:         !!d.is_eu,
      isp:           d.connection?.isp,
      org:           d.connection?.org,
      asn:           d.connection?.asn ? `AS${d.connection.asn}` : '—',
      domain:        d.connection?.domain,
      timezone_id:   d.timezone?.id,
      timezone_utc:  d.timezone?.utc,
      local_time:    d.timezone?.current_time
                       ? d.timezone.current_time.replace('T', ' ').slice(0, 19) : null,
    }),
  },
  {
    url: ip => ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : 'https://ipapi.co/json/',
    ok:  d  => d && !d.error && d.ip,
    map: d  => ({
      ip:            d.ip,
      type:          d.version || 'IPv4',
      country:       d.country_name,
      country_code:  (d.country_code || '').toLowerCase(),
      region:        d.region,
      city:          d.city,
      postal:        d.postal,
      continent:     d.continent_code || '—',
      capital:       '—',
      calling_code:  d.country_calling_code || '—',
      latitude:      d.latitude,
      longitude:     d.longitude,
      is_eu:         !!d.in_eu,
      isp:           d.org,
      org:           d.org,
      asn:           d.asn || '—',
      domain:        '—',
      timezone_id:   d.timezone,
      timezone_utc:  d.utc_offset || '—',
      local_time:    null,
    }),
  },
  {
    url: ip => ip ? `https://json.geoiplookup.io/${encodeURIComponent(ip)}` : 'https://json.geoiplookup.io',
    ok:  d  => d && d.ip,
    map: d  => ({
      ip:            d.ip,
      type:          d.ip?.includes(':') ? 'IPv6' : 'IPv4',
      country:       d.country_name,
      country_code:  (d.country_code || '').toLowerCase(),
      region:        d.region,
      city:          d.city,
      postal:        d.postal_code,
      continent:     d.continent_name || '—',
      capital:       '—',
      calling_code:  d.calling_code ? `+${d.calling_code}` : '—',
      latitude:      d.latitude,
      longitude:     d.longitude,
      is_eu:         !!d.is_eu,
      isp:           d.asn_org,
      org:           d.asn_org,
      asn:           d.asn ? `AS${d.asn}` : '—',
      domain:        d.hostname || '—',
      timezone_id:   d.timezone_name,
      timezone_utc:  '—',
      local_time:    null,
    }),
  },
];

// ── IDs whose content comes from the API (reset to skeleton on each lookup) ──
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

// ── DOM helper ──
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
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
};

// ── Copy helpers ──
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
  if (!currentData) { showToast('No data yet — wait for lookup', 'error'); return; }
  const blob = new Blob([JSON.stringify(currentData, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `ip-${currentData.ip}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast('JSON downloaded!');
};

// ── Share ──
const shareIP = async () => {
  if (!currentData) return;
  const text = `My IP: ${currentData.ip} | ${currentData.city || ''}, ${currentData.country || ''}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'My IP Info', text, url: location.href }); }
    catch (_) { /* user cancelled */ }
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

  L.circle([lat, lng], {
    radius: 28000, color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.06, weight: 1,
  }).addTo(ipMap);

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
  else if (/Mac OS X ([\d_]+)/.test(ua))  os = `macOS ${ua.match(/Mac OS X ([\d_]+)/)?.[1].replace(/_/g, '.')}`;
  else if (/Android ([\d.]+)/.test(ua))   os = `Android ${ua.match(/Android ([\d.]+)/)?.[1]}`;
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
    memory:    navigator.deviceMemory       ? `${navigator.deviceMemory} GB`       : '—',
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

// ── Security heuristics ──
const setSecBadge = (id, active, labelTrue, labelFalse, activeClass = 'warn') => {
  const el = $(id);
  if (!el) return;
  el.textContent = active ? labelTrue : labelFalse;
  el.className   = `sec-badge ${active ? activeClass : 'safe'}`;
};

const analyzeSecurityFromData = data => {
  const combined = `${data.isp || ''} ${data.org || ''}`.toLowerCase();
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
  };
};

// ── Populate all normalized data into UI ──
const populateData = data => {
  // Hero
  const ipEl = $('ip-display');
  if (ipEl) { ipEl.classList.remove('loading'); ipEl.textContent = data.ip || '—'; }
  setValue('ip-type-badge', data.type || 'IPv4');

  // Country flag
  const flagEl = $('country-flag');
  if (flagEl && data.country_code) {
    flagEl.className = `fi fi-${data.country_code} flag-icon`;
  }

  // Quick stats
  setValue('qs-country', data.country);
  setValue('qs-city',    [data.city, data.region].filter(Boolean).join(', ') || '—');
  setValue('qs-isp',     data.isp || data.org);
  setValue('qs-tz',      data.timezone_id);
  setValue('qs-asn',     data.asn);

  // Location tab
  setValue('d-country',    data.country);
  setValue('d-region',     data.region);
  setValue('d-city',       data.city);
  setValue('d-postal',     data.postal);
  setValue('d-continent',  data.continent);
  setValue('d-capital',    data.capital);
  setValue('d-calling',    data.calling_code);
  setValue('d-coords',     (data.latitude && data.longitude) ? `${data.latitude}, ${data.longitude}` : '—');
  setValue('d-timezone',   data.timezone_id);
  setValue('d-utc',        data.timezone_utc);
  setValue('d-local-time', data.local_time);
  setValue('d-eu',         data.is_eu ? 'Yes — GDPR Applies' : 'No');
  setValue('d-coords-display', (data.latitude && data.longitude) ? `${data.latitude}, ${data.longitude}` : '—');

  // Network tab
  setValue('n-ip',     data.ip);
  setValue('n-type',   data.type);
  setValue('n-asn',    data.asn);
  setValue('n-isp',    data.isp);
  setValue('n-org',    data.org);
  setValue('n-domain', data.domain);

  // Map
  const lat = parseFloat(data.latitude);
  const lng = parseFloat(data.longitude);
  if (!isNaN(lat) && !isNaN(lng)) initMap(lat, lng, data.city, data.country);

  // Security tab
  const sec = analyzeSecurityFromData(data);
  setSecBadge('sec-vpn',     sec.isVPN,     'Likely VPN / Proxy', 'Not Detected');
  setSecBadge('sec-hosting', sec.isHosting, 'Hosting / Cloud',    'Residential / ISP');
  setSecBadge('sec-eu',      data.is_eu,    'EU — GDPR Applies',  'Non-EU', 'info');
  setValue('sec-type', data.type || 'IPv4');
  setValue('sec-asn',  data.asn);

  const httpsEl = $('sec-https');
  if (httpsEl) {
    const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    httpsEl.textContent = secure ? 'Yes — Encrypted' : 'No — Insecure';
    httpsEl.className   = `sec-badge ${secure ? 'safe' : 'warn'}`;
  }
};

// ── Skeleton / loading state ──
const setLoading = on => {
  const ipEl = $('ip-display');
  if (!ipEl) return;
  if (on) {
    ipEl.textContent = '';
    ipEl.classList.add('loading');
    const flagEl = $('country-flag');
    if (flagEl) flagEl.className = 'fi flag-icon';
    API_SKELETON_IDS.forEach(id => {
      const el = $(id);
      if (!el) return;
      el.textContent = '';
      el.classList.add('skeleton');
    });
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
const fetchWithTimeout = (url, ms = 8000) => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

// ── Main lookup — tries each API in sequence until one succeeds ──
const lookupIP = async (ip = '') => {
  setLoading(true);
  // Sanitise input — only allow chars valid in an IP address or domain name
  const safeIP = ip.replace(/[^a-zA-Z0-9.\-:]/g, '');

  let lastError = null;

  for (const api of APIS) {
    try {
      const url = api.url(safeIP);
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      if (!api.ok(raw)) throw new Error(raw.message || raw.reason || 'API error');
      currentData = { ...api.map(raw), _raw: raw };
      populateData(currentData);
      showToast(safeIP ? `Lookup for ${currentData.ip} complete!` : 'IP detected!');
      return; // success — stop trying more APIs
    } catch (err) {
      lastError = err;
      console.warn(`[IP lookup] API failed (${err.message}), trying next…`);
    }
  }

  // All APIs failed
  const msg = lastError?.name === 'AbortError' ? 'Request timed out' : (lastError?.message || 'All APIs failed');
  showToast(msg, 'error');
  setLoading(false);
  const ipEl = $('ip-display');
  if (ipEl) { ipEl.classList.remove('loading'); ipEl.textContent = 'Unavailable'; }
};

// ── Search handler ──
const handleSearch = e => {
  e?.preventDefault();
  const q = $('ip-search')?.value?.trim() || '';
  if (!q) { lookupIP(); return; }
  if (!/^[a-zA-Z0-9.\-:]+$/.test(q)) {
    showToast('Enter a valid IP address or hostname', 'error');
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
