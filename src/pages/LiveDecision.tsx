import { useEffect, useState } from 'react';
import { Clock, TrendingUp } from 'lucide-react';

export default function LiveDecision() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDecisionWindow, setIsDecisionWindow] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      const hours = now.getHours();
      const minutes = now.getMinutes();
      const inWindow = hours === 15 && minutes >= 0 && minutes <= 15;
      setIsDecisionWindow(inWindow);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Live Decision Window</h1>
        <p className="text-text-secondary">Real-time decision making (3:00 PM - 3:15 PM)</p>
      </div>

      <div className="bg-surface rounded-lg p-8 border border-surface-light text-center">
        <Clock className="w-16 h-16 text-primary mx-auto mb-4" />

        <div className="text-5xl font-bold text-text-primary mb-4">
          {currentTime.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </div>

        {isDecisionWindow ? (
          <div className="bg-success/20 border border-success/30 rounded-lg p-6 mt-6">
            <TrendingUp className="w-8 h-8 text-success mx-auto mb-3" />
            <p className="text-success font-semibold text-lg">
              Decision Window is ACTIVE
            </p>
            <p className="text-text-secondary text-sm mt-2">
              System is evaluating stocks for potential trades
            </p>
          </div>
        ) : (
          <div className="bg-surface-light rounded-lg p-6 mt-6">
            <p className="text-text-muted font-medium">
              Decision Window is Closed
            </p>
            <p className="text-text-secondary text-sm mt-2">
              Next window: Today 3:00 PM - 3:15 PM
            </p>
          </div>
        )}
      </div>

      <div className="bg-surface rounded-lg p-6 border border-surface-light">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Stocks Near Decision Threshold
        </h3>
        <div className="text-center py-8 text-text-muted">
          <p>No stocks near threshold currently</p>
        </div>
      </div>
    </div>
  );
}
