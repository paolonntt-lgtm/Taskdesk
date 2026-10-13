import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export interface EntityTerm {
  singular: string;
  plural: string;
  singularLower: string;
  pluralLower: string;
  grammaticalGender: 'masculine' | 'feminine';
  navAll: string;
  navNew: string;
  articleIndef: string;
}

export function useEntityTerm(): EntityTerm {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const businessType = (user as any)?.businessType ?? 'it_support';
  const overrideSingular = (user as any)?.entitySingular?.trim();
  const overridePlural = (user as any)?.entityPlural?.trim();

  if (overrideSingular) {
    const singular = overrideSingular;
    const plural = overridePlural || overrideSingular;
    const singularLower = singular.toLowerCase();
    const pluralLower = plural.toLowerCase();
    const grammaticalGender: EntityTerm['grammaticalGender'] =
      /e$/i.test(plural) || (!overridePlural && /a$/i.test(singular))
        ? 'feminine'
        : 'masculine';
    const startsWithVowel = /^[aeiouàèéìòùAEIOUÀÈÉÌÒÙ]/.test(singular);
    const endsWithA = singular.toLowerCase().endsWith('a');
    const articleIndef =
      lang === 'en'
        ? startsWithVowel ? 'an' : 'a'
        : startsWithVowel ? "un'" : endsWithA ? 'una' : 'un';
    const navAll =
      lang === 'en'
        ? `All ${plural}`
        : `Tutti i ${plural}`;
    const navNew =
      lang === 'en'
        ? `New ${singular}`
        : `Nuovo ${singular}`;
    return { singular, plural, singularLower, pluralLower, grammaticalGender, navAll, navNew, articleIndef };
  }

  const map = t.entityTerms as Record<string, EntityTerm>;
  return map[businessType] ?? map['it_support'];
}
