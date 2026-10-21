const CLIENT_TITLE_SEPARATOR = " — ";

export function prefixTicketTitleWithClient(
  title: string,
  clientName: string,
  previousClientName?: string | null,
): string {
  const normalizedClientName = clientName.trim();
  if (!normalizedClientName) return title;

  const previousPrefix = previousClientName?.trim()
    ? `${previousClientName.trim()}${CLIENT_TITLE_SEPARATOR}`
    : null;
  const originalTitle = previousPrefix && title.startsWith(previousPrefix)
    ? title.slice(previousPrefix.length)
    : title;
  const newPrefix = `${normalizedClientName}${CLIENT_TITLE_SEPARATOR}`;

  return originalTitle.startsWith(newPrefix)
    ? originalTitle
    : `${newPrefix}${originalTitle}`;
}
