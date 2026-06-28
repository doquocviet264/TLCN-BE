// src/controllers/departure.controller.js
import mongoose from "mongoose";
import { TourDeparture } from "../models/TourDeparture.js";
import { Tour }          from "../models/Tour.js";
import { Leader }        from "../models/Leader.js";
import { Expense }       from "../models/Expense.js";
import { Booking }       from "../models/Booking.js";
import { Notification }  from "../models/Notification.js";
import { sendMail } from "../services/mailer.js";
import { unlockProvinceForDeparture } from "../services/journey.service.js";

/* ========================================================
 *  1. Tạo lịch khởi hành mới cho 1 Tour Template
 *  POST /api/admin/tours/:tourId/departures
 * ======================================================== */
export const createDeparture = async (req, res) => {
  try {
    const { tourId } = req.params;
    if (!mongoose.isValidObjectId(tourId))
      return res.status(400).json({ message: "Invalid tourId" });

    const tour = await Tour.findById(tourId).select("_id title priceAdult priceChild");
    if (!tour) return res.status(404).json({ message: "Tour not found" });

    const {
      startDate, endDate,
      min_guests, current_guests,
      priceAdult, priceChild,
      status, leaderId
    } = req.body || {};

    if (!startDate || !endDate)
      return res.status(400).json({ message: "startDate & endDate are required" });

    if (leaderId && !mongoose.isValidObjectId(leaderId))
      return res.status(400).json({ message: "Invalid leaderId" });

    const departure = await TourDeparture.create({
      tourId:         new mongoose.Types.ObjectId(tourId),
      startDate:      new Date(startDate),
      endDate:        new Date(endDate),
      min_guests:     min_guests     ?? 10,
      current_guests: current_guests ?? 0,
      priceAdult:     priceAdult  ?? tour.priceAdult,
      priceChild:     priceChild  ?? tour.priceChild,
      status:         status      ?? "pending",
      leaderId:       leaderId    ? new mongoose.Types.ObjectId(leaderId) : null,
    });

    res.status(201).json({ message: "Departure created", departure });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  2. Liệt kê các lịch khởi hành của 1 Tour
 *  GET /api/admin/tours/:tourId/departures
 * ======================================================== */
export const listDepartures = async (req, res) => {
  try {
    const { tourId } = req.params;
    if (!mongoose.isValidObjectId(tourId))
      return res.status(400).json({ message: "Invalid tourId" });

    const { status, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = { tourId: new mongoose.Types.ObjectId(tourId) };
    
    // Lọc theo trạng thái
    if (status) filter.status = status;

    // Lọc theo khoảng thời gian khởi hành
    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) {
        // Thiết lập đến cuối ngày của endDate
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.startDate.$lte = end;
      }
    }

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(parseInt(limit, 10) || 50, 200);

    const [departures, total] = await Promise.all([
      TourDeparture.find(filter)
        .populate("leaderId", "fullName phoneNumber email")
        .sort({ startDate: 1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      TourDeparture.countDocuments(filter)
    ]);

    res.json({ total, page: p, limit: l, data: departures });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  3. Chi tiết 1 Departure
 *  GET /api/admin/departures/:id
 * ======================================================== */
export const getDepartureById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });

    const departure = await TourDeparture.findById(id)
      .populate("tourId",   "title destination images itinerary")
      .populate("leaderId", "fullName phoneNumber email")
      .lean();

    if (!departure) return res.status(404).json({ message: "Departure not found" });
    res.json(departure);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  4. Đổi trạng thái Departure
 *  PATCH /api/admin/departures/:id/status
 * ======================================================== */
export const patchDepartureStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });

    const ALLOWED = ["pending", "confirmed", "in_progress", "completed", "closed"];
    if (!ALLOWED.includes(status))
      return res.status(400).json({ message: `status must be one of: ${ALLOWED.join(", ")}` });

    // Lấy trạng thái hiện tại để so sánh
    const currentDep = await TourDeparture.findById(id).populate("tourId");
    if (!currentDep) return res.status(404).json({ message: "Departure not found" });

    const oldStatus = currentDep.status;
    const departure = await TourDeparture.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );

    // Xử lý tự động hủy đơn và thông báo khi status chuyển thành "closed"
    if (oldStatus !== "closed" && status === "closed") {
      const bookings = await Booking.find({
        tourDepartureId: id,
        bookingStatus: { $in: ["pending", "confirmed"] }
      });

      if (bookings.length > 0) {
        // Cập nhật tất cả các đơn này thành "cancelled"
        await Booking.updateMany(
          { _id: { $in: bookings.map(b => b._id) } },
          { $set: { bookingStatus: "cancelled" } }
        );

        // Chuẩn bị danh sách gửi thông báo in-app
        const userIds = [...new Set(bookings.filter(b => b.userId).map(b => b.userId.toString()))];
        if (userIds.length > 0) {
          const tourTitle = currentDep.tourId?.title || "Tour của bạn";
          const startDateStr = new Date(currentDep.startDate).toLocaleDateString("vi-VN");

          await Notification.create({
            type: "tour",
            targetType: "user",
            targetUsers: userIds,
            title: "Lịch khởi hành bị hủy",
            content: `Lịch khởi hành ngày ${startDateStr} của ${tourTitle} đã bị hủy. Đơn đặt chỗ của bạn đã được chuyển sang trạng thái Đã Hủy. Hệ thống sẽ liên hệ hoàn tiền sớm nhất nếu bạn đã thanh toán.`,
            link: "/user/history"
          });
        }

        // Gửi email
        for (const bk of bookings) {
          if (bk.email) {
            const tourTitle = currentDep.tourId?.title || "Tour của bạn";
            const startDateStr = new Date(currentDep.startDate).toLocaleDateString("vi-VN");
            
            await sendMail({
              to: bk.email,
              subject: `Thông báo hủy lịch khởi hành: ${tourTitle}`,
              html: `
                <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                  <h2 style="color: #e65100;">Thông báo Hủy Lịch Khởi Hành</h2>
                  <p>Kính chào quý khách <b>${bk.fullName || 'Khách hàng'}</b>,</p>
                  <p>Chúng tôi thành thật xin lỗi phải thông báo rằng lịch khởi hành ngày <b>${startDateStr}</b> cho <b>${tourTitle}</b> đã bị hủy.</p>
                  <p>Mã đơn đặt chỗ của bạn: <b>${bk.code}</b> đã được chuyển sang trạng thái <b>Đã Hủy</b>.</p>
                  <p>Nếu quý khách đã tiến hành thanh toán, đội ngũ của chúng tôi sẽ liên hệ để hướng dẫn thủ tục hoàn tiền (100%) trong thời gian sớm nhất.</p>
                  <p>Mong quý khách thông cảm cho sự bất tiện này.</p>
                  <br/>
                  <p>Trân trọng,<br/><b>Ban Quản Trị Hệ Thống Tour</b></p>
                </div>
              `
            }).catch(err => console.error(`Error sending cancel email to ${bk.email}:`, err));
          }
        }
      }
    }

    // Xử lý tự động thông báo khi status chuyển thành "confirmed"
    if (oldStatus !== "confirmed" && status === "confirmed") {
      const bookings = await Booking.find({
        tourDepartureId: id,
        bookingStatus: { $in: ["pending", "confirmed"] }
      });

      if (bookings.length > 0) {
        // Chuẩn bị danh sách gửi thông báo in-app
        const userIds = [...new Set(bookings.filter(b => b.userId).map(b => b.userId.toString()))];
        if (userIds.length > 0) {
          const tourTitle = currentDep.tourId?.title || "Tour của bạn";
          const startDateStr = new Date(currentDep.startDate).toLocaleDateString("vi-VN");

          await Notification.create({
            type: "tour",
            targetType: "user",
            targetUsers: userIds,
            title: "Lịch khởi hành đã được xác nhận",
            content: `Tuyệt vời! Lịch khởi hành ngày ${startDateStr} của ${tourTitle} đã chính thức được xác nhận. Vui lòng kiểm tra và hoàn tất thanh toán (nếu cần).`,
            link: "/user/history"
          });
        }

        // Gửi email
        for (const bk of bookings) {
          if (bk.email) {
            const tourTitle = currentDep.tourId?.title || "Tour của bạn";
            const startDateStr = new Date(currentDep.startDate).toLocaleDateString("vi-VN");
            
            await sendMail({
              to: bk.email,
              subject: `Xác nhận khởi hành: ${tourTitle}`,
              html: `
                <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                  <h2 style="color: #0288d1;">Lịch Khởi Hành Đã Được Xác Nhận</h2>
                  <p>Kính chào quý khách <b>${bk.fullName || 'Khách hàng'}</b>,</p>
                  <p>Chúng tôi rất vui được thông báo rằng lịch khởi hành ngày <b>${startDateStr}</b> cho <b>${tourTitle}</b> đã chính thức được <b>Xác nhận</b>.</p>
                  <p>Mã đơn đặt chỗ của bạn: <b>${bk.code}</b>.</p>
                  <p>Nếu quý khách mới chỉ thanh toán tiền cọc, vui lòng hoàn tất phần thanh toán còn lại trước ngày khởi hành theo quy định để đảm bảo dịch vụ.</p>
                  <p>Cảm ơn quý khách đã tin tưởng và đồng hành cùng chúng tôi. Chúc quý khách có một chuyến đi tuyệt vời!</p>
                  <br/>
                  <p>Trân trọng,<br/><b>Ban Quản Trị Hệ Thống Tour</b></p>
                </div>
              `
            }).catch(err => console.error(`Error sending confirmed email to ${bk.email}:`, err));
          }
        }
      }
    }

    res.json({ message: "Status updated", departure });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  5. Phân công Leader cho Departure
 *  PATCH /api/admin/departures/:id/leader
 * ======================================================== */
export const assignLeaderToDeparture = async (req, res) => {
  try {
    const { id } = req.params;
    const { leaderId } = req.body || {};

    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });

    if (leaderId !== null && leaderId !== undefined && !mongoose.isValidObjectId(leaderId))
      return res.status(400).json({ message: "Invalid leaderId" });

    // Nếu leaderId = null → gỡ leader
    let update;
    if (leaderId) {
      const leader = await Leader.findById(leaderId);
      if (!leader) return res.status(404).json({ message: "Leader not found" });
      update = { leaderId: leader._id };
    } else {
      update = { leaderId: null };
    }

    const departure = await TourDeparture.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    ).populate("leaderId", "fullName phoneNumber email");

    if (!departure) return res.status(404).json({ message: "Departure not found" });

    // --- TẠO THÔNG BÁO CHO KHÁCH HÀNG KHI PHÂN CÔNG HDV ---
    if (leaderId && update.leaderId) {
       const bookings = await Booking.find({
          tourDepartureId: id,
          bookingStatus: { $ne: "cancelled" },
          userId: { $ne: null }
       }).select("userId");

       const userIds = [...new Set(bookings.map(b => b.userId.toString()))];

       if (userIds.length > 0) {
          const leader = await Leader.findById(leaderId);
          Notification.create({
            type: "tour",
            title: "Cập nhật Hướng dẫn viên",
            content: `Chuyến đi của bạn đã được phân công Hướng dẫn viên: ${leader.fullName} - SĐT: ${leader.phoneNumber}.`,
            link: `/user/history`,
            targetType: "all", // Trick: use all to bypass single user schema limit if we want, or targetType: 'user' with targetUsers array. 
            // Wait, targetType: "user" allows multiple users in targetUsers array. Let's use targetType: "user".
            targetType: "user",
            targetUsers: userIds,
            targetTourId: departure.tourId,
          }).catch(console.error);
       }
    }
    // --------------------------------------------------------

    res.json({ message: "Leader assigned", departure });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  6. Thêm Timeline Event vào Departure (Admin)
 *  POST /api/admin/departures/:id/timeline
 * ======================================================== */
export const addTimelineToDeparture = async (req, res) => {
  try {
    const { id } = req.params;
    const { eventType, at, place, note } = req.body || {};

    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });

    const ALLOWED = ["departed", "arrived", "checkpoint", "note", "finished"];
    if (!ALLOWED.includes(eventType))
      return res.status(400).json({ message: "Invalid eventType" });

    const atDate = at ? new Date(at) : new Date();
    if (isNaN(atDate.getTime()))
      return res.status(400).json({ message: "Invalid 'at' datetime" });

    if (!req.user?.id || !mongoose.isValidObjectId(req.user.id))
      return res.status(401).json({ message: "Invalid admin ID" });

    const event = {
      eventType,
      at: atDate,
      place: place || "",
      note:  note  || "",
      createdBy: new mongoose.Types.ObjectId(req.user.id)
    };

    const update = { $push: { timeline: event } };
    if (eventType === "departed")  update.$set = { ...(update.$set || {}), departedAt: atDate, status: "in_progress" };
    if (eventType === "arrived")   update.$set = { ...(update.$set || {}), arrivedAt: atDate };
    if (eventType === "finished")  update.$set = { ...(update.$set || {}), finishedAt: atDate, status: "completed" };

    const departure = await TourDeparture.findByIdAndUpdate(id, update, { new: true });
    if (!departure) return res.status(404).json({ message: "Departure not found" });

    // Khi lịch trình kết thúc, tự động cập nhật các booking 'confirmed' sang 'completed'
    if (eventType === "finished") {
      await Booking.updateMany(
        { tourDepartureId: id, bookingStatus: "confirmed" },
        { $set: { bookingStatus: "completed" } }
      );
      await unlockProvinceForDeparture(id);
    }

    res.json({ message: "Timeline updated", departure });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  7. Thêm Chi Phí cho Departure (Admin)
 *  POST /api/admin/departures/:id/expenses
 * ======================================================== */
export const createExpenseForDeparture = async (req, res) => {
  try {
    const { id } = req.params; // departureId
    const { title, amount, note, visibleToCustomers = true } = req.body || {};

    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });
    if (!title || !Number.isFinite(Number(amount)))
      return res.status(400).json({ message: "title & amount are required" });
    if (!req.user?.id || !mongoose.isValidObjectId(req.user.id))
      return res.status(401).json({ message: "Invalid admin ID" });

    // Kiểm tra departure tồn tại
    const dep = await TourDeparture.exists({ _id: id });
    if (!dep) return res.status(404).json({ message: "Departure not found" });

    const expense = await Expense.create({
      tourDepartureId: new mongoose.Types.ObjectId(id),
      title,
      amount:           Number(amount),
      occurredAt:       new Date(),
      note:             note || "",
      visibleToCustomers: Boolean(visibleToCustomers),
      addedBy:          new mongoose.Types.ObjectId(req.user.id)
    });

    res.status(201).json({ message: "Expense created", expense });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  8. Danh Sách Chi Phí của Departure
 *  GET /api/admin/departures/:id/expenses
 * ======================================================== */
export const listExpensesForDeparture = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ message: "Invalid departure ID" });

    const items = await Expense.find({ tourDepartureId: id })
      .sort({ occurredAt: 1, _id: 1 })
      .lean();

    const total = items.reduce((s, e) => s + (e.amount || 0), 0);
    res.json({ total, count: items.length, items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  9. Danh sách Ongoing Departures (thay thế listOngoingTours cũ)
 *  GET /api/admin/departures/ongoing
 * ======================================================== */
export const listOngoingDepartures = async (req, res) => {
  try {
    const now = new Date();
    const onlyToday = String(req.query.onlyToday || "0") === "1";

    const filter = { status: { $in: ["confirmed", "in_progress"] } };
    if (onlyToday) {
      filter.startDate = { $lte: now };
      filter.endDate   = { $gte: now };
    }

    const data = await TourDeparture.find(filter)
      .populate("tourId",   "title destination")
      .populate("leaderId", "fullName phoneNumber")
      .select("tourId startDate endDate status leaderId current_guests min_guests departedAt arrivedAt finishedAt")
      .sort({ startDate: 1 })
      .lean();

    res.json({ total: data.length, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ========================================================
 *  10. Li?t k� to�n b? l?ch kh?i h�nh to�n h? th?ng (Global)
 *  GET /api/admin/reports
 * ======================================================== */
export const listAllDepartures = async (req, res) => {
  try {
    const { status, leaderId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (leaderId) filter.leaderId = new mongoose.Types.ObjectId(leaderId);

    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }

    const total = await TourDeparture.countDocuments(filter);
    const data = await TourDeparture.find(filter)
      .populate("tourId", "title destination images")
      .populate("leaderId", "fullName username")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    res.json({ total, page: Number(page), limit: Number(limit), data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
