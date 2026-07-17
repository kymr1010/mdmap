/* @refresh reload */
import { render } from "solid-js/web";
import "solid-devtools";
import "@yaireo/tagify/dist/tagify.css";
import "easymde/dist/easymde.min.css";
import "./Tag/tag.css";
import App from "./App.js";

const root = document.getElementById("root");

render(() => <App />, root);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("failed to register service worker", error);
    });
  });
}
