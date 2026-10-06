const MAX_OPERATOR_INPUTS = 20;
const MAX_INPUT_CHARS = 2000;
const MAX_TOTAL_CHARS = 6000;

export function sanitizeDailyReportOperatorInputs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const candidates = value
    .slice(-MAX_OPERATOR_INPUTS)
    .map((entry) => typeof entry === "string" ? entry.trim().slice(0, MAX_INPUT_CHARS) : "")
    .filter(Boolean);

  const retained: string[] = [];
  let totalChars = 0;

  // Keep the newest turns when the context budget is reached.
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const candidate = candidates[i];
    if (totalChars + candidate.length > MAX_TOTAL_CHARS) break;
    retained.push(candidate);
    totalChars += candidate.length;
  }

  return retained.reverse();
}

export function formatDailyReportOperatorInputs(
  inputs: string[],
  lang: "it" | "en",
): string {
  if (inputs.length === 0) return "";

  const title = lang === "it"
    ? "MESSAGGI DEL COLLABORATORE DURANTE LA PREPARAZIONE DEL REPORT"
    : "COLLABORATOR MESSAGES DURING REPORT PREPARATION";
  const entries = inputs.map((input, index) => `${index + 1}. ${JSON.stringify(input)}`).join("\n");

  return `\n\n--- ${title} (in ordine cronologico) ---\n${entries}\n--- FINE MESSAGGI ---`;
}
