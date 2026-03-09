(function () {
  const DATA_URL = "./data/products.json";

  const STATUS_META = {
    "available": { label: "Disponibile", cta: "Aggiungi", disabled: false, className: "is-available" },
    "made-to-order": { label: "Realizzato su richiesta", cta: "Aggiungi su richiesta", disabled: false, className: "is-made-to-order" },
    "out-of-stock": { label: "Esaurito", cta: "Esaurito", disabled: true, className: "is-out-of-stock" },
    "coming-soon": { label: "Presto disponibile", cta: "Presto disponibile", disabled: true, className: "is-coming-soon" }
  };

  const BADGE_LABELS = {
    "new": "Nuovo",
    "best-seller": "Best seller",
    "limited": "Edizione limitata",
    "custom": "Personalizzabile"
  };

  const FALLBACK_PRODUCTS = [
    { id: "3d-gyro-v1", name: "Giroscopio decorativo — PLA", category: "stampe-3d", price: 19.9, featured: false, sortOrder: 20, status: "available", available: true, cardDescription: "Oggetto cinetico stampato in 3D.", thumbClass: "thumb--img-gyro", thumbTypeClass: "thumb--3d", cardTag: "3D", badgesStandard: ["new"] },
    { id: "3d-stand-v1", name: "Stand modulare per scrivania", category: "stampe-3d", price: 24.5, featured: true, sortOrder: 10, status: "made-to-order", available: true, cardDescription: "Supporto modulare per accessori.", thumbClass: "thumb--img-stand", thumbTypeClass: "thumb--3d", cardTag: "3D", badgesStandard: ["best-seller"] },
    { id: "3d-keycap-v1", name: "Keycap personalizzata", category: "stampe-3d", price: 14, featured: false, sortOrder: 30, status: "available", available: true, cardDescription: "Keycap stampata in 3D.", thumbClass: "thumb--img-keycap", thumbTypeClass: "thumb--3d", cardTag: "3D", badgesStandard: ["custom"] },
    { id: "print-seri-a2", name: "Serigrafia A2 — edizione limitata", category: "serigrafie-vestiti", price: 35, featured: true, sortOrder: 15, status: "available", available: true, cardDescription: "Stampa serigrafica numerata.", thumbClass: "thumb--img-seri-a2", thumbTypeClass: "thumb--print", cardTag: "PRINT", badgesStandard: ["limited"] },
    { id: "print-poster-a3", name: "Poster A3 — grafica studio", category: "serigrafie-vestiti", price: 18, featured: false, sortOrder: 40, status: "out-of-stock", available: false, cardDescription: "Poster A3 su carta opaca.", thumbClass: "thumb--img-poster-a3", thumbTypeClass: "thumb--print", cardTag: "PRINT", badgesStandard: ["limited"] },
    { id: "tee-logo-v1", name: "T-shirt serigrafata — Logo", category: "serigrafie-vestiti", price: 22, featured: false, sortOrder: 25, status: "available", available: true, cardDescription: "Cotone 100%. Taglie S–XL.", thumbClass: "thumb--img-tee", thumbTypeClass: "thumb--wear", cardTag: "WEAR", badgesStandard: ["best-seller"] },
    { id: "hoodie-v1", name: "Felpa — patch serigrafata", category: "serigrafie-vestiti", price: 48, featured: true, sortOrder: 35, status: "coming-soon", available: false, cardDescription: "Felpa pesante con stampa frontale.", thumbClass: "thumb--img-hoodie", thumbTypeClass: "thumb--wear", cardTag: "WEAR", badgesStandard: ["new"] }
  ].map((p) => ({ ...p, url: `./product.html?id=${encodeURIComponent(p.id)}` }));

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function formatEUR(value) {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value || 0));
  }

  function loadProductsSync(url) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, false);
      xhr.send(null);
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
        const parsed = JSON.parse(xhr.responseText || "[]");
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // no-op
    }
    return [];
  }

  function normalizeStatus(product) {
    const s = String(product.status || "").trim();
    if (STATUS_META[s]) return s;
    if (product.available === false) return "out-of-stock";
    return "available";
  }

  function statusInfo(product) {
    return STATUS_META[normalizeStatus(product)] || STATUS_META.available;
  }

  function productLink(product) {
    return product.url || `./product.html?id=${encodeURIComponent(product.id || "")}`;
  }

  function isFiniteNumber(v) {
    return Number.isFinite(Number(v));
  }

  function defaultComparator(a, b) {
    const sa = isFiniteNumber(a.sortOrder) ? Number(a.sortOrder) : 9999;
    const sb = isFiniteNumber(b.sortOrder) ? Number(b.sortOrder) : 9999;
    if (sa !== sb) return sa - sb;
    if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
    const ia = Number(a.__index || 0);
    const ib = Number(b.__index || 0);
    return ia - ib;
  }

  function sortProducts(list, mode) {
    const out = list.slice();
    if (mode === "price-asc") return out.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (mode === "price-desc") return out.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (mode === "featured-first") {
      return out.sort((a, b) => {
        if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
        return defaultComparator(a, b);
      });
    }
    if (mode === "availability-first") {
      return out.sort((a, b) => {
        const da = statusInfo(a).disabled ? 1 : 0;
        const db = statusInfo(b).disabled ? 1 : 0;
        if (da !== db) return da - db;
        return defaultComparator(a, b);
      });
    }
    return out.sort(defaultComparator);
  }

  function collectFacetData(products) {
    const statuses = new Set();
    const badges = new Set();
    const variantMap = new Map();

    for (const p of products) {
      statuses.add(normalizeStatus(p));

      const stdBadges = Array.isArray(p.badgesStandard) ? p.badgesStandard : [];
      stdBadges.forEach((b) => badges.add(String(b).toLowerCase()));

      const variants = Array.isArray(p.variants) ? p.variants : [];
      for (const v of variants) {
        if (!v || !v.key) continue;
        if (!variantMap.has(v.key)) {
          variantMap.set(v.key, { key: v.key, label: v.label || v.key, options: new Set() });
        }
        const entry = variantMap.get(v.key);
        const opts = Array.isArray(v.options) ? v.options : [];
        opts.forEach((opt) => entry.options.add(String(opt)));
      }
    }

    const variants = Array.from(variantMap.values())
      .map((v) => ({ ...v, options: Array.from(v.options) }))
      .filter((v) => v.options.length > 1);

    return {
      statuses: Array.from(statuses),
      badges: Array.from(badges),
      variants
    };
  }

  function getPriceBandConfig(products) {
    const prices = products
      .map((p) => Number(p.price || 0))
      .filter((n) => Number.isFinite(n));

    if (!prices.length) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const mid = (min + max) / 2;

    if (Math.abs(max - min) < 0.01) return null;

    return {
      min,
      max,
      mid,
      lowLabel: `Fino a ${formatEUR(mid)}`,
      highLabel: `Oltre ${formatEUR(mid)}`
    };
  }

  function hasBadge(product, badgeKey) {
    if (!badgeKey) return true;
    const target = String(badgeKey).toLowerCase();
    const std = Array.isArray(product.badgesStandard) ? product.badgesStandard.map((b) => String(b).toLowerCase()) : [];
    if (std.includes(target)) return true;
    const txt = Array.isArray(product.badges) ? product.badges.map((b) => String(b).toLowerCase()) : [];
    if (txt.includes(target)) return true;
    const single = String(product.badge || "").toLowerCase();
    return !!single && single === target;
  }

  function productHasVariantOption(product, key, value) {
    if (!value) return true;
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const found = variants.find((v) => v && v.key === key);
    if (!found) return false;
    const options = Array.isArray(found.options) ? found.options.map(String) : [];
    if (options.includes(String(value))) return true;
    return String(found.default || "") === String(value);
  }

  function isPurchaseDisabled(product) {
    return statusInfo(product).disabled || product.available === false;
  }

  function badgeChipsHtml(product) {
    const std = Array.isArray(product.badgesStandard) ? product.badgesStandard : [];
    const chips = std.slice(0, 2).map((b) => {
      const key = String(b).toLowerCase();
      const label = BADGE_LABELS[key] || b;
      return `<span class="status-chip badge-chip">${escapeHtml(label)}</span>`;
    });
    return chips.join("");
  }

  function renderStandardCard(product) {
    const thumbTypeClass = product.thumbTypeClass || "thumb--3d";
    const thumbClass = product.thumbClass || "";
    const cardTag = product.cardTag || "PROD";
    const name = product.name || "Prodotto";
    const desc = product.cardDescription || product.description || product.details || "";
    const link = productLink(product);
    const status = statusInfo(product);
    const disabled = isPurchaseDisabled(product);
    const btnAttrs = disabled
      ? 'type="button" disabled aria-disabled="true"'
      : `type="button" data-add-to-cart data-id="${escapeHtml(product.id)}"`;

    return `
      <article class="card">
        <a href="${escapeHtml(link)}" aria-label="Apri ${escapeHtml(name)}">
          <div class="thumb ${escapeHtml(thumbTypeClass)} ${escapeHtml(thumbClass)}"><span class="tag">${escapeHtml(cardTag)}</span></div>
        </a>
        <h3 class="card__title"><a href="${escapeHtml(link)}">${escapeHtml(name)}</a></h3>
        <p class="card__desc">${escapeHtml(desc)}</p>
        <div class="catalog-meta-row">
          <span class="status-chip ${escapeHtml(status.className)}">${escapeHtml(status.label)}</span>
          ${badgeChipsHtml(product)}
        </div>
        <div class="card__row">
          <span class="price">${escapeHtml(formatEUR(product.price))}</span>
          <button class="btn" ${btnAttrs}>${escapeHtml(status.cta)}</button>
        </div>
      </article>
    `;
  }

  function renderEditorialCard(product, idx) {
    const mediaClass = product.category === "stampe-3d"
      ? "editorial-card__media--3d"
      : (product.thumbTypeClass === "thumb--print" ? "editorial-card__media--print" : "editorial-card__media--wear");
    const name = product.name || "Prodotto";
    const desc = product.details || product.cardDescription || "";
    const featuredTag = product.featuredTag || "In evidenza";
    const link = productLink(product);
    const cardClass = idx === 0 ? "editorial-card editorial-card--hero" : "editorial-card";
    const btnClass = idx === 0 ? "btn btn--primary" : "btn";
    const status = statusInfo(product);
    const disabled = isPurchaseDisabled(product);
    const btnAttrs = disabled
      ? 'type="button" disabled aria-disabled="true"'
      : `type="button" data-add-to-cart data-id="${escapeHtml(product.id)}"`;

    return `
      <article class="${cardClass}">
        <a class="editorial-card__media ${mediaClass}" href="${escapeHtml(link)}" aria-label="Apri ${escapeHtml(name)}"></a>
        <div class="editorial-card__body">
          <span class="editorial-card__tag">${escapeHtml(featuredTag)}</span>
          <h3>${escapeHtml(name)}</h3>
          <p>${escapeHtml(desc)}</p>
          <div class="catalog-meta-row">
            <span class="status-chip ${escapeHtml(status.className)}">${escapeHtml(status.label)}</span>
            ${badgeChipsHtml(product)}
          </div>
          <div class="editorial-card__row">
            <span class="price">${escapeHtml(formatEUR(product.price))}</span>
            <button class="${btnClass}" ${btnAttrs}>${escapeHtml(status.cta)}</button>
          </div>
        </div>
      </article>
    `;
  }

  function buildFiltersUI(state, facets, priceBand) {
    const variantFiltersHtml = facets.variants.map((v) => {
      return `
        <div class="field field--compact">
          <label for="filter-${escapeHtml(v.key)}">${escapeHtml(v.label)}</label>
          <select id="filter-${escapeHtml(v.key)}" data-filter-variant="${escapeHtml(v.key)}">
            <option value="">Tutti</option>
            ${v.options.map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join("")}
          </select>
        </div>
      `;
    }).join("");

    return `
      <div class="catalog-auto-tools">
        <div class="catalog-auto-tools__row">
          <div class="field field--compact">
            <label for="filter-status">Disponibilità</label>
            <select id="filter-status" data-filter="status">
              <option value="">Tutte</option>
              ${facets.statuses.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(statusInfo({ status: s }).label)}</option>`).join("")}
            </select>
          </div>

          <div class="field field--compact">
            <label for="filter-badge">Badge</label>
            <select id="filter-badge" data-filter="badge">
              <option value="">Tutti</option>
              ${facets.badges.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(BADGE_LABELS[b] || b)}</option>`).join("")}
            </select>
          </div>

          <div class="field field--compact">
            <label for="filter-price">Prezzo</label>
            <select id="filter-price" data-filter="price">
              <option value="">Tutti</option>
              ${priceBand ? `<option value="low">${escapeHtml(priceBand.lowLabel)}</option><option value="high">${escapeHtml(priceBand.highLabel)}</option>` : ""}
            </select>
          </div>

          ${variantFiltersHtml}

          <div class="field field--compact">
            <label for="catalog-sort">Ordina</label>
            <select id="catalog-sort" data-filter="sort">
              <option value="default">Predefinito</option>
              <option value="price-asc">Prezzo crescente</option>
              <option value="price-desc">Prezzo decrescente</option>
              <option value="featured-first">Novità / featured prima</option>
              <option value="availability-first">Disponibilità prima</option>
            </select>
          </div>

          <div class="catalog-auto-tools__actions">
            <button class="btn" type="button" data-filter-reset>Reset</button>
          </div>
        </div>
        <p class="note" data-filter-summary></p>
      </div>
    `;
  }

  function mountCategoryCatalog(container, productsInCategory) {
    const facets = collectFacetData(productsInCategory);
    const priceBand = getPriceBandConfig(productsInCategory);

    const state = {
      status: "",
      badge: "",
      price: "",
      sort: "default",
      variants: {}
    };

    const toolsWrap = document.createElement("div");
    toolsWrap.className = "catalog-tools-host";
    toolsWrap.innerHTML = buildFiltersUI(state, facets, priceBand);
    container.parentNode.insertBefore(toolsWrap, container);

    const summaryEl = toolsWrap.querySelector("[data-filter-summary]");

    toolsWrap.querySelectorAll("[data-filter='status'], [data-filter='badge'], [data-filter='price'], [data-filter='sort']").forEach((el) => {
      el.addEventListener("change", () => {
        const key = el.getAttribute("data-filter");
        state[key] = String(el.value || "");
        render();
      });
    });

    toolsWrap.querySelectorAll("[data-filter-variant]").forEach((el) => {
      el.addEventListener("change", () => {
        const key = el.getAttribute("data-filter-variant");
        if (!key) return;
        state.variants[key] = String(el.value || "");
        render();
      });
    });

    const resetBtn = toolsWrap.querySelector("[data-filter-reset]");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        state.status = "";
        state.badge = "";
        state.price = "";
        state.sort = "default";
        state.variants = {};
        toolsWrap.querySelectorAll("select").forEach((s) => { s.value = s.getAttribute("data-filter") === "sort" ? "default" : ""; });
        render();
      });
    }

    function passPrice(product) {
      if (!state.price || !priceBand) return true;
      const p = Number(product.price || 0);
      if (state.price === "low") return p <= priceBand.mid;
      if (state.price === "high") return p > priceBand.mid;
      return true;
    }

    function render() {
      let list = productsInCategory.filter((p) => {
        if (state.status && normalizeStatus(p) !== state.status) return false;
        if (state.badge && !hasBadge(p, state.badge)) return false;
        if (!passPrice(p)) return false;

        for (const [k, v] of Object.entries(state.variants)) {
          if (!v) continue;
          if (!productHasVariantOption(p, k, v)) return false;
        }

        return true;
      });

      list = sortProducts(list, state.sort);
      container.innerHTML = list.map((p) => renderStandardCard(p)).join("");

      if (summaryEl) {
        summaryEl.textContent = `${list.length} prodotti trovati`;
      }
    }

    render();
  }

  function mountCatalog(container, allProducts) {
    const type = container.getAttribute("data-catalog") || "";
    const limit = Number(container.getAttribute("data-limit") || "0") || 0;
    const filtersMode = String(container.getAttribute("data-filters") || "").toLowerCase();

    let list = [];
    if (type === "featured") {
      list = allProducts.filter((p) => p && p.featured).slice();
      list = sortProducts(list, "default");
      if (limit > 0) list = list.slice(0, limit);
      container.innerHTML = list.map((p, idx) => renderEditorialCard(p, idx)).join("");
      return;
    }

    list = allProducts.filter((p) => p && p.category === type).slice();
    list = sortProducts(list, "default");

    if (container.classList.contains("product-grid")) {
      // Filters are temporarily disabled on category pages with few products.
      // To re-enable in future, remove data-filters=\"off\" from page containers.
      if (filtersMode === "off") {
        container.innerHTML = list.map((p) => renderStandardCard(p)).join("");
        return;
      }
      mountCategoryCatalog(container, list);
      return;
    }

    if (limit > 0) list = list.slice(0, limit);
    container.innerHTML = list.map((p) => renderStandardCard(p)).join("");
  }

  const loadedProducts = loadProductsSync(DATA_URL);
  const products = loadedProducts.length ? loadedProducts : FALLBACK_PRODUCTS;

  // Keep product data globally available for script.js and product-page.js.
  window.__PRODUCTS_DATA = products.map((p, idx) => ({ ...p, __index: idx }));

  document.addEventListener("DOMContentLoaded", () => {
    const list = Array.isArray(window.__PRODUCTS_DATA) ? window.__PRODUCTS_DATA : [];
    if (!list.length) return;

    document.querySelectorAll("[data-catalog]").forEach((container) => {
      mountCatalog(container, list);
    });
  });
})();
