// api.js - GODMODE STORE API Client
const API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") 
  ? "http://localhost:4000/api/v1" 
  : "/api/v1";

class APIClient {
  constructor() {
    this.token = localStorage.getItem("gm_token");
  }

  async request(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...options.headers
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          return this.request(endpoint, options);
        }
        this.logout();
        throw new Error(data.message || "Session expired");
      }
      throw new Error(data.message || "API Error");
    }

    return data;
  }

  // ========== Token Refresh ==========
  async refreshToken() {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include"
      });
      const data = await response.json();
      if (data.success && data.data?.accessToken) {
        this.token = data.data.accessToken;
        localStorage.setItem("gm_token", this.token);
        return true;
      }
    } catch (e) {
      console.error("Refresh failed:", e);
    }
    return false;
  }

  // ========== Auth ==========
  async register(userData) {
    const data = await this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData)
    });
    if (data.data?.accessToken) {
      this.token = data.data.accessToken;
      localStorage.setItem("gm_token", this.token);
    }
    return data;
  }

  async login(email, password) {
    const data = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    if (data.data?.accessToken) {
      this.token = data.data.accessToken;
      localStorage.setItem("gm_token", this.token);
    }
    return data;
  }

  async logout() {
    try {
      await this.request("/auth/logout", { method: "POST" });
    } catch (e) {}
    this.token = null;
    localStorage.removeItem("gm_token");
    sessionStorage.removeItem("gm_user");
    localStorage.removeItem("gm_user");
  }

  async getMe() {
    return this.request("/auth/me");
  }

  async updateProfile(data) {
    return this.request("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data)
    });
  }

  async changePassword(currentPassword, newPassword) {
    return this.request("/auth/me/password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  async forgotPassword(email) {
    return this.request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  }

  async resetPassword(token, password) {
    return this.request(`/auth/reset-password/${token}`, {
      method: "POST",
      body: JSON.stringify({ password })
    });
  }

  // ========== Products ==========
  async getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/products${query ? "?" + query : ""}`);
  }
  async getProductsNoCache(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/products${query ? "?" + query : ""}`, {
      // headers: { "Cache-Control": "no-cache" }
    });
  }

  async getProduct(id) {
    return this.request(`/products/${id}`);
  }

  async getFeaturedProducts() {
    return this.request("/products/featured");
  }

  async searchProducts(q, filters = {}) {
    const params = new URLSearchParams({ q, ...filters }).toString();
    return this.request(`/products/search?${params}`);
  }

  async getProductReviews(productId, page = 1, limit = 10) {
    return this.request(
      `/products/${productId}/reviews?page=${page}&limit=${limit}`
    );
  }

  async addReview(productId, rating, comment) {
    return this.request(`/products/${productId}/reviews`, {
      method: "POST",
      body: JSON.stringify({ rating, comment })
    });
  }

  // ========== Cart ==========
  async getCart() {
    return this.request("/cart");
  }

  async addToCart(productId, qty = 1, options = {}) {
    return this.request("/cart", {
      method: "POST",
      body: JSON.stringify({ productId, qty, options })
    });
  }

  async updateCartItem(productId, qty) {
    return this.request(`/cart/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({ qty })
    });
  }

  async removeFromCart(productId) {
    return this.request(`/cart/${productId}`, { method: "DELETE" });
  }

  async clearCart() {
    return this.request("/cart", { method: "DELETE" });
  }

  async applyCoupon(code) {
    return this.request("/cart/coupon", {
      method: "POST",
      body: JSON.stringify({ code })
    });
  }

  async removeCoupon() {
    return this.request("/cart/coupon", { method: "DELETE" });
  }

  // ========== Orders ==========
  async createOrder(orderData) {
    return this.request("/orders", {
      method: "POST",
      body: JSON.stringify(orderData)
    });
  }

  async getMyOrders(page = 1, limit = 10) {
    return this.request(`/orders/my?page=${page}&limit=${limit}`);
  }

  async getMyOrder(orderId) {
    return this.request(`/orders/my/${orderId}`);
  }

  async createPaymentIntent(amount, orderId = null, currency = "usd") {
    return this.request("/orders/payment-intent", {
      method: "POST",
      body: JSON.stringify({ amount, currency, orderId })
    });
  }

  // ========== Addresses ==========
  async getAddresses() {
    return this.request("/addresses");
  }

  async createAddress(addressData) {
    return this.request("/addresses", {
      method: "POST",
      body: JSON.stringify(addressData)
    });
  }

  async updateAddress(id, addressData) {
    return this.request(`/addresses/${id}`, {
      method: "PUT",
      body: JSON.stringify(addressData)
    });
  }

  async deleteAddress(id) {
    return this.request(`/addresses/${id}`, { method: "DELETE" });
  }

  async setDefaultAddress(id) {
    return this.request(`/addresses/${id}/default`, { method: "PATCH" });
  }

  // ========== Admin ==========
  async getAdminDashboard() {
    return this.request("/admin/dashboard");
  }

  async getAdminUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/users${query ? "?" + query : ""}`);
  }

  async updateUserRole(userId, role) {
    return this.request(`/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role })
    });
  }

  async deleteUser(userId) {
    return this.request(`/admin/users/${userId}`, { method: "DELETE" });
  }

  async getAdminAnalytics() {
    return this.request("/admin/analytics");
  }

  async getAdminAuditLog(page = 1, limit = 50) {
    return this.request(`/admin/audit-log?page=${page}&limit=${limit}`);
  }

  async getAdminCoupons() {
    return this.request("/admin/coupons");
  }

  async createAdminCoupon(couponData) {
    return this.request("/admin/coupons", {
      method: "POST",
      body: JSON.stringify(couponData)
    });
  }

  async updateAdminCoupon(id, couponData) {
    return this.request(`/admin/coupons/${id}`, {
      method: "PATCH",
      body: JSON.stringify(couponData)
    });
  }

  async getAdminOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/orders${query ? "?" + query : ""}`);
  }

  async getAdminOrder(id) {
    return this.request(`/orders/${id}`);
  }

  async updateOrderStatus(id, status) {
    return this.request(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  }

  // ========== Admin Products ==========
  // ✅ هذه الدوال الجديدة — أضيفت في نهاية الـ Admin section

  async getAdminProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request("/admin/products" + (query ? "?" + query : ""));
  }

  async createProduct(productData) {
    return this.request("/admin/products", {
      method: "POST",
      body: JSON.stringify(productData)
    });
  }

  async updateProduct(id, productData) {
    return this.request("/admin/products/" + id, {
      method: "PATCH",
      body: JSON.stringify(productData)
    });
  }

  async deleteProduct(id) {
    return this.request("/admin/products/" + id, {
      method: "DELETE"
    });
  }

  async toggleProductFeatured(id) {
    return this.request("/admin/products/" + id + "/featured", {
      method: "PATCH"
    });
  }

  // ========== Chat ==========
  async sendChatMessage(message, sessionKey = null) {
    return this.request("/chat/message", {
      method: "POST",
      body: JSON.stringify({ message, sessionKey })
    });
  }

  async getChatSession(sessionKey) {
    return this.request(`/chat/session/${sessionKey}`);
  }

  async clearChatSession(sessionKey) {
    return this.request(`/chat/session/${sessionKey}`, { method: "DELETE" });
  }

  // ========== Upload ==========
  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append("avatar", file);

    const response = await fetch(`${API_BASE}/upload/avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
      body: formData,
      credentials: "include"
    });

    return response.json();
  }

  async uploadProductImages(files, productId = null) {
    const formData = new FormData();
    for (const file of files) {
      formData.append("images", file);
    }
    if (productId) {
      formData.append("productId", productId);
    }

    const response = await fetch(`${API_BASE}/upload/product-images`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
      body: formData,
      credentials: "include"
    });

    return response.json();
  }
}

// ========== Global Instance ==========
const api = new APIClient();

function isAuthenticated() {
  return !!localStorage.getItem("gm_token");
}

let chatSessionKey = localStorage.getItem("chat_session_key");
if (!chatSessionKey) {
  chatSessionKey = crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2);
  localStorage.setItem("chat_session_key", chatSessionKey);
}
