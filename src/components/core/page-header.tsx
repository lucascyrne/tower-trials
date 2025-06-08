import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  className?: string;
}

export const PageHeader = ({ title, description, className }: PageHeaderProps) => {
  return (
    <div className={cn("space-y-1", className)}>
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}; 