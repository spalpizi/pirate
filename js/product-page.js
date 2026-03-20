(function () {
  if (window.__BP_PRODUCT_PAGE_INITIALIZED__) return;
  window.__BP_PRODUCT_PAGE_INITIALIZED__ = true;
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

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function formatEUR(value) {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value || 0));
  }

  function mediaStyleAttr(image) {
    const src = String(image || "").trim();
    if (!src) return "";
    return ` style="background-image: linear-gradient(160deg, rgba(255,255,255,.10), rgba(255,255,255,.03)), url('${escapeHtml(src)}');"`;
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

  function isPurchaseDisabled(product) {
    return statusInfo(product).disabled || product.available === false;
  }

  function isPublicProduct(product) {
    return !!product && product.published !== false;
  }

  function readProducts() {
    if (Array.isArray(window.__PRODUCTS_DATA) && window.__PRODUCTS_DATA.length) {
      return window.__PRODUCTS_DATA;
    }
    const loaded = loadProductsSync(DATA_URL);
    const publicProducts = loaded.filter(isPublicProduct);
    window.__PRODUCTS_DATA = publicProducts;
    return publicProducts;
  }

  function updateHead(product) {
    if (!product) return;

    const title = product.seoTitle || `${product.name} | Il Porto dei Pirati`;
    const desc = product.seoDescription || product.details || product.cardDescription || product.lead || "";

    document.title = title;

    const descTags = [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]'
    ];
    descTags.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el && desc) el.setAttribute("content", desc);
    });

    const titleTags = [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]'
    ];
    titleTags.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute("content", title);
    });
  }

  function categoryLink(category) {
    return category === "stampe-3d" ? "./category.html?category=stampe-3d" : "./category.html?category=serigrafie-vestiti";
  }

  function renderNotFound(container) {
    container.innerHTML = `
      <div class="page-block">
        <div class="container page-head page-head--center">
          <div>
            <h1>Prodotto non trovato</h1>
            <p class="muted">Controlla il link o torna al catalogo prodotti.</p>
            <a class="btn" href="./index.html">Torna alla home</a>
          </div>
        </div>
      </div>
    `;
  }

  function relatedProductsFor(product, allProducts) {
    const byId = new Map(allProducts.map((p) => [p.id, p]));
    const explicit = Array.isArray(product.related) ? product.related : [];

    if (explicit.length) {
      return explicit
        .map((id) => byId.get(id))
        .filter((p) => p && p.id !== product.id)
        .slice(0, 3);
    }

    return allProducts
      .filter((p) => p && p.id !== product.id && p.category === product.category)
      .sort((a, b) => {
        const da = isPurchaseDisabled(a) ? 1 : 0;
        const db = isPurchaseDisabled(b) ? 1 : 0;
        if (da !== db) return da - db;
        if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
        const sa = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 9999;
        const sb = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 9999;
        return sa - sb;
      })
      .slice(0, 3);
  }

  function relatedCardsHtml(list) {
    return list.map((p) => {
      const thumbTypeClass = p.thumbTypeClass || "thumb--3d";
      const thumbClass = p.thumbClass || "";
      const status = statusInfo(p);
      const disabled = isPurchaseDisabled(p);
      const btnAttrs = disabled
        ? 'type="button" disabled aria-disabled="true"'
        : `type="button" data-add-to-cart data-id="${escapeHtml(p.id)}"`;

      return `
        <article class="card">
          <a href="./product.html?id=${escapeHtml(p.id)}" aria-label="Apri ${escapeHtml(p.name)}">
            <div class="thumb ${escapeHtml(thumbTypeClass)} ${escapeHtml(thumbClass)}"${mediaStyleAttr(p.image)}><span class="tag">${escapeHtml(p.cardTag || "PROD")}</span></div>
          </a>
          <h3 class="card__title"><a href="./product.html?id=${escapeHtml(p.id)}">${escapeHtml(p.name)}</a></h3>
          <p class="card__desc">${escapeHtml(p.cardDescription || p.description || "")}</p>
          <div class="catalog-meta-row">
            <span class="status-chip ${escapeHtml(status.className)}">${escapeHtml(status.label)}</span>
          </div>
          <div class="card__row">
            <span class="price">${escapeHtml(formatEUR(p.price))}</span>
            <button class="btn" ${btnAttrs}>${escapeHtml(status.cta)}</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderProduct(container, product, allProducts) {
    const badges = Array.isArray(product.badges) ? product.badges : [];
    const stdBadges = Array.isArray(product.badgesStandard) ? product.badgesStandard : [];
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const specs = Array.isArray(product.specs) ? product.specs : [];
    const thumbTypeClass = product.thumbTypeClass || "thumb--3d";
    const thumbClass = product.thumbClass || "";
    const status = statusInfo(product);
    const disabled = isPurchaseDisabled(product);

    const stdBadgeHtml = stdBadges.map((b) => {
      const key = String(b).toLowerCase();
      const label = BADGE_LABELS[key] || b;
      return `<span class="badge">${escapeHtml(label)}</span>`;
    }).join("");

    const textBadgeHtml = badges.map((b) => `<span class="badge">${escapeHtml(b)}</span>`).join("");

    const variantsHtml = variants.length
      ? `<div class="variants" aria-label="Varianti">${variants.map((v, idx) => {
          const vid = `var-${escapeHtml(v.key)}-${idx}`;
          const options = Array.isArray(v.options) ? v.options : [];
          return `
            <div class="field">
              <label for="${vid}">${escapeHtml(v.label || v.key)}</label>
              <select id="${vid}" data-variant="${escapeHtml(v.key)}">
                ${options.map((opt) => {
                  const selected = String(opt) === String(v.default || "") ? " selected" : "";
                  return `<option value="${escapeHtml(opt)}"${selected}>${escapeHtml(opt)}</option>`;
                }).join("")}
              </select>
            </div>
          `;
        }).join("")}</div>`
      : "";

    const specsHtml = specs.map((s) => `
      <div class="kv__row"><dt>${escapeHtml(s.label || "")}</dt><dd>${escapeHtml(s.value || "")}</dd></div>
    `).join("");

    const categoryHref = categoryLink(product.category);
    const related = relatedProductsFor(product, allProducts);

    const ctaAttrs = disabled
      ? 'type="button" disabled aria-disabled="true"'
      : `type="button" data-add-to-cart data-id="${escapeHtml(product.id)}" data-qty-from="input"`;

    container.innerHTML = `
      <div class="page-block">
        <div class="container product-layout">
          <div class="gallery">
            <div class="gallery__img ${escapeHtml(thumbTypeClass)} ${escapeHtml(thumbClass)}" aria-label="Immagine prodotto"${mediaStyleAttr(product.image)}></div>
            <p class="note">${escapeHtml(product.description || "Galleria prodotto con immagine principale e dettagli della lavorazione.")}</p>
          </div>

          <div class="product-info">
            <h1>${escapeHtml(product.name || "Prodotto")}</h1>
            <p class="lead">${escapeHtml(product.lead || product.cardDescription || "")}</p>

            <div class="badges">${stdBadgeHtml}${textBadgeHtml}</div>
            <div class="catalog-meta-row">
              <span class="status-chip ${escapeHtml(status.className)}">${escapeHtml(status.label)}</span>
              ${product.leadTimeDays ? `<span class="status-chip">Lead time: ${escapeHtml(product.leadTimeDays)} giorni</span>` : ""}
            </div>

            <div class="sum sum--price">
              <span>Prezzo</span>
              <b>${escapeHtml(formatEUR(product.price))}</b>
            </div>

            ${variantsHtml}

            <div class="qty-stepper">
              <button type="button" data-qty-dec aria-label="Diminuisci quantità">−</button>
              <input type="number" min="1" value="1" data-qty-input inputmode="numeric" step="1" aria-label="Quantità" ${disabled ? "disabled" : ""} />
              <button type="button" data-qty-inc aria-label="Aumenta quantità">+</button>
              <button class="btn btn--primary" ${ctaAttrs}>${escapeHtml(status.cta)}</button>
            </div>

            <div class="specs">
              <h2>Specifiche</h2>
              <dl class="kv">${specsHtml}</dl>
            </div>

            <div class="product-actions">
              <a class="btn" href="${escapeHtml(categoryHref)}">Torna alla categoria</a>
              <a class="btn" href="./cart.html">Vai al carrello</a>
            </div>

            <p class="note">${escapeHtml(product.details || "Dettagli prodotto disponibili su richiesta.")}</p>
          </div>
        </div>
      </div>

      <div class="page-block product-related">
        <div class="container page-head page-head--center">
          <div>
            <h2>Prodotti correlati</h2>
          </div>
        </div>
        <div class="container product-grid">
          ${relatedCardsHtml(related)}
        </div>
      </div>
    `;

    document.body.setAttribute("data-product-id", product.id);
    updateHead(product);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const root = document.getElementById("product-content");
    if (!root) return;

    const products = readProducts();
    const id = new URLSearchParams(window.location.search).get("id");
    const product = products.find((p) => p && p.id === id);

    if (!product) {
      renderNotFound(root);
      return;
    }

    renderProduct(root, product, products);
  });
})();
