import { motion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;

export function Shot01() {
  return (
    <motion.section
      className="absolute inset-0 overflow-hidden"
      initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
      exit={{ scale: 1.08, opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.48, ease }}
      style={{ background: '#0b1220' }}
    >
      <div className="film-grain" />
      <motion.div
        className="absolute top-[13%] left-[6%] h-[2px] bg-[#3b82f6]"
        initial={{ width: '0vw' }}
        animate={{ width: ['0vw', '17vw', '17vw'] }}
        transition={{ duration: 2.8, times: [0, 0.2, 1], ease }}
      />
      <div className="absolute left-[6%] top-[16%] w-[45%]">
        <motion.div
          className="micro-label text-[#79a9ff]"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.12, duration: 0.35, ease }}
        >
          STUDIO PAOLO <span className="text-slate-500">/</span> TICKET #SP-1916
        </motion.div>
        <div className="mt-[4.4vh] font-display font-bold leading-[.82] tracking-[-.075em] text-[#e7edf5]">
          <motion.div
            className="text-[19vmin]"
            initial={{ opacity: 0, scale: 1.4, x: -35 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 0.12, duration: 0.42, ease }}
          >
            NON È
          </motion.div>
          <motion.div
            className="ml-[3vw] mt-[1.3vh] text-[17.5vmin]"
            initial={{ opacity: 0, y: 70, rotate: 2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: 0.56, duration: 0.44, ease }}
          >
            IL FILE.
          </motion.div>
        </div>
        <motion.p
          className="mt-[4.2vh] max-w-[34vw] text-[2.45vmin] leading-[1.25] text-slate-300"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.42, ease }}
        >
          Il logo aggiornato non compare nell’anteprima.
        </motion.p>
      </div>
      <motion.div
        className="absolute right-[7%] top-[17%] h-[64%] w-[35%]"
        initial={{ opacity: 0, scale: 0.72, rotateY: -24, rotateZ: 4, x: 55 }}
        animate={{ opacity: 1, scale: 1, rotateY: 0, rotateZ: 1.6, x: 0 }}
        exit={{ scale: 3.2, x: -70, opacity: 0, filter: 'blur(12px)' }}
        transition={{ delay: 0.82, duration: 0.72, ease }}
        style={{ perspective: 1000, transformStyle: 'preserve-3d', willChange: 'transform, opacity' }}
      >
        <div className="paper relative h-full overflow-hidden rounded-[1.3vmin] p-[2.4vmin]">
          <div className="flex items-center justify-between border-b border-slate-300 pb-[1.5vmin]">
            <span className="micro-label text-slate-500">PREVENTIVO · V4</span>
            <span className="mono-label text-[1.25vmin] text-slate-400">01 / 04</span>
          </div>
          <div className="pt-[5vh] font-display text-[4vmin] font-semibold tracking-[-.06em]">STUDIO</div>
          <div className="font-display text-[4vmin] font-semibold tracking-[-.06em]">PAOLO</div>
          <motion.div
            className="absolute left-[9%] top-[43%] h-[1px] w-[84%] bg-[#ee5966]"
            initial={{ scaleX: 0, rotate: -13 }}
            animate={{ scaleX: [0, 1, 1], rotate: -13 }}
            transition={{ delay: 1.35, duration: 0.42, ease }}
            style={{ transformOrigin: 'left' }}
          />
          <div className="mt-[5vh] h-[1px] w-[70%] bg-slate-300" />
          <div className="mt-[1.2vh] h-[1px] w-[58%] bg-slate-300" />
          <div className="absolute bottom-[7%] left-[7%] right-[7%] rounded-[.7vmin] border border-dashed border-[#3b82f6]/60 bg-[#3b82f6]/[.08] p-[1.2vmin]">
            <div className="micro-label text-[#245fc6]">ALLEGATO COLLEGATO</div>
            <div className="mono-label mt-[.8vh] text-[1.55vmin] text-slate-700">logo_studio_v4.svg</div>
          </div>
        </div>
        <motion.div
          className="absolute -right-[7%] top-[12%] -z-10 h-[75%] w-[95%] border border-[#3b82f6]/55 bg-[#3b82f6]/10"
          initial={{ scale: 0.65, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.6, ease }}
        />
      </motion.div>
      <div className="absolute bottom-[8%] left-[6%] micro-label text-slate-500">UNA RICHIESTA. UNA PERSONA CHE SEGUE IL FILO.</div>
    </motion.section>
  );
}
