import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/i18n";
import {
  getProfessionalCampaign,
  trackProfessionDialogClosed,
  trackProfessionDialogOpened,
  trackProfessionDialogProfessionSelected,
} from "@/lib/analytics";
import { PROFESSION_SLUGS } from "@/profession-routes";
import { ProfessionMark } from "@/components/ProfessionMark";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProfessionEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfessionEntryDialog({ open, onOpenChange }: ProfessionEntryDialogProps) {
  const { lang, t } = useLanguage();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const wasOpen = useRef(false);
  const campaign = getProfessionalCampaign(
    typeof window === "undefined" ? "" : window.location.search,
  );
  const campaignQuery = campaign === "unattributed"
    ? ""
    : `?utm_campaign=${encodeURIComponent(campaign)}`;

  useEffect(() => {
    if (open && !wasOpen.current) trackProfessionDialogOpened(lang);
    wasOpen.current = open;
  }, [lang, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeButtonLabel={t.professionDialog.close}
        overlayClassName="z-[10000] bg-slate-950/50 backdrop-blur-sm"
        className="z-[10001] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_28px_100px_-28px_rgba(15,23,42,0.5)] sm:p-10"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
        onCloseButtonClick={() => trackProfessionDialogClosed(lang, "x")}
        onPointerDownOutside={() => trackProfessionDialogClosed(lang, "backdrop")}
        onEscapeKeyDown={() => trackProfessionDialogClosed(lang, "escape")}
      >
        <DialogHeader className="mb-3 pr-10 text-left">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            {t.professionDialog.eyebrow}
          </p>
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="text-2xl font-black tracking-tight text-slate-950 outline-none sm:text-3xl"
          >
            {t.professionDialog.title}
          </DialogTitle>
          <DialogDescription className="max-w-2xl pt-2 text-sm leading-6 text-slate-600 sm:text-base">
            {t.professionDialog.description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-6">
          {t.whoUses.profiles.map((profile) => (
            <Link
              key={profile.profession}
              href={`/${lang}/${PROFESSION_SLUGS[lang][profile.profession]}${campaignQuery}`}
              onClick={() => trackProfessionDialogProfessionSelected(profile.profession, lang)}
              className="group flex min-h-36 flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 text-center transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-lg hover:shadow-blue-950/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:col-span-2 sm:min-h-48 sm:p-5"
              data-testid={`link-entry-profession-${profile.profession}`}
            >
              <ProfessionMark
                profile={profile}
                className="mb-4"
              />
              <span className="relative block w-full px-5 text-center text-base font-extrabold text-slate-900">
                {profile.title}
                <ArrowUpRight aria-hidden="true" className="absolute right-0 top-0 h-4 w-4 text-blue-600 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
              <span className="mt-2 w-full text-center text-sm leading-5 text-slate-600">
                {profile.desc}
              </span>
            </Link>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
