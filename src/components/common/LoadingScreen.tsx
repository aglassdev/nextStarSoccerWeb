import { useEffect, useRef } from 'react';
import lottie, { AnimationItem } from 'lottie-web';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen = ({ }: LoadingScreenProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      animationRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        path: '/assets/animations/loading.json'
      });
    }

    return () => {
      animationRef.current?.destroy();
    };
  }, []);

  return (
    <div className="flex items-center justify-center h-screen overflow-hidden">
      <div ref={containerRef} className="w-16 h-16" />
    </div>
  );
};

export default LoadingScreen;
