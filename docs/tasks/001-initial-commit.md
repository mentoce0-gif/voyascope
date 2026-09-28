# タスク001：最初のコミットとpush

## 目的

下書き一式を GitHub の private リポジトリに載せ、CI が動くことを確認する。

## 前提

- リポジトリはオーナーが作成済み：`https://github.com/mentoce0-gif/voyascope`（private）
  - 名前を大文字の `VOYASCOPE` で作っている可能性がある。GitHub の URL は大文字小文字を区別しないので、どちらでも push できる
- リポジトリは空（README・.gitignore・license なし）

## 手順

1. `npm install` を実行し、`npm run validate` が「問題なし」で通ることを確認する
2. `npm run validate:examples` がエラーで落ちることを確認する（見本の出典が TODO のため。これが正常）
3. `node_modules/` がコミット対象に入っていないことを確認する（.gitignore 済み）
4. 次を実行する
   ```
   git init
   git add .
   git commit -m "初回コミット：ルール・スキーマ・検証スクリプト・AI依頼テンプレート"
   git branch -M main
   git remote add origin https://github.com/mentoce0-gif/voyascope.git
   git push -u origin main
   ```
5. GitHub の Actions で `validate-cards` が成功することを確認する

## やらないこと

- LICENSE ファイルの作成
- リポジトリの公開設定の変更
- ファイルの中身の変更（問題を見つけたら、直さずにオーナーへ報告する）

## 完了条件

- main ブランチに全ファイルが載っている
- `.github/workflows/validate.yml` と `.gitignore` が含まれている
- Actions の `validate-cards` が緑
