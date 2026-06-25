(() => {
  const normalizePathname = (pathname) => {
    let p = pathname || "/";
    if (p.endsWith("/index.html")) {
      p = p.slice(0, -"/index.html".length) || "/";
    }
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p || "/";
  };

  const setMainNavCurrent = () => {
    const nav = document.querySelector("[data-nav-links]");
    if (!nav) return;
    const current = normalizePathname(window.location.pathname);
    nav.querySelectorAll("a[href]").forEach((a) => {
      let target = "";
      try {
        target = normalizePathname(new URL(a.getAttribute("href"), window.location.origin).pathname);
      } catch {
        return;
      }
      if (current === target) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  };

  const isEnglishSite = () => normalizePathname(window.location.pathname).startsWith("/en");

  const localizeTripStoryUrl = (url) => {
    const u = (url || "").trim();
    if (!u || !isEnglishSite()) return u;
    if (u.startsWith("/en/")) return u;
    if (u.startsWith("/trip-stories/")) return `/en${u}`;
    return u;
  };

  const loadSiteIncludes = async () => {
    const headerPh = document.querySelector('[data-site-include="header"]');
    const footerPh = document.querySelector('[data-site-include="footer"]');
    if (!headerPh && !footerPh) return;
    const en = isEnglishSite();
    const headerPath = en ? "/components/header-en.html" : "/components/header.html";
    const footerPath = en ? "/components/footer-en.html" : "/components/footer.html";
    const fetches = [];
    if (headerPh) fetches.push(fetch(headerPath).then((r) => r.text()));
    else fetches.push(Promise.resolve(null));
    if (footerPh) fetches.push(fetch(footerPath).then((r) => r.text()));
    else fetches.push(Promise.resolve(null));
    const [headerHtml, footerHtml] = await Promise.all(fetches);
    if (headerPh && headerHtml) headerPh.outerHTML = headerHtml;
    if (footerPh && footerHtml) footerPh.outerHTML = footerHtml;
  };

  const pickTwoUnique = (items) => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(2, copy.length));
  };

  /** 頁尾圖文區：摘要不宜過長，維持兩欄版面整齊 */
  const clipFooterSummary = (text, maxChars = 88) => {
    const t = (text == null ? "" : String(text)).trim().replace(/\s+/g, " ");
    if (t.length <= maxChars) return t;
    return t.slice(0, maxChars).trimEnd() + "…";
  };

  /** 與建置腳本同步；路徑優先依 main.js 位置推算，避免子路徑或 file 情境下 /assets 錯位 */
  const tripStoriesArticleJsonUrls = () => {
    const urls = [];
    const en = isEnglishSite();
    const jsonName = en ? "trip-stories-articles-en.json" : "trip-stories-articles.json";
    const script =
      document.querySelector('script[src*="main.js"]') || document.querySelector('script[src*="trip-hub.js"]');
    if (script && script.src) {
      try {
        urls.push(new URL(`../data/${jsonName}`, script.src).href);
      } catch (_) {}
    }
    const o = window.location.origin;
    if (o && o !== "null") {
      try {
        urls.push(new URL(`/assets/data/${jsonName}`, o).href);
        if (!en) urls.push(new URL("/content/trip-stories/articles.json", o).href);
        if (en) urls.push(new URL("/content/trip-stories-en/articles.json", o).href);
      } catch (_) {}
    }
    return [...new Set(urls)];
  };

  const fetchTripStoriesArticlesJson = async () => {
    for (const url of tripStoriesArticleJsonUrls()) {
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

  const initFooterTripStoryRandom = async () => {
    const wrap = document.querySelector("[data-footer-trip-story]");
    if (!wrap) return;
    const slots = wrap.querySelectorAll("[data-footer-trip-story-slot]");
    if (!slots.length) return;
    try {
      const data = await fetchTripStoriesArticlesJson();
      if (!data) {
        console.error("[site] Footer trip stories: 無法載入 articles JSON（請確認已部署 assets/data/trip-stories-articles.json）");
        return;
      }
      const articles = Array.isArray(data.articles) ? data.articles : [];
      const valid = articles.filter((a) => a && (a.slug || "").trim() && (a.url || "").trim());
      if (!valid.length) return;
      const picks = pickTwoUnique(valid);
      slots.forEach((slot, index) => {
        const pick = picks[index];
        if (!pick) {
          slot.hidden = true;
          return;
        }
        slot.hidden = false;
        const title = (pick.title || pick.slug || "").trim();
        const summary = clipFooterSummary(pick.description || "");
        const imgPath = ((pick.listVideoPoster || pick.listImage || pick.coverImage || "") + "").trim();
        const imgAlt = ((pick.listImageAlt || pick.coverImageAlt || title || "") + "").trim();
        const category = (pick.category || "").trim();
        const url = localizeTripStoryUrl((pick.url || `/trip-stories/${pick.slug}/`).trim());
        const link = slot.querySelector("[data-footer-trip-story-link]");
        const titleEl = slot.querySelector("[data-footer-trip-story-title]");
        const summaryEl = slot.querySelector("[data-footer-trip-story-summary]");
        const catEl = slot.querySelector("[data-footer-trip-story-category]");
        const imgEl = slot.querySelector("[data-footer-trip-story-img]");
        if (link) {
          link.href = url;
          link.setAttribute("aria-label", `${title}。${summary}`);
        }
        if (titleEl) titleEl.textContent = title;
        if (summaryEl) summaryEl.textContent = summary;
        if (catEl) {
          catEl.textContent = category;
          catEl.hidden = !category;
        }
        if (imgEl) {
          const thumb = slot.querySelector(".footer-trip-story-random__thumb");
          if (imgPath) {
            imgEl.src = imgPath;
            imgEl.alt = imgAlt;
            if (thumb) thumb.hidden = false;
          } else {
            imgEl.removeAttribute("src");
            imgEl.alt = "";
            if (thumb) thumb.hidden = true;
          }
        }
      });
      wrap.removeAttribute("hidden");
    } catch (e) {
      console.error("[site] Footer trip story random failed:", e);
    }
  };

  const initBookingTemplateCopy = () => {
    const btn = document.querySelector("[data-copy-booking-template]");
    const template = document.querySelector("[data-booking-template-text]");
    const feedback = document.querySelector("[data-copy-booking-feedback]");
    if (!btn || !template) return;

    const setFeedback = (msg, ok = true) => {
      if (!feedback) return;
      feedback.textContent = msg;
      feedback.style.color = ok ? "var(--color-primary)" : "#b33636";
    };

    btn.addEventListener("click", async () => {
      const text = template.textContent ? template.textContent.trim() : "";
      if (!text) {
        setFeedback("找不到可複製的預約內容，請重新整理後再試。", false);
        return;
      }

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const helper = document.createElement("textarea");
          helper.value = text;
          helper.setAttribute("readonly", "");
          helper.style.position = "fixed";
          helper.style.opacity = "0";
          document.body.appendChild(helper);
          helper.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(helper);
          if (!ok) throw new Error("execCommand copy failed");
        }
        setFeedback("已複製預約資料，直接貼到 LINE 或 WhatsApp 傳送即可。");
      } catch (err) {
        console.error("[site] Failed to copy booking template:", err);
        setFeedback("複製失敗，請手動選取模板內容後複製。", false);
      }
    });
  };

  const initItineraryCopy = () => {
    document.querySelectorAll("[data-copy-itinerary-day]").forEach((btn) => {
      const dayId = btn.getAttribute("data-copy-itinerary-day");
      const template = document.querySelector(`[data-itinerary-text="${dayId}"]`);
      const feedback = btn
        .closest(".itinerary-card__actions")
        ?.querySelector("[data-itinerary-copy-feedback]");
      if (!template) return;

      const setFeedback = (msg, ok = true) => {
        if (!feedback) return;
        feedback.textContent = msg;
        feedback.classList.toggle("is-error", !ok);
      };

      btn.addEventListener("click", async () => {
        const text =
          template.tagName === "TEMPLATE"
            ? template.content.textContent.trim()
            : (template.textContent || "").trim();
        if (!text) {
          setFeedback("找不到可複製的行程內容。", false);
          return;
        }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
          } else {
            const helper = document.createElement("textarea");
            helper.value = text;
            helper.setAttribute("readonly", "");
            helper.style.position = "fixed";
            helper.style.opacity = "0";
            document.body.appendChild(helper);
            helper.select();
            const ok = document.execCommand("copy");
            document.body.removeChild(helper);
            if (!ok) throw new Error("execCommand copy failed");
          }
          setFeedback("已複製這一天的行程，可貼到記事本或傳給旅伴。");
        } catch (err) {
          console.error("[site] Failed to copy itinerary:", err);
          setFeedback("複製失敗，請手動選取內容。", false);
        }
      });
    });
  };

  const boot = async () => {
    try {
      await loadSiteIncludes();
    } catch (e) {
      console.error("[site] Failed to load header/footer includes:", e);
    }
    /* 等瀏覽器套用 footer outerHTML 後再綁定隨機文章，避免偶發抓不到節點 */
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          try {
            await initFooterTripStoryRandom();
          } catch (e) {
            console.error("[site] Footer trip story init:", e);
          } finally {
            resolve();
          }
        });
      });
    });
    setMainNavCurrent();

    const header = document.querySelector("[data-site-header]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navLinks = document.querySelector("[data-nav-links]");

    const setScrolled = () => {
      if (!header) return;
      header.classList.toggle("is-scrolled", window.scrollY > 6);
    };

    setScrolled();
    window.addEventListener("scroll", setScrolled, { passive: true });

    if (navToggle && navLinks) {
      navToggle.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("is-open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
      });

      navLinks.addEventListener("click", (e) => {
        const a = e.target && e.target.closest ? e.target.closest("a") : null;
        if (!a) return;
        navLinks.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    }

    initBookingTemplateCopy();
    initItineraryCopy();

    const accordions = document.querySelectorAll("[data-accordion]");
    accordions.forEach((el) => {
      const btn = el.querySelector("button");
      const panel = el.querySelector(".panel");
      const toggle = el.querySelector("[data-toggle]");
      if (!btn) return;

      const setOpen = (open) => {
        el.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", String(open));
        if (toggle) toggle.textContent = open ? "－" : "＋";
        if (!panel) return;
        if (open) {
          panel.style.maxHeight = panel.scrollHeight + "px";
        } else {
          panel.style.maxHeight = "0px";
        }
      };

      setOpen(false);

      btn.addEventListener("click", () => {
        const isOpen = el.classList.contains("is-open");
        setOpen(!isOpen);
      });
    });

    const revealEls = document.querySelectorAll("[data-reveal]");
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

      revealEls.forEach((el) => io.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add("is-visible"));
    }

    window.addEventListener(
      "resize",
      () => {
        document.querySelectorAll("[data-accordion].is-open .panel").forEach((panel) => {
          panel.style.maxHeight = panel.scrollHeight + "px";
        });
      },
      { passive: true }
    );

    // 指南頁折疊區塊：若網址帶有 #hash，自動展開對應段落及其所有 <details> 祖先。
    const openCollapsibleFromHash = () => {
      const hash = window.location.hash;
      if (!hash || hash.length < 2) return;
      let target = null;
      try {
        target = document.querySelector(hash);
      } catch (_) {
        return;
      }
      if (!target) return;
      let node = target;
      while (node && node !== document.body) {
        if (node.tagName === "DETAILS" && !node.open) node.open = true;
        node = node.parentElement;
      }
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    openCollapsibleFromHash();
    window.addEventListener("hashchange", openCollapsibleFromHash);
  };

  boot().catch((err) => {
    console.error("[site] Boot failed:", err);
  });
})();
