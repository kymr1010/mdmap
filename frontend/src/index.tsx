/* @refresh reload */
import { render } from "solid-js/web";
import "solid-devtools";
import "@yaireo/tagify/dist/tagify.css";
import "easymde/dist/easymde.min.css";
import "./Tag/tag.css";
import App from "./App.js";

const root = document.getElementById("root");

render(() => <App />, root);
