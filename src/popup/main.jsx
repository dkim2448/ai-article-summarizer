// handles the multi-entry-point chrome extension build:
// npm install -D @crxjs/vite-plugin

// gives you the icons (copy, gear, sun/moon, etc.)
// npm install lucide-react

import { createRoot } from "react-dom/client";
import Popup from "./Popup";

createRoot(document.getElementById("root")).render(<Popup />);
