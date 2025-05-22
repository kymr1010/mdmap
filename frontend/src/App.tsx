import { createSignal, onMount } from "solid-js";
// import init from "@memo-app/wasm";
import { CardContainer } from "./CardContainer/CardContainer.jsx";

function App() {
  onMount(async () => {
    const res = await fetch("http://localhost:8082/");
    const text = await res.text();
    console.log(text); // "Hello, World! 🎉"
    // init();
  });

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
      <CardContainer position={{ x: 0, y: 0 }}></CardContainer>
    </div>
  );
}

export default App;
