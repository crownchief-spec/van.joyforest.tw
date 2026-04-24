(function () {
  const root = document.querySelector("[data-trip-stories-root]");
  if (!root || typeof marked === "undefined" || typeof marked.parse !== "function") {
    return;
  }

  marked.setOptions({ gfm: true, breaks: true });

  const manifestHref =
    root.dataset.manifest ||
    new URL("/content/trip-stories/manifest.json", window.location.origin).href;

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

  const scrollToHashIfNeeded = () => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    let target = null;
    try {
      target = document.querySelector(hash);
    } catch (_) {
      return;
    }
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  (async () => {
    try {
      const res = await fetch(manifestHref, { cache: "no-cache" });
      if (!res.ok) throw new Error("manifest " + res.status);
      const data = await res.json();
      const list = Array.isArray(data.articles) ? data.articles : [];
      const baseDir = manifestHref.replace(/manifest\.json$/, "");

      const sections = [];

      for (const item of list) {
        const slug = item.slug;
        const file = item.file;
        if (!slug || !file) continue;
        const mdUrl = new URL(file, baseDir).href;
        const mdRes = await fetch(mdUrl, { cache: "no-cache" });
        if (!mdRes.ok) continue;
        const md = await mdRes.text();
        const prose = marked.parse(md);
        const section = document.createElement("section");
        section.className = "section trip-story-section fade-in";
        section.dataset.reveal = "";
        section.id = slug;
        section.innerHTML =
          '<div class="container">' +
          '<article class="card trip-story-card">' +
          '<div class="trip-story-prose">' +
          prose +
          "</div></article></div>";
        sections.push(section);
      }

      if (!sections.length) {
        root.innerHTML =
          '<p class="trip-stories-error">目前尚無旅遊文章，或清單尚未設定。</p>';
        return;
      }

      root.replaceWith(...sections);
      observeReveal(document.querySelectorAll(".trip-story-section[data-reveal]"));
      scrollToHashIfNeeded();
      window.addEventListener("hashchange", scrollToHashIfNeeded);
    } catch (e) {
      console.error("[trip-stories] load failed:", e);
      root.innerHTML =
        '<p class="trip-stories-error">旅遊文章載入失敗，請稍後重新整理頁面。</p>';
    }
  })();
})();
