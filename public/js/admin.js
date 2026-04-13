/**
 * AOS Admin Panel v2.0 - JavaScript
 * ✅ CSP Compatible - Koi bhi onclick nahi
 * ✅ Firebase Firestore + localStorage fallback
 * ✅ Orders list, search, filter, status update
 */

// ============================================
// FIREBASE CONFIG — apna config yahan daalo
// ============================================
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Firebase available hai ya nahi — auto detect
let db = null;
let useFirebase = false;

function initFirebase() {
  try {
    if (typeof firebase !== "undefined" && FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY") {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
      useFirebase = true;
      console.log("✅ Firebase connected");
    } else {
      console.warn("⚠️ Firebase config nahi mila — localStorage fallback use ho raha hai");
    }
  } catch (e) {
    console.warn("⚠️ Firebase init failed:", e.message);
  }
}

// ============================================
// STATE
// ============================================
let TOKEN = localStorage.getItem("aos_admin_token") || "";
let currentOrderId = null;
let currentPage = 1;
let searchDebounce = null;
let allOrders = []; // local cache
const PAGE_SIZE = 15;

// ============================================
// INIT
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  initFirebase();

  if (TOKEN) {
    showAdminPanel();
    loadDashboard();
  }

  setupAdminListeners();
});

// ============================================
// EVENT LISTENERS — koi onclick nahi
// ============================================
function setupAdminListeners() {
  // Login
  document.getElementById("loginPassword")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") doLogin();
  });
  document.getElementById("loginBtn")?.addEventListener("click", doLogin);
  document.getElementById("logoutBtn")?.addEventListener("click", doLogout);

  // Sidebar nav
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      if (section) showSection(section);
    });
  });

  // "View All" button on dashboard
  document.getElementById("viewAllOrdersBtn")?.addEventListener("click", () => {
    showSection("orders");
  });

  // Refresh
  document.getElementById("refreshBtn")?.addEventListener("click", refreshCurrent);

  // Search + filter
  document.getElementById("orderSearch")?.addEventListener("input", debounceSearch);
  document.getElementById("statusFilter")?.addEventListener("change", () => applyLocalFilter());

  // Order detail modal — close
  document.getElementById("closeOrderDetailBtn")?.addEventListener("click", closeOrderDetail);
  document.getElementById("orderDetailOverlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeOrderDetail();
  });

  // Update status
  document.getElementById("updateStatusBtn")?.addEventListener("click", updateOrderStatus);

  // ESC key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeOrderDetail();
  });

  // Event delegation — dashboard recent orders (click on row)
  document.getElementById("recentOrdersList")?.addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-order-id]");
    if (row) viewOrder(row.dataset.orderId);
  });

  // Event delegation — orders table view button
  document.getElementById("ordersTableBody")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-view");
    if (btn) viewOrder(btn.dataset.orderId);
  });

  // Event delegation — pagination
  document.getElementById("ordersPagination")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".page-btn");
    if (btn && btn.dataset.page) renderOrdersPage(parseInt(btn.dataset.page));
  });
}

// ============================================
// AUTH
// ============================================
async function doLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const btn = document.getElementById("loginBtn");

  if (!email || !password) { showLoginError("Email aur password dono daalo"); return; }

  btn.innerHTML = '<span class="spinner-admin"></span> Logging in...';
  btn.disabled = true;

  // --- Firebase Auth ---
  if (useFirebase && typeof firebase !== "undefined") {
    try {
      await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = firebase.auth().currentUser;
      TOKEN = await user.getIdToken();
      localStorage.setItem("aos_admin_token", TOKEN);
      document.getElementById("adminEmailDisplay").textContent = email;
      showAdminPanel();
      loadDashboard();
    } catch (err) {
      showLoginError(err.message || "Login failed");
    } finally {
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
      btn.disabled = false;
    }
    return;
  }

  // --- Backend API Auth (fallback) ---
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.token) {
      TOKEN = data.token;
      localStorage.setItem("aos_admin_token", TOKEN);
      document.getElementById("adminEmailDisplay").textContent = data.email || email;
      showAdminPanel();
      loadDashboard();
    } else {
      showLoginError(data.error || "Invalid credentials");
    }
  } catch {
    // --- Dev/local fallback: hardcoded credentials ---
    const ADMIN_EMAIL = "admin@aos.com";
    const ADMIN_PASS  = "aos@admin123"; // sirf dev ke liye
    if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
      TOKEN = "local_dev_token";
      localStorage.setItem("aos_admin_token", TOKEN);
      document.getElementById("adminEmailDisplay").textContent = email;
      showAdminPanel();
      loadDashboard();
    } else {
      showLoginError("Server nahi mila. Dev mode: admin@aos.com / aos@admin123");
    }
  } finally {
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    btn.disabled = false;
  }
}

function showLoginError(msg) {
  const el = document.getElementById("loginError");
  if (el) { el.textContent = "❌ " + msg; el.style.display = "block"; }
}

function doLogout() {
  TOKEN = "";
  localStorage.removeItem("aos_admin_token");
  if (useFirebase && typeof firebase !== "undefined") {
    firebase.auth().signOut().catch(() => {});
  }
  document.getElementById("adminPanel").style.display = "none";
  document.getElementById("loginPage").style.display = "flex";
}

function showAdminPanel() {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("adminPanel").style.display = "flex";
}

// ============================================
// DATA LAYER — Firebase ya localStorage
// ============================================

/** Saare orders fetch karo (Firebase ya localStorage) */
async function fetchAllOrders() {
  // --- Firebase ---
  if (useFirebase && db) {
    const snap = await db.collection("orders").orderBy("createdAt", "desc").get();
    return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
  }

  // --- localStorage fallback ---
  const raw = localStorage.getItem("aos_orders");
  if (raw) {
    const orders = JSON.parse(raw);
    // Newest first
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // --- Backend API fallback ---
  try {
    const res = await fetch("/api/admin/orders?limit=500", {
      headers: { Authorization: "Bearer " + TOKEN },
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.orders || [];
  } catch {
    return [];
  }
}

/** Single order ka status update karo */
async function updateOrderInDB(orderId, status) {
  // --- Firebase ---
  if (useFirebase && db) {
    await db.collection("orders").doc(orderId).update({ status, updatedAt: new Date().toISOString() });
    return true;
  }

  // --- localStorage fallback ---
  const raw = localStorage.getItem("aos_orders");
  if (raw) {
    const orders = JSON.parse(raw);
    const idx = orders.findIndex(o => o._id === orderId || o.orderNumber === orderId);
    if (idx !== -1) {
      orders[idx].status = status;
      orders[idx].updatedAt = new Date().toISOString();
      localStorage.setItem("aos_orders", JSON.stringify(orders));
      return true;
    }
  }

  // --- Backend API fallback ---
  const res = await fetch(`/api/admin/order/${orderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + TOKEN,
    },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  return data.success;
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
  try {
    allOrders = await fetchAllOrders();

    const today = new Date().toDateString();
    const totalOrders   = allOrders.length;
    const pendingOrders = allOrders.filter(o => o.status === "Pending").length;
    const totalRevenue  = allOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const todayOrders   = allOrders.filter(o => new Date(o.createdAt).toDateString() === today).length;

    setText("statTotal",   totalOrders);
    setText("statPending", pendingOrders);
    setText("statRevenue", "₹" + totalRevenue.toFixed(0));
    setText("statToday",   todayOrders);

    const badge = document.getElementById("pendingBadge");
    if (badge) {
      badge.textContent = pendingOrders;
      badge.style.display = pendingOrders > 0 ? "inline" : "none";
    }

    renderRecentOrders(allOrders.slice(0, 5));
  } catch (err) {
    console.error("Dashboard load error:", err);
  }
}

function renderRecentOrders(orders) {
  const container = document.getElementById("recentOrdersList");
  if (!container) return;

  if (!orders.length) {
    container.innerHTML = '<p style="text-align:center;color:#78716c;padding:2rem;">Koi orders nahi hain abhi</p>';
    return;
  }

  container.innerHTML = `
    <table class="orders-table">
      <thead><tr>
        <th>Order #</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th>
      </tr></thead>
      <tbody>
        ${orders.map(o => `
          <tr style="cursor:pointer" data-order-id="${o._id || o.orderNumber}">
            <td><span class="order-num">#${o.orderNumber || o._id}</span></td>
            <td>
              <div class="customer-name">${o.customer?.firstName || ""} ${o.customer?.lastName || ""}</div>
              <div class="customer-phone">${o.customer?.phone || ""}</div>
            </td>
            <td class="total-amt">₹${(o.total || 0).toFixed(0)}</td>
            <td><span class="status-badge s-${o.status}">${o.status || "Pending"}</span></td>
            <td>${formatDate(o.createdAt)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ============================================
// ORDERS — Search, Filter, Pagination
// ============================================
async function loadOrders(page = 1) {
  currentPage = page;
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" class="loading-row"><div class="spinner-admin"></div> Loading...</td></tr>';

  try {
    if (!allOrders.length) allOrders = await fetchAllOrders();
    applyLocalFilter();
  } catch {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-row" style="color:#ef4444">Error loading orders</td></tr>';
  }
}

/** Search + filter locally (fast, no extra API calls) */
function applyLocalFilter() {
  const status = document.getElementById("statusFilter")?.value || "all";
  const search = (document.getElementById("orderSearch")?.value || "").toLowerCase().trim();

  let filtered = [...allOrders];

  // Status filter
  if (status !== "all") {
    filtered = filtered.filter(o => o.status === status);
  }

  // Search filter — naam, phone, order number
  if (search) {
    filtered = filtered.filter(o => {
      const name = `${o.customer?.firstName || ""} ${o.customer?.lastName || ""}`.toLowerCase();
      const phone = (o.customer?.phone || "").toLowerCase();
      const orderNum = String(o.orderNumber || o._id || "").toLowerCase();
      return name.includes(search) || phone.includes(search) || orderNum.includes(search);
    });
  }

  // Paginate
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const pageOrders = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  renderOrdersTable(pageOrders);
  renderPagination(totalPages, currentPage);
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-row">Koi orders nahi mili</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><span class="order-num">#${o.orderNumber || o._id}</span></td>
      <td>
        <div class="customer-name">${o.customer?.firstName || ""} ${o.customer?.lastName || ""}</div>
        <div class="customer-phone">${o.customer?.phone || ""}</div>
      </td>
      <td class="items-count">${o.items?.length || 0} item(s)</td>
      <td class="total-amt">₹${(o.total || 0).toFixed(0)}</td>
      <td><span class="pay-badge pay-${o.paymentMethod || "COD"}">${o.paymentMethod || "COD"}</span></td>
      <td><span class="status-badge s-${o.status}">${o.status || "Pending"}</span></td>
      <td>${formatDate(o.createdAt)}</td>
      <td>
        <button class="action-btn btn-view" data-order-id="${o._id || o.orderNumber}">
          <i class="fas fa-eye"></i> View
        </button>
      </td>
    </tr>
  `).join("");
}

function renderPagination(totalPages, current) {
  const container = document.getElementById("ordersPagination");
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ""; return; }

  let html = "";
  if (current > 1)
    html += `<button class="page-btn" data-page="${current - 1}">← Prev</button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === current ? "active" : ""}" data-page="${i}">${i}</button>`;
  }
  if (current < totalPages)
    html += `<button class="page-btn" data-page="${current + 1}">Next →</button>`;

  container.innerHTML = html;
}

function renderOrdersPage(page) {
  currentPage = page;
  applyLocalFilter();
}

function debounceSearch() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    currentPage = 1;
    applyLocalFilter();
  }, 400);
}

// ============================================
// ORDER DETAIL MODAL
// ============================================
async function viewOrder(orderId) {
  currentOrderId = orderId;
  const overlay = document.getElementById("orderDetailOverlay");
  const body = document.getElementById("orderDetailBody");
  if (!overlay || !body) return;

  overlay.classList.add("open");
  body.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="spinner-admin"></div></div>';

  try {
    // Local cache mein dhundo pehle
    let order = allOrders.find(o => o._id === orderId || String(o.orderNumber) === String(orderId));

    // Agar cache mein nahi toh Firebase se
    if (!order && useFirebase && db) {
      const snap = await db.collection("orders").doc(orderId).get();
      if (snap.exists) order = { _id: snap.id, ...snap.data() };
    }

    if (!order) { body.innerHTML = "<p style='color:red;text-align:center;'>Order not found</p>"; return; }

    const titleEl = document.getElementById("orderDetailTitle");
    const statusSelect = document.getElementById("statusUpdateSelect");
    if (titleEl) titleEl.textContent = `Order #${order.orderNumber || order._id}`;
    if (statusSelect) statusSelect.value = order.status || "Pending";

    const itemsHtml = (order.items || []).map(i => `
      <div class="order-item-row">
        <span>${i.name} ${i.size ? `(${i.size})` : ""} × ${i.quantity}</span>
        <span>₹${(i.price * i.quantity).toFixed(0)}</span>
      </div>
    `).join("");

    body.innerHTML = `
      <div class="detail-section">
        <h4>👤 Customer Information</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Name</span>
            <span class="detail-val">${order.customer?.firstName || ""} ${order.customer?.lastName || ""}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Phone / WhatsApp</span>
            <span class="detail-val">${order.customer?.phone || "—"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Email</span>
            <span class="detail-val">${order.customer?.email || "—"}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">OTP Verified</span>
            <span class="detail-val">${order.otpVerified ? "✅ Yes" : "❌ No"}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h4>📍 Delivery Address</h4>
        <p style="font-size:.9rem;line-height:1.8;">
          ${order.customer?.address || "—"}<br/>
          ${order.customer?.city || ""}, ${order.customer?.state || ""} — ${order.customer?.zipCode || ""}
        </p>
      </div>

      <div class="detail-section">
        <h4>🛍️ Order Items</h4>
        <div class="order-items-list">${itemsHtml || "<p>No items</p>"}</div>
        <div style="display:flex;justify-content:space-between;padding:.75rem .5rem;font-weight:700;border-top:2px solid #d4af37;margin-top:.5rem;">
          <span>Total</span>
          <span>₹${(order.total || 0).toFixed(0)}
            <span class="pay-badge pay-${order.paymentMethod || 'COD'}" style="margin-left:.5rem;">${order.paymentMethod || "COD"}</span>
          </span>
        </div>
      </div>

      <div class="detail-section">
        <h4>📋 Order Info</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Order Date</span>
            <span class="detail-val">${formatDate(order.createdAt, true)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Current Status</span>
            <span class="status-badge s-${order.status}">${order.status || "Pending"}</span>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    body.innerHTML = "<p style='color:red;text-align:center;'>Error loading order details</p>";
    console.error(err);
  }
}

function closeOrderDetail() {
  document.getElementById("orderDetailOverlay")?.classList.remove("open");
  currentOrderId = null;
}

async function updateOrderStatus() {
  if (!currentOrderId) return;

  const status = document.getElementById("statusUpdateSelect")?.value;
  const btn = document.getElementById("updateStatusBtn");
  if (!btn || !status) return;

  btn.innerHTML = '<div class="spinner-admin"></div> Updating...';
  btn.disabled = true;

  try {
    const success = await updateOrderInDB(currentOrderId, status);
    if (success) {
      // Local cache bhi update karo
      const idx = allOrders.findIndex(o => o._id === currentOrderId || String(o.orderNumber) === String(currentOrderId));
      if (idx !== -1) allOrders[idx].status = status;

      showAdminToast(`✅ Status updated to "${status}"`);
      closeOrderDetail();
      applyLocalFilter();   // Table refresh
      loadDashboard();      // Stats refresh
    } else {
      showAdminToast("❌ Update fail hua");
    }
  } catch {
    showAdminToast("❌ Server error");
  } finally {
    btn.innerHTML = '<i class="fas fa-save"></i> Update Status';
    btn.disabled = false;
  }
}

// ============================================
// CONTACTS
// ============================================
async function loadContacts() {
  const container = document.getElementById("contactsList");
  if (!container) return;
  container.innerHTML = '<div class="spinner-admin" style="display:block;margin:2rem auto;"></div>';

  try {
    let contacts = [];

    // Firebase
    if (useFirebase && db) {
      const snap = await db.collection("contacts").orderBy("createdAt", "desc").get();
      contacts = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    } else {
      // localStorage fallback
      const raw = localStorage.getItem("aos_contacts");
      contacts = raw ? JSON.parse(raw) : [];

      // Backend API fallback
      if (!contacts.length) {
        const res = await fetch("/api/admin/contacts", {
          headers: { Authorization: "Bearer " + TOKEN },
        });
        contacts = await res.json();
      }
    }

    if (!contacts.length) {
      container.innerHTML = '<p style="text-align:center;color:#78716c;padding:2rem;">Koi messages nahi hain</p>';
      return;
    }

    container.innerHTML = contacts.map(c => `
      <div class="contact-card">
        <div class="contact-card-header">
          <div>
            <div class="contact-name">${c.name || "—"}</div>
            <div class="contact-meta">${c.email || ""} ${c.phone ? "| " + c.phone : ""}</div>
          </div>
          <div class="contact-date">${formatDate(c.createdAt)}</div>
        </div>
        <div class="contact-msg">${c.message || ""}</div>
      </div>
    `).join("");
  } catch {
    container.innerHTML = '<p style="color:red;text-align:center;">Error loading messages</p>';
  }
}

// ============================================
// NAVIGATION
// ============================================
function showSection(name) {
  ["dashboard", "orders", "contacts"].forEach(s => {
    document.getElementById(`${s}Section`)?.classList.remove("active");
  });
  document.getElementById(`${name}Section`)?.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
  document.querySelector(`.nav-item[data-section="${name}"]`)?.classList.add("active");

  const titles = { dashboard: "Dashboard", orders: "Orders", contacts: "Messages" };
  setText("pageTitle", titles[name] || name);

  if (name === "orders") loadOrders(1);
  else if (name === "contacts") loadContacts();
  else if (name === "dashboard") loadDashboard();
}

function refreshCurrent() {
  const active = document.querySelector(".nav-item.active")?.dataset.section;
  if (active) showSection(active);
}

// ============================================
// HELPERS
// ============================================
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function formatDate(iso, full = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  if (full) {
    return (
      d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
      " " +
      d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    );
  }
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function showAdminToast(msg) {
  const toast = document.getElementById("adminToast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}
