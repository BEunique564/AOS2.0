/**
 * AOS E-COMMERCE v2.0 - PRODUCTION SERVER
 * Angelic Organic Spark
 * ✅ FIXED: CSP mein script-src-attr add kiya - onclick attributes kaam karein
 */

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const path = require("path");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// DATABASE CONNECTION
// ============================================
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
  });

// ============================================
// MIDDLEWARE
// ============================================
app.use(compression());

// ✅ FIXED: CSP - script-src-attr add kiya taaki onclick kaam kare
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "fonts.googleapis.com",
          "cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "fonts.gstatic.com",
          "cdnjs.cloudflare.com",
          "data:",
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "cdnjs.cloudflare.com",
        ],
        // ✅ YEH LINE SABSE ZAROORI THI - onclick attributes allow karta hai
        scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// OTP Rate Limiting
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many OTP requests. Please wait 15 minutes." },
});

// ============================================
// MONGOOSE SCHEMAS
// ============================================

const otpSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  verified: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});
const OTP = mongoose.model("OTP", otpSchema);

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  customer: {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, default: "Uttar Pradesh" },
    zipCode: { type: String, required: true },
    pincode: String,
  },
  items: [
    {
      id: String,
      name: String,
      price: Number,
      quantity: Number,
      size: String,
      image: String,
    },
  ],
  subtotal: Number,
  shipping: { type: Number, default: 0 },
  total: { type: Number, required: true },
  paymentMethod: { type: String, enum: ["COD", "UPI"], default: "COD" },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending",
  },
  status: {
    type: String,
    enum: ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"],
    default: "Pending",
  },
  otpVerified: { type: Boolean, default: false },
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const count = await Order.countDocuments();
    this.orderNumber = `AOS${String(count + 1).padStart(5, "0")}`;
  }
  this.updatedAt = new Date();
  next();
});
const Order = mongoose.model("Order", orderSchema);

const contactSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  message: String,
  replied: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
const Contact = mongoose.model("Contact", contactSchema);

const adminSchema = new mongoose.Schema({
  email: { type: String, unique: true, lowercase: true },
  passwordHash: String,
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now },
});
const Admin = mongoose.model("Admin", adminSchema);

// ============================================
// EMAIL TRANSPORTER
// ============================================
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
  transporter.verify((err) => {
    if (err) console.warn("⚠️ Email not configured:", err.message);
    else console.log("✅ Email ready");
  });
}

// ============================================
// WHATSAPP HELPER (Twilio)
// ============================================
async function sendWhatsApp(to, message) {
  try {
    if (
      !process.env.TWILIO_ACCOUNT_SID ||
      process.env.TWILIO_ACCOUNT_SID.startsWith("AC_")
    ) {
      console.log("📱 WhatsApp (mock):", message.substring(0, 60) + "...");
      return { success: false, reason: "Twilio not configured" };
    }

    const axios = require("axios");
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      new URLSearchParams({ From: from, To: to, Body: message }),
      {
        auth: { username: sid, password: token },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    return { success: true, sid: response.data.sid };
  } catch (err) {
    console.error("WhatsApp Error:", err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

// ============================================
// EMAIL HELPERS
// ============================================
async function sendOrderEmailToCustomer(order) {
  if (!transporter) return;

  const itemsHtml = order.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #f0e8d0;">${i.name} (${i.size || ""})</td>
          <td style="padding:8px;border-bottom:1px solid #f0e8d0;text-align:center;">${i.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #f0e8d0;text-align:right;">₹${(i.price * i.quantity).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family:Arial,sans-serif;background:#f5f2e8;margin:0;padding:20px;">
      <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
        <div style="background:linear-gradient(135deg,#d4af37,#b8941f);padding:30px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:28px;">✨ AOS</h1>
          <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;">Angelic Organic Spark</p>
        </div>
        <div style="padding:30px;">
          <h2 style="color:#3c2415;">🎉 Order Confirmed!</h2>
          <p style="color:#6b5b47;">Namaste ${order.customer.firstName}! Aapka order place ho gaya hai.</p>
          <div style="background:#f5f2e8;border-radius:12px;padding:20px;margin:20px 0;">
            <p style="margin:0;color:#6b5b47;font-size:14px;">Order Number</p>
            <h3 style="margin:4px 0;color:#d4af37;font-size:22px;">#${order.orderNumber}</h3>
          </div>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <thead>
              <tr style="background:#f5f2e8;">
                <th style="padding:10px;text-align:left;color:#3c2415;">Product</th>
                <th style="padding:10px;text-align:center;color:#3c2415;">Qty</th>
                <th style="padding:10px;text-align:right;color:#3c2415;">Price</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div style="text-align:right;padding:16px;background:#f5f2e8;border-radius:8px;">
            <strong style="color:#3c2415;font-size:18px;">Total: ₹${order.total.toFixed(2)}</strong>
          </div>
          <div style="margin:20px 0;padding:16px;border:2px solid #d4af37;border-radius:12px;">
            <h3 style="color:#3c2415;margin:0 0 10px;">📦 Delivery Address</h3>
            <p style="color:#6b5b47;margin:0;">
              ${order.customer.firstName} ${order.customer.lastName}<br>
              ${order.customer.address}, ${order.customer.city} - ${order.customer.zipCode}
            </p>
          </div>
          <div style="background:#fff9e6;border:1px solid #d4af37;border-radius:8px;padding:16px;">
            <p style="margin:0;color:#8b6914;">💡 <strong>Payment:</strong> ${order.paymentMethod === "COD" ? "Cash on Delivery" : "UPI Payment"}</p>
          </div>
        </div>
        <div style="background:#3c2415;padding:20px;text-align:center;">
          <p style="color:#d4af37;margin:0;">Questions? Call us: +91 99199 17791</p>
          <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:8px 0 0;">© 2025 Angelic Organic Spark. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"AOS Skincare" <${process.env.EMAIL_USER}>`,
      to: order.customer.email,
      subject: `✅ Order Confirmed #${order.orderNumber} - AOS Skincare`,
      html,
    });
  } catch (err) {
    console.error("Customer email error:", err.message);
  }
}

async function sendOrderAlertToAdmin(order) {
  if (!transporter) return;

  const itemsList = order.items
    .map((i) => `• ${i.name} (${i.size}) x${i.quantity} = ₹${i.price * i.quantity}`)
    .join("\n");

  try {
    await transporter.sendMail({
      from: `"AOS Orders" <${process.env.EMAIL_USER}>`,
      to: process.env.STORE_EMAIL || process.env.ADMIN_EMAIL,
      subject: `🛍️ NEW ORDER #${order.orderNumber} - ₹${order.total} - ${order.paymentMethod}`,
      html: `
        <div style="font-family:Arial;padding:20px;background:#f5f2e8;">
          <h2 style="color:#d4af37;">New Order Alert! 🎉</h2>
          <p><strong>Order #:</strong> ${order.orderNumber}</p>
          <p><strong>Customer:</strong> ${order.customer.firstName} ${order.customer.lastName}</p>
          <p><strong>Phone:</strong> ${order.customer.phone}</p>
          <p><strong>Email:</strong> ${order.customer.email}</p>
          <p><strong>Address:</strong> ${order.customer.address}, ${order.customer.city} - ${order.customer.zipCode}</p>
          <hr>
          <pre style="background:white;padding:10px;border-radius:8px;">${itemsList}</pre>
          <hr>
          <p><strong>Total:</strong> ₹${order.total.toFixed(2)}</p>
          <p><strong>Payment:</strong> ${order.paymentMethod}</p>
          <a href="${process.env.CLIENT_URL}/admin.html"
             style="background:#d4af37;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">
            View in Admin Panel
          </a>
        </div>
      `,
    });
  } catch (err) {
    console.error("Admin email error:", err.message);
  }
}

// ============================================
// INITIALIZE ADMIN USER
// ============================================
async function initAdmin() {
  try {
    const existing = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
    if (!existing) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "Admin@AOS2025", 12);
      await Admin.create({
        email: process.env.ADMIN_EMAIL || "vaibhavgupta2542@gmail.com",
        passwordHash: hash,
      });
      console.log("✅ Admin user created");
    }
  } catch (err) {
    console.error("Admin init error:", err.message);
  }
}
mongoose.connection.once("open", initAdmin);

// ============================================
// AUTH MIDDLEWARE
// ============================================
function authMiddleware(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ error: "No token provided" });

  const token = header.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Invalid token format" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "aos-secret");
    req.admin = decoded;
    next();
  } catch {
    return res.status(403).json({ error: "Token expired or invalid" });
  }
}

// ============================================
// API ROUTES
// ============================================

// Send OTP
app.post("/api/otp/send", otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number required" });

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(
      Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000
    );

    await OTP.deleteMany({ phone: cleanPhone });

    const otpHash = await bcrypt.hash(otp, 10);
    await OTP.create({ phone: cleanPhone, otp: otpHash, expiresAt });

    const whatsappTo = `whatsapp:+91${cleanPhone.slice(-10)}`;
    const whatsappMsg = `🔐 *AOS Skincare - Order Verification*\n\nAapka OTP hai: *${otp}*\n\nYeh OTP ${process.env.OTP_EXPIRY_MINUTES || 10} minutes mein expire ho jayega.\n\n⚠️ Kisi ko bhi share mat karein.\n\n_Angelic Organic Spark_`;

    const waResult = await sendWhatsApp(whatsappTo, whatsappMsg);

    console.log(`OTP for ${cleanPhone}: ${otp} (WhatsApp: ${waResult.success})`);

    res.json({
      success: true,
      message: "OTP sent successfully via WhatsApp",
      ...(process.env.NODE_ENV !== "production" && { devOtp: otp }),
    });
  } catch (err) {
    console.error("OTP send error:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// Verify OTP
app.post("/api/otp/verify", async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: "Phone and OTP required" });

    const cleanPhone = phone.replace(/\D/g, "");
    const otpDoc = await OTP.findOne({
      phone: cleanPhone,
      expiresAt: { $gt: new Date() },
    });

    if (!otpDoc) {
      return res.status(400).json({ error: "OTP expired ya invalid hai. Dobara try karein." });
    }

    if (otpDoc.attempts >= 3) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ error: "Too many wrong attempts. Nayi OTP mangaiye." });
    }

    const isValid = await bcrypt.compare(otp.trim(), otpDoc.otp);
    if (!isValid) {
      await OTP.updateOne({ _id: otpDoc._id }, { $inc: { attempts: 1 } });
      return res.status(400).json({ error: "Galat OTP. Phir se try karein." });
    }

    await OTP.updateOne({ _id: otpDoc._id }, { verified: true });

    const verifyToken = jwt.sign(
      { phone: cleanPhone, purpose: "order" },
      process.env.JWT_SECRET || "aos-secret",
      { expiresIn: "30m" }
    );

    res.json({ success: true, verifyToken, message: "OTP verified!" });
  } catch (err) {
    console.error("OTP verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// Place Order
app.post("/api/order", async (req, res) => {
  try {
    const { customer, items, total, paymentMethod, verifyToken } = req.body;

    if (!customer || !items || !total) {
      return res.status(400).json({ error: "Order data incomplete" });
    }

    let otpVerified = false;
    if (verifyToken) {
      try {
        const decoded = jwt.verify(verifyToken, process.env.JWT_SECRET || "aos-secret");
        if (decoded.purpose === "order") otpVerified = true;
      } catch {
        return res.status(401).json({ error: "OTP verification expired. Dobara verify karein." });
      }
    } else {
      return res.status(401).json({ error: "OTP verification required" });
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = subtotal >= 499 ? 0 : 50;
    const calculatedTotal = subtotal + shipping;

    const order = new Order({
      customer,
      items,
      subtotal,
      shipping,
      total: calculatedTotal,
      paymentMethod: paymentMethod || "COD",
      otpVerified,
    });

    await order.save();

    sendOrderEmailToCustomer(order).catch(console.error);
    sendOrderAlertToAdmin(order).catch(console.error);

    const custPhone = `whatsapp:+91${customer.phone.replace(/\D/g, "").slice(-10)}`;
    const itemNames = items.map((i) => `${i.name} x${i.quantity}`).join(", ");
    const custMsg = `🌿 *AOS Skincare - Order Confirmed!*\n\nNamaste ${customer.firstName}! 🎉\n\n*Order #${order.orderNumber}*\n${itemNames}\n\n💰 *Total: ₹${calculatedTotal.toFixed(2)}*\n🚚 *Payment: ${paymentMethod === "COD" ? "Cash on Delivery" : "UPI"}*\n\nAapka order 3-5 business days mein deliver ho jayega.\n\nKoi sawaal? Call karein: +91 99199 17791\n\n_Angelic Organic Spark_ ✨`;

    sendWhatsApp(custPhone, custMsg).catch(console.error);

    const ownerPhone = process.env.OWNER_WHATSAPP;
    if (ownerPhone) {
      const ownerMsg = `🛍️ *Naya Order Aaya!*\n\n*Order #${order.orderNumber}*\nCustomer: ${customer.firstName} ${customer.lastName}\nPhone: ${customer.phone}\nCity: ${customer.city}\nItems: ${itemNames}\nTotal: ₹${calculatedTotal}\nPayment: ${paymentMethod}\n\nAdmin Panel: ${process.env.CLIENT_URL}/admin.html`;
      sendWhatsApp(ownerPhone, ownerMsg).catch(console.error);
    }

    res.json({
      success: true,
      orderNumber: order.orderNumber,
      message: "Order placed successfully!",
    });
  } catch (err) {
    console.error("Order error:", err);
    res.status(500).json({ error: "Order place karne mein error. Please try again." });
  }
});

// Contact Form
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !message) return res.status(400).json({ error: "Name and message required" });

    await Contact.create({ name, email, phone, message });

    if (transporter) {
      await transporter.sendMail({
        from: `"AOS Contact" <${process.env.EMAIL_USER}>`,
        to: process.env.STORE_EMAIL,
        subject: `📩 New Contact Form - ${name}`,
        html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Phone:</strong> ${phone}</p><p><strong>Message:</strong> ${message}</p>`,
      });
    }

    res.json({ success: true, message: "Message sent! Hum jald hi contact karenge." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Login
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Credentials required" });

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) return res.status(401).json({ error: "Invalid credentials" });

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) return res.status(401).json({ error: "Invalid credentials" });

    await Admin.updateOne({ _id: admin._id }, { lastLogin: new Date() });

    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: "admin" },
      process.env.JWT_SECRET || "aos-secret",
      { expiresIn: "8h" }
    );

    res.json({ success: true, token, email: admin.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get All Orders
app.get("/api/admin/orders", authMiddleware, async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const query = {};
    if (status && status !== "all") query.status = status;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { "customer.phone": { $regex: search, $options: "i" } },
        { "customer.email": { $regex: search, $options: "i" } },
        { "customer.firstName": { $regex: search, $options: "i" } },
      ];
    }

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ orders, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard Stats
app.get("/api/admin/stats", authMiddleware, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalOrders, todayOrders, totalRevenue, pendingOrders, contacts] =
      await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ createdAt: { $gte: today } }),
        Order.aggregate([{ $group: { _id: null, total: { $sum: "$total" } } }]),
        Order.countDocuments({ status: "Pending" }),
        Contact.countDocuments({ replied: false }),
      ]);

    res.json({
      totalOrders,
      todayOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      pendingOrders,
      unreadContacts: contacts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Order Status
app.put("/api/admin/order/:id", authMiddleware, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = [
      "Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, ...(notes && { notes }), updatedAt: new Date() },
      { new: true }
    );

    if (!order) return res.status(404).json({ error: "Order not found" });

    const custPhone = `whatsapp:+91${order.customer.phone.replace(/\D/g, "").slice(-10)}`;
    const statusEmoji = { Confirmed: "✅", Shipped: "🚚", Delivered: "🎉", Cancelled: "❌" };
    const emoji = statusEmoji[status] || "📦";

    if (["Confirmed", "Shipped", "Delivered", "Cancelled"].includes(status)) {
      const statusMsg = `${emoji} *AOS Order Update*\n\nOrder #${order.orderNumber}\nStatus: *${status}*\n${status === "Shipped" ? "Aapka order raste mein hai!" : ""}\n${status === "Delivered" ? "Order deliver ho gaya! 🌟" : ""}\n${status === "Cancelled" ? "Call: +91 99199 17791" : ""}\n\n_Angelic Organic Spark_ ✨`;
      sendWhatsApp(custPhone, statusMsg).catch(console.error);
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Contacts
app.get("/api/admin/contacts", authMiddleware, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 }).limit(50);
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    version: "2.0.0",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// ============================================
// STATIC FILES
// ============================================
app.use(express.static(path.join(__dirname, "public")));
app.get("/admin", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html"))
);
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════╗
  ║   AOS E-COMMERCE v2.0 STARTED     ║
  ║   Port: ${PORT}                       ║
  ║   Mode: ${process.env.NODE_ENV || "development"}              ║
  ╚════════════════════════════════════╝
  `);
});

module.exports = app;
