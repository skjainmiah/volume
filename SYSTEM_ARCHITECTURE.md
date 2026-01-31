# SANIA AI - System Architecture & Usage Guide

## 🎯 Core Philosophy

**"We analyze CASH, but we trade OPTIONS"**

This system NEVER trades equity shares. It analyzes cash market data to identify opportunities, then executes trades exclusively in OPTIONS.

---

## 📊 Data Flow Architecture

```
CASH STOCKS (OPTIONS-ELIGIBLE ONLY)
        ↓
  FETCH CANDLE DATA
        ↓
   SHOCK DETECTION
        ↓
   RADAR TRACKING
        ↓
 ACCEPTANCE PATTERN
        ↓
  DECISION ENGINE
        ↓
 FETCH OPTIONS CHAIN
        ↓
   SELECT OPTION
        ↓
  EXECUTE TRADE (OPTIONS ONLY)
```

---

## 🗄️ Database Schema

### 1. **stocks** - Universe of tradable stocks
- `symbol` (PK) - Stock ticker (e.g., 'RELIANCE')
- `name` - Company name
- `has_options` (boolean) - **CRITICAL FILTER** - Only true stocks enter radar
- `avg_volume_20d` - 20-day average volume for shock detection
- `last_price` - Current spot price

### 2. **candle_data** - CASH market price data
- Supports 3 timeframes: `10min`, `1hour`, `1day`
- OHLCV (Open, High, Low, Close, Volume)
- Used for ALL analysis and chart display
- Never used for direct trading

### 3. **options_chain** - OPTIONS market data
- `option_type` - 'CALL' or 'PUT'
- `strike_price`, `expiry_date`
- `ltp`, `bid`, `ask` - Pricing data
- `is_liquid` - Liquidity filter
- `groww_symbol` - Actual tradable symbol
- Used ONLY for execution

### 4. **radar** - Active tracking list
- Only stocks with `has_options=true` can enter
- Tracks shock candles through digestion phase
- State machine: DIGESTION → ACCEPTANCE_READY → TRADE_ACTIVE

### 5. **trades** - Executed positions
- `trade_mode` - PAPER or REAL
- `option_symbol` - Actual option contract traded
- `option_type` - CALL or PUT
- `strike_price`, `expiry_date`
- Stop loss, P&L tracking

---

## 🔧 Edge Functions

### 1. **groww-data-fetcher**
Handles all market data retrieval:

**Actions:**
- `fetch_stocks_with_options` - Populates stocks table with options-eligible stocks
- `fetch_candles` - Fetches CASH market OHLCV data (10min/1hour/1day)
- `fetch_options_chain` - Fetches OPTIONS market data for execution

**Critical Rules:**
- Candles are CASH market data (for analysis)
- Options chain is separate (for execution)
- Currently uses mock data generators (ready for Groww API integration)

### 2. **scan-engine**
Daily EOD scan for shock candles:

**Logic:**
1. Fetch all stocks WHERE `has_options = true`
2. For each stock, fetch last 21 daily candles
3. Detect shock if:
   - Volume ≥ 4× average 20-day volume
   - Body ratio ≥ 60% of candle range
4. Add to radar with direction (RED/GREEN)

**Safety:**
- Only runs after 6:00 PM (EOD data required)
- NEVER scans stocks without options
- Logs all detected shocks

### 3. **decision-engine**
Real-time decision making during market hours:

**Flow:**
1. Check kill switch (blocks if active)
2. Check decision window (3:00-3:15 PM)
3. Fetch acceptance-ready stocks from radar
4. Calculate features (digestion quality, volume behavior)
5. Score using learned weights
6. Consult LLM if score near threshold
7. **IF BUY SIGNAL → Fetch options chain**
8. Select ATM/ITM liquid option
9. Execute trade (OPTIONS ONLY)

**Options Selection Logic:**
```javascript
// 1. Verify stock has options
if (!stockData.has_options) {
  REJECT - "Stock does not have tradable options"
}

// 2. Fetch options chain
const optionsChain = await fetchOptionsChain(symbol, optionType)

// 3. Filter liquid options
const liquidOptions = optionsChain.filter(o => o.is_liquid)

// 4. Select nearest expiry, ATM strike
const selectedOption = findATMOption(liquidOptions, spotPrice)

// 5. Execute OPTION trade
executeTrade(selectedOption)
```

### 4. **kill-switch-manager**
Master emergency stop:

**Manual Control:**
- UI toggle (ON/OFF)
- Confirmation dialog required

**Auto-Triggers:**
- Consecutive losses ≥ 3
- Daily drawdown > 2%
- API failures
- Data corruption
- Execution anomalies

**When Active:**
- ❌ No new trades
- ✅ Scanning continues
- ✅ Charts update
- ❌ Decision engine blocked

---

## 🎨 Frontend Components

### 1. **CandlestickChart.tsx**
TradingView-style candlestick chart:
- Green/Red candles (CASH market)
- Volume bars with average line
- Timeframe selector (10M / 1H / 1D)
- Interactive tooltips (OHLCV)

### 2. **Pages**

**Radar:**
- Lists tracked stocks
- "Fetch Stocks" button → Populates database with options-eligible stocks
- "Scan for Shocks" button → Runs EOD scan

**Stock Intelligence:**
- Detailed view per stock
- Live candlestick charts
- Timeframe switching
- "Fetch Candles" button → Loads CASH market data
- Shock details sidebar

**Live Decision:**
- Shows acceptance-ready stocks
- "Run Decision Engine" button
- Displays BUY/WAIT decisions
- Shows selected option contracts

**Dashboard:**
- Today's P&L
- Active trades
- Radar count
- System status

---

## 🚦 Trading Rules (Enforced in Code)

### ✅ ALLOWED:
- Analyze CASH market data
- Display CASH charts
- Scan CASH candles
- **BUY CALL options**
- **BUY PUT options**

### ❌ FORBIDDEN:
- Trade equity shares (CNC/MIS)
- Trade futures
- SELL naked options
- Trade stocks without options
- Skip options chain verification

---

## 🔐 Security & Safety

### Row Level Security (RLS):
- All tables have RLS enabled
- Authenticated users: READ-ONLY
- Service role (edge functions): READ/WRITE

### Kill Switch:
- 3-level protection (UI, Backend, Strategy)
- Persistent state across restarts
- Only manual deactivation allowed
- Auto-triggers on violations

### API Keys:
- Stored in database (`system_config` table)
- OpenAI API key configured
- Environment variables as fallback

---

## 🎯 Usage Workflow

### Step 1: Initial Setup
```bash
1. Go to Radar page
2. Click "Fetch Stocks" → Populates 20 NSE stocks with options
3. Wait for success message
```

### Step 2: Fetch Market Data
```bash
1. Go to Stock Intelligence page (click any radar item)
2. Click "Fetch Candles" → Downloads CASH market data
3. Switch timeframes: 10M / 1H / 1D
4. View candlestick charts with volume
```

### Step 3: Run Scan (After 6 PM)
```bash
1. Go to Radar page
2. Click "Scan for Shocks"
3. System scans all stocks for shock candles
4. Detected shocks added to radar
```

### Step 4: Decision Window (3:00-3:15 PM)
```bash
1. Go to Live Decision page
2. Click "Run Decision Engine"
3. System analyzes acceptance-ready stocks
4. For BUY signals:
   - Fetches options chain
   - Selects ATM/ITM option
   - Executes OPTION trade
5. View results and selected contracts
```

### Step 5: Monitor Trades
```bash
1. Go to Trades page
2. View open positions (OPTIONS)
3. Monitor P&L
4. System auto-exits based on stop loss
```

---

## 🧪 Testing Checklist

### Data Pipeline:
- [ ] Fetch stocks with options (should get 20 stocks)
- [ ] Fetch candles for 1day timeframe
- [ ] Fetch candles for 1hour timeframe
- [ ] Fetch candles for 10min timeframe
- [ ] Verify charts display green/red candles
- [ ] Verify volume bars show below chart

### Kill Switch:
- [ ] Toggle kill switch ON
- [ ] Try running decision engine (should block)
- [ ] Toggle kill switch OFF
- [ ] Verify trading resumes

### Scan Engine:
- [ ] Run scan before 6 PM (should reject)
- [ ] Run scan after 6 PM (should succeed)
- [ ] Verify only stocks with options are scanned
- [ ] Check radar for detected shocks

### Decision Engine:
- [ ] Run outside decision window (should reject)
- [ ] Run during 3:00-3:15 PM window
- [ ] Verify options chain is fetched on BUY signal
- [ ] Verify ATM/ITM option is selected
- [ ] Check trades table for executed positions
- [ ] Verify option_symbol contains actual contract

### LLM Integration:
- [ ] Set score threshold near 0.5
- [ ] Add acceptance-ready stock
- [ ] Run decision engine
- [ ] Verify OpenAI API is called
- [ ] Check decisions_log for LLM response

---

## 🔌 API Integration Readiness

Currently using **mock data generators**. Ready for Groww API:

### Replace in `groww-data-fetcher`:

**fetch_stocks_with_options:**
```typescript
// Replace hardcoded list with:
const response = await fetch('GROWW_API/stocks/with-options')
const stocks = await response.json()
```

**fetch_candles:**
```typescript
// Replace mock generator with:
const response = await fetch(`GROWW_API/candles/${symbol}/${timeframe}`)
const candles = await response.json()
```

**fetch_options_chain:**
```typescript
// Replace mock generator with:
const response = await fetch(`GROWW_API/options/${symbol}`)
const chain = await response.json()
```

---

## 📈 Next Steps

1. **Integrate Real Groww API**
   - Replace mock generators
   - Add authentication
   - Handle rate limits

2. **Position Monitoring**
   - Create edge function for stop loss checks
   - Real-time P&L updates
   - Auto-exit logic

3. **Scheduler Setup**
   - Daily EOD scan (6:00 PM)
   - Decision window (3:00-3:15 PM)
   - Position monitoring (market hours)

4. **Graduation to REAL Mode**
   - Requires 20+ profitable paper trades
   - No critical safety events
   - Manual approval

---

## ⚠️ Critical Reminders

1. **NEVER trade equity shares** - System ONLY trades OPTIONS
2. **ALWAYS verify has_options=true** - Before radar entry
3. **ALWAYS fetch options chain** - Before execution
4. **NEVER skip kill switch check** - Safety first
5. **CASH for analysis, OPTIONS for execution** - Core philosophy

---

## 🛠️ Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Supabase (Database + Edge Functions)
- **Charts:** Recharts (Candlestick + Volume)
- **AI:** OpenAI GPT-4 (Decision validation)
- **State:** Zustand
- **Styling:** Tailwind CSS

---

## 📞 Support

For issues or questions:
1. Check Safety Logs page for error events
2. Review kill switch triggers
3. Verify database schema matches this doc
4. Ensure edge functions deployed correctly

**Build Status:** ✅ PASSING
**Kill Switch:** ✅ OPERATIONAL
**LLM Integration:** ✅ CONFIGURED
**Charts:** ✅ CANDLESTICK + VOLUME
**Options Logic:** ✅ ENFORCED
