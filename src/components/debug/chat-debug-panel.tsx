"use client";

import { useState, useEffect } from "react";

type DebugLog = {
  timestamp: number;
  level: "log" | "error" | "warn";
  tag: string;
  message: string;
  data?: any;
};

const MAX_LOGS = 50;
let debugLogs: DebugLog[] = [];

// Override console methods to capture logs
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args: any[]) => {
    originalLog(...args);
    const message = String(args[0] ?? "");
    if (message.startsWith("[")) {
      const tag = message.match(/\[(.*?)\]/)?.[1] || "LOG";
      debugLogs.push({
        timestamp: Date.now(),
        level: "log",
        tag,
        message,
        data: args.slice(1),
      });
      if (debugLogs.length > MAX_LOGS) debugLogs.shift();
    }
  };

  console.error = (...args: any[]) => {
    originalError(...args);
    const message = String(args[0] ?? "");
    if (message.startsWith("[")) {
      const tag = message.match(/\[(.*?)\]/)?.[1] || "ERROR";
      debugLogs.push({
        timestamp: Date.now(),
        level: "error",
        tag,
        message,
        data: args.slice(1),
      });
      if (debugLogs.length > MAX_LOGS) debugLogs.shift();
    }
  };

  console.warn = (...args: any[]) => {
    originalWarn(...args);
    const message = String(args[0] ?? "");
    if (message.startsWith("[")) {
      const tag = message.match(/\[(.*?)\]/)?.[1] || "WARN";
      debugLogs.push({
        timestamp: Date.now(),
        level: "warn",
        tag,
        message,
        data: args.slice(1),
      });
      if (debugLogs.length > MAX_LOGS) debugLogs.shift();
    }
  };
}

export function ChatDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<DebugLog[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setLogs([...debugLogs]);
    }, 500);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-black/80 text-white px-3 py-1 rounded text-xs hover:bg-black/90"
      >
        {isOpen ? "🔴 Debug OFF" : "🟢 Debug ON"}
      </button>

      {isOpen && (
        <div className="mt-2 bg-black/95 text-white rounded border border-blue-500/50 max-w-md max-h-96 overflow-auto text-xs font-mono">
          <div className="sticky top-0 bg-black/90 border-b border-blue-500/30 p-2 flex justify-between">
            <span>Chat Debug Logs ({logs.length})</span>
            <button
              onClick={() => {
                debugLogs = [];
                setLogs([]);
              }}
              className="hover:bg-white/10 px-2 py-1 rounded"
            >
              Clear
            </button>
          </div>

          <div className="p-2 space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-500">Pas de logs...</div>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={`${
                    log.level === "error"
                      ? "text-red-400"
                      : log.level === "warn"
                        ? "text-yellow-400"
                        : "text-green-400"
                  }`}
                >
                  <span className="text-gray-600">[{log.tag}]</span> {log.message}
                  {log.data && log.data.length > 0 && (
                    <div className="text-gray-500 ml-4">
                      {JSON.stringify(log.data[0], null, 2)
                        .split("\n")
                        .map((line, j) => (
                          <div key={j}>{line}</div>
                        ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
