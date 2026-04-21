'use client';

import { useEffect, useState } from 'react';
import { NameValidationService } from './name-validation.service';

export interface CharacterNameValidation {
  isValid: boolean;
  error?: string;
  suggestions?: string[];
}

/**
 * Valida o nome em tempo real. Para evitar revalidações desnecessárias,
 * memoize `existingNames` no componente pai (ex.: useMemo a partir da lista de personagens).
 */
export function useCharacterNameValidation(
  rawName: string,
  existingNames: string[],
): CharacterNameValidation {
  const [validation, setValidation] = useState<CharacterNameValidation>({ isValid: true });

  useEffect(() => {
    if (!rawName.trim()) {
      setValidation({ isValid: true });
      return;
    }

    const base = NameValidationService.validateCharacterName(rawName);

    if (base.isValid && existingNames.length > 0) {
      const formattedName = NameValidationService.formatCharacterName(rawName);
      if (NameValidationService.isTooSimilar(formattedName, existingNames)) {
        setValidation({
          isValid: false,
          error: 'Nome muito similar a um personagem existente',
          suggestions: NameValidationService.generateNameSuggestions(formattedName),
        });
        return;
      }
    }

    setValidation(base);
  }, [rawName, existingNames]);

  return validation;
}
