import { VideoHTMLAttributes, forwardRef, useImperativeHandle, useRef } from 'react';
import { VideoSource, useAdaptiveVideo } from '../hooks/useAdaptiveVideo';

// A <video> that plays an Appwrite Videos stream, falling back to the file
// (see hooks/useAdaptiveVideo). Takes every other <video> attribute except src.

interface Props extends Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src'> {
  source: VideoSource;
  /** Private videos: returns an Appwrite JWT for the viewer. */
  jwt?: () => Promise<string>;
  lazy?: boolean;
  onFatal?: () => void;
  maxHeight?: number;
}

const AdaptiveVideo = forwardRef<HTMLVideoElement, Props>(({ source, jwt, lazy, onFatal, maxHeight, ...rest }, ref) => {
  const video = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => video.current as HTMLVideoElement);
  useAdaptiveVideo(video, source, { jwt, lazy, onFatal, maxHeight });
  return <video ref={video} {...rest} />;
});

AdaptiveVideo.displayName = 'AdaptiveVideo';

export default AdaptiveVideo;
