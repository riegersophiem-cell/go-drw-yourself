import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { Join } from "./pages/Join";
import { RoomPage } from "./pages/RoomPage";
import "./App.css";

// DEV-ONLY route for deterministic Action Focus screenshots (see
// ACTION_FOCUS_POLISH_REPORT.md) — import.meta.env.DEV is a build-time
// constant Vite inlines; wrapping the dynamic import() in this dead branch
// means Vite/Rollup drops the whole branch (and never even emits a chunk
// for ActionPreview) from a production build, not just hides it at runtime.
const ActionPreview = import.meta.env.DEV ? lazy(() => import("./pages/dev/ActionPreview").then((m) => ({ default: m.ActionPreview }))) : null;
// Same dead-code-elimination guarantee as ActionPreview above, for the
// REMOTE_MOBILE_FULL / hand-size QA harness (MOBILE_HAND_UI_FIX_REPORT.md).
const MobilePreview = import.meta.env.DEV ? lazy(() => import("./pages/dev/MobilePreview").then((m) => ({ default: m.MobilePreview }))) : null;
// Same dead-code-elimination guarantee, for the pre-game Lobby QA harness (LOBBY_SESSION_FLOW_REPORT.md).
const LobbyPreview = import.meta.env.DEV ? lazy(() => import("./pages/dev/LobbyPreview").then((m) => ({ default: m.LobbyPreview }))) : null;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<Join />} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        {ActionPreview && <Route path="/dev/action-preview" element={<Suspense fallback={null}><ActionPreview /></Suspense>} />}
        {MobilePreview && <Route path="/dev/mobile-preview" element={<Suspense fallback={null}><MobilePreview /></Suspense>} />}
        {LobbyPreview && <Route path="/dev/lobby-preview" element={<Suspense fallback={null}><LobbyPreview /></Suspense>} />}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
