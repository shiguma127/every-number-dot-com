# Every Number Dot Com

[Every UUID](https://everyuuid.com/) の数字版。0 以上の整数を仮想スクロールで探索できます。各行からコピーやお気に入りへの追加ができ、お気に入りはブラウザーに保存されます。

## ローカル実行

```sh
mise trust
mise install
mise run setup
mise run dev
```

http://127.0.0.1:8787/ を開きます。

## ビルドとテスト

```sh
mise run build
mise exec -- pnpm exec playwright install chromium
mise run test
```

[GitHub Pages](https://shiguma127.github.io/every-number-dot-com/) は `main` の `docs/` を配信します。TypeScript を編集したら `mise run build` で `docs/` 内の JS を更新し、ソースと一緒にコミットします。
