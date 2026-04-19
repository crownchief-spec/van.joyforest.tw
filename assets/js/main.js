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

  const loadSiteIncludes = async () => {
    const headerPh = document.querySelector('[data-site-include="header"]');
    const footerPh = document.querySelector('[data-site-include="footer"]');
    if (!headerPh && !footerPh) return;
    const fetches = [];
    if (headerPh) fetches.push(fetch("/components/header.html").then((r) => r.text()));
    else fetches.push(Promise.resolve(null));
    if (footerPh) fetches.push(fetch("/components/footer.html").then((r) => r.text()));
    else fetches.push(Promise.resolve(null));
    const [headerHtml, footerHtml] = await Promise.all(fetches);
    if (headerPh && headerHtml) headerPh.outerHTML = headerHtml;
    if (footerPh && footerHtml) footerPh.outerHTML = footerHtml;
  };

  const boot = async () => {
    try {
      await loadSiteIncludes();
    } catch (e) {
      console.error("[site] Failed to load header/footer includes:", e);
    }
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
  };

  boot().catch((err) => {
    console.error("[site] Boot failed:", err);
  });
})();
