import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { appLink } from "./urls";
import type { UserDoc } from "./data";
import { escapeHtml, sendEmail } from "./email";

// The three onboarding emails (PLAN.md phase 7): welcome, "your site is live" and
// "you got your first message". Each one is sent once per account.

type Milestone = "welcome" | "live" | "firstMessage";

/** Marks the milestone and returns the user if this is the first time (so the email goes once). */
async function once(uid: string, key: Milestone): Promise<UserDoc | null> {
  const db = adminDb();
  const ref = db.collection("users").doc(uid);
  return db.runTransaction(async (tx) => {
    const user = (await tx.get(ref)).data() as (UserDoc & { emails?: Record<string, boolean> }) | undefined;
    if (!user?.email || user.isAnonymous || user.emails?.[key]) return null;
    tx.update(ref, { [`emails.${key}`]: true });
    return user;
  });
}

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "fannan.net";

function mail(user: UserDoc, subject: [string, string], body: [string[], string[]], cta: [string, string], link: string) {
  const ar = user.locale === "ar";
  const lines = ar ? body[1] : body[0];
  const button = ar ? cta[1] : cta[0];
  return {
    to: user.email!,
    subject: ar ? subject[1] : subject[0],
    text: `${lines.join("\n\n")}\n\n${button}: ${link}`,
    html: `<div${ar ? ' dir="rtl"' : ""}>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#141414;color:#fff;text-decoration:none;font-weight:600">${button}</a></p></div>`,
  };
}

async function usernameOf(user: UserDoc) {
  if (!user.siteId) return null;
  return ((await adminDb().collection("sites").doc(user.siteId).get()).data()?.username as string | undefined) ?? null;
}

export async function welcome(uid: string) {
  const user = await once(uid, "welcome");
  if (!user) return;
  const name = await usernameOf(user);
  const address = name ? `${name}.${ROOT_DOMAIN}` : `yourname.${ROOT_DOMAIN}`;
  await sendEmail(
    mail(
      user,
      ["Welcome to Fannan", "أهلًا بك في فنان"],
      [
        [
          `Your address ${address} is saved. Three things make the biggest difference to studios:`,
          "1. Add your best 3–5 projects, with your role, the studio or client, and the year.",
          "2. Write a short About: who you are, what you do, where you are.",
          "3. Turn on “Available for work” when you're taking projects.",
          "Then press Publish and send your link everywhere.",
        ],
        [
          `حُفظ عنوانك ${address}. ثلاثة أشياء تصنع أكبر فرق عند الاستوديوهات:`,
          "١. أضف أفضل ٣ إلى ٥ مشاريع، مع دورك والاستوديو أو العميل والسنة.",
          "٢. اكتب نبذة قصيرة: من أنت، وماذا تعمل، وأين أنت.",
          "٣. فعّل «متاح للعمل» عندما تقبل مشاريع.",
          "ثم اضغط «انشر» وأرسل رابطك في كل مكان.",
        ],
      ],
      ["Open my dashboard", "افتح لوحة التحكم"],
      appLink("/"),
    ),
  );
}

export async function siteLive(uid: string, username: string) {
  const user = await once(uid, "live");
  if (!user) return;
  const link = `https://${username}.${ROOT_DOMAIN}`;
  await sendEmail(
    mail(
      user,
      ["Your site is live", "موقعك منشور الآن"],
      [
        [
          `Congratulations! ${username}.${ROOT_DOMAIN} is live.`,
          "Put the link in your Instagram and LinkedIn bio, your email signature and every application. Studios look at the work first, so lead with your strongest project.",
          "Editing never changes the live site until you press Publish again.",
        ],
        [
          `مبروك! ${username}.${ROOT_DOMAIN} منشور الآن.`,
          "ضع الرابط في نبذة إنستجرام ولينكدإن وتوقيع بريدك وكل تقديم. الاستوديوهات تنظر إلى الأعمال أولًا، فابدأ بأقوى مشروع لديك.",
          "التعديل لا يغيّر الموقع المنشور حتى تضغط «انشر» مرة أخرى.",
        ],
      ],
      ["See my site", "شاهد موقعي"],
      link,
    ),
  );
}

/** The first contact-form message ever. When email copies are on, the message email itself says so. */
export async function firstMessage(uid: string, emailCopiesOn: boolean): Promise<boolean> {
  const user = await once(uid, "firstMessage");
  if (!user) return false;
  if (emailCopiesOn) return true;
  await sendEmail(
    mail(
      user,
      ["You got your first message on Fannan", "وصلتك أول رسالة على فنان"],
      [
        ["Someone used the contact form on your site. Read it and reply from your inbox."],
        ["استخدم أحدهم نموذج التواصل في موقعك. اقرأ الرسالة ورد عليها من صندوق الرسائل."],
      ],
      ["Open messages", "افتح الرسائل"],
      appLink("/messages"),
    ),
  );
  return true;
}
