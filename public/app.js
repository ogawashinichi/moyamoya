const BADGE_COLORS = ['#ff4757','#ff6b35','#9c27b0','#0097a7','#388e3c','#e91e8c'];
const CARD_GRADIENTS = [
  'linear-gradient(90deg,#ff4757,#ff9f43)',
  'linear-gradient(90deg,#ff6b35,#ffd43b)',
  'linear-gradient(90deg,#9c27b0,#e91e8c)',
  'linear-gradient(90deg,#0097a7,#00e5ff)',
  'linear-gradient(90deg,#388e3c,#a5d6a7)',
  'linear-gradient(90deg,#e91e8c,#ff4757)',
];

let allEpisodes = [];
let isAdmin = false;
let displayCount = 12;
let searchQuery = '';
let activeTag = '';

// ===== Utils =====
function getMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return { m4a:'audio/mp4', mp4:'audio/mp4', mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', aac:'audio/aac' }[ext] || 'audio/mpeg';
}
function formatDate(d) { const [y,m,day]=d.split('-'); return `${y}年${parseInt(m)}月${parseInt(day)}日`; }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function highlight(text, query) {
  const escaped = escHtml(text);
  if (!query) return escaped;
  const safe = escHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(safe, 'gi'), m => `<mark class="search-hl">${m}</mark>`);
}
function toSpotifyEmbedUrl(url) {
  return url.replace('open.spotify.com/', 'open.spotify.com/embed/').split('?')[0];
}
function xAccountUrl(val) {
  if (!val) return '#';
  if (val.startsWith('http')) return val;
  return `https://x.com/${val.replace(/^@/, '')}`;
}

// ===== Episode Card =====
function renderEpisode(episode, index, total) {
  const num = total - index;
  const ci = (num - 1) % BADGE_COLORS.length;
  const card = document.createElement('article');
  card.className = 'episode-card';
  card.id = 'episode-' + episode.id;
  card.style.setProperty('--badge-color', BADGE_COLORS[ci]);
  card.style.setProperty('--card-gradient', CARD_GRADIENTS[ci]);
  card.innerHTML = `
    <div class="episode-card-bg-num">${num}</div>
    <div class="episode-meta">
      <span class="episode-num">第${num}回</span>
      <div class="episode-meta-right">
        <time class="episode-date" datetime="${episode.date}">${formatDate(episode.date)}</time>
        <button class="episode-share-btn" title="URLをコピー" aria-label="URLをコピー"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></button>
        <button class="episode-tweet-btn" title="Xでシェア" aria-label="Xでシェア"><svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></button>
        <button class="episode-line-btn" title="LINEでシェア" aria-label="LINEでシェア"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19.952 10.876C19.952 6.553 15.613 3 10.302 3 4.99 3 .652 6.553.652 10.876c0 3.865 3.428 7.099 8.057 7.712.314.068.741.207.849.476.097.245.063.629.031.876l-.137.823c-.042.245-.193.957.838.522 1.031-.435 5.561-3.277 7.589-5.609 1.4-1.535 2.073-3.095 2.073-4.8z"/></svg></button>
        ${isAdmin ? `<button class="episode-edit-btn" title="編集" data-id="${episode.id}"><svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>` : ''}
      </div>
    </div>
    <h3 class="episode-title">${highlight(episode.title, searchQuery)}</h3>
    ${episode.description ? `<div class="episode-description">${highlight(episode.description, searchQuery)}</div>` : ''}
    ${episode.tags && episode.tags.length ? `<div class="episode-tags">${episode.tags.map(t => `<button class="episode-tag${t === activeTag ? ' active' : ''}" data-tag="${escHtml(t)}">${escHtml(t)}</button>`).join('')}</div>` : ''}
    <div class="episode-player">
      ${episode.spotifyUrl
        ? `<button class="spotify-play-btn" data-url="${escHtml(toSpotifyEmbedUrl(episode.spotifyUrl))}"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 11.424c-.18.295-.563.387-.857.207-2.35-1.435-5.305-1.76-8.786-.963-.335.077-.67-.133-.746-.469-.077-.336.132-.67.469-.746 3.809-.871 7.077-.496 9.713 1.115.293.18.386.563.207.856zm1.223-2.723c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.517-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.48.707.257 1.071zm.105-2.835C14.692 5.95 9.375 5.775 6.297 6.71c-.493.15-1.016-.129-1.166-.623-.148-.495.13-1.016.625-1.165 3.532-1.073 9.404-.866 13.115 1.338.445.264.59.838.327 1.282-.264.443-.838.59-1.284.324z"/></svg> Spotifyで再生</button>`
        : episode.spaceUrl
          ? `<a class="space-link-btn" href="${escHtml(episode.spaceUrl)}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>Xスペースで聴く</a>`
          : `<audio controls preload="none"><source src="/data/${encodeURIComponent(episode.filename)}" type="${getMimeType(episode.filename)}"></audio>`}
    </div>
  `;
  if (isAdmin) {
    card.querySelector('.episode-edit-btn').addEventListener('click', () => openEditModal(episode));
  }
  const spotifyBtn = card.querySelector('.spotify-play-btn');
  if (spotifyBtn) {
    spotifyBtn.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = spotifyBtn.dataset.url;
      iframe.width = '100%';
      iframe.height = '152';
      iframe.frameBorder = '0';
      iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      iframe.style.borderRadius = '10px';
      spotifyBtn.replaceWith(iframe);
    });
  }
  card.querySelectorAll('.episode-tag').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tag = btn.dataset.tag;
      activeTag = activeTag === tag ? '' : tag;
      displayCount = 12;
      renderTagFilter();
      renderEpisodes();
    });
  });
  card.querySelector('.episode-share-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?ep=${episode.id}`;
    navigator.clipboard.writeText(url).then(
      () => showToast('URLをコピーしました', 'success'),
      () => showToast('コピーに失敗しました', 'error')
    );
  });
  card.querySelector('.episode-tweet-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?ep=${episode.id}`;
    const text = `【新聞記者のもやもや話】第${num}回「${episode.title}」`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
  });
  card.querySelector('.episode-line-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?ep=${episode.id}`;
    const text = `【新聞記者のもやもや話】第${num}回「${episode.title}」\n`;
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text + url)}`, '_blank', 'noopener,noreferrer');
  });
  return card;
}

// ===== JSON-LD =====
function updateJsonLd(episodes) {
  const el = document.getElementById('json-ld');
  if (!el) return;
  const SITE = 'https://moyamoya-pefh.onrender.com';
  el.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'PodcastSeries',
    name: '新聞記者のもやもや話',
    description: '東京新聞デジタル編集部の記者とデスクが日々感じている「もやもや」を語り合っています。取材での悩みや葛藤、ジャーナリズムの課題、社会の問いかけ。',
    url: SITE + '/',
    image: SITE + '/thumbnail.png',
    inLanguage: 'ja',
    author: { '@type': 'Organization', name: '東京新聞デジタル編集部' },
    episode: episodes.map((ep, i) => ({
      '@type': 'PodcastEpisode',
      episodeNumber: episodes.length - i,
      name: ep.title,
      datePublished: ep.date,
      description: ep.description || ep.title,
      url: ep.spotifyUrl || ep.spaceUrl || `${SITE}/?ep=${ep.id}`
    }))
  });
}

// ===== Tag Filter =====
function getAllTags() {
  const set = new Set();
  allEpisodes.forEach(ep => (ep.tags || []).forEach(t => set.add(t)));
  return [...set];
}

function renderTagFilter() {
  const wrap = document.getElementById('tags-filter');
  if (!wrap) return;
  const tags = getAllTags();
  if (!tags.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  wrap.innerHTML = `
    <span class="tags-filter-label">タグで絞り込み：</span>
    ${tags.map(t => `<button class="tag-filter-btn${activeTag === t ? ' active' : ''}" data-tag="${escHtml(t)}">${escHtml(t)}</button>`).join('')}
    ${activeTag ? `<button class="tag-filter-clear">✕ クリア</button>` : ''}
  `;
  wrap.querySelectorAll('.tag-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTag = activeTag === btn.dataset.tag ? '' : btn.dataset.tag;
      displayCount = 12;
      renderTagFilter();
      renderEpisodes();
    });
  });
  const clearBtn = wrap.querySelector('.tag-filter-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    activeTag = '';
    displayCount = 12;
    renderTagFilter();
    renderEpisodes();
  });
}

// ===== Hero Latest =====
function updateHeroLatest() {
  const el = document.getElementById('hero-latest');
  const info = document.getElementById('hero-latest-info');
  const meta = document.getElementById('hero-latest-meta');
  if (!el || !info || !allEpisodes.length) return;
  const ep = allEpisodes[0];
  const num = allEpisodes.length;
  if (meta) meta.textContent = `第${num}回 · ${formatDate(ep.date)}`;
  info.textContent = ep.title;
  el.style.display = 'block';
}

// ===== Render Episodes (search + pagination) =====
function renderEpisodes() {
  const grid = document.getElementById('episodes-grid');
  const sectionCount = document.getElementById('section-count');
  const loadMoreWrap = document.getElementById('load-more-wrap');
  const loadMoreBtn = document.getElementById('btn-load-more');

  let filtered = allEpisodes;
  if (activeTag) {
    filtered = filtered.filter(ep => ep.tags && ep.tags.includes(activeTag));
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(ep =>
      ep.title.toLowerCase().includes(q) ||
      (ep.description && ep.description.toLowerCase().includes(q)) ||
      (ep.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  if (sectionCount) {
    sectionCount.textContent = searchQuery
      ? `${filtered.length} / 全${allEpisodes.length}件`
      : `全${allEpisodes.length}件`;
  }

  // When searching show all matches; otherwise paginate
  const toShow = searchQuery ? filtered : filtered.slice(0, displayCount);

  grid.innerHTML = '';
  if (!filtered.length) {
    const msg = activeTag
      ? `タグ「${escHtml(activeTag)}」のエピソードはありません`
      : searchQuery
        ? `「${escHtml(searchQuery)}」に一致するエピソードはありません`
        : 'まだエピソードがありません。';
    grid.innerHTML = `<div class="state-empty"><p>${msg}</p></div>`;
    if (loadMoreWrap) loadMoreWrap.style.display = 'none';
    return;
  }

  toShow.forEach(ep => {
    const idx = allEpisodes.indexOf(ep);
    grid.appendChild(renderEpisode(ep, idx, allEpisodes.length));
  });

  if (loadMoreWrap && loadMoreBtn) {
    const hasMore = !searchQuery && filtered.length > displayCount;
    loadMoreWrap.style.display = hasMore ? 'block' : 'none';
    if (hasMore) {
      loadMoreBtn.textContent = `もっと見る（残り${filtered.length - displayCount}件）`;
    }
  }
}

function loadMore() {
  displayCount += 12;
  renderEpisodes();
}

// ===== Load =====
async function loadEpisodes() {
  const grid = document.getElementById('episodes-grid');
  try {
    const [epRes, authRes] = await Promise.all([fetch('/api/episodes'), fetch('/api/auth/check')]);
    allEpisodes = await epRes.json();
    isAdmin = (await authRes.json()).authenticated;
    if (isAdmin) document.body.classList.add('is-admin');
    const adminBtn = document.getElementById('nav-admin-btn');
    if (adminBtn) adminBtn.style.display = isAdmin ? '' : 'none';
    displayCount = 12;
    updateHeroLatest();
    renderTagFilter();
    renderEpisodes();
    updateJsonLd(allEpisodes);
    // Deep-link: ?ep=ID でそのエピソードにスクロール
    const epId = new URLSearchParams(window.location.search).get('ep');
    if (epId) {
      const target = document.getElementById('episode-' + epId);
      if (target) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.style.outline = '3px solid var(--pop-pink)';
          target.style.outlineOffset = '4px';
          setTimeout(() => { target.style.outline = ''; target.style.outlineOffset = ''; }, 2500);
        }, 400);
      }
    }
  } catch {
    grid.innerHTML = '<div class="state-empty"><p>読み込みに失敗しました。</p></div>';
  }
}

// ===== Search =====
const searchInput = document.getElementById('episodes-search');
if (searchInput) {
  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    displayCount = 12;
    renderEpisodes();
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') { searchInput.value = ''; searchQuery = ''; displayCount = 12; renderEpisodes(); searchInput.blur(); }
  });
}

// ===== Keyboard Shortcuts =====
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    e.preventDefault();
    const el = document.getElementById('episodes-search');
    if (el) { el.focus(); el.select(); }
  }
});

loadEpisodes();

// ===== Theme Toggle =====
const themeToggle = document.getElementById('btn-theme-toggle');
if (themeToggle) {
  const isNewspaper = () => document.documentElement.getAttribute('data-theme') === 'newspaper';
  themeToggle.textContent = isNewspaper() ? '🎨' : '📰';
  themeToggle.addEventListener('click', () => {
    if (isNewspaper()) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'default');
      themeToggle.textContent = '📰';
    } else {
      document.documentElement.setAttribute('data-theme', 'newspaper');
      localStorage.setItem('theme', 'newspaper');
      themeToggle.textContent = '🎨';
    }
  });
}

// ===== Service Worker =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ===== Scroll to top =====
const scrollTopBtn = document.getElementById('btn-scroll-top');
if (scrollTopBtn) {
  window.addEventListener('scroll', () => {
    scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
}

// ===== Edit Modal =====
let editingId = null;
const editModal = document.getElementById('edit-modal');
function openEditModal(ep) {
  editingId = ep.id;
  document.getElementById('edit-date').value = ep.date;
  document.getElementById('edit-title').value = ep.title;
  document.getElementById('edit-description').value = ep.description || '';
  const spaceUrlEl = document.getElementById('edit-space-url');
  if (spaceUrlEl) spaceUrlEl.value = ep.spaceUrl || '';
  const spotifyUrlEl = document.getElementById('edit-spotify-url');
  if (spotifyUrlEl) spotifyUrlEl.value = ep.spotifyUrl || '';
  editModal.classList.add('open');
}
function closeEditModal() { editModal.classList.remove('open'); editingId = null; }
document.getElementById('modal-close').addEventListener('click', closeEditModal);
document.getElementById('modal-cancel').addEventListener('click', closeEditModal);
editModal.addEventListener('click', e => { if (e.target === editModal) closeEditModal(); });

document.getElementById('modal-save').addEventListener('click', async () => {
  const date = document.getElementById('edit-date').value.trim();
  const title = document.getElementById('edit-title').value.trim();
  const description = document.getElementById('edit-description').value.trim();
  const spaceUrl = document.getElementById('edit-space-url')?.value.trim() || '';
  const spotifyUrl = document.getElementById('edit-spotify-url')?.value.trim() || '';
  if (!date || !title) return showToast('日付とタイトルは必須です', 'error');
  const btn = document.getElementById('modal-save');
  btn.disabled = true; btn.textContent = '保存中…';
  try {
    const res = await fetch(`/api/episodes/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date, description, spaceUrl, spotifyUrl })
    });
    if (!res.ok) throw new Error((await res.json()).error);
    closeEditModal();
    showToast('保存しました！', 'success');
    loadEpisodes();
  } catch (err) {
    showToast(err.message || '保存に失敗しました', 'error');
  } finally { btn.disabled = false; btn.textContent = '保存する'; }
});

// ===== Toast =====
let toastTimer;
const toast = document.getElementById('toast');
function showToast(msg, type='success') {
  toast.textContent = type === 'success' ? '✓ ' + msg : '✕ ' + msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ===== Speakers =====
const AVATAR_STYLES = { reporter: 'speaker-avatar--reporter', desk: 'speaker-avatar--desk' };

function renderSpeaker(p) {
  const avatarClass = AVATAR_STYLES[p.id] || 'speaker-avatar--reporter';
  const roleClass   = p.id === 'desk' ? 'speaker-role speaker-role--desk' : 'speaker-role';
  const svgFallback = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>`;
  const photoHtml = p.photo
    ? `<img src="${escHtml(p.photo)}" alt="${escHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">${svgFallback}`
    : svgFallback;
  return `
    <div class="speaker-card">
      <div class="speaker-avatar ${avatarClass}">${photoHtml}</div>
      <div class="speaker-info">
        <span class="${roleClass}">${escHtml(p.role || '')}</span>
        <h3 class="speaker-name">${escHtml(p.name || '')}${p.kana ? `<span class="speaker-name-kana">${escHtml(p.kana)}</span>` : ''}</h3>
        <p class="speaker-bio">${escHtml(p.bio || '')}</p>
        ${(p.xAccount || p.website) ? `
        <div class="speaker-links">
          ${p.xAccount ? `<a class="speaker-link speaker-link--x" href="${escHtml(xAccountUrl(p.xAccount))}" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            ${escHtml(p.xAccount.startsWith('@') ? p.xAccount : '@' + p.xAccount.replace(/.*x\.com\//, ''))}
          </a>` : ''}
          ${p.website ? `<a class="speaker-link speaker-link--web" href="${escHtml(p.website)}" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            ウェブサイト
          </a>` : ''}
        </div>` : ''}
      </div>
    </div>`;
}

async function loadProfiles() {
  const grid = document.getElementById('speakers-grid');
  if (!grid) return;
  try {
    const res = await fetch('/api/profiles');
    if (!res.ok) return;
    const profiles = await res.json();
    if (profiles.length) grid.innerHTML = profiles.map(renderSpeaker).join('');
  } catch {}
}

loadProfiles();

// ===== Settings =====
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const settings = await res.json();
    const el = document.getElementById('hero-desc');
    if (el && settings.heroDescription) el.textContent = settings.heroDescription;
  } catch {}
}

loadSettings();

// ===== Voice Form =====
async function submitVoice(e) {
  e.preventDefault();
  const name    = document.getElementById('voice-name')?.value.trim() || '';
  const contact = document.getElementById('voice-contact')?.value.trim() || '';
  const message = document.getElementById('voice-message')?.value.trim() || '';
  if (!message) return;
  const btn = document.getElementById('voice-submit');
  btn.disabled = true; btn.textContent = '送信中…';
  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contact, message })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || '送信に失敗しました'); btn.disabled = false; btn.textContent = '送信する'; return; }
    document.getElementById('voice-form').style.display = 'none';
    document.getElementById('voice-thanks').style.display = 'block';
  } catch {
    alert('送信に失敗しました。もう一度お試しください。');
    btn.disabled = false; btn.textContent = '送信する';
  }
}
