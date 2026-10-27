// The link page (round 9, like Linktree): a column of buttons with a photo, name and bio.
// Pure helpers, safe in the browser and on the server.

import type { Locale } from "@/i18n/locales";
import { parseVideoLink } from "@/lib/video";
import { newId } from "./ids";
import { sectionStyle } from "./style";
import type { Block, LinkItem } from "./types";

export function linkItem(extra: Partial<LinkItem> = {}): LinkItem {
  return {
    id: newId(),
    kind: "link",
    title: "",
    url: "",
    mediaId: null,
    icon: "",
    hidden: false,
    highlight: "none",
    from: "",
    until: "",
    ...extra,
  };
}

const WORDS = {
  en: {
    bio: "Animator and illustrator. Here's everything in one place.",
    portfolio: "My portfolio",
    reel: "Watch my showreel",
    shop: "Prints shop",
    contact: "Work with me",
    social: "Find me online",
  },
  ar: {
    bio: "رسّام ومحرّك. كل روابطي في مكان واحد.",
    portfolio: "معرض أعمالي",
    reel: "شاهد الشوريل",
    shop: "متجر المطبوعات",
    contact: "اشتغل معي",
    social: "تابعني",
  },
};

export function linksBlock(l: Locale, name = ""): Extract<Block, { type: "links" }> {
  const w = WORDS[l];
  return {
    id: newId(),
    type: "links",
    photoId: null,
    name,
    bio: w.bio,
    social: true,
    items: [
      linkItem({ title: w.portfolio, url: "/", icon: "website" }),
      linkItem({ title: w.reel, url: "", icon: "youtube" }),
      linkItem({ title: w.shop, url: "", icon: "sparkle" }),
      linkItem({ title: w.contact, url: "/contact", icon: "email" }),
    ],
    button: { style: "fill", shape: "pill", color: null, textColor: null },
    share: true,
    style: sectionStyle({
      bg: { kind: "gradient", color: "#FFF4D6", color2: "#F6D9C4", angle: 180 },
      padTop: 56,
      padBottom: 56,
    }),
  };
}

/** A social network's mark for a link, guessed from its address. */
export function networkOf(url: string): string {
  if (/^mailto:/i.test(url)) return "email";
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\.|^m\./, "");
  } catch {
    return "";
  }
  const known: Array<[RegExp, string]> = [
    [/(^|\.)instagram\.com$/, "instagram"],
    [/(^|\.)behance\.net$/, "behance"],
    [/(^|\.)artstation\.com$/, "artstation"],
    [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
    [/(^|\.)vimeo\.com$/, "vimeo"],
    [/(^|\.)(x\.com|twitter\.com)$/, "x"],
    [/(^|\.)tiktok\.com$/, "tiktok"],
    [/(^|\.)(facebook\.com|fb\.com)$/, "facebook"],
    [/(^|\.)linkedin\.com$/, "linkedin"],
  ];
  return known.find(([re]) => re.test(host))?.[1] ?? "website";
}

/** The player address for an embedded link: YouTube, Vimeo, Spotify or SoundCloud. */
export function embedSrc(raw: string): { src: string; height: number } | null {
  const v = parseVideoLink(raw);
  if (v)
    return {
      src:
        v.provider === "youtube"
          ? `https://www.youtube-nocookie.com/embed/${v.id}?rel=0`
          : `https://player.vimeo.com/video/${v.id}${v.hash ? `?h=${v.hash}` : ""}`,
      height: 0,
    };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host === "open.spotify.com") {
    const m = url.pathname.match(
      /^\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]{10,40})/,
    );
    return m
      ? {
          src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`,
          height: m[1] === "track" || m[1] === "episode" ? 152 : 352,
        }
      : null;
  }
  if (host === "soundcloud.com")
    return {
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}&color=%23141414&visual=false`,
      height: 166,
    };
  return null;
}

/** Scheduled links show only between their dates (inclusive). Dates are YYYY-MM-DD. */
export function linkShowsOn(item: LinkItem, today: string): boolean {
  if (item.from && today < item.from) return false;
  if (item.until && today > item.until) return false;
  return true;
}

export const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);
