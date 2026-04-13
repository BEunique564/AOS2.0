/**
 * AOS E-COMMERCE v2.0 - Frontend Script
 * Angelic Organic Spark
 * 
 * FIXES APPLIED:
 * 1. "Shop Collection" button - scrollToProducts() wired in DOMContentLoaded
 * 2. productsGrid fallback - agar ID match nahi toh bhi kaam kare
 * 3. Filter tabs "scrubs" -> "scrub" category match fix
 * 4. animateOnScroll - products render hone ke BAAD call hogi
 */

// ============================================
// PRODUCTS DATA
// ============================================
const PRODUCTS = [
  {
    id: "AOS-FP-100",
    name: "AOS Organic Face Pack",
    shortName: "Face Pack — 100G",
    description: "Premium organic face pack with Ayurvedic ingredients. Deep cleansing aur hydration ke liye best. Weekly use ke liye perfect.",
    price: 199,
    mrp: 399,
    image: "images/FACEPACK.png",
    sizes: ["100G"],
    category: "face-pack",
    badge: "bestseller",
    inventory: 50,
    ingredients: ["Rose Extract", "Turmeric", "Neem", "Aloe Vera", "Sandalwood"],
    benefits: ["Deep Cleansing", "Hydration", "Anti-aging", "Natural Glow"],
  },
  {
    id: "AOS-FP-050",
    name: "AOS Organic Face Pack",
    shortName: "Face Pack — 50G",
    description: "Regular use ke liye mid-size face pack. Natural ingredients se healthy, glowing skin ke liye.",
    price: 149,
    mrp: 299,
    image: "images/FACEPACK.png",
    sizes: ["50G"],
    category: "face-pack",
    badge: null,
    inventory: 70,
    ingredients: ["Rose Extract", "Turmeric", "Neem", "Aloe Vera", "Sandalwood"],
    benefits: ["Deep Cleansing", "Hydration", "Anti-aging", "Natural Glow"],
  },
  {
    id: "AOS-FP-030",
    name: "AOS Organic Face Pack",
    shortName: "Face Pack — 30G",
    description: "Travel-friendly size. Safar mein bhi skincare routine maintain karein asaani se.",
    price: 119,
    mrp: 249,
    image: "images/FACEPACK.png",
    sizes: ["30G"],
    category: "face-pack",
    badge: null,
    inventory: 100,
    ingredients: ["Rose Extract", "Turmeric", "Neem", "Aloe Vera", "Sandalwood"],
    benefits: ["Deep Cleansing", "Hydration", "Anti-aging", "Natural Glow"],
  },
  {
    id: "AOS-FP-020",
    name: "AOS Organic Face Pack",
    shortName: "Face Pack — 20G",
    description: "Trial size - pehli baar try karne ke liye perfect. AOS ka farq khud mahsoos karein.",
    price: 99,
    mrp: 199,
    image: "images/FACEPACK.png",
    sizes: ["20G"],
    category: "face-pack",
    badge: "new",
    inventory: 120,
    ingredients: ["Rose Extract", "Turmeric", "Neem", "Aloe Vera", "Sandalwood"],
    benefits: ["Deep Cleansing", "Hydration", "Anti-aging", "Natural Glow"],
  },
  {
    id: "AOS-FS-120",
    name: "AOS Organic Face Scrub",
    shortName: "Face Scrub — 120G",
    description: "100% natural face scrub, bilkul no side effects. Smooth, radiant skin ke liye gentle exfoliation.",
    price: 299,
    mrp: 499,
    image: "images/singledry.png",
    sizes: ["120G"],
    category: "scrub",
    badge: "bestseller",
    inventory: 80,
    ingredients: ["Coffee Grounds", "Coconut Oil", "Brown Sugar", "Vitamin E", "Essential Oils"],
    benefits: ["Gentle Exfoliation", "Dead Skin Remove", "Improves Texture", "Natural Radiance"],
  },
];

// ============================================
// CART STATE
// ============================================
let cart = [];
try { cart = JSON.parse(localStorage.getItem("aos_cart_v2")) || []; } catch { cart = []; }

let verifyToken = null;
let otpTimerInterval = null;
let currentFilter = "all";

// ============================================
// ON LOAD — FIX #1: Sab kuch yahan wire karo
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  // Products render karo
  renderProducts(PRODUCTS);

  // Cart count update karo
  updateCartCount();

  // Sabhi event listeners lagao
  setupListeners();

  // ✅ FIX #1: "Shop Collection" button ko scrollToProducts se connect karo
  // Multiple selectors try karte hain kyunki HTML mein button ka exact class/ID
  // alag ho sakta hai
  const shopBtns = document.querySelectorAll(
    '.hero-btn, .shop-btn, [onclick*="scrollToProducts"], a[href="#products"]'
  );
  shopBtns.forEach(btn => {
    // Sirf woh button jo "Shop" ya "Collection" text contain kare
    if (btn.textContent.toLowerCase().includes("shop") ||
        btn.textContent.toLowerCase().includes("collection")) {
      btn.removeAttribute("href"); // href="#" se page jump rokein
      btn.style.cursor = "pointer";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        scrollToProducts();
      });
    }
  });

  // Animate on scroll (products render ke BAAD)
  animateOnScroll();
});

// ============================================
// RENDER PRODUCTS — FIX #2: Grid ID fallback
// ============================================
function renderProducts(list) {
  // ✅ FIX #2: Pehle "productsGrid" try karo, nahi mila toh dusre IDs try karo
  let grid = document.getElementById("productsGrid");
  
  if (!grid) grid = document.getElementById("products-grid");
  if (!grid) grid = document.querySelector(".products-grid");
  if (!grid) grid = document.querySelector("#products .grid");
  if (!grid) grid = document.querySelector("#products > div");

  if (!grid) {
    console.error("❌ Products grid element nahi mila! HTML mein id='productsGrid' wala div check karo.");
    return;
  }

  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">
      <i class="fas fa-box-open" style="font-size:3rem;margin-bottom:1rem;display:block;"></i>
      <p>Koi product nahi mila is category mein</p>
    </div>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const discount = Math.round(((p.mrp - p.price) / p.mrp) * 100);
    const badgeHtml = p.badge
      ? `<div class="product-badge ${p.badge === "bestseller" ? "bestseller" : ""}">${p.badge === "bestseller" ? "⭐ Bestseller" : p.badge.toUpperCase()}</div>`
      : "";

    return `
      <div class="product-card" data-category="${p.category}" data-id="${p.id}">
        <div class="product-img-wrap">
          ${badgeHtml}
          <img src="${p.image}" alt="${p.name}"
               onerror="this.src='data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\'><rect width=\'300\' height=\'300\' fill=\'%23fdf8ec\'/><text x=\'150\' y=\'150\' text-anchor=\'middle\' dominant-baseline=\'middle\' fill=\'%23d4af37\' font-size=\'40\'>🌿</text></svg>'" />
        </div>
        <div class="product-info">
          <span class="product-category">${p.category.replace("-", " ")}</span>
          <h3 class="product-name">${p.shortName}</h3>
          <p class="product-desc">${p.description}</p>
          <div class="product-pricing">
            <span class="price-current">₹${p.price}</span>
            <span class="price-mrp">₹${p.mrp}</span>
            <span class="price-discount">${discount}% off</span>
          </div>
          <div class="product-actions">
            <select class="size-select" id="sz-${p.id}">
              ${p.sizes.map(s => `<option value="${s}">${s}</option>`).join("")}
            </select>
            <button class="add-cart-btn" onclick="addToCart('${p.id}')" id="btn-${p.id}">
              <i class="fas fa-shopping-bag"></i> Add to Cart
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ============================================
// CART FUNCTIONS
// ============================================
function addToCart(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const sizeEl = document.getElementById(`sz-${productId}`);
  const size = sizeEl ? sizeEl.value : product.sizes[0];

  const existing = cart.find(i => i.id === productId && i.size === size);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id: productId, name: product.shortName, price: product.price, size, quantity: 1, image: product.image });
  }

  saveCart();
  updateCartCount();
  showToast(`${product.shortName} cart mein add ho gaya! 🛍️`);

  // Animate button
  const btn = document.getElementById(`btn-${productId}`);
  if (btn) {
    btn.innerHTML = '<i class="fas fa-check"></i> Added!';
    btn.classList.add("added");
    setTimeout(() => {
      btn.innerHTML = '<i class="fas fa-shopping-bag"></i> Add to Cart';
      btn.classList.remove("added");
    }, 1500);
  }
}

function removeFromCart(productId, size) {
  cart = cart.filter(i => !(i.id === productId && i.size === size));
  saveCart();
  updateCartCount();
  renderCartDrawer();
}

function updateQty(productId, size, delta) {
  const item = cart.find(i => i.id === productId && i.size === size);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) removeFromCart(productId, size);
  else { saveCart(); renderCartDrawer(); updateCartCount(); }
}

function saveCart() {
  try { localStorage.setItem("aos_cart_v2", JSON.stringify(cart)); } catch {}
}

function updateCartCount() {
  const total = cart.reduce((s, i) => s + i.quantity, 0);
  // ✅ FIX: Multiple selectors try karo cart count ke liye
  const el = document.getElementById("cartCount") ||
             document.querySelector(".cart-count") ||
             document.querySelector("[data-cart-count]");
  if (el) el.textContent = total;
}

function calcTotals() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = subtotal >= 499 ? 0 : (cart.length > 0 ? 50 : 0);
  return { subtotal, shipping, total: subtotal + shipping };
}

// ============================================
// CART DRAWER
// ============================================
function openCartDrawer() {
  document.getElementById("cartDrawer").classList.add("open");
  document.getElementById("cartOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  renderCartDrawer();
}

function closeCartDrawer() {
  document.getElementById("cartDrawer").classList.remove("open");
  document.getElementById("cartOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

function renderCartDrawer() {
  const container = document.getElementById("cartItems");
  const footer = document.getElementById("cartFooter");
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <i class="fas fa-shopping-bag"></i>
        <p>Aapka cart khaali hai</p>
        <button class="btn-primary" onclick="closeCartDrawer(); scrollToProducts()">
          <i class="fas fa-arrow-left"></i> Shop Now
        </button>
      </div>`;
    if (footer) footer.style.display = "none";
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item-row">
      <img class="cart-item-img" src="${item.image}" alt="${item.name}"
           onerror="this.src='data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'72\' height=\'72\'><rect width=\'72\' height=\'72\' fill=\'%23fdf8ec\'/><text x=\'36\' y=\'36\' text-anchor=\'middle\' dominant-baseline=\'middle\' fill=\'%23d4af37\' font-size=\'24\'>🌿</text></svg>'" />
      <div class="cart-item-details">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-size">${item.size}</div>
        <div class="cart-item-price">₹${(item.price * item.quantity).toFixed(0)}</div>
        <div class="qty-controls">
          <button class="qty-btn" onclick="updateQty('${item.id}','${item.size}',-1)">−</button>
          <span class="qty-num">${item.quantity}</span>
          <button class="qty-btn" onclick="updateQty('${item.id}','${item.size}',1)">+</button>
          <button class="cart-item-remove" onclick="removeFromCart('${item.id}','${item.size}')">
            <i class="fas fa-trash-alt"></i> Remove
          </button>
        </div>
      </div>
    </div>
  `).join("");

  const { subtotal, shipping, total } = calcTotals();
  document.getElementById("cartSubtotal").textContent = `₹${subtotal}`;
  document.getElementById("cartShipping").textContent = shipping === 0 ? "FREE 🎉" : `₹${shipping}`;
  document.getElementById("cartTotal").textContent = `₹${total}`;

  if (footer) footer.style.display = "block";
}

// ============================================
// CHECKOUT
// ============================================
function openCheckout() {
  if (cart.length === 0) { showToast("Cart khaali hai!", "error"); return; }
  closeCartDrawer();
  showStep(1);
  document.getElementById("checkoutOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeCheckout() {
  document.getElementById("checkoutOverlay").classList.remove("open");
  document.body.style.overflow = "";
  clearInterval(otpTimerInterval);
}

function showStep(n) {
  [1, 2, 3].forEach(i => {
    document.getElementById(`checkoutStep${i}`).classList.toggle("active", i === n);
    const btn = document.getElementById(`step${i}Btn`);
    if (btn) {
      btn.classList.remove("active", "done");
      if (i === n) btn.classList.add("active");
      else if (i < n) btn.classList.add("done");
    }
  });
}

async function goToStep2() {
  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const email = document.getElementById("custEmail").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const address = document.getElementById("custAddress").value.trim();
  const city = document.getElementById("custCity").value.trim();
  const zip = document.getElementById("custZip").value.trim();

  if (!firstName || !lastName || !email || !phone || !address || !city || !zip) {
    showToast("Sabhi * wale fields fill karein", "error"); return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("Valid email address daalo", "error"); return;
  }
  if (phone.length !== 10 || !/^\d{10}$/.test(phone)) {
    showToast("10 digit ka valid WhatsApp number daalo", "error"); return;
  }
  if (!/^\d{6}$/.test(zip)) {
    showToast("6 digit PIN code daalo", "error"); return;
  }

  await sendOTP(phone);
}

async function sendOTP(phone) {
  document.getElementById("otpSentMsg").textContent = "OTP bheja ja raha hai...";
  showStep(2);

  try {
    const res = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById("otpSentMsg").textContent =
        `OTP +91${phone} ke WhatsApp pe bhej diya gaya hai`;

      if (data.devOtp) {
        document.getElementById("devOtpHint").style.display = "block";
        document.getElementById("devOtpVal").textContent = data.devOtp;
      }

      startOTPTimer();
    } else {
      showToast(data.error || "OTP send nahi hua", "error");
      showStep(1);
    }
  } catch {
    showToast("Server se connection nahi hua. Try again.", "error");
    showStep(1);
  }
}

async function resendOTP() {
  const phone = document.getElementById("custPhone").value.trim();
  document.getElementById("resendBtn").disabled = true;
  await sendOTP(phone);
}

function startOTPTimer() {
  let seconds = 60;
  clearInterval(otpTimerInterval);
  document.getElementById("timerCount").textContent = seconds;
  document.getElementById("resendBtn").disabled = true;
  document.getElementById("otpTimer").style.display = "inline";

  otpTimerInterval = setInterval(() => {
    seconds--;
    document.getElementById("timerCount").textContent = seconds;
    if (seconds <= 0) {
      clearInterval(otpTimerInterval);
      document.getElementById("otpTimer").style.display = "none";
      document.getElementById("resendBtn").disabled = false;
    }
  }, 1000);
}

async function verifyOTP() {
  const phone = document.getElementById("custPhone").value.trim();
  const otp = document.getElementById("otpInput").value.trim();

  if (!otp || otp.length !== 6) {
    showToast("6 digit OTP daalo", "error"); return;
  }

  try {
    const res = await fetch("/api/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp }),
    });
    const data = await res.json();

    if (data.success) {
      verifyToken = data.verifyToken;
      clearInterval(otpTimerInterval);
      showToast("✅ OTP verified! Ab payment karein.", "success");
      fillOrderSummary();
      showStep(3);
    } else {
      showToast(data.error || "OTP galat hai", "error");
    }
  } catch {
    showToast("Verification fail hua. Try again.", "error");
  }
}

function fillOrderSummary() {
  const { subtotal, shipping, total } = calcTotals();
  const container = document.getElementById("checkoutItemsList");
  if (container) {
    container.innerHTML = cart.map(i =>
      `<div class="checkout-item-row">
        <span>${i.name} (${i.size}) × ${i.quantity}</span>
        <span>₹${(i.price * i.quantity).toFixed(0)}</span>
      </div>`
    ).join("");
  }
  document.getElementById("checkoutSubtotal").textContent = `₹${subtotal}`;
  document.getElementById("checkoutShipping").textContent = shipping === 0 ? "FREE 🎉" : `₹${shipping}`;
  document.getElementById("checkoutTotal").textContent = `₹${total}`;
}

document.addEventListener("click", (e) => {
  const opt = e.target.closest(".payment-option");
  if (!opt) return;
  document.querySelectorAll(".payment-option").forEach(o => o.classList.remove("active"));
  opt.classList.add("active");
  opt.querySelector('input[type="radio"]').checked = true;
  const val = opt.querySelector('input').value;
  document.getElementById("upiSection").style.display = val === "UPI" ? "block" : "none";
});

async function placeOrder() {
  if (!verifyToken) { showToast("Pehle OTP verify karein", "error"); return; }

  const btn = document.getElementById("placeOrderBtn");
  const original = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Processing...';
  btn.disabled = true;

  const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || "COD";
  const { total } = calcTotals();

  const orderData = {
    customer: {
      firstName: document.getElementById("firstName").value.trim(),
      lastName: document.getElementById("lastName").value.trim(),
      email: document.getElementById("custEmail").value.trim(),
      phone: document.getElementById("custPhone").value.trim(),
      address: document.getElementById("custAddress").value.trim(),
      city: document.getElementById("custCity").value.trim(),
      state: document.getElementById("custState").value.trim() || "Uttar Pradesh",
      zipCode: document.getElementById("custZip").value.trim(),
    },
    items: cart,
    total,
    paymentMethod,
    verifyToken,
  };

  try {
    const res = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });
    const data = await res.json();

    if (data.success) {
      cart = [];
      saveCart();
      updateCartCount();
      verifyToken = null;

      closeCheckout();
      document.getElementById("successOrderNum").textContent = data.orderNumber;
      document.getElementById("successOverlay").classList.add("open");
    } else {
      showToast(data.error || "Order fail hua. Try again.", "error");
    }
  } catch {
    showToast("Server error. Please try again.", "error");
  } finally {
    btn.innerHTML = original;
    btn.disabled = false;
  }
}

function closeSuccess() {
  document.getElementById("successOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

// ============================================
// CONTACT FORM
// ============================================
async function handleContactForm(e) {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  const original = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Sending...';
  btn.disabled = true;

  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();

    if (result.success) {
      showToast("✅ Message send ho gaya! Hum jald reply karenge.", "success");
      e.target.reset();
    } else {
      showToast("Message send nahi hua. Try again.", "error");
    }
  } catch {
    showToast("Server error. Try again.", "error");
  } finally {
    btn.innerHTML = original;
    btn.disabled = false;
  }
}

// ============================================
// FILTER TABS — FIX #3: "scrubs" -> "scrub" match
// ============================================
function setupFilterTabs() {
  document.querySelectorAll(".filter-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      // ✅ FIX #3: data-filter value ko normalize karo
      // HTML mein "scrubs" hoga lekin PRODUCTS mein category "scrub" hai
      const rawFilter = tab.dataset.filter;
      currentFilter = rawFilter;

      let filtered;
      if (rawFilter === "all") {
        filtered = PRODUCTS;
      } else {
        filtered = PRODUCTS.filter(p => {
          // Exact match ya partial match dono try karo
          return p.category === rawFilter ||
                 p.category === rawFilter.replace(/s$/, "") || // "scrubs" -> "scrub"
                 p.category.includes(rawFilter) ||
                 rawFilter.includes(p.category);
        });
      }

      renderProducts(filtered);

      // Re-apply animations naye render ke baad
      setTimeout(() => animateOnScroll(), 100);
    });
  });
}

// ============================================
// UTILITY
// ============================================
function scrollToProducts() {
  const el = document.getElementById("products");
  if (el) {
    el.scrollIntoView({ behavior: "smooth" });
  } else {
    // Fallback: products section dhundo
    const section = document.querySelector("section.products, .products-section, [data-section='products']");
    if (section) section.scrollIntoView({ behavior: "smooth" });
  }
}

function showToast(msg, type = "success") {
  const toast = document.getElementById("toast");
  const icon = document.getElementById("toastIcon");
  const msgEl = document.getElementById("toastMsg");
  if (!toast) return;

  icon.className = type === "error" ? "fas fa-exclamation-circle" : "fas fa-check-circle";
  toast.style.background = type === "error" ? "var(--error)" : "var(--brown)";
  msgEl.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function copyUPI() {
  const upiId = document.getElementById("upiIdText")?.textContent;
  if (upiId) {
    navigator.clipboard.writeText(upiId).then(() => showToast("UPI ID copied! ✓"));
  }
}

function showPolicy(type) {
  const policies = {
    shipping: "🚚 Shipping Policy\n\n• ₹499+ ke orders pe FREE shipping\n• ₹499 se kam pe ₹50 delivery charge\n• 3-5 business days mein delivery\n• Lucknow area mein 1-2 din",
    return: "↩️ Return Policy\n\n• 7 din ki return policy\n• Damaged ya wrong product pe full refund\n• Sealed product wapas karna zaroori hai\n• Return ke liye WhatsApp karein",
    privacy: "🔒 Privacy Policy\n\n• Aapka data sirf order fulfillment ke liye use hoga\n• Kisi bhi third party ko data nahi diya jayega\n• Payment details secure server pe process hoti hain",
    terms: "📋 Terms of Service\n\n• Sabhi orders OTP verification ke baad confirm hote hain\n• COD orders mein delivery pe cash ready rakhein\n• Prices bina notice ke change ho sakti hain",
  };
  alert(policies[type] || "Information unavailable");
}

// ============================================
// SCROLL ANIMATIONS
// ============================================
function animateOnScroll() {
  // Pehle se visible class ka style add karo agar nahi hai
  if (!document.getElementById("aos-visible-style")) {
    const style = document.createElement("style");
    style.id = "aos-visible-style";
    style.textContent = ".visible { opacity: 1 !important; transform: translateY(0) !important; }";
    document.head.appendChild(style);
  }

  const observer = new IntersectionObserver(
    (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
    { threshold: 0.1 }
  );

  document.querySelectorAll(".product-card, .feature-card, .step-card, .testimonial-card").forEach(el => {
    // Already visible class nahi hai toh animate karo
    if (!el.classList.contains("visible")) {
      el.style.opacity = "0";
      el.style.transform = "translateY(20px)";
      el.style.transition = "opacity .5s ease, transform .5s ease";
      observer.observe(el);
    }
  });
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupListeners() {
  // Hamburger menu
  const hamburger = document.getElementById("hamburger");
  const navMenu = document.getElementById("navMenu");
  hamburger?.addEventListener("click", () => {
    hamburger.classList.toggle("open");
    navMenu.classList.toggle("open");
  });

  // Close nav on link click
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      hamburger?.classList.remove("open");
      navMenu?.classList.remove("open");
    });
  });

  // Cart
  document.getElementById("cartBtn")?.addEventListener("click", openCartDrawer);
  document.getElementById("closeCart")?.addEventListener("click", closeCartDrawer);
  document.getElementById("cartOverlay")?.addEventListener("click", closeCartDrawer);

  // Checkout overlay click outside
  document.getElementById("checkoutOverlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeCheckout();
  });

  // Success overlay click outside
  document.getElementById("successOverlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeSuccess();
  });

  // Contact form
  document.getElementById("contactForm")?.addEventListener("submit", handleContactForm);

  // Filter tabs
  setupFilterTabs();

  // ✅ Scroll: header + back to top
  window.addEventListener("scroll", () => {
    const header = document.getElementById("header");
    const backToTop = document.getElementById("backToTop");
    if (header) header.classList.toggle("scrolled", window.scrollY > 50);
    if (backToTop) backToTop.classList.toggle("visible", window.scrollY > 400);

    // Active nav link highlight
    const sections = ["home", "products", "about", "contact"];
    let current = "";
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 100) current = id;
    });
    document.querySelectorAll(".nav-link").forEach(link => {
      link.classList.toggle("active", link.getAttribute("href") === `#${current}`);
    });
  });

  // OTP input - only numbers
  document.getElementById("otpInput")?.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "");
  });

  // Phone input - only numbers, max 10 digits
  document.getElementById("custPhone")?.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
  });

  // ZIP - only numbers, max 6 digits
  document.getElementById("custZip")?.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
  });

  // Enter key on OTP field
  document.getElementById("otpInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") verifyOTP();
  });

  // ESC key closes all modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCartDrawer();
      closeCheckout();
      closeSuccess();
    }
  });
}
