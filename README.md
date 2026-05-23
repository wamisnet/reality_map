# Handoff: 旅ガチャ (旅行行き先抽選サイト)

旧称: Crosshair Scan

## Overview
ライブ配信などで使用する、日本全国の都市を抽選するための「ミッション・コントロール風」演出アプリです。衛星地図上で照準（クロスヘア）が候補地を走査し、ドラマチックに 1 つの都市をロックオン → 画像と説明文を表示する、という一連のアニメーションを行います。

主な用途:
- ライブ配信や社内イベントでの「抽選デモ」演出
- 旅行先のランダム決定
- プレゼンの "選定" 演出

## About the Design Files
このフォルダに含まれている HTML / JSX は **デザインリファレンス（プロトタイプ）** です。HTML+React (CDN 経由) で書かれた、見た目と挙動を確認するための試作品であり、そのままプロダクション環境にコピーするためのものではありません。

実装担当者のタスクは、**ターゲットコードベースの既存環境（React / Next.js / Vue / SwiftUI など）で、このプロトタイプを再現すること**です。既存のコンポーネントライブラリ・状態管理・ビルドパイプラインに合わせて再構築してください。まだフレームワークが決まっていない場合は、React + Vite + TypeScript を推奨します（Leaflet との相性が良く、地図ベースのアプリに適しているため）。

## Fidelity
**高忠実度 (Hi-Fi)** — 色、タイポグラフィ、レイアウト、アニメーションタイミング、効果音まで本番想定で作り込まれています。ピクセル単位で同じ見た目・挙動を再現してください。微細な調整（例: イージング、ディレイ）は README の数値を信頼してください。

## アプリ全体の流れ (ステートマシン)

```
idle ──[FIRE TRIGGER]──▶ scanning ──[scan完了]──▶ locked ──[RESET]──▶ idle
                                                       │
                                                       └─[detailDelaySec経過]─▶ 画像/説明文表示
                                                       └─[autoCloseSec経過]─▶ 自動でidleへ
```

3 つの phase:

| phase | 状態 | UI |
|---|---|---|
| `idle` | 待機中。照準が候補地をゆっくり漂う（drift） | FIRE TRIGGER ボタン |
| `scanning` | 約 2.3 秒の走査アニメ。候補地を順次ハイライト | "SCANNING…" ボタン (disabled) |
| `locked` | 当選地ロック。シンセ効果音、画面フラッシュ、地図ズームイン、結果カード表示 | RESET / FIRE AGAIN ボタン |

## Screens / Views

このアプリは **1 画面構成（フルスクリーン）** です。レイヤー構成は以下:

### レイヤー（背面 → 前面）
1. **衛星地図 (Leaflet)** — 全画面背景。Esri World Imagery タイル。
2. **走査オーバーレイ (SVG)** — 地図上に被さる候補地ドット・クロスヘア・ロックオン演出。
3. **スキャンライン** — 全画面に薄い水平走査線（CRT風）。
4. **フラッシュレイヤー** — ロック時に一瞬赤く光る (`mix-blend-mode: screen`)。
5. **フレーム枠 + 4 角コーナーマーク** — 軍用 HUD 風の枠。
6. **HUD テキスト (左上 / 右上)** — タイトル、時計、テレメトリ。
7. **サイドパネル** — 候補プール（右上）、当選履歴（右下）、結果カード（左下）。
8. **トリガーボタン** — 画面中央下。

### コンポーネント詳細

#### 1. HUD ヘッダー (左上)
- `cs-tag` "SAT.CHŪSEN · OPS CONSOLE" — 10px / letter-spacing 0.3em / opacity 0.55
- `cs-h1` "CROSSHAIR SCAN" — 22px / weight 600 / letter-spacing 0.06em / 色 `--text`
- `cs-tag` "MODE · LAND-ONLY · POOL {N} · TARGETS {N}" — 10px

#### 2. HUD テレメトリ (右上)
- 現在時刻 (JST, mm:ss.fff 形式) — JetBrains Mono
- 3 本のバー: SIG (シグナル, 72-98%) / NSE (ノイズ, 3-28%) / DRIFT (-1.2 ~ +1.2)
- バー高さ 3px、テレメトリは毎フレームランダムウォーク

#### 3. 候補プール (右上サイド)
- 位置: top 130px / right 28px / width 260px
- 候補リストを 2 列グリッドで表示。最大 28 件 + "+N more"
- スキャン中は該当候補が `--soft` でハイライト
- ロック中は当選候補が `--danger` 背景でハイライト
- 文字: 10.5px、prefは opacity 0.6

#### 4. 当選履歴 (右下サイド)
- 位置: bottom 110px / right 28px / width 260px
- 過去 5 件の当選地。各行: 県名 + 都市名 (16px Noto Sans JP bold) + 緯度経度 + タイムスタンプ
- 行間に dashed border

#### 5. 結果カード (左下) — **重要**
- 位置: bottom 110px / left 28px
- **通常時 width 320px / 画像表示時 width 560px** (transition 0.5s ease)
- 背景: `var(--panel)` + backdrop-filter blur(6px)
- 左に 2px のアクセントボーダー (ロック時は `--danger`)
- 内容（上から）:
  1. 都道府県名 — 10px / letter-spacing 0.32em / uppercase
  2. 都市名 — Noto Sans JP / 44px / weight 700 — ロック時に `hit` アニメーション (scale 0.92→1.04→1, 0.4s)
  3. **画像 + 説明文 (locked かつ revealDetail かつデータ有の場合のみ)**
     - 画像: aspect-ratio 16/10、object-fit cover、最初に `detailIn` アニメ (translateY 8px → 0, opacity 0 → 1, 0.55-0.8s)
     - 説明文: Noto Sans JP / 13px / line-height 1.65 / margin-top 12px
  4. 座標 LAT / LON — 11.5px

#### 6. トリガーボタン (中央下)
- 位置: bottom 28px / center
- フォント: JetBrains Mono / 11px / letter-spacing 0.32em / uppercase
- 状態別:
  - `idle`: "▶ FIRE TRIGGER" (primary: 塗り＋黒文字)
  - `scanning`: "SCANNING…" (disabled)
  - `locked`: "↻ RESET" (danger 枠) + "▶ FIRE AGAIN" (枠のみ)

#### 7. ステータスバー (最下部)
- 位置: bottom 12px / left 28px / right 28px
- 左: phase 表示 "● STANDBY..." / "◐ SCANNING..." / "● TARGET LOCKED"
- 右: "FRAME XXXXXX · UPLINK OK"
- 10px / letter-spacing 0.25em / opacity 0.6

#### 8. 地図上のロック演出 (SVG, locked phase)
- ピン位置を中心に:
  - 拡散リング × 2 (r 65→260, 1.8s ループ、0.9s 位相差)
  - 外側固定リング (r 96)
  - 内側 dashed リング (r 58)
  - 長い十字アーム (4本)
  - 中央の短い白十字
  - コーナーブラケット 4 個 (r 96 の位置)
  - 中央ピン (赤丸 r 6 + 白丸 r 2.5)
- ピンから引き出し線で **TARGET LOCKED コールアウト** (520×200, 黒半透明背景)
  - "TARGET LOCKED" — JetBrains Mono 14px / letter-spacing 6 / 色 `--danger`
  - 都道府県名 — 13px / opacity 0.6
  - 都市名 — Noto Sans JP 46px weight 500
  - 座標 — 13px / opacity 0.65
- コールアウトはピン位置によって左右に自動配置 (画面の左 55% にあれば右側に出す)

## Interactions & Behavior

### Idle drift
- 3〜5 秒ごとに候補地をランダム選出し、`targetLLRef` をその経度緯度に更新
- クロスヘア位置を毎フレーム `lerp(prev, target, 0.04)` で滑らかに追従

### Scanning (FIRE TRIGGER 押下時)
1. SFX.sweep (180Hz→900Hz, 0.45s) を再生
2. `finalIdx = random()` で当選地を内部決定
3. 26 tick のループ実行:
   - tick `i` で `span = max(1, floor((1-t) * candidates.length * 0.4))` を計算 (t = i/26)
   - 当選地周辺の `span` 範囲内からランダムに 1 つ選び `scanIdx` 更新
   - 同時に `targetLLRef` も更新
   - tick ごとに SFX.tick (1100±700Hz) 再生
   - tick 間隔 = `(22 + t^2.4 * 220) / speed` ms — 後半ほど遅く（イージング）
4. 26 tick 終了時に finalIdx を確定、`locked` 状態へ移行
5. クロスヘア追従は `lerp(prev, target, 0.18)` (idle より速いが瞬間ジャンプではない)

**合計スキャン時間: 約 2.3 秒**

### Locked
1. SFX.lockOn() 再生 (チャイム的)
2. 画面全体に赤フラッシュ (0.55s `flash` アニメ)
3. 当選地リスト (winners) の先頭に追加（最大 5 件保持）
4. **280ms 後**、地図カメラを当選地に flyTo(zoom=12, duration=1.6s)
5. **detailDelaySec (1.6s) 後**、結果カードに画像と説明文がフェードイン
6. **autoCloseSec (55s) 後**、自動で idle に戻る (地図も全国ビューに復帰)

### RESET
- 即座に `locked = null`, `phase = "idle"`
- 地図カメラを日本全域に flyToBounds (1.0s)
- クロスヘアを画面中央 (lon 135, lat 36) にリセット

### FIRE AGAIN
1. RESET 実行（地図ズームアウト 1.0s）
2. **2.2 秒待機** (ズームアウト完了 + 約 1.2 秒の "間")
3. 自動で FIRE TRIGGER 実行

## State Management

```ts
type Phase = "idle" | "scanning" | "locked";

interface AppState {
  phase: Phase;
  scanIdx: number;          // 現在ハイライトしている候補のインデックス
  locked: Candidate | null; // ロックされた当選地
  winners: Candidate[];     // 当選履歴 (最大5件)
  posLL: { lon: number; lat: number };  // クロスヘアの現在位置 (経度緯度)
  drift: number | null;     // idle時の漂いターゲットindex
  events: EventLog[];       // イベントログ (将来用)
  telemetry: { signal: number; noise: number; drift: number; frame: number };
  revealDetail: boolean;    // 画像/説明文を出してよいか
}
```

注意:
- `phaseRef` (useRef) と `phase` (useState) を両方持って同期している — useAnimationFrame 内で最新 phase を読むため
- `targetLLRef` も useRef — 毎フレーム lerp する補間先を保持
- 状態更新は React の state 経由、ただし高頻度ループ（毎フレーム）の参照だけは useRef で逃がす

## Configuration (CONFIG オブジェクト)

`Crosshair Scan.html` の上部にある定数で挙動を調整:

```js
const CONFIG = {
  speed: 1,           // アニメ速度倍率 (大きいほど高速)
  sound: true,        // 効果音オン/オフ
  autoFire: false,    // 自動発火モード (8-14秒に1回自動でFIRE)
  theme: "green",     // "amber" | "red" | "green" | "cyan"
  resultStyle: "standard",  // "minimal" | "standard" | "detailed"
  autoCloseSec: 55,   // ロックから自動クローズまでの秒数
  detailDelaySec: 1.6, // ロック後に画像/説明文を出すまでの秒数
  lockZoom: 12,       // ロック時のズーム (8=県全体 / 10=都市圏 / 12=市街地)
};
```

### CANDIDATES データ構造

```js
[地名, 都道府県, 経度, 緯度, 画像URL?, 説明文?]
```

5番目以降はオプション。実装時は次の型で:

```ts
interface Candidate {
  name: string;      // "札幌"
  pref: string;      // "北海道"
  lon: number;       // 141.354
  lat: number;       // 43.062
  image?: string;    // 画像URL (任意)
  desc?: string;     // 説明文 (任意)
}
```

現在のリストはサンプル画像に [picsum.photos](https://picsum.photos) を使っています。実運用時は実画像 URL に差し替えてください。

## Design Tokens

### Colors (テーマ別)

```css
/* Green theme (現在のデフォルト) */
--primary: oklch(0.82 0.18 145);
--soft:    oklch(0.82 0.18 145 / 0.5);
--danger:  oklch(0.7 0.22 25);

/* Amber */
--primary: oklch(0.82 0.18 75);
--soft:    oklch(0.82 0.18 75 / 0.5);
--danger:  oklch(0.65 0.22 25);

/* Red */
--primary: oklch(0.7 0.22 25);
--soft:    oklch(0.7 0.22 25 / 0.5);
--danger:  oklch(0.65 0.22 25);

/* Cyan */
--primary: oklch(0.82 0.16 210);
--soft:    oklch(0.82 0.16 210 / 0.5);
--danger:  oklch(0.7 0.22 25);
```

### 共通カラー
```css
--bg:    oklch(0.075 0.025 240);              /* ほぼ黒の深い青 */
--panel: oklch(0.1 0.025 240 / 0.78);         /* 半透明パネル */
--line:  oklch(0.95 0.02 230 / 0.12);         /* 細線 */
--text:  oklch(0.95 0.03 80);                 /* オフホワイト */
--dim:   oklch(0.7 0.04 80 / 0.55);           /* 弱いテキスト */
```

### Typography
```css
font-family-mono: 'JetBrains Mono', ui-monospace, monospace;
font-family-jp:   'Noto Sans JP', system-ui, sans-serif;
font-family-ui:   'Inter', system-ui, sans-serif;
```

サイズスケール (全部 px):
| 用途 | size | weight | letter-spacing |
|---|---|---|---|
| HUDタグ | 10 | 400 | 0.30em |
| ステータス | 10 | 400 | 0.25em |
| ボタン | 11 | 600 | 0.32em |
| サイドパネル本文 | 11 | 400 | 0em |
| サイドパネル見出し | 9.5 | 400 | 0.32em |
| HUDタイトル | 22 | 600 | 0.06em |
| カード本文・座標 | 11.5–13 | 400 | 0.02em |
| カード都市名 | 44 | 700 | 0.02em |
| ロックコールアウト都市名 | 46 | 500 | 0.02em |

### Animation
- 拡散リング: `r: 65 → 260, opacity: 0.85 → 0`, 1.8s ループ (2本、0.9s位相差)
- フラッシュ: `flash` keyframe — opacity 0 → 0.45 → 0, 0.55s ease-out
- ロックヒット: `hit` keyframe — scale 0.92 → 1.04 → 1, 0.4s ease-out
- 詳細フェードイン: `detailIn` keyframe — translateY 8 → 0, opacity 0 → 1, 0.55-0.8s ease-out
- カード幅トランジション: 0.5s ease
- ライブインジケータ点滅: 1.4s infinite (opacity 1 → 0.3)

### Sizing
- フレーム inset: 14px
- HUD padding: 14px 22px
- サイドパネル padding: 14px 16px
- 結果カード padding: 16px 20px
- ボタン padding: 12px 26px

## Assets / 外部依存

### CDN
- **Leaflet** 1.9.4 — 地図ライブラリ
  - `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css`
  - `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`
- **React** 18.3.1 (UMD) — プロトタイプ用、本番では npm パッケージへ
- **Babel Standalone** 7.29.0 — JSX をブラウザでトランスパイル、本番ではビルドステップへ

### フォント (Google Fonts)
- Inter (400, 500, 600)
- JetBrains Mono (400, 500, 600)
- Noto Sans JP (400, 500, 700)

### 地図タイル
- **Esri World Imagery** (衛星写真) — `basemap-real.jsx` 参照
- Attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"

### 効果音 (`audio.js`)
すべて Web Audio API で生成されており外部音源は不要:
- `SFX.tick()` — スキャン中の高音ピッ
- `SFX.sweep(from, to, dur)` — トリガー時の周波数スイープ
- `SFX.lockOn()` — ロック時のチャイム

### 画像
現在のサンプルは `picsum.photos` のランダム画像。本番では各都市の実写画像（ライセンス確認済み）を用意してください。推奨サイズ: 640×400 以上、16:10 アスペクト比。

## Files (このフォルダ内)

| ファイル | 内容 |
|---|---|
| `Crosshair Scan.html` | エントリーポイント。CANDIDATES と CONFIG はここに |
| `crosshair-app.jsx` | メインの React コンポーネント (671行) |
| `basemap-real.jsx` | Leaflet 衛星地図ラッパー + flyTo / reset コントローラ |
| `basemap.jsx` | SVG ベースの代替地図 (現在は未使用 / フォールバック) |
| `japan-data.js` | 都市座標プリセット + 緯度経度フォーマッタ + 投影関数 |
| `audio.js` | Web Audio API 効果音モジュール |

## 実装時の推奨ステップ

1. **基盤を立てる**
   - React + Vite + TypeScript プロジェクトを作成
   - `react-leaflet` か直接 Leaflet を導入
   - フォント（Inter / JetBrains Mono / Noto Sans JP）を組み込み

2. **ステートマシンを実装**
   - `phase` を Zustand / useReducer / XState で管理
   - `CANDIDATES` を JSON / CMS / API から読み込む形に
   - 画像は CDN 経由か、`/public/cities/` に配置

3. **地図レイヤーを構築**
   - Leaflet マップ + Esri タイル
   - flyTo / flyToBounds をフックでラップ
   - 候補ドットは Leaflet マーカー or SVG オーバーレイ

4. **走査ロジック**
   - `crosshair-app.jsx` の `fire()` 関数 (L121-160 付近) をそのまま TypeScript で書き直し
   - tick の `setTimeout` ループは `useEffect` + cleanup で実装

5. **HUD レイヤー**
   - SVG クロスヘアは React コンポーネントとして抜き出し
   - 結果カード、サイドパネルは独立コンポーネントに

6. **効果音**
   - `audio.js` の SFX クラスはそのまま流用可能 (Web Audio API)
   - ブラウザの自動再生制限のため、最初のユーザー操作後に `SFX.ensure()` を呼ぶ

7. **テーマシステム**
   - CSS Custom Properties (`--primary` 等) で実装済み
   - data-theme 属性で切り替え

## Open Questions

実装前に決めておくべきこと:
- 候補リストは固定？それとも API / CMS で動的に？
- 画像のホスト先と CDN は？
- 配信連携（OBS / ストリームチャット連動）は本番でも残す？
- レスポンシブ対応の範囲（モバイルでも使う？）

## Contact
このプロトタイプに関する質問は元の Claude セッションへ。
