import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@blog-editor/content-render/post.css";
import "../src/editor.css";
import "../src/editor-screen.css";
import "../src/text-toolbar.css";
import "./playground.css";
import { Playground } from "./Playground";

const root = document.getElementById("root");
if (root === null) throw new Error("playground: #root가 없다");

createRoot(root).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
);
