import { motion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;
const marco = `${import.meta.env.BASE_URL}images/studio-paolo-marco.png`;

export function Shot03() {
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
      exit={{ scale: 1.06, opacity: 0, filter: 'blur(9px)' }}
      transition={{ duration: 0.56, ease }}
      style={{ background: '#101d31' }}
    >
      <div className="absolute inset-y-0 left-1/2 w-px bg-slate-500/20" />
      <div className="absolute left-[6%] top-[9%] micro-label text-[#81adff]">SP-1916 <span className="text-slate-500">/</span> CONVERSAZIONE</div>
      <motion.div
        className="absolute left-[8%] top-[22%] w-[39%]"
        initial={{ opacity: 0, x: -40, rotateY: 10 }}
        animate={{ opacity: 1, x: 0, rotateY: 0 }}
        transition={{ delay: 0.25, duration: 0.55, ease }}
      >
        <div className="mb-[1.8vh] flex items-center gap-[1.3vmin]">
          <img src={marco} alt="Marco Bianchi" className="avatar !h-[5.8vmin] !w-[5.8vmin]" />
          <div>
            <div className="font-display text-[2.4vmin] font-semibold">Marco Bianchi</div>
            <div className="mt-[.45vh] text-[1.45vmin] text-slate-400">Supporto · 10:41</div>
          </div>
        </div>
        <div className="relative rounded-[1.4vmin] rounded-tl-[.25vmin] bg-[#1c4f99] p-[2.6vmin] shadow-[0_2vmin_5vmin_rgba(0,0,0,.22)]">
          <div className="micro-label text-blue-200/70">COMMENTO 01</div>
          <p className="mt-[1.6vh] text-[3vmin] leading-[1.28] tracking-[-.02em] text-white">
            Ciao Giulia, controllo l’allegato e la versione collegata al ticket.
          </p>
          <motion.div className="absolute bottom-[2.05vmin] left-[31%] h-[.42vmin] rounded-full bg-[#91bcff]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.35, duration: .44, ease }} style={{ transformOrigin: 'left' }} />
        </div>
        <motion.div
          className="mt-[2vh] flex items-center gap-[.8vmin] text-[1.55vmin] text-blue-200/80"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.72, duration: .32, ease }}
        >
          <span className="h-px w-[3vw] bg-[#3b82f6]" /> VERSIONE COLLEGATA
        </motion.div>
      </motion.div>
      <motion.div
        className="ticket-panel absolute right-[7%] top-[31%] w-[42%] rounded-[1.3vmin] p-[2.4vmin]"
        initial={{ opacity: 0, x: 45, rotateY: -12, scale: .9 }}
        animate={{ opacity: 1, x: 0, rotateY: 0, scale: 1 }}
        transition={{ delay: 1.6, duration: .58, ease }}
        style={{ transformOrigin: 'right center' }}
      >
        <div className="flex items-center justify-between">
          <div className="micro-label text-[#81adff]">AGGIORNAMENTO · 10:48</div>
          <div className="h-[.8vmin] w-[.8vmin] rounded-full bg-[#71d8b0]" />
        </div>
        <motion.p
          className="mt-[2vh] text-[2.55vmin] leading-[1.42] text-slate-100"
          initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
          animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
          transition={{ delay: 2.05, duration: .72, ease }}
        >
          Ho trovato il file: l’anteprima non si era aggiornata. Ho ricollegato il logo nuovo; puoi verificare?
        </motion.p>
        <motion.div
          className="mt-[2vh] flex items-center gap-[1vmin] rounded-[.8vmin] border border-[#71d8b0]/20 bg-[#71d8b0]/[.07] px-[1.2vmin] py-[1vh]"
          initial={{ opacity: 0, scale: .96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 3.04, duration: .36, ease }}
        >
          <span className="mono-label text-[1.5vmin] text-slate-300">logo_studio_v4.svg</span>
          <span className="ml-auto micro-label text-[#71d8b0]">COLLEGATO</span>
        </motion.div>
        <motion.div
          className="absolute -bottom-[3.5vmin] left-[13%] right-[10%] h-[2px] bg-[#3b82f6]"
          initial={{ scaleX: .1 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 3.7, duration: .48, ease }}
          style={{ transformOrigin: 'left' }}
        />
      </motion.div>
      <motion.div
        className="absolute bottom-[10%] left-[8%] font-display text-[4.2vmin] font-medium tracking-[-.04em] text-[#e7edf5]"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3.78, duration: .4, ease }}
      >
        Dettagli chiari. Prossimo passo.
      </motion.div>
      <div className="absolute bottom-[8%] right-[7%] micro-label text-slate-500">STUDIO PAOLO · SUPPORTO</div>
    </motion.section>
  );
}
