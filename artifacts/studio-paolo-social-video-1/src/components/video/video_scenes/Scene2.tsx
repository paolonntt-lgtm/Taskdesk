import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';

const EASE = [0.16, 1, 0.3, 1] as const;
const BASE = import.meta.env.BASE_URL;

export function Scene2() {
  const [phase, setPhase] = useState(0);
  useSceneTimer([
    { time: 620, callback: () => setPhase(1) },
    { time: 1420, callback: () => setPhase(2) },
    { time: 3200, callback: () => setPhase(3) },
  ]);
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden px-[7vw] py-[11vh]"
      initial={{ clipPath: 'inset(0 0 100% 0)' }}
      animate={{ clipPath: 'inset(0 0 0 0)' }}
      exit={{ scale: 1.04, rotateY: -8, opacity: 0, x: '-2vw' }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <div className="absolute left-[7vw] top-[8vh] font-mono text-[1.45vmin] tracking-[0.24em] text-[#7f90a7]">RICHIESTA / <span className="text-[#50a1ff]">SUPPORTO</span></div>
      <motion.div
        className="absolute left-[7vw] top-[14vh] h-[69vh] w-[86vw] overflow-hidden rounded-[1.1vw] border border-[#566982]/50 bg-[#111d30] shadow-[0_35px_90px_#020916a8]"
        initial={{ scale: 0.94, y: 35, rotateX: 4, opacity: 0 }}
        animate={{ scale: phase >= 3 ? 1.04 : 1, y: 0, rotateX: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 250, damping: 26, delay: 0.18 }}
        style={{ transformPerspective: 1000 }}
      >
        <div className="flex h-[10vh] items-center justify-between border-b border-white/[0.08] px-[2.2vw]">
          <div className="flex items-center gap-[1vw]">
            <div className="flex h-[3.5vw] w-[3.5vw] items-center justify-center rounded-[0.65vw] bg-[#1e3657] font-mono text-[1.3vmin] tracking-[0.09em] text-[#8ec3ff]">SP</div>
            <div>
              <div className="font-mono text-[1.25vmin] tracking-[0.16em] text-[#7f90a7]">TICKET #SP-1842</div>
              <h2 className="mt-[0.45vh] font-display text-[3.35vmin] font-semibold leading-none tracking-[-0.035em] text-[#edf2f9]">ACCESSO AL PORTALE CLIENTI</h2>
            </div>
          </div>
          <motion.div
            className="flex items-center gap-[0.55vw] rounded-full border border-[#e4a64d55] bg-[#a7651b22] px-[1vw] py-[0.8vh] font-mono text-[1.45vmin] tracking-[0.11em] text-[#f2bd75]"
            animate={phase >= 3 ? { scale: 1.38, x: '1vw', rotate: -3 } : { scale: 1, x: 0, rotate: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <span className="h-[0.48vw] w-[0.48vw] rounded-full bg-[#ecb667]" /> APERTA
          </motion.div>
        </div>
        <div className="grid h-[55vh] grid-cols-[0.78fr_1.4fr_0.75fr]">
          <div className="border-r border-white/[0.08] px-[2vw] py-[3vh]">
            <div className="font-mono text-[1.2vmin] tracking-[0.17em] text-[#74849a]">CLIENTE</div>
            <motion.div
              className="mt-[2vh] flex flex-col items-start"
              initial={{ opacity: 0, x: -18 }}
              animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -18 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <motion.img
                src={`${BASE}images/studio-paolo-giulia.png`}
                alt="Giulia Rossi"
                className="h-[9vw] w-[9vw] rounded-full border-[3px] border-[#4e9bff] object-cover object-center shadow-[0_0_0_0.7vw_#4e9bff14]"
                initial={{ clipPath: 'circle(0% at 50% 50%)', scale: 0.8 }}
                animate={{ clipPath: 'circle(50% at 50% 50%)', scale: 1 }}
                transition={{ duration: 0.58, ease: EASE, delay: 0.2 }}
              />
              <div className="mt-[1.7vh] font-display text-[2.8vmin] font-medium tracking-[-0.025em] text-[#edf2f9]">Giulia Rossi</div>
              <div className="mt-[0.7vh] font-body text-[1.65vmin] text-[#8797ad]">Cliente · oggi, 09:14</div>
            </motion.div>
            <div className="mt-[4vh] flex items-center gap-[0.6vw] border-t border-white/[0.08] pt-[2vh] font-body text-[1.6vmin] text-[#b7c3d3]">
              <span className="h-[0.55vw] w-[0.55vw] rounded-full bg-[#78c5a2]" /> Priorità normale
            </div>
          </div>
          <div className="relative px-[2.4vw] py-[3.1vh]">
            <div className="flex items-center gap-[0.6vw] font-mono text-[1.2vmin] tracking-[0.17em] text-[#74849a]">
              <span className="h-[1px] w-[2.2vw] bg-[#4e9bff]" /> DESCRIZIONE
            </div>
            <motion.p
              className="mt-[2.5vh] max-w-[40vw] font-body text-[3.15vmin] font-medium leading-[1.28] tracking-[-0.025em] text-[#e6edf7]"
              initial={{ opacity: 0, y: 18, clipPath: 'inset(0 0 100% 0)' }}
              animate={phase >= 2 ? { opacity: 1, y: 0, clipPath: 'inset(0 0 0 0)' } : { opacity: 0, y: 18, clipPath: 'inset(0 0 100% 0)' }}
              transition={{ duration: 0.58, ease: EASE }}
            >
              Da stamattina non riesco ad accedere al portale clienti. Dopo la password la pagina resta in caricamento. Ho una fattura da scaricare entro oggi.
            </motion.p>
            <motion.div className="absolute bottom-[3.1vh] left-[2.4vw] right-[2.4vw] flex items-center justify-between border-t border-white/[0.08] pt-[1.7vh]" initial={{ opacity: 0, y: 8 }} animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }} transition={{ duration: 0.4, delay: 0.25 }}>
              <span className="font-mono text-[1.2vmin] tracking-[0.12em] text-[#7d8ca1]">CREATO OGGI · 09:14</span>
              <span className="font-mono text-[1.2vmin] tracking-[0.1em] text-[#aac4e7]">1 MESSAGGIO</span>
            </motion.div>
          </div>
          <div className="border-l border-white/[0.08] px-[1.8vw] py-[3.1vh]">
            <div className="font-mono text-[1.2vmin] tracking-[0.17em] text-[#74849a]">ASSEGNATO A</div>
            <motion.div className="mt-[2vh] flex items-center gap-[0.9vw]" initial={{ opacity: 0, x: 15 }} animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 15 }} transition={{ duration: 0.4, delay: 0.22 }}>
              <img src={`${BASE}images/studio-paolo-marco.png`} alt="Marco Bianchi" className="h-[3.5vw] w-[3.5vw] rounded-full object-cover object-center" />
              <div>
                <div className="font-display text-[1.9vmin] font-medium text-[#e8eef7]">Marco Bianchi</div>
                <div className="mt-[0.35vh] font-body text-[1.25vmin] text-[#7c8ca2]">Supporto</div>
              </div>
            </motion.div>
            <div className="mt-[4vh] h-px w-full bg-white/[0.08]" />
            <div className="mt-[2vh] font-mono text-[1.15vmin] tracking-[0.15em] text-[#75859b]">ULTIMO AGGIORNAMENTO</div>
            <div className="mt-[0.8vh] font-body text-[1.5vmin] text-[#c2cddd]">Oggi, 09:14</div>
          </div>
        </div>
        <motion.div className="absolute bottom-0 left-0 h-[3px] bg-[#4e9bff]" initial={{ width: '10%' }} animate={{ width: phase >= 3 ? '100%' : '38%' }} transition={{ duration: 0.62, ease: EASE }} />
      </motion.div>
      <motion.div className="absolute bottom-[8vh] right-[7vw] font-mono text-[1.25vmin] tracking-[0.2em] text-white/40" animate={{ opacity: phase >= 3 ? 0.9 : 0.48 }}>
        02 / CONTEXTO
      </motion.div>
    </motion.section>
  );
}
