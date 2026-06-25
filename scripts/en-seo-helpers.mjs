/** SEO helpers for English pages targeting international visitors in Taiwan */

export const EN_SEO_KEYWORDS =
  "campervan rental Taiwan, rent campervan Taipei, Taiwan campervan, motorhome Taiwan, self-drive campervan Taipei, Taiwan road trip, campervan delivery Taipei, RV rental Taiwan, Joyforest";

export const TAIWAN_TAIPEI_RE = /\btaiwan\b|\btaipei\b/i;

export const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Add Taiwan to title when missing */
export const enhanceEnTitle = (title) => {
  const t = (title || "").trim();
  if (!t || TAIWAN_TAIPEI_RE.test(t)) return t;
  return `${t}｜Taiwan`;
};

/** Add Taipei/Taiwan context to meta description when missing */
export const enhanceEnDescription = (description, maxLen = 160) => {
  const d = (description || "").trim();
  if (!d || TAIWAN_TAIPEI_RE.test(d)) return d;
  const suffix = " Campervan rental in Taipei, Taiwan.";
  const room = maxLen - suffix.length;
  let base = d;
  if (base.length > room) base = base.slice(0, room).trimEnd() + "…";
  return base + suffix;
};

export const keywordsMetaHtml = (keywords = EN_SEO_KEYWORDS) =>
  `    <meta name="keywords" content="${escapeHtml(keywords)}" />`;

/** Curated overrides for high-traffic English pages */
export const EN_PAGE_SEO_OVERRIDES = {
  "index.html": {
    title: "Taiwan Campervan Rental Taipei｜Delivered to Your Door・Wake by the Sea｜Joyforest",
    description:
      "Rent a self-drive campervan in Taiwan—delivered in Taipei with Taoyuan and Hsinchu on request. Two double beds, A/C, fridge and bathroom for families and friends. Wake by the sea, outdoor movies, and slow North Coast trips.",
    keywords:
      "campervan rental Taiwan, rent campervan Taipei, Taiwan motorhome rental, campervan Taiwan, Taipei campervan delivery, Taiwan road trip campervan, self-drive RV Taiwan, Joyforest"
  },
  "booking.html": {
    title: "Book a Campervan in Taiwan｜Taipei Delivery｜Joyforest",
    description:
      "Book Joyforest campervan rental in Taiwan: share dates, group size, delivery in Taipei (Taoyuan and Hsinchu on request), and your route. We confirm availability, pricing, and handover.",
    keywords:
      "book campervan Taiwan, campervan rental Taipei, reserve motorhome Taiwan, Taiwan campervan booking, Taipei delivery campervan, Joyforest"
  },
  "404.html": {
    title: "Page not found｜Joyforest Campervan Rental Taiwan",
    description: "This page could not be found. Return to Joyforest campervan rental in Taipei, Taiwan.",
    keywords: EN_SEO_KEYWORDS
  },
  "blog/index.html": {
    title: "Taiwan Campervan Tips & Travel Notes｜Joyforest",
    description:
      "Campervan travel tips, Taiwan road-trip notes, and rental how-tos from Joyforest—based in Taipei with delivery across northern Taiwan.",
    keywords:
      "Taiwan campervan blog, Taipei campervan tips, Taiwan van life, campervan travel Taiwan, Joyforest"
  },
  "pages/campervan.html": {
    title: "Taiwan Campervan Rental Prices & Van Details｜Taipei｜Joyforest",
    description:
      "Joyforest campervan rental in Taiwan: 3-day/2-night rates, weekday and holiday pricing, NT$5,000 deposit, van specs, glamping bundles, and doorstep delivery in Taipei, Taoyuan, and Hsinchu.",
    keywords:
      "Taiwan campervan price, rent campervan Taipei, campervan rental Taiwan cost, motorhome Taiwan rates, Taipei campervan rental, Joyforest"
  },
  "pages/booking-guide.html": {
    title: "How to Use a Campervan in Taiwan｜Handover Guide｜Joyforest Taipei",
    description:
      "First-time campervan rental in Taiwan: Joyforest handover walkthrough, driving height, power, water, beds, bathroom, outdoor gear, and return checklist—Taipei delivery.",
    keywords:
      "campervan how to Taiwan, first campervan rental Taipei, Taiwan motorhome guide, campervan handover Taiwan, Joyforest"
  },
  "pages/trip-ideas.html": {
    title: "Taiwan Campervan Customer Stories｜Real Trips from Taipei｜Joyforest",
    description:
      "Real campervan trips in Taiwan: North Coast 3-day routes, seaside van-camping, family slow travel, mountain stargazing, and event support—guest stories from Taipei and northern Taiwan.",
    keywords:
      "Taiwan campervan stories, campervan trip Taiwan, Taipei campervan travel, Taiwan van life stories, customer reviews Taiwan campervan, Joyforest"
  },
  "pages/resources/index.html": {
    title: "Taiwan Campervan Travel Resources｜Taipei Rental Guides｜Joyforest",
    description:
      "Campervan rental guides for Taiwan: Taipei and Taoyuan delivery, coastal routes, 3-day/2-night itineraries, pricing, family trips, campsites, and beginner how-tos.",
    keywords:
      "Taiwan campervan guide, Taipei campervan resources, Taiwan road trip campervan, motorhome Taiwan tips, Joyforest"
  }
};
