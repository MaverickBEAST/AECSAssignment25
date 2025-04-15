// src/services/userService.js
import axios from "axios";

const BASE_URL = "http://a8797e0c8948a4dd1b538090991eae26-1818452634.us-east-1.elb.amazonaws.com";

const register = async (userData) => {
  const res = await axios.post(`${BASE_URL}/register`, userData);
  return res.data;
};

const login = async (email, password) => {
  const res = await axios.post(`${BASE_URL}/login`, { email, password });
  return res.data;
};

export default { register, login };
