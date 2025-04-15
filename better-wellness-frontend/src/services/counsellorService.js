// src/services/counsellorService.js
import axios from "axios";

const BASE_URL = "http://localhost:5001";

const getCounsellors = async (token) => {
  const res = await axios.get(`${BASE_URL}/counsellors`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export default { getCounsellors };
