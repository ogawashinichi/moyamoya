// ===== Auth =====
(async () => {
  const res = await fetch('/api/auth/check');
  const { authenticated } = await res.json();
  if (!authenticated) location.href = '/login.html?next=/profiles.html';
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
function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

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

// ===== Load profiles =====
async function loadProfiles() {
  try {
    const res = await fetch('/api/profiles');
    if (!res.ok) return;
    const profiles = await res.json();
    for (const p of profiles) {
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      set(`profile-role-${p.id}`, p.role);
      set(`profile-name-${p.id}`, p.name);
      set(`profile-kana-${p.id}`, p.kana);
      set(`profile-bio-${p.id}`, p.bio);
      set(`profile-x-${p.id}`, p.xAccount);
      set(`profile-website-${p.id}`, p.website);
      if (p.photo) {
        const img = document.getElementById(`photo-${p.id}`);
        const noPhoto = document.getElementById(`no-photo-${p.id}`);
        if (img) { img.src = p.photo; img.style.display = 'block'; }
        if (noPhoto) noPhoto.style.display = 'none';
      }
    }
  } catch {}
}

// ===== Save profile =====
async function saveProfile(role) {
  const get = id => document.getElementById(id)?.value.trim() || '';
  const role_val = get(`profile-role-${role}`);
  const name     = get(`profile-name-${role}`);
  const kana     = get(`profile-kana-${role}`);
  const bio      = get(`profile-bio-${role}`);
  const xAccount = get(`profile-x-${role}`);
  const website  = get(`profile-website-${role}`);

  if (!name) return showToast('名前を入力してください', 'error');
  if (!role_val) return showToast('役割ラベルを入力してください', 'error');

  const btn = [...document.querySelectorAll('.btn-submit')].find(b => b.getAttribute('onclick') === `saveProfile('${role}')`);
  if (btn) { btn.disabled = true; btn.textContent = '保存中…'; }
  try {
    const res = await fetch(`/api/profiles/${role}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: role_val, name, kana, bio, xAccount, website })
    });
    if (res.status === 401) { location.href = '/login.html'; return; }
    if (!res.ok) throw new Error((await res.json()).error || '保存失敗');
    showToast('プロフィールを保存しました！', 'success');
  } catch (err) {
    showToast(err.message || '保存に失敗しました', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '保存する'; }
  }
}

// ===== Photo upload =====
async function uploadPhoto(role, name) {
  const input = document.getElementById(`photo-input-${role}`);
  if (!input || !input.files[0]) { showToast('画像ファイルを選択してください', 'error'); return; }
  const file = input.files[0];
  if (file.size > 10 * 1024 * 1024) { showToast('ファイルサイズは10MB以下にしてください', 'error'); return; }
  const formData = new FormData();
  formData.append('profileId', role);
  formData.append('name', name);
  formData.append('image', file);
  const btn = document.querySelector(`button[onclick="uploadPhoto('${role}', '${name}')"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'アップロード中…'; }
  try {
    const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
    if (res.status === 401) { location.href = '/login.html'; return; }
    if (!res.ok) throw new Error((await res.json()).error || 'アップロード失敗');
    const { url } = await res.json();
    const img = document.getElementById(`photo-${role}`);
    const noPhoto = document.getElementById(`no-photo-${role}`);
    if (img) { img.src = url + '?t=' + Date.now(); img.style.display = 'block'; }
    if (noPhoto) noPhoto.style.display = 'none';
    showToast('写真をアップロードしました！', 'success');
    input.value = '';
  } catch (err) {
    showToast(err.message || 'アップロードに失敗しました', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📷 写真をアップロード'; }
  }
}

loadProfiles();
loadUnreadBadge();
