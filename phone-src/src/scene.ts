/* 대화방 연출: 보는 사람이 그 방에 직접 들어가면 정해진 대로 저절로 흘러감 (보기 전용)
   예) 상대 말이 오다 끊김 → 입력창에 "받" 치다가 → 스팸이 와다닥 → 입력창이 "미친놈인가"로 바뀜
   - 강제로 방을 열지 않음: 알림을 누르거나 목록에서 직접 들어가야 시작
   - 저장하지 않음: 새로 열면(새로고침) 처음부터 다시 · 같은 방문 중 다시 들어오면 이어서/끝난 모습 그대로 */
import { useEffect, useSyncExternalStore } from "react";
import type { Msg, Thread, SceneStep } from "./store";

type St = { extra: Msg[]; typed: string; step: number; done: boolean; typing?: boolean; taps?: Record<string, string>; gone?: string[] };
const states = new Map<string, St>();
const listeners = new Set<() => void>();
const set = (id: string, v: Partial<St>) => {
  states.set(id, { ...(states.get(id) as St), ...v });
  listeners.forEach((l) => l());
};

/* 한글 한 글자씩 조합되는 모습 (ㅂ → 바 → 받) */
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
export function typingFrames(text: string): string[] {
  const out: string[] = [];
  let done = "";
  for (const ch of text) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c >= 0 && c < 11172) {
      const cho = Math.floor(c / 588);
      const jung = Math.floor((c % 588) / 28);
      const jong = c % 28;
      out.push(done + CHO[cho]);
      const open = String.fromCharCode(0xac00 + cho * 588 + jung * 28);
      out.push(done + open);
      if (jong) out.push(done + ch);
    } else out.push(done + ch);
    done += ch;
  }
  return out;
}

/* 연출로 글을 칠 때: 아이폰 키보드를 올리고, 방금 친 자판을 반짝 */
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const LASTV: Record<string, string> = { ㅘ: "ㅏ", ㅙ: "ㅐ", ㅚ: "ㅣ", ㅝ: "ㅓ", ㅞ: "ㅔ", ㅟ: "ㅣ", ㅢ: "ㅣ" };
const LASTC: Record<string, string> = { ㄳ: "ㅅ", ㄵ: "ㅈ", ㄶ: "ㅎ", ㄺ: "ㄱ", ㄻ: "ㅁ", ㄼ: "ㅂ", ㄽ: "ㅅ", ㄾ: "ㅌ", ㄿ: "ㅍ", ㅀ: "ㅎ", ㅄ: "ㅅ" };
const BASE: Record<string, string> = { ㄲ: "ㄱ", ㄸ: "ㄷ", ㅃ: "ㅂ", ㅆ: "ㅅ", ㅉ: "ㅈ", ㅒ: "ㅐ", ㅖ: "ㅔ" };
function keyOf(prev: string, cur: string): string {
  if ([...cur].length < [...prev].length) return "지우기";
  const ch = [...cur].pop() || "";
  if (ch === " ") return "스페이스";
  if (ch === "\n") return "리턴";
  const c = ch.charCodeAt(0) - 0xac00;
  let k = ch;
  if (c >= 0 && c < 11172) {
    const jong = c % 28, jung = Math.floor((c % 588) / 28);
    const sameSyl = [...prev].length === [...cur].length;
    if (jong && sameSyl) k = LASTC[JONG[jong]] ?? JONG[jong];
    else { const v = JUNG[jung]; k = LASTV[v] ?? v; }
  }
  return BASE[k] ?? k;
}
export const kbShow = (on: boolean) => window.dispatchEvent(new CustomEvent("phone:kb", { detail: on }));
const kbFlash = (k: string) => window.dispatchEvent(new CustomEvent("phone:kbflash", { detail: k }));

function run(t: Thread) {
  const steps = t.scene ?? [];
  const id = t.id;
  let k = 0;
  const next = (i: number) => {
    if (i >= steps.length) { setTimeout(() => kbShow(false), 1400); return set(id, { done: true }); }
    const s = steps[i];
    set(id, { step: i });
    if (s.kind === "wait") return void setTimeout(() => next(i + 1), Math.max(0, s.sec) * 1000);
    /* 상대가 입력 중 (아이메시지: 회색 점 세 개 말풍선 · 카톡은 실제처럼 표시 없이 기다림) */
    if (s.kind === "typing") {
      set(id, { typing: true });
      return void setTimeout(() => { set(id, { typing: false }); next(i + 1); }, Math.max(0.4, s.sec ?? 2) * 1000);
    }
    /* 내가 마지막으로 보낸 말을 전송 취소 / 삭제 */
    if (s.kind === "unsend") {
      const st = states.get(id)!;
      const all = [...t.messages, ...st.extra];
      const last = [...all].reverse().find((m) => m.from === "me" && m.kind !== "deleted" && !(st.gone || []).includes(m.id));
      if (last) {
        if (st.extra.some((m) => m.id === last.id)) set(id, { extra: st.extra.map((m) => (m.id === last.id ? { ...m, kind: "deleted" as const } : m)) });
        else set(id, { gone: [...(st.gone || []), last.id] });
      }
      return void setTimeout(() => next(i + 1), Math.max(0.05, s.sec ?? 0.6) * 1000);
    }
    /* 말풍선 반응: from 이 단 반응 → 상대의 마지막 말풍선에 붙음 */
    if (s.kind === "react") {
      const st = states.get(id)!;
      const target = s.from === "me" ? "them" : "me";
      const all = [...t.messages, ...st.extra];
      const last = [...all].reverse().find((m) => m.from === target && m.kind !== "date");
      if (last) set(id, { taps: { ...(st.taps || {}), [last.id]: s.tap } });
      return void setTimeout(() => next(i + 1), Math.max(0.05, s.sec ?? 0.8) * 1000);
    }
    /* 사진 보내기: text 는 사진 설명 */
    if (s.kind === "photo") {
      const st = states.get(id)!;
      set(id, { extra: [...st.extra, { id: `scene-${id}-${k++}`, from: s.from ?? "them", text: s.text, kind: "photo" }] });
      return void setTimeout(() => next(i + 1), Math.max(0.05, s.sec ?? 0.8) * 1000);
    }
    if (s.kind === "msg") {
      const st = states.get(id)!;
      set(id, { extra: [...st.extra, { id: `scene-${id}-${k++}`, from: s.from ?? "them", text: s.text }] });
      return void setTimeout(() => next(i + 1), Math.max(0.05, s.sec ?? 0.35) * 1000);
    }
    // 입력창에 쓴 걸 보내기 (내 말풍선으로 올라가고 입력창은 비움)
    if (s.kind === "send") {
      const st = states.get(id)!;
      if (st.typed.trim()) set(id, { extra: [...st.extra, { id: `scene-${id}-${k++}`, from: "me", text: st.typed.trim() }], typed: "" });
      return void setTimeout(() => next(i + 1), Math.max(0.05, s.sec ?? 0.5) * 1000);
    }
    // 입력창에 치기: 지금 쓰여 있는 걸 한 글자씩 지우고 → 새 글을 한 글자씩
    const cur = states.get(id)!.typed;
    const frames: string[] = [];
    for (let n = [...cur].length - 1; n >= 0; n--) frames.push([...cur].slice(0, n).join(""));
    frames.push(...typingFrames(s.text));
    const del = [...cur].length;
    const ms = s.ms ?? 150;
    let f = 0;
    // 사람처럼: 지우기 전에 잠깐 멈칫 → 치는 속도 그대로 한 칸씩 지우고 → 살짝 쉬었다가 새로 침 / 다 치면 바로 다음
    const gap = (k: number) => (k === del && del ? ms * 2 : ms * (0.8 + Math.random() * 0.4));
    kbShow(true);
    const tick = () => {
      if (f >= frames.length) return void next(i + 1);
      const before = states.get(id)!.typed;
      set(id, { typed: frames[f++] });
      kbFlash(keyOf(before, frames[f - 1]));
      setTimeout(tick, gap(f));
    };
    if (del) setTimeout(tick, 300);
    else tick();
  };
  next(0);
}

/** 그 방의 연출 상태. 방이 화면에 처음 열릴 때 시작 */
export function useScene(t: Thread, on = true): St | null {
  const has = on && !!t.scene?.length;
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => states.get(t.id),
  );
  useEffect(() => {
    if (!has || states.has(t.id)) return;
    states.set(t.id, { extra: [], typed: "", step: 0, done: false, typing: false, taps: {}, gone: [] });
    run(t);
  }, [has, t.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return has ? (states.get(t.id) ?? { extra: [], typed: "", step: 0, done: false, typing: false, taps: {}, gone: [] }) : null;
}

/** 연출이 끝난 뒤엔 보는 사람 마음대로: 입력창 고치기 */
export function setSceneTyped(id: string, v: string) {
  if (states.get(id)?.done) set(id, { typed: v });
}
/** 연출이 끝난 뒤 보내기: 그 방 말풍선으로 올라감 (연출처럼 저장은 안 됨 — 새로 열면 처음부터) */
export function sendScene(id: string) {
  const st = states.get(id);
  if (!st?.done || !st.typed.trim()) return;
  set(id, { extra: [...st.extra, { id: `scene-${id}-u${st.extra.length}`, from: "me", text: st.typed.trim() }], typed: "" });
}

/* ───── 하루 재생 전용: 알림으로 온 말 · 방에서 보낸 말을 재생하는 동안만 쌓아 둔다 (저장 안 함) ───── */
const dayMsgs = new Map<string, Msg[]>();
const dayUnread = new Map<string, number>();
let dayVer = 0;
const bump = () => { dayVer++; listeners.forEach((l) => l()); };
export function dayPush(id: string, m: Msg, unread = 0) {
  const list = dayMsgs.get(id) || [];
  if (list.some((x) => x.text === m.text && x.from === m.from)) return;
  dayMsgs.set(id, [...list, m]);
  if (unread) dayUnread.set(id, (dayUnread.get(id) || 0) + unread);
  bump();
}
export const dayHas = (id: string, text: string) => (dayMsgs.get(id) || []).some((m) => m.text === text);
export function dayRead(id: string) { if (dayUnread.get(id)) { dayUnread.delete(id); bump(); } }
export function dayClear() { dayMsgs.clear(); dayUnread.clear(); states.clear(); bump(); }
/** 같은 방 연출을 다시 시작하기 전: 지난번에 보낸 말은 방에 남겨 둔다 */
export function restartScene(id: string) {
  const st = states.get(id);
  if (st) {
    const gone = new Set(st.gone || []);
    const keep = st.extra.filter((m) => m.kind !== "deleted" && !gone.has(m.id));
    dayMsgs.set(id, [...(dayMsgs.get(id) || []), ...keep.map((m) => ({ ...m, id: m.id + "-k" + dayVer }))]);
  }
  states.delete(id);
  bump();
}
/** 목록 · 방에서 쓰는 '지금 보이는' 대화: 원래 말 + 재생 중 쌓인 말 + 연출 중인 말 */
export function threadView(t: Thread): Thread {
  const sc = states.get(t.id);
  const extra = [...(dayMsgs.get(t.id) || []), ...(sc ? sc.extra.filter((m) => m.kind !== "deleted") : [])];
  const u = dayUnread.get(t.id) || 0;
  if (!extra.length && !u) return t;
  return { ...t, messages: [...t.messages, ...extra], unread: (t.unread || 0) + u };
}
/** 목록이 재생 중 바뀐 걸 따라 다시 그려지게 */
export function useDayView() {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => dayVer);
}

/** 편집 화면에서 연출을 고친 뒤 다시 보기 */
export function resetScene(id?: string) {
  if (id) states.delete(id);
  else states.clear();
  listeners.forEach((l) => l());
}
export type { SceneStep };

/** 괄호 밖 하루 재생: 지금 그 방 연출이 끝났는지 */
export const sceneInfo = (id: string) => states.get(id);

/** 연출이 적용된 말풍선 목록: 지운 것 · 반응까지 반영 */
export function sceneMessages(t: Thread, sc: St | null): Msg[] {
  const base = [...t.messages, ...(dayMsgs.get(t.id) || [])];
  if (!sc) return base;
  const gone = new Set(sc.gone || []);
  return [...base, ...sc.extra].map((m) => {
    let x = m;
    if (gone.has(m.id)) x = { ...x, kind: "deleted" };
    const tap = sc.taps?.[m.id];
    if (tap) x = { ...x, tap };
    return x;
  });
}
