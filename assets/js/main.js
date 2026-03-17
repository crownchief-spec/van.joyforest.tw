(() => {
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
})();

