// src/pages/MessagesPage.js
import React, { useState, useEffect, useContext } from "react";
import messagingService from "../services/messagingService";
import counsellorService from "../services/counsellorService";
import { AuthContext } from "../AuthContext";

function MessagesPage() {
  const { token, userInfo } = useContext(AuthContext);
  const [allMessages, setAllMessages] = useState([]);
  const [conversations, setConversations] = useState({});
  const [selectedConv, setSelectedConv] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");

  // State for new conversation mode
  const [isNewConvMode, setIsNewConvMode] = useState(false);
  const [newConvReceiver, setNewConvReceiver] = useState("");
  const [availableCounsellors, setAvailableCounsellors] = useState([]);

  // Fetch all messages for the logged-in user
  const fetchMessages = async () => {
    try {
      // Assuming userInfo.email is used as the unique identifier.
      const data = await messagingService.getMessages(token, userInfo.email);
      setAllMessages(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  // Group messages by conversation (using the other party's ID)
  const groupMessages = (msgs) => {
    const convs = {};
    msgs.forEach((msg) => {
      // Determine conversation key: if the current user is sender, use receiver; otherwise, use sender.
      const convKey = msg.sender_id === userInfo.email ? msg.receiver_id : msg.sender_id;
      if (!convs[convKey]) {
        convs[convKey] = [];
      }
      convs[convKey].push(msg);
    });
    // Sort messages in each conversation by timestamp.
    Object.keys(convs).forEach((key) => {
      convs[key].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    });
    return convs;
  };

  // Fetch available counsellors (for starting a new conversation)
  const fetchCounsellors = async () => {
    try {
      const data = await counsellorService.getCounsellors(token);
      setAvailableCounsellors(data);
    } catch (err) {
      console.log("Error fetching counsellors", err);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchCounsellors();
  }, [token]);

  useEffect(() => {
    if (allMessages.length) {
      const convs = groupMessages(allMessages);
      setConversations(convs);
      if (!selectedConv && Object.keys(convs).length > 0) {
        setSelectedConv(Object.keys(convs)[0]);
      }
    }
  }, [allMessages]);

  // Handle sending a new message in the selected conversation
  const handleSendMessage = async () => {
    if (!selectedConv || !newMessage) return;
    try {
      await messagingService.createMessage(token, {
        sender_id: userInfo.email,
        receiver_id: selectedConv,
        content: newMessage,
      });
      setNewMessage("");
      await fetchMessages();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  // Handle initiating a new conversation by showing the new conversation form
  const handleStartNewConversation = () => {
    setIsNewConvMode(true);
    setSelectedConv(null); // Clear any selected conversation.
  };

  // Confirm the new conversation selection; if conversation doesn't exist, create an empty entry.
  const handleNewConvConfirm = () => {
    if (!newConvReceiver) return;
    if (!conversations[newConvReceiver]) {
      setConversations((prev) => ({ ...prev, [newConvReceiver]: [] }));
    }
    setSelectedConv(newConvReceiver);
    setIsNewConvMode(false);
    setNewConvReceiver("");
  };

  // Render the conversation list (inbox view)
  const renderConversationList = () => {
    return (
      <div>
        <button onClick={handleStartNewConversation}>New Conversation</button>
        <ul style={{ listStyleType: "none", padding: 0 }}>
          {Object.keys(conversations).map((convKey) => {
            const msgs = conversations[convKey];
            const latestMsg = msgs[msgs.length - 1];
            return (
              <li
                key={convKey}
                onClick={() => {
                  setSelectedConv(convKey);
                  setIsNewConvMode(false);
                }}
                style={{
                  cursor: "pointer",
                  padding: "0.5rem",
                  backgroundColor: convKey === selectedConv ? "#e0e0e0" : "transparent",
                  borderBottom: "1px solid #ccc",
                }}
              >
                <strong>{convKey}</strong>
                <br />
                <small>
                  {latestMsg
                    ? latestMsg.content.substring(0, 30) + "..."
                    : "No messages yet"}
                </small>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  // Render the new conversation form including a Cancel option
  const renderNewConversationForm = () => {
    return (
      <div style={{ marginBottom: "1rem" }}>
        <h4>Start a New Conversation</h4>
        <select
          value={newConvReceiver}
          onChange={(e) => setNewConvReceiver(e.target.value)}
        >
          <option value="">-- Select a Counsellor --</option>
          {availableCounsellors.map((counsellor) => (
            <option
              key={counsellor.counsellor_id || counsellor.email}
              value={counsellor.counsellor_id || counsellor.email}
            >
              {counsellor.name} ({counsellor.specialization})
            </option>
          ))}
        </select>
        <button onClick={handleNewConvConfirm}>Start Conversation</button>
        <button
          onClick={() => {
            setIsNewConvMode(false);
            setNewConvReceiver("");
          }}
          style={{ marginLeft: "1rem" }}
        >
          Cancel
        </button>
      </div>
    );
  };

  // Render the message thread for the selected conversation
  const renderConversationThread = () => {
    if (!selectedConv) return <p>Select a conversation or start a new one.</p>;
    const msgs = conversations[selectedConv] || [];
    return (
      <div>
        {msgs.map((msg) => (
          <div key={msg.message_id} style={{ marginBottom: "0.5rem" }}>
            <strong>{msg.sender_id}</strong>: {msg.content} <br />
            <small>{new Date(msg.timestamp).toLocaleString()}</small>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", gap: "1rem" }}>
      <div
        style={{
          flex: "0 0 30%",
          borderRight: "1px solid #ccc",
          paddingRight: "1rem",
        }}
      >
        <h3>Inbox</h3>
        {isNewConvMode && renderNewConversationForm()}
        {renderConversationList()}
      </div>
      <div style={{ flex: "1", paddingLeft: "1rem" }}>
        <h3>Conversation with {selectedConv || "..."}</h3>
        {renderConversationThread()}
        <div style={{ marginTop: "1rem" }}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message here..."
            style={{ width: "80%" }}
          />
          <button
            onClick={handleSendMessage}
            style={{ marginLeft: "0.5rem" }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default MessagesPage;
