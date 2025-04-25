// src/services/userService.js
import axios from "axios";

const BASE_URL = "https://user.betterhealthservices.42web.io";

const register = async (userData) => {
  const res = await axios.post(`${BASE_URL}/register`, userData);
  return res.data;
};

const login = async (email, password) => {
  const res = await axios.post(`${BASE_URL}/login`, { email, password });
  return res.data;
};

const confirmEmail = async (token) => {
  // hits GET /confirm?token=… on your ALB → user-service
  const res = await axios.get(`${BASE_URL}/confirm`, {
    params: { token }
  });
  return res.data;
};

export default { register, login };
