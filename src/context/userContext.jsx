// src/context/userContext.jsx
import { createContext, useState, useEffect, useCallback } from "react";

export const UserContext = createContext();

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5275";

export function UserProvider({ children }) {
  // user state (you already had this)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved
      ? JSON.parse(saved)
      : {
          name: "",
          username: "",
          email: "",
          interests: [],
          subscription: "",
          location: "",
          role: "user",
          loggedIn: false,
        };
  });

  // token state (persisted)
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");

  // persist user
  useEffect(() => {
    localStorage.setItem("user", JSON.stringify(user));
  }, [user]);

  // persist token
  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  const updateUser = (updates) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  // --- NEW: Fetch /api/auth/me and normalize fields to UI keys ---
  const hydrateProfile = useCallback(
    async (activeToken) => {
      if (!activeToken) return;
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          method: "GET",
          headers: { Authorization: `Bearer ${activeToken}` },
        });

        if (!res.ok) {
          // Silently ignore; UI still has minimal user from login
          return;
        }

        const me = await res.json();

        // Normalize API -> UI keys:
        // fullName -> name
        // userName -> username
        // location stays the same
        setUser((prev) => ({
          ...prev,
          loggedIn: true,
          // keep existing values if present; prefer fresh /me values
          email: me?.email ?? prev.email ?? "",
          role: me?.role ?? prev.role ?? "user",
          name: me?.fullName ?? prev.name ?? "",
          username: me?.userName ?? prev.username ?? "",
          location: me?.location ?? prev.location ?? "",
          // keep city if you ever need to show it later (not rendered in profile)
          city: me?.city ?? prev.city ?? "",
        }));
      } catch {
        // no-op: avoid breaking UI if /me fails
      }
    },
    []
  );

  // --- NEW: On app load or whenever a token appears, hydrate the profile ---
  useEffect(() => {
    if (token) {
      hydrateProfile(token);
    }
  }, [token, hydrateProfile]);

  const logout = () => {
    setUser({
      name: "",
      username: "",
      email: "",
      interests: [],
      subscription: "",
      location: "",
      role: "user",
      loggedIn: false,
    });
    setToken("");
  };

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        updateUser,
        token,
        setToken,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}