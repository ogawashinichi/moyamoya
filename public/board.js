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

// ===== Utils =====
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

// ===== Load Board =====
async function loadBoard() {
  const list = document.getElementById('board-list');
  try {
    const res = await fetch('/api/board');
    const messages = await res.json();
    if (!messages.length) {
      list.innerHTML = '<div class="board-empty"><p>まだ掲載されている声はありません</p></div>';
      return;
    }
    list.innerHTML = messages.map(m => `
      <div class="board-card">
        <div class="board-card-meta">
          <span class="board-card-name">${escHtml(m.name)}</span>
          <span class="board-card-date">${formatDate(m.createdAt)}</span>
        </div>
        <p class="board-card-body">${escHtml(m.message)}</p>
      </div>`).join('');
  } catch {
    list.innerHTML = '<div class="board-empty"><p>読み込みに失敗しました</p></div>';
  }
}

loadBoard();
