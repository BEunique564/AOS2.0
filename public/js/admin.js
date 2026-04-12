/**
 * AOS Admin Panel v2.0 - JavaScript
 */

let TOKEN = localStorage.getItem("aos_admin_token") || "";
let currentOrderId = null;
let currentPage = 1;
let searchDebounce = null;

// ============================================
// INIT
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  if (TOKEN) {
    // Try to restore session
    showAdminPanel();
    loadDashboard();
  }

  // Enter key on login
  document.getElementById("loginPassword")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") doLogin();
  });
});

// ============================================
// AUTH
// ============================================
async function doLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errorEl = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");

  if (!email || !password) {
    showLoginError("Email aur password dono daalo"); return;
  }

  btn.innerHTML = '<span class="spinner-admin"></span> Logging in...';
  btn.disabled = true;
  errorEl.style.display = "none";

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
    showLoginError("Server se connect nahi ho paya");
  } finally {
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    btn.disabled = false;
  }
}

function showLoginError(msg) {
  const el = document.getElementById("loginError");
  el.textContent = "❌ " + msg;
  el.style.display = "block";
}

function doLogout() {
  TOKEN = "";
  localStorage.removeItem("aos_admin_token");
  document.getElementById("adminPanel").style.display = "none";
  document.getElementById("loginPage").style.display = "flex";
}

function showAdminPanel() {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("adminPanel").style.display = "flex";
}

// ============================================
// API HELPER
// ============================================
async function apiGet(url) {
  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + TOKEN },
  });
  if (res.status === 401 || res.status === 403) {
    doLogout(); throw new Error("Unauthorized");
  }
  return res.json();
}

async function apiPut(url, body) {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + TOKEN,
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
  try {
    const [stats, ordersData] = await Promise.all([
      apiGet("/api/admin/stats"),
      apiGet("/api/admin/orders?limit=5&page=1"),
    ]);

    document.getElementById("statTotal").textContent = stats.totalOrders || 0;
    document.getElementById("statPending").textContent = stats.pendingOrders || 0;
    document.getElementById("statRevenue").textContent = "₹" + (stats.totalRevenue || 0).toFixed(0);
    document.getElementById("statToday").textContent = stats.todayOrders || 0;

    // Pending badge
    const badge = document.getElementById("pendingBadge");
    badge.textContent = stats.pendingOrders || 0;
    badge.style.display = stats.pendingOrders > 0 ? "inline" : "none";

    // Recent orders
    renderRecentOrders(ordersData.orders || []);
  } catch (err) {
    console.error("Dashboard load error:", err);
  }
}

function renderRecentOrders(orders) {
  const container = document.getElementById("recentOrdersList");
  if (!container) return;

  if (orders.length === 0) {
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
          <tr style="cursor:pointer" onclick="viewOrder('${o._id}')">
            <td><span class="order-num">#${o.orderNumber}</span></td>
            <td>
              <div class="customer-name">${o.customer?.firstName} ${o.customer?.lastName}</div>
              <div class="customer-phone">${o.customer?.phone}</div>
            </td>
            <td class="total-amt">₹${(o.total || 0).toFixed(0)}</td>
            <td><span class="status-badge s-${o.status}">${o.status}</span></td>
            <td>${formatDate(o.createdAt)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

// ============================================
// ORDERS
// ============================================
async function loadOrders(page = 1) {
  currentPage = page;
  const tbody = document.getElementById("ordersTableBody");
  tbody.innerHTML = '<tr><td colspan="8" class="loading-row"><div class="spinner-admin"></div> Loading...</td></tr>';

  const status = document.getElementById("statusFilter")?.value || "all";
  const search = document.getElementById("orderSearch")?.value || "";

  try {
    const data = await apiGet(`/api/admin/orders?page=${page}&limit=15&status=${status}&search=${encodeURIComponent(search)}`);
    renderOrdersTable(data.orders || []);
    renderPagination(data.pages || 1, page);
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-row" style="color:#ef4444">Error loading orders</td></tr>';
  }
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById("ordersTableBody");

  if (orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-row">Koi orders nahi mili</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><span class="order-num">#${o.orderNumber}</span></td>
      <td>
        <div class="customer-name">${o.customer?.firstName} ${o.customer?.lastName}</div>
        <div class="customer-phone">${o.customer?.phone}</div>
      </td>
      <td class="items-count">${o.items?.length || 0} item(s)</td>
      <td class="total-amt">₹${(o.total || 0).toFixed(0)}</td>
      <td><span class="pay-badge pay-${o.paymentMethod || "COD"}">${o.paymentMethod || "COD"}</span></td>
      <td><span class="status-badge s-${o.status}">${o.status}</span></td>
      <td>${formatDate(o.createdAt)}</td>
      <td>
        <button class="action-btn btn-view" onclick="viewOrder('${o._id}')">
          <i class="fas fa-eye"></i> View
        </button>
      </td>
    </tr>
  `).join("");
}

function renderPagination(totalPages, current) {
  const container = document.getElementById("ordersPagination");
  if (!container || totalPages <= 1) { if (container) container.innerHTML = ""; return; }

  let html = "";
  if (current > 1) html += `<button class="page-btn" onclick="loadOrders(${current - 1})">← Prev</button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${i === current ? "active" : ""}" onclick="loadOrders(${i})">${i}</button>`;
  }
  if (current < totalPages) html += `<button class="page-btn" onclick="loadOrders(${current + 1})">Next →</button>`;
  container.innerHTML = html;
}

function debounceSearch() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadOrders(1), 400);
}

// ============================================
// ORDER DETAIL MODAL
// ============================================
async function viewOrder(orderId) {
  currentOrderId = orderId;
  document.getElementById("orderDetailOverlay").classList.add("open");

  const body = document.getElementById("orderDetailBody");
  body.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="spinner-admin"></div></div>';

  try {
    // Fetch single order from list (reuse the orders endpoint with search)
    const data = await apiGet(`/api/admin/orders?search=${orderId}&limit=1`);
    const order = data.orders?.find(o => o._id === orderId);
    if (!order) { body.innerHTML = "<p>Order not found</p>"; return; }

    document.getElementById("orderDetailTitle").textContent = `Order #${order.orderNumber}`;
    document.getElementById("statusUpdateSelect").value = order.status;

    const itemsHtml = (order.items || []).map(i => `
      <div class="order-item-row">
        <span>${i.name} (${i.size}) × ${i.quantity}</span>
        <span>₹${(i.price * i.quantity).toFixed(0)}</span>
      </div>
    `).join("");

    body.innerHTML = `
      <div class="detail-section">
        <h4>Customer Information</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Name</span>
            <span class="detail-val">${order.customer?.firstName} ${order.customer?.lastName}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Phone / WhatsApp</span>
            <span class="detail-val">${order.customer?.phone}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Email</span>
            <span class="detail-val">${order.customer?.email}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">OTP Verified</span>
            <span class="detail-val">${order.otpVerified ? "✅ Yes" : "❌ No"}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h4>Delivery Address</h4>
        <p style="font-size:.9rem;line-height:1.7;">
          ${order.customer?.address}<br/>
          ${order.customer?.city}, ${order.customer?.state} - ${order.customer?.zipCode}
        </p>
      </div>

      <div class="detail-section">
        <h4>Order Items</h4>
        <div class="order-items-list">${itemsHtml}</div>
        <div style="display:flex;justify-content:space-between;padding:.75rem .5rem;font-weight:600;border-top:2px solid #d4af37;margin-top:.5rem;">
          <span>Total</span>
          <span>₹${(order.total || 0).toFixed(0)} (${order.paymentMethod})</span>
        </div>
      </div>

      <div class="detail-section">
        <h4>Order Info</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Order Date</span>
            <span class="detail-val">${formatDate(order.createdAt, true)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Current Status</span>
            <span class="status-badge s-${order.status}">${order.status}</span>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    body.innerHTML = "<p style='color:red'>Error loading order details</p>";
  }
}

function closeOrderDetail() {
  document.getElementById("orderDetailOverlay").classList.remove("open");
  currentOrderId = null;
}

async function updateOrderStatus() {
  if (!currentOrderId) return;

  const status = document.getElementById("statusUpdateSelect").value;
  const btn = document.getElementById("updateStatusBtn");
  btn.innerHTML = '<div class="spinner-admin"></div>';
  btn.disabled = true;

  try {
    const data = await apiPut(`/api/admin/order/${currentOrderId}`, { status });
    if (data.success) {
      showAdminToast(`Status updated to "${status}" ✅`);
      closeOrderDetail();
      loadOrders(currentPage);
      loadDashboard();
    } else {
      showAdminToast("Update fail hua ❌");
    }
  } catch {
    showAdminToast("Server error ❌");
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
  container.innerHTML = '<div class="spinner-admin" style="display:block;margin:2rem auto;"></div>';

  try {
    const contacts = await apiGet("/api/admin/contacts");
    if (!contacts.length) {
      container.innerHTML = '<p style="text-align:center;color:#78716c;padding:2rem;">Koi messages nahi hain</p>';
      return;
    }
    container.innerHTML = contacts.map(c => `
      <div class="contact-card">
        <div class="contact-card-header">
          <div>
            <div class="contact-name">${c.name}</div>
            <div class="contact-meta">${c.email || ""} ${c.phone ? "| " + c.phone : ""}</div>
          </div>
          <div class="contact-date">${formatDate(c.createdAt)}</div>
        </div>
        <div class="contact-msg">${c.message}</div>
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
  // Sections
  ["dashboard", "orders", "contacts"].forEach(s => {
    document.getElementById(`${s}Section`)?.classList.remove("active");
  });
  document.getElementById(`${name}Section`)?.classList.add("active");

  // Nav items
  document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
  document.querySelector(`[data-section="${name}"]`)?.classList.add("active");

  // Page title
  const titles = { dashboard: "Dashboard", orders: "Orders", contacts: "Messages" };
  document.getElementById("pageTitle").textContent = titles[name] || name;

  // Load data
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
function formatDate(iso, full = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (full) {
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function showAdminToast(msg) {
  const toast = document.getElementById("adminToast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}
