(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SVG_NS = "http://www.w3.org/2000/svg";

  // ---------- 時間帯で配色が変わる（割り当ては theme.js） ----------
  const { slotAt, jstHour } = window.siteTheme;
  let currentTheme = root.dataset.theme || "indigo";
  let shiftTimer;

  const setTheme = (id) => {
    if (id === currentTheme) return;
    if (!reduceMotion) {
      root.classList.add("is-theme-shifting");
      clearTimeout(shiftTimer);
      shiftTimer = setTimeout(() => root.classList.remove("is-theme-shifting"), 1300);
    }
    if (id === "indigo") delete root.dataset.theme;
    else root.dataset.theme = id;
    currentTheme = id;
  };
  setInterval(() => setTheme(slotAt(jstHour()).id), 30 * 1000);

  // ---------- Hero: 1文字ずつ分割 ----------
  let i = 0;
  document.querySelectorAll("[data-split] .hero-line").forEach((line) => {
    const text = line.textContent.trim();
    line.textContent = "";
    for (const ch of text) {
      const span = document.createElement("span");
      span.className = "ch";
      span.style.setProperty("--i", i++);
      span.textContent = ch;
      line.appendChild(span);
    }
  });

  const ready = () => root.classList.add("is-ready");
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 500))]).then(ready);
  } else {
    ready();
  }

  // ---------- Dial: 目盛り・数字・弧を生成 ----------
  const nums = document.querySelector("[data-dial-nums]");

  document.querySelectorAll("[data-dial-ticks]").forEach((ticks) => {
    for (let t = 0; t < 60; t++) {
      const major = t % 5 === 0;
      const a = (t * 6 * Math.PI) / 180;
      const r1 = 300;
      const r2 = major ? 276 : 288;
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", (Math.sin(a) * r1).toFixed(2));
      line.setAttribute("y1", (-Math.cos(a) * r1).toFixed(2));
      line.setAttribute("x2", (Math.sin(a) * r2).toFixed(2));
      line.setAttribute("y2", (-Math.cos(a) * r2).toFixed(2));
      if (major) line.classList.add("is-major");
      ticks.appendChild(line);
    }
  });

  if (nums) {
    for (let h = 1; h <= 12; h++) {
      if (h === 3) continue; // 3時の位置は「15:00」ラベル
      const a = (h * 30 * Math.PI) / 180;
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", (Math.sin(a) * 252).toFixed(2));
      text.setAttribute("y", (-Math.cos(a) * 252).toFixed(2));
      text.textContent = String(h).padStart(2, "0");
      nums.appendChild(text);
    }
  }

  // 14:00〜15:00（おやつ前の1時間）を弧で示す
  const arcPoint = (deg) => {
    const a = (deg * Math.PI) / 180;
    return `${(Math.sin(a) * 300).toFixed(2)} ${(-Math.cos(a) * 300).toFixed(2)}`;
  };
  document.querySelectorAll("[data-dial-arc]").forEach((arc) => {
    arc.setAttribute("d", `M ${arcPoint(60)} A 300 300 0 0 1 ${arcPoint(90)}`);
  });

  // ---------- 時刻（JST） ----------
  const hands = {
    h: document.querySelector('[data-hand="h"]'),
    m: document.querySelector('[data-hand="m"]'),
    s: document.querySelector('[data-hand="s"]'),
  };
  const clockEls = document.querySelectorAll("[data-clock]");
  const countdownEls = document.querySelectorAll("[data-countdown]");
  const clockSmallEl = document.querySelector("[data-clock-small]");
  const pad = (n) => String(n).padStart(2, "0");
  const JST_OFFSET = 9 * 3600 * 1000;

  let lastSecond = -1;

  const tick = () => {
    const now = Date.now();
    const jst = new Date(now + JST_OFFSET);
    const h = jst.getUTCHours();
    const m = jst.getUTCMinutes();
    const s = jst.getUTCSeconds();
    const ms = jst.getUTCMilliseconds();

    const sec = reduceMotion ? s : s + ms / 1000;
    if (hands.s) hands.s.setAttribute("transform", `rotate(${(sec * 6).toFixed(3)})`);
    if (hands.m) hands.m.setAttribute("transform", `rotate(${((m + sec / 60) * 6).toFixed(3)})`);
    if (hands.h) hands.h.setAttribute("transform", `rotate(${(((h % 12) + m / 60 + sec / 3600) * 30).toFixed(3)})`);

    if (s !== lastSecond) {
      lastSecond = s;
      const time = `${pad(h)}:${pad(m)}:${pad(s)}`;
      clockEls.forEach((el) => (el.textContent = time));
      if (clockSmallEl) clockSmallEl.textContent = `JST ${pad(h)}:${pad(m)}`;

      let countdown;
      const minutesOfDay = h * 60 + m;
      if (minutesOfDay >= 15 * 60 && minutesOfDay < 15 * 60 + 15) {
        countdown = "It's 3 o'clock. Take a break.";
      } else {
        let diff = 15 * 3600 - (h * 3600 + m * 60 + s);
        if (diff <= 0) diff += 24 * 3600;
        countdown = `next 15:00 in ${pad(Math.floor(diff / 3600))}:${pad(Math.floor((diff % 3600) / 60))}:${pad(diff % 60)}`;
      }
      countdownEls.forEach((el) => (el.textContent = countdown));
    }

    if (reduceMotion) {
      setTimeout(tick, 1000 - ms);
    } else {
      requestAnimationFrame(tick);
    }
  };
  tick();

  // ---------- Hero：いま15時台の街のほうを向く地球 ----------
  // 世界のタイムゾーンは UTC-12〜+14 にまたがるので、どの瞬間もどこかの街が15時台になる
  const globe = document.querySelector("[data-globe]");
  if (globe && window.GLOBE_LAND) {
    const canvas = globe.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const pin = globe.querySelector("[data-globe-pin]");
    const pinName = globe.querySelector("[data-globe-name]");
    const pinCountry = globe.querySelector("[data-globe-country]");
    const pinCountryEn = globe.querySelector("[data-globe-country-en]");
    const pinNameRow = globe.querySelector(".globe-pin-name");
    const pinCountryRow = globe.querySelector(".globe-pin-country");
    const placeEl = globe.querySelector("[data-globe-place]");
    const timeEl = globe.querySelector("[data-globe-time]");
    const ringSvg = globe.querySelector(".globe-ring");
    const arcTop = globe.querySelector('[data-globe-arc="top"]');
    const arcBottom = globe.querySelector('[data-globe-arc="bottom"]');
    const RAD = Math.PI / 180;

    // 陸地の点：経度と、緯度の sin・cos を持っておく
    const bin = Uint8Array.from(atob(window.GLOBE_LAND), (c) => c.charCodeAt(0));
    const view = new DataView(bin.buffer);
    const count = bin.length / 4;
    const dotLon = new Float32Array(count);
    const dotSin = new Float32Array(count);
    const dotCos = new Float32Array(count);
    const dotZone = new Int8Array(count);
    for (let k = 0; k < count; k++) {
      const lat = (view.getInt16(k * 4 + 2, true) / 10) * RAD;
      const lon = view.getInt16(k * 4, true) / 10;
      dotLon[k] = lon * RAD;
      dotZone[k] = Math.round(lon / 15);
      dotSin[k] = Math.sin(lat);
      dotCos[k] = Math.cos(lat);
    }

    // サマータイムのない街も入れて、どの時間でも15時台の街が見つかるようにしている
    const CITIES = [
      ["東京", "Tokyo", "日本", "Japan", "Asia/Tokyo", 139.69, 35.69],
      ["パリ", "Paris", "フランス", "France", "Europe/Paris", 2.35, 48.86],
      ["ニューヨーク", "New York", "アメリカ", "USA", "America/New_York", -74.01, 40.71],
      ["ロンドン", "London", "イギリス", "UK", "Europe/London", -0.13, 51.51],
      ["ソウル", "Seoul", "韓国", "South Korea", "Asia/Seoul", 126.98, 37.57],
      ["シンガポール", "Singapore", "シンガポール", "Singapore", "Asia/Singapore", 103.82, 1.35],
      ["バンコク", "Bangkok", "タイ", "Thailand", "Asia/Bangkok", 100.5, 13.76],
      ["ドバイ", "Dubai", "アラブ首長国連邦", "UAE", "Asia/Dubai", 55.27, 25.2],
      ["イスタンブール", "Istanbul", "トルコ", "Türkiye", "Europe/Istanbul", 28.98, 41.01],
      ["カイロ", "Cairo", "エジプト", "Egypt", "Africa/Cairo", 31.24, 30.04],
      ["ローマ", "Rome", "イタリア", "Italy", "Europe/Rome", 12.5, 41.9],
      ["ベルリン", "Berlin", "ドイツ", "Germany", "Europe/Berlin", 13.4, 52.52],
      ["ロサンゼルス", "Los Angeles", "アメリカ", "USA", "America/Los_Angeles", -118.24, 34.05],
      ["シドニー", "Sydney", "オーストラリア", "Australia", "Australia/Sydney", 151.21, -33.87],
      ["台北", "Taipei", "台湾", "Taiwan", "Asia/Taipei", 121.56, 25.03],
      ["上海", "Shanghai", "中国", "China", "Asia/Shanghai", 121.47, 31.23],
      ["デリー", "Delhi", "インド", "India", "Asia/Kolkata", 77.21, 28.61],
      ["ホノルル", "Honolulu", "アメリカ・ハワイ州", "USA", "Pacific/Honolulu", -157.86, 21.31],
      ["サンパウロ", "São Paulo", "ブラジル", "Brazil", "America/Sao_Paulo", -46.63, -23.55],
      ["メキシコシティ", "Mexico City", "メキシコ", "Mexico", "America/Mexico_City", -99.13, 19.43],
      ["オークランド", "Auckland", "ニュージーランド", "New Zealand", "Pacific/Auckland", 174.76, -36.85],
      ["シカゴ", "Chicago", "アメリカ", "USA", "America/Chicago", -87.63, 41.88],
      ["リスボン", "Lisbon", "ポルトガル", "Portugal", "Europe/Lisbon", -9.14, 38.72],
      ["モスクワ", "Moscow", "ロシア", "Russia", "Europe/Moscow", 37.62, 55.76],
      ["ナイロビ", "Nairobi", "ケニア", "Kenya", "Africa/Nairobi", 36.82, -1.29],
      ["ヨハネスブルグ", "Johannesburg", "南アフリカ", "South Africa", "Africa/Johannesburg", 28.05, -26.2],
      ["ラゴス", "Lagos", "ナイジェリア", "Nigeria", "Africa/Lagos", 3.38, 6.52],
      ["アテネ", "Athens", "ギリシャ", "Greece", "Europe/Athens", 23.73, 37.98],
      ["ジャカルタ", "Jakarta", "インドネシア", "Indonesia", "Asia/Jakarta", 106.85, -6.21],
      ["ダッカ", "Dhaka", "バングラデシュ", "Bangladesh", "Asia/Dhaka", 90.41, 23.81],
      ["カトマンズ", "Kathmandu", "ネパール", "Nepal", "Asia/Kathmandu", 85.32, 27.72],
      ["カラチ", "Karachi", "パキスタン", "Pakistan", "Asia/Karachi", 67.01, 24.86],
      ["タシケント", "Tashkent", "ウズベキスタン", "Uzbekistan", "Asia/Tashkent", 69.24, 41.3],
      ["テヘラン", "Tehran", "イラン", "Iran", "Asia/Tehran", 51.39, 35.69],
      ["パース", "Perth", "オーストラリア", "Australia", "Australia/Perth", 115.86, -31.95],
      ["ブリスベン", "Brisbane", "オーストラリア", "Australia", "Australia/Brisbane", 153.03, -27.47],
      ["グアム", "Guam", "アメリカ領グアム", "Guam", "Pacific/Guam", 144.79, 13.44],
      ["ヌメア", "Nouméa", "ニューカレドニア", "New Caledonia", "Pacific/Noumea", 166.46, -22.26],
      ["スバ", "Suva", "フィジー", "Fiji", "Pacific/Fiji", 178.44, -18.14],
      ["ヌクアロファ", "Nukuʻalofa", "トンガ", "Tonga", "Pacific/Tongatapu", -175.2, -21.14],
      ["アピア", "Apia", "サモア", "Samoa", "Pacific/Apia", -171.76, -13.83],
      ["キリティマティ", "Kiritimati", "キリバス", "Kiribati", "Pacific/Kiritimati", -157.36, 1.87],
      ["パゴパゴ", "Pago Pago", "アメリカ領サモア", "American Samoa", "Pacific/Pago_Pago", -170.7, -14.28],
      ["アンカレッジ", "Anchorage", "アメリカ・アラスカ州", "USA", "America/Anchorage", -149.9, 61.22],
      ["ガンビエ諸島", "Gambier", "フランス領ポリネシア", "French Polynesia", "Pacific/Gambier", -134.97, -23.12],
      ["ピトケアン諸島", "Pitcairn", "イギリス領ピトケアン諸島", "Pitcairn Islands", "Pacific/Pitcairn", -130.1, -25.07],
      ["バンクーバー", "Vancouver", "カナダ", "Canada", "America/Vancouver", -123.12, 49.28],
      ["フェニックス", "Phoenix", "アメリカ", "USA", "America/Phoenix", -112.07, 33.45],
      ["デンバー", "Denver", "アメリカ", "USA", "America/Denver", -104.99, 39.74],
      ["リマ", "Lima", "ペルー", "Peru", "America/Lima", -77.04, -12.05],
      ["トロント", "Toronto", "カナダ", "Canada", "America/Toronto", -79.38, 43.65],
      ["カラカス", "Caracas", "ベネズエラ", "Venezuela", "America/Caracas", -66.9, 10.48],
      ["サンティアゴ", "Santiago", "チリ", "Chile", "America/Santiago", -70.67, -33.45],
      ["ブエノスアイレス", "Buenos Aires", "アルゼンチン", "Argentina", "America/Argentina/Buenos_Aires", -58.38, -34.6],
      ["フェルナンド・デ・ノローニャ", "Noronha", "ブラジル", "Brazil", "America/Noronha", -32.42, -3.85],
      ["プライア", "Praia", "カーボベルデ", "Cape Verde", "Atlantic/Cape_Verde", -23.51, 14.93],
      ["アゾレス諸島", "Azores", "ポルトガル", "Portugal", "Atlantic/Azores", -25.67, 37.74],
      ["レイキャビク", "Reykjavík", "アイスランド", "Iceland", "Atlantic/Reykjavik", -21.94, 64.15],
    ].map(([ja, en, country, countryEn, tz, lon, lat]) => {
      let fmt = null;
      try {
        fmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
      } catch (e) {}
      return { ja, en, country, countryEn, lon, lat, fmt };
    });

    const localTime = (city, now) => {
      const parts = city.fmt.formatToParts(now);
      const get = (type) => Number(parts.find((p) => p.type === type).value);
      return { h: get("hour"), m: get("minute") };
    };
    const citiesAt3 = (now) => CITIES.filter((c) => c.fmt && localTime(c, now).h === 15);

    // 見る向き（中心の経度・緯度）。街の少し南を中心にして、街が地球の真ん中あたりに来るように
    const viewFor = (city) => ({ lon: city.lon, lat: Math.max(-40, Math.min(45, city.lat * 0.85)) });
    const wrap180 = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;
    // canvas では color-mix() が使えないブラウザがあるので、16進の色を自前で混ぜる
    const toRgb = (hex) => {
      const h = hex.replace("#", "");
      const full = h.length === 3 ? h.replace(/./g, "$&$&") : h;
      const n = parseInt(full.slice(0, 6), 16);
      return Number.isNaN(n) ? [255, 255, 255] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const mix = (a, b, t) => {
      const x = toRgb(a);
      const y = toRgb(b);
      return `rgb(${x.map((v, i) => Math.round(v * t + y[i] * (1 - t))).join(",")})`;
    };
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    // 点の色：その土地の現地時刻の時間帯の色（site.css の各テーマの --signal と同じ色）
    const SLOT_COLORS = { lime: "#3D7A00", cobalt: "#155EEF", berry: "#D1246E", mono: "#FF5A1F", indigo: "#4F46F0", teal: "#0E8C86" };

    let size = 0;
    let dpr = 1;
    let geo = { R: 0, ring: 0 };
    let colors = {};
    let current = null;
    let cur = { lon: 139.69, lat: 15 };
    let drag = { lon: 0, lat: 0 };
    let anim = null;
    let frame = 0;

    const readColors = () => {
      const cs = getComputedStyle(globe);
      colors = {
        ink: cs.getPropertyValue("--ink").trim(),
        line: cs.getPropertyValue("--line-strong").trim(),
        paper: cs.getPropertyValue("--paper").trim(),
      };
    };

    const draw = () => {
      if (!size) return;
      const now = new Date();
      const W = size;
      const cx = W / 2;
      const cy = W / 2;
      const R = geo.R;
      const lon0 = (cur.lon + drag.lon) * RAD;
      const lat0 = Math.max(-60, Math.min(60, cur.lat + drag.lat)) * RAD;
      const sin0 = Math.sin(lat0);
      const cos0 = Math.cos(lat0);

      // 太陽の真下の地点（昼と夜の境目に使う）
      const ut = now.getUTCHours() + now.getUTCMinutes() / 60;
      const dayOfYear = Math.floor((now - Date.UTC(now.getUTCFullYear(), 0, 0)) / 864e5);
      const sunLon = wrap180((12 - ut) * 15) * RAD;
      const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10)) * RAD;
      const sunSin = Math.sin(decl);
      const sunCos = Math.cos(decl);

      // ピンを立てている街のまわりの点を、少し大きく濃く
      const focus = current;
      const fLon = focus ? focus.lon * RAD : 0;
      const fSin = focus ? Math.sin(focus.lat * RAD) : 0;
      const fCos = focus ? Math.cos(focus.lat * RAD) : 0;
      const glowEdge = Math.cos(34 * RAD);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, W);

      // 球：うっすら色づいた面と、輪郭の線
      const fill = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      fill.addColorStop(0, colors.paper);
      fill.addColorStop(1, mix(colors.ink, colors.paper, 0.04));
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.line;
      ctx.stroke();

      // 外側のリング
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, geo.ring, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 15度ごとの経線（時差1時間ぶん）を薄く
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.07;
      for (let m = -180; m < 180; m += 15) {
        const dl = m * RAD - lon0;
        ctx.beginPath();
        let open = false;
        for (let p = -90; p <= 90; p += 4) {
          const phi = p * RAD;
          const sp = Math.sin(phi);
          const cp = Math.cos(phi);
          const cosc = sin0 * sp + cos0 * cp * Math.cos(dl);
          if (cosc < 0) {
            open = false;
            continue;
          }
          const x = cx + R * cp * Math.sin(dl);
          const y = cy - R * (cos0 * sp - sin0 * cp * Math.cos(dl));
          if (open) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
          open = true;
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 街の印（HTML）を地球の上の位置へ。
      // ラベルの文字の下にある点は消して、カラフルな点の上でも文字を読みやすくする
      const holes = [];
      if (focus) {
        const dl = fLon - lon0;
        const cosc = sin0 * fSin + cos0 * fCos * Math.cos(dl);
        const x = cx + R * fCos * Math.sin(dl);
        const y = cy - R * (cos0 * fSin - sin0 * fCos * Math.cos(dl));
        pin.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        pin.classList.toggle("is-left", x > cx + R * 0.2);
        pin.classList.toggle("is-down", y < cy - R * 0.15);
        pin.classList.toggle("is-on", cosc > 0.15 && !anim?.hidePin);
        if (pin.classList.contains("is-on") && pin.classList.contains("is-drawn")) {
          const base = canvas.getBoundingClientRect();
          [pinNameRow, pinCountryRow].forEach((el) => {
            const b = el.getBoundingClientRect();
            holes.push([b.left - base.left - 4, b.top - base.top - 2, b.right - base.left + 4, b.bottom - base.top + 2]);
          });
        }
      }

      // タイムゾーンごとの色（時差 -12〜+12 時間）
      const zoneColor = [];
      for (let z = -12; z <= 12; z++) {
        const hour = Math.floor((((ut + z) % 24) + 24) % 24);
        zoneColor.push(SLOT_COLORS[slotAt(hour).id]);
      }

      // 陸地の点：奥ほど小さく、夜の側は淡く
      const dotR = Math.max(1, R / 115);
      for (let k = 0; k < count; k++) {
        const dl = dotLon[k] - lon0;
        const cdl = Math.cos(dl);
        const cosc = sin0 * dotSin[k] + cos0 * dotCos[k] * cdl;
        if (cosc <= 0.02) continue;
        const x = cx + R * dotCos[k] * Math.sin(dl);
        const y = cy - R * (cos0 * dotSin[k] - sin0 * dotCos[k] * cdl);
        const sun = dotSin[k] * sunSin + dotCos[k] * sunCos * Math.cos(dotLon[k] - sunLon);
        const day = Math.max(0, Math.min(1, (sun + 0.08) / 0.2));
        const depth = 0.35 + 0.65 * cosc;
        let r = dotR * (0.5 + 0.5 * cosc);
        let alpha = (0.34 + 0.56 * day) * depth;

        if (focus) {
          const near = fSin * dotSin[k] + fCos * dotCos[k] * Math.cos(dotLon[k] - fLon);
          if (near > glowEdge) {
            const g = Math.pow((near - glowEdge) / (1 - glowEdge), 1.2);
            r *= 1 + 0.45 * g;
            alpha = Math.min(1, alpha + 0.25 * g);
          }
        }

        for (const [left, top, right, bottom] of holes) {
          const gap = Math.hypot(Math.max(left - x, 0, x - right), Math.max(top - y, 0, y - bottom));
          if (gap < 10) alpha *= 0.04 + 0.96 * (gap / 10);
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = zoneColor[dotZone[k] + 12];
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

    };

    const loop = (t) => {
      frame = 0;
      if (anim) {
        const p = Math.min(1, (t - anim.start) / anim.duration);
        const e = ease(p);
        cur = { lon: anim.from.lon + (anim.to.lon - anim.from.lon) * e, lat: anim.from.lat + (anim.to.lat - anim.from.lat) * e };
        if (anim.dragFrom) drag = { lon: anim.dragFrom.lon * (1 - e), lat: anim.dragFrom.lat * (1 - e) };
        if (p >= 1) {
          cur = { lon: wrap180(anim.to.lon), lat: anim.to.lat };
          anim = null;
        }
      }
      draw();
      if (anim) frame = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(loop);
    };

    // 向きを変える。westward: true なら、地球の自転と同じ向き（西回り）に回す
    const turnTo = (target, duration, opts = {}) => {
      if (reduceMotion || !duration) {
        cur = { lon: target.lon, lat: target.lat };
        drag = { lon: 0, lat: 0 };
        anim = null;
        kick();
        return;
      }
      let delta = wrap180(target.lon - cur.lon);
      if (opts.westward) delta = -((((cur.lon - target.lon) % 360) + 360) % 360);
      anim = {
        start: performance.now(),
        duration,
        from: { ...cur },
        to: { lon: cur.lon + delta, lat: target.lat },
        hidePin: !!opts.hidePin,
        dragFrom: opts.dragFrom,
      };
      kick();
    };

    // 街の名前は、空港の発着案内板のように文字がパタパタと入れ替わってから止まる
    const FLAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let flapFrame = 0;
    const flapTo = (el, text) => {
      cancelAnimationFrame(flapFrame);
      el.style.width = "";
      el.textContent = text;
      if (reduceMotion) return;
      el.style.width = `${el.getBoundingClientRect().width}px`;
      const start = performance.now();
      const step = (t) => {
        const p = (t - start) / 700;
        let out = "";
        for (let i = 0; i < text.length; i++) {
          const settled = p >= 0.35 + (0.65 * i) / text.length;
          out += settled || text[i] === " " ? text[i] : FLAP[Math.floor(Math.random() * FLAP.length)];
        }
        el.textContent = out;
        if (p < 1) flapFrame = requestAnimationFrame(step);
        else el.style.width = "";
      };
      flapFrame = requestAnimationFrame(step);
    };

    // ラベル：点から線が伸び、街の名前（パタパタ）と国名が順に出る
    const showLabel = (city) => {
      pin.classList.remove("is-drawn");
      pinCountryEn.textContent = city.countryEn.toUpperCase();
      pinCountry.textContent = city.country;
      flapTo(pinName, city.en.toUpperCase());
      pin.style.setProperty("--lw", `${Math.max(pinNameRow.offsetWidth, pinCountryRow.offsetWidth) + 4}px`);
      void pin.offsetWidth;
      pin.classList.add("is-drawn");
      kick();
    };

    // 表示する街を選ぶ。15時台の街が複数あれば、順番に切り替える
    let pickIndex = 0;
    const updateReadout = () => {
      if (!current) return;
      const { h, m } = localTime(current, new Date());
      const time = `${pad(h)}:${pad(m)}`;
      timeEl.textContent = time;
      placeEl.textContent = `いま、${current.country}の${current.ja}は${time}。世界のどこかは、いつも3時のおやつ。`;
    };
    const choose = (opts) => {
      if (dragStart) return;
      const list = citiesAt3(new Date());
      if (!list.length) return;
      const next = list[pickIndex % list.length];
      pickIndex++;
      const changed = next !== current;
      current = next;
      if (changed) {
        const city = current;
        // 最初に回っているあいだはラベルを隠しているので、止まってから出す
        if (opts?.hidePin && !reduceMotion) setTimeout(() => showLabel(city), opts.duration);
        else showLabel(city);
      }
      updateReadout();
      if (changed || opts) turnTo(viewFor(current), opts?.duration ?? 1800, opts);
    };

    const resize = () => {
      const w = Math.round(globe.clientWidth);
      if (!w) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = w;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(w * dpr);

      // 外周の文字の帯を確保してから、リングと地球の大きさを決める
      const fs = Math.max(9, Math.min(13, w * 0.026));
      const c = w / 2;
      const ring = c - 1 - fs * 1.25 - 6;
      geo = { R: ring - Math.max(6, w * 0.025), ring };
      const rTop = ring + 7;
      const rBottom = ring + 7 + fs * 0.78;
      ringSvg.setAttribute("viewBox", `0 0 ${w} ${w}`);
      ringSvg.style.fontSize = `${fs}px`;
      arcTop.setAttribute("d", `M ${c - rTop} ${c} A ${rTop} ${rTop} 0 0 1 ${c + rTop} ${c}`);
      arcBottom.setAttribute("d", `M ${c - rBottom} ${c} A ${rBottom} ${rBottom} 0 0 0 ${c + rBottom} ${c}`);
      kick();
    };

    // 東京と15時台の街が近いとき（日本が昼の時間帯）は、少し東から回し始める
    const first = citiesAt3(new Date())[0];
    if (first && (((cur.lon - first.lon) % 360) + 360) % 360 < 60) cur.lon = first.lon + 100;

    readColors();
    resize();
    new ResizeObserver(resize).observe(globe);
    new MutationObserver(() => {
      readColors();
      kick();
    }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    // 最初は日本（東京）から、いま15時台の街まで西回りにくるっと回る
    setTimeout(() => choose({ duration: 2800, westward: true, hidePin: true }), reduceMotion ? 0 : 450);
    setInterval(() => choose(), 8000);
    setInterval(() => {
      updateReadout();
      kick();
    }, 5000);

    // ドラッグで回せる。離すと、いま15時台の街へゆっくり戻る
    let dragStart = null;
    canvas.addEventListener("pointerdown", (e) => {
      dragStart = { x: e.clientX, y: e.clientY, lon: drag.lon, lat: drag.lat };
      anim = null;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add("is-dragging");
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragStart) return;
      const k = 180 / (Math.PI * geo.R);
      drag = {
        lon: dragStart.lon - (e.clientX - dragStart.x) * k,
        lat: Math.max(-40, Math.min(40, dragStart.lat + (e.clientY - dragStart.y) * k)),
      };
      kick();
    });
    const release = () => {
      if (!dragStart) return;
      dragStart = null;
      canvas.classList.remove("is-dragging");
      if (current) turnTo(viewFor(current), 1400, { dragFrom: { ...drag } });
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
  }

  // ---------- About：2時→3時（長針が1周）のアニメーション ----------
  const animDial = document.querySelector("[data-dial-animate]");
  if (animDial && !reduceMotion && "IntersectionObserver" in window) {
    const hourHand = animDial.querySelector('[data-hand-static="h"]');
    const minuteHand = animDial.querySelector('[data-hand-static="m"]');
    const arc = animDial.querySelector("[data-dial-arc]");
    const now = animDial.querySelector("[data-dial-now]");
    const arcLength = arc.getTotalLength();
    arc.style.strokeDasharray = arcLength;

    const render = (p) => {
      hourHand.setAttribute("transform", `rotate(${60 + 30 * p})`);
      minuteHand.setAttribute("transform", `rotate(${360 * p})`);
      arc.style.strokeDashoffset = arcLength * (1 - p);
      now.textContent = p >= 1 ? "15:00" : `14:${pad(Math.floor(60 * p))}`;
    };
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    render(0);
    animDial.classList.add("is-waiting");

    const play = () => {
      const start = performance.now();
      const duration = 2800;
      const step = (time) => {
        const t = Math.min((time - start) / duration, 1);
        render(easeInOut(t));
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          animDial.classList.remove("is-waiting");
          animDial.classList.add("is-three");
        }
      };
      requestAnimationFrame(step);
    };

    const dialObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          dialObserver.disconnect();
          setTimeout(play, 500);
        }
      },
      { threshold: 0.6 }
    );
    dialObserver.observe(animDial);
  }

  // ---------- お問い合わせ：「開発相談・見積もり」と「その他」をタブで切り替え ----------
  const contactTabs = document.querySelector("[data-contact-tabs]");
  if (contactTabs) {
    const tabs = [...contactTabs.querySelectorAll('[role="tab"]')];
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));
    const showTab = (index, focus) => {
      tabs.forEach((tab, n) => {
        const on = n === index;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        panels[n].hidden = !on;
      });
      if (focus) tabs[index].focus();
    };
    tabs.forEach((tab, n) => {
      tab.addEventListener("click", () => showTab(n));
      tab.addEventListener("keydown", (e) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        showTab((n + step + tabs.length) % tabs.length, true);
      });
    });

    // ?type=development は見積もり、それ以外の種別は「その他」を開いて、その種別を選ぶ
    const params = new URLSearchParams(location.search);
    const type = params.get("type");
    const general = document.getElementById("panel-general");
    const presetType = type && general.querySelector(`input[name="type"][value="${CSS.escape(type)}"]`);
    if (presetType) {
      presetType.checked = true;
      showTab(tabs.findIndex((tab) => tab.getAttribute("aria-controls") === "panel-general"));
    }
    const activeForm = panels.find((panel) => !panel.hidden).querySelector("form");
    const role = params.get("role");
    const topic = params.get("topic");
    if (role) activeForm.elements.message.value = `【応募職種】${role}\n\n`;
    else if (topic) activeForm.elements.message.value = `【ご希望】${topic}\n\n`;
  }

  // ---------- お問い合わせフォーム：入力内容をメールアプリで開く ----------
  document.querySelectorAll("[data-contact-form]").forEach((form) => {
    const status = form.querySelector("[data-form-status]");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        status.dataset.state = "error";
        status.textContent = "未入力の必須項目があります。";
        form.reportValidity();
        return;
      }

      // data-mail-label の付いた項目を、上から順に本文へ
      const lines = [];
      form.querySelectorAll("[data-mail-label]").forEach((field) => {
        const label = field.dataset.mailLabel;
        const value = field.tagName === "FIELDSET" ? field.querySelector("input:checked")?.dataset.label : field.value.trim();
        if (field.tagName === "TEXTAREA") lines.push("", `${label}：`, value || "-", "");
        else lines.push(`${label}：${value || "-"}`);
      });
      const typeField = form.querySelector("[data-subject-type]");
      const head = form.dataset.subject + (typeField ? typeField.querySelector("input:checked").dataset.label : "");
      const subject = `${head}｜${form.elements.name.value}様`;
      const to = form.dataset.to;

      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
      status.dataset.state = "info";
      status.textContent = `メールアプリが開きます。内容を確認して送信してください。開かない場合は ${to} まで直接ご連絡ください。`;
    });
  });

  // ---------- 採用：メッセージの文字がスクロールに合わせて濃くなる ----------
  const fillTexts = [...document.querySelectorAll("[data-fill-text]")];
  if (fillTexts.length && !reduceMotion) {
    const chars = new Map();
    fillTexts.forEach((el) => {
      const frag = document.createDocumentFragment();
      el.childNodes.forEach((node) => {
        if (node.nodeType !== Node.TEXT_NODE) {
          frag.appendChild(node.cloneNode(true));
          return;
        }
        for (const ch of node.textContent) {
          const span = document.createElement("span");
          span.className = "fc";
          span.textContent = ch;
          frag.appendChild(span);
        }
      });
      el.replaceChildren(frag);
      el.classList.add("is-split");
      chars.set(el, [...el.querySelectorAll(".fc")]);
    });

    const paint = () => {
      const start = innerHeight * 0.85;
      const end = innerHeight * 0.45;
      chars.forEach((list, el) => {
        const r = el.getBoundingClientRect();
        const p = Math.min(Math.max((start - r.top) / (r.height + start - end), 0), 1);
        const lit = Math.round(p * list.length);
        list.forEach((c, i) => c.classList.toggle("is-lit", i < lit));
      });
    };
    let queued = false;
    window.addEventListener(
      "scroll",
      () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
          paint();
          queued = false;
        });
      },
      { passive: true }
    );
    paint();
  }

  // ---------- 採用：職種の絞り込み ----------
  const filterButtons = document.querySelectorAll("[data-filter]");
  const positionCards = document.querySelectorAll(".pos-card");
  const positionCount = document.querySelector("[data-pos-count]");
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      filterButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      let shown = 0;
      positionCards.forEach((card) => {
        const isOpenCard = card.dataset.cat === "open";
        const match = filter === "all" || card.dataset.cat === filter;
        card.hidden = !match;
        if (match && !isOpenCard) shown++;
      });
      if (positionCount) positionCount.textContent = shown;
    });
  });

  // ---------- 制作例：カードの画面イメージを、詳細ポップアップの見出しの下にも出す ----------
  document.querySelectorAll(".case").forEach((card) => {
    const shot = card.querySelector(".case-shot");
    const id = card.querySelector("[data-open-dialog]")?.dataset.openDialog;
    const title = id && document.querySelector(`#dlg-${id} .rdlg-title`);
    if (shot && title) title.after(shot.cloneNode(true));
  });

  // ---------- 採用：職種の詳細ポップアップ（#ios などの URL でも開く） ----------
  const openRole = (id, updateHash) => {
    const dialog = document.getElementById(`dlg-${id}`);
    if (!dialog || dialog.open) return;
    dialog.showModal();
    if (updateHash) history.replaceState(null, "", `#${id}`);
  };
  document.querySelectorAll("[data-open-dialog]").forEach((button) => {
    button.addEventListener("click", () => openRole(button.dataset.openDialog, true));
  });
  document.querySelectorAll("dialog.rdlg").forEach((dialog) => {
    dialog.querySelector("[data-dialog-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      if (location.hash === `#${dialog.dataset.role}`) {
        history.replaceState(null, "", location.pathname + location.search);
      }
    });
  });
  const openRoleFromHash = () => openRole(location.hash.slice(1), false);
  openRoleFromHash();
  window.addEventListener("hashchange", openRoleFromHash);

  // ---------- 文書ページ：見出しから目次をつくる ----------
  const docToc = document.querySelector("[data-doc-toc]");
  const docHeads = [...document.querySelectorAll(".doc-body h2")];
  if (docToc && docHeads.length) {
    const list = document.createElement("ol");
    docHeads.forEach((h, n) => {
      if (!h.id) h.id = `sec-${n + 1}`;
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `#${h.id}`;
      a.textContent = h.textContent;
      li.appendChild(a);
      list.appendChild(li);
    });
    docToc.appendChild(list);
    const tocLinks = [...list.querySelectorAll("a")];
    const markActive = () => {
      let current = docHeads[0];
      docHeads.forEach((h) => {
        if (h.getBoundingClientRect().top < innerHeight * 0.3) current = h;
      });
      tocLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${current.id}`));
    };
    window.addEventListener("scroll", markActive, { passive: true });
    markActive();
  }

  // ---------- スクリーンショットの横スクロールボタン ----------
  document.querySelectorAll("[data-shots]").forEach((shots) => {
    const track = shots.querySelector("[data-shots-track]");
    shots.querySelectorAll("[data-shots-dir]").forEach((button) => {
      button.addEventListener("click", () => {
        track.scrollBy({ left: Number(button.dataset.shotsDir) * track.clientWidth * 0.8, behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  });

  // ---------- Products：カードの出方とカーソルへの反応 ----------
  const pcards = document.querySelectorAll("[data-pcard]");

  if ("IntersectionObserver" in window && !reduceMotion) {
    const cardObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-shown");
          cardObserver.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -15% 0px", threshold: 0.2 }
    );
    pcards.forEach((card) => cardObserver.observe(card));
  } else {
    pcards.forEach((card) => card.classList.add("is-shown"));
  }

  // マウスのときだけ：カーソルの位置にやわらかい光を当てる（カードや画像は動かさない）
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && !reduceMotion) {
    pcards.forEach((card) => {
      let frame;
      card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          card.style.setProperty("--mx", `${x.toFixed(1)}%`);
          card.style.setProperty("--my", `${y.toFixed(1)}%`);
        });
      });
    });
  }

  // ---------- スクロールで出現 ----------
  const revealTargets = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("is-in"));
  }

  // ---------- Header ----------
  const header = document.querySelector("[data-gh]");
  const toggle = document.querySelector("[data-gh-toggle]");

  const inner = header.querySelector(".gh-inner");
  const nav = header.querySelector(".gh-nav");
  const cta = header.querySelector(".gh-cta");
  const desktop = window.matchMedia("(min-width: 961px)");

  // PC：スクロールしたら右上の小さなカプセルにまとめる。
  // 白いカプセルは、閉じているときは「Menu」だけ、広げたときはメニューの先頭から「Close」までを包む
  const setPill = (left, right, instant) => {
    header.classList.toggle("no-pill-anim", !!instant);
    const base = inner.getBoundingClientRect().left;
    inner.style.setProperty("--pill-x", `${left - base}px`);
    inner.style.setProperty("--pill-w", `${right - left}px`);
  };
  const navLeft = () => nav.getBoundingClientRect().left - 24;
  const placePill = () => {
    if (!header.classList.contains("is-compact")) return;
    const t = toggle.getBoundingClientRect();
    setPill(header.classList.contains("is-expanded") ? navLeft() : t.left - 6, t.right + 6);
  };
  let expandedAt = 0;
  const setExpanded = (open) => {
    header.classList.toggle("is-expanded", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    expandedAt = window.scrollY;
    placePill();
  };

  // カプセルにまとめるとき：いまのメニューの幅でカプセルを出し、メニューを吸い込みながら「Menu」の大きさまで縮める。
  // 元に戻すとき：カプセルをメニューの幅まで広げてから消す
  let releaseTimer = 0;
  const setCompact = (on) => {
    clearTimeout(releaseTimer);
    if (on) {
      header.classList.remove("is-releasing");
      header.classList.add("is-compact");
      if (!reduceMotion) setPill(navLeft(), toggle.getBoundingClientRect().right + 6, true);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        header.classList.remove("no-pill-anim");
        placePill();
      }));
    } else {
      if (header.classList.contains("is-expanded")) setExpanded(false);
      header.classList.remove("is-compact");
      header.classList.add("is-releasing");
      setPill(navLeft(), cta.getBoundingClientRect().right + 6);
      releaseTimer = setTimeout(() => header.classList.remove("is-releasing"), 450);
    }
  };

  const darkZones = [...document.querySelectorAll(".sec--dark, .gf, .rhero, .rentry")];
  const onScroll = () => {
    const compact = desktop.matches && window.scrollY > 120;
    if (compact !== header.classList.contains("is-compact")) setCompact(compact);
    // 広げたあとにしばらくスクロールしたら、またカプセルに戻す
    if (header.classList.contains("is-expanded") && Math.abs(window.scrollY - expandedAt) > 160) setExpanded(false);

    const probe = header.offsetHeight / 2;
    const overDark = darkZones.some((el) => {
      const r = el.getBoundingClientRect();
      return r.top <= probe && r.bottom >= probe;
    });
    header.classList.toggle("is-dark", overDark);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  desktop.addEventListener("change", onScroll);
  window.addEventListener("resize", placePill);

  const setMenu = (open) => {
    header.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    document.body.style.overflow = open ? "hidden" : "";
  };
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    if (desktop.matches) setExpanded(open);
    else setMenu(open);
  });
  header.querySelectorAll(".gh-nav a").forEach((a) =>
    a.addEventListener("click", () => {
      setMenu(false);
      setExpanded(false);
    }),
  );
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    setMenu(false);
    setExpanded(false);
  });
})();
