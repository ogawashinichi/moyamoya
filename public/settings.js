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

// ===== Auth =====
(async () => {
  const res = await fetch('/api/auth/check');
  const { authenticated } = await res.json();
  if (!authenticated) location.href = '/login.html?next=/settings.html';
})();

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = '/login.html';
});

// ===== Utils =====
let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = type === 'success' ? '✓ ' + msg : '✕ ' + msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ===== Unread badge =====
async function loadUnreadBadge() {
  try {
    const res = await fetch('/api/messages');
    if (!res.ok) return;
    const messages = await res.json();
    const unread = messages.filter(m => !m.read).length;
    const nav = document.getElementById('nav-messages');
    if (nav && unread > 0) nav.innerHTML += ` <span class="msg-badge" style="font-size:11px;padding:1px 6px;">${unread}</span>`;
  } catch {}
}

// ===== Settings =====
function updateAnnouncePreview() {
  const enabled = document.getElementById('setting-announce-enabled')?.checked;
  const text    = document.getElementById('setting-announce-text')?.value.trim();
  const preview = document.getElementById('announce-preview');
  const link    = document.getElementById('announce-preview-link');
  if (!preview || !link) return;
  if (enabled && text) {
    link.textContent = text + ' →';
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
}

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const s = await res.json();
    const el = document.getElementById('setting-hero-desc');
    if (el && s.heroDescription) el.value = s.heroDescription;
    const ae = document.getElementById('setting-announce-enabled');
    const at = document.getElementById('setting-announce-text');
    const au = document.getElementById('setting-announce-url');
    const ne = document.getElementById('setting-notify-email');
    if (ae) ae.checked = !!s.announceEnabled;
    if (at) at.value = s.announceText || '';
    if (au) au.value = s.announceUrl || '';
    if (ne) ne.value = s.notifyEmail || '';
    const ap = document.getElementById('setting-apple-podcast-url');
    const ss = document.getElementById('setting-spotify-show-url');
    if (ap) ap.value = s.applePodcastUrl || '';
    if (ss) ss.value = s.spotifyShowUrl || '';
    // Attach preview listeners
    ['setting-announce-enabled', 'setting-announce-text'].forEach(id => {
      const el2 = document.getElementById(id);
      if (el2) { el2.addEventListener('input', updateAnnouncePreview); el2.addEventListener('change', updateAnnouncePreview); }
    });
    updateAnnouncePreview();
  } catch {}
}

async function saveSettings() {
  const heroDescription    = document.getElementById('setting-hero-desc')?.value.trim();
  const announceEnabled    = document.getElementById('setting-announce-enabled')?.checked;
  const announceText       = document.getElementById('setting-announce-text')?.value.trim();
  const announceUrl        = document.getElementById('setting-announce-url')?.value.trim();
  const notifyEmail        = document.getElementById('setting-notify-email')?.value.trim();
  const applePodcastUrl    = document.getElementById('setting-apple-podcast-url')?.value.trim();
  const spotifyShowUrl     = document.getElementById('setting-spotify-show-url')?.value.trim();
  const btn = document.querySelector('button[onclick="saveSettings()"]');
  if (btn) { btn.disabled = true; btn.textContent = '保存中…'; }
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heroDescription, announceEnabled, announceText, announceUrl, notifyEmail, applePodcastUrl, spotifyShowUrl })
    });
    if (res.status === 401) { location.href = '/login.html'; return; }
    if (!res.ok) throw new Error((await res.json()).error || '保存失敗');
    showToast('設定を保存しました！', 'success');
  } catch (err) {
    showToast(err.message || '保存に失敗しました', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '保存する'; }
  }
}

loadSettings();
loadUnreadBadge();
