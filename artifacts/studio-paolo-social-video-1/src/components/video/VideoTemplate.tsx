import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  VideoCanvas,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { VideoPausedContext } from '@/lib/video/hooks';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS = {
  hook: 3250,
  ticket: 4250,
  conversation: 5050,
  resolution: 4900,
  close: 4368,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';
const EASE = [0.16, 1, 0.3, 1] as const;
const ACCENT_POSITIONS = [
  { left: '7vw', top: '78vh', width: '24vw' },
  { left: '7vw', top: '18vh', width: '38vw' },
  { left: '55vw', top: '84vh', width: '32vw' },
  { left: '8vw', top: '87vh', width: '84vw' },
  { left: '37vw', top: '62vh', width: '26vw' },
];

const SCENE_COMPONENTS = [Scene1, Scene2, Scene3, Scene4, Scene5];
const SCENE_START_SEC: Record<string, number> = (() => {
  const result: Record<string, number> = {};
  let elapsed = 0;
  for (const [key, duration] of Object.entries(SCENE_DURATIONS)) {
    result[key] = elapsed / 1000;
    elapsed += duration;
  }
  return result;
})();

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
  const { currentScene, currentSceneKey } = useVideoPlayer({
    durations,
    loop,
    paused,
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSceneKeyRef = useRef<string | null>(null);
  const canonicalKey = currentSceneKey.replace(/_r[12]$/, '');
  const CurrentScene = SCENE_COMPONENTS[
    Object.keys(SCENE_DURATIONS).indexOf(canonicalKey)
  ];

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
      const target = SCENE_START_SEC[canonicalKey] ?? 0;
      if (Math.abs(audio.currentTime - target) > 0.18) audio.currentTime = target;
    }
    audio.play().catch(() => {});
  }, [canonicalKey, currentSceneKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas
        aspectRatio={VIDEO_ASPECT_RATIO}
        className="paolo-stage"
        style={{ backgroundColor: 'var(--color-bg-dark)' }}
      >
        <motion.div
          className="paolo-grid"
          initial={false}
          animate={{ backgroundPosition: ['0px 0px', '48px 48px'] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="paolo-glow"
          initial={false}
          animate={{
            x: ['6vw', '48vw', '20vw', '60vw', '31vw'][currentScene],
            y: ['30vh', '-10vh', '39vh', '9vh', '18vh'][currentScene],
          }}
          transition={{ duration: 1.25, ease: EASE }}
        />
        <motion.div
          className="paolo-accent-line"
          initial={false}
          animate={ACCENT_POSITIONS[currentScene]}
          transition={{ duration: 0.85, ease: EASE }}
        />
        <div className="paolo-grain" aria-hidden="true" />
        <AnimatePresence mode="sync">
          {CurrentScene && (
            <CurrentScene key={currentSceneKey} />
          )}
        </AnimatePresence>
        <audio
          ref={audioRef}
          src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
          preload="auto"
          autoPlay
          muted={muted}
        />
      </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
