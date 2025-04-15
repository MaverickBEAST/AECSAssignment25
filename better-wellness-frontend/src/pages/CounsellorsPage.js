// src/pages/CounsellorsPage.js
import React, { useEffect, useState, useContext } from "react";
import counsellorService from "../services/counsellorService";
import { AuthContext } from "../AuthContext";

function CounsellorsPage() {
  const { token } = useContext(AuthContext);
  const [counsellors, setCounsellors] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCounsellors = async () => {
      try {
        const data = await counsellorService.getCounsellors(token);
        setCounsellors(data);
      } catch (err) {
        setError(err.response?.data?.error || err.message);
      }
    };

    fetchCounsellors();
  }, [token]);

  // Styles for the vertical list with borders
  const listContainerStyle = {
    margin: "1rem 0",
    padding: 0,
    listStyleType: "none",
  };

  const listItemStyle = {
    border: "1px solid #ddd",    // Border added
    borderRadius: "4px",          // Slight rounding of corners
    padding: "0.75rem",           // Padding inside each item
    marginBottom: "0.75rem",      // Spacing between items
    backgroundColor: "#fff"
  };

  const titleStyle = {
    fontSize: "1.1rem",
    margin: "0 0 0.5rem 0",
    color: "#333",
  };

  const detailStyle = {
    fontSize: "0.9rem",
    margin: "0.25rem 0",
    color: "#666",
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>Counsellors</h2>
      {error && <p style={{ color: "red", textAlign: "center" }}>Error: {error}</p>}
      {counsellors.length ? (
        <ul style={listContainerStyle}>
          {counsellors.map((counsellor) => (
            <li key={counsellor.counsellor_id || counsellor.email} style={listItemStyle}>
              <span style={titleStyle}>{counsellor.name}</span>
              <br />
              <span style={detailStyle}>
                <strong>Specialization:</strong> {counsellor.specialization}
              </span>
              <br />
              <span style={detailStyle}>
                <strong>Email:</strong> {counsellor.email}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ textAlign: "center" }}>No counsellors available.</p>
      )}
    </div>
  );
}

export default CounsellorsPage;
