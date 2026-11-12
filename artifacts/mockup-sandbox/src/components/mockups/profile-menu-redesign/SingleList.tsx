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
  last = false,
}: {
  label: string;
  Icon: typeof Bell;
  Action?: typeof ChevronRight;
  last?: boolean;
}) {
  return (
    <div className={`single-row${last ? " single-row-last" : ""}`}>
      <Icon className="single-icon" size={18} strokeWidth={1.8} />
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
          margin: 0;
          padding: 12px 16px;
          background: color-mix(in srgb, var(--profile-muted-bg) 38%, white);
          color: var(--profile-muted);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .06em;
          line-height: 16px;
          text-transform: uppercase;
        }
        .single-menu .single-admin-heading {
          border-top: 1px solid var(--profile-border);
        }
        .single-row {
          display: flex;
          min-height: 46px;
          align-items: center;
          gap: 12px;
          padding: 6px 16px;
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
        .single-icon {
          flex: 0 0 auto;
          color: var(--profile-primary);
        }
        .single-action {
          flex: 0 0 auto;
          color: var(--profile-muted);
        }
      `}</style>
    </main>
  );
}
