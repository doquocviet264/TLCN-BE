import "dotenv/config";
import mongoose from "mongoose";
import { Tour } from "../src/models/Tour.js";
import { connectMongo } from "../src/config/mongo.js";

// Seed data cho tours với itinerary đầy đủ
const toursData = [
  {
    title: "Du lịch Hạ Long - Vịnh Kỳ Quan 3N2Đ",
    time: "3 ngày 2 đêm",
    description: "Khám phá vẻ đẹp tuyệt vời của Vịnh Hạ Long - Di sản thiên nhiên thế giới. Tham quan hang Sửng Sốt, đảo Ti Tốp, làng chài Cửa Vạn.",
    quantity: 30,
    priceAdult: 3500000,
    priceChild: 2500000,
    destination: "Quảng Ninh",
    startDate: new Date("2025-12-15"),
    endDate: new Date("2025-12-17"),
    min_guests: 10,
    current_guests: 0,
    status: "pending",
    images: [
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=800",
      "https://images.unsplash.com/photo-1559628376-f3fe5f782a2e?w=800",
      "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800",
      "https://images.unsplash.com/photo-1578986175247-7d60c6e2c2b0?w=800",
      "https://images.unsplash.com/photo-1559628376-f3fe5f782a2e?w=800"
    ],
    itinerary: [
      {
        day: 1,
        title: "Hà Nội - Hạ Long - Đón khách và lên tàu",
        summary: "Khởi hành từ Hà Nội, di chuyển đến Hạ Long, check-in tàu và bắt đầu hành trình khám phá vịnh.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "07:00 - Xe đón khách tại điểm hẹn ở Hà Nội",
              "Khởi hành đi Hạ Long, dừng chân nghỉ ngơi tại trạm dừng chân",
              "Tham quan cơ sở làm ngọc trai"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "12:00 - Đến Hạ Long, check-in tàu du lịch",
              "Dùng bữa trưa với hải sản tươi ngon trên tàu",
              "Tham quan hang Sửng Sốt - hang động đẹp nhất Hạ Long",
              "Leo lên đảo Ti Tốp ngắm toàn cảnh vịnh từ trên cao"
            ]
          },
          {
            timeOfDay: "evening",
            title: "Buổi tối",
            items: [
              "18:00 - Dùng bữa tối trên tàu",
              "Tự do câu mực, hát karaoke, câu cá đêm",
              "Nghỉ đêm trên tàu"
            ]
          }
        ],
        photos: [
          "https://images.unsplash.com/photo-1528127269322-539801943592?w=800"
        ]
      },
      {
        day: 2,
        title: "Khám phá vịnh Hạ Long - Làng chài Cửa Vạn",
        summary: "Tiếp tục hành trình khám phá vẻ đẹp của Vịnh Hạ Long và làng chài truyền thống.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "06:30 - Tập Thái Cực Quyền trên boong tàu",
              "07:00 - Dùng điểm tâm sáng",
              "Tham quan làng chài Cửa Vạn, chèo kayak khám phá hang động",
              "Tìm hiểu đời sống người dân làng chài"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "12:00 - Dùng bữa trưa trên tàu",
              "Tham quan hang Luồn - hang động đẹp với ánh sáng tự nhiên",
              "Tắm biển tại bãi tắm Soi Sim",
              "Thư giãn và tận hưởng không khí trong lành"
            ]
          },
          {
            timeOfDay: "evening",
            title: "Buổi tối",
            items: [
              "18:30 - BBQ tiệc nướng trên boong tàu",
              "Chương trình văn nghệ, karaoke",
              "Nghỉ đêm trên tàu"
            ]
          }
        ],
        photos: [
          "https://images.unsplash.com/photo-1559628376-f3fe5f782a2e?w=800"
        ]
      },
      {
        day: 3,
        title: "Hạ Long - Hà Nội - Chia tay đoàn",
        summary: "Kết thúc chuyến tham quan, trở về Hà Nội với những kỷ niệm đẹp.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "06:00 - Ngắm bình minh trên vịnh",
              "07:00 - Dùng điểm tâm sáng",
              "Check-out khỏi tàu, trả phòng",
              "Di chuyển về bến tàu, lên xe về Hà Nội"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "12:00 - Dùng cơm trưa tại nhà hàng",
              "Tiếp tục hành trình về Hà Nội",
              "15:00 - Về đến Hà Nội, chia tay đoàn",
              "Kết thúc chương trình tham quan"
            ]
          }
        ],
        photos: []
      }
    ]
  },
  {
    title: "Phú Quốc - Thiên Đường Biển Đảo 4N3Đ",
    time: "4 ngày 3 đêm",
    description: "Tận hưởng kỳ nghỉ tại đảo ngọc Phú Quốc với bãi biển tuyệt đẹp, hải sản tươi ngon và các hoạt động vui chơi giải trí phong phú.",
    quantity: 25,
    priceAdult: 6500000,
    priceChild: 4500000,
    destination: "Kiên Giang",
    startDate: new Date("2025-12-20"),
    endDate: new Date("2025-12-23"),
    min_guests: 12,
    current_guests: 0,
    status: "pending",
    images: [
      "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800",
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
      "https://images.unsplash.com/photo-1559628376-f3fe5f782a2e?w=800",
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=800"
    ],
    itinerary: [
      {
        day: 1,
        title: "TP.HCM - Phú Quốc - Nghỉ dưỡng",
        summary: "Bay từ TP.HCM đến Phú Quốc, check-in resort và tự do nghỉ dưỡng.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "06:00 - Tập trung tại sân bay Tân Sơn Nhất",
              "Làm thủ tục bay đến Phú Quốc",
              "Đến Phú Quốc, xe đón đoàn đi về resort"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "Check-in resort 4-5 sao",
              "Tự do nghỉ ngơi, tắm biển",
              "Khám phá khu resort"
            ]
          },
          {
            timeOfDay: "evening",
            title: "Buổi tối",
            items: [
              "Dùng bữa tối buffet tại resort",
              "Tự do dạo chợ đêm Phú Quốc",
              "Nghỉ ngơi tại resort"
            ]
          }
        ],
        photos: ["https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800"]
      },
      {
        day: 2,
        title: "Khám phá Nam đảo - VinWonders",
        summary: "Tham quan các điểm đến nổi tiếng ở Nam Phú Quốc và vui chơi tại VinWonders.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "Ăn sáng tại resort",
              "Tham quan làng chài Hàm Ninh",
              "Chùa Hộ Quốc - ngôi chùa lớn nhất Phú Quốc",
              "Chụp ảnh tại Hòn Thơm cable car"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "Dùng cơm trưa",
              "Tham quan VinWonders Phú Quốc",
              "Vui chơi tại công viên nước Aquatopia",
              "Trải nghiệm các trò chơi cảm giác mạnh"
            ]
          },
          {
            timeOfDay: "evening",
            title: "Buổi tối",
            items: [
              "Dùng bữa tối tại VinWonders",
              "Xem show nhạc nước, pháo hoa",
              "Về resort nghỉ ngơi"
            ]
          }
        ],
        photos: ["https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800"]
      },
      {
        day: 3,
        title: "Tour 4 đảo - Lặn ngắm san hô",
        summary: "Khám phá 4 đảo đẹp nhất Phú Quốc và trải nghiệm lặn ngắm san hô.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "07:00 - Ăn sáng tại resort",
              "Lên canoe tham quan 4 đảo",
              "Đảo Móng Tay - check-in cầu gỗ Instagram",
              "Lặn ngắm san hô tại Hòn Mây Rút"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "BBQ trưa trên đảo",
              "Câu cá, đánh bắt tôm hùm",
              "Tắm biển tại bãi Sao",
              "Về resort nghỉ ngơi"
            ]
          },
          {
            timeOfDay: "evening",
            title: "Buổi tối",
            items: [
              "Tự do dùng bữa tối",
              "Tham quan chợ đêm, mua sắm đặc sản",
              "Nghỉ ngơi tại resort"
            ]
          }
        ],
        photos: ["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800"]
      },
      {
        day: 4,
        title: "Phú Quốc - TP.HCM",
        summary: "Check-out resort, tự do mua sắm trước khi bay về TP.HCM.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "Ăn sáng tại resort",
              "Check-out, trả phòng",
              "Tự do tắm biển lần cuối",
              "Mua sắm đặc sản: sim rượu, nước mắm, ngọc trai"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "Ra sân bay Phú Quốc",
              "Bay về TP.HCM",
              "Về đến Tân Sơn Nhất, chia tay đoàn",
              "Kết thúc chương trình"
            ]
          }
        ],
        photos: []
      }
    ]
  },
  {
    title: "Sapa - Chinh Phục Fansipan 3N2Đ",
    time: "3 ngày 2 đêm",
    description: "Chinh phục đỉnh Fansipan - Nóc nhà Đông Dương, khám phá bản làng người dân tộc, thưởng thức ẩm thực đặc sản Tây Bắc.",
    quantity: 20,
    priceAdult: 4200000,
    priceChild: 3000000,
    destination: "Lào Cai",
    startDate: new Date("2025-12-25"),
    endDate: new Date("2025-12-27"),
    min_guests: 10,
    current_guests: 0,
    status: "pending",
    images: [
      "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800",
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=800",
      "https://images.unsplash.com/photo-1559628376-f3fe5f782a2e?w=800"
    ],
    itinerary: [
      {
        day: 1,
        title: "Hà Nội - Sapa",
        summary: "Khởi hành từ Hà Nội, di chuyển đến Sapa, tham quan làng Cát Cát.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "06:00 - Xe đón tại điểm hẹn Hà Nội",
              "Khởi hành đi Sapa qua cao tốc Nội Bài - Lào Cai",
              "Dừng chân nghỉ ngơi tại Yên Bái"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "12:00 - Đến Sapa, dùng cơm trưa",
              "Check-in khách sạn",
              "Tham quan làng Cát Cát - tìm hiểu văn hóa dân tộc H'Mông",
              "Chụp ảnh tại thác Cát Cát"
            ]
          },
          {
            timeOfDay: "evening",
            title: "Buổi tối",
            items: [
              "Dùng bữa tối với các món đặc sản Sapa",
              "Tự do dạo phố Sapa về đêm",
              "Nghỉ đêm tại khách sạn"
            ]
          }
        ],
        photos: ["https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800"]
      },
      {
        day: 2,
        title: "Chinh phục Fansipan",
        summary: "Lên đỉnh Fansipan bằng cáp treo, ngắm toàn cảnh núi non Tây Bắc từ độ cao 3143m.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "07:00 - Ăn sáng tại khách sạn",
              "Đi cáp treo Fansipan Legend - cáp treo 3 dây dài nhất thế giới",
              "Chinh phục đỉnh Fansipan 3143m",
              "Check-in tại cột cờ Tổ quốc trên đỉnh núi"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "Dùng cơm trưa tại nhà hàng trên núi",
              "Tham quan khu du lịch Sun World Fansipan Legend",
              "Chụp ảnh tại vườn hoa, tượng Phật bà",
              "Xuống núi bằng cáp treo"
            ]
          },
          {
            timeOfDay: "evening",
            title: "Buổi tối",
            items: [
              "Về khách sạn nghỉ ngơi",
              "Dùng bữa tối",
              "Tự do khám phá chợ đêm Sapa",
              "Nghỉ đêm"
            ]
          }
        ],
        photos: ["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800"]
      },
      {
        day: 3,
        title: "Sapa - Hà Nội",
        summary: "Tham quan thung lũng Mường Hoa, trở về Hà Nội.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "07:00 - Ăn sáng, check-out khách sạn",
              "Tham quan thung lũng Mường Hoa",
              "Ghé bản Lao Chải - Tả Van",
              "Tìm hiểu cuộc sống người dân tộc Giáy, Dao"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "11:30 - Dùng cơm trưa tại Sapa",
              "Khởi hành về Hà Nội",
              "Dừng chân mua đặc sản: cá hồi, rau rừng",
              "18:00 - Về đến Hà Nội, chia tay đoàn"
            ]
          }
        ],
        photos: []
      }
    ]
  },
  {
    title: "Đà Nẵng - Hội An - Bà Nà Hills 4N3Đ",
    time: "4 ngày 3 đêm",
    description: "Khám phá thành phố đáng sống Đà Nẵng, phố cổ Hội An và khu du lịch Bà Nà Hills với cầu Vàng nổi tiếng.",
    quantity: 28,
    priceAdult: 5800000,
    priceChild: 4200000,
    destination: "Đà Nẵng",
    startDate: new Date("2026-01-05"),
    endDate: new Date("2026-01-08"),
    min_guests: 15,
    current_guests: 0,
    status: "pending",
    images: [
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800",
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=800",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
      "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800",
      "https://images.unsplash.com/photo-1559628376-f3fe5f782a2e?w=800"
    ],
    itinerary: [
      {
        day: 1,
        title: "TP.HCM - Đà Nẵng - Tham quan thành phố",
        summary: "Bay từ TP.HCM đến Đà Nẵng, tham quan các điểm đến nổi tiếng trong thành phố.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "Tập trung tại sân bay Tân Sơn Nhất",
              "Bay đến Đà Nẵng",
              "Đón đoàn tại sân bay, di chuyển về khách sạn"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "Check-in khách sạn",
              "Tham quan chùa Linh Ứng - tượng Phật Bà cao 67m",
              "Bán đảo Sơn Trà, ngắm toàn cảnh Đà Nẵng",
              "Tắm biển tại bãi biển Mỹ Khê"
            ]
          },
          {
            timeOfDay: "evening",
            title: "Buổi tối",
            items: [
              "Dùng bữa tối hải sản",
              "Ngắm cầu Rồng phun lửa (tối thứ 7, Chủ nhật)",
              "Nghỉ đêm tại Đà Nẵng"
            ]
          }
        ],
        photos: ["https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800"]
      },
      {
        day: 2,
        title: "Bà Nà Hills - Cầu Vàng",
        summary: "Tham quan khu du lịch Bà Nà Hills, trải nghiệm cáp treo kỷ lục.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "Ăn sáng tại khách sạn",
              "Di chuyển đến Bà Nà Hills",
              "Đi cáp treo lên núi Bà Nà",
              "Tham quan làng Pháp, Cầu Vàng"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "Dùng buffet trưa tại Bà Nà",
              "Vui chơi tại Fantasy Park",
              "Tham quan vườn hoa Le Jardin D'Amour",
              "Chụp ảnh tại các điểm check-in"
            ]
          },
          {
            timeOfDay: "evening",
            title: "Buổi tối",
            items: [
              "Xuống núi về Đà Nẵng",
              "Dùng bữa tối",
              "Tự do dạo phố, mua sắm",
              "Nghỉ đêm"
            ]
          }
        ],
        photos: ["https://images.unsplash.com/photo-1528127269322-539801943592?w=800"]
      },
      {
        day: 3,
        title: "Hội An - Phố cổ",
        summary: "Tham quan phố cổ Hội An - Di sản văn hóa thế giới.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "Ăn sáng, check-out khách sạn Đà Nẵng",
              "Di chuyển đến Hội An",
              "Check-in khách sạn Hội An",
              "Tham quan làng rau Trà Quế, trải nghiệm làm nông"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "Dùng cơm trưa đặc sản Hội An",
              "Tham quan phố cổ: Chùa Cầu, Hội quán Phúc Kiến",
              "Nhà cổ Tấn Ký, Phùng Hưng",
              "Thả đèn hoa đăng trên sông Hoài"
            ]
          },
          {
            timeOfDay: "evening",
            title: "Buổi tối",
            items: [
              "Tự do dùng bữa tối",
              "Dạo phố cổ Hội An về đêm",
              "Mua sắm đặc sản, may áo dài",
              "Nghỉ đêm tại Hội An"
            ]
          }
        ],
        photos: ["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800"]
      },
      {
        day: 4,
        title: "Hội An - Đà Nẵng - TP.HCM",
        summary: "Tự do nghỉ dưỡng, bay về TP.HCM.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "Ăn sáng tại khách sạn",
              "Tự do tắm biển An Bàng",
              "Check-out khách sạn",
              "Mua sắm đặc sản cuối cùng"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "Di chuyển ra sân bay Đà Nẵng",
              "Bay về TP.HCM",
              "Về đến Tân Sơn Nhất, chia tay đoàn",
              "Kết thúc chương trình"
            ]
          }
        ],
        photos: []
      }
    ]
  },
  {
    title: "Nha Trang - Vinpearl Land 3N2Đ",
    time: "3 ngày 2 đêm",
    description: "Khám phá thành phố biển Nha Trang xinh đẹp, tham quan Vinpearl Land và trải nghiệm các hoạt động thể thao nước.",
    quantity: 32,
    priceAdult: 4800000,
    priceChild: 3500000,
    destination: "Khánh Hòa",
    startDate: new Date("2026-01-10"),
    endDate: new Date("2026-01-12"),
    min_guests: 15,
    current_guests: 0,
    status: "pending",
    images: [
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800",
      "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800",
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=800",
      "https://images.unsplash.com/photo-1559628376-f3fe5f782a2e?w=800"
    ],
    itinerary: [
      {
        day: 1,
        title: "TP.HCM - Nha Trang",
        summary: "Bay từ TP.HCM đến Nha Trang, check-in và nghỉ dưỡng.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "Tập trung tại sân bay Tân Sơn Nhất",
              "Bay đến Nha Trang",
              "Đón đoàn tại sân bay Cam Ranh"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "Check-in khách sạn",
              "Tự do nghỉ ngơi, tắm biển",
              "Tham quan bãi biển Nha Trang"
            ]
          },
          {
            timeOfDay: "evening",
            title: "Buổi tối",
            items: [
              "Dùng bữa tối hải sản",
              "Tự do dạo phố biển",
              "Nghỉ đêm"
            ]
          }
        ],
        photos: ["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800"]
      },
      {
        day: 2,
        title: "Tour 4 đảo Nha Trang",
        summary: "Tham quan 4 đảo đẹp nhất Nha Trang, lặn ngắm san hô.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "07:30 - Ăn sáng tại khách sạn",
              "Lên tàu tour 4 đảo",
              "Tham quan Hòn Mun - lặn ngắm san hô",
              "Trải nghiệm trò chơi thể thao nước"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "Dùng cơm trưa trên tàu",
              "Tham quan bể cá Trí Nguyên",
              "Hòn Tằm - tắm biển, thư giãn",
              "Về bến tàu"
            ]
          },
          {
            timeOfDay: "evening",
            title: "Buổi tối",
            items: [
              "Về khách sạn nghỉ ngơi",
              "Tự do dùng bữa tối",
              "Tắm bùn I-Resort (tự túc)",
              "Nghỉ đêm"
            ]
          }
        ],
        photos: ["https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800"]
      },
      {
        day: 3,
        title: "Vinpearl Land - TP.HCM",
        summary: "Vui chơi tại Vinpearl Land, bay về TP.HCM.",
        segments: [
          {
            timeOfDay: "morning",
            title: "Buổi sáng",
            items: [
              "Ăn sáng, check-out khách sạn",
              "Đi cáp treo qua Vinpearl Land",
              "Vui chơi tại công viên nước",
              "Trải nghiệm các trò chơi cảm giác mạnh"
            ]
          },
          {
            timeOfDay: "afternoon",
            title: "Buổi chiều",
            items: [
              "Dùng trưa tại Vinpearl",
              "Tiếp tục vui chơi",
              "Di chuyển ra sân bay Cam Ranh",
              "Bay về TP.HCM, chia tay đoàn"
            ]
          }
        ],
        photos: []
      }
    ]
  }
];

async function seedTours() {
  try {
    console.log("🔄 Starting tours seed...");
    console.log("=".repeat(80));
    
    // Connect to MongoDB
    await connectMongo();

    // Clear existing tours (optional)
    const deletedCount = await Tour.deleteMany({});
    console.log(`🗑️  Deleted ${deletedCount.deletedCount} existing tours`);
    console.log("=".repeat(80));

    // Insert tours
    const createdTours = await Tour.insertMany(toursData);
    console.log(`\n✅ Successfully created ${createdTours.length} tour(s)`);
    console.log("=".repeat(80));

    // Log created tours with details
    console.log("\n📋 CREATED TOURS DETAILS:");
    console.log("=".repeat(80));
    
    createdTours.forEach((tour, index) => {
      console.log(`\n${index + 1}. TOUR: ${tour.title}`);
      console.log(`   ${"─".repeat(76)}`);
      console.log(`   ID: ${tour._id}`);
      console.log(`   Destination: ${tour.destination} (Slug: ${tour.destinationSlug})`);
      console.log(`   Duration: ${tour.time}`);
      console.log(`   Price: Adult ${tour.priceAdult.toLocaleString()}đ | Child ${tour.priceChild.toLocaleString()}đ`);
      console.log(`   Dates: ${tour.startDate.toLocaleDateString('vi-VN')} → ${tour.endDate.toLocaleDateString('vi-VN')}`);
      console.log(`   Capacity: ${tour.current_guests}/${tour.quantity} (Min: ${tour.min_guests})`);
      console.log(`   Status: ${tour.status}`);
      console.log(`   Images: ${tour.images.length} images`);
      console.log(`   Itinerary: ${tour.itinerary.length} days`);
      
      // Log itinerary summary
      if (tour.itinerary && tour.itinerary.length > 0) {
        console.log(`\n   📅 ITINERARY SUMMARY:`);
        tour.itinerary.forEach((day) => {
          console.log(`      Day ${day.day}: ${day.title}`);
          console.log(`         - ${day.segments.length} segments (${day.segments.map(s => s.timeOfDay).join(', ')})`);
          console.log(`         - ${day.segments.reduce((total, s) => total + s.items.length, 0)} activities`);
        });
      }
      
      console.log(`   ${"─".repeat(76)}`);
    });

    console.log("\n" + "=".repeat(80));
    console.log("📊 STATISTICS:");
    console.log("=".repeat(80));
    console.log(`Total Tours: ${createdTours.length}`);
    console.log(`Total Capacity: ${createdTours.reduce((sum, t) => sum + t.quantity, 0)} guests`);
    console.log(`Average Price (Adult): ${(createdTours.reduce((sum, t) => sum + t.priceAdult, 0) / createdTours.length).toLocaleString()}đ`);
    console.log(`Destinations: ${[...new Set(createdTours.map(t => t.destination))].join(', ')}`);
    console.log(`Total Images: ${createdTours.reduce((sum, t) => sum + t.images.length, 0)}`);
    console.log(`Total Itinerary Days: ${createdTours.reduce((sum, t) => sum + t.itinerary.length, 0)}`);

    console.log("\n" + "=".repeat(80));
    console.log("🔍 VALIDATION TEST:");
    console.log("=".repeat(80));
    
    // Test query tours
    const allTours = await Tour.find({}).lean();
    console.log(`✓ Query all tours: ${allTours.length} found`);
    
    const pendingTours = await Tour.find({ status: 'pending' }).lean();
    console.log(`✓ Query pending tours: ${pendingTours.length} found`);
    
    const hasItinerary = allTours.filter(t => t.itinerary && t.itinerary.length > 0);
    console.log(`✓ Tours with itinerary: ${hasItinerary.length}`);
    
    const hasImages = allTours.filter(t => t.images && t.images.length >= 5);
    console.log(`✓ Tours with 5+ images: ${hasImages.length}`);

    console.log("\n" + "=".repeat(80));
    console.log("✨ Tours seed completed successfully!");
    console.log("=".repeat(80));
    
  } catch (error) {
    console.error("\n❌ ERROR SEEDING TOURS:");
    console.error("=".repeat(80));
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 MongoDB disconnected");
    process.exit(0);
  }
}

seedTours();
