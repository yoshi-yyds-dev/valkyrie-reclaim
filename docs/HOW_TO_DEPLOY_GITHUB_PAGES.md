# GitHub Pages への公開手順ガイド

`games/00001_shooting-game/app/` のビルド成果物を GitHub Pages で公開し、世界中にURLを配るための手順書です。

---

## 方式の選択（どちらか1つを選択）

### 【おすすめ】方式A：ビルド済みフォルダ（dist）だけを別リポジトリで即座に公開する（最も簡単・1分で完了）
開発環境（ソースコード）とは切り離し、完成した公開用データ（`app/dist/`）だけを GitHub にアップして公開するシンプルな方法です。

1. **GitHub 上で新しいリポジトリを作成**:
   * リポジトリ名: 例 `void-vanguard`
   * 公開設定: **Public**（無料の GitHub Pages は Public リポジトリである必要があります）
   * README や .gitignore の追加チェックは **すべて外して空のリポジトリ** を作成する。
2. **`app/dist` フォルダ内で Git 初期化してプッシュ**:
   ```bash
   cd games/00001_shooting-game/app/dist
   git init -b main
   git add .
   git commit -m "feat: release VOID VANGUARD PWA v1.0.0"
   git remote add origin https://github.com/<あなたのユーザー名>/void-vanguard.git
   git push -u origin main
   ```
3. **GitHub リポジトリの設定で GitHub Pages を有効化**:
   * リポジトリの **Settings** ➔ **Pages** を開く。
   * **Build and deployment** の Source で **Deploy from a branch** を選択。
   * Branch: `main` / `/(root)` を選んで **Save**。
4. **1〜2分待つと公開URLが完成**:
   * `https://<あなたのユーザー名>.github.io/void-vanguard/`

---

### 方式B：プロジェクト全体を GitHub に上げ、GitHub Actions で自動ビルド・公開する（本格派）
ソースコード全体を管理し、`git push` するたびに GitHub が自動でビルド＆公開を更新してくれる方法です。

1. **リポジトリ直下に `.github/workflows/deploy.yml` を配置**（作成済み）。
2. リポジトリの **Settings ➔ Pages ➔ Source** で **GitHub Actions** を選択。
3. リポジトリにプッシュすると、GitHub 側でビルドが走り自動公開されます。
