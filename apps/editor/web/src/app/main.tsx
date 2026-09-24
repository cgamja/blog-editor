import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { createQueryClient } from "./query-client";
import { router } from "./router";
import "@blog-editor/design-tokens/tokens.css";
import "../styles/app.css";

const container = document.getElementById("root");
if (container === null) throw new Error("web: #root가 없다(index.html)");

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
