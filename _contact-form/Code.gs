/**
 * @OnlyCurrentDoc
 *
 * 3時のおやつ サイトのお問い合わせフォーム（開発・採用・会社、各アプリのサポート）の受け口。
 * サイトから届いた内容を、このスプレッドシートに記録し、メールで知らせ、Slack に通知する。
 *
 * 置き場所：記録用スプレッドシートの「拡張機能 → Apps Script」に貼り、ウェブアプリとして公開する（手順は README.md）。
 * 設定（Apps Script の「プロジェクトの設定 → スクリプト プロパティ」。変えるとすぐ反映され、再デプロイは不要）：
 *   SLACK_WEBHOOK_URL            Slack の Incoming Webhook の URL（ないときは Slack に送らない）
 *   SLACK_WEBHOOK_URL_RECRUIT    採用だけ別のチャンネルに送りたいとき（_DEVELOPMENT / _COMPANY / _APP も同じ）
 *   MAIL_TO                      通知メールの宛先（ないときは info@3jino-oyatsu.com）
 *   MAIL_TO_RECRUIT              採用だけ別の宛先にしたいとき（_DEVELOPMENT / _COMPANY / _APP も同じ）
 */

const DEFAULT_MAIL_TO = "info@3jino-oyatsu.com";
const TIME_ZONE = "Asia/Tokyo";

// サイトのフォーム（data-form-type）→ 記録するシート名と、通知での呼び名
const FORMS = {
  development: { sheet: "開発のご相談", label: "開発のご相談" },
  recruit: { sheet: "採用", label: "採用への応募・面談" },
  company: { sheet: "会社へのお問い合わせ", label: "会社へのお問い合わせ" },
  // 各アプリのサポートページ（どのアプリかは「アプリ」の列に入る）
  app: { sheet: "アプリのお問い合わせ", label: "アプリのお問い合わせ" },
};

// シートの左端に必ず置く列。「対応状況」はチームで書き換えて使う
const BASE_COLUMNS = ["受付日時", "対応状況"];

// 自動送信が続いたときに止める目安（10分間に受け付ける件数）
const LIMIT_PER_10MIN = 30;

// ブラウザで URL を開いたときの動作確認用
function doGet() {
  return json_({ ok: true, service: "3jino-oyatsu contact form" });
}

function doPost(e) {
  try {
    const data = JSON.parse((e && e.parameter && e.parameter.payload) || "{}");
    // 人には見えない欄（website）が埋まっているのは自動送信。受け付けたふりをして捨てる
    if (data.website) return json_({ ok: true });
    const entry = parse_(data);

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (overLimit_()) return json_({ ok: false, error: "busy" });
      // 記録や Slack が失敗しても、メールが届けば受け付けとする
      try {
        record_(entry);
      } catch (err) {
        console.error("スプレッドシートへの記録に失敗", err);
      }
    } finally {
      lock.releaseLock();
    }

    sendMail_(entry);
    try {
      notifySlack_(entry);
    } catch (err) {
      console.error("Slack への通知に失敗", err);
    }
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: "failed" });
  }
}

// ---------- 受け取った内容の確認 ----------
function parse_(data) {
  const type = String(data.form || "");
  if (!Object.prototype.hasOwnProperty.call(FORMS, type)) throw new Error(`知らないフォーム：${type}`);
  // お名前はアプリのサポートでは任意。返信先のメールアドレスは必ずいる
  const name = text_(data.name, 100);
  const email = text_(data.email, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("メールアドレスが正しくない");

  const fields = (Array.isArray(data.fields) ? data.fields : [])
    .slice(0, 40)
    .filter((f) => f && typeof f === "object")
    .map((f) => ({ label: text_(f.label, 60), value: text_(f.value, f.long ? 5000 : 500, Boolean(f.long)), long: Boolean(f.long) }))
    .filter((f) => f.label);
  const subject = text_(data.subject, 200) || `【${FORMS[type].label}】${name ? `${name}様` : email}`;
  return { type, name, email, subject, fields, at: new Date() };
}

// 文字列にして前後の空白を取り、長さをそろえる。1行の項目は改行もつぶす
function text_(value, max, multiline) {
  let s = String(value == null ? "" : value).replace(/\r\n?/g, "\n").trim();
  if (!multiline) s = s.replace(/\s+/g, " ");
  return s.slice(0, max);
}

function overLimit_() {
  const cache = CacheService.getScriptCache();
  const count = Number(cache.get("recent") || 0) + 1;
  cache.put("recent", String(count), 600);
  return count > LIMIT_PER_10MIN;
}

// ---------- スプレッドシートに1行追加（フォームごとのシート。項目が増えたら列も足す） ----------
function record_(entry) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const name = FORMS[entry.type].sheet;
  const sheet = book.getSheetByName(name) || book.insertSheet(name);

  const width = sheet.getLastColumn();
  const header = width ? sheet.getRange(1, 1, 1, width).getValues()[0].map(String) : [];
  const before = header.length;
  [...BASE_COLUMNS, ...entry.fields.map((f) => f.label)].forEach((label) => {
    if (!header.includes(label)) header.push(label);
  });
  if (header.length !== before) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  const values = { 受付日時: entry.at, 対応状況: "未対応" };
  // 先頭に「'」を付けて文字として入れる（「=」で始まる入力を数式にしない・電話番号の先頭の 0 を残す）
  entry.fields.forEach((f) => {
    values[f.label] = f.value ? `'${f.value}` : "";
  });
  sheet.appendRow(header.map((label) => (label in values ? values[label] : "")));
}

// ---------- メールで知らせる（返信すると、問い合わせた人に届く） ----------
function sendMail_(entry) {
  const lines = [];
  entry.fields.forEach((f) => {
    if (f.long) lines.push("", `${f.label}：`, f.value || "-", "");
    else lines.push(`${f.label}：${f.value || "-"}`);
  });
  const body = [
    `サイトの「${FORMS[entry.type].label}」フォームから届きました。`,
    `このメールに返信すると、${entry.name ? `${entry.name}様（${entry.email}）` : `${entry.email} `}あてに送られます。`,
    "",
    "――――――――――――――――",
    ...lines,
    "――――――――――――――――",
    `受付日時：${formatDate_(entry.at)}`,
  ].join("\n");

  MailApp.sendEmail({
    to: setting_("MAIL_TO", entry.type) || DEFAULT_MAIL_TO,
    subject: entry.subject,
    body,
    replyTo: entry.email,
    name: "3時のおやつ お問い合わせフォーム",
  });
}

// ---------- Slack に通知 ----------
function notifySlack_(entry) {
  const url = setting_("SLACK_WEBHOOK_URL", entry.type);
  if (!url) return;

  const filled = entry.fields.filter((f) => f.value);
  const short = filled.filter((f) => !f.long);
  const long = filled.filter((f) => f.long);
  const blocks = [{ type: "header", text: { type: "plain_text", text: clip_(entry.subject, 150) } }];
  for (let i = 0; i < short.length; i += 10) {
    blocks.push({
      type: "section",
      fields: short.slice(i, i + 10).map((f) => ({ type: "mrkdwn", text: `*${slack_(f.label)}*\n${clip_(slack_(f.value), 1900)}` })),
    });
  }
  long.forEach((f) => {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*${slack_(f.label)}*\n${clip_(slack_(f.value), 2800)}` } });
  });
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `${formatDate_(entry.at)} 受付　<${sheetUrl_(entry)}|スプレッドシートで見る>` }],
  });

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ text: `${FORMS[entry.type].label}：${entry.subject}`, blocks }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error(`Slack ${res.getResponseCode()}：${res.getContentText()}`);
}

function sheetUrl_(entry) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheetByName(FORMS[entry.type].sheet);
  return book.getUrl() + (sheet ? `#gid=${sheet.getSheetId()}` : "");
}

// ---------- 小物 ----------
// スクリプト プロパティ。MAIL_TO_RECRUIT のようにフォームごとの値があれば、そちらを使う
function setting_(key, type) {
  const props = PropertiesService.getScriptProperties();
  return (props.getProperty(`${key}_${type.toUpperCase()}`) || props.getProperty(key) || "").trim();
}

function formatDate_(date) {
  return Utilities.formatDate(date, TIME_ZONE, "yyyy/MM/dd HH:mm");
}

function clip_(s, max) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// Slack の書式で特別な意味を持つ記号を文字に戻す（<!channel> などで全員に通知されないように）
function slack_(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
