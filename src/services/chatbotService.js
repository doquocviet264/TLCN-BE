import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import mongoose from "mongoose";
import { Tour } from "../models/Tour.js";
import { TourDeparture } from "../models/TourDeparture.js";
import { Chat } from "../models/Chat.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const REC_BASE = process.env.RECOMMENDATION_API || "http://localhost:8000";

const SYSTEM_PROMPT = `Bạn là Smart Tour Assistant của AHH Travel — trợ lý du lịch AI thông minh.

Bạn có thể:
- Gợi ý tour phù hợp dựa trên nhu cầu (điểm đến, ngân sách, số ngày, dịp đặc biệt)
- Cung cấp thông tin chi tiết về từng tour: lịch trình, giá, chỗ còn trống
- Gợi ý tour cá nhân hóa dựa trên AI (DeepFM)
- Hướng dẫn quy trình đặt tour và thanh toán
- Trả lời câu hỏi về chính sách, hủy tour, bảo hiểm
- Kết nối với nhân viên hỗ trợ thực khi cần

Nguyên tắc:
- Luôn trả lời bằng tiếng Việt, thân thiện và ngắn gọn
- Chỉ dùng dữ liệu thực từ tool, không bịa thông tin tour
- Khi gợi ý tour, luôn gọi tool để lấy dữ liệu từ hệ thống
- Nếu không tìm thấy tour phù hợp, hãy thành thật và gợi ý thay thế
- Khi khách muốn đặt tour cụ thể, hướng dẫn họ vào trang tour đó`;

const TOOLS = [
  {
    name: "search_tours",
    description:
      "Tìm kiếm tour du lịch. Dùng khi khách hỏi về tour đi địa điểm nào đó, tour giá rẻ, tour mấy ngày, hoặc tìm tour theo yêu cầu cụ thể.",
    input_schema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "Từ khóa: tên điểm đến hoặc tên tour (VD: 'Đà Nẵng', 'Phú Quốc')",
        },
        maxPriceAdult: {
          type: "number",
          description: "Giá tối đa cho người lớn (VNĐ)",
        },
        durationKeyword: {
          type: "string",
          description: "Thời gian tour (VD: '3 ngày', '5 ngày 4 đêm')",
        },
      },
    },
  },
  {
    name: "get_tour_detail",
    description:
      "Lấy thông tin chi tiết 1 tour: lịch trình đầy đủ, giá, ngày khởi hành còn slot. Dùng khi khách hỏi chi tiết về 1 tour cụ thể.",
    input_schema: {
      type: "object",
      properties: {
        tourId: {
          type: "string",
          description: "MongoDB ObjectId của tour",
        },
      },
      required: ["tourId"],
    },
  },
  {
    name: "get_recommendations",
    description:
      "Lấy tour được AI gợi ý cá nhân hóa cho khách. Dùng khi khách không có yêu cầu cụ thể hoặc hỏi 'tour nào hay', 'gợi ý cho tôi'.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Số tour muốn lấy, mặc định 4",
        },
      },
    },
  },
  {
    name: "get_similar_tours",
    description: "Lấy các tour tương tự với 1 tour đang xem.",
    input_schema: {
      type: "object",
      properties: {
        tourId: {
          type: "string",
          description: "MongoDB ObjectId của tour",
        },
        limit: {
          type: "number",
          description: "Số tour, mặc định 3",
        },
      },
      required: ["tourId"],
    },
  },
  {
    name: "get_faq",
    description:
      "Trả lời câu hỏi thường gặp về chính sách, dịch vụ. Dùng khi khách hỏi về cách đặt, hủy tour, thanh toán, liên hệ.",
    input_schema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: ["booking", "cancel", "payment", "contact", "general"],
          description: "Chủ đề câu hỏi",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Chuyển khách sang nhân viên hỗ trợ thực. Dùng khi: khách yêu cầu nói chuyện với người thật, vấn đề phức tạp (khiếu nại, sự cố thanh toán, hoàn tiền), hoặc AI không thể giải quyết.",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Tóm tắt lý do cần hỗ trợ để nhân viên nắm bắt ngay",
        },
      },
      required: ["reason"],
    },
  },
];

const FAQ = {
  booking: `Quy trình đặt tour AHH Travel:
1. Chọn tour → chọn ngày khởi hành
2. Điền thông tin người đặt và hành khách
3. Xem lại đơn và chọn phương thức thanh toán
4. Thanh toán qua VNPay, MoMo, hoặc chuyển khoản
5. Nhận xác nhận đặt tour qua email ngay sau khi thanh toán

Lưu ý: Đặt trước ít nhất 3 ngày trước ngày khởi hành.`,

  cancel: `Chính sách hủy tour AHH Travel:
• Hủy trước 15 ngày: hoàn 90%
• Hủy trước 7 ngày: hoàn 70%
• Hủy trước 3 ngày: hoàn 50%
• Hủy dưới 3 ngày / không báo trước: không hoàn tiền

Để hủy tour, liên hệ hotline hoặc vào mục "Đơn của tôi" trên website.`,

  payment: `Phương thức thanh toán:
• VNPay (thẻ ATM, thẻ tín dụng/ghi nợ)
• MoMo
• Chuyển khoản ngân hàng
• Thanh toán trực tiếp tại văn phòng

Giá tour đã bao gồm: xe đưa đón, khách sạn, HDV, bảo hiểm du lịch.`,

  contact: `Liên hệ AHH Travel:
• Hotline: 1900 xxxx (8:00–20:00 hàng ngày)
• Email: support@ahhtravel.vn
• Facebook: AHH Travel
• Văn phòng: Tp. Hồ Chí Minh`,

  general: `AHH Travel là đơn vị lữ hành chuyên tổ chức tour du lịch trong nước chất lượng cao. Chúng tôi cung cấp đầy đủ dịch vụ: đặt tour, vận chuyển, lưu trú, hướng dẫn viên và bảo hiểm du lịch.`,
};

function formatTourCard(tour) {
  return {
    _id: String(tour._id),
    title: tour.title || "",
    destination: tour.destination || "",
    destinationSlug: tour.destinationSlug || "",
    time: tour.time || "",
    priceAdult: tour.priceAdult || 0,
    priceChild: tour.priceChild || 0,
    images: Array.isArray(tour.images) ? tour.images.slice(0, 1) : [],
    description: (tour.description || "").slice(0, 120),
  };
}

async function executeTool(name, input, userId) {
  const tours = [];

  switch (name) {
    case "search_tours": {
      const query = { status: "active" };
      if (input.keyword) query.$text = { $search: input.keyword };
      if (input.maxPriceAdult) query.priceAdult = { $lte: input.maxPriceAdult };
      if (input.durationKeyword)
        query.time = { $regex: input.durationKeyword, $options: "i" };

      const found = await Tour.find(query)
        .select("title destination destinationSlug time priceAdult priceChild images description")
        .limit(5)
        .lean();

      tours.push(...found);
      return {
        result: { count: found.length, tours: found.map(formatTourCard) },
        tours,
      };
    }

    case "get_tour_detail": {
      if (!mongoose.isValidObjectId(input.tourId))
        return { result: { error: "Tour ID không hợp lệ" }, tours };

      const tour = await Tour.findById(input.tourId).lean();
      if (!tour) return { result: { error: "Không tìm thấy tour" }, tours };

      const departures = await TourDeparture.find({
        tourId: tour._id,
        status: { $in: ["pending", "confirmed"] },
        startDate: { $gte: new Date() },
      })
        .select("startDate endDate priceAdult priceChild max_guests current_guests")
        .sort("startDate")
        .limit(5)
        .lean();

      tours.push(tour);
      return {
        result: {
          tour: {
            ...formatTourCard(tour),
            includes: tour.includes,
            excludes: tour.excludes,
            itinerary: (tour.itinerary || []).map((d) => ({
              day: d.day,
              title: d.title,
              summary: d.summary,
            })),
          },
          upcomingDepartures: departures.map((d) => ({
            startDate: d.startDate,
            endDate: d.endDate,
            priceAdult: d.priceAdult ?? tour.priceAdult,
            priceChild: d.priceChild ?? tour.priceChild,
            availableSlots: (d.max_guests || 30) - (d.current_guests || 0),
          })),
        },
        tours,
      };
    }

    case "get_recommendations": {
      try {
        const { data } = await axios.get(`${REC_BASE}/recommend/homepage`, {
          params: { userId: userId || undefined, limit: input.limit || 4 },
          timeout: 5000,
        });
        const list = data?.data || [];
        tours.push(...list);
        return { result: { count: list.length, tours: list.map(formatTourCard) }, tours };
      } catch {
        return { result: { error: "Không thể lấy gợi ý lúc này, thử lại sau" }, tours };
      }
    }

    case "get_similar_tours": {
      try {
        const { data } = await axios.get(`${REC_BASE}/recommend/similar`, {
          params: { tourId: input.tourId, limit: input.limit || 3 },
          timeout: 5000,
        });
        const list = data?.data || [];
        tours.push(...list);
        return { result: { count: list.length, tours: list.map(formatTourCard) }, tours };
      } catch {
        return { result: { error: "Không thể lấy tour tương tự lúc này" }, tours };
      }
    }

    case "get_faq": {
      return {
        result: { content: FAQ[input.topic] || FAQ.general },
        tours,
      };
    }

    case "escalate_to_human": {
      return { result: { escalate: true, reason: input.reason }, tours };
    }

    default:
      return { result: { error: "Tool không tồn tại" }, tours };
  }
}

export async function runChatbot({ messages, userId, userInfo }) {
  const allTours = [];
  let escalateAction = null;

  let currentMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Agentic loop — tối đa 5 vòng
  for (let i = 0; i < 5; i++) {
    const response = await client.messages.create({
      model: process.env.CHATBOT_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: currentMessages,
    });

    if (response.stop_reason === "end_turn") {
      const text = response.content.find((b) => b.type === "text");
      return {
        reply: text?.text || "Xin lỗi, mình không thể trả lời lúc này.",
        tours: deduplicateTours(allTours),
        action: escalateAction,
      };
    }

    if (response.stop_reason === "tool_use") {
      currentMessages.push({ role: "assistant", content: response.content });

      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        const { result, tours } = await executeTool(block.name, block.input, userId);
        allTours.push(...tours);

        // Tạo support session khi escalate
        if (block.name === "escalate_to_human" && result.escalate) {
          const supportId =
            "SUP-" + Math.random().toString(36).slice(2, 8).toUpperCase();
          await Chat.create({
            roomType: "support",
            supportId,
            fromRole: userId ? "user" : "guest",
            name: userInfo?.name || "",
            email: userInfo?.email || "",
            content: result.reason,
            isSystem: false,
          });
          escalateAction = { type: "escalate", supportId };
          result.supportId = supportId;
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      currentMessages.push({ role: "user", content: toolResults });
    }
  }

  return {
    reply: "Xin lỗi, yêu cầu của bạn hơi phức tạp. Bạn có thể mô tả lại không?",
    tours: deduplicateTours(allTours),
    action: escalateAction,
  };
}

function deduplicateTours(tours) {
  const seen = new Set();
  return tours
    .filter((t) => {
      const id = String(t._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 6);
}
