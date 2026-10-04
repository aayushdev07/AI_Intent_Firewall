import * as React from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <h1 className="font-display text-[28px] font-medium tracking-tight text-fog">{title}</h1>
        {description ? <p className="mt-1 text-sm leading-relaxed text-fog-dim">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function DbUnavailable({ message }: { message?: string }) {
  return (
    <div role="alert" className="rounded-lg border border-block/40 bg-block-bg p-4 text-sm text-fog">
      <p className="font-semibold text-block">Database unavailable</p>
      <p className="mt-1 text-fog-dim">
        {message ?? "IntentGuard could not read its SQLite database."} Run <code className="font-mono text-fog">npm run setup</code> (Prisma
        push + seed) and restart the dev server.
      </p>
    </div>
  );
}
