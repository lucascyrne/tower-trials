export const formatPhoneNumber = (value: string): string => {
  // Remove todos os caracteres não numéricos
  const numbers = value.replace(/\D/g, '');

  // Verifica se é celular (11 dígitos) ou telefone fixo (10 dígitos)
  const isCellPhone = numbers.length === 11;

  if (!numbers) return '';

  // Formata conforme o tipo de telefone
  if (isCellPhone) {
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  // Formato para telefone fixo
  return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
};

export const normalizePhoneNumber = (value: string): string => {
  return value.replace(/\D/g, '');
};

export const validatePhoneNumber = (phone: string): boolean => {
  const numbers = phone.replace(/\D/g, '');
  return numbers.length === 10 || numbers.length === 11;
};

// Máscara para uso com react-hook-form
export const phoneNumberMask = (value: string): string => {
  const normalized = normalizePhoneNumber(value);
  return formatPhoneNumber(normalized);
};
