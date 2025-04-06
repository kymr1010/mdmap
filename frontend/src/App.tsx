import { createSignal, onMount } from "solid-js";
import init from "@memo-app/canvas-wasm";

function App() {
  onMount(async () => {
    const res = await fetch("http://localhost:8082/");
    const text = await res.text();
    console.log(text); // "Hello, World! 🎉"
    init();
  });

  return (
    <>
      <p class="read-the-docs">hello</p>
      <canvas id="my_canvas" width="640" height="480"></canvas>
    </>
  );
}

export default App;
