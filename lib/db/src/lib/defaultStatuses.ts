export interface StatusPreset {
  key: string;
  label: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  isClosed: boolean;
}

export function getDefaultStatuses(businessType: string | null | undefined): StatusPreset[] {
  switch (businessType) {
    case "professional_studio":
      return [
        { key: "open", label: "Aperta", color: "#1976d2", sortOrder: 0, isDefault: true, isClosed: false },
        { key: "in_progress", label: "In lavorazione", color: "#ed6c02", sortOrder: 1, isDefault: false, isClosed: false },
        { key: "waiting_client", label: "In attesa", color: "#9c27b0", sortOrder: 2, isDefault: false, isClosed: false },
        { key: "waiting_document", label: "In attesa documento", color: "#0288d1", sortOrder: 3, isDefault: false, isClosed: false },
        { key: "waiting_approval", label: "In attesa approvazione", color: "#f57c00", sortOrder: 4, isDefault: false, isClosed: false },
        { key: "closed", label: "Chiusa", color: "#616161", sortOrder: 5, isDefault: false, isClosed: true },
      ];
    case "agency":
      return [
        { key: "open", label: "Aperto", color: "#1976d2", sortOrder: 0, isDefault: true, isClosed: false },
        { key: "in_progress", label: "In lavorazione", color: "#ed6c02", sortOrder: 1, isDefault: false, isClosed: false },
        { key: "in_review", label: "In revisione", color: "#9c27b0", sortOrder: 2, isDefault: false, isClosed: false },
        { key: "approved", label: "Approvato", color: "#2e7d32", sortOrder: 3, isDefault: false, isClosed: false },
        { key: "closed", label: "Chiuso", color: "#616161", sortOrder: 4, isDefault: false, isClosed: true },
      ];
    case "other":
      return [
        { key: "open", label: "Aperta", color: "#1976d2", sortOrder: 0, isDefault: true, isClosed: false },
        { key: "waiting", label: "In attesa", color: "#ed6c02", sortOrder: 1, isDefault: false, isClosed: false },
        { key: "resolved", label: "Risolta", color: "#2e7d32", sortOrder: 2, isDefault: false, isClosed: true },
        { key: "closed", label: "Chiusa", color: "#616161", sortOrder: 3, isDefault: false, isClosed: true },
      ];
    case "it_support":
    default:
      return [
        { key: "open", label: "Aperto", color: "#1976d2", sortOrder: 0, isDefault: true, isClosed: false },
        { key: "in_progress", label: "In lavorazione", color: "#ed6c02", sortOrder: 1, isDefault: false, isClosed: false },
        { key: "waiting", label: "In attesa", color: "#9c27b0", sortOrder: 2, isDefault: false, isClosed: false },
        { key: "resolved", label: "Risolto", color: "#2e7d32", sortOrder: 3, isDefault: false, isClosed: true },
        { key: "closed", label: "Chiuso", color: "#616161", sortOrder: 4, isDefault: false, isClosed: true },
      ];
  }
}
