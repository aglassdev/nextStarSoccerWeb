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
      const duration = 2000;
      const startTime = Date.now();
      const startValue = 1;

      const animate = () => {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.ceil(startValue + (endValue - startValue) * easeOutCubic);
        setDisplayValue(Math.min(currentValue, endValue));
        if (progress < 1) requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    }
  }, [isVisible, hasAnimated, endValue]);

  return (
    <div className="text-center px-1">
      <div className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-2 md:mb-4 leading-none">
        {displayValue}{suffix}
      </div>
      <div className="text-white text-xs sm:text-sm md:text-base whitespace-pre-line leading-snug">
        {label}
      </div>
    </div>
  );
};

export default AnimatedCounter;
