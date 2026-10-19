/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const SCENE_DETAILS: Record<string, { title: string; filePath: string }> = {
  hook: { title: 'Il problema', filePath: 'src/components/video/scenes/Shot01.tsx' },
  request: { title: 'La richiesta', filePath: 'src/components/video/scenes/Shot02.tsx' },
  reply: { title: 'La conversazione', filePath: 'src/components/video/scenes/Shot03.tsx' },
  confirmed: { title: 'La conferma', filePath: 'src/components/video/scenes/Shot04.tsx' },
  close: { title: 'Studio Paolo', filePath: 'src/components/video/scenes/Shot05.tsx' },
};

function formatPlaybackTime(durationMs: number): string {
  const seconds = Math.max(0, Math.floor(durationMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function PlaybackStatus({
  sceneKeys, activeIndex, activeDuration, activeStartTime, totalDuration, tick, paused, onJumpTo,
}: {
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  paused: boolean;
  onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedBaseRef = useRef(0);
  useEffect(() => {
    setElapsed(0);
    elapsedBaseRef.current = 0;
  }, [tick]);
  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const timer = window.setInterval(() => {
      setElapsed(elapsedBaseRef.current + performance.now() - start);
    }, 60);
    return () => {
      window.clearInterval(timer);
      elapsedBaseRef.current += performance.now() - start;
    };
  }, [tick, paused]);
  const progress = activeDuration ? Math.min(1, elapsed / activeDuration) : 0;
  const currentTime = Math.min(totalDuration, activeStartTime + Math.min(elapsed, activeDuration));
  return (
    <>
      <div className="flex flex-1 items-center gap-1.5">
        {sceneKeys.map((key, index) => (
          <button
            key={key}
            onClick={() => onJumpTo(index)}
            aria-label={`Vai alla scena ${index + 1}`}
            aria-current={index === activeIndex ? 'true' : undefined}
            className="relative h-3 min-h-3 flex-1 cursor-pointer overflow-hidden rounded-full bg-white/20 transition-all hover:h-4"
          >
            <span className="absolute inset-y-0 left-0 rounded-full bg-[#87b2ff]" style={{ width: `${index < activeIndex ? 100 : index === activeIndex ? progress * 100 : 0}%` }} />
          </button>
        ))}
      </div>
      <div className="shrink-0 font-mono text-xl tabular-nums text-white/70">{activeIndex + 1}/{sceneKeys.length}</div>
      <div className="min-w-[11ch] shrink-0 text-right font-mono text-xl tabular-nums text-white/80" role="timer">
        {formatPlaybackTime(currentTime)} / {formatPlaybackTime(totalDuration)}
      </div>
    </>
  );
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const [muted, setMuted] = useState(false);
  const sensorRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);
  const {
    sceneKeys, activeIndex, locked, paused, mountKey, tick, durations,
    activeDuration, activeStartTime, totalDuration, onSceneChange, jumpTo, toggleLock, togglePause,
  } = useSceneControls(SCENE_DURATIONS);

  const handleJumpTo = useCallback((index: number) => {
    jumpTo(index);
    const details = SCENE_DETAILS[sceneKeys[index]];
    if (!details?.filePath) return;
    window.parent.postMessage({
      type: 'REPLIT_VIDEO_SCENE_SELECTED',
      payload: { sceneIndex: index, sceneCount: sceneKeys.length, sceneTitle: details.title, filePath: details.filePath, lineNumber: 1 },
    }, '*');
  }, [jumpTo, sceneKeys]);

  useEffect(() => {
    if (!paused) return;
    const runningAnimations = document.getAnimations().filter((animation) => animation.playState === 'running');
    runningAnimations.forEach((animation) => animation.pause());
    return () => runningAnimations.forEach((animation) => animation.play());
  }, [paused]);

  const handlePointerEnter = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(true);
  }, []);
  const handlePointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(false);
  }, []);
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && collapsed) setTapPinned(true);
  }, [collapsed]);
  const handleToggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      if (!value) { setHovering(false); setTapPinned(false); }
      return !value;
    });
  }, []);
  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const dismiss = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && sensorRef.current && !sensorRef.current.contains(event.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [collapsed, tapPinned]);

  if (!isIframed) return <VideoTemplate />;
  const visible = !collapsed || hovering || tapPinned;
  return (
    <div className="relative h-screen w-full">
      <VideoTemplate key={mountKey} durations={durations} loop paused={paused} muted={muted} onSceneChange={onSceneChange} />
      <div
        ref={sensorRef}
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end"
        style={{ height: '25%' }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <div className="w-full flex-1" aria-hidden="true" />
        <div className={`flex items-center gap-3 bg-[#070b13]/80 px-5 py-3 backdrop-blur-md transition-all duration-200 ease-out ${visible ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'}`} aria-hidden={!visible}>
          <button onClick={togglePause} title={paused ? 'Riproduci' : 'Pausa'} aria-label={paused ? 'Riproduci' : 'Pausa'} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">
            {paused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
          </button>
          <button onClick={toggleLock} title={locked ? 'Ripeti scena: attivo' : 'Ripeti scena: inattivo'} aria-label={locked ? 'Ripeti scena: attivo' : 'Ripeti scena: inattivo'} aria-pressed={locked} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${locked ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}>
            <Repeat className="h-6 w-6" />
          </button>
          <button onClick={() => setMuted((value) => !value)} title={muted ? 'Attiva audio' : 'Disattiva audio'} aria-label={muted ? 'Attiva audio' : 'Disattiva audio'} aria-pressed={muted} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">
            {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
          </button>
          <div className="h-8 w-px shrink-0 bg-white/15" />
          <PlaybackStatus sceneKeys={sceneKeys} activeIndex={activeIndex} activeDuration={activeDuration} activeStartTime={activeStartTime} totalDuration={totalDuration} tick={tick} paused={paused} onJumpTo={handleJumpTo} />
          <button onClick={handleToggleCollapsed} title={collapsed ? 'Mostra controlli' : 'Nascondi controlli'} aria-label={collapsed ? 'Mostra controlli' : 'Nascondi controlli'} aria-expanded={!collapsed} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white/65 hover:bg-white/10 hover:text-white">
            {collapsed ? <ChevronUp className="h-7 w-7" /> : <ChevronDown className="h-7 w-7" />}
          </button>
        </div>
      </div>
    </div>
  );
}
