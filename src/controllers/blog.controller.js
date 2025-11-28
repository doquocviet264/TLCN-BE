// src/controllers/blog.controller.js
import mongoose from "mongoose";
import { BlogPost } from "../models/BlogPost.js";

/** Helper: tính lại ratingAvg & ratingCount */
function recalcRating(post) {
  const list = post.comments || [];
  if (!list.length) {
    post.ratingAvg = 0;
    post.ratingCount = 0;
    return;
  }
  const sum = list.reduce((s, c) => s + (c.rating || 0), 0);
  post.ratingCount = list.length;
  post.ratingAvg = sum / list.length;
}

/** ========== PUBLIC ========== */

// GET /api/blog
export const listPublicPosts = async (req, res) => {
  const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);
  const { q, tag } = req.query;

  const filter = { status: "published" };
  if (q && q.trim()) {
    const regex = new RegExp(q.trim(), "i");
    filter.$or = [
      { title: regex },
      { summary: regex },
      { content: regex }
    ];
  }
  if (tag) {
    filter.tags = tag;
  }

  const [data, total] = await Promise.all([
    BlogPost.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    BlogPost.countDocuments(filter)
  ]);

  res.json({ total, page, limit, data });
};

// GET /api/blog/:slug
export const getPostBySlug = async (req, res) => {
  const { slug } = req.params;
  const post = await BlogPost.findOne({ slug, status: "published" }).lean();
  if (!post) return res.status(404).json({ message: "Post not found" });
  res.json(post);
};

/** ========== ADMIN CRUD ========== */

// GET /api/blog/admin/list
export const listAllPostsAdmin = async (req, res) => {
  const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
  const { status } = req.query;

  const filter = {};
  if (status) filter.status = status;

  const [data, total] = await Promise.all([
    BlogPost.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    BlogPost.countDocuments(filter)
  ]);

  res.json({ total, page, limit, data });
};

// GET /api/blog/admin/:id
export const getPostByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const post = await BlogPost.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/blog/admin
export const createPost = async (req, res) => {
  try {
    const { title, summary, content, tags, coverImageUrl, coverImagePublicId, status } = req.body;

    const post = new BlogPost({
      title,
      summary,
      content,
      tags,
      coverImageUrl,
      coverImagePublicId,
      authorId: req.user?.id,              // admin hiện tại
      status: status || "draft"
    });

    if (post.status === "published" && !post.publishedAt) {
      post.publishedAt = new Date();
    }

    await post.save();
    res.status(201).json({ message: "Created", post });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/blog/admin/:id
export const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const body = { ...req.body };
    // không cho update ratingAvg/Count trực tiếp
    delete body.ratingAvg;
    delete body.ratingCount;
    delete body.comments;

    const post = await BlogPost.findByIdAndUpdate(id, body, { new: true });
    if (!post) return res.status(404).json({ message: "Post not found" });

    res.json({ message: "Updated", post });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/blog/admin/:id
export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const ok = await BlogPost.findByIdAndDelete(id);
    if (!ok) return res.status(404).json({ message: "Post not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** ========== ADMIN: UPDATE STATUS ========== */

// PATCH /api/blog/admin/:id/status
export const updatePostStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const ALLOWED = ["draft", "published", "archived"];
    if (!ALLOWED.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const post = await BlogPost.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.status = status;
    if (status === "published" && !post.publishedAt) {
      post.publishedAt = new Date();
    }
    if (status !== "published") {
      // tuỳ em: có thể giữ publishedAt hoặc clear
      // post.publishedAt = null;
    }

    await post.save();
    res.json({ message: "Status updated", post });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** ========== COMMENT + RATING (USER) ========== */

// GET /api/blog/:slug/comments
export const listComments = async (req, res) => {
  const { slug } = req.params;
  const post = await BlogPost.findOne({ slug, status: "published" })
    .select("comments ratingAvg ratingCount")
    .lean();
  if (!post) return res.status(404).json({ message: "Post not found" });
  res.json(post);
};

// POST /api/blog/:slug/comments
export const addComment = async (req, res) => {
  try {
    const { slug } = req.params;
    const { rating, content } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Content is required" });
    }

    const post = await BlogPost.findOne({ slug, status: "published" });
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = {
      userId: req.user.id,
      fullName: req.user.fullName || "",   // nếu token không có thì thôi
      rating,
      content: content.trim()
    };

    post.comments.push(comment);
    recalcRating(post);
    await post.save();

    const inserted = post.comments[post.comments.length - 1];
    res.status(201).json({
      message: "Comment added",
      comment: inserted,
      ratingAvg: post.ratingAvg,
      ratingCount: post.ratingCount
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/blog/:slug/comments/:commentId
export const updateComment = async (req, res) => {
  try {
    const { slug, commentId } = req.params;
    const { rating, content } = req.body;

    const post = await BlogPost.findOne({ slug, status: "published" });
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // chỉ chủ comment hoặc admin mới được sửa
    const isOwner = String(comment.userId) === String(req.user.id);
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }
      comment.rating = rating;
    }
    if (content !== undefined) {
      comment.content = content.trim();
    }
    comment.updatedAt = new Date();

    recalcRating(post);
    await post.save();

    res.json({
      message: "Comment updated",
      comment,
      ratingAvg: post.ratingAvg,
      ratingCount: post.ratingCount
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/blog/:slug/comments/:commentId
export const deleteComment = async (req, res) => {
  try {
    const { slug, commentId } = req.params;

    const post = await BlogPost.findOne({ slug, status: "published" });
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const isOwner = String(comment.userId) === String(req.user.id);
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    comment.deleteOne(); // xoá khỏi array
    recalcRating(post);
    await post.save();

    res.json({
      message: "Comment deleted",
      ratingAvg: post.ratingAvg,
      ratingCount: post.ratingCount
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
