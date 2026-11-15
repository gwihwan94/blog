/* 하루 재생 자동 손가락: 폰 화면 위에 손끝(반투명 원)을 보여 주고, 실제 터치 이벤트를 보내서
   잠금 화면 밀기 · 암호 누르기 · 아이콘 누르기 · 알림 누르기 · 제어 센터 내리기 · 밝기 끌기 · 스크롤을 폰이 스스로 한다.
   좌표는 폰 화면 기준(393 x 852). */

let finger: HTMLDivElement | null = null;
let speed = 1;
let alive = () => true;

export function setRobot(sp: number, ok: () => boolean) {
  speed = sp;
  alive = ok;
}

const wait = (ms: number) => new Promise<boolean>((r) => setTimeout(() => r(alive()), ms / speed));
export const screenEl = () => document.querySelector<HTMLElement>("[data-phone-screen]");
const k = () => {
  const s = screenEl();
  const r = s?.getBoundingClientRect();
  return { r: r!, k: r ? r.width / 393 : 1 };
};
/** 폰 좌표 → 화면 좌표 */
const toView = (x: number, y: number) => {
  const { r, k: s } = k();
  return { cx: r.left + x * s, cy: r.top + y * s };
};
/** 화면 요소 → 폰 좌표 (가운데) */
export function centerOf(el: Element): [number, number] {
  const { r, k: s } = k();
  const b = el.getBoundingClientRect();
  return [(b.left + b.width / 2 - r.left) / s, (b.top + b.height / 2 - r.top) / s];
}
/** 그 요소가 지금 폰 화면 안에 보이는지 */
export function onScreen(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const { r } = k();
  const b = el.getBoundingClientRect();
  if (!b.width || !b.height) return false;
  const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
  return cx > r.left && cx < r.right && cy > r.top && cy < r.bottom;
}

function ensureFinger() {
  if (finger && document.body.contains(finger)) return finger;
  finger = document.createElement("div");
  finger.className = "robot-finger";
  document.body.appendChild(finger);
  return finger;
}
function place(x: number, y: number, ms: number) {
  const f = ensureFinger();
  const { k: s } = k();
  const { cx, cy } = toView(x, y);
  const size = 40 * s;
  f.style.transition = ms ? `left ${ms / speed}ms cubic-bezier(.3,.7,.3,1), top ${ms / speed}ms cubic-bezier(.3,.7,.3,1), opacity .25s, transform .12s` : "opacity .25s, transform .12s";
  f.style.width = f.style.height = size + "px";
  f.style.left = cx - size / 2 + "px";
  f.style.top = cy - size / 2 + "px";
  f.style.opacity = "1";
}
export function hideFinger() {
  if (finger) finger.style.opacity = "0";
}
const press = (on: boolean) => finger && (finger.style.transform = on ? "scale(.78)" : "scale(1)");

function pointer(type: string, x: number, y: number, target?: Element | null) {
  const { cx, cy } = toView(x, y);
  const el = target ?? document.elementFromPoint(cx, cy);
  if (!el) return null;
  const ev = new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, pointerId: 7, pointerType: "touch", isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1 });
  el.dispatchEvent(ev);
  return el;
}

let last: [number, number] = [196, 600];
/** 손끝을 옮김 (화면에 안 보이던 상태면 그 자리에서 나타남) */
async function moveTo(x: number, y: number) {
  const vis = finger && finger.style.opacity === "1";
  place(vis ? last[0] : x, vis ? last[1] : y + 30, 0);
  await wait(30);
  place(x, y, vis ? 380 : 260);
  last = [x, y];
  return wait(vis ? 400 : 280);
}

/** 누르기: 요소(또는 좌표)로 가서 꾹 → 떼면서 클릭 */
export async function tap(t: Element | [number, number], opt: { click?: boolean } = {}) {
  const [x, y] = Array.isArray(t) ? t : centerOf(t);
  if (!(await moveTo(x, y))) return false;
  press(true);
  /* 그 자리 맨 위에 다른 게 덮여 있으면(홈 막대·탭 막대 등) 터치를 보내지 않고 대상만 누른다 */
  const { cx, cy } = toView(x, y);
  const top = document.elementFromPoint(cx, cy);
  const covered = !Array.isArray(t) && top && !(t as Element).contains(top) && !top.contains(t as Element);
  const el = covered ? null : pointer("pointerdown", x, y);
  await wait(110);
  if (el) pointer("pointerup", x, y, el);
  if (opt.click !== false) {
    const target = (Array.isArray(t) ? el : t) as HTMLElement | null;
    (target?.closest("button, a, [role=button], label") as HTMLElement | null ?? target)?.click();
  }
  press(false);
  return wait(240);
}

/** 밀기: from → to (실제 터치 이동을 여러 번 보냄) */
export async function swipe(from: [number, number], to: [number, number], ms = 420, opt: { events?: boolean } = {}) {
  if (!(await moveTo(from[0], from[1]))) return false;
  press(true);
  const ev = opt.events !== false;
  const el = ev ? pointer("pointerdown", from[0], from[1]) : null;
  const n = 12;
  for (let i = 1; i <= n; i++) {
    const x = from[0] + ((to[0] - from[0]) * i) / n, y = from[1] + ((to[1] - from[1]) * i) / n;
    place(x, y, 0);
    if (ev) pointer("pointermove", x, y, el);
    if (!(await wait(ms / n))) return false;
  }
  if (ev) pointer("pointerup", to[0], to[1], el);
  press(false);
  last = to;
  return wait(160);
}

/** 앱 화면을 손가락으로 천천히 쓸어 올리며 읽기 */
export async function readScroll(root: HTMLElement | null, sec: number) {
  const els = root ? [...root.querySelectorAll<HTMLElement>("*")].filter((e) => {
    const s = getComputedStyle(e);
    return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 40;
  }) : [];
  const sc = els.sort((a, b) => b.clientHeight - a.clientHeight)[0];
  const t0 = Date.now();
  if (!sc) return wait(Math.min(sec, 4.5) * 1000);
  const rounds = Math.max(1, Math.round(sec / 2.2));
  for (let i = 0; i < rounds && Date.now() - t0 < (sec * 1000) / speed; i++) {
    const room = sc.scrollHeight - sc.clientHeight - sc.scrollTop;
    if (room < 10) break;
    if (!(await swipe([210, 640], [214, 430], 520, { events: false }))) return false;
    sc.scrollBy({ top: Math.min(room, sc.clientHeight * 0.45), behavior: "smooth" });
    hideFinger();
    if (!(await wait(1500))) return false;
  }
  const left = sec * 1000 / speed - (Date.now() - t0);
  return left > 0 ? wait(left * speed) : alive();
}

/** 조건이 맞을 때까지 기다림 (최대 ms) */
export async function until(f: () => unknown, ms = 3000) {
  const t0 = Date.now();
  while (!f()) {
    if (Date.now() - t0 > ms / speed) return false;
    if (!(await wait(80))) return false;
  }
  return true;
}
export const pause = wait;
