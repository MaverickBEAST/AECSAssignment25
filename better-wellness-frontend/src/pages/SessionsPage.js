// src/pages/SessionsPage.js
import React, { useState, useEffect, useContext } from "react";
import messagingService from "../services/messagingService";
import counsellorService from "../services/counsellorService";
import { AuthContext } from "../AuthContext";

function SessionsPage() {
  const { token, userInfo } = useContext(AuthContext);
  const [sessions, setSessions] = useState([]);
  const [availableCounsellors, setAvailableCounsellors] = useState([]);
  const [selectedCounsellor, setSelectedCounsellor] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [error, setError] = useState("");
  const [rescheduleData, setRescheduleData] = useState({}); // { session_id, newDate, newTime }

  // Helper function to capitalize a status string
  const capitalizeStatus = (status) => {
    if (!status) return "";
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  // Fetch sessions for the current user
  const fetchSessions = async () => {
    try {
      // Assuming userInfo.email is used as the customer_id.
      const data = await messagingService.getSessions(token, { customerId: userInfo.email });
      setSessions(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  // Fetch available counsellors for the dropdown
  const fetchCounsellors = async () => {
    try {
      const data = await counsellorService.getCounsellors(token);
      setAvailableCounsellors(data);
    } catch (err) {
      console.log("Error fetching counsellors", err);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchCounsellors();
  }, [token]);

  // Book a new session using the selected counsellor, date, and time.
  const handleBookSession = async () => {
    setError("");
    if (!selectedCounsellor || !selectedDate || !selectedTime) {
      setError("Please select a counsellor, date, and time.");
      return;
    }
    try {
      await messagingService.bookSession(token, {
        customer_id: userInfo.email,
        counsellor_id: selectedCounsellor,
        date_time: selectedDate,        // Date part (YYYY-MM-DD)
        session_time: selectedTime,     // Time part (HH:MM)
        created_at: new Date().toISOString(),
        status: "booked"
      });
      // Clear inputs and refresh sessions
      setSelectedCounsellor("");
      setSelectedDate("");
      setSelectedTime("");
      fetchSessions();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  // Cancel a session by updating its status to "cancelled"
  const handleCancelSession = async (sessionId) => {
    setError("");
    try {
      await messagingService.updateSession(token, sessionId, { status: "cancelled" });
      fetchSessions();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  // Initiate reschedule mode for a session
  const handleInitiateReschedule = (session) => {
    setRescheduleData({
      session_id: session.session_id,
      newDate: session.date_time,
      newTime: session.session_time
    });
  };

  // Update rescheduled session details
  const handleRescheduleSession = async () => {
    const { session_id, newDate, newTime } = rescheduleData;
    if (!newDate || !newTime) {
      setError("Please provide both new date and time for rescheduling.");
      return;
    }
    setError("");
    try {
      await messagingService.updateSession(token, session_id, {
        date_time: newDate,
        session_time: newTime
      });
      setRescheduleData({});
      fetchSessions();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div>
      <h2>Book a Session</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div>
        <label>Select a Counsellor:</label>
        <select value={selectedCounsellor} onChange={(e) => setSelectedCounsellor(e.target.value)}>
          <option value="">-- Select --</option>
          {availableCounsellors.map((c) => (
            <option key={c.counsellor_id || c.email} value={c.counsellor_id || c.email}>
              {c.name} ({c.specialization})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>Select Date:</label>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
      </div>
      <div>
        <label>Select Time:</label>
        <input type="time" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} />
      </div>
      <button onClick={handleBookSession}>Book Session</button>

      <h3>Your Sessions</h3>
      {sessions.length ? (
        <ul style={{ listStyleType: "none", padding: 0 }}>
          {sessions.map((sess) => (
            <li
              key={sess.session_id}
              style={{
                padding: "0.5rem",
                marginBottom: "0.5rem",
                border: "1px solid #ccc",
                backgroundColor:
                  sess.status === "booked" ? "#e0ffe0" : "#f0f0f0" // Active sessions in light green
              }}
            >
              <div>
                <strong>Session with:</strong> {sess.counsellor_id}<br />
                <strong>Date:</strong> {sess.date_time} <strong>Time:</strong> {sess.session_time}<br />
                <strong>Status:</strong> {capitalizeStatus(sess.status)}
              </div>
              {sess.status === "booked" && sess.customer_id === userInfo.email && (
                <div style={{ marginTop: "0.5rem" }}>
                  <button onClick={() => handleCancelSession(sess.session_id)}>Cancel</button>
                  <button onClick={() => handleInitiateReschedule(sess)} style={{ marginLeft: "1rem" }}>
                    Reschedule
                  </button>
                </div>
              )}
              {rescheduleData.session_id === sess.session_id && (
                <div style={{ marginTop: "0.5rem" }}>
                  <label>New Date:</label>
                  <input
                    type="date"
                    value={rescheduleData.newDate}
                    onChange={(e) =>
                      setRescheduleData({ ...rescheduleData, newDate: e.target.value })
                    }
                  />
                  <label>New Time:</label>
                  <input
                    type="time"
                    value={rescheduleData.newTime}
                    onChange={(e) =>
                      setRescheduleData({ ...rescheduleData, newTime: e.target.value })
                    }
                  />
                  <button onClick={handleRescheduleSession}>Update</button>
                  <button onClick={() => setRescheduleData({})} style={{ marginLeft: "1rem" }}>
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No sessions booked.</p>
      )}
    </div>
  );
}

export default SessionsPage;
