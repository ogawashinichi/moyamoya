# 新聞記者のもやもや話

東京新聞デジタル編集部の記者・デスクによる音声アーカイブサイトです。
X スペースまたは Spotify のリンクを登録して公開できます。

🌐 **公開サイト：** https://moyamoya.onrender.com
*(Renderにデプロイ後、URLを更新してください)*

---

## 機能

- 🎙️ **X スペースリンク登録** — X スペースの録音URLを登録してリンクボタンを表示
- 🎵 **Spotify 埋め込み** — Spotify エピソードのURLを登録してプレーヤーを表示
- 👤 **話者プロフィール** — 写真・プロフィール文・X アカウント・ウェブサイトを管理
- ✏️ **エピソード編集・削除** — 登録済みエピソードをいつでも修正可能
- 🔒 **管理画面認証** — ログイン保護・ブルートフォース対策済み

---

## 必要環境

- Node.js 18 以上
- npm

---

## ローカルでのセットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/ogawashinichi/moyamoya.git
cd moyamoya
```

### 2. 依存パッケージをインストール

```bash
npm install
```

### 3. 管理者設定ファイルを作成

```bash
cp admin.config.example.json admin.config.json
```

`admin.config.json` を編集してユーザー名・パスワードを設定：

```json
{
  "username": "任意のユーザー名",
  "password": "任意のパスワード",
  "sessionSecret": "ランダムな長い文字列"
}
```

> ⚠️ `admin.config.json` は `.gitignore` で除外されています。Git にコミットしないでください。

### 4. サーバーを起動

```bash
node server.js
```

ブラウザで http://localhost:3000 を開きます。

---

## Render へのデプロイ

1. [Render](https://render.com) で新しい **Web Service** を作成
2. GitHub リポジトリ（`ogawashinichi/moyamoya`）を連携
3. 以下の設定を入力：

| 項目 | 値 |
|------|-----|
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Environment | `Node` |

4. **Environment Variables** に以下を追加：

| 変数名 | 値 |
|--------|-----|
| `ADMIN_USERNAME` | 管理者ユーザー名 |
| `ADMIN_PASSWORD` | 管理者パスワード |
| `SESSION_SECRET` | ランダムな長い文字列 |
| `NODE_ENV` | `production` |

---

## 使い方

### エピソードを登録する

管理画面（`/admin.html`）にログイン後：

- **Xスペースリンク** タブ → `https://x.com/i/spaces/…` のURLを入力
- **Spotify** タブ → `https://open.spotify.com/episode/…` のURLを入力

### プロフィールを編集する

管理画面の「話している人」セクションで：
- 名前・プロフィール文・写真を設定
- X アカウント（`@username`）やウェブサイトURLを追加すると公開ページにリンクボタンが表示されます

---

## ファイル構成

```
.
├── server.js                  # Express サーバー
├── episodes.json              # エピソードデータ
├── profiles.json              # 話者プロフィール
├── settings.json              # サイト設定
├── admin.config.json          # 管理者認証情報（.gitignore 除外）
├── admin.config.example.json  # 設定ファイルのテンプレート
└── public/
    ├── index.html             # 公開ページ
    ├── admin.html             # 管理画面
    ├── login.html             # ログインページ
    ├── favicon.svg            # ファビコン（マイクアイコン）
    ├── app.js                 # 公開ページのスクリプト
    ├── admin.js               # 管理画面のスクリプト
    └── style.css              # スタイルシート
```

---

## ライセンス

MIT
