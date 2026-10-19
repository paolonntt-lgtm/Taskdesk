import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
} from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const SCENE_DETAILS: Record<string, { title: string; filePath: string }> = {
  hook: { title: 'Hook', filePath: 'src/components/video/video_scenes/Scene1.tsx' },
  ticket: { title: 'Richiesta', filePath: 'src/components/video/video_scenes/Scene2.tsx' },
  conversation: { title: 'Conversazione', filePath: 'src/components/video/video_scenes/Scene3.tsx' },
  resolution: { title: 'Risoluzione', filePath: 'src/components/video/video_scenes/Scene4.tsx' },
  close: { title: 'Chiusura', filePath: 'src/components/video/video_scenes/Scene5.tsx' },
};

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const [muted, setMuted] = useState(false);
  const {
    sceneKeys,
    activeIndex,
    locked,
    paused,
    mountKey,
    tick,
    durations,
    activeDuration,
    activeStartTime,
    totalDuration,
    onSceneChange,
    jumpTo,
    toggleLock,
    togglePause,
  } = useSceneControls(SCENE_DURATIONS);
  const sensorRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);

  const announceSceneSelection = useCallback((index: number) => {
    const key = sceneKeys[index];
    const detail = SCENE_DETAILS[key];
    if (!detail?.filePath) return;
    window.parent.postMessage({
      type: 'REPLIT_VIDEO_SCENE_SELECTED',
      payload: {
        sceneIndex: index,
        sceneCount: sceneKeys.length,
        sceneTitle: detail.title || key,
        filePath: detail.filePath,
        lineNumber: 1,
      },
    }, '*');
  }, [sceneKeys]);
  const handleJumpTo = useCallback((index: number) => {
    jumpTo(index);
    announceSceneSelection(index);
  }, [announceSceneSelection, jumpTo]);

  useEffect(() => {
    if (!paused) return;
    const frozen = document.getAnimations().filter((animation) => animation.playState === 'running');
    frozen.forEach((animation) => animation.pause());
    return () => frozen.forEach((animation) => animation.play());
  }, [paused]);

  const handlePointerEnter = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(true);
  }, []);
  const handlePointerLeave = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') setHovering(false);
  }, []);
  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && collapsed) setTapPinned(true);
  }, [collapsed]);
  const handleToggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      if (!value) {
        setHovering(false);
        setTapPinned(false);
      }
      return !value;
    });
  }, []);
  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const clearOnOutsideTap = (event: globalThis.PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      if (sensorRef.current && !sensorRef.current.contains(event.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', clearOnOutsideTap);
    return () => document.removeEventListener('pointerdown', clearOnOutsideTap);
  }, [collapsed, tapPinned]);

  if (!isIframed) return <VideoTemplate />;
  const visible = !collapsed || hovering || tapPinned;

  return (
    <div className="relative h-screen w-full">
      <VideoTemplate
        key={mountKey}
        durations={durations}
        loop
        paused={paused}
        muted={muted}
        onSceneChange={onSceneChange}
      />
      <div
        ref={sensorRef}
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end"
        style={{ height: '25%' }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <div className="flex-1 w-full" aria-hidden="true" />
        <div
          className={`flex items-center gap-3 bg-[#101a2acc] px-5 py-3 text-[#edf1fa] backdrop-blur-md transition-all duration-200 ${
            visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'
          }`}
          aria-hidden={!visible}
        >
          <button className="video-control" onClick={togglePause} title={paused ? 'Play' : 'Pause'} aria-label={paused ? 'Play' : 'Pause'}>
            {paused ? <Play /> : <Pause />}
          </button>
          <button className={`video-control ${locked ? 'is-active' : ''}`} onClick={toggleLock} title={locked ? 'Loop current scene: on' : 'Loop current scene: off'} aria-label={locked ? 'Loop current scene: on' : 'Loop current scene: off'} aria-pressed={locked}>
            <Repeat />
          </button>
          <button className="video-control" onClick={() => setMuted((value) => !value)} title={muted ? 'Unmute' : 'Mute'} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
            {muted ? <VolumeX /> : <Volume2 />}
          </button>
          <div className="h-8 w-px shrink-0 bg-white/20" aria-hidden="true" />
          <PlaybackStatus
            sceneKeys={sceneKeys}
            activeIndex={activeIndex}
            activeDuration={activeDuration}
            activeStartTime={activeStartTime}
            totalDuration={totalDuration}
            tick={tick}
            paused={paused}
            onJumpTo={handleJumpTo}
          />
          <button className="video-control" onClick={handleToggleCollapsed} title={collapsed ? 'Show controls' : 'Hide controls'} aria-label={collapsed ? 'Show controls' : 'Hide controls'} aria-expanded={!collapsed}>
            {collapsed ? <ChevronUp className="!h-7 !w-7" /> : <ChevronDown className="!h-7 !w-7" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlaybackStatus({
  sceneKeys,
  activeIndex,
  activeDuration,
  activeStartTime,
  totalDuration,
  tick,
  paused,
  onJumpTo,
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
    const started = performance.now();
    const id = window.setInterval(() => setElapsed(elapsedBaseRef.current + performance.now() - started), 60);
    return () => {
      window.clearInterval(id);
      elapsedBaseRef.current += performance.now() - started;
    };
  }, [tick, paused]);
  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;
  const totalElapsed = Math.min(totalDuration, activeStartTime + Math.min(elapsed, activeDuration));
  return (
    <>
      <div className="flex flex-1 items-center gap-1.5">
        {sceneKeys.map((key, index) => (
          <button key={key} onClick={() => onJumpTo(index)} className="relative h-3 min-h-3 flex-1 cursor-pointer overflow-hidden rounded-full bg-white/20 transition-all hover:h-4" aria-label={`Jump to scene ${index + 1}`} aria-current={index === activeIndex ? 'true' : undefined}>
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/90" style={{ width: `${index === activeIndex ? progress * 100 : 0}%` }} />
          </button>
        ))}
      </div>
      <div className="shrink-0 font-mono text-sm tabular-nums text-white/70">{activeIndex + 1}/{sceneKeys.length}</div>
      <div className="min-w-[9ch] shrink-0 text-right font-mono text-sm tabular-nums text-white/90" role="timer">
        {formatTime(totalElapsed)} / {formatTime(totalDuration)}
      </div>
    </>
  );
}

function formatTime(duration: number) {
  const seconds = Math.max(0, Math.floor(duration / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
