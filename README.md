# SANIA AI - Autonomous Options Trading System

A fully autonomous options trading system built according to institutional-grade architecture principles. The system trades stock options using a shock candle reversal strategy with bounded AI assistance, comprehensive risk management, and continuous learning capabilities.

## 🎯 Core Philosophy

- **Survival > Profit**: Capital preservation is paramount
- **Rules > Intelligence**: Hard-coded safety rules override all learning
- **Learning is Bounded**: AI can only adjust feature weights, never core logic
- **Stop Loss is Sacred**: Every trade has mandatory stop loss
- **WAIT is Valid**: Not trading is an intelligent decision
- **Paper ≈ Real**: Same logic for both modes, only execution differs
- **Explainability is Mandatory**: Every decision must be auditable

## 🏗️ System Architecture

### Frontend (React + TypeScript)
- **Dashboard**: Real-time system status and P&L overview
- **Radar**: Stocks being tracked by the system
- **Stock Intelligence**: Detailed analysis with charts and explanations
- **Live Decision**: Real-time decision window (configurable, default 3:00-3:15 PM)
- **Trades**: Complete trade history (Paper/Real separation)
- **Learning**: Feature weights visualization and learning evolution
- **Settings**: System configuration management
- **Safety & Logs**: Audit trail and safety events

### Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Scheduler/Orchestrator                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Market Data Layer                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                 Scanner & Radar Manager                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  State Machine Engine                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     Feature Engine                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     Scoring Engine                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                  ┌────────▼────────┐
                  │  LLM Judge      │  (Conditional)
                  └────────┬────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│            Confidence Calibration Engine                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Position Sizing Engine                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│           Broker Interface (Paper/Real)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  Safety Governor                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Trade Monitoring & Exit                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Learning Engine                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│               Persistent Storage (Supabase)                  │
└──────────────────────────────────────────────────────────────┘
```

## 📊 Database Schema

### Core Tables
- **stocks**: Stock universe with options availability
- **radar**: Stocks being tracked after shock candle detection
- **state_memory**: State machine transition history
- **features_snapshot**: Feature values for each decision
- **trades**: Complete trade history (Paper & Real)
- **learning_weights**: Dynamic feature weights
- **decisions_log**: All decision records with reasoning
- **llm_prompts**: Versioned LLM prompts
- **system_config**: System configuration
- **safety_events**: Safety governor events
- **market_data_cache**: Cached market data
- **calibration_history**: Confidence calibration tracking

## 🧠 Backend Modules

### 1. LLM Provider Adapter
Multi-provider AI integration supporting:
- OpenAI (GPT-4)
- Anthropic Claude
- Google Gemini
- xAI Grok
- DeepSeek

**Features**:
- Unified interface across providers
- Automatic fallback on failure
- Normalized JSON output
- Complete audit trail

### 2. State Machine Engine
Enforces strict state transitions:
- `IDLE` → `SHOCK_DETECTED` → `DIGESTION` → `ACCEPTANCE_READY` → `TRADE_ACTIVE` → `IDLE`
- `FAILED_RESET` can occur from any state and returns to `IDLE`
- No state skipping allowed
- All transitions logged

### 3. Feature Engine
Calculates 18 locked features:
- **Price & Volume**: shock candle, volume multiple, days since shock, volume trend, acceptance candle
- **Trend & Structure**: trend, support/resistance, distance to key levels
- **Options Context**: option type, strike type, bid-ask spread, OI alignment
- **Market Context**: FII/DII flows, news risk

### 4. Scoring Engine
- Weighted feature scoring
- Threshold-based decision
- Ambiguity detection for LLM consultation
- Score explanation generation

### 5. Safety Governor
**Non-overridable checks**:
- Daily loss limit
- Max trades per day
- Per-trade risk limit
- Consecutive loss throttle
- API health monitoring
- Data integrity validation
- Emergency stop capabilities

**Graduation criteria** (Paper → Real):
- Minimum 20 paper trades
- Maximum 10% drawdown
- Positive total P&L
- No critical safety events in 7 days

### 6. Position Sizing Engine
**Risk-based sizing**:
- Fixed % risk per trade
- Confidence-based scaling (0.5× to 1.0×, never higher)
- Loss throttle (reduces size after consecutive losses)
- Capital availability checks
- Never uses martingale or revenge sizing

### 7. Confidence Calibration Engine
- Adjusts raw LLM confidence using historical accuracy
- Slow-changing calibration factor (0.5 - 1.2 range)
- Feature similarity consideration
- Time decay for outdated calibrations

### 8. Broker Interface
**Two implementations**:
- **PaperBroker**: Simulated execution with slippage
- **RealBroker**: Groww API integration (placeholder)

Both feed same learning engine with different weights:
- Paper: 0.3× learning weight
- Real: 1.0× learning weight

### 9. Learning Engine
**What it CAN learn**:
- Feature weights (bounded)
- Confidence calibration

**What it CANNOT learn**:
- Entry timing
- Stop loss logic
- Exit logic
- Position sizing rules
- State machine transitions
- Risk limits

**Learning decay**:
- Time-based decay after 7 days
- Performance-based weight adjustment
- Automatic reset on poor performance

## 🚦 Trading Strategy

### Shock Candle Detection
1. Large red or green candle
2. Volume ≥ 4× 20-day average
3. Significant body size (not doji)

### Digestion Phase (1-4 days)
- Volume decreases
- Price consolidates
- No immediate trading

### Acceptance Candle
- Counter-trend candle
- Good body ratio
- Signals potential reversal

### Decision Window
- Configurable (default 3:00-3:15 PM)
- Score-based with LLM consultation if ambiguous
- Safety checks before execution

### Trade Management
- Hard stop loss (mandatory)
- Trailing stop loss (profit protection)
- Next-day exit option
- Emergency flatten capability

## 🔒 Safety Features

### Multiple Safety Layers
1. **Pre-trade checks**: Risk limits, API health, data integrity
2. **Execution safety**: Position size validation, capital checks
3. **Post-trade monitoring**: Continuous SL tracking, gap protection
4. **Emergency controls**: Kill switch, auto-disable REAL mode

### Audit Trail
- Every decision logged
- All state transitions recorded
- Safety events tracked
- Complete explainability

## 📈 Monitoring & Alerts

### Health Checks
- System health (uptime, resources)
- Data health (freshness, integrity)
- Trading health (P&L, win rate)
- AI health (LLM latency, failures)
- Safety health (breach events, throttling)

### Alert Levels
- **INFO**: Operational events
- **WARNING**: Throttling, minor issues
- **CRITICAL**: Breaches, failures, emergency stops

## 🚀 Deployment

### Prerequisites
- Supabase project (database provided)
- Node.js 18+
- Environment variables configured

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Installation
```bash
npm install
npm run build
```

### Edge Functions
Decision engine deployed as Supabase Edge Function:
- Processes radar stocks at decision time
- Executes scoring and safety checks
- Places orders through broker interface
- Logs all decisions

## 📝 Configuration

### System Config (via UI)
- **Trading Mode**: PAPER / REAL
- **Risk Limits**: Per-trade, per-day, max trades
- **Strategy Settings**: Thresholds, timing windows
- **Learning Rates**: Paper vs Real weight
- **LLM Provider**: OpenAI, Claude, Gemini, Grok, DeepSeek

### Risk Limits (Default)
- Max risk per trade: 2% of capital
- Max loss per day: 5% of capital
- Max trades per day: 3
- Consecutive loss throttle: 3 losses

## 🔬 Testing & Validation

### Dry-Run Checklist
- [ ] Data flow validation
- [ ] Strategy logic validation
- [ ] LLM integration validation
- [ ] Position sizing validation
- [ ] Execution simulation
- [ ] Safety governor validation
- [ ] Learning engine validation

### Graduation Criteria
Must complete before enabling REAL mode:
- ≥ 20 paper trades
- Max drawdown ≤ 10%
- Positive total P&L
- Zero critical failures

## 📚 Technical Stack

### Frontend
- React 18
- TypeScript
- Tailwind CSS
- Recharts (visualization)
- Zustand (state management)
- React Router

### Backend
- Supabase (database, auth, edge functions)
- TypeScript/Deno (edge functions)
- Multiple LLM providers

### Infrastructure
- Supabase hosting
- Automatic backups
- Row Level Security (RLS)
- Real-time subscriptions

## ⚠️ Important Notes

### Security
- All tables have RLS enabled
- API keys never logged
- Secrets auto-configured in edge functions
- No hardcoded credentials

### Compliance
- Rate limiting enforced
- No market manipulation patterns
- Full audit trail maintained
- Broker terms respected

### Limitations
- Paper trading only until graduation
- Groww API integration is placeholder
- Manual market data integration needed for production
- LLM API keys must be configured

## 🎓 Learning & Evolution

The system learns from every trade but within strict bounds:
- Feature weights adjust based on outcomes
- Confidence calibration improves accuracy
- Time decay prevents overfitting
- Poor performers get reset
- Core rules never change

## 📞 Support & Documentation

For detailed documentation on each module, see:
- `/src/backend/types.ts` - Type definitions
- `/src/backend/*.ts` - Individual engine implementations
- `/supabase/migrations/` - Database schema
- `/src/pages/*.tsx` - UI components

## 🔐 License

Proprietary - SANIA AI Trading System

---

**Remember**: Capital preservation is more important than opportunity. The system is designed to survive, learn, and evolve while protecting your capital at all costs.
