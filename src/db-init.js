/**
 * AOS v2.0 - Database Initialization Script
 * Run: node src/db-init.js
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error("❌ MONGODB_URI not set in .env"); process.exit(1); }

mongoose.connect(MONGODB_URI).then(async () => {
  console.log("✅ Connected to MongoDB");

  const Admin = mongoose.model("Admin", new mongoose.Schema({
    email: String,
    passwordHash: String,
    createdAt: { type: Date, default: Date.now },
  }));

  const email = process.env.ADMIN_EMAIL || "vaibhavgupta2542@gmail.com";
  const password = process.env.ADMIN_PASSWORD || "Admin@AOS2025";

  const existing = await Admin.findOne({ email });
  if (existing) {
    console.log("ℹ️ Admin already exists:", email);
  } else {
    const hash = await bcrypt.hash(password, 12);
    await Admin.create({ email, passwordHash: hash });
    console.log("✅ Admin created:", email);
  }

  console.log("✅ Database ready!");
  process.exit(0);
}).catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
