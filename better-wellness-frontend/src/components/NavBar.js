// src/components/NavBar.js
import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";

function NavBar() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="navbar">
      <div>
        <Link to="/">Home</Link>
        {!token && (
          <>
            <Link to="/register">Register</Link>
            <Link to="/login">Login</Link>
          </>
        )}
        {token && (
          <>
            <Link to="/counsellors">Counsellors</Link>
            <Link to="/sessions">Sessions</Link>
            <Link to="/messages">Messages</Link>
          </>
        )}
      </div>
      {token && <button onClick={handleLogout}>Log Out</button>}
    </div>
  );
}

export default NavBar;
