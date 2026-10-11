interface ProfessionMarkProps {
  profile: {
    logo?: string;
    logoPresentation?: "horizontal" | "square";
    icon?: string;
  };
  className?: string;
  compact?: boolean;
}

export function ProfessionMark({ profile, className = "", compact = false }: ProfessionMarkProps) {
  const tileClassName = compact
    ? "h-8 w-16 rounded-lg"
    : "h-10 w-20 rounded-xl";
  const markClassName = profile.logoPresentation === "horizontal"
    ? `${compact ? "h-8 w-16" : "h-10 w-20"} object-contain`
    : `${compact ? "h-8 w-8" : "h-10 w-10"} object-contain`;

  return (
    <span
      data-testid="profession-mark"
      className={`flex ${tileClassName} shrink-0 items-center justify-center border border-slate-100 bg-white ${className}`}
      aria-hidden="true"
    >
      {profile.logo ? (
        <img src={profile.logo} alt="" className={markClassName} />
      ) : (
        <span className={`flex ${compact ? "h-8 w-8 text-2xl" : "h-10 w-10 text-3xl"} items-center justify-center leading-none`}>
          {profile.icon}
        </span>
      )}
    </span>
  );
}
