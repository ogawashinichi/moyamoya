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

function getMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return { m4a:'audio/mp4', mp4:'audio/mp4', mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', aac:'audio/aac' }[ext] || 'audio/mpeg';
}
function formatDate(d) { const [y,m,day]=d.split('-'); return `${y}年${parseInt(m)}月${parseInt(day)}日`; }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderEpisode(episode, index, total) {
  const num = total - index;
  const ci = (num - 1) % BADGE_COLORS.length;
  const card = document.createElement('article');
  card.className = 'episode-card';
  card.style.setProperty('--badge-color', BADGE_COLORS[ci]);
  card.style.setProperty('--card-gradient', CARD_GRADIENTS[ci]);
  card.innerHTML = `
    <div class="episode-card-bg-num">${num}</div>
    <div class="episode-meta">
      <span class="episode-num">第${num}回</span>
      <div class="episode-meta-right">
        <time class="episode-date" datetime="${episode.date}">${formatDate(episode.date)}</time>
        ${isAdmin ? `<button class="episode-edit-btn" title="編集" data-id="${episode.id}"><svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>` : ''}
      </div>
    </div>
    <h3 class="episode-title">${escHtml(episode.title)}</h3>
    ${episode.description ? `<div class="episode-description">${escHtml(episode.description)}</div>` : ''}
    <div class="episode-player">
      ${episode.spotifyUrl
        ? `<iframe
            src="${escHtml(toSpotifyEmbedUrl(episode.spotifyUrl))}"
            width="100%" height="152" frameborder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy" style="border-radius:10px;"></iframe>`
        : episode.spaceUrl
          ? `<a class="space-link-btn" href="${escHtml(episode.spaceUrl)}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>Xスペースで聴く</a>`
          : `<audio controls preload="none"><source src="/data/${encodeURIComponent(episode.filename)}" type="${getMimeType(episode.filename)}"></audio>`}
    </div>
  `;
  if (isAdmin) {
    card.querySelector('.episode-edit-btn').addEventListener('click', () => openEditModal(episode));
  }
  return card;
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

// ===== Load =====
async function loadEpisodes() {
  const grid = document.getElementById('episodes-grid');
  const countEl = document.getElementById('episode-count');
  const sectionCount = document.getElementById('section-count');
  try {
    const [epRes, authRes] = await Promise.all([fetch('/api/episodes'), fetch('/api/auth/check')]);
    allEpisodes = await epRes.json();
    isAdmin = (await authRes.json()).authenticated;
    if (isAdmin) document.body.classList.add('is-admin');
    grid.innerHTML = '';
    if (!allEpisodes.length) {
      grid.innerHTML = '<div class="state-empty"><p>まだエピソードがありません。</p></div>';
      return;
    }
    if (countEl) countEl.textContent = allEpisodes.length;
    sectionCount.textContent = `全${allEpisodes.length}件`;
    allEpisodes.forEach((ep, i) => grid.appendChild(renderEpisode(ep, i, allEpisodes.length)));
  } catch {
    grid.innerHTML = '<div class="state-empty"><p>読み込みに失敗しました。</p></div>';
  }
}

loadEpisodes();

function toSpotifyEmbedUrl(url) {
  // https://open.spotify.com/episode/ID → https://open.spotify.com/embed/episode/ID
  return url.replace('open.spotify.com/', 'open.spotify.com/embed/').split('?')[0];
}

function xAccountUrl(val) {
  if (!val) return '#';
  if (val.startsWith('http')) return val;
  const handle = val.replace(/^@/, '');
  return `https://x.com/${handle}`;
}

// ===== Speakers =====
const AVATAR_STYLES = {
  reporter: 'speaker-avatar--reporter',
  desk:     'speaker-avatar--desk',
};

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

// ===== Site settings =====
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
  btn.disabled = true;
  btn.textContent = '送信中…';
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
    btn.disabled = false;
    btn.textContent = '送信する';
  }
}
