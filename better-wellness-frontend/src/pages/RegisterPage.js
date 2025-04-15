// src/pages/RegisterPage.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import userService from "../services/userService";

function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profileType, setProfileType] = useState("customer");
  const [specialization, setSpecialization] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      await userService.register({
        name,
        email,
        password,
        profile_type: profileType,
        specialization: profileType === "counsellor" ? specialization : undefined,
      });
      setSuccess("Registration successful! You can now log in.");
      // Optionally, redirect to login page after 2 seconds
      setSuccess("Registration successful! Please check your email for the confirmation code. Redirecting to confirmation page...");
      setTimeout(() => {
        navigate("/confirm", { state: { email } });
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div>
      <h2>Register</h2>
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name:</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label>Email:</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label>Password:</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div>
          <label>Profile Type:</label>
          <select value={profileType} onChange={(e) => setProfileType(e.target.value)}>
            <option value="customer">Customer</option>
            <option value="counsellor">Counsellor</option>
          </select>
        </div>
        {profileType === "counsellor" && (
          <div>
            <label>Specialization:</label>
            <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} required />
          </div>
        )}
        <button type="submit">Register</button>
      </form>
    </div>
  );
}

export default RegisterPage;
