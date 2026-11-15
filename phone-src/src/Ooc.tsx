/* 괄호 밖 · OOC로 NPC의 폰 채우기
   단계별 OOC를 복사해 AI 채팅에 보내고, 돌아온 답(JSON)을 붙여넣으면 폰 데이터와 하루 타임라인이 채워진다. */
import { useMemo, useState } from "react";
import { appId } from "./appAlias";
import { useData, setData, getData, resetData, type PhoneData, type DayStep, type Thread, type Msg, type SafariTab } from "./store";
import { blankData, EX_OWNER } from "./data";
import { resetScene } from "./scene";
import { APPS } from "./apps";

const rid = () => Math.random().toString(36).slice(2, 10);
const S = (v: unknown, n = 400) => (typeof v === "string" ? v.slice(0, n) : typeof v === "number" ? String(v) : "");
const N = (v: unknown, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") as Record<string, unknown>[] : []);

/* ── AI 답에서 JSON 뽑기 (코드블록 · 앞뒤 잡담 · 끝 쉼표 · 안쪽 따옴표 · 문자열 속 줄바꿈 · 끊긴 답) ── */
function repair(s: string) {
  let o = "", inStr = false, bs = false, open = 0; const stack: string[] = [];
  const next = (i: number) => { for (let j = i + 1; j < s.length; j++) if (!/\s/.test(s[j])) return s[j]; return ""; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (bs) { bs = false; o += c; continue; }
      if (c === "\\") { bs = true; o += c; continue; }
      if (c === "\n" || c === "\r" || c === "\t") { o += " "; continue; }
      if (c === '"') { const n = next(i); if (n === "" || n === "," || n === ":" || n === "}" || n === "]") { inStr = false; o += c; } else o += open++ % 2 ? "”" : "“"; continue; }
      o += c; continue;
    }
    if (c === '"') { inStr = true; open = 0; o += c; continue; }
    if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if ((c === "}" || c === "]") && stack.length) stack.pop();
    o += c;
  }
  if (inStr) o += '"';
  if (stack.length) { o = o.replace(/,\s*"[^"]*"\s*:?\s*$/, "").replace(/:\s*$/, ': ""').replace(/,\s*$/, ""); o += stack.reverse().join(""); }
  return o.replace(/,\s*([}\]])/g, "$1");
}
function tryParse(s: string) {
  for (const f of [(x: string) => x, (x: string) => x.replace(/,\s*([}\]])/g, "$1"), (x: string) => repair(x), (x: string) => repair(x.replace(/[“”]/g, '"'))]) {
    try { const v = JSON.parse(f(s.trim())); if (v && typeof v === "object") return v as Record<string, unknown>; } catch { /* 다음 */ }
  }
  return null;
}
function scan(text: string) {
  const out: Record<string, unknown>[] = []; let depth = 0, start = -1, inStr = false, bs = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (bs) bs = false; else if (c === "\\") bs = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { if (depth > 0) inStr = true; continue; }
    if (c === "{") { if (depth === 0) start = i; depth++; }
    else if (c === "}" && depth > 0) { depth--; if (depth === 0) { const v = tryParse(text.slice(start, i + 1)); if (v) out.push(v); } }
  }
  /* 끝까지 안 닫힌 답(출력 끊김)은 열린 곳부터 고쳐서 살린다 */
  if (depth > 0 && start >= 0) { const v = tryParse(text.slice(start).replace(/`+\s*$/, "")); if (v) out.push(v); }
  return out;
}
function extract(raw: string) {
  /* AI 답의 줄표: 말이 끊기는 자리는 말줄임표로, 문장 사이는 쉼표로 */
  raw = raw.replace(/\s+[—–]+\s+/g, ", ").replace(/[—–]+/g, "…");
  const out: Record<string, unknown>[] = []; const re = /```[a-zA-Z]*\s*([\s\S]*?)```/g; let m;
  while ((m = re.exec(raw))) { const v = tryParse(m[1]); if (v) out.push(v); else out.push(...scan(m[1])); }
  if (!out.length) out.push(...scan(raw));
  return out;
}

/* ── JSON → 폰 데이터 ── */
const APPK = (v: unknown) => (v === "kakao" || v === "insta" ? v : "messages") as Thread["app"];
const KINDS = ["text", "photo", "deleted", "call", "date", "pay", "link"] as const;
function mapThread(t: Record<string, unknown>): Thread {
  const msgs: Msg[] = arr(t.messages).slice(0, 80).map((m) => {
    const kind = (KINDS as readonly string[]).includes(S(m.kind)) ? (S(m.kind) as Msg["kind"]) : "text";
    const from = m.from === "me" || m.from === "system" ? m.from : "them";
    return { id: rid(), from: kind === "date" ? "system" : from, text: S(m.text, 600), kind, ...(S(m.who) ? { who: S(m.who, 40) } : {}) } as Msg;
  });
  return { id: rid(), app: APPK(t.app), name: S(t.name, 40) || "이름 없음", unread: Math.max(0, Math.round(N(t.unread))), pinned: !!t.pinned, last: S(t.last, 20) || "어제", ...(N(t.members) > 2 ? { members: N(t.members) } : {}), ...(t.sms ? { sms: true } : {}), messages: msgs };
}
const PAGE_TYPES = ["search", "qna", "news", "blog", "wiki", "cafe", "board", "market"];
function mapTab(p: Record<string, unknown>): SafariTab {
  const type = PAGE_TYPES.includes(S(p.type)) ? S(p.type) : "search";
  const title = S(p.title, 80) || S(p.query, 80) || "페이지";
  let page: SafariTab["page"];
  if (type === "search") page = { type: "search", engine: p.engine === "google" ? "google" : "naver", query: S(p.query, 80) || title, results: arr(p.results).slice(0, 8).map((r) => ({ title: S(r.title, 120), url: S(r.url, 120), desc: S(r.desc, 240) })) };
  else if (type === "qna") page = { type: "qna", question: S(p.question, 160) || title, detail: S(p.detail, 800), asker: S(p.asker, 30) || "비공개", when: S(p.when, 20) || "1일 전", views: N(p.views, 120), answers: arr(p.answers).slice(0, 4).map((a) => ({ who: S(a.who, 30) || "답변자", text: S(a.text, 600) })) };
  else if (type === "news") page = { type: "news", press: S(p.press, 30) || "뉴스", title, body: S(p.body, 3000), reporter: S(p.reporter, 30) };
  else if (type === "blog") page = { type: "blog", category: S(p.category, 30), title, author: S(p.author, 30) || "블로거", when: S(p.when, 20), body: S(p.body, 3000), photo: "", likes: N(p.likes, 12), comments: arr(p.comments).slice(0, 6).map((c) => ({ who: S(c.who, 30), text: S(c.text, 300) })) };
  else page = { type: "qna", question: title, detail: S(p.body || p.detail, 800), asker: "비공개", when: "", views: 0, answers: [] };
  return { id: rid(), title, url: S(p.url, 120) || (type === "search" ? `m.search.naver.com` : "m.blog.naver.com"), page };
}
const DAY_ACTS = ["lock", "unlock", "home", "open", "banner", "alarm", "call", "end"];
/* 시각은 늘 HH:MM (7:05 · 7시 5분 · 오후 3:10 → 07:05 · 07:05 · 15:10) — 순서가 꼬이지 않게 */
function hhmm(t: string): string {
  const m = /(\d{1,2})\s*[:시]\s*(\d{1,2})?/.exec(t || "");
  if (!m) return "12:00";
  let h = +m[1] % 24; const mm = Math.min(59, +(m[2] || 0));
  if (/오후|pm/i.test(t) && h < 12) h += 12;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function typingOf(v: unknown): "fast" | "normal" | "slow" | null {
  const t = String(v ?? "").toLowerCase();
  if (/fast|빠|급|quick/.test(t)) return "fast";
  if (/slow|느|천천/.test(t)) return "slow";
  if (/normal|보통|중간/.test(t)) return "normal";
  return null;
}
function mapDay(v: unknown): DayStep[] {
  return arr(v).slice(0, 40).map((s) => {
    /* act 이름이 조금 달라도 맞춘다 (notification → banner 등) */
    const ACT_ALIAS: Record<string, string> = { notification: "banner", notify: "banner", noti: "banner", push: "banner", 알림: "banner", ring: "call", phone: "call", incoming: "call", 전화: "call", wake: "lock", 잠금: "lock", 해제: "unlock", sleep: "end", off: "end", 끝: "end", app: "open", 열기: "open", 알람: "alarm" };
    const a0 = S(s.act).toLowerCase();
    const act = (DAY_ACTS.includes(a0) ? a0 : ACT_ALIAS[a0] || "open") as DayStep["act"];
    const step: DayStep = { t: hhmm(S(s.t, 8)), act, say: S(s.say, 160), ...(S(s.inner) ? { inner: S(s.inner, 160) } : {}) };
    if (s.app) step.app = appId(S(s.app, 20)) || S(s.app, 20);
    if (s.thread) step.thread = S(s.thread, 40);
    if (s.tab != null) step.tab = Math.max(0, Math.round(N(s.tab)));
    if (s.note) step.note = S(s.note, 60);
    if (s.label) step.label = S(s.label, 40);
    if (s.do) step.do = S(s.do, 40);
    if (s.photo) step.photo = S(s.photo, 140);
    if (s.banner && typeof s.banner === "object") { const b = s.banner as Record<string, unknown>; step.banner = { app: appId(S(b.app, 20)) || "messages", title: S(b.title, 40), text: S(b.text, 160) }; }
    if (s.call && typeof s.call === "object") { const c = s.call as Record<string, unknown>; step.call = { name: S(c.name, 40), lines: (Array.isArray(c.lines) ? c.lines : []).map((x) => S(x, 160)).filter(Boolean).slice(0, 8), me: (Array.isArray(c.me) ? c.me : []).map((x) => S(x, 160)).filter(Boolean).slice(0, 8), talk: arr(c.talk).map((x) => ({ who: (/^(me|npc|나|a)$/i.test(S(x.who)) ? "me" : "them") as "me" | "them", text: S(x.text ?? x.line ?? x.say, 160) })).filter((x) => x.text).slice(0, 12) }; }
    /* 장면 종류 이름이 조금 달라도 맞춘다 */
    const KIND: Record<string, string> = { input: "type", write: "type", typein: "type", 입력: "type", 작성: "type", submit: "send", enter: "send", 전송: "send", 보내기: "send", pause: "wait", delay: "wait", sleep: "wait", 대기: "wait", message: "msg", receive: "msg", reply: "msg", incoming: "msg", 말풍선: "msg", 수신: "msg", delete: "unsend", recall: "unsend", 삭제: "unsend", 취소: "unsend", reaction: "react", like: "react", 반응: "react", image: "photo", picture: "photo", 사진: "photo", istyping: "typing", 입력중: "typing" };
    const sc = arr(s.scene).slice(0, 16).map((x) => {
      const k0 = S(x.kind || x.type).toLowerCase().replace(/[\s_-]/g, "");
      const k = KIND[k0] || k0;
      if (k === "type") return { kind: "type" as const, text: S(x.text, 120) };
      if (k === "send") return { kind: "send" as const };
      if (k === "wait") return { kind: "wait" as const, sec: Math.min(6, Math.max(0.2, N(x.sec, 1))) };
      if (k === "typing") return { kind: "typing" as const, sec: Math.min(8, Math.max(0.5, N(x.sec, 2))) };
      if (k === "unsend") return { kind: "unsend" as const };
      if (k === "react") return { kind: "react" as const, tap: ["heart", "like", "dislike", "haha", "emph", "q"].includes(S(x.tap)) ? S(x.tap) : "heart", from: (x.from === "me" ? "me" : "them") as "me" | "them" };
      if (k === "photo") return { kind: "photo" as const, text: S(x.text, 80) || "사진", from: (x.from === "me" ? "me" : "them") as "me" | "them" };
      return { kind: "msg" as const, text: S(x.text, 200), from: (x.from === "me" ? "me" : x.from === "system" ? "system" : "them") as "me" | "them" | "system", sec: Math.min(6, Math.max(0.2, N(x.sec, 1.2))) };
    }).filter((x) => (x.kind !== "msg" && x.kind !== "type") || ("text" in x && x.text));
    if (sc.length) step.scene = sc;
    return step;
  }).sort((a, b) => a.t.localeCompare(b.t));
}

/** 받은 JSON 하나를 폰 데이터에 반영. 반영한 항목 이름들을 돌려줌 */
function applyObj(d: PhoneData, o: Record<string, unknown>): string[] {
  const got: string[] = [];
  if (S(o.owner)) {
    d.owner = S(o.owner, 30);
    d.deviceName = S(o.deviceName, 40) || `${d.owner}의 iPhone`;
    // 암호: 4·6자리 숫자 / "" 또는 "없음"이면 암호 없이 밀어서 열림
    const pc = S(o.passcode).replace(/\s/g, "");
    d.passcode = /^\d{4}$|^\d{6}$/.test(pc) ? pc : "";
    d.passcodeHint = d.passcode ? S(o.passcodeHint, 60) : "";
    d.carrier = S(o.carrier, 10) || "SKT";
    d.battery = Math.min(100, Math.max(5, Math.round(N(o.battery, 64))));
    if (S(o.weatherCity)) d.weather = { ...d.weather, city: S(o.weatherCity, 20) };
    d.dayInfo = { ...(d.dayInfo || { title: "", date: "", summary: "" }), owner: d.owner, pc: S(o.pc, 30) } as PhoneData["dayInfo"];
    got.push("폰 주인");
  }
  /* 배경화면 */
  if (o.wallpaper && typeof o.wallpaper === "object") {
    const w = o.wallpaper as Record<string, unknown>;
    const colors = (Array.isArray(w.colors) ? w.colors : []).map((c) => S(c, 7)).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 3);
    d.wallpaper = { style: (["mesh", "gradient", "solid"].includes(S(w.style)) ? S(w.style) : "mesh") as "mesh", colors, desc: S(w.desc, 120) };
    got.push("배경화면");
  }
  /* 설치된 앱 · 홈 화면 배치 */
  if (Array.isArray(o.apps)) {
    const ok = (x: unknown) => typeof x === "string" && x in APPS;
    const dock = (Array.isArray(o.dock) ? o.dock : []).filter(ok).slice(0, 4) as string[];
    const folders: Record<string, string[]> = {};
    if (o.folders && typeof o.folders === "object") for (const [k, v] of Object.entries(o.folders as Record<string, unknown>)) {
      const list = (Array.isArray(v) ? v : []).filter(ok) as string[];
      if (k && list.length) folders[S(k, 12)] = list.slice(0, 12);
    }
    const inFolder = new Set(Object.values(folders).flat());
    const grid = (o.apps as unknown[]).filter(ok).filter((x) => !dock.includes(x as string) && !inFolder.has(x as string)) as string[];
    if (!grid.includes("settings") && !inFolder.has("settings")) grid.push("settings");
    d.home = { grid: [...grid.slice(0, 24), ...Object.keys(folders).map((f) => "folder:" + f)], dock: dock.length ? dock : ["phone", "messages", "safari", "music"], folders };
    got.push(`앱 ${grid.length + inFolder.size + dock.length}개`);
  }
  /* 계정: 카카오톡 · 인스타 · 넷플릭스 · X */
  const k = (o.kakao && typeof o.kakao === "object" ? o.kakao : null) as Record<string, unknown> | null;
  if (k || S(o.kakaoStatus)) d.kakaoProfile = { name: S(k?.name, 30), status: S(k?.status ?? o.kakaoStatus, 60) };
  const hideApp = (id: string) => { d.home.grid = d.home.grid.filter((x) => x !== id); d.home.dock = d.home.dock.filter((x) => x !== id); for (const f of Object.keys(d.home.folders)) d.home.folders[f] = d.home.folders[f].filter((x) => x !== id); };
  if (o.insta && typeof o.insta === "object") {
    const i = o.insta as Record<string, unknown>; const m = (i.me && typeof i.me === "object" ? i.me : i) as Record<string, unknown>;
    if (i.uses === false) hideApp("insta");
    else d.ig = { ...d.ig, me: { handle: S(m.handle, 30).replace(/^@/, "") || "user", name: S(m.name, 30), bio: S(m.bio, 150), posts: Math.max(0, Math.round(N(m.posts))), followers: Math.max(0, Math.round(N(m.followers))), following: Math.max(0, Math.round(N(m.following))), private: m.private !== false } };
    got.push("인스타 계정");
  }
  if (o.netflix && typeof o.netflix === "object") {
    const nf = o.netflix as Record<string, unknown>;
    if (nf.uses === false) hideApp("netflix"); else d.netflix = { ...d.netflix, profile: S(nf.profile, 20) || d.owner };
  }
  if (o.x && typeof o.x === "object") {
    const xx = o.x as Record<string, unknown>;
    if (xx.uses === false) hideApp("x"); else d.x = { ...d.x, name: S(xx.name, 30), handle: "@" + (S(xx.handle, 30).replace(/^@/, "") || "user") };
  }
  if (Array.isArray(o.contacts)) { d.contacts = arr(o.contacts).slice(0, 60).map((c) => ({ id: rid(), name: S(c.name, 40), phone: S(c.phone, 20) || "010-****-0000", label: S(c.label, 20) || "휴대전화", note: S(c.note, 200), fav: !!c.fav })); got.push(`연락처 ${d.contacts.length}명`); }
  if (Array.isArray(o.lockNotifs)) { d.lockNotifs = arr(o.lockNotifs).slice(0, 8).map((n) => ({ app: (["kakao", "messages", "insta", "phone", "bank"].includes(S(n.app)) ? S(n.app) : "messages") as PhoneData["lockNotifs"][number]["app"], title: S(n.title, 40), text: S(n.text, 160), when: S(n.when, 20) || "지금" })); got.push("잠금화면 알림"); }
  const upsert = (t: Thread) => { const i = d.threads.findIndex((x) => x.name === t.name && x.app === t.app); if (i >= 0) d.threads[i] = t; else d.threads.push(t); };
  if (o.pcThread && typeof o.pcThread === "object") { const t = mapThread(o.pcThread as Record<string, unknown>); t.pinned = true; d.threads = d.threads.filter((x) => !x.pinned); upsert(t); d.threads.sort((x, y) => Number(!!y.pinned) - Number(!!x.pinned)); resetScene(); got.push("PC와의 대화방"); }
  if (Array.isArray(o.threads)) { d.threads = d.threads.filter((x) => x.pinned); arr(o.threads).slice(0, 8).map(mapThread).forEach(upsert); resetScene(); got.push(`대화방 ${d.threads.length}개`); }
  if (Array.isArray(o.calls)) { d.calls = arr(o.calls).slice(0, 30).map((c) => ({ id: rid(), name: S(c.name, 40), kind: (c.kind === "in" || c.kind === "out" ? c.kind : "missed") as "in" | "out" | "missed", label: S(c.label, 20) || "휴대전화", when: S(c.when, 20) || "어제", ...(N(c.count) > 1 ? { count: N(c.count) } : {}), lines: (Array.isArray(c.lines) ? c.lines : []).map((x) => S(x, 200)).filter(Boolean).slice(0, 10) })); got.push("통화 기록"); }
  if (Array.isArray(o.notes)) { d.notes = arr(o.notes).slice(0, 30).map((n) => ({ id: rid(), folder: S(n.folder, 20) || "메모", title: S(n.title, 60), body: S(n.body, 4000) || S(n.title, 60), pinned: !!n.pinned, when: S(n.when, 20) || "어제" })); got.push("메모"); }
  if (Array.isArray(o.reminders)) { d.reminders = arr(o.reminders).slice(0, 30).map((r) => ({ id: rid(), text: S(r.text, 120), note: S(r.note, 200), due: S(r.due, 30), done: !!r.done, list: S(r.list, 20) || "미리 알림", ...(r.flag ? { flag: true } : {}) })); got.push("미리 알림"); }
  if (Array.isArray(o.alarms)) { d.alarms = arr(o.alarms).slice(0, 12).map((a) => ({ id: rid(), time: S(a.time, 5) || "07:00", label: S(a.label, 40) || "알람", on: a.on !== false })); got.push("알람"); }
  if (Array.isArray(o.calendar)) { d.calendar = arr(o.calendar).slice(0, 20).map((e, i) => ({ id: rid(), days: (Array.isArray(e.days) ? e.days : [5]).map((x) => Math.min(6, Math.max(0, Math.round(N(x))))), time: S(e.time, 5), title: S(e.title, 60), place: S(e.place, 40), color: ["#ff3b30", "#007aff", "#34c759", "#ff9500", "#af52de"][i % 5] })); got.push("캘린더"); }
  if (o.safari && typeof o.safari === "object") {
    const sf = o.safari as Record<string, unknown>;
    const tabs = arr(sf.tabs).slice(0, 8).map(mapTab);
    d.safari = { ...d.safari, tabs: tabs.length ? tabs : d.safari.tabs, history: (Array.isArray(sf.history) ? sf.history : []).map((x) => S(x, 80)).filter(Boolean).slice(0, 20) };
    got.push("사파리");
  }
  if (o.youtube && typeof o.youtube === "object") {
    const y = o.youtube as Record<string, unknown>;
    const vids = arr(y.history).slice(0, 12).map((v, i) => ({ id: rid(), title: S(v.title, 100), channel: S(v.channel, 40), views: S(v.views, 20) || "조회수 1.2만회", when: S(v.when, 20) || "1주 전", duration: S(v.duration, 8) || "12:04", hue: (i * 47) % 360, photo: "", progress: Math.min(1, Math.max(0, N(v.progress, 0.6))) }));
    d.youtube = { feed: vids.length ? vids : d.youtube.feed, history: vids, searches: (Array.isArray(y.searches) ? y.searches : []).map((x) => S(x, 60)).filter(Boolean).slice(0, 12) };
    got.push("유튜브");
  }
  if (Array.isArray(o.songs)) { d.songs = arr(o.songs).slice(0, 20).map((s, i) => ({ id: rid(), title: S(s.title, 80), artist: S(s.artist, 60), album: S(s.album, 60) || S(s.title, 80), url: "", hue: (i * 53) % 360 })); got.push("음악"); }
  if (o.bank && typeof o.bank === "object") {
    const b = o.bank as Record<string, unknown>;
    d.bank = { name: S(b.name, 20) || d.bank.name, account: S(b.account, 30) || d.bank.account, balance: Math.round(N(b.balance, d.bank.balance)), txs: arr(b.txs).slice(0, 30).map((t) => ({ id: rid(), when: S(t.when, 20), name: S(t.name, 40), amount: Math.round(N(t.amount)), memo: S(t.memo, 60) })) };
    got.push("은행");
  }
  /* 4단계: SNS · 생활 앱 안쪽 */
  if (o.instaFeed && typeof o.instaFeed === "object") {
    const f = o.instaFeed as Record<string, unknown>;
    const users = arr(f.following).slice(0, 12).map((u) => ({ handle: S(u.handle, 30).replace(/^@/, ""), name: S(u.name, 30), bio: S(u.bio, 150), posts: Math.round(N(u.posts, 40)), followers: Math.round(N(u.followers, 300)), following: Math.round(N(u.following, 200)), ...(u.private ? { private: true } : {}) })).filter((u) => u.handle);
    const BG = ["linear-gradient(160deg,#2a1d12,#0e0a06)", "linear-gradient(170deg,#101a2c,#2a3d5a)", "linear-gradient(160deg,#1c2a1f,#0b120d)", "linear-gradient(160deg,#2b1430,#0f0612)"];
    const items = arr(f.stories).slice(0, 10).map((s, i) => ({ id: rid(), user: S(s.user, 30).replace(/^@/, ""), text: S(s.text, 120), bg: BG[i % BG.length], when: S(s.when, 10) || "3시간", ...(s.box ? { style: "box" as const } : {}) }));
    d.ig = { ...d.ig, users: users.length ? users : d.ig.users, feed: arr(f.feed).slice(0, 12).map((p) => ({ id: rid(), user: S(p.user, 30).replace(/^@/, ""), caption: S(p.caption, 300), photo: "", likes: Math.round(N(p.likes, 20)), comments: Math.round(N(p.comments, 2)), when: S(p.when, 10) || "어제" })), stories: [...new Set(items.map((s) => s.user))], storyItems: items, notes: arr(f.notes).slice(0, 6).map((x) => ({ user: S(x.user, 30).replace(/^@/, ""), text: S(x.text, 60) })) };
    got.push("인스타 피드");
  }
  if (o.netflixList && typeof o.netflixList === "object") {
    const nl = o.netflixList as Record<string, unknown>;
    const mk = (v: Record<string, unknown>, i: number) => ({ id: rid(), title: S(v.title, 60), ep: S(v.ep, 30), progress: Math.min(1, Math.max(0, N(v.progress, 0.4))), hue: (i * 61) % 360, photo: "", desc: S(v.desc, 200), year: S(v.year, 4), eps: Math.round(N(v.eps, 8)) });
    d.netflix = { ...d.netflix, watching: arr(nl.watching).slice(0, 8).map(mk), myList: arr(nl.myList).slice(0, 8).map(mk) };
    got.push("넷플릭스");
  }
  if (Array.isArray(o.xFeed)) { d.x = { ...d.x, feed: arr(o.xFeed).slice(0, 12).map((p) => ({ id: rid(), name: S(p.name, 30), handle: "@" + S(p.handle, 30).replace(/^@/, ""), text: S(p.text, 280), when: S(p.when, 10) || "1시간", replies: Math.round(N(p.replies)), reposts: Math.round(N(p.reposts)), likes: Math.round(N(p.likes)), photo: "" })) }; got.push("X"); }
  if (Array.isArray(o.coupang)) { d.coupang = arr(o.coupang).slice(0, 12).map((p) => ({ id: rid(), name: S(p.name, 80), option: S(p.option, 60) || "1개", price: S(p.price, 20), when: S(p.when, 20), status: S(p.status, 10) || "배송완료", photo: "" })); got.push("쿠팡"); }
  if (Array.isArray(o.baemin)) { d.baemin = arr(o.baemin).slice(0, 12).map((p) => ({ id: rid(), store: S(p.store, 40), menu: S(p.menu, 80), price: S(p.price, 20), when: S(p.when, 20), status: S(p.status, 10) || "배달완료", photo: "" })); got.push("배달의민족"); }
  if (Array.isArray(o.kakaot)) { d.kakaot = arr(o.kakaot).slice(0, 12).map((p) => ({ id: rid(), kind: S(p.kind, 10) || "택시", from: S(p.from, 40), to: S(p.to, 40), when: S(p.when, 20), price: S(p.price, 20) })); got.push("카카오 T"); }
  if (Array.isArray(o.mail)) { d.mail = arr(o.mail).slice(0, 12).map((m) => ({ id: rid(), from: S(m.from, 40), addr: S(m.addr, 60) || "noreply@mail.example", subject: S(m.subject, 100), body: S(m.body, 2000), when: S(m.when, 20) || "어제", unread: !!m.unread, box: "inbox" as const })); got.push("메일"); }
  if (Array.isArray(o.photos) && o.photos.length) { d.photos = [...d.photos.filter((p) => p.src || p.asset), ...arr(o.photos).slice(0, 16).map((p) => ({ id: rid(), caption: S(p.caption || p.desc, 140), when: S(p.when, 20) || "오늘" }))]; got.push(`사진 ${o.photos.length}장`); }
  if (Array.isArray(o.wallet)) { d.wallet = arr(o.wallet).slice(0, 8).map((w, i) => ({ id: rid(), name: S(w.name, 30), sub: S(w.sub, 40), number: S(w.number, 30), color: ["#1C3D5A", "#5B6B3A", "#6B2737", "#2B2B2E"][i % 4] })); got.push("지갑"); }
  if (Array.isArray(o.voiceMemos)) { d.voiceMemos = arr(o.voiceMemos).slice(0, 10).map((v) => ({ id: rid(), title: S(v.title, 40) || "새로운 녹음", when: S(v.when, 20) || "어제", lines: (Array.isArray(v.lines) ? v.lines : []).map((x) => S(x, 200)).filter(Boolean).slice(0, 12) })); got.push("음성 메모"); }
  if (o.health && typeof o.health === "object") {
    const h = o.health as Record<string, unknown>;
    d.health = { ...d.health, move: Math.round(N(h.move, d.health.move)), moveGoal: Math.round(N(h.moveGoal, 400)), exercise: Math.round(N(h.exercise, 20)), stand: Math.round(N(h.stand, 8)), km: N(h.km, 5), sleep: S(h.sleep, 20) || d.health.sleep, heart: (Array.isArray(h.heart) ? h.heart : d.health.heart).map((x) => Math.round(N(x, 70))).slice(0, 24), peakAt: S(h.peakAt, 20) };
    got.push("건강");
  }
  if (o.screenTime && typeof o.screenTime === "object") {
    const st = o.screenTime as Record<string, unknown>;
    const hours = Array.isArray(st.hours) && st.hours.length === 24 ? st.hours.map((x) => Math.max(0, Math.round(N(x)))) : d.screenTime.hours;
    d.screenTime = { total: S(st.total, 20) || d.screenTime.total, hours, apps: arr(st.apps).slice(0, 6).map((a) => [S(a.name, 20), S(a.time, 20)] as [string, string]), pickups: Math.round(N(st.pickups, 80)), firstPickup: S(st.firstPickup, 20) };
    got.push("스크린 타임");
  }
  if (Array.isArray(o.dayMore)) { d.day = [...(d.day || []), ...mapDay(o.dayMore)].sort((x, y) => x.t.localeCompare(y.t)); got.push(`하루 타임라인 ${d.day.length}장면`); }
  if (Array.isArray(o.day)) {
    d.day = mapDay(o.day).sort((x, y) => x.t.localeCompare(y.t));
    for (const st of d.day) {
      const app = st.act === "open" ? (st.app && ["kakao", "messages", "insta"].includes(st.app) ? st.app : st.thread ? "kakao" : "") : st.act === "banner" && ["kakao", "messages", "insta"].includes(st.banner?.app || "") ? st.banner!.app! : "";
      const nm = st.act === "open" ? st.thread : st.banner?.title;
      if (!app || !nm) continue;
      if (st.act === "open" && !st.app) st.app = app;
      if (!d.threads.some((t) => t.app === app && (t.name === nm || t.name.includes(nm) || nm.includes(t.name)))) d.threads.push({ id: rid(), app: app as Thread["app"], name: nm, unread: 0, last: "", messages: [] });
    }
    d.dayInfo = { title: S(o.title, 60), date: S(o.date, 30), owner: d.owner || d.dayInfo?.owner || "", pc: d.dayInfo?.pc || S(o.pc, 30), summary: S(o.summary, 300), ...(typingOf(o.typing) ? { typing: typingOf(o.typing)! } : {}) };
    got.push(`하루 타임라인 ${d.day.length}장면`);
  }
  return got;
}

/* ── OOC 본문 ── */
const RULES = `원칙: 기존 설정·성격·말투·관계와 지금까지 RP에서 실제로 있었던 사건만 근거로 삼는다. 없는 설정(가족, 과거, 직업 세부)을 지어내지 않는다. 실제 주소·실명 기관 등 신상을 특정할 정보는 넣지 않는다. 말풍선 안에 시간 표기(오후 3:00 등)를 쓰지 않는다.`;
/* 메신저 말투: 대사가 아니라 진짜 사람이 폰으로 친 글처럼 */
const CHAT = `[메신저 말투 규칙] 대화방·알림·연출 속 모든 메시지는 진짜 사람이 폰으로 직접 친 글이다. 소설 대사나 대본처럼 쓰지 않는다.
- 말풍선 하나 = 한 번 전송. 한 덩어리로 길게 쓰지 않고, 생각나는 대로 짧게 끊어 여러 말풍선으로 보낸다.
- 문장 끝 온점(.)은 거의 찍지 않는다. 물음표·느낌표·물결(~)·말줄임(..)·쉼표는 그 사람 습관대로 자유롭게.
- 맞춤법·띄어쓰기는 캐릭터의 성격·나이·기분·상황을 따른다. 꼼꼼한 사람은 비교적 바르게, 대충 치는 사람은 붙여 쓰고 오타·줄임말도 그대로 둔다(ㅇㅇ ㅇㅋ ㄱㄱ ㄴㄴ ㅈㅅ 같은 초성, 됬어·몰겠다 같은 습관).
- 웃음·감정 표기(ㅋㅋ ㅎㅎ ㅠㅠ ㅜㅜ ;; ㅡㅡ ㄷㄷ)와 개수도 성격대로. 이모지·특수문자(♡ ~ !! ..)는 그 사람이 실제로 쓸 때만 쓴다. 무뚝뚝한 사람은 거의 안 쓴다.
- 같은 사람도 상대와 방에 따라 말투가 달라진다: PC에게, 친한 친구에게, 직장 단체방에서, 모르는 번호에게 각각 다르게. 존댓말·반말도 관계대로.
- 괄호 속 행동 묘사, 따옴표, 내레이션, 감정 설명은 넣지 않는다. 화면에 찍힌 글자만 쓴다.
- 은행·택배·인증번호·[Web발신] 같은 자동 문자는 실제 기관 문자 형식 그대로.
예) 무뚝뚝한 사람: "ㅇ" / "어디" / "늦으면 두고감"
예) 수다스럽고 다정한 사람: "헐 오늘 비온대ㅠㅠ" / "우산 챙겨요!!" / "진짜루 꼭"
예) 속마음을 숨기는 사람: "네" / "괜찮아요" / "아 그거 그냥요"`;
const APP_LIST = Object.keys(APPS).filter((k) => !k.startsWith("c:")).join(" ");
/* OOC 형식: 준비 신호 없이 한 번에 · NPC/PC · ▪ 항목 · 예시 값은 그대로 쓰지 않기 (로판AI 1,500자 안) */
const OUT = `▪ 품질: 클리셰 말고 이 사람만의 물건·장소·습관·말버릇으로 구체적으로, 줄표(—) 없이. 끊길 것 같으면 개수를 줄여서라도 JSON을 끝까지 닫는다.
▪ 출력: 설명 없이 JSON 코드 블록 하나만. 문자열 안 따옴표는 “ ”만, 줄바꿈 금지. 값은 형식 예시일 뿐.`;
const OUT2 = `▪ 품질·출력: 1/4과 같은 규칙(JSON 코드 블록 하나, 따옴표 “ ”, 끊길 것 같으면 개수를 줄여 끝까지 닫기, 값은 예시일 뿐).`;
const PROMPTS: { label: string; sub: string; text: string }[] = [
  {
    label: "폰 기본 · 앱 · 계정 · 연락처", sub: "말투 규칙 포함",
    text: `*[OOC: 롤플레잉 잠시 중단. 「NPC의 폰」 1/4 · 폰 기본. NPC의 실제 아이폰을 4번에 나눠 만든다.
▪ 근거(4번 내내): RP에 나온 일만. 없는 가족·과거·신상, PC의 말·속마음은 지어내지 않고, 여기서 만든 건 RP의 사실로 안 쓴다.
▪ 메신저 말투(4번 내내): 진짜 사람이 폰으로 친 글. 대사·지문·따옴표 금지, 짧게 끊어 여러 말풍선, 온점 거의 안 씀. 맞춤법·ㅋㅋ·ㅠㅠ·이모지·오타는 성격·나이·기분대로, 상대마다 다르게. 자동 문자는 실제 형식.
▪ passcode 4·6자리(뜻은 passcodeHint), 안 걸면 "" / wallpaper desc(무슨 사진인지 눈에 보이듯 한 문장)·colors 대표색 3개·style mesh|gradient|solid / apps 깔아 둔 앱 id만(${APP_LIST}) / dock 4개 / folders(안 쓰면 {}) / kakao 이름·상태메시지 / insta·netflix·x 안 쓰면 {"uses":false} / contacts 8~12명(저장명은 NPC가 부르는 호칭대로) / lockNotifs 2~3개
${OUT}
{"owner":"","pc":"","deviceName":"","passcode":"","passcodeHint":"","carrier":"","battery":0,"wallpaper":{"style":"","colors":[],"desc":""},"apps":[],"dock":[],"folders":{},"kakao":{"name":"","status":""},"insta":{"uses":true,"me":{"handle":"","name":"","bio":"","posts":0,"followers":0,"following":0,"private":true}},"netflix":{"uses":true,"profile":""},"x":{"uses":false,"name":"","handle":""},"contacts":[{"name":"","phone":"","note":"","fav":false}],"lockNotifs":[{"app":"kakao","title":"","text":"","when":"지금"}]}]*`,
  },
  {
    label: "대화방 전부", sub: "PC 방 + 다른 방 3~5개",
    text: `*[OOC: 「NPC의 폰」 2/4 · 대화방. 1/4의 근거·메신저 말투 그대로. 오늘 아침 이전까지의 대화만.
▪ pcThread: PC와 실제로 쓰는 방 하나(카톡 kakao, 문자 messages, 인스타DM insta), 메시지 12~20개
▪ threads: 그 밖의 방 3~5개(친구·직장 단체방·지인·자동 문자 등, 깐 앱만), 방마다 5~10개. 같은 NPC라도 방마다 말투가 달라야 한다.
▪ 방 이름(name)은 NPC 폰에 저장된 그대로, 4/4에서도 똑같이 쓴다.
▪ pcThread는 RP에서 실제로 오간 흐름이 이어지게, date 구분선 2~3개로 며칠에 걸쳐. 마지막 말이 누구 차례로 끝났는지가 관계를 보여 준다.
▪ 단체방은 members 3~6명(NPC식 저장명), 자동 문자(택배·카드 승인·인증번호)는 실제 형식 그대로. unread는 NPC가 안 읽고 둔 만큼.
▪ from me(NPC) them system / kind text, date(날짜 구분선, text에 "11월 13일 목요일"), deleted, photo(text에 사진 설명), call(text에 "음성통화 3:12") / 단체방은 members와 who / 초록 문자는 sms true
${OUT2}
{"pcThread":{"app":"","name":"","last":"어제","messages":[{"from":"","text":"","kind":"text"}]},"threads":[{"app":"","name":"","unread":0,"last":"","members":null,"sms":false,"messages":[{"from":"","who":"","text":"","kind":"text"}]}]}]*`,
  },
  {
    label: "앱 속 흔적 전부", sub: "통화 · 메모 · 검색 · SNS · 돈 · 건강",
    text: `*[OOC: 「NPC의 폰」 3/4 · 앱 속 흔적. 1/4의 근거 그대로. PC를 향한 마음은 검색어·메모·소비에. 안 깐 앱은 빈 배열.
▪ calls 5~8(받은 통화는 lines=상대 대사) / alarms 2~4 / reminders 3~5 / calendar 2~4(days 0일~6토) / notes 2~4(체크는 [ ] [x]) / safari.tabs 2(search는 query·results, qna는 question·detail·answers)·history 5~8 / bank txs(입금+ 출금-) / coupang·baemin·kakaot / wallet 2~3(카드·차 키) / photos 6~10(caption은 사진 속 장면 한 줄) / health(move·sleep·heart 16개·peakAt) / screenTime(hours 24개·apps) / songs 4~6
${OUT2}
{"calls":[{"name":"","kind":"missed","when":"","lines":[]}],"alarms":[{"time":"","label":""}],"reminders":[{"text":"","due":""}],"calendar":[{"title":"","days":[],"time":""}],"notes":[{"title":"","body":""}],"safari":{"tabs":[{"type":"search","query":"","results":[{"title":"","url":"","desc":""}]}],"history":[]},"youtube":{"history":[{"title":"","channel":""}]},"instaFeed":{"following":[{"handle":"","name":""}],"feed":[{"user":"","caption":""}],"stories":[{"user":"","text":""}]},"xFeed":[],"netflixList":{"watching":[{"title":"","ep":"","progress":0.5}]},"bank":{"name":"","balance":0,"txs":[{"when":"","name":"","amount":0}]},"coupang":[],"baemin":[],"kakaot":[],"wallet":[{"name":"","sub":""}],"photos":[{"caption":"","when":""}],"health":{"move":0,"sleep":"","heart":[],"peakAt":""},"screenTime":{"total":"","hours":[],"apps":[{"name":"","time":""}]},"songs":[{"title":"","artist":""}]}]*`,
  },
  {
    label: "하루 재생", sub: "장면 14~20개 · 이어지는 연출",
    text: `*[OOC: 「NPC의 폰」 4/4 · 하루 재생. 1/4의 근거·메신저 말투 그대로. 오늘 하루를 시간순 장면 14~20개로(lock 시작, end 끝).
▪ 1~3/4와 맞물리게: 방 이름·메모 제목 그대로, 여는 앱엔 3/4 내용이 있어야 한다. 화면은 lock·end에서만 꺼진다.
▪ act: lock unlock home open banner alarm call(전화 옴) end
▪ 메신저 banner 다음엔 그 방을 open해 답하고, 보낸 말이 다음 장면의 원인이 되게.
▪ banner: app·title(방 이름)·text / alarm: label / call: name·talk(4~8개 순서대로 주고받기, who them=상대 me=NPC, 말투 그대로)
▪ open: app은 1/4 apps id 그대로(꼭 적기), 대화방은 thread, safari는 tab(0부터), notes는 note, 사진을 찍으면 app camera·photo(장면 한 줄)
▪ say 화면 밖 행동 35자 / inner 속마음 35자(보낸 말과 다르게) / 폰 조작은 do에도(밝기 최저|밝기 최대|화면 끄기)
▪ typing: 성격대로 fast|normal|slow / type 글은 실제로 보낼 말
▪ scene(대화방 장면에): type(입력창에 침, 전 글 지워짐) send wait(sec) msg(from them) typing(상대 입력 중, 아이메시지만) unsend(보낸 말 취소) react(tap heart|like|haha, from) photo(text에 사진 설명). PC 방에선 썼다 지우거나 보냈다 취소하는 순간을 꼭.
${OUT2}
{"title":"","date":"11월 14일 금요일","summary":"","typing":"normal","day":[{"t":"07:00","act":"alarm","label":"","say":""},{"t":"07:01","act":"unlock","say":""},{"t":"07:30","act":"banner","banner":{"app":"kakao","title":"","text":""},"say":""},{"t":"07:31","act":"open","app":"kakao","thread":"","say":"","inner":"","scene":[{"kind":"type","text":""},{"kind":"send"},{"kind":"wait","sec":1.5},{"kind":"unsend"},{"kind":"type","text":""},{"kind":"send"}]},{"t":"18:00","act":"call","call":{"name":"","talk":[{"who":"them","text":""},{"who":"me","text":""}]},"say":""},{"t":"23:50","act":"end","say":""}]}]*`,
  },
];
/* 로판AI 1,500자 안에 맞추려고 AI가 읽는 데 지장 없는 띄어쓰기만 줄인다 */
const REF = "▪ 세계관 정보, PC와 NPC의 캐릭터 정보, 유저 노트, 두 사람의 관계성을 참고하여 서술한다.";
/* AI는 띄어쓰기 없이도 읽으니: 한글 사이·문장부호 둘레 공백을 뺀다 (따옴표 속 JSON 예시 값 · 영어 단어 사이는 그대로) */
const squeeze = (text: string) =>
  text
    .split(/("(?:[^"\\\n]|\\.)*")/)
    .map((seg, i) =>
      i % 2
        ? seg
        : seg
            .replace(/[ \t]+/g, " ")
            .replace(/ ?([▪/·,:|→=~()[\]{}「」『』]) ?/g, "$1")
            .replace(/ +\n/g, "\n"),
    )
    .join("");
for (const p of PROMPTS) { const i = p.text.indexOf("\n"); p.text = squeeze(p.text.slice(0, i + 1) + REF + "\n" + p.text.slice(i + 1)); }

export default function Ooc() {
  const d = useData();
  const [copied, setCopied] = useState<number[]>([]);
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const copy = async (i: number) => {
    const t = PROMPTS[i].text;
    try { await navigator.clipboard.writeText(t); } catch {
      const ta = document.createElement("textarea"); ta.value = t; document.body.append(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopied((c) => [...new Set([...c, i])]);
  };
  const apply = () => {
    setDone("");
    if (!raw.trim()) return setErr("AI 답변을 먼저 붙여넣어 주세요.");
    const objs = extract(raw);
    if (!objs.length) return setErr('결과 데이터를 찾지 못했어요. AI 답변에서 ``` 로 감싼 코드 블록까지 통째로 붙여넣어 주세요. 답이 중간에 끊겼다면 "이어서 출력해"라고 보내 보세요.');
    // 아직 예시 폰이거나 다른 사람의 폰 주인 답이 들어오면 비우고 새로 시작 (예시 내용이 섞이지 않게)
    let next = JSON.parse(JSON.stringify(getData())) as PhoneData;
    const newOwner = objs.map((o) => S(o.owner)).find(Boolean);
    if (next.owner === EX_OWNER || (newOwner && next.owner && newOwner !== next.owner)) { const b = blankData(); b.home = next.home; next = b; delete next.day; }
    const got = objs.flatMap((o) => applyObj(next, o));
    if (!got.length) return setErr("읽을 수 있는 항목이 없어요. 이 페이지의 OOC로 받은 답이 맞는지 확인해 주세요.");
    setData(next); resetScene();
    setErr(""); setRaw(""); setDone(`적용했어요 · ${got.join(", ")}`);
  };
  /* 붙여넣기 칸에 답이 있으면 적용하기 전에도 그 답을 넣었을 때의 체크를 바로 (복사본에만 넣어 봄) */
  const preview = useMemo(() => {
    if (!raw.trim()) return null;
    try {
      const objs = extract(raw);
      if (!objs.length) return null;
      let next = JSON.parse(JSON.stringify(getData())) as PhoneData;
      const newOwner = objs.map((o) => S(o.owner)).find(Boolean);
      if (next.owner === EX_OWNER || (newOwner && next.owner && newOwner !== next.owner)) { const b = blankData(); b.home = next.home; next = b; delete next.day; }
      return objs.flatMap((o) => applyObj(next, o)).length ? next : null;
    } catch { return null; }
  }, [raw]);
  /* 체크는 붙여넣은 답이 들어올 때만: 예시 폰(NPC)이면 전부 빈칸 */
  const v = preview || d;
  const mine = !!v.owner && v.owner !== EX_OWNER;
  const has = {
    owner: mine,
    threads: mine && v.threads.length > 0, notes: mine && v.notes.length > 0, day: mine && !!v.day?.length, wall: mine && !!v.wallpaper,
  };
  return (
    <div className="day-root">
      <header className="day-top">
        <a href="../" className="day-brand"><b></b>귀환의 블로그</a>
        <span className="day-crumb">NPC의 폰 · OOC로 채우기</span>
        <span className="day-sp" />
        <a href="#/" className="day-link">하루 재생 보기</a>
        <a href="#/phone" className="day-link">직접 둘러보기</a>
        <a href="#/editor" className="day-link quiet">세부 편집</a>
      </header>
      <main className="ooc-main">
        <section className="ooc-intro">
          <h1>NPC의 폰 만들기</h1>
          <p>OOC 1번부터 4번까지 차례로 보내고, 받은 답을 아래 칸에 붙여넣어요.</p>
          <p className="ooc-note">지금 폰 주인: <b>{d.owner || "없음"}</b>{d.owner === EX_OWNER ? " (예시)" : ""} · 대화방 {d.threads.length}개 · 타임라인 {d.day?.length || 0}장면</p>
        </section>
        <ol className="ooc-steps">
          {PROMPTS.map((p, i) => (
            <li key={i} className={copied.includes(i) ? "copied" : ""}>
              <span className="n">{i + 1}</span>
              <span className="l"><b>{p.label}</b><small><span className={p.text.length > 1500 ? "over" : ""}>{p.text.length}자</span> · {p.sub}</small></span>
              <button onClick={() => copy(i)}>{copied.includes(i) ? "복사됨" : "OOC 복사"}</button>
            </li>
          ))}
        </ol>
        <section className="ooc-paste">
          <label htmlFor="ooc-raw"><b>AI 답변 붙여넣기</b></label>
          <textarea id="ooc-raw" value={raw} onChange={(e) => { setRaw(e.target.value); setErr(""); }} className={err ? "err" : ""} placeholder="여기에 AI 답변을 그대로 붙여넣어 주세요" />
          {err ? <p className="ooc-err" role="alert">{err}</p> : null}
          {done ? <p className="ooc-ok" role="status">{done}</p> : null}
          <button className="ooc-apply" onClick={apply}>적용하기</button>
          <div className={`ooc-chips ${preview ? "live" : ""}`}>
            <span className={has.owner ? "ok" : ""}>폰 주인</span><span className={has.threads ? "ok" : ""}>대화방</span><span className={has.notes ? "ok" : ""}>앱 속 흔적</span><span className={has.wall ? "ok" : ""}>배경 · 앱</span><span className={has.day ? "ok" : ""}>하루 타임라인</span>
          {preview ? <p className="ooc-live">붙여넣은 답 미리 보기 · 적용하기를 누르면 들어가요</p> : null}
          </div>
        </section>
        <section className="ooc-reset">
          <button onClick={() => { if (confirm("지금 폰을 지우고 예시(NPC의 폰)로 되돌릴까요?")) { resetData(); resetScene(); setDone("예시 폰으로 되돌렸어요"); } }}>예시 폰으로 되돌리기</button>
        </section>
      </main>
    </div>
  );
}
