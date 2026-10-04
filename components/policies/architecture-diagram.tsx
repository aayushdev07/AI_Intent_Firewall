/** Static system architecture: where authority comes from and where execution is gated. */
const box = "rounded-md border px-3 py-2 text-center text-xs leading-snug";

function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-1 text-[11px] text-fog-mute" aria-hidden>
      <span className="h-4 w-px bg-steel-soft" />
      {label ? <span className="py-0.5">{label}</span> : null}
      <span className="-mt-px text-steel-soft">▼</span>
    </div>
  );
}

export function ArchitectureDiagram() {
  const stages = ["Validation (schema, strict args)", "Intent alignment", "Trajectory tracker", "Risk engine", "Policy engine (R1–R10, B1)", "Decision engine"];
  return (
    <figure aria-label="IntentGuard architecture" className="mx-auto max-w-3xl">
      <div className="flex flex-col items-center">
        <div className={`${box} w-64 border-steel-soft bg-ink-3 text-fog`}>User task (natural language)</div>
        <Arrow />
        <div className={`${box} w-80 border-steel-soft bg-ink-3 text-fog`}>
          Intent parser: agent model (any local OpenAI-compatible server), hardened by deterministic rules
          <div className="text-fog-mute">Rule-based parser when the model is offline</div>
        </div>
        <Arrow label="user confirms" />
        <div className={`${box} w-80 border-allow/50 bg-allow-bg text-fog`}>
          Original Intent: immutable, SHA-256 sealed
          <div className="text-fog-mute">The only source of authority</div>
        </div>
        <Arrow />
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className={`${box} border-warn/40 bg-warn-bg text-fog`}>
            External content (emails, files)
            <div className="text-fog-mute">Untrusted data, never authority</div>
          </div>
          <span className="text-fog-mute" aria-hidden>→</span>
          <div className={`${box} border-steel-soft bg-ink-3 text-fog`}>
            Orchestrator → Worker agent (any model)
            <div className="text-fog-mute">Proposes one action at a time. No execution rights.</div>
          </div>
        </div>
        <Arrow label="proposal" />
        <div className="w-full rounded-lg border-2 border-signal/60 bg-ink-2 p-3">
          <div className="mb-2 text-center text-xs font-semibold text-signal">IntentGuard (deterministic, no LLM in the decision path)</div>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stages.map((s, i) => (
              <li key={s} className={`${box} border-steel-line bg-ink-3 text-fog-dim`}>
                <span className="font-mono text-fog-mute">{i + 1}.</span> {s}
              </li>
            ))}
          </ol>
        </div>
        <Arrow label="decision" />
        <div className="grid w-full grid-cols-3 gap-3">
          <div className={`${box} border-allow/50 bg-allow-bg text-fog`}>
            <span className="font-mono font-semibold text-allow">ALLOW</span>
            <div className="text-fog-mute">Execution guard re-verifies, then the simulated tool runs</div>
          </div>
          <div className={`${box} border-warn/50 bg-warn-bg text-fog`}>
            <span className="font-mono font-semibold text-warn">WARN</span>
            <div className="text-fog-mute">Paused for a human: approve once or deny</div>
          </div>
          <div className={`${box} border-block/50 bg-block-bg text-fog`}>
            <span className="font-mono font-semibold text-block">BLOCK</span>
            <div className="text-fog-mute">Never executed. Fail-closed on any error.</div>
          </div>
        </div>
        <Arrow />
        <div className={`${box} w-full border-steel-soft bg-ink-3 text-fog`}>
          SQLite via Prisma: action receipts, risk assessments, violations, trajectory, provenance chain → dashboard
        </div>
      </div>
    </figure>
  );
}
