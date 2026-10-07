import type { CSSProperties } from "react";
import { dirFor } from "@/i18n/locales";
import type { Block, SampleArt, SiteDraft } from "@/lib/site/types";

// Renders an artist site from its draft. Artist sites use the artist's theme, never Fannan's brand.
// This is the seed of the public renderer (phase 4); the sign-up preview and the dashboard use it
// at small scale through <ScaledSite>.

const headingFamily = {
  grotesk: "var(--font-bricolage), system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  sans: "var(--font-plex), var(--font-plex-arabic), system-ui, sans-serif",
};
const bodyFamily = {
  sans: "var(--font-plex), var(--font-plex-arabic), system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', var(--font-plex-arabic), serif",
};

function withBlankArt(site: SiteDraft, tone: string): SiteDraft {
  const paint = (b: Block): Block => {
    switch (b.type) {
      case "reel":
      case "hero-image":
        return { ...b, art: { ...b.art, tone } };
      case "grid":
      case "case-studies":
        return { ...b, items: b.items.map((it) => ({ ...it, art: { ...it.art, tone } })) } as Block;
      default:
        return b;
    }
  };
  return { ...site, pages: site.pages.map((p) => ({ ...p, blocks: p.blocks.map(paint) })) };
}

function Art({ art, radius, label }: { art: SampleArt; radius: number; label?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{ aspectRatio: art.ratio, background: art.tone, borderRadius: radius, width: "100%" }}
    />
  );
}

function BlockView({ block, site }: { block: Block; site: SiteDraft }) {
  const { colors, radius } = site.theme;
  const heading: CSSProperties = {
    fontFamily: headingFamily[site.theme.fonts.heading],
    fontWeight: site.theme.fonts.heading === "serif" ? 600 : 800,
    letterSpacing: site.theme.fonts.heading === "grotesk" ? "-0.02em" : undefined,
    margin: 0,
  };
  switch (block.type) {
    case "reel":
      return (
        <section style={{ position: "relative" }}>
          <Art art={block.art} radius={radius} label={block.title} />
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              margin: "auto",
              width: 72,
              height: 72,
              borderRadius: "50%",
              border: `2px solid ${colors.text}`,
              opacity: 0.85,
            }}
          />
        </section>
      );
    case "hero-image":
      return <Art art={block.art} radius={radius} />;
    case "hero-headline":
      return <h2 style={{ ...heading, fontSize: 48, lineHeight: 1.1, maxWidth: 760 }}>{block.text}</h2>;
    case "grid": {
      const gap = { tight: 8, normal: 16, airy: 40 }[block.gap];
      return (
        <section style={{ display: "grid", gridTemplateColumns: `repeat(${block.columns}, minmax(0, 1fr))`, gap }}>
          {block.items.map((it, i) => (
            <Art key={i} art={it.art} radius={radius} label={it.title} />
          ))}
        </section>
      );
    }
    case "case-studies":
      return (
        <section style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {block.items.map((it, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 24, alignItems: "end" }}>
              <Art art={it.art} radius={radius} />
              <div>
                <h3 style={{ ...heading, fontSize: 28 }}>{it.title}</h3>
                <p style={{ color: colors.muted, margin: "6px 0 0" }}>{it.credit}</p>
              </div>
            </div>
          ))}
        </section>
      );
    case "about":
      return (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 32 }}>
          <h2 style={{ ...heading, fontSize: 28 }}>{block.heading}</h2>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6 }}>{block.text}</p>
        </section>
      );
    case "contact":
      return (
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 12,
            padding: 40,
            borderRadius: radius * 2,
            background: colors.surface,
          }}
        >
          <h2 style={{ ...heading, fontSize: 32 }}>{block.heading}</h2>
          <p style={{ margin: 0, color: colors.muted }}>{block.text}</p>
          <span
            style={{
              marginTop: 8,
              padding: "12px 20px",
              borderRadius: radius,
              background: colors.text,
              color: colors.background,
              fontWeight: 600,
            }}
          >
            {block.button}
          </span>
        </section>
      );
  }
}

export function SiteRender({
  site: input,
  available,
  blankArt,
}: {
  site: SiteDraft;
  available?: { label: string };
  /** Paint every sample artwork in this one colour (sign-up preview before the discipline is known). */
  blankArt?: string;
}) {
  const site = blankArt ? withBlankArt(input, blankArt) : input;
  const { colors, nav } = site.theme;
  const home = site.pages[0];
  const navLinks = site.pages.map((p) => p.title).join(" · ");
  const header: CSSProperties =
    nav === "center"
      ? { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }
      : { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 };

  return (
    <div
      dir={dirFor(site.language)}
      lang={site.language}
      style={{
        background: colors.background,
        color: colors.text,
        fontFamily: bodyFamily[site.theme.fonts.body],
        padding: site.layout === "minimalist" ? "56px 72px" : "40px 48px",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        gap: site.layout === "minimalist" ? 64 : 40,
        fontSize: 16,
        lineHeight: 1.5,
      }}
    >
      <header style={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontFamily: headingFamily[site.theme.fonts.heading],
              fontWeight: site.theme.fonts.heading === "serif" ? 600 : 800,
              fontSize: site.layout === "minimalist" ? 22 : 30,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            {site.title}
          </span>
          {site.tagline && <span style={{ color: colors.muted, fontSize: 15 }}>{site.tagline}</span>}
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 14, color: colors.muted, fontSize: 14 }}>
          {available && (
            <span
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                background: colors.text,
                color: colors.background,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {available.label}
            </span>
          )}
          {navLinks}
        </span>
      </header>
      {home.blocks.map((b) => (
        <BlockView key={b.id} block={b} site={site} />
      ))}
    </div>
  );
}
