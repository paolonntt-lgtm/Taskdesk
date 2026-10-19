import { motion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;
const giulia = `${import.meta.env.BASE_URL}images/studio-paolo-giulia.png`;
const marco = `${import.meta.env.BASE_URL}images/studio-paolo-marco.png`;

export function Shot05() {
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0, clipPath: 'inset(50% 0 50% 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0% 0 0% 0)' }}
      exit={{ opacity: 0, clipPath: 'inset(50% 0 50% 0)' }}
      transition={{ duration: .55, ease }}
      style={{ background: '#e9edf1', color: '#0b1220' }}
    >
      <div className="absolute left-[7%] top-[12%] h-px w-[86%] bg-slate-400/35" />
      <div className="absolute bottom-[12%] left-[7%] h-px w-[86%] bg-slate-400/35" />
      <motion.div
        className="absolute left-[11%] top-[22%] h-[42vmin] w-[42vmin] border-[.8vmin] border-[#17273b] bg-[#3b82f6]"
        initial={{ rotate: 45, scale: .35, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        transition={{ delay: .22, duration: .78, ease }}
      >
        <motion.div
          className="absolute inset-[16%] border border-white/75"
          initial={{ rotate: -45, scale: .72 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ delay: .45, duration: .68, ease }}
        />
        <motion.div
          className="absolute left-[35%] top-[35%] h-[30%] w-[30%] bg-[#e9edf1]"
          initial={{ rotate: 45, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ delay: .72, type: 'spring', stiffness: 310, damping: 24 }}
        />
      </motion.div>
      <div className="absolute left-[60%] top-[24%] w-[34%]">
        <motion.div
          className="micro-label text-[#3b82f6]"
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: .4, duration: .38, ease }}
        >
          SUPPORTO · OGNI PASSAGGIO, IN CHIARO
        </motion.div>
        <motion.h2
          className="mt-[2.3vh] font-display text-[8.2vmin] font-bold leading-[.88] tracking-[-.075em] text-[#0b1220]"
          initial={{ opacity: 0, y: 44, clipPath: 'inset(100% 0 0 0)' }}
          animate={{ opacity: 1, y: 0, clipPath: 'inset(0% 0 0 0)' }}
          transition={{ delay: .56, duration: .7, ease }}
        >
          STUDIO
          <br />
          PAOLO
        </motion.h2>
        <motion.p
          className="mt-[2.5vh] max-w-[30vw] font-display text-[3vmin] leading-[1.14] tracking-[-.025em] text-[#415166]"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.18, duration: .42, ease }}
        >
          Ogni risposta porta il lavoro avanti.
        </motion.p>
        <motion.div
          className="mt-[2.8vh] h-[.55vmin] w-[18vw] rounded-full bg-[#3b82f6]"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: [0, 1, 1, 1], rotate: [0, 0, 90, 90], x: [0, 0, 0, '-55vw'], opacity: [1, 1, 1, 0] }}
          transition={{ delay: 1.5, duration: 2.7, times: [0, .34, .78, 1], ease }}
          style={{ transformOrigin: 'left center' }}
        />
        <motion.div className="mt-[2.2vh] micro-label text-slate-500" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.02, duration: .35 }}>
          DALLA RICHIESTA ALLA CONFERMA.
        </motion.div>
      </div>
      <motion.div className="absolute bottom-[15%] left-[13%] flex items-center gap-[1vmin]" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.15, duration: .34 }}>
        <img src={giulia} alt="" className="h-[4.2vmin] w-[4.2vmin] rounded-full border-2 border-[#e9edf1] object-cover" />
        <img src={marco} alt="" className="-ml-[1.6vmin] h-[4.2vmin] w-[4.2vmin] rounded-full border-2 border-[#e9edf1] object-cover" />
        <span className="ml-[.7vmin] micro-label text-slate-600">UNA CONVERSAZIONE. FINO ALLA FINE.</span>
      </motion.div>
      <motion.div className="absolute right-[7%] top-[12%] h-[1.4vmin] w-[1.4vmin] bg-[#3b82f6]" initial={{ scale: 0 }} animate={{ scale: [0, 1, 1, 0] }} transition={{ delay: .45, duration: 3.8, times: [0, .2, .8, 1], ease }} />
    </motion.section>
  );
}
