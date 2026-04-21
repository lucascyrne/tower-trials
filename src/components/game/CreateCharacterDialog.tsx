'use client';

import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { CharacterNameValidation } from '@/resources/game/use-character-name-validation';

export interface CreateCharacterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (name: string) => void;
  nameValidation: CharacterNameValidation;
  description: ReactNode;
  showNameRulesWhenEmpty?: boolean;
  extraCanSubmit?: boolean;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function CreateCharacterDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  nameValidation,
  description,
  showNameRulesWhenEmpty = false,
  extraCanSubmit = true,
  onSubmit,
  isSubmitting,
}: CreateCharacterDialogProps) {
  const canSubmit =
    name.trim().length > 0 && nameValidation.isValid && !isSubmitting && extraCanSubmit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novo Personagem</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="relative">
              <Input
                placeholder="Nome do personagem (3-20 caracteres)"
                value={name}
                onChange={e => onNameChange(e.target.value)}
                className={`pr-10 ${
                  name.trim()
                    ? nameValidation.isValid
                      ? 'border-green-500 focus:border-green-500'
                      : 'border-red-500 focus:border-red-500'
                    : ''
                }`}
                maxLength={20}
              />
              {name.trim() && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 transform">
                  {nameValidation.isValid ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              )}
            </div>

            {name.trim() && !nameValidation.isValid && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{nameValidation.error}</AlertDescription>
              </Alert>
            )}

            {nameValidation.suggestions && nameValidation.suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Sugestões de nomes:</p>
                <div className="flex flex-wrap gap-2">
                  {nameValidation.suggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => onNameChange(suggestion)}
                      className="text-xs"
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {showNameRulesWhenEmpty && !name.trim() && (
              <div className="bg-muted space-y-1 rounded-lg p-3 text-sm">
                <p className="mb-2 font-medium">Regras para o nome:</p>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>Entre 3 e 20 caracteres</li>
                  <li>Deve começar com uma letra</li>
                  <li>Apenas letras, números, espaços, hífen e apostrofe</li>
                  <li>Não pode ser apenas números</li>
                  <li>Não pode conter palavras ofensivas</li>
                  <li>Máximo 2 números consecutivos</li>
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-t-2 border-white"></div>
                Criando...
              </>
            ) : (
              'Criar Personagem'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
