import { type Character } from '@/resources/character/character.model';
import { CharacterService } from '@/resources/character/character.service';
import { NameValidationService } from '@/resources/character/name-validation.service';

interface NameSimilarityValidationResult {
  isValid: boolean;
  error?: string;
  suggestions?: string[];
}

/**
 * Validar similaridade de nome de personagem
 * Função pura que verifica se um nome é muito similar aos existentes
 *
 * @param name - Nome a ser validado
 * @param userId - ID do usuário (para buscar personagens existentes)
 * @returns Resultado da validação com sugestões se inválido
 */
export async function validateCharacterNameSimilarity(
  name: string,
  userId: string
): Promise<NameSimilarityValidationResult> {
  const formattedName = NameValidationService.formatCharacterName(name);

  // Buscar personagens existentes do usuário
  const existingResponse = await CharacterService.getUserCharacters(userId);
  const existingCharacters: Character[] =
    existingResponse.success && existingResponse.data ? existingResponse.data : [];

  // Se não há personagens existentes, nome é válido
  if (existingCharacters.length === 0) {
    return { isValid: true };
  }

  // Verificar similaridade
  const existingNames = existingCharacters.map(c => c.name);
  const isTooSimilar = NameValidationService.isTooSimilar(formattedName, existingNames);

  if (isTooSimilar) {
    const suggestions = NameValidationService.generateNameSuggestions(formattedName);
    return {
      isValid: false,
      error: `Nome muito similar a um personagem existente. Sugestões: ${suggestions.join(', ')}`,
      suggestions,
    };
  }

  return { isValid: true };
}

/**
 * Validação completa de nome de personagem
 * Combina validação de formato e similaridade
 */
export async function validateCharacterNameComplete(
  name: string,
  userId: string
): Promise<NameSimilarityValidationResult> {
  // Validar formato básico
  const formatValidation = NameValidationService.validateCharacterName(name);
  if (!formatValidation.isValid) {
    return {
      isValid: false,
      error: formatValidation.error || 'Nome inválido',
    };
  }

  // Validar similaridade
  return validateCharacterNameSimilarity(name, userId);
}
