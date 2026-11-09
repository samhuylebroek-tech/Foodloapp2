import type { ReactNode } from "react";

/** Lege staat (V2): rustig paneel, rond icoon, één zin uitleg en de volgende stap. */
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
    <div className="flex flex-col items-center paneel px-5 py-9 text-center">
      {icon ? (
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-secondary text-primary [&_svg]:size-8">
          {icon}
        </div>
      ) : null}
      <h2 className="text-sectietitel">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-sm text-base text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6 w-full max-w-sm">{action}</div> : null}
    </div>
  );
}
