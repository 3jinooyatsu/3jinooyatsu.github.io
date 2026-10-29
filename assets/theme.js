// 時間帯（JST）ごとの配色。head で同期読み込みし、描画前に色を決めて色のちらつきを防ぐ
(function () {
  var SCHEDULE = [
    { from: 5, to: 9, id: "lime", label: "Lime", note: "朝" },
    { from: 9, to: 13, id: "cobalt", label: "Cobalt", note: "午前" },
    { from: 13, to: 16, id: "berry", label: "Berry", note: "おやつの時間" },
    { from: 16, to: 19, id: "mono", label: "Mono", note: "夕方" },
    { from: 19, to: 23, id: "indigo", label: "Indigo", note: "夜" },
    { from: 23, to: 5, id: "teal", label: "Teal", note: "深夜" },
  ];

  function slotAt(hour) {
    for (var i = 0; i < SCHEDULE.length; i++) {
      var s = SCHEDULE[i];
      var inSlot = s.from < s.to ? hour >= s.from && hour < s.to : hour >= s.from || hour < s.to;
      if (inSlot) return s;
    }
    return SCHEDULE[0];
  }

  function jstHour() {
    return new Date(Date.now() + 9 * 3600 * 1000).getUTCHours();
  }

  var root = document.documentElement;
  root.classList.add("js");

  var id = slotAt(jstHour()).id;
  if (id !== "indigo") root.dataset.theme = id;

  window.siteTheme = { SCHEDULE: SCHEDULE, slotAt: slotAt, jstHour: jstHour };

  // 再読み込みしたら、いつもページの先頭（FV）から表示する。
  // 「プロダクトを見る」などで URL に付いた #products や、ブラウザのスクロール位置の復元で途中に飛ばないように
  var nav = window.performance && performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
  if (nav && nav.type === "reload") {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    window.addEventListener("load", function () { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); });
  }
})();
