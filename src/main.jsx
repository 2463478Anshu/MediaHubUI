// main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Navbar from "./components/navbar.jsx";
import { useLocation, BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes/appRoutes.jsx";
import { useState } from "react";
import { UserProvider } from "./context/userContext.jsx";
import Sidebar from "./components/sidebar.jsx";
import ToastStack from "./components/ToastStack.jsx";


function Layout() {
  const location = useLocation();

  const [loggedIn, setLoggedIn] = useState(
    localStorage.getItem("loggedIn") === "true"
  );

  const hideNavAndSidebar =
    location.pathname === "/login" || location.pathname === "/signup";

    const mainContentClass = 
      location.pathname === "/login" 
      ? "main-content login-page" 
      : location.pathname === "/signup" 
      ? "main-content signup-page" 
      : "main-content";

  return (
    <>
      {!hideNavAndSidebar && <Navbar />}

      {!hideNavAndSidebar && <Sidebar />}

      <div className={mainContentClass}>
        <AppRoutes
          setLoggedIn={(val) => {
            setLoggedIn(val);
            localStorage.setItem("loggedIn", val ? "true" : "false");
          }}
        />
      </div>
       
      <ToastStack />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <UserProvider>
        <Layout />
      </UserProvider>
    </BrowserRouter>
  </StrictMode>
);
