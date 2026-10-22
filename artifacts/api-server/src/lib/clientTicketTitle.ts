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
  const newPrefix = `${normalizedClientName}${CLIENT_TITLE_SEPARATOR}`;
  let originalTitle = title;

  const stripPrefix = (prefix: string) => {
    while (originalTitle.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())) {
      originalTitle = originalTitle.slice(prefix.length);
    }
  };
  if (previousPrefix) stripPrefix(previousPrefix);
  stripPrefix(newPrefix);

  return `${newPrefix}${originalTitle}`;
}
