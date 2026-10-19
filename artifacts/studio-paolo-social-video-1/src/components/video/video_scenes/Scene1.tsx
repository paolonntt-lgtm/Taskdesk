import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';

const EASE = [0.16, 1, 0.3, 1] as const;

export function Scene1() {
  const [phase, setPhase] = useState(0);
  useSceneTimer([
    { time: 1300, callback: () => setPhase(1) },
    { time: 1650, callback: () => setPhase(2) },
    { time: 2750, callback: () => setPhase(3) },
  ]);

  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      initial={{ clipPath: 'inset(0 100% 0 0)' }}
      animate={{ clipPath: 'inset(0 0 0 0)' }}
      exit={{ scale: 1.12, x: '3vw', opacity: 0, filter: 'blur(8px)' }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <motion.div
        className="absolute left-[7vw] top-[13vh] font-mono text-[1.8vmin] tracking-[0.3em] text-[#55a2ff]"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.12 }}
      >
        STUDIO PAOLO <span className="text-white/35">/</span> SUPPORTO
      </motion.div>
      <motion.div
        className="absolute left-[6vw] top-[26vh] flex items-baseline gap-[1.2vw]"
        animate={{ x: phase >= 3 ? '-2vw' : 0, scale: phase >= 3 ? 1.04 : 1 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <motion.h1
          className="m-0 font-display text-[31vmin] font-bold leading-[0.78] tracking-[-0.09em] text-[#ecf2fb]"
          initial={{ scale: 0.65, rotate: -5, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.08 }}
        >
          NON
        </motion.h1>
        <motion.span
          className="absolute left-[21vw] top-[20vh] whitespace-nowrap font-display text-[14vmin] font-medium leading-none tracking-[-0.07em] text-[#4e9bff]"
          initial={{ clipPath: 'inset(100% 0 0 0)', y: 20 }}
          animate={{ clipPath: 'inset(0 0 0 0)', y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.48 }}
        >
          SI APRE.
        </motion.span>
      </motion.div>
      <motion.p
        className="absolute left-[7vw] top-[68vh] m-0 max-w-[41vw] font-body text-[3.2vmin] leading-[1.18] text-[#aab8cb]"
        initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
        animate={phase >= 1 ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
        transition={{ duration: 0.48, ease: EASE }}
      >
        Un accesso bloccato. Una persona<br />che risponde.
      </motion.p>
      <motion.div
        className="absolute right-[7vw] top-[32vh] w-[31vw] overflow-hidden rounded-[1.2vw] border border-[#7184a033] bg-[#121d30] p-[1.8vw] shadow-[0_30px_100px_#030a16aa]"
        initial={{ opacity: 0, scale: 0.72, rotate: 5, x: 35 }}
        animate={{ opacity: 1, scale: phase >= 3 ? 1.1 : 1, rotate: 0, x: 0 }}
        transition={{ type: 'spring', stiffness: 250, damping: 24, delay: 0.52 }}
      >
        <div className="mb-[1.25vw] flex items-center gap-[0.45vw]">
          {['#e68184', '#e5c275', '#70b896'].map((color) => <i key={color} className="h-[0.48vw] w-[0.48vw] rounded-full" style={{ backgroundColor: color }} />)}
          <span className="ml-[0.6vw] font-mono text-[1.2vmin] tracking-[0.13em] text-[#7f90a7]">PORTALE CLIENTI</span>
        </div>
        <div className="flex h-[10vh] items-center justify-center rounded-[0.6vw] bg-[#0a1323]">
          <motion.div
            className="h-[2.2vw] w-[2.2vw] rounded-full border-[2px] border-[#334661] border-t-[#4e9bff]"
            animate={phase >= 2 ? { rotate: [0, 150, 150] } : { rotate: 360 }}
            transition={phase >= 2 ? { duration: 0.4, ease: 'circOut' } : { duration: 1.3, repeat: Infinity, ease: 'linear' }}
          />
          <motion.span
            className="ml-[1.2vw] max-w-[20vw] font-body text-[1.65vmin] leading-snug text-[#c4cede]"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.85 }}
          >
            La pagina resta in caricamento
          </motion.span>
        </div>
        <div className="mt-[1.2vw] flex items-center justify-between font-mono text-[1.15vmin] tracking-[0.08em] text-[#728198]">
          <span>SESS. 09:14:03</span><span className="text-[#eb8c8b]">● BLOCCATO</span>
        </div>
      </motion.div>
      <motion.div className="absolute left-[7vw] top-[83vh] h-[2px] bg-[#4e9bff]" initial={{ width: 0 }} animate={{ width: phase >= 2 ? '23vw' : '7vw' }} transition={{ duration: 0.4, ease: EASE }} />
      <motion.span className="absolute right-[7vw] bottom-[10vh] font-mono text-[1.2vmin] tracking-[0.18em] text-white/35" animate={{ x: phase >= 3 ? '2vw' : 0, opacity: phase >= 3 ? 0.9 : 0.45 }}>
        01 / IL PROBLEMA
      </motion.span>
    </motion.section>
  );
}
