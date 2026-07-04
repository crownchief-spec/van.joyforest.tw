import { SITE_ORIGIN, toCanonicalUrl } from "./seo-url-helpers.mjs";

/** Confirmed business facts — do not add unverified address or sameAs */
export const BUSINESS = {
  name: "揪好森露營車出租",
  alternateName: "Joyforest Campervan Rental",
  telephone: "+886-911-252-302",
  email: "crownchief@gmail.com",
  logo: `${SITE_ORIGIN}/assets/images/shared/joyforest-campervan-rental-logo-icon-512.png`,
  heroImage: `${SITE_ORIGIN}/assets/images/home/joyforest-campervan-at-white-villa-staycation-hero.jpg`,
  areaServed: [
    { "@type": "City", name: "台北市" },
    { "@type": "City", name: "桃園市" },
    { "@type": "City", name: "新竹市" }
  ],
  areaServedNames: ["台北", "桃園", "新竹"]
};

export const organizationNode = () => ({
  "@type": "Organization",
  "@id": `${SITE_ORIGIN}/#organization`,
  name: BUSINESS.name,
  alternateName: BUSINESS.alternateName,
  url: `${SITE_ORIGIN}/`,
  logo: BUSINESS.logo,
  email: BUSINESS.email,
  telephone: BUSINESS.telephone
});

export const websiteNode = () => ({
  "@type": "WebSite",
  "@id": `${SITE_ORIGIN}/#website`,
  name: BUSINESS.name,
  url: `${SITE_ORIGIN}/`,
  inLanguage: "zh-Hant",
  publisher: { "@id": `${SITE_ORIGIN}/#organization` }
});

export const localBusinessNode = () => ({
  "@type": "LocalBusiness",
  "@id": `${SITE_ORIGIN}/#localbusiness`,
  name: BUSINESS.name,
  alternateName: BUSINESS.alternateName,
  url: `${SITE_ORIGIN}/`,
  image: BUSINESS.heroImage,
  telephone: BUSINESS.telephone,
  email: BUSINESS.email,
  areaServed: BUSINESS.areaServed,
  description:
    "自走式露營車到府交車，適合親子、好友與情侶的三天兩夜慢旅行；兩張雙人床、獨立衛浴、冷暖空調。",
  serviceType: ["露營車出租", "指定地點送車"]
});

export const homePageGraph = () => [organizationNode(), websiteNode(), localBusinessNode()];

export const breadcrumbNode = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.name,
    item: toCanonicalUrl(item.path)
  }))
});

/** Campervan pricing page — Service + OfferCatalog (prices match visible page content) */
export const campervanServiceGraph = (pagePath = "/pages/campervan") => {
  const pageUrl = toCanonicalUrl(pagePath);
  return [
    {
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: "露營車出租價格與車款",
      isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: `${SITE_ORIGIN}/assets/images/campervan/taipei-campervan-rental-white-rv-coastal-ocean-view-hero.jpg`
      }
    },
    {
      "@type": "Service",
      "@id": `${pageUrl}#service`,
      name: "揪好森自走式露營車出租",
      provider: { "@id": `${SITE_ORIGIN}/#localbusiness` },
      areaServed: BUSINESS.areaServedNames,
      serviceType: "露營車出租",
      offers: {
        "@type": "OfferCatalog",
        name: "露營車租借方案",
        itemListElement: [
          {
            "@type": "Offer",
            name: "3天2夜（平日）",
            price: "11800",
            priceCurrency: "TWD",
            description: "平日 3 天 2 夜基本方案，含車輛與標準設備"
          },
          {
            "@type": "Offer",
            name: "3天2夜（假日）",
            price: "13800",
            priceCurrency: "TWD",
            description: "假日 3 天 2 夜基本方案，含車輛與標準設備"
          },
          {
            "@type": "Offer",
            name: "押金",
            price: "5000",
            priceCurrency: "TWD",
            description: "還車驗收後退還（依合約條款）"
          }
        ]
      }
    },
    breadcrumbNode([
      { name: "首頁", path: "/" },
      { name: "價格與車款介紹", path: pagePath }
    ])
  ];
};

export const toJsonLdScript = (graph) =>
  JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2);
