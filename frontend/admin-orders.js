/* ═══════════════════════════════════════════════════════════
   GODMODE STORE — admin-orders.js
   
   ═══════════════════════════════════════════════════════════ */

const AdminOrders = (() => {
  /* ── State ──────────────────────────────────────────── */
  let _orders = [];
  let _page = 1;
  let _totalPages = 1;
  let _search = "";
  let _status = "";
  let _loading = false;
  let _selectedOrder = null;

  const LIMIT = 10;

  /* ══════════════════════════════════════════════════════
     FETCH — جلب الطلبات من الباك اند
  ══════════════════════════════════════════════════════ */
  async function fetchOrders() {
    _loading = true;
    _renderTable();

    try {
      const params = { page: _page, limit: LIMIT };
      if (_search) params.search = _search; // Note: backend can filter if implemented, otherwise handled in search or client
      if (_status) params.status = _status;

      const res = await api.getAdminOrders(params);

      if (res.success) {
        _orders = res.data;
        _totalPages = Math.ceil((res.meta?.total || 0) / LIMIT);
      }
    } catch (err) {
      console.error("AdminOrders.fetchOrders:", err);
      showNotif("❌ Failed to load orders");
    }

    _loading = false;
    _renderTable();
    _renderPagination();
  }

  /* ══════════════════════════════════════════════════════
     RENDER — جدول الطلبات
  ══════════════════════════════════════════════════════ */
  function _renderTable() {
    const panel = document.getElementById("admin-orders-panel");
    if (!panel) return;

    panel.innerHTML = `
      <div class="admin-orders-section">

        <div class="ao-header">
          <div>
            <h2 class="ao-title">Orders Management</h2>
            <p class="ao-sub">Track, view details, and manage status of customer orders</p>
          </div>
        </div>

        <div class="ao-filters">
          <input
            class="ao-search"
            type="text"
            placeholder="🔍 Search orders by number or name..."
            value="${_search}"
            oninput="AdminOrders.onSearch(this.value)"
          >
          <select class="ao-status-filter" onchange="AdminOrders.onStatusFilter(this.value)">
            <option value="" ${!_status ? "selected" : ""}>All Statuses</option>
            <option value="PENDING" ${_status === "PENDING" ? "selected" : ""}>⏳ Pending</option>
            <option value="PAID" ${_status === "PAID" ? "selected" : ""}>💳 Paid</option>
            <option value="PROCESSING" ${_status === "PROCESSING" ? "selected" : ""}>⚙️ Processing</option>
            <option value="SHIPPED" ${_status === "SHIPPED" ? "selected" : ""}>🚚 Shipped</option>
            <option value="DELIVERED" ${_status === "DELIVERED" ? "selected" : ""}>✅ Delivered</option>
            <option value="CANCELLED" ${_status === "CANCELLED" ? "selected" : ""}>❌ Cancelled</option>
            <option value="REFUNDED" ${_status === "REFUNDED" ? "selected" : ""}>↩️ Refunded</option>
          </select>
          <button class="ao-refresh-btn" onclick="AdminOrders.refresh()" title="Refresh">
            🔄
          </button>
        </div>

        <div class="ao-table-wrap" id="ao-table-wrap">
          ${_loading ? _skeletonRows() : _tableHTML()}
        </div>

        <div id="ao-pagination" class="ao-pagination"></div>

      </div>

      <div class="ao-modal-overlay" id="ao-modal-overlay" onclick="AdminOrders.closeModal(event)">
        <div class="ao-modal" id="ao-modal" onclick="event.stopPropagation()">
          <div class="ao-modal-header">
            <h3 id="ao-modal-title">Order Details</h3>
            <button class="ao-modal-close" onclick="AdminOrders.closeModal()">✕</button>
          </div>
          <div id="ao-modal-body"></div>
        </div>
      </div>
    `;

    _renderPagination();
    _injectStyles();
  }

  function _skeletonRows() {
    return `
      <table class="ao-table">
        <thead><tr>
          <th>Order #</th><th>Customer</th><th>Date</th>
          <th>Total</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${Array(5)
            .fill(
              `
            <tr>
              ${Array(6).fill(`<td><div class="ao-skeleton"></div></td>`).join("")}
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function _tableHTML() {
    // Client-side search helper if backend search isn't complete
    let filteredOrders = _orders;
    if (_search) {
      const q = _search.toLowerCase();
      filteredOrders = _orders.filter(o => 
        o.orderNumber.toLowerCase().includes(q) ||
        (o.user && (o.user.firstName + " " + o.user.lastName).toLowerCase().includes(q)) ||
        (o.shippingName && o.shippingName.toLowerCase().includes(q))
      );
    }

    if (!filteredOrders.length) {
      return `
        <div class="ao-empty">
          <div style="font-size:48px">🛒</div>
          <h3>No orders found</h3>
          <p>When users place orders, they will show up here</p>
        </div>`;
    }

    const rows = filteredOrders
      .map(
        (o) => {
          const customerName = o.user ? `${o.user.firstName} ${o.user.lastName}` : o.shippingName || "Guest Customer";
          const dateStr = new Date(o.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });
          return `
            <tr id="ao-row-${o.id}">
              <td><strong>${o.orderNumber}</strong></td>
              <td>
                <div class="ao-cust-name">${customerName}</div>
                <div class="ao-cust-email">${o.user?.email || "No Email"}</div>
              </td>
              <td>${dateStr}</td>
              <td class="ao-price">$${parseFloat(o.total).toFixed(2)}</td>
              <td>
                <span class="status-badge status-${o.status.toLowerCase()}">
                  ${o.status}
                </span>
              </td>
              <td>
                <div class="ao-actions">
                  <button class="ao-btn-view" onclick="AdminOrders.openModal('${o.id}')">👁 View & Manage</button>
                </div>
              </td>
            </tr>
          `;
        }
      )
      .join("");

    return `
      <table class="ao-table">
        <thead>
          <tr>
            <th>Order #</th><th>Customer</th><th>Date</th>
            <th>Total</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function _renderPagination() {
    const el = document.getElementById("ao-pagination");
    if (!el || _totalPages <= 1) return;

    let html = "";
    if (_page > 1)
      html += `<button class="ao-page-btn" onclick="AdminOrders.goPage(${_page - 1})">← Prev</button>`;

    for (let i = 1; i <= _totalPages; i++) {
      if (i === 1 || i === _totalPages || (i >= _page - 1 && i <= _page + 1)) {
        html += `<button class="ao-page-btn ${i === _page ? "active" : ""}" onclick="AdminOrders.goPage(${i})">${i}</button>`;
      } else if (i === _page - 2 || i === _page + 2) {
        html += `<span class="ao-page-dots">…</span>`;
      }
    }

    if (_page < _totalPages)
      html += `<button class="ao-page-btn" onclick="AdminOrders.goPage(${_page + 1})">Next →</button>`;
    el.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════
     DETAILS MODAL
  ══════════════════════════════════════════════════════ */
  async function openModal(id) {
    const overlay = document.getElementById("ao-modal-overlay");
    const body = document.getElementById("ao-modal-body");
    if (!overlay || !body) return;

    body.innerHTML = `<div style="text-align:center;padding:40px;"><div class="ao-skeleton" style="width:50px;height:50px;margin:0 auto 15px;border-radius:50%"></div>Loading details...</div>`;
    overlay.style.display = "flex";
    setTimeout(() => overlay.classList.add("open"), 10);

    try {
      const res = await api.getAdminOrder(id);
      if (res.success) {
        _selectedOrder = res.data;
        body.innerHTML = _modalHTML(res.data);
      } else {
        body.innerHTML = `<div style="color:red;text-align:center;padding:20px;">❌ Failed to load details: ${res.message}</div>`;
      }
    } catch (err) {
      console.error(err);
      body.innerHTML = `<div style="color:red;text-align:center;padding:20px;">❌ Error loading details</div>`;
    }
  }

  function closeModal(e) {
    if (e && e.target !== document.getElementById("ao-modal-overlay")) return;
    const overlay = document.getElementById("ao-modal-overlay");
    if (!overlay) return;
    overlay.classList.remove("open");
    setTimeout(() => {
      overlay.style.display = "none";
    }, 280);
    _selectedOrder = null;
  }

  function _modalHTML(o) {
    const customerName = o.user ? `${o.user.firstName} ${o.user.lastName}` : o.shippingName || "Guest Customer";
    const dateStr = new Date(o.createdAt).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const itemsHTML = o.items.map(item => `
      <div class="ao-order-item-row">
        <div>
          <div class="ao-item-name">${item.productName}</div>
          <div class="ao-item-qty-price">${item.qty} × $${parseFloat(item.unitPrice).toFixed(2)}</div>
        </div>
        <div class="ao-item-total">$${parseFloat(item.totalPrice).toFixed(2)}</div>
      </div>
    `).join("");

    const statuses = ["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
    const statusOptions = statuses.map(s => 
      `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`
    ).join("");

    return `
      <div class="ao-details-grid">
        <div class="ao-details-col">
          <h4 class="ao-sec-title">General Info</h4>
          <table class="ao-info-table">
            <tr><td>Order Number:</td><td><strong>${o.orderNumber}</strong></td></tr>
            <tr><td>Date:</td><td>${dateStr}</td></tr>
            <tr><td>Customer:</td><td>${customerName}</td></tr>
            <tr><td>Email:</td><td>${o.user?.email || "No Email"}</td></tr>
            <tr><td>Phone:</td><td>${o.user?.phone || o.address?.phone || "No Phone"}</td></tr>
          </table>

          <h4 class="ao-sec-title" style="margin-top:20px;">Shipping Address</h4>
          <div class="ao-address-card">
            <strong>${o.shippingName || customerName}</strong><br>
            ${o.shippingStreet || "No Street Address"}<br>
            ${o.shippingCity || ""}, ${o.shippingZip || ""}<br>
            ${o.shippingCountry || "US"}
          </div>

          <h4 class="ao-sec-title" style="margin-top:20px;">Actions & Status</h4>
          <div class="ao-status-change-box">
            <label>Update Status:</label>
            <div class="d-flex gap-2 mt-1">
              <select id="ao-status-select" class="ao-input-select">
                ${statusOptions}
              </select>
              <button class="ao-btn-update-status" onclick="AdminOrders.saveStatus('${o.id}')">
                Save
              </button>
            </div>
          </div>
        </div>

        <div class="ao-details-col">
          <h4 class="ao-sec-title">Order Items</h4>
          <div class="ao-items-list-box">
            ${itemsHTML}
          </div>

          <div class="ao-summary-box">
            <div class="ao-sum-line"><span>Subtotal:</span><span>$${parseFloat(o.subtotal).toFixed(2)}</span></div>
            ${o.discountAmount > 0 ? `<div class="ao-sum-line" style="color:#61C822"><span>Discount:</span><span>-$${parseFloat(o.discountAmount).toFixed(2)}</span></div>` : ""}
            <div class="ao-sum-line"><span>Shipping:</span><span>${o.shippingCost === 0 ? "FREE" : `$${parseFloat(o.shippingCost).toFixed(2)}`}</span></div>
            <div class="ao-sum-line ao-sum-total"><span>Total:</span><span>$${parseFloat(o.total).toFixed(2)}</span></div>
          </div>

          ${o.notes ? `
            <h4 class="ao-sec-title" style="margin-top:15px; font-size:12px;">Notes</h4>
            <div class="ao-notes-box">${o.notes}</div>
          ` : ""}
        </div>
      </div>
    `;
  }

  /* ══════════════════════════════════════════════════════
     UPDATE STATUS
  ══════════════════════════════════════════════════════ */
  async function saveStatus(id) {
    const select = document.getElementById("ao-status-select");
    if (!select) return;
    const newStatus = select.value;

    const btn = document.querySelector(".ao-btn-update-status");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Updating...";
    }

    try {
      const res = await api.updateOrderStatus(id, newStatus);
      if (res.success) {
        showNotif(`✅ Order status updated to ${newStatus}`);
        
        // Update local state
        const idx = _orders.findIndex(o => o.id === id);
        if (idx !== -1) {
          _orders[idx].status = newStatus;
        }

        closeModal();
        _renderTable();
        
        // If Dashboard overview is initialized, reload it
        if (typeof initAdmin === "function") {
          initAdmin();
        }
      } else {
        showNotif(`❌ Failed: ${res.message}`);
      }
    } catch (err) {
      console.error(err);
      showNotif("❌ Error updating order status");
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = "Save";
    }
  }

  /* ══════════════════════════════════════════════════════
     FILTERS & SEARCH
  ══════════════════════════════════════════════════════ */
  let _searchTimer = null;
  function onSearch(val) {
    clearTimeout(_searchTimer);
    _search = val;
    _page = 1;
    _searchTimer = setTimeout(() => fetchOrders(), 300);
  }

  function onStatusFilter(val) {
    _status = val;
    _page = 1;
    fetchOrders();
  }

  function goPage(n) {
    _page = n;
    fetchOrders();
  }

  function refresh() {
    fetchOrders();
  }

  /* ══════════════════════════════════════════════════════
     STYLES
  ══════════════════════════════════════════════════════ */
  function _injectStyles() {
    if (document.getElementById("ao-styles")) return;
    const style = document.createElement("style");
    style.id = "ao-styles";
    style.textContent = `
      .admin-orders-section {
        background: var(--brown-card);
        border: 1px solid rgba(201,168,76,0.15);
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 28px;
      }
      .ao-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
        border-bottom: 1px solid rgba(201,168,76,0.08);
        padding-bottom: 16px;
      }
      .ao-title {
        font-family: 'Playfair Display', serif;
        color: var(--gold);
        font-size: 22px;
        margin-bottom: 4px;
      }
      .ao-sub {
        font-size: 13px;
        color: var(--text-muted);
        margin: 0;
      }
      .ao-filters {
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
        flex-wrap: wrap;
      }
      .ao-search {
        flex: 1;
        min-width: 200px;
        background: var(--brown-mid);
        border: 1px solid rgba(201,168,76,0.2);
        color: var(--text-primary);
        padding: 8px 14px;
        border-radius: 8px;
        font-size: 13px;
        outline: none;
      }
      .ao-search:focus {
        border-color: var(--gold);
      }
      .ao-status-filter {
        background: var(--brown-mid);
        border: 1px solid rgba(201,168,76,0.2);
        color: var(--gold);
        padding: 8px 14px;
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
        outline: none;
      }
      .ao-refresh-btn {
        background: var(--brown-mid);
        border: 1px solid rgba(201,168,76,0.2);
        color: var(--text-primary);
        width: 38px;
        height: 38px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: 0.2s;
      }
      .ao-refresh-btn:hover {
        background: var(--brown-hover);
        border-color: var(--gold);
      }
      .ao-table-wrap {
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid rgba(201,168,76,0.1);
      }
      .ao-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 13px;
      }
      .ao-table th {
        background: rgba(201,168,76,0.06);
        color: var(--gold);
        padding: 14px 16px;
        font-weight: 600;
        border-bottom: 1px solid rgba(201,168,76,0.1);
      }
      .ao-table td {
        padding: 14px 16px;
        border-bottom: 1px solid rgba(201,168,76,0.06);
        color: var(--text-primary);
        vertical-align: middle;
      }
      .ao-table tbody tr:hover td {
        background: rgba(255,255,255,0.01);
      }
      .ao-cust-name {
        font-weight: 600;
      }
      .ao-cust-email {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 2px;
      }
      .ao-price {
        font-family: 'Playfair Display', serif;
        font-weight: 700;
        color: var(--gold);
      }
      .ao-actions {
        display: flex;
        gap: 8px;
      }
      .ao-btn-view {
        background: transparent;
        border: 1px solid var(--gold);
        color: var(--gold);
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 11px;
        cursor: pointer;
        font-weight: 600;
        transition: 0.2s;
      }
      .ao-btn-view:hover {
        background: var(--gold);
        color: var(--brown-deep);
      }
      .ao-empty {
        text-align: center;
        padding: 48px 16px;
        color: var(--text-muted);
      }
      .ao-empty h3 {
        color: var(--text-primary);
        font-size: 18px;
        margin-top: 12px;
        margin-bottom: 4px;
      }
      .ao-pagination {
        display: flex;
        justify-content: center;
        gap: 6px;
        margin-top: 20px;
      }
      .ao-page-btn {
        background: var(--brown-mid);
        border: 1px solid rgba(201,168,76,0.15);
        color: var(--text-primary);
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        transition: 0.2s;
      }
      .ao-page-btn:hover, .ao-page-btn.active {
        border-color: var(--gold);
        color: var(--gold);
        background: var(--brown-hover);
      }
      .ao-page-dots {
        color: var(--text-muted);
        padding: 6px;
      }
      .ao-skeleton {
        height: 14px;
        background: rgba(255,255,255,0.05);
        border-radius: 4px;
        animation: ao-shimmer 1.5s infinite linear;
        position: relative;
        overflow: hidden;
      }
      .ao-skeleton::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, rgba(201,168,76,0.1), transparent);
        transform: translateX(-100%);
        animation: ao-shimmer-slide 1.5s infinite;
      }
      @keyframes ao-shimmer-slide {
        100% { transform: translateX(100%); }
      }
      
      /* Modal Styles */
      .ao-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.75);
        backdrop-filter: blur(8px);
        z-index: 1050;
        display: none;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .ao-modal-overlay.open {
        opacity: 1;
      }
      .ao-modal {
        background: var(--brown-dark);
        border: 1px solid rgba(201,168,76,0.25);
        border-radius: 16px;
        width: 90%;
        max-width: 800px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0,0,0,0.6);
        transform: scale(0.95);
        transition: transform 0.3s ease;
      }
      .ao-modal-overlay.open .ao-modal {
        transform: scale(1);
      }
      .ao-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        border-bottom: 1px solid rgba(201,168,76,0.15);
      }
      .ao-modal-header h3 {
        margin: 0;
        color: var(--gold);
        font-family: 'Playfair Display', serif;
        font-size: 18px;
      }
      .ao-modal-close {
        background: none;
        border: none;
        color: var(--text-muted);
        font-size: 18px;
        cursor: pointer;
      }
      .ao-modal-close:hover {
        color: var(--gold);
      }
      
      /* Detail Grid */
      .ao-details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        padding: 24px;
      }
      @media (max-width: 650px) {
        .ao-details-grid {
          grid-template-columns: 1fr;
        }
      }
      .ao-sec-title {
        color: var(--gold);
        font-size: 13px;
        letter-spacing: 1px;
        text-transform: uppercase;
        border-bottom: 1px solid rgba(201,168,76,0.1);
        padding-bottom: 6px;
        margin-bottom: 12px;
      }
      .ao-info-table {
        width: 100%;
        font-size: 12px;
      }
      .ao-info-table td {
        padding: 6px 0;
        color: var(--text-primary);
      }
      .ao-info-table td:first-child {
        color: var(--text-muted);
        width: 110px;
      }
      .ao-address-card {
        background: var(--brown-card);
        border: 1px solid rgba(201,168,76,0.1);
        border-radius: 8px;
        padding: 12px;
        font-size: 12px;
        line-height: 1.6;
        color: var(--text-primary);
      }
      .ao-status-change-box {
        background: rgba(201,168,76,0.04);
        border: 1px solid rgba(201,168,76,0.12);
        padding: 12px;
        border-radius: 8px;
        font-size: 12px;
      }
      .ao-input-select {
        flex: 1;
        background: var(--brown-mid);
        border: 1px solid rgba(201,168,76,0.25);
        color: var(--gold);
        border-radius: 6px;
        padding: 6px 10px;
        outline: none;
      }
      .ao-btn-update-status {
        background: var(--gold);
        color: var(--brown-deep);
        border: none;
        border-radius: 6px;
        padding: 6px 16px;
        font-weight: 700;
        cursor: pointer;
        transition: 0.2s;
      }
      .ao-btn-update-status:hover {
        background: var(--gold-light);
      }
      
      /* Order Items column */
      .ao-items-list-box {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid rgba(201,168,76,0.1);
        border-radius: 8px;
        padding: 8px 12px;
        background: var(--brown-card);
        margin-bottom: 14px;
      }
      .ao-order-item-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255,255,255,0.03);
        font-size: 12px;
      }
      .ao-order-item-row:last-child {
        border-bottom: none;
      }
      .ao-item-name {
        font-weight: 600;
        color: var(--text-primary);
      }
      .ao-item-qty-price {
        font-size: 10px;
        color: var(--text-muted);
        margin-top: 2px;
      }
      .ao-item-total {
        font-weight: 700;
        color: var(--gold);
      }
      
      .ao-summary-box {
        background: rgba(255,255,255,0.02);
        border-radius: 8px;
        padding: 12px;
      }
      .ao-sum-line {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        padding: 4px 0;
        color: var(--text-muted);
      }
      .ao-sum-line span:last-child {
        color: var(--text-primary);
      }
      .ao-sum-total {
        font-size: 14px;
        font-weight: 700;
        border-top: 1px solid rgba(201,168,76,0.15);
        padding-top: 8px;
        margin-top: 4px;
        color: var(--gold) !important;
      }
      .ao-sum-total span:last-child {
        color: var(--gold) !important;
      }
      .ao-notes-box {
        background: rgba(201,168,76,0.05);
        border-radius: 8px;
        padding: 10px;
        font-size: 11px;
        color: var(--text-primary);
        font-style: italic;
        line-height: 1.5;
      }
    `;
    document.head.appendChild(style);
  }

  /* ══════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════ */
  return {
    render: _renderTable,
    fetchOrders,
    onSearch,
    onStatusFilter,
    goPage,
    refresh,
    openModal,
    closeModal,
    saveStatus
  };
})();
