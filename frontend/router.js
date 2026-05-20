/* ═══════════════════════════════════════════════
   GODMODE STORE — router.js
   
═══════════════════════════════════════════════ */

const Router = (() => {
  /* ── الصفحات الصالحة ── */
  const VALID = new Set([
    "home",
    "coffee",
    "drinks",
    "brass",
    "about",
    "product",
    "cart",
    "checkout",
    "admin",
    "chatbot",
    "success",
    "404",
    "search"
  ]);

  /* ── حالة داخلية ── */
  let _current = "home";
  let _previous = "home";
  let _param = null; // مثلاً product ID

  /* ── قراءة الـ hash الحالي ── */
  function _parseHash() {
    const raw = window.location.hash.replace("#", "") || "home";
    const [page, param] = raw.split("/");
    return { page: VALID.has(page) ? page : "404", param: param || null };
  }

  /* ── تفعيل صفحة بدون تغيير الـ URL (internal) ── */
  function _activate(name, param) {
    /* أخفِ كل الصفحات */
    document
      .querySelectorAll(".page")
      .forEach((p) => p.classList.remove("active"));

    const el = document.getElementById("page-" + name);
    if (!el) {
      _activate("404", null);
      return;
    }
    el.classList.add("active");

    /* حدّث الـ nav links */
    document.querySelectorAll(".nav-inner a").forEach((a) => {
      a.classList.toggle("active", a.id === "nav-" + name);
    });

    /* حدّث Bottom Nav */
    document.querySelectorAll(".bottom-nav-item").forEach((a) => {
      const href = a.getAttribute("onclick") || "";
      a.classList.toggle("active", href.includes(`'${name}'`));
    });

    /* Scroll للأعلى */
    window.scrollTo({ top: 0, behavior: "smooth" });

    /* Hooks بعد التفعيل */
    if (name === "cart" || name === "checkout") renderCart();
    if (name === "admin") initAdmin();
    if (name === "product" && param) {
      if (typeof showProductDetail === "function") {
        showProductDetail(param, true);
      } else {
        _loadProduct(param);
      }
    }
  }

  /* ── تحميل المنتج عبر الـ param ── */
  function _loadProduct(id) {
     const p = getProductsSource().find((pr) => pr.id == id);
     if (!p) {
       navigate("404");
       return;
     }

    Store.setState("product", (s) => ({
      currentId: Number(id),
      currentPrice: p.price,
      qty: 1
    }));
    Store.setState("gallery", (s) => ({
      index: 0,
      images: productImages[id] || [p.image]
    }));

    document.getElementById("detail-name").textContent = p.name;
    document.getElementById("detail-breadcrumb").textContent = p.name;
    document.getElementById("detail-price").textContent =
      "$" + p.price.toFixed(2);
    document.getElementById("detail-desc").textContent = p.desc;
    document.getElementById("detail-reviews").textContent =
      `(${p.reviews} reviews)`;
    document.getElementById("qty-display").textContent = 1;
    document.getElementById("detail-image").innerHTML = renderGallery(
      p.badge || "PREMIUM"
    );

    document
      .querySelectorAll("#detail-size-chips .option-chip")
      .forEach((c, i) => c.classList.toggle("active", i === 0));
    document
      .querySelectorAll("#detail-opt1-chips .option-chip")
      .forEach((c, i) => c.classList.toggle("active", i === 0));

    renderRelated(id, p.cat);
  }

  /* ══════════════════════════════════
     API العامة
  ══════════════════════════════════ */

  /**
   * navigate(name, param?)
   * يغيّر الـ URL ويعرض الصفحة
   * مثال: Router.navigate('product', 3)  →  #product/3
   */
  function navigate(name, param) {
    if (!VALID.has(name)) name = "404";

    _previous = _current;
    _current = name;
    _param = param || null;

    /* chatbot: احفظ الصفحة السابقة في Store */
    if (name === "chatbot") {
      Store.setState("ui", (s) => ({
        previousPage: s.currentPage,
        currentPage: name
      }));
    } else {
      Store.setState("ui", (s) => ({ currentPage: name }));
    }

    /* اكتب الـ hash */
    const hash = param ? `#${name}/${param}` : `#${name}`;
    history.pushState({ name, param }, "", hash);

    _activate(name, param);
  }

  /**
   * replace(name, param?)
   * مثل navigate لكن بدون إضافة للـ History
   * مفيد للـ success page بعد الطلب
   */
  function replace(name, param) {
    if (!VALID.has(name)) name = "404";
    _previous = _current;
    _current = name;
    _param = param || null;

    const hash = param ? `#${name}/${param}` : `#${name}`;
    history.replaceState({ name, param }, "", hash);
    _activate(name, param);
  }

  /**
   * getCurrentPage() / getPreviousPage()
   */
  function getCurrentPage() {
    return _current;
  }
  function getPreviousPage() {
    return _previous;
  }

  /* ── استمع لزر الـ Back/Forward ── */
  window.addEventListener("popstate", (e) => {
    if (e.state) {
      _previous = _current;
      _current = e.state.name;
      _param = e.state.param || null;
      _activate(e.state.name, e.state.param);
    } else {
      /* hash قديم بدون state */
      const { page, param } = _parseHash();
      _previous = _current;
      _current = page;
      _param = param;
      _activate(page, param);
    }
  });

  /* ── التهيئة الأولى عند تحميل الصفحة ── */
  function init() {
    const { page, param } = _parseHash();
    _current = page;
    _param = param;

    /* اكتب state للصفحة الحالية حتى يعمل popstate */
    history.replaceState(
      { name: page, param },
      "",
      window.location.hash || "#home"
    );
    _activate(page, param);
  }

  return { navigate, replace, getCurrentPage, getPreviousPage, init };
})();

/* ════════════════════════════════════════════════════
   SHIM — استبدال الدوال القديمة بالـ Router الجديد
   (يضمن توافق بقية الكود دون تعديل كل سطر)
════════════════════════════════════════════════════ */

/**
 * showPage(name)  ← الدالة القديمة
 * الآن تستدعي Router.navigate تلقائياً
 */
function showPage(name) {
  Router.navigate(name);
}

/**
 * navTo(name, el)  ← تُستخدم في الـ nav links
 */
function navTo(name, el) {
  Router.navigate(name);
}



/**
 * previousPage ← متغيّر كان يُستخدم في chatbot close button
 * الآن يُقرأ من Router
 */
Object.defineProperty(window, "previousPage", {
  get() {
    return Router.getPreviousPage();
  }
});
