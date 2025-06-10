import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/403')({
  component: ForbiddenPage,
});

function ForbiddenPage() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <h1>
        A página que você tentou acessar não existe ou você não possui a permissão necessária.
      </h1>
    </div>
  );
}
