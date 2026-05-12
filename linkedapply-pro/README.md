# ⚡ LinkedApply Pro
### LinkedIn Job Search + Gmail Auto-Apply Automation

---

## 📁 Project Structure

```
linkedapply-pro/
├── backend/
│   ├── src/
│   │   ├── server.js              ← Express server (entry point)
│   │   ├── linkedin/
│   │   │   ├── linkedinService.js ← Playwright browser automation
│   │   │   └── linkedinRouter.js  ← /api/linkedin routes
│   │   ├── gmail/
│   │   │   ├── gmailService.js    ← Nodemailer email sender
│   │   │   └── gmailRouter.js     ← /api/gmail routes
│   │   └── utils/
│   │       └── logger.js          ← Winston logger
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.js                 ← Main React UI (dashboard)
│   │   └── api.js                 ← Axios API calls to backend
│   └── package.json
├── config/
│   └── .env                       ← Credentials & config
├── uploads/                       ← Uploaded resumes stored here
├── logs/                          ← App & error logs
└── README.md
```

---

## 🚀 How to Run

### Prerequisites
- Node.js v18+
- npm v9+

---

### Step 1 — Install Backend
```bash
cd backend
npm install
npx playwright install chromium
```

### Step 2 — Install Frontend
```bash
cd frontend
npm install
```

### Step 3 — Configure .env
Edit `config/.env`:
```
PORT=5000
GMAIL_USER=yourmail@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

> **Gmail App Password Setup:**
> Google Account → Security → 2-Step Verification → App Passwords → Generate

### Step 4 — Create Folders
```bash
mkdir uploads logs
```

### Step 5 — Start Backend
```bash
cd backend
npm run dev
# Runs on http://localhost:5000
```

### Step 6 — Start Frontend
```bash
cd frontend
npm start
# Runs on http://localhost:3000
```

---

## 🔄 Automation Flow

| Step | Action | Tool Used |
|------|--------|-----------|
| 1 | Login to LinkedIn | Playwright (headless Chrome) |
| 2 | Search Posts (last 24h) | Playwright + DOM scraping |
| 3 | Extract recruiter emails | Regex + Profile visit |
| 4 | Login Gmail | Nodemailer SMTP |
| 5 | Send emails + resume | Nodemailer + Multer |

---

## 📡 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/linkedin/login | Login to LinkedIn |
| POST | /api/linkedin/search | Search job posts |
| POST | /api/linkedin/logout | Close browser |
| POST | /api/gmail/login | Auth Gmail |
| POST | /api/gmail/send-bulk | Send all emails |
| POST | /api/gmail/preview | Preview email |
| POST | /api/upload-resume | Upload resume file |
| GET  | /api/health | Server health check |

---

## ⚠️ Important Notes

1. **LinkedIn TOS**: LinkedIn restricts automated scraping. Use responsibly and at low volume.
2. **2FA**: If LinkedIn triggers 2FA, set `headless: false` in `linkedinService.js` to handle it manually.
3. **Gmail App Password**: Do NOT use your Gmail account password. Generate an App Password.
4. **Rate Limiting**: Built-in 1.5s delay between emails to avoid spam detection.
5. **Resume**: Upload PDF via the UI before running. Falls back to default if none uploaded.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Axios
- **Backend**: Node.js, Express
- **Browser Automation**: Playwright (Chromium)
- **Email**: Nodemailer (Gmail SMTP)
- **File Upload**: Multer
- **Logging**: Winston

---

*LinkedApply Pro — Built for Java Developer contract job seekers*
