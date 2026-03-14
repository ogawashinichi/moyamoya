// ===== Auth check =====
(async () => {
  const res = await fetch('/api/auth/check');
  const data = await res.json();
  if (!data.authenticated) { location.href = '/login.html?next=/messages.html'; }
})();

// ===== Utils =====
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast toast--${type} toast--show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('toast--show'), 3000);
}

// ===== State =====
let allMessages = [];
let currentFilter = 'all';

// ===== Load =====
async function loadMessages() {
  const list = document.getElementById('messages-list');
  try {
    const res = await fetch('/api/messages');
    if (!res.ok) { list.innerHTML = '<p class="loading-text">ログインが必要です</p>'; return; }
    allMessages = await res.json();
    updateBadge();
    renderMessages();
  } catch {
    list.innerHTML = '<p class="loading-text">読み込みに失敗しました</p>';
  }
}

function updateBadge() {
  const unread = allMessages.filter(m => !m.read).length;
  const badge = document.getElementById('msg-unread-badge');
  const markAllBtn = document.getElementById('btn-mark-all');
  if (badge) {
    badge.textContent = unread > 0 ? `未読 ${unread}件` : '';
    badge.style.display = unread > 0 ? 'inline-block' : 'none';
  }
  if (markAllBtn) markAllBtn.style.display = unread > 0 ? 'inline-block' : 'none';
}

function renderMessages() {
  const list = document.getElementById('messages-list');
  const filtered = allMessages.filter(m => {
    if (currentFilter === 'unread') return !m.read;
    if (currentFilter === 'read') return m.read;
    return true;
  });
  if (!filtered.length) {
    list.innerHTML = `<p class="loading-text">${currentFilter === 'unread' ? '未読メッセージはありません' : currentFilter === 'read' ? '既読メッセージはありません' : 'まだメッセージはありません'}</p>`;
    return;
  }
  list.innerHTML = filtered.map(m => `
    <div class="msg-card ${m.read ? 'msg-card--read' : ''}" id="msg-${m.id}">
      <div class="msg-meta">
        <span class="msg-name">${escHtml(m.name)}</span>
        <span class="msg-date">${formatDate(m.createdAt)}</span>
        ${!m.read ? '<span class="msg-new">NEW</span>' : ''}
      </div>
      <p class="msg-body">${escHtml(m.message)}</p>
      <div class="msg-actions">
        ${!m.read ? `<button class="btn-read" onclick="markRead('${m.id}')">既読にする</button>` : ''}
        <button class="btn-delete-msg" onclick="deleteMessage('${m.id}')">削除</button>
      </div>
    </div>`).join('');
}

// ===== Filter =====
function filterMessages(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.msg-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderMessages();
}

// ===== Actions =====
async function markRead(id) {
  await fetch(`/api/messages/${id}/read`, { method: 'PATCH' });
  const m = allMessages.find(m => m.id === id);
  if (m) m.read = true;
  updateBadge();
  renderMessages();
  showToast('既読にしました');
}

async function markAllRead() {
  const unread = allMessages.filter(m => !m.read);
  await Promise.all(unread.map(m => fetch(`/api/messages/${m.id}/read`, { method: 'PATCH' })));
  allMessages.forEach(m => m.read = true);
  updateBadge();
  renderMessages();
  showToast('すべて既読にしました');
}

async function deleteMessage(id) {
  if (!confirm('このメッセージを削除しますか？')) return;
  await fetch(`/api/messages/${id}`, { method: 'DELETE' });
  allMessages = allMessages.filter(m => m.id !== id);
  updateBadge();
  renderMessages();
  showToast('削除しました');
}

// ===== Logout =====
document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = '/login.html';
});

loadMessages();
