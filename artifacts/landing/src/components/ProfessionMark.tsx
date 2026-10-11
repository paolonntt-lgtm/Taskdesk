interface ProfessionMarkProps {
  profile: {
    logo?: string;
    logoPresentation?: "horizontal" | "square";
    icon?: string;
  };
  className?: string;
}

export function ProfessionMark({ profile, className = "" }: ProfessionMarkProps) {
  const markClassName = profile.logoPresentation === "horizontal"
    ? "h-10 w-20 object-contain"
    : "h-10 w-10 object-contain";

  return (
    <span
      className={`flex h-10 w-20 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white ${className}`}
      aria-hidden="true"
    >
      {profile.logo ? (
        <img src={profile.logo} alt="" className={markClassName} />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center text-3xl leading-none">
          {profile.icon}
        </span>
      )}
    </span>
  );
}
