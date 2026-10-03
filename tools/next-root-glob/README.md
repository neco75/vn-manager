# Next.js LintのrootDir検索

開発用の `@next/eslint-plugin-next@16.3.6` が使う `fast-glob` を、この小さなローカルパッケージへ限定して置き換える。Node.js 24の `fs.globSync` と `statSync` を使い、脆弱な `braces` / `micromatch` を依存ツリーから取り除く。アプリ、本番のルーティング、保存データには使用しない。

## 対応する契約

[Next.js 16.3.6 get-root-dirs.ts](https://github.com/vercel/next.js/blob/v16.3.6/packages/eslint-plugin-next/src/utils/get-root-dirs.ts) の唯一の利用箇所は `globSync(rootDir, { onlyDirectories: true })`。文字列の相対/絶対パス、`*`、`**`、通常のbraceパターンをNode標準のglobへ渡し、実ディレクトリだけ返す。Next側がrootDir配列の要素ごとに呼び出す。

fast-glob全体の代替ではない。非文字列、他のオプション、否定パターンは明示的にエラーにする。Nextの依存やAPIが変わったときに無言で不完全な検査を続けないよう、ESLintの実際の `no-html-link-for-pages` 規則をfixtureのrootDir検索で確認するチェックを `check:regression` に含める。

overrideのfileパスは依存元 `node_modules/@next/eslint-plugin-next` からプロジェクトの `tools/next-root-glob` への相対指定。`.npmrc` の `install-links=true` はこのfile依存をコピーとしてインストールし、`npm ci` を再現可能にするための指定。Node.jsの基準は既存の `.nvmrc` の24を維持する。

## 理由と撤去条件

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) に対するbracesの正式修正版は2026-10-03時点でない。`npm audit --audit-level=high` は変更・除外しない。監査結果を隠すためのバージョン偽装や、破壊的なeslint-config-nextのダウングレードも行わない。

Next.js側がこの依存を除くか、正式なbraces修正版を含む依存ツリーが利用できるようになったら、overrideとこのパッケージを削除し、lockfileを更新する。そのときrootDir規則の回帰チェックと `npm run check:review` を通す。
