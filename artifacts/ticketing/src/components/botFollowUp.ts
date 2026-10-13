export function shouldShowYesNoReplies(text: string): boolean {
  const asksQuestion = /[?？]/.test(text);
  const offersOptionalFollowUp = /\b(?:se vuoi|se preferisci)\b[\s\S]{0,120}\bposso\b|\bposso\b[\s\S]{0,140}\b(?:se vuoi|se preferisci)\b|\bvuoi che\b|\bif you want\b[\s\S]{0,120}\bi can\b|\bi can\b[\s\S]{0,140}\bif you(?:'d| would) like\b|\bwould you like me to\b|\bshall i\b/i.test(text);
  return asksQuestion || offersOptionalFollowUp;
}
