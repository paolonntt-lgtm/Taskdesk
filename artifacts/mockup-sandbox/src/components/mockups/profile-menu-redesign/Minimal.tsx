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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="minimal-section">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Row({
  label,
  Icon,
  Action = ChevronRight,
}: {
  label: string;
  Icon: typeof Bell;
  Action?: typeof ChevronRight;
}) {
  return (
    <div className="minimal-row">
      <Icon className="minimal-icon" size={18} strokeWidth={1.8} />
      <span>{label}</span>
      <Action className="minimal-action" size={17} strokeWidth={1.8} />
    </div>
  );
}

export function Minimal() {
  return (
    <main className="minimal-preview">
      <Section title="Altri strumenti">
        {toolItems.map(({ label, Icon }) => (
          <Row key={label} label={label} Icon={Icon} />
        ))}
      </Section>
      <Section title="Amministrazione">
        {adminItems.map(({ label, Icon, Action }) => (
          <Row key={label} label={label} Icon={Icon} Action={Action} />
        ))}
      </Section>
      <style>{`
        .minimal-preview {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 16px;
          background: var(--profile-bg);
          color: var(--profile-foreground);
        }
        .minimal-section {
          overflow: hidden;
          border: 1px solid var(--profile-border);
          border-radius: 14px;
          background: var(--profile-card);
        }
        .minimal-section h2 {
          margin: 0;
          padding: 12px 16px;
          border-bottom: 1px solid var(--profile-border);
          color: var(--profile-muted);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .06em;
          line-height: 16px;
          text-transform: uppercase;
        }
        .minimal-row {
          display: flex;
          min-height: 49px;
          align-items: center;
          gap: 12px;
          padding: 0 15px;
          border-bottom: 1px solid var(--profile-border);
          color: var(--profile-foreground);
          font-size: 14px;
          font-weight: 500;
        }
        .minimal-section > div > .minimal-row:last-child {
          border-bottom: 0;
        }
        .minimal-row span {
          flex: 1;
        }
        .minimal-icon,
        .minimal-action {
          flex: 0 0 auto;
          color: var(--profile-primary);
        }
        .minimal-action {
          color: var(--profile-muted);
        }
      `}</style>
    </main>
  );
}
