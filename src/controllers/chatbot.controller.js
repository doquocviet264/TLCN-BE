import { runChatbot } from "../services/chatbotService.js";

export const sendChatbotMessage = async (req, res) => {
  try {
    const { messages, userInfo } = req.body;
    const userId = req.user?.id || null;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "messages là bắt buộc" });
    }

    // Giới hạn lịch sử gửi lên để tránh token quá lớn
    const trimmedMessages = messages.slice(-20);

    const result = await runChatbot({
      messages: trimmedMessages,
      userId,
      userInfo: userInfo || {},
    });

    res.json(result);
  } catch (err) {
    console.error("[ChatBot Error]", err?.message || err);
    res.status(500).json({ message: "Lỗi hệ thống chatbot, vui lòng thử lại" });
  }
};
