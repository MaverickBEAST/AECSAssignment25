// src/pages/ConfirmPage.js
import React, { useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";

function ConfirmPage() {
  // If the user was redirected from registration, we can pre-fill the email:
  const { state } = useLocation();
  const [email, setEmail] = useState(state && state.email ? state.email : "");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleConfirm = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const res = await axios.post("http://localhost:5000/confirm", {
        email,
        confirmation_code: confirmationCode,
      });
      setMessage("Your account has been confirmed! Redirecting to login...");
      // After confirmation, redirect to login page after a short delay:
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div>
      <h2>Confirm Your Account</h2>
      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      <form onSubmit={handleConfirm}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Confirmation Code:</label>
          <input
            type="text"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            required
          />
        </div>
        <button type="submit">Confirm Account</button>
      </form>
    </div>
  );
}

export default ConfirmPage;
