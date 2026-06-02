import { ProvinceProgress } from "../models/ProvinceProgress.js";
import { Tour } from "../models/Tour.js";

const COLLECTIONS = [
  {
    id: "mien-trung",
    name: "Dấu chân miền Trung",
    description: "Khám phá vẻ đẹp cổ kính của dải đất miền Trung.",
    provinces: ["Đà Nẵng", "Thừa Thiên Huế", "Quảng Nam", "Quảng Bình", "Quảng Trị", "Quảng Ngãi"],
    icon: "compass"
  },
  {
    id: "nguoi-cua-bien",
    name: "Người của biển",
    description: "Tận hưởng làn gió biển và hải sản tươi ngon.",
    provinces: ["Bà Rịa - Vũng Tàu", "Phú Yên", "Khánh Hòa", "Ninh Thuận", "Bình Thuận"],
    icon: "anchor"
  },
  {
    id: "tay-bac",
    name: "Tây Bắc trong tim",
    description: "Chinh phục những cung đường đèo hùng vĩ.",
    provinces: ["Lào Cai", "Yên Bái", "Sơn La", "Lai Châu", "Điện Biên"],
    icon: "mountain"
  },
  {
    id: "cao-nguyen",
    name: "Cao nguyên đại ngàn",
    description: "Hoà mình vào thiên nhiên hoang sơ của Tây Nguyên.",
    provinces: ["Lâm Đồng", "Gia Lai", "Đắk Lắk", "Đắk Nông", "Kon Tum"],
    icon: "tree"
  },
  {
    id: "5-thanh-pho",
    name: "5 thành phố lớn",
    description: "Khám phá nhịp sống sôi động của các trung tâm kinh tế.",
    provinces: ["Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Cần Thơ", "Hải Phòng"],
    icon: "city"
  }
];

export const getMyCollections = async (req, res) => {
  try {
    const userId = req.user.id;
    const progressList = await ProvinceProgress.find({ userId });
    
    // Tạo set các tỉnh đã đi
    const unlockedProvinces = new Set();
    progressList.forEach(p => {
      unlockedProvinces.add(p.provinceName);
    });

    const collections = COLLECTIONS.map(col => {
      const unlockedCount = col.provinces.filter(p => unlockedProvinces.has(p)).length;
      const missingProvinces = col.provinces.filter(p => !unlockedProvinces.has(p));
      return {
        ...col,
        total: col.provinces.length,
        unlocked: unlockedCount,
        missingProvinces,
        completed: unlockedCount === col.provinces.length
      };
    });

    res.status(200).json({ success: true, data: collections });
  } catch (error) {
    console.error("Error in getMyCollections:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
};

export const getTourSuggestions = async (req, res) => {
  try {
    const userId = req.user.id;
    const progressList = await ProvinceProgress.find({ userId });
    
    const unlockedProvinces = new Set();
    progressList.forEach(p => {
      unlockedProvinces.add(p.provinceName);
    });

    // Gom các tỉnh còn thiếu từ các bộ sưu tập chưa hoàn thành
    let missingProvinces = new Set();
    COLLECTIONS.forEach(col => {
      const unlockedCount = col.provinces.filter(p => unlockedProvinces.has(p)).length;
      if (unlockedCount > 0 && unlockedCount < col.provinces.length) {
        // Bộ sưu tập đang đi dở
        col.provinces.forEach(p => {
          if (!unlockedProvinces.has(p)) missingProvinces.add(p);
        });
      }
    });

    if (missingProvinces.size === 0) {
      // Nếu chưa đi dở bộ nào, gợi ý các tỉnh chưa đi từ các bộ sưu tập
      COLLECTIONS.forEach(col => {
        col.provinces.forEach(p => {
          if (!unlockedProvinces.has(p)) missingProvinces.add(p);
        });
      });
    }

    const missingArray = Array.from(missingProvinces);

    const tours = await Tour.find({
      destination: { $in: missingArray },
      status: "active"
    })
      .select("title images priceAdult priceChild rating destination destinationSlug code time quantity")
      .limit(6)
      .lean();

    res.status(200).json({ success: true, data: tours });
  } catch (error) {
    console.error("Error in getTourSuggestions:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
};
