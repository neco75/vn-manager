# AGENTS.md

## Language

ユーザーとの会話、Issue、PR、資料は日本語。識別子とコードは既存の命名に従う。

## UI v2

UI v2の担当は最初にdocs/design-v2/README.md、SPEC.md、PLAN.md、HANDOFF.mdと担当Issueを読む。
現行コードの機能と保存形式を保つ。v2の見た目はSPEC.mdが旧design.mdに優先する。
採用画像の架空データを実データや新しい機能として実装しない。

- 最新origin/develop-v2からcodex/接頭辞のIssue専用ブランチを作成。
- 1 Issue / 1 PR。UI実装PRのbaseはdevelop-v2、mainではない。
- 依存PRのdevelop-v2への統合を確認。第1段階後はユーザーのPreview確認を待つ。
- 自分ではmerge、auto-merge、Production deploy、Production Branch変更、保護解除を行わない。
- IndexedDB、LibraryItem、全localStorageキー、下書き、競合検出、JSONバックアップを維持。
- 既存部品・fixture・隔離BrowserContextを使う。ユーザーの実データをテスト対象にしない。
- npm run check:reviewとPRのQuality checks、対象の操作とPC/スマホ画像を確認。
- 実装者とは別のレビューを受け、最新headで指摘対応済みのPRを指定の統合担当へ渡す。

資料・作業ルール・CIだけの準備PRはmain向け。アプリの新UIを混ぜない。
v2以外の既存不具合修正はCONTRIBUTING.mdのmain向け手順を維持。

