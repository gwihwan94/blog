/* 공통 코어
   - AI 답변에서 JSON 뽑기 (코드블록 / 앞뒤 잡담 / 끝 쉼표 / 둥근 따옴표 허용)
   - 폼 자동 생성, 로컬 저장, 공유 링크(#d=), PNG 저장, OOC 복사
   툴 페이지는 Core.app({...}) 하나만 호출하면 된다. */
/* AI 채팅 입력창 한도: 로판AI 1,500자 기준 (케이브덕도 답 기본 출력량이 약 1,600자) */
const OOC_LIMIT = 1500;
const OOC_REF = '▪ 세계관 정보, PC와 NPC의 캐릭터 정보, 유저 노트, 두 사람의 관계성을 참고하여 서술한다.';
/* OOC 압축: AI는 띄어쓰기 없이도 읽으니 한글 사이·문장부호 둘레 공백을 빼서 글자 수를 아낀다.
   따옴표 속(JSON 예시 값)·영어 단어 사이·이름(keep)은 그대로 둔다. 줄바꿈도 그대로. */
const OOC_SAME = '▪ 말투·호칭·이름·숫자는 RP 그대로, 줄표(—) 없이.';
function squeezeOOC(text, keep) {
  const names = (keep || []).filter((n) => typeof n === 'string' && /\s/.test(n.trim())).sort((a, b) => b.length - a.length);
  let t = text;
  names.forEach((n, i) => { t = t.split(n).join('\u0001' + i + '\u0001'); });
  t = t.split(/("(?:[^"\\\n]|\\.)*")/).map((seg, i) => i % 2 ? seg : seg
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?([▪/·,:|→=~()\[\]{}「」『』《》]) ?/g, '$1')
    .replace(/ +\n/g, '\n')).join('');
  names.forEach((n, i) => { t = t.split('\u0001' + i + '\u0001').join(n); });
  return t;
}
/* 상태 안의 이름(name 키)들: 띄어쓰기가 있는 이름은 압축에서 지킨다 */
function namesIn(o, out = []) { if (!o || typeof o !== 'object') return out; for (const [k, v] of Object.entries(o)) { if (k === 'name' && typeof v === 'string') out.push(v); else if (typeof v === 'object') namesIn(v, out); } return out; }
/* 사이트 이름: 여기 한 곳만 바꾸면 모든 툴 상단 바에 반영된다 */
const SITE_NAME = "귀환의 블로그";
document.addEventListener("DOMContentLoaded", () => document.querySelectorAll("header .brand:not([data-keep])").forEach(b => { b.textContent = SITE_NAME; }));
/* 허브 썸네일(iframe)로 열렸을 때: 상단바·버튼을 숨겨 화면만 보이게 */
if (/[?&]thumb/.test(location.search)) document.documentElement.classList.add("thumb");
window.Core = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  const set = (o, p, v) => {
    const ks = p.split('.'); let a = o;
    for (let i = 0; i < ks.length - 1; i++) {
      if (a[ks[i]] == null || typeof a[ks[i]] !== 'object') a[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      a = a[ks[i]];
    }
    a[ks[ks.length - 1]] = v;
  };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const num = (v, d = 0) => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : d; };
  /* 여러 줄 텍스트 안전 출력: 줄바꿈 + // 줄바꿈 */
  const br = s => esc(s).replace(/\s*\/\/\s*/g, '<br>').replace(/\n/g, '<br>');
  const pad = n => String(n).padStart(2, '0');
  const initial = s => [...String(s || '?').trim()][0] || '?';
  /* 같은 입력이면 같은 그림이 나오도록 하는 시드 난수 */
  function rng(seed) {
    let h = 1779033703 ^ String(seed).length;
    for (const c of String(seed)) { h = Math.imul(h ^ c.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /* "21:04" ↔ 분 */
  const toMin = t => { const m = String(t ?? '').match(/(\d{1,2})\s*[:시]\s*(\d{1,2})?/); return m ? Number(m[1]) * 60 + Number(m[2] || 0) : 0; };
  const fmtMin = m => `${pad(Math.floor(((m % 1440) + 1440) % 1440 / 60))}:${pad(Math.round(((m % 60) + 60) % 60))}`;
  const today = () => { const d = new Date(); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; };
  /* 받침 유무로 조사 고르기: josa('재희','이','가') */
  const josa = (w, a, b) => { const c = String(w || '').trim().slice(-1).charCodeAt(0); return (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28) ? a : b; };
  const editorHTML = (what) => `
    <div id="form"></div>
    <aside>
      <section class="card">
        <h3>AI 채팅으로 채우기</h3>
        <div class="how"><div><b>01 복사</b>1번부터 차례로</div><div><b>02 보내기</b>캐릭터 채팅방에</div><div><b>03 붙여넣기</b>답을 통째로</div></div>
      </section>
      <section class="card"><h3>OOC 프롬프트</h3><div class="psteps" id="prompts"></div></section>
      <section class="card">
        <h3>AI 답변 붙여넣기</h3>
        <textarea class="paste" id="paste" placeholder="AI 답변을 그대로 붙여넣어 주세요. 앞뒤에 말이 섞여 있어도 괜찮아요."></textarea>
        <button class="btn primary" id="apply" style="width:100%;margin-top:8px">적용하기</button>
        <div class="progress" id="progress"></div>
      </section>
      <section class="card" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="btn-sample">예시 불러오기</button>
        <button class="btn ghost" id="btn-clear">전부 비우기</button>
      </section>
    </aside>`;

  /* ── JSON 추출 ── */
  /* AI 채팅 답에서 흔한 깨짐을 고친다:
     문자열 안 일반 따옴표 → “ ” / 문자열 안 줄바꿈 → 띄어쓰기 / 뒤쪽 쉼표 / 중간에 끊긴 답은 열린 괄호를 닫는다 */
  function repair(s) {
    let o = '', inStr = false, bs = false, open = 0; const stack = [];
    const next = i => { for (let j = i + 1; j < s.length; j++) if (!/\s/.test(s[j])) return s[j]; return ''; };
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inStr) {
        if (bs) { bs = false; o += c; continue; }
        if (c === '\\') { bs = true; o += c; continue; }
        if (c === '\n' || c === '\r' || c === '\t') { o += ' '; continue; }
        if (c === '"') {
          const n = next(i);
          if (n === '' || n === ',' || n === ':' || n === '}' || n === ']') { inStr = false; o += c; }
          else { o += (open++ % 2 ? '”' : '“'); }
          continue;
        }
        o += c; continue;
      }
      if (c === '"') { inStr = true; open = 0; o += c; continue; }
      if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
      else if ((c === '}' || c === ']') && stack.length) stack.pop();
      o += c;
    }
    if (inStr) o += '"';
    if (stack.length) {
      /* 끊긴 자리의 반쪽 항목(키만 있거나 쉼표로 끝난 것)을 걷어 내고 닫는다 */
      o = o.replace(/,\s*"[^"]*"\s*:?\s*$/, '').replace(/:\s*$/, ': ""').replace(/,\s*$/, '');
      o += stack.reverse().join('');
    }
    return o.replace(/,\s*([}\]])/g, '$1');
  }
  function tryParse(s) {
    const fixes = [
      x => x,
      x => x.replace(/,\s*([}\]])/g, '$1'),
      x => repair(x),
      x => repair(x.replace(/[“”]/g, '"')),
    ];
    for (const f of fixes) {
      try { const v = JSON.parse(f(s.trim())); if (v && typeof v === 'object') return v; } catch (e) { /* 다음 방법 */ }
    }
    return null;
  }
  function scanObjects(text) {
    const out = []; let depth = 0, start = -1, inStr = false, bs = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inStr) { if (bs) bs = false; else if (c === '\\') bs = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') { if (depth > 0) inStr = true; continue; }
      if (c === '{') { if (depth === 0) start = i; depth++; }
      else if (c === '}' && depth > 0) { depth--; if (depth === 0) { const v = tryParse(text.slice(start, i + 1)); if (v) out.push(v); } }
    }
    /* 끝까지 안 닫힌 답(출력이 끊김): 열린 곳부터 끝까지를 고쳐서 살린다 */
    if (depth > 0 && start >= 0) { const v = tryParse(text.slice(start).replace(/`+\s*$/, '')); if (v) { v.__cut = true; out.push(v); } }
    return out;
  }
  function extractJSON(raw) {
    /* AI 답의 줄표: 말이 끊기는 자리는 말줄임표로, 문장 사이는 쉼표로 (사람이 쓴 글처럼) */
    raw = String(raw).replace(/\s+[—–]+\s+/g, ", ").replace(/[—–]+/g, "…");
    const out = []; const fence = /```[a-zA-Z]*\s*([\s\S]*?)```/g; let m;
    while ((m = fence.exec(raw))) { const v = tryParse(m[1]); if (v) out.push(v); else out.push(...scanObjects(m[1])); }
    if (!out.length) out.push(...scanObjects(raw));
    return out;
  }

  /* ── 유틸 ── */
  let toastT;
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0';
      document.body.append(ta); ta.select(); let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { /* 무시 */ }
      ta.remove(); return ok;
    }
  }
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } },
  };
  function readShare() {
    const m = location.hash.match(/[#&]d=([^&]+)/);
    if (!m || !window.LZString) return null;
    try { return JSON.parse(LZString.decompressFromEncodedURIComponent(m[1])); } catch (e) { return null; }
  }
  function shareURL(obj) { return location.origin + location.pathname + '#d=' + LZString.compressToEncodedURIComponent(JSON.stringify(obj)); }
  async function savePNG(el, name, skin) {
    if (!window.modernScreenshot) { toast('이미지 도구를 불러오지 못했어요. 새로고침 후 다시 해 주세요'); return; }
    toast('이미지 만드는 중…');
    /* 저장 배경을 골랐으면 잠깐 바깥 틀로 감싸서 같이 찍는다 */
    const fr = skin && SKIN.frame.find(f => f[0] === skin.frame && f[2]);
    let wrap = null, target = el;
    try {
      await document.fonts.ready;
      el.classList.add('capturing');
      if (fr) {
        wrap = document.createElement('div'); wrap.className = 'skin-cap';
        wrap.style.cssText = `display:inline-block;padding:36px;background:${fr[2]};max-width:none;`;
        wrap.style.width = (el.offsetWidth + 72) + 'px';
        el.before(wrap); wrap.append(el); target = wrap;
      }
      const bg = fr ? null : getComputedStyle(el).backgroundColor;
      const url = await modernScreenshot.domToPng(target, { scale: 2.5, backgroundColor: fr ? undefined : (bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#ffffff') });
      const a = document.createElement('a'); a.href = url; a.download = (name || '2inbun').replace(/[\\/:*?"<>|]/g, '') + '.png'; a.click();
      toast('PNG로 저장했어요');
    } catch (e) { console.error(e); toast('이미지 저장에 실패했어요'); }
    finally { el.classList.remove('capturing'); if (wrap) { wrap.before(el); wrap.remove(); } }
  }

  /* ── 꾸미기 (모든 툴 공통) ──
     고른 값은 상태(S.skin)에 들어가서 내 브라우저 저장·공유 링크·이미지 저장에 그대로 따라간다.
     theme: 툴 자체 스타일의 색을 테마 색 배열에 역할별로 다시 배치한다.
            캐릭터 색처럼 사용자가 고른 색은 그대로 둔다.
     frame: 이미지로 저장할 때 바깥 배경 · font: 글꼴 */
  /* 테마 = 직접 짠 색 배열. 툴의 색을 역할별로 나눠 이 배열에 다시 배치한다.
     무채색(바탕·면·선·글자): 툴 안에서의 밝기 순서를 지켜 surface → bg → line → muted → ink 단계에 놓는다.
     유채색(강조): 툴에서 많이 쓰인 색 계열부터 acc[0], acc[1]… 에 짝지어 주고, 원래 옅은 색은 면 쪽으로, 진한 색은 글자 쪽으로 섞는다. */
  const P = (surface, bg, line, muted, ink, acc) => ({ surface, bg, line, muted, ink, acc });
  const SKIN = {
    theme: [
      ['base', '기본', null],
      ['paper', '종이', P('#fbf7ee', '#f3ecdd', '#d9cdb6', '#8a7a65', '#2b241d', ['#b6452f', '#2e5e66', '#c8972f', '#6d5287'])],
      ['sakura', '벚꽃', P('#fffafb', '#fdeef2', '#f1cdd7', '#a07c89', '#3b2430', ['#e0668a', '#7fae96', '#f0a25b', '#8a74cf'])],
      ['sea', '바다', P('#f7fbfe', '#e9f3fa', '#c3dbea', '#6c8599', '#10304a', ['#1c79c0', '#f0845a', '#27a99b', '#f1bd45'])],
      ['forest', '숲', P('#f8f9f3', '#eef1e4', '#cfd6bd', '#6f7a63', '#1e2a1f', ['#3c7a4c', '#c98236', '#a3463a', '#5a7ba0'])],
      ['lavender', '라벤더', P('#faf9ff', '#f0edfc', '#d8d1f3', '#7f78a3', '#26204a', ['#7458e8', '#ff8fa8', '#45b6a5', '#f2b544'])],
      ['mono', '모노', P('#ffffff', '#f3f3f3', '#d6d6d6', '#7a7a7a', '#111111', ['#e5392b', '#111111', '#6b6b6b', '#a8a8a8'])],
      ['night', '밤', P('#171b26', '#11141c', '#2c3242', '#8a93a8', '#eef1f7', ['#8fb2ff', '#f4c56b', '#ff8a9a', '#74d6c4'])],
      ['cocoa', '코코아', P('#241c17', '#1b1511', '#3e322a', '#a8978a', '#f4ebe1', ['#e8a15a', '#d9655b', '#9ec28a', '#e9d18c'])],
    ],
    frame: [
      ['none', '없음', ''],
      ['white', '흰색', '#ffffff'],
      ['paper', '종이', '#f1ebdf'],
      ['black', '검정', '#141518'],
      ['pink', '분홍', 'linear-gradient(160deg,#ffe8ef,#ffc9d9)'],
      ['sky', '하늘', 'linear-gradient(160deg,#e8f2ff,#bcd7fb)'],
      ['dusk', '노을', 'linear-gradient(160deg,#ffd3a6,#ee9bb2 55%,#8c7fd6)'],
      ['night', '밤하늘', 'linear-gradient(160deg,#20274a,#0c0f1f)'],
    ],
    font: [
      ['base', '기본', ''],
      ['round', '둥근', "'Gowun Dodum', 'Pretendard Variable', sans-serif"],
      ['serif', '명조', "'Noto Serif KR', 'Batang', serif"],
      ['pen', '손글씨', "'Nanum Pen Script', 'Pretendard Variable', cursive"],
      ['dot', '도트', "'Galmuri11', 'Galmuri9', monospace"],
    ],
  };
  const skinOf = s => {
    const o = s && typeof s === 'object' ? s : {};
    const pick = (k, v) => SKIN[k].some(x => x[0] === v) ? v : SKIN[k][0][0];
    return { theme: pick('theme', o.theme), frame: pick('frame', o.frame), font: pick('font', o.font) };
  };
  let fontsLoaded = false;
  function loadSkinFonts() {
    if (fontsLoaded) return; fontsLoaded = true;
    const add = href => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.crossOrigin = 'anonymous'; l.href = href; document.head.append(l); };
    add('https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Nanum+Pen+Script&family=Noto+Serif+KR:wght@400;700&display=swap');
    if (!document.querySelector('link[href*="galmuri"]')) add('https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/galmuri.css');
  }

  /* 색 계산 */
  const COLOR_RE = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|rgba?\([^)]*\)|(?<![-\w])(?:white|black)(?![-\w])/gi;
  function parseColor(t) {
    t = t.toLowerCase();
    if (t === 'white') return [255, 255, 255, 1]; if (t === 'black') return [0, 0, 0, 1];
    if (t[0] === '#') {
      let x = t.slice(1); if (x.length <= 4) x = [...x].map(c => c + c).join('');
      return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16), x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1];
    }
    const n = t.match(/[\d.]+%?/g); if (!n || n.length < 3) return null;
    const v = n.map(s => s.endsWith('%') ? parseFloat(s) * 2.55 : parseFloat(s));
    return [v[0], v[1], v[2], n[3] != null ? (n[3].endsWith('%') ? parseFloat(n[3]) / 100 : parseFloat(n[3])) : 1];
  }
  function toHSL([r, g, b]) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return { h: 0, s: 0, l };
    const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: h * 60, s, l };
  }
  function fromHSL({ h, s, l }) {
    s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [f(0), f(8), f(4)].map(v => Math.round(v * 255));
  }
  const hex = t => parseColor(t).slice(0, 3);
  const mixRGB = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const chroma = h => h.s * (1 - Math.abs(2 * h.l - 1));
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  /* 툴이 쓰는 색 통계: 무채색 밝기 범위, 유채색 계열(많이 쓴 순) */
  let toolStat = null;
  function statOf() {
    if (toolStat) return toolStat;
    const cnt = new Map();
    for (const sh of document.styleSheets) {
      if (!sh.ownerNode || sh.ownerNode.tagName !== 'STYLE' || /^skin-/.test(sh.ownerNode.id)) continue;
      let txt = ''; try { txt = [...sh.cssRules].map(r => r.cssText).join(''); } catch (e) { continue; }
      for (const m of txt.match(COLOR_RE) || []) { const c = parseColor(m); if (!c || c[3] < .6) continue; const k = c.slice(0, 3).join(','); cnt.set(k, (cnt.get(k) || 0) + 1); }
      COLOR_RE.lastIndex = 0;
    }
    let lmin = 1, lmax = 0; const hues = [];
    for (const [k, n] of cnt) {
      const h = toHSL(k.split(',').map(Number));
      if (chroma(h) < .12) { lmin = Math.min(lmin, h.l); lmax = Math.max(lmax, h.l); }
      else if (h.l > .25 && h.l < .8) hues.push({ h: h.h, n: n * chroma(h) });
    }
    hues.sort((a, b) => b.n - a.n);
    const centers = [];
    for (const x of hues) { if (centers.length >= 4) break; if (centers.every(c => Math.abs(((x.h - c + 540) % 360) - 180) > 38)) centers.push(x.h); }
    if (lmax - lmin < .3) { lmin = 0; lmax = 1; }
    /* 결과 화면 바탕이 어두운지 */
    let dark = false;
    for (let el = document.querySelector('.skin-root') || document.getElementById('poster') || document.body; el; el = el.parentElement) { const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g); if (m && (m[3] === undefined || +m[3] > .5)) { dark = lum(m.slice(0, 3).map(Number)) < .2; break; } }
    return (toolStat = { lmin, lmax, dark, centers: centers.length ? centers : [0] });
  }
  function mapColor(tok, pal) {
    const c = parseColor(tok); if (!c) return tok;
    const h = toHSL(c), st = statOf();
    let rgb;
    if (chroma(h) < .12) {
      /* 무채색: 툴 안 밝기 위치 → 테마의 글자~면 단계 */
      let t = Math.max(0, Math.min(1, (h.l - st.lmin) / (st.lmax - st.lmin)));
      /* 바탕이 어두운 툴은 어두운 쪽이 면이 되게 뒤집는다 */
      if (st.dark) t = 1 - t;
      const stops = [[0, pal.ink], [.45, pal.muted], [.8, pal.line], [.93, pal.bg], [1, pal.surface]];
      let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
      const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
      rgb = mixRGB(hex(c0), hex(c1), (t - t0) / (t1 - t0 || 1));
    } else {
      /* 유채색: 가장 가까운 계열의 테마 강조색, 원래 밝기 쪽으로 섞기 */
      let k = 0, best = 999;
      st.centers.forEach((cn, i) => { const d = Math.abs(((h.h - cn + 540) % 360) - 180); if (d < best) { best = d; k = i; } });
      const base = hex(pal.acc[k % pal.acc.length]);
      /* 바탕 쪽 밝기(밝은 툴은 밝은 색, 어두운 툴은 어두운 색)면 면 색에 가깝게, 글자 쪽이면 글자색에 가깝게 */
      const L = st.dark ? 1 - h.l : h.l;
      if (L > .8) rgb = mixRGB(base, hex(L > .93 ? pal.surface : pal.bg), Math.min(.97, .88 + (L - .8) * .6));
      else if (L > .66) rgb = mixRGB(base, hex(pal.surface), (L - .66) / .16 * .8);
      else if (L < .4) rgb = mixRGB(base, hex(pal.ink), Math.min(.85, (.4 - L) / .3));
      else rgb = base;
    }
    const [r, g, b] = rgb;
    return c[3] < 1 ? `rgba(${r},${g},${b},${+c[3].toFixed(3)})` : '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  /* 툴 페이지의 스타일 규칙을 읽어 테마용 규칙을 만든다 */
  const SHADOW = /shadow/i;
  function splitSel(sel) { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(s => s.trim()).filter(Boolean); }
  function prefixSel(sel, id) {
    const P = `html[data-skin-theme="${id}"]`;
    return splitSel(sel).map(s => {
      if (/^(:root|html)\b/.test(s)) return s.replace(/^(:root|html)/, P);
      return P + ' ' + s;
    }).join(',');
  }
  function themeRules(rules, id, fn) {
    let out = '';
    for (const r of rules) {
      if (r.cssRules && r.media) { const inner = themeRules(r.cssRules, id, fn); if (inner) out += `@media ${r.media.mediaText}{${inner}}`; continue; }
      if (r.cssRules && r.conditionText != null && !r.selectorText) { const inner = themeRules(r.cssRules, id, fn); if (inner) out += `@supports ${r.conditionText}{${inner}}`; continue; }
      if (!r.selectorText || !r.style) continue;
      /* 규칙 전체를 같은 접두로 옮겨 적어야 원래의 우선순위가 그대로 유지된다 (색만 바꿔서) */
      const txt = r.style.cssText; if (!txt) continue;
      /* 게임 화면처럼 그림 자체인 부분은 색을 그대로 둔다 (우선순위만 맞춰 옮겨 적음) */
      const keepRule = skinKeep && skinKeep.test(r.selectorText);
      const parts = []; let d = 0, q = '', cur = '';
      for (const ch of txt) {
        if (q) { if (ch === q) q = ''; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '(') d++; else if (ch === ')') d--; else if (ch === ';' && !d) { parts.push(cur); cur = ''; continue; }
        cur += ch;
      }
      parts.push(cur);
      const ds = parts.map(s => s.trim()).filter(Boolean).map(s => {
        const p = s.slice(0, s.indexOf(':'));
        if (keepRule || SHADOW.test(p) ||/url\(/.test(s)) return s;
        return s.replace(COLOR_RE, t => mapColor(t, fn));
      });
      /* 같은 규칙에 글자색과 바탕색이 같이 있으면 대비(4.5:1)를 맞춘다 */
      if (!keepRule) {
        const fi = ds.findIndex(s => /^color\s*:/.test(s)), bi = ds.findIndex(s => /^background(-color)?\s*:/.test(s));
        if (fi >= 0 && bi >= 0) {
          const fc = (ds[fi].match(COLOR_RE) || [])[0], bm = ds[bi].match(COLOR_RE) || []; COLOR_RE.lastIndex = 0;
          if (fc && bm.length === 1) {
            const f = parseColor(fc), b = parseColor(bm[0]);
            if (f && b && f[3] === 1 && b[3] === 1) {
              const dark = lum(b) > .4, to = hex(dark ? (lum(hex(fn.ink)) < lum(hex(fn.surface)) ? fn.ink : fn.surface) : (lum(hex(fn.ink)) > lum(hex(fn.surface)) ? fn.ink : fn.surface));
              let x = f.slice(0, 3), k = 0;
              while (contrast(x, b) < 4.5 && k < 1) { k += .12; x = mixRGB(f.slice(0, 3), to, Math.min(1, k)); }
              ds[fi] = 'color: #' + x.map(v => v.toString(16).padStart(2, '0')).join('') + (/!important/.test(ds[fi]) ? ' !important' : '');
            }
          }
        }
      }
      const decl = ds.join(';');
      if (decl) out += `${prefixSel(r.selectorText, id)}{${decl}}`;
    }
    return out;
  }
  const themeCache = {};
  let skinKeep = null;
  function themeSheet(id) {
    const t = SKIN.theme.find(x => x[0] === id); if (!t || !t[2]) return '';
    if (themeCache[id] != null) return themeCache[id];
    let css = '';
    for (const sh of document.styleSheets) {
      const own = sh.ownerNode; if (!own || own.id === 'skin-css' || own.id === 'skin-theme') continue;
      /* 툴 페이지 안의 <style>만 (사이트 공통 틀은 그대로) */
      if (own.tagName !== 'STYLE') continue;
      try { css += themeRules(sh.cssRules, id, t[2]); } catch (e) { /* 읽을 수 없는 시트 */ }
    }
    return (themeCache[id] = css);
  }
  function skinCSS() {
    if (document.getElementById('skin-css')) return;
    const st = document.createElement('style'); st.id = 'skin-css';
    st.textContent = SKIN.font.filter(f => f[2]).map(f => `html[data-skin-font="${f[0]}"] .skin-root,html[data-skin-font="${f[0]}"] .skin-root *{font-family:${f[2]} !important}`).join('\n') +
      `\nhtml[data-skin-font="pen"] .skin-root{font-size:1.1em}
.skin-btn[aria-expanded="true"]{box-shadow:inset 0 0 0 2px currentColor}
.skin-pop{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(78px + env(safe-area-inset-bottom,0px));z-index:30;width:min(560px,calc(100vw - 24px));max-height:min(72vh,520px);display:flex;flex-direction:column;background:#ececec;color:#141414;border:1px solid #141414;box-shadow:4px 4px 0 #141414;font:500 13px/1.4 'Pretendard Variable',system-ui,sans-serif}
.skin-pop[hidden]{display:none}
.skin-pop .sk-bar{display:flex;align-items:center;gap:8px;height:26px;padding:0 4px 0 8px;border-bottom:1px solid #141414;background:repeating-linear-gradient(180deg,#ececec 0 2px,#b5b5b5 2px 3px)}
.skin-pop .sk-bar b{background:#ececec;padding:0 8px;margin:0 auto;font:400 12px/18px var(--px,'Galmuri11',monospace)}
.skin-pop .sk-x{all:unset;box-sizing:border-box;width:18px;height:18px;border:1px solid #141414;background:#fff;display:grid;place-items:center;font:400 11px/1 var(--px,monospace);cursor:pointer}
.skin-pop .sk-body{overflow:auto;padding:12px;display:grid;gap:12px;background:#fff;margin:6px;border:1px solid #141414}
.skin-pop h4{margin:0 0 8px;display:flex;align-items:baseline;gap:8px;font-size:12px;font-weight:700;color:#141414}
.skin-pop h4 small{font-weight:500;color:#6b6b6b}
.skin-pop .sk-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px}
.skin-pop .sk-opt{all:unset;box-sizing:border-box;position:relative;display:flex;flex-direction:column;gap:6px;padding:6px;border:1px solid #c9c9c9;background:#fff;cursor:pointer;font-size:12px;color:#141414;text-align:left}
.skin-pop .sk-opt:hover{border-color:#141414}
.skin-pop .sk-opt[aria-pressed="true"]{border-color:#141414;box-shadow:2px 2px 0 #141414;background:#fffbe6}
.skin-pop .sk-opt[aria-pressed="true"]::after{content:"";position:absolute;top:5px;right:5px;width:7px;height:7px;background:#141414}
.skin-pop .sk-opt:focus-visible{outline:2px solid #2f6bff;outline-offset:2px}
.skin-pop .sk-pv{height:34px;border:1px solid rgba(0,0,0,.18);display:flex;align-items:center;padding:0 8px;gap:4px;font:700 14px/1 inherit}.skin-pop .sk-pv b{margin-right:auto}
.skin-pop .sk-pv i{width:12px;height:12px;border-radius:50%;flex:none}
.skin-pop .sk-fpv{height:34px;border:1px solid rgba(0,0,0,.18);display:grid;place-items:center}
.skin-pop .sk-fpv span{width:46%;height:52%;background:#fff;border:1px solid rgba(0,0,0,.2)}
.skin-pop .sk-tpv{height:34px;display:grid;place-items:center;font-size:17px;border:1px solid rgba(0,0,0,.12);background:#fafafa}
.skin-pop .sk-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:0 6px 6px}
.skin-pop .sk-foot p{margin:0;font-size:12px;color:#444}
.skin-pop .sk-reset{all:unset;box-sizing:border-box;min-height:28px;padding:0 10px;border:1px solid #141414;background:#ececec;box-shadow:1px 1px 0 #141414;font-size:12px;cursor:pointer}
.ph-slot{cursor:pointer;position:relative}.ph-slot::after{content:"사진 넣기";position:absolute;left:50%;bottom:6px;transform:translateX(-50%);padding:3px 8px;border-radius:999px;background:rgba(0,0,0,.62);color:#fff;font:600 11px 'Pretendard Variable',sans-serif;white-space:nowrap;opacity:0;transition:opacity .15s;pointer-events:none}.ph-slot:hover::after,.ph-slot:focus-visible::after{opacity:1}.ph-slot:focus-visible{outline:2px solid #2f6bff;outline-offset:2px}.ph-x{all:unset;position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.62);color:#fff;font:700 13px/20px sans-serif;text-align:center;cursor:pointer;opacity:0;transition:opacity .15s;z-index:3}.ph-slot:hover .ph-x,.ph-x:focus-visible{opacity:1}.capturing .ph-slot::after,.capturing .ph-x{display:none!important}
@media (max-width:560px){.skin-pop .sk-row{grid-template-columns:repeat(auto-fill,minmax(84px,1fr))}}`;
    document.head.append(st);
  }
  function applySkin(sk) {
    const h = document.documentElement;
    let st = document.getElementById('skin-theme');
    if (!st) { st = document.createElement('style'); st.id = 'skin-theme'; document.head.append(st); }
    st.textContent = themeSheet(sk.theme);
    h.dataset.skinTheme = sk.theme; h.dataset.skinFont = sk.font;
    if (sk.font !== 'base') loadSkinFonts();
    setTimeout(autoInk, 60);
  }

  /* ── 사진 칸 ──
     툴 화면에서 [data-photo="이름"] 칸을 누르면 사진을 골라 넣는다.
     사진은 이 브라우저에만 저장되고(공유 링크에는 안 실림, 링크가 너무 길어지므로) 이미지 저장에는 그대로 들어간다. */
  const PKEY = k => 'photo:' + location.pathname + ':' + k;
  function photo(k) { try { return localStorage.getItem(PKEY(k)) || ''; } catch (e) { return ''; } }
  function setPhoto(k, v) { try { if (v) localStorage.setItem(PKEY(k), v); else localStorage.removeItem(PKEY(k)); return true; } catch (e) { toast('사진이 너무 커서 넣지 못했어요'); return false; } }
  function shrink(file, max = 720) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onerror = rej; r.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .86)); }; im.src = r.result; }; r.readAsDataURL(file); });
  }
  function mountPhotos(root, again) {
    if (!root) return;
    root.querySelectorAll('[data-photo]').forEach(el => {
      const k = el.dataset.photo; el.classList.add('ph-slot'); el.setAttribute('role', 'button'); el.tabIndex = 0;
      el.setAttribute('aria-label', photo(k) ? '사진 바꾸기' : '사진 넣기');
      if (photo(k) && !el.querySelector('.ph-x')) { const x = document.createElement('button'); x.type = 'button'; x.className = 'ph-x'; x.setAttribute('aria-label', '사진 빼기'); x.textContent = '×'; x.onclick = e => { e.stopPropagation(); setPhoto(k, ''); again(); }; el.append(x); }
      const pick = () => { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.onchange = async () => { const file = f.files && f.files[0]; if (!file) return; try { if (setPhoto(k, await shrink(file))) { again(); toast('사진을 넣었어요'); } } catch (e) { toast('사진을 읽지 못했어요'); } }; f.click(); };
      el.onclick = e => { if (e.target.closest('.ph-x')) return; pick(); };
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
    });
  }

  /* ── 폼 생성 ──
     schema: [{title, en, desc, fields:[{k, label, type:text|textarea|select|range|color, opts:[[v,l]], full, rows, ph, min, max, num} | {sub:'소제목'}]}] */
  function buildForm(root, schema, state, onChange) {
    root.innerHTML = '';
    for (const sec of schema) {
      const box = document.createElement('section'); box.className = 'f-sec';
      box.innerHTML = `<h3>${esc(sec.title)}${sec.en ? `<small>${esc(sec.en)}</small>` : ''}</h3>${sec.desc ? `<p class="f-desc">${esc(sec.desc)}</p>` : ''}<div class="f-grid"></div>`;
      const grid = box.querySelector('.f-grid');
      for (const f of sec.fields) {
        if (f.sub) { const s = document.createElement('div'); s.className = 'f-sub'; s.textContent = f.sub; grid.append(s); continue; }
        const w = document.createElement('label'); w.className = 'f' + (f.full ? ' full' : '');
        const v = get(state, f.k);
        let input;
        if (f.type === 'textarea') { input = document.createElement('textarea'); input.rows = f.rows || 2; }
        else if (f.type === 'select') { input = document.createElement('select'); input.innerHTML = f.opts.map(([val, lab]) => `<option value="${esc(val)}">${esc(lab)}</option>`).join(''); }
        else { input = document.createElement('input'); input.type = f.type || 'text'; if (f.type === 'range') { input.min = f.min ?? 0; input.max = f.max ?? 100; input.step = 1; } }
        input.value = v ?? (f.type === 'range' ? 0 : '');
        if (f.ph) input.placeholder = f.ph;
        const lab = document.createElement('span'); lab.className = 'f-lab';
        lab.innerHTML = esc(f.label) + (f.type === 'range' ? `<output>${esc(v ?? 0)}</output>` : '');
        w.append(lab, input);
        input.addEventListener('input', () => {
          let val = input.value;
          if (f.type === 'range' || f.num) val = Number(val);
          set(state, f.k, val);
          if (f.type === 'range') lab.querySelector('output').textContent = val;
          onChange(f.k);
        });
        grid.append(w);
      }
      root.append(box);
    }
  }

  /* ── 앱 컨트롤러 ──
     cfg: { key, sample(), normalize(s), schema(s), prompts(s) -> [{label, sub, text}], apply(s, obj) -> 적용한 항목 이름 배열,
            progress(s) -> [{label, ok}], render(s, {animate}), fileName(s), posterSel } */
  /* 사용자가 고른 색 위의 글자: 배경이 밝으면 먹색, 어두우면 흰색 */
  function autoInk() {
    document.querySelectorAll('.av, [data-ink]').forEach(el => {
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g); if (!m || (m[3] !== undefined && +m[3] < .5)) return;
      const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
      const L = .2126 * f(+m[0]) + .7152 * f(+m[1]) + .0722 * f(+m[2]);
      el.style.color = L > .4 ? '#141414' : '#ffffff';
    });
  }
  /* 등장 애니메이션(투명→보임)이 브라우저 사정으로 멈춰 있어도, 끝날 시간이 지나면 무조건 보이게 푼다 */
  const ENTER = new Set(['lay', 'thud', 'fadeUp', 'fadein', 'evin', 'chIn', 'al']);
  function settleEntrances() {
    document.querySelectorAll('main *').forEach(el => { const n = getComputedStyle(el).animationName; if (n && ENTER.has(n)) el.style.animation = 'none'; });
  }
  function app(cfg) {
    /* 모든 OOC 둘째 줄에: 세계관·캐릭터·유저 노트·관계성을 참고하라는 지시 */
    const _prompts = cfg.prompts; cfg.prompts = s => _prompts(s).map(p => {
      const i = p.text.indexOf('\n');
      const withRef = p.text.includes(OOC_REF) || i < 0 ? p.text : p.text.slice(0, i + 1) + OOC_REF + '\n' + OOC_SAME + '\n' + p.text.slice(i + 1);
      return { ...p, text: squeezeOOC(withRef, namesIn(s)) }; });
    const _render = cfg.render; cfg.render =(s, o) => { const v = _render(s, o); document.querySelector(cfg.posterSel || '#poster')?.classList.add('skin-root'); mountPhotos($('#poster'), () => cfg.render(S, { animate: false })); setTimeout(autoInk, 30); setTimeout(autoInk, 600); setTimeout(settleEntrances, 3200); return v; };
    const ed = $('#editor'); if (ed && !ed.children.length) ed.innerHTML = editorHTML(cfg.what || '결과');
    /* PC 추천 안내(모든 툴) + Y2K 툴은 결과 화면을 창 틀 안에 넣는다 */
    const stage = document.querySelector('.stage'), poster = document.getElementById('poster');
    if (stage && !document.querySelector('.pc-note')) {
      const n = document.createElement('p'); n.className = 'pc-note shared-note';
      n.textContent = 'PC에서 보시는 걸 추천드려요. 휴대폰에서도 볼 수 있지만, 큰 화면에서 훨씬 잘 보여요.';
      stage.prepend(n);
      if (poster && document.querySelector('link[href*="y2k.css"]') && !document.body.hasAttribute('data-noframe')) {
        const fr = document.createElement('section'); fr.className = 'y-frame';
        fr.innerHTML = `<div class="y-title"><span class="y-title-t">${esc(document.title)}.exe</span><span class="y-title-b" aria-hidden="true"><i>_</i><i>□</i><i>×</i></span></div><div class="y-frame-b"></div>`;
        poster.before(fr); fr.lastChild.append(poster);
      }
    }
    const shared = readShare();
    const first = shared || store.get(cfg.key);
    let S = cfg.normalize(first || cfg.sample());
    /* 꾸미기 값은 툴 자체 정리(normalize)와 따로 지킨다 */
    let SK = skinOf(first && first.skin);
    const keepSkin = () => { S.skin = SK; };
    keepSkin();
    const strip = o => { const r = { ...o }; delete r.skin; return JSON.stringify(r); };
    /* 공유 링크로 열었으면 새로고침해도 유지되게 #d=를 두었다가, 처음 고칠 때 떼고 내 브라우저에 저장한다 */
    const save = () => { if (location.hash) history.replaceState(null, '', location.pathname); store.set(cfg.key, S); };
    const saveSoon = debounce(save, 300);
    const renderSoon = debounce(() => cfg.render(S, { animate: false }), 150);
    const copied = new Set();

    function mountForm() { buildForm($('#form'), cfg.schema(S), S, () => { saveSoon(); renderSoon(); mountProgress(); }); }
    function mountProgress(preview) {
      const el = $('#progress'); if (!el || !cfg.progress) return;
      /* 붙여넣기 칸에 답이 있으면: 적용하기 전에도 그 답을 넣었을 때의 체크를 바로 보여 준다 */
      if (preview) { el.classList.add('live'); el.innerHTML = cfg.progress(preview).map(p => `<span class="${p.ok ? 'ok' : ''}">${esc(p.label)}</span>`).join('') + '<em class="live-note">붙여넣은 답 미리 보기 · 적용하기를 누르면 들어가요</em>'; return; }
      el.classList.remove('live');
      /* 체크는 내가 붙여넣은 답이 들어올 때만 채운다: 예시 그대로면 전부 빈칸 */
      const ex = cfg.normalize(cfg.sample());
      const sample = strip(S) === strip(ex) ||!!(S.a && ex.a && S.b && ex.b && S.a.name === ex.a.name && S.b.name === ex.b.name);
      const base = sample && cfg.blank ? cfg.normalize(cfg.blank()) : S;
      el.innerHTML = cfg.progress(base).map(p => `<span class="${p.ok && !sample ? 'ok' : ''}">${esc(p.label)}</span>`).join('');
    }
    function mountPrompts() {
      const ps = cfg.prompts(S);
      $('#prompts').innerHTML = ps.map((p, i) => `
        <div class="pstep ${copied.has(i) ? 'is-done' : ''}"><span class="pnum">${i + 1}</span>
          <span class="plab">${esc(p.label)}<small>${esc(p.sub || '')} · <span class="${p.text.length > OOC_LIMIT ? 'over' : ''}">${p.text.length}자</span></small></span>
          <button class="btn small ${copied.has(i) ? 'done' : ''}" data-copy="${i}">${copied.has(i) ? '복사됨' : 'OOC 복사'}</button></div>`).join('');
    }
    $('#prompts').addEventListener('click', async e => {
      const b = e.target.closest('[data-copy]'); if (!b) return;
      const i = Number(b.dataset.copy); const ps = cfg.prompts(S);
      if (await copy(ps[i].text)) {
        copied.add(i); mountPrompts();
        toast(`${ps.length > 1 ? `${i + 1}/${ps.length}번을` : 'OOC를'} 복사했어요. AI 채팅에 보내고, 받은 답을 아래 칸에 붙여넣어 주세요`);
      } else toast('복사가 막혀 있어요. 길게 눌러 직접 복사해 주세요');
    });
    /* 붙여넣기 오류는 토스트가 아니라 칸 바로 아래에 남겨서, 무엇을 고치면 되는지 보이게 */
    const pasteEl = $('#paste');
    const errEl = document.createElement('p'); errEl.className = 'paste-err'; errEl.hidden = true; errEl.setAttribute('role', 'alert');
    pasteEl.after(errEl);
    const showErr = msg => { errEl.textContent = msg; errEl.hidden = !msg; pasteEl.classList.toggle('is-err', !!msg); };
    /* 붙여넣는 순간·고치는 동안 실시간 체크 (복사본에 넣어 보기만 하고 저장은 안 함) */
    let liveT = 0;
    const livePreview = () => {
      const raw = pasteEl.value;
      if (!raw.trim()) return mountProgress();
      const objs = extractJSON(raw);
      if (!objs.length) return mountProgress();
      try {
        const ex = cfg.normalize(cfg.sample());
        let P = JSON.parse(JSON.stringify(S));
        const isSample = strip(S) === strip(ex) || (S.a && ex.a && S.b && ex.b && S.a.name === ex.a.name && S.b.name === ex.b.name);
        if (isSample && cfg.blank) P = cfg.normalize(cfg.blank());
        const names = objs.flatMap(o => cfg.apply(P, o) || []);
        if (!names.length) return mountProgress();
        mountProgress(cfg.normalize(P));
      } catch (e) { mountProgress(); }
    };
    pasteEl.addEventListener('input', () => { showErr(''); clearTimeout(liveT); liveT = setTimeout(livePreview, 180); });
    $('#apply').addEventListener('click', () => {
      const raw = pasteEl.value;
      if (!raw.trim()) { showErr('AI 답변을 먼저 붙여넣어 주세요.'); pasteEl.focus(); return; }
      const objs = extractJSON(raw);
      if (!objs.length) { showErr('결과 데이터를 찾지 못했어요. AI 답변에서 ``` 로 감싼 코드 블록까지 통째로 복사해 붙여넣어 주세요. 답이 중간에 끊겼다면 "이어서 출력해"라고 보내 보세요.'); return; }
      /* 아직 예시 그대로면 먼저 비운다: AI가 빼먹은 항목에 예시 인물의 문장이 남아 섞이지 않게 */
      const ex = cfg.normalize(cfg.sample());
      const isSample = strip(S) === strip(ex) || (S.a && ex.a && S.b && ex.b && S.a.name === ex.a.name && S.b.name === ex.b.name);
      if (isSample && cfg.blank) { const keep = { a: S.a && S.a.pic, b: S.b && S.b.pic }; S = cfg.normalize(cfg.blank()); if (keep.a) S.a.pic = keep.a; if (keep.b) S.b.pic = keep.b; }
      const names = objs.flatMap(o => cfg.apply(S, o) || []);
      if (!names.length) { showErr('읽을 수 있는 항목이 없어요. 이 툴의 OOC로 받은 답이 맞는지 확인해 주세요.'); return; }
      S = cfg.normalize(S); keepSkin(); save(); mountForm(); mountProgress(); cfg.render(S, { animate: false });
      pasteEl.value = ''; showErr('');
      const cut = objs.some(o => o.__cut);
      toast(cut ? `답이 중간에 끊겨서 받은 데까지만 넣었어요 · ${[...new Set(names)].join(', ')}` : `적용했어요 · ${[...new Set(names)].join(', ')}`);
    });

    function setMode(m) {
      document.body.dataset.mode = m;
      $$('.tabs [data-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
      if (m === 'view') cfg.render(S, { animate: true });
      window.scrollTo({ top: 0 });
    }
    $$('.tabs [data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    $('#btn-png')?.addEventListener('click', () => savePNG($(cfg.posterSel || '#poster'), cfg.fileName(S), SK));

    /* 꾸미기 버튼 + 패널 */
    const skinEl = () => $(cfg.posterSel || '#poster');
    skinEl()?.classList.add('skin-root');
    if (cfg.skinKeep) skinKeep = new RegExp(cfg.skinKeep);
    if (cfg.skin === false) { SK = skinOf({}); keepSkin(); }
    /* 테마를 입히기 전 원래 모습 (기본 칩 미리 보기용) */
    const baseLook = (() => { let el = skinEl() || $('#poster') || document.body, bg = '#ffffff'; const ink = getComputedStyle(el).color; for (; el; el = el.parentElement) { const c = getComputedStyle(el).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; } } return { bg, ink }; })();
    skinCSS(); applySkin(SK);
    const acts = $('.actions');
    if (acts && cfg.skin !== false) {
      const btn = document.createElement('button'); btn.className = 'btn skin-btn'; btn.type = 'button'; btn.textContent = '꾸미기';
      btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'skin-pop');
      const png = $('#btn-png'); (png ? png.after(btn) : acts.append(btn));
      const pop = document.createElement('section'); pop.className = 'skin-pop'; pop.id = 'skin-pop'; pop.hidden = true; pop.setAttribute('aria-label', '꾸미기');
      document.body.append(pop);
      const opt = (k, x, inner) => `<button type="button" class="sk-opt" data-k="${k}" data-v="${x[0]}" aria-pressed="${SK[k] === x[0]}">${inner}<span>${esc(x[1])}</span></button>`;
      const themeOpt = x => {
        let bg, ink, dots;
        if (x[2]) { bg = x[2].surface; ink = x[2].ink; dots = x[2].acc.slice(0, 3); }
        else {
          bg = baseLook.bg; ink = baseLook.ink; dots = statOf().centers.slice(0, 3).map(h => `hsl(${Math.round(h)} 70% 52%)`);
        }
        return opt('theme', x, `<span class="sk-pv" style="background:${bg};color:${ink}"><b>가</b>${dots.map(d => `<i style="background:${d}"></i>`).join('')}</span>`);
      };
      const frameOpt = x => opt('frame', x, x[2] ? `<span class="sk-fpv" style="background:${x[2]}"><span></span></span>` : `<span class="sk-fpv" style="background:#fafafa"><span style="width:62%;height:70%"></span></span>`);
      const fontOpt = x => opt('font', x, `<span class="sk-tpv" style="font-family:${(x[2] || "'Pretendard Variable', sans-serif").replace(/"/g, "'")}">가나다</span>`);
      const paint = () => {
        pop.innerHTML = `<div class="sk-bar"><b>꾸미기</b><button type="button" class="sk-x" data-close aria-label="닫기">×</button></div>
          <div class="sk-body">
            <div><h4>테마<small>결과 화면 색</small></h4><div class="sk-row">${SKIN.theme.map(themeOpt).join('')}</div></div>
            <div><h4>이미지 배경<small>저장할 때 바깥 여백</small></h4><div class="sk-row">${SKIN.frame.map(frameOpt).join('')}</div></div>
            <div><h4>글꼴</h4><div class="sk-row">${SKIN.font.map(fontOpt).join('')}</div></div>
          </div>
          <div class="sk-foot"><p>이미지 저장과 링크에 그대로 들어가요.</p><button type="button" class="sk-reset" data-reset>처음대로</button></div>`;
      };
      const setOpen = o => { if (o) { loadSkinFonts(); paint(); } pop.hidden = !o; btn.setAttribute('aria-expanded', String(o)); };
      btn.addEventListener('click', () => setOpen(pop.hidden));
      pop.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.close !== undefined) { setOpen(false); btn.focus(); return; }
        if (b.dataset.reset !== undefined) SK = skinOf({}); else SK = { ...SK, [b.dataset.k]: b.dataset.v };
        keepSkin(); applySkin(SK); save(); paint(); if (b.dataset.k === 'theme' || b.dataset.reset !== undefined) cfg.render(S, { animate: false });
        pop.querySelector(`[data-k="${b.dataset.k}"][data-v="${b.dataset.v}"]`)?.focus();
      });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) { setOpen(false); btn.focus(); } });
      document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn) setOpen(false); });
    }
    $('#btn-link')?.addEventListener('click', async () => {
      const url = shareURL(S);
      (await copy(url)) ? toast('공유 링크를 복사했어요') : toast('복사가 막혀 있어요');
    });
    $('#btn-replay')?.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); cfg.render(S, { animate: true }); });
    $('#btn-sample')?.addEventListener('click', () => {
      if (!confirm('지금 내용을 지우고 예시로 바꿀까요?')) return;
      S = cfg.normalize(cfg.sample()); keepSkin(); save(); mountForm(); mountProgress(); cfg.render(S, { animate: false }); toast('예시로 바꿨어요');
    });
    $('#btn-clear')?.addEventListener('click', () => {
      if (!confirm('모든 내용을 비울까요? 되돌릴 수 없어요.')) return;
      S = cfg.normalize(cfg.blank()); keepSkin(); save(); mountForm(); mountProgress(); cfg.render(S, { animate: false }); toast('비웠어요');
    });

    if (shared) { const n = $('#shared-note'); if (n) n.hidden = false; }
    mountForm(); mountPrompts(); mountProgress();
    setMode('view');
    return { get state() { return S; } };
  }

  return { photo, $, $$, esc, br, pad, initial, rng, toMin, fmtMin, today, josa, clone, get, set, clamp, num, debounce, extractJSON, toast, copy, store, savePNG, buildForm, app };
})();
