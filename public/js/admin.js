/**
 * AOS Admin Panel v2.0 — admin.js
 * ✅ CSP Safe — koi inline onclick nahi
 * ✅ JWT Auth (backend) + localStorage fallback
 * ✅ Analytics, WhatsApp, Razorpay Sync, Live Tracking
 */

// ============================================================
// CONFIG — apna backend URL yahan set karo
// ============================================================
const API_BASE = window.location.origin; // same origin pe serve ho raha hai

// ============================================================
// STATE
// ============================================================
let TOKEN        = localStorage.getItem("aos_admin_token") || "";
let adminEmail   = localStorage.getItem("aos_admin_email") || "";
let allOrders    = [];
let currentOrderId = null;
let currentPage  = 1;
let searchTimer  = null;
const PAGE_SIZE  = 20;

// Chart instances (destroy karo before re-render)
const CHARTS = {};

// ============================================================
// BOOT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  if (TOKEN) {
    showAdminPanel();
    loadDashboard();
  } else {
    document.getElementById("loginPage").style.display = "flex";
  }
  setupListeners();
});

// ============================================================
// ALL EVENT LISTENERS — koi onclick HTML mein nahi
// ============================================================
function setupListeners() {
  // Login
  document.getElementById("loginBtn")?.addEventListener("click", doLogin);
  document.getElementById("loginPassword")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });

  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", doLogout);

  // Sidebar toggle
  document.getElementById("sidebarToggle")?.addEventListener("click", toggleSidebar);

  // Nav items
  document.querySelectorAll(".nav-item[data-section]").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      showSection(item.dataset.section);
    });
  });

  // View all orders button (dashboard)
  document.getElementById("viewAllOrdersBtn")?.addEventListener("click", () => showSection("orders"));

  // Refresh
  document.getElementById("refreshBtn")?.addEventListener("click", refreshCurrent);

  // Order search + filters
  document.getElementById("orderSearch")?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { currentPage = 1; applyFilter(); }, 380);
  });
  document.getElementById("statusFilter")?.addEventListener("change", () => { currentPage = 1; applyFilter(); });
  document.getElementById("paymentFilter")?.addEventListener("change", () => { currentPage = 1; applyFilter(); });

  // Modal — close
  document.getElementById("closeOrderDetailBtn")?.addEventListener("click", closeModal);
  document.getElementById("orderDetailOverlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Modal — update status
  document.getElementById("updateStatusBtn")?.addEventListener("click", updateOrderStatus);

  // Razorpay sync
  document.getElementById("razorpaySyncBtn")?.addEventListener("click", syncRazorpay);

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // Event delegation — orders table
  document.getElementById("ordersTableBody")?.addEventListener("click", (e) => {
    const viewBtn = e.target.closest(".btn-view");
    if (viewBtn) { openOrderDetail(viewBtn.dataset.id); return; }
    const waBtn = e.target.closest(".btn-wa");
    if (waBtn) { openWhatsApp(waBtn.dataset.phone, waBtn.dataset.name, waBtn.dataset.order); return; }
  });

  // Event delegation — recent orders (dashboard)
  document.getElementById("recentOrdersList")?.addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-id]");
    if (row) openOrderDetail(row.dataset.id);
  });

  // Pagination
  document.getElementById("ordersPagination")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".page-btn[data-page]");
    if (btn) { currentPage = parseInt(btn.dataset.page); applyFilter(); }
  });
}

// ============================================================
// SIDEBAR TOGGLE
// ============================================================
function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("collapsed");
  document.getElementById("mainContent")?.classList.toggle("collapsed");
}

// ============================================================
// AUTH
// ============================================================
async function doLogin() {
  const email    = document.getElementById("loginEmail")?.value.trim();
  const password = document.getElementById("loginPassword")?.value;
  const btn      = document.getElementById("loginBtn");
  const errEl    = document.getElementById("loginError");

  errEl.style.display = "none";
  if (!email || !password) { showLoginError("Email aur password dono daalo"); return; }

  btn.innerHTML = '<span class="spinner-admin"></span> Logging in...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (data.token) {
      TOKEN = data.token;
      adminEmail = data.email || email;
      localStorage.setItem("aos_admin_token", TOKEN);
      localStorage.setItem("aos_admin_email", adminEmail);
      document.getElementById("adminEmailDisplay").textContent = adminEmail;
      showAdminPanel();
      loadDashboard();
    } else {
      showLoginError(data.error || data.message || "Invalid credentials");
    }
  } catch {
    // Dev fallback
    const DEV_EMAIL = "admin@aos.com";
    const DEV_PASS  = "aos@admin123";
    if (email === DEV_EMAIL && password === DEV_PASS) {
      TOKEN = "dev_token_local";
      adminEmail = email;
      localStorage.setItem("aos_admin_token", TOKEN);
      localStorage.setItem("aos_admin_email", email);
      document.getElementById("adminEmailDisplay").textContent = email;
      showAdminPanel();
      loadDashboard();
    } else {
      showLoginError("Server nahi mila. Dev: admin@aos.com / aos@admin123");
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
  TOKEN = ""; adminEmail = "";
  localStorage.removeItem("aos_admin_token");
  localStorage.removeItem("aos_admin_email");
  document.getElementById("adminPanel").style.display = "none";
  document.getElementById("loginPage").style.display  = "flex";
}

function showAdminPanel() {
  document.getElementById("loginPage").style.display  = "none";
  document.getElementById("adminPanel").style.display = "flex";
  if (adminEmail) document.getElementById("adminEmailDisplay").textContent = adminEmail;
}

// ============================================================
// DATA — fetch from backend / localStorage fallback
// ============================================================
async function fetchOrders() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/orders?limit=1000`, {
      headers: { Authorization: "Bearer " + TOKEN },
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return (data.orders || data || []).sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  } catch {
    // localStorage fallback
    try {
      const raw = localStorage.getItem("aos_orders");
      if (raw) {
        const orders = JSON.parse(raw);
        return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    } catch {}
    return [];
  }
}

async function fetchContacts() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/contacts`, {
      headers: { Authorization: "Bearer " + TOKEN },
    });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    try {
      const raw = localStorage.getItem("aos_contacts");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
}

async function patchOrderStatus(orderId, status) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/order/${orderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + TOKEN,
      },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    return data.success !== false;
  } catch {
    // localStorage fallback
    try {
      const raw = localStorage.getItem("aos_orders");
      if (raw) {
        const orders = JSON.parse(raw);
        const idx = orders.findIndex(o => (o._id === orderId || String(o.orderNumber) === String(orderId)));
        if (idx !== -1) {
          orders[idx].status = status;
          orders[idx].updatedAt = new Date().toISOString();
          localStorage.setItem("aos_orders", JSON.stringify(orders));
          return true;
        }
      }
    } catch {}
    return false;
  }
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  setSpinRefresh(true);
  try {
    allOrders = await fetchOrders();

    const today = new Date().toDateString();
    const total      = allOrders.length;
    const pending    = allOrders.filter(o => o.status === "Pending").length;
    const delivered  = allOrders.filter(o => o.status === "Delivered").length;
    const cancelled  = allOrders.filter(o => o.status === "Cancelled").length;
    const revenue    = allOrders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    const todayCount = allOrders.filter(o => new Date(o.createdAt).toDateString() === today).length;

    setText("statTotal",     total);
    setText("statPending",   pending);
    setText("statRevenue",   "₹" + formatNum(revenue));
    setText("statToday",     todayCount);
    setText("statDelivered", delivered);
    setText("statCancelled", cancelled);

    const badge = document.getElementById("pendingBadge");
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? "inline" : "none"; }

    renderRecentOrders(allOrders.slice(0, 6));
    renderWeekChart(allOrders);
    renderStatusChart(allOrders);
    renderRevenueChart(allOrders);
  } catch (err) {
    console.error("Dashboard load error:", err);
  } finally {
    setSpinRefresh(false);
  }
}

function renderRecentOrders(orders) {
  const el = document.getElementById("recentOrdersList");
  if (!el) return;
  if (!orders.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>Koi orders nahi hain abhi</p></div>'; return; }

  el.innerHTML = `
    <div class="orders-table-wrap">
      <table class="orders-table">
        <thead><tr><th>Order #</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
          ${orders.map(o => `
            <tr style="cursor:pointer" data-id="${o._id || o.orderNumber}">
              <td><span class="order-num">#${o.orderNumber || o._id}</span></td>
              <td>
                <div class="customer-name">${esc(o.customer?.firstName || "")} ${esc(o.customer?.lastName || "")}</div>
                <div class="customer-phone">${esc(o.customer?.phone || "")}</div>
              </td>
              <td class="total-amt">₹${formatNum(o.total)}</td>
              <td><span class="status-badge s-${o.status}">${o.status || "Pending"}</span></td>
              <td>${fmtDate(o.createdAt)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ============================================================
// CHARTS — Chart.js
// ============================================================
function destroyChart(key) {
  if (CHARTS[key]) { CHARTS[key].destroy(); delete CHARTS[key]; }
}

function renderWeekChart(orders) {
  destroyChart("week");
  const canvas = document.getElementById("weekChart");
  if (!canvas) return;

  const labels = [], data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toDateString();
    labels.push(d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }));
    data.push(orders.filter(o => new Date(o.createdAt).toDateString() === ds).length);
  }

  CHARTS.week = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Orders",
        data,
        backgroundColor: "rgba(212,175,55,0.7)",
        borderColor: "#d4af37",
        borderWidth: 1,
        borderRadius: 5,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#a09880", font: { size: 11 } }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#a09880", font: { size: 11 }, stepSize: 1 }, grid: { color: "rgba(255,255,255,0.05)" }, beginAtZero: true },
      },
    },
  });
}

function renderStatusChart(orders) {
  destroyChart("status");
  const canvas = document.getElementById("statusChart");
  if (!canvas) return;

  const statusList = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];
  const counts = statusList.map(s => orders.filter(o => o.status === s).length);
  const colors = ["#fbbf24","#60a5fa","#c084fc","#86efac","#22c55e","#f87171"];

  CHARTS.status = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: statusList,
      datasets: [{ data: counts, backgroundColor: colors, borderWidth: 2, borderColor: "#1a1914" }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "right", labels: { color: "#a09880", font: { size: 11 }, boxWidth: 12, padding: 8 } },
      },
      cutout: "60%",
    },
  });
}

function renderRevenueChart(orders) {
  destroyChart("revenue");
  const canvas = document.getElementById("revenueChart");
  if (!canvas) return;

  const days = 30;
  const labels = [], data = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toDateString();
    labels.push(i % 5 === 0 ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
    const dayRev = orders
      .filter(o => new Date(o.createdAt).toDateString() === ds)
      .reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    data.push(Math.round(dayRev));
  }

  CHARTS.revenue = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Revenue (₹)",
        data,
        borderColor: "#d4af37",
        backgroundColor: "rgba(212,175,55,0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: "#d4af37",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#a09880", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.04)" } },
        y: {
          ticks: { color: "#a09880", font: { size: 10 }, callback: v => "₹" + formatNum(v) },
          grid: { color: "rgba(255,255,255,0.04)" },
          beginAtZero: true,
        },
      },
    },
  });
}

// ============================================================
// ORDERS — filter, paginate, render
// ============================================================
function applyFilter() {
  const status  = document.getElementById("statusFilter")?.value || "all";
  const payment = document.getElementById("paymentFilter")?.value || "all";
  const search  = (document.getElementById("orderSearch")?.value || "").toLowerCase().trim();

  let filtered = [...allOrders];
  if (status  !== "all") filtered = filtered.filter(o => o.status === status);
  if (payment !== "all") filtered = filtered.filter(o => (o.paymentMethod || "COD") === payment);
  if (search) {
    filtered = filtered.filter(o => {
      const name     = `${o.customer?.firstName || ""} ${o.customer?.lastName || ""}`.toLowerCase();
      const phone    = (o.customer?.phone || "").toLowerCase();
      const orderNum = String(o.orderNumber || o._id || "").toLowerCase();
      return name.includes(search) || phone.includes(search) || orderNum.includes(search);
    });
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const slice = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  renderOrdersTable(slice);
  renderPagination(totalPages, currentPage);
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="loading-row"><i class="fas fa-search" style="margin-right:6px"></i>Koi orders nahi mili</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const id    = o._id || o.orderNumber;
    const name  = `${esc(o.customer?.firstName || "")} ${esc(o.customer?.lastName || "")}`.trim() || "—";
    const phone = esc(o.customer?.phone || "");
    const pm    = o.paymentMethod || "COD";
    return `
      <tr>
        <td><span class="order-num">#${esc(String(o.orderNumber || o._id))}</span></td>
        <td>
          <div class="customer-name">${name}</div>
          <div class="customer-phone">${phone}</div>
        </td>
        <td class="items-count">${o.items?.length || 0} item(s)</td>
        <td class="total-amt">₹${formatNum(o.total)}</td>
        <td><span class="pay-badge pay-${pm}">${pm}</span></td>
        <td><span class="status-badge s-${o.status}">${o.status || "Pending"}</span></td>
        <td>${fmtDate(o.createdAt)}</td>
        <td>
          <div class="actions-cell">
            <button class="action-btn btn-view" data-id="${id}" title="View order"><i class="fas fa-eye"></i> View</button>
            ${phone ? `<button class="action-btn btn-wa" data-phone="${phone}" data-name="${name}" data-order="${o.orderNumber || id}" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>` : ""}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderPagination(total, current) {
  const el = document.getElementById("ordersPagination");
  if (!el) return;
  if (total <= 1) { el.innerHTML = ""; return; }

  let html = "";
  if (current > 1) html += `<button class="page-btn" data-page="${current - 1}">← Prev</button>`;

  const start = Math.max(1, current - 2);
  const end   = Math.min(total, current + 2);
  if (start > 1) html += `<button class="page-btn" data-page="1">1</button>${start > 2 ? '<span style="color:var(--text3);padding:0 4px;">…</span>' : ""}`;
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === current ? "active" : ""}" data-page="${i}">${i}</button>`;
  }
  if (end < total) html += `${end < total - 1 ? '<span style="color:var(--text3);padding:0 4px;">…</span>' : ""}<button class="page-btn" data-page="${total}">${total}</button>`;

  if (current < total) html += `<button class="page-btn" data-page="${current + 1}">Next →</button>`;
  el.innerHTML = html;
}

// ============================================================
// ORDER DETAIL MODAL
// ============================================================
async function openOrderDetail(orderId) {
  currentOrderId = orderId;
  const overlay  = document.getElementById("orderDetailOverlay");
  const body     = document.getElementById("orderDetailBody");
  if (!overlay || !body) return;

  overlay.classList.add("open");
  body.innerHTML = '<div style="text-align:center;padding:3rem;"><div class="spinner-admin" style="width:36px;height:36px;border-width:3px;"></div></div>';

  const order = allOrders.find(o => String(o._id) === String(orderId) || String(o.orderNumber) === String(orderId));

  if (!order) {
    body.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle" style="color:var(--red)"></i><p>Order nahi mila</p></div>';
    return;
  }

  setText("orderDetailTitle", `Order #${order.orderNumber || order._id}`);
  document.getElementById("statusUpdateSelect").value = order.status || "Pending";

  const items = (order.items || []).map(i => `
    <div class="order-item-row">
      <span>${esc(i.name)} ${i.size ? `<span style="color:var(--text2);font-size:0.78rem">(${esc(i.size)})</span>` : ""} × ${i.quantity || 1}</span>
      <span>₹${formatNum((parseFloat(i.price) || 0) * (parseInt(i.quantity) || 1))}</span>
    </div>
  `).join("") || "<p style='color:var(--text2)'>No items</p>";

  const phone = order.customer?.phone || "";
  const name  = `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim();

  body.innerHTML = `
    <div class="detail-section">
      <h4>👤 Customer Information</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-label">Name</span><span class="detail-val">${esc(name) || "—"}</span></div>
        <div class="detail-item"><span class="detail-label">Phone / WhatsApp</span>
          <span class="detail-val">
            ${phone ? `<a href="https://wa.me/91${phone.replace(/\D/g,"")}" target="_blank" rel="noopener" style="color:#25d366">${esc(phone)} <i class="fab fa-whatsapp"></i></a>` : "—"}
          </span>
        </div>
        <div class="detail-item"><span class="detail-label">Email</span><span class="detail-val">${esc(order.customer?.email || "—")}</span></div>
        <div class="detail-item"><span class="detail-label">OTP Verified</span><span class="detail-val">${order.otpVerified ? "✅ Yes" : "❌ No"}</span></div>
      </div>
    </div>

    <div class="detail-section">
      <h4>📍 Delivery Address</h4>
      <div style="background:var(--bg3);border-radius:8px;padding:12px 14px;font-size:0.88rem;line-height:1.9;color:var(--text)">
        ${esc(order.customer?.address || "—")}<br/>
        ${[order.customer?.city, order.customer?.state].filter(Boolean).join(", ")}
        ${order.customer?.zipCode ? " — " + esc(order.customer.zipCode) : ""}
      </div>
    </div>

    <div class="detail-section">
      <h4>🛍️ Order Items</h4>
      <div class="order-items-list">${items}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem .5rem;font-weight:700;border-top:2px solid var(--gold-dark);margin-top:.5rem;font-size:0.95rem;">
        <span>Total</span>
        <span style="color:var(--green)">
          ₹${formatNum(order.total)}
          <span class="pay-badge pay-${order.paymentMethod || "COD"}" style="margin-left:8px">${order.paymentMethod || "COD"}</span>
          ${order.razorpayPaymentId ? `<span style="font-size:0.72rem;color:var(--text2);margin-left:6px">${esc(order.razorpayPaymentId)}</span>` : ""}
        </span>
      </div>
    </div>

    <div class="detail-section">
      <h4>📦 Live Tracking</h4>
      ${renderTrackingTimeline(order.status)}
    </div>

    <div class="detail-section">
      <h4>📋 Order Info</h4>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-label">Order Date</span><span class="detail-val">${fmtDate(order.createdAt, true)}</span></div>
        <div class="detail-item"><span class="detail-label">Last Updated</span><span class="detail-val">${fmtDate(order.updatedAt, true)}</span></div>
        <div class="detail-item"><span class="detail-label">Order ID</span><span class="detail-val" style="font-size:0.78rem">${esc(String(order._id || "—"))}</span></div>
        <div class="detail-item"><span class="detail-label">Current Status</span><span class="status-badge s-${order.status}">${order.status || "Pending"}</span></div>
      </div>
    </div>

    ${phone ? `
    <div class="detail-section">
      <h4>💬 Quick WhatsApp Actions</h4>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="action-btn btn-wa" style="font-size:0.82rem"
          onclick="openWhatsApp('${phone}','${esc(name)}','${order.orderNumber || order._id}','confirm')">
          <i class="fab fa-whatsapp"></i> Order Confirm
        </button>
        <button class="action-btn btn-wa" style="font-size:0.82rem"
          onclick="openWhatsApp('${phone}','${esc(name)}','${order.orderNumber || order._id}','shipped')">
          <i class="fab fa-whatsapp"></i> Shipped Update
        </button>
        <button class="action-btn btn-wa" style="font-size:0.82rem"
          onclick="openWhatsApp('${phone}','${esc(name)}','${order.orderNumber || order._id}','delivered')">
          <i class="fab fa-whatsapp"></i> Delivery Done
        </button>
      </div>
    </div>
    ` : ""}
  `;

  // WA buttons inside modal — direct onclick (sirf modal ke andar, CSP-safe kyunki attribute nahi HTML mein hai)
  body.querySelectorAll(".btn-wa").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("onclick")?.match(/'(\w+)'\)$/)?.[1];
      openWhatsApp(phone, name, String(order.orderNumber || order._id), type);
      btn.removeAttribute("onclick");
    });
    btn.removeAttribute("onclick");
  });
}

function renderTrackingTimeline(currentStatus) {
  const steps = [
    { key: "Pending",    icon: "fa-clock",          label: "Order Placed",    desc: "Customer ne order diya" },
    { key: "Confirmed",  icon: "fa-check",           label: "Confirmed",       desc: "Order confirm ho gaya" },
    { key: "Processing", icon: "fa-box",             label: "Processing",      desc: "Pack ho raha hai" },
    { key: "Shipped",    icon: "fa-truck",           label: "Shipped",         desc: "Courier ko diya" },
    { key: "Delivered",  icon: "fa-check-double",    label: "Delivered",       desc: "Customer ko mil gaya" },
  ];
  const cancelledStatus = currentStatus === "Cancelled";
  const stepIndex = steps.findIndex(s => s.key === currentStatus);

  if (cancelledStatus) {
    return `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:12px 16px;color:#f87171;font-size:0.88rem;"><i class="fas fa-times-circle" style="margin-right:6px"></i>Order cancelled ho gaya</div>`;
  }

  return `<ul class="tracking-timeline">
    ${steps.map((step, idx) => {
      let dotClass = "pending";
      if (idx < stepIndex) dotClass = "done";
      else if (idx === stepIndex) dotClass = "active-step";
      const icon = idx < stepIndex ? "fa-check" : step.icon;
      return `<li>
        <div class="tl-dot ${dotClass}"><i class="fas ${icon}" style="font-size:0.6rem"></i></div>
        <div class="tl-content">
          <div class="tl-title" style="${idx === stepIndex ? "color:var(--gold)" : ""}">${step.label}</div>
          <div class="tl-desc">${step.desc}</div>
        </div>
      </li>`;
    }).join("")}
  </ul>`;
}

function closeModal() {
  document.getElementById("orderDetailOverlay")?.classList.remove("open");
  currentOrderId = null;
}

async function updateOrderStatus() {
  if (!currentOrderId) return;
  const status = document.getElementById("statusUpdateSelect")?.value;
  const btn    = document.getElementById("updateStatusBtn");
  if (!btn || !status) return;

  btn.innerHTML = '<div class="spinner-admin"></div> Saving...';
  btn.disabled = true;

  try {
    const ok = await patchOrderStatus(currentOrderId, status);
    if (ok) {
      // Local cache update
      const idx = allOrders.findIndex(o => String(o._id) === String(currentOrderId) || String(o.orderNumber) === String(currentOrderId));
      if (idx !== -1) { allOrders[idx].status = status; allOrders[idx].updatedAt = new Date().toISOString(); }
      showToast(`✅ Status updated: "${status}"`);
      closeModal();
      applyFilter();
      loadDashboard();
    } else {
      showToast("❌ Update fail hua");
    }
  } catch {
    showToast("❌ Server error");
  } finally {
    btn.innerHTML = '<i class="fas fa-save"></i> Update';
    btn.disabled = false;
  }
}

// ============================================================
// WHATSAPP
// ============================================================
function openWhatsApp(phone, name, orderNum, type = "generic") {
  if (!phone) return;
  const clean = phone.replace(/\D/g, "");
  const num   = clean.startsWith("91") ? clean : "91" + clean;

  const templates = {
    confirm:   `Namaste ${name}! 🌿\n\nAapka order *#${orderNum}* confirm ho gaya hai. Hum jald hi process karenge.\n\nAOS Angelic Organic Spark 🌸`,
    shipped:   `Namaste ${name}! 📦\n\nAapka order *#${orderNum}* ship ho gaya hai! Jald hi aapke paas pahunchega.\n\nTracking details jald milenge.\n\nAOS Angelic Organic Spark 🌸`,
    delivered: `Namaste ${name}! ✅\n\nAapka order *#${orderNum}* deliver ho gaya hai! Umeed hai aapko product pasand aaya.\n\nKoi bhi feedback ke liye reply karein.\n\nAOS Angelic Organic Spark 🌸`,
    generic:   `Namaste ${name}! 🌿\n\nAapke order *#${orderNum}* ke baare mein kuch update hai.\n\nAOS Angelic Organic Spark 🌸`,
  };

  const msg = templates[type] || templates.generic;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
}

// ============================================================
// RAZORPAY SYNC (UI only — backend se aata hai)
// ============================================================
async function syncRazorpay() {
  const btn = document.getElementById("razorpaySyncBtn");
  if (!btn) return;
  btn.innerHTML = '<span class="spinner-admin"></span> Syncing...';
  btn.style.pointerEvents = "none";

  try {
    const res = await fetch(`${API_BASE}/api/admin/razorpay/sync`, {
      method: "POST",
      headers: { Authorization: "Bearer " + TOKEN },
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`✅ Razorpay sync done! ${data.synced || ""} payments updated`);
      allOrders = [];
      loadDashboard();
    } else {
      showToast("⚠️ Razorpay sync route nahi mila — backend mein add karo");
    }
  } catch {
    showToast("⚠️ Razorpay sync ke liye backend route chahiye: POST /api/admin/razorpay/sync");
  } finally {
    btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sync Razorpay';
    btn.style.pointerEvents = "";
  }
}

// ============================================================
// ANALYTICS
// ============================================================
async function loadAnalytics() {
  if (!allOrders.length) allOrders = await fetchOrders();

  const total     = allOrders.length;
  const revenue   = allOrders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
  const avg       = total ? revenue / total : 0;
  const delivered = allOrders.filter(o => o.status === "Delivered").length;
  const rate      = total ? ((delivered / total) * 100).toFixed(1) : 0;

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekRev = allOrders.filter(o => new Date(o.createdAt) >= weekAgo).reduce((s, o) => s + (parseFloat(o.total) || 0), 0);

  setText("aStatRevenue",      "₹" + formatNum(revenue));
  setText("aStatAvg",          "₹" + formatNum(avg));
  setText("aStatDeliveryRate", rate + "%");
  setText("aStatWeekRev",      "₹" + formatNum(weekRev));

  renderMonthlyChart(allOrders);
  renderTopProducts(allOrders);
  renderCityChart(allOrders);
}

function renderMonthlyChart(orders) {
  destroyChart("monthly");
  const canvas = document.getElementById("monthlyRevenueChart");
  if (!canvas) return;

  const months = {};
  orders.forEach(o => {
    const d = new Date(o.createdAt);
    if (isNaN(d)) return;
    const key = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    months[key] = (months[key] || 0) + (parseFloat(o.total) || 0);
  });

  const entries = Object.entries(months).slice(-12);
  const labels  = entries.map(e => e[0]);
  const data    = entries.map(e => Math.round(e[1]));

  CHARTS.monthly = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Revenue (₹)",
        data,
        borderColor: "#d4af37",
        backgroundColor: "rgba(212,175,55,0.12)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#d4af37",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#a09880", font: { size: 11 } }, grid: { color: "rgba(255,255,255,0.04)" } },
        y: {
          ticks: { color: "#a09880", font: { size: 11 }, callback: v => "₹" + formatNum(v) },
          grid: { color: "rgba(255,255,255,0.04)" },
          beginAtZero: true,
        },
      },
    },
  });
}

function renderTopProducts(orders) {
  const el = document.getElementById("topProductsList");
  if (!el) return;

  const counts = {};
  orders.forEach(o => {
    (o.items || []).forEach(i => {
      const key = i.name || "Unknown";
      counts[key] = (counts[key] || 0) + (parseInt(i.quantity) || 1);
    });
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max    = sorted[0]?.[1] || 1;

  if (!sorted.length) { el.innerHTML = '<p style="color:var(--text2);font-size:0.85rem">No product data</p>'; return; }

  el.innerHTML = sorted.map(([name, qty]) => `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:0.82rem;color:var(--text);font-weight:500">${esc(name)}</span>
        <span style="font-size:0.78rem;color:var(--text2)">${qty} sold</span>
      </div>
      <div style="background:var(--bg3);border-radius:4px;height:6px;overflow:hidden">
        <div style="height:100%;width:${Math.round((qty/max)*100)}%;background:linear-gradient(90deg,var(--gold),var(--gold-light));border-radius:4px;transition:width 0.5s"></div>
      </div>
    </div>
  `).join("");
}

function renderCityChart(orders) {
  destroyChart("city");
  const canvas = document.getElementById("cityChart");
  if (!canvas) return;

  const cities = {};
  orders.forEach(o => {
    const city = (o.customer?.city || "Unknown").trim();
    cities[city] = (cities[city] || 0) + 1;
  });

  const sorted = Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 10);

  CHARTS.city = new Chart(canvas, {
    type: "bar",
    data: {
      labels: sorted.map(e => e[0]),
      datasets: [{
        label: "Orders",
        data: sorted.map(e => e[1]),
        backgroundColor: "rgba(168,85,247,0.6)",
        borderColor: "#a855f7",
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#a09880", font: { size: 11 }, stepSize: 1 }, grid: { color: "rgba(255,255,255,0.04)" }, beginAtZero: true },
        y: { ticks: { color: "#a09880", font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}

// ============================================================
// CONTACTS
// ============================================================
async function loadContacts() {
  const el = document.getElementById("contactsList");
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:3rem"><div class="spinner-admin" style="width:36px;height:36px;border-width:3px"></div></div>';

  const contacts = await fetchContacts();

  if (!contacts.length) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Koi messages nahi hain</p></div>';
    return;
  }

  el.innerHTML = contacts.map(c => `
    <div class="contact-card">
      <div class="contact-card-header">
        <div>
          <div class="contact-name">${esc(c.name || "—")}</div>
          <div class="contact-meta">
            ${c.email ? `<a href="mailto:${esc(c.email)}" style="color:var(--gold)">${esc(c.email)}</a>` : ""}
            ${c.phone ? ` &nbsp;|&nbsp; <a href="https://wa.me/91${c.phone.replace(/\D/g,"")}" target="_blank" rel="noopener" style="color:#25d366">${esc(c.phone)} <i class="fab fa-whatsapp"></i></a>` : ""}
          </div>
        </div>
        <div class="contact-date">${fmtDate(c.createdAt)}</div>
      </div>
      <div class="contact-msg">${esc(c.message || "")}</div>
    </div>
  `).join("");
}

// ============================================================
// NAVIGATION
// ============================================================
function showSection(name) {
  const sections = ["dashboard", "orders", "analytics", "contacts"];
  sections.forEach(s => document.getElementById(`${s}Section`)?.classList.remove("active"));
  document.getElementById(`${name}Section`)?.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
  document.querySelector(`.nav-item[data-section="${name}"]`)?.classList.add("active");

  const titles = { dashboard: "Dashboard", orders: "Orders", analytics: "Analytics", contacts: "Messages" };
  setText("pageTitle", titles[name] || name);

  if (name === "orders")    { if (!allOrders.length) fetchOrders().then(o => { allOrders = o; applyFilter(); }); else applyFilter(); }
  else if (name === "analytics") loadAnalytics();
  else if (name === "contacts")  loadContacts();
  else if (name === "dashboard") loadDashboard();
}

function refreshCurrent() {
  setSpinRefresh(true);
  const active = document.querySelector(".nav-item.active")?.dataset.section || "dashboard";
  allOrders = []; // force fresh fetch
  setTimeout(() => {
    showSection(active);
    setSpinRefresh(false);
  }, 300);
}

function setSpinRefresh(on) {
  document.getElementById("refreshBtn")?.classList.toggle("spinning", on);
}

// ============================================================
// HELPERS
// ============================================================
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function formatNum(n) {
  const num = parseFloat(n) || 0;
  if (num >= 100000) return (num / 100000).toFixed(1) + "L";
  if (num >= 1000)   return (num / 1000).toFixed(1) + "K";
  return Math.round(num).toLocaleString("en-IN");
}

function fmtDate(iso, full = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  if (full) return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function esc(str) {
  if (str == null) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function showToast(msg, duration = 3500) {
  const el = document.getElementById("adminToast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), duration);
}
