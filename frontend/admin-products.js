/* ═══════════════════════════════════════════════════════════
   GODMODE STORE — admin-products.js
  
   ═══════════════════════════════════════════════════════════ */

const AdminProducts = (() => {
  /* ── State ──────────────────────────────────────────── */
  let _products = [];
  let _page = 1;
  let _totalPages = 1;
  let _search = "";
  let _category = "";
  let _editId = null;
  let _loading = false;

  const LIMIT = 10;

  /* ══════════════════════════════════════════════════════
     🔧 FIX #1 — مزامنة صحيحة مع apiProducts
     المشكلة القديمة: الدمج كان يُبقي المنتجات المحذوفة
     الحل: نحذف المنتجات غير الموجودة في القائمة الجديدة
  ══════════════════════════════════════════════════════ */
function _syncGlobalProducts(newList) {
  const formatted = newList
    .filter((p) => p.isActive !== false) // ← أزل غير النشطة فوراً
    .map(_formatForStore);

  const newIds = new Set(formatted.map((p) => String(p.id)));

  // أبقِ فقط المنتجات من categories غير موجودة في القائمة الجديدة
  // + أضف القائمة الجديدة (النشطة فقط)
  const others = apiProducts.filter(
    (p) => !newIds.has(String(p.id)) && p.isActive !== false
  );
  const map = new Map([...others, ...formatted].map((p) => [String(p.id), p]));
  apiProducts = [...map.values()];

  // تأكد نهائي
  apiProducts = apiProducts.filter((p) => p.isActive !== false);
}

  /* 🔧 FIX — دالة خاصة لإزالة منتج محذوف من apiProducts */
  function _removeFromGlobal(id) {
    const strId = String(id);
    const before = apiProducts.length;
    apiProducts = apiProducts.filter((p) => String(p.id) !== strId);
    console.log(
      `[AdminProducts] Removed ID ${strId} from apiProducts (${before} → ${apiProducts.length})`
    );
  }

  /* 🔧 FIX — إعادة رسم جميع grids في المتجر فوراً */
  function _redrawAllGrids() {
    const source = apiProducts.filter((p) => p.isActive !== false);

    const featured = source.filter((p) => p.isFeatured);
    const coffee = source.filter((p) => p.cat === "coffee");
    const drinks = source.filter((p) => p.cat === "drinks");
    const brass = source.filter((p) => p.cat === "brass");

    if (typeof renderProducts === "function") {
      if (document.getElementById("featured-grid"))
        renderProducts("featured-grid", featured);
      if (document.getElementById("coffee-grid"))
        renderProducts("coffee-grid", coffee);
      if (document.getElementById("drinks-grid"))
        renderProducts("drinks-grid", drinks);
      if (document.getElementById("brass-grid"))
        renderProducts("brass-grid", brass);
    }

    if (typeof renderSmallProducts === "function") renderSmallProducts();
  }

  function _formatForStore(p) {
    let img =
      Array.isArray(p.images) && p.images[0]
        ? p.images[0]
        : "imagesCoffe/spinning_coffee_cup.png";

    if (img.startsWith("/uploads/")) {
      img = "imagesCoffe/" + img.split("/").pop();
    }

    const avgRating = Math.round(p.ratingAvg || 5);
    const rating =
      "★".repeat(Math.min(avgRating, 5)) +
      "☆".repeat(Math.max(0, 5 - avgRating));

    return {
      id: String(p.id), // 🔧 دائماً String لتجنب مشاكل المقارنة
      name: p.name,
      price: parseFloat(p.price),
      image: img,
      images: Array.isArray(p.images) ? p.images : [],
      rating,
      reviews: p.reviewCount || 0,
      badge: p.badge || null,
      cat: p.category,
      desc: p.description,
      stock: p.stock || 0,
      isFeatured: p.isFeatured,
      isActive: p.isActive
    };
  }

  /* ══════════════════════════════════════════════════════
     FETCH — جلب المنتجات من الباك
  ══════════════════════════════════════════════════════ */
  async function fetchProducts() {
    _loading = true;
    _renderTable();

    try {
      const params = { page: _page, limit: LIMIT };
      if (_search) params.search = _search;
      if (_category) params.category = _category;

      const res = await api.getAdminProducts(params);

      if (res.success) {
        _products = res.data.filter((p) => p.isActive !== false);
        _totalPages = Math.ceil((res.meta?.total || 0) / LIMIT);
        _syncGlobalProducts(res.data);
        _redrawAllGrids();
      }
    } catch (err) {
      console.error("AdminProducts.fetchProducts:", err);
      showNotif("❌ Failed to load products");
    }

    _loading = false;
    _renderTable();
    _renderPagination();
  }

  /* ══════════════════════════════════════════════════════
     🔧 FIX #3 — إعادة تحميل شاملة وموثوقة للمتجر
     تضمن أن كل الـ grids تتحدث بعد أي عملية CRUD
  ══════════════════════════════════════════════════════ */
  async function _forceReloadAll() {
    try {
      await Promise.all([
        loadRealProducts(),
        loadCoffeeProducts(),
        loadDrinksProducts(),
        loadBrassProducts()
      ]);
      if (typeof renderSmallProducts === "function") renderSmallProducts();
    } catch (e) {
      console.warn("_forceReloadAll error:", e);
      _redrawAllGrids();
    }
  }

  /* ══════════════════════════════════════════════════════
     RENDER — جدول المنتجات
  ══════════════════════════════════════════════════════ */
  function _renderTable() {
    const panel = document.getElementById("admin-products-panel");
    if (!panel) return;

    panel.innerHTML = `
      <div class="admin-products-section">

        <div class="ap-header">
          <div>
            <h2 class="ap-title">Products Management</h2>
            <p class="ap-sub">Manage all store products — add, edit, delete, feature</p>
          </div>
          <button class="ap-add-btn" onclick="AdminProducts.openModal()">
            + Add New Product
          </button>
        </div>

        <div class="ap-filters">
          <input
            class="ap-search"
            type="text"
            placeholder="🔍 Search products..."
            value="${_search}"
            oninput="AdminProducts.onSearch(this.value)"
          >
          <select class="ap-cat-filter" onchange="AdminProducts.onCategoryFilter(this.value)">
            <option value="" ${!_category ? "selected" : ""}>All Categories</option>
            <option value="coffee" ${_category === "coffee" ? "selected" : ""}>☕ Coffee</option>
            <option value="drinks" ${_category === "drinks" ? "selected" : ""}>🥤 Drinks</option>
            <option value="brass"  ${_category === "brass" ? "selected" : ""}>🏺 Brass</option>
          </select>
          <button class="ap-refresh-btn" onclick="AdminProducts.refresh()" title="Refresh">
            🔄
          </button>
        </div>

        <div class="ap-table-wrap" id="ap-table-wrap">
          ${_loading ? _skeletonRows() : _tableHTML()}
        </div>

        <div id="ap-pagination" class="ap-pagination"></div>

      </div>

      <div class="ap-modal-overlay" id="ap-modal-overlay" onclick="AdminProducts.closeModal(event)">
        <div class="ap-modal" id="ap-modal" onclick="event.stopPropagation()">
          <div class="ap-modal-header">
            <h3 id="ap-modal-title">Add Product</h3>
            <button class="ap-modal-close" onclick="AdminProducts.closeModal()">✕</button>
          </div>
          <div id="ap-modal-body"></div>
        </div>
      </div>
    `;

    _renderPagination();
    _injectStyles();
  }

  function _skeletonRows() {
    return `
      <table class="ap-table">
        <thead><tr>
          <th>Image</th><th>Name</th><th>Category</th>
          <th>Price</th><th>Stock</th><th>Featured</th>
          <th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${Array(5)
            .fill(
              `
            <tr>
              ${Array(8).fill(`<td><div class="ap-skeleton"></div></td>`).join("")}
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function _tableHTML() {
    if (!_products.length) {
      return `
        <div class="ap-empty">
          <div style="font-size:48px">📦</div>
          <h3>No products found</h3>
          <p>Add your first product to get started</p>
          <button class="ap-add-btn" onclick="AdminProducts.openModal()">+ Add Product</button>
        </div>`;
    }

    const rows = _products
      .map(
        (p) => `
      <tr class="${!p.isActive ? "ap-row-inactive" : ""}" id="ap-row-${p.id}">
        <td>
          <div class="ap-thumb">
            <img src="${_getImage(p)}" alt="${p.name}" onerror="this.src='imagesCoffe/spinning_coffee_cup.png'">
          </div>
        </td>
        <td>
          <div class="ap-prod-name">${p.name}</div>
          ${p.badge ? `<span class="ap-badge">${p.badge}</span>` : ""}
        </td>
        <td><span class="ap-cat ap-cat-${p.category}">${_catLabel(p.category)}</span></td>
        <td class="ap-price">$${parseFloat(p.price).toFixed(2)}</td>
        <td>
          <span class="ap-stock ${p.stock === 0 ? "ap-stock-out" : p.stock < 5 ? "ap-stock-low" : ""}">
            ${p.stock}
          </span>
        </td>
        <td>
          <button
            class="ap-toggle-feat ${p.isFeatured ? "active" : ""}"
            onclick="AdminProducts.toggleFeatured('${p.id}', this)"
            title="${p.isFeatured ? "Remove from featured" : "Add to featured"}"
          >
            ${p.isFeatured ? "⭐ Featured" : "☆ Feature"}
          </button>
        </td>
        <td>
          <span class="ap-status ${p.isActive ? "active" : "inactive"}">
            ${p.isActive ? "Active" : "Inactive"}
          </span>
        </td>
        <td>
          <div class="ap-actions">
            <button class="ap-btn-edit" onclick="AdminProducts.openModal('${p.id}')">✏ Edit</button>
            <button class="ap-btn-del"  onclick="AdminProducts.deleteProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}')">🗑</button>
          </div>
        </td>
      </tr>
    `
      )
      .join("");

    return `
      <table class="ap-table">
        <thead>
          <tr>
            <th>Image</th><th>Name</th><th>Category</th>
            <th>Price</th><th>Stock</th><th>Featured</th>
            <th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function _renderPagination() {
    const el = document.getElementById("ap-pagination");
    if (!el || _totalPages <= 1) return;

    let html = "";
    if (_page > 1)
      html += `<button class="ap-page-btn" onclick="AdminProducts.goPage(${_page - 1})">← Prev</button>`;

    for (let i = 1; i <= _totalPages; i++) {
      if (i === 1 || i === _totalPages || (i >= _page - 1 && i <= _page + 1)) {
        html += `<button class="ap-page-btn ${i === _page ? "active" : ""}" onclick="AdminProducts.goPage(${i})">${i}</button>`;
      } else if (i === _page - 2 || i === _page + 2) {
        html += `<span class="ap-page-dots">…</span>`;
      }
    }

    if (_page < _totalPages)
      html += `<button class="ap-page-btn" onclick="AdminProducts.goPage(${_page + 1})">Next →</button>`;
    el.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════
     MODAL
  ══════════════════════════════════════════════════════ */
  function openModal(id = null) {
    _editId = id;
    const overlay = document.getElementById("ap-modal-overlay");
    const title = document.getElementById("ap-modal-title");
    const body = document.getElementById("ap-modal-body");
    if (!overlay || !title || !body) return;

    title.textContent = id ? "Edit Product" : "Add New Product";

    let product = null;
    if (id) {
      product = _products.find((p) => String(p.id) === String(id));
      if (!product) {
        showNotif("❌ Product not found");
        return;
      }
    }

    body.innerHTML = _formHTML(product);
    overlay.style.display = "flex";
    setTimeout(() => overlay.classList.add("open"), 10);
  }

  function closeModal(e) {
    if (e && e.target !== document.getElementById("ap-modal-overlay")) return;
    const overlay = document.getElementById("ap-modal-overlay");
    if (!overlay) return;
    overlay.classList.remove("open");
    setTimeout(() => {
      overlay.style.display = "none";
    }, 280);
    _editId = null;
  }

  function _formHTML(p) {
    const v = (field, fallback = "") => (p ? (p[field] ?? fallback) : fallback);
    const imgVal = p && p.images && p.images[0] ? p.images[0] : "";

    return `
      <div class="ap-form">
        <div class="ap-img-preview" id="ap-img-preview">
          ${
            imgVal
              ? `<img src="${imgVal}" onerror="this.style.display='none'">`
              : `<div class="ap-img-placeholder">📷 No Image</div>`
          }
        </div>

        <div class="ap-field">
          <label>Image URL</label>
          <input class="ap-input" id="ap-f-image" type="text"
            placeholder="https://... or imagesCoffe/name.png"
            value="${imgVal}"
            oninput="AdminProducts.previewImage(this.value)">
          <small style="color:var(--text-muted);font-size:10px">
            Enter full URL or relative path like <code>imagesCoffe/spinning_coffee_cup.png</code>
          </small>
        </div>

        <div class="ap-row">
          <div class="ap-field" style="flex:2">
            <label>Product Name *</label>
            <input class="ap-input" id="ap-f-name" type="text"
              placeholder="e.g. Premium Arabica Beans" value="${v("name")}">
          </div>
          <div class="ap-field" style="flex:1">
            <label>Category *</label>
            <select class="ap-input" id="ap-f-category">
              <option value="">Select…</option>
              <option value="coffee" ${v("category") === "coffee" ? "selected" : ""}>☕ Coffee</option>
              <option value="drinks" ${v("category") === "drinks" ? "selected" : ""}>🥤 Drinks</option>
              <option value="brass"  ${v("category") === "brass" ? "selected" : ""}>🏺 Brass</option>
            </select>
          </div>
        </div>

        <div class="ap-field">
          <label>Description *</label>
          <textarea class="ap-input ap-textarea" id="ap-f-desc"
            placeholder="Product description...">${v("description")}</textarea>
        </div>

        <div class="ap-row">
          <div class="ap-field">
            <label>Price ($) *</label>
            <input class="ap-input" id="ap-f-price" type="number"
              step="0.01" min="0" placeholder="0.00" value="${v("price")}">
          </div>
          <div class="ap-field">
            <label>Stock</label>
            <input class="ap-input" id="ap-f-stock" type="number"
              min="0" placeholder="0" value="${v("stock", 0)}">
          </div>
          <div class="ap-field">
            <label>Badge</label>
            <select class="ap-input" id="ap-f-badge">
              <option value="">None</option>
              ${["BESTSELLER", "NEW", "HOT", "PREMIUM", "SALE"]
                .map(
                  (b) =>
                    `<option value="${b}" ${v("badge") === b ? "selected" : ""}>${b}</option>`
                )
                .join("")}
            </select>
          </div>
        </div>

        <div class="ap-row" style="gap:20px;margin-top:4px">
          <label class="ap-checkbox-label">
            <input type="checkbox" id="ap-f-featured" ${v("isFeatured", false) ? "checked" : ""}>
            <span>⭐ Featured Product</span>
          </label>
          ${
            p
              ? `
            <label class="ap-checkbox-label">
              <input type="checkbox" id="ap-f-active" ${v("isActive", true) ? "checked" : ""}>
              <span>✅ Active (visible in store)</span>
            </label>
          `
              : ""
          }
        </div>

        <div class="ap-form-actions">
          <button class="ap-btn-cancel" onclick="AdminProducts.closeModal()">Cancel</button>
          <button class="ap-btn-save" onclick="AdminProducts.saveProduct()">
            ${p ? "💾 Save Changes" : "➕ Add Product"}
          </button>
        </div>
      </div>
    `;
  }

  /* ══════════════════════════════════════════════════════
     🔧 FIX #2 — SAVE: يحدّث apiProducts فوراً ثم يعيد التحميل
  ══════════════════════════════════════════════════════ */
  async function saveProduct() {
    const name = document.getElementById("ap-f-name")?.value.trim();
    const category = document.getElementById("ap-f-category")?.value;
    const desc = document.getElementById("ap-f-desc")?.value.trim();
    const price = document.getElementById("ap-f-price")?.value;
    const stock = document.getElementById("ap-f-stock")?.value;
    const badge = document.getElementById("ap-f-badge")?.value;
    const featured = document.getElementById("ap-f-featured")?.checked;
    const active = document.getElementById("ap-f-active")?.checked ?? true;
    const image = document.getElementById("ap-f-image")?.value.trim();

    if (!name) {
      showNotif("❌ Product name is required");
      return;
    }
    if (!category) {
      showNotif("❌ Please select a category");
      return;
    }
    if (!desc) {
      showNotif("❌ Description is required");
      return;
    }
    if (!price || isNaN(price) || parseFloat(price) <= 0) {
      showNotif("❌ Valid price is required");
      return;
    }

    const payload = {
      name,
      category,
      description: desc,
      price: parseFloat(price),
      stock: parseInt(stock) || 0,
      badge: badge || null,
      isFeatured: featured,
      isActive: active,
      images: image ? [image] : []
    };

    const saveBtn = document.querySelector(".ap-btn-save");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
    }

    try {
      let res;
      if (_editId) {
        res = await api.updateProduct(_editId, payload);
        if (res.success) {
          // 🔧 حدّث المنتج في apiProducts فوراً
          const updatedFormatted = _formatForStore({
            ...res.data,
            ...payload,
            id: _editId
          });
          const idx = apiProducts.findIndex(
            (p) => String(p.id) === String(_editId)
          );
          if (idx !== -1) {
            apiProducts[idx] = updatedFormatted;
          } else {
            apiProducts.push(updatedFormatted);
          }
          showNotif("✅ Product updated successfully!");
        }
      } else {
        res = await api.createProduct(payload);
        if (res.success) {
          // 🔧 أضف المنتج الجديد لـ apiProducts فوراً
          const newFormatted = _formatForStore(res.data);
          apiProducts.push(newFormatted);
          showNotif("✅ Product created successfully!");
        }
      }

      if (res.success) {
        closeModal();
        // أعد رسم الـ grids فوراً من apiProducts المحدّث
        _redrawAllGrids();
        // ثم حدّث جدول الأدمن
        await fetchProducts();
        // ثم حمّل من الباك للتأكيد
      await _forceReloadAll();
      }
    } catch (err) {
      console.error("saveProduct error:", err);
      showNotif(`❌ ${err.message || "Failed to save product"}`);
    }

    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = _editId ? "💾 Save Changes" : "➕ Add Product";
    }
  }


async function deleteProduct(id, name) {
  const confirmed = await _confirm(
    `Delete "${name}"?`,
    "This will hide the product from the store."
  );
  if (!confirmed) return;

  const row = document.getElementById(`ap-row-${id}`);

  // ── أوقف كل أزرار الحذف أثناء الـ animation ──
  document.querySelectorAll(".ap-btn-del").forEach((b) => (b.disabled = true));

  if (row) {
    row.classList.add("ap-deleting");

    row.addEventListener(
      "animationend",
      async () => {
        row.remove();

        // ── حذف من الـ state ──
        _products = _products.filter((p) => String(p.id) !== String(id));
        _removeFromGlobal(id);
        _redrawAllGrids();

        // ── animate الصفوف المتبقية ──
        const tbody = document.querySelector("#ap-table-wrap tbody");
        if (tbody) {
          const remaining = [...tbody.querySelectorAll('tr[id^="ap-row-"]')];
          remaining.forEach((tr, i) => {
            tr.classList.remove("ap-reflow");
            void tr.offsetWidth;
            tr.style.animationDelay = i * 35 + "ms";
            tr.classList.add("ap-reflow");
            tr.addEventListener(
              "animationend",
              () => {
                tr.classList.remove("ap-reflow");
                tr.style.animationDelay = "";
              },
              { once: true }
            );
          });
        }

        // ── أعد تفعيل الأزرار ──
        document
          .querySelectorAll(".ap-btn-del")
          .forEach((b) => (b.disabled = false));

        // ── API call في الخلفية ──
        try {
          await api.deleteProduct(id);
          showNotif(`🗑 "${name}" deleted`);
          await fetchProducts();
          await _forceReloadAll();
        } catch (err) {
          console.error("deleteProduct error:", err);
          showNotif(`❌ ${err.message || "Failed to delete product"}`);
          await fetchProducts();
          await _forceReloadAll();
        }
      },
      { once: true }
    );
  } else {
    // مفيش row ظاهر → امسح مباشرة
    _products = _products.filter((p) => String(p.id) !== String(id));
    _removeFromGlobal(id);
    _redrawAllGrids();
    document
      .querySelectorAll(".ap-btn-del")
      .forEach((b) => (b.disabled = false));
    try {
      await api.deleteProduct(id);
      showNotif(`🗑 "${name}" deleted`);
      await fetchProducts();
    } catch (err) {
      showNotif(`❌ ${err.message || "Failed to delete product"}`);
    }
  }
}

  /* ══════════════════════════════════════════════════════
     TOGGLE FEATURED
  ══════════════════════════════════════════════════════ */
  async function toggleFeatured(id, btnEl) {
    try {
      const res = await api.toggleProductFeatured(id);
      if (res.success) {
        const isFeat = res.data.isFeatured;
        btnEl.classList.toggle("active", isFeat);
        btnEl.textContent = isFeat ? "⭐ Featured" : "☆ Feature";
        showNotif(isFeat ? "⭐ Added to featured" : "☆ Removed from featured");

        // 🔧 حدّث في apiProducts بـ String comparison صحيح
        const p = apiProducts.find((p) => String(p.id) === String(id));
        if (p) p.isFeatured = isFeat;

        // أعد رسم featured grid فوراً
        _redrawAllGrids();

        // ثم حمّل من الباك
        if (typeof loadRealProducts === "function") loadRealProducts();
      }
    } catch (err) {
      console.error("toggleFeatured error:", err);
      showNotif("❌ Failed to update featured status");
    }
  }

  /* ══════════════════════════════════════════════════════
     SEARCH & FILTER
  ══════════════════════════════════════════════════════ */
  let _searchTimer = null;
  function onSearch(val) {
    clearTimeout(_searchTimer);
    _search = val;
    _page = 1;
    _searchTimer = setTimeout(() => fetchProducts(), 400);
  }

  function onCategoryFilter(val) {
    _category = val;
    _page = 1;
    fetchProducts();
  }

  function goPage(n) {
    _page = n;
    fetchProducts();
  }

  function refresh() {
    fetchProducts();
    _forceReloadAll();
  }

  /* ══════════════════════════════════════════════════════
     ADMIN NAV
  ══════════════════════════════════════════════════════ */
  // window.adminNavItem is now defined in main.js to handle Dashboard, Products, and Orders dynamically.

  /* ══════════════════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════════════════ */
  function _getImage(p) {
    const img = Array.isArray(p.images) && p.images[0] ? p.images[0] : "";
    if (!img) return "imagesCoffe/spinning_coffee_cup.png";
    if (img.startsWith("http") || img.startsWith("imagesCoffe/")) return img;
    return "imagesCoffe/" + img.split("/").pop();
  }

  function _catLabel(cat) {
    return (
      { coffee: "☕ Coffee", drinks: "🥤 Drinks", brass: "🏺 Brass" }[cat] ||
      cat
    );
  }

  function _confirm(title, msg) {
    return new Promise((resolve) => {
      document.getElementById("ap-confirm-overlay")?.remove();

      const el = document.createElement("div");
      el.id = "ap-confirm-overlay";
      el.innerHTML = `
        <div class="ap-confirm-box">
          <div class="ap-confirm-icon">⚠️</div>
          <h4>${title}</h4>
          <p>${msg}</p>
          <div class="ap-confirm-btns">
            <button class="ap-btn-cancel" id="ap-confirm-no">Cancel</button>
            <button class="ap-btn-del-confirm" id="ap-confirm-yes">Delete</button>
          </div>
        </div>
      `;
      document.body.appendChild(el);
      setTimeout(() => el.classList.add("open"), 10);

      const cleanup = (result) => {
        el.classList.remove("open");
        setTimeout(() => el.remove(), 280);
        resolve(result);
      };

      document.getElementById("ap-confirm-yes").onclick = () => cleanup(true);
      document.getElementById("ap-confirm-no").onclick = () => cleanup(false);
      el.onclick = (e) => {
        if (e.target === el) cleanup(false);
      };
    });
  }

  function previewImage(url) {
    const preview = document.getElementById("ap-img-preview");
    if (!preview) return;
    if (url) {
      preview.innerHTML = `<img src="${url}" onerror="this.style.opacity=0.3" style="opacity:1">`;
    } else {
      preview.innerHTML = `<div class="ap-img-placeholder">📷 No Image</div>`;
    }
  }

  /* ══════════════════════════════════════════════════════
     STYLES
  ══════════════════════════════════════════════════════ */
  function _injectStyles() {
    if (document.getElementById("ap-styles")) return;
    const style = document.createElement("style");
    style.id = "ap-styles";
    style.textContent = `
      .admin-products-section {
        background: var(--brown-card);
        border: 1px solid rgba(201,168,76,0.15);
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 28px;
      }
      .ap-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }
      .ap-title { font-size:18px; font-weight:700; color:var(--gold); margin:0 }
      .ap-sub   { font-size:12px; color:var(--text-muted); margin:4px 0 0 }

      .ap-add-btn {
        background: var(--gold);
        color: var(--brown-deep);
        border: none;
        border-radius: 8px;
        padding: 10px 18px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
        font-family: "Jost", sans-serif;
        transition: opacity .2s;
        white-space: nowrap;
      }
      .ap-add-btn:hover { opacity: .85 }

      .ap-filters {
        display: flex;
        gap: 10px;
        margin-bottom: 16px;
        flex-wrap: wrap;
        align-items: center;
      }
      .ap-search, .ap-cat-filter {
        background: var(--brown-mid);
        border: 1px solid rgba(201,168,76,0.2);
        border-radius: 8px;
        color: var(--text-primary);
        font-family: "Jost", sans-serif;
        font-size: 13px;
        padding: 8px 12px;
        outline: none;
        transition: border-color .2s;
      }
      .ap-search { flex: 1; min-width: 180px }
      .ap-search:focus, .ap-cat-filter:focus { border-color: var(--gold) }
      .ap-refresh-btn {
        background: rgba(201,168,76,0.1);
        border: 1px solid rgba(201,168,76,0.2);
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        transition: background .2s;
      }
      .ap-refresh-btn:hover { background: rgba(201,168,76,0.2) }

      .ap-table-wrap { overflow-x: auto; border-radius: 10px }
      .ap-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .ap-table thead tr {
        background: rgba(201,168,76,0.08);
        border-bottom: 1px solid rgba(201,168,76,0.15);
      }
      .ap-table th {
        padding: 10px 12px;
        text-align: left;
        color: var(--gold);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .5px;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .ap-table td {
        padding: 10px 12px;
        border-bottom: 1px solid rgba(201,168,76,0.06);
        color: var(--text-primary);
        vertical-align: middle;
        transition: opacity 0.3s, transform 0.3s;
      }
      .ap-table tbody tr:hover { background: rgba(201,168,76,0.04) }
      .ap-row-inactive { opacity: .5 }

      .ap-thumb {
        width: 44px; height: 44px;
        border-radius: 8px; overflow: hidden;
        background: rgba(201,168,76,0.08);
        flex-shrink: 0;
      }
      .ap-thumb img { width:100%; height:100%; object-fit:cover }

      .ap-prod-name { font-weight:600; font-size:13px; color:var(--text-primary) }
      .ap-badge {
        display: inline-block;
        font-size: 9px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(201,168,76,0.15);
        color: var(--gold);
        letter-spacing: .5px;
        margin-top: 3px;
      }

      .ap-cat {
        display: inline-block;
        padding: 3px 9px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
      }
      .ap-cat-coffee { background:rgba(139,90,43,.25); color:#C9A84C }
      .ap-cat-drinks { background:rgba(33,150,243,.15); color:#64B5F6 }
      .ap-cat-brass  { background:rgba(255,193,7,.12);  color:#FFD54F }

      .ap-price { font-weight:700; color:var(--gold) }
      .ap-stock { font-weight:600; font-size:12px; color:var(--text-primary) }
      .ap-stock-low { color:#EF9F27 }
      .ap-stock-out { color:#E53935 }

      .ap-toggle-feat {
        background: rgba(201,168,76,0.08);
        border: 1px solid rgba(201,168,76,0.2);
        border-radius: 6px;
        color: var(--text-muted);
        font-size: 11px;
        padding: 4px 9px;
        cursor: pointer;
        transition: all .2s;
        white-space: nowrap;
      }
      .ap-toggle-feat.active {
        background: rgba(201,168,76,0.18);
        border-color: var(--gold);
        color: var(--gold);
      }
      .ap-toggle-feat:hover { border-color: var(--gold); color:var(--gold) }

      .ap-status {
        display: inline-block;
        padding: 3px 9px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
      }
      .ap-status.active   { background:rgba(97,200,34,.12); color:#61C822 }
      .ap-status.inactive { background:rgba(255,0,0,.08);   color:#F44336 }

      .ap-actions { display:flex; gap:6px }
      .ap-btn-edit {
        background: rgba(201,168,76,0.1);
        border: 1px solid rgba(201,168,76,0.25);
        border-radius: 6px;
        color: var(--gold);
        font-size: 11px;
        padding: 5px 10px;
        cursor: pointer;
        font-family: "Jost", sans-serif;
        transition: all .2s;
        white-space: nowrap;
      }
      .ap-btn-edit:hover { background:rgba(201,168,76,0.2) }
      .ap-btn-del {
        background: rgba(244,67,54,0.08);
        border: 1px solid rgba(244,67,54,0.2);
        border-radius: 6px;
        color: #F44336;
        font-size: 13px;
        padding: 5px 8px;
        cursor: pointer;
        transition: all .2s;
      }
      .ap-btn-del:hover { background:rgba(244,67,54,0.16) }

      .ap-skeleton {
        height: 14px; border-radius: 6px;
        background: linear-gradient(90deg,
          rgba(201,168,76,0.06) 25%,
          rgba(201,168,76,0.14) 50%,
          rgba(201,168,76,0.06) 75%);
        background-size: 200% 100%;
        animation: ap-shimmer 1.4s infinite;
      }
      @keyframes ap-shimmer { to { background-position: -200% 0 } }

      .ap-empty {
        text-align: center; padding: 48px 20px;
        color: var(--text-muted);
      }
      .ap-empty h3 { color:var(--text-primary); margin:12px 0 6px }
      .ap-empty p  { font-size:13px; margin-bottom:18px }

      .ap-pagination {
        display: flex; gap: 6px; justify-content: center;
        align-items: center; margin-top: 16px; flex-wrap: wrap;
      }
      .ap-page-btn {
        background: rgba(201,168,76,0.08);
        border: 1px solid rgba(201,168,76,0.15);
        border-radius: 6px;
        color: var(--text-primary);
        font-size: 12px;
        padding: 6px 11px;
        cursor: pointer;
        transition: all .2s;
        font-family: "Jost", sans-serif;
      }
      .ap-page-btn:hover, .ap-page-btn.active {
        background: rgba(201,168,76,0.2);
        border-color: var(--gold);
        color: var(--gold);
      }
      .ap-page-dots { color:var(--text-muted); font-size:12px }

      .ap-modal-overlay {
        display: none;
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.7);
        z-index: 2000;
        align-items: center;
        justify-content: center;
        padding: 20px;
        backdrop-filter: blur(4px);
        opacity: 0;
        transition: opacity .28s;
      }
      .ap-modal-overlay.open { opacity: 1 }

      .ap-modal {
        background: var(--brown-card);
        border: 1px solid rgba(201,168,76,0.2);
        border-radius: 16px;
        width: 100%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        transform: translateY(20px);
        transition: transform .28s;
      }
      .ap-modal-overlay.open .ap-modal { transform: translateY(0) }

      .ap-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 18px 22px;
        border-bottom: 1px solid rgba(201,168,76,0.1);
        position: sticky; top: 0;
        background: var(--brown-card);
        z-index: 1;
      }
      .ap-modal-header h3 {
        font-family: "Playfair Display", serif;
        color: var(--gold); font-size:16px; margin:0
      }
      .ap-modal-close {
        background: none; border: none;
        color: var(--text-muted); font-size:18px;
        cursor: pointer; line-height:1;
        transition: color .2s;
      }
      .ap-modal-close:hover { color: var(--text-primary) }

      .ap-form { padding: 20px 22px }
      .ap-row  { display:flex; gap:12px; flex-wrap:wrap }
      .ap-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 14px;
        flex: 1;
        min-width: 140px;
      }
      .ap-field label {
        font-size: 11px;
        font-weight: 700;
        color: var(--text-muted);
        letter-spacing: .5px;
        text-transform: uppercase;
      }
      .ap-input {
        background: var(--brown-mid);
        border: 1px solid rgba(201,168,76,0.2);
        border-radius: 8px;
        color: var(--text-primary);
        font-family: "Jost", sans-serif;
        font-size: 13px;
        padding: 9px 12px;
        outline: none;
        transition: border-color .2s;
        width: 100%;
        box-sizing: border-box;
      }
      .ap-input:focus { border-color: var(--gold) }
      .ap-textarea { min-height: 80px; resize: vertical }

      .ap-img-preview {
        width: 100%; height: 140px;
        border-radius: 10px;
        background: rgba(201,168,76,0.05);
        border: 1px dashed rgba(201,168,76,0.2);
        display: flex; align-items:center; justify-content:center;
        margin-bottom: 14px; overflow: hidden;
      }
      .ap-img-preview img {
        width:100%; height:100%; object-fit:contain;
        transition: opacity .2s;
      }
      .ap-img-placeholder { color:var(--text-muted); font-size:13px }

      .ap-checkbox-label {
        display: flex; align-items:center; gap:8px;
        cursor: pointer; font-size:13px;
        color: var(--text-primary);
        user-select: none;
        margin-bottom: 14px;
      }
      .ap-checkbox-label input { accent-color: var(--gold); width:15px; height:15px }

      .ap-form-actions {
        display: flex; justify-content:flex-end;
        gap: 10px; margin-top: 8px;
        padding-top: 14px;
        border-top: 1px solid rgba(201,168,76,0.08);
      }
      .ap-btn-cancel {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        color: var(--text-muted);
        font-size: 13px; padding: 9px 18px;
        cursor: pointer; font-family:"Jost",sans-serif;
        transition: all .2s;
      }
      .ap-btn-cancel:hover { background:rgba(255,255,255,0.09) }
      .ap-btn-save {
        background: var(--gold);
        border: none; border-radius: 8px;
        color: var(--brown-deep);
        font-size: 13px; font-weight: 700;
        padding: 9px 22px;
        cursor: pointer; font-family:"Jost",sans-serif;
        transition: opacity .2s;
      }
      .ap-btn-save:hover   { opacity:.85 }
      .ap-btn-save:disabled { opacity:.5; cursor:not-allowed }

      #ap-confirm-overlay {
        position: fixed; inset:0;
        background: rgba(0,0,0,0.75);
        z-index: 3000;
        display: flex; align-items:center; justify-content:center;
        padding: 20px;
        opacity: 0; transition: opacity .28s;
      }
      #ap-confirm-overlay.open { opacity:1 }
      .ap-confirm-box {
        background: var(--brown-card);
        border: 1px solid rgba(201,168,76,0.2);
        border-radius: 14px;
        padding: 28px 28px 22px;
        max-width: 380px; width:100%;
        text-align: center;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        transform: scale(.95);
        transition: transform .28s;
      }
      #ap-confirm-overlay.open .ap-confirm-box { transform:scale(1) }
      .ap-confirm-icon { font-size:36px; margin-bottom:10px }
      .ap-confirm-box h4 { color:var(--text-primary); margin:0 0 8px; font-size:16px }
      .ap-confirm-box p  { color:var(--text-muted); font-size:13px; margin:0 0 20px }
      .ap-confirm-btns   { display:flex; gap:10px; justify-content:center }
      .ap-btn-del-confirm {
        background: #E53935; border:none; border-radius:8px;
        color:#fff; font-size:13px; font-weight:700;
        padding:9px 22px; cursor:pointer;
        font-family:"Jost",sans-serif;
        transition:opacity .2s;
      }
      .ap-btn-del-confirm:hover { opacity:.85 }

      @media (max-width:700px) {
        .ap-table th:nth-child(3),
        .ap-table td:nth-child(3),
        .ap-table th:nth-child(6),
        .ap-table td:nth-child(6) { display:none }
        .ap-header { flex-direction:column }
        .ap-add-btn { width:100%; text-align:center }
        .ap-row { flex-direction:column }
      }
    `;
    document.head.appendChild(style);
  }

  /* ══════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════ */
  return {
    render: () => {
      _renderTable();
      fetchProducts();
    },
    openModal,
    closeModal: (e) => closeModal(e),
    saveProduct,
    deleteProduct,
    toggleFeatured,
    onSearch,
    onCategoryFilter,
    goPage,
    refresh,
    previewImage,
    reloadStore: _forceReloadAll
  };
})();
