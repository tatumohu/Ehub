# E-Hub

Google AI Studioから引き継いだReact / Express / SQLiteアプリです。
今後の作業フォルダは `/Users/yamatotatsunori/Documents/ChatGPT/E-hub` です。
元のDesktop/untitledは変更していません。

## 起動

Node.js 22以降を使用します。

```sh
cd /Users/yamatotatsunori/Documents/ChatGPT/E-hub
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

## 設定

サーバーはこのフォルダの `.env.local`、`.env` の順に読み込みます。
`OPENAI_API_KEY` は設定済みで、ブラウザへの配布対象外です。
テキストモデルは `OPENAI_MODEL`、画像モデルは `OPENAI_IMAGE_MODEL` で変更できます。
初期値はそれぞれ `gpt-6-astra`、`gpt-image-1` です。
契約文生成、スカウト、アイデアの整理・相談、翻訳、画像生成はOpenAIを使います。
Google OAuth・Firebase・StripeはAI以外の既存機能として残しています。利用には別途各サービスの設定が必要です。

## 確認と本番実行

```sh
npm run lint
npm run build
NODE_ENV=production npm start
```

データはこのフォルダの `ehub.db` に保存します。引き継ぎ元DBは破損していたため、`ehub.imported-corrupt.db` に保管し、起動用DBを新規作成しています。旧データの復旧は未実施です。
元コードに含まれる修復・検証スクリプトは通常の起動には不要です。
`openai_repair.ts` と `py_repair.py` はソースを書き換えるため、通常運用では実行しないでください。
Python版の利用には別途 `openai` パッケージと環境変数が必要です。

APIの実装資料: https://developers.openai.com/api/docs/quickstart
