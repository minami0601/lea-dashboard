# LEA Dashboard

このプロジェクトは[Next.js](https://nextjs.org)を使用しており、[`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app)でブートストラップされています。

## 始め方

まず、開発サーバーを起動します：

```bash
npm run dev
# または
yarn dev
# または
pnpm dev
# または
bun dev
```

ブラウザで[http://localhost:3000](http://localhost:3000)を開くと結果が表示されます。

`app/page.tsx`を編集することでページの編集を始めることができます。ファイルを編集すると、ページは自動的に更新されます。

このプロジェクトでは[`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts)を使用して、Vercelの新しいフォントファミリーである[Geist](https://vercel.com/font)を自動的に最適化して読み込んでいます。

## Biomeの設定

このプロジェクトではコードのフォーマットとリンティングに[Biome](https://biomejs.dev/)を使用しています。設定は`biome.json`ファイルで管理されています。

以下のコマンドが利用可能です：

```bash
# コードのフォーマット
pnpm format

# コードのチェック
pnpm check
```

## BigQueryの設定

このプロジェクトではデータ分析にGoogle BigQueryを使用しています。接続を設定するには：

1. 開発環境と本番環境の両方のサービスアカウントキーファイルを取得します。
2. キーファイルを以下の名前で`/key`フォルダに配置します：
   - 開発環境用：`lea-for-marketplace-dev-key.json`
   - 本番環境用：`lea-for-marketplace-prod-key.json`
3. `.env.local`と`.env.production`ファイルはすでにこれらのキーファイルを使用するように設定されています。

開発環境と本番環境を切り替えるには：

- 開発環境：`pnpm dev`（lea-for-marketplace-devに接続）
- 本番環境：`pnpm dev:prod`（lea-for-marketplace-prodに接続）

注意：セキュリティ上の理由から、`/key`フォルダはGitで無視されます。サービスアカウントキーを安全に保管し、リポジトリにコミットしないようにしてください。

## もっと詳しく

Next.jsについてもっと詳しく知るには、以下のリソースをご覧ください：

- [Next.jsドキュメント](https://nextjs.org/docs) - Next.jsの機能とAPIについて学びます。
- [Learn Next.js](https://nextjs.org/learn) - インタラクティブなNext.jsチュートリアルです。

[Next.jsのGitHubリポジトリ](https://github.com/vercel/next.js)もチェックできます - フィードバックや貢献を歓迎します！

## Vercelへのデプロイ

Next.jsアプリをデプロイする最も簡単な方法は、Next.jsの作成者によるVercelプラットフォームを使用することです。

詳細については、[Next.jsのデプロイドキュメント](https://nextjs.org/docs/app/building-your-application/deploying)をご覧ください。
