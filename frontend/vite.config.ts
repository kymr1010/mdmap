import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { macaronVitePlugin } from "@macaron-css/vite";
import devtools from "solid-devtools/vite";

export default defineConfig({
  // `.env` lives at the monorepo root (shared with the backend / docker-compose),
  // one level above this frontend package, so load env files from there.
  envDir: "..",
  plugins: [
    devtools({
      /* features options - all disabled by default */
      autoname: true, // e.g. enable autoname
    }),
    macaronVitePlugin(),
    solid(),
  ],
});
