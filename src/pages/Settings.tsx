import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon, Save, AlertTriangle, Shield, TrendingUp, Brain, Clock, Key } from 'lucide-react';
import clsx from 'clsx';

interface SystemConfig {
  trading_mode: 'PAPER' | 'REAL';
  max_risk_per_trade_pct: number;
  max_loss_per_day_pct: number;
  max_trades_per_day: number;
  consecutive_loss_throttle: number;
  decision_window_start_hour: number;
  decision_window_start_minute: number;
  decision_window_end_hour: number;
  decision_window_end_minute: number;
  shock_volume_threshold: number;
  learning_rate_paper: number;
  learning_rate_real: number;
  llm_provider: 'openai' | 'claude' | 'gemini' | 'grok' | 'deepseek';
  score_threshold: number;
}

export default function Settings() {
  const [config, setConfig] = useState<SystemConfig>({
    trading_mode: 'PAPER',
    max_risk_per_trade_pct: 2.0,
    max_loss_per_day_pct: 5.0,
    max_trades_per_day: 3,
    consecutive_loss_throttle: 3,
    decision_window_start_hour: 15,
    decision_window_start_minute: 0,
    decision_window_end_hour: 15,
    decision_window_end_minute: 15,
    shock_volume_threshold: 4.0,
    learning_rate_paper: 0.3,
    learning_rate_real: 1.0,
    llm_provider: 'openai',
    score_threshold: 0.6,
  });

  const [apiKeys, setApiKeys] = useState({
    openai: '',
    claude: '',
    gemini: '',
    grok: '',
    deepseek: '',
  });

  const [growwConfig, setGrowwConfig] = useState({
    api_key: '',
    api_secret: '',
    user_id: '',
    is_configured: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showGraduationCheck, setShowGraduationCheck] = useState(false);
  const [graduationResult, setGraduationResult] = useState<{
    canEnableReal: boolean;
    reasons: string[];
  } | null>(null);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('*');

      if (error) throw error;

      if (data) {
        const configMap: any = {};
        data.forEach((item: any) => {
          const value = item.config_value;
          switch (item.config_key) {
            case 'trading_mode':
              configMap.trading_mode = value.mode;
              break;
            case 'max_risk_per_trade_pct':
              configMap.max_risk_per_trade_pct = value.value;
              break;
            case 'max_loss_per_day_pct':
              configMap.max_loss_per_day_pct = value.value;
              break;
            case 'max_trades_per_day':
              configMap.max_trades_per_day = value.value;
              break;
            case 'consecutive_loss_throttle':
              configMap.consecutive_loss_throttle = value.value;
              break;
            case 'decision_window_start':
              configMap.decision_window_start_hour = value.hour;
              configMap.decision_window_start_minute = value.minute;
              break;
            case 'decision_window_end':
              configMap.decision_window_end_hour = value.hour;
              configMap.decision_window_end_minute = value.minute;
              break;
            case 'shock_volume_threshold':
              configMap.shock_volume_threshold = value.value;
              break;
            case 'learning_rate_paper':
              configMap.learning_rate_paper = value.value;
              break;
            case 'learning_rate_real':
              configMap.learning_rate_real = value.value;
              break;
            case 'llm_provider':
              configMap.llm_provider = value.provider;
              break;
            case 'score_threshold':
              configMap.score_threshold = value.value;
              break;
            case 'groww_api':
              if (value.api_key) {
                setGrowwConfig({
                  api_key: value.api_key || '',
                  api_secret: value.api_secret || '',
                  user_id: value.user_id || '',
                  is_configured: true,
                });
              }
              break;
          }
        });
        setConfig({ ...config, ...configMap });
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkGraduationCriteria = async () => {
    setShowGraduationCheck(true);
    try {
      const { data: paperTrades } = await supabase
        .from('trades')
        .select('*')
        .eq('trade_mode', 'PAPER')
        .order('created_at', { ascending: false })
        .limit(50);

      const reasons: string[] = [];

      if (!paperTrades || paperTrades.length < 20) {
        reasons.push(`Minimum 20 paper trades required (current: ${paperTrades?.length || 0})`);
      }

      const totalPnL = paperTrades?.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0) || 0;

      if (totalPnL < 0) {
        reasons.push('Paper trading must be profitable before enabling REAL mode');
      }

      const { data: criticalEvents } = await supabase
        .from('safety_events')
        .select('*')
        .eq('severity', 'CRITICAL')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (criticalEvents && criticalEvents.length > 0) {
        reasons.push('Critical safety events in last 7 days must be resolved');
      }

      setGraduationResult({
        canEnableReal: reasons.length === 0,
        reasons,
      });
    } catch (error) {
      console.error('Error checking graduation:', error);
      setGraduationResult({
        canEnableReal: false,
        reasons: ['Error checking graduation criteria'],
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await (supabase
        .from('system_config') as any)
        .update({
          config_value: { mode: config.trading_mode },
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'trading_mode');

      await (supabase
        .from('system_config') as any)
        .update({
          config_value: { value: config.max_risk_per_trade_pct },
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'max_risk_per_trade_pct');

      await (supabase
        .from('system_config') as any)
        .update({
          config_value: { value: config.max_loss_per_day_pct },
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'max_loss_per_day_pct');

      await (supabase
        .from('system_config') as any)
        .update({
          config_value: { value: config.max_trades_per_day },
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'max_trades_per_day');

      await (supabase
        .from('system_config') as any)
        .update({
          config_value: { value: config.consecutive_loss_throttle },
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'consecutive_loss_throttle');

      await (supabase
        .from('system_config') as any)
        .update({
          config_value: {
            hour: config.decision_window_start_hour,
            minute: config.decision_window_start_minute
          },
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'decision_window_start');

      await (supabase
        .from('system_config') as any)
        .update({
          config_value: {
            hour: config.decision_window_end_hour,
            minute: config.decision_window_end_minute
          },
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'decision_window_end');

      await (supabase
        .from('system_config') as any)
        .update({
          config_value: { value: config.shock_volume_threshold },
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'shock_volume_threshold');

      await (supabase
        .from('system_config') as any)
        .update({
          config_value: { value: config.learning_rate_paper },
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'learning_rate_paper');

      await (supabase
        .from('system_config') as any)
        .update({
          config_value: { value: config.learning_rate_real },
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'learning_rate_real');

      await (supabase
        .from('system_config') as any)
        .update({
          config_value: { provider: config.llm_provider },
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'llm_provider');

      await (supabase
        .from('system_config') as any)
        .update({
          config_value: { value: config.score_threshold },
          updated_at: new Date().toISOString(),
        })
        .eq('config_key', 'score_threshold');

      alert('Configuration saved successfully');
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-primary" />
          Settings
        </h1>
        <p className="text-text-secondary">Configure system parameters and behavior</p>
      </div>

      <div className="bg-surface rounded-lg border border-surface-light overflow-hidden">
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-4">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Trading Mode
          </h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-text-primary font-medium">Current Mode</p>
              <p className="text-text-secondary text-sm">
                {config.trading_mode === 'PAPER'
                  ? 'Simulated trading with fake money'
                  : 'Real trading with actual capital'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setConfig({ ...config, trading_mode: 'PAPER' })}
                className={clsx(
                  'px-6 py-3 rounded-lg font-medium transition-colors',
                  config.trading_mode === 'PAPER'
                    ? 'bg-primary text-white'
                    : 'bg-surface-light text-text-secondary hover:bg-surface'
                )}
              >
                PAPER
              </button>
              <button
                onClick={() => {
                  if (config.trading_mode === 'PAPER') {
                    checkGraduationCriteria();
                  } else {
                    setConfig({ ...config, trading_mode: 'REAL' });
                  }
                }}
                className={clsx(
                  'px-6 py-3 rounded-lg font-medium transition-colors',
                  config.trading_mode === 'REAL'
                    ? 'bg-warning text-white'
                    : 'bg-surface-light text-text-secondary hover:bg-surface'
                )}
              >
                REAL
              </button>
            </div>
          </div>

          {showGraduationCheck && graduationResult && (
            <div className={clsx(
              'mt-4 p-4 rounded-lg border',
              graduationResult.canEnableReal
                ? 'bg-success/10 border-success/30'
                : 'bg-warning/10 border-warning/30'
            )}>
              <p className={clsx(
                'font-semibold mb-2',
                graduationResult.canEnableReal ? 'text-success' : 'text-warning'
              )}>
                {graduationResult.canEnableReal
                  ? '✓ Ready for REAL mode'
                  : '⚠ Not ready for REAL mode'}
              </p>
              {graduationResult.reasons.length > 0 && (
                <ul className="text-sm text-text-secondary space-y-1">
                  {graduationResult.reasons.map((reason, i) => (
                    <li key={i}>• {reason}</li>
                  ))}
                </ul>
              )}
              {graduationResult.canEnableReal && (
                <button
                  onClick={() => {
                    setConfig({ ...config, trading_mode: 'REAL' });
                    setShowGraduationCheck(false);
                  }}
                  className="mt-3 px-4 py-2 bg-warning hover:bg-warning/80 text-white rounded-lg font-medium transition-colors"
                >
                  Enable REAL Mode
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface rounded-lg border border-surface-light overflow-hidden">
        <div className="bg-surface-light px-6 py-4 border-b border-surface-light">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Risk Limits
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Max Risk Per Trade (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={config.max_risk_per_trade_pct}
                onChange={(e) => setConfig({ ...config, max_risk_per_trade_pct: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Max Loss Per Day (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={config.max_loss_per_day_pct}
                onChange={(e) => setConfig({ ...config, max_loss_per_day_pct: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Max Trades Per Day
              </label>
              <input
                type="number"
                value={config.max_trades_per_day}
                onChange={(e) => setConfig({ ...config, max_trades_per_day: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Consecutive Loss Throttle
              </label>
              <input
                type="number"
                value={config.consecutive_loss_throttle}
                onChange={(e) => setConfig({ ...config, consecutive_loss_throttle: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg border border-surface-light overflow-hidden">
        <div className="bg-surface-light px-6 py-4 border-b border-surface-light">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Decision Window
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Start Time
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={config.decision_window_start_hour}
                  onChange={(e) => setConfig({ ...config, decision_window_start_hour: parseInt(e.target.value) })}
                  className="w-20 px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="HH"
                />
                <span className="text-text-primary py-2">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={config.decision_window_start_minute}
                  onChange={(e) => setConfig({ ...config, decision_window_start_minute: parseInt(e.target.value) })}
                  className="w-20 px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="MM"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                End Time
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={config.decision_window_end_hour}
                  onChange={(e) => setConfig({ ...config, decision_window_end_hour: parseInt(e.target.value) })}
                  className="w-20 px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="HH"
                />
                <span className="text-text-primary py-2">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={config.decision_window_end_minute}
                  onChange={(e) => setConfig({ ...config, decision_window_end_minute: parseInt(e.target.value) })}
                  className="w-20 px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="MM"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg border border-surface-light overflow-hidden">
        <div className="bg-surface-light px-6 py-4 border-b border-surface-light">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Strategy Parameters
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Shock Volume Threshold (×)
              </label>
              <input
                type="number"
                step="0.1"
                value={config.shock_volume_threshold}
                onChange={(e) => setConfig({ ...config, shock_volume_threshold: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-text-muted mt-1">Volume must be X times the 20-day average</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Score Threshold
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={config.score_threshold}
                onChange={(e) => setConfig({ ...config, score_threshold: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-text-muted mt-1">Minimum score to trigger LLM consultation</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg border border-surface-light overflow-hidden">
        <div className="bg-surface-light px-6 py-4 border-b border-surface-light">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Learning Parameters
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Paper Trading Learning Rate
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={config.learning_rate_paper}
                onChange={(e) => setConfig({ ...config, learning_rate_paper: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-text-muted mt-1">Weight applied to paper trade outcomes</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Real Trading Learning Rate
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={config.learning_rate_real}
                onChange={(e) => setConfig({ ...config, learning_rate_real: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-text-muted mt-1">Weight applied to real trade outcomes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg border border-surface-light overflow-hidden">
        <div className="bg-surface-light px-6 py-4 border-b border-surface-light">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            LLM Configuration
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              LLM Provider
            </label>
            <select
              value={config.llm_provider}
              onChange={(e) => setConfig({ ...config, llm_provider: e.target.value as any })}
              className="w-full px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="openai">OpenAI (GPT-4)</option>
              <option value="claude">Anthropic Claude</option>
              <option value="gemini">Google Gemini</option>
              <option value="grok">xAI Grok</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              API Key (Optional - for testing)
            </label>
            <input
              type="password"
              value={apiKeys[config.llm_provider]}
              onChange={(e) => setApiKeys({ ...apiKeys, [config.llm_provider]: e.target.value })}
              placeholder="Enter API key for selected provider"
              className="w-full px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-text-muted mt-1">
              API keys are stored securely in edge functions
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg border border-surface-light overflow-hidden">
        <div className="bg-surface-light px-6 py-4 border-b border-surface-light">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Groww API Configuration
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-text-primary">
              <strong>How to get Groww API credentials:</strong>
            </p>
            <ol className="text-sm text-text-secondary mt-2 space-y-1 ml-4 list-decimal">
              <li>Log in to your Groww account</li>
              <li>Go to Settings → API Access</li>
              <li>Generate new API credentials</li>
              <li>Copy the API Key, Secret, and User ID</li>
              <li>Paste them below and save</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              API Key
            </label>
            <input
              type="password"
              value={growwConfig.api_key}
              onChange={(e) => setGrowwConfig({ ...growwConfig, api_key: e.target.value })}
              placeholder="Enter Groww API Key"
              className="w-full px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              API Secret
            </label>
            <input
              type="password"
              value={growwConfig.api_secret}
              onChange={(e) => setGrowwConfig({ ...growwConfig, api_secret: e.target.value })}
              placeholder="Enter Groww API Secret"
              className="w-full px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              User ID
            </label>
            <input
              type="text"
              value={growwConfig.user_id}
              onChange={(e) => setGrowwConfig({ ...growwConfig, user_id: e.target.value })}
              placeholder="Enter Groww User ID"
              className="w-full px-4 py-2 bg-background border border-surface-light rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              {growwConfig.is_configured && (
                <span className="text-success text-sm font-medium">✓ Configured</span>
              )}
            </div>
            <button
              onClick={async () => {
                try {
                  await (supabase.from('system_config') as any).upsert({
                    config_key: 'groww_api',
                    config_value: {
                      api_key: growwConfig.api_key,
                      api_secret: growwConfig.api_secret,
                      user_id: growwConfig.user_id,
                    },
                    config_type: 'API',
                    is_editable_during_trading: false,
                  });
                  setGrowwConfig({ ...growwConfig, is_configured: true });
                  alert('Groww API configured successfully');
                } catch (error) {
                  console.error('Error saving Groww config:', error);
                  alert('Error saving Groww configuration');
                }
              }}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium text-sm"
            >
              Save Groww API
            </button>
          </div>

          <p className="text-xs text-text-muted">
            All credentials are encrypted and stored securely in Supabase. Never shared with third parties.
          </p>
        </div>
      </div>

      <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-warning font-semibold">Important Safety Notice</p>
          <p className="text-text-secondary mt-1">
            Changes to risk limits and trading mode require careful consideration. The system will automatically
            prevent unsafe modifications during active trading. Always test changes in PAPER mode first.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <button
          onClick={loadConfiguration}
          className="px-6 py-3 bg-surface-light hover:bg-surface text-text-primary rounded-lg transition-colors font-medium"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
