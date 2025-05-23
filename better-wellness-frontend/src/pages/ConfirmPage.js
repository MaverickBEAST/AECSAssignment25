// src/pages/ConfirmPage.js

import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import userService from "../services/userService";  // adjust path if needed

export default function ConfirmPage() {
  // If the user was redirected from registration, we can pre-fill the email:
  const { state } = useLocation();
  const [email, setEmail] = useState(state?.email || "");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleConfirm = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      // Use the confirm method from our userService
      const res = await userService.confirm(email, confirmationCode);
      setMessage("Your account has been confirmed! Redirecting to login…");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "2rem auto" }}>
      <h2>Confirm Your Account</h2>
      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      <form onSubmit={handleConfirm}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Confirmation Code:</label>
          <input
            type="text"
            value={confirmationCode}
            onChange={e => setConfirmationCode(e.target.value)}
            required
          />
        </div>
        <button type="submit">Confirm Account</button>
      </form>
    </div>
  );
}
