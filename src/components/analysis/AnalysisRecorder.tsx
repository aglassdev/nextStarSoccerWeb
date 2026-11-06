import { useEffect, useRef, useState } from 'react';
import { Permission, Role } from 'appwrite';
import { formatTimestamp, uploadToFilmBucket } from '../../services/videoAnalysis';

// The coach's video breakdown: record the screen (this tab, with the film and
// annotations) plus the microphone right here, or upload a recording made
// elsewhere. Saved into the film bucket, visible to coaches and admins until
// the analysis is completed, when the family gets access too.

const pickMimeType = () => {
  const options = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return options.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';
};

const staffOnly = [
  Permission.read(Role.label('coach')),
  Permission.update(Role.label('coach')),
  Permission.delete(Role.label('coach')),
];

interface Props {
  /** Signed link to the saved recording, if there is one. */
  existingUrl?: string;
  disabled?: boolean;
  onSaved: (fileId: string) => Promise<void>;
}

const AnalysisRecorder = ({ existingUrl, disabled, onSaved }: Props) => {
  const [state, setState] = useState<'idle' | 'recording' | 'recorded' | 'uploading'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stopTracks = () => {
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current = [];
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  };

  useEffect(() => () => { stopTracks(); if (preview) URL.revokeObjectURL(preview); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state !== 'recording') return;
    const started = Date.now();
    const id = window.setInterval(() => setElapsed((Date.now() - started) / 1000), 500);
    return () => clearInterval(id);
  }, [state]);

  const start = async () => {
    setError('');
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser can’t record the screen. Use Chrome, Edge or Safari on a computer, or upload a recording instead.');
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
        // Offer this tab first, so the film and annotations are what's recorded.
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
      } as any);
      streamsRef.current.push(display);
      let mic: MediaStream | null = null;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        streamsRef.current.push(mic);
      } catch {
        setError('No microphone access, so the recording will have no voice. Allow the microphone and record again to talk over it.');
      }

      // Mix the microphone with any tab audio into one track.
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();
      for (const s of [display, mic]) {
        if (s && s.getAudioTracks().length) ctx.createMediaStreamSource(s).connect(dest);
      }
      const tracks = [...display.getVideoTracks(), ...dest.stream.getAudioTracks()];
      const combined = new MediaStream(tracks);

      const mimeType = pickMimeType();
      const rec = new MediaRecorder(combined, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 4_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stopTracks();
        const out = new Blob(chunks, { type: rec.mimeType || mimeType || 'video/webm' });
        setBlob(out);
        setPreview(URL.createObjectURL(out));
        setState('recorded');
      };
      // Stopping the share from the browser's own bar ends the recording too.
      display.getVideoTracks()[0]?.addEventListener('ended', () => { if (rec.state !== 'inactive') rec.stop(); });
      recorderRef.current = rec;
      rec.start(1000);
      setElapsed(0);
      setState('recording');
    } catch (e: any) {
      stopTracks();
      if (e?.name !== 'NotAllowedError') setError(e?.message || 'Could not start recording.');
    }
  };

  const stop = () => recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop();

  const discard = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview('');
    setBlob(null);
    setState('idle');
  };

  const save = async (file: File) => {
    setError('');
    setState('uploading');
    setProgress(0);
    try {
      const uploaded = await uploadToFilmBucket(file, setProgress, staffOnly);
      await onSaved(uploaded.$id);
      discard();
    } catch (e: any) {
      setError(e?.message || 'The upload failed. Try again.');
      setState(blob ? 'recorded' : 'idle');
    }
  };

  const saveRecording = () => {
    if (!blob) return;
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    save(new File([blob], `analysis-recording.${ext}`, { type: blob.type }));
  };

  return (
    <div className="space-y-3">
      {existingUrl && state === 'idle' && (
        <div className="bg-black border border-white/10 rounded-xl overflow-hidden">
          <video src={existingUrl} controls playsInline preload="metadata" className="w-full max-h-72 bg-black" />
        </div>
      )}

      {state === 'recording' && (
        <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <span className="flex items-center gap-2 text-red-300 text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            Recording {formatTimestamp(elapsed)}
          </span>
          <button onClick={stop} className="px-4 py-1.5 bg-white text-black text-sm font-semibold rounded-lg">Stop</button>
        </div>
      )}

      {state === 'recorded' && preview && (
        <div className="space-y-2">
          <div className="bg-black border border-white/10 rounded-xl overflow-hidden">
            <video src={preview} controls playsInline className="w-full max-h-72 bg-black" />
          </div>
          <div className="flex gap-2">
            <button onClick={discard} className="flex-1 py-2 text-sm text-gray-300 border border-white/15 rounded-lg hover:border-white/30">Discard</button>
            <button onClick={saveRecording} className="flex-1 py-2 text-sm bg-white text-black font-semibold rounded-lg hover:bg-gray-200">Save recording</button>
          </div>
        </div>
      )}

      {state === 'uploading' && (
        <div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-white transition-[width] duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="text-gray-400 text-xs mt-2">Saving {Math.round(progress * 100)}%…</p>
        </div>
      )}

      {state === 'idle' && (
        <div className="flex gap-2">
          <button onClick={start} disabled={disabled}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2 text-sm bg-white text-black font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-40">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {existingUrl ? 'Record again' : 'Record breakdown'}
          </button>
          <label className={`flex-1 py-2 text-sm text-center text-gray-300 border border-white/15 rounded-lg hover:border-white/30 cursor-pointer ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
            Upload a recording
            <input type="file" accept="video/*,.mp4,.mov,.webm" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) save(f); e.target.value = ''; }} />
          </label>
        </div>
      )}
      {state === 'idle' && (
        <p className="text-gray-600 text-xs">
          Recording captures this tab (the film and your annotations) and your microphone. Talk through the game as you play it.
        </p>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
};

export default AnalysisRecorder;
