import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { StagingBar } from "@/components/StagingBar";
import { ContactForm } from "@/components/site/live/ContactForm";
import { MatureGate } from "@/components/site/live/MatureGate";
import { PasswordForm } from "@/components/site/live/PasswordForm";
import { SiteEnhancer } from "@/components/site/live/SiteEnhancer";
import { networkName } from "@/lib/site/blocks";
import { contactFormOf } from "@/lib/site/contact";
import { SiteRender, type GalleryProject, type SiteMedia } from "@/components/site/SiteRender";
import type { Locale } from "@/i18n/locales";
import { imageSources, posterSources } from "@/lib/media";
import { surfaceOfRequest } from "@/lib/server/host";
import { surfaceUrls } from "@/lib/server/urls";
import { accessCookieName, checkAccessCookie, liveSite, mediaToken, type LiveSite } from "@/lib/server/public";
import { usernameRedirect } from "@/lib/server/settings";
import type { PublishedProject } from "@/lib/server/site";
import { TURNSTILE_SITE_KEY } from "@/lib/server/turnstile";
import type { SiteDraft } from "@/lib/site/types";
import { parseVideoLink, videoPoster } from "@/lib/video";
import { unlock } from "../actions";

// Public artist sites: {username}.fannan.net/{page-or-project}. Reads only the published snapshot.

type Params = { locale: Locale; username: string; path?: string[] };

function resolve(site: LiveSite, path: string[] | undefined) {
  if (path && path.length > 1) return null;
  const slug = path?.[0] ?? "";
  const page = site.pages.find((p) => p.slug === slug && p.type !== "link");
  if (page) return { kind: "page" as const, page, scope: page.id, hash: page.passwordHash };
  const project = slug ? site.projects.find((p) => p.slug === slug) : undefined;
  if (project)
    return {
      kind: "project" as const,
      project,
      scope: project.id,
      hash: project.visibility === "password" ? project.passwordHash : null,
    };
  return null;
}

const asDraft = (s: LiveSite): SiteDraft => ({
  language: s.language,
  title: s.title,
  tagline: s.tagline,
  theme: s.theme,
  header: s.header,
  footer: s.footer,
  pages: s.pages,
});

function galleryProjects(s: LiveSite): GalleryProject[] {
  return s.projects
    .filter((p) => p.visibility !== "hidden")
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      title: projectText(s, p).title,
      category: p.category,
      client: p.client,
      role: projectText(s, p).role,
      visibility: p.visibility,
      coverId: p.visibility === "password" ? null : p.coverId,
      mature: p.mature,
    }));
}

function projectText(s: LiveSite, p: PublishedProject) {
  const ar = s.language === "ar" && p.arabic;
  return {
    title: (ar && p.ar.title) || p.title,
    role: (ar && p.ar.role) || p.role,
    description: (ar && p.ar.description) || p.description,
  };
}

function mediaFor(s: LiveSite, id: string | null | undefined, base: string, want = 1600) {
  const m = id ? s.media[id] : null;
  return m ? (posterSources(m, want, base) ?? imageSources(m, want, base)) : null;
}

/* ---------- metadata (title, description, Open Graph, favicon) ---------- */

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username, path } = await params;
  const site = await liveSite(username);
  if (!site) return { title: username, robots: { index: false } };
  const r = resolve(site, path);
  const { indexable } = site.settings.privacy;
  const sitePassword = !!site.sitePasswordHash;
  const { origin } = await surfaceOfRequest();
  const abs = (u: string | undefined | null) => (u ? new URL(u, origin).toString() : undefined);
  const firstCover = site.projects.find((p) => p.visibility === "public" && p.coverId)?.coverId;
  const favicon = mediaFor(site, site.theme.faviconMediaId, "/m/", 400)?.src;
  const base: Metadata = {
    metadataBase: new URL(origin),
    icons: { icon: favicon ?? "data:," },
    alternates: { canonical: abs(`/${path?.join("/") ?? ""}`) },
  };
  if (!r) return { ...base, title: site.title, robots: { index: false } };
  const locked = !!r.hash || sitePassword;
  if (r.kind === "project") {
    const p = r.project;
    const text = projectText(site, p);
    const title = p.seo.title || `${text.title} · ${site.title}`;
    const description = p.seo.description || text.description.slice(0, 200) || site.tagline;
    const image = locked ? undefined : abs(mediaFor(site, p.coverId, "/m/")?.src);
    return {
      ...base,
      title: { absolute: title },
      description,
      robots: { index: indexable && !locked && p.visibility === "public" },
      openGraph: { title, description, type: "article", images: image ? [image] : undefined },
      twitter: { card: image ? "summary_large_image" : "summary" },
    };
  }
  const seo = site.settings.seo;
  const title = r.page.slug
    ? `${r.page.title} · ${seo.title || site.title}`
    : seo.title || `${site.title}${site.tagline ? ` · ${site.tagline}` : ""}`;
  const description = seo.description || site.tagline || site.title;
  const image = locked
    ? undefined
    : abs(mediaFor(site, seo.shareImageId ?? firstCover ?? site.theme.logoMediaId, "/m/")?.src);
  return {
    ...base,
    title: { absolute: title },
    description,
    robots: { index: indexable && !locked },
    openGraph: { title, description, type: "profile", images: image ? [image] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary" },
  };
}

/* ---------- pieces ---------- */

async function PasswordScreen({ username, scope }: { username: string; scope: string }) {
  const t = await getTranslations("site.password");
  return (
    <PasswordForm
      username={username}
      scope={scope}
      unlock={unlock}
      labels={{ title: t("title"), text: t("text"), label: t("label"), open: t("open"), wrong: t("wrong") }}
    />
  );
}

async function ProjectView({ site, project, base }: { site: LiveSite; project: PublishedProject; base: string }) {
  const t = await getTranslations("site.project");
  const tm = await getTranslations("site.mature");
  const tp = await getTranslations("projects");
  const text = projectText(site, project);
  const credits: Array<[string, string]> = [
    [t("role"), text.role],
    [t("client"), project.client],
    [t("studio"), project.studio],
    [t("year"), project.year],
    [t("team"), project.team],
  ].filter(([, v]) => v) as Array<[string, string]>;

  const items = project.mediaIds
    .map(
      (id) =>
        site.media[id] as
          | (SiteMedia & {
              display?: { fullWidth: boolean; lightbox: boolean; autoplay: boolean };
              text?: string;
              original?: string | null;
            })
          | undefined,
    )
    .filter(Boolean);
  const full = { marginInline: "calc(var(--site-pad) * -1)" };
  const mediaList: ReactNode = (
    <div className="flex flex-col gap-6">
      {items.map((m) => {
        if (!m) return null;
        const style = m.display?.fullWidth ? full : undefined;
        if (m.type === "text") {
          return (
            <div key={m.id} className="max-w-[760px] text-[18px] leading-[1.6] whitespace-pre-line">
              {m.text}
            </div>
          );
        }
        if (m.type === "embed") {
          const v = parseVideoLink(m.embed?.url ?? "");
          const poster = m.embed?.poster ?? videoPoster(v);
          return (
            <figure key={m.id} className="m-0 flex flex-col gap-2" style={style}>
              <div
                className="relative overflow-hidden"
                data-video={m.embed?.url}
                style={{ aspectRatio: "16 / 9", background: "#141414", borderRadius: "var(--site-radius)" }}
              >
                {poster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={poster}
                    alt={m.embed?.title ?? ""}
                    loading="lazy"
                    className="block h-full w-full object-cover"
                  />
                )}
                <span
                  aria-hidden
                  className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full"
                  style={{ background: "rgba(20,20,20,.55)" }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFFFFF">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </div>
              {m.caption && <figcaption style={{ color: "var(--site-muted)" }}>{m.caption}</figcaption>}
            </figure>
          );
        }
        if (m.type === "loop" && m.loop) {
          return (
            <figure key={m.id} className="m-0 flex flex-col gap-2" style={style}>
              <video
                src={`${base}${m.loop}`}
                poster={imageSources(m, 1600, base)?.src}
                muted
                loop
                playsInline
                autoPlay={m.display?.autoplay !== false}
                controls={m.display?.autoplay === false}
                className="block w-full"
                style={{ borderRadius: "var(--site-radius)" }}
              />
              {m.caption && <figcaption style={{ color: "var(--site-muted)" }}>{m.caption}</figcaption>}
            </figure>
          );
        }
        if (m.type === "pdf") {
          const cover = imageSources(m, 800, base);
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-5">
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover.src}
                  alt=""
                  className="w-[200px]"
                  style={{ border: "1px solid var(--site-line)", borderRadius: "var(--site-radius)" }}
                />
              )}
              <div className="flex flex-col gap-2">
                <span className="font-semibold">{m.caption || m.alt || "PDF"}</span>
                {m.pages ? <span style={{ color: "var(--site-muted)" }}>{t("pages", { count: m.pages })}</span> : null}
                <a
                  href={`${base.replace(/\/$/, "")}/pdf/${site.siteId}/${m.id}`}
                  className="site-button self-start"
                  style={{ textDecoration: "none" }}
                >
                  {t("download")}
                </a>
              </div>
            </div>
          );
        }
        const src = imageSources(m, 2560, base);
        if (!src) return null;
        return (
          <figure
            key={m.id}
            className="m-0 flex flex-col gap-2"
            style={style}
            data-lightbox={m.display?.lightbox !== false ? src.src : undefined}
            data-lightbox-caption={m.caption || m.alt || undefined}
          >
            <picture
              className="block overflow-hidden"
              style={{ borderRadius: m.display?.fullWidth ? 0 : "var(--site-radius)" }}
            >
              {src.avifSet && (
                <source type="image/avif" srcSet={src.avifSet} sizes="(min-width: 1200px) 1200px, 100vw" />
              )}
              <img
                src={src.src}
                srcSet={src.srcSet}
                sizes="(min-width: 1200px) 1200px, 100vw"
                alt={m.alt ?? ""}
                width={m.width}
                height={m.height}
                loading="lazy"
                decoding="async"
                className="block h-auto w-full"
              />
            </picture>
            {m.caption && (
              <figcaption
                style={{ color: "var(--site-muted)", padding: m.display?.fullWidth ? "0 var(--site-pad)" : undefined }}
              >
                {m.caption}
              </figcaption>
            )}
          </figure>
        );
      })}
    </div>
  );

  return (
    <article className="flex flex-col gap-8">
      <a href="/" style={{ color: "var(--site-muted)", textDecoration: "none" }} className="text-[14px]">
        <span aria-hidden className="inline-block rtl:-scale-x-100">
          ←
        </span>{" "}
        {t("back")}
      </a>
      <header className="flex flex-col gap-4">
        <h1
          className="m-0 text-[48px] leading-[1.05] @max-2xl:text-[34px]"
          style={{ fontFamily: "var(--site-heading)", fontWeight: "var(--site-heading-weight)" as unknown as number }}
        >
          {text.title}
        </h1>
        {project.category && <span style={{ color: "var(--site-muted)" }}>{tp(`categories.${project.category}`)}</span>}
        {credits.length > 0 && (
          <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-8 gap-y-3">
            {credits.map(([k, v]) => (
              <div key={k} className="flex flex-col">
                <dt className="text-[13px]" style={{ color: "var(--site-muted)" }}>
                  {k}
                </dt>
                <dd className="m-0 font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {text.description && (
          <p className="m-0 max-w-[760px] text-[18px] leading-[1.6] whitespace-pre-line">{text.description}</p>
        )}
      </header>
      {project.mature ? (
        <MatureGate text={tm("text")} button={tm("view")}>
          {mediaList}
        </MatureGate>
      ) : (
        mediaList
      )}
    </article>
  );
}

function jsonLd(site: LiveSite, origin: string, project?: PublishedProject) {
  const person = {
    "@type": "Person",
    name: site.title,
    jobTitle: site.tagline || undefined,
    url: origin,
    sameAs: [
      ...new Set([
        ...site.settings.social.map((l) => l.url),
        ...site.pages.flatMap((p) =>
          p.blocks.flatMap((b) => (b.type === "social" ? b.links.map((l) => l.url).filter(Boolean) : [])),
        ),
      ]),
    ],
  };
  const data = project
    ? {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: projectText(site, project).title,
        creator: person,
        dateCreated: project.year || undefined,
        description: project.description || undefined,
        url: `${origin}/${project.slug}`,
      }
    : { "@context": "https://schema.org", ...person };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** The artist's own Google Analytics and Meta Pixel, when set in Settings (IDs validated on save). */
function Integrations({ ga, pixel }: { ga: string; pixel: string }) {
  return (
    <>
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}');`}
          </Script>
        </>
      )}
      {pixel && (
        <Script id="pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}

/** Social links and the CV from Settings. */
function footerLinks(site: LiveSite, cvLabel: string) {
  const links: Array<{ href: string; label: string; download?: boolean; kind: "social" | "cv" }> = site.settings.social.map(
    (l) => ({ href: l.url, label: networkName(l.network, l.url), kind: "social" }),
  );
  const cv = site.settings.cvMediaId;
  if (cv && site.media[cv]) links.push({ href: `/m/pdf/${site.siteId}/${cv}`, label: cvLabel, download: true, kind: "cv" });
  return links;
}

/* ---------- the page ---------- */

export default async function ArtistSite({ params }: { params: Promise<Params> }) {
  const { locale, username, path } = await params;
  setRequestLocale(locale);
  const site = await liveSite(username);
  const ts = await getTranslations("site");
  if (!site) {
    // A changed username keeps working for 30 days.
    const moved = await usernameRedirect(username);
    if (moved) {
      const { origin } = await surfaceOfRequest();
      const rest = `/${path?.join("/") ?? ""}`;
      const target = new URL(rest, origin);
      if (target.hostname.startsWith(`${username}.`)) {
        target.hostname = `${moved}${target.hostname.slice(username.length)}`;
        redirect(target.toString());
      }
      // Staging and local previews pick the site with the surface switcher instead of a subdomain.
      redirect(`/__surface?to=${encodeURIComponent(`site:${moved}`)}&next=${encodeURIComponent(rest)}`);
    }
    return (
      <>
        <StagingBar />
        <main className="mx-auto flex min-h-[80dvh] max-w-[720px] flex-col justify-center gap-3 px-6">
          <h1 dir="ltr" className="text-[40px] font-semibold tracking-tight">
            {username}
          </h1>
          <p className="text-muted">{ts("unpublishedText")}</p>
        </main>
      </>
    );
  }
  const r = resolve(site, path);
  if (!r) notFound();

  const { origin } = await surfaceOfRequest();
  const jar = await cookies();
  const pass = (scope: string) =>
    checkAccessCookie(jar.get(accessCookieName(scope))?.value, site.siteId, scope, site.version);
  // Whole-site password (Pro) first, then the page or project's own.
  const siteLocked = !!site.sitePasswordHash && !pass("site");
  const unlocked = !siteLocked && (!r.hash || pass(r.scope));
  const base =
    r.kind === "project" && r.hash
      ? `/m/t/${mediaToken(site.siteId, r.scope)}/`
      : site.sitePasswordHash
        ? `/m/t/${mediaToken(site.siteId, "site")}/`
        : "/m/";

  const contactPage = site.pages.find((p) => p.blocks.some((b) => b.type === "contact"));
  const contactHref =
    r.kind === "page" && r.page.blocks.some((b) => b.type === "contact")
      ? "#contact"
      : contactPage
        ? `/${contactPage.slug}#contact`
        : undefined;
  const credit = site.plan === "free" ? ts("credit") : null;

  let content: ReactNode | undefined;
  if (siteLocked) content = <PasswordScreen username={username} scope="site" />;
  else if (!unlocked) content = <PasswordScreen username={username} scope={r.scope} />;
  else if (r.kind === "project") content = <ProjectView site={site} project={r.project} base={base} />;

  // Visitors only download the text the site needs.
  const messages = (await getMessages()) as Record<string, unknown>;
  return (
    <NextIntlClientProvider locale={locale} messages={{ site: messages.site }}>
      <StagingBar />
      <SiteRender
        site={asDraft(site)}
        pageId={r.kind === "page" ? r.page.id : "__project"}
        media={site.media}
        projects={galleryProjects(site)}
        mediaBase={base}
        live
        content={content}
        credit={credit}
        footerLinks={footerLinks(site, ts("cv"))}
        report={{
          label: ts("report"),
          href: (await surfaceUrls()).marketing(
            `${site.language === "ar" ? "/ar" : ""}/report?site=${username}&url=${encodeURIComponent(`${origin}/${path?.join("/") ?? ""}`)}`,
          ),
        }}
        contactHref={contactHref}
        available={{ on: site.available.on, label: ts("available"), hire: ts("hireMe") }}
        contactFallback={site.settings.contact}
        renderContact={(b) => (
          <ContactForm button={b.button} turnstileKey={TURNSTILE_SITE_KEY} form={contactFormOf(b, site.settings.contact)} />
        )}
      />
      <SiteEnhancer protectImages={site.settings.privacy.protectImages} closeLabel={ts("close")} />
      <Integrations ga={site.settings.integrations.gaId} pixel={site.settings.integrations.pixelId} />
      {unlocked && jsonLd(site, origin, r.kind === "project" ? r.project : undefined)}
    </NextIntlClientProvider>
  );
}
