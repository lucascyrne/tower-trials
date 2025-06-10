import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/resources/auth/auth-hook';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PWAStatus } from '@/components/PWAStatus';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { IUser } from '@/resources/user/user-model';
import { userService } from '@/resources/user/user.service';

const profileSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  tipo_pessoa: z.enum(['PF', 'PJ']),
  documento: z.string().optional(),
  telefone: z.string().optional(),
  data_nascimento: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<IUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nome: '',
      tipo_pessoa: 'PF',
    },
  });

  // Carregar perfil do usuário
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await userService.getUserProfile();

        if (error) {
          toast.error('Erro', {
            description: error,
          });
          return;
        }

        if (data) {
          setUserProfile(data);
          form.reset({
            nome: data.nome,
            tipo_pessoa: data.tipo_pessoa,
            documento: data.documento,
            telefone: data.telefone,
            data_nascimento: data.data_nascimento,
          });
        }
      } catch (error) {
        toast.error('Erro', {
          description:
            error instanceof Error ? error.message : 'Não foi possível carregar seu perfil',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [form]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user?.id || !userProfile) return;

    try {
      const { error } = await userService.updateUser(user.id, {
        ...data,
        data_nascimento: data.data_nascimento ? new Date(data.data_nascimento) : undefined,
        imagemPerfil: pendingFile || undefined,
      });

      if (error) throw new Error(error);

      // Recarregar perfil
      const { data: updatedProfile, error: loadError } = await userService.getUserProfile();
      if (loadError) throw new Error(loadError);
      if (updatedProfile) setUserProfile(updatedProfile);

      toast.success('Sucesso', {
        description: 'Perfil atualizado com sucesso!',
      });

      // Limpar arquivo pendente
      setPendingFile(null);
    } catch (error) {
      toast.error('Erro', {
        description: error instanceof Error ? error.message : 'Erro ao atualizar perfil',
      });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setPendingFile(file);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Carregando...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header padronizado */}
      <div className="space-y-3 sm:space-y-4 mb-6">
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: '/game' })}
            className="self-start"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Voltar ao Menu</span>
            <span className="sm:hidden">Voltar</span>
          </Button>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Perfil</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Gerencie suas informações pessoais
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Foto de Perfil</CardTitle>
            <CardDescription>Atualize sua foto de perfil</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={userProfile?.imagem_perfil_url} />
                <AvatarFallback>{userProfile?.nome?.charAt(0)}</AvatarFallback>
              </Avatar>
              <Input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="max-w-xs"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
            <CardDescription>Atualize suas informações pessoais</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tipo_pessoa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Pessoa *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo de pessoa" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PF">Pessoa Física</SelectItem>
                            <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="documento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{form.watch('tipo_pessoa') === 'PF' ? 'CPF' : 'CNPJ'}</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="data_nascimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit">Salvar</Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Status PWA para debug */}
        <PWAStatus />
      </div>
    </div>
  );
}
