(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SVG_NS = "http://www.w3.org/2000/svg";

  // ---------- 時間帯で配色が変わる（割り当ては theme.js） ----------
  const { SCHEDULE, slotAt, jstHour } = window.siteTheme;
  const themeNameEls = document.querySelectorAll("[data-theme-name]");
  let currentTheme = root.dataset.theme || "indigo";
  let shiftTimer;

  const setTheme = (id, animate) => {
    if (id !== currentTheme) {
      if (animate && !reduceMotion) {
        root.classList.add("is-theme-shifting");
        clearTimeout(shiftTimer);
        shiftTimer = setTimeout(() => root.classList.remove("is-theme-shifting"), 1300);
      }
      if (id === "indigo") delete root.dataset.theme;
      else root.dataset.theme = id;
      currentTheme = id;
    }
    const slot = SCHEDULE.find((s) => s.id === id);
    themeNameEls.forEach((el) => (el.textContent = `${slot.label} — ${slot.note}`));
  };
  setTheme(currentTheme, false);
  setInterval(() => setTheme(slotAt(jstHour()).id, true), 30 * 1000);

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

  // ---------- お問い合わせフォーム：メールアプリで送信 ----------
  const contactForm = document.querySelector("[data-contact-form]");
  if (contactForm) {
    const status = contactForm.querySelector("[data-form-status]");
    const params = new URLSearchParams(location.search);

    const presetType = contactForm.querySelector(`input[name="type"][value="${CSS.escape(params.get("type") || "")}"]`);
    if (presetType) presetType.checked = true;
    const role = params.get("role");
    const topic = params.get("topic");
    if (role) contactForm.elements.message.value = `【応募職種】${role}\n\n`;
    else if (topic) contactForm.elements.message.value = `【ご希望】${topic}\n\n`;

    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!contactForm.checkValidity()) {
        status.dataset.state = "error";
        status.textContent = "未入力の必須項目があります。";
        contactForm.reportValidity();
        return;
      }

      const data = new FormData(contactForm);
      const typeLabel = contactForm.querySelector('input[name="type"]:checked').dataset.label;
      const body = [
        `お問い合わせ種別：${typeLabel}`,
        `会社名・団体名：${data.get("company") || "-"}`,
        `お名前：${data.get("name")}`,
        `メールアドレス：${data.get("email")}`,
        `電話番号：${data.get("phone") || "-"}`,
        "",
        "お問い合わせ内容：",
        data.get("message"),
      ].join("\n");
      const subject = `【お問い合わせ】${typeLabel}｜${data.get("name")}様`;
      const to = contactForm.dataset.to;

      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.dataset.state = "info";
      status.textContent = `メールアプリが開きます。内容を確認して送信してください。開かない場合は ${to} まで直接ご連絡ください。`;
    });
  }

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

  const darkZones = [...document.querySelectorAll(".sec--dark, .gf, .rhero, .rentry")];
  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
    const probe = header.offsetHeight / 2;
    const overDark = darkZones.some((el) => {
      const r = el.getBoundingClientRect();
      return r.top <= probe && r.bottom >= probe;
    });
    header.classList.toggle("is-dark", overDark);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const setMenu = (open) => {
    header.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    document.body.style.overflow = open ? "hidden" : "";
  };
  toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  header.querySelectorAll(".gh-nav a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenu(false);
  });
})();
