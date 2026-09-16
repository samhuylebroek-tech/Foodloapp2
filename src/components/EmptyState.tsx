import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-12 text-center">
      {icon ? (
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
          {icon}
        </div>
      ) : null}
      <h2 className="text-2xl font-semibold">{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-sm text-base text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}