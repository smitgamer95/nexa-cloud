import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ErrorBoundary } from "./components/common/ErrorBoundary.tsx";

// Remove the HTML loading screen once React takes over
const loader = document.getElementById('app-loading');
if (loader) {
  loader.style.transition = 'opacity 0.4s ease';
  loader.style.opacity = '0';
  setTimeout(() => loader.remove(), 420);
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <AppWrapper>
      <App />
    </AppWrapper>
  </ErrorBoundary>
);
