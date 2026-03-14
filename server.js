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
['episodes.json', 'profiles.json', 'settings.json'].forEach(migrateIfNeeded);

const EPISODES_FILE = path.join(STORAGE_DIR, 'episodes.json');
const CONFIG_FILE   = path.join(__dirname, 'admin.config.json'); // 認証情報はenvで管理
const PROFILES_FILE = path.join(STORAGE_DIR, 'profiles.json');
const SETTINGS_FILE = path.join(STORAGE_DIR, 'settings.json');
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
    const { title, date, description, spaceUrl } = req.body;
    if (!title || !date || !spaceUrl) return res.status(400).json({ error: 'タイトル、日付、スペースURLは必須です' });
    if (!isSafeUrl(spaceUrl)) return res.status(400).json({ error: '無効なURLです' });
    let episodes = [];
    try { episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8')); } catch (e) {}
    const episode = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(), date,
      spaceUrl: spaceUrl.trim(),
      description: (description || '').trim(), createdAt: new Date().toISOString()
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
    const { title, date, description, spotifyUrl } = req.body;
    if (!title || !date || !spotifyUrl) return res.status(400).json({ error: 'タイトル、日付、SpotifyURLは必須です' });
    if (!isSafeUrl(spotifyUrl)) return res.status(400).json({ error: '無効なURLです' });
    let episodes = [];
    try { episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8')); } catch (e) {}
    const episode = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(), date, spotifyUrl: spotifyUrl.trim(),
      description: (description || '').trim(), createdAt: new Date().toISOString()
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
    const { title, date, description, spaceUrl, spotifyUrl } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'タイトルと日付は必須です' });
    let episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
    const idx = episodes.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'エピソードが見つかりません' });
    episodes[idx] = {
      ...episodes[idx],
      title: title.trim(), date, description: (description || '').trim(),
      ...(spaceUrl !== undefined ? { spaceUrl: spaceUrl.trim() } : {}),
      ...(spotifyUrl !== undefined ? { spotifyUrl: spotifyUrl.trim() } : {})
    };
    episodes.sort((a, b) => b.date.localeCompare(a.date));
    fs.writeFileSync(EPISODES_FILE, JSON.stringify(episodes, null, 2));
    res.json(episodes[episodes.findIndex(e => e.id === req.params.id)]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ===== Messages API =====
const MESSAGES_FILE = path.join(STORAGE_DIR, 'messages.json');

function initMessages() {
  if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2));
    console.log('  messages.json \u3092\u4f5c\u6210\u3057\u307e\u3057\u305f');
  }
}

app.post('/api/messages', (req, res) => {
  try {
    const { name, message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: '\u30e1\u30c3\u30bb\u30fc\u30b8\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044' });
    if (message.trim().length > 1000) return res.status(400).json({ error: '\u30e1\u30c3\u30bb\u30fc\u30b8\u306f1000\u6587\u5b57\u4ee5\u5185\u3067\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044' });
    const messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: (name || '').trim().slice(0, 50) || '\u533f\u540d',
      message: message.trim(),
      createdAt: new Date().toISOString(),
      read: false
    };
    messages.unshift(entry);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
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
    if (idx === -1) return res.status(404).json({ error: '\u30e1\u30c3\u30bb\u30fc\u30b8\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093' });
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



initSettings();
initProfiles();
initEpisodes();
initMessages();
app.listen(PORT, () => {
  console.log('');
  console.log('  新聞記者のもやもや話 アーカイブ');
  console.log(`  http://localhost:${PORT}`);
  console.log('');
  console.log('  管理画面: http://localhost:' + PORT + '/admin.html');
  console.log('  ログイン情報は admin.config.json で変更できます');
  console.log('');
});
