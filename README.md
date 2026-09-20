# VN Manager

> [!NOTE]
> This application's code was primarily generated and implemented by Google DeepMind's AI.

美少女ゲーム・ノベルゲーム専用の管理ツールです。
VNDB（Visual Novel Database）と連携し、プレイしたゲームや積んでいるゲームを美しく管理できます。

## ✨ 主な機能

- **ライブラリ管理**: プレイ状況（プレイ中、クリア済み、積みゲーなど）やスコアを記録。
- **VNDB連携**: タイトル検索で画像やメタデータを自動取得。
- **詳細データ**: プレイ時間、開発元、タグ、あらすじなどを保存。
- **統計・分析**: プレイ傾向のチャート表示、月別履歴。
- **統計画像シェア**: 統計データを画像として保存し、X（Twitter）などでシェア。
- **設定とバックアップ**: 設定ページで言語、画像ぼかし、背景、購入先、JSONバックアップを管理。
- **ローカル保存**: ライブラリ、スコア、メモ、設定はブラウザ内（IndexedDB / localStorage）に保存。
- **その他**: 次やるゲームルーレット、本棚モード、ダークモード対応。

## 🚀 使い方

### Web版（推奨）

以下のURLにアクセスするだけで、すぐに使い始めることができます。
https://vn-manager.vercel.app

**注意点:**
- データはこのブラウザのIndexedDB / localStorageに保存されます。サイトデータやブラウザストレージを削除すると記録も削除されるため注意してください。
- 異なるデバイス間での同期機能はありません。
- 「設定」ページから定期的にバックアップ（JSONエクスポート）を取ることを推奨します。

### 保存と外部通信

- アカウント、クラウド同期、サーバーへのライブラリ保存はありません。ブラウザのデータを消去すると記録も消えるため、設定ページからバックアップしてください。
- タイトル検索では検索語が、作品詳細の表示や情報更新ではVNDBの作品IDがVNDB APIへ送信されます。
- 作品画像はVNDBが提供する画像URLからブラウザが取得します。
- 公開環境でVercel Speed Insightsが有効な場合、ライブラリ・スコア・メモ本文は送信されません。一方、匿名のdata pointとして閲覧route/URL（例: `/vn/v123`）、network speed、browser、device type/OS、country、Web Vital/attribution、SDK情報、サーバー受信時刻などがVercelへ送信されます。個人visitorやIPに紐付けたり、ページ横断のsessionを再構成できる情報は保存されません。詳しくは[Vercelの公式説明](https://vercel.com/docs/speed-insights/privacy-policy)を参照してください。

### 制限事項

- データは端末・ブラウザごとに保存され、端末間同期はありません。
- VNDB APIやVNDBの画像URLが利用できない場合、検索・最新情報の取得・画像表示に影響します。
- 統計の共有画像は実装済みですが、ランキングの共有画像はありません。
- テーマはダーク表示のみです。

### ローカル環境で動かす

開発者向けの手順です。自分のPC上で動作させることができます。

#### 必要要件
- Node.js 24（バージョンの基準は `.nvmrc`）
- 開発・検証・PRの手順は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

#### インストール手順

1. リポジトリをクローン
```bash
git clone https://github.com/neco75/vn-manager.git
cd vn-manager
```

2. 依存関係をインストール
```bash
npm ci
```

3. 開発サーバーを起動
```bash
npm run dev
```

4. ブラウザでアクセス
[http://localhost:3000](http://localhost:3000) を開いてください。

## 🛠️ 技術スタック

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui, Lucide React
- **Animation**: Framer Motion
- **Database**: IndexedDB (idb)
- **API**: VNDB API
- **計測**: Vercel Speed Insights（公開環境で有効な場合）
