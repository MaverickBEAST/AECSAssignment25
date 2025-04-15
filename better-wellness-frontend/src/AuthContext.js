// src/AuthContext.js
import React, { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);    // store the id_token
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    // Optionally retrieve token from localStorage on app load
    const savedToken = localStorage.getItem("idToken");
    const savedUser = localStorage.getItem("userInfo");
    if (savedToken) setToken(savedToken);
    if (savedUser) setUserInfo(JSON.parse(savedUser));
  }, []);

  const login = (idToken, userData) => {
    setToken(idToken);
    setUserInfo(userData);
    localStorage.setItem("idToken", idToken);
    localStorage.setItem("userInfo", JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUserInfo(null);
    localStorage.removeItem("idToken");
    localStorage.removeItem("userInfo");
  };

  return (
    <AuthContext.Provider value={{ token, userInfo, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
