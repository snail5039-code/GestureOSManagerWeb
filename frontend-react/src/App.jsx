import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Test from "./pages/Test.jsx";
import Camera from "./pages/Camera.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/Home" element={<Home />} />
      <Route path="/test" element={<Test />} />
      <Route path="/camera" element={<Camera />} />
    </Routes>
  );
}
