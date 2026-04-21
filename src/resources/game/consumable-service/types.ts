export interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export function extractErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
  }
  return fallbackMessage;
}
