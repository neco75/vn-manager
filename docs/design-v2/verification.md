# V2-14 回帰・公開前確認

## 判定

- 検証対象base: `origin/develop-v2` / `7f0e5a4c31d39a90a53f21aabc05c358e3dd45b7`（PR #121 merge後。PR #117の#55修正、PR #123のNext.js監査修正、V2-13を含む）。
- このPRはQA資料と画面証跡のみを更新する。アプリ本体、DB、依存パッケージ、保存形式の変更はない。
- base `7f0e5a4` のGitHub Quality checks run [37763749288](https://github.com/neco75/vn-manager/actions/runs/37763749288) はsuccess。baseのPreview deployment [6933141656](https://github.com/neco75/vn-manager/deployments/6933141656) はenvironment `Preview` / status `success`。
- ローカル検証は `CI=true npm run check:review`。PlaywrightはVNDB fixtureと隔離BrowserContextを使い、実データ・実VNDBへ接続しない。

## 採用画面と実画面

親Issue #76 の[2026-10-07確認コメント](https://github.com/neco75/vn-manager/issues/76#issuecomment-6036035422)には、PR #108統合後のPreview画面とPC/スマホ画像をユーザーへ提示し、「ok」の返答を受けたとある。これは第1段階の一覧→詳細→保存→戻るを次へ進める確認。Previewの手動操作はVercel認証が `account_not_found` となり未確認だった。今回もユーザーの実ブラウザや実データを使った操作はしていない。

採用したコンセプトは画面の方向を示す架空の6作品モック。実UIは保存済みレコードと既存機能を表示するため内容と補助操作が異なる。既存の状態・所有フィルター、12種の並べ替え、grid/list/shelf、件数、ルーレットは仕様に沿って維持している。E2E画像は架空fixtureを使うため、VNDB実作品の表紙画像とは異なる。

| 採用画像 | 実UIとの差 | 理由 |
| --- | --- | --- |
| [一覧案](references/library.png) | コンセプトは6作品のイラストと単一の状態列。実画面はfixtureの3作品、状態と所有の選択、並べ替え、3つの表示形式、検索一致件数を表示する。 | 実保存データとSPECの既存操作を維持するため。表紙なしの長い日本語タイトル、画像ぼかし、0点、未評価のfixtureを含む。 |
| [詳細案](references/detail.png) | コンセプトは大きな架空表紙、状態/評価/時間、再開メモと感想。実画面は保存済み作品の2列記録配置で、所有・日付・購入先・非公開メモ・削除確認も維持し、編集中のみ保存バーを出す。 | 既存LibraryItemの全項目と操作を保持し、追加機能や情報を画像から新設しないため。 |

### 実画面

このbase上でPlaywrightが取得したPC 1440×1000の一覧と記録フォーム、詳細390×667、スマホ390×844で下部を編集した状態の実画像。390×844ではページ下部へ移動しても保存バーが画面下に残り、保存操作へ届く。

![PC 1440×1000 一覧](../../e2e/screenshots/v2-04-library-1440x1000.png)

![PC 1440×1000 記録](../../e2e/screenshots/v2-07-record-1440x1000.png)

![詳細 390×667 記録フォーム](../../e2e/screenshots/v2-07-record-390x667.png)

![スマホ 390×844 保存バー](../../e2e/screenshots/v2-08-save-bar-390x844.png)

## 仕様マトリクスと操作

| 項目 | 確認根拠 |
| --- | --- |
| 幅320/390/768/1024/1440px | `e2e/final-qa.spec.ts` の主要導線と横overflow、`e2e/v2-09-search-add.spec.ts` のカード列数、`e2e/issue-54-record-ux.spec.ts` の詳細、`e2e/shell-navigation.spec.ts` とranking/shelfのresponsive E2E。5幅すべてを複数画面で実行。 |
| JA/EN | `e2e/issue-53-accessibility.spec.ts`、`e2e/v2-09-search-add.spec.ts`、`e2e/ranking-and-shelf-responsive.spec.ts`。背景画像あり/なしと白/黒背景も含む。 |
| 長いタイトル・表紙なし・ぼかし | `e2e/search-and-library.spec.ts`、`e2e/ranking-and-shelf-responsive.spec.ts`、`e2e/issue-53-accessibility.spec.ts`。fixtureの長いJA/ENタイトル、画像なし、性的内容値が未知の画像も対象。 |
| 正常・空・失敗 | `e2e/search-and-library.spec.ts`、`e2e/v2-09-search-add.spec.ts`、`e2e/v2-10-ranking.spec.ts`、`e2e/v2-11-stats.spec.ts`、`e2e/v2-13-backup.spec.ts`、`e2e/issue-55-idb-retry.spec.ts`。空、絞り込み0件、通信失敗、DB失敗、再試行後を区別。 |
| 背景 on/off | `e2e/final-qa.spec.ts` と `e2e/issue-53-accessibility.spec.ts`。白/黒/背景なし、画像ぼかしの切替を確認。 |
| 操作・focus・44px | `e2e/issue-53-accessibility.spec.ts`、`e2e/shell-navigation.spec.ts`、`e2e/final-qa.spec.ts`。キーボード導線、Dialog focus trap/復帰、スコアと未評価、保存、追加/削除を確認。 |
| 文字・境界・focusのcontrast | `e2e/issue-53-accessibility.spec.ts` が実computed colorで通常文字/placeholder 4.5:1以上、入力境界と操作表面3:1以上を確認。disabled操作は対象外。 |
| 横overflow・保存バー | `e2e/final-qa.spec.ts` と `e2e/detail-save-bar.spec.ts`。編集長文、画面端/固定位置、入力とheader/保存バーの重なり、ポインターとキーボード保存を確認。390×667/844の画像も収録。 |

## 保存互換性と障害復旧

- `e2e/v2-13-backup.spec.ts` はフォーム保存→再読込→JSON export→別BrowserContextへrestoreを同一テストで実行。exportと復元後を元LibraryItemと完全一致比較する。
- 2件のfixtureでscore `0`、`null`/未評価、750分、各日付、status/ownership、メモ/感想/再開メモ、購入先、addedAt/updatedAt、VN metadataを含む。設定3キーも復元後のlocalStorageと再読込後で確認。
- 保存形式は現行のまま: IndexedDB `vn-manager-db` / DB version `3`、LibraryItem `recordVersion: 2`、backup schema `2`、draft localStorage key `vn-manager-detail-draft-v1:<vnId>` / draft version `1`。下書きの復元/破棄・別作品分離・別tab競合は `e2e/search-and-library.spec.ts`、`e2e/save-conflicts.spec.ts`、`test/unit/detail-draft.test.ts` が確認。
- `e2e/issue-55-idb-retry.spec.ts` はopen初回失敗、再試行の連続失敗、次の再試行で復旧し、保存fieldsと750分を含む詳細値が戻ることを確認。未処理Promise rejectionが0であることも確認。修正はPR #117でbaseへ統合済み。

### 実行結果

- 最新base上で `CI=true npm run check:review` がexit 0。regression checks、unit 98/98、lint（error 0。既存の`<img>`警告3件）、typecheck、build、E2E 112/112、`npm audit --audit-level=high` を完走した。auditはModerate 2件のみでHighは0件。
- PlaywrightはCI設定の1 workerで112件を実行。Issue #55の3ケース、backupの別BrowserContext往復、下書き/別tab競合、Settingsのbackup fingerprint成功・失敗・変更検知、responsive/JA/EN/a11yケースを含む。
- GitHub上のbase Quality checksもsuccess（run [37763749288](https://github.com/neco75/vn-manager/actions/runs/37763749288)）。今回のPRでアプリ実装やテスト期待値は変更しない。

## Preview、本番境界、rollback

- base SHA `7f0e5a4` のVercel deployment [6933141656](https://github.com/neco75/vn-manager/deployments/6933141656) はenvironment `Preview` / status `success`。Preview URLは[こちら](https://vn-manager-q0op4k0je-neco75s-projects.vercel.app)。
- 最新の成功したVercel Production deployment [6913928333](https://github.com/neco75/vn-manager/deployments/6913928333) はSHA `5ae97970b2386b740a168b7e137df246f1fc542f`、URLは[こちら](https://vn-manager-2dd18v0wd-neco75s-projects.vercel.app)。GitHub `main`の先端も同SHA。今回のPRからProduction deployment/promote/mainへのUI公開は行わない。
- Vercel dashboardのProduction Branch設定画面は直接確認できていないため、その設定自体は未確認。

## ローカル検証結果

| Check | 結果 |
| --- | --- |
| `npm ci` | exit 0。依存lockfileの変更なし。Moderate 2件あり。 |
| `CI=true npm run check:review` | exit 0。Regression / unit 98/98 / lint / typecheck / build / E2E 112/112 pass。`npm audit --audit-level=high` はHigh 0、Moderate 2。 |
| Base Quality checks | success、run `37763749288`、head `7f0e5a4c31d39a90a53f21aabc05c358e3dd45b7`。 |
| Base Preview deployment | success、deployment `6933141656`、environment `Preview`、head `7f0e5a4c31d39a90a53f21aabc05c358e3dd45b7`。 |

## 未確認

- 認証されたVercel Previewでのライブ手動操作とVercel dashboardのProduction Branch設定。親Issue #76の記録ではPreviewの認証が `account_not_found`。ローカルE2EとGitHub deployment statusは確認済みだが、これをlive手動操作の代替とは扱わない。
- VNDB実データ/実表紙の描画。すべてのE2Eはfixtureとネットワーク遮断を使った。
