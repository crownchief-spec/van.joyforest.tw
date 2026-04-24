(function () {
  const hubRoot = document.querySelector("[data-trip-hub]");
  if (!hubRoot) return;

  const FILTER_KEYS = [
    { id: "all", label: "全部文章" },
    { id: "客戶體驗", label: "客戶體驗" },
    { id: "品牌合作", label: "品牌合作" },
    { id: "國際客人", label: "國際客人" },
    { id: "新手行程", label: "新手行程" },
    { id: "海邊路線", label: "海邊路線" },
    { id: "山區路線", label: "山區路線" },
    { id: "好友旅行", label: "好友旅行" },
    { id: "親子旅行", label: "親子旅行", matchTag: "親子旅行" },
    { id: "活動支援", label: "活動支援" },
    { id: "新手教學", label: "新手教學" }
  ];

  /** 依腳本位置推算 JSON（相容子路徑部署、避免只用 /assets 根路徑失敗） */
  const tripStoriesArticleJsonUrls = () => {
    const urls = [];
    const script =
      document.querySelector('script[src*="trip-hub.js"]') || document.querySelector('script[src*="main.js"]');
    if (script && script.src) {
      try {
        urls.push(new URL("../data/trip-stories-articles.json", script.src).href);
      } catch (_) {}
    }
    const o = window.location.origin;
    if (o && o !== "null") {
      try {
        urls.push(new URL("/assets/data/trip-stories-articles.json", o).href);
        urls.push(new URL("/content/trip-stories/articles.json", o).href);
      } catch (_) {}
    }
    return [...new Set(urls)];
  };

  const fetchArticlesData = async () => {
    const custom = (hubRoot.dataset.articles || "").trim();
    const tryList = custom
      ? [custom.startsWith("http") ? custom : new URL(custom, window.location.href).href]
      : tripStoriesArticleJsonUrls();
    for (const url of tryList) {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) continue;
        return await res.json();
      } catch {
        /* 下一個路徑 */
      }
    }
    return null;
  };

  const observeReveal = (elements) => {
    if (!elements || !elements.length) return;
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
      );
      elements.forEach((el) => io.observe(el));
    } else {
      elements.forEach((el) => el.classList.add("is-visible"));
    }
  };

  const esc = (s) => {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  };

  const cardHtml = (a) => {
    const tags = Array.isArray(a.tags) ? a.tags : [];
    const tagStr = tags
      .slice(0, 5)
      .map((t) => `<span class="trip-hub-tag">${esc(t)}</span>`)
      .join("");
    return `<article class="trip-hub-card fade-in" data-reveal data-trip-hub-card data-category="${esc(
      a.category
    )}" data-tags="${esc(tags.join(","))}">
  <a class="trip-hub-card__link" href="${esc(a.url)}">
    <div class="trip-hub-card__media">
      <img src="${esc(a.coverImage)}" alt="${esc(a.coverImageAlt || a.title)}" width="640" height="360" loading="lazy" decoding="async" />
    </div>
    <div class="trip-hub-card__body">
      <span class="pill trip-hub-card__pill">${esc(a.category)}</span>
      <h3 class="trip-hub-card__title">${esc(a.title)}</h3>
      <p class="trip-hub-card__excerpt">${esc(a.description)}</p>
      <div class="trip-hub-card__meta">
        <time datetime="${esc(a.date)}">${esc(a.date)}</time>
        <span class="trip-hub-card__dot" aria-hidden="true">·</span>
        <span>${esc(a.readingTime || "")}</span>
      </div>
      ${
        tagStr
          ? `<div class="trip-hub-card__tags" aria-label="標籤">${tagStr}</div>`
          : ""
      }
      <span class="trip-hub-card__more">閱讀文章</span>
    </div>
  </a>
</article>`;
  };

  const matchesFilter = (article, filterId, matchTag) => {
    if (filterId === "all") return true;
    if (matchTag) {
      const tags = Array.isArray(article.tags) ? article.tags : [];
      return tags.includes(matchTag);
    }
    return article.category === filterId;
  };

  (async () => {
    try {
      const data = await fetchArticlesData();
      if (!data) throw new Error("articles json unavailable");
      const list = Array.isArray(data.articles) ? data.articles : [];
      if (!list.length) {
        hubRoot.innerHTML = '<p class="trip-stories-error">目前尚無客戶體驗文章。</p>';
        return;
      }

      const featured = list.filter((a) => a.featured).slice(0, 3);
      const filterHost = hubRoot.querySelector("[data-trip-hub-filters]");
      const featuredHost = hubRoot.querySelector("[data-trip-hub-featured]");
      const listHost = hubRoot.querySelector("[data-trip-hub-list]");

      if (filterHost) {
        filterHost.innerHTML = FILTER_KEYS.map(
          (f, i) =>
            `<button type="button" class="trip-hub-filter${i === 0 ? " is-active" : ""}" data-trip-filter="${esc(
              f.id
            )}" data-trip-filter-tag="${f.matchTag ? esc(f.matchTag) : ""}">${esc(f.label)}</button>`
        ).join("");
      }

      const renderFeatured = () => {
        if (!featuredHost) return;
        featuredHost.innerHTML = featured.map((a) => cardHtml(a)).join("");
      };

      const renderList = (filterId, matchTag) => {
        if (!listHost) return;
        const filtered = list.filter((a) => matchesFilter(a, filterId, matchTag));
        listHost.innerHTML = filtered.map((a) => cardHtml(a)).join("");
        observeReveal(listHost.querySelectorAll(".fade-in[data-reveal]"));
      };

      renderFeatured();
      if (featuredHost) {
        observeReveal(featuredHost.querySelectorAll(".fade-in[data-reveal]"));
      }

      let activeFilter = "all";
      let activeTag = "";
      renderList(activeFilter, activeTag);

      if (filterHost) {
        filterHost.addEventListener("click", (e) => {
          const btn = e.target && e.target.closest ? e.target.closest("[data-trip-filter]") : null;
          if (!btn) return;
          activeFilter = btn.getAttribute("data-trip-filter") || "all";
          activeTag = btn.getAttribute("data-trip-filter-tag") || "";
          filterHost.querySelectorAll("[data-trip-filter]").forEach((b) => {
            b.classList.toggle("is-active", b === btn);
          });
          renderList(activeFilter, activeTag);
        });
      }
    } catch (err) {
      console.error("[trip-hub]", err);
      hubRoot.innerHTML =
        '<p class="trip-stories-error">客戶體驗文章清單載入失敗。若使用本機檔案開啟，請改以網址列的網站網域瀏覽，或確認已部署 <code>assets/data/trip-stories-articles.json</code> 後重新整理。</p>';
    }
  })();
})();
