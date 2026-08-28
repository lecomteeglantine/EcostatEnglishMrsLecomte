const vocab = window.ECOSTAT_VOCAB || [];
const interview = window.ECOSTAT_INTERVIEW || [];
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const PATHWAYS = ['EQUADE', 'DSI', 'IRF', 'GRAF'];
const VIEW_IDS = ['home', 'dictionary', 'flashcards', 'quiz', 'interview', 'progress', 'about'];
const validIds = new Set(vocab.map(e => Number(e.id)));

const store = {
  get(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
};

function cleanIdList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter(id => validIds.has(id)))];
}
function nonNegativeInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

let state = {
  fav: new Set(cleanIdList(store.get('eco_fav', []))),
  mastered: new Set(cleanIdList(store.get('eco_mastered', []))),
  attempts: nonNegativeInt(store.get('eco_attempts', 0)),
  correct: nonNegativeInt(store.get('eco_correct', 0)),
  path: 'ALL',
  page: 1,
  perPage: 24
};
state.correct = Math.min(state.correct, state.attempts);

let deferredPrompt = null;
let flashDeck = [];
let flashIndex = 0;
let quizCurrent = null;
let quizRound = { queue: [], target: 0, answered: 0, correct: 0, locked: false, finished: false };
let timerInterval = null;
let timerLeft = 90;
let lastInterviewQuestion = null;
let lastFocusedBeforeModal = null;

const accessibility = store.get('eco_a11y', {});

function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function normaliseText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function save() {
  store.set('eco_fav', [...state.fav]);
  store.set('eco_mastered', [...state.mastered]);
  store.set('eco_attempts', state.attempts);
  store.set('eco_correct', state.correct);
  updateStats();
}

function renderPathProgress() {
  const host = $('#pathProgress');
  if (!host) return;
  host.innerHTML = PATHWAYS.map(path => {
    const pool = vocab.filter(e => matchesPath(e, path));
    const mastered = pool.filter(e => state.mastered.has(e.id)).length;
    const pct = pool.length ? Math.round(mastered / pool.length * 100) : 0;
    return `<article class="path-progress-card panel">
      <div class="path-progress-head"><strong>${path}</strong><span>${mastered}/${pool.length}</span></div>
      <div class="meter" aria-label="${path}: ${pct}% mastered"><span style="width:${pct}%"></span></div>
      <p class="mini-note">${pct}% mastered</p>
    </article>`;
  }).join('');
}

function updateStats() {
  const acc = state.attempts ? `${Math.round(state.correct / state.attempts * 100)}%` : '—';
  const values = {
    statWords: vocab.length,
    statMastered: state.mastered.size,
    statFav: state.fav.size,
    statAccuracy: acc,
    pMastered: state.mastered.size,
    pFav: state.fav.size,
    pAccuracy: acc
  };
  for (const [id, value] of Object.entries(values)) {
    const el = $('#' + id);
    if (el) el.textContent = value;
  }
  if ($('#pAttempts')) {
    $('#pAttempts').textContent = state.attempts
      ? `${state.correct} correct out of ${state.attempts}`
      : 'No attempts yet';
  }
  if ($('#masterMeter')) {
    $('#masterMeter').style.width = `${vocab.length ? Math.min(100, state.mastered.size / vocab.length * 100) : 0}%`;
  }
  renderPathProgress();
}

function showView(id, { syncHash = true } = {}) {
  if (!VIEW_IDS.includes(id)) return;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === id));
  $$('.nav button').forEach(b => {
    const active = b.dataset.view === id;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  if (syncHash && location.hash !== `#${id}`) location.hash = id;
  const reduceMotion = document.body.classList.contains('reduce-motion') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  if (id === 'dictionary') renderDictionary();
  if (id === 'flashcards') buildFlashDeck();
  if (id === 'quiz' && !quizRound.target) startQuizRound();
  if (id === 'progress') updateStats();
}

function navigateTo(id) {
  if (location.hash === `#${id}`) showView(id, { syncHash: false });
  else location.hash = id;
}

$$('[data-view]').forEach(el => el.addEventListener('click', () => navigateTo(el.dataset.view)));
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (VIEW_IDS.includes(id)) showView(id, { syncHash: false });
});

let preferredVoice = null;
function refreshPreferredVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  preferredVoice = voices.find(v => /^en-GB$/i.test(v.lang)) || voices.find(v => /^en-GB/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) {
  refreshPreferredVoice();
  speechSynthesis.addEventListener?.('voiceschanged', refreshPreferredVoice);
}
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-GB';
  utterance.rate = 0.88;
  if (preferredVoice) utterance.voice = preferredVoice;
  speechSynthesis.speak(utterance);
}
window.speak = speak;

const cats = [...new Set(vocab.map(x => x.category))].sort();
for (const sel of [$('#catFilter'), $('#flashCat')].filter(Boolean)) {
  cats.forEach(c => {
    const option = document.createElement('option');
    option.value = c;
    option.textContent = c;
    sel.append(option);
  });
}

function matchesPath(entry, path) {
  if (path === 'ALL') return true;
  if (path === 'FAV') return state.fav.has(entry.id);
  if (path === 'COMMON') return entry.pathways.includes('COMMON');
  return entry.pathways.includes(path) || entry.pathways.includes('COMMON');
}

function filtered() {
  const q = normaliseText($('#search')?.value || '');
  const cat = $('#catFilter')?.value || '';
  const src = $('#sourceFilter')?.value || '';
  return vocab.filter(entry => {
    const haystack = normaliseText([entry.term, entry.fr, entry.definition, entry.category, entry.source, ...entry.pathways].join(' '));
    return matchesPath(entry, state.path) &&
      (!cat || entry.category === cat) &&
      (!src || entry.source === src) &&
      (!q || haystack.includes(q));
  });
}

function renderPager(pages) {
  const host = $('#pager');
  if (!host) return;
  if (pages <= 1) {
    host.innerHTML = '';
    return;
  }
  const start = Math.max(1, state.page - 2);
  const end = Math.min(pages, state.page + 2);
  const bits = [];
  bits.push(`<button data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''} aria-label="Previous page">←</button>`);
  if (start > 1) bits.push(`<button data-page="1" aria-label="Page 1">1</button>${start > 2 ? '<span aria-hidden="true">…</span>' : ''}`);
  for (let n = start; n <= end; n++) {
    bits.push(`<button data-page="${n}" ${n === state.page ? 'disabled aria-current="page"' : ''} aria-label="Page ${n}">${n}</button>`);
  }
  if (end < pages) bits.push(`${end < pages - 1 ? '<span aria-hidden="true">…</span>' : ''}<button data-page="${pages}" aria-label="Page ${pages}">${pages}</button>`);
  bits.push(`<button data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''} aria-label="Next page">→</button>`);
  host.innerHTML = bits.join('');
}

function renderDictionary() {
  const list = filtered();
  const pages = Math.max(1, Math.ceil(list.length / state.perPage));
  state.page = Math.max(1, Math.min(state.page, pages));
  $('#resultsMeta').textContent = `${list.length} entr${list.length === 1 ? 'y' : 'ies'} · page ${state.page}/${pages}`;
  const slice = list.slice((state.page - 1) * state.perPage, state.page * state.perPage);
  $('#wordGrid').innerHTML = slice.length ? slice.map(e => `<article class="word-card">
    <div class="visual" aria-hidden="true">${e.visual}</div>
    <div><h3>${e.term}</h3><div class="ipa">${e.ipa}</div><div class="translation">${e.fr}</div><p class="definition">${e.definition}</p>
      <div class="badges"><span class="badge">${e.category}</span>${e.pathways.map(p => `<span class="badge path">${p}</span>`).join('')}</div>
    </div>
    <div class="card-actions">
      <button class="smallbtn" data-speak="${e.id}" aria-label="Listen to ${e.term}">🔊</button>
      <button class="smallbtn ${state.fav.has(e.id) ? 'on' : ''}" data-fav="${e.id}" aria-label="${state.fav.has(e.id) ? 'Remove' : 'Add'} ${e.term} ${state.fav.has(e.id) ? 'from' : 'to'} favourites">★</button>
      <button class="smallbtn" data-open="${e.id}" aria-label="Open details for ${e.term}">↗</button>
    </div>
  </article>`).join('') : '<div class="empty-state panel"><h3>No matching words</h3><p>Try another spelling, pathway or category.</p></div>';
  renderPager(pages);
  bindCards();
}

function bindCards() {
  $$('[data-speak]').forEach(b => b.onclick = () => {
    const entry = vocab.find(x => x.id == b.dataset.speak);
    if (entry) speak(entry.term);
  });
  $$('[data-fav]').forEach(b => b.onclick = () => {
    const id = Number(b.dataset.fav);
    state.fav.has(id) ? state.fav.delete(id) : state.fav.add(id);
    save();
    renderDictionary();
  });
  $$('[data-open]').forEach(b => b.onclick = () => openWord(Number(b.dataset.open)));
  $$('[data-page]').forEach(b => b.onclick = () => {
    if (b.disabled) return;
    state.page = Number(b.dataset.page);
    renderDictionary();
    $('#resultsMeta')?.scrollIntoView({ block: 'start' });
  });
}

function openWord(id) {
  const e = vocab.find(x => x.id === id);
  if (!e) return;
  $('#wordModalBody').innerHTML = `<div style="font-size:4rem" aria-hidden="true">${e.visual}</div>
    <div class="eyebrow">${e.category}</div>
    <h2 id="wordModalTitle" style="font-size:2.2rem;margin:.2em 0">${e.term}</h2>
    <div class="ipa">${e.ipa}</div><h3>${e.fr}</h3><p>${e.definition}</p>
    <div class="badges">${e.pathways.map(p => `<span class="badge path">${p}</span>`).join('')}<span class="badge">${e.source}</span></div>
    <div class="hero-actions"><button class="ghost" onclick="speak(${JSON.stringify(e.term)})">🔊 Listen</button>
    <button class="primary" onclick="toggleMaster(${e.id})">${state.mastered.has(e.id) ? '✓ Mastered · click to unmark' : 'Mark as mastered'}</button></div>
    <p class="mini-note">Pronunciation uses an en-GB browser voice when one is available on your device.</p>`;
  openModal('wordModal');
}

window.toggleMaster = id => {
  id = Number(id);
  state.mastered.has(id) ? state.mastered.delete(id) : state.mastered.add(id);
  save();
  openWord(id);
};

$('#search').oninput = () => { state.page = 1; renderDictionary(); };
$('#catFilter').onchange = $('#sourceFilter').onchange = () => { state.page = 1; renderDictionary(); };
$$('#pathChips .chip').forEach(b => b.onclick = () => {
  $$('#pathChips .chip').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  state.path = b.dataset.path;
  state.page = 1;
  renderDictionary();
});
$$('[data-home-path]').forEach(b => b.onclick = () => {
  const path = b.dataset.homePath;
  state.path = path;
  state.page = 1;
  $$('#pathChips .chip').forEach(x => x.classList.toggle('active', x.dataset.path === path));
  navigateTo('dictionary');
});

function buildFlashDeck() {
  const path = $('#flashPath').value;
  const cat = $('#flashCat').value;
  const favOnly = $('#flashFav').checked;
  const unmasteredOnly = $('#flashUnmastered').checked;
  flashDeck = shuffle(vocab.filter(e =>
    matchesPath(e, path) &&
    (!cat || e.category === cat) &&
    (!favOnly || state.fav.has(e.id)) &&
    (!unmasteredOnly || !state.mastered.has(e.id))
  ));
  flashIndex = 0;
  renderFlash();
}

function renderFlash() {
  const card = $('#flashCard');
  if (!flashDeck.length) {
    card.innerHTML = '<div class="empty-state"><h3>No cards match these filters.</h3><p>Change the deck settings or uncheck a filter.</p></div>';
    $('#flashCount').textContent = '';
    $('#masterBtn').disabled = true;
    $('#speakFlash').disabled = true;
    return;
  }
  flashIndex = ((flashIndex % flashDeck.length) + flashDeck.length) % flashDeck.length;
  const e = flashDeck[flashIndex];
  card.classList.remove('flipped');
  card.innerHTML = `<div class="front"><div class="big-visual" aria-hidden="true">${e.visual}</div><div class="eyebrow">${e.category}</div><h2>${e.term}</h2><div class="ipa">${e.ipa}</div><p class="hint">Tap to reveal</p></div>
    <div class="back"><div class="big-visual" aria-hidden="true">${e.visual}</div><h2>${e.fr}</h2><p style="font-size:1.15rem">${e.definition}</p><div class="badges" style="justify-content:center">${e.pathways.map(p => `<span class="badge path">${p}</span>`).join('')}</div></div>`;
  card.setAttribute('aria-label', `Flip flashcard: ${e.term}`);
  $('#flashCount').textContent = `Card ${flashIndex + 1} of ${flashDeck.length}`;
  $('#masterBtn').disabled = state.mastered.has(e.id);
  $('#masterBtn').textContent = state.mastered.has(e.id) ? '✓ Mastered' : 'Mastered';
  $('#speakFlash').disabled = false;
}

$('#flashCard').onclick = () => $('#flashCard').classList.toggle('flipped');
$('#flashCard').onkeydown = e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    $('#flashCard').click();
  }
};
$('#againBtn').onclick = () => {
  if (!flashDeck.length) return;
  flashIndex = (flashIndex + 1) % flashDeck.length;
  renderFlash();
};
$('#masterBtn').onclick = () => {
  if (!flashDeck.length) return;
  const id = flashDeck[flashIndex].id;
  state.mastered.add(id);
  save();
  if ($('#flashUnmastered').checked) {
    flashDeck.splice(flashIndex, 1);
    if (flashIndex >= flashDeck.length) flashIndex = 0;
  } else {
    flashIndex = (flashIndex + 1) % flashDeck.length;
  }
  renderFlash();
};
$('#speakFlash').onclick = () => flashDeck.length && speak(flashDeck[flashIndex].term);
$('#shuffleFlash').onclick = buildFlashDeck;
$('#flashPath').onchange = $('#flashCat').onchange = $('#flashFav').onchange = $('#flashUnmastered').onchange = buildFlashDeck;

function quizPool() {
  const path = $('#quizPath').value;
  return vocab.filter(e => matchesPath(e, path));
}

function uniqueOptions(pool, current, mode) {
  const key = mode === 'fr' ? e => normaliseText(e.fr) : e => normaliseText(e.term);
  const seen = new Set([key(current)]);
  const alternatives = [];
  for (const entry of shuffle(pool)) {
    if (entry.id === current.id) continue;
    const k = key(entry);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    alternatives.push(entry);
    if (alternatives.length === 3) break;
  }
  return shuffle([...alternatives, current]);
}

function startQuizRound() {
  const pool = quizPool();
  if (pool.length < 4) {
    $('#quizCard').innerHTML = '<div class="empty-state"><h3>Not enough vocabulary for this round.</h3></div>';
    return;
  }
  quizRound = {
    queue: shuffle(pool).slice(0, Math.min(10, pool.length)),
    target: Math.min(10, pool.length),
    answered: 0,
    correct: 0,
    locked: false,
    finished: false
  };
  nextQuizQuestion();
}

function nextQuizQuestion() {
  if (quizRound.answered >= quizRound.target || !quizRound.queue.length) {
    finishQuizRound();
    return;
  }
  quizCurrent = quizRound.queue.shift();
  quizRound.locked = false;
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const mode = $('#quizMode').value;
  const n = quizRound.answered + 1;
  let html = `<div class="quiz-progress-row"><span>Question ${n} / ${quizRound.target}</span><span>${quizRound.correct} correct so far</span></div><div class="quiz-progress"><span style="width:${quizRound.target ? (quizRound.answered / quizRound.target * 100) : 0}%"></span></div>`;
  html += `<div class="question-visual" aria-hidden="true">${quizCurrent.visual}</div><div class="eyebrow">${quizCurrent.category}</div>`;
  if (mode === 'mcq') {
    html += `<h2>${quizCurrent.definition}</h2><p class="mini-note">Which word matches this definition?</p>`;
    const opts = uniqueOptions(quizPool(), quizCurrent, mode);
    html += `<div class="answers">${opts.map(o => `<button class="answer" data-qid="${o.id}">${o.term}</button>`).join('')}</div><div id="quizFeedback" class="quiz-feedback" role="status"></div>`;
  } else if (mode === 'fr') {
    html += `<h2>${quizCurrent.term}</h2><div class="ipa">${quizCurrent.ipa}</div><p class="mini-note">Choose the best French translation.</p>`;
    const opts = uniqueOptions(quizPool(), quizCurrent, mode);
    html += `<div class="answers">${opts.map(o => `<button class="answer" data-qid="${o.id}">${o.fr}</button>`).join('')}</div><div id="quizFeedback" class="quiz-feedback" role="status"></div>`;
  } else {
    html += `<h2>${quizCurrent.definition}</h2><p class="mini-note">Type the English term.</p><div class="type-input"><label class="sr-only" for="typeAnswer">English term</label><input id="typeAnswer" autocomplete="off" autocapitalize="none" spellcheck="false"><button id="checkType" class="primary">Check</button></div><div id="typeFeedback" class="quiz-feedback" role="status"></div>`;
  }
  $('#quizCard').innerHTML = html;
  $$('[data-qid]').forEach(b => b.onclick = () => checkChoice(b, Number(b.dataset.qid)));
  if ($('#checkType')) {
    $('#checkType').onclick = checkType;
    $('#typeAnswer').onkeydown = e => {
      if (e.key === 'Enter') checkType();
    };
    $('#typeAnswer').focus();
  }
  updateQuizScore();
}

function recordQuizResult(ok) {
  state.attempts++;
  quizRound.answered++;
  if (ok) {
    state.correct++;
    quizRound.correct++;
  }
  save();
  updateQuizScore();
}

function scheduleNextQuiz() {
  setTimeout(() => {
    if (quizRound.answered >= quizRound.target) finishQuizRound();
    else nextQuizQuestion();
  }, 950);
}

function checkChoice(btn, id) {
  if (quizRound.locked) return;
  quizRound.locked = true;
  const ok = id === quizCurrent.id;
  $$('.answer').forEach(b => { b.disabled = true; });
  if (ok) {
    btn.classList.add('correct');
    $('#quizFeedback').textContent = '✓ Correct';
  } else {
    btn.classList.add('wrong');
    const correctBtn = $(`[data-qid="${quizCurrent.id}"]`);
    if (correctBtn) correctBtn.classList.add('correct');
    $('#quizFeedback').innerHTML = `Not this time. Correct answer: <strong>${quizCurrent.term}</strong>.`;
  }
  recordQuizResult(ok);
  scheduleNextQuiz();
}

function normaliseAnswer(value) {
  return normaliseText(value)
    .replace(/^(an?|the|to)\s+/, '')
    .replace(/[^a-z0-9]+/g, '');
}

function checkType() {
  if (quizRound.locked) return;
  const input = $('#typeAnswer');
  const value = input.value.trim();
  if (!value) {
    $('#typeFeedback').textContent = 'Type an answer first.';
    input.focus();
    return;
  }
  quizRound.locked = true;
  input.disabled = true;
  $('#checkType').disabled = true;
  const ok = normaliseAnswer(value) === normaliseAnswer(quizCurrent.term);
  $('#typeFeedback').innerHTML = ok
    ? `✓ Correct — <strong>${quizCurrent.term}</strong>`
    : `Not this time. Expected: <strong>${quizCurrent.term}</strong>`;
  recordQuizResult(ok);
  scheduleNextQuiz();
}

function finishQuizRound() {
  quizRound.finished = true;
  quizRound.locked = true;
  const pct = quizRound.target ? Math.round(quizRound.correct / quizRound.target * 100) : 0;
  let message = 'Good start — review the missed vocabulary and try another round.';
  if (pct >= 90) message = 'Excellent recall. Increase the difficulty or switch pathway.';
  else if (pct >= 70) message = 'Solid result. One more round should consolidate it.';
  $('#quizCard').innerHTML = `<div class="quiz-summary"><div class="eyebrow">Round complete</div><strong>${quizRound.correct}/${quizRound.target}</strong><h2>${pct}%</h2><p>${message}</p><button id="restartRound" class="primary">Start another round</button></div>`;
  $('#restartRound').onclick = startQuizRound;
  updateQuizScore();
}

function updateQuizScore() {
  const lifetime = state.attempts ? Math.round(state.correct / state.attempts * 100) : 0;
  const roundText = quizRound.target ? `Round: ${quizRound.correct}/${quizRound.answered} correct` : 'Round not started';
  $('#quizScore').textContent = `${roundText} · Lifetime: ${state.correct}/${state.attempts}${state.attempts ? ` (${lifetime}%)` : ''}`;
}

$('#newQuiz').onclick = startQuizRound;
$('#quizMode').onchange = $('#quizPath').onchange = startQuizRound;

function interviewHasSpecificPath(q) {
  return PATHWAYS.some(path => q.tag.includes(path));
}
function interviewPool() {
  const path = $('#interviewPath').value;
  if (path === 'ALL') return interview;
  if (path === 'COMMON') return interview.filter(q => !interviewHasSpecificPath(q));
  return interview.filter(q => !interviewHasSpecificPath(q) || q.tag.includes(path));
}
function frameworkFor(q) {
  const tag = q.tag.toLowerCase();
  if (tag.includes('behavioural')) return {
    title: 'STAR',
    steps: ['Situation — give just enough context.', 'Task — say what you had to achieve.', 'Action — focus on what you personally did.', 'Result — finish with an outcome or lesson.'],
    starter: '“A good example would be…”'
  };
  if (tag.includes('ethics')) return {
    title: 'Ethical decision',
    steps: ['Principle — identify the professional or ethical issue.', 'Risk — explain what could go wrong.', 'Action — state the safest proportionate response.', 'Communication — say who you would inform and how.'],
    starter: '“The first issue I would consider is…”'
  };
  if (/technical|data|equade|dsi|irf|graf/.test(tag)) return {
    title: 'Technical explanation',
    steps: ['Define — explain the idea in one plain-English sentence.', 'Method — say how it works or how you would approach it.', 'Example — make it concrete.', 'Limitation — show that you understand assumptions or risks.'],
    starter: '“In simple terms, this means…”'
  };
  if (/tricky|curveball|salary|hypothetical|stress/.test(tag)) return {
    title: 'PREP under pressure',
    steps: ['Point — answer the question immediately.', 'Reason — justify your position.', 'Example — support it briefly.', 'Point — close with a clear takeaway.'],
    starter: '“My first reaction would be…”'
  };
  return {
    title: 'PREP',
    steps: ['Point — give your main answer.', 'Reason — explain why.', 'Example — add evidence or experience.', 'Point — finish clearly.'],
    starter: '“The main point I would make is…”'
  };
}
function renderInterviewFramework(q) {
  const f = frameworkFor(q);
  $('#interviewFramework').innerHTML = `<div class="framework-title"><strong>${f.title}</strong><span>${f.starter}</span></div><ol>${f.steps.map(step => `<li>${step}</li>`).join('')}</ol>`;
}
function newInterview() {
  const pool = interviewPool();
  if (!pool.length) return;
  let candidates = pool.filter(q => q.q !== lastInterviewQuestion);
  if (!candidates.length) candidates = pool;
  const q = candidates[Math.floor(Math.random() * candidates.length)];
  lastInterviewQuestion = q.q;
  $('#interviewQ').textContent = q.q;
  $('#interviewTag').textContent = q.tag;
  renderInterviewFramework(q);
  $('#interviewFramework').hidden = true;
  $('#frameworkBtn').setAttribute('aria-expanded', 'false');
  $('#frameworkBtn').textContent = 'Show answer framework';
  resetTimer();
}
function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerLeft = 90;
  $('#timer').textContent = '01:30';
  $('#timerBtn').textContent = 'Start 90-sec timer';
}
function fmt(sec) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}
$('#timerBtn').onclick = () => {
  if (timerInterval) {
    resetTimer();
    return;
  }
  $('#timerBtn').textContent = 'Reset timer';
  timerInterval = setInterval(() => {
    timerLeft--;
    $('#timer').textContent = fmt(Math.max(0, timerLeft));
    if (timerLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      $('#timerBtn').textContent = 'Time! — reset';
    }
  }, 1000);
};
$('#newInterview').onclick = newInterview;
$('#interviewPath').onchange = newInterview;
$('#frameworkBtn').onclick = () => {
  const panel = $('#interviewFramework');
  panel.hidden = !panel.hidden;
  const expanded = !panel.hidden;
  $('#frameworkBtn').setAttribute('aria-expanded', String(expanded));
  $('#frameworkBtn').textContent = expanded ? 'Hide answer framework' : 'Show answer framework';
};

function focusableIn(modal) {
  return $$('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])').filter(el => modal.contains(el) && !el.disabled && !el.hidden);
}
function openModal(id) {
  const modal = $('#' + id);
  if (!modal) return;
  lastFocusedBeforeModal = document.activeElement;
  modal.classList.add('open');
  document.body.classList.add('modal-open');
  const focusables = focusableIn(modal);
  focusables[0]?.focus();
}
function closeModal(id) {
  const modal = $('#' + id);
  if (!modal) return;
  modal.classList.remove('open');
  if (!$$('.modal.open').length) document.body.classList.remove('modal-open');
  if (lastFocusedBeforeModal?.focus) lastFocusedBeforeModal.focus();
}
$$('[data-close]').forEach(b => b.onclick = () => closeModal(b.dataset.close));
$$('.modal').forEach(m => m.onclick = e => { if (e.target === m) closeModal(m.id); });
document.addEventListener('keydown', e => {
  const modal = $('.modal.open');
  if (!modal) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeModal(modal.id);
    return;
  }
  if (e.key !== 'Tab') return;
  const items = focusableIn(modal);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
});
$('#a11yBtn').onclick = () => openModal('a11yModal');

function applyAccessibilitySettings() {
  for (const [id, cls] of [['largeText', 'large-text'], ['highContrast', 'high-contrast'], ['readable', 'readable'], ['reduceMotion', 'reduce-motion']]) {
    const el = $('#' + id);
    if (!el) continue;
    el.checked = !!accessibility[id];
    document.body.classList.toggle(cls, el.checked);
  }
}
for (const [id, cls] of [['largeText', 'large-text'], ['highContrast', 'high-contrast'], ['readable', 'readable'], ['reduceMotion', 'reduce-motion']]) {
  const el = $('#' + id);
  el.onchange = () => {
    document.body.classList.toggle(cls, el.checked);
    accessibility[id] = el.checked;
    store.set('eco_a11y', accessibility);
  };
}
applyAccessibilitySettings();

function appInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function refreshInstallUI() {
  const btn = $('#installHero'), hint = $('#installHint');
  if (!btn || !hint) return;
  if (appInstalled()) {
    btn.textContent = 'Installed';
    btn.disabled = true;
    hint.textContent = 'App installed on this device.';
  } else if (deferredPrompt) {
    btn.textContent = 'Install app';
    btn.disabled = false;
    hint.textContent = 'Ready to install on this device.';
  } else {
    btn.textContent = 'Install app';
    btn.disabled = false;
    hint.textContent = 'Install it once. Revise anywhere.';
  }
}
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  refreshInstallUI();
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  refreshInstallUI();
});
async function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    refreshInstallUI();
  } else openModal('installModal');
}
$('#installHero').onclick = installApp;

function renderSpotlight() {
  const host = $('#homeSpotlight');
  if (!host || !vocab.length) return;
  const course = vocab.filter(e => e.source === 'Course 2026');
  const pool = course.length ? course : vocab;
  const now = new Date();
  const dayKey = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
  const e = pool[Math.abs(dayKey) % pool.length];
  host.innerHTML = `<div class="spotlight-label">Word spotlight · ${e.category}</div><div class="spotlight-row"><div><div class="spotlight-term">${e.term}</div><div class="spotlight-ipa">${e.ipa}</div><div class="spotlight-fr">${e.fr}</div><p class="spotlight-definition">${e.definition}</p></div><div class="spotlight-actions"><button class="smallbtn" id="spotSpeak" aria-label="Listen to ${e.term}">🔊</button><button class="smallbtn" id="spotOpen" aria-label="Open ${e.term}">↗</button></div></div>`;
  $('#spotSpeak').onclick = () => speak(e.term);
  $('#spotOpen').onclick = () => openWord(e.id);
}

function downloadProgress() {
  const data = {
    version: 2,
    favourites: [...state.fav],
    mastered: [...state.mastered],
    attempts: state.attempts,
    correct: state.correct,
    accessibility: { ...accessibility },
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = 'ecostat-english-progress.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
$('#exportBtn').onclick = downloadProgress;
$('#importFile').onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    state.fav = new Set(cleanIdList(d.favourites));
    state.mastered = new Set(cleanIdList(d.mastered));
    state.attempts = nonNegativeInt(d.attempts);
    state.correct = Math.min(nonNegativeInt(d.correct), state.attempts);
    if (d.accessibility && typeof d.accessibility === 'object') {
      for (const key of ['largeText', 'highContrast', 'readable', 'reduceMotion']) accessibility[key] = !!d.accessibility[key];
      store.set('eco_a11y', accessibility);
      applyAccessibilitySettings();
    }
    save();
    renderDictionary();
    buildFlashDeck();
    alert('Progress imported.');
  } catch {
    alert('This file could not be imported.');
  } finally {
    e.target.value = '';
  }
};
$('#resetBtn').onclick = () => {
  if (confirm('Reset all favourites, mastery and quiz statistics?')) {
    state.fav.clear();
    state.mastered.clear();
    state.attempts = 0;
    state.correct = 0;
    save();
    buildFlashDeck();
    startQuizRound();
  }
};

function updateNetworkStatus() {
  const host = $('#networkStatus');
  if (!host) return;
  const online = navigator.onLine !== false;
  host.classList.toggle('offline', !online);
  const text = host.querySelector('b');
  if (text) text.textContent = online ? 'Online' : 'Offline';
}
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
updateNetworkStatus();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

updateStats();
renderSpotlight();
refreshInstallUI();
renderDictionary();
buildFlashDeck();
startQuizRound();
newInterview();
const initialView = VIEW_IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
showView(initialView, { syncHash: false });
