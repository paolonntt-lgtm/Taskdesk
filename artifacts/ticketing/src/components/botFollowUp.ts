export function isYesNoFollowUpOffer(text: string): boolean {
  const offersFollowUp = /\b(?:se vuoi|se preferisci)\b[\s\S]{0,120}\bposso\b|\bposso\b[\s\S]{0,140}\b(?:se vuoi|se preferisci)\b|\bvuoi che\b|\bif you want\b[\s\S]{0,120}\bi can\b|\bi can\b[\s\S]{0,140}\bif you(?:'d| would) like\b|\bwould you like me to\b|\bshall i\b/i.test(text);
  const offersTicketCreation = /\b(?:aprire|creare|open|create)\b[\s\S]{0,40}\b(?:ticket|pratica)\b/i.test(text);
  return offersFollowUp && !offersTicketCreation;
}
