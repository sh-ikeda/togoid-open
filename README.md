# TogoID Open — Chrome Extension

生命科学データベースの ID を選択して、対応するレコードページを直接開くための Chrome 拡張機能です。

## インストール方法

1. Chrome で `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. このフォルダ (`togoid-open/`) を選択する

## 使い方

### 右クリックメニュー
1. ページ上で ID テキストを選択する（例: `CHEMBL121649`）
2. 右クリック → **TogoID Open** サブメニューから開きたいデータベースを選ぶ
3. 新しいタブでレコードページが開く

### ホットキー（Alt+Shift+O）
1. ID テキストを選択する
2. `Alt+Shift+O` を押す
3. ページ中央にポップアップが表示されるので、候補をクリックする
4. `Esc` またはポップアップ外をクリックで閉じる

## 対応データベース（現在）

| データベース | ID パターン例 | URL |
|---|---|---|
| ChEMBL compound | `CHEMBL121649` | http://identifiers.org/chembl.compound/ |
| ChEMBL target | `CHEMBL121649` | http://identifiers.org/chembl.target/ |
| PDB (PDBj) | `3PFQ` | https://pdbj.org/mine/summary/ |
| PDB (RCSB PDB) | `3PFQ` | https://www.rcsb.org/structure/ |
| PDB (PDBe) | `3PFQ` | https://www.ebi.ac.uk/pdbe/entry/pdb/ |

## データベースの追加・変更

`databases.js` の `DATABASES` 配列に以下の形式でエントリを追加するだけです：

```js
{
  key: "chebi",
  label: "ChEBI",
  regex: /^(CHEBI:\d+)$/,
  prefix: [
    { label: "EBI", uri: "https://www.ebi.ac.uk/chebi/searchId.do?chebiId=" }
  ]
}
```

YAML ファイルと同期する場合は、YAML → JS の変換スクリプトを別途用意することを推奨します。

## ホットキーの変更

Chrome の `chrome://extensions/shortcuts` でいつでも変更できます。
