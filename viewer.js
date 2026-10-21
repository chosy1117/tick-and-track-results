// Tick & Track 휴대폰 결과 페이지
// 주소의 '#' 뒤 결과 코드(web/share.py 가 만든 것)를 이 휴대폰에서만 풀어서 그린다. 서버로 아무것도 보내지 않는다.
// 관계·상성·문장 계산은 touchdesigner/tarot_fortune.py 와 같은 규칙 (문장은 data.json 에서)

const $ = (id) => document.getElementById(id);
const E = { w: 'water', e: 'earth', a: 'air', f: 'fire' };
const FRIENDLY = [['fire', 'air'], ['water', 'earth']];
const OPPOSED = [['fire', 'water'], ['air', 'earth']];

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// 결과 코드 'v2.' + base64url(JSON 배열) -> 결과 (배열 순서는 web/share.py 설명과 같다)
function decode(hash) {
  const m = /^#v2\.([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
    return unpack(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (e) {
    return null;
  }
}
function fmtDate(s) {       // YYMMDDHHMM -> 2026.10.21 17:30
  return `20${s.slice(0, 2)}.${s.slice(2, 4)}.${s.slice(4, 6)} ${s.slice(6, 8)}:${s.slice(8, 10)}`;
}
function pairsOf(a, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push([a[2 * i], a[2 * i + 1]]);
  return out;
}
function unpack(a) {
  if (a[0] === 's') {
    return { m: 's', d: fmtDate(a[1]), a: a[2], h: a[3], sid: a[4], y: [a[5], a[6]], c: pairsOf(a.slice(7), 3) };
  }
  if (a[0] === 'g') {
    const n = a[3];
    const p = [];
    for (let i = 0; i < n; i++) p.push(a.slice(4 + 3 * i, 7 + 3 * i));
    return { m: 'g', d: fmtDate(a[1]), l: a[2], p, c: pairsOf(a.slice(4 + 3 * n), 4) };
  }
  return null;
}

// ---------- tarot_fortune.py 와 같은 계산 ----------
function dignity(a, b) {
  if (a === b) return 'same';
  const has = (list) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  if (has(FRIENDLY)) return 'friendly';
  if (has(OPPOSED)) return 'opposed';
  return 'neutral';
}
function reduceMajor(n) {
  n = Math.abs(Math.trunc(n));
  while (n > 22) n = String(n).split('').reduce((s, d) => s + Number(d), 0);
  return n === 22 ? 0 : n;
}
const ageCard = (age) => reduceMajor(age);
function ageLabel(age) {
  const lo = Math.max(10, Math.floor(age / 5) * 5);
  return lo >= 80 ? '80세 이상' : `${lo}~${lo + 4}세`;
}
function songTier(bpm) {
  if (bpm < 90) return 'slow';
  if (bpm >= 130) return 'peak';
  if (bpm >= 115) return 'fast';
  return 'mid';
}
const memberLabel = (i, age) => `${i + 1}번(${age}세)`;

function placement(D, position, id, rev) {
  const c = D.cards[id];
  return { position, id, c, rev: !!rev, keywords: rev ? c.r : c.u, message: rev ? c.mr : c.m };
}
// 카드 그림(cards/<id>.jpg, 역방향이면 뒤집기) 옆에 자리·이름·키워드·한 줄 운세
function cardHTML(p) {
  return `<div class="card"><div class="ci ${p.rev ? 'rev' : ''}"><img src="cards/${esc(p.id)}.jpg" alt="${esc(p.c.n)}"></div>` +
    `<div class="ct"><div class="p">${esc(p.position)}</div>` +
    `<div class="n">${esc(p.c.n)}${p.rev ? '<small>역방향</small>' : ''}</div>` +
    `<div class="k">${esc(p.keywords)}</div><div class="m">${esc(p.message)}</div></div></div>`;
}

// ---------- 혼자 ----------
function renderSolo(D, r) {
  const T = D.text;
  const song = D.songs[r.sid];
  const P = ['나이 카드', '심박 카드', '조언 카드'].map((pos, i) => placement(D, pos, r.c[i][0], r.c[i][1]));
  const [age, heart, advice] = P;
  const songCard = song && song.c ? placement(D, '노래 카드', song.c, 0) : null;
  const lines = ['기운의 흐름 · ' + T.dignity[dignity(heart.c.e, advice.c.e)]];
  if (songCard) {
    lines.push(T.song_flow[dignity(songCard.c.e, heart.c.e)]);
    if (songCard.c === age.c) lines.push('노래 카드가 내 나이 카드와 같아요. 노래가 당신의 카드를 한 번 더 불러냈어요');
    else {
      outer: for (const p of P) for (const w of song.th) if (p.keywords.includes(w)) {
        lines.push(`노래도 ${p.position}도 '${w}'을(를) 말하고 있어요`);
        break outer;
      }
    }
  }
  document.body.className = song ? songTier(song.b) : '';
  return `<div class="top"><span class="brand">TICK &amp; TRACK</span><span class="date">${esc(r.d)}</span></div>` +
    '<h1>나의 심박과 오늘의 타로</h1>' +
    `<div class="hr"><b>${r.h}</b><span>BPM</span></div>` +
    `<div class="meta">${ageLabel(r.a)} · 청소년기 ${r.y[0]}–${r.y[1]}년</div><hr>` +
    '<div class="label">♪ 그 시절 나의 노래</div>' +
    (song ? `<div class="song">${esc(song.t)}</div><div class="song-meta">${esc(song.a)} · ${song.y}년 · ${song.b} BPM · ${esc(song.tl)}</div>`
      : '<div class="song-meta">노래 정보를 찾지 못했어요</div>') +
    (song && song.me ? `<div class="meaning">${esc(song.me)}</div>` : '') + '<hr>' +
    '<div class="label">오늘의 타로</div>' + P.concat(songCard ? [songCard] : []).map(cardHTML).join('') +
    `<div class="lines">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>` +
    '<div class="foot">Tick &amp; Track · 심박이 고른 노래와 타로</div>';
}

// ---------- 여러 명 ----------
function groupReading(D, g) {
  const T = D.text;
  const members = g.p.map(([age, hr, e], i) => ({ i, age, hr, el: E[e], label: memberLabel(i, age) }));
  const els = Object.keys(T.element);
  const counts = Object.fromEntries(els.map((e) => [e, members.filter((m) => m.el === e).length]));
  const top = Math.max(...Object.values(counts));
  const dominant = els.filter((e) => counts[e] === top);
  const lacks = els.filter((e) => counts[e] === 0);
  let mood;
  if (!lacks.length && top - Math.min(...Object.values(counts)) <= 1) mood = T.group_balanced;
  else if (dominant.length >= 3) mood = T.group_mixed;
  else mood = dominant.map((e) => T.group_mood[e]).join(' / ');
  const spread = ['그룹 카드', '모임의 지금', '모임의 과제', '모임에게 주는 조언'].map((pos, i) => placement(D, pos, g.c[i][0], g.c[i][1]));
  const majors = Object.values(D.cards).filter((c) => c.s === 'major');
  const majorOf = (k) => majors.find((c) => c.k === k);
  const pairs = [];
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
    const a = members[i], b = members[j];
    const d = dignity(a.el, b.el);
    pairs.push({ i, j, a, b, d, score: D.pair_score[d], rel: majorOf(reduceMajor(ageCard(a.age) + ageCard(b.age))) });
  }
  const totals = members.map((m) => pairs.filter((p) => p.i === m.i || p.j === m.i).reduce((s, p) => s + p.score, 0));
  const best = Math.max(...totals);
  const hub = best > 0 && totals.filter((t) => t === best).length === 1 ? totals.indexOf(best) : null;
  const bridges = [];
  for (const p of pairs) {
    if (p.d !== 'opposed') continue;
    for (const c of members) {
      if (c.i === p.i || c.i === p.j) continue;
      const da = dignity(c.el, p.a.el), db = dignity(c.el, p.b.el);
      if (da !== 'opposed' && db !== 'opposed' && (da === 'friendly' || db === 'friendly')) bridges.push([c.i, p]);
    }
  }
  const nb = members.map((m) => bridges.filter(([k]) => k === m.i).length);
  const nbMax = Math.max(...nb);
  const mediator = nbMax > 0 && nb.filter((n) => n === nbMax).length === 1 ? nb.indexOf(nbMax) : null;
  pairs.sort((x, y) => y.score - x.score || x.i - y.i || x.j - y.j);
  return { T, members, counts, mood, lacks, spread, pairs, hub, mediator, bridges };
}

let G = null;          // 모임 계산 결과 (사람 칩을 누를 때 다시 그림)
let focus = null;

function renderGroup(D, g) {
  G = G || groupReading(D, g);
  const { T, members, mood, lacks, spread, pairs, hub, mediator, bridges } = G;
  const notes = lacks.map((e) => '필요한 것 · ' + T.group_lack[e]);
  if (g.l) notes.push(`이 모임의 플레이리스트는 ${T.element[E[g.l]]}의 기운이에요`);
  const roles = [];
  if (hub !== null) roles.push('모두와 잘 통하는 사람 · ' + members[hub].label);
  if (mediator !== null) roles.push('사이를 이어 주는 사람 · ' + members[mediator].label);
  const shown = focus === null ? pairs : pairs.filter((p) => p.i === focus || p.j === focus);
  document.body.className = '';
  return `<div class="top"><span class="brand">TICK &amp; TRACK</span><span class="date">${esc(g.d)}</span></div>` +
    `<h1>모임 ${members.length}명의 관계 운세</h1>` +
    `<div class="mood">${esc(mood)}</div>` +
    `<div class="lines" style="margin-top:8px">${notes.map((l) => `<p>${esc(l)}</p>`).join('')}</div><hr>` +
    '<div class="label">모임 종합 운세</div>' + spread.map(cardHTML).join('') +
    `<div class="lines"><p>흐름 · ${esc(T.group_flow[dignity(spread[1].c.e, spread[2].c.e)])}</p>` +
    roles.map((r) => `<p>${esc(r)}</p>`).join('') + '</div><hr>' +
    `<div class="label">두 사람씩 (${pairs.length}쌍)</div>` +
    `<div class="chips">${members.map((m) => `<button class="chip ${focus === m.i ? 'on' : ''}" data-i="${m.i}">${esc(m.label)} ${m.hr}BPM</button>`).join('')}</div>` +
    shown.map((p) => {
      const ks = bridges.filter(([, q]) => q === p).map(([k]) => members[k].label);
      return `<div class="pair"><div class="w"><span>${esc(p.a.label)} × ${esc(p.b.label)}</span>` +
        `<span class="d ${p.d}">${esc(T.dignity_short[p.d])}</span></div>` +
        `<div class="r">관계 카드 <b>${esc(p.rel.n)}</b> · ${esc(p.rel.m)}</div>` +
        (ks.length ? `<div class="b">이어 주는 사람 · ${esc(ks.join(', '))}</div>` : '') + '</div>';
    }).join('') +
    '<div class="foot">Tick &amp; Track · 심박으로 본 우리의 관계 · 이름을 눌러 그 사람의 관계만 보기</div>';
}

// ---------- 시작 ----------
async function main() {
  const r = decode(location.hash);
  const root = $('result');
  if (!r) {
    root.innerHTML = '<div class="intro"><div class="brand">TICK &amp; TRACK</div>' +
      '<p>전시장 화면의 QR 을 찍으면<br>내 결과가 이 화면에 열려요</p></div>';
    return;
  }
  const D = await (await fetch('data.json')).json();
  const draw = () => { root.innerHTML = r.m === 'g' ? renderGroup(D, r) : renderSolo(D, r); };
  draw();
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const i = Number(b.dataset.i);
    focus = focus === i ? null : i;
    draw();
  });
  $('actions').hidden = false;
  $('save').addEventListener('click', () => saveImage(root));
}

async function saveImage(node) {
  const btn = $('save');
  btn.disabled = true;
  btn.textContent = '이미지 만드는 중…';
  try {
    const blob = await htmlToImage.toBlob(node, { pixelRatio: 3, backgroundColor: '#0e0c16' });
    const file = new File([blob], 'tick-and-track.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });             // 휴대폰: 사진에 저장 / 공유
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tick-and-track.png';
      a.click();
    }
  } catch (e) {
    if (e.name !== 'AbortError') alert('이미지를 만들지 못했어요. 화면을 캡처해 주세요.');
  }
  btn.disabled = false;
  btn.textContent = '이미지로 저장';
}

main();
