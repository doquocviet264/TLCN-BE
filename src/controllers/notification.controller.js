import { Notification } from "../models/Notification.js";
import mongoose from "mongoose";

// ==================== USER API ====================

// Lấy danh sách thông báo của User
export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const query = {
      isActive: true,
      $and: [
        {
          $or: [
            { targetType: "all" },
            { targetType: "user", targetUsers: userId },
          ]
        },
        {
          $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }]
        }
      ]
    };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);

    // Tính toán trường isRead cho từng notification
    const data = notifications.map((notif) => {
      const isRead = Array.isArray(notif.readBy) ? notif.readBy.some(
        (read) => read && read.userId && read.userId.toString() === userId.toString()
      ) : false;
      return { ...notif.toObject(), isRead };
    });

    res.status(200).json({
      success: true,
      data,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Đếm số lượng thông báo chưa đọc
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const query = {
      isActive: true,
      $and: [
        {
          $or: [
            { targetType: "all" },
            { targetType: "user", targetUsers: userId },
          ]
        },
        {
          $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }]
        }
      ],
      "readBy.userId": { $ne: userId },
    };

    const unreadCount = await Notification.countDocuments(query);

    res.status(200).json({ success: true, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Đánh dấu 1 thông báo là đã đọc
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông báo" });
    }

    // Kiểm tra xem đã đọc chưa
    const isRead = Array.isArray(notification.readBy) ? notification.readBy.some(
      (read) => read && read.userId && read.userId.toString() === userId.toString()
    ) : false;

    if (!isRead) {
      await Notification.updateOne(
        { _id: id },
        { $push: { readBy: { userId, readAt: new Date() } } }
      );
    }

    res.status(200).json({ success: true, message: "Đánh dấu đã đọc thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Đánh dấu tất cả thông báo là đã đọc
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const unreadNotifications = await Notification.find({
      isActive: true,
      $and: [
        {
          $or: [
            { targetType: "all" },
            { targetType: "user", targetUsers: userId },
          ]
        },
        {
          $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }]
        }
      ],
      "readBy.userId": { $ne: userId },
    });

    const updatePromises = unreadNotifications.map((notif) =>
      Notification.updateOne(
        { _id: notif._id },
        { $push: { readBy: { userId, readAt: new Date() } } }
      )
    );

    await Promise.all(updatePromises);

    res.status(200).json({ success: true, message: "Đã đánh dấu tất cả là đã đọc" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== ADMIN API ====================

export const getAllNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, targetType } = req.query;

    const query = {};
    if (type) query.type = type;
    if (targetType) query.targetType = targetType;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .populate("createdBy", "fullName email")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);

    res.status(200).json({
      success: true,
      data: notifications,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate("createdBy", "fullName email")
      .populate("targetUsers", "fullName email");

    if (!notification) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông báo" });
    }

    res.status(200).json({ success: true, data: notification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createNotification = async (req, res) => {
  try {
    const adminId = req.user._id; // Từ verifyAdmin
    const { type, title, content, image, link, targetType, targetUsers, expiresAt } = req.body;

    const newNotification = new Notification({
      type: type || "system",
      title,
      content,
      image,
      link,
      targetType: targetType || "all",
      targetUsers: targetUsers || [],
      createdBy: adminId,
      expiresAt: expiresAt || null,
    });

    await newNotification.save();

    res.status(201).json({
      success: true,
      message: "Tạo thông báo thành công",
      data: newNotification,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    
    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updatedNotification) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông báo" });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật thông báo thành công",
      data: updatedNotification,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedNotification = await Notification.findByIdAndDelete(id);

    if (!deletedNotification) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông báo" });
    }

    res.status(200).json({ success: true, message: "Đã xóa thông báo" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
