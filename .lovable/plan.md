# 生配信（ライブ配信）機能 実装計画

既存機能（認証・動画投稿・文章投稿・コメント・返信・いいね・DM・通知・フレンド・管理者・分析）は一切変更せず、**追加のみ**で組み込みます。

## 1. 現在のプロジェクト構成

- TanStack Start（React 19 / Vite）+ Tailwind + shadcn UI
- ページ: ホーム、検索、ランキング、アップロード、動画詳細、YouTube、プロフィール、保存、通知、DM一覧・個別、フレンド、設定/管理者ログイン、規約
- 共通部品: Header、SideNav、VideoCard、PostList、Comments、CommentReplies、UserAvatar、AdminBadge、ChannelAnalytics
- データ層: `src/lib/queries.ts`（TanStack Query）、`src/lib/storage.ts`（署名URL・アップロード）
- 通知: `src/lib/push.ts` + `src/lib/push.functions.ts`（Web Push、VAPID鍵はサーバー側に既存）

## 2. 現在の認証・バックエンド構成

- メール＋Microsoft/Google系のログイン、`profiles` が全ユーザーの表示情報
- 主要テーブル: profiles / videos / posts / comments / comment_replies / comment_likes / likes / saved_videos / subscriptions / friendships / friend_requests / direct_messages / notifications / mailbox_messages / push_subscriptions / admin_badges
- 各テーブルはRLS＋GRANT済み。通知は種類（like, comment, subscribe, new_video, friend_request）を持つ列挙型
- サーバー処理は `createServerFn`（Edge Functionは新規作成しない）

## 3. 既存機能との接続方法

- 配信者情報は `profiles` をそのまま参照（アイコン・管理者マークも既存部品を再利用）
- フォロー通知は既存 `subscriptions` を利用（登録者へ通知）
- 通知は既存 `notifications` に新しい種類 `live_start` を追加するだけ。プッシュ送信は既存 `push.functions.ts` に関数を1つ足す形
- コメントは既存コメント欄とは別テーブル（ライブ専用）にし、既存コメント機能には触らない
- いいねはライブ専用テーブル。既存 `likes` はそのまま

## 4. 新しいテーブル（追加のみ）

- `live_streams`: 配信者、タイトル、説明、状態（準備中/配信中/終了）、開始日時、終了日時、視聴者数の記録、サムネイル、将来のアーカイブ用の保存先、配信方式の識別子
- `live_viewers`: 配信ID・視聴者・最終接続時刻（現在の視聴者数の集計用、離脱で自動的に古くなる）
- `live_chat_messages`: 配信ID・投稿者・本文（Realtime配信、将来のモデレーション用に「非表示」フラグ）
- `live_likes`: 配信ID・ユーザー（重複不可）
- `live_signals`: WebRTC接続の合図データを一時的に受け渡す箱（Realtimeで送受信、将来別方式に差し替え可能）
- 将来拡張の余地: `live_reports`（通報）、`live_blocks`（ブロック）、`live_moderators`、`live_ai_insights`（Chat AET分析結果）を後から追加できるよう、すべて `live_streams.id` を軸にした設計にします

RLSは既存方針を踏襲：公開中の配信は誰でも閲覧可、書き込みは本人のみ、GRANTも同じ migration 内で付与。Realtimeはチャット・視聴者・配信状態のみ有効化。

## 5. 必要なサーバー処理（Edge Functionは作らない）

`src/lib/live.functions.ts` に `createServerFn` で追加：
- 配信開始（配信レコード作成＋登録者への通知作成＋プッシュ送信）
- 配信終了（状態更新、最高同時視聴者数の確定）
- 視聴者の心拍（参加/離脱の記録と視聴者数返却）
- 配信一覧・配信詳細の公開読み取り（ログイン不要で見られるように公開用の読み取り）

## 6. 必要な画面・部品

- `/live`：ライブ配信一覧（LIVEバッジ、視聴者数、配信者アイコン）
- `/live/start`：配信開始画面（タイトル入力、カメラ・マイク許可、プレビュー、開始/終了、配信中表示、視聴者数）
- `/live/$streamId`：視聴ページ（映像、配信者情報、リアルタイムチャット、いいね、視聴者数）
- 部品：`LiveBadge`、`LiveCard`、`LiveChat`、`LiveLikeButton`、`LiveViewerCount`、`useLiveStream`（接続処理）
- 導線：SideNav と Header に「ライブ」を追加（既存項目は変更しない）。ホームに配信中があるときだけ小さな一覧を出す

デザインは既存のカード・ボタン・配色トークンをそのまま使用します。

## 7. 映像配信方式の比較

| 方式 | 費用 | 無料で開始 | 同時視聴 | iPhone | ブラウザ | 難易度 | 拡張性 |
|---|---|---|---|---|---|---|---|
| ブラウザ間の直接接続（WebRTC / P2P、合図はバックエンドのRealtime） | 追加費用なし | できる | 数人〜十数人まで | 対応（Safari可） | 良好 | 中 | 中（後で配信サーバー方式に差し替え可） |
| WebRTC + 中継サーバー（SFU、自前運用） | サーバー費用が発生 | 実質不可 | 数百人 | 対応 | 良好 | 高 | 高 |
| 外部ライブ配信サービス（Mux / Cloudflare Stream / Livekit 等） | 従量課金 | 無料枠は限定的 | 数千人以上 | 対応 | 良好 | 低〜中 | 非常に高（録画・アーカイブ標準） |
| 画像連写でごまかす方式（数秒ごとの静止画をアップ） | 追加費用なし | できる | 多い | 対応 | 良好 | 低 | 低（音声なし・映像品質が低い） |

結論：**今は追加契約なしで始められる「ブラウザ間の直接接続」方式**にします。少人数向けですが無料で完結し、iPhoneのSafariでも動きます。視聴者が増えて限界が来たら、`live_streams` に方式の識別子を持たせておくので、外部サービス方式を後から並行追加できます（今回は契約しません）。

## 8. 最小構成（第1段階）

1. テーブル追加＋RLS＋Realtime有効化
2. 配信開始/終了/視聴者心拍のサーバー処理
3. `/live` 一覧、`/live/start` 配信、`/live/$streamId` 視聴（映像＋視聴者数）
4. ライブチャットといいね
5. 登録者への通知（画面内通知＋既存プッシュ）

第2段階以降：アーカイブ保存、配信履歴、モデレーション、通報、ブロック、AI分析（Chat AET連携）

## 9. 既存機能を壊さないための注意点

- 既存テーブル・ポリシー・関数は変更しない（通知の種類に値を1つ追加するのみ、既存値は保持）
- 既存ファイルの編集は「ライブへの導線を足す」だけに限定（Header / SideNav / ホーム）
- プッシュ通知は既存の仕組みを再利用し、DM通知の処理には触らない
- 新規ページはすべて追加ファイル。既存ルートの上書きなし
- スパダッシュ / Chat AET / GitHub 連携の設定ファイルには手を入れない
- 各段階でビルドと型チェックを通し、既存画面の表示を確認
