// src/services/moderationService.js
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function stripHtml(html = "") {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SYSTEM_PROMPT = `Bạn là hệ thống kiểm duyệt nội dung tự động cho blog du lịch của AHH Travel. Nhiệm vụ: đánh giá một bài viết do người dùng đăng và quyết định có cho qua kiểm duyệt sơ bộ hay không, TRƯỚC khi Admin duyệt lần cuối.

Tiêu chí chấm điểm (mỗi mục từ 0.0 đến 1.0):
- toxic_score: mức độ độc hại, xúc phạm, ngôn từ thù ghét, nội dung khiêu dâm/bạo lực
- spam_score: mức độ quảng cáo trá hình, link rác, kêu gọi mua hàng/dịch vụ không liên quan
- off_topic_score: mức độ KHÔNG liên quan đến du lịch (điểm đến, ẩm thực, văn hóa, kinh nghiệm di chuyển, lưu trú...). Đây là blog du lịch, nội dung lạc đề (ví dụ: đầu tư tài chính, crypto, chính trị) phải có off_topic_score cao.
- misinformation_score: mức độ chứa thông tin sai lệch/không kiểm chứng được về địa điểm, giá cả, dịch vụ
- quality_score: chất lượng nội dung nói chung (độ chi tiết, mạch lạc, hữu ích cho người đọc), 0 là rất kém, 1 là rất tốt

Quy tắc quyết định action (áp dụng đúng thứ tự):
1. Nếu toxic_score > 0.7 HOẶC spam_score > 0.8 → action = "reject"
2. Nếu không rơi vào reject, nhưng có bất kỳ score nào trong {toxic_score, spam_score, off_topic_score, misinformation_score} nằm trong khoảng [0.4, 0.7] → action = "flag_for_review"
3. Nếu tất cả score trong {toxic_score, spam_score, off_topic_score, misinformation_score} đều < 0.4 và quality_score > 0.3 → action = "approve"
4. Mọi trường hợp còn lại → action = "flag_for_review"

CHỈ trả về JSON thuần theo đúng schema sau. KHÔNG markdown code fence, KHÔNG giải thích, KHÔNG text nào khác ngoài JSON:
{
  "action": "approve" | "reject" | "flag_for_review",
  "confidence": 0.0-1.0,
  "reason": "lý do ngắn gọn bằng tiếng Việt, dành cho Admin đọc",
  "suggestion": "gợi ý sửa cho người dùng nếu reject/flag, hoặc null nếu approve",
  "categories": {
    "toxic_score": 0.0-1.0,
    "spam_score": 0.0-1.0,
    "off_topic_score": 0.0-1.0,
    "misinformation_score": 0.0-1.0,
    "quality_score": 0.0-1.0
  }
}`;

function parseModelJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

/**
 * Kiểm duyệt nội dung blog bằng Claude trước khi đưa vào hàng chờ Admin duyệt.
 * @param {{ title: string, content: string, authorId?: string }} params
 */
export async function moderateBlogContent({ title, content, authorId }) {
  const plainText = stripHtml(typeof content === "string" ? content : "");

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Tiêu đề: ${title || "(không có)"}\n\nNội dung:\n${
            plainText || "(không có nội dung)"
          }`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const parsed = parseModelJson(textBlock?.text || "{}");
    const action = parsed.action || "flag_for_review";

    return {
      passed: action !== "reject",
      action,
      confidence: parsed.confidence ?? 0,
      reason: parsed.reason || "",
      categories: parsed.categories || {},
      suggestion: parsed.suggestion ?? null,
    };
  } catch (err) {
    console.error("[moderateBlogContent] AI moderation error:", err);
    return {
      passed: true,
      action: "flag_for_review",
      confidence: 0,
      reason: "AI service lỗi, chuyển thủ công",
      categories: {},
      suggestion: null,
    };
  }
}
