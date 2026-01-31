import { SafetyCheck, RiskLimits, TradingMode, SafetyEventSeverity } from './types';

interface SystemState {
  totalCapital: number;
  todayPnL: number;
  todayTradesCount: number;
  consecutiveLosses: number;
  activePositionsCount: number;
  tradingMode: TradingMode;
  marketDataHealthy: boolean;
  brokerApiHealthy: boolean;
  llmHealthy: boolean;
}

export class SafetyGovernor {
  private riskLimits: RiskLimits;
  private emergencyStopActive: boolean = false;
  private supabaseClient: any;

  constructor(riskLimits: RiskLimits, supabaseClient: any) {
    this.riskLimits = riskLimits;
    this.supabaseClient = supabaseClient;
  }

  async checkTradeAllowed(
    systemState: SystemState,
    tradeRiskAmount: number
  ): Promise<SafetyCheck> {
    if (this.emergencyStopActive) {
      return {
        passed: false,
        reason: 'Emergency stop is active',
        actionTaken: 'BLOCKED_TRADE',
      };
    }

    const dailyLossCheck = await this.checkDailyLossLimit(systemState);
    if (!dailyLossCheck.passed) {
      await this.logSafetyEvent(
        'DAILY_LOSS_LIMIT_BREACH',
        'CRITICAL',
        dailyLossCheck.reason!,
        'Disabled REAL mode, switched to PAPER'
      );
      await this.autoDisableRealMode();
      return dailyLossCheck;
    }

    const tradeCountCheck = this.checkMaxTradesPerDay(systemState);
    if (!tradeCountCheck.passed) {
      await this.logSafetyEvent(
        'MAX_TRADES_EXCEEDED',
        'WARNING',
        tradeCountCheck.reason!,
        'Blocked additional trades for today'
      );
      return tradeCountCheck;
    }

    const consecutiveLossCheck = this.checkConsecutiveLosses(systemState);
    if (!consecutiveLossCheck.passed) {
      await this.logSafetyEvent(
        'CONSECUTIVE_LOSS_THROTTLE',
        'WARNING',
        consecutiveLossCheck.reason!,
        'Trade throttling in effect'
      );
      return consecutiveLossCheck;
    }

    const perTradeRiskCheck = this.checkPerTradeRisk(systemState, tradeRiskAmount);
    if (!perTradeRiskCheck.passed) {
      await this.logSafetyEvent(
        'PER_TRADE_RISK_EXCEEDED',
        'WARNING',
        perTradeRiskCheck.reason!,
        'Blocked trade due to excessive risk'
      );
      return perTradeRiskCheck;
    }

    const apiHealthCheck = this.checkAPIHealth(systemState);
    if (!apiHealthCheck.passed) {
      await this.logSafetyEvent(
        'API_HEALTH_FAILURE',
        'CRITICAL',
        apiHealthCheck.reason!,
        'Halted new trades until APIs recover'
      );
      return apiHealthCheck;
    }

    const dataHealthCheck = this.checkDataIntegrity(systemState);
    if (!dataHealthCheck.passed) {
      await this.logSafetyEvent(
        'DATA_INTEGRITY_ISSUE',
        'WARNING',
        dataHealthCheck.reason!,
        'Skipped decision due to data issues'
      );
      return dataHealthCheck;
    }

    return {
      passed: true,
    };
  }

  private async checkDailyLossLimit(systemState: SystemState): Promise<SafetyCheck> {
    const maxLossAllowed =
      (this.riskLimits.maxLossPerDayPct / 100) * systemState.totalCapital;
    const currentLoss = Math.abs(Math.min(systemState.todayPnL, 0));

    if (currentLoss >= maxLossAllowed) {
      return {
        passed: false,
        reason: `Daily loss limit breached: ₹${currentLoss.toFixed(2)} / ₹${maxLossAllowed.toFixed(2)}`,
        actionTaken: 'DISABLED_REAL_MODE',
      };
    }

    return { passed: true };
  }

  private checkMaxTradesPerDay(systemState: SystemState): SafetyCheck {
    if (systemState.todayTradesCount >= this.riskLimits.maxTradesPerDay) {
      return {
        passed: false,
        reason: `Max trades per day reached: ${systemState.todayTradesCount} / ${this.riskLimits.maxTradesPerDay}`,
        actionTaken: 'BLOCKED_TRADE',
      };
    }

    return { passed: true };
  }

  private checkConsecutiveLosses(systemState: SystemState): SafetyCheck {
    if (systemState.consecutiveLosses >= this.riskLimits.consecutiveLossThrottle) {
      return {
        passed: false,
        reason: `Consecutive loss throttle active: ${systemState.consecutiveLosses} losses in a row`,
        actionTaken: 'THROTTLED_TRADING',
      };
    }

    return { passed: true };
  }

  private checkPerTradeRisk(
    systemState: SystemState,
    tradeRiskAmount: number
  ): SafetyCheck {
    const maxRiskAllowed =
      (this.riskLimits.maxRiskPerTradePct / 100) * systemState.totalCapital;

    if (tradeRiskAmount > maxRiskAllowed) {
      return {
        passed: false,
        reason: `Per-trade risk too high: ₹${tradeRiskAmount.toFixed(2)} > ₹${maxRiskAllowed.toFixed(2)}`,
        actionTaken: 'BLOCKED_TRADE',
      };
    }

    return { passed: true };
  }

  private checkAPIHealth(systemState: SystemState): SafetyCheck {
    if (!systemState.brokerApiHealthy) {
      return {
        passed: false,
        reason: 'Broker API is unhealthy or unresponsive',
        actionTaken: 'HALTED_NEW_TRADES',
      };
    }

    return { passed: true };
  }

  private checkDataIntegrity(systemState: SystemState): SafetyCheck {
    if (!systemState.marketDataHealthy) {
      return {
        passed: false,
        reason: 'Market data integrity issues detected',
        actionTaken: 'SKIPPED_DECISION',
      };
    }

    return { passed: true };
  }

  async handleMarketBlackSwan(): Promise<void> {
    await this.logSafetyEvent(
      'MARKET_BLACK_SWAN',
      'CRITICAL',
      'Extreme market volatility or gap detected',
      'Emergency flatten all positions, switch to PAPER mode'
    );

    await this.autoDisableRealMode();
    this.emergencyStopActive = true;
  }

  async handleInfrastructureCrash(): Promise<void> {
    await this.logSafetyEvent(
      'INFRASTRUCTURE_CRASH',
      'CRITICAL',
      'System crash or restart detected',
      'Attempting graceful recovery from database state'
    );
  }

  async activateKillSwitch(): Promise<void> {
    this.emergencyStopActive = true;

    await this.logSafetyEvent(
      'KILL_SWITCH_ACTIVATED',
      'CRITICAL',
      'Manual kill switch activated by user',
      'All trading stopped, switched to PAPER mode'
    );

    await this.autoDisableRealMode();
  }

  async deactivateKillSwitch(): Promise<void> {
    this.emergencyStopActive = false;

    await this.logSafetyEvent(
      'KILL_SWITCH_DEACTIVATED',
      'INFO',
      'Kill switch deactivated, system resuming',
      'System can now accept trades based on current mode'
    );
  }

  isEmergencyStopActive(): boolean {
    return this.emergencyStopActive;
  }

  private async autoDisableRealMode(): Promise<void> {
    try {
      await this.supabaseClient
        .from('system_config')
        .update({
          config_value: { mode: 'PAPER' },
          updated_at: new Date().toISOString(),
          updated_by: 'SAFETY_GOVERNOR',
        })
        .eq('config_key', 'trading_mode');
    } catch (error) {
      console.error('Error disabling REAL mode:', error);
    }
  }

  private async logSafetyEvent(
    eventType: string,
    severity: SafetyEventSeverity,
    description: string,
    actionTaken: string
  ): Promise<void> {
    try {
      await this.supabaseClient.from('safety_events').insert({
        event_type: eventType,
        severity,
        description,
        action_taken: actionTaken,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error logging safety event:', error);
    }
  }

  async checkGraduationCriteria(): Promise<{
    canEnableReal: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    try {
      const { data: paperTrades } = await this.supabaseClient
        .from('trades')
        .select('*')
        .eq('trade_mode', 'PAPER')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!paperTrades || paperTrades.length < 20) {
        reasons.push('Minimum 20 paper trades required (current: ' + (paperTrades?.length || 0) + ')');
      }

      const totalPnL = paperTrades?.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0) || 0;
      const maxDrawdown = this.calculateMaxDrawdown(paperTrades || []);

      if (maxDrawdown > 10) {
        reasons.push(`Max drawdown too high: ${maxDrawdown.toFixed(2)}% (limit: 10%)`);
      }

      if (totalPnL < 0) {
        reasons.push('Paper trading must be profitable before enabling REAL mode');
      }

      const { data: criticalEvents } = await this.supabaseClient
        .from('safety_events')
        .select('*')
        .eq('severity', 'CRITICAL')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (criticalEvents && criticalEvents.length > 0) {
        reasons.push('Critical safety events in last 7 days must be resolved');
      }

      return {
        canEnableReal: reasons.length === 0,
        reasons,
      };
    } catch (error) {
      console.error('Error checking graduation criteria:', error);
      return {
        canEnableReal: false,
        reasons: ['Error checking criteria'],
      };
    }
  }

  private calculateMaxDrawdown(trades: any[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;

    for (const trade of trades) {
      runningPnL += trade.pnl || 0;
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      const drawdown = ((peak - runningPnL) / Math.max(peak, 1)) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }
}
