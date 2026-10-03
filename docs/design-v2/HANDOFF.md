# 実装・レビュー・公開の手順

## 作業先

- main: 既存の安定版とv2の承認済み資料。
- develop-v2: v2の統合とPreview確認。ここへ直接pushせず、Issue別ブランチからPR。
- codex/v2-XX-short-name: 最新origin/develop-v2から作る担当Issueの作業ブランチ。
- UI実装PRのbaseは必ずdevelop-v2。mainではない。実装者はmerge/auto-merge/本番deployをしない。

CONTRIBUTING.mdの「最新main」は、v2の作業では最新develop-v2に読み替える。
mainで別の修正が進んだら、統合担当がmain→develop-v2のPRで取り込み、Quality checksとPreviewを確認。
実装担当が勝手にmainへv2を戻したり、保護を解除したりしない。

## 一件の進め方

1. 親Issue、担当Issue、README.md、SPEC.md、PLAN.md、CONTRIBUTING.md、AGENTS.mdと対象コードを読む。
2. 先行Issueがdevelop-v2へマージ済みか確認。「PRあり」「Issue closed」だけを完了条件にしない。
3. 最新origin/develop-v2から専用ブランチを作る。同じ作業ディレクトリで別エージェントを並行実行しない。
4. 担当範囲だけを実装。既存部品と検証基盤を再利用する。依存追加、DB移行、仕様の再発明をしない。
5. 担当Issueの確認とnpm run check:reviewを実行。UIの実画像と操作証拠を用意。
6. develop-v2をbaseにPRを作成。IssueはRefs #番号とし、develop-v2へのマージ後に担当が手動で閉じる。
   GitHubのClosesは既定ブランチ以外へのマージでは自動closeしないため、それを前提に進捗を判断しない。
7. 実装者以外のレビューを受ける。最新headで指摘対応とCI成功が揃った後、指定の統合担当がdevelop-v2へマージ。
8. マージ後のPreviewと親Issueの進捗を更新。次のIssueへ進む。

同じアカウントの別エージェントはGitHubの承認者として扱えないことがある。
レビュー結果をPRコメントに残し、指定担当が確認する。実装者の自己承認を代替にしない。

## 委任文（番号とURLを差し替えて使う）

> neco75/vn-manager のUI v2子Issue #番号（URL）のみ実装してください。最新origin/develop-v2からcodex/接頭辞の専用ブランチを作り、PRのbaseをdevelop-v2にしてください。親Issue、担当Issue、AGENTS.md、CONTRIBUTING.md、docs/design-v2/README.md・SPEC.md・PLAN.md・HANDOFF.mdを読み、依存Issueがdevelop-v2へマージ済みか確認してください。採用画像は仕様の参照であり、画像を貼ってUIを再現しないでください。既存の機能・全保存フィールド・下書き・競合検出・バックアップを維持し、設計や新機能を独断で追加しないでください。担当の完了条件とnpm run check:review、PRのQuality checksを確認し、PC/スマホ画像、base/head SHA、検証、互換性、未確認事項をPRに記載してください。完了地点はレビュー可能なPRです。merge、auto-merge、本番deploy、保護解除は行わず、次のIssueを自動で始めないでください。

## レビュー依頼文

> UI v2子Issue #番号のPR URLを、最新headでレビューしてください。baseがdevelop-v2であること、先行Issueの統合、担当範囲、SPEC.mdの確定仕様、PC/スマホの実画像を照合してください。機能の削除・文字切れ・保存バーの重なり・データ初期化/0点/分単位・下書き/別タブ競合・画像/ネタバレ保護を確認してください。npm run check:reviewとQuality checksの実際の結果を確認し、実装者の成功報告だけで合格にしないでください。指摘に優先度・ファイルと行・再現・影響を付け、未確認を明記してください。再レビューでは前回headからの差分とR番号への対応を優先してください。

## 第1段階の確認

V2-01〜V2-08後、一覧→詳細→記録→戻るをユーザーがPreviewで確認。
この段階の確認前にV2-09以降の別画面へ拡大しない。
初期段階でも未着手のページを消さず、共通のライトトークンへの影響を必ず確認。
モデルに「自由に良くして」と渡さず、一件ずつ依頼する。

## 既存Issueとの関係

- #53と#54は今回の色・アクセシビリティ・記録配置に重なる。新Issueの検証から関連先として参照する。
  旧ダーク仕様で並行実装しない。本準備では解決済みとして閉じない。
- #55はDB接続失敗後の再試行に関する既存不具合。v2の見た目変更で修正済みとはしない。
  最新コードで再現を確認し、既存#55の修正を統合するまでv2の本番公開を止める。
  修正がmainに入る場合はmain→develop-v2のPRで取り込む。
- #45の残存不具合管理は継続。v2親Issueに新しいUI作業を集約し、旧Issueの自動closeや履歴改変はしない。
- 旧CONTRIBUTING.mdやIssue本文のmain向け手順は、このv2作業には本書のbaseルールを優先。

## デプロイ境界

VercelはProduction Branch=main、develop-v2とIssue別ブランチはPreviewを使う想定。
Gitのブランチ保護はVercelのデプロイ設定を変更しない。PreviewをProductionへ手動昇格させても境界を越える。
実装担当はvercel --prod、Productionへのpromote、Production Branch変更をしない。

準備時のGitHub履歴ではmain先頭89b2b32とProductionのSHAが一致し、過去PRはPreview環境へ出ていた。
VercelダッシュボードのProduction Branch設定そのものは、GitHub履歴だけでは断定しない。
実装着手前に、develop-v2を追跡するデプロイがPreviewであること、本番ドメインが引き続きmainの安定版を指すことを確認する。
この確認ができない場合もコードを実装して本番へ試しに出さない。

資料PRはdocs、作業ルール、CIの対象ブランチだけを変更し、アプリのソース/依存/保存形式を変更しない。
mainへ資料を入れることで本番の再buildが起きても、新UIを混ぜない。

## 公開前の条件

V2-14の回帰確認、#55対応、第1段階の見た目確認、develop-v2のQuality checksとPreview成功が必要。
既存ブラウザデータとJSONバックアップが読め、全保存項目を往復できる証拠を残す。
利用者のストレージを実データのテストに使わない。Previewは別originなので本番のライブラリが空に見えても消失と断定しない。
テスト用バックアップをPreviewへimportし、origin間の分離を維持して確認する。

最終公開はユーザー確認後、develop-v2→mainの別PRで行う。受け入れ前に自動mergeしない。
公開前のmain SHAを記録し、問題時のコードrollbackを用意。ストレージ互換性はコードrollbackだけでは直らないため移行しない設計を守る。
