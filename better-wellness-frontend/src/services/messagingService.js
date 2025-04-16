// src/services/messagingService.js
import axios from "axios";

const BASE_URL = "http://messaging.betterhealthservices.42web.io";

const createMessage = async (token, messageData) => {
  const res = await axios.post(`${BASE_URL}/messages`, messageData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

const getMessages = async (token, userId) => {
  const res = await axios.get(`${BASE_URL}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { userId },
  });
  return res.data;
};

const bookSession = async (token, sessionData) => {
  const res = await axios.post(`${BASE_URL}/sessions`, sessionData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

const getSessions = async (token, params) => {
  const res = await axios.get(`${BASE_URL}/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
};

const updateSession = async (token, sessionId, updateData) => {
  const res = await axios.put(`${BASE_URL}/sessions/${sessionId}`, updateData, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export default {
  createMessage,
  getMessages,
  bookSession,
  getSessions,
  updateSession,
};
