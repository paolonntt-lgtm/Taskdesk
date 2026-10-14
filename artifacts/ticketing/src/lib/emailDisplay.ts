export function compactEmailDetailLinks(text: string): string {
  const protectedSegments: string[] = [];
  let result = text.replace(/(`[^`]*`|\[[^\]]+\]\([^)]+\))/g, (segment) => {
    const index = protectedSegments.push(segment) - 1;
    return `\u0000${index}\u0000`;
  });

  result = result.replace(
    /<\s*(https?:\/\/[^>\s]+)\s*>|https?:\/\/[^\s<>"'`)\]]+/gi,
    (match, angleUrl: string | undefined) => {
      const url = angleUrl ?? match;
      const label = /google\.[^/]+\/maps/i.test(url) ? 'mappa' : 'link';
      return `[${label}](${url})`;
    },
  );

  return result.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => protectedSegments[Number(index)]);
}
