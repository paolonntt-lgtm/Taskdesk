import "./_group.css";
import {
  BarChart3,
  Bell,
  ChevronRight,
  CreditCard,
  Settings,
  Share2,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

const toolItems = [
  { label: "Report", Icon: BarChart3 },
  { label: "Clienti", Icon: Users },
  { label: "Rendiconto ore", Icon: BarChart3 },
  { label: "Notifiche", Icon: Bell },
  { label: "Cestino ticket", Icon: Trash2 },
  { label: "Fatturazione", Icon: CreditCard },
  { label: "Avvisi", Icon: Bell },
];

const adminItems = [
  { label: "Gestione utenti", Icon: Users },
  { label: "Gruppi, sedi e categorie", Icon: Settings },
  { label: "Invita collaboratore", Icon: UserPlus, Action: Share2 },
];

function MenuRow({
  label,
  Icon,
  Action = ChevronRight,
  tone = "blue",
  last = false,
}: {
  label: string;
  Icon: typeof Bell;
  Action?: typeof ChevronRight;
  tone?: "blue" | "teal" | "amber";
  last?: boolean;
}) {
  return (
    <div className={`single-row single-row-${tone}${last ? " single-row-last" : ""}`}>
      <span className="single-icon-wrap">
        <Icon className="single-icon" size={16} strokeWidth={1.8} />
      </span>
      <span>{label}</span>
      <Action className="single-action" size={17} strokeWidth={1.8} />
    </div>
  );
}

export function SingleList() {
  return (
    <main className="single-preview">
      <section className="single-menu">
        <h2>Altri strumenti</h2>
        {toolItems.map(({ label, Icon }, index) => (
          <MenuRow
            key={label}
            label={label}
            Icon={Icon}
          tone={(["blue", "teal", "amber"] as const)[index % 3]}
            last={index === toolItems.length - 1}
          />
        ))}
        <h2 className="single-admin-heading">Amministrazione</h2>
        {adminItems.map(({ label, Icon, Action }, index) => (
          <MenuRow
            key={label}
            label={label}
            Icon={Icon}
            Action={Action}
            tone={(["blue", "teal", "amber"] as const)[index]}
            last={index === adminItems.length - 1}
          />
        ))}
      </section>
      <style>{`
        .single-preview {
          min-height: 100vh;
          padding: 16px;
          background: var(--profile-bg);
          color: var(--profile-foreground);
        }
        .single-menu {
          overflow: hidden;
          border: 1px solid var(--profile-border);
          border-radius: 14px;
          background: var(--profile-card);
        }
        .single-menu h2 {
          display: flex;
          align-items: center;
          gap: 9px;
          margin: 0;
          min-height: 40px;
          padding: 9px 14px;
          background: color-mix(in srgb, var(--profile-primary) 7%, white);
          color: var(--profile-muted);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .06em;
          line-height: 16px;
          text-transform: uppercase;
        }
        .single-menu h2::before {
          content: "";
          width: 4px;
          height: 15px;
          border-radius: 2px;
          background: var(--profile-primary);
        }
        .single-menu .single-admin-heading {
          border-top: 1px solid var(--profile-border);
          background: color-mix(in srgb, var(--profile-teal) 8%, white);
        }
        .single-menu .single-admin-heading::before {
          background: var(--profile-teal);
        }
        .single-row {
          display: flex;
          min-height: 50px;
          align-items: center;
          gap: 10px;
          padding: 6px 14px;
          border-bottom: 1px solid var(--profile-border);
          color: var(--profile-foreground);
          font-size: 14px;
          font-weight: 500;
        }
        .single-row-last {
          border-bottom: 0;
        }
        .single-row span {
          flex: 1;
        }
        .single-row-blue {
          --row-accent: var(--profile-primary);
        }
        .single-row-teal {
          --row-accent: var(--profile-teal);
        }
        .single-row-amber {
          --row-accent: var(--profile-amber);
        }
        .single-icon-wrap {
          display: grid;
          width: 30px;
          height: 30px;
          flex: 0 0 auto;
          place-items: center;
          border-radius: 9px;
          background: color-mix(in srgb, var(--row-accent) 12%, white);
        }
        .single-icon {
          color: var(--row-accent);
        }
        .single-action {
          flex: 0 0 auto;
          color: var(--profile-muted);
        }
      `}</style>
    </main>
  );
}
