import { motion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;
const giulia = `${import.meta.env.BASE_URL}images/studio-paolo-giulia.png`;

export function Shot02() {
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0, scale: 1.16, clipPath: 'inset(13% 12% 13% 12% round 2vmin)' }}
      animate={{ opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0% round 0vmin)' }}
      exit={{ x: -36, opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
      transition={{ duration: 0.62, ease }}
      style={{ background: '#0d1728' }}
    >
      <motion.div
        className="absolute left-[7%] top-[11%] h-[2px] bg-[#3b82f6]"
        initial={{ width: '0vw' }}
        animate={{ width: '86vw' }}
        transition={{ delay: 0.2, duration: 0.62, ease }}
      />
      <div className="absolute left-[7%] top-[15%] w-[51%]">
        <div className="flex items-center justify-between">
          <span className="micro-label text-[#81adff]">TICKET #SP-1916</span>
          <span className="rounded-full border border-[#e4bd72]/35 bg-[#e4bd72]/[.1] px-[1.3vmin] py-[.8vmin] micro-label text-[#e4bd72]">APERTO</span>
        </div>
        <motion.h2
          className="mt-[3.4vh] font-display text-[6.5vmin] font-semibold leading-[.98] tracking-[-.055em] text-[#e7edf5]"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.52, ease }}
        >
          PREVENTIVO
          <br />
          <span className="text-slate-400">LOGO NON AGGIORNATO</span>
        </motion.h2>
        <motion.div
          className="ticket-panel mt-[4vh] rounded-[1.2vmin] p-[2.2vmin]"
          initial={{ opacity: 0, x: -40, rotateY: -8 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ delay: 0.55, duration: 0.55, ease }}
          style={{ transformOrigin: 'left center' }}
        >
          <div className="flex items-center gap-[1.4vmin]">
            <img className="avatar" src={giulia} alt="Giulia Rossi" />
            <div>
              <div className="font-display text-[2.25vmin] font-semibold text-[#e7edf5]">Giulia Rossi</div>
              <div className="mt-[.45vh] text-[1.45vmin] text-slate-400">Cliente · oggi, 10:26</div>
            </div>
            <span className="ml-auto h-[.8vmin] w-[.8vmin] rounded-full bg-[#3b82f6] shadow-[0_0_0_.5vmin_rgba(59,130,246,.12)]" />
          </div>
          <motion.p
            className="mt-[2.3vh] max-w-[44vw] text-[2.35vmin] leading-[1.45] text-slate-200"
            initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
            animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
            transition={{ delay: 0.98, duration: 0.7, ease }}
          >
            Ho caricato il logo aggiornato, ma nell’anteprima del preventivo compare ancora quello vecchio. È normale?
          </motion.p>
          <motion.div
            className="mt-[2vh] flex items-center gap-[1vmin] border-t border-slate-600/40 pt-[1.4vh] text-[1.6vmin] text-slate-400"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.72, duration: 0.35, ease }}
          >
            <span className="inline-flex h-[2.4vmin] w-[2.4vmin] items-center justify-center rounded-[.5vmin] bg-[#3b82f6]/15 text-[1.25vmin] text-[#82aeff]">↗</span>
            Allegato · <span className="mono-label text-slate-300">logo_studio_v4.svg</span>
          </motion.div>
        </motion.div>
      </div>
      <motion.div
        className="paper absolute right-[7%] top-[25%] h-[55%] w-[27%] rounded-[1vmin] p-[2vmin]"
        initial={{ opacity: 0, rotate: 8, y: 44, scale: 0.84 }}
        animate={{ opacity: 1, rotate: 2.5, y: 0, scale: 1 }}
        transition={{ delay: 0.72, duration: 0.74, ease }}
      >
        <div className="micro-label text-slate-500">ANTEPRIMA · V4</div>
        <div className="mt-[6vh] font-display text-[3.6vmin] font-bold leading-[.88] tracking-[-.07em] text-slate-800">STUDIO<br />PAOLO</div>
        <div className="mt-[4vh] h-[1px] w-[87%] bg-slate-300" />
        <div className="mt-[1vh] h-[1px] w-[61%] bg-slate-300" />
        <div className="mt-[1vh] h-[1px] w-[76%] bg-slate-300" />
        <motion.div
          className="absolute bottom-[11%] right-[9%] rounded-full bg-[#3b82f6] px-[1.1vmin] py-[.7vmin] micro-label text-white"
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: -4 }}
          transition={{ delay: 2.28, type: 'spring', stiffness: 360, damping: 21 }}
        >
          V4
        </motion.div>
      </motion.div>
      <motion.div className="absolute bottom-[12%] left-[7%] h-[2px] bg-[#3b82f6]" initial={{ width: '0%' }} animate={{ width: '61%' }} transition={{ delay: 3.48, duration: 0.48, ease }} />
      <div className="absolute bottom-[7%] right-[7%] micro-label text-slate-500">RICHIESTA RICEVUTA · 10:26</div>
    </motion.section>
  );
}
