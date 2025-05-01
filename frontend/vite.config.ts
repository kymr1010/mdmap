import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { macaronVitePlugin } from "@macaron-css/vite";

export default defineConfig({
  plugins: [macaronVitePlugin(), solid()],
});
