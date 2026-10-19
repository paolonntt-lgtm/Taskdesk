import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  VideoCanvas,
  type VideoAspectRatio,
  VideoPausedContext,
  useVideoPlayer,
} from '@/lib/video';
import { Shot01 } from './scenes/Shot01';
import { Shot02 } from './scenes/Shot02';
import { Shot03 } from './scenes/Shot03';
import { Shot04 } from './scenes/Shot04';
import { Shot05 } from './scenes/Shot05';

export const SCENE_DURATIONS = {
  hook: 3250,
  request: 4300,
  reply: 4900,
  confirmed: 5000,
  close: 4368,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';
const SCENE_START_SEC: Record<string, number> = (() => {
  const result: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, duration] of Object.entries(SCENE_DURATIONS)) {
    result[key] = cumulativeMs / 1000;
    cumulativeMs += duration;
  }
  return result;
})();
const SCENE_COMPONENTS = {
  hook: Shot01,
  request: Shot02,
  reply: Shot03,
  confirmed: Shot04,
  close: Shot05,
};
const SCENE_KEYS = Object.keys(SCENE_DURATIONS);

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSceneKeyRef = useRef<string | null>(null);
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = SCENE_KEYS.indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey as keyof typeof SCENE_COMPONENTS];

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    if (paused) {
      audio.pause();
      return;
    }
    if (lastSceneKeyRef.current !== currentSceneKey) {
      lastSceneKeyRef.current = currentSceneKey;
      const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
      if (Math.abs(audio.currentTime - targetTime) > 0.18) audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [baseSceneKey, currentSceneKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas
        aspectRatio={VIDEO_ASPECT_RATIO}
        className="relative h-screen w-full overflow-hidden"
        style={{ backgroundColor: '#0b1220', fontFamily: 'var(--font-body)' }}
      >
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={false}
          animate={{ backgroundPosition: `${sceneIndex * 1.8}vw ${sceneIndex * 1.2}vw` }}
          transition={{ duration: 4.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            backgroundImage: 'linear-gradient(rgba(148,163,184,.075) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.075) 1px,transparent 1px)',
            backgroundSize: '4.2vw 4.2vw',
          }}
        />
        <motion.div
          className="pointer-events-none absolute h-[46vw] w-[46vw] rounded-full"
          initial={false}
          animate={{
            x: ['2vw', '50vw', '16vw', '43vw', '23vw'][sceneIndex] ?? '10vw',
            y: ['25vh', '-11vh', '23vh', '13vh', '8vh'][sceneIndex] ?? '12vh',
            opacity: [0.65, 0.48, 0.55, 0.25, 0.12][sceneIndex] ?? 0.2,
          }}
          transition={{ duration: 2.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,.2), transparent 68%)', filter: 'blur(14px)' }}
        />
        <motion.div
          className="absolute z-30 h-[2px] bg-[#3b82f6]"
          initial={false}
          animate={[
            { left: '6vw', top: '13vh', width: '17vw' },
            { left: '7vw', top: '11vh', width: '86vw' },
            { left: '8vw', top: '16vh', width: '84vw' },
            { left: '16vw', top: '19vh', width: '68vw' },
            { left: '60vw', top: '19vh', width: '22vw' },
          ][sceneIndex] ?? { left: '8vw', top: '12vh', width: '40vw' }}
          transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
        />
        <AnimatePresence mode="sync" initial={false}>
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
        <audio
          ref={audioRef}
          src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
          preload="auto"
          autoPlay
          muted={muted}
          aria-hidden="true"
        />
        <span className="sr-only" aria-hidden="true">{currentScene}</span>
      </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
