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
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const settings = await res.json();
    const el = document.getElementById('setting-hero-desc');
    if (el && settings.heroDescription) el.value = settings.heroDescription;
  } catch {}
}

async function saveSettings() {
  const heroDescription = document.getElementById('setting-hero-desc')?.value.trim();
  const btn = document.querySelector('button[onclick="saveSettings()"]');
  if (btn) { btn.disabled = true; btn.textContent = '保存中…'; }
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heroDescription })
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
