const BADGE_COLORS = ['#ff4757','#ff6b35','#9c27b0','#0097a7','#388e3c','#e91e8c'];

// ===== Theme Toggle =====
(function() {
  const btn = document.getElementById('btn-theme-toggle');
  if (!btn) return;
  const isNewspaper = () => document.documentElement.getAttribute('data-theme') === 'newspaper';
  btn.textContent = isNewspaper() ? '🎨' : '📰';
  btn.addEventListener('click', () => {
    if (isNewspaper()) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'default');
      btn.textContent = '📰';
    } else {
      document.documentElement.setAttribute('data-theme', 'newspaper');
      localStorage.setItem('theme', 'newspaper');
      btn.textContent = '🎨';
    }
  });
})();

// ===== Auth check =====
(async () => {
  const res = await fetch('/api/auth/check');
  const { authenticated } = await res.json();
  if (!authenticated) window.location.href = '/login.html';
})();

// ===== Logout =====
document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

// ===== DOM refs =====
const form = document.getElementById('register-form');
const btnSubmit = document.getElementById('btn-submit');
const toast = document.getElementById('toast');
const recentList = document.getElementById('recent-list');
const editModal = document.getElementById('edit-modal');

// ===== Input type toggle =====
let currentInputType = 'link';
function switchInputType(type) {
  currentInputType = type;
  document.getElementById('tab-link').classList.toggle('active', type === 'link');
  document.getElementById('tab-spotify').classList.toggle('active', type === 'spotify');
  document.getElementById('section-link').style.display = type === 'link' ? '' : 'none';
  document.getElementById('section-spotify').style.display = type === 'spotify' ? '' : 'none';
}

// ===== Register form =====
form.addEventListener('submit', e => {
  e.preventDefault();
  const date = document.getElementById('input-date').value.trim();
  const title = document.getElementById('input-title').value.trim();
  const description = document.getElementById('input-description').value.trim();
  if (!date) return showToast('配信日を入力してください', 'error');
  if (!title) return showToast('タイトルを入力してください', 'error');

  const tagsRaw = document.getElementById('input-tags').value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  const audioUrl = document.getElementById('input-audio-url').value.trim();

  if (currentInputType === 'spotify') {
    const spotifyUrl = document.getElementById('input-spotify-url').value.trim();
    if (!spotifyUrl) return showToast('SpotifyエピソードURLを入力してください', 'error');
    btnSubmit.disabled = true; btnSubmit.textContent = '登録中…';
    fetch('/api/episodes/spotify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date, description, spotifyUrl, audioUrl, tags })
    }).then(async res => {
      btnSubmit.disabled = false; btnSubmit.textContent = '登録する';
      if (res.status === 401) { window.location.href = '/login.html'; return; }
      if (!res.ok) { const d = await res.json(); showToast(d.error || '登録に失敗しました', 'error'); return; }
      showToast('登録しました！', 'success');
      form.reset(); switchInputType('link'); loadEpisodes();
    }).catch(() => { btnSubmit.disabled = false; btnSubmit.textContent = '登録する'; showToast('エラーが発生しました', 'error'); });
    return;
  }

  // Xスペースリンク
  const spaceUrl = document.getElementById('input-space-url').value.trim();
  if (!spaceUrl) return showToast('XスペースURLを入力してください', 'error');
  btnSubmit.disabled = true; btnSubmit.textContent = '登録中…';
  fetch('/api/episodes/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, date, description, spaceUrl, audioUrl, tags })
  }).then(async res => {
    btnSubmit.disabled = false; btnSubmit.textContent = '登録する';
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    if (!res.ok) { const d = await res.json(); showToast(d.error || '登録に失敗しました', 'error'); return; }
    showToast('登録しました！', 'success');
    form.reset(); loadEpisodes();
  }).catch(() => { btnSubmit.disabled = false; btnSubmit.textContent = '登録する'; showToast('エラーが発生しました', 'error'); });
});

// ===== Edit modal =====
let editingId = null;
function openEditModal(ep) {
  editingId = ep.id;
  document.getElementById('edit-date').value = ep.date;
  document.getElementById('edit-title').value = ep.title;
  document.getElementById('edit-description').value = ep.description || '';
  const spaceUrlEl = document.getElementById('edit-space-url');
  if (spaceUrlEl) spaceUrlEl.value = ep.spaceUrl || '';
  const spotifyUrlEl = document.getElementById('edit-spotify-url');
  if (spotifyUrlEl) spotifyUrlEl.value = ep.spotifyUrl || '';
  const audioUrlEl = document.getElementById('edit-audio-url');
  if (audioUrlEl) audioUrlEl.value = ep.audioUrl || '';
  const tagsEl = document.getElementById('edit-tags');
  if (tagsEl) tagsEl.value = (ep.tags || []).join(', ');
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
  const audioUrl = document.getElementById('edit-audio-url')?.value.trim() || '';
  const tagsRaw = document.getElementById('edit-tags')?.value.trim() || '';
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  if (!date) return showToast('配信日を入力してください', 'error');
  if (!title) return showToast('タイトルを入力してください', 'error');

  const btn = document.getElementById('modal-save');
  btn.disabled = true; btn.textContent = '保存中…';
  try {
    const res = await fetch(`/api/episodes/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date, description, spaceUrl, spotifyUrl, audioUrl, tags })
    });
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    if (!res.ok) throw new Error((await res.json()).error);
    closeEditModal();
    showToast('保存しました！', 'success');
    loadEpisodes();
  } catch (err) {
    showToast(err.message || '保存に失敗しました', 'error');
  } finally {
    btn.disabled = false; btn.textContent = '保存する';
  }
});

// ===== Load episodes =====
function formatDate(d) { const [y,m,day]=d.split('-'); return `${y}年${parseInt(m)}月${parseInt(day)}日`; }

async function loadEpisodes() {
  try {
    const res = await fetch('/api/episodes');
    const episodes = await res.json();
    if (!episodes.length) { recentList.innerHTML = '<p style="color:var(--muted);font-size:14px;">まだエピソードがありません。</p>'; return; }
    const rssWarn = document.getElementById('rss-warn');
    if (rssWarn) {
      const noAudio = episodes.filter(ep => !ep.audioUrl).length;
      if (noAudio > 0) {
        rssWarn.textContent = `⚠️ ${noAudio}件のエピソードに音声URL（RSS用）が未設定です`;
        rssWarn.style.display = 'block';
      } else {
        rssWarn.style.display = 'none';
      }
    }
    const total = episodes.length;
    recentList.innerHTML = episodes.map((ep, i) => {
      const num = total - i;
      const color = BADGE_COLORS[(num-1) % BADGE_COLORS.length];
      return `
        <div class="recent-item" style="--badge-color:${color}">
          <div class="recent-item-body">
            <div class="recent-item-date">第${num}回 · ${formatDate(ep.date)}</div>
            <div class="recent-item-title">${escHtml(ep.title)}</div>
          </div>
          <button class="recent-item-edit" title="編集" data-id="${ep.id}">✏️</button>
          <button class="recent-item-delete" title="削除" data-id="${ep.id}" data-title="${escHtml(ep.title)}">🗑️</button>
        </div>`;
    }).join('');

    recentList.querySelectorAll('.recent-item-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const ep = episodes.find(e => e.id === btn.dataset.id);
        if (ep) openEditModal(ep);
      });
    });

    recentList.querySelectorAll('.recent-item-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`「${btn.dataset.title}」を削除しますか？\nこの操作は取り消せません。`)) return;
        try {
          const res = await fetch(`/api/episodes/${btn.dataset.id}`, { method: 'DELETE' });
          if (res.status === 401) { window.location.href = '/login.html'; return; }
          if (!res.ok) throw new Error((await res.json()).error);
          showToast('削除しました', 'success');
          loadEpisodes();
        } catch (err) {
          showToast(err.message || '削除に失敗しました', 'error');
        }
      });
    });
  } catch { recentList.innerHTML = '<p style="color:var(--muted);font-size:14px;">読み込みに失敗しました</p>'; }
}

// ===== Toast =====
let toastTimer;
function showToast(msg, type='success') {
  toast.textContent = type === 'success' ? '✓ ' + msg : '✕ ' + msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
function escHtml(str) { return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

loadEpisodes();

// ===== Dashboard Stats =====
async function loadStats() {
  try {
    const [epRes, msgRes, schRes] = await Promise.all([
      fetch('/api/episodes'),
      fetch('/api/messages'),
      fetch('/api/schedules/all')
    ]);
    const episodes  = await epRes.json();
    const messages  = await msgRes.json();
    const schedules = await schRes.json();
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = schedules.filter(s => s.published && s.date >= today).length;
    const unread   = messages.filter(m => !m.read).length;

    const setNum = (id, n, suffix='') => {
      const el = document.getElementById(id);
      if (!el) return;
      el.querySelector('.dash-stat-num').textContent = n + suffix;
    };
    setNum('stat-episodes', episodes.length, '本');
    setNum('stat-unread',   unread,           '件');
    setNum('stat-schedule', upcoming,         '件');

    const unreadStat = document.getElementById('stat-unread');
    if (unreadStat) unreadStat.classList.toggle('dash-stat--alert', unread > 0);
  } catch {}
}

loadStats();

// ===== Unread badge =====
async function loadUnreadBadge() {
  try {
    const res = await fetch('/api/messages');
    if (!res.ok) return;
    const messages = await res.json();
    const unread = messages.filter(m => !m.read).length;
    const badge = document.getElementById('msg-unread-badge');
    if (badge) {
      badge.textContent = unread > 0 ? unread : '';
      badge.style.display = unread > 0 ? 'inline-block' : 'none';
    }
  } catch {}
}

loadUnreadBadge();
