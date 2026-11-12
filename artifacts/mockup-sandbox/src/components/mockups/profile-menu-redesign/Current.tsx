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

const colors = ["var(--profile-primary)", "var(--profile-teal)", "var(--profile-amber)"];

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
  { label: "Gestione utenti", Icon: Users, color: "var(--profile-primary)" },
  { label: "Gruppi, sedi e categorie", Icon: Settings, color: "var(--profile-teal)" },
  { label: "Invita collaboratore", Icon: UserPlus, color: "var(--profile-amber)", action: Share2 },
];

function CurrentSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="current-section">
      <h2>{title}</h2>
      <div className="current-list">{children}</div>
    </section>
  );
}

function CurrentRow({
  label,
  Icon,
  color,
  Action = ChevronRight,
}: {
  label: string;
  Icon: typeof Bell;
  color: string;
  Action?: typeof ChevronRight;
}) {
  return (
    <div
      className="current-row"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 8%, white)`,
        borderColor: `color-mix(in srgb, ${color} 26%, white)`,
        borderLeftColor: color,
      }}
    >
      <span
        className="current-icon"
        style={{
          backgroundColor: `color-mix(in srgb, ${color} 14%, white)`,
          borderColor: `color-mix(in srgb, ${color} 32%, white)`,
          color,
        }}
      >
        <Icon size={19} strokeWidth={1.9} />
      </span>
      <span className="current-label">{label}</span>
      <span className="current-action" style={{ color }}>
        <Action size={17} strokeWidth={2} />
      </span>
    </div>
  );
}

export function Current() {
  return (
    <main className="current-preview">
      <CurrentSection title="Altri strumenti">
        {toolItems.map(({ label, Icon }, index) => (
          <CurrentRow
            key={label}
            label={label}
            Icon={Icon}
            color={colors[index % colors.length]}
          />
        ))}
      </CurrentSection>

      <CurrentSection title="Amministrazione">
        {adminItems.map(({ label, Icon, color, action: Action }) => (
          <CurrentRow key={label} label={label} Icon={Icon} color={color} Action={Action} />
        ))}
      </CurrentSection>

      <style>{`
        .current-preview {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 16px;
          background: var(--profile-bg);
          color: var(--profile-foreground);
        }
        .current-section {
          overflow: hidden;
          border: 1px solid var(--profile-border);
          border-radius: 14px;
          background: var(--profile-card);
        }
        .current-section h2 {
          margin: 0;
          padding: 12px 16px;
          border-bottom: 1px solid var(--profile-border);
          background: color-mix(in srgb, var(--profile-muted-bg) 48%, white);
          color: var(--profile-muted);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: .06em;
          line-height: 16px;
          text-transform: uppercase;
        }
        .current-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px 10px;
        }
        .current-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 46px;
          padding: 5px 9px;
          border: 1px solid;
          border-left-width: 3px;
          border-radius: 11px;
        }
        .current-icon {
          display: grid;
          width: 28px;
          height: 28px;
          flex: 0 0 28px;
          place-items: center;
          border: 1px solid;
          border-radius: 9px;
        }
        .current-label {
          flex: 1;
          font-size: 14px;
          font-weight: 600;
          line-height: 18px;
        }
        .current-action {
          display: grid;
          width: 22px;
          height: 22px;
          flex: 0 0 22px;
          place-items: center;
        }
      `}</style>
    </main>
  );
}
