import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ── Inline schemas (không import model để tránh vòng lặp circular) ──────────
const blogSchema = new mongoose.Schema(
  {
    title:               { type: String, required: true, trim: true },
    slug:                { type: String, unique: true, index: true },
    summary:             { type: String, default: "" },
    content:             { type: String, default: "" },
    tags:                { type: [String], default: [] },
    categories:          { type: [String], default: [] },
    coverImageUrl:       { type: String, default: "" },
    coverImagePublicId:  { type: String, default: "" },
    authorModel:         { type: String, enum: ["User", "Admin"], default: "Admin" },
    authorId:            { type: mongoose.Schema.Types.ObjectId, refPath: "authorModel" },
    privacy:             { type: String, enum: ["public", "private"], default: "public" },
    locationDetail:      { type: String, default: "" },
    province:            { type: String, default: "" },
    ward:                { type: String, default: "" },
    rejectReason:        { type: String, default: "" },
    status:              { type: String, enum: ["draft", "pending", "published", "archived", "rejected"], default: "draft", index: true },
    publishedAt:         { type: Date },
    ratingAvg:           { type: Number, default: 0 },
    ratingCount:         { type: Number, default: 0 },
  },
  { timestamps: true }
);

function slugify(str = "") {
  const map = {
    đ: "d", Đ: "d", ơ: "o", Ơ: "o", ư: "u", Ư: "u",
    ă: "a", Ă: "a", â: "a", Â: "a", ê: "e", Ê: "e", ô: "o", Ô: "o",
  };
  const replaced = str.replace(/[đĐơƠưƯăĂâÂêÊôÔ]/g, (c) => map[c] || c);
  return replaced
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

blogSchema.pre("save", function (next) {
  if (!this.slug && this.title) {
    const base = slugify(this.title);
    const suffix = Date.now().toString(36);
    this.slug = `${base}-${suffix}`;
  }
  next();
});

const adminSchema = new mongoose.Schema(
  {
    fullName:    { type: String },
    username:    { type: String, required: true, unique: true, index: true },
    email:       { type: String, required: true, unique: true, index: true },
    password:    { type: String },
    address:     { type: String },
    createdDate: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

const BlogPost = mongoose.model("BlogPost", blogSchema, "tbl_blog");
const Admin    = mongoose.model("Admin",    adminSchema, "tbl_admin");

// ── Dữ liệu bài viết mẫu theo từng danh mục ──────────────────────────────────
const BLOG_ARTICLES = [
  // ── Ẩm thực ──────────────────────────────────────────────────────────────
  {
    category: "Ẩm thực",
    title: "Hành trình khám phá ẩm thực đường phố Hà Nội từ sáng đến tối",
    summary: "Hà Nội không chỉ đẹp ở những con phố cổ mà còn cuốn hút bởi nền ẩm thực phong phú. Phở, bún chả, bánh mì, hay cốc cà phê trứng... mỗi món ăn đều kể một câu chuyện riêng.",
    content: `<h2>Bắt đầu ngày mới với Phở Bắc</h2>
<p>Không có gì tuyệt vời hơn việc bắt đầu một ngày ở Hà Nội với một tô phở bò nghi ngút khói. Nước dùng trong, ngọt lừ từ xương bò hầm nhiều giờ, bánh phở mềm dai, thịt bò tươi thái mỏng – đây là công thức "thức tỉnh" hoàn hảo cho mọi du khách.</p>
<h2>Bữa trưa: Bún Chả Obama</h2>
<p>Nổi tiếng sau chuyến thăm của cựu Tổng thống Mỹ Barack Obama, quán bún chả trên phố Lê Văn Hưu luôn tấp nập khách. Chả miếng và chả viên nướng thơm lừng, chấm cùng nước mắm chua ngọt, cuộn cùng bún và rau sống – hương vị đặc trưng không nơi nào có được.</p>
<h2>Cà phê trứng buổi chiều</h2>
<p>Một ly cà phê trứng tại Giảng Cà Phê – nơi khai sinh ra thức uống độc đáo này – là trải nghiệm không thể bỏ qua. Lòng đỏ trứng được đánh bông mịn, hòa cùng cà phê đen đậm đà tạo nên hương vị ngọt nhẹ, béo ngậy.</p>
<h2>Tối tại Phố Cổ: Bánh Mì & Bia Hơi</h2>
<p>Kết thúc ngày dài bằng một ổ bánh mì nóng giòn hay ly bia hơi góc phố – đó là Hà Nội thực thụ. Phong cách sống chậm, thân thiện, và luôn có điều gì đó mới để khám phá.</p>`,
    tags: ["ẩm thực hà nội", "phở bắc", "bún chả", "cà phê trứng", "đặc sản"],
    province: "Hà Nội",
    coverImageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=800&fit=crop",
  },
  {
    category: "Ẩm thực",
    title: "Top 10 món ăn đặc sản miền Trung không thể bỏ qua",
    summary: "Ẩm thực miền Trung nổi tiếng với vị cay đặc trưng và hương thơm phức hợp. Từ bún bò Huế, mì Quảng đến bánh căn Đà Lạt – mỗi món là một trải nghiệm khó quên.",
    content: `<h2>Bún Bò Huế – Linh hồn ẩm thực Cố Đô</h2>
<p>Bún bò Huế khác biệt so với phở Hà Nội bởi nước dùng đậm đà hương sả, màu đỏ của ớt và ruốc. Sợi bún to, tròn, kết hợp giò heo, chả Huế và huyết – tạo nên bữa sáng "no lâu" cho người dân xứ Huế.</p>
<h2>Mì Quảng – Đặc sản Quảng Nam</h2>
<p>Mì Quảng sử dụng ít nước dùng, chủ yếu là "nhưn" (nhân) phong phú gồm tôm, thịt, trứng cút, đậu phộng rang giòn. Tất cả hòa quyện cùng sợi mì vàng nghệ đặc trưng tạo nên món ăn vừa lạ vừa quen.</p>
<h2>Bánh Xèo Miền Trung</h2>
<p>Nhỏ hơn bánh xèo miền Nam nhưng không kém phần hấp dẫn, bánh xèo miền Trung được ăn kèm với rau sống, nước mắm chua ngọt pha tỏi ớt. Tiếng xèo xèo khi bột bánh gặp chảo nóng là âm thanh "ngon tai" nhất.</p>`,
    tags: ["ẩm thực miền trung", "bún bò huế", "mì quảng", "bánh xèo", "đặc sản"],
    province: "Đà Nẵng",
    coverImageUrl: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=1200&h=800&fit=crop",
  },
  {
    category: "Ẩm thực",
    title: "Sài Gòn về đêm – Thiên đường ẩm thực không ngủ",
    summary: "TP.HCM được mệnh danh là 'thành phố không ngủ' bởi hàng nghìn quán ăn đêm từ đình đám đến bình dân, từ hủ tiếu Nam Vang đến bánh tráng trộn vỉa hè.",
    content: `<h2>Hủ Tiếu Nam Vang – Hương vị Sài Gòn chính hiệu</h2>
<p>Bắt nguồn từ cộng đồng người Hoa ở Sài Gòn, hủ tiếu Nam Vang với nước dùng trong vắt, ngọt lịm từ tôm khô và xương heo là món "khuya" được yêu thích nhất. Ăn kèm giá sống, rau cần, hành phi và tương đen tương đỏ.</p>
<h2>Bánh Tráng Trộn – Ký ức học trò</h2>
<p>Góc đường nào ở Sài Gòn cũng có xe bánh tráng trộn. Bánh tráng cắt nhỏ, trộn cùng xoài xanh, tôm khô, khô bò, rau răm, tương ớt – vừa chua cay mặn ngọt, vừa no vừa vui.</p>
<h2>Chợ Đêm Bến Thành</h2>
<p>Sau 6 giờ tối, khu vực xung quanh chợ Bến Thành biến thành thiên đường ẩm thực với hàng trăm gian hàng bày bán đủ loại hải sản tươi sống, bia lạnh, và những món ăn vặt đặc trưng Sài Gòn.</p>`,
    tags: ["ẩm thực sài gòn", "hủ tiếu", "bánh tráng trộn", "ăn đêm", "tp hcm"],
    province: "Hồ Chí Minh",
    coverImageUrl: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=1200&h=800&fit=crop",
  },

  // ── Trải nghiệm ──────────────────────────────────────────────────────────
  {
    category: "Trải nghiệm",
    title: "Chinh phục đỉnh Fansipan – Nóc nhà Đông Dương bằng đôi chân",
    summary: "Fansipan cao 3.147m không chỉ là điểm đến du lịch mà còn là thử thách chinh phục bản thân. Hành trình trekking 2 ngày 1 đêm qua rừng nguyên sinh Hoàng Liên để đặt chân lên đỉnh cao nhất Đông Dương.",
    content: `<h2>Chuẩn bị trước chuyến đi</h2>
<p>Không cần là vận động viên chuyên nghiệp, nhưng bạn cần có sức khỏe tốt và tinh thần quyết tâm. Chuẩn bị giày trekking chắc chắn, áo mưa, đèn pin, thuốc chống say độ cao và đủ nước uống.</p>
<h2>Ngày 1: Từ Trạm Tôn lên Lán 2</h2>
<p>Xuất phát từ Trạm Kiểm soát Tôn, con đường mòn băng qua rừng trúc xanh mát, rừng nguyên sinh rêu phong huyền bí. Độ dốc tăng dần, nhưng cảnh quan đền bù xứng đáng. Đêm lán dã chiến, bầu trời đầy sao là phần thưởng đặc biệt.</p>
<h2>Ngày 2: Chinh phục đỉnh</h2>
<p>Dậy từ 3h30 sáng để kịp ngắm bình minh trên đỉnh. Khoảnh khắc đứng trên nóc nhà Đông Dương nhìn xuống biển mây trắng muốt là trải nghiệm không thể diễn tả bằng lời – chỉ có thể cảm nhận.</p>`,
    tags: ["fansipan", "trekking", "lào cai", "sa pa", "chinh phục đỉnh cao"],
    province: "Lào Cai",
    coverImageUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&h=800&fit=crop",
  },
  {
    category: "Trải nghiệm",
    title: "Kayaking qua hang Sơn Đoòng – Kỳ quan thiên nhiên thế giới",
    summary: "Sơn Đoòng – hang động lớn nhất thế giới – là điểm đến trong mơ của nhiều phượt thủ. Tour 6 ngày khám phá Sơn Đoòng là hành trình không thể nào quên.",
    content: `<h2>Sơn Đoòng – Kỳ quan ẩn giấu trong lòng đất</h2>
<p>Phát hiện bởi người dân địa phương năm 1991 và được khoa học khám phá năm 2009, Sơn Đoòng dài hơn 9km, nơi rộng nhất có thể chứa cả một tòa nhà 40 tầng. Bên trong có cả "rừng mưa nhiệt đới" và sông ngầm.</p>
<h2>Hành trình 6 ngày</h2>
<p>Tour khám phá do Oxalis Adventure tổ chức giới hạn chỉ 220 người/năm. Bạn sẽ vượt sông Chày, leo vách đá, trải qua đêm trong hang và được chứng kiến ánh sáng tự nhiên xuyên qua "mắt hang" chiếu xuống tạo nên khung cảnh như thiên đường.</p>
<h2>Những điều cần biết trước khi đi</h2>
<p>Chi phí tour Sơn Đoòng khoảng 3.000 USD/người, phải đặt trước nhiều tháng. Cần có sức khỏe tốt và không mắc bệnh tim mạch. Đây là trải nghiệm đắt giá nhất – theo nghĩa đen lẫn nghĩa bóng.</p>`,
    tags: ["sơn đoòng", "hang động", "quảng bình", "kỳ quan thiên nhiên", "phượt"],
    province: "Quảng Bình",
    coverImageUrl: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&h=800&fit=crop",
  },

  // ── Review ────────────────────────────────────────────────────────────────
  {
    category: "Review",
    title: "Review chi tiết resort 5 sao Vinpearl Nha Trang – Có đáng tiền không?",
    summary: "Sau 3 ngày nghỉ dưỡng tại Vinpearl Nha Trang, tôi muốn chia sẻ trải nghiệm thực tế: phòng ốc, dịch vụ, ăn uống và khu vui chơi – tất cả có xứng đáng với mức giá cao cấp?",
    content: `<h2>Check-in và Phòng nghỉ</h2>
<p>Thủ tục check-in nhanh chóng, nhân viên nhiệt tình và thông thạo tiếng Anh. Phòng Deluxe Ocean View rộng 45m², view biển tuyệt đẹp, giường lớn êm ái. Minibar, TV 55", bồn tắm jacuzzi – đủ tiện nghi để bạn không muốn ra ngoài.</p>
<h2>Nhà hàng và Ẩm thực</h2>
<p>Buffet sáng phong phú với hơn 80 món, từ Việt Nam đến Tây Âu. Nhà hàng hải sản buổi tối được xếp hạng xuất sắc – tôm hùm nướng bơ tỏi, cá biển hấp gừng hành đều được chế biến tươi ngon. Điểm trừ nhỏ: phục vụ bữa tối hơi chậm vào cuối tuần.</p>
<h2>Hồ Bơi và Bãi Biển</h2>
<p>Hệ thống 3 hồ bơi nối liền ra bãi biển riêng, nước trong xanh, ghế tắm nắng xếp thành hàng gọn gàng. Đây là điểm mạnh nhất của resort. Dịch vụ đồ uống tại hồ bơi được phục vụ tận nơi.</p>
<h2>Kết luận</h2>
<p>Với mức giá 4-6 triệu/đêm, Vinpearl Nha Trang xứng đáng để thử một lần. Không phải lựa chọn tốt nhất về "value for money" nhưng chắc chắn là trải nghiệm đáng nhớ cho dịp đặc biệt.</p>`,
    tags: ["review resort", "vinpearl", "nha trang", "khánh hòa", "nghỉ dưỡng"],
    province: "Khánh Hòa",
    coverImageUrl: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200&h=800&fit=crop",
  },
  {
    category: "Review",
    title: "Review vé máy bay giá rẻ: Bí quyết mua vé 0 đồng từ Vietjet",
    summary: "Mua được vé 0 đồng không phải may mắn – đó là kỹ năng. Chia sẻ kinh nghiệm săn vé giá rẻ từ Vietjet, Bamboo và Vietnam Airlines dựa trên kinh nghiệm 5 năm đi khắp Việt Nam.",
    content: `<h2>Flash Sale là gì và khi nào có?</h2>
<p>Các hãng bay thường tung flash sale vào thứ Ba và thứ Tư hàng tuần, vào các khung giờ 0h-2h hoặc 12h-14h. Vé flash sale thường bán trước 1-3 tháng và giới hạn số lượng cực kỳ ít.</p>
<h2>Cài App và Bật Thông báo</h2>
<p>Đây là bước quan trọng nhất. Cài app Vietjet, Bamboo, Vietnam Airlines và bật thông báo đẩy. Đăng ký email thông báo khuyến mãi. Theo dõi fanpage chính thức để không bỏ lỡ Flash Sale.</p>
<h2>Kỹ thuật "Vé xương" (Hidden City Ticketing)</h2>
<p>Đây là kỹ thuật cao cấp: đặt vé đến điểm xa hơn điểm bạn thực sự muốn đến, với chi phí thấp hơn. Ví dụ: vé HCM-Nha Trang có thể rẻ hơn vé HCM-Đà Nẵng, dù Đà Nẵng ở giữa đường bay. Lưu ý: chỉ áp dụng cho hành lý xách tay.</p>
<h2>Kết luận</h2>
<p>Tiết kiệm tiền vé để chi cho trải nghiệm – đó là triết lý du lịch thông minh. Với sự kiên nhẫn và kỹ năng đúng đắn, bạn hoàn toàn có thể đi máy bay với giá xe buýt.</p>`,
    tags: ["vé máy bay giá rẻ", "flash sale", "vietjet", "tips du lịch", "tiết kiệm"],
    province: "Hồ Chí Minh",
    coverImageUrl: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&h=800&fit=crop",
  },

  // ── Cẩm nang ─────────────────────────────────────────────────────────────
  {
    category: "Cẩm nang",
    title: "Cẩm nang du lịch Phú Quốc từ A-Z – Cập nhật 2025",
    summary: "Tất cả những gì bạn cần biết trước khi đến Phú Quốc: thời điểm đẹp nhất, phương tiện di chuyển, ăn ở ở đâu, và những điểm đến không thể bỏ qua trên đảo ngọc.",
    content: `<h2>Thời điểm lý tưởng</h2>
<p>Mùa khô từ tháng 11 đến tháng 4 là thời điểm đẹp nhất để ghé Phú Quốc. Biển trong xanh, sóng êm, nắng đẹp. Tránh tháng 7-9 vì mưa nhiều và sóng lớn, nhiều bãi biển phía Tây bị bùn đỏ.</p>
<h2>Di chuyển đến Phú Quốc</h2>
<p>Bay thẳng từ Hà Nội, TP.HCM, Đà Nẵng về Phú Quốc. Thời gian bay từ HCM chỉ khoảng 55 phút. Cũng có thể đi phà từ Rạch Giá hoặc Hà Tiên nhưng mất nhiều thời gian hơn.</p>
<h2>Di chuyển trong đảo</h2>
<p>Thuê xe máy (150-200k/ngày) là lựa chọn tốt nhất để khám phá Phú Quốc. Grab hoạt động trên đảo nhưng đôi khi khan hiếm xe. Tránh taxi truyền thống vì thường "chặt chém" du khách.</p>
<h2>Địa điểm không thể bỏ qua</h2>
<p>Bãi Sao – bãi biển đẹp nhất Phú Quốc; Vinpearl Safari; Làng chài Hàm Ninh; Chợ đêm Phú Quốc; Dinh Cậu; Bãi Kem – "Top 10 bãi biển đẹp nhất châu Á" theo National Geographic.</p>`,
    tags: ["phú quốc", "cẩm nang", "đảo ngọc", "kiên giang", "du lịch"],
    province: "Kiên Giang",
    coverImageUrl: "https://images.unsplash.com/photo-1559628129-67cf63b72248?w=1200&h=800&fit=crop",
  },
  {
    category: "Cẩm nang",
    title: "Cẩm nang đặt phòng khách sạn – Bí quyết được giá tốt nhất",
    summary: "Đặt phòng khách sạn đúng cách có thể tiết kiệm 30-50% chi phí. Chia sẻ kinh nghiệm so sánh giá, thời điểm đặt tốt nhất và các nền tảng đặt phòng uy tín tại Việt Nam.",
    content: `<h2>So sánh giá trên nhiều nền tảng</h2>
<p>Không bao giờ đặt phòng ngay trên một nền tảng duy nhất. Hãy kiểm tra Booking.com, Agoda, Traveloka, Hotels.com và trang web chính thức của khách sạn. Thường thì đặt trực tiếp qua website khách sạn rẻ hơn 10-15%.</p>
<h2>Thời điểm đặt tốt nhất</h2>
<p>Với điểm đến trong nước, đặt trước 2-4 tuần thường cho giá tốt nhất. Đặt vào thứ Ba hoặc thứ Tư trong tuần để có giá thấp hơn. Tránh đặt vào cuối tuần và ngày lễ khi giá thường tăng 30-50%.</p>
<h2>Dùng Chức năng "Giá Bí Mật"</h2>
<p>Nhiều ứng dụng đặt phòng như HotelTonight, Secret Escapes cung cấp giá ưu đãi đặc biệt cho phòng trống vào phút chót. Nếu kế hoạch linh động, đây là cách tuyệt vời để ở khách sạn 4-5 sao với giá 2-3 sao.</p>`,
    tags: ["cẩm nang đặt phòng", "tiết kiệm", "booking", "agoda", "tips"],
    province: "Hồ Chí Minh",
    coverImageUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&h=800&fit=crop",
  },

  // ── Kinh nghiệm ──────────────────────────────────────────────────────────
  {
    category: "Kinh nghiệm",
    title: "10 kinh nghiệm xương máu khi đi phượt xe máy xuyên Việt",
    summary: "Chuyến đi xuyên Việt bằng xe máy dài 2.500km từ Hà Nội đến Cà Mau dạy tôi nhiều bài học không có trong sách vở. Chia sẻ để bạn không phải mắc những sai lầm tương tự.",
    content: `<h2>1. Kiểm tra xe kỹ trước khi lên đường</h2>
<p>Thay nhớt, kiểm tra lốp, phanh, đèn và xăng đầy bình – đây là bước bắt buộc. Dù xe mới hay cũ, hãy ghé tiệm sửa xe để họ kiểm tra toàn diện. Chi phí 100-200k còn tốt hơn hỏng xe giữa đèo hẻo lánh.</p>
<h2>2. Đi chậm hơn bạn nghĩ</h2>
<p>Nhiều người lên kế hoạch quá tham: 300-400km/ngày là quá sức với người mới. Chỉ nên đi 150-200km/ngày để còn sức khỏe và thời gian khám phá. Phượt không phải là đua.</p>
<h2>3. Mưa đèo không phải chuyện đùa</h2>
<p>Đèo Hải Vân, Đèo Ngang, Đèo Cả – mùa mưa có thể rất nguy hiểm. Luôn kiểm tra thời tiết. Nếu trời mưa lớn, hãy dừng lại tìm chỗ trú. Một ngày delay còn hơn một chuyến đi không có hồi kết.</p>
<h2>4. Ứng dụng không thể thiếu</h2>
<p>Google Maps offline (tải bản đồ trước), Waze cho lưu thông, và nhóm Facebook "Phượt Xuyên Việt" để hỏi kinh nghiệm realtime từ cộng đồng.</p>`,
    tags: ["xuyên việt", "phượt xe máy", "kinh nghiệm", "tips", "đi xe máy"],
    province: "Hà Nội",
    coverImageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=800&fit=crop",
  },
  {
    category: "Kinh nghiệm",
    title: "Kinh nghiệm đi du lịch một mình lần đầu – Dành cho người mới bắt đầu",
    summary: "Solo travel không đáng sợ như bạn nghĩ. Chia sẻ từ người đã đi một mình qua 15 tỉnh thành: cách lên kế hoạch, giữ an toàn, và tận hưởng sự tự do tuyệt vời khi không phụ thuộc ai.",
    content: `<h2>Tại sao nên thử du lịch một mình?</h2>
<p>Bạn được tự quyết mọi thứ: đi đâu, ăn gì, ngủ khi nào. Không cần thương lượng, không cần chờ đợi. Solo travel giúp bạn trưởng thành hơn, tự tin hơn và có những kết nối bất ngờ với người lạ.</p>
<h2>An toàn là ưu tiên số 1</h2>
<p>Luôn báo cho người thân biết lịch trình. Lưu số điện thoại khách sạn, đại sứ quán và cơ quan chức năng địa phương. Không đeo nhiều đồ trang sức. Chọn phòng hostel dorm để gặp gỡ du khách khác.</p>
<h2>Khởi đầu từ điểm dễ</h2>
<p>Đà Lạt, Hội An, Nha Trang là những điểm đến an toàn và thân thiện với solo traveler. Rất nhiều người địa phương nói tiếng Anh cơ bản, hạ tầng du lịch tốt, dễ di chuyển.</p>`,
    tags: ["solo travel", "du lịch một mình", "kinh nghiệm", "first time", "tips"],
    province: "Lâm Đồng",
    coverImageUrl: "https://images.unsplash.com/photo-1500259783852-0ca9ce8a64dc?w=1200&h=800&fit=crop",
  },

  // ── Nghỉ dưỡng ───────────────────────────────────────────────────────────
  {
    category: "Nghỉ dưỡng",
    title: "Top 5 bungalow trên cọc tại Phú Quốc – Trải nghiệm ngủ trên biển",
    summary: "Nằm ngủ nghe sóng biển vỗ ngay dưới chân – đó là trải nghiệm bungalow trên cọc tại Phú Quốc mang lại. Review chi tiết 5 resort có kiểu phòng độc đáo này.",
    content: `<h2>1. Mango Bay Resort</h2>
<p>Nằm ở bờ Tây đảo Phú Quốc, Mango Bay có phong cách bungalow gỗ truyền thống hòa mình vào thiên nhiên. Bungalow trên cọc nhìn thẳng ra biển, giá từ 2.5 triệu/đêm – hợp lý cho mức độ trải nghiệm.</p>
<h2>2. La Veranda Resort</h2>
<p>Phong cách Pháp thuộc địa sang trọng, bungalow nhìn ra vườn nhiệt đới hoặc biển. Pool villa có hồ bơi riêng. Bữa sáng được phục vụ tại phòng với đồ ăn homemade ngon tuyệt.</p>
<h2>3. Nam Nghi Resort</h2>
<p>Nằm trên ghềnh đá tự nhiên, Nam Nghi có thiết kế tích hợp với địa hình. Một số bungalow có cầu thang riêng xuống biển để lặn snorkeling ngay từ phòng. Rất phù hợp cho honeymoon.</p>`,
    tags: ["bungalow", "phú quốc", "nghỉ dưỡng", "resort", "biển"],
    province: "Kiên Giang",
    coverImageUrl: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&h=800&fit=crop",
  },
  {
    category: "Nghỉ dưỡng",
    title: "Wellness retreat tại Đà Lạt – 3 ngày detox tâm hồn và thể chất",
    summary: "Giữa nhịp sống hối hả, một kỳ nghỉ wellness retreat tại Đà Lạt là liều thuốc tinh thần hoàn hảo. Yoga buổi sáng, spa thảo dược, thiền định và ăn chay – trải nghiệm 3 ngày đổi thay quan niệm sống.",
    content: `<h2>Ngày 1: Đến và thả lỏng</h2>
<p>Check-in tại Ana Mandara Villas Đà Lạt – resort biệt thự Pháp được bao bọc bởi thông xanh và hoa dã quỳ vàng. Buổi chiều: massage thư giãn bằng đá nóng và tinh dầu thông Đà Lạt. Tối: ăn tối thuần chay thanh đạm.</p>
<h2>Ngày 2: Yoga & Thiền định</h2>
<p>5h30 sáng dậy tập yoga tại sân vườn, sương mờ Đà Lạt bao quanh tạo không gian huyền ảo. Sau đó là lớp thiền định 60 phút với thiền sư. Buổi chiều: tắm suối khoáng tự nhiên và đắp mặt nạ bùn núi lửa.</p>
<h2>Ngày 3: Hòa mình vào thiên nhiên</h2>
<p>Sáng: forest bathing (tắm rừng theo phong cách Nhật Bản Shinrin-yoku) trong rừng thông Prenn. Chiều: cooking class làm các món chay Đà Lạt. Kết thúc bằng buổi trà chiều ngắm hoàng hôn.</p>`,
    tags: ["wellness", "đà lạt", "retreat", "yoga", "spa", "lâm đồng"],
    province: "Lâm Đồng",
    coverImageUrl: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&h=800&fit=crop",
  },
];

// ── Hàm tạo delay nhỏ giữa các bài để slug suffix không bị trùng ─────────────
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in TLCN-BE/.env");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  // 1. Tìm Admin đầu tiên trong DB
  const admin = await Admin.findOne().lean();
  if (!admin) {
    console.error("❌ Không tìm thấy tài khoản Admin trong DB. Hãy đảm bảo có ít nhất 1 admin.");
    return;
  }
  console.log(`✅ Sẽ tạo bài viết với Admin: ${admin.email} (${admin._id})`);

  // 2. Thêm danh mục "Du lịch" cho TẤT CẢ bài viết hiện có KHÔNG có categories
  const updatedNoCat = await BlogPost.updateMany(
    { $or: [{ categories: { $exists: false } }, { categories: { $size: 0 } }] },
    { $set: { categories: ["Du lịch"] } }
  );
  console.log(`\n✅ Đã thêm danh mục "Du lịch" cho ${updatedNoCat.modifiedCount} bài viết chưa có danh mục.`);

  // 3. Tạo bài viết mới cho từng danh mục
  let createdCount = 0;
  let skippedCount = 0;

  for (const article of BLOG_ARTICLES) {
    // Kiểm tra xem đã có bài này chưa (dựa trên title)
    const existing = await BlogPost.findOne({ title: article.title }).lean();
    if (existing) {
      console.log(`⏭  Bỏ qua (đã tồn tại): "${article.title}"`);
      skippedCount++;
      continue;
    }

    const post = new BlogPost({
      title:        article.title,
      summary:      article.summary,
      content:      article.content,
      tags:         article.tags,
      categories:   [article.category],
      coverImageUrl: article.coverImageUrl,
      authorId:     admin._id,
      authorModel:  "Admin",
      privacy:      "public",
      province:     article.province || "",
      status:       "published",
      publishedAt:  new Date(),
    });

    await post.save();
    console.log(`✅ Tạo bài [${article.category}]: "${article.title}"`);
    createdCount++;

    // delay nhỏ để slug suffix không bị trùng
    await delay(10);
  }

  // 4. Thống kê theo danh mục
  console.log("\n── Thống kê danh mục sau khi seed ──────────────────────────");
  const categories = ["Du lịch", "Ẩm thực", "Trải nghiệm", "Review", "Cẩm nang", "Kinh nghiệm", "Nghỉ dưỡng"];
  for (const cat of categories) {
    const count = await BlogPost.countDocuments({
      categories: new RegExp(`^${cat}$`, "i"),
      status: "published",
    });
    console.log(`  ${cat.padEnd(12)}: ${count} bài viết published`);
  }

  const totalPublished = await BlogPost.countDocuments({ status: "published" });
  console.log(`\n  Tổng published: ${totalPublished} bài viết`);
  console.log(`\n✅ Seed hoàn tất! Đã tạo: ${createdCount}, bỏ qua: ${skippedCount} bài viết.`);
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  });
