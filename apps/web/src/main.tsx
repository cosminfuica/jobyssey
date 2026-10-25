import { AppProviders, createAppRouter } from "@jobyssey/web-shell/client";
import { createRoot } from "react-dom/client";
import { home, webFeatures } from "./features.tsx";
import "./styles.css";

const router = createAppRouter({ features: webFeatures, home });
const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root element");
createRoot(root).render(<AppProviders router={router} />);
