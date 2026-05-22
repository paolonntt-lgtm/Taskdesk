import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export interface EntityTerm {
  singular: string;
  plural: string;
  singularLower: string;
  pluralLower: string;
  navAll: string;
  navNew: string;
  articleIndef: string;
}

export function useEntityTerm(): EntityTerm {
  const { user } = useAuth();
  const { t } = useLanguage();
  const businessType = (user as any)?.businessType ?? 'it_support';
  const map = t.entityTerms as Record<string, EntityTerm>;
  return map[businessType] ?? map['it_support'];
}
