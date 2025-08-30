# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

NOT A HOTELの「THE KEY」NFTのOpenSeaリスティング情報を収集・分析し、割安な物件を発見するためのNext.jsアプリケーション。

## 技術スタック

- **フレームワーク**: Next.js 15.5.2 (App Router)
- **言語**: TypeScript 5
- **スタイリング**: Tailwind CSS v4
- **リンター/フォーマッター**: Biome
- **パッケージマネージャー**: npm

## プロジェクト構造

```
src/
├── app/                 # Next.js App Router
│   ├── page.tsx        # ホームページ（リスティング一覧）
│   ├── about/          # Aboutページ
│   └── item/[tokenId]/ # NFT詳細ページ
├── components/         # UIコンポーネント
│   └── ListingCard.tsx # リスティングカード
├── lib/                # ビジネスロジック
│   ├── nah-the-key.ts  # THE KEY価格計算ロジック
│   ├── nah-the-key.seed.ts # 宿泊施設マスターデータ
│   └── opensea-listings.ts # OpenSea API連携
└── scripts/            # ユーティリティスクリプト
    ├── cache-images.ts # 画像キャッシュ
    ├── revalidate-pages.ts # ISR更新
    └── build-seed-from-shop.ts # マスターデータ生成
```

## 主要コマンド

```bash
# 開発サーバー起動（Turbopack使用）
npm run dev

# ビルド（画像キャッシュ含む）
npm run build

# リンター実行
npm run lint

# フォーマット
npm run format

# ISR手動更新（要.env.local）
npm run revalidate

# OpenSeaリスティング取得（要.env.local）
npm run opensea-listings

# 施設データ更新
npm run build-seed
```

## 環境変数

`.env.local`に以下を設定：

```
OPENSEA_API_KEY=your_opensea_api_key
```

## 主要機能

1. **リスティング分析**: OpenSea APIから「THE KEY」NFTのリスティングを取得し、公正価格と比較して割引率を計算
2. **価格計算ロジック**: 施設、日付、曜日、長期滞在、リードタイムなどの要因を考慮した動的価格計算
3. **ISR（Incremental Static Regeneration）**: 30分ごとに自動更新
4. **GitHub Actions**: 1時間ごとに自動でISR更新を実行

## 開発時の注意事項

1. **Biome使用**: ESLint/Prettierの代わりにBiomeを使用。設定は`biome.json`参照
2. **画像キャッシュ**: ビルド前に`prebuild`スクリプトで画像をローカルにキャッシュ
3. **TypeScript厳格モード**: `strict: true`が有効なため、型安全性に注意
4. **パスエイリアス**: `@/`は`src/`にマッピング済み

## デプロイ

- Vercel上でホスティング（https://nah-key-scout.vercel.app）
- GitHub Actionsで1時間ごとにISR更新を実行