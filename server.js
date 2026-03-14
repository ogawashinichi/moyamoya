const express = require('express');
const multer = require('multer');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const EPISODES_FILE = path.join(__dirname, 'episodes.json');
const CONFIG_FILE = path.join(__dirname, 'admin.config.json');
const PROFILES_FILE = path.join(__dirname, 'profiles.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// ===== Load admin config =====
let adminConfig;
if (fs.existsSync(CONFIG_FILE)) {
  adminConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
} else {
  adminConfig = { username: 'admin', password: 'password', sessionSecret: 'change-this-secret' };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(adminConfig, null, 2));
  console.log('  ⚠  admin.config.json を作成しました。ユーザー名とパスワードを変更してください。');
}

// ===== Middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: adminConfig.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 } // 8 hours
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(DATA_DIR));

// ===== Auth middleware =====
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: 'ログインが必要です', redirect: '/login.html' });
}

// ===== Auth API =====
app.get('/api/auth/check', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === adminConfig.username && password === adminConfig.password) {
    req.session.authenticated = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'ユーザー名またはパスワードが違います' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ===== Image Upload API =====
const imageStorage = multer.diskStorage({
  destination: path.join(__dirname, 'public', 'images'),
  filename: (req, file, cb) => {
    const name = (req.body.name || 'speaker').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${name}${ext}`);
  }
});
const imageUpload = multer({ storage: imageStorage, limits: { fileSize: 10 * 1024 * 1024 } });
app.post('/api/upload-image', requireAuth, imageUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルがありません' });
  const url = `/images/${req.file.filename}`;
  // Update profile photo field in profiles.json
  const profileId = req.body.profileId;
  if (profileId && fs.existsSync(PROFILES_FILE)) {
    try {
      const profiles = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'));
      const idx = profiles.findIndex(p => p.id === profileId);
      if (idx !== -1) {
        profiles[idx].photo = url;
        fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
      }
    } catch {}
  }
  res.json({ url });
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
    const { name, kana, role, bio } = req.body;
    if (!name || !role) return res.status(400).json({ error: '名前と役割ラベルは必須です' });
    let profiles = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'));
    const idx = profiles.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'プロフィールが見つかりません' });
    profiles[idx] = {
      ...profiles[idx],
      name: name.trim(),
      kana: (kana || '').trim(),
      role: role.trim(),
      bio: (bio || '').trim()
    };
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
    res.json(profiles[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Episodes API =====
function parseFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  const match = base.match(/^(\d{8})_(.+)$/);
  if (!match) return null;
  const dateStr = match[1];
  const title = match[2];
  const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  return { date, title };
}

function initEpisodes() {
  let episodes = [];
  if (fs.existsSync(EPISODES_FILE)) {
    try { episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8')); } catch (e) {}
  }
  const files = fs.readdirSync(DATA_DIR).filter(f => /\.(m4a|mp3|mp4|wav|ogg|aac)$/i.test(f));
  const existingFilenames = new Set(episodes.map(e => e.filename));
  for (const file of files) {
    if (!existingFilenames.has(file)) {
      const parsed = parseFilename(file);
      if (parsed) {
        episodes.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          filename: file, title: parsed.title, date: parsed.date,
          description: '', createdAt: new Date().toISOString()
        });
      }
    }
  }
  episodes.sort((a, b) => b.date.localeCompare(a.date));
  fs.writeFileSync(EPISODES_FILE, JSON.stringify(episodes, null, 2));
  console.log(`  ${episodes.length} エピソードを読み込みました`);
}

const storage = multer.diskStorage({
  destination: DATA_DIR,
  filename: (req, file, cb) => {
    const { title, date } = req.body;
    const dateStr = date.replace(/-/g, '');
    const ext = path.extname(file.originalname) || '.m4a';
    const safeTitle = title.trim().replace(/[/\\:*?"<>|]/g, '_');
    cb(null, `${dateStr}_${safeTitle}${ext}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    /\.(m4a|mp3|mp4|wav|ogg|aac)$/i.test(file.originalname) ? cb(null, true) : cb(new Error('対応していないファイル形式です'));
  },
  limits: { fileSize: 500 * 1024 * 1024 }
});

app.get('/api/episodes', (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'))); } catch { res.json([]); }
});

app.post('/api/episodes', requireAuth, upload.single('audio'), (req, res) => {
  try {
    const { title, date, description } = req.body;
    if (!title || !date || !req.file) return res.status(400).json({ error: 'タイトル、日付、ファイルは必須です' });
    let episodes = [];
    try { episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8')); } catch (e) {}
    const episode = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      filename: req.file.filename, title: title.trim(), date,
      description: (description || '').trim(), createdAt: new Date().toISOString()
    };
    episodes.push(episode);
    episodes.sort((a, b) => b.date.localeCompare(a.date));
    fs.writeFileSync(EPISODES_FILE, JSON.stringify(episodes, null, 2));
    console.log(`  新規登録: ${episode.date} "${episode.title}"`);
    res.json(episode);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/episodes/link', requireAuth, (req, res) => {
  try {
    const { title, date, description, spaceUrl } = req.body;
    if (!title || !date || !spaceUrl) return res.status(400).json({ error: 'タイトル、日付、スペースURLは必須です' });
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

app.put('/api/episodes/:id', requireAuth, (req, res) => {
  try {
    const { title, date, description, spaceUrl } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'タイトルと日付は必須です' });
    let episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
    const idx = episodes.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'エピソードが見つかりません' });
    episodes[idx] = {
      ...episodes[idx],
      title: title.trim(), date, description: (description || '').trim(),
      ...(spaceUrl !== undefined ? { spaceUrl: spaceUrl.trim() } : {})
    };
    episodes.sort((a, b) => b.date.localeCompare(a.date));
    fs.writeFileSync(EPISODES_FILE, JSON.stringify(episodes, null, 2));
    res.json(episodes[episodes.findIndex(e => e.id === req.params.id)]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

initSettings();
initProfiles();
initEpisodes();
app.listen(PORT, () => {
  console.log('');
  console.log('  新聞記者のもやもや話 アーカイブ');
  console.log(`  http://localhost:${PORT}`);
  console.log('');
  console.log('  管理画面: http://localhost:' + PORT + '/admin.html');
  console.log('  ログイン情報は admin.config.json で変更できます');
  console.log('');
});
