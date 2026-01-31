# SANIA AI - Quick Start Guide

## 🚀 Immediate Testing Steps

### Step 1: Verify System Status
```
1. Open the app
2. Check Status Bar at bottom
3. Verify:
   ✅ TRADING: ON (green indicator)
   ✅ Mode: PAPER
   ✅ Capital: ₹100,000
```

### Step 2: Populate Database
```
1. Go to "Radar" page
2. Click "Fetch Stocks" button
3. Wait for alert: "Fetched 20 stocks with options"
4. This populates the stocks table with NSE stocks that have tradable options
```

**What just happened:**
- Added 20 major stocks (RELIANCE, TCS, HDFCBANK, etc.)
- All marked as `has_options = true`
- Ready for scanning and tracking

### Step 3: Fetch Candle Data
```
1. From Radar page, click any stock (e.g., RELIANCE)
2. You'll land on Stock Intelligence page
3. Click "Fetch Candles" button
4. Wait for data to load
5. Switch timeframes: 10M / 1H / 1D
```

**What you'll see:**
- 📊 Green/Red candlestick chart (TradingView style)
- 📈 Volume bars below with average line
- 🔄 Interactive tooltips showing OHLCV data
- ⏱️ Timeframe selector (10min, 1hour, 1day)

### Step 4: Test Scan Engine
```
IMPORTANT: Only works after 6:00 PM (EOD data requirement)

1. Go to Radar page
2. Click "Scan for Shocks" button
3. System scans all 20 stocks
4. Detects shock candles (volume ≥ 4× average)
5. Adds to radar with direction (RED/GREEN)
```

**What it checks:**
- ✅ Only scans stocks with `has_options = true`
- ✅ Volume spike (4× average)
- ✅ Strong body candle (60%+ of range)
- ✅ Direction (GREEN bullish / RED bearish)

### Step 5: Test Decision Engine
```
IMPORTANT: Only works 3:00-3:15 PM (decision window)

1. Manually add test data to radar:
   - Go to Radar page
   - Should see stocks in ACCEPTANCE_READY state

2. Go to "Live Decision" page
3. Click "Run Decision Engine"
4. System will:
   - Analyze acceptance patterns
   - Calculate feature scores
   - Consult OpenAI LLM if near threshold
   - FOR BUY SIGNALS:
     → Fetch options chain
     → Select ATM/ITM option
     → Execute OPTION trade
```

**Expected output:**
- List of decisions (BUY_CALL, BUY_PUT, or WAIT)
- Selected option contracts (e.g., "RELIANCE20250206225CE")
- Trade entries in Trades page

### Step 6: Verify Charts are Working
```
1. Stock Intelligence page
2. Should see:
   ✅ Green candles when close > open
   ✅ Red candles when close < open
   ✅ Wicks showing high/low
   ✅ Volume bars (green/red matching candle)
   ✅ Orange dashed line (average volume)
   ✅ Tooltip on hover (OHLCV)
```

### Step 7: Test Kill Switch
```
1. Click "TRADING ON" toggle at bottom status bar
2. Confirm dialog: "This will immediately stop all trading. Continue?"
3. Click Yes
4. Status changes to "TRADING OFF" (red + pulsing)
5. Try running decision engine → Should be blocked
6. Toggle back ON to resume
```

---

## 📊 Understanding the Charts

### Candlestick Colors:
- **Green** = Bullish (close ≥ open)
- **Red** = Bearish (close < open)

### Chart Layout:
```
┌────────────────────────────┐
│   PRICE CANDLESTICKS       │  70% height
│   (Green/Red candles)      │
│                            │
├────────────────────────────┤
│   VOLUME BARS              │  30% height
│   (with average line)      │
└────────────────────────────┘
```

### Timeframes:
- **10M** = 10-minute candles (100 bars)
- **1H** = 1-hour candles (50 bars)
- **1D** = Daily candles (30 bars)

---

## 🎯 CASH vs OPTIONS Flow

### What You See in Charts:
📊 **CASH market data** (equity prices)
- Used for analysis
- Displayed in charts
- Used for shock detection
- Used for pattern recognition

### What Gets Traded:
💹 **OPTIONS contracts** (CALL/PUT)
- Selected based on CASH analysis
- ATM or 1-step ITM strikes
- Nearest weekly expiry
- Only liquid options

### Critical Rule:
```
ANALYZE CASH → EXECUTE OPTIONS
    ↓              ↓
  Charts        Trades
```

**NEVER trade equity shares!**

---

## 🔍 Database Verification

### Check stocks table:
```sql
SELECT symbol, name, has_options, avg_volume_20d
FROM stocks
WHERE has_options = true
LIMIT 10;
```

Should return 20 stocks.

### Check candle_data table:
```sql
SELECT stock_symbol, timeframe, COUNT(*)
FROM candle_data
GROUP BY stock_symbol, timeframe
ORDER BY stock_symbol, timeframe;
```

After fetching candles, should see entries.

### Check options_chain table:
```sql
SELECT stock_symbol, option_type, COUNT(*)
FROM options_chain
WHERE is_liquid = true
GROUP BY stock_symbol, option_type;
```

Gets populated when decision engine fetches chains.

---

## 🧪 Mock Data vs Real API

### Currently Using Mock Data:
- ✅ Stock list (20 NSE stocks)
- ✅ Candle generation (algorithmic)
- ✅ Options chain generation (algorithmic)

### Ready for Groww API:
- 🔌 `groww-data-fetcher` edge function
- 🔌 Authentication placeholders
- 🔌 Error handling

### To Switch to Real API:
Edit `supabase/functions/groww-data-fetcher/index.ts`:
- Replace `generateMockCandles()` with Groww API call
- Replace `nseStocksWithOptions` array with API fetch
- Replace `generateMockOptions()` with API call

---

## ⚡ Quick Troubleshoots

### Charts not showing?
1. Click "Fetch Candles" button
2. Wait for data to load
3. Try switching timeframes

### Scan engine rejected?
- Check time (must be after 6 PM)
- Verify stocks table populated
- Check console for errors

### Decision engine blocked?
- Check kill switch status (must be OFF)
- Check time (3:00-3:15 PM window)
- Verify radar has ACCEPTANCE_READY stocks

### No options found?
- Run decision engine once to populate
- Check `options_chain` table
- Verify stock has `has_options = true`

---

## 📝 Important Notes

1. **Paper Mode First**: System starts in PAPER mode (safe testing)
2. **Kill Switch Default**: OFF (trading allowed)
3. **OpenAI Configured**: GPT-4 integration ready
4. **Time Windows**: Scan (6 PM+), Decision (3:00-3:15 PM)
5. **Options Only**: System will NEVER trade equity shares

---

## 🎓 Learning the System

### Day 1: Data Pipeline
- Fetch stocks
- Fetch candles
- View charts
- Understand timeframes

### Day 2: Scanning
- Run EOD scan
- Understand shock detection
- Track radar states

### Day 3: Decision Making
- Run decision engine
- Understand LLM role
- View selected options

### Day 4: Risk Management
- Test kill switch
- Monitor capital usage
- Check safety logs

### Week 2+: Paper Trading
- Let system run autonomously
- Monitor performance
- Analyze decisions

---

## 🚨 Safety First

Before ANY real trading:
1. ✅ Test all features in PAPER mode
2. ✅ Verify kill switch works
3. ✅ Complete 20+ profitable paper trades
4. ✅ Review all safety logs
5. ✅ Understand CASH→OPTIONS flow

**Only then consider REAL mode.**

---

## 📚 Additional Resources

- `SYSTEM_ARCHITECTURE.md` - Detailed technical docs
- `logic_prompt` - Original strategy logic
- Safety Logs page - Real-time event monitoring
- Settings page - Configuration options

---

## 💡 Pro Tips

1. **Always fetch stocks first** - Database needs population
2. **Test kill switch immediately** - Verify safety mechanism
3. **Watch the charts** - Understand price action
4. **Check Safety Logs** - Monitor system behavior
5. **Start with PAPER mode** - Build confidence first

---

**Ready to trade? Start with Step 1!** 🚀
