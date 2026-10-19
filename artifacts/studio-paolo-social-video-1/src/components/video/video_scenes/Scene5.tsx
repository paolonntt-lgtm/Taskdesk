import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';

const EASE = [0.16, 1, 0.3, 1] as const;

export function Scene5() {
  const [phase, setPhase] = useState(0);
  useSceneTimer([
    { time: 250, callback: () => setPhase(1) },
    { time: 750, callback: () => setPhase(2) },
    { time: 1350, callback: () => setPhase(3) },
    { time: 3420, callback: () => setPhase(4) },
  ]);
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden bg-[#e7ebef]"
      initial={{ clipPath: 'circle(0% at 48% 52%)' }}
      animate={{ clipPath: 'circle(110% at 48% 52%)' }}
      exit={{ clipPath: 'circle(0% at 49% 51%)', scale: 0.88, opacity: 0 }}
      transition={{ duration: 0.53, ease: EASE }}
    >
      <motion.div className="absolute left-[7vw] top-[9vh] font-mono text-[1.3vmin] tracking-[0.22em] text-[#66758a]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, delay: 0.15 }}>
        STUDIO PAOLO <span className="text-[#2679d3]">/</span> SUPPORTO
      </motion.div>
      <div className="absolute left-[7vw] top-[22vh]">
        <motion.div
          className="font-display text-[15vmin] font-bold leading-[0.84] tracking-[-0.085em] text-[#172338]"
          initial={{ clipPath: 'inset(0 100% 0 0)', x: -10 }}
          animate={phase >= 1 ? { clipPath: 'inset(0 0 0 0)', x: 0 } : { clipPath: 'inset(0 100% 0 0)', x: -10 }}
          transition={{ duration: 0.72, ease: EASE }}
        >
          STUDIO
        </motion.div>
        <motion.div
          className="mt-[0.6vh] font-display text-[15vmin] font-semibold leading-[0.84] tracking-[-0.085em] text-[#172338]"
          initial={{ clipPath: 'inset(0 0 0 100%)', x: 10 }}
          animate={phase >= 1 ? { clipPath: 'inset(0 0 0 0)', x: 0 } : { clipPath: 'inset(0 0 0 100%)', x: 10 }}
          transition={{ duration: 0.72, ease: EASE, delay: 0.13 }}
        >
          PAOLO.
        </motion.div>
        <motion.div className="mt-[3.3vh] flex items-center gap-[0.75vw] font-display text-[3.35vmin] font-medium tracking-[-0.035em] text-[#45556c]" initial={{ opacity: 0, y: 14 }} animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }} transition={{ duration: 0.45, ease: EASE }}>
          <span className="h-[2px] w-[2.5vw] bg-[#327fd2]" />
          Le richieste non restano in sospeso.
        </motion.div>
        <motion.div className="mt-[1.55vh] ml-[3.25vw] font-body text-[2.45vmin] text-[#66758a]" initial={{ opacity: 0, x: -10 }} animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }} transition={{ duration: 0.42, ease: EASE }}>
          Dalla richiesta alla soluzione.
        </motion.div>
      </div>
      <motion.div
        className="absolute right-[9vw] top-[27vh] flex h-[31vw] w-[31vw] items-center justify-center rounded-full border border-[#b9c3cf] bg-[#dce2e8]"
        initial={{ scale: 0.65, opacity: 0, rotate: -18 }}
        animate={{ scale: phase >= 2 ? 1 : 0.65, opacity: 1, rotate: phase >= 4 ? 37 : 0 }}
        transition={{ duration: 0.85, ease: EASE }}
      >
        <motion.div className="flex h-[52%] w-[52%] items-center justify-center rounded-[1vw] border border-[#3d83ca] bg-[#172a44] shadow-[0_18px_45px_#12243c55]" initial={{ rotate: 45, scale: 0.35 }} animate={{ rotate: phase >= 3 ? 0 : 45, scale: 1 }} transition={{ type: 'spring', stiffness: 270, damping: 22 }}>
          <div className="relative h-[42%] w-[42%] rounded-full border-[2px] border-[#8dbbf0]">
            <motion.div className="absolute left-1/2 top-[15%] h-[55%] w-[2px] origin-bottom bg-[#79aff0]" initial={{ rotate: -90 }} animate={{ rotate: phase >= 4 ? 270 : 0 }} transition={{ duration: 0.65, ease: EASE }} />
            <div className="absolute left-1/2 top-1/2 h-[0.7vw] w-[0.7vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e2edf8]" />
          </div>
        </motion.div>
      </motion.div>
      <motion.div className="absolute bottom-[12vh] left-[7vw] h-[3px] bg-[#317fd2]" initial={{ width: 0 }} animate={{ width: phase >= 3 ? '53vw' : '0vw', x: phase >= 4 ? '-56vw' : '0vw' }} transition={{ duration: 0.62, ease: EASE }} />
      <motion.div className="absolute bottom-[8vh] right-[7vw] font-mono text-[1.15vmin] tracking-[0.18em] text-[#758298]" animate={{ opacity: phase >= 4 ? 0.15 : 0.8 }}>UNA CONVERSAZIONE ALLA VOLTA</motion.div>
    </motion.section>
  );
}
