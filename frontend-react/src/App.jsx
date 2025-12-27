import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Test from "./pages/Test.jsx";
import Camera from "./pages/Camera.jsx";
import TranslationLogPanel from "./components/TranslationLogPanel.jsx";
import CallRoom from "./pages/CallRoom.jsx";
import CallLobby from "./pages/CallLobby.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/Home" element={<Home />} />
      <Route path="/test" element={<Test />} />
      <Route path="/camera" element={<Camera />} />
      <Route path="/translationLogPanel" element={<TranslationLogPanel />} />
      <Route path="/call/:roomId" element={<CallRoom />} />
      <Route path="/callLobby" element={<CallLobby />} /> 
    </Routes>
  );
}
