(function () {
  const DEFAULT_CATEGORY_ID = "stampe-3d";

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function updateHead(category) {
    if (!category) return;

    const title = category.seoTitle || "Il Porto dei Pirati";
    const desc = category.seoDescription || "";

    document.title = title;

    const titleTags = [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]'
    ];

    titleTags.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute("content", title);
    });

    if (!desc) return;

    const descTags = [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]'
    ];

    descTags.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute("content", desc);
    });
  }

  function categoryLink(categoryId) {
    return `./category.html?category=${encodeURIComponent(categoryId)}`;
  }

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  function setAttr(selector, attr, value) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  }

  function resolveCategory() {
    const categories = Array.isArray(window.__CATEGORIES_DATA) ? window.__CATEGORIES_DATA : [];
    if (!categories.length) return null;

    const params = new URLSearchParams(window.location.search);
    const requestedId = (params.get("category") || "").trim();
    const active = categories.find((c) => c && c.id === requestedId)
      || categories.find((c) => c && c.id === DEFAULT_CATEGORY_ID)
      || categories[0];

    return active || null;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const category = resolveCategory();
    if (!category) return;

    const classes = ["category-page--3d", "category-page--serigrafie"];
    document.body.classList.remove(...classes);
    if (category.bodyClass) document.body.classList.add(category.bodyClass);

    setText("[data-category-brand-subtitle]", category.brandSubtitle || "");
    setText("[data-category-hero-title]", category.heroTitle || "");
    setText("[data-category-hero-description]", category.heroDescription || "");
    setText("[data-category-hero-cta-label]", category.heroCtaLabel || "Vai al catalogo");
    setText("[data-category-aside-title]", category.asideTitle || "");
    setText("[data-category-aside-note]", category.asideNote || "");
    setText("[data-category-catalog-title]", category.catalogTitle || "Catalogo");

    const catalogId = category.heroCatalogId || "catalogo";
    setAttr("[data-category-hero-cta]", "href", `#${catalogId}`);
    setAttr("[data-category-catalog-block]", "id", catalogId);
    setAttr("[data-category-grid]", "data-catalog", category.id || DEFAULT_CATEGORY_ID);

    const metaHost = document.querySelector("[data-category-hero-meta]");
    if (metaHost) {
      const rows = Array.isArray(category.heroMeta) ? category.heroMeta : [];
      metaHost.innerHTML = rows.map((row) => (
        `<div class="kv__row"><dt>${escapeHtml(row.label || "")}</dt><dd>${escapeHtml(row.value || "")}</dd></div>`
      )).join("");
    }

    const link3d = document.querySelector("[data-category-link='stampe-3d']");
    const linkWear = document.querySelector("[data-category-link='serigrafie-vestiti']");

    if (link3d) {
      link3d.setAttribute("href", categoryLink("stampe-3d"));
      const small = link3d.querySelector("small");
      if (small) small.textContent = category.id === "stampe-3d" ? "Sei qui" : "Pagina";
    }

    if (linkWear) {
      linkWear.setAttribute("href", categoryLink("serigrafie-vestiti"));
      const small = linkWear.querySelector("small");
      if (small) small.textContent = category.id === "serigrafie-vestiti" ? "Sei qui" : "Pagina";
    }

    updateHead(category);
  });
})();
