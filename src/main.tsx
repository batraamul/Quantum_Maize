import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "./styles/global.css";
import { setupMonaco } from "./editor/monacoSetup";
import { App } from "./app/App";
import { invoke } from "@tauri-apps/api/core";

// Mirror webview errors to the backend log (visible in terminal/system logs).
const forward = (level: string, args: unknown[]) => {
  const text = args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}\n${a.stack ?? ""}` : typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  invoke("log_frontend", { level, message: text }).catch(() => {});
};
for (const level of ["error", "warn"] as const) {
  const orig = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    orig(...args);
    forward(level, args);
  };
}
window.addEventListener("error", (e) => forward("error", [e.error ?? e.message]));
window.addEventListener("unhandledrejection", (e) => forward("error", ["Unhandled rejection:", e.reason]));

setupMonaco();
document.documentElement.dataset.theme = "dark";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
