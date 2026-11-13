import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { useApp } from "../app/store";

export function Modal(props: { title: ReactNode; icon?: ReactNode; onClose?: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; bodyClass?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape" && props.onClose) {
        e.stopPropagation();
        props.onClose();
      }
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [props.onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose?.()}>
      <div className={"modal" + (props.wide ? " wide" : "")} role="dialog" aria-modal="true">
        <div className="modal-head">
          {props.icon}
          <h2>{props.title}</h2>
        </div>
        <div className={"modal-body " + (props.bodyClass ?? "")}>{props.children}</div>
        {props.footer && <div className="modal-foot">{props.footer}</div>}
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="switch" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function SeverityIcon({ s, size = 15 }: { s: "error" | "warning" | "info" | "success"; size?: number }) {
  if (s === "error") return <XCircle size={size} color="var(--danger)" />;
  if (s === "warning") return <AlertTriangle size={size} color="var(--warning)" />;
  if (s === "success") return <CheckCircle2 size={size} color="var(--success)" />;
  return <Info size={size} color="var(--info)" />;
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <SeverityIcon s={t.kind} size={18} />
          <div className="grow">
            <div className="tt">{t.title}</div>
            {t.detail && <div className="td">{t.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConfirmHost() {
  const req = useApp((s) => s.confirmReq);
  if (!req) return null;
  const cancel = req.buttons.find((b) => b.id === "cancel")?.id ?? req.buttons[0].id;
  return (
    <Modal
      title={req.title}
      icon={<AlertTriangle size={20} color="var(--warning)" />}
      onClose={() => req.resolve(cancel)}
      footer={req.buttons.map((b, i) => (
        <button key={b.id} autoFocus={i === req.buttons.length - 1} className={"btn " + (b.variant ?? "")} onClick={() => req.resolve(b.id)}>
          {b.label}
        </button>
      ))}
    >
      <div>{req.message}</div>
    </Modal>
  );
}

export function PromptHost() {
  const req = useApp((s) => s.promptReq);
  const [v, setV] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (req) {
      setV(req.initial);
      setTimeout(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        const dot = req.initial.lastIndexOf(".");
        el.setSelectionRange(0, dot > 0 ? dot : req.initial.length);
      }, 20);
    }
  }, [req]);
  if (!req) return null;
  const ok = () => req.resolve(v.trim() ? v.trim() : null);
  return (
    <Modal
      title={req.title}
      onClose={() => req.resolve(null)}
      footer={
        <>
          <button className="btn" onClick={() => req.resolve(null)}>
            Cancel
          </button>
          <button className="btn primary" onClick={ok} disabled={!v.trim()}>
            OK
          </button>
        </>
      }
    >
      <div className="field">
        <label>{req.label}</label>
        <input ref={ref} className="input prompt-input" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ok()} spellCheck={false} />
      </div>
    </Modal>
  );
}

export const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent);
export const mod = isMac ? "⌘" : "Ctrl+";
export function sc(s: string) {
  return isMac ? s.replace(/Ctrl\+/g, "⌘").replace(/Alt\+/g, "⌥").replace(/Shift\+/g, "⇧") : s;
}
