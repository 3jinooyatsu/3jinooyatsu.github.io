// ---------- サイドドロワーメニュー ----------
(function () {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (!toggle || !nav) return;

  // .page-frame の container/contain 制約から逃がすため、navをbody直下に移動
  document.body.appendChild(nav);

  // バックドロップをbody直下、navの直前に挿入
  const backdrop = document.createElement("div");
  backdrop.className = "site-nav-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  document.body.insertBefore(backdrop, nav);

  // メニュー内に閉じるボタンを追加（×アイコン）
  const closeBtn = document.createElement("button");
  closeBtn.className = "site-nav-close";
  closeBtn.setAttribute("aria-label", "メニューを閉じる");
  closeBtn.setAttribute("type", "button");
  nav.insertBefore(closeBtn, nav.firstChild);

  const close = () => {
    toggle.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    document.body.style.overflow = "";
  };

  const open = () => {
    toggle.setAttribute("aria-expanded", "true");
    nav.classList.add("is-open");
    backdrop.classList.add("is-open");
    document.body.style.overflow = "hidden";
  };

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    isOpen ? close() : open();
  });

  backdrop.addEventListener("click", close);
  closeBtn.addEventListener("click", close);

  nav.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", close);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) close();
  });
})();

// ---------- マグネティック・ボタン ----------
(function () {
  // ボタン自身を吸い寄せるタイプ
  const magnets = document.querySelectorAll(".contact-button");
  magnets.forEach((el) => {
    const strength = 0.35;
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    });
    el.addEventListener("mouseleave", () => {
      el.style.transform = "";
    });
  });

  // メニューの大きな番号：行のmousemoveに応じてカーソルへ引き寄せられる
  const rows = document.querySelectorAll(".catalog-row");
  rows.forEach((row) => {
    const bignum = row.querySelector(".catalog-bignum");
    if (!bignum) return;
    const strength = 0.18;
    row.addEventListener("mousemove", (e) => {
      const r = bignum.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      bignum.style.setProperty("--mx", `${x * strength}px`);
      bignum.style.setProperty("--my", `${y * strength}px`);
    });
    row.addEventListener("mouseleave", () => {
      bignum.style.setProperty("--mx", "0px");
      bignum.style.setProperty("--my", "0px");
    });
  });
})();

// ---------- ページインジケーター ----------
(function () {
  const current = document.querySelector(".page-current");
  if (!current) return;

  const sections = Array.from(
    document.querySelectorAll(".hero, #apps, #about, #contact")
  );
  if (!sections.length) return;

  const visibility = new Map();

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => visibility.set(e.target, e.intersectionRatio));

      let max = -1;
      let active = null;
      visibility.forEach((ratio, sec) => {
        if (ratio > max) {
          max = ratio;
          active = sec;
        }
      });

      if (active) {
        const idx = sections.indexOf(active) + 1;
        current.textContent = String(idx).padStart(2, "0");
      }
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] }
  );

  sections.forEach((s) => obs.observe(s));
})();

// ---------- About：本文を1文字ずつspanに分解 ----------
(function () {
  const texts = document.querySelectorAll(".about-text");
  if (!texts.length) return;

  let charIndex = 0;
  function wrap(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      const frag = document.createDocumentFragment();
      for (const ch of text) {
        if (ch === " " || ch === "\n" || ch === "\t") {
          frag.appendChild(document.createTextNode(ch));
        } else {
          const span = document.createElement("span");
          span.className = "char";
          span.style.setProperty("--ci", charIndex++);
          span.textContent = ch;
          frag.appendChild(span);
        }
      }
      node.replaceWith(frag);
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "BR") {
      Array.from(node.childNodes).forEach(wrap);
    }
  }

  texts.forEach((p) => Array.from(p.childNodes).forEach(wrap));
})();

// ---------- 左右余白の色：スクロール位置で淡く変化 ----------
(function () {
  const sectionColors = {
    "hero":    "#F0E2C8", // 暖かいクリーム
    "apps":    "#D5E2CE", // 淡いセージ
    "about":   "#DFD4E0", // 柔らかいラベンダー
    "news":    "#E8DECB", // 淡いサンド
    "contact": "#F0D9D0", // 淡いローズ
  };

  const targets = [
    { el: document.querySelector(".hero"),    key: "hero" },
    { el: document.querySelector("#apps"),    key: "apps" },
    { el: document.querySelector("#about"),   key: "about" },
    { el: document.querySelector("#news"),    key: "news" },
    { el: document.querySelector("#contact"), key: "contact" },
  ].filter((t) => t.el);
  if (!targets.length) return;

  const ratios = new Map();

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => ratios.set(e.target, e.intersectionRatio));

      let bestKey = null;
      let bestRatio = -1;
      targets.forEach(({ el, key }) => {
        const r = ratios.get(el) || 0;
        if (r > bestRatio) {
          bestRatio = r;
          bestKey = key;
        }
      });
      if (bestKey && sectionColors[bestKey]) {
        document.documentElement.style.setProperty("--frame-bg", sectionColors[bestKey]);
      }
    },
    { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] }
  );

  targets.forEach((t) => obs.observe(t.el));
})();

// ---------- Hero：ロード後に時計の針を3:00へ動かし、止まったらテキストを出す ----------
(function () {
  const hero = document.querySelector(".hero");
  if (!hero) return;
  const min = hero.querySelector(".hero-clock-min");

  const reveal = () => hero.classList.add("is-text-reveal");

  window.addEventListener("load", () => {
    setTimeout(() => hero.classList.add("is-active"), 400);
  });

  if (min) {
    min.addEventListener("transitionend", reveal, { once: true });
    // フォールバック（万一transitionendが発火しなかった場合）
    setTimeout(reveal, 4000);
  } else {
    reveal();
  }
})();

// ---------- About：スクロールで is-active を付与 ----------
(function () {
  const about = document.querySelector(".about");
  if (!about) return;

  if (!("IntersectionObserver" in window)) {
    about.classList.add("is-active");
    return;
  }

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          about.classList.add("is-active");
          obs.unobserve(about);
        }
      });
    },
    { threshold: 0.25 }
  );

  obs.observe(about);
})();

// ---------- Contactフォーム送信ハンドラ ----------
(function () {
  const form = document.querySelector(".contact-form");
  if (!form) return;
  const status = form.querySelector(".form-status");
  const submit = form.querySelector(".form-submit");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      status.textContent = "未入力の必須項目があります。";
      status.classList.remove("is-success");
      status.classList.add("is-error");
      form.reportValidity();
      return;
    }

    submit.disabled = true;
    status.classList.remove("is-error");
    status.textContent = "送信中…";

    // 実運用ではここで fetch して送信先（Formspree/Netlify/独自APIなど）に POST する
    setTimeout(() => {
      status.classList.remove("is-error");
      status.classList.add("is-success");
      status.textContent = "送信ありがとうございます。お返事までしばしお待ちください。";
      form.reset();
      submit.disabled = false;
    }, 700);
  });
})();

// ---------- 3時ぴったりに小さな演出 ----------
(function () {
  const banner = document.getElementById("three-oclock");
  if (!banner) return;

  function check() {
    const now = new Date();
    const isThree = now.getHours() === 15 && now.getMinutes() < 5;
    if (isThree) {
      banner.hidden = false;
      requestAnimationFrame(() => banner.classList.add("show"));
    }
  }

  check();
  // 1分ごとにチェック
  setInterval(check, 60 * 1000);
})();

// ---------- クリックでアコーディオン展開 ----------
(function () {
  const rows = document.querySelectorAll(".catalog-row");
  rows.forEach((row) => {
    const toggle = () => {
      const item = row.closest(".catalog-item");
      const wasOpen = item.classList.contains("is-open");

      // 他は閉じる
      document.querySelectorAll(".catalog-item.is-open").forEach((i) => {
        i.classList.remove("is-open");
        const r = i.querySelector(".catalog-row");
        if (r) r.setAttribute("aria-expanded", "false");
      });

      if (!wasOpen) {
        item.classList.add("is-open");
        row.setAttribute("aria-expanded", "true");
      }
    };

    row.addEventListener("click", toggle);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });

  // 詳細内のリンクはバブリングさせない（行のトグルと衝突しないように）
  document.querySelectorAll(".catalog-detail-link").forEach((a) => {
    a.addEventListener("click", (e) => e.stopPropagation());
  });
})();

// ---------- スクロールで順番にフェードイン ----------
(function () {
  const items = document.querySelectorAll(".catalog-item");
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach((i) => i.classList.add("is-visible"));
    return;
  }

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          obs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  items.forEach((i) => {
    obs.observe(i);
    // 入場アニメ完了後、ホバー用の素早いトランジションへ切り替え
    i.addEventListener(
      "transitionend",
      function handler(e) {
        if (e.propertyName === "opacity" && i.classList.contains("is-visible")) {
          i.classList.add("is-revealed");
          i.removeEventListener("transitionend", handler);
        }
      }
    );
  });
})();

