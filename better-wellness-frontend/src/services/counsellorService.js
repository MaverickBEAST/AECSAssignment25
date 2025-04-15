// src/services/counsellorService.js
import axios from "axios";

const BASE_URL = "http:aeba3d810c60f47a3a7c707134d640f8-2037757430.us-east-1.elb.amazonaws.com";

const getCounsellors = async (token) => {
  const res = await axios.get(`${BASE_URL}/counsellors`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export default { getCounsellors };
