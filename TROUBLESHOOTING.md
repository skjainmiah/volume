# Troubleshooting Guide - Stock Fetching Issues

## 🔍 Problem: "Fetch Stocks" Button Not Working

If clicking "Fetch Stocks" doesn't populate the database, follow these steps:

---

## ✅ Step 1: Verify Environment Variables

### Check Browser Console:
1. Open the app
2. Press `F12` to open Developer Tools
3. Go to **Console** tab
4. Check for any error messages

### Verify Configuration in Settings:
1. Go to **Settings** page
2. Scroll to **System Diagnostics** section
3. Verify all items show ✅:
   - Supabase URL: ✅ SET
   - Anon Key: ✅ SET
   - OpenAI API Key: ✅ SET
   - Database Connection: ✅ CONNECTED

### If Any Show ❌:
Your `.env` file might not be loaded. Restart the dev server:

```bash
# Stop the server (Ctrl+C)
# Start again
npm run dev
```

---

## ✅ Step 2: Test API Connection

### From Settings Page:
1. Go to **Settings**
2. Find **System Diagnostics** section
3. Click **"Test API Connection"** button
4. Wait for the alert message

### Expected Success Message:
```
✅ API Connection Successful!

Fetched 20 stocks with options

Check the console for details.
```

### If You See an Error:
Check the **browser console** for detailed error messages. Common errors:

#### Error 401 (Unauthorized):
```
❌ JWT verification failed
```
**Fix:** Edge function redeployed with JWT disabled. Refresh page and try again.

#### Error 404 (Not Found):
```
❌ Function not found
```
**Fix:** Edge function might not be deployed. Check Supabase dashboard.

#### Error 500 (Server Error):
```
❌ Internal server error
```
**Fix:** Check edge function logs in Supabase dashboard.

---

## ✅ Step 3: Check Edge Function Deployment

The `groww-data-fetcher` edge function has been redeployed with JWT verification disabled.

### Verify Deployment:
Edge functions deployed:
- ✅ `groww-data-fetcher` (verifyJWT: false)
- ✅ `scan-engine` (verifyJWT: false)
- ✅ `decision-engine` (verifyJWT: false)
- ✅ `kill-switch-manager` (verifyJWT: true)

---

## ✅ Step 4: Test Stock Fetching

### From Radar Page:
1. Go to **Radar** page
2. Open **Developer Tools** (F12)
3. Go to **Console** tab
4. Click **"Fetch Stocks"** button
5. Watch the console logs

### What You Should See in Console:
```javascript
Fetching stocks from: https://your-project.supabase.co/functions/v1/groww-data-fetcher
Response status: 200
Response headers: [object Headers]
API Result: {
  success: true,
  message: "Fetched 20 stocks with options",
  stocks: [...]
}
```

### Alert Message:
```
Stocks fetched successfully!

Fetched 20 stocks with options
```

---

## ✅ Step 5: Verify Database Population

### Check Stocks Table:
1. Go to Supabase Dashboard
2. Navigate to **Table Editor**
3. Open **stocks** table
4. Should see 20 rows:
   - RELIANCE
   - TCS
   - HDFCBANK
   - INFY
   - ICICIBANK
   - (and 15 more...)

### All stocks should have:
- `has_options = true`
- `exchange = 'NSE'`
- `is_active = true`

---

## 🔧 Common Issues and Fixes

### Issue 1: CORS Error
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**Fix:**
- Edge function has CORS headers configured
- Try refreshing the page
- Clear browser cache

### Issue 2: Network Error
```
Failed to fetch
TypeError: NetworkError when attempting to fetch resource
```

**Fix:**
- Check your internet connection
- Verify Supabase URL in `.env` is correct
- Try accessing Supabase URL directly in browser

### Issue 3: JWT Verification Error
```
JWT verification failed
```

**Fix:**
- Edge function redeployed with `verifyJWT: false`
- Refresh page and try again
- Clear browser cache

### Issue 4: Environment Variables Not Loading
```
VITE_SUPABASE_URL is undefined
```

**Fix:**
1. Check `.env` file exists in project root
2. Verify variable names start with `VITE_`
3. Restart dev server:
   ```bash
   # Ctrl+C to stop
   npm run dev
   ```

### Issue 5: Silent Failure (No Error, No Success)
```
Button clicks but nothing happens
```

**Fix:**
1. Open browser console
2. Check for JavaScript errors
3. Verify fetch request is being made
4. Check Network tab in Developer Tools

---

## 🔬 Advanced Debugging

### Check Network Requests:
1. Open Developer Tools (F12)
2. Go to **Network** tab
3. Filter by `Fetch/XHR`
4. Click "Fetch Stocks"
5. Look for request to `groww-data-fetcher`
6. Click on the request to see:
   - **Headers** (verify Authorization header)
   - **Request Payload** (should have `action: "fetch_stocks_with_options"`)
   - **Response** (should have `success: true`)

### Check Edge Function Logs:
1. Go to Supabase Dashboard
2. Navigate to **Edge Functions**
3. Click on `groww-data-fetcher`
4. View **Logs** tab
5. Look for execution logs and errors

### Test Direct API Call:
Use this curl command to test the API directly:

```bash
curl -X POST \
  'https://YOUR_PROJECT.supabase.co/functions/v1/groww-data-fetcher' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"action":"fetch_stocks_with_options"}'
```

Replace:
- `YOUR_PROJECT` with your Supabase project ref
- `YOUR_ANON_KEY` with your anon key from `.env`

---

## 📋 Diagnostic Checklist

Before reporting an issue, verify:

- [ ] `.env` file exists and has correct values
- [ ] Dev server restarted after `.env` changes
- [ ] Browser console shows no JavaScript errors
- [ ] Settings page shows all ✅ in diagnostics
- [ ] "Test API Connection" button succeeds
- [ ] Network tab shows 200 OK response
- [ ] Edge functions are deployed (check Supabase dashboard)
- [ ] Database table `stocks` exists

---

## 🚨 If Nothing Works

### Nuclear Option - Fresh Restart:

1. **Stop dev server** (Ctrl+C)

2. **Clear browser cache:**
   - Chrome: Ctrl+Shift+Delete → Clear cached images and files
   - Firefox: Ctrl+Shift+Delete → Cached Web Content

3. **Verify `.env` file:**
   ```bash
   cat .env
   ```
   Should show:
   ```
   VITE_SUPABASE_URL=https://...
   VITE_SUPABASE_ANON_KEY=eyJ...
   VITE_OPENAI_API_KEY=sk-proj-...
   ```

4. **Restart dev server:**
   ```bash
   npm run dev
   ```

5. **Hard refresh browser:**
   - Chrome/Firefox: Ctrl+Shift+R
   - Safari: Cmd+Shift+R

6. **Try "Test API Connection" in Settings**

---

## 💡 Success Indicators

When everything works correctly:

### In Browser Console:
```javascript
✅ Fetching stocks from: https://...
✅ Response status: 200
✅ API Result: { success: true, message: "Fetched 20 stocks..." }
```

### In Alert Dialog:
```
✅ Stocks fetched successfully!

Fetched 20 stocks with options
```

### In Database:
```
stocks table: 20 rows
All with has_options = true
```

### In Radar Page:
- No error banner at top
- Ready to click "Scan for Shocks"

---

## 📞 Still Stuck?

If you've tried everything:

1. **Check edge function logs** in Supabase dashboard
2. **Share console errors** (screenshot or copy-paste)
3. **Share network request details** (from Network tab)
4. **Verify Supabase project is active** (not paused)

---

## 🎯 Quick Test Command

Run this in browser console to test everything:

```javascript
// Test 1: Check environment variables
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Has Anon Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
console.log('Has OpenAI Key:', !!import.meta.env.VITE_OPENAI_API_KEY);

// Test 2: Try API call
fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/groww-data-fetcher`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ action: 'fetch_stocks_with_options' })
})
  .then(r => r.json())
  .then(d => console.log('✅ API Test Result:', d))
  .catch(e => console.error('❌ API Test Failed:', e));
```

If this works, you should see:
```javascript
✅ API Test Result: {
  success: true,
  message: "Fetched 20 stocks with options",
  stocks: [...]
}
```

---

**Most Common Fix:** Restart dev server after adding API keys to `.env` file!
