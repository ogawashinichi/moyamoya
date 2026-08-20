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
function getYearMonth(iso) {
  return iso.slice(0, 7); // "2026-08"
}

// ===== State =====
let allMessages = [];
let currentFilter = 'all';
let currentMonth = null; // null = all months

// ===== Load =====
async function loadMessages() {
  const list = document.getElementById('messages-list');
  try {
    const res = await fetch('/api/messages');
    if (!res.ok) { list.innerHTML = '<p class="loading-text">ログインが必要です</p>'; return; }
    allMessages = await res.json();
    refresh();
  } catch {
    list.innerHTML = '<p class="loading-text">読み込みに失敗しました</p>';
  }
}

function refresh() {
  updateBadge();
  buildMonthNav();
  renderMessages();
}

// ===== Badge =====
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

// ===== Month Nav =====
function buildMonthNav() {
  const nav = document.getElementById('month-nav');
  if (!nav) return;

  const monthMap = new Map();
  for (const m of allMessages) {
    const ym = getYearMonth(m.createdAt);
    if (!monthMap.has(ym)) monthMap.set(ym, { total: 0, unread: 0 });
    const g = monthMap.get(ym);
    g.total++;
    if (!m.read) g.unread++;
  }
  const sorted = [...monthMap.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const yearMap = new Map();
  for (const [ym, counts] of sorted) {
    const year = ym.slice(0, 4);
    if (!yearMap.has(year)) yearMap.set(year, []);
    yearMap.get(year).push([ym, counts]);
  }

  const totalAll = allMessages.length;
  const unreadAll = allMessages.filter(m => !m.read).length;

  let html = `<button class="msg-month-item ${currentMonth === null ? 'active' : ''}" onclick="selectMonth(null)">
    <span>すべて</span>
    <span class="msg-month-count">${totalAll}件${unreadAll ? `<em class="msg-month-unread"> 未読${unreadAll}</em>` : ''}</span>
  </button>`;

  for (const [year, months] of yearMap) {
    html += `<div class="msg-month-year-label">${year}年</div>`;
    for (const [ym, counts] of months) {
      const monthNum = parseInt(ym.slice(5));
      html += `<button class="msg-month-item ${currentMonth === ym ? 'active' : ''}" onclick="selectMonth('${ym}')">
        <span>${monthNum}月</span>
        <span class="msg-month-count">${counts.total}件${counts.unread ? `<em class="msg-month-unread"> 未読${counts.unread}</em>` : ''}</span>
      </button>`;
    }
  }

  nav.innerHTML = html;
}

function selectMonth(ym) {
  currentMonth = ym;
  buildMonthNav();
  renderMessages();
}

// ===== Render =====
function renderMessages() {
  const list = document.getElementById('messages-list');
  let filtered = allMessages.filter(m => {
    if (currentFilter === 'unread') return !m.read;
    if (currentFilter === 'read') return m.read;
    return true;
  });
  if (currentMonth !== null) {
    filtered = filtered.filter(m => getYearMonth(m.createdAt) === currentMonth);
  }
  if (!filtered.length) {
    const emptyMsg = currentFilter === 'unread' ? '未読メッセージはありません'
      : currentFilter === 'read' ? '既読メッセージはありません'
      : currentMonth ? 'この期間のメッセージはありません'
      : 'まだメッセージはありません';
    list.innerHTML = `<p class="loading-text">${emptyMsg}</p>`;
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
  refresh();
  showToast('既読にしました');
}

async function markAllRead() {
  const unread = allMessages.filter(m => !m.read);
  await Promise.all(unread.map(m => fetch(`/api/messages/${m.id}/read`, { method: 'PATCH' })));
  allMessages.forEach(m => m.read = true);
  refresh();
  showToast('すべて既読にしました');
}

async function deleteMessage(id) {
  if (!confirm('このメッセージを削除しますか？')) return;
  await fetch(`/api/messages/${id}`, { method: 'DELETE' });
  allMessages = allMessages.filter(m => m.id !== id);
  refresh();
  showToast('削除しました');
}

// ===== Logout =====
document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = '/login.html';
});

loadMessages();
