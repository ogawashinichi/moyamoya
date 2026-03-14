# 新聞記者のもやもや話 — X Spaces アーカイブ

東京新聞デジタル編集部の記者・デスクによる X スペースの配信アーカイブサイトです。
音声ファイルのアップロード、または X スペースのリンクを登録して公開できます。

## スクリーンショット

| 公開ページ | 管理画面 |
|---|---|
| エピソード一覧（音声プレーヤー or Xリンク） | 新規登録・プロフィール編集 |

---

## 必要環境

- Node.js 18 以上
- npm

---

## セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

### 2. 依存パッケージをインストール

```bash
npm install
```

### 3. 管理者設定ファイルを作成

`admin.config.example.json` をコピーして `admin.config.json` を作成し、ユーザー名・パスワードを設定します。

```bash
cp admin.config.example.json admin.config.json
```

`admin.config.json` を編集：

```json
{
  "username": "任意のユーザー名",
  "password": "任意のパスワード",
  "sessionSecret": "ランダムな長い文字列"
}
```

> ⚠️ `admin.config.json` は `.gitignore` で除外されています。絶対に Git にコミットしないでください。

### 4. フォルダを作成

```bash
mkdir -p data public/images
```

### 5. サーバーを起動

```bash
node server.js
```

ブラウザで http://localhost:3000 を開きます。

---

## 使い方

### 公開ページ
- `http://localhost:3000` — 配信アーカイブ一覧

### 管理画面
- `http://localhost:3000/admin.html` — ログイン後に使用可能

#### エピソードの登録方法

**音声ファイルをアップロードする場合**
「音声ファイル」タブを選択 → M4A / MP3 / MP4 / WAV / AAC（最大500MB）をドロップ

**X スペースのリンクを登録する場合**
「Xスペースリンク」タブを選択 → `https://x.com/i/spaces/…` の形式で URL を入力

#### エピソードの編集
- 公開ページまたは管理画面の ✏️ ボタン → タイトル・日付・概要・XスペースURLを編集可能

---

## ファイル構成

```
.
├── server.js              # Express サーバー
├── episodes.json          # エピソードデータ（自動生成）
├── profiles.json          # 話者プロフィール（自動生成）
├── settings.json          # サイト設定（自動生成）
├── admin.config.json      # 管理者認証情報（.gitignore 除外）
├── admin.config.example.json  # 設定ファイルのテンプレート
├── data/                  # 音声ファイル置き場（.gitignore 除外）
├── public/
│   ├── index.html         # 公開ページ
│   ├── admin.html         # 管理画面
│   ├── login.html         # ログインページ
│   ├── app.js             # 公開ページのスクリプト
│   ├── admin.js           # 管理画面のスクリプト
│   ├── style.css          # スタイルシート
│   └── images/            # アップロード画像（.gitignore 除外）
└── package.json
```

---

## ライセンス

MIT
