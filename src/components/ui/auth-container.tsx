interface AuthContainerProps {
  title: string;
  description?: string;
  form: React.ReactNode;
  footer?: React.ReactNode;
}

export default function AuthContainer({ title, description, form, footer }: AuthContainerProps) {
  return (
    <div className="w-full max-w-[400px] flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
        {description && (
          <p className="text-sm text-neutral-500">{description}</p>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {form}
        {footer}
      </div>
    </div>
  );
} 