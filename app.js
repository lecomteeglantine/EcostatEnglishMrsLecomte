(() => {
  'use strict';

  const VERSION = '6.0.1';
  const A11Y_KEY = 'eco_a11y';
  const PROGRAMMES = ['EQUADE', 'DSI', 'IRF', 'GRAF'];
  const PATHS = ['COMMON', ...PROGRAMMES];
  const PAGE_SIZE = 24;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const text = value => String(value ?? '');
  const esc = value => text(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const norm = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const normaliseAnswer = value => norm(value).replace(/^(an?|the|to)\s+/, '').replace(/[^a-z0-9]+/g, '');
  const shuffle = values => {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const pick = values => values.length ? values[Math.floor(Math.random() * values.length)] : null;
  const unique = values => [...new Set(values)];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const vocab = (Array.isArray(window.ECOSTAT_VOCAB) ? window.ECOSTAT_VOCAB : []).filter(item =>
    item && Number.isFinite(Number(item.id)) && text(item.term).trim() && text(item.definition).trim()
  );
  const interview = (Array.isArray(window.ECOSTAT_INTERVIEW) ? window.ECOSTAT_INTERVIEW : []).filter(item => item && text(item.q).trim());
  const collocations = (Array.isArray(window.ECOSTAT_COLLOCATIONS) ? window.ECOSTAT_COLLOCATIONS : []).filter(item => item && text(item.lead).trim() && text(item.tail).trim());
  const pronunciation = (Array.isArray(window.ECOSTAT_PRONUNCIATION) ? window.ECOSTAT_PRONUNCIATION : []).filter(item => item && text(item.term).trim());
  const frenglish = (Array.isArray(window.ECOSTAT_FRENGLISH) ? window.ECOSTAT_FRENGLISH : []).filter(item => item && text(item.wrong).trim() && text(item.right).trim());
  const charts = (Array.isArray(window.ECOSTAT_CHARTS) ? window.ECOSTAT_CHARTS : []).filter(item => item && text(item.title).trim() && Array.isArray(item.values));
  const validIds = new Set(vocab.map(item => Number(item.id)));

  function readJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  const stored = {
    programme: readJSON('eco_programme', ''),
    favourites: readJSON('eco_fav', []),
    mastered: readJSON('eco_mastered', []),
    attempts: readJSON('eco_attempts', 0),
    correct: readJSON('eco_correct', 0),
    skillAttempts: readJSON('eco_skill_attempts', 0),
    skillCorrect: readJSON('eco_skill_correct', 0)
  };
  const state = {
    programme: PROGRAMMES.includes(stored.programme) ? stored.programme : '',
    favourites: new Set((Array.isArray(stored.favourites) ? stored.favourites : []).map(Number).filter(id => validIds.has(id))),
    mastered: new Set((Array.isArray(stored.mastered) ? stored.mastered : []).map(Number).filter(id => validIds.has(id))),
    attempts: Math.max(0, Math.floor(Number(stored.attempts) || 0)),
    correct: Math.max(0, Math.floor(Number(stored.correct) || 0)),
    skillAttempts: Math.max(0, Math.floor(Number(stored.skillAttempts) || 0)),
    skillCorrect: Math.max(0, Math.floor(Number(stored.skillCorrect) || 0)),
    path: 'ALL',
    page: 1,
    perPage: PAGE_SIZE
  };
  state.correct = Math.min(state.correct, state.attempts);
  state.skillCorrect = Math.min(state.skillCorrect, state.skillAttempts);

  function saveState() {
    const entries = {
      eco_programme: state.programme,
      eco_fav: [...state.favourites],
      eco_mastered: [...state.mastered],
      eco_attempts: state.attempts,
      eco_correct: state.correct,
      eco_skill_attempts: state.skillAttempts,
      eco_skill_correct: state.skillCorrect
    };
    try {
      Object.entries(entries).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
    } catch (_) {}
    updateStats();
  }

  function pathList(item) {
    const raw = Array.isArray(item?.pathways) ? item.pathways : [item?.path].filter(Boolean);
    return raw.map(text);
  }

  function pathMatches(item, requested) {
    const paths = pathList(item);
    if (!requested || requested === 'ALL') return true;
    if (requested === 'MY') return state.programme ? (paths.includes('COMMON') || paths.includes(state.programme)) : true;
    if (requested === 'COMMON') return paths.includes('COMMON');
    return paths.includes(requested) || paths.includes('COMMON');
  }

  function skillPathMatches(item, requested) {
    const path = text(item?.path);
    if (!requested || requested === 'ALL') return true;
    if (requested === 'MY') return state.programme ? (path === 'COMMON' || path === state.programme) : true;
    return path === 'COMMON' || path === requested;
  }

  function interviewMatches(item, requested) {
    if (!requested || requested === 'ALL') return true;
    const tag = text(item?.tag).toUpperCase();
    if (requested === 'MY') return !state.programme || !PROGRAMMES.some(p => tag.startsWith(`${p} /`)) || tag.startsWith(`${state.programme} /`);
    if (requested === 'COMMON') return !PROGRAMMES.some(p => tag.startsWith(`${p} /`));
    return !PROGRAMMES.some(p => tag.startsWith(`${p} /`)) || tag.startsWith(`${requested} /`);
  }

  function showDataHealth() {
    const host = $('#dataAlert');
    if (!host) return;
    if (vocab.length) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    host.hidden = false;
    host.innerHTML = `
      <div><strong>Vocabulary data did not load.</strong>
      <span>The app has protected itself instead of showing broken exercises. This can happen when an old offline cache serves mismatched files.</span></div>
      <button type="button" class="ghost" id="repairDataBtn">Repair data load</button>`;
    $('#repairDataBtn')?.addEventListener('click', repairDataLoad);
  }

  async function repairDataLoad() {
    const button = $('#repairDataBtn');
    if (button) { button.disabled = true; button.textContent = 'Repairing…'; }
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('ecostat-english-')).map(key => caches.delete(key)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(reg => reg.unregister()));
      }
    } catch (_) {}
    const clean = `${location.pathname}?repair=${Date.now()}#home`;
    location.replace(clean);
  }

  let lastFocused = null;
  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    lastFocused = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const focusable = $('button, input, select, textarea, [tabindex]:not([tabindex="-1"])', modal);
    focusable?.focus();
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (!$$('.modal.open').length) document.body.classList.remove('modal-open');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function handleModalKeydown(event) {
    if (event.key === 'Escape') {
      const open = $('.modal.open');
      if (open) closeModal(open.id);
      return;
    }
    if (event.key !== 'Tab') return;
    const modal = $('.modal.open');
    if (!modal) return;
    const focusable = $$('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', modal)
      .filter(el => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function currentView() {
    return $('.view.active')?.id || 'home';
  }

  function cleanupTimedActivities(nextView) {
    if (nextView !== 'interview') stopInterviewTimer(false);
    if (nextView !== 'skills') stopBlitzTimer(false);
    if (nextView !== 'quiz' && quizAdvanceTimeout) {
      clearTimeout(quizAdvanceTimeout);
      quizAdvanceTimeout = null;
    }
  }

  function navigateTo(view, updateHash = true) {
    if (!document.getElementById(view)) view = 'home';
    cleanupTimedActivities(view);
    $$('.view').forEach(section => section.classList.toggle('active', section.id === view));
    $$('.nav [data-view]').forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    if (updateHash && location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
    window.scrollTo({ top: 0, behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' });
    if (view === 'dictionary') renderDictionary();
    if (view === 'flashcards') buildFlashDeck();
    if (view === 'quiz' && !quizRound.length) startQuiz();
    if (view === 'pronunciation') renderPronunciation();
    if (view === 'skills') renderSkill();
    if (view === 'interview') renderInterview();
    if (view === 'progress') renderProgress();
  }

  function speak(value, rate = 0.92) {
    if (!('speechSynthesis' in window) || !text(value).trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text(value));
    utterance.lang = 'en-GB';
    utterance.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const british = voices.find(v => /^en-GB/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
    if (british) utterance.voice = british;
    window.speechSynthesis.speak(utterance);
  }

  function populateFilters() {
    const categories = unique(vocab.map(item => text(item.category)).filter(Boolean)).sort((a, b) => a.localeCompare(b));
    const sources = unique(vocab.map(item => text(item.source)).filter(Boolean)).sort((a, b) => a.localeCompare(b));
    const fill = (select, values, firstLabel) => {
      if (!select) return;
      const current = select.value;
      select.innerHTML = `<option value="">${esc(firstLabel)}</option>` + values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
      if (values.includes(current)) select.value = current;
    };
    fill($('#catFilter'), categories, 'All categories');
    fill($('#flashCat'), categories, 'All categories');
    fill($('#sourceFilter'), sources, 'All sources');
  }

  function setProgramme(programme) {
    if (!PROGRAMMES.includes(programme)) return;
    state.programme = programme;
    ['flashPath', 'quizPath', 'pronPath', 'skillPath', 'interviewPath'].forEach(id => {
      const select = document.getElementById(id);
      if (select && [...select.options].some(option => option.value === 'MY')) select.value = 'MY';
    });
    saveState();
    updateProgrammeUI();
    syncMyProgrammeSelects();
    renderHomeSpotlight();
  }

  function updateProgrammeUI() {
    const label = state.programme || 'Not selected yet';
    const status = $('#programmeStatus strong');
    if (status) status.textContent = label;
    if ($('#progressProgramme')) $('#progressProgramme').textContent = state.programme || 'Not selected';
    $$('.pathway-jump[data-programme]').forEach(button => {
      const selected = button.dataset.programme === state.programme;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function syncMyProgrammeSelects() {
    ['flashPath', 'quizPath', 'pronPath', 'skillPath', 'interviewPath'].forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      const option = [...select.options].find(o => o.value === 'MY');
      if (option) option.textContent = state.programme ? `MY PROGRAMME · ${state.programme}` : 'MY PROGRAMME';
    });
  }

  function renderHomeSpotlight() {
    const host = $('#homeSpotlight');
    if (!host) return;
    const course = vocab.filter(item => item.source === 'Course 2026');
    const pool = course.length ? course : vocab;
    const now = new Date();
    const dayKey = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
    const item = pool.length ? pool[Math.abs(dayKey) % pool.length] : null;
    if (!item) {
      host.innerHTML = `<div class="spotlight-label">Word spotlight</div><p class="mini-note">Vocabulary unavailable.</p>`;
      return;
    }
    host.innerHTML = `
      <div class="spotlight-label">Word spotlight</div>
      <div class="spotlight-row"><div>
        <div class="spotlight-term">${esc(item.term)}</div>
        <div class="spotlight-ipa">${esc(item.ipa || '')}</div>
        <div class="spotlight-fr">${esc(item.fr || '')}</div>
      </div><div class="spotlight-actions"><button type="button" class="smallbtn" data-spot-speak aria-label="Listen to ${esc(item.term)}">🔊</button><button type="button" class="smallbtn" data-spot-open aria-label="Open ${esc(item.term)}">→</button></div></div>
      <p class="spotlight-definition">${esc(item.definition)}</p>`;
    $('[data-spot-speak]', host)?.addEventListener('click', () => speak(item.term));
    $('[data-spot-open]', host)?.addEventListener('click', () => openWord(item.id));
  }

  function filteredDictionary() {
    const query = norm($('#search')?.value);
    const category = text($('#catFilter')?.value);
    const source = text($('#sourceFilter')?.value);
    return vocab.filter(item => {
      if (state.path === 'FAV' && !state.favourites.has(Number(item.id))) return false;
      if (state.path !== 'FAV' && !pathMatches(item, state.path)) return false;
      if (category && item.category !== category) return false;
      if (source && item.source !== source) return false;
      if (query) {
        const haystack = norm([item.term, item.fr, item.definition, item.category, item.source, item.example, ...(item.pathways || [])].join(' '));
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  function renderDictionary() {
    const host = $('#wordGrid');
    if (!host) return;
    const items = filteredDictionary();
    const pages = Math.max(1, Math.ceil(items.length / state.perPage));
    state.page = clamp(state.page, 1, pages);
    const start = (state.page - 1) * state.perPage;
    const pageItems = items.slice(start, start + state.perPage);
    const meta = $('#resultsMeta');
    if (meta) meta.textContent = `${items.length} entr${items.length === 1 ? 'y' : 'ies'}${items.length ? ` · page ${state.page} of ${pages}` : ''}`;
    if (!pageItems.length) {
      host.innerHTML = `<div class="empty-state panel"><h3>No matching words.</h3><p>Try another search, category or pathway.</p></div>`;
      renderPager(0, 1);
      return;
    }
    host.innerHTML = pageItems.map(item => {
      const id = Number(item.id);
      const fav = state.favourites.has(id);
      const mastered = state.mastered.has(id);
      return `<article class="word-card" data-word-id="${id}">
        <div class="visual" aria-hidden="true">${esc(item.visual || '🔹')}</div>
        <div><h3>${esc(item.term)}</h3><div class="ipa">${esc(item.ipa || '')}</div><div class="translation">${esc(item.fr || '')}</div><p class="definition">${esc(item.definition)}</p><div class="badges">${(item.pathways || []).map(p => `<span class="badge path">${esc(p)}</span>`).join('')}<span class="badge">${esc(item.category || '')}</span></div></div>
        <div class="card-actions"><button type="button" class="smallbtn ${fav ? 'on' : ''}" data-action="fav" aria-label="${fav ? 'Remove from' : 'Add to'} favourites">★</button><button type="button" class="smallbtn" data-action="speak" aria-label="Listen">🔊</button><button type="button" class="smallbtn ${mastered ? 'on' : ''}" data-action="master" aria-label="${mastered ? 'Mark as not mastered' : 'Mark as mastered'}">✓</button><button type="button" class="smallbtn" data-action="open" aria-label="Open details">→</button></div>
      </article>`;
    }).join('');
    host.querySelectorAll('[data-word-id]').forEach(card => {
      const id = Number(card.dataset.wordId);
      $('[data-action="fav"]', card)?.addEventListener('click', () => toggleFavourite(id));
      $('[data-action="master"]', card)?.addEventListener('click', () => toggleMastered(id));
      $('[data-action="speak"]', card)?.addEventListener('click', () => speak(vocab.find(v => Number(v.id) === id)?.term));
      $('[data-action="open"]', card)?.addEventListener('click', () => openWord(id));
    });
    renderPager(items.length, pages);
  }

  function renderPager(total, pages) {
    const host = $('#pager');
    if (!host) return;
    if (!total || pages <= 1) { host.innerHTML = ''; return; }
    const parts = [];
    parts.push(`<button type="button" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>← Previous</button>`);
    const visible = unique([1, state.page - 1, state.page, state.page + 1, pages]).filter(p => p >= 1 && p <= pages).sort((a, b) => a - b);
    let previous = 0;
    visible.forEach(page => {
      if (previous && page - previous > 1) parts.push('<span aria-hidden="true">…</span>');
      parts.push(`<button type="button" data-page="${page}" ${page === state.page ? 'aria-current="page"' : ''}>${page}</button>`);
      previous = page;
    });
    parts.push(`<button type="button" data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''}>Next →</button>`);
    host.innerHTML = parts.join('');
    $$('[data-page]', host).forEach(button => button.addEventListener('click', () => {
      state.page = clamp(Number(button.dataset.page), 1, pages);
      renderDictionary();
      $('#dictionary')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function toggleFavourite(id) {
    if (!validIds.has(Number(id))) return;
    const n = Number(id);
    state.favourites.has(n) ? state.favourites.delete(n) : state.favourites.add(n);
    saveState();
    renderDictionary();
    if (currentView() === 'flashcards') buildFlashDeck();
  }

  function toggleMastered(id) {
    if (!validIds.has(Number(id))) return;
    const n = Number(id);
    state.mastered.has(n) ? state.mastered.delete(n) : state.mastered.add(n);
    saveState();
    renderDictionary();
    if (currentView() === 'flashcards') renderFlash();
  }

  function openWord(id) {
    const item = vocab.find(v => Number(v.id) === Number(id));
    const host = $('#wordModalBody');
    if (!item || !host) return;
    const fav = state.favourites.has(Number(item.id));
    const mastered = state.mastered.has(Number(item.id));
    host.innerHTML = `
      <div class="word-detail"><div class="detail-visual" aria-hidden="true">${esc(item.visual || '🔹')}</div>
      <div class="eyebrow">${esc(item.category || 'Vocabulary')}</div><h2 id="wordModalTitle">${esc(item.term)}</h2><div class="ipa">${esc(item.ipa || '')}</div><h3>${esc(item.fr || '')}</h3><p>${esc(item.definition)}</p>
      ${item.example ? `<div class="example-box"><strong>Example</strong><p>${esc(item.example)}</p></div>` : ''}
      <div class="badges">${(item.pathways || []).map(p => `<span class="badge path">${esc(p)}</span>`).join('')}${item.source ? `<span class="badge">${esc(item.source)}</span>` : ''}</div>
      <div class="hero-actions"><button type="button" class="ghost" data-detail-speak>🔊 Listen</button><button type="button" class="ghost" data-detail-fav>${fav ? '★ Remove favourite' : '☆ Save word'}</button><button type="button" class="primary" data-detail-master>${mastered ? 'Mark not mastered' : 'Mark mastered'}</button></div></div>`;
    $('[data-detail-speak]', host)?.addEventListener('click', () => speak(item.term));
    $('[data-detail-fav]', host)?.addEventListener('click', () => { toggleFavourite(item.id); openWord(item.id); });
    $('[data-detail-master]', host)?.addEventListener('click', () => { toggleMastered(item.id); openWord(item.id); });
    openModal('wordModal');
  }

  let flashDeck = [];
  let flashIndex = 0;
  let flashFlipped = false;

  function flashPool() {
    const requested = text($('#flashPath')?.value || 'ALL');
    const category = text($('#flashCat')?.value);
    const favouritesOnly = Boolean($('#flashFav')?.checked);
    const unmasteredOnly = Boolean($('#flashUnmastered')?.checked);
    return vocab.filter(item => {
      const id = Number(item.id);
      if (!pathMatches(item, requested)) return false;
      if (category && item.category !== category) return false;
      if (favouritesOnly && !state.favourites.has(id)) return false;
      if (unmasteredOnly && state.mastered.has(id)) return false;
      return true;
    });
  }

  function buildFlashDeck(forceShuffle = false) {
    const pool = flashPool();
    flashDeck = forceShuffle ? shuffle(pool) : pool;
    flashIndex = 0;
    flashFlipped = false;
    renderFlash();
  }

  function renderFlash() {
    const host = $('#flashCard');
    if (!host) return;
    const count = $('#flashCount');
    if (!flashDeck.length) {
      host.classList.remove('flipped');
      host.innerHTML = `<div><h2>No cards in this deck.</h2><p class="hint">Change a filter or choose another pathway.</p></div>`;
      if (count) count.textContent = '0 cards';
      return;
    }
    flashIndex = ((flashIndex % flashDeck.length) + flashDeck.length) % flashDeck.length;
    const item = flashDeck[flashIndex];
    const mastered = state.mastered.has(Number(item.id));
    host.classList.toggle('flipped', flashFlipped);
    host.innerHTML = `<div class="front"><div class="big-visual" aria-hidden="true">${esc(item.visual || '🔹')}</div><h2>${esc(item.term)}</h2><div class="ipa">${esc(item.ipa || '')}</div><p class="hint">Tap to reveal the answer</p></div><div class="back"><div class="eyebrow">${esc(item.category || '')}</div><h2>${esc(item.fr || '')}</h2><p class="definition">${esc(item.definition)}</p>${item.example ? `<p class="example-text">${esc(item.example)}</p>` : ''}<p class="hint">Tap to see the word again</p></div>`;
    if ($('#masterBtn')) $('#masterBtn').textContent = mastered ? '✓ Mastered' : 'Mastered';
    if (count) count.textContent = `${flashIndex + 1} of ${flashDeck.length} cards`;
  }

  function nextFlash() {
    if (!flashDeck.length) return;
    flashIndex = (flashIndex + 1) % flashDeck.length;
    flashFlipped = false;
    renderFlash();
  }

  function flipFlash() {
    if (!flashDeck.length) return;
    flashFlipped = !flashFlipped;
    renderFlash();
  }

  let quizRound = [];
  let quizIndex = 0;
  let quizRoundCorrect = 0;
  let quizLocked = false;
  let quizAdvanceTimeout = null;

  function quizPool() {
    const requested = text($('#quizPath')?.value || 'ALL');
    return vocab.filter(item => pathMatches(item, requested));
  }

  function startQuiz() {
    if (quizAdvanceTimeout) { clearTimeout(quizAdvanceTimeout); quizAdvanceTimeout = null; }
    quizRound = shuffle(quizPool()).slice(0, 10);
    quizIndex = 0;
    quizRoundCorrect = 0;
    quizLocked = false;
    renderQuiz();
  }

  function renderQuiz() {
    const host = $('#quizCard');
    if (!host) return;
    const score = $('#quizScore');
    if (!quizRound.length) {
      host.innerHTML = `<div class="empty-state"><h3>No questions available.</h3><p>Choose another pathway.</p></div>`;
      if (score) score.textContent = '0 questions';
      return;
    }
    if (quizIndex >= quizRound.length) {
      const pct = Math.round((quizRoundCorrect / quizRound.length) * 100);
      host.innerHTML = `<div class="quiz-finish"><div class="eyebrow">Round complete</div><h2>${quizRoundCorrect}/${quizRound.length} · ${pct}%</h2><p>${pct >= 80 ? 'Strong recall. Keep moving.' : 'Useful diagnosis. Review the misses, then try again.'}</p><button type="button" class="primary" data-restart-quiz>Start another round</button></div>`;
      $('[data-restart-quiz]', host)?.addEventListener('click', startQuiz);
      if (score) score.textContent = `Round: ${quizRoundCorrect}/${quizRound.length}`;
      return;
    }
    quizLocked = false;
    const item = quizRound[quizIndex];
    const mode = text($('#quizMode')?.value || 'mcq');
    const pool = quizPool().filter(other => Number(other.id) !== Number(item.id));
    const progress = `Question ${quizIndex + 1} of ${quizRound.length}`;
    if (score) score.textContent = `${progress} · score ${quizRoundCorrect}`;

    if (mode === 'type') {
      host.innerHTML = `<div class="eyebrow">${esc(progress)}</div><div class="question-visual" aria-hidden="true">${esc(item.visual || '✎')}</div><h2>${esc(item.definition)}</h2><p class="mini-note">Type the English term.</p><form class="type-input" id="typeForm"><label class="sr-only" for="typeAnswer">English word</label><input id="typeAnswer" autocomplete="off" spellcheck="false"><button type="submit" class="primary">Check</button></form><div class="quiz-feedback" id="quizFeedback" aria-live="polite"></div>`;
      $('#typeForm')?.addEventListener('submit', event => {
        event.preventDefault();
        if (quizLocked) return;
        const correct = normaliseAnswer($('#typeAnswer')?.value) === normaliseAnswer(item.term);
        completeQuizAnswer(correct, item, null, item.term);
      });
      $('#typeAnswer')?.focus();
      return;
    }

    const target = mode === 'fr' ? item.fr : item.term;
    const distractorValues = shuffle(pool.map(other => mode === 'fr' ? other.fr : other.term).filter(Boolean));
    const options = unique([target, ...distractorValues]).slice(0, 4);
    while (options.length < Math.min(4, quizPool().length)) {
      const extra = mode === 'fr' ? pick(vocab)?.fr : pick(vocab)?.term;
      if (extra && !options.includes(extra)) options.push(extra);
    }
    const shuffledOptions = shuffle(options);
    const prompt = mode === 'fr' ? item.term : item.definition;
    const sub = mode === 'fr' ? 'Choose the best French translation.' : 'Choose the English term.';
    host.innerHTML = `<div class="eyebrow">${esc(progress)}</div><div class="question-visual" aria-hidden="true">${esc(item.visual || '◆')}</div><h2>${esc(prompt)}</h2><p class="mini-note">${esc(sub)}</p><div class="answers">${shuffledOptions.map((value, idx) => `<button type="button" class="answer" data-answer-index="${idx}">${esc(value)}</button>`).join('')}</div><div class="quiz-feedback" id="quizFeedback" aria-live="polite"></div>`;
    $$('[data-answer-index]', host).forEach(button => button.addEventListener('click', () => {
      if (quizLocked) return;
      const chosen = shuffledOptions[Number(button.dataset.answerIndex)];
      completeQuizAnswer(chosen === target, item, button, target);
    }));
  }

  function completeQuizAnswer(correct, item, clickedButton, correctDisplay) {
    if (quizLocked) return;
    quizLocked = true;
    state.attempts += 1;
    if (correct) { state.correct += 1; quizRoundCorrect += 1; }
    saveState();
    const host = $('#quizCard');
    if (clickedButton) clickedButton.classList.add(correct ? 'correct' : 'wrong');
    if (!correct) {
      $$('[data-answer-index]', host).forEach(button => {
        if (norm(button.textContent) === norm(correctDisplay)) button.classList.add('correct');
      });
    }
    $$('button, input', host).forEach(control => control.disabled = true);
    const feedback = $('#quizFeedback');
    if (feedback) feedback.innerHTML = correct
      ? `<p class="feedback-ok"><strong>Correct.</strong> ${esc(item.term)} · ${esc(item.fr || '')}</p>`
      : `<p class="feedback-bad"><strong>Not this time.</strong> Correct answer: <b>${esc(correctDisplay)}</b></p>`;
    quizAdvanceTimeout = setTimeout(() => {
      quizAdvanceTimeout = null;
      quizIndex += 1;
      renderQuiz();
    }, 1150);
  }

  let pronCurrent = null;
  let pronChallengeMode = false;

  function pronunciationPool() {
    const requested = text($('#pronPath')?.value || 'ALL');
    return pronunciation.filter(item => pathMatches(item, requested));
  }

  function stressAlternatives(stress) {
    const correct = text(stress).trim();
    const chunks = correct.split('-').filter(Boolean);
    if (chunks.length < 2) return [correct];
    const lower = chunks.map(chunk => chunk.toLowerCase());
    const options = [correct];
    for (let i = 0; i < lower.length; i += 1) {
      const alt = lower.map((chunk, index) => index === i ? chunk.toUpperCase() : chunk).join('-');
      if (alt !== correct && !options.includes(alt)) options.push(alt);
    }
    return shuffle(options).slice(0, Math.min(4, options.length));
  }

  function renderPronunciation(forceNew = false) {
    const host = $('#pronCard');
    if (!host) return;
    const pool = pronunciationPool();
    if (!pool.length) {
      pronCurrent = null;
      host.innerHTML = `<div class="empty-state"><h3>No pronunciation targets here.</h3><p>Choose another focus.</p></div>`;
      return;
    }
    if (forceNew || !pronCurrent || !pool.includes(pronCurrent)) pronCurrent = pick(pool);
    const item = pronCurrent;
    if (!pronChallengeMode) {
      host.innerHTML = `<div class="pron-visual" aria-hidden="true">🔊</div><div class="eyebrow">Say it before you listen</div><h2>${esc(item.term)}</h2><div class="ipa">${esc(item.ipa || '')}</div><div class="hero-actions centred"><button type="button" class="primary" data-pron-listen>Listen · British English</button><button type="button" class="ghost" data-pron-reveal>Reveal stress & trap</button></div><div id="pronReveal" class="pron-reveal" hidden><strong>${esc(item.stress || '')}</strong><p>${esc(item.trap || '')}</p></div>`;
      $('[data-pron-listen]', host)?.addEventListener('click', () => speak(item.term, 0.82));
      $('[data-pron-reveal]', host)?.addEventListener('click', event => {
        const reveal = $('#pronReveal');
        if (reveal) reveal.hidden = false;
        event.currentTarget.disabled = true;
      });
      return;
    }
    const options = stressAlternatives(item.stress);
    if (options.length < 2) {
      host.innerHTML = `<div class="eyebrow">Stress challenge</div><h2>${esc(item.term)}</h2><p>This item has no useful multiple-choice stress contrast.</p><p><strong>${esc(item.stress || '')}</strong></p><button type="button" class="primary" data-pron-next>Next word</button>`;
      $('[data-pron-next]', host)?.addEventListener('click', () => { pronCurrent = pick(pool); renderPronunciation(); });
      return;
    }
    host.innerHTML = `<div class="eyebrow">Stress challenge</div><h2>${esc(item.term)}</h2><p class="mini-note">Which stress pattern is correct?</p><div class="answers">${options.map((option, idx) => `<button type="button" class="answer" data-stress-index="${idx}">${esc(option)}</button>`).join('')}</div><div id="stressFeedback" class="quiz-feedback" aria-live="polite"></div><div class="hero-actions"><button type="button" class="ghost" data-pron-listen>🔊 Listen</button></div>`;
    $('[data-pron-listen]', host)?.addEventListener('click', () => speak(item.term, 0.82));
    $$('[data-stress-index]', host).forEach(button => button.addEventListener('click', () => {
      const chosen = options[Number(button.dataset.stressIndex)];
      const correct = chosen === item.stress;
      button.classList.add(correct ? 'correct' : 'wrong');
      $$('[data-stress-index]', host).forEach(btn => {
        btn.disabled = true;
        if (btn.textContent.trim() === text(item.stress).trim()) btn.classList.add('correct');
      });
      const feedback = $('#stressFeedback');
      if (feedback) feedback.innerHTML = `<p><strong>${correct ? 'Correct.' : 'Correct pattern:'}</strong> ${esc(item.stress || '')}<br>${esc(item.trap || '')}</p>`;
    }));
  }

  let skillMode = 'collocation';
  let blitzInterval = null;
  let blitzLeft = 30;

  function recordSkill(correct) {
    state.skillAttempts += 1;
    if (correct) state.skillCorrect += 1;
    saveState();
    updateSkillScore();
  }

  function updateSkillScore() {
    const host = $('#skillScore');
    if (!host) return;
    host.textContent = state.skillAttempts ? `Lifetime scored drills: ${state.skillCorrect}/${state.skillAttempts} · ${Math.round(state.skillCorrect / state.skillAttempts * 100)}%` : 'Choose a mode and start training.';
  }

  function renderSkill() {
    if (skillMode !== 'blitz') stopBlitzTimer(false);
    if (skillMode === 'collocation') renderCollocation();
    else if (skillMode === 'frenglish') renderFrenglish();
    else if (skillMode === 'chart') renderChart();
    else renderBlitz();
    updateSkillScore();
  }

  function skillRequestedPath() {
    return text($('#skillPath')?.value || 'ALL');
  }

  function renderCollocation() {
    const host = $('#skillHost');
    if (!host) return;
    const pool = collocations.filter(item => skillPathMatches(item, skillRequestedPath()));
    if (!pool.length) {
      host.innerHTML = `<div class="empty-state"><h3>No collocations for this pathway.</h3><p>Choose another pathway.</p></div>`;
      return;
    }
    const item = pick(pool);
    const distractors = shuffle(unique(collocations.filter(other => other !== item && other.lead !== item.lead).map(other => other.lead).filter(Boolean)));
    const options = shuffle(unique([item.lead, ...distractors]).slice(0, 4));
    host.innerHTML = `<div class="eyebrow">Collocation Challenge · ${esc(item.path || 'COMMON')}</div><h2>___ ${esc(item.tail)}</h2><p class="skill-prompt">Choose the verb or verb phrase a professional would naturally use.</p><div class="answers">${options.map((option, idx) => `<button type="button" class="answer" data-coll-index="${idx}">${esc(option)}</button>`).join('')}</div><div id="skillFeedback" class="quiz-feedback" aria-live="polite"></div><button type="button" class="ghost skill-next" data-next-skill hidden>Next challenge</button>`;
    $$('[data-coll-index]', host).forEach(button => button.addEventListener('click', () => {
      const chosen = options[Number(button.dataset.collIndex)];
      const correct = chosen === item.lead;
      recordSkill(correct);
      button.classList.add(correct ? 'correct' : 'wrong');
      $$('[data-coll-index]', host).forEach(btn => { btn.disabled = true; if (btn.textContent.trim() === item.lead) btn.classList.add('correct'); });
      $('#skillFeedback').innerHTML = `<p><strong>${correct ? 'Correct.' : 'Best collocation:'}</strong> ${esc(item.lead)} ${esc(item.tail)}<br><span>${esc(item.fr || '')}</span></p>${item.example ? `<p class="example-text">${esc(item.example)}</p>` : ''}`;
      const next = $('[data-next-skill]', host); if (next) { next.hidden = false; next.addEventListener('click', renderCollocation, { once: true }); }
    }));
  }

  function renderFrenglish() {
    const host = $('#skillHost');
    if (!host) return;
    if (!frenglish.length) {
      host.innerHTML = `<div class="empty-state"><h3>No French-English fixes loaded.</h3></div>`;
      return;
    }
    const item = pick(frenglish);
    host.innerHTML = `<div class="eyebrow">Fix the French English</div><h2 class="frenglish-wrong">“${esc(item.wrong)}”</h2><p class="mini-note">Say a natural correction aloud before revealing it.</p><div class="hero-actions"><button type="button" class="primary" data-reveal-fix>Reveal correction</button><button type="button" class="ghost" data-new-fix>Another sentence</button></div><div id="fixReveal" class="frenglish-answer" hidden><strong class="frenglish-right">${esc(item.right)}</strong><p>${esc(item.why || '')}</p></div>`;
    $('[data-reveal-fix]', host)?.addEventListener('click', () => { const reveal = $('#fixReveal'); if (reveal) reveal.hidden = false; });
    $('[data-new-fix]', host)?.addEventListener('click', renderFrenglish);
  }

  function renderChart() {
    const host = $('#skillHost');
    if (!host) return;
    const pool = charts.filter(item => skillPathMatches(item, skillRequestedPath()));
    if (!pool.length) {
      host.innerHTML = `<div class="empty-state"><h3>No chart prompts for this pathway.</h3><p>Choose another pathway.</p></div>`;
      return;
    }
    const item = pick(pool);
    const values = item.values.map(Number).filter(Number.isFinite);
    const labels = Array.isArray(item.labels) ? item.labels : [];
    const max = Math.max(1, ...values.map(v => Math.abs(v)));
    const bars = values.map((value, index) => {
      const height = Math.max(6, Math.round(Math.abs(value) / max * 150));
      return `<div class="bar-col"><div class="bar-value">${esc(value)}${esc(item.unit || '')}</div><div class="bar" style="height:${height}px" aria-label="${esc(labels[index] || `Value ${index + 1}`)}: ${esc(value)} ${esc(item.unit || '')}"></div><b>${esc(labels[index] || index + 1)}</b></div>`;
    }).join('');
    host.innerHTML = `<div class="eyebrow">Explain the Chart · ${esc(item.path || 'COMMON')}</div><h2>${esc(item.title)}</h2><div class="mini-chart" role="img" aria-label="${esc(item.title)} chart">${bars}</div><div class="chart-task"><strong>Your task</strong><p>${esc(item.task || 'Describe the main pattern clearly.')}</p></div><div class="hero-actions"><button type="button" class="primary" data-show-model>Show model answer</button><button type="button" class="ghost" data-new-chart>New chart</button></div><div id="chartModel" class="model-answer" hidden><strong>Model answer</strong><p>${esc(item.model || '')}</p></div>`;
    $('[data-show-model]', host)?.addEventListener('click', () => { const model = $('#chartModel'); if (model) model.hidden = false; });
    $('[data-new-chart]', host)?.addEventListener('click', renderChart);
  }

  function blitzPool() {
    const requested = skillRequestedPath();
    return interview.filter(item => interviewMatches(item, requested));
  }

  function renderBlitz() {
    stopBlitzTimer(false);
    blitzLeft = 30;
    const host = $('#skillHost');
    if (!host) return;
    const pool = blitzPool();
    if (!pool.length) {
      host.innerHTML = `<div class="empty-state"><h3>No interview prompts for this pathway.</h3><p>Choose another pathway.</p></div>`;
      return;
    }
    const item = pick(pool);
    host.innerHTML = `<div class="eyebrow">Interview Blitz · ${esc(item.tag || 'Professional')}</div><h2>${esc(item.q)}</h2><div class="blitz-timer" id="blitzTimer">00:30</div><p class="mini-note">Give a concise answer: point → evidence/example → takeaway.</p><div class="hero-actions centred"><button type="button" class="primary" id="blitzTimerBtn">Start 30-sec sprint</button><button type="button" class="ghost" data-new-blitz>New prompt</button></div>`;
    $('#blitzTimerBtn')?.addEventListener('click', handleBlitzTimerButton);
    $('[data-new-blitz]', host)?.addEventListener('click', renderBlitz);
  }

  function updateBlitzTimer() {
    const timer = $('#blitzTimer');
    if (timer) timer.textContent = `00:${String(Math.max(0, blitzLeft)).padStart(2, '0')}`;
  }

  function stopBlitzTimer(resetLabel = true) {
    if (blitzInterval) clearInterval(blitzInterval);
    blitzInterval = null;
    if (resetLabel && $('#blitzTimerBtn')) $('#blitzTimerBtn').textContent = blitzLeft <= 0 ? 'Reset timer' : 'Start 30-sec sprint';
  }

  function resetBlitzTimer() {
    stopBlitzTimer(false);
    blitzLeft = 30;
    updateBlitzTimer();
    if ($('#blitzTimerBtn')) $('#blitzTimerBtn').textContent = 'Start 30-sec sprint';
  }

  function handleBlitzTimerButton() {
    if (blitzInterval) { resetBlitzTimer(); return; }
    if (blitzLeft <= 0) { resetBlitzTimer(); return; }
    const button = $('#blitzTimerBtn');
    if (button) button.textContent = 'Reset timer';
    blitzInterval = setInterval(() => {
      blitzLeft -= 1;
      updateBlitzTimer();
      if (blitzLeft <= 0) {
        stopBlitzTimer(false);
        if (button) button.textContent = 'Reset timer';
      }
    }, 1000);
  }

  let interviewCurrent = null;
  let interviewInterval = null;
  let interviewLeft = 90;

  function interviewPool() {
    return interview.filter(item => interviewMatches(item, text($('#interviewPath')?.value || 'ALL')));
  }

  function renderInterview(forceNew = false) {
    const pool = interviewPool();
    if (!pool.length) {
      interviewCurrent = null;
      if ($('#interviewTag')) $('#interviewTag').textContent = '';
      if ($('#interviewQ')) $('#interviewQ').textContent = 'No interview questions available for this pathway.';
      resetInterviewTimer();
      return;
    }
    if (forceNew || !interviewCurrent || !pool.includes(interviewCurrent)) interviewCurrent = pick(pool);
    if ($('#interviewTag')) $('#interviewTag').textContent = interviewCurrent.tag || 'Professional';
    if ($('#interviewQ')) $('#interviewQ').textContent = interviewCurrent.q;
    const framework = $('#interviewFramework');
    if (framework) { framework.hidden = true; framework.innerHTML = ''; }
    const button = $('#frameworkBtn');
    if (button) { button.textContent = 'Show answer framework'; button.setAttribute('aria-expanded', 'false'); }
    resetInterviewTimer();
  }

  function updateInterviewTimer() {
    const timer = $('#timer');
    if (!timer) return;
    const mins = Math.floor(Math.max(0, interviewLeft) / 60);
    const secs = Math.max(0, interviewLeft) % 60;
    timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function stopInterviewTimer(resetLabel = true) {
    if (interviewInterval) clearInterval(interviewInterval);
    interviewInterval = null;
    if (resetLabel && $('#timerBtn')) $('#timerBtn').textContent = interviewLeft <= 0 ? 'Reset 90-sec timer' : 'Start 90-sec timer';
  }

  function resetInterviewTimer() {
    stopInterviewTimer(false);
    interviewLeft = 90;
    updateInterviewTimer();
    if ($('#timerBtn')) $('#timerBtn').textContent = 'Start 90-sec timer';
  }

  function handleInterviewTimerButton() {
    if (interviewInterval) { resetInterviewTimer(); return; }
    if (interviewLeft <= 0) { resetInterviewTimer(); return; }
    const button = $('#timerBtn');
    if (button) button.textContent = 'Reset timer';
    interviewInterval = setInterval(() => {
      interviewLeft -= 1;
      updateInterviewTimer();
      if (interviewLeft <= 0) {
        stopInterviewTimer(false);
        if (button) button.textContent = 'Reset 90-sec timer';
      }
    }, 1000);
  }

  function frameworkFor(item) {
    const tag = text(item?.tag).toLowerCase();
    if (tag.includes('technical')) return {
      name: 'Technical explanation',
      steps: ['Define the concept in plain English.', 'Explain the mechanism or method.', 'Give one concrete example or implication.', 'State one limitation, assumption or check.']
    };
    if (tag.includes('ethical') || tag.includes('tricky')) return {
      name: 'Decision structure',
      steps: ['State the issue clearly.', 'Identify the stakeholders and constraints.', 'Explain the trade-off and your reasoning.', 'Give your decision and how you would communicate it.']
    };
    if (tag.includes('communication')) return {
      name: 'PREP',
      steps: ['Point: answer immediately.', 'Reason: explain why.', 'Example: make it concrete.', 'Point: finish with the takeaway.']
    };
    return {
      name: 'STAR',
      steps: ['Situation: give only the useful context.', 'Task: say what you had to achieve.', 'Action: focus on what you did.', 'Result: quantify or explain the outcome and learning.']
    };
  }

  function toggleFramework() {
    if (!interviewCurrent) return;
    const host = $('#interviewFramework');
    const button = $('#frameworkBtn');
    if (!host || !button) return;
    const opening = host.hidden;
    if (opening) {
      const f = frameworkFor(interviewCurrent);
      host.innerHTML = `<strong>${esc(f.name)}</strong><ol>${f.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol>`;
      host.hidden = false;
      button.textContent = 'Hide answer framework';
      button.setAttribute('aria-expanded', 'true');
    } else {
      host.hidden = true;
      button.textContent = 'Show answer framework';
      button.setAttribute('aria-expanded', 'false');
    }
  }

  function updateStats() {
    if ($('#statWords')) $('#statWords').textContent = vocab.length.toLocaleString('en-GB');
    if ($('#statMastered')) $('#statMastered').textContent = state.mastered.size.toLocaleString('en-GB');
    if ($('#statFav')) $('#statFav').textContent = state.favourites.size.toLocaleString('en-GB');
    if ($('#statAccuracy')) $('#statAccuracy').textContent = state.attempts ? `${Math.round(state.correct / state.attempts * 100)}%` : '—';
    if ($('#pMastered')) $('#pMastered').textContent = state.mastered.size.toLocaleString('en-GB');
    if ($('#pFav')) $('#pFav').textContent = state.favourites.size.toLocaleString('en-GB');
    if ($('#pAccuracy')) $('#pAccuracy').textContent = state.attempts ? `${Math.round(state.correct / state.attempts * 100)}%` : '—';
    if ($('#pAttempts')) $('#pAttempts').textContent = state.attempts ? `${state.correct} correct from ${state.attempts} attempts` : 'No attempts yet';
    if ($('#pSkillAccuracy')) $('#pSkillAccuracy').textContent = state.skillAttempts ? `${Math.round(state.skillCorrect / state.skillAttempts * 100)}%` : '—';
    if ($('#pSkillAttempts')) $('#pSkillAttempts').textContent = state.skillAttempts ? `${state.skillCorrect} correct from ${state.skillAttempts} scored drills` : 'No scored drills yet';
    const masteryPct = vocab.length ? Math.round(state.mastered.size / vocab.length * 100) : 0;
    if ($('#masterMeter')) $('#masterMeter').style.width = `${masteryPct}%`;
  }

  function renderProgress() {
    updateProgrammeUI();
    updateStats();
    const host = $('#pathProgress');
    if (!host) return;
    host.innerHTML = PROGRAMMES.map(path => {
      const pool = vocab.filter(item => pathMatches(item, path));
      const mastered = pool.filter(item => state.mastered.has(Number(item.id))).length;
      const pct = pool.length ? Math.round(mastered / pool.length * 100) : 0;
      return `<div class="panel path-progress-card"><div class="path-progress-head"><strong>${esc(path)}</strong><span>${mastered}/${pool.length} · ${pct}%</span></div><div class="meter"><span style="width:${pct}%"></span></div></div>`;
    }).join('');
  }

  function exportProgress() {
    const payload = {
      version: 6,
      favourites: [...state.favourites],
      mastered: [...state.mastered],
      attempts: state.attempts,
      correct: state.correct,
      skillAttempts: state.skillAttempts,
      skillCorrect: state.skillCorrect,
      programme: state.programme,
      accessibility: readJSON(A11Y_KEY, {}),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ecostat-english-progress.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importProgress(file) {
    if (!file) return;
    if (file.size > 1_000_000) { alert('This backup file is too large.'); return; }
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = parsed?.state && typeof parsed.state === 'object' ? parsed.state : parsed;
      if (!incoming || typeof incoming !== 'object') throw new Error('Invalid backup');
      state.programme = PROGRAMMES.includes(incoming.programme) ? incoming.programme : '';
      state.favourites = new Set((Array.isArray(incoming.favourites) ? incoming.favourites : []).map(Number).filter(id => validIds.has(id)));
      state.mastered = new Set((Array.isArray(incoming.mastered) ? incoming.mastered : []).map(Number).filter(id => validIds.has(id)));
      state.attempts = Math.max(0, Number(incoming.attempts) || 0);
      state.correct = clamp(Math.max(0, Number(incoming.correct) || 0), 0, state.attempts);
      state.skillAttempts = Math.max(0, Number(incoming.skillAttempts) || 0);
      state.skillCorrect = clamp(Math.max(0, Number(incoming.skillCorrect) || 0), 0, state.skillAttempts);
      const importedA11y = parsed?.accessibility || incoming?.accessibility;
      if (importedA11y && typeof importedA11y === 'object') {
        const cleanA11y = {};
        ['largeText', 'highContrast', 'readable', 'reduceMotion'].forEach(key => { cleanA11y[key] = Boolean(importedA11y[key]); });
        try { localStorage.setItem(A11Y_KEY, JSON.stringify(cleanA11y)); } catch (_) {}
        const classMap = { largeText: 'large-text', highContrast: 'high-contrast', readable: 'readable', reduceMotion: 'reduce-motion' };
        Object.entries(classMap).forEach(([id, cls]) => {
          document.body.classList.toggle(cls, cleanA11y[id]);
          const input = document.getElementById(id); if (input) input.checked = cleanA11y[id];
        });
      }
      saveState();
      updateProgrammeUI();
      syncMyProgrammeSelects();
      renderProgress();
      alert('Progress imported successfully.');
    } catch (_) {
      alert('This file is not a valid Ecostat English progress backup.');
    } finally {
      const input = $('#importFile'); if (input) input.value = '';
    }
  }

  function resetProgress() {
    if (!confirm('Reset favourites, mastery and all practice statistics on this device?')) return;
    state.favourites.clear();
    state.mastered.clear();
    state.attempts = 0;
    state.correct = 0;
    state.skillAttempts = 0;
    state.skillCorrect = 0;
    saveState();
    renderProgress();
    renderDictionary();
  }

  function initA11y() {
    const saved = readJSON(A11Y_KEY, {});
    const map = {
      largeText: 'large-text',
      highContrast: 'high-contrast',
      readable: 'readable',
      reduceMotion: 'reduce-motion'
    };
    Object.entries(map).forEach(([id, cls]) => {
      const enabled = Boolean(saved[id]);
      document.body.classList.toggle(cls, enabled);
      const input = document.getElementById(id);
      if (input) {
        input.checked = enabled;
        input.addEventListener('change', () => {
          document.body.classList.toggle(cls, input.checked);
          const next = readJSON(A11Y_KEY, {});
          next[id] = input.checked;
          try { localStorage.setItem(A11Y_KEY, JSON.stringify(next)); } catch (_) {}
        });
      }
    });
  }

  let deferredInstall = null;
  function initInstall() {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredInstall = event;
      if ($('#installHint')) $('#installHint').textContent = 'Install for offline revision.';
    });
    window.addEventListener('appinstalled', () => {
      deferredInstall = null;
      if ($('#installHint')) $('#installHint').textContent = 'Installed · works offline.';
      const button = $('#installHero'); if (button) button.textContent = 'Installed';
    });
    $('#installHero')?.addEventListener('click', async () => {
      if (deferredInstall) {
        deferredInstall.prompt();
        try { await deferredInstall.userChoice; } catch (_) {}
        deferredInstall = null;
      } else openModal('installModal');
    });
  }

  function updateNetworkStatus() {
    const host = $('#networkStatus');
    if (!host) return;
    const online = navigator.onLine;
    host.classList.toggle('offline', !online);
    const label = $('b', host);
    if (label) label.textContent = online ? 'Online' : 'Offline';
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
        .then(registration => registration.update().catch(() => {}))
        .catch(() => {});
    });
  }

  function bindEvents() {
    $$('[data-view]').forEach(button => button.addEventListener('click', () => navigateTo(button.dataset.view)));
    $$('.pathway-jump[data-programme]').forEach(button => button.addEventListener('click', () => setProgramme(button.dataset.programme)));
    $('#openProgrammeVocabulary')?.addEventListener('click', () => {
      state.path = state.programme ? 'MY' : 'ALL';
      $$('.chip').forEach(chip => chip.classList.toggle('active', chip.dataset.path === state.path));
      state.page = 1;
      navigateTo('dictionary');
    });
    $('#openProgrammeTraining')?.addEventListener('click', () => {
      if ($('#skillPath')) $('#skillPath').value = state.programme ? 'MY' : 'ALL';
      navigateTo('skills');
    });
    $('#changeProgramme')?.addEventListener('click', () => navigateTo('home'));

    $('#search')?.addEventListener('input', () => { state.page = 1; renderDictionary(); });
    $('#catFilter')?.addEventListener('change', () => { state.page = 1; renderDictionary(); });
    $('#sourceFilter')?.addEventListener('change', () => { state.page = 1; renderDictionary(); });
    $$('.chip').forEach(button => button.addEventListener('click', () => {
      state.path = button.dataset.path || 'ALL';
      state.page = 1;
      $$('.chip').forEach(chip => chip.classList.toggle('active', chip === button));
      renderDictionary();
    }));

    $('#flashCard')?.addEventListener('click', flipFlash);
    $('#flashCard')?.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); flipFlash(); } });
    $('#againBtn')?.addEventListener('click', nextFlash);
    $('#speakFlash')?.addEventListener('click', () => { const item = flashDeck[flashIndex]; if (item) speak(item.term); });
    $('#masterBtn')?.addEventListener('click', () => { const item = flashDeck[flashIndex]; if (item) { toggleMastered(item.id); nextFlash(); } });
    ['flashPath', 'flashCat', 'flashFav', 'flashUnmastered'].forEach(id => document.getElementById(id)?.addEventListener('change', () => buildFlashDeck()));
    $('#shuffleFlash')?.addEventListener('click', () => buildFlashDeck(true));

    $('#newQuiz')?.addEventListener('click', startQuiz);
    $('#quizMode')?.addEventListener('change', startQuiz);
    $('#quizPath')?.addEventListener('change', startQuiz);

    $('#nextPron')?.addEventListener('click', () => renderPronunciation(true));
    $('#pronPath')?.addEventListener('change', () => renderPronunciation(true));
    $('#pronChallenge')?.addEventListener('click', event => {
      pronChallengeMode = !pronChallengeMode;
      event.currentTarget.textContent = pronChallengeMode ? 'Standard pronunciation' : 'Stress challenge';
      renderPronunciation(true);
    });

    $$('.skill-mode').forEach(button => button.addEventListener('click', () => {
      skillMode = button.dataset.skill || 'collocation';
      $$('.skill-mode').forEach(btn => btn.classList.toggle('active', btn === button));
      renderSkill();
    }));
    $('#skillPath')?.addEventListener('change', renderSkill);

    $('#timerBtn')?.addEventListener('click', handleInterviewTimerButton);
    $('#newInterview')?.addEventListener('click', () => renderInterview(true));
    $('#interviewPath')?.addEventListener('change', () => renderInterview(true));
    $('#frameworkBtn')?.addEventListener('click', toggleFramework);

    $('#exportBtn')?.addEventListener('click', exportProgress);
    $('#importFile')?.addEventListener('change', event => importProgress(event.target.files?.[0]));
    $('#resetBtn')?.addEventListener('click', resetProgress);

    $('#a11yBtn')?.addEventListener('click', () => openModal('a11yModal'));
    $$('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.close)));
    $$('.modal').forEach(modal => modal.addEventListener('mousedown', event => { if (event.target === modal) closeModal(modal.id); }));
    document.addEventListener('keydown', handleModalKeydown);
    window.addEventListener('hashchange', () => navigateTo(location.hash.slice(1) || 'home', false));
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
  }

  function init() {
    showDataHealth();
    populateFilters();
    updateProgrammeUI();
    syncMyProgrammeSelects();
    updateStats();
    updateSkillScore();
    initA11y();
    initInstall();
    updateNetworkStatus();
    bindEvents();
    renderHomeSpotlight();
    buildFlashDeck();
    renderPronunciation(true);
    renderSkill();
    renderInterview(true);
    renderProgress();
    navigateTo(location.hash.slice(1) || 'home', false);
    registerServiceWorker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
