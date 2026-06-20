import { Router } from "express";
import { optionalAuth } from "../middleware/auth.js";
import { sendChatbotMessage } from "../controllers/chatbot.controller.js";

const router = Router();

router.post("/message", optionalAuth, sendChatbotMessage);

export default router;
