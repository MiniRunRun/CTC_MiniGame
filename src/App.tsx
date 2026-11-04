// Top-level layout of the Flower Builder: slider panel on the left, 3D preview on the right.
import Panel from "./ui/Panel";
import Viewport from "./scene/Viewport";

export default function App() {
  return (
    <div className="app">
      <Panel />
      <main className="viewport">
        <Viewport />
      </main>
    </div>
  );
}
