import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';

const EASE = [0.16, 1, 0.3, 1] as const;
const BASE = import.meta.env.BASE_URL;

export function Scene4() {
  const [phase, setPhase] = useState(0);
  useSceneTimer([
    { time: 300, callback: () => setPhase(1) },
    { time: 500, callback: () => setPhase(2) },
    { time: 2150, callback: () => setPhase(3) },
    { time: 3200, callback: () => setPhase(4) },
    { time: 3900, callback: () => setPhase(5) },
  ]);
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      initial={{ clipPath: 'circle(0% at 48% 52%)' }}
      animate={{ clipPath: 'circle(110% at 48% 52%)' }}
      exit={{ scale: 1.07, opacity: 0, filter: 'blur(8px)' }}
      transition={{ duration: 0.58, ease: EASE }}
    >
      <motion.div className="absolute left-[15vw] top-[18vh] font-display text-[22vmin] font-bold leading-[0.8] tracking-[-0.09em] text-transparent" style={{ WebkitTextStroke: '1px #52647e' }} initial={{ opacity: 0, scale: 0.84 }} animate={{ opacity: phase >= 1 ? 0.5 : 0.18, scale: phase >= 3 ? 1.05 : 1 }} transition={{ duration: 0.6, ease: EASE }}>
        RISOLTA
      </motion.div>
      <div className="absolute left-[7vw] top-[11vh] font-mono text-[1.4vmin] tracking-[0.2em] text-[#8797ad]">AGGIORNAMENTO TICKET <span className="text-[#4e9bff]">· #SP-1842</span></div>
      <motion.div
        className="absolute left-[21vw] top-[17vh] w-[58vw] overflow-hidden rounded-[1vw] border border-[#62758f66] bg-[#101d31] shadow-[0_35px_95px_#020914c7]"
        initial={{ opacity: 0, y: 40, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: phase >= 5 ? 1.28 : 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 25 }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.09] px-[2vw] py-[1.7vh]">
          <div className="font-mono text-[1.25vmin] tracking-[0.15em] text-[#92a1b6]">PORTALE CLIENTI <span className="text-white/30">/</span> #SP-1842</div>
          <motion.div className="relative flex items-center gap-[0.65vw] rounded-full bg-[#1c815b33] px-[1vw] py-[0.7vh] font-mono text-[1.35vmin] tracking-[0.1em] text-[#8de0bd]" initial={{ scale: 0.6, opacity: 0 }} animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }} transition={{ type: 'spring', stiffness: 390, damping: 23 }}>
            <motion.span className="h-[0.6vw] w-[0.6vw] rounded-full border border-[#8de0bd]" animate={phase >= 1 ? { scale: [0.6, 1.5, 1], backgroundColor: ['#193c36', '#8de0bd', '#3cb281'] } : {}} transition={{ duration: 0.55, ease: EASE }} />
            RISOLTA
          </motion.div>
        </div>
        <div className="grid grid-cols-[1.12fr_0.88fr] gap-[2vw] px-[2vw] py-[2.3vh]">
          <div>
            <motion.div className="font-display text-[4.2vmin] font-semibold leading-[0.98] tracking-[-0.055em] text-[#eef3fb]" initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }} animate={phase >= 2 ? { opacity: 1, clipPath: 'inset(0 0 0 0)' } : { opacity: 0, clipPath: 'inset(0 100% 0 0)' }} transition={{ duration: 0.52, ease: EASE }}>
              Era la cache<br />del browser.
            </motion.div>
            <motion.p className="mt-[1.35vh] m-0 font-body text-[2.25vmin] leading-snug text-[#aebbd0]" initial={{ opacity: 0, y: 12 }} animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }} transition={{ duration: 0.45, delay: 0.15, ease: EASE }}>
              Svuotata. Accesso ripristinato.
            </motion.p>
            <motion.div className="mt-[2vh] flex items-center gap-[0.8vw] border-t border-white/[0.1] pt-[1.35vh]" initial={{ opacity: 0, y: 9 }} animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 9 }} transition={{ duration: 0.38, ease: EASE }}>
              <img src={`${BASE}images/studio-paolo-giulia.png`} alt="Giulia Rossi" className="h-[3.4vw] w-[3.4vw] rounded-full object-cover" />
              <div className="font-body text-[1.85vmin] text-[#dae3f0]"><span className="font-semibold text-[#f1f4f8]">Giulia ·</span> Perfetto, ora entra. Grazie!</div>
            </motion.div>
          </div>
          <div className="relative flex items-center justify-center overflow-hidden rounded-[0.7vw] bg-[#0a1527]">
            <motion.div className="absolute inset-x-[12%] top-[18%] h-[64%] rounded-[0.35vw] border border-[#344863] bg-[#111f33]" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: phase >= 1 ? 1 : 0.92, opacity: phase >= 1 ? 1 : 0 }} transition={{ duration: 0.4, ease: EASE }}>
              <div className="flex h-[27%] items-center gap-[0.35vw] border-b border-white/[0.09] px-[0.7vw]">
                {['#ea8883', '#efbe75', '#78c19b'].map((color) => <i key={color} className="h-[0.38vw] w-[0.38vw] rounded-full" style={{ backgroundColor: color }} />)}
                <span className="ml-[0.4vw] font-mono text-[0.95vmin] text-[#7f91a8]">CLIENTI / LOGIN</span>
              </div>
              <div className="space-y-[0.7vh] px-[1vw] py-[1.3vh]">
                <div className="h-[0.55vh] w-[74%] rounded-full bg-[#3d5676]" />
                <motion.div className="h-[0.55vh] rounded-full bg-[#4e9bff]" initial={{ width: '18%' }} animate={phase >= 2 ? { width: ['18%', '88%', '66%'] } : { width: '18%' }} transition={{ duration: 0.8, ease: EASE }} />
                <div className="h-[0.55vh] w-[54%] rounded-full bg-[#263952]" />
                <motion.div className="mt-[1vh] h-[1.7vh] w-[40%] rounded-[0.25vw] bg-[#204e78]" animate={phase >= 3 ? { scale: [1, 1.07, 1], backgroundColor: ['#204e78', '#55ad89', '#298968'] } : {}} transition={{ duration: 0.5, ease: EASE }} />
              </div>
            </motion.div>
            <motion.div className="absolute right-[9%] top-[13%] flex h-[3.1vw] w-[3.1vw] items-center justify-center rounded-full border border-[#7ddeb8] bg-[#17392f] font-mono text-[1.7vmin] text-[#9ce8c8]" initial={{ scale: 0, opacity: 0 }} animate={phase >= 3 ? { scale: [0, 1.22, 1], opacity: 1 } : { scale: 0, opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}>✓</motion.div>
            <div className="absolute bottom-[7%] left-[8%] font-mono text-[1.1vmin] tracking-[0.13em] text-[#687c96]">SESSIONE RIPRISTINATA</div>
          </div>
        </div>
      </motion.div>
      <motion.div className="absolute bottom-[10vh] left-[21vw] font-display text-[3vmin] font-medium tracking-[-0.025em] text-[#cbd6e5]" initial={{ opacity: 0, y: 10 }} animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }} transition={{ duration: 0.42, ease: EASE }}>
        Il problema seguito fino alla fine.
      </motion.div>
      <motion.div className="absolute bottom-[10vh] right-[7vw] font-mono text-[1.2vmin] tracking-[0.18em] text-white/40">04 / RISOLUZIONE</motion.div>
    </motion.section>
  );
}
