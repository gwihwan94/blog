/* 괄호 밖 · NPC의 하루 재생
   왼쪽: 실제 아이폰 화면(Phone embedded) / 오른쪽: 시간표. 재생하면 시간이 흐르며 폰이 저절로 움직인다. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Phone from "./Phone";
import { useData, update, getData, type DayStep, type PhoneData, type SceneStep } from "./store";
import { sceneInfo, dayClear, dayPush, dayHas, restartScene } from "./scene";
import { setRobot, screenEl, onScreen, centerOf, tap, swipe, until, hideFinger, readScroll } from "./robot";
import { AppIcon } from "./icons";
import { APPS } from "./apps";
import { appOf } from "./appAlias";

const toMin = (t: string) => { const m = /(\d{1,2})\s*:\s*(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : 0; };
const ko = (t: string) => { const m = toMin(t); const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0"); return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${mm}`; };
const W = window as unknown as { __phoneClock?: () => Date; __lastPreview?: unknown };
const W_ = window as unknown as { __phoneState?: unknown };
type PState = { app?: string | null; arg?: unknown; phase?: string; off?: boolean; cc?: boolean; bright?: number; call?: boolean; ringing?: boolean; alarm?: boolean };
const FACE = window as unknown as { __faceOk?: boolean };

const ACT_APP: Record<string, string> = { lock: "lock", unlock: "lock", home: "home", banner: "", alarm: "clock", call: "phone", end: "lock" };
function stepApp(s: DayStep) { return s.act === "open" ? appOf(s) : s.act === "banner" ? s.banner?.app || "messages" : ACT_APP[s.act] || "home"; }
function stepLabel(s: DayStep) {
  if (s.act === "open") return (APPS[appOf(s)]?.label || "앱") + (s.thread ? ` · ${s.thread}` : s.note ? ` · ${s.note}` : "");
  return { lock: "잠금 화면", unlock: "잠금 해제", home: "홈 화면", banner: "알림", alarm: "알람", call: "전화 수신", end: "화면 끔" }[s.act] || "";
}
function findThread(d: PhoneData, s: DayStep) {
  if (!s.thread) return null;
  const ap = appOf(s);
  const want = ap === "messages" || ap === "kakao" || ap === "insta" ? ap : null;
  return d.threads.find((t) => t.name === s.thread && (!want || t.app === want)) || d.threads.find((t) => t.name.includes(s.thread!) && (!want || t.app === want)) || null;
}

function fire(detail: Record<string, unknown>) {
  const cmd = ["banner", "call", "goHome", "bright", "off", "cc", "alarm", "shutter"].some((k) => k in detail) || detail.phase === "code";
  if (!cmd) W.__lastPreview = detail;
  window.dispatchEvent(new CustomEvent("phone:open", { detail }));
}

export default function Day() {
  const d = useData();
  /* 대화방 연출을 넣느라 데이터가 바뀌어도 타임라인 내용이 같으면 그대로 (처음으로 돌아가지 않게) */
  const dayKey = JSON.stringify(d.day ?? []);
  const steps = useMemo<DayStep[]>(() => JSON.parse(dayKey), [dayKey]);
  const info = d.dayInfo ?? { title: "", date: "", owner: d.owner || "NPC", pc: "", summary: "" };
  const [k, setK] = useState(-1); // 지금 장면 (-1: 시작 전)
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const token = useRef(0);
  const viaBanner = useRef(-1);
  const clock = useRef<Date>(new Date());
  const listRef = useRef<HTMLOListElement>(null);
  const [scale, setScale] = useState(0.8);
  const [wide, setWide] = useState(true);

  /* 폰 크기: 화면 높이에 맞춤 */
  useEffect(() => {
    const f = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const isWide = w >= 900;
      setWide(isWide);
      setScale(isWide ? Math.min(0.92, (h - 120) / 892) : Math.min(0.86, (w - 40) / 433));
    };
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  /* 상태바 시계 = 타임라인 시각 */
  /* 이야기 속 날짜("11월 14일 금요일")와 요일이 맞는 해를 찾아 잠금화면 날짜로 쓴다 */
  const storyDate = useMemo(() => {
    const m = /(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*\(?([일월화수목금토])요?일?\)?)?/.exec(info.date || "");
    if (!m) return null;
    const mo = +m[1] - 1, dd = +m[2], want = m[3] ? "일월화수목금토".indexOf(m[3]) : -1;
    const y0 = new Date().getFullYear();
    for (let y = y0; y > y0 - 12; y--) { const x = new Date(y, mo, dd); if (want < 0 || x.getDay() === want) return x; }
    return new Date(y0, mo, dd);
  }, [info.date]);
  const setClock = useCallback((t: string) => {
    const m = toMin(t), dt = storyDate ? new Date(storyDate) : new Date();
    dt.setHours(Math.floor(m / 60), m % 60, 0, 0);
    clock.current = dt;
    window.dispatchEvent(new Event("phone:clock"));
  }, [storyDate]);
  useEffect(() => {
    W.__phoneClock = () => clock.current;
    setClock(steps[0]?.t || "07:00");
    fire({ phase: "lock" });
    return () => { delete W.__phoneClock; };
  }, [steps, setClock]);

  const sleep = (ms: number, tok: number) => new Promise<boolean>((r) => setTimeout(() => r(tok === token.current), ms));

  /* 한 장면 실행: 앞뒤 장면을 보고 이어지게 (알림을 누르고 들어가기 · 홈을 거쳐 열기 · 빠진 내용 채우기) */
  const runStep = useCallback(async (i: number, tok: number, sp: number) => {
    const s = steps[i], prev = steps[i - 1], next = steps[i + 1];
    setClock(s.t);
    setRobot(sp, () => tok === token.current);
    const W = (sec: number) => sleep((sec * 1000) / sp, tok);
    const dwell = s.sec ?? ({ lock: 3.5, unlock: 2.4, home: 2.4, open: 6.5, banner: 4.5, alarm: 4.5, call: 7, end: 3.5 } as Record<string, number>)[s.act] ?? 5;
    const ps = () => (W_.__phoneState || {}) as PState;
    const scr = () => screenEl();
    const ok = () => tok === token.current;

    /* 화면 켜기 · 잠금 풀기(밀어 올리기 → Face ID 실패 → 암호를 손가락으로) */
    const wake = async () => { if (ps().off) { fire({ off: false }); fire({ phase: "lock" }); return W(0.6); } return true; };
    const unlockPhone = async () => {
      if (!(await wake())) return false;
      if (ps().phase === "home") return true;
      if (ps().phase === "lock") { if (!(await swipe([196, 812], [196, 430], 380))) return false; hideFinger(); }
      const code = getData().passcode || "";
      if (code && !FACE.__faceOk) {
        const key = (ch: string) => [...(scr()?.querySelectorAll("button") || [])].find((b) => b.className.includes("w-[78px]") && b.querySelector("span")?.textContent === ch);
        if (!(await until(() => key("1"), 3500))) { if (!ok()) return false; fire({}); }
        for (const ch of code) { const b = key(ch); if (b && !(await tap(b))) return false; }
      }
      if (!(await until(() => ps().phase === "home", 2500))) { if (!ok()) return false; fire({}); }
      FACE.__faceOk = true;
      hideFinger();
      return W(0.5);
    };
    /* 홈으로: 아래 막대를 밀어 올리면 앱이 아이콘 자리로 */
    const goHome = async () => {
      if (!ps().app) return true;
      if (!(await swipe([196, 846], [196, 600], 300, { events: false }))) return false;
      hideFinger();
      fire({ goHome: true });
      return W(0.55);
    };
    /* 홈 화면에서 아이콘 찾아 누르기 (다른 페이지면 넘기고, 폴더 안이면 폴더부터) */
    const tapIcon = async (app: string) => {
      const find = () => [...(scr()?.querySelectorAll(`[data-app="${app}"]`) || [])].find((e) => onScreen(e)) || null;
      let el = find();
      for (let p = 0; !el && p < 3; p++) {
        const folder = [...(scr()?.querySelectorAll<HTMLElement>("[data-folder]") || [])].find((f) => onScreen(f) && (f.dataset.apps || "").split(" ").includes(app));
        if (folder) { if (!(await tap(folder))) return false; if (!(await W(0.45))) return false; el = find(); break; }
        if (!scr()?.querySelector(`[data-app="${app}"]`) && !scr()?.querySelector("[data-folder]")) break;
        if (!(await swipe([330, 500], [70, 500], 340))) return false;
        if (!(await W(0.45))) return false;
        el = find();
      }
      if (el) { if (!(await tap(el))) return false; }
      else fire({ app });
      hideFinger();
      await until(() => ps().app === app, 1500);
      return ok();
    };
    /* 앱 안에서 대화방 · 메모 줄을 눌러 들어가기 (못 찾으면 바로 열기) */
    const rowOf = (name: string) => {
      const appEl = [...(scr()?.querySelectorAll<HTMLElement>(".app-open") || [])].pop() ?? scr();
      const cands = [...(appEl?.querySelectorAll<HTMLElement>("span, div, b, p") || [])].filter((e) => e.childElementCount === 0 && e.textContent?.trim() === name && e.getBoundingClientRect().height > 0);
      return (cands[0]?.closest("button, [role=button], li") as HTMLElement | null) ?? cands[0] ?? null;
    };
    /* 누르기 전에: 맨 아래(탭 막대·홈 막대)나 위쪽 가장자리에 걸치면 화면 가운데로 굴려 놓는다 */
    const toSafe = async (el: HTMLElement) => {
      const y = centerOf(el)[1];
      if (y > 130 && y < 720 && onScreen(el)) return true;
      /* 페이지는 건드리지 않고 그 목록(스크롤 칸)만 굴린다 */
      let p = el.parentElement;
      while (p && p !== scr() && !(/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight)) p = p.parentElement;
      if (p && p !== scr()) { const pr = p.getBoundingClientRect(), er = el.getBoundingClientRect(); p.scrollBy({ top: er.top + er.height / 2 - (pr.top + pr.height / 2), behavior: "smooth" }); }
      return W(0.55);
    };
    const tapRow = async (name: string, inside: () => boolean, fallback: Record<string, unknown>, via: string[] = []) => {
      if (inside()) return true;
      if (!(await W(0.5))) return false;
      /* 앱이 아이콘에서 커지는 중이면 다 열릴 때까지 기다렸다가 누른다 */
      await until(() => { const el = [...(scr()?.querySelectorAll<HTMLElement>(".app-open") || [])].pop(); return !el || getComputedStyle(el).transform === "none"; }, 1500);
      let row = rowOf(name);
      /* 목록 안쪽에 있으면 (메모 앱: 폴더 → 메모) 한 단계 먼저 들어간다 */
      for (const v of via) {
        if (row) break;
        const f = rowOf(v);
        if (f) { if (!(await toSafe(f))) return false; if (!(await tap(f))) return false; hideFinger(); if (!(await W(0.6))) return false; row = rowOf(name); }
      }
      if (row) { if (!(await toSafe(row))) return false; if (!(await tap(row))) return false; hideFinger(); }
      if (!(await until(inside, 1200))) { if (!ok()) return false; fire(fallback); await W(0.4); }
      return ok();
    };
    /* 폰 조작: 밝기 · 화면 끄기 · 읽으며 스크롤 */
    const doText = `${s.do || ""} ${s.say}`;
    const wantBright = /밝기/.test(doText) ? (/(낮|최저|어둡|줄|내리|내린)/.test(doText) ? 0.3 : /(올|최대|밝게|높)/.test(doText) ? 1 : null) : null;
    const brightness = async (v: number) => {
      if (!(await swipe([372, 6], [372, 250], 320))) return false;
      hideFinger();
      if (!(await until(() => ps().cc, 400)) && ok()) fire({ cc: true });
      if (!(await until(() => scr()?.querySelector("[data-cc=bright]"), 1500))) return ok();
      if (!(await W(0.5))) return false;
      const sl = scr()!.querySelector<HTMLElement>("[data-cc=bright]")!;
      const [cx, cy] = centerOf(sl);
      const h = sl.getBoundingClientRect().height / (scr()!.getBoundingClientRect().width / 393);
      const cur = ps().bright ?? 1;
      const top = cy - h / 2 + 5, bot = cy + h / 2 - 5;
      const y0 = Math.max(top, Math.min(bot, cy + h / 2 - cur * h)), y1 = Math.max(top, Math.min(bot, cy + h / 2 - v * h));
      if (!(await swipe([cx, y0], [cx, y1], 900))) return false;
      fire({ bright: v });
      if (!(await W(0.9))) return false;
      if (!(await swipe([196, 760], [196, 420], 300, { events: false }))) return false;
      hideFinger();
      fire({ cc: false });
      return W(0.5);
    };
    const screenOff = async () => { fire({ phase: "lock" }); if (!(await W(0.6))) return false; fire({ off: true }); return true; };

    hideFinger();
    if (s.act === "lock" || s.act === "end") {
      const st = ps();
      if (s.act === "end" || /(화면\s*(을|도)?\s*(끄|꺼|끈)|던져|덮어|엎어|주머니|가방에)/.test(doText) || (st.phase === "home" && !st.off)) {
        if (st.phase === "home" && !st.off) { if (!(await screenOff())) return false; }
        else fire({ off: true });
        return W(dwell);
      }
      if (!(await wake())) return false;
      fire({ phase: "lock" });
      return W(dwell);
    }
    if (s.act === "unlock") {
      if (!(await unlockPhone())) return false;
      if (wantBright !== null && !(await brightness(wantBright))) return false;
      return W(Math.max(1, dwell - 1.5));
    }
    if (s.act === "home") {
      if (!(await unlockPhone())) return false;
      if (!(await goHome())) return false;
      if (/(주머니|가방에|화면\s*(을|도)?\s*(끄|꺼|끈)|던져)/.test(doText)) { if (!(await W(1.6))) return false; if (!(await screenOff())) return false; }
      return W(dwell);
    }
    if (s.act === "alarm" || (s.act === "banner" && !s.banner?.title && !s.banner?.text && /알람|알림음|타이머/.test(s.say))) {
      if (!(await wake())) return false;
      fire({ alarm: { label: s.label || s.banner?.text || "알람" } });
      if (!(await W(/(잽싸|바로|곧바로|울리자마자|즉시)/.test(doText) ? 1.4 : 2.6))) return false;
      const which = /(다시 알림|스누즈|5분만|조금만 더)/.test(doText) ? "snooze" : "stop";
      const b = scr()?.querySelector(`[data-alarm=${which}]`);
      if (b) { if (!(await tap(b))) return false; hideFinger(); } else fire({ alarm: false });
      if (!(await W(0.6))) return false;
      if (wantBright !== null && !(await brightness(wantBright))) return false;
      if (/(화면\s*(을|도)?\s*(끄|꺼|끈)|엎어|덮어|던져)/.test(doText) && ps().phase !== "home") { if (!(await W(0.6))) return false; fire({ off: true }); }
      return W(Math.max(1.2, dwell * 0.4));
    }
    if (s.act === "banner") {
      /* 알림 내용이 빠졌으면 바로 다음에 여는 방에서 가져온다 */
      let b = s.banner;
      if (!b?.title && !b?.text) {
        const nth = next?.act === "open" ? next : null;
        const firstMsg = nth?.scene?.find((x) => x.kind === "msg");
        b = { app: nth?.app || "messages", title: nth?.thread || "알림", text: (firstMsg && "text" in firstMsg ? firstMsg.text : "") || "새 메시지" };
      }
      if (!(await wake())) return false;
      const bth = b && ["kakao", "messages", "insta"].includes(b.app || "") ? getData().threads.find((t) => t.app === b!.app && (t.name === b!.title || t.name.includes(b!.title) || b!.title.includes(t.name))) : undefined;
      if (bth && b?.text) dayPush(bth.id, { id: "day-" + i, from: "them", text: b.text }, 1);
      fire({ banner: { ...b, sec: dwell / sp } });
      if (!(await W(Math.min(2.6, dwell * 0.6)))) return false;
      /* 다음 장면에서 그 앱을 연다면: 잠금이 풀려 있으면 알림을 손가락으로 눌러 들어간다 */
      const st = ps();
      if (next?.act === "open" && next.app === (b?.app || next.app) && st.phase === "lock") {
        const el = scr()?.querySelector(".banner");
        if (el && onScreen(el)) {
          if (!(await tap(el, { click: false }))) return false;
          hideFinger();
          viaBanner.current = i + 1;
          fire({ phase: "code" });
          if (!(await until(() => ps().phase === "code" || ps().phase === "home", 800))) return ok();
          if (!FACE.__faceOk) return W(0.4);
          await until(() => ps().phase === "home", 2500);
          return W(0.3);
        }
      }
      if (next?.act === "open" && next.app === (b?.app || next.app) && st.phase === "home" && !st.off) {
        const el = scr()?.querySelector(".banner");
        if (el && onScreen(el)) { if (!(await tap(el))) return false; hideFinger(); await until(() => ps().app === next.app, 1200); }
      }
      return W(Math.max(0.6, dwell * 0.4));
    }
    if (s.act === "call") {
      const c = s.call?.name ? s.call : { name: s.call?.name || getData().contacts.find((x) => x.fav)?.name || "알 수 없음", lines: s.call?.lines?.length ? s.call.lines : [] };
      if (!(await wake())) return false;
      fire({ call: c });
      if (!(await W(2.2))) return false;
      const decline = /(거절|무시|안 받|씹)/.test(doText);
      const btn = scr()?.querySelector(`[data-call=${decline ? "decline" : "accept"}]`);
      if (btn && !(await tap(btn))) return false;
      hideFinger();
      if (decline) { fire({ call: false }); return W(1.5); }
      if (!(await until(() => scr()?.querySelector("[data-call-done]"), 90000))) return ok();
      if (!(await W(1.2))) return false;
      const end = scr()?.querySelector("[data-call=end]");
      if (end) { if (!(await tap(end))) return false; hideFinger(); if (!(await W(1.5))) return false; }
      fire({ call: false });
      return W(0.6);
    }

    /* 앱 열기: 잠금 → 풀기, 다른 앱 → 홈으로 → 아이콘 → 그 방/메모 줄을 눌러 들어감 */
    const th = findThread(getData(), s);
    /* 바로 앞(또는 그 앞) 알림으로 온 메시지는 그 방에도 말풍선으로 들어와 있어야 한다 */
    let scene: SceneStep[] = s.scene ? [...s.scene] : [];
    if (th) {
      const recent = [prev, steps[i - 2]].filter((x): x is DayStep => !!x && x.act === "banner" && !!x.banner?.text && !!x.banner.title && (x.banner.title === th.name || th.name.includes(x.banner.title) || x.banner.title.includes(th.name)));
      for (const bnr of recent.reverse()) {
        const txt = bnr.banner!.text;
        if (!th.messages.some((m) => m.text === txt) && !dayHas(th.id, txt) && !scene.some((x) => x.kind === "msg" && x.text === txt)) scene = [{ kind: "msg", text: txt, from: "them", sec: 1.1 }, ...scene];
      }
    }
    if (th && scene.length) {
      /* 타자 속도: NPC 성격(하루 정보의 typing)에 맞춰 */
      const ms = ({ fast: 80, normal: 140, slow: 230 } as Record<string, number>)[info.typing || ""] ?? 140;
      scene = scene.map((x) => (x.kind === "type" && !x.ms ? { ...x, ms } : x));
      update((x) => { const t = x.threads.find((y) => y.id === th.id); if (t) t.scene = scene; });
      restartScene(th.id);
    }
    if (!(await unlockPhone())) return false;
    if (wantBright !== null && !(await brightness(wantBright))) return false;
    const app0 = appOf(s);
    /* 사진을 찍는 장면: 카메라로 찍고 → 사진 앱에서 그 사진을 연다 */
    const shoot = !!s.photo && (app0 === "camera" || /(찍|촬영|셔터|몰래|담는|담아|카메라)/.test(doText + (s.inner || "")));
    const app = app0 === "camera" && s.photo ? "photos" : app0;
    const photoId = s.photo ? "day-photo-" + s.t.replace(/\D/g, "") : "";
    if (shoot && APPS.camera) {
      if (ps().app !== "camera") { if (!(await goHome())) return false; if (!(await tapIcon("camera"))) return false; }
      if (!(await W(1.4))) return false;
      if (!(await tap([196, 742], { click: false }))) return false;
      hideFinger();
      fire({ shutter: true });
      if (!(await W(0.9))) return false;
    }
    if (s.photo && !getData().photos.some((p) => p.id === photoId)) update((x) => { x.photos.push({ id: photoId, caption: s.photo!, when: "오늘 " + s.t }); });
    if (viaBanner.current === i && th) {
      viaBanner.current = -1;
      fire({ app, arg: th.id });
      if (!(await W(0.6))) return false;
    } else if (ps().app !== app) {
      if (!(await goHome())) return false;
      if (!(await tapIcon(app))) return false;
    }
    const note = app === "notes" && s.note ? getData().notes.find((x) => x.title === s.note || x.title.includes(s.note!)) : undefined;
    const roomOpen = () => !!scr()?.querySelector("textarea");
    if (th) { if (!(await tapRow(th.name, roomOpen, { app, arg: th.id }))) return false; }
    else if (note) { if (!(await tapRow(note.title, () => !!scr()?.querySelector("[contenteditable], textarea"), { app, arg: note.id }, ["메모", "모든 iCloud", "iCloud"]))) return false; }
    else if (app === "safari" && s.tab) { fire({ app, arg: s.tab }); if (!(await W(0.6))) return false; }
    if (th && scene.length) {
      const t0 = Date.now();
      while (!sceneInfo(th.id)?.done && Date.now() - t0 < 90000) { if (!(await sleep(200, tok))) return false; }
      const lastTxt = [...scene].reverse().find((x) => "text" in x && x.text) as { text?: string } | undefined;
      return W(Math.max(2.8, 1.6 + (lastTxt?.text?.length || 0) * 0.07));
    }
    /* 사진 앱: 방금(또는 말한) 사진을 눌러 크게 본다 */
    if (app === "photos" && s.photo) {
      if (!(await W(0.8))) return false;
      const cells = [...(scr()?.querySelectorAll<HTMLElement>(".app-open [role=img], .app-open img") || [])].filter((e) => onScreen(e) && e.closest("button"));
      const cell = cells.find((e) => e.getAttribute("aria-label") === s.photo) || cells[cells.length - 1];
      if (cell) { if (!(await tap(cell))) return false; hideFinger(); }
      return W(Math.max(3.5, dwell - 1));
    }
    /* 대화가 아닌 앱(메모 · 사파리 · 미리 알림 …): 손가락으로 천천히 내려 읽기 */
    if (!th) return readScroll(scr(), dwell);
    return W(dwell);
  }, [setClock, steps]);

  const play = useCallback(async (from: number) => {
    const tok = ++token.current;
    setPlaying(true);
    /* 좁은 화면: 재생하면 폰이 보이는 곳으로 */
    if (window.innerWidth < 900) document.querySelector(".day-phone")?.scrollIntoView({ block: "start", behavior: "smooth" });
    /* 처음부터면 폰도 처음 상태로: 밝기 원래대로 · 화면 꺼진 잠금 */
    FACE.__faceOk = from > 0;
    if (from === 0) dayClear();
    fire({ bright: 1 }); fire({ cc: false }); fire({ alarm: false });
    viaBanner.current = -1;
    if (from === 0) { fire({ bright: 1 }); fire({ cc: false }); fire({ alarm: false }); fire({ off: true }); await sleep(450, tok); }
    for (let i = from; i < steps.length; i++) {
      setK(i);
      if (!(await runStep(i, tok, speedRef.current))) return;
      const s = steps[i], nx = steps[i + 1];
      const st = (W_.__phoneState || {}) as PState;
      if (nx && !["lock", "end"].includes(s.act) && ["banner", "alarm", "call"].includes(nx.act) && toMin(nx.t) - toMin(s.t) >= 20 && !st.off && !st.call && st.phase === "home") {
        hideFinger();
        fire({ phase: "lock" });
        if (!(await sleep(600 / speedRef.current, tok))) return;
      }
    }
    if (tok === token.current) setPlaying(false);
  }, [steps, runStep]);
  const speedRef = useRef(speed);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  /* 세부 편집의 "이 장면부터 재생": 들어오자마자 그 장면부터 */
  useEffect(() => {
    let from: string | null = null;
    try { from = sessionStorage.getItem("day-from"); sessionStorage.removeItem("day-from"); } catch { /* 저장 안 되는 창 */ }
    if (from == null || !steps.length) return;
    const t = setTimeout(() => play(Math.min(steps.length - 1, Math.max(0, +from! || 0))), 700);
    return () => clearTimeout(t);
  }, [steps.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const stop = () => { token.current++; setPlaying(false); hideFinger(); };

  /* 지금 장면이 시간표에서 보이게 */
  useEffect(() => {
    /* 시간표 안에서만 따라 내려감 (페이지 전체가 밀려 폰이 안 보이는 일 없게) */
    const list = listRef.current, el = list?.querySelector<HTMLElement>(`[data-i="${k}"]`);
    if (!list || !el || list.scrollHeight <= list.clientHeight + 4) return;
    const lr = list.getBoundingClientRect(), er = el.getBoundingClientRect();
    list.scrollTo({ top: list.scrollTop + er.top - lr.top - lr.height / 2 + er.height / 2, behavior: "smooth" });
  }, [k]);

  const cur = k >= 0 ? steps[k] : null;
  const first = steps[0]?.t || "", last = steps[steps.length - 1]?.t || "";
  const span = Math.max(1, toMin(last) - toMin(first));
  const pos = cur ? (toMin(cur.t) - toMin(first)) / span : 0;

  return (
    <div className="day-root">
      <header className="day-top">
        <a href="../" className="day-brand"><b></b>귀환의 블로그</a>
        <span className="day-crumb">NPC의 폰 · 하루 재생</span>
        <span className="day-sp" />
        <a href="#/ooc" className="day-link">OOC로 채우기</a>
        <a href="#/phone" className="day-link">직접 둘러보기</a>
        <a href="#/editor" className="day-link quiet">세부 편집</a>
      </header>

      <main className={`day-main ${wide ? "wide" : ""}`}>
        <section className="day-phone">
          <div style={{ width: 433 * scale, height: 892 * scale }}>
            <Phone embedded previewScale={scale} />
          </div>
          <div className="day-caption" aria-live="polite">
            <span className="cap-time">{cur ? ko(cur.t) : ko(first)}</span>
            <p className="cap-say">{cur ? cur.say : `${info.owner}의 하루를 재생해요.`}</p>
            {cur?.inner ? <p className="cap-inner">{cur.inner}</p> : null}
          </div>
        </section>

        <section className="day-side">
          <div className="day-head">
            <span className="day-date">{info.date}</span>
            <h1>{info.owner}의 하루</h1>
            <p className="day-title">{info.title}</p>
            {d.wallpaper?.desc ? <p className="day-wall"><b>배경화면</b> {d.wallpaper.desc}</p> : null}
          </div>

          <div className="day-ctrl">
            <button className="day-play" onClick={() => (playing ? stop() : play(k < 0 || k >= steps.length - 1 ? 0 : k + 1))} aria-label={playing ? "일시정지" : "재생"}>
              {playing ? <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><rect x="4" y="3" width="3.6" height="12" rx="1" /><rect x="10.4" y="3" width="3.6" height="12" rx="1" /></svg> : <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><path d="M5 2.8v12.4L15 9z" /></svg>}
            </button>
            <div className="day-bar">
              <div className="day-bar-in"><i style={{ width: `${pos * 100}%` }} /></div>
              <div className="day-bar-lab"><span>{ko(first)}</span><span>{ko(last)}</span></div>
            </div>
            <div className="day-speed" role="group" aria-label="재생 속도">
              {[1, 2, 4].map((s) => <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}배</button>)}
            </div>
          </div>

          {!steps.length ? <p className="day-empty">하루 타임라인이 없어요. <a href="#/ooc">OOC로 채우기</a>에서 4번 답을 붙여넣어 주세요.</p> : null}
          <ol className="day-list" ref={listRef}>
            {steps.map((s, i) => (
              <li key={i} data-i={i} className={i === k ? "on" : i < k ? "past" : ""}>
                <button onClick={() => { stop(); setTimeout(() => play(i), 30); }}>
                  <time>{s.t}</time>
                  <span className="ic">{["lock", "home"].includes(stepApp(s)) ? <span className="ic-sys">{s.act === "unlock" ? "해제" : s.act === "home" ? "홈" : "잠금"}</span> : <AppIcon id={stepApp(s)} size={26} />}</span>
                  <span className="tx"><small>{stepLabel(s)}</small>{s.say}</span>
                </button>
              </li>
            ))}
          </ol>
          {info.summary ? <p className="day-sum">{info.summary}</p> : null}
        </section>
      </main>
    </div>
  );
}
