import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Brain, TrendingUp, TrendingDown } from 'lucide-react';

interface FeatureWeight {
  feature_name: string;
  current_weight: number;
  min_weight: number;
  max_weight: number;
  performance_impact: number;
  update_count: number;
}

export default function Learning() {
  const [weights, setWeights] = useState<FeatureWeight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLearningWeights();
  }, []);

  const loadLearningWeights = async () => {
    try {
      const { data, error } = await supabase
        .from('learning_weights')
        .select('*')
        .order('performance_impact', { ascending: false });

      if (error) throw error;
      setWeights(data || []);
    } catch (error) {
      console.error('Error loading learning weights:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = weights.map(w => ({
    name: w.feature_name.replace(/_/g, ' '),
    weight: w.current_weight,
    impact: w.performance_impact,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
          <Brain className="w-8 h-8 text-primary" />
          Learning & Intelligence
        </h1>
        <p className="text-text-secondary">Feature weights and learning evolution</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-surface rounded-lg p-6 border border-surface-light">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Feature Weights</h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1C2541" />
                  <XAxis
                    dataKey="name"
                    stroke="#94A3B8"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis stroke="#94A3B8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#141B34',
                      border: '1px solid #1C2541',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="weight" fill="#3B82F6" name="Current Weight" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface rounded-lg p-6 border border-surface-light">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Top Performing Features
              </h3>
              <div className="space-y-3">
                {weights
                  .filter(w => w.performance_impact > 0)
                  .slice(0, 5)
                  .map(weight => (
                    <div key={weight.feature_name} className="flex items-center justify-between p-3 bg-surface-light rounded-lg">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-success" />
                        <span className="text-text-primary font-medium">
                          {weight.feature_name.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-success font-semibold">
                        +{weight.performance_impact.toFixed(3)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="bg-surface rounded-lg p-6 border border-surface-light">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                Features Under Review
              </h3>
              <div className="space-y-3">
                {weights
                  .filter(w => w.performance_impact < 0)
                  .slice(0, 5)
                  .map(weight => (
                    <div key={weight.feature_name} className="flex items-center justify-between p-3 bg-surface-light rounded-lg">
                      <div className="flex items-center gap-3">
                        <TrendingDown className="w-5 h-5 text-danger" />
                        <span className="text-text-primary font-medium">
                          {weight.feature_name.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-danger font-semibold">
                        {weight.performance_impact.toFixed(3)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/30 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Learning Constraints</h3>
            <ul className="text-text-secondary text-sm space-y-2">
              <li>• Learning only updates feature weights (never rules or stop loss)</li>
              <li>• Paper trades have 0.3× learning weight vs real trades (1.0×)</li>
              <li>• All weights are bounded between min and max values</li>
              <li>• Changes are applied slowly to prevent overfitting</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
