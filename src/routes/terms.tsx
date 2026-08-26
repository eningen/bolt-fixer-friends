import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
  const { language } = useLanguage();
  const en = language === "en";

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
        <Button asChild variant="ghost" className="mb-4">
          <Link to="/">← {en ? "Back" : "戻る"}</Link>
        </Button>

        <article className="rounded-xl border border-border bg-card p-6 leading-7">
          <h1 className="text-2xl font-extrabold">Stickman Video 利用規約</h1>
          <p className="mt-2 text-sm text-muted-foreground">最終更新日: 2026年8月20日</p>

          <h2 className="mt-7 text-lg font-bold">第1条 サービスについて</h2>
          <p className="mt-2">Stickman Videoは、棒人間アニメーションや動画を投稿・共有できる動画SNSサービスです。また棒人間ジャンル以外の動画投稿も大歓迎です。</p>

          <h2 className="mt-7 text-lg font-bold">第2条 アカウント</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>利用者は正しい情報を登録してください。</li>
            <li>他人になりすましてアカウントを作成することは禁止します。</li>
            <li>個人情報保護のため、本名や電話番号、住所など個人を特定できる情報をアカウント名やプロフィールに記載しないでください。</li>
            <li>アカウント名やプロフィール情報は後から変更できます。</li>
            <li>パスワードは第三者に教えたり共有したりしないでください。</li>
          </ul>

          <h2 className="mt-7 text-lg font-bold">第3条 投稿について</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>利用者は自分で制作した動画、または投稿する権利を持つ動画のみ投稿できます。</li>
            <li>他人の動画を許可なく転載する行為は禁止しています。</li>
            <li>また他人への誹謗中傷や過度な攻撃的コメントを行う行為は禁止しています。</li>
            <li>運営は投稿された動画・コメント等について、利用規約違反の疑いがある場合、事前通知なく確認・削除できるものとします。</li>
          </ul>

          <h2 className="mt-7 text-lg font-bold">第4条 禁止事項</h2>
          <p className="mt-2">以下の行為を禁止します。</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>他人への誹謗中傷</li><li>荒らし行為</li><li>スパム行為</li><li>不正アクセス</li><li>他人へのなりすまし</li><li>著作権を侵害する動画の投稿</li><li>違法な内容の投稿</li><li>サービス運営の妨害</li><li>意図的に内容を隠す目的で隠語や暗号のような表現を使用する行為</li><li>個人情報の公開</li><li>詐欺行為</li><li>他サービスへの過度な誘導</li><li>不適切な広告</li><li>他人の住所、電話番号、学校名など個人情報を公開する行為</li>
          </ul>

          <h2 className="mt-7 text-lg font-bold">第5条 動画の削除</h2>
          <p className="mt-2">運営は利用規約に違反する動画またはアカウントを予告なく削除、非公開化、一時停止または永久停止できるものとします。</p>

          <h2 className="mt-7 text-lg font-bold">第6条 サービス変更</h2>
          <p className="mt-2">運営はサービス内容を変更または停止する場合があります。</p>

          <h2 className="mt-7 text-lg font-bold">第7条 免責事項</h2>
          <p className="mt-2">利用者同士のトラブルについて、運営は可能な範囲で対応しますが責任を負わないものとします。</p>

          <h2 className="mt-7 text-lg font-bold">第8条 年齢制限について</h2>
          <p className="mt-2">中学生未満の方は、保護者の同意を得た上で本サービスをご利用ください。また、早生まれなどにより12歳であっても中学生であれば利用可能です。なお、年齢によっては一部機能が利用できない場合があります。</p>

          <h2 className="mt-7 text-lg font-bold">第9条 運営について</h2>
          <p className="mt-2">本サービスは個人運営のサービスです。運営はサービス向上や不具合修正を目的として随時アップデートを行います。また、メンテナンス等により一時的にサービスが利用できなくなる場合があります。サービス向上のため、利用規約やプライバシーポリシーを変更する場合があります。運営は必要に応じて利用者へ通知を行う場合があります。大型アップデートの場合は修正に1日~2日掛かる事があります。</p>

          <h2 className="mt-7 text-lg font-bold">Stickman video運営の対応時間について</h2>
          <p className="mt-2">運営は個人運営に伴い以下の時間帯に対応しております。</p>
          <ul className="mt-2 list-disc space-y-1 pl-6"><li>平日: 7時~7時50分・16時~21時30分</li><li>休日: 8時~21時30分</li><li>長期休み: 7時~21時30分</li><li>祝日: 8時~21時30分</li></ul>
          <p className="mt-2 text-sm text-muted-foreground">※また上記に記載した時間帯であっても対応できない場合があります。</p>

          <h2 className="mt-7 text-lg font-bold">これら利用規約の対象外の条件</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>本人が公開している情報や、既に本人により公開されている情報については、第4条の個人情報公開禁止の対象外とします。</li>
            <li>他人の動画を勝手に転載する行為はその動画の所有者・本人に許可をとっている場合は対象外となります。ただし許可を取っていても動画を投稿する際は、元ネタのチャンネルリンクをコメント欄に書き、許可を本人から得ている事を、書いて下さい。</li>
            <li>ただしこれらを守られていない場合は通常通り、対応させて頂きます。</li>
          </ul>

          <h2 className="mt-7 text-lg font-bold">利用規約が対象外になる理由</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>既に一般に公開されている物に利用規約通り対応すると、動画投稿時のややこしさ・利用者の困惑を起こすためです。</li>
            <li>コメント欄に元ネタを書く事が必要な理由は、その動画を見た視聴者が元ネタを作った人物と間違えないように、又は無断転載の影響を起こさないためです。</li>
          </ul>

          <h2 className="mt-10 border-t border-border pt-7 text-xl font-extrabold">Stickman Video プライバシーポリシー</h2>
          <h2 className="mt-7 text-lg font-bold">取得する情報</h2>
          <p className="mt-2">Stickman Videoでは以下の情報を保存します。</p>
          <ul className="mt-2 list-disc space-y-1 pl-6"><li>ユーザー名</li><li>メールアドレス</li><li>プロフィール情報</li><li>投稿した動画</li><li>フォロー情報</li><li>いいね情報</li><li>コメント情報</li><li>チャンネル開設日</li><li>アクセス日時</li><li>IPアドレス</li><li>ブラウザ情報</li><li>ログイン方法（Google / Email）</li><li>アカウント作成日時</li><li>最終ログイン日時</li><li>ユーザーID</li><li>メール認証状況</li></ul>

          <h2 className="mt-7 text-lg font-bold">利用目的</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6"><li>アカウント管理</li><li>サービス提供</li><li>不具合修正</li><li>不正利用対策</li><li>違反行為取り締まり</li><li>法令に基づく対応</li><li>お問い合わせ対応</li></ul>

          <h2 className="mt-7 text-lg font-bold">情報の管理</h2><p className="mt-2">運営は取得した情報を適切に管理します。</p>
          <h2 className="mt-7 text-lg font-bold">第三者提供</h2><p className="mt-2">法令に基づく場合を除き、利用者の個人情報を第三者へ提供しません。また、フォロワー数、投稿数、チャンネル名などの一部情報は公開される場合があります。</p>
          <h2 className="mt-7 text-lg font-bold">情報の削除について</h2><p className="mt-2">利用者がアカウント削除を希望する場合は、お問い合わせよりご連絡ください。運営は確認後、対象データの削除を行います。</p>
          <h2 className="mt-7 text-lg font-bold">お問い合わせ</h2><p className="mt-2">ご質問やお問い合わせは運営までご連絡ください。運営までのご連絡は左側にあるタブからお問い合わせください。またお問い合わせ返信はAIではなく全て人の手によって丁寧に返信しております。また時間帯や日時によっては数日対応できない場合があります。必ずしも対応できる訳ではないので後日の返信で対応して頂く場合があります。</p>

          <h2 className="mt-10 border-t border-border pt-7 text-xl font-extrabold">Stickman Video コミュニティガイドライン</h2>
          <p className="mt-2">~楽しく利用するためのルール~</p>
          <ol className="mt-2 list-decimal space-y-1 pl-6"><li>みんなに共感してもらおう</li><li>みんなに作品を共有しよう</li><li>みんなで楽しく使おう</li><li>誹謗中傷は禁止</li><li>オリジナル作品を大切にしよう</li><li>困ったら通報機能を利用しよう</li></ol>

          <p className="mt-10 border-t border-border pt-6 font-semibold">※本サービスを利用した時点で、本利用規約およびプライバシーポリシーに同意したものとみなします。</p>
          <p className="mt-4 text-sm text-muted-foreground">最終更新日: 2026年8月20日</p>
        </article>
      </main>
    </div>
  );
}
