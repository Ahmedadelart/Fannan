"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { signOut } from "firebase/auth";
import { endServerSession, useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Controls";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/lib/cx";
import { imageSources } from "@/lib/media";
import type { DomainInfo } from "@/lib/server/domains";
import type { SiteSettings } from "@/lib/server/settings";
import { beginUpload, completeUpload } from "../projects/actions";
import {
  changeEmail,
  checkOwnDomain,
  connectOwnDomain,
  removeOwnDomain,
  deleteAccount,
  renameSite,
  saveBasics,
  saveSitePassword,
  saveSiteSettings,
  undoDeleteAccount,
} from "./actions";

export interface SettingsData {
  username: string;
  domain: string;
  siteUrl: string;
  pro: boolean;
  canPassword: boolean;
  settings: SiteSettings;
  language: "en" | "ar";
  favicon: { id: string; src: string } | null;
  shareImage: { id: string; src: string } | null;
  cv: { id: string; name: string } | null;
  defaults: { title: string; description: string };
  email: string;
  emailChanged: boolean;
  anonymous: boolean;
  deletionAt: number | null;
  plans: Array<{ months: number; price: string; perMonth: string; label: string }>;
  canDomain: boolean;
  ownDomain: DomainInfo | null;
  billing: {
    proUntil: number | null;
    inGrace: boolean;
    gift: boolean;
    canBuy: boolean;
    orders: Array<{ id: string; date: number; months: number; amount: string; status: string; gift: boolean }>;
  };
}

const SECTIONS = ["domain", "privacy", "contact", "language", "integrations", "plan", "account"] as const;
const GA_RE = /^G-[A-Z0-9]{4,16}$/;
const PIXEL_RE = /^\d{6,20}$/;

const EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

function networkOf(url: string): string {
  let host = "";
  try {
    host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "website";
  }
  const map: Array<[RegExp, string]> = [
    [/instagram\.com$/, "instagram"],
    [/artstation\.com$/, "artstation"],
    [/behance\.net$/, "behance"],
    [/linkedin\.com$/, "linkedin"],
    [/(youtube\.com|youtu\.be)$/, "youtube"],
    [/vimeo\.com$/, "vimeo"],
    [/(x\.com|twitter\.com)$/, "x"],
    [/tiktok\.com$/, "tiktok"],
    [/(facebook\.com|fb\.com)$/, "facebook"],
  ];
  return map.find(([re]) => re.test(host))?.[1] ?? "website";
}

/* ---------- small pieces ---------- */

function Section({ id, title, sub, children, wide }: { id: string; title: string; sub?: string; children: ReactNode; wide?: boolean }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cx("border-line bg-paper flex scroll-mt-6 flex-col gap-3.5 rounded-lg border p-5", wide && "lg:col-span-2")}
    >
      <div>
        <h2 id={`${id}-title`} className="font-heading font-heading-weight text-[20px] leading-tight">
          {title}
        </h2>
        {sub && <p className="text-muted mt-0.5 text-[13px]">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="border-line flex items-center justify-between gap-4 border-t pt-3 first:border-t-0 first:pt-0">
      <span className="flex min-w-0 flex-col">
        <span className="text-[14px] font-semibold">{title}</span>
        {hint && <span className="text-muted text-[12px]">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children, disabled }: { on: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "rounded-pill h-8 px-3 text-[12px] font-semibold transition-colors disabled:cursor-default",
        on ? "bg-secondary-container text-on-secondary-container" : "bg-mist text-ink hover:bg-line",
      )}
    >
      {children}
    </button>
  );
}

/* ---------- the form ---------- */

export function SettingsForm({ data }: { data: SettingsData }) {
  const t = useTranslations("settings");
  const tp = useTranslations("projects");
  const format = useFormatter();
  const toast = useToast();

  const [s, setS] = useState<SiteSettings>(data.settings);
  const [language, setLanguage] = useState(data.language);
  const [favicon, setFavicon] = useState(data.favicon);
  const [shareImage, setShareImage] = useState(data.shareImage);
  const [cv, setCv] = useState(data.cv);
  const [social, setSocial] = useState<string[]>(() => {
    const urls = data.settings.social.map((l) => l.url);
    return urls.length < 4 ? [...urls, ...Array(4 - urls.length).fill("")] : urls;
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [askCustom, setAskCustom] = useState(!!data.settings.contact.customQuestion);

  const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setS((cur) => ({ ...cur, [key]: value }));
    setDirty(true);
  };
  const gaBad = !!s.integrations.gaId && !GA_RE.test(s.integrations.gaId.trim().toUpperCase());
  const pixelBad = !!s.integrations.pixelId && !PIXEL_RE.test(s.integrations.pixelId.trim());

  async function save() {
    if (gaBad || pixelBad) return toast(t("fixErrors"));
    setSaving(true);
    const contact = { ...s.contact, customQuestion: askCustom ? s.contact.customQuestion : "" };
    const [a, b] = await Promise.all([
      saveSiteSettings({
        privacy: s.privacy,
        contact,
        social: social.map((u) => u.trim()).filter(Boolean).map((url) => ({ network: networkOf(url), url })),
        cvMediaId: cv?.id ?? null,
        seo: { ...s.seo, shareImageId: shareImage?.id ?? null },
        integrations: s.integrations,
      }),
      saveBasics({ language, faviconMediaId: favicon?.id ?? null }),
    ]);
    setSaving(false);
    if (!a.ok || !b.ok) return toast(t("error"));
    setDirty(false);
    toast(language !== data.language || favicon?.id !== data.favicon?.id ? t("savedPublish") : t("saved"), "check");
  }

  /* uploads go to the site library, like images picked in the editor */
  async function upload(file: File, kind: "image" | "pdf"): Promise<{ id: string; src: string; name: string } | null> {
    const type = EXT[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? file.type;
    if (kind === "pdf" ? type !== "application/pdf" : !type.startsWith("image/")) {
      toast(tp("errors.bad-type"));
      return null;
    }
    const problem = (code: string) =>
      toast(tp.has(`errors.${code}`) ? tp(`errors.${code}`, { image: 30, pdf: 50 }) : tp("errors.error"));
    const start = await beginUpload("_library", { name: file.name, type, size: file.size });
    if (!start.ok) return problem(start.error), null;
    const put = await fetch(start.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": start.contentType },
      body: file,
    }).catch(() => null);
    if (!put?.ok) return problem("error"), null;
    const done = await completeUpload(start.mediaId);
    if (!done.ok) return problem(done.error), null;
    setDirty(true);
    return { id: done.media.id, src: imageSources(done.media, 800)?.src ?? "", name: file.name };
  }

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t("onThisPage")} className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {SECTIONS.map((id) => (
          <a
            key={id}
            href={`#${id}`}
            className="border-line bg-paper text-ink-soft hover:text-ink flex h-8 flex-none items-center rounded-[8px] border px-3 text-[13px] font-medium"
          >
            {t(`nav.${id}`)}
          </a>
        ))}
      </nav>

      {data.deletionAt && <DeletionBanner at={data.deletionAt} />}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <DomainSection data={data} />

        <Section id="privacy" title={t("privacy.title")}>
          <SitePassword data={data} on={s.hasSitePassword} onChange={(v) => setS((c) => ({ ...c, hasSitePassword: v }))} />
          <Row title={t("privacy.protect")} hint={t("privacy.protectHint")}>
            <Toggle
              hideLabel
              label={t("privacy.protect")}
              checked={s.privacy.protectImages}
              onChange={(v) => update("privacy", { ...s.privacy, protectImages: v })}
            />
          </Row>
          <Row title={t("privacy.searchable")} hint={t("privacy.searchableHint")}>
            <Toggle
              hideLabel
              label={t("privacy.searchable")}
              checked={s.privacy.searchable}
              onChange={(v) => update("privacy", { ...s.privacy, searchable: v })}
            />
          </Row>
          <Row title={t("privacy.indexable")} hint={t("privacy.indexableHint")}>
            <Toggle
              hideLabel
              label={t("privacy.indexable")}
              checked={s.privacy.indexable}
              onChange={(v) => update("privacy", { ...s.privacy, indexable: v })}
            />
          </Row>
        </Section>

        <Section id="contact" title={t("contact.title")} sub={t("contact.sub")}>
          <Row title={t("contact.inbox")} hint={t("contact.inboxHint")}>
            <Toggle hideLabel label={t("contact.inbox")} checked disabled />
          </Row>
          <Row title={t("contact.email")} hint={<span dir="ltr">{data.email || "–"}</span>}>
            <Toggle
              hideLabel
              label={t("contact.email")}
              checked={s.contact.email}
              onChange={(v) => update("contact", { ...s.contact, email: v })}
            />
          </Row>
          <Row title={t("contact.whatsapp")} hint={t("contact.whatsappHint")}>
            <Badge variant="neutral">{t("soon")}</Badge>
          </Row>
          <div className="flex flex-col gap-2">
            <span className="text-ink-soft text-[12px] font-semibold">{t("contact.askFor")}</span>
            <div className="flex flex-wrap gap-1.5">
              <Chip on disabled>
                {t("contact.name")}
              </Chip>
              <Chip on disabled>
                {t("contact.emailField")}
              </Chip>
              {(["projectType", "budget", "deadline"] as const).map((k) => (
                <Chip key={k} on={s.contact[k]} onClick={() => update("contact", { ...s.contact, [k]: !s.contact[k] })}>
                  {t(`contact.${k}`)}
                </Chip>
              ))}
              <Chip
                on={askCustom}
                onClick={() => {
                  setAskCustom(!askCustom);
                  setDirty(true);
                }}
              >
                {askCustom ? t("contact.custom") : `+ ${t("contact.custom")}`}
              </Chip>
            </div>
            {askCustom && (
              <Input
                label={t("contact.customLabel")}
                maxLength={160}
                placeholder={t("contact.customPlaceholder")}
                value={s.contact.customQuestion}
                onChange={(e) => update("contact", { ...s.contact, customQuestion: e.target.value })}
              />
            )}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-ink-soft mb-2 text-[12px] font-semibold">{t("contact.social")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {social.map((url, i) => (
                <Input
                  key={i}
                  aria-label={t("contact.socialN", { n: i + 1 })}
                  dir="ltr"
                  inputMode="url"
                  placeholder={["instagram.com/you", "linkedin.com/in/you", "artstation.com/you", t("contact.socialMore")][i] ?? ""}
                  value={url}
                  onChange={(e) => {
                    const next = [...social];
                    next[i] = e.target.value;
                    setSocial(next);
                    setDirty(true);
                  }}
                />
              ))}
            </div>
            {social.length < 8 && (
              <button
                type="button"
                onClick={() => setSocial([...social, ""])}
                className="text-ink-soft hover:text-ink self-start text-[13px] font-semibold"
              >
                + {t("contact.addLink")}
              </button>
            )}
          </fieldset>
          <FilePick
            label={t("contact.cv")}
            hint={t("contact.cvHint")}
            accept="application/pdf"
            current={cv ? cv.name : null}
            button={cv ? t("replace") : t("contact.cvUpload")}
            onFile={async (f) => {
              const r = await upload(f, "pdf");
              if (r) setCv({ id: r.id, name: r.name });
            }}
            onRemove={
              cv
                ? () => {
                    setCv(null);
                    setDirty(true);
                  }
                : undefined
            }
            removeLabel={t("remove")}
          />
        </Section>

        <Section id="language" title={t("language.title")} sub={t("language.sub")}>
          <div role="radiogroup" aria-label={t("language.title")} className="flex flex-col gap-2">
            {(["en", "ar", "both"] as const).map((l) => {
              const on = language === l;
              const soon = l === "both";
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={soon}
                  onClick={() => {
                    if (soon) return;
                    setLanguage(l);
                    setDirty(true);
                  }}
                  className={cx(
                    "flex flex-col items-start gap-0.5 rounded-[10px] border-2 px-3 py-2.5 text-start disabled:opacity-60",
                    on ? "border-ink bg-mist" : "border-line bg-paper",
                  )}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    {t(`language.${l}`)}
                    {soon && <Badge variant="neutral">{t("soon")}</Badge>}
                  </span>
                  <span className="text-muted text-[12px]">{t(`language.${l}Hint`)}</span>
                </button>
              );
            })}
          </div>
          <p className="text-muted text-[12px]">{t("appliesOnPublish")}</p>

          <h3 className="font-heading font-heading-weight mt-2 text-[18px]">{t("seo.title")}</h3>
          <Input
            label={t("seo.siteTitle")}
            maxLength={120}
            placeholder={data.defaults.title}
            value={s.seo.title}
            onChange={(e) => update("seo", { ...s.seo, title: e.target.value })}
          />
          <Input
            label={t("seo.description")}
            maxLength={300}
            placeholder={data.defaults.description || t("seo.descriptionPlaceholder")}
            value={s.seo.description}
            onChange={(e) => update("seo", { ...s.seo, description: e.target.value })}
          />
          <div className="flex flex-wrap items-start gap-4">
            <ImagePick
              label={t("seo.shareImage")}
              hint={t("seo.shareImageHint")}
              img={shareImage}
              wide
              fallback={s.seo.title || data.defaults.title}
              button={shareImage ? t("replace") : t("upload")}
              removeLabel={t("remove")}
              onFile={async (f) => {
                const r = await upload(f, "image");
                if (r) setShareImage({ id: r.id, src: r.src });
              }}
              onRemove={() => {
                setShareImage(null);
                setDirty(true);
              }}
            />
            <ImagePick
              label={t("seo.favicon")}
              hint={t("seo.faviconHint")}
              img={favicon}
              fallback={(data.defaults.title || data.username).slice(0, 1).toUpperCase()}
              button={favicon ? t("replace") : t("upload")}
              removeLabel={t("remove")}
              onFile={async (f) => {
                const r = await upload(f, "image");
                if (r) setFavicon({ id: r.id, src: r.src });
              }}
              onRemove={() => {
                setFavicon(null);
                setDirty(true);
              }}
            />
          </div>
        </Section>

        <Section id="integrations" title={t("integrations.title")}>
          <Input
            label={t("integrations.ga")}
            dir="ltr"
            placeholder="G-XXXXXXXXXX"
            value={s.integrations.gaId}
            error={gaBad ? t("integrations.gaError") : undefined}
            onChange={(e) => update("integrations", { ...s.integrations, gaId: e.target.value })}
          />
          <Input
            label={t("integrations.pixel")}
            dir="ltr"
            inputMode="numeric"
            placeholder={t("optional")}
            value={s.integrations.pixelId}
            error={pixelBad ? t("integrations.pixelError") : undefined}
            onChange={(e) => update("integrations", { ...s.integrations, pixelId: e.target.value })}
          />
          <Input
            label={`${t("integrations.code")} (Pro)`}
            placeholder={data.pro ? t("soon") : "<script>…"}
            disabled
            hint={t("integrations.codeHint")}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled className={cx(buttonClasses("outline", "md"), "opacity-60")}>
              {t("integrations.artstation")} · {t("soon")}
            </button>
            <button type="button" disabled className={cx(buttonClasses("outline", "md"), "opacity-60")}>
              {t("integrations.behance")} · {t("soon")}
            </button>
            <a href="/api/export" download className={buttonClasses("outline", "md")} data-testid="export">
              <Icon name="upload" size={18} className="rotate-180" />
              {t("integrations.export")}
            </a>
          </div>
          <p className="text-muted text-[12px]">{t("integrations.exportHint")}</p>
        </Section>

        <Section id="plan" title={t("plan.title")} wide>
          <p className="text-[14px] font-semibold" data-testid="plan-status">
            {data.billing.gift && data.billing.proUntil === null
              ? t("plan.statusGift")
              : data.billing.proUntil !== null && data.pro
                ? data.billing.inGrace
                  ? t("plan.statusGrace", { date: format.dateTime(new Date(data.billing.proUntil), { dateStyle: "long" }) })
                  : t("plan.statusPro", { date: format.dateTime(new Date(data.billing.proUntil), { dateStyle: "long" }) })
                : t("plan.statusFree")}
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3.5">
            <div className={cx("flex flex-col gap-2 rounded-[14px] border-2 p-4", data.pro ? "border-line" : "border-ink")}>
              <span className="flex items-center justify-between">
                <span className="font-heading font-heading-weight text-[22px]">{t("plan.free")}</span>
                {!data.pro && <Badge variant="brand">{t("plan.current")}</Badge>}
              </span>
              <span className="text-ink-soft text-[13px]">{t("plan.freeBlurb")}</span>
            </div>
            {data.plans.map((p) => (
              <div key={p.months} className="border-line flex flex-col gap-2 rounded-[14px] border-2 p-4">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-heading font-heading-weight text-[20px]">{t("plan.pro", { months: p.months })}</span>
                  <Badge variant="neutral">{t(`plan.tags.${p.months}`)}</Badge>
                </span>
                <span>
                  <span className="font-heading font-heading-weight text-[26px]">{p.price}</span>
                  <span className="text-muted text-[13px]"> · {t("plan.perMonth", { price: p.perMonth })}</span>
                </span>
                <span className="text-ink-soft text-[13px]">{t("plan.once")}</span>
                {data.billing.canBuy ? (
                  <a href={`/upgrade?months=${p.months}`} className={cx(buttonClasses("outline", "md"), "mt-auto")}>
                    {data.pro ? t("plan.addMonths", { months: p.months }) : t("plan.get", { months: p.months })}
                  </a>
                ) : (
                  <button type="button" disabled className={cx(buttonClasses("outline", "md"), "mt-auto opacity-60")}>
                    {t("plan.soon")}
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-muted text-[12px]">{t("plan.note")}</p>
          {data.billing.orders.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-[14px] font-semibold">{t("plan.history")}</h3>
              <ul className="divide-line divide-y text-[13px]" data-testid="payments">
                {data.billing.orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                    <span>
                      {format.dateTime(new Date(o.date), { dateStyle: "medium" })} · {t("plan.pro", { months: o.months })}
                      {o.gift && ` · ${t("plan.gift")}`}
                    </span>
                    <span className="text-muted">
                      {o.amount} · {t(`plan.orderStatus.${o.status}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <AccountSection data={data} />
      </div>

      <div
        className={cx(
          "border-line bg-paper shadow-float sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-lg border p-3 ps-4 transition-opacity",
          dirty ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!dirty}
      >
        <span className="text-[14px] font-medium">{t("unsaved")}</span>
        <Button onClick={save} disabled={saving || !dirty}>
          <Icon name="publish" size={18} className="rtl:-scale-x-100" />
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}

/* ---------- sections with their own buttons ---------- */

function DomainSection({ data }: { data: SettingsData }) {
  const t = useTranslations("settings");
  const tu = useTranslations("usernameProblems");
  const toast = useToast();
  const [name, setName] = useState(data.username);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [mode, setMode] = useState<"fannan" | "custom">(data.ownDomain ? "custom" : "fannan");
  return (
    <Section id="domain" title={t("domain.title")} sub={t("domain.sub")}>
      <div role="radiogroup" aria-label={t("domain.type")} className="flex gap-2">
        {(["fannan", "custom"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={cx(
              "flex h-10 items-center gap-2 rounded-[10px] border-2 px-3.5 text-[14px] font-semibold",
              mode === m ? "border-ink bg-mist" : "border-line bg-paper",
            )}
          >
            {t(`domain.${m}`)}
            {m === "custom" && <Badge variant="pro">Pro</Badge>}
          </button>
        ))}
      </div>
      {mode === "fannan" ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (name.trim().toLowerCase() === data.username) return;
            if (!window.confirm(t("domain.confirm", { old: `${data.username}.${data.domain}` }))) return;
            setBusy(true);
            setProblem(null);
            const r = await renameSite(name);
            setBusy(false);
            if (!r.ok) {
              if (r.error === "slow-down") return setProblem(t("slowDown"));
              return setProblem(tu.has(r.error) ? tu(r.error as "taken") : t("error"));
            }
            toast(t("domain.changed"), "check");
            window.location.reload();
          }}
        >
          <Input
            label={t("domain.address")}
            dir="ltr"
            suffix={`.${data.domain}`}
            value={name}
            autoCapitalize="none"
            spellCheck={false}
            maxLength={30}
            error={problem ?? undefined}
            hint={t("domain.hint")}
            onChange={(e) => setName(e.target.value.toLowerCase())}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="outline" disabled={busy || name.trim().toLowerCase() === data.username}>
              {busy ? t("saving") : t("domain.change")}
            </Button>
            <a href={data.siteUrl} className="text-ink-soft text-[13px] font-semibold underline-offset-2 hover:underline">
              {t("domain.open")}
            </a>
          </div>
          <p className="text-muted text-[12px]">{t("domain.redirect")}</p>
        </form>
      ) : (
        <OwnDomain data={data} />
      )}
    </Section>
  );
}

const DOMAIN_STATUS: Record<DomainInfo["status"], { dot: string; key: string }> = {
  pending: { dot: "bg-line-strong", key: "pending" },
  issuing: { dot: "bg-ink-soft", key: "issuing" },
  active: { dot: "bg-lime", key: "active" },
  failed: { dot: "bg-ink", key: "failed" },
};

function OwnDomain({ data }: { data: SettingsData }) {
  const t = useTranslations("settings.ownDomain");
  const ts = useTranslations("settings");
  const toast = useToast();
  const [domain, setDomain] = useState(data.ownDomain);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // Status updates live while Cloudflare checks the DNS and issues the certificate.
  useEffect(() => {
    if (!domain || domain.status === "active") return;
    const timer = setInterval(async () => {
      const r = await checkOwnDomain();
      if (r.ok && r.domain) setDomain(r.domain);
    }, 8000);
    return () => clearInterval(timer);
  }, [domain]);

  if (!data.canDomain) {
    return (
      <div className="bg-mist text-ink-soft flex flex-col items-start gap-2 rounded-[10px] p-3 text-[13px]">
        <span className="text-ink font-semibold">{ts("domain.customTitle")}</span>
        <span>{t("proOnly")}</span>
        <a href="/upgrade" className={buttonClasses("lime", "sm")}>
          {t("getPro")}
        </a>
      </div>
    );
  }

  if (!domain) {
    return (
      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await connectOwnDomain(input);
          setBusy(false);
          if (!r.ok) return toast(t.has(`errors.${r.error}`) ? t(`errors.${r.error}`) : ts("error"));
          setDomain(r.domain);
        }}
      >
        <Input
          label={t("label")}
          dir="ltr"
          placeholder="yourname.com"
          autoCapitalize="none"
          spellCheck={false}
          value={input}
          hint={t("hint")}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" variant="outline" disabled={busy || !input.includes(".")} className="self-start">
          {busy ? ts("saving") : t("connect")}
        </Button>
      </form>
    );
  }

  const st = DOMAIN_STATUS[domain.status];
  return (
    <div className="flex flex-col gap-3" data-testid="own-domain">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span dir="ltr" className="text-[16px] font-semibold">
          {domain.hostname}
        </span>
        <span className="flex items-center gap-2 text-[13px] font-semibold" data-testid="domain-status" data-status={domain.status}>
          <span aria-hidden className={cx("size-2 rounded-full", st.dot)} />
          {t(`status.${st.key}`)}
        </span>
      </div>
      {domain.status !== "active" && (
        <ol className="bg-mist flex list-none flex-col gap-3 rounded-[10px] p-3 text-[13px]" data-testid="domain-steps">
          <li className="flex flex-col gap-1">
            <span className="text-ink font-semibold">1. {t("step1", { apex: domain.apex })}</span>
          </li>
          <li className="flex flex-col gap-2">
            <span className="text-ink font-semibold">2. {t("step2")}</span>
            <div className="bg-paper overflow-x-auto rounded-[8px] p-2">
              <table className="w-full text-start text-[12px]" dir="ltr">
                <thead className="text-muted">
                  <tr>
                    <th className="pe-3 text-start font-semibold">{t("type")}</th>
                    <th className="pe-3 text-start font-semibold">{t("name")}</th>
                    <th className="text-start font-semibold">{t("value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {domain.records.map((r) => (
                    <tr key={`${r.type}${r.name}`} className="align-top">
                      <td className="pe-3 py-1 font-semibold">{r.type}</td>
                      <td className="pe-3 py-1 font-semibold break-all">{r.host}</td>
                      <td className="py-1 break-all">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <span className="text-ink-soft">{t("step2Note", { apex: domain.apex })}</span>
          </li>
          {domain.forwardApex && (
            <li className="flex flex-col gap-1">
              <span className="text-ink font-semibold">3. {t("step3", { apex: domain.apex, hostname: domain.hostname })}</span>
              <span className="text-ink-soft">{t("step3Note")}</span>
            </li>
          )}
          <li className="text-ink-soft">{t("wait")}</li>
          {domain.error && <li className="text-ink font-semibold">{domain.error}</li>}
        </ol>
      )}
      {domain.status === "active" && <p className="text-ink-soft text-[13px]">{t("activeText", { address: `${data.username}.${data.domain}` })}</p>}
      <div className="flex flex-wrap gap-2">
        {domain.status !== "active" && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await checkOwnDomain();
              setBusy(false);
              if (r.ok && r.domain) setDomain(r.domain);
            }}
          >
            {t("checkNow")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm(t("removeConfirm", { domain: domain.hostname }))) return;
            setBusy(true);
            const r = await removeOwnDomain();
            setBusy(false);
            if (!r.ok) return toast(ts("error"));
            setDomain(null);
          }}
        >
          {t("remove")}
        </Button>
      </div>
    </div>
  );
}

function SitePassword({ data, on, onChange }: { data: SettingsData; on: boolean; onChange: (v: boolean) => void }) {
  const t = useTranslations("settings");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const set = async (value: string) => {
    setBusy(true);
    const r = await saveSitePassword(value);
    setBusy(false);
    if (!r.ok) return toast(r.error === "pro-only" ? t("privacy.proOnly") : t("error"));
    onChange(!!value);
    setOpen(false);
    setPw("");
    toast(value ? t("privacy.passwordOn") : t("privacy.passwordOff"), "check");
  };
  return (
    <>
      <Row
        title={
          <span className="flex items-center gap-2">
            {t("privacy.password")}
            {!data.canPassword && <Badge variant="pro">Pro</Badge>}
          </span>
        }
        hint={data.canPassword ? t("privacy.passwordHint") : t("privacy.proOnly")}
      >
        <Toggle
          hideLabel
          label={t("privacy.password")}
          checked={on || open}
          disabled={!data.canPassword || busy}
          onChange={(v) => (v ? setOpen(true) : on ? set("") : setOpen(false))}
        />
      </Row>
      {(open || on) && data.canPassword && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw.length >= 4) void set(pw);
          }}
        >
          <div className="flex-1">
            <Input
              label={on ? t("privacy.newPassword") : t("privacy.sitePassword")}
              type="text"
              autoComplete="off"
              minLength={4}
              maxLength={200}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={busy || pw.length < 4}>
            {t("privacy.setPassword")}
          </Button>
        </form>
      )}
    </>
  );
}

function AccountSection({ data }: { data: SettingsData }) {
  const t = useTranslations("settings");
  const toast = useToast();
  const getAuth = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  return (
    <Section id="account" title={t("account.title")} wide>
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const r = await changeEmail(email);
            setBusy(false);
            if (!r.ok) {
              const k = `account.emailErrors.${r.error}`;
              return toast(t.has(k) ? t(k) : t("error"));
            }
            setSent(email);
            setEmail("");
          }}
        >
          <span className="text-[14px] font-semibold">{t("account.email")}</span>
          <span dir="ltr" className="text-muted text-start text-[13px] rtl:text-end" data-testid="account-email">
            {data.email || "–"}
          </span>
          {data.anonymous ? (
            <a href="/signup" className={cx(buttonClasses("lime", "md"), "self-start")}>
              {t("account.saveFirst")}
            </a>
          ) : (
            <>
              <Input
                label={t("account.newEmail")}
                type="email"
                dir="ltr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" variant="outline" disabled={busy || !email.includes("@")} className="self-start">
                {t("account.changeEmail")}
              </Button>
              {sent && (
                <p role="status" className="bg-mist rounded-[10px] p-3 text-[13px]">
                  {t("account.emailSent", { email: sent })}
                </p>
              )}
            </>
          )}
        </form>
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setDeleting(true);
            const r = await deleteAccount(confirm);
            if (!r.ok) {
              setDeleting(false);
              return toast(r.error === "invalid" ? t("account.typeName") : t("error"));
            }
            await signOut(getAuth()).catch(() => {});
            await endServerSession();
            window.location.href = "/login?deleted=1";
          }}
        >
          <span className="text-[14px] font-semibold">{t("account.delete")}</span>
          <span className="text-ink-soft text-[13px]">{t("account.deleteText")}</span>
          <Input
            label={t("account.deleteConfirm", { name: data.username })}
            dir="ltr"
            autoCapitalize="none"
            spellCheck={false}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={deleting || confirm.trim().toLowerCase() !== data.username || !!data.deletionAt}
            className="self-start"
          >
            <Icon name="delete" size={18} />
            {t("account.deleteButton")}
          </Button>
        </form>
      </div>
    </Section>
  );
}

function DeletionBanner({ at }: { at: number }) {
  const t = useTranslations("settings");
  const toast = useToast();
  const format = useFormatter();
  const [busy, setBusy] = useState(false);
  return (
    <div role="alert" className="bg-lime flex flex-wrap items-center justify-between gap-3 rounded-lg p-4">
      <span className="flex flex-col">
        <span className="font-heading font-heading-weight text-[18px]">{t("account.pendingTitle")}</span>
        <span className="text-[14px]">{t("account.pendingText", { date: format.dateTime(new Date(at), { dateStyle: "long" }) })}</span>
      </span>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await undoDeleteAccount();
          if (!r.ok) {
            setBusy(false);
            return toast(t("error"));
          }
          window.location.reload();
        }}
      >
        {t("account.cancelDelete")}
      </Button>
    </div>
  );
}

/* ---------- file pickers ---------- */

function FilePick({
  label,
  hint,
  accept,
  current,
  button,
  onFile,
  onRemove,
  removeLabel,
}: {
  label: string;
  hint: string;
  accept: string;
  current: string | null;
  button: string;
  onFile: (f: File) => Promise<void>;
  onRemove?: () => void;
  removeLabel: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-ink-soft text-[12px] font-semibold">{label}</span>
      {current && (
        <span className="flex items-center gap-2 text-[13px] font-medium">
          <Icon name="pdf" size={18} />
          <span className="truncate">{current}</span>
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className={buttonClasses("outline", "sm")}
        >
          <Icon name="upload" size={16} />
          {busy ? "…" : button}
        </button>
        {onRemove && (
          <button type="button" onClick={onRemove} className={buttonClasses("ghost", "sm")}>
            {removeLabel}
          </button>
        )}
      </div>
      <span className="text-muted text-[12px]">{hint}</span>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        aria-label={label}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          await onFile(f);
          setBusy(false);
        }}
      />
    </div>
  );
}

function ImagePick({
  label,
  hint,
  img,
  fallback,
  wide,
  button,
  removeLabel,
  onFile,
  onRemove,
}: {
  label: string;
  hint: string;
  img: { src: string } | null;
  fallback: string;
  wide?: boolean;
  button: string;
  removeLabel: string;
  onFile: (f: File) => Promise<void>;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className={cx("flex flex-col gap-1.5", wide ? "min-w-[180px] flex-1" : "flex-none")}>
      <span className="text-ink-soft text-[12px] font-semibold">{label}</span>
      <div
        className={cx(
          "font-heading font-heading-weight flex overflow-hidden",
          wide
            ? "bg-ink aspect-[1200/630] items-end rounded-[10px] p-2.5 text-[16px] text-white"
            : "bg-lime size-16 items-center justify-center rounded-[14px] text-[30px]",
        )}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="truncate">{fallback}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className={buttonClasses("outline", "sm")}>
          {busy ? "…" : button}
        </button>
        {img && (
          <button type="button" onClick={onRemove} className={buttonClasses("ghost", "sm")}>
            {removeLabel}
          </button>
        )}
      </div>
      <span className="text-muted max-w-[220px] text-[12px]">{hint}</span>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        aria-label={label}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          await onFile(f);
          setBusy(false);
        }}
      />
    </div>
  );
}
