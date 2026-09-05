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

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDate(d) { const [y,m,day]=d.split('-'); return `${y}年${parseInt(m)}月${parseInt(day)}日`; }
function toSpotifyEmbedUrl(url) { return url.replace('open.spotify.com/', 'open.spotify.com/embed/').split('?')[0]; }

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = type === 'success' ? '✓ ' + msg : '✕ ' + msg;
  t.className = `toast ${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}

async function loadEpisode() {
  const wrap = document.getElementById('ep-detail');
  const epId = location.pathname.replace('/episode/', '');

  try {
    const res = await fetch('/api/episodes');
    const episodes = await res.json();
    const idx = episodes.findIndex(e => e.id === epId);
    if (idx === -1) { wrap.innerHTML = '<p style="color:var(--muted);padding:60px 0;text-align:center;">エピソードが見つかりませんでした。</p>'; return; }

    const ep = episodes[idx];
    const num = episodes.length - idx;
    const total = episodes.length;
    const epUrl = `${location.origin}/episode/${ep.id}`;

    // Breadcrumb
    wrap.innerHTML = `
      <div class="ep-detail-breadcrumb">
        <a href="/">← アーカイブ一覧</a>
        <span>第${num}回</span>
      </div>

      <article class="ep-detail-card">
        <div class="ep-detail-meta">
          <span class="episode-num" style="font-size:13px;">第${num}回</span>
          <time class="episode-date" datetime="${ep.date}">${formatDate(ep.date)}</time>
        </div>
        <h1 class="ep-detail-title">${escHtml(ep.title)}</h1>
        ${ep.description ? `<p class="ep-detail-desc">${escHtml(ep.description)}</p>` : ''}
        ${ep.tags && ep.tags.length ? `<div class="episode-tags">${ep.tags.map(t => `<span class="episode-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}

        <div class="ep-detail-player">
          ${ep.spotifyUrl
            ? `<button class="spotify-play-btn" id="spotify-btn" data-url="${escHtml(toSpotifyEmbedUrl(ep.spotifyUrl))}">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 11.424c-.18.295-.563.387-.857.207-2.35-1.435-5.305-1.76-8.786-.963-.335.077-.67-.133-.746-.469-.077-.336.132-.67.469-.746 3.809-.871 7.077-.496 9.713 1.115.293.18.386.563.207.856zm1.223-2.723c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.517-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.48.707.257 1.071zm.105-2.835C14.692 5.95 9.375 5.775 6.297 6.71c-.493.15-1.016-.129-1.166-.623-.148-.495.13-1.016.625-1.165 3.532-1.073 9.404-.866 13.115 1.338.445.264.59.838.327 1.282-.264.443-.838.59-1.284.324z"/></svg>
                Spotifyで再生
              </button>`
            : ep.spaceUrl
              ? `<a class="space-link-btn" href="${escHtml(ep.spaceUrl)}" target="_blank" rel="noopener noreferrer">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Xスペースで聴く
                </a>`
              : ''}
        </div>

        <div class="ep-detail-share">
          <button class="episode-share-btn ep-detail-share-btn" id="btn-copy" title="URLをコピー">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            URLをコピー
          </button>
          <button class="episode-tweet-btn ep-detail-share-btn" id="btn-tweet" title="Xでシェア">
            <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Xでシェア
          </button>
          <button class="episode-line-btn ep-detail-share-btn" id="btn-line" title="LINEでシェア">
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19.952 10.876C19.952 6.553 15.613 3 10.302 3 4.99 3 .652 6.553.652 10.876c0 3.865 3.428 7.099 8.057 7.712.314.068.741.207.849.476.097.245.063.629.031.876l-.137.823c-.042.245-.193.957.838.522 1.031-.435 5.561-3.277 7.589-5.609 1.4-1.535 2.073-3.095 2.073-4.8z"/></svg>
            LINEでシェア
          </button>
        </div>

        <div class="ep-detail-nav">
          ${idx < total - 1
            ? `<a class="ep-detail-nav-btn" href="/episode/${episodes[idx+1].id}">← 第${num-1}回「${escHtml(episodes[idx+1].title)}」</a>`
            : '<span></span>'}
          ${idx > 0
            ? `<a class="ep-detail-nav-btn ep-detail-nav-btn--next" href="/episode/${episodes[idx-1].id}">第${num+1}回「${escHtml(episodes[idx-1].title)}」→</a>`
            : ''}
        </div>
      </article>
    `;

    // Spotify lazy load
    const spotifyBtn = document.getElementById('spotify-btn');
    if (spotifyBtn) {
      spotifyBtn.addEventListener('click', () => {
        const iframe = document.createElement('iframe');
        iframe.src = spotifyBtn.dataset.url;
        iframe.width = '100%'; iframe.height = '152'; iframe.frameBorder = '0';
        iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
        iframe.style.borderRadius = '10px';
        spotifyBtn.replaceWith(iframe);
      });
    }

    // Share buttons
    document.getElementById('btn-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(epUrl).then(
        () => showToast('URLをコピーしました'),
        () => showToast('コピーに失敗しました', 'error')
      );
    });
    document.getElementById('btn-tweet').addEventListener('click', () => {
      const text = `【新聞記者のもやもや話】第${num}回「${ep.title}」`;
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(epUrl)}`, '_blank', 'noopener,noreferrer');
    });
    document.getElementById('btn-line').addEventListener('click', () => {
      const text = `【新聞記者のもやもや話】第${num}回「${ep.title}」\n`;
      window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text + epUrl)}`, '_blank', 'noopener,noreferrer');
    });

  } catch {
    wrap.innerHTML = '<p style="color:var(--muted);padding:60px 0;text-align:center;">読み込みに失敗しました。</p>';
  }
}

loadEpisode();
