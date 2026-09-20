# 開発とレビュー

Node.js 24を使用します（バージョンの基準は `.nvmrc`）。
`nvm`を利用する環境では `nvm install && nvm use`、それ以外はNode.js 24をインストールしてください。

Lefthookを使用して、push前に回帰チェック・Lint・Type checkを自動実行します。`package.json` で `lefthook@2.1.14` のinstall scriptを明示承認しているため、通常の `npm ci` / `npm install` でLefthookのpostinstallがGit hookを設定します。`ignore-scripts=true` の環境では自動設定されないため、依存インストール後に `npx lefthook install` を実行してください。

```sh
npm ci
npm run check:regression
npm run lint
npm run typecheck
npm run build
npm audit --audit-level=high
```

CIはPR作成・更新時とmainへのpush時に上記を実行します。
監査は開発依存も対象とし、high / criticalで失敗します。低・中レベルも出力を確認してください。
Lintの既存警告を理由なく増やさないでください。

## pre-pushチェック

通常の `git push` では `lefthook.yml` のpre-push hookから次を順番に実行します。

1. `npm run check:regression`
2. `npm run lint`
3. `npm run typecheck`

いずれかが失敗するとpushを中断します。BuildとDependency auditはpre-pushには含めず、最終ゲートとしてCIで実行します。
手動で同じチェックを実行する場合は次を使用します。

```sh
npm run check:push
```

## 作業手順

1. Issue本文・依存Issue・最新コード・AGENTS.md（存在する場合）・design.mdを読みます。
2. 依存Issueのマージを確認し、最新mainからIssue専用ブランチを作成します。原則1 Issue / 1 PR、直列で進めます。
3. 変更する関数の呼び出し元と保存済みデータへの影響を確認し、Issueの範囲内で実装します。
4. PRに検証結果と未確認事項を記載し、別エージェントのレビューを受けます。実装担当はマージ・自動マージ設定を行いません。
5. 指摘対応後、指定のマージ担当が最新コミットのCI・レビュー・mainとの整合を確認し、マージとIssueクローズ、親Issueの進捗更新を行います。

## GitHub側の初期設定（管理者）

このファイルをマージしても以下の設定は自動適用されません。既存ルールを確認して設定してください。

- Settings → Rules → Rulesets（またはBranches）でmainへのPRを必須にし、force push・削除を禁止します。
- このPRのCIが一度成功した後、必須ステータスチェックに `Quality checks` を追加し、マージ前に最新mainへの追従を要求します。
- 未解決のレビュー会話がある場合のマージを禁止します。
- エージェントが同じGitHubアカウントを使う場合、PR作成者は自分のPRを承認できません。別エージェントのレビュー結果はコメントで残し、指定の担当が確認します。別アカウントのレビュアーを確保できる場合は承認1件以上も必須にします。
- Dependabot alertsとsecurity updatesを有効にします。通常の依存更新は `.github/dependabot.yml` により週次でPRになります。自動マージは設定しません。
- VercelのNode.js設定も24に揃え、Preview成功を確認します。
