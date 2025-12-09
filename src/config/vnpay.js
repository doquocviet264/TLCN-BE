import dotenv from "dotenv";
dotenv.config();

export const vnpConfig = {
  tmnCode: process.env.VNP_TMNCODE,
  hashSecret: process.env.VNP_HASHSECRET,
  vnpUrl: process.env.VNP_URL,
  returnUrl: process.env.VNP_RETURN_URL,
};
