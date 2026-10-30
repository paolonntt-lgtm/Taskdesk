const CLIENT_TITLE_SEPARATOR = " — ";

export function prefixTicketTitleWithClient(
  title: string,
  clientName: string,
  previousClientName?: string | null,
): string {
  const normalizedClientName = clientName.trim();
  if (!normalizedClientName) return title;

  const normalizedPreviousClientName = previousClientName?.trim() || null;
  const newPrefix = `${normalizedClientName}${CLIENT_TITLE_SEPARATOR}`;
  let originalTitle = title;

  const stripPrefix = (prefix: string) => {
    const normalizedPrefix = prefix.trim().toLocaleLowerCase();
    while (originalTitle.toLocaleLowerCase().startsWith(normalizedPrefix)) {
      const separator = /^\s*(?:—|–|-|:)\s*/u.exec(originalTitle.slice(prefix.trim().length));
      if (!separator) break;
      originalTitle = originalTitle.slice(prefix.trim().length + separator[0].length);
    }
  };
  if (normalizedPreviousClientName) stripPrefix(normalizedPreviousClientName);
  stripPrefix(normalizedClientName);

  return `${newPrefix}${originalTitle}`;
}
