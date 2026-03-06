<div align="center">

# IP Intelligence

**Real-time IP & geolocation lookup with an advanced, modern interface**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Site-4f46e5?style=for-the-badge&logo=googlechrome&logoColor=white)](https://fzihak.github.io/What-is-my-IP/)
[![GitHub Pages](https://img.shields.io/badge/Deployed%20on-GitHub%20Pages-222?style=for-the-badge&logo=github&logoColor=white)](https://fzihak.github.io/What-is-my-IP/)
![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)

</div>

---

## Overview

**IP Intelligence** is a fully client-side web application that instantly reveals detailed information about any public IP address or domain — including geolocation, ISP, ASN, timezone, and more. It uses a **multi-API fallback chain** to ensure maximum uptime and data accuracy, with zero backend required.

---

## Features

| Category | Details |
|---|---|
| **IP Detection** | Auto-detects your public IP (IPv4 & IPv6) on load |
| **Geolocation** | Country, region, city, postal code, continent, capital, calling code |
| **Network Info** | ISP, organization, ASN, hostname/domain |
| **Timezone** | Timezone ID, UTC offset, local time |
| **Interactive Map** | Leaflet.js powered map with a pinned marker |
| **IP/Domain Search** | Look up any arbitrary IP address or domain |
| **Security Panel** | IP type classification and ASN-based analysis |
| **Export** | Download full lookup data as a JSON file |
| **Theme** | Dark / Light mode toggle with persistent preference |
| **Real-time Clock** | Live clock displayed in the navbar |

---

## Tech Stack

- **Frontend** — Vanilla HTML5, CSS3, JavaScript (ES2020+)
- **Map** — [Leaflet.js](https://leafletjs.com/) v1.9
- **Icons** — [Font Awesome](https://fontawesome.com/) 6 & [Flag Icons](https://flagicons.lipis.dev/)
- **Fonts** — [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts
- **Hosting** — GitHub Pages (static, zero-cost)

### API Fallback Chain

Requests are attempted in order; the next API is tried only if the previous one fails:

1. [ipwho.is](https://ipwho.is/) — primary
2. [ipapi.co](https://ipapi.co/) — secondary
3. [geoiplookup.io](https://json.geoiplookup.io/) — tertiary

---

## Getting Started

No build step or server required. Just open the project locally:

```bash
git clone https://github.com/fzihak/What-is-my-IP.git
cd What-is-my-IP
# Open index.html directly in your browser, or serve with any static server:
npx serve .
```

---

## Project Structure

```
What-is-my-IP/
├── index.html      # Application shell & markup
├── style.css       # All styles (dark/light themes, animations)
├── app.js          # Core logic, API chain, map, UI interactions
├── Image/          # Favicon and assets
├── CNAME           # Custom domain config for GitHub Pages
└── package.json    # Project metadata
```

---

## Live Demo

**[https://fzihak.github.io/What-is-my-IP/](https://fzihak.github.io/What-is-my-IP/)**

---

## License

This project is released under the [MIT License](https://opensource.org/licenses/MIT) — free to use, modify, and distribute.

---

<div align="center">
  Made by <a href="https://github.com/fzihak">fzihak</a>
</div>
