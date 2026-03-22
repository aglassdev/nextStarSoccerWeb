import { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  isVisible: boolean;
  endValue: number;
  label: string;
  suffix?: string;
}

const AnimatedCounter = ({ isVisible, endValue, label, suffix = '' }: AnimatedCounterProps) => {
  const [displayValue, setDisplayValue] = useState(1);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (isVisible && !hasAnimated) {
      setHasAnimated(true);
      const duration = 2000; // 2 seconds
      const startTime = Date.now();
      const startValue = 1;

      const animate = () => {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic function
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.ceil(startValue + (endValue - startValue) * easeOutCubic);

        setDisplayValue(Math.min(currentValue, endValue));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [isVisible, hasAnimated, endValue]);

  return (
    <div className="text-center">
      <div className="text-6xl md:text-7xl font-bold text-white mb-4">
        {displayValue}{suffix}
      </div>
      <div className="text-white text-base md:text-lg whitespace-pre-line">
        {label}
      </div>
    </div>
  );
};

export default AnimatedCounter;
