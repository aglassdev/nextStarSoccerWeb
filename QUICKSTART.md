# Next Star Soccer - Quick Start Guide

## 🚀 Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Check Environment Variables
```bash
chmod +x check-env.sh
./check-env.sh
```

This will verify all required environment variables are set in your `.env` file.

### 3. Start Development Server
```bash
npm run dev
```

Visit: http://localhost:3000

## 🌐 Deploying to Vercel

### Prerequisites
- Vercel account
- GitHub repository connected to Vercel

### Steps

1. **Ensure all files are committed**
   ```bash
   git add .
   git commit -m "Fix: Add error handling and deployment configuration"
   git push
   ```

2. **Configure Environment Variables in Vercel**
   - Go to: https://vercel.com/your-project/settings/environment-variables
   - Add ALL variables from your `.env` file
   - Select: Production, Preview, Development
   - See `VERCEL_DEPLOYMENT.md` for detailed instructions

3. **Redeploy**
   - Vercel will auto-deploy on git push
   - Or manually redeploy from Vercel dashboard

4. **Verify Deployment**
   - Open your Vercel URL
   - Check browser console (F12) for success messages
   - Should see: ✅ Environment variables validated

## 🔧 Troubleshooting

### Black Screen on Vercel?
- **Check**: Environment variables are set in Vercel
- **Check**: Browser console for error messages
- **Check**: Vercel build logs
- **Read**: `FIX_SUMMARY.md` for detailed fix instructions

### Build Errors?
```bash
npm run build
```
Run this locally to catch build errors before deploying.

### Environment Variable Issues?
```bash
./check-env.sh
```
This will show which variables are missing.

## 📁 Project Structure

```
nss-web/
├── src/
│   ├── components/      # React components
│   ├── contexts/        # React contexts (Auth, etc.)
│   ├── pages/          # Page components
│   ├── services/       # API services (Appwrite)
│   ├── styles/         # CSS and fonts
│   ├── types/          # TypeScript types
│   └── main.tsx        # Entry point
├── public/             # Static assets
├── .env                # Environment variables (DO NOT COMMIT)
├── .env.example        # Environment template (safe to commit)
├── vercel.json         # Vercel configuration
├── vite.config.ts      # Vite configuration
└── package.json        # Dependencies
```

## 📚 Documentation

- `FIX_SUMMARY.md` - Details about the black screen fix
- `VERCEL_DEPLOYMENT.md` - Complete Vercel deployment guide
- `.env.example` - Environment variables template

## 🆘 Need Help?

1. Check browser console for errors
2. Run `./check-env.sh` to verify environment
3. Review `FIX_SUMMARY.md` for common issues
4. Check Vercel build logs

## ✅ Deployment Checklist

Before deploying:
- [ ] All dependencies installed (`npm install`)
- [ ] Build passes locally (`npm run build`)
- [ ] Environment variables verified (`./check-env.sh`)
- [ ] Changes committed to git
- [ ] Environment variables added to Vercel
- [ ] Ready to deploy! 🚀
