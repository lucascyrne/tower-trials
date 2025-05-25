import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatar números grandes com sufixos (k, M, B)
 * @param num Número a ser formatado
 * @param precision Precisão decimal (padrão: 1)
 * @returns String formatada
 */
export function formatLargeNumber(num: number, precision: number = 1): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(precision).replace(/\.0+$/, '') + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(precision).replace(/\.0+$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(precision).replace(/\.0+$/, '') + 'k';
  }
  return num.toLocaleString('pt-BR');
}

/**
 * Formatar moeda brasileira
 * @param value Valor a ser formatado
 * @returns String formatada como moeda
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/**
 * Formatar porcentagem
 * @param value Valor decimal (0.5 = 50%)
 * @param precision Precisão decimal (padrão: 1)
 * @returns String formatada como porcentagem
 */
export function formatPercentage(value: number, precision: number = 1): string {
  return (value * 100).toFixed(precision) + '%';
}
