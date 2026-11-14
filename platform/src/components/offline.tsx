"use client";

import { useEffect, useState } from "react";

// Must match the name in public/sw.js.
const PAGES_CACHE = "time-pages-v1";

// Starts the service worker (public/sw.js), shows a banner while there is no connection,
// and removes saved lessons from the phone whenever nobody is signed in.
export function OfflineSupport({ signedIn }: { signedIn: boolean }) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* the app works without it */ });
    }
  }, []);

  useEffect(() => {
    // Saved lessons belong to the person who saved them: signing out clears them.
    if (!signedIn && "caches" in window && navigator.onLine) caches.delete(PAGES_CACHE).catch(() => {});
  }, [signedIn]);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  if (!offline) return null;
  return (
    <p className="offline-bar" role="status">
      You have no connection. You can read saved lessons. Marking lessons complete, handing in work and payments need a connection.
    </p>
  );
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "done"; saved: number; failed: number } | { kind: "error" };

// Saves a class's lessons on this phone so they can be read without a connection.
export function SaveForOffline({ paths, lessons }: { paths: string[]; lessons: number }) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  useEffect(() => { setSupported(process.env.NODE_ENV === "production" && "serviceWorker" in navigator); }, []);
  if (!supported || lessons === 0) return null;

  async function save() {
    setState({ kind: "saving" });
    try {
      const registration = await navigator.serviceWorker.ready;
      const result = await new Promise<{ saved: number; failed: number }>((resolve, reject) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => resolve(e.data);
        setTimeout(() => reject(new Error("timeout")), 120_000);
        registration.active?.postMessage({ type: "save", paths }, [channel.port2]);
      });
      setState({ kind: "done", ...result });
    } catch {
      setState({ kind: "error" });
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div>
        <button className="btn ghost" type="button" onClick={save} disabled={state.kind === "saving"}>
          {state.kind === "saving" ? "Saving lessons…" : "Save lessons for offline"}
        </button>
      </div>
      <p className="small muted" role="status">
        {state.kind === "idle" && "Saves this class's lessons on this phone, so you can read them with no connection."}
        {state.kind === "saving" && "Keep this page open until saving has finished."}
        {state.kind === "done" && state.failed === 0 && `Saved. ${lessons === 1 ? "The lesson" : `All ${lessons} lessons`} in this class can now be read on this phone with no connection.`}
        {state.kind === "done" && state.failed > 0 && `Some pages could not be saved (${state.failed}). Check your connection and try again.`}
        {state.kind === "error" && "The lessons could not be saved. Check your connection and try again."}
      </p>
    </div>
  );
}
