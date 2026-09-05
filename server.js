const express = require('express');
const multer = require('multer');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
app.set('trust proxy', 1); // Render等のリバースプロキシ経由でも正しくセッションを処理
const PORT = process.env.PORT || 3000;

// データ保存先：STORAGE_DIR 環境変数があればそちらを使う（Render Persistent Disk 用）
const STORAGE_DIR = process.env.STORAGE_DIR || __dirname;
if (process.env.STORAGE_DIR && !fs.existsSync(process.env.STORAGE_DIR)) {
  fs.mkdirSync(process.env.STORAGE_DIR, { recursive: true });
}

// 既存ファイルをストレージディレクトリへ初回コピー（データ移行用）
function migrateIfNeeded(filename) {
  const src = path.join(__dirname, filename);
  const dest = path.join(STORAGE_DIR, filename);
  if (STORAGE_DIR !== __dirname && !fs.existsSync(dest) && fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}
['episodes.json', 'profiles.json', 'settings.json', 'messages.json', 'schedules.json'].forEach(migrateIfNeeded);

const EPISODES_FILE = path.join(STORAGE_DIR, 'episodes.json');
const CONFIG_FILE   = path.join(__dirname, 'admin.config.json');
const PROFILES_FILE = path.join(STORAGE_DIR, 'profiles.json');
const SETTINGS_FILE = path.join(STORAGE_DIR, 'settings.json');
const MESSAGES_FILE  = path.join(STORAGE_DIR, 'messages.json');
const SCHEDULES_FILE = path.join(STORAGE_DIR, 'schedules.json');
const DATA_DIR      = process.env.STORAGE_DIR
  ? path.join(process.env.STORAGE_DIR, 'data')
  : path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ===== Load admin config =====
let adminConfig;
if (process.env.ADMIN_USERNAME) {
  // 環境変数から読み込む（Renderなどのクラウド環境）
  adminConfig = {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
    sessionSecret: process.env.SESSION_SECRET || 'change-this-secret'
  };
} else if (fs.existsSync(CONFIG_FILE)) {
  adminConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
} else {
  adminConfig = { username: 'admin', password: 'password', sessionSecret: 'change-this-secret' };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(adminConfig, null, 2));
  console.log('  ⚠  admin.config.json を作成しました。ユーザー名とパスワードを変更してください。');
}

// ===== Middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// セキュリティヘッダー
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'microphone=(), camera=()');
  next();
});

const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  secret: adminConfig.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,  // HTTPS環境（Render）では自動でsecureに
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  }
}));
// ===== Protected HTML pages (server-side auth guard) =====
// Must be before express.static so auth check runs before serving the file
const PROTECTED_PAGES = ['/admin.html', '/messages.html', '/settings.html', '/schedule.html'];
PROTECTED_PAGES.forEach(page => {
  app.get(page, (req, res, next) => {
    if (req.session && req.session.authenticated) {
      res.setHeader('Cache-Control', 'no-store');
      return next();
    }
    res.redirect('/login.html');
  });
});

// ===== Episode-specific OGP (for social crawlers) =====
app.get('/', (req, res, next) => {
  const epId = req.query.ep;
  if (!epId) return next();
  try {
    let episodes = [];
    try { episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8')); } catch {}
    const ep = episodes.find(e => e.id === epId);
    if (!ep) return next();
    const num = episodes.length - episodes.indexOf(ep);
    const title = `第${num}回「${ep.title}」— 新聞記者のもやもや話`;
    const desc = ep.description ? ep.description.slice(0, 200) : ep.title;
    const epUrl = `${SITE_URL}/?ep=${encodeURIComponent(epId)}`;
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
    html = html
      .replace(/(<title>).*?(<\/title>)/, `$1${escXml(title)}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/,   `$1${escXml(title)}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${escXml(desc)}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/,     `$1${escXml(epUrl)}$2`)
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/,  `$1${escXml(title)}$2`)
      .replace(/(<meta name="twitter:description" content=")[^"]*(")/,  `$1${escXml(desc)}$2`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/,          `$1${escXml(epUrl)}$2`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
  } catch { next(); }
});

// ===== Episode detail page (SEO-friendly URL with OGP injection) =====
app.get('/episode/:id', (req, res, next) => {
  try {
    let episodes = [];
    try { episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8')); } catch {}
    const ep = episodes.find(e => e.id === req.params.id);
    if (!ep) return res.status(404).sendFile('404.html', { root: path.join(__dirname, 'public') });
    const num = episodes.length - episodes.indexOf(ep);
    const title = `第${num}回「${ep.title}」— 新聞記者のもやもや話`;
    const desc = ep.description ? ep.description.slice(0, 200) : ep.title;
    const epUrl = `${SITE_URL}/episode/${encodeURIComponent(req.params.id)}`;
    let html = fs.readFileSync(path.join(__dirname, 'public', 'episode.html'), 'utf-8');
    html = html
      .replace(/(<title>).*?(<\/title>)/, `$1${escXml(title)}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/,   `$1${escXml(title)}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${escXml(desc)}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/,     `$1${escXml(epUrl)}$2`)
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/,  `$1${escXml(title)}$2`)
      .replace(/(<meta name="twitter:description" content=")[^"]*(")/,  `$1${escXml(desc)}$2`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/,          `$1${escXml(epUrl)}$2`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
  } catch { next(); }
});

app.use(express.static(path.join(__dirname, 'public')));

// ===== Auth middleware =====
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: 'ログインが必要です', redirect: '/login.html' });
}

// ===== ログイン試行回数制限 =====
const loginAttempts = new Map(); // ip -> { count, blockedUntil }
function checkLoginLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  if (entry.blockedUntil > now) return false; // ブロック中
  return true;
}
function recordFailedLogin(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= 10) {
    entry.blockedUntil = now + 15 * 60 * 1000; // 10回失敗で15分ブロック
    entry.count = 0;
  }
  loginAttempts.set(ip, entry);
}
function clearLoginLimit(ip) { loginAttempts.delete(ip); }

// ===== Auth API =====
app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkLoginLimit(ip)) {
    return res.status(429).json({ error: 'ログイン試行回数が多すぎます。しばらく待ってから再試行してください。' });
  }
  const { username, password } = req.body;
  if (username === adminConfig.username && password === adminConfig.password) {
    clearLoginLimit(ip);
    req.session.authenticated = true;
    res.json({ ok: true });
  } else {
    recordFailedLogin(ip);
    res.status(401).json({ error: 'ユーザー名またはパスワードが違います' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ===== URLバリデーション =====
function isSafeUrl(url) {
  if (!url) return true; // 空は許可（任意フィールド）
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

// ===== Image Upload API =====
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
app.post('/api/upload-image', requireAuth, imageUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルがありません' });
  // Base64に変換してprofiles.jsonに直接保存（ファイルシステム依存を排除）
  const mime = req.file.mimetype || 'image/jpeg';
  const dataUrl = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
  const profileId = req.body.profileId;
  if (profileId && fs.existsSync(PROFILES_FILE)) {
    try {
      const profiles = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'));
      const idx = profiles.findIndex(p => p.id === profileId);
      if (idx !== -1) {
        profiles[idx].photo = dataUrl;
        fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
      }
    } catch {}
  }
  res.json({ url: dataUrl });
});

// ===== Settings API =====
function initSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    const defaults = {
      heroDescription: '東京新聞デジタル編集部の記者とデスクが日々感じている「もやもや」を語り合っています。取材での悩みや葛藤、ジャーナリズムの課題、社会の問いかけ。過去の配信アーカイブをこちらでお聴きいただけます'
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaults, null, 2));
    console.log('  settings.json を作成しました');
  }
}

app.get('/api/settings', (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))); } catch { res.json({}); }
});

app.put('/api/settings', requireAuth, (req, res) => {
  try {
    const current = fs.existsSync(SETTINGS_FILE)
      ? JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) : {};
    const updated = { ...current, ...req.body };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Profiles API =====
function initProfiles() {
  if (!fs.existsSync(PROFILES_FILE)) {
    const defaults = [
      {
        id: 'reporter',
        role: '記者',
        name: '中村真暁',
        kana: 'なかむら・まあき',
        bio: '社会福祉士。1985年石川県津幡町生まれ。生活困窮者が多く暮らす東京・山谷地域での取材をきっかけに、貧困問題に関心を抱く。2020年と25年に貧困ジャーナリズム賞受賞。摂食症の当事者でもあります。社内の仲間とPodcast番組「新聞記者ラジオ」も配信中。好きなドラマは「オレンジ・イズ・ニュー・ブラック」。',
        photo: '/images/nakamura.jpg'
      },
      {
        id: 'desk',
        role: 'デスク',
        name: 'お名前',
        kana: '',
        bio: 'プロフィール文をここに入力してください。',
        photo: ''
      }
    ];
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(defaults, null, 2));
    console.log('  profiles.json を作成しました');
  }
}

app.get('/api/profiles', (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'))); } catch { res.json([]); }
});

app.put('/api/profiles/:id', requireAuth, (req, res) => {
  try {
    const { name, kana, role, bio, xAccount, website } = req.body;
    if (!name || !role) return res.status(400).json({ error: '名前と役割ラベルは必須です' });
    let profiles = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'));
    const idx = profiles.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'プロフィールが見つかりません' });
    profiles[idx] = {
      ...profiles[idx],
      name: name.trim(),
      kana: (kana || '').trim(),
      role: role.trim(),
      bio: (bio || '').trim(),
      xAccount: (xAccount || '').trim(),
      website: isSafeUrl(website) ? (website || '').trim() : ''
    };
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
    res.json(profiles[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Episodes API =====
function initEpisodes() {
  if (!fs.existsSync(EPISODES_FILE)) {
    fs.writeFileSync(EPISODES_FILE, '[]');
    console.log('  episodes.json を作成しました');
  }
}

app.get('/api/episodes', (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'))); } catch { res.json([]); }
});

app.post('/api/episodes/link', requireAuth, (req, res) => {
  try {
    const { title, date, description, spaceUrl, audioUrl, tags } = req.body;
    if (!title || !date || !spaceUrl) return res.status(400).json({ error: 'タイトル、日付、スペースURLは必須です' });
    if (!isSafeUrl(spaceUrl)) return res.status(400).json({ error: '無効なURLです' });
    if (audioUrl && !isSafeUrl(audioUrl)) return res.status(400).json({ error: '無効な音声URLです' });
    let episodes = [];
    try { episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8')); } catch (e) {}
    const episode = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(), date,
      spaceUrl: spaceUrl.trim(),
      description: (description || '').trim(),
      audioUrl: (audioUrl || '').trim(),
      tags: Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : [],
      createdAt: new Date().toISOString()
    };
    episodes.push(episode);
    episodes.sort((a, b) => b.date.localeCompare(a.date));
    fs.writeFileSync(EPISODES_FILE, JSON.stringify(episodes, null, 2));
    console.log(`  新規登録（リンク）: ${episode.date} "${episode.title}"`);
    res.json(episode);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/episodes/:id', requireAuth, (req, res) => {
  try {
    let episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
    const idx = episodes.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'エピソードが見つかりません' });
    const deleted = episodes.splice(idx, 1)[0];
    fs.writeFileSync(EPISODES_FILE, JSON.stringify(episodes, null, 2));
    console.log(`  削除: "${deleted.title}"`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/episodes/spotify', requireAuth, (req, res) => {
  try {
    const { title, date, description, spotifyUrl, audioUrl, tags } = req.body;
    if (!title || !date || !spotifyUrl) return res.status(400).json({ error: 'タイトル、日付、SpotifyURLは必須です' });
    if (!isSafeUrl(spotifyUrl)) return res.status(400).json({ error: '無効なURLです' });
    if (audioUrl && !isSafeUrl(audioUrl)) return res.status(400).json({ error: '無効な音声URLです' });
    let episodes = [];
    try { episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8')); } catch (e) {}
    const episode = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(), date, spotifyUrl: spotifyUrl.trim(),
      description: (description || '').trim(),
      audioUrl: (audioUrl || '').trim(),
      tags: Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : [],
      createdAt: new Date().toISOString()
    };
    episodes.push(episode);
    episodes.sort((a, b) => b.date.localeCompare(a.date));
    fs.writeFileSync(EPISODES_FILE, JSON.stringify(episodes, null, 2));
    console.log(`  新規登録（Spotify）: ${episode.date} "${episode.title}"`);
    res.json(episode);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/episodes/:id', requireAuth, (req, res) => {
  try {
    const { title, date, description, spaceUrl, spotifyUrl, audioUrl, tags } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'タイトルと日付は必須です' });
    if (audioUrl && !isSafeUrl(audioUrl)) return res.status(400).json({ error: '無効な音声URLです' });
    let episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
    const idx = episodes.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'エピソードが見つかりません' });
    episodes[idx] = {
      ...episodes[idx],
      title: title.trim(), date, description: (description || '').trim(),
      ...(spaceUrl !== undefined ? { spaceUrl: spaceUrl.trim() } : {}),
      ...(spotifyUrl !== undefined ? { spotifyUrl: spotifyUrl.trim() } : {}),
      audioUrl: (audioUrl || '').trim(),
      tags: Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : (episodes[idx].tags || [])
    };
    episodes.sort((a, b) => b.date.localeCompare(a.date));
    fs.writeFileSync(EPISODES_FILE, JSON.stringify(episodes, null, 2));
    res.json(episodes[episodes.findIndex(e => e.id === req.params.id)]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Messages API =====
function initMessages() {
  if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2));
  }
}

app.post('/api/messages', (req, res) => {
  try {
    const { name, contact, message, allowPublish } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'メッセージを入力してください' });
    if (message.trim().length > 1000) return res.status(400).json({ error: 'メッセージは1000文字以内で入力してください' });
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: (name || '').trim().slice(0, 50) || '匿名',
      contact: (contact || '').trim().slice(0, 100),
      message: message.trim(),
      createdAt: new Date().toISOString(),
      read: false,
      allowPublish: allowPublish === true,
      published: false
    };
    messages.unshift(entry);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    sendNewMessageNotification(entry);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages', requireAuth, (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'))); } catch { res.json([]); }
});

app.patch('/api/messages/:id/read', requireAuth, (req, res) => {
  try {
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
    const idx = messages.findIndex(m => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'メッセージが見つかりません' });
    messages[idx].read = true;
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/messages/:id', requireAuth, (req, res) => {
  try {
    let messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
    messages = messages.filter(m => m.id !== req.params.id);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/messages/:id/memo', requireAuth, (req, res) => {
  try {
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
    const idx = messages.findIndex(m => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'メッセージが見つかりません' });
    messages[idx].memo = (req.body.memo || '').trim().slice(0, 500);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/messages/:id/publish', requireAuth, (req, res) => {
  try {
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
    const idx = messages.findIndex(m => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'メッセージが見つかりません' });
    messages[idx].published = !messages[idx].published;
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    res.json({ ok: true, published: messages[idx].published });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Email Notification =====
async function sendNewMessageNotification(msg) {
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    const notifyEmail = settings.notifyEmail || process.env.NOTIFY_EMAIL;
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (!notifyEmail || !smtpHost || !smtpUser || !smtpPass) return;
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: smtpUser, pass: smtpPass }
    });
    await transporter.sendMail({
      from: smtpUser,
      to: notifyEmail,
      subject: `【もやもや話】${msg.name}さんからメッセージが届きました`,
      text: `${msg.name} さんからメッセージが届きました。\n\n${msg.message}\n\n管理画面: https://moyamoya-pefh.onrender.com/messages.html`
    });
  } catch (err) {
    console.warn('メール通知の送信に失敗:', err.message);
  }
}

// 公開掲示板 — 認証不要、contact フィールド除外
app.get('/api/board', (req, res) => {
  try {
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
    const board = messages
      .filter(m => m.published)
      .map(({ id, name, message, createdAt }) => ({ id, name, message, createdAt }));
    res.json(board);
  } catch { res.json([]); }
});

// ===== Schedules API =====
function initSchedules() {
  if (!fs.existsSync(SCHEDULES_FILE)) fs.writeFileSync(SCHEDULES_FILE, '[]');
}

app.get('/api/schedules', (req, res) => {
  try {
    const all = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8'));
    res.json(all.filter(s => s.published).sort((a, b) => a.date.localeCompare(b.date)));
  } catch { res.json([]); }
});

app.get('/api/schedules/all', requireAuth, (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8'))); } catch { res.json([]); }
});

app.post('/api/schedules', requireAuth, (req, res) => {
  try {
    const { title, date, time, description, url } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'タイトルと日付は必須です' });
    if (url && !isSafeUrl(url)) return res.status(400).json({ error: '無効なURLです' });
    const schedules = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8'));
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(), date,
      time: (time || '').trim(),
      description: (description || '').trim(),
      url: (url || '').trim(),
      published: false,
      createdAt: new Date().toISOString()
    };
    schedules.push(entry);
    schedules.sort((a, b) => a.date.localeCompare(b.date));
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
    res.json(entry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/schedules/:id', requireAuth, (req, res) => {
  try {
    const { title, date, time, description, url, published } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'タイトルと日付は必須です' });
    const schedules = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8'));
    const idx = schedules.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'スケジュールが見つかりません' });
    schedules[idx] = { ...schedules[idx], title: title.trim(), date, time: (time || '').trim(), description: (description || '').trim(), url: isSafeUrl(url) ? (url || '').trim() : schedules[idx].url, published: published !== undefined ? !!published : schedules[idx].published };
    schedules.sort((a, b) => a.date.localeCompare(b.date));
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
    res.json(schedules.find(s => s.id === req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/schedules/:id/publish', requireAuth, (req, res) => {
  try {
    const schedules = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8'));
    const idx = schedules.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'スケジュールが見つかりません' });
    schedules[idx].published = !schedules[idx].published;
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
    res.json({ ok: true, published: schedules[idx].published });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/schedules/:id', requireAuth, (req, res) => {
  try {
    let schedules = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8'));
    schedules = schedules.filter(s => s.id !== req.params.id);
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== CSV Export =====
function toCsvRow(row) { return row.map(v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(','); }

app.get('/api/export/episodes', requireAuth, (req, res) => {
  try {
    const episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
    const header = ['ID', 'タイトル', '配信日', '概要', 'XスペースURL', 'SpotifyURL', '音声URL', 'タグ', '登録日時'];
    const rows = episodes.map(ep => [ep.id, ep.title, ep.date, ep.description || '', ep.spaceUrl || '', ep.spotifyUrl || '', ep.audioUrl || '', (ep.tags || []).join(','), ep.createdAt]);
    const csv = '﻿' + [header, ...rows].map(toCsvRow).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="episodes.csv"');
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/export/messages', requireAuth, (req, res) => {
  try {
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
    const header = ['ID', '名前', '連絡先', 'メッセージ', '既読', '掲載同意', '掲載済み', '受信日時'];
    const rows = messages.map(m => [m.id, m.name, m.contact || '', m.message, m.read ? '既読' : '未読', m.allowPublish ? '希望' : '非希望', m.published ? '掲載中' : '非掲載', m.createdAt]);
    const csv = '﻿' + [header, ...rows].map(toCsvRow).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="messages.csv"');
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

initSettings();
initProfiles();
initMessages();
initEpisodes();
initSchedules();

// ===== PNG Thumbnail Generation =====
(async () => {
  const THUMBNAIL_SVG = path.join(__dirname, 'public', 'thumbnail.svg');
  const THUMBNAIL_PNG = path.join(__dirname, 'public', 'thumbnail.png');
  try {
    const sharp = require('sharp');
    await sharp(THUMBNAIL_SVG).resize(1200, 630).png().toFile(THUMBNAIL_PNG);
    console.log('  thumbnail.png を生成しました');
  } catch (err) {
    console.warn('  thumbnail.png の生成をスキップ:', err.message);
  }
})();

// ===== RSS Feed =====
const SITE_URL = 'https://moyamoya-pefh.onrender.com';
app.get('/feed.xml', (req, res) => {
  let episodes = [];
  try { episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8')); } catch {}
  const items = episodes.map((ep, i) => {
    const num = episodes.length - i;
    const link = ep.spotifyUrl || ep.spaceUrl || SITE_URL;
    const enclosure = ep.audioUrl
      ? `<enclosure url="${escXml(ep.audioUrl)}" length="0" type="audio/mpeg"/>`
      : ep.filename
        ? `<enclosure url="${SITE_URL}/data/${encodeURIComponent(ep.filename)}" length="0" type="audio/mpeg"/>`
        : '';
    const pubDate = (() => { try { return new Date(ep.date).toUTCString(); } catch { return ''; } })();
    return `<item>
      <title><![CDATA[第${num}回 ${ep.title}]]></title>
      <link>${escXml(link)}</link>
      <guid isPermaLink="false">${SITE_URL}/?ep=${escXml(ep.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${ep.description || ep.title}]]></description>
      ${enclosure}
    </item>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>新聞記者のもやもや話</title>
    <link>${SITE_URL}</link>
    <description>東京新聞デジタル編集部の記者とデスクが日々感じている「もやもや」を語り合っています。</description>
    <language>ja</language>
    <itunes:image href="${SITE_URL}/thumbnail.png"/>
    <image>
      <url>${SITE_URL}/thumbnail.png</url>
      <title>新聞記者のもやもや話</title>
      <link>${SITE_URL}</link>
    </image>
    ${items}
  </channel>
</rss>`;
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(xml);
});
function escXml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ===== Sitemap =====
app.get('/sitemap.xml', (req, res) => {
  let episodes = [];
  try { episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8')); } catch {}
  const today = new Date().toISOString().slice(0, 10);
  const latestDate = episodes.length ? episodes[0].date : today;
  const urls = [
    `<url><loc>${SITE_URL}/</loc><lastmod>${latestDate}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${SITE_URL}/board.html</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.6</priority></url>`,
    ...episodes.map(ep =>
      `<url><loc>${SITE_URL}/episode/${ep.id}</loc><lastmod>${ep.date}</lastmod><changefreq>never</changefreq><priority>0.7</priority></url>`
    )
  ].join('\n  ');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls}\n</urlset>`);
});

// ===== 404 Handler =====
app.use((req, res) => {
  res.status(404).sendFile('404.html', { root: path.join(__dirname, 'public') });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  新聞記者のもやもや話 アーカイブ');
  console.log(`  http://localhost:${PORT}`);
  console.log('');
  console.log('  管理画面: http://localhost:' + PORT + '/admin.html');
  console.log('  ログイン情報は admin.config.json で変更できます');
  console.log('');
});
