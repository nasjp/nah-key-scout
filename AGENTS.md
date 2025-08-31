# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

NOT A HOTELの「THE KEY」NFTのOpenSeaリスティング情報を収集・分析し、割安な物件を発見するためのNext.jsアプリケーション。

## 技術スタック

- **フレームワーク**: Next.js 15.5.2 (App Router)
- **言語**: TypeScript 5
- **スタイリング**: Tailwind CSS v4
- **モノレポ**: Turborepo
- **リンター/フォーマッター**: Biome
- **パッケージマネージャー**: pnpm（ワークスペース）

## プロジェクト構造（Turborepo）

```
apps/
  web/                  # Next.jsアプリ
    src/app/            # App Router
    src/components/     # UIコンポーネント
    public/             # 静的アセット（画像キャッシュ出力先）
    scripts/cache-images.ts  # ビルド前に公式サムネイルをキャッシュ
  cli/                  # CLI群
    src/opensea-listings.ts  # リスティング取得（NDJSON）
    src/revalidate-pages.ts  # ISRウォームアップ
packages/
  core/                 # 共有ドメインロジック
    src/nah-the-key.ts        # 価格計算
    src/nah-the-key.seed.ts   # 宿泊施設マスタ
    src/opensea-listings.ts   # OpenSea API
    src/view-models.ts        # 画面用VM生成
    src/...                   # 各種ユーティリティ
```

## 主要コマンド（ルートで実行）

```bash
# インストール
pnpm install

# 開発（webのみ）
pnpm dev

# ビルド（webのprebuildで画像キャッシュ実行）
pnpm build

# Lint / Format / TypeCheck
pnpm lint
pnpm format
pnpm typecheck

# CLI（要 .env.local）
pnpm revalidate            # apps/cli の revalidate
pnpm opensea-listings      # apps/cli の listings 取得
```

## 環境変数

- Web(Next.js): `apps/web/.env.local`
- CLI: ルート `.env.local`

内容は同一でOKです。

```
OPENSEA_API_KEY=your_opensea_api_key
```

## 主要機能

1. **リスティング分析**: OpenSea APIから「THE KEY」NFTのリスティングを取得し、公正価格と比較して割引率を計算
2. **価格計算ロジック**: 施設、日付、曜日、長期滞在、リードタイムなどの要因を考慮した動的価格計算
3. **ISR（Incremental Static Regeneration）**: 30分ごとに自動更新
4. **GitHub Actions**: 1時間ごとに自動でISR更新を実行

## 開発時の注意事項

1. **Biome使用**: ルートの`biome.json`を使用（各パッケージから呼び出し可能）
2. **画像キャッシュ**: `apps/web` の `prebuild` で `scripts/cache-images.ts` を実行し、`apps/web/public/house-images` に出力
3. **TypeScript**: ルート `tsconfig.base.json` を継承。`apps/web` は `@/*` を `apps/web/src/*` にマップ
4. **共有モジュール**: アプリからは `@nah/core/*` をインポート

## デプロイ

- Vercel（apps/web を対象）
- GitHub Actions: `revalidate.yml` は pnpm + Turborepo に対応済み
