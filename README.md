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
- **SNSシェア**: 統計データやランキングを画像として生成し、X（Twitter）などでシェア。
- **プライバシー重視**: データはすべてブラウザ内（IndexedDB）に保存。外部送信なし。
- **その他**: 次やるゲームルーレット、本棚モード、ダークモード対応。

## 🚀 使い方

### Web版（推奨）

以下のURLにアクセスするだけで、すぐに使い始めることができます。
（ここにデプロイ先のURLを記載してください）

**注意点:**
- データはブラウザに保存されます。キャッシュクリアに注意してください。
- 異なるデバイス間での同期機能はありません。
- 「統計・設定」ページから定期的にバックアップ（JSONエクスポート）を取ることを推奨します。

### ローカル環境で動かす

開発者向けの手順です。自分のPC上で動作させることができます。

#### 必要要件
- Node.js 18.17.0 以上

#### インストール手順

1. リポジトリをクローン
```bash
git clone https://github.com/your-username/vn-manager.git
cd vn-manager
```

2. 依存関係をインストール
```bash
npm install
```

3. 開発サーバーを起動
```bash
npm run dev
```

4. ブラウザでアクセス
[http://localhost:3000](http://localhost:3000) を開いてください。

## 🛠️ 技術スタック

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui, Lucide React
- **Animation**: Framer Motion
- **Database**: IndexedDB (idb)
- **API**: VNDB API
