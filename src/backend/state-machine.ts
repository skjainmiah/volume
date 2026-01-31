import { StateMachineState } from './types';

interface StateTransition {
  from: StateMachineState;
  to: StateMachineState;
  reason: string;
}

export class StateMachineEngine {
  private static readonly VALID_TRANSITIONS: Record<
    StateMachineState,
    StateMachineState[]
  > = {
    IDLE: ['SHOCK_DETECTED'],
    SHOCK_DETECTED: ['DIGESTION', 'FAILED_RESET'],
    DIGESTION: ['ACCEPTANCE_READY', 'FAILED_RESET'],
    ACCEPTANCE_READY: ['TRADE_ACTIVE', 'FAILED_RESET'],
    TRADE_ACTIVE: ['IDLE'],
    FAILED_RESET: ['IDLE'],
  };

  validateTransition(from: StateMachineState, to: StateMachineState): boolean {
    const validNextStates = StateMachineEngine.VALID_TRANSITIONS[from];
    return validNextStates.includes(to);
  }

  getValidNextStates(currentState: StateMachineState): StateMachineState[] {
    return StateMachineEngine.VALID_TRANSITIONS[currentState] || [];
  }

  canTrade(state: StateMachineState): boolean {
    return state === 'ACCEPTANCE_READY';
  }

  shouldBeInDigestion(
    currentState: StateMachineState,
    daysSinceShock: number,
    _volumeTrend: string
  ): boolean {
    if (currentState === 'SHOCK_DETECTED' && daysSinceShock >= 1) {
      return true;
    }
    return false;
  }

  shouldBeAcceptanceReady(
    currentState: StateMachineState,
    daysSinceShock: number,
    acceptanceCandle: boolean,
    volumeTrend: string
  ): boolean {
    if (
      currentState === 'DIGESTION' &&
      daysSinceShock >= 1 &&
      daysSinceShock <= 4 &&
      acceptanceCandle &&
      volumeTrend === 'DECREASING'
    ) {
      return true;
    }
    return false;
  }

  shouldFail(
    currentState: StateMachineState,
    daysSinceShock: number,
    volumeTrend: string,
    priceNearResistance: boolean
  ): boolean {
    if (daysSinceShock > 6) {
      return true;
    }

    if (currentState === 'DIGESTION' && volumeTrend === 'EXPANDING') {
      return true;
    }

    if (
      currentState === 'ACCEPTANCE_READY' &&
      priceNearResistance &&
      volumeTrend !== 'DECREASING'
    ) {
      return true;
    }

    return false;
  }

  determineNextState(
    currentState: StateMachineState,
    daysSinceShock: number,
    acceptanceCandle: boolean,
    volumeTrend: string,
    priceNearResistance: boolean
  ): { nextState: StateMachineState; reason: string } {
    if (
      this.shouldFail(currentState, daysSinceShock, volumeTrend, priceNearResistance)
    ) {
      return {
        nextState: 'FAILED_RESET',
        reason: this.getFailureReason(
          daysSinceShock,
          volumeTrend,
          priceNearResistance
        ),
      };
    }

    if (currentState === 'SHOCK_DETECTED') {
      if (daysSinceShock >= 1) {
        return {
          nextState: 'DIGESTION',
          reason: 'Shock candle detected, entering digestion phase',
        };
      }
    }

    if (currentState === 'DIGESTION') {
      if (
        this.shouldBeAcceptanceReady(
          currentState,
          daysSinceShock,
          acceptanceCandle,
          volumeTrend
        )
      ) {
        return {
          nextState: 'ACCEPTANCE_READY',
          reason: 'Acceptance candle detected, ready for decision',
        };
      }
    }

    if (currentState === 'FAILED_RESET') {
      return {
        nextState: 'IDLE',
        reason: 'Resetting to idle state',
      };
    }

    return {
      nextState: currentState,
      reason: 'No state change required',
    };
  }

  private getFailureReason(
    daysSinceShock: number,
    volumeTrend: string,
    priceNearResistance: boolean
  ): string {
    if (daysSinceShock > 6) {
      return 'Setup invalidated: Too many days since shock candle';
    }

    if (volumeTrend === 'EXPANDING') {
      return 'Setup invalidated: Volume expanding instead of digesting';
    }

    if (priceNearResistance) {
      return 'Setup invalidated: Price too close to resistance';
    }

    return 'Setup invalidated: Unknown reason';
  }

  async logTransition(
    radarId: string,
    transition: StateTransition,
    supabaseClient: any
  ): Promise<void> {
    try {
      await supabaseClient.from('state_memory').insert({
        radar_id: radarId,
        previous_state: transition.from,
        current_state: transition.to,
        transition_reason: transition.reason,
        transitioned_at: new Date().toISOString(),
      });

      await supabaseClient
        .from('radar')
        .update({
          current_state: transition.to,
          updated_at: new Date().toISOString(),
        })
        .eq('id', radarId);
    } catch (error) {
      console.error('Error logging state transition:', error);
      throw error;
    }
  }

  getStateDescription(state: StateMachineState): string {
    const descriptions: Record<StateMachineState, string> = {
      IDLE: 'No active setup',
      SHOCK_DETECTED: 'High-volume shock candle detected',
      DIGESTION: 'Tracking volume decay and price consolidation',
      ACCEPTANCE_READY: 'Potential reversal/acceptance candle identified',
      TRADE_ACTIVE: 'Position is active',
      FAILED_RESET: 'Setup invalidated, resetting',
    };

    return descriptions[state] || 'Unknown state';
  }
}
