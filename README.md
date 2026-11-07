# スピード暗記帳

期末テストの計画を自動で組み、暗記カードも1つにまとめた勉強アプリです。ホーム画面に追加して使います。

https://ae345.github.io/speed-anki/

## しくみ

- **自動の計画:** 「計画の設定」でテストの日、科目ごとの範囲、使える時間を入れます。アプリが1周目、2周目（×の問題だけ）、3周目、テスト前の総見直しを、毎日に自動で配ります。やり残しが出ても、開くたびに組み直します。
- **暗記:** 忘れかけたころにカードを出す間隔反復（Anki式）と、デッキを最後まで一気に回すモードがあります。
- **使う人の切り替え:** 1つの端末で、自分と弟など複数の人のデータを別々に持てます。
- **データ:** 各端末の中に保存されます。同期を有効にすると、Firestore の `sync/{同期コード}` にも保存されます。

## 同期（Firebase）の準備

1. https://console.firebase.google.com/ で、新しいプロジェクトを作る（Googleアナリティクスはオフでよい）
2. 「構築」→「Authentication」→「始める」→「ログイン方法」で「匿名」を有効にする
3. 「構築」→「Firestore Database」→「データベースを作成」
   - ロケーション：`asia-northeast1`（東京）
   - モード：「本番環境モード」
4. Firestore の「ルール」タブに、次のルールを貼って「公開」する

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sync/{code} {
      allow get, create, update: if request.auth != null && code.size() == 16;
      allow list, delete: if false;
    }
  }
}
```

5. 「プロジェクトの設定」（歯車）→「マイアプリ」→ ウェブ（`</>`）でアプリを追加し、表示された `firebaseConfig` の中身を `firebase-config.js` に書く

```js
window.FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", storageBucket: "...", messagingSenderId: "...", appId: "..." };
```

6. 「Authentication」→「設定」→「承認済みドメイン」に `ae345.github.io` を追加する

`firebaseConfig` の値は公開されても問題ありません（アクセスはルールで制御します）。同期コードは鍵の代わりなので、家族以外には教えないでください。
