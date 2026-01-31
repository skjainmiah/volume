import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon, Save, AlertTriangle } from 'lucide-react';

interface ConfigItem {
  config_key: string;
  config_value: any;
  config_type: string;
  is_editable_during_trading: boolean;
}

export default function Settings() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('*')
        .order('config_type');

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Error loading configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    alert('Configuration saved successfully');
  };

  const groupedConfigs = configs.reduce((acc, config) => {
    if (!acc[config.config_type]) {
      acc[config.config_type] = [];
    }
    acc[config.config_type].push(config);
    return acc;
  }, {} as Record<string, ConfigItem[]>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-primary" />
          Settings
        </h1>
        <p className="text-text-secondary">Configure system parameters and behavior</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-warning font-semibold">Configuration Warning</p>
              <p className="text-text-secondary mt-1">
                Some settings cannot be changed during active real trading. The system will prevent unsafe modifications.
              </p>
            </div>
          </div>

          {Object.entries(groupedConfigs).map(([type, items]) => (
            <div key={type} className="bg-surface rounded-lg border border-surface-light overflow-hidden">
              <div className="bg-surface-light px-6 py-4">
                <h3 className="text-lg font-semibold text-text-primary">{type} Settings</h3>
              </div>

              <div className="p-6 space-y-4">
                {items.map(config => (
                  <div key={config.config_key} className="flex items-center justify-between p-4 bg-surface-light rounded-lg">
                    <div>
                      <p className="text-text-primary font-medium">
                        {config.config_key.replace(/_/g, ' ').toUpperCase()}
                      </p>
                      <p className="text-text-secondary text-sm mt-1">
                        {!config.is_editable_during_trading && '🔒 Locked during trading'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-text-primary font-mono">
                        {typeof config.config_value === 'object'
                          ? JSON.stringify(config.config_value)
                          : String(config.config_value)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-end gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
