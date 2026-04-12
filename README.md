# AOS E-Commerce v2.0 🌿
**Angelic Organic Spark** - Production Ready

---

## Features
- ✅ OTP Verification (WhatsApp via Twilio)
- ✅ Order Alerts (Customer + Owner WhatsApp)
- ✅ Email Confirmations (Gmail SMTP)
- ✅ Admin Panel (Dashboard, Orders, Messages)
- ✅ Secure JWT Authentication
- ✅ MongoDB Atlas Database
- ✅ Rate Limiting & Security Headers
- ✅ Responsive Design

---

## Quick Deploy on Render

### Step 1: GitHub pe daalo
```bash
git init
git add .
git commit -m "AOS v2.0"
git remote add origin https://github.com/BEunique564/AOS.git
git push -u origin main
```

### Step 2: Render pe deploy
1. render.com pe jao
2. "New Web Service" -> GitHub connect karo
3. AOS repo select karo
4. Environment Variables daalo (neeche dekho)

### Step 3: Environment Variables (Render Dashboard)
```
NODE_ENV=production
MONGODB_URI=mongodb+srv://vaibhavgupta2542_db_user:Raghav12321@aos.jctvpvu.mongodb.net/aos_ecommerce?retryWrites=true&w=majority
JWT_SECRET=aos-super-secret-2025-change-this
ADMIN_EMAIL=vaibhavgupta2542@gmail.com
ADMIN_PASSWORD=Admin@AOS2025
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password
STORE_EMAIL=vaibhavgupta2542@gmail.com
TWILIO_ACCOUNT_SID=ACxxxxxxxxx (twilio.com se lo)
TWILIO_AUTH_TOKEN=your-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
OWNER_WHATSAPP=whatsapp:+919919917791
CLIENT_URL=https://aos-4jq4.onrender.com
CORS_ORIGIN=https://aos-4jq4.onrender.com
```

---

## Twilio WhatsApp Setup (Free)

1. twilio.com pe free account banao
2. Console -> WhatsApp Sandbox
3. Sandbox number join karo (apne phone se "join <word>" WhatsApp pe)
4. Account SID & Auth Token copy karo

**Note:** Free trial mein sirf verified numbers pe message jaata hai.
Production ke liye Twilio WhatsApp Business account chahiye.

---

## Gmail App Password

1. Google Account -> Security -> 2-Step Verification ON karo
2. Security -> App Passwords
3. "Mail" select karo -> Generate
4. 16-digit password copy karo -> EMAIL_PASS mein daalo

---

## Admin Panel
- URL: `https://your-site.onrender.com/admin.html`
- Email: ADMIN_EMAIL (.env se)
- Password: ADMIN_PASSWORD (.env se)

---

## File Structure
```
aos-v2/
├── server.js          # Main server
├── package.json
├── render.yaml        # Render config
├── .env.example       # Environment template
├── .gitignore
├── src/
│   └── db-init.js     # DB setup script
└── public/            # Frontend files
    ├── index.html
    ├── admin.html
    ├── css/
    │   ├── styles.css
    │   └── admin.css
    ├── js/
    │   ├── script.js
    │   └── admin.js
    └── images/        # Apni images yahan daalo
        ├── logo.png
        ├── FACEPACK.png
        ├── singledry.png
        ├── multiple.png
        ├── steps.png
        └── upiQRMAA.jpg
```

---

## Images Add Karna
Apni sabhi images `public/images/` folder mein daalo:
- `logo.png` - Company logo
- `FACEPACK.png` - Face pack image
- `singledry.png` - Scrub image
- `multiple.png` - Hero section image
- `upiQRMAA.jpg` - UPI QR code

---

## Future Products Add Karna
`public/js/script.js` mein PRODUCTS array mein commented blocks dekho.
Uncomment karo aur details bhar do. Filter tab bhi add karna hoga `index.html` mein.
