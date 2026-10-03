# develop-v2の開始記録

2026-10-03。mainの資料準備PR [#74](https://github.com/neco75/vn-manager/pull/74)を統合したコミット `c9f96457c630c1940305f919bb292e2dfc377a74` からdevelop-v2を作成した。
このファイルは開発ブランチの運用記録。採用仕様は [SPEC.md](SPEC.md)、着手条件と最新の検証証拠は [親Issue #76](https://github.com/neco75/vn-manager/issues/76) を正本とする。

## 担当者の開始位置

- リポジトリ: https://github.com/neco75/vn-manager
- 最新origin/develop-v2からIssue専用のcodex/ブランチを作る。
- 最初の担当は [V2-01 / #77](https://github.com/neco75/vn-manager/issues/77)。後続は#78〜#90の依存順に進める。
- [README.md](README.md)、[HANDOFF.md](HANDOFF.md)、[PLAN.md](PLAN.md)、担当Issue、AGENTS.mdを先に読む。
- PRのbaseはdevelop-v2。実装担当はmainへのマージやProduction deployを行わない。
- V2-08 / #84後はユーザーのPreview確認が着手条件。公開前には既知のDB不具合#55も解消を確認する。

## 準備で確認する環境

mainの本番UIと保存形式は維持する。develop-v2とそのIssue別PRはPreviewで検証する。
GitHubの [保護ルール](https://github.com/neco75/vn-manager/rules/24407651) はPR、Quality checks、未解決会話の解消を必須とし、force pushと削除を禁止する。
Vercelの設定画面にログインできたという意味ではなく、実際のデプロイの環境・コミット・成功ステータスで境界を確認し、結果を親Issueへ残す。

この資料だけのPRは、develop-v2を統合先とするCIと、統合後のPreview経路を新UIの実装前に確認するためのもの。
UI・DB・保存データ・本番設定は変更しない。既存開発依存のaudit失敗は別PR [#91](https://github.com/neco75/vn-manager/pull/91) で対処済み。
