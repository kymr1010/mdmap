import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { macaronVitePlugin } from "@macaron-css/vite";
import devtools from "solid-devtools/vite";

export default defineConfig({
  plugins: [
    devtools({
      /* features options - all disabled by default */
      autoname: true, // e.g. enable autoname
    }),
    macaronVitePlugin(),
    solid(),
  ],
});
