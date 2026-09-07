// ===== Theme Toggle =====
(function() {
  const btn = document.getElementById('btn-theme-toggle');
  if (!btn) return;
  const isNewspaper = () => document.documentElement.getAttribute('data-theme') === 'newspaper';
  btn.textContent = isNewspaper() ? '🎨' : '📰';
  btn.addEventListener('click', () => {
    if (isNewspaper()) { document.documentElement.removeAttribute('data-theme'); localStorage.setItem('theme', 'default'); btn.textContent = '📰'; }
    else { document.documentElement.setAttribute('data-theme', 'newspaper'); localStorage.setItem('theme', 'newspaper'); btn.textContent = '🎨'; }
  });
})();

// ===== Auth =====
(async () => {
  const res = await fetch('/api/auth/check');
  const { authenticated } = await res.json();
  if (!authenticated) location.href = '/login.html?next=/schedule.html';
})();

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = '/login.html';
});

// ===== Utils =====
function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDate(date, time) {
  const d = new Date(date);
  const y = d.getFullYear(), m = d.getMonth()+1, day = d.getDate();
  const weekday = ['日','月','火','水','木','金','土'][d.getDay()];
  let s = `${y}年${m}月${day}日（${weekday}）`;
  if (time) s += ` ${time}〜`;
  return s;
}
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = type === 'success' ? '✓ ' + msg : '✕ ' + msg;
  t.className = `toast toast--${type} toast--show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('toast--show'), 3000);
}

let allSchedules = [];
let editingId = null;

// ===== Load =====
async function loadSchedules() {
  const list = document.getElementById('schedule-list');
  try {
    const res = await fetch('/api/schedules/all');
    if (!res.ok) { list.innerHTML = '<p style="color:var(--muted)">ログインが必要です</p>'; return; }
    allSchedules = await res.json();
    renderList();
  } catch {
    list.innerHTML = '<p style="color:var(--muted)">読み込みに失敗しました</p>';
  }
}

function renderList() {
  const list = document.getElementById('schedule-list');
  if (!allSchedules.length) { list.innerHTML = '<p style="color:var(--muted);font-size:14px;">スケジュールはまだありません</p>'; return; }
  list.innerHTML = allSchedules.map(s => `
    <div class="recent-item" id="sched-${s.id}">
      <div class="recent-item-header">
        <div>
          <span class="sched-date">${escHtml(formatDate(s.date, s.time))}</span>
          <span class="sched-pub-badge ${s.published ? 'sched-pub-badge--on' : ''}">${s.published ? '公開中' : '非公開'}</span>
        </div>
        <div class="recent-item-actions">
          <button class="btn-publish-msg ${s.published ? 'btn-publish-msg--on' : ''}" onclick="togglePublish('${s.id}')">${s.published ? '✅ 公開中' : '📢 公開する'}</button>
          <button class="btn-edit" onclick="openEdit('${s.id}')">編集</button>
          <button class="btn-delete" onclick="deleteSchedule('${s.id}')">削除</button>
        </div>
      </div>
      <div class="recent-item-title">${escHtml(s.title)}</div>
      ${s.description ? `<div class="recent-item-desc" style="font-size:13px;color:var(--muted);margin-top:4px;">${escHtml(s.description)}</div>` : ''}
      ${s.url ? `<a href="${escHtml(s.url)}" target="_blank" rel="noopener" style="font-size:12px;color:var(--pop-pink);">🔗 ${escHtml(s.url)}</a>` : ''}
    </div>`).join('');
}

// ===== Add =====
document.getElementById('schedule-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('s-submit');
  btn.disabled = true; btn.textContent = '追加中…';
  const body = {
    date: document.getElementById('s-date').value,
    time: document.getElementById('s-time').value,
    title: document.getElementById('s-title').value.trim(),
    description: document.getElementById('s-desc').value.trim(),
    url: document.getElementById('s-url').value.trim(),
    published: document.getElementById('s-published').checked
  };
  try {
    const res = await fetch('/api/schedules', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || '追加に失敗しました', 'error'); return; }
    allSchedules.push(data);
    allSchedules.sort((a, b) => a.date.localeCompare(b.date));
    renderList();
    e.target.reset();
    showToast('スケジュールを追加しました');
  } catch { showToast('追加に失敗しました', 'error'); }
  finally { btn.disabled = false; btn.textContent = '追加する'; }
});

// ===== Toggle Publish =====
async function togglePublish(id) {
  const res = await fetch(`/api/schedules/${id}/publish`, { method: 'PATCH' });
  const data = await res.json();
  const s = allSchedules.find(s => s.id === id);
  if (s) s.published = data.published;
  renderList();
  showToast(data.published ? '公開しました' : '非公開にしました');
}

// ===== Delete =====
async function deleteSchedule(id) {
  if (!confirm('このスケジュールを削除しますか？')) return;
  await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
  allSchedules = allSchedules.filter(s => s.id !== id);
  renderList();
  showToast('削除しました');
}

// ===== Edit Modal =====
function openEdit(id) {
  const s = allSchedules.find(s => s.id === id);
  if (!s) return;
  editingId = id;
  document.getElementById('e-date').value = s.date;
  document.getElementById('e-time').value = s.time || '';
  document.getElementById('e-title').value = s.title;
  document.getElementById('e-desc').value = s.description || '';
  document.getElementById('e-url').value = s.url || '';
  document.getElementById('e-published').checked = s.published;
  document.getElementById('edit-modal').classList.add('open');
}
document.getElementById('modal-close').addEventListener('click', () => { document.getElementById('edit-modal').classList.remove('open'); editingId = null; });
document.getElementById('modal-cancel').addEventListener('click', () => { document.getElementById('edit-modal').classList.remove('open'); editingId = null; });
document.getElementById('modal-save').addEventListener('click', async () => {
  if (!editingId) return;
  const body = {
    date: document.getElementById('e-date').value,
    time: document.getElementById('e-time').value,
    title: document.getElementById('e-title').value.trim(),
    description: document.getElementById('e-desc').value.trim(),
    url: document.getElementById('e-url').value.trim(),
    published: document.getElementById('e-published').checked
  };
  const res = await fetch(`/api/schedules/${editingId}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) { showToast(data.error || '保存に失敗しました', 'error'); return; }
  const idx = allSchedules.findIndex(s => s.id === editingId);
  if (idx !== -1) allSchedules[idx] = data;
  allSchedules.sort((a, b) => a.date.localeCompare(b.date));
  renderList();
  document.getElementById('edit-modal').classList.remove('open');
  editingId = null;
  showToast('保存しました');
});

// ===== Unread badge =====
async function loadUnreadBadge() {
  try {
    const res = await fetch('/api/messages');
    if (!res.ok) return;
    const msgs = await res.json();
    const unread = msgs.filter(m => !m.read).length;
    const nav = document.getElementById('nav-messages');
    if (nav && unread > 0) nav.innerHTML += ` <span class="msg-badge" style="font-size:11px;padding:1px 6px;">${unread}</span>`;
  } catch {}
}

loadSchedules();
loadUnreadBadge();
