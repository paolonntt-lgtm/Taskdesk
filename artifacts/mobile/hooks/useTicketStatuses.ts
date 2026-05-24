import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/utils/api";

export interface TicketStatus {
  id: number;
  organizationId: number;
  key: string;
  label: string;
  color: string | null;
  sortOrder: number;
  isDefault: boolean;
  isClosed: boolean;
  createdAt: string;
}

export function useTicketStatuses() {
  const { data: statuses = [], isLoading } = useQuery<TicketStatus[]>({
    queryKey: ["ticket-statuses"],
    queryFn: () => apiGet<TicketStatus[]>("/settings/ticket-statuses"),
    staleTime: 5 * 60_000,
  });

  function getLabelForKey(key: string): string {
    const found = statuses.find((s) => s.key === key);
    return found?.label ?? key;
  }

  function isClosedKey(key: string): boolean {
    const found = statuses.find((s) => s.key === key);
    return found?.isClosed ?? (key === "closed" || key === "resolved");
  }

  return { statuses, isLoading, getLabelForKey, isClosedKey };
}
