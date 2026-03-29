import { useEffect, useRef, useState } from 'react';

const AnimatedCycleText = () => {
  const words = ['Dream', 'Train', 'Play'];
  const animationValue = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Responsive dimensions based on viewport width
  const getDims = () => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
    if (w < 400) return { fontSize: 30, textHeight: 38, containerWidth: 108, marginLeft: 7 };
    if (w < 640) return { fontSize: 36, textHeight: 46, containerWidth: 130, marginLeft: 8 };
    if (w < 768) return { fontSize: 44, textHeight: 56, containerWidth: 158, marginLeft: 9 };
    return { fontSize: 54, textHeight: 69, containerWidth: 195, marginLeft: 9 };
  };

  const [dims, setDims] = useState(getDims);

  useEffect(() => {
    const update = () => setDims(getDims());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const { fontSize, textHeight, containerWidth, marginLeft } = dims;

  useEffect(() => {
    animationValue.current = 0;
    if (containerRef.current) containerRef.current.style.transform = 'translateY(0px)';

    let animationFrameId: number;
    let timeoutId: number;

    const sequence: { toValue: number; duration: number; delay: number }[] = [];
    for (let i = 1; i < words.length; i++) {
      sequence.push({ toValue: -textHeight * i, duration: 800, delay: 1000 });
    }
    sequence.push({ toValue: 0, duration: 300, delay: 1000 });

    let currentStep = 0;

    const animate = () => {
      if (currentStep >= sequence.length) {
        currentStep = 0;
        timeoutId = window.setTimeout(() => animate(), 0);
        return;
      }
      const step = sequence[currentStep];
      const startValue = animationValue.current;
      const startTime = Date.now();

      const update = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / step.duration, 1);
        const eased =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        animationValue.current = startValue + (step.toValue - startValue) * eased;
        if (containerRef.current) {
          containerRef.current.style.transform = `translateY(${animationValue.current}px)`;
        }
        if (progress < 1) {
          animationFrameId = requestAnimationFrame(update);
        } else {
          timeoutId = window.setTimeout(() => {
            currentStep++;
            animate();
          }, step.delay);
        }
      };

      update();
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(timeoutId);
    };
  }, [textHeight, words.length]);

  return (
    <div className="flex items-center" style={{ height: `${textHeight}px`, overflow: 'hidden' }}>
      <div
        style={{
          width: `${containerWidth}px`,
          height: `${textHeight}px`,
          overflow: 'hidden',
          marginLeft: `-${marginLeft + 3}px`,
        }}
      >
        <div ref={containerRef} style={{ willChange: 'transform' }}>
          {words.map((word, i) => (
            <div
              key={i}
              style={{
                color: 'white',
                fontSize: `${fontSize}px`,
                fontWeight: 'bold',
                height: `${textHeight}px`,
                lineHeight: `${textHeight}px`,
                textAlign: 'right',
                width: `${containerWidth}px`,
              }}
            >
              {word}
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          color: 'white',
          fontSize: `${fontSize}px`,
          fontWeight: 'bold',
          marginLeft: `${marginLeft}px`,
          whiteSpace: 'nowrap',
        }}
      >
        Like a Pro
      </div>
    </div>
  );
};

export default AnimatedCycleText;
