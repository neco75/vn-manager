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

## Review Ready

レビュー依頼前は、CI相当の主要チェックをまとめた次のコマンドを実行します。

```sh
npm run check:review
```

`check:review` は regression → lint → typecheck → build → dependency audit の順に実行します。レビュー依頼前の標準手順は次のとおりです。

1. Issueの受け入れ条件を自己確認します。
2. 最新mainを取り込み、競合を解消します。
3. `npm run check:review` を実行し、失敗があれば修正して再実行します。
4. PRのReview Ready checklistを埋めます。
5. 保存済みデータ・既存挙動への互換性影響を確認し、PR本文に記載します。
6. 未確認事項を具体的に書きます。未確認がない場合も「未確認なし」と明記します。
7. 再レビューの場合は、前回指摘のR番号ごとに状態と変更箇所または理由を記載します。
8. 上記を満たしてからレビュー依頼します。

### 再レビュー

実装担当は、前回レビューで付いたR番号を省略せず、各項目を `解消` / `対応しない` などの状態と変更箇所または最小限の説明付きで整理します。前回reviewed headが分かる場合は、最新headも明記します。

レビュアーは、可能な限り前回reviewed headから最新headまでのdeltaを優先して確認し、前回指摘が意図どおり解消されているかを先に再確認します。delta外でも、修正による新しい回帰や最新mainとの競合解消で影響が出る箇所は必要に応じて確認します。

## 作業手順

1. Issue本文・依存Issue・最新コード・AGENTS.md（存在する場合）・design.mdを読みます。
2. 依存Issueのマージを確認し、最新mainからIssue専用ブランチを作成します。原則1 Issue / 1 PR、直列で進めます。
3. 変更する関数の呼び出し元と保存済みデータへの影響を確認し、Issueの範囲内で実装します。
4. 上記のReview Ready手順を満たし、PRに検証結果・互換性影響・未確認事項・必要なら前回レビュー対応表を記載して、別エージェントのレビューを受けます。実装担当はマージ・自動マージ設定を行いません。
5. 指摘対応後、指定のマージ担当が最新コミットのCI・レビュー・mainとの整合を確認し、マージとIssueクローズ、親Issueの進捗更新を行います。

## GitHub側の初期設定（管理者）

このファイルをマージしても以下の設定は自動適用されません。既存ルールを確認して設定してください。

- Settings → Rules → Rulesets（またはBranches）でmainへのPRを必須にし、force push・削除を禁止します。
- このPRのCIが一度成功した後、必須ステータスチェックに `Quality checks` を追加し、マージ前に最新mainへの追従を要求します。
- 未解決のレビュー会話がある場合のマージを禁止します。
- エージェントが同じGitHubアカウントを使う場合、PR作成者は自分のPRを承認できません。別エージェントのレビュー結果はコメントで残し、指定の担当が確認します。別アカウントのレビュアーを確保できる場合は承認1件以上も必須にします。
- Dependabot alertsとsecurity updatesを有効にします。通常の依存更新は `.github/dependabot.yml` により週次でPRになります。自動マージは設定しません。
- VercelのNode.js設定も24に揃え、Preview成功を確認します。
