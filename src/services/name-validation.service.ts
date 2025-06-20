interface NameValidationResult {
  isValid: boolean;
  error?: string;
  suggestions?: string[];
}

export class NameValidationService {
  // Blacklist de palavras ofensivas (português, inglês, espanhol)
  private static readonly BLACKLIST_WORDS = [
    // Português - palavras de baixo calão
    'porra',
    'merda',
    'caralho',
    'puta',
    'putaria',
    'viado',
    'bicha',
    'cu',
    'buceta',
    'piroca',
    'pinto',
    'rola',
    'foda',
    'foder',
    'fodido',
    'cuzao',
    'cuzão',
    'babaca',
    'otario',
    'otário',
    'idiota',
    'imbecil',
    'retardado',
    'mongoloide',
    'burro',
    'desgraça',
    'desgraçado',
    'filho da puta',
    'fdp',
    'vagabundo',
    'safado',
    'cachorro',
    'cadela',
    'prostituta',
    'vagabunda',
    'piranha',
    'galinha',

    // Inglês - palavras de baixo calão
    'fuck',
    'shit',
    'bitch',
    'damn',
    'hell',
    'ass',
    'asshole',
    'bastard',
    'crap',
    'piss',
    'dick',
    'cock',
    'pussy',
    'cunt',
    'whore',
    'slut',
    'fag',
    'faggot',
    'nigger',
    'retard',
    'moron',
    'idiot',
    'stupid',
    'gay',
    'lesbian',
    'homo',
    'nazi',
    'hitler',
    'rape',
    'kill',
    'murder',

    // Espanhol - palavras de baixo calão
    'mierda',
    'joder',
    'puta',
    'puto',
    'cabron',
    'cabrón',
    'pendejo',
    'idiota',
    'estupido',
    'estúpido',
    'culo',
    'coño',
    'verga',
    'chingar',
    'pinche',
    'mamada',
    'putada',
    'hijo de puta',
    'hdp',
    'marica',
    'maricon',
    'maricón',

    // Palavras relacionadas a drogas
    'droga',
    'cocaina',
    'heroina',
    'crack',
    'cocaine',
    'heroin',
    'drug',
    'dealer',
    'traficante',

    // Termos inadequados gerais
    'sexo',
    'sex',
    'porn',
    'porno',
    'nude',
    'naked',
    'xxx',
    'fetish',
    'admin',
    'moderador',
    'mod',
    'gm',
    'gamemaster',
    'suporte',
    'support',
    'oficial',
    'staff',
    'dev',
    'developer',
    'bot',
    'sistema',
    'system',
  ];

  // Palavras reservadas do sistema
  private static readonly RESERVED_WORDS = [
    'admin',
    'administrator',
    'moderador',
    'moderator',
    'mod',
    'gm',
    'gamemaster',
    'suporte',
    'support',
    'help',
    'ajuda',
    'oficial',
    'official',
    'staff',
    'dev',
    'developer',
    'sistema',
    'system',
    'bot',
    'null',
    'undefined',
    'test',
    'teste',
    'demo',
    'sample',
    'example',
    'exemplo',
    'guest',
    'visitante',
    'player',
    'jogador',
    'user',
    'usuario',
    'usuário',
    'npc',
    'monster',
    'monstro',
  ];

  // Padrões inadequados
  private static readonly INVALID_PATTERNS = [
    /^[0-9]+$/, // Apenas números
    /^[^a-zA-ZÀ-ÿ]/, // Não começa com letra
    /[^a-zA-ZÀ-ÿ0-9\s'-]/, // Caracteres especiais não permitidos
    /\d{3,}/, // Mais de 2 números consecutivos
    /(.)\1{3,}/, // Mais de 3 caracteres repetidos
    /^\s|\s$/, // Começa ou termina com espaço
    /\s{2,}/, // Múltiplos espaços
  ];

  /**
   * Validar nome de personagem
   * @param name Nome a ser validado
   * @returns Resultado da validação
   */
  static validateCharacterName(name: string): NameValidationResult {
    // Verificar se o nome foi fornecido
    if (!name || typeof name !== 'string') {
      return {
        isValid: false,
        error: 'Nome é obrigatório',
      };
    }

    // Limpar espaços desnecessários
    const cleanName = name.trim();

    // Verificar comprimento
    if (cleanName.length < 3) {
      return {
        isValid: false,
        error: 'Nome deve ter pelo menos 3 caracteres',
      };
    }

    if (cleanName.length > 20) {
      return {
        isValid: false,
        error: 'Nome deve ter no máximo 20 caracteres',
      };
    }

    // Verificar padrões inválidos
    for (const pattern of this.INVALID_PATTERNS) {
      if (pattern.test(cleanName)) {
        return {
          isValid: false,
          error: this.getPatternError(pattern),
        };
      }
    }

    // Verificar palavras da blacklist
    const nameWords = cleanName.toLowerCase().split(/[\s\-']+/);
    for (const word of nameWords) {
      if (this.BLACKLIST_WORDS.includes(word)) {
        return {
          isValid: false,
          error: 'Nome contém palavras inadequadas',
        };
      }
    }

    // Verificar se contém substring de palavra da blacklist
    const nameLower = cleanName.toLowerCase().replace(/[\s\-']/g, '');
    for (const blacklistWord of this.BLACKLIST_WORDS) {
      if (nameLower.includes(blacklistWord)) {
        return {
          isValid: false,
          error: 'Nome contém termos inadequados',
        };
      }
    }

    // Verificar palavras reservadas
    for (const reservedWord of this.RESERVED_WORDS) {
      if (nameLower.includes(reservedWord)) {
        return {
          isValid: false,
          error: 'Nome contém termos reservados do sistema',
        };
      }
    }

    // Verificar se há pelo menos uma letra
    if (!/[a-zA-ZÀ-ÿ]/.test(cleanName)) {
      return {
        isValid: false,
        error: 'Nome deve conter pelo menos uma letra',
      };
    }

    // Verificar proporção de números
    const letterCount = (cleanName.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
    const numberCount = (cleanName.match(/[0-9]/g) || []).length;

    if (numberCount > letterCount) {
      return {
        isValid: false,
        error: 'Nome não pode ter mais números que letras',
      };
    }

    // Nome válido
    return {
      isValid: true,
    };
  }

  /**
   * Obter mensagem de erro específica para cada padrão
   * @private
   */
  private static getPatternError(pattern: RegExp): string {
    const patternStr = pattern.toString();

    if (patternStr.includes('^[0-9]+$')) {
      return 'Nome não pode ser apenas números';
    }
    if (patternStr.includes('^[^a-zA-ZÀ-ÿ]')) {
      return 'Nome deve começar com uma letra';
    }
    if (patternStr.includes("[^a-zA-ZÀ-ÿ0-9\\s'\\-]")) {
      return 'Nome contém caracteres especiais não permitidos';
    }
    if (patternStr.includes('\\d{3,}')) {
      return 'Nome não pode ter mais de 2 números consecutivos';
    }
    if (patternStr.includes('(.)\\1{3,}')) {
      return 'Nome não pode ter mais de 3 caracteres iguais seguidos';
    }
    if (patternStr.includes('^\\s|\\s$')) {
      return 'Nome não pode começar ou terminar com espaços';
    }
    if (patternStr.includes('\\s{2,}')) {
      return 'Nome não pode ter espaços múltiplos';
    }

    return 'Nome contém formato inválido';
  }

  /**
   * Formatar nome corretamente
   * @param name Nome a ser formatado
   * @returns Nome formatado
   */
  static formatCharacterName(name: string): string {
    if (!name) return '';

    // Limpar espaços extras
    let formatted = name.trim().replace(/\s+/g, ' ');

    // Capitalizar primeira letra de cada palavra
    formatted = formatted.replace(/\b\w/g, char => char.toUpperCase());

    return formatted;
  }

  /**
   * Gerar sugestões de nomes alternativos
   * @param originalName Nome original que falhou na validação
   * @returns Lista de sugestões
   */
  static generateNameSuggestions(originalName: string): string[] {
    const suggestions: string[] = [];
    const cleanName = originalName.replace(/[^a-zA-ZÀ-ÿ]/g, '');

    if (cleanName.length >= 3) {
      // Adicionar números no final
      for (let i = 1; i <= 3; i++) {
        const randomNum = Math.floor(Math.random() * 100);
        suggestions.push(this.formatCharacterName(cleanName + randomNum));
      }

      // Adicionar sufixos comuns
      const suffixes = ['Jr', 'II', 'III', 'X', 'Prime', 'Neo'];
      for (const suffix of suffixes.slice(0, 2)) {
        suggestions.push(this.formatCharacterName(cleanName + suffix));
      }
    }

    // Nomes genéricos seguros se não conseguir gerar do original
    if (suggestions.length === 0) {
      const genericNames = [
        'Aventureiro',
        'Guerreiro',
        'Explorador',
        'Heroi',
        'Campeao',
        'Bravo',
        'Valente',
        'Nobre',
        'Lenda',
        'Mestre',
      ];

      for (let i = 0; i < 3; i++) {
        const randomName = genericNames[Math.floor(Math.random() * genericNames.length)];
        const randomNum = Math.floor(Math.random() * 1000);
        suggestions.push(`${randomName}${randomNum}`);
      }
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Verificar se o nome é muito similar a nomes existentes
   * @param name Nome a verificar
   * @param existingNames Lista de nomes existentes
   * @returns Se é muito similar
   */
  static isTooSimilar(name: string, existingNames: string[]): boolean {
    const nameLower = name.toLowerCase().replace(/[^a-zA-ZÀ-ÿ0-9]/g, '');

    for (const existingName of existingNames) {
      const existingLower = existingName.toLowerCase().replace(/[^a-zA-ZÀ-ÿ0-9]/g, '');

      // Verificar se são idênticos sem considerar case e caracteres especiais
      if (nameLower === existingLower) {
        return true;
      }

      // Verificar similaridade usando distância de Levenshtein simples
      if (this.calculateSimilarity(nameLower, existingLower) > 0.8) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calcular similaridade entre duas strings (0-1)
   * @private
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calcular distância de Levenshtein
   * @private
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}
