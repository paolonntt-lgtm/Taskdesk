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

        <div className="grid gap-3 sm:grid-cols-3">
          {t.whoUses.profiles.map((profile) => (
            <Link
              key={profile.profession}
              href={`/${lang}/${PROFESSION_SLUGS[lang][profile.profession]}${campaignQuery}`}
              onClick={() => trackProfessionDialogProfessionSelected(profile.profession, lang)}
              className="group flex min-h-36 flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-lg hover:shadow-blue-950/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:min-h-48 sm:p-5"
              data-testid={`link-entry-profession-${profile.profession}`}
            >
              <span
                className={`mb-4 flex h-11 ${profile.profession === "commercialisti" ? "w-16" : "w-11"} items-center justify-center rounded-xl bg-blue-50 text-2xl`}
                aria-hidden="true"
              >
                {profile.logo ? (
                  <img
                    src={profile.logo}
                    alt=""
                    className={`object-contain ${profile.profession === "commercialisti" ? "h-8 w-[3.75rem]" : "h-8 w-8"}`}
                  />
                ) : (
                  profile.icon
                )}
              </span>
              <span className="flex items-start justify-between gap-2 text-base font-extrabold text-slate-900">
                {profile.title}
                <ArrowUpRight aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
              <span className="mt-2 text-sm leading-5 text-slate-600">
                {profile.desc}
              </span>
            </Link>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
