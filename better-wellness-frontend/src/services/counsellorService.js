// src/services/counsellorService.js
import axios from "axios";

const BASE_URL = "https://counsellor.betterhealthservices.42web.io";

const getCounsellors = async (token) => {
  const res = await axios.get(`${BASE_URL}/counsellors`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export default { getCounsellors };
