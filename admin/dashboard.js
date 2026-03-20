(function () {
  const productForm = document.getElementById("productForm");
  const eventForm = document.getElementById("eventForm");
  const productList = document.getElementById("productList");
  const eventList = document.getElementById("eventList");
  const productFeedback = document.getElementById("productFeedback");
  const eventFeedback = document.getElementById("eventFeedback");
  const adminUserLabel = document.getElementById("adminUserLabel");
  const logoutBtn = document.getElementById("adminLogoutBtn");
  const newProductBtn = document.getElementById("newProductBtn");
  const newEventBtn = document.getElementById("newEventBtn");
  const PRODUCT_REQUIRED_FIELDS = [
    { key: "id", label: "Identificativo" },
    { key: "slug", label: "Slug" },
    { key: "name", label: "Nome prodotto" },
    { key: "category", label: "Categoria" },
    { key: "price", label: "Prezzo" },
    { key: "cardDescription", label: "Descrizione breve" },
    { key: "image", label: "Immagine principale" },
  ];

  let products = [];
  let events = [];
  let currentProductId = null;
  let currentEventId = null;

  function setFeedback(target, message, isError) {
    if (!target) return;
    target.textContent = message || "";
    target.classList.toggle("is-error", !!isError);
  }

  function apiUrl(path) {
    if (window.location.protocol === "file:") {
      throw new Error("Apri la dashboard tramite `python3 server.py` e usa http://127.0.0.1:8000/admin/login.html.");
    }
    return path;
  }

  function parseCommaList(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseLineList(value) {
    return String(value || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function parseSpecs(value) {
    return String(value || "")
      .split("\n")
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => {
        const parts = row.split(":");
        const label = (parts.shift() || "").trim();
        const cellValue = parts.join(":").trim();
        return label || cellValue ? { label, value: cellValue } : null;
      })
      .filter(Boolean);
  }

  function formatSpecs(specs) {
    if (!Array.isArray(specs)) return "";
    return specs
      .map((row) => `${row.label || ""}: ${row.value || ""}`.trim())
      .filter(Boolean)
      .join("\n");
  }

  function parseVariants(value) {
    if (!String(value || "").trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return null;
    }
  }

  function normalizeSlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function formatVariants(variants) {
    return Array.isArray(variants) && variants.length ? JSON.stringify(variants, null, 2) : "";
  }

  function blankProduct() {
    return {
      id: "",
      slug: "",
      name: "",
      category: "stampe-3d",
      price: 0,
      status: "available",
      stockQty: 0,
      leadTimeDays: 0,
      sortOrder: 0,
      published: true,
      featured: false,
      available: true,
      image: "",
      gallery: [],
      cardDescription: "",
      description: "",
      lead: "",
      details: "",
      badge: "",
      badges: [],
      badgesStandard: [],
      related: [],
      thumbClass: "",
      thumbTypeClass: "thumb--3d",
      cardTag: "PROD",
      featuredTag: "",
      seoTitle: "",
      seoDescription: "",
      specs: [],
      variants: [],
    };
  }

  function blankEvent() {
    return {
      id: "",
      title: "",
      description: "",
      image: "",
      dateLabel: "",
      period: "",
      status: "",
      ctaLabel: "",
      ctaUrl: "",
      published: true,
      sortOrder: 0,
    };
  }

  function fillProductForm(product, isNew) {
    currentProductId = isNew ? null : product.id;
    productForm.reset();
    productForm.elements.isNewRecord.value = isNew ? "true" : "false";

    productForm.elements.id.value = product.id || "";
    productForm.elements.id.readOnly = !isNew;
    productForm.elements.slug.value = product.slug || "";
    productForm.elements.name.value = product.name || "";
    productForm.elements.category.value = product.category || "stampe-3d";
    productForm.elements.price.value = product.price ?? 0;
    productForm.elements.status.value = product.status || "available";
    productForm.elements.stockQty.value = product.stockQty ?? 0;
    productForm.elements.leadTimeDays.value = product.leadTimeDays ?? 0;
    productForm.elements.sortOrder.value = product.sortOrder ?? 0;
    productForm.elements.published.checked = product.published !== false;
    productForm.elements.featured.checked = !!product.featured;
    productForm.elements.available.checked = product.available !== false;
    productForm.elements.image.value = product.image || "";
    productForm.elements.gallery.value = Array.isArray(product.gallery) ? product.gallery.join("\n") : "";
    productForm.elements.cardDescription.value = product.cardDescription || "";
    productForm.elements.description.value = product.description || "";
    productForm.elements.lead.value = product.lead || "";
    productForm.elements.details.value = product.details || "";
    productForm.elements.badge.value = product.badge || "";
    productForm.elements.badges.value = Array.isArray(product.badges) ? product.badges.join(", ") : "";
    productForm.elements.badgesStandard.value = Array.isArray(product.badgesStandard) ? product.badgesStandard.join(", ") : "";
    productForm.elements.related.value = Array.isArray(product.related) ? product.related.join(", ") : "";
    productForm.elements.thumbClass.value = product.thumbClass || "";
    productForm.elements.thumbTypeClass.value = product.thumbTypeClass || "thumb--3d";
    productForm.elements.cardTag.value = product.cardTag || "PROD";
    productForm.elements.featuredTag.value = product.featuredTag || "";
    productForm.elements.seoTitle.value = product.seoTitle || "";
    productForm.elements.seoDescription.value = product.seoDescription || "";
    productForm.elements.specs.value = formatSpecs(product.specs);
    productForm.elements.variants.value = formatVariants(product.variants);

    setFeedback(productFeedback, "", false);
    renderProductList();
  }

  function fillEventForm(item, isNew) {
    currentEventId = isNew ? null : item.id;
    eventForm.reset();
    eventForm.elements.isNewRecord.value = isNew ? "true" : "false";

    eventForm.elements.id.value = item.id || "";
    eventForm.elements.id.readOnly = !isNew;
    eventForm.elements.title.value = item.title || "";
    eventForm.elements.description.value = item.description || "";
    eventForm.elements.image.value = item.image || "";
    eventForm.elements.dateLabel.value = item.dateLabel || "";
    eventForm.elements.period.value = item.period || "";
    eventForm.elements.status.value = item.status || "";
    eventForm.elements.ctaLabel.value = item.ctaLabel || "";
    eventForm.elements.ctaUrl.value = item.ctaUrl || "";
    eventForm.elements.published.checked = item.published !== false;
    eventForm.elements.sortOrder.value = item.sortOrder ?? 0;

    setFeedback(eventFeedback, "", false);
    renderEventList();
  }

  function renderProductList() {
    if (!productList) return;
    productList.innerHTML = "";

    products.forEach((product) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "admin-card" + (currentProductId === product.id ? " is-active" : "");
      btn.innerHTML = `
        <p class="admin-card__title">${product.name || product.id}</p>
        <p class="admin-card__meta">${product.categoryLabel || product.category || ""} • € ${Number(product.price || 0).toFixed(2)}${product.published === false ? " • bozza" : ""}</p>
      `;
      btn.addEventListener("click", () => fillProductForm(product, false));
      productList.appendChild(btn);
    });
  }

  function renderEventList() {
    if (!eventList) return;
    eventList.innerHTML = "";

    events.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "admin-card" + (currentEventId === item.id ? " is-active" : "");
      btn.innerHTML = `
        <p class="admin-card__title">${item.title || item.id}</p>
        <p class="admin-card__meta">${item.dateLabel || ""}${item.period ? " • " + item.period : ""}${item.published === false ? " • bozza" : ""}</p>
      `;
      btn.addEventListener("click", () => fillEventForm(item, false));
      eventList.appendChild(btn);
    });
  }

  function serializeProductForm() {
    const variants = parseVariants(productForm.elements.variants.value);
    if (variants === null) {
      throw new Error("Il campo varianti deve contenere JSON valido.");
    }

    return {
      id: productForm.elements.id.value.trim(),
      slug: productForm.elements.slug.value.trim(),
      name: productForm.elements.name.value.trim(),
      category: productForm.elements.category.value,
      price: Number(productForm.elements.price.value || 0),
      status: productForm.elements.status.value,
      stockQty: Number(productForm.elements.stockQty.value || 0),
      leadTimeDays: Number(productForm.elements.leadTimeDays.value || 0),
      sortOrder: Number(productForm.elements.sortOrder.value || 0),
      published: productForm.elements.published.checked,
      featured: productForm.elements.featured.checked,
      available: productForm.elements.available.checked,
      image: productForm.elements.image.value.trim(),
      gallery: parseLineList(productForm.elements.gallery.value),
      cardDescription: productForm.elements.cardDescription.value.trim(),
      description: productForm.elements.description.value.trim(),
      lead: productForm.elements.lead.value.trim(),
      details: productForm.elements.details.value.trim(),
      badge: productForm.elements.badge.value.trim(),
      badges: parseCommaList(productForm.elements.badges.value),
      badgesStandard: parseCommaList(productForm.elements.badgesStandard.value),
      related: parseCommaList(productForm.elements.related.value),
      thumbClass: productForm.elements.thumbClass.value.trim(),
      thumbTypeClass: productForm.elements.thumbTypeClass.value.trim(),
      cardTag: productForm.elements.cardTag.value.trim(),
      featuredTag: productForm.elements.featuredTag.value.trim(),
      seoTitle: productForm.elements.seoTitle.value.trim(),
      seoDescription: productForm.elements.seoDescription.value.trim(),
      specs: parseSpecs(productForm.elements.specs.value),
      variants,
    };
  }

  function validateProduct(product) {
    const errors = [];
    PRODUCT_REQUIRED_FIELDS.forEach((field) => {
      const value = product[field.key];
      if (value === null || value === undefined || String(value).trim() === "") {
        errors.push(`${field.label} obbligatorio.`);
      }
    });

    if (product.category !== "stampe-3d" && product.category !== "serigrafie-vestiti") {
      errors.push("Categoria non valida.");
    }
    if (!Number.isFinite(product.price) || product.price < 0) {
      errors.push("Prezzo non valido.");
    }

    const duplicateId = products.find((item) => item.id === product.id && item.id !== currentProductId);
    if (duplicateId) errors.push("Identificativo gia esistente.");

    const duplicateSlug = products.find((item) => item.slug === product.slug && item.id !== currentProductId);
    if (duplicateSlug) errors.push("Slug gia esistente.");

    return errors;
  }

  function serializeEventForm() {
    return {
      id: eventForm.elements.id.value.trim(),
      title: eventForm.elements.title.value.trim(),
      description: eventForm.elements.description.value.trim(),
      image: eventForm.elements.image.value.trim(),
      dateLabel: eventForm.elements.dateLabel.value.trim(),
      period: eventForm.elements.period.value.trim(),
      status: eventForm.elements.status.value.trim(),
      ctaLabel: eventForm.elements.ctaLabel.value.trim(),
      ctaUrl: eventForm.elements.ctaUrl.value.trim(),
      published: eventForm.elements.published.checked,
      sortOrder: Number(eventForm.elements.sortOrder.value || 0),
    };
  }

  async function fetchJson(url, options) {
    let res;
    try {
      res = await fetch(apiUrl(url), {
        credentials: "same-origin",
        ...options,
      });
    } catch (error) {
      throw new Error("Server admin non raggiungibile. Avvia `python3 server.py` e apri la dashboard via http://127.0.0.1:8000.");
    }
    if (res.status === 401) {
      window.location.href = "./login.html";
      throw new Error("Sessione scaduta");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const details = Array.isArray(data.errors) && data.errors.length ? data.errors.join(" ") : "";
      throw new Error(details || data.error || "Errore richiesta");
    }
    return data;
  }

  async function loadSession() {
    const data = await fetchJson("/api/admin/session");
    if (!data.authenticated) {
      window.location.href = "./login.html";
      return false;
    }
    if (adminUserLabel && data.user) {
      adminUserLabel.textContent = `${data.user.username}`;
    }
    return true;
  }

  async function loadData() {
    const [productsRes, eventsRes] = await Promise.all([
      fetchJson("/api/admin/products"),
      fetchJson("/api/admin/events"),
    ]);

    products = Array.isArray(productsRes.items) ? productsRes.items : [];
    events = Array.isArray(eventsRes.items) ? eventsRes.items : [];

    renderProductList();
    renderEventList();
    fillProductForm(products[0] || blankProduct(), !products.length);
    fillEventForm(events[0] || blankEvent(), !events.length);
  }

  productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = productForm.querySelector('button[type="submit"]');
    setFeedback(productFeedback, "Salvataggio…", false);

    try {
      const product = serializeProductForm();
      product.slug = normalizeSlug(product.slug);
      productForm.elements.slug.value = product.slug;
      const errors = validateProduct(product);
      if (errors.length) {
        throw new Error(errors.join(" "));
      }
      if (submitBtn) submitBtn.disabled = true;
      const res = await fetchJson("/api/admin/products/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
      });

      const saved = res.item;
      const existingIndex = products.findIndex((item) => item.id === saved.id || item.id === currentProductId);
      if (existingIndex >= 0) products[existingIndex] = saved;
      else products.push(saved);
      products.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
      fillProductForm(saved, false);
      setFeedback(productFeedback, "Prodotto salvato.", false);
    } catch (error) {
      setFeedback(productFeedback, error.message || "Salvataggio non riuscito.", true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  eventForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback(eventFeedback, "Salvataggio…", false);

    try {
      const item = serializeEventForm();
      const res = await fetchJson("/api/admin/events/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: item }),
      });

      const saved = res.item;
      const existingIndex = events.findIndex((entry) => entry.id === saved.id || entry.id === currentEventId);
      if (existingIndex >= 0) events[existingIndex] = saved;
      else events.push(saved);
      events.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
      fillEventForm(saved, false);
      setFeedback(eventFeedback, "Evento salvato.", false);
    } catch (error) {
      setFeedback(eventFeedback, error.message || "Salvataggio non riuscito.", true);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await fetchJson("/api/admin/logout", { method: "POST" });
    window.location.href = "./login.html";
  });

  newProductBtn.addEventListener("click", () => fillProductForm(blankProduct(), true));
  newEventBtn.addEventListener("click", () => fillEventForm(blankEvent(), true));

  (async function init() {
    try {
      const ok = await loadSession();
      if (!ok) return;
      await loadData();
    } catch (error) {
      setFeedback(productFeedback, error.message || "Impossibile caricare i dati admin.", true);
      setFeedback(eventFeedback, error.message || "Impossibile caricare i dati admin.", true);
    }
  })();
})();
