/**
 * Format a phone number to (99) 99999-9999
 * @param phoneNumber
 * @returns
 */
export const formatPhoneNumber = (phoneNumber?: string) => {
  if (!phoneNumber) {
    return '';
  }

  if (phoneNumber.length < 10) {
    return phoneNumber;
  }

  if (phoneNumber.length > 11) {
    return phoneNumber;
  }

  const cleaned = ('' + phoneNumber).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{2})(\d{4,5})(\d{4})$/);
  if (match) {
    return '(' + match[1] + ') ' + match[2] + '-' + match[3];
  }
  return null;
};

/**
 * Format a CPF to 999.999.999-99
 * @param cpf
 * @returns
 */
export const formatCPF = (cpf: string) => {
  if (!cpf) {
    return '';
  }

  if (cpf.length < 11) {
    return cpf;
  }

  const cleaned = ('' + cpf).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{3})(\d{2})$/);
  if (match) {
    return match[1] + '.' + match[2] + '.' + match[3] + '-' + match[4];
  }
  return null;
};
