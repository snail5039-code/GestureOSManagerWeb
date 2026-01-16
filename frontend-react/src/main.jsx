import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n/index.js";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import "./styles/GlobalStyles.css";
import AuthProvider from "./auth/AuthProvider.jsx";
import { ModalProvider } from "./context/ModalContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ModalProvider>
          <App />
        </ModalProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
