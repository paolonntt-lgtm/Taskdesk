export function shouldShowYesNoReplies(text: string): boolean {
  const asksQuestion = /[?？]/.test(text);
  const offersOptionalFollowUp = /\b(?:se vuoi|se preferisci)\b[\s\S]{0,120}\bposso\b|\bposso\b[\s\S]{0,140}\b(?:se vuoi|se preferisci)\b|\bvuoi che\b|\bif you want\b[\s\S]{0,120}\bi can\b|\bi can\b[\s\S]{0,140}\bif you(?:'d| would) like\b|\bwould you like me to\b|\bshall i\b/i.test(text);
  return asksQuestion || offersOptionalFollowUp;
}

export function isUnableToHelp(text: string): boolean {
  return /\b(?:non sono riuscit[oa] ad aiutarti|non riesco ad aiutarti|non posso aiutarti|non sono in grado di aiutarti|non sono riuscit[oa] a risolvere|non riesco a risolvere il problema|non ho trovato una soluzione|i couldn't help|i could not help|i can't help|i cannot help|i'm unable to help|i am unable to help|i couldn't resolve|i could not resolve|i can't resolve|i cannot resolve|i haven't been able to solve)\b/i.test(text);
}
