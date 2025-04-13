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
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        "justify-content": "center",
        "align-items": "center",
      }}
    >
      <canvas id="my_canvas"></canvas>
    </div>
  );
}

export default App;
