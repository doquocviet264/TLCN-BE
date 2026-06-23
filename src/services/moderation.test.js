// src/services/moderation.test.js
// Chạy: node src/services/moderation.test.js
// Cần ANTHROPIC_API_KEY trong env (ví dụ: node --env-file=.env src/services/moderation.test.js)
import { moderateBlogContent } from "./moderationService.js";

const cases = [
  {
    name: "Case 1 - Bài du lịch bình thường, kỳ vọng approve",
    expected: "approve",
    title: "3 ngày khám phá Đà Lạt cho người mới bắt đầu",
    content: `<p>Đà Lạt là điểm đến lý tưởng cho những ai yêu thích khí hậu se lạnh và cảnh quan đồi núi.
    Mình đã có 3 ngày 2 đêm khám phá thành phố này, từ Hồ Xuân Hương buổi sáng sớm, ghé Đồi chè Cầu Đất,
    thưởng thức bánh tráng nướng ở chợ đêm, đến tham quan Thung lũng Tình Yêu. Giá phòng homestay trung bình
    khoảng 400.000đ/đêm, đồ ăn rất rẻ và ngon. Đặc biệt nên mang theo áo ấm vì buổi tối khá lạnh. Đây là một
    trải nghiệm đáng nhớ và mình rất khuyến khích mọi người ghé thăm Đà Lạt ít nhất một lần.</p>`,
  },
  {
    name: "Case 2 - Spam quảng cáo rõ ràng, kỳ vọng reject",
    expected: "reject",
    title: "MUA NGAY giảm giá 90% chỉ hôm nay!!!",
    content: `<p>BÁN HÀNG GIÁ RẺ NHẤT THỊ TRƯỜNG!!! Click ngay vào link http://spam-shop-fake.example/giam-gia
    để nhận ưu đãi khủng. Liên hệ Zalo 0900-xxx-xxx để được tư vấn mua hàng ngay hôm nay. Số lượng giới hạn,
    nhanh tay đặt hàng kẻo hết. Inbox ngay để mua iPhone giá rẻ, đồng hồ fake giá sỉ, mỹ phẩm không rõ nguồn gốc.
    Mua càng nhiều giảm càng sâu, share bài viết để nhận thêm mã giảm giá!</p>`,
  },
  {
    name: "Case 3 - Lạc đề (đầu tư crypto), kỳ vọng flag_for_review",
    expected: "flag_for_review",
    title: "Hướng dẫn đầu tư Bitcoin và Altcoin cho người mới",
    content: `<p>Bài viết này chia sẻ kinh nghiệm đầu tư crypto của mình trong 2 năm qua. Bitcoin và Ethereum
    là hai đồng coin nên quan tâm đầu tiên, ngoài ra có thể xem xét một số altcoin tiềm năng. Nên phân bổ vốn
    hợp lý, không nên all-in vào một đồng coin duy nhất, và luôn đặt stop-loss để quản trị rủi ro khi thị trường
    biến động mạnh.</p>`,
  },
];

async function run() {
  for (const c of cases) {
    console.log(`\n=== ${c.name} ===`);
    const result = await moderateBlogContent({
      title: c.title,
      content: c.content,
      authorId: "test-author",
    });

    console.log("action:    ", result.action, result.action === c.expected ? "(OK)" : `(expected ${c.expected})`);
    console.log("confidence:", result.confidence);
    console.log("reason:    ", result.reason);
    console.log("categories:", result.categories);
  }
}

run().catch((err) => {
  console.error("Test run failed:", err);
  process.exit(1);
});
