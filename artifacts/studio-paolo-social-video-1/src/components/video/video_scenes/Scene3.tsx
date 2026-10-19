import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';

const EASE = [0.16, 1, 0.3, 1] as const;
const BASE = import.meta.env.BASE_URL;

export function Scene3() {
  const [phase, setPhase] = useState(0);
  useSceneTimer([
    { time: 180, callback: () => setPhase(1) },
    { time: 2150, callback: () => setPhase(2) },
    { time: 3210, callback: () => setPhase(3) },
    { time: 4210, callback: () => setPhase(4) },
  ]);
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      initial={{ clipPath: 'inset(0 0 0 100%)' }}
      animate={{ clipPath: 'inset(0 0 0 0)' }}
      exit={{ scale: 0.94, rotateY: 8, opacity: 0, filter: 'blur(7px)' }}
      transition={{ duration: 0.45, ease: EASE }}
      style={{ perspective: 1100 }}
    >
      <div className="absolute left-[7vw] top-[8vh] font-mono text-[1.5vmin] tracking-[0.22em] text-[#8998ad]">CONVERSAZIONE <span className="text-[#4e9bff]">/ 02 SCAMBI</span></div>
      <motion.h2 className="absolute left-[7vw] top-[15vh] m-0 font-display text-[5.4vmin] font-semibold tracking-[-0.055em] text-[#eaf0f9]" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}>
        Prima si ascolta.
      </motion.h2>
      <div className="absolute inset-x-[7vw] top-[29vh] flex h-[50vh] items-start gap-[2.5vw]">
        <motion.article
          className="relative w-[48vw] rounded-[1vw] border border-[#4e9bff55] bg-[#142542] p-[2vw] shadow-[0_18px_60px_#030a1599]"
          initial={{ opacity: 0, rotateY: -14, rotateX: 6, scale: 0.84, x: -70 }}
          animate={phase >= 1 ? { opacity: 1, rotateY: -2, rotateX: 0, scale: 1, x: 0 } : { opacity: 0, rotateY: -14, rotateX: 6, scale: 0.84, x: -70 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          style={{ transformPerspective: 1000, transformOrigin: 'left center' }}
        >
          <div className="flex items-center gap-[1vw]">
            <img src={`${BASE}images/studio-paolo-marco.png`} alt="Marco Bianchi" className="h-[5vw] w-[5vw] rounded-full border-2 border-[#579fff] object-cover" />
            <div><div className="font-display text-[2.45vmin] font-semibold text-[#edf3fc]">Marco <span className="text-[#8da1ba]">· Supporto</span></div><div className="mt-[0.45vh] font-mono text-[1.2vmin] tracking-[0.08em] text-[#7f94af]">OGGI, 09:21</div></div>
          </div>
          <motion.div className="ml-[6vw] mt-[1.8vh] max-w-[37vw] font-body text-[2.7vmin] leading-[1.38] text-[#e0e9f5]" initial={{ opacity: 0, y: 12 }} animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }} transition={{ duration: 0.45, delay: 0.28, ease: EASE }}>
            Ciao Giulia, verifico subito. Intanto puoi provare una finestra in incognito?
          </motion.div>
          <motion.div className="ml-[6vw] mt-[1.3vh] h-[2px] bg-[#55a2ff]" initial={{ width: 0 }} animate={phase >= 2 ? { width: '15vw' } : { width: 0 }} transition={{ duration: 0.42, ease: EASE }} />
          <div className="absolute right-[1.4vw] top-[1.2vw] font-mono text-[1.15vmin] tracking-[0.16em] text-[#7196c3]">RISPOSTA</div>
        </motion.article>
        <motion.article
          className="relative mt-[9vh] w-[38vw] rounded-[1vw] border border-white/[0.11] bg-[#202c3e] p-[1.8vw]"
          initial={{ opacity: 0, rotateY: 14, rotateX: -5, scale: 0.86, x: 65 }}
          animate={phase >= 2 ? { opacity: 1, rotateY: 0, rotateX: 0, scale: 1, x: 0 } : { opacity: 0, rotateY: 14, rotateX: -5, scale: 0.86, x: 65 }}
          transition={{ type: 'spring', stiffness: 260, damping: 25 }}
          style={{ transformPerspective: 1000, transformOrigin: 'right center' }}
        >
          <div className="flex items-center gap-[0.9vw]">
            <img src={`${BASE}images/studio-paolo-giulia.png`} alt="Giulia Rossi" className="h-[4vw] w-[4vw] rounded-full border-2 border-[#c3cfdf] object-cover" />
            <div><div className="font-display text-[2.15vmin] font-semibold text-[#edf3fc]">Giulia <span className="text-[#9baac0]">· Cliente</span></div><div className="mt-[0.3vh] font-mono text-[1.12vmin] tracking-[0.08em] text-[#8592a6]">OGGI, 09:24</div></div>
          </div>
          <motion.div className="ml-[4.9vw] mt-[1.55vh] max-w-[29vw] font-body text-[2.4vmin] leading-[1.37] text-[#d7e0ed]" initial={{ opacity: 0, y: 12 }} animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }} transition={{ duration: 0.44, delay: 0.24, ease: EASE }}>
            In incognito funziona. Dal browser normale invece resta bloccato.
          </motion.div>
          <motion.div className="absolute bottom-0 left-0 h-[3px] bg-[#e0e7f0]" initial={{ width: 0 }} animate={phase >= 3 ? { width: '100%' } : { width: 0 }} transition={{ duration: 0.45, ease: EASE }} />
        </motion.article>
      </div>
      <motion.div
        className="absolute bottom-[8vh] left-[7vw] flex items-center gap-[1.2vw]"
        initial={{ opacity: 0, x: -20 }}
        animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <motion.div className="h-[1px] bg-[#4e9bff]" initial={{ width: '1vw' }} animate={phase >= 4 ? { width: '15vw' } : { width: '1vw' }} transition={{ duration: 0.55, ease: EASE }} />
        <span className="font-display text-[3.15vmin] font-medium tracking-[-0.035em] text-[#c2d0e2]">Il dettaglio giusto cambia tutto.</span>
      </motion.div>
      <motion.div className="absolute bottom-[8vh] right-[7vw] font-mono text-[1.2vmin] tracking-[0.18em] text-white/40" animate={{ x: phase >= 4 ? '1.5vw' : 0 }}>
        03 / ASCOLTO
      </motion.div>
    </motion.section>
  );
}
