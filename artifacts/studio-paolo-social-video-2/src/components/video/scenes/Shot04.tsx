import { motion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;
const giulia = `${import.meta.env.BASE_URL}images/studio-paolo-giulia.png`;

export function Shot04() {
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0, scale: 1.1, rotateX: -4 }}
      animate={{ opacity: 1, scale: 1, rotateX: 0 }}
      exit={{ scale: 1.14, opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: .62, ease }}
      style={{ background: '#dce5ed', color: '#152238', perspective: 1000 }}
    >
      <div className="absolute inset-0 opacity-[.33]" style={{ backgroundImage: 'linear-gradient(rgba(36,64,96,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(36,64,96,.1) 1px,transparent 1px)', backgroundSize: '4.2vw 4.2vw' }} />
      <div className="absolute left-[8%] top-[9%] micro-label text-[#47617e]">TICKET #SP-1916 <span className="text-slate-400">/</span> VERIFICA CLIENTE</div>
      <motion.div
        className="absolute left-[16%] top-[20%] h-[64%] w-[68%] rounded-[1.2vmin] border border-[#aab8c8] bg-[#f1f4f6] p-[3vmin] shadow-[0_3vmin_8vmin_rgba(28,45,67,.18)]"
        initial={{ opacity: 0, y: 36, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ delay: .24, duration: .62, ease }}
        style={{ transformOrigin: 'center top' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="micro-label text-slate-500">ANTEPRIMA AGGIORNATA</div>
            <div className="mt-[.8vh] font-display text-[2.1vmin] font-semibold tracking-[-.025em] text-slate-800">Preventivo · versione 4</div>
          </div>
          <motion.div
            className="flex items-center gap-[.8vmin] rounded-full border border-[#308765]/20 bg-[#71d8b0]/25 px-[1.3vmin] py-[.85vmin] micro-label text-[#246849]"
            initial={{ scale: .65, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ delay: .68, type: 'spring', stiffness: 350, damping: 24 }}
          >
            <span className="h-[.8vmin] w-[.8vmin] rounded-full bg-[#318663]" /> CONFERMATO
          </motion.div>
        </div>
        <div className="absolute left-[9%] right-[9%] top-[25%] flex h-[30%] items-center justify-center border-y border-slate-300/80">
          <motion.div
            className="absolute font-display text-[6.5vmin] font-bold leading-none tracking-[-.085em] text-slate-800"
            initial={{ opacity: .3, x: -20, scale: 1.12 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ delay: .92, duration: .58, ease }}
          >
            STUDIO PAOLO
          </motion.div>
          <motion.div className="absolute h-[1px] w-[62%] bg-[#ee5966]" initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ delay: .82, duration: .42, ease }} />
          <motion.div className="absolute bottom-[23%] h-[.55vmin] w-[63%] rounded-full bg-[#3b82f6]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.25, duration: .58, ease }} style={{ transformOrigin: 'left' }} />
        </div>
        <motion.div
          className="absolute bottom-[8%] left-[7%] right-[7%] flex items-center gap-[1.4vmin] rounded-[.8vmin] border border-[#d1d9e1] bg-white/75 p-[1.5vmin]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.38, duration: .42, ease }}
        >
          <img src={giulia} alt="Giulia Rossi" className="avatar !h-[4.8vmin] !w-[4.8vmin] !border-white" />
          <div className="min-w-0">
            <div className="flex items-center gap-[.8vmin] text-[1.4vmin] text-slate-500"><span className="font-semibold text-slate-700">Giulia Rossi</span> · Cliente · 10:53</div>
            <p className="mt-[.55vh] text-[2vmin] leading-[1.25] text-slate-800">Confermato, ora si vede. Grazie per avermi avvisata.</p>
          </div>
        </motion.div>
      </motion.div>
      <motion.div
        className="absolute bottom-[9%] left-[16%] font-display text-[2.35vmin] font-medium tracking-[-.02em] text-[#415873]"
        initial={{ opacity: 0, clipPath: 'inset(0 0 0 100%)' }}
        animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
        transition={{ delay: 3.5, duration: .48, ease }}
      >
        Seguito fino alla conferma.
      </motion.div>
      <div className="absolute bottom-[9.5%] right-[16%] flex items-center gap-[1vmin] micro-label text-[#47617e]">
        <span>3 COMMENTI</span><span className="h-[.6vmin] w-[.6vmin] rounded-full bg-[#3b82f6]" /><span>1 ALLEGATO</span>
      </div>
    </motion.section>
  );
}
