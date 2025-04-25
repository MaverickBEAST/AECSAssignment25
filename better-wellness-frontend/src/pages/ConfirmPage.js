// src/pages/ConfirmPage.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";

const BASE_URL = "https://user.betterhealthservices.42web.io";

export default function ConfirmPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const qs = new URLSearchParams(search);
  const email = qs.get("email") || "";
  const code  = qs.get("code")  || "";

  const [status, setStatus] = useState("Verifying…");
  const [error,  setError]  = useState("");

  useEffect(() => {
    // if either param is missing, show an error
    if (!email || !code) {
      setError("Invalid confirmation link.");
      setStatus("");
      return;
    }

    // auto-confirm on mount
    axios
      .post(`${BASE_URL}/confirm`, { email, confirmation_code: code })
      .then(() => {
        setStatus("✅ Your account has been confirmed!");
        setTimeout(() => navigate("/login"), 2000);
      })
      .catch((err) => {
        const msg = err.response?.data?.error || err.message;
        setError(`Could not confirm: ${msg}`);
        setStatus("");
      });
  }, [email, code, navigate]);

  return (
    <div style={{ maxWidth: 400, margin: "2rem auto", textAlign: "center" }}>
      <h2>Account Confirmation</h2>
      {status && <p style={{ color: "green" }}>{status}</p>}
      {error  && <p style={{ color: "red"   }}>{error }</p>}
      {!status && !error && <p>Waiting for confirmation…</p>}
    </div>
  );
}
