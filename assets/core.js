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
  async function savePNG(el, name) {
    if (!window.modernScreenshot) { toast('이미지 도구를 불러오지 못했어요. 새로고침 후 다시 해 주세요'); return; }
    toast('이미지 만드는 중…');
    try {
      await document.fonts.ready;
      el.classList.add('capturing');
      const bg = getComputedStyle(el).backgroundColor;
      const url = await modernScreenshot.domToPng(el, { scale: 2.5, backgroundColor: bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#ffffff' });
      const a = document.createElement('a'); a.href = url; a.download = (name || '2inbun').replace(/[\\/:*?"<>|]/g, '') + '.png'; a.click();
      toast('PNG로 저장했어요');
    } catch (e) { console.error(e); toast('이미지 저장에 실패했어요'); }
    finally { el.classList.remove('capturing'); }
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
    const _render = cfg.render; cfg.render =(s, o) => { const v = _render(s, o); setTimeout(autoInk, 30); setTimeout(autoInk, 600); setTimeout(settleEntrances, 3200); return v; };
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
    let S = cfg.normalize(shared || store.get(cfg.key) || cfg.sample());
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
      const sample = JSON.stringify(S) === JSON.stringify(ex) || !!(S.a && ex.a && S.b && ex.b && S.a.name === ex.a.name && S.b.name === ex.b.name);
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
        const isSample = JSON.stringify(S) === JSON.stringify(ex) || (S.a && ex.a && S.b && ex.b && S.a.name === ex.a.name && S.b.name === ex.b.name);
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
      const isSample = JSON.stringify(S) === JSON.stringify(ex) || (S.a && ex.a && S.b && ex.b && S.a.name === ex.a.name && S.b.name === ex.b.name);
      if (isSample && cfg.blank) { const keep = { a: S.a && S.a.pic, b: S.b && S.b.pic }; S = cfg.normalize(cfg.blank()); if (keep.a) S.a.pic = keep.a; if (keep.b) S.b.pic = keep.b; }
      const names = objs.flatMap(o => cfg.apply(S, o) || []);
      if (!names.length) { showErr('읽을 수 있는 항목이 없어요. 이 툴의 OOC로 받은 답이 맞는지 확인해 주세요.'); return; }
      S = cfg.normalize(S); save(); mountForm(); mountProgress(); cfg.render(S, { animate: false });
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
    $('#btn-png')?.addEventListener('click', () => savePNG($(cfg.posterSel || '#poster'), cfg.fileName(S)));
    $('#btn-link')?.addEventListener('click', async () => {
      const url = shareURL(S);
      (await copy(url)) ? toast('공유 링크를 복사했어요') : toast('복사가 막혀 있어요');
    });
    $('#btn-replay')?.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); cfg.render(S, { animate: true }); });
    $('#btn-sample')?.addEventListener('click', () => {
      if (!confirm('지금 내용을 지우고 예시로 바꿀까요?')) return;
      S = cfg.normalize(cfg.sample()); save(); mountForm(); mountProgress(); cfg.render(S, { animate: false }); toast('예시로 바꿨어요');
    });
    $('#btn-clear')?.addEventListener('click', () => {
      if (!confirm('모든 내용을 비울까요? 되돌릴 수 없어요.')) return;
      S = cfg.normalize(cfg.blank()); save(); mountForm(); mountProgress(); cfg.render(S, { animate: false }); toast('비웠어요');
    });

    if (shared) { const n = $('#shared-note'); if (n) n.hidden = false; }
    mountForm(); mountPrompts(); mountProgress();
    setMode('view');
    return { get state() { return S; } };
  }

  return { $, $$, esc, br, pad, initial, rng, toMin, fmtMin, today, josa, clone, get, set, clamp, num, debounce, extractJSON, toast, copy, store, savePNG, buildForm, app };
})();
