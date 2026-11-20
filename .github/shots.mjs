// 開発チームの手順（.github/workflows/claude-dev.yml）が使う、2つの確かめ。
//   node .github/shots.mjs links <ページ…>   変わったページの、サイトの中へのリンクと画像が、切れていないかを確かめる
//   node .github/shots.mjs shots <ページ…>   変わったページの写真を撮る（PC の幅とスマホの幅。代表が、見て確かめるため）
// ページは、リポジトリのいちばん上からの道すじ（index.html、news.html、about/index.html など）
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const [mode, ...pages] = process.argv.slice(2);
const root = process.cwd();

if (mode === "links") {
  // href と src のうち、サイトの中を指すものが、ファイルとしてあるかを見る（外のアドレス、ページの中の位置、メール、電話は見ない）
  const broken = [];
  for (const page of pages) {
    const html = readFileSync(join(root, page), "utf8");
    for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      const url = m[1].split("#")[0].split("?")[0];
      if (!url || /^(https?:|\/\/|mailto:|tel:|data:|javascript:)/i.test(m[1])) continue;
      const path = url.startsWith("/") ? join(root, url) : resolve(dirname(join(root, page)), url);
      const ok = existsSync(path) && (statSync(path).isFile() || existsSync(join(path, "index.html")));
      if (!ok) broken.push(`${page}：${m[1]}`);
    }
  }
  if (broken.length) {
    console.error(`リンクか画像が、切れています：\n${[...new Set(broken)].join("\n")}`);
    process.exit(1);
  }
  console.log(`リンクと画像を確かめました（${pages.length}ページ）`);
} else if (mode === "shots") {
  // playwright は、手順が PW_DIR に入れる（このリポジトリには、入れない）
  const { chromium } = createRequire(join(process.env.PW_DIR ?? root, "x.js"))("playwright");
  const base = process.env.SHOTS_BASE ?? "http://localhost:8080";
  const out = process.env.SHOTS_OUT ?? "/tmp/shots";
  mkdirSync(out, { recursive: true });
  const sizes = [{ name: "pc", width: 1280, height: 800 }, { name: "sp", width: 390, height: 844 }];
  const browser = await chromium.launch();
  let n = 0;
  for (const page of pages) {
    n += 1;
    const url = `${base}/${page.replace(/(^|\/)index\.html$/, "$1")}`;
    const label = page.replace(/\/?index\.html$/, "").replace(/\.html$/, "").replace(/\//g, "-") || "top";
    for (const size of sizes) {
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: "reduce", locale: "ja-JP" });
      const p = await context.newPage();
      try {
        await p.goto(url, { waitUntil: "load", timeout: 30000 });
        // スクロールすると出てくる部分を、全部出しておく（いちばん下まで送ってから、上に戻る）
        await p.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); }
          window.scrollTo(0, 0);
        });
        await p.addStyleTag({ content: "[data-reveal],[data-reveal] *{opacity:1!important;transform:none!important;transition:none!important;animation:none!important}" });
        await p.waitForTimeout(600);
        await p.screenshot({ path: join(out, `${n}-${label}-${size.name}.jpg`), type: "jpeg", quality: 70, fullPage: true });
        console.log(`撮りました：${label}（${size.name}）`);
      } catch (e) {
        console.error(`撮れませんでした：${label}（${size.name}）：${e.message}`);
      }
      await context.close();
    }
  }
  await browser.close();
} else {
  console.error("使い方：node .github/shots.mjs links|shots <ページ…>");
  process.exit(1);
}
