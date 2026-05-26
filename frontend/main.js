/* ═══════════════════════════════════════════════
   GODMODE STORE — main.js
   Vanilla JS Store Pattern — Fixed & API-Connected
═══════════════════════════════════════════════ */

/* ═══════════════ STORE ═══════════════ */
const Store = (() => {
  let state = {
    cart: {
      items: [],
      discountPercent: 0
    },
    ui: {
      currentPage: "home",
      previousPage: "home"
    },
    product: {
      currentId: null,
      currentPrice: 0,
      qty: 1
    },
    gallery: {
      index: 0,
      images: []
    },
    chat: {
      history: []
    },
    search: {
      query: "",
      category: "all",
      sort: "relevant",
      recentSearches: JSON.parse(localStorage.getItem("recentSearches") || "[]")
    }
  };

  const subscribers = {};
let _productsLoaded = false;
  return {
    getState: () => state,

    setState(slice, updater) {
      const prev = state[slice];
      state[slice] = { ...prev, ...updater(prev) };
      if (subscribers[slice]) {
        subscribers[slice].forEach((fn) => fn(state[slice]));
      }
    },

    subscribe(slice, fn) {
      if (!subscribers[slice]) subscribers[slice] = [];
      subscribers[slice].push(fn);
      return () => {
        subscribers[slice] = subscribers[slice].filter((f) => f !== fn);
      };
    }
  };
})();
/* ═══════════════ CART PERSISTENCE ═══════════════ */
const CART_KEY = "gm_cart_local";

// احفظ السلة في localStorage (للمستخدم غير المسجل)
function saveCartLocally() {
  const { items } = Store.getState().cart;
  // ensure ids are saved as strings to avoid type mismatches on merge
  const normalized = items.map((it) => ({ ...it, id: String(it.id) }));
  localStorage.setItem(CART_KEY, JSON.stringify(normalized));
}

// حمّل السلة من localStorage
function loadCartLocally() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

// امسح السلة المحلية بعد الدمج
function clearLocalCart() {
  localStorage.removeItem(CART_KEY);
}

// هل المستخدم مسجل دخول؟
function isUserLoggedIn() {
  return !!(
    localStorage.getItem("gm_token") &&
    (JSON.parse(localStorage.getItem("gm_user") || "null") ||
      JSON.parse(sessionStorage.getItem("gm_user") || "null"))
  );
}
/* ═══════════════ API PRODUCTS (Single Source of Truth) ═══════════════ */
// FIX: apiProducts هو المصدر الوحيد — لا يوجد products[] ثابتة بعد الآن
let apiProducts = [];
let isLoadingProducts = false;

/* ═══════════════ DATA ═══════════════ */
// FIX: هذه البيانات تُستخدم فقط كـ Fallback عند فشل الباك (Offline mode)
const productsFallback = [
  {
    id: 1,
    name: "Premium Arabica Beans",
    price: 16.99,
    image: "imagesCoffe/spinning_coffee_cup.png",
    rating: "★★★★★",
    reviews: 128,
    badge: "BESTSELLER",
    cat: "coffee",
    desc: "100% Arabica beans from the finest Colombian highlands. Rich, smooth flavor with notes of chocolate and caramel."
  },
  {
    id: 2,
    name: "Cold Brew Coffee",
    price: 4.99,
    image: "imagesCoffe/iced_black_coffee.png",
    rating: "★★★★★",
    reviews: 89,
    badge: null,
    cat: "coffee",
    desc: "Smooth cold brew concentrate, steeped for 18 hours for the perfect bold flavor."
  },
  {
    id: 3,
    name: "Brass Coffee Pot",
    price: 49.99,
    image: "imagesCoffe/arabic_coffee_pot.png",
    rating: "★★★★☆",
    reviews: 64,
    badge: "NEW",
    cat: "brass",
    desc: "Handcrafted traditional brass coffee pot with intricate engravings. A timeless piece for your kitchen."
  },
  {
    id: 4,
    name: "Cappuccino To-Go",
    price: 3.99,
    image: "imagesCoffe/latte_art_cup.png",
    rating: "★★★★★",
    reviews: 95,
    badge: null,
    cat: "drinks",
    desc: "Creamy Italian-style cappuccino, made fresh and ready to take anywhere you go."
  },
  {
    id: 5,
    name: "Brass Decorative Bowl",
    price: 29.99,
    image: "imagesCoffe/traditional_brass_bowl.png",
    rating: "★★★★☆",
    reviews: 43,
    badge: null,
    cat: "brass",
    desc: "Elegant decorative brass bowl, perfect as a centerpiece or for holding small items."
  },
  {
    id: 6,
    name: "Mango Smoothie",
    price: 5.49,
    image: "imagesCoffe/iced_orange_juice.png",
    rating: "★★★★★",
    reviews: 77,
    badge: "HOT",
    cat: "drinks",
    desc: "Fresh mango blended with yogurt and a hint of honey. Tropical and refreshing."
  },
  {
    id: 7,
    name: "Ethiopian Yirgacheffe",
    price: 18.99,
    image: "imagesCoffe/luxury_coffee_bags.png",
    rating: "★★★★★",
    reviews: 112,
    badge: "PREMIUM",
    cat: "coffee",
    desc: "Single-origin Ethiopian beans with floral, fruity notes. Light roast, complex and bright."
  },
  {
    id: 8,
    name: "Cold Brew Starter Set",
    price: 34.99,
    image: "imagesCoffe/coffee_preparation.png",
    rating: "★★★★☆",
    reviews: 58,
    badge: null,
    cat: "coffee",
    desc: "Everything you need to make perfect cold brew at home. Includes jar, filter, and guide."
  },
  {
    id: 9,
    name: "Mango Lassi",
    price: 4.49,
    image: "imagesCoffe/pink_drink.png",
    rating: "★★★★☆",
    reviews: 34,
    badge: null,
    cat: "drinks",
    desc: "Classic Indian-style mango lassi with fresh mango, yogurt, and a pinch of cardamom."
  },
  {
    id: 10,
    name: "Copper Coffee Mug",
    price: 22.99,
    image: "imagesCoffe/golden_coffee_cup.png",
    rating: "★★★★★",
    reviews: 87,
    badge: null,
    cat: "brass",
    desc: "Pure copper mug that keeps your coffee hot longer. Naturally antimicrobial and beautiful."
  },
  {
    id: 11,
    name: "Tropical Smoothie",
    price: 5.99,
    image: "imagesCoffe/red_cold_drink.png",
    rating: "★★★★☆",
    reviews: 45,
    badge: "NEW",
    cat: "drinks",
    desc: "A blend of pineapple, coconut, and mango — a tropical vacation in every sip."
  },
  {
    id: 12,
    name: "Brass Incense Holder",
    price: 19.99,
    image: "imagesCoffe/silver_traditional_pot.png",
    rating: "★★★★☆",
    reviews: 29,
    badge: null,
    cat: "brass",
    desc: "Beautifully crafted brass incense holder with geometric patterns. Adds elegance to any room."
  }
];

const productImages = {
  1: [
    "imagesCoffe/spinning_coffee_cup.png",
    "imagesCoffe/luxury_coffee_bags.png",
    "imagesCoffe/coffee_preparation.png",
    "imagesCoffe/iced_black_coffee.png"
  ],
  2: [
    "imagesCoffe/iced_black_coffee.png",
    "imagesCoffe/spinning_coffee_cup.png",
    "imagesCoffe/coffee_preparation.png"
  ],
  3: [
    "imagesCoffe/arabic_coffee_pot.png",
    "imagesCoffe/silver_traditional_pot.png",
    "imagesCoffe/golden_coffee_cup.png"
  ],
  4: [
    "imagesCoffe/latte_art_cup.png",
    "imagesCoffe/iced_black_coffee.png",
    "imagesCoffe/pink_drink.png"
  ],
  5: [
    "imagesCoffe/traditional_brass_bowl.png",
    "imagesCoffe/arabic_coffee_pot.png",
    "imagesCoffe/golden_coffee_cup.png"
  ],
  6: [
    "imagesCoffe/iced_orange_juice.png",
    "imagesCoffe/pink_drink.png",
    "imagesCoffe/red_cold_drink.png"
  ],
  7: [
    "imagesCoffe/luxury_coffee_bags.png",
    "imagesCoffe/luxury_coffee_bag2.png",
    "imagesCoffe/spinning_coffee_cup.png"
  ],
  8: [
    "imagesCoffe/coffee_preparation.png",
    "imagesCoffe/spinning_coffee_cup.png",
    "imagesCoffe/iced_black_coffee.png"
  ],
  9: [
    "imagesCoffe/pink_drink.png",
    "imagesCoffe/iced_orange_juice.png",
    "imagesCoffe/red_cold_drink.png"
  ],
  10: [
    "imagesCoffe/golden_coffee_cup.png",
    "imagesCoffe/arabic_coffee_pot.png",
    "imagesCoffe/silver_traditional_pot.png"
  ],
  11: [
    "imagesCoffe/red_cold_drink.png",
    "imagesCoffe/red_cold_drink2.png",
    "imagesCoffe/pink_drink.png"
  ],
  12: [
    "imagesCoffe/silver_traditional_pot.png",
    "imagesCoffe/arabic_coffee_pot.png",
    "imagesCoffe/traditional_brass_bowl.png"
  ]
};

/* ═══════════════ HELPER: مصدر المنتجات ═══════════════ */
function getProductsSource() {
  if (apiProducts.length > 0) return apiProducts.filter((p) => p.isActive !== false);
  // ارجع fallback فقط لو لم يتم أي تحميل بعد (أول load)
  if (!_productsLoaded) return productsFallback;
  // بعد أي load ناجح → ارجع array فاضي (لا تُظهر fallback)
  return [];
}

/* ═══════════════ GALLERY ═══════════════ */
function renderGallery(badge) {
  const { images, index } = Store.getState().gallery;
  return `
    <div class="gallery-main">
      <div class="gallery-badge">${badge}</div>
      <img id="gallery-main-img" src="${images[index]}" alt="product">
      <button class="gallery-arrow prev" onclick="galleryNav(-1)">‹</button>
      <button class="gallery-arrow next" onclick="galleryNav(1)">›</button>
    </div>
    <div class="gallery-thumbs" id="gallery-thumbs">
      ${images
        .map(
          (src, i) => `
        <div class="gallery-thumb ${i === 0 ? "active" : ""}" onclick="gallerySet(${i})">
          <img src="${src}" alt="thumb ${i + 1}">
        </div>
      `
        )
        .join("")}
    </div>
  `;
}
window.quickAddToCart = function (id, price) {
  Store.setState("product", () => ({
    currentId: String(id),
    currentPrice: price,
    qty: 1
  }));
  addToCart();
};
window.clearRecentSearches = function () {
  Store.setState("search", () => ({ recentSearches: [] }));
  localStorage.setItem("recentSearches", "[]");
  renderDropdown("");
};
function gallerySet(i) {
  Store.setState("gallery", () => ({ index: i }));
  const mainImg = document.getElementById("gallery-main-img");
  if (!mainImg) return;
  mainImg.style.opacity = "0";
  mainImg.style.transform = "scale(0.97)";
  setTimeout(() => {
    mainImg.src = Store.getState().gallery.images[i];
    mainImg.style.opacity = "1";
    mainImg.style.transform = "scale(1)";
  }, 180);
  document
    .querySelectorAll(".gallery-thumb")
    .forEach((t, idx) => t.classList.toggle("active", idx === i));
}

function galleryNav(dir) {
  const { images, index } = Store.getState().gallery;
  gallerySet((index + dir + images.length) % images.length);
}

/* ═══════════════ MOBILE NAV ═══════════════ */
function openMobileNav() {
  document.getElementById("mobile-nav").classList.add("open");
  document.getElementById("nav-overlay").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeMobileNav() {
  document.getElementById("mobile-nav").classList.remove("open");
  document.querySelectorAll(".sidebar.open").forEach((s) => s.classList.remove("open"));
  document.getElementById("nav-overlay").classList.remove("open");
  document.body.style.overflow = "";
}

function toggleSidebar(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.toggle("open");
    if (el.classList.contains("open")) {
      document.getElementById("nav-overlay").classList.add("open");
      document.body.style.overflow = "hidden";
    } else {
      document.getElementById("nav-overlay").classList.remove("open");
      document.body.style.overflow = "";
    }
  }
}

/* ═══════════════ RENDER PRODUCTS ═══════════════ */
function showSkeletons(containerId, count = 6) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array(count)
    .fill(
      `
    <div class="skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line short" style="margin-bottom:14px"></div>
    </div>
  `
    )
    .join("");
}

function renderProducts(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">No products found.</div>`;
    return;
  }
  el.innerHTML = items
    .map(
      (p) => `
    <div class="product-card" data-id="${p.id}">
      <div class="product-img">
        ${p.badge ? `<div class="product-badge">${p.badge}</div>` : ""}
        <img src="${p.image}" loading="lazy" style="width:100%;height:100%;object-fit:cover">
      </div>
      <div class="product-info">
        <h4>${p.name}</h4>
        <div class="product-price">$${p.price.toFixed(2)}</div>
        <div class="product-rating">
          <span class="stars">${p.rating}</span>
          <span class="rating-count">(${p.reviews})</span>
        </div>
      </div>
      <button class="product-add-btn" data-id="${p.id}" data-price="${p.price}">
        + ADD TO CART
      </button>
    </div>
  `
    )
    .join("");

  // Event delegation بدل inline onclick
  el.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".product-add-btn")) return;
      showProductDetail(card.dataset.id);
    });
  });

  el.querySelectorAll(".product-add-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      quickAddToCart(btn.dataset.id, parseFloat(btn.dataset.price));
    });
  });
  if (typeof applyVisualsToContainer === "function") {
    applyVisualsToContainer(el);
  }
}

function renderRelated(currentId, cat) {
  const el = document.getElementById("related-grid");
  if (!el) return;
  const source = getProductsSource();
  let related = source.filter((p) => p.cat === cat && String(p.id) !== String(currentId));
  if (related.length < 4) {
    const others = source.filter((p) => p.cat !== cat && String(p.id) !== String(currentId));
    related = [...related, ...others].slice(0, 4);
  } else {
    related = related.slice(0, 4);
  }

  el.innerHTML = related
    .map(
      (p) => `
    <div class="product-card" data-id="${p.id}" style="cursor:pointer">
      <div class="product-img">
        ${p.badge ? `<div class="product-badge">${p.badge}</div>` : ""}
        <img src="${p.image}" loading="lazy" style="width:100%;height:100%;object-fit:cover">
      </div>
      <div class="product-info">
        <h4>${p.name}</h4>
        <div class="product-price">$${p.price.toFixed(2)}</div>
        <div class="product-rating">
          <span class="stars">${p.rating}</span>
          <span class="rating-count">(${p.reviews})</span>
        </div>
      </div>
      <button class="product-add-btn" data-id="${p.id}" data-price="${p.price}">
        + ADD TO CART
      </button>
    </div>
  `
    )
    .join("");

  el.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".product-add-btn")) return;
      showProductDetail(card.dataset.id);
    });
  });

  el.querySelectorAll(".product-add-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      quickAddToCart(btn.dataset.id, parseFloat(btn.dataset.price));
    });
  });
  if (typeof applyVisualsToContainer === "function") {
    applyVisualsToContainer(el);
  }
}

function renderSmallProducts() {
  const source = getProductsSource();

  // Coffee
  const elCoffee = document.getElementById("small-products");
  if (elCoffee) {
    const coffeeItems = source.filter((p) => p.cat === "coffee").slice(0, 4);
    elCoffee.innerHTML = coffeeItems
      .map(
        (p) => `
      <div class="small-product" onclick="showProductDetail(${p.id})">
        <div class="sp-img" style="overflow:hidden;padding:0">
          <img src="${p.image}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:8px">
        </div>
        <div class="sp-name">${p.name}</div>
        <div class="sp-price">$${p.price.toFixed(2)}</div>
      </div>
    `
      )
      .join("");
  }

  // Drinks
  const elDrinks = document.getElementById("drinks-small-products");
  if (elDrinks) {
    const drinkItems = source.filter((p) => p.cat === "drinks").slice(0, 4);
    elDrinks.innerHTML = drinkItems
      .map(
        (p) => `
      <div class="small-product" onclick="showProductDetail(${p.id})">
        <div class="sp-img" style="overflow:hidden;padding:0">
          <img src="${p.image}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:8px">
        </div>
        <div class="sp-name">${p.name}</div>
        <div class="sp-price">$${p.price.toFixed(2)}</div>
      </div>
    `
      )
      .join("");
  }

  // Brass
  const elBrass = document.getElementById("brass-small-products");
  if (elBrass) {
    const brassItems = source.filter((p) => p.cat === "brass").slice(0, 4);
    elBrass.innerHTML = brassItems
      .map(
        (p) => `
      <div class="small-product" onclick="showProductDetail(${p.id})">
        <div class="sp-img" style="overflow:hidden;padding:0">
          <img src="${p.image}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:8px">
        </div>
        <div class="sp-name">${p.name}</div>
        <div class="sp-price">$${p.price.toFixed(2)}</div>
      </div>
    `
      )
      .join("");
  }
}

/* ═══════════════ SORT & FILTER ═══════════════ */
// FIX: جميع دوال الفلترة والترتيب تستخدم getProductsSource()
function sortProducts(gridId, cat) {
  const sortEl = document.querySelector(`#page-${cat} .sort-select`);
  if (!sortEl) return;
  const val = sortEl.value;
  let items = getProductsSource().filter((p) => p.cat === cat);
  if (val === "low") items.sort((a, b) => a.price - b.price);
  else if (val === "high") items.sort((a, b) => b.price - a.price);
  renderProducts(gridId, items);
}

function filterProducts(cat, btn) {
  document
    .querySelectorAll(".filter-tab")
    .forEach((t) => t.classList.remove("active"));
  if (btn) btn.classList.add("active");
  const source = getProductsSource();
  const items = cat === "all" ? source : source.filter((p) => p.cat === cat);
  renderProducts("featured-grid", items);
}

function sidebarFilter(el, subcat, gridId, parentCat) {
  el.closest(".sidebar")
    .querySelectorAll(".sidebar-cat")
    .forEach((c) => c.classList.remove("active"));
  el.classList.add("active");

  if (!gridId) return;
  const source = getProductsSource();

  let items;
  if (subcat === parentCat || subcat === 'all') {
    // Show all products in this main category
    items = source.filter((p) => p.cat === parentCat);
  } else {
    // Filter by sub-category keyword (search in name, desc, or badge)
    items = source.filter((p) => {
      if (p.cat !== parentCat) return false;
      const haystack = ((p.name || '') + ' ' + (p.desc || '') + ' ' + (p.badge || '')).toLowerCase();
      return haystack.includes(subcat.toLowerCase());
    });
  }

  renderProducts(gridId, items);
}

function filterByPrice() {
  const maxPrice = parseFloat(
    document.getElementById("coffee-price-range").value
  );
  const items = getProductsSource().filter(
    (p) => p.cat === "coffee" && p.price <= maxPrice
  );
  renderProducts("coffee-grid", items);
}

function filterDrinksByPrice() {
  const rangeEl = document.getElementById("drinks-price-range");
  if (!rangeEl) return;
  const maxPrice = parseFloat(rangeEl.value);
  const items = getProductsSource().filter(
    (p) => p.cat === "drinks" && p.price <= maxPrice
  );
  renderProducts("drinks-grid", items);
}

function filterBrassByPrice() {
  const rangeEl = document.getElementById("brass-price-range");
  if (!rangeEl) return;
  const maxPrice = parseFloat(rangeEl.value);
  const items = getProductsSource().filter(
    (p) => p.cat === "brass" && p.price <= maxPrice
  );
  renderProducts("brass-grid", items);
}

/* ═══════════════ SEARCH ═══════════════ */
function handleSearch(val) {
  if (!val.trim()) return;

  const { recentSearches } = Store.getState().search;
  const updated = [val, ...recentSearches.filter((r) => r !== val)].slice(0, 6);

  Store.setState("search", () => ({
    query: val.trim(),
    category: "all",
    sort: "relevant",
    recentSearches: updated
  }));

  localStorage.setItem("recentSearches", JSON.stringify(updated));

  document
    .querySelectorAll(".search-filter-tab")
    .forEach((t) => t.classList.remove("active"));
  const firstTab = document.querySelector(".search-filter-tab");
  if (firstTab) firstTab.classList.add("active");
  const sortSel = document.getElementById("search-sort-select");
  if (sortSel) sortSel.value = "relevant";

  runSearch();
  showPage("search");
}

function runSearch() {
  const { query, category, sort } = Store.getState().search;
  const q = query.toLowerCase();

  // FIX: دائمًا من getProductsSource()
  const source = getProductsSource();

  let results = source.filter((p) => {
    const matchQ =
      p.name.toLowerCase().includes(q) ||
      (p.desc && p.desc.toLowerCase().includes(q)) ||
      p.cat.toLowerCase().includes(q);
    const matchCat = category === "all" || p.cat === category;
    return matchQ && matchCat;
  });

  if (sort === "low") results.sort((a, b) => a.price - b.price);
  if (sort === "high") results.sort((a, b) => b.price - a.price);
  if (sort === "rating") results.sort((a, b) => b.reviews - a.reviews);

  renderSearchResults(results);
}

function renderSearchResults(results) {
  const grid = document.getElementById("search-results-grid");
  const countEl = document.getElementById("search-count");
  const queryEl = document.getElementById("search-query-display");
  if (!grid) return;

  const { query } = Store.getState().search;
  if (queryEl) queryEl.textContent = query;
  if (countEl) countEl.textContent = results.length;

  if (!results.length) {
    grid.innerHTML = `
      <div class="search-empty">
        <div class="icon">🔍</div>
        <h3>No results found</h3>
        <p>Try different keywords or browse our categories</p>
        <button onclick="showPage(Store.getState().ui.previousPage)">← Back</button>
      </div>`;
    return;
  }

  grid.innerHTML = results
    .map(
      (p) => `
  <div class="product-card" data-id="${p.id}">
    <div class="product-img">
      ${p.badge ? `<div class="product-badge">${p.badge}</div>` : ""}
      <img src="${p.image}" loading="lazy" style="width:100%;height:100%;object-fit:cover">
    </div>
    <div class="product-info">
      <h4>${p.name}</h4>
      <div class="product-price">$${p.price.toFixed(2)}</div>
      <div class="product-rating">
        <span class="stars">${p.rating}</span>
        <span class="rating-count">(${p.reviews})</span>
      </div>
    </div>
    <button class="product-add-btn" data-id="${p.id}" data-price="${p.price}">
      + ADD TO CART
    </button>
  </div>
`
    )
    .join("");

  grid.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".product-add-btn")) return;
      showProductDetail(card.dataset.id);
    });
  });

  grid.querySelectorAll(".product-add-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      quickAddToCart(btn.dataset.id, parseFloat(btn.dataset.price));
    });
  });
  if (typeof applyVisualsToContainer === "function") {
    applyVisualsToContainer(grid);
  }
}

function searchFilter(cat, btn) {
  Store.setState("search", () => ({ category: cat }));
  document
    .querySelectorAll(".search-filter-tab")
    .forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  runSearch();
}

function searchSort() {
  const val = document.getElementById("search-sort-select").value;
  Store.setState("search", () => ({ sort: val }));
  runSearch();
}

/* ═══════════════ PAGES ═══════════════ */
const validPages = [
  "home",
  "coffee",
  "drinks",
  "brass",
  "product",
  "cart",
  "checkout",
  "admin",
  "chatbot",
  "success",
  "404",
  "search",
  "about"
];

/* ═══════════════ PRODUCT DETAIL ═══════════════ */
window.showProductDetail = async function (id, skipNavigate = false) {
  // FIX: ابحث في getProductsSource() أولًا
  let product = getProductsSource().find((p) => p.id == id);

  // إذا لم نجد، اجلب من API مباشرة
  if (!product) {
    try {
      const response = await api.getProduct(id);
      if (response.success && response.data) {
        const p = response.data;
        product = {
          id: p.id,
          name: p.name,
          price: parseFloat(p.price),
          image: p.images?.[0] || "/uploads/placeholder.png",
          rating: "★★★★★",
          reviews: p.reviewCount || 0,
          badge: p.badge,
          cat: p.category,
          desc: p.description
        };
        // أضفه لـ apiProducts حتى لا نجلبه مرة أخرى
        apiProducts.push(product);
      }
    } catch (error) {
      console.error("Failed to load product:", error);
      showNotif("❌ Failed to load product details");
      return;
    }
  }

  if (!product) return;

  Store.setState("product", () => ({
    currentId: String(id),
    currentPrice: product.price,
    qty: 1
  }));

  // Build image array from API images or fallback — deduplicated
  let images;
  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    // Use API images, clean /uploads/ paths, remove duplicates
    const seen = new Set();
    images = product.images
      .map(img => img.startsWith('/uploads/') ? 'imagesCoffe/' + img.split('/').pop() : img)
      .filter(img => { if (seen.has(img)) return false; seen.add(img); return true; });
  } else if (productImages[id]) {
    // Use hardcoded fallback map (already unique per product)
    images = productImages[id];
  } else {
    // Last resort: single image, no duplication
    images = [product.image];
  }
  Store.setState("gallery", () => ({
    index: 0,
    images: images
  }));

  document.getElementById("detail-name").textContent = product.name;
  document.getElementById("detail-breadcrumb").textContent = product.name;
  document.getElementById("detail-price").textContent =
    "$" + product.price.toFixed(2);
  document.getElementById("detail-desc").textContent = product.desc;
  document.getElementById("detail-reviews").textContent =
    `(${product.reviews} reviews)`;
  document.getElementById("qty-display").textContent = 1;
  document.getElementById("detail-image").innerHTML = renderGallery(
    product.badge || "PREMIUM"
  );

  document
    .querySelectorAll("#detail-size-chips .option-chip")
    .forEach((c, i) => c.classList.toggle("active", i === 0));
  document
    .querySelectorAll("#detail-opt1-chips .option-chip")
    .forEach((c, i) => c.classList.toggle("active", i === 0));

  renderRelated(id, product.cat);
  if (!skipNavigate) Router.navigate("product", id);
};

function changeQty(d) {
  const current = Store.getState().product.qty;
  const next = Math.max(1, current + d);
  Store.setState("product", () => ({ qty: next }));
  document.getElementById("qty-display").textContent = next;
}

function selectSize(el, price) {
  document
    .querySelectorAll("#detail-size-chips .option-chip")
    .forEach((c) => c.classList.remove("active"));
  el.classList.add("active");
  const parsed = parseFloat(price.replace("$", ""));
  Store.setState("product", () => ({ currentPrice: parsed }));
  document.getElementById("detail-price").textContent = price;
}

document.addEventListener("click", function (e) {
  const chip = e.target.closest("#detail-opt1-chips .option-chip");
  if (chip) {
    document
      .querySelectorAll("#detail-opt1-chips .option-chip")
      .forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
  }
});

/* ═══════════════ CART ═══════════════ */
// FIX: addToCart مع مزامنة الباك وrollback عند الفشل
window.addToCart = async function () {
  const { currentId, currentPrice, qty } = Store.getState().product;
  if (!currentId) return;

  const p = getProductsSource().find((pr) => String(pr.id) === String(currentId));
  if (!p) return;

  Store.setState("cart", (s) => {
    const existing = s.items.find((i) => String(i.id) === String(currentId));
    const newItems = existing
      ? s.items.map((i) =>
          String(i.id) === String(currentId) ? { ...i, qty: i.qty + qty } : i
        )
      : [
          ...s.items,
          {
            id: p.id,
            name: p.name,
            sub: "Premium Quality",
            image: p.image,
            price: currentPrice,
            qty
          }
        ];
    return { items: newItems };
  });

  updateCartCount();
  showNotif(`✅ ${p.name} added to cart`);
  bumpCartBadge();

  // لو مش مسجل → احفظ محلياً وخلاص
  if (!isUserLoggedIn()) {
    saveCartLocally();
    return;
  }

  // مسجل → ابعت للباك
  try {
    await api.addToCart(String(currentId), qty);
  } catch (e) {
    if (e.message?.includes("Authentication") || e.status === 401) {
      saveCartLocally();
      return;
    }
    Store.setState("cart", (s) => {
      const existing = s.items.find((i) => String(i.id) === String(currentId));
      if (!existing) return s;
      const newItems =
        existing.qty - qty <= 0
          ? s.items.filter((i) => String(i.id) !== String(currentId))
          : s.items.map((i) =>
              String(i.id) === String(currentId) ? { ...i, qty: i.qty - qty } : i
            );
      return { items: newItems };
    });
    updateCartCount();
    showNotif("❌ Failed to add to cart — please try again");
  }
};

function bumpCartBadge() {
  const badge = document.getElementById("cart-count");
  if (!badge) return;
  badge.classList.remove("bump");
  void badge.offsetWidth;
  badge.classList.add("bump");
}

function updateCartCount() {
  const { items } = Store.getState().cart;
  const total = items.reduce((s, i) => s + i.qty, 0);
  const cartCount = document.getElementById("cart-count");
  const cartCountHeader = document.getElementById("cart-count-header");
  if (cartCount) cartCount.textContent = total;
  if (cartCountHeader) cartCountHeader.textContent = `(${total})`;
}

function calcCart() {
  const { items, discountPercent } = Store.getState().cart;
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = subtotal === 0 ? 0 : subtotal >= 50 ? 0 : 5.99;
  const discount = subtotal * (discountPercent / 100);
  const total = subtotal + shipping - discount;
  return { subtotal, shipping, discount, total };
}

function renderCart() {
  const { items, discountPercent } = Store.getState().cart;
  const container = document.getElementById("cart-items-container");
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-cart">
        <div class="icon">🛒</div>
        <p>Your cart is empty</p>
        <a href="#" onclick="showPage('coffee');return false">Browse Products →</a>
      </div>`;
  } else {
    container.innerHTML = items
      .map(
        (item, i) => `
      <div class="cart-item">
        <div class="cart-item-img" style="overflow:hidden;padding:0">
          <img src="${item.image}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">
        </div>
        <div>
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-sub">${item.sub}</div>
          <div class="cart-item-qty">
            <button class="cart-qty-btn" onclick="changeCartQty(${i},-1)">−</button>
            <span style="font-size:13px;color:var(--text-primary);min-width:22px;text-align:center;font-weight:600">${item.qty}</span>
            <button class="cart-qty-btn" onclick="changeCartQty(${i},1)">+</button>
          </div>
        </div>
        <div class="cart-item-price">
          <span class="price">$${(item.price * item.qty).toFixed(2)}</span>
          <button class="cart-item-remove" onclick="removeFromCart(${i})">✕ Remove</button>
        </div>
      </div>
    `
      )
      .join("");
  }

  const { subtotal, shipping, discount, total } = calcCart();

  document.getElementById("cart-subtotal").textContent =
    "$" + subtotal.toFixed(2);
  document.getElementById("cart-shipping").textContent =
    shipping === 0
      ? items.length
        ? "FREE"
        : "$0.00"
      : "$" + shipping.toFixed(2);
  document.getElementById("cart-total").textContent = "$" + total.toFixed(2);

  const discLine = document.getElementById("discount-line");
  if (discLine) {
    if (discountPercent > 0) {
      discLine.style.display = "flex";
      document.getElementById("cart-discount").textContent =
        "-$" + discount.toFixed(2);
    } else {
      discLine.style.display = "none";
    }
  }

  const co = document.getElementById("checkout-items");
  if (co) {
    co.innerHTML = items
      .map(
        (item) => `
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:9px">
        <span>${item.name} ×${item.qty}</span>
        <span style="color:var(--gold);font-weight:600">$${(item.price * item.qty).toFixed(2)}</span>
      </div>
    `
      )
      .join("");
  }

  const setIfExists = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setIfExists("co-subtotal", "$" + subtotal.toFixed(2));
  setIfExists(
    "co-shipping",
    shipping === 0
      ? items.length
        ? "FREE"
        : "$0.00"
      : "$" + shipping.toFixed(2)
  );
  setIfExists("co-total", "$" + total.toFixed(2));
}

// FIX: changeCartQty مع مزامنة الباك
async function changeCartQty(i, d) {
  const item = Store.getState().cart.items[i];
  if (!item) return;
  const newQty = Math.max(1, item.qty + d);

  Store.setState("cart", (s) => {
    const newItems = s.items.map((it, idx) =>
      idx === i ? { ...it, qty: newQty } : it
    );
    return { items: newItems };
  });
  updateCartCount();
  renderCart();

  try {
    await api.updateCartItem(item.id, newQty);
  } catch (e) {
    console.error("Cart update failed:", e);
    // Rollback
    Store.setState("cart", (s) => {
      const newItems = s.items.map((it, idx) =>
        idx === i ? { ...it, qty: item.qty } : it
      );
      return { items: newItems };
    });
    updateCartCount();
    renderCart();
    showNotif("❌ Failed to update quantity");
  }
}

// FIX: removeFromCart مع مزامنة الباك وrollback
async function removeFromCart(i) {
  const item = Store.getState().cart.items[i];
  if (!item) return;
  const name = item.name;

  // تحديث فوري
  Store.setState("cart", (s) => ({
    items: s.items.filter((_, idx) => idx !== i)
  }));
  updateCartCount();
  renderCart();
  showNotif("🗑 " + name + " removed");

  // مزامنة مع الباك
  try {
    await api.removeFromCart(item.id);
  } catch (e) {
    console.error("Remove from cart failed:", e);
    // Rollback: أعد العنصر لمكانه
    Store.setState("cart", (s) => {
      const newItems = [...s.items];
      newItems.splice(i, 0, item);
      return { items: newItems };
    });
    updateCartCount();
    renderCart();
    showNotif("❌ Failed to remove item — please try again");
  }
}

function goCheckout() {
  if (!Store.getState().cart.items.length) {
    showNotif("⚠ Your cart is empty");
    return;
  }
  showPage("checkout");
}

async function applyCoupon() {
  const code = document
    .getElementById("coupon-input")
    .value.trim()
    .toUpperCase();
  if (!code) {
    showNotif("❌ Please enter a coupon code");
    return;
  }

  try {
    const response = await api.applyCoupon(code);
    if (response.success) {
      Store.setState("cart", () => ({
        discountPercent: response.data.discountPercent
      }));
      showNotif(`🎁 ${response.data.discountPercent}% discount applied!`);
      renderCart();
    }
  } catch (error) {
    console.error("Apply coupon failed:", error);
    showNotif(`❌ ${error.message || "Invalid coupon code"}`);
  }
}

/* ═══════════════ CHECKOUT ═══════════════ */
function selectPayment(type) {
  document
    .getElementById("pay-card")
    .classList.toggle("active", type === "card");
  document
    .getElementById("pay-paypal")
    .classList.toggle("active", type === "paypal");
  document.getElementById("card-fields").style.display =
    type === "card" ? "block" : "none";
}

function formatCard(el) {
  let v = el.value.replace(/\D/g, "").substring(0, 16);
  el.value = v.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(el) {
  let v = el.value.replace(/\D/g, "");
  if (v.length >= 2) v = v.substring(0, 2) + "/" + v.substring(2, 4);
  el.value = v;
}

function validateCheckout() {
  const required = [
    { id: "f-name", check: (v) => v.trim().length > 1 },
    { id: "f-email", check: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
    { id: "f-address", check: (v) => v.trim().length > 3 },
    { id: "f-city", check: (v) => v.trim().length > 1 },
    { id: "f-zip", check: (v) => v.trim().length > 3 }
  ];
  const isCard = document
    .getElementById("pay-card")
    .classList.contains("active");
  if (isCard) {
    required.push({
      id: "f-card",
      check: (v) => v.replace(/\s/g, "").length === 16
    });
    required.push({ id: "f-expiry", check: (v) => /^\d{2}\/\d{2}$/.test(v) });
    required.push({ id: "f-cvv", check: (v) => /^\d{3,4}$/.test(v) });
  }
  let valid = true;
  required.forEach(({ id, check }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ok = check(el.value);
    el.classList.toggle("error", !ok);
    if (!ok) valid = false;
  });
  return valid;
}

async function placeOrder() {
  const { items } = Store.getState().cart;
  if (!items.length) {
    showNotif("⚠ Your cart is empty");
    return;
  }

  const name = document.getElementById("f-name")?.value.trim();
  const email = document.getElementById("f-email")?.value.trim();
  const address = document.getElementById("f-address")?.value.trim();
  const city = document.getElementById("f-city")?.value.trim();
  const zip = document.getElementById("f-zip")?.value.trim();

  if (!name || !email || !address || !city || !zip) {
    showNotif("⚠ Please fill all required fields");
    return;
  }

  const btn = document.getElementById("place-order-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "PLACING ORDER...";
  }

  try {
    const response = await api.createOrder({
      shippingName: name,
      shippingStreet: address,
      shippingCity: city,
      shippingZip: zip,
      shippingCountry: "US",
      notes: `Email: ${email}`
    });

    if (response.success) {
      const order = response.data;
      document.getElementById("success-order-id").textContent =
        `Order ${order.orderNumber}`;
      document.getElementById("success-total").textContent =
        `Total: $${order.total}`;

      Store.setState("cart", () => ({ items: [], discountPercent: 0 }));
      updateCartCount();

      // مزامنة: امسح السلة من الباك أيضًا
      try {
        await api.clearCart();
      } catch (e) {
        console.error("Clear cart on server failed:", e);
      }

      Router.navigate("success");
      showNotif("🎉 Order placed successfully!");
    }
  } catch (error) {
    console.error("Place order failed:", error);
    showNotif(`❌ Failed to place order: ${error.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "PLACE ORDER";
    }
  }
}

/* ═══════════════ ADMIN ═══════════════ */
/* ── Navigation for Admin Sections (Dashboard, Products, Orders) ── */
window.adminNavItem = function (el) {
  const text = el.textContent.trim();
  closeAdminNav();

  const dashView = document.getElementById("admin-dashboard-view");
  const prodPanel = document.getElementById("admin-products-panel");
  const ordersPanel = document.getElementById("admin-orders-panel");

  if (dashView) dashView.style.display = "none";
  if (prodPanel) prodPanel.style.display = "none";
  if (ordersPanel) ordersPanel.style.display = "none";

  if (text.includes("Dashboard")) {
    if (dashView) {
      dashView.style.display = "block";
      initAdmin();
      dashView.scrollIntoView({ behavior: "smooth" });
    }
  } else if (text.includes("Products")) {
    if (prodPanel) {
      prodPanel.style.display = "block";
      if (!prodPanel.querySelector(".admin-products-section")) {
        AdminProducts.render();
      }
      AdminProducts.refresh();
      prodPanel.scrollIntoView({ behavior: "smooth" });
    }
  } else if (text.includes("Orders")) {
    if (ordersPanel) {
      ordersPanel.style.display = "block";
      if (!ordersPanel.querySelector(".admin-orders-section")) {
        AdminOrders.render();
      }
      AdminOrders.refresh();
      ordersPanel.scrollIntoView({ behavior: "smooth" });
    }
  }
};

function adminNav(el) {
  closeAdminNav();
  document
    .querySelectorAll(".admin-menu-item")
    .forEach((m) => m.classList.remove("active"));
  el.classList.add("active");
  if (window.innerWidth <= 800) closeAdminSidebar();
}

function openAdminNav() {
  document.getElementById("admin-nav-drawer").classList.add("open");
  document.getElementById("admin-nav-overlay").style.display = "block";
}

function closeAdminNav() {
  document.getElementById("admin-nav-drawer").classList.remove("open");
  document.getElementById("admin-nav-overlay").style.display = "none";
}


function renderCustomerOrders(orders) {
  const container = document.getElementById("customer-orders-list");
  if (!container) return;

  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; background: var(--brown-card); border: 1px solid rgba(201, 168, 76, 0.15); border-radius: 16px;">
        <div style="font-size: 40px; margin-bottom: 15px;">📦</div>
        <h3 style="color: var(--text-primary); font-size: 18px; margin-bottom: 10px; font-family: 'Playfair Display', serif;">No Purchases Yet</h3>
        <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 25px; max-width: 400px; margin-left: auto; margin-right: auto;">
          You haven't ordered any premium products from CMODY yet. Start exploring our collections today!
        </p>
        <button onclick="showPage('coffee')" style="background: var(--gold); color: var(--brown-deep); border: none; padding: 10px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.3s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
          Shop Our Coffee
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = orders.map(order => {
    const dateStr = new Date(order.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    let statusColor = "rgba(201, 168, 76, 0.15)";
    let statusText = order.status;
    let statusTextColor = "var(--gold)";

    if (order.status === "DELIVERED") {
      statusColor = "rgba(40, 167, 69, 0.15)";
      statusTextColor = "#28a745";
    } else if (order.status === "PENDING" || order.status === "UNPAID") {
      statusColor = "rgba(255, 193, 7, 0.15)";
      statusTextColor = "#ffc107";
    } else if (order.status === "CANCELLED") {
      statusColor = "rgba(220, 53, 69, 0.15)";
      statusTextColor = "#dc3545";
    }

    const itemsHtml = order.items.map(item => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(201, 168, 76, 0.08);">
        <div>
          <span style="font-weight: 600; color: var(--text-primary); font-size: 14px;">${escapeHtml(item.productName)}</span>
          <span style="color: var(--text-muted); font-size: 12px; margin-left: 10px;">x${item.qty}</span>
        </div>
        <span style="font-family: 'Jost', sans-serif; font-size: 14px; color: var(--text-muted); font-weight: 500;">
          $${(parseFloat(item.unitPrice) * item.qty).toFixed(2)}
        </span>
      </div>
    `).join("");

    return `
      <div class="order-card" style="background: var(--brown-card); border: 1px solid rgba(201, 168, 76, 0.18); border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); transition: 0.3s; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px; border-bottom: 1px solid rgba(201, 168, 76, 0.12); padding-bottom: 16px; margin-bottom: 16px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--gold); letter-spacing: 1px;">Order</span>
              <span style="font-family: 'Jost', sans-serif; font-size: 15px; font-weight: 700; color: var(--text-primary);">${escapeHtml(order.orderNumber)}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Ordered on ${dateStr}</div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
            <span style="background: ${statusColor}; color: ${statusTextColor}; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
              ${statusText}
            </span>
            <span style="font-size: 18px; font-weight: 800; color: var(--gold); font-family: 'Jost', sans-serif;">$${parseFloat(order.total).toFixed(2)}</span>
          </div>
        </div>
        
        <div class="order-items" style="margin-bottom: 18px;">
          ${itemsHtml}
        </div>

        ${order.address ? `
        <div style="background: rgba(201, 168, 76, 0.04); border-radius: 8px; padding: 12px 16px; border: 1px dashed rgba(201, 168, 76, 0.1);">
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: var(--gold); letter-spacing: 0.8px; margin-bottom: 4px;">Delivery Address</div>
          <div style="font-size: 13px; color: var(--text-primary); line-height: 1.4;">
            ${escapeHtml(order.address.fullName)} | ${escapeHtml(order.address.phone)}
            <br>
            ${escapeHtml(order.address.streetAddress)}, ${escapeHtml(order.address.city)}, ${escapeHtml(order.address.state)} ${escapeHtml(order.address.zipCode || "")}
          </div>
        </div>
        ` : ''}
      </div>
    `;
  }).join("");
}

async function initAdmin() {
  const user =
    JSON.parse(localStorage.getItem("gm_user") || "null") ||
    JSON.parse(sessionStorage.getItem("gm_user") || "null");

  const isAdmin = user && user.role === "ADMIN";

  const adminPortal = document.getElementById("admin-portal-view");
  const customerPortal = document.getElementById("customer-portal-view");

  // Hide the sidebar toggle for non-admins
  const toggleBtn = document.getElementById("admin-sidebar-toggle");

  if (!isAdmin) {
    // Customer / Guest Portal View
    if (adminPortal) adminPortal.style.display = "none";
    if (customerPortal) customerPortal.style.display = "block";
    if (toggleBtn) toggleBtn.style.display = "none";

    const listContainer = document.getElementById("customer-orders-list");

    if (!isUserLoggedIn()) {
      // Guest — show prompt to login
      if (listContainer) {
        listContainer.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; background: var(--brown-card); border: 1px solid rgba(201,168,76,0.15); border-radius: 16px;">
            <div style="font-size: 48px; margin-bottom: 15px;">🛍️</div>
            <h3 style="color: var(--text-primary); font-family:'Playfair Display',serif; font-size:20px; margin-bottom:10px;">No Orders Yet</h3>
            <p style="color: var(--text-muted); font-size:14px; margin-bottom:25px; max-width:360px; margin-left:auto; margin-right:auto;">
              Sign in to view your purchase history and track your orders.
            </p>
            <a href="auth.html" style="display:inline-block; background:var(--gold); color:var(--brown-deep); border:none; padding:11px 28px; border-radius:8px; font-weight:700; text-decoration:none; font-family:'Jost',sans-serif; transition:0.3s;">Sign In</a>
          </div>
        `;
      }
      return;
    }

    // Logged-in regular user — load their orders
    if (listContainer) {
      listContainer.innerHTML = `
        <div style="text-align:center;padding:50px 0;color:var(--text-muted);">
          <div style="font-size:24px;margin-bottom:10px;">⏳</div>
          Loading your orders...
        </div>
      `;
    }

    try {
      const res = await api.getMyOrders(1, 50);
      if (res.success && Array.isArray(res.data)) {
        renderCustomerOrders(res.data);
      } else {
        renderCustomerOrders([]);
      }
    } catch (err) {
      console.error("Error loading user orders:", err);
      renderCustomerOrders([]);
    }
    return;
  }

  // Admin Portal View
  if (customerPortal) customerPortal.style.display = "none";
  if (adminPortal) adminPortal.style.display = "block";

  // Show toggle button for admin
  if (toggleBtn) {
    toggleBtn.style.setProperty("display", "flex", "important");
  }

  // Ensure default view is shown and others are hidden when admin route loads
  const dashView = document.getElementById("admin-dashboard-view");
  const prodPanel = document.getElementById("admin-products-panel");
  const ordersPanel = document.getElementById("admin-orders-panel");
  
  if (dashView) dashView.style.display = "block";
  if (prodPanel) prodPanel.style.display = "none";
  if (ordersPanel) ordersPanel.style.display = "none";

  if (prodPanel && prodPanel.innerHTML === "") AdminProducts.render();

  const dateEl = document.getElementById("admin-date");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  try {
    // 1. Fetch Dashboard Stats & Recent Orders
    const res = await api.getAdminDashboard();
    if (res.success) {
      const { stats, recentOrders, ordersByStatus, salesByMonth } = res.data;

      // Update statistics cards
      const statProd = document.getElementById("stat-products");
      if (statProd) statProd.textContent = stats.totalProducts;

      const statOrders = document.getElementById("stat-orders") || document.querySelector(".stat-card:nth-child(2) .value");
      if (statOrders) statOrders.textContent = stats.totalOrders;

      const statCust = document.getElementById("stat-customers") || document.querySelector(".stat-card:nth-child(3) .value");
      if (statCust) statCust.textContent = stats.totalCustomers;

      const statRev = document.getElementById("stat-revenue");
      if (statRev) statRev.textContent = "$" + stats.totalRevenue.toFixed(2);

      const adminProdCount = document.getElementById("admin-prod-count");
      if (adminProdCount) adminProdCount.textContent = stats.totalProducts;

      // Render recent orders table
      const tbody = document.getElementById("admin-orders-table");
      if (tbody) {
        if (!recentOrders || recentOrders.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">No orders found</td></tr>`;
        } else {
          tbody.innerHTML = recentOrders
            .slice(0, 5)
            .map((o) => {
              const customerName = o.user ? `${o.user.firstName} ${o.user.lastName}` : o.shippingName || "Guest Customer";
              return `
                <tr>
                  <td><strong>${o.orderNumber}</strong></td>
                  <td>${customerName}</td>
                  <td>$${parseFloat(o.total).toFixed(2)}</td>
                  <td><span class="status-badge status-${o.status.toLowerCase()}">${o.status}</span></td>
                </tr>
              `;
            })
            .join("");
        }
      }

      // Map backend monthly sales to Chart data
      if (salesByMonth && salesByMonth.length > 0) {
        // Reset salesData structure
        for (const m in salesData) {
          salesData[m] = 0;
        }
        salesByMonth.forEach((item) => {
          if (salesData[item.month] !== undefined) {
            salesData[item.month] = parseFloat(item.revenue || 0);
          }
        });
      }
      buildChart();

      // Render Order Status Breakdown
      const statusEl = document.getElementById("order-status-breakdown");
      if (statusEl) {
        const statuses = [
          { label: "Delivered", count: ordersByStatus["DELIVERED"] || 0, color: "#61C822" },
          { label: "Shipped", count: ordersByStatus["SHIPPED"] || 0, color: "#378ADD" },
          { label: "Processing", count: ordersByStatus["PROCESSING"] || 0, color: "#9c27b0" },
          { label: "Pending", count: ordersByStatus["PENDING"] || 0, color: "#EF9F27" }
        ];
        const total = statuses.reduce((s, x) => s + x.count, 0) || 1;
        statusEl.innerHTML = statuses
          .map(
            (s) => `
          <div class="mb-2">
            <div class="d-flex justify-content-between mb-1">
              <span style="font-size:11px;color:var(--text-muted)">${s.label}</span>
              <span style="font-size:11px;font-weight:700;color:var(--text-primary)">${s.count}</span>
            </div>
            <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:10px;overflow:hidden">
              <div style="height:100%;width:${((s.count / total) * 100).toFixed(0)}%;background:${s.color};border-radius:10px;transition:width .6s ease"></div>
            </div>
          </div>
        `
          )
          .join("");
      }
    }

    // 2. Fetch Top Products Analytics
    const analyticRes = await api.getAdminAnalytics();
    if (analyticRes.success) {
      const { topProducts } = analyticRes.data;
      const topEl = document.getElementById("top-products-list");
      if (topEl) {
        if (!topProducts || topProducts.length === 0) {
          topEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:10px;">No sales data available</div>`;
        } else {
          topEl.innerHTML = topProducts
            .slice(0, 4)
            .map(
              (p, i) => `
            <div class="d-flex align-items-center gap-2 mb-2">
              <span style="font-size:10px;font-weight:700;color:var(--gold);min-width:16px">#${i + 1}</span>
              <div style="flex:1;font-size:12px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.productName}</div>
              <span style="font-size:11px;font-weight:700;color:var(--gold)">$${parseFloat(p._sum.totalPrice || 0).toFixed(2)}</span>
            </div>
          `
            )
            .join("");
        }
      }
    }

    // 3. Fetch Audit Logs for Recent Activity
    const logsRes = await api.getAdminAuditLog(1, 5);
    if (logsRes.success) {
      const activities = logsRes.data;
      const actEl = document.getElementById("recent-activity");
      if (actEl) {
        if (!activities || activities.length === 0) {
          actEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:10px;">No recent activities</div>`;
        } else {
          actEl.innerHTML = activities
            .map(
              (a) => {
                let icon = "⚙️";
                const actionLower = a.action.toLowerCase();
                if (actionLower.includes("create") || actionLower.includes("place")) icon = "📝";
                else if (actionLower.includes("complete") || actionLower.includes("status") || actionLower.includes("paid")) icon = "✅";
                else if (actionLower.includes("ship")) icon = "🚚";
                else if (actionLower.includes("delete")) icon = "🗑️";
                else if (actionLower.includes("role") || actionLower.includes("register")) icon = "👤";

                const relativeTime = formatRelativeTime(new Date(a.createdAt));
                return `
                  <div class="d-flex align-items-start gap-2 mb-2 pb-2" style="border-bottom:1px solid rgba(201,168,76,0.07)">
                    <span style="font-size:14px">${icon}</span>
                    <div style="flex:1">
                      <div style="font-size:11px;color:var(--text-primary);line-height:1.4">${a.action}: ${a.entity}</div>
                      <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${relativeTime}</div>
                    </div>
                  </div>
                `;
              }
            )
            .join("");
        }
      }
    }
  } catch (err) {
    console.error("initAdmin Dynamic Loading Error:", err);
    showNotif("⚠️ Error connecting to admin endpoints");
  }
}

function formatRelativeTime(date) {
  const diffMs = new Date() - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  return `${diffDays} days ago`;
}

/* ═══════════════ SALES CHART ═══════════════ */
let salesChartInstance = null;

const salesData = {
  Jan: 45,
  Feb: 52,
  Mar: 58,
  Apr: 63,
  May: 72,
  Jun: 78,
  Jul: 85,
  Aug: 0,
  Sep: 0,
  Oct: 0,
  Nov: 0,
  Dec: 0
};

function recordSale(amount) {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  const currentMonth = monthNames[new Date().getMonth()];
  salesData[currentMonth] = (salesData[currentMonth] || 0) + amount;
  updateSalesChart();
  const totalRevenue = Object.values(salesData).reduce((a, b) => a + b, 0);
  const el = document.getElementById("stat-revenue");
  if (el) el.textContent = "$" + totalRevenue.toFixed(2);
}

function getChartDataByPeriod(period) {
  const allMonths = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  const allValues = allMonths.map((m) => salesData[m] || 0);
  if (period === "6months")
    return { labels: allMonths.slice(0, 6), values: allValues.slice(0, 6) };
  if (period === "3months")
    return { labels: allMonths.slice(0, 3), values: allValues.slice(0, 3) };
  return { labels: allMonths, values: allValues };
}

function buildChart() {
  updateSalesChart();
}

function updateSalesChart() {
  const canvas = document.getElementById("sales-line-chart");
  if (!canvas) return;

  if (typeof Chart === "undefined") {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
    script.onload = () => updateSalesChart();
    document.head.appendChild(script);
    return;
  }

  const period = document.getElementById("chart-period")?.value || "year";
  const { labels, values } = getChartDataByPeriod(period);

  if (salesChartInstance) {
    salesChartInstance.destroy();
    salesChartInstance = null;
  }

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 160);
  gradient.addColorStop(0, "rgba(201,168,76,0.4)");
  gradient.addColorStop(1, "rgba(201,168,76,0.0)");

  salesChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Sales ($)",
          data: values,
          borderColor: "#C9A84C",
          borderWidth: 2.5,
          backgroundColor: gradient,
          pointBackgroundColor: "#C9A84C",
          pointBorderColor: "#1a0a00",
          pointBorderWidth: 1.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: "easeInOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(13,7,0,0.92)",
          titleColor: "#C9A84C",
          bodyColor: "#F5E6D3",
          borderColor: "rgba(201,168,76,0.3)",
          borderWidth: 1,
          padding: 10,
          callbacks: { label: (ctx) => " $" + ctx.parsed.y.toFixed(2) }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(201,168,76,0.07)", drawBorder: false },
          ticks: {
            color: "rgba(160,120,64,0.8)",
            font: { family: "Jost", size: 9 }
          }
        },
        y: {
          grid: { color: "rgba(201,168,76,0.07)", drawBorder: false },
          ticks: {
            color: "rgba(160,120,64,0.8)",
            font: { family: "Jost", size: 9 },
            callback: (val) => "$" + val
          }
        }
      }
    }
  });
}

/* ═══════════════ CHATBOT ═══════════════ */
async function sendChat() {
  const input = document.getElementById("chat-input");
  const msg = input.value.trim();
  if (!msg) return;

  const sendBtn = document.getElementById("chat-send-btn");
  if (sendBtn) sendBtn.disabled = true;
  input.value = "";

  const msgs = document.getElementById("chat-messages");
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  msgs.innerHTML += `<div class="message user">${escapeHtml(msg)}<div class="message-time">${now}</div></div>`;

  const typingId = "typing-" + Date.now();
  msgs.innerHTML += `<div class="typing-indicator" id="${typingId}"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  msgs.scrollTop = msgs.scrollHeight;

  try {
    const response = await api.sendChatMessage(msg, chatSessionKey);
    const reply = response.data?.reply || "عذراً، لم أتمكن من معالجة طلبك.";

    Store.setState("chat", (s) => ({ history: [...s.history, { role: "user", content: msg }] }));
    Store.setState("chat", (s) => ({ history: [...s.history, { role: "assistant", content: reply }] }));

    document.getElementById(typingId)?.remove();
    msgs.innerHTML += `<div class="message bot">${escapeHtml(reply).replace(/\n/g, "<br>")}<div class="message-time">${now}</div></div>`;
  } catch (err) {
    console.error("Chat error:", err);
    document.getElementById(typingId)?.remove();
    const fallback = "عذراً، حدث خطأ في الاتصال. الرجاء المحاولة مرة أخرى.";
    msgs.innerHTML += `<div class="message bot">${fallback}<div class="message-time">${now}</div></div>`;
  }

  msgs.scrollTop = msgs.scrollHeight;
  if (sendBtn) sendBtn.disabled = false;
  input.focus();
}

function quickSend(msg) {
  document.getElementById("chat-input").value = msg;
  sendChat();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ═══════════════ DARK MODE ═══════════════ */
function applySavedTheme() {
  const user =
    JSON.parse(localStorage.getItem("gm_user") || "null") ||
    JSON.parse(sessionStorage.getItem("gm_user") || "null");
  const themeKey = user && user.id ? `theme_user_${user.id}` : "theme_default";
  const savedTheme = localStorage.getItem(themeKey);

  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
  } else if (savedTheme === "dark") {
    document.body.classList.remove("light-mode");
  }

  const isLight = document.body.classList.contains("light-mode");
  document.querySelectorAll(".dark-mode-btn").forEach((b) => {
    const icon = b.querySelector("i");
    if (icon) {
      icon.className = isLight ? "bi bi-moon" : "bi bi-moon-stars";
    } else {
      b.textContent = isLight ? "🌙 Dark Mode" : "☀ Light Mode";
    }
  });
}

function toggleMode() {
  document.body.classList.toggle("light-mode");
  const isLight = document.body.classList.contains("light-mode");

  const user =
    JSON.parse(localStorage.getItem("gm_user") || "null") ||
    JSON.parse(sessionStorage.getItem("gm_user") || "null");
  const themeKey = user && user.id ? `theme_user_${user.id}` : "theme_default";
  localStorage.setItem(themeKey, isLight ? "light" : "dark");

  document.querySelectorAll(".dark-mode-btn").forEach((b) => {
    const icon = b.querySelector("i");
    if (icon) {
      icon.className = isLight ? "bi bi-moon" : "bi bi-moon-stars";
    } else {
      b.textContent = isLight ? "🌙 Dark Mode" : "☀ Light Mode";
    }
  });
}

/* ═══════════════ NOTIFICATION ═══════════════ */
let notifTimeout;
function showNotif(msg) {
  const el = document.getElementById("notif");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden", "hide");
  el.classList.add("show");
  clearTimeout(notifTimeout);
  notifTimeout = setTimeout(() => {
    el.classList.remove("show");
    el.classList.add("hide");
  }, 3000);
}

/* ═══════════════ SEARCH DROPDOWN ═══════════════ */
function openSearchDropdown() {
  const dd = document.getElementById("search-dropdown");
  if (dd) dd.classList.add("open");
  const input = document.getElementById("search-input");
  renderDropdown(input ? input.value : "");
}

function closeSearchDropdown() {
  const dd = document.getElementById("search-dropdown");
  if (dd) dd.classList.remove("open");
}

function updateSearchDropdown(query) {
  renderDropdown(query);
}

function renderDropdown(query) {
  const dd = document.getElementById("search-dropdown");
  if (!dd) return;

  const { recentSearches } = Store.getState().search;
  let html = "";
  query = query.trim();

  if (query.length > 0) {
    const products = getProductsSource();
    const results = products
      .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5);

    if (results.length > 0) {
      html += `<div class="sd-section-title">Products</div>`;
      html += results.map((p) => {
        let img = Array.isArray(p.images) && p.images[0] ? p.images[0] : "imagesCoffe/spinning_coffee_cup.png";
        if (img.startsWith("/uploads/")) img = "imagesCoffe/" + img.split("/").pop();
        return `<div class="sd-item" onclick="handleSearch(\'${p.name.replace(/\'/g, "\\'")}\'); closeSearchDropdown();">
          <div class="sd-item-icon"><img src="${img}" alt="${p.name}"></div>
          <span class="sd-item-name">${highlightMatch(p.name, query)}</span>
          <span class="sd-item-price">$${p.price.toFixed(2)}</span>
        </div>`;
      }).join("");
    } else {
      html += `<div class="sd-no-results">No products found</div>`;
    }
    html += `<div class="sd-divider"></div>`;
  }

  html += `<div class="sd-section-title">Browse Categories</div>`;
  html += `<div class="sd-categories">
    <button class="sd-cat-chip" onclick="navTo('coffee',null);closeSearchDropdown();">☕ Coffee</button>
    <button class="sd-cat-chip" onclick="navTo('drinks',null);closeSearchDropdown();">🥤 Drinks</button>
    <button class="sd-cat-chip" onclick="navTo('brass',null);closeSearchDropdown();">🏺 Brass</button>
  </div>`;

  if (recentSearches.length && query.length === 0) {
    html += `<div class="sd-divider"></div>`;
    html += `<div class="sd-section-title">Recent Searches</div>`;
    html += recentSearches.slice(0, 4).map((r, idx) =>
      `<div class="sd-item" onclick="selectRecentSearch(${idx})">
        <div class="sd-item-icon recent-icon">🕐</div>
        <span class="sd-item-name">${r}</span>
      </div>`
    ).join("");
    html += `<button class="sd-clear-recent" onclick="clearRecentSearches()">✕ Clear recent searches</button>`;
  }

  dd.innerHTML = html;
}

window.selectRecentSearch = function (idx) {
  const { recentSearches } = Store.getState().search;
  const val = recentSearches[idx];
  if (!val) return;
  document.getElementById("search-input").value = val;
  handleSearch(val);
  closeSearchDropdown();
};

function highlightMatch(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, "gi");
  return text.replace(regex, `<strong style="color:var(--gold)">$1</strong>`);
}

document.addEventListener("click", function (e) {
  const wrapper = document.querySelector(".search-wrapper");
  if (wrapper && !wrapper.contains(e.target)) closeSearchDropdown();
});

document.querySelectorAll(".sidebar-cat").forEach((cat) => {
  cat.addEventListener("click", function () {
    const sidebar = this.closest(".sidebar");
    sidebar.querySelectorAll(".sidebar-cat").forEach((c) => c.classList.remove("active"));
    this.classList.add("active");
    if (window.innerWidth <= 800) {
      sidebar.classList.remove("open");
      document.getElementById("nav-overlay").classList.remove("open");
      document.body.style.overflow = "";
    }
  });
});

/* ═══════════════ SUBSCRIBERS ═══════════════ */
Store.subscribe("cart", () => updateCartCount());

/* ═══════════════ API LOADERS ═══════════════ */
function formatApiProduct(p) {
  let img = Array.isArray(p.images) && p.images[0] ? p.images[0] : "imagesCoffe/spinning_coffee_cup.png";
  if (img.startsWith("/uploads/")) img = "imagesCoffe/" + img.split("/").pop();
  const avgRating = Math.round(p.ratingAvg || 5);
  const rating = "★".repeat(Math.min(avgRating, 5)) + "☆".repeat(Math.max(0, 5 - avgRating));
  return {
    id: String(p.id), name: p.name, price: parseFloat(p.price),
    image: img, images: Array.isArray(p.images) ? p.images : [],
    rating, reviews: p.reviewCount || 0, badge: p.badge || null,
    cat: p.category, desc: p.description || "", stock: p.stock || 0,
    isFeatured: p.isFeatured || false, isActive: p.isActive !== false
  };
}

function mergeProducts(newProducts, options = {}) {
  const activeOnly = newProducts.filter((p) => p.isActive !== false);
  if (options.replaceCategory) {
    const cat = options.replaceCategory;
    const others = apiProducts.filter((p) => p.cat !== cat);
    const map = new Map([...others, ...activeOnly].map((p) => [String(p.id), p]));
    apiProducts = [...map.values()];
  } else if (options.replaceFeatured) {
    const nonFeatured = apiProducts.filter((p) => !p.isFeatured);
    const newIds = new Set(activeOnly.map((p) => String(p.id)));
    const filteredNonFeatured = nonFeatured.filter((p) => !newIds.has(String(p.id)));
    apiProducts = [...filteredNonFeatured, ...activeOnly];
  } else {
    const map = new Map(apiProducts.map((p) => [String(p.id), p]));
    activeOnly.forEach((p) => map.set(String(p.id), p));
    apiProducts = [...map.values()];
  }
  apiProducts = apiProducts.filter((p) => p.isActive !== false);
}

function _purgeInactiveFromGlobal() {
  const before = apiProducts.length;
  apiProducts = apiProducts.filter((p) => p.isActive !== false);
  const removed = before - apiProducts.length;
  if (removed > 0) console.log(`[main] Purged ${removed} inactive products from apiProducts`);
}

async function loadRealProducts() {
  showSkeletons("featured-grid", 6);
  try {
    const response = await api.getFeaturedProducts();
    if (response.success && Array.isArray(response.data) && response.data.length) {
      const formatted = response.data.map(formatApiProduct);
      mergeProducts(formatted, { replaceFeatured: true });
      _productsLoaded = true;
      renderProducts("featured-grid", formatted);
    } else {
      _productsLoaded = true;
      renderProducts("featured-grid", []);
    }
  } catch (e) {
    console.warn("loadRealProducts fallback:", e.message);
    if (!_productsLoaded) renderProducts("featured-grid", productsFallback.filter((p) => p.isFeatured));
    else renderProducts("featured-grid", []);
  }
}

async function loadCoffeeProducts() {
  showSkeletons("coffee-grid", 6);
  try {
    const response = await api.getProductsNoCache({ category: "coffee", limit: 20 });
    if (response.success && Array.isArray(response.data) && response.data.length) {
      const formatted = response.data.map(formatApiProduct);
      mergeProducts(formatted, { replaceCategory: "coffee" });
      _productsLoaded = true;
      renderProducts("coffee-grid", formatted);
    } else {
      _productsLoaded = true;
      renderProducts("coffee-grid", []);
    }
  } catch (e) {
    console.warn("loadCoffeeProducts fallback:", e.message);
    if (!_productsLoaded) renderProducts("coffee-grid", productsFallback.filter((p) => p.cat === "coffee"));
    else renderProducts("coffee-grid", []);
  }
}

async function loadDrinksProducts() {
  showSkeletons("drinks-grid", 4);
  try {
    const response = await api.getProductsNoCache({ category: "drinks", limit: 20 });
    if (response.success && Array.isArray(response.data) && response.data.length) {
      const formatted = response.data.map(formatApiProduct);
      mergeProducts(formatted, { replaceCategory: "drinks" });
      _productsLoaded = true;
      renderProducts("drinks-grid", formatted);
    } else {
      _productsLoaded = true;
      renderProducts("drinks-grid", []);
    }
  } catch (e) {
    console.warn("loadDrinksProducts fallback:", e.message);
    if (!_productsLoaded) renderProducts("drinks-grid", productsFallback.filter((p) => p.cat === "drinks"));
    else renderProducts("drinks-grid", []);
  }
}

async function loadBrassProducts() {
  showSkeletons("brass-grid", 4);
  try {
    const response = await api.getProductsNoCache({ category: "brass", limit: 20 });
    if (response.success && Array.isArray(response.data) && response.data.length) {
      const formatted = response.data.map(formatApiProduct);
      mergeProducts(formatted, { replaceCategory: "brass" });
      _productsLoaded = true;
      renderProducts("brass-grid", formatted);
    } else {
      _productsLoaded = true;
      renderProducts("brass-grid", []);
    }
  } catch (e) {
    console.warn("loadBrassProducts fallback:", e.message);
    if (!_productsLoaded) renderProducts("brass-grid", productsFallback.filter((p) => p.cat === "brass"));
    else renderProducts("brass-grid", []);
  }
}

async function loadCartFromAPI() {
  if (!isUserLoggedIn()) {
    const localItems = loadCartLocally();
    if (localItems.length) {
      Store.setState("cart", () => ({ items: localItems }));
      renderCart();
      updateCartCount();
    }
    return;
  }
  try {
    const response = await api.getCart();
    if (response.success && response.data) {
      const rawItems = response.data.items || [];
      const serverItems = rawItems.map((item) => {
        let img = item.image || item.product?.images?.[0] || "imagesCoffe/spinning_coffee_cup.png";
        if (img.startsWith("/uploads/")) {
          img = "imagesCoffe/" + img.split("/").pop();
        } else if (img && !img.startsWith("imagesCoffe/") && !img.startsWith("http")) {
          img = "imagesCoffe/" + img.split("/").pop();
        }
        return {
          id: item.productId || item.id,
          name: item.name || item.product?.name || "Unknown",
          sub: "Premium Quality",
          image: img,
          price: parseFloat(item.price || item.product?.price || 0),
          qty: item.qty || item.quantity || 1
        };
      });
      const localItems = loadCartLocally().map((li) => ({ ...li, id: String(li.id) }));
      const merged = [...serverItems];
      for (const localItem of localItems) {
        const exists = merged.find((i) => String(i.id) === String(localItem.id));
        if (exists) {
          exists.qty += localItem.qty;
          try {
            await api.updateCartItem(String(exists.id), exists.qty);
          } catch (e) {
            console.error("Merge update failed:", e);
          }
        } else {
          // push a normalized local item and persist to server
          merged.push({ ...localItem, id: String(localItem.id) });
          try {
            await api.addToCart(String(localItem.id), localItem.qty);
          } catch (e) {
            console.error("Merge add failed:", e);
          }
        }
      }
      clearLocalCart();
      Store.setState("cart", () => ({ items: merged }));
      renderCart();
      updateCartCount();
    }
  } catch (error) {
    if (error.message?.includes("Authentication")) {
      const localItems = loadCartLocally();
      if (localItems.length) {
        Store.setState("cart", () => ({ items: localItems }));
        renderCart();
        updateCartCount();
      }
      return;
    }
    console.error("loadCartFromAPI failed:", error);
  }
}

/* ═══════════════ INIT ═══════════════ */
window.init = async function () {
  showSkeletons("featured-grid", 6);
  showSkeletons("coffee-grid", 6);
  showSkeletons("drinks-grid", 4);
  showSkeletons("brass-grid", 4);

  await Promise.all([
    loadRealProducts(),
    loadCoffeeProducts(),
    loadDrinksProducts(),
    loadBrassProducts()
  ]);

  // تحديث وعرض المنتجات في الصفحة الرئيسية بعد انتهاء التحميل
  const activeTab = document.querySelector(".filter-tab.active");
  if (activeTab) {
    const isAll = activeTab.textContent.toLowerCase().includes("all");
    filterProducts(isAll ? "all" : "coffee", activeTab);
  } else {
    filterProducts("all");
  }

  Router.init();
  loadCartFromAPI();
  updateCartCount();
  renderSmallProducts();
  updateAccountBtn();
  applySavedTheme();
  if (typeof initPremiumVisuals === "function") {
    initPremiumVisuals();
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => window.init());
} else {
  window.init();
}

function toggleAdminSidebar() {
  const sidebar = document.querySelector(".admin-sidebar");
  const overlay = document.getElementById("admin-sidebar-overlay");
  const toggle = document.getElementById("admin-sidebar-toggle");
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle("open");
  if (overlay) overlay.classList.toggle("open", isOpen);
  if (toggle) toggle.textContent = isOpen ? "✕" : "☰";
}

function closeAdminSidebar() {
  const sidebar = document.querySelector(".admin-sidebar");
  if (sidebar) sidebar.classList.remove("open");
  const overlay = document.getElementById("admin-sidebar-overlay");
  if (overlay) overlay.classList.remove("open");
  const toggle = document.getElementById("admin-sidebar-toggle");
  if (toggle) toggle.textContent = "☰";
}

/* ═══════════════ PREMIUM VISUAL EFFECTS ═══════════════ */
function initPremiumVisuals() {
  initGoldParticles();
  initStatsCounter();
  initScrollReveal();
  initTiltEffect();
}

function initGoldParticles() {
  if (document.getElementById('gold-particles-canvas')) return;
  const canvas = document.createElement('canvas');
  canvas.id = 'gold-particles-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '1';
  canvas.style.opacity = '0.35';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  const particles = [];
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const count = isMobile ? 15 : 35;

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height + height;
      this.size = Math.random() * 2.2 + 0.6;
      this.speedY = -(Math.random() * 0.7 + 0.15);
      this.speedX = Math.random() * 0.3 - 0.15;
      this.opacity = Math.random() * 0.5 + 0.1;
      this.fadeSpeed = Math.random() * 0.004 + 0.001;
    }
    update() {
      this.y += this.speedY;
      this.x += this.speedX;
      this.opacity -= this.fadeSpeed;
      if (this.y < 0 || this.opacity <= 0) {
        this.reset();
        this.y = height + 10;
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(229, 199, 126, ${this.opacity})`;
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#c9a84c';
      ctx.fill();
    }
  }

  for (let i = 0; i < count; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  animate();
}

function initStatsCounter() {
  const stats = document.querySelectorAll('.about-hero-stat strong, .health-number');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        if (el.dataset.animated) return;
        el.dataset.animated = 'true';
        const originalText = el.textContent;
        const matches = originalText.match(/(\d+)/);
        if (!matches) return;
        const targetValue = parseInt(matches[1], 10);
        const suffix = originalText.replace(matches[1], '');
        const prefix = originalText.substring(0, originalText.indexOf(matches[1]));

        let start = 0;
        const duration = 1500;
        const startTime = performance.now();

        function updateCounter(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const ease = progress * (2 - progress);
          const currentValue = Math.floor(ease * targetValue);
          el.textContent = prefix + currentValue + suffix;

          if (progress < 1) {
            requestAnimationFrame(updateCounter);
          } else {
            el.textContent = originalText;
          }
        }
        requestAnimationFrame(updateCounter);
      }
    });
  }, { threshold: 0.1 });

  stats.forEach(s => observer.observe(s));
}

function initScrollReveal() {
  const elementsToReveal = document.querySelectorAll(
    '.categories-section, .products-section .section-header, ' +
    '.about-hero-title, .about-hero-sub, .about-section-title, .about-section-sub, ' +
    '.story-grid, .video-wrap, .bean-card, .roast-card, .blend-card, .health-stat-card, .benefit-item, .kids-drink-card'
  );

  elementsToReveal.forEach(el => {
    el.classList.add('reveal');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  elementsToReveal.forEach(el => observer.observe(el));
}

function initTiltEffect() {
  const cards = document.querySelectorAll('.bean-card, .kids-drink-card, .roast-card');
  if (window.matchMedia('(pointer: fine)').matches) {
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((centerY - y) / centerY) * 6;
        const rotateY = ((x - centerX) / centerX) * 6;

        card.style.transform = `perspective(1000px) translateY(-5px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });

      card.style.transition = 'transform 0.15s ease-out, box-shadow 0.35s ease';

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }
}

function applyVisualsToContainer(container) {
  const cards = container.querySelectorAll('.product-card');
  
  if (window.matchMedia('(pointer: fine)').matches) {
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((centerY - y) / centerY) * 6;
        const rotateY = ((x - centerX) / centerX) * 6;

        card.style.transform = `perspective(1000px) translateY(-5px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });

      card.style.transition = 'transform 0.15s ease-out, box-shadow 0.35s ease, border-color 0.35s ease, background 0.35s ease';

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  cards.forEach(card => {
    card.classList.add('reveal');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });

  cards.forEach(card => observer.observe(card));
}
