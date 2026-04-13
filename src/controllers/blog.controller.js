// src/controllers/blog.controller.js
import mongoose from "mongoose";
import { BlogPost } from "../models/BlogPost.js";
import { BlogComment } from "../models/BlogComment.js";
import cloudinary from "../config/cloudinary.js";

/** Helper: tính lại ratingAvg & ratingCount */
async function recalcGlobalRating(blogId) {
  const result = await BlogComment.aggregate([
    { $match: { blogId: new mongoose.Types.ObjectId(blogId) } },
    { $group: { _id: null, ratingAvg: { $avg: "$rating" }, ratingCount: { $sum: 1 } } }
  ]);
  const stats = result[0] || { ratingAvg: 0, ratingCount: 0 };
  await BlogPost.findByIdAndUpdate(blogId, {
    ratingAvg: stats.ratingAvg,
    ratingCount: stats.ratingCount
  });
  return stats;
}

/** ========== PUBLIC ========== */

// GET /api/blog
export const listPublicPosts = async (req, res) => {
  const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);
  const { q, tag, category } = req.query;

  const filter = {
    $or: [{ status: "published", privacy: "public" }]
  };
  if (req.user) {
    filter.$or.push({ authorId: req.user.id, authorModel: "User" });
  }
  if (q && q.trim()) {
    const regex = new RegExp(q.trim(), "i");
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { title: regex },
        { summary: regex },
        { content: regex },
        { tags: regex }
      ]
    });
  }
  if (tag) {
    filter.$and = filter.$and || [];
    filter.$and.push({ tags: new RegExp(tag, "i") });
  }
  if (category) {
    filter.$and = filter.$and || [];
    filter.$and.push({ categories: category });
  }

  const [data, total, totalComments, allAuthorsResult] = await Promise.all([
    BlogPost.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("authorId", "firstName lastName fullName email avatar avatarUrl")
      .lean(),
    BlogPost.countDocuments(filter),
    BlogComment.countDocuments(),
    BlogPost.distinct("authorId", { status: "published" })
  ]);

  const totalAuthors = allAuthorsResult.length;

  const blogIds = data.map(post => post._id);
  const commentsCounts = await BlogComment.aggregate([
    { $match: { blogId: { $in: blogIds } } },
    { $group: { _id: "$blogId", count: { $sum: 1 } } }
  ]);
  const commentsMap = {};
  commentsCounts.forEach(c => commentsMap[c._id.toString()] = c.count);

  const formattedData = data.map(post => {
      let authorObj = { name: "Admin", avatar: "/Logo.svg" };
      if (post.authorId && typeof post.authorId === "object") {
        authorObj.name = `${post.authorId.firstName || ""} ${post.authorId.lastName || ""}`.trim() || post.authorId.fullName || post.authorId.email || "Admin";
        authorObj.avatar = post.authorId.avatar || post.authorId.avatarUrl || "/Logo.svg";
      }
      post.author = authorObj;
      post.commentsCount = commentsMap[post._id.toString()] || 0;
      return post;
  });

  res.json({ total, page, limit, totalComments, totalAuthors, data: formattedData });
};

// GET /api/blog/:slug
export const getPostBySlug = async (req, res) => {
  const { slug } = req.params;
  const post = await BlogPost.findOne({ slug, status: "published", privacy: "public" })
    .populate("authorId", "firstName lastName fullName email avatar avatarUrl")
    .lean();
  if (!post) return res.status(404).json({ message: "Post not found" });

  // Định dạng lại tên author
  let authorObj = { name: "Admin", avatar: "/Logo.svg" };
  if (post.authorId && typeof post.authorId === "object") {
    authorObj.name = `${post.authorId.firstName || ""} ${post.authorId.lastName || ""}`.trim() || post.authorId.fullName || post.authorId.email || "Admin";
    authorObj.avatar = post.authorId.avatar || post.authorId.avatarUrl || "/Logo.svg";
  }
  post.author = authorObj;

  // Tính LIVE rating từ BlogComment (thay vì dùng giá trị cũ lưu trong BlogPost)
  const ratingResult = await BlogComment.aggregate([
    { $match: { blogId: post._id } },
    { $group: { _id: null, ratingAvg: { $avg: "$rating" }, ratingCount: { $sum: 1 } } }
  ]);
  const ratingStats = ratingResult[0] || { ratingAvg: 0, ratingCount: 0 };
  post.ratingAvg = ratingStats.ratingAvg ? Math.round(ratingStats.ratingAvg * 10) / 10 : 0;
  post.ratingCount = ratingStats.ratingCount;

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
      .populate("authorId", "firstName lastName fullName email avatar avatarUrl")
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
    const { title, summary, content, tags, categories, coverImageUrl, coverImagePublicId, status } = req.body;

    const post = new BlogPost({
      title,
      summary,
      content,
      tags,
      categories,
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

/** ========== ADMIN: MIGRATION UTILS ========== */

// POST /api/blog/admin/sync-ratings
// Chạy 1 lần để sync toàn bộ ratingAvg/ratingCount từ BlogComment vào BlogPost
export const syncAllRatings = async (req, res) => {
  try {
    const posts = await BlogPost.find({}).select("_id").lean();
    let updated = 0;
    for (const post of posts) {
      const result = await BlogComment.aggregate([
        { $match: { blogId: post._id } },
        { $group: { _id: null, ratingAvg: { $avg: "$rating" }, ratingCount: { $sum: 1 } } }
      ]);
      const stats = result[0] || { ratingAvg: 0, ratingCount: 0 };
      await BlogPost.findByIdAndUpdate(post._id, {
        ratingAvg: stats.ratingAvg ? Math.round(stats.ratingAvg * 10) / 10 : 0,
        ratingCount: stats.ratingCount
      });
      updated++;
    }
    res.json({ message: `Synced ${updated} posts OK` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** ========== ADMIN: UPDATE STATUS ========== */

// PATCH /api/blog/admin/:id/status
export const updatePostStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectReason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const ALLOWED = ["draft", "pending", "published", "archived", "rejected"];
    if (!ALLOWED.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const post = await BlogPost.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.status = status;
    if (status === "published" && !post.publishedAt) {
      post.publishedAt = new Date();
    }
    if (status === "rejected" && rejectReason) {
      post.rejectReason = rejectReason;
    }
    if (status !== "rejected") {
      post.rejectReason = ""; // clear reject reason if status changes
    }

    await post.save();
    res.json({ message: "Status updated", post });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** ========== USER CRUD ========== */

// POST /api/blog/user
export const createPostUser = async (req, res) => {
  try {
    const { title, summary, content, tags, categories, coverImageUrl, coverImagePublicId, privacy, locationDetail, province, ward } = req.body;

    // Handle stringified arrays from FormData if necessary
    let parsedTags = tags;
    if (typeof tags === 'string') {
      try { parsedTags = JSON.parse(tags); } catch (e) { parsedTags = [tags]; }
    }

    let parsedCategories = categories;
    if (typeof categories === 'string') {
      try { parsedCategories = JSON.parse(categories); } catch (e) { parsedCategories = [categories]; }
    }

    // Xử lý upload ảnh qua Cloudinary nếu có req.file
    let uploadedCoverUrl = coverImageUrl;
    let uploadedCoverPublicId = coverImagePublicId;

    if (req.file) {
      const folder = process.env.CLOUDINARY_FOLDER || "travela/blogs";
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: "image", overwrite: true },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        stream.end(req.file.buffer);
      });
      uploadedCoverUrl = uploadResult.secure_url;
      uploadedCoverPublicId = uploadResult.public_id;
    }

    const post = new BlogPost({
      title,
      summary,
      content,
      tags: parsedTags,
      categories: parsedCategories,
      coverImageUrl: uploadedCoverUrl,
      coverImagePublicId: uploadedCoverPublicId,
      authorId: req.user?.id,
      authorModel: "User",
      privacy: privacy || "public",
      locationDetail,
      province,
      ward,
      status: privacy === "private" ? "published" : "pending" // If private, it can be published immediately. If public, needs approval.
    });

    if (post.status === "published") {
      post.publishedAt = new Date();
    }

    await post.save();
    res.status(201).json({ message: "Created", post, slug: post.slug });
  } catch (err) {
    console.error("[createPostUser] Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/blog/user/my-posts
export const getMyPosts = async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);

    const filter = { authorId: req.user.id, authorModel: "User" };

    const [data, total] = await Promise.all([
      BlogPost.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("authorId", "firstName lastName fullName email avatar avatarUrl")
        .lean(),
      BlogPost.countDocuments(filter)
    ]);

    res.json({ total, page, limit, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/blog/user/:id
export const updateOwnPost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const post = await BlogPost.findOne({ _id: id, authorId: req.user.id, authorModel: "User" });
    if (!post) {
      return res.status(404).json({ message: "Post not found or unauthorized" });
    }

    const { title, summary, content, tags, categories, coverImageUrl, coverImagePublicId, privacy, locationDetail, province, ward } = req.body;

    let parsedTags = tags;
    if (tags && typeof tags === 'string') {
      try { parsedTags = JSON.parse(tags); } catch (e) { parsedTags = [tags]; }
    }

    let parsedCategories = categories;
    if (categories && typeof categories === 'string') {
      try { parsedCategories = JSON.parse(categories); } catch (e) { parsedCategories = [categories]; }
    }

    if (title) post.title = title;
    if (summary !== undefined) post.summary = summary;
    if (content !== undefined) post.content = content;
    if (parsedTags) post.tags = parsedTags;
    if (parsedCategories) post.categories = parsedCategories;
    if (coverImageUrl) post.coverImageUrl = coverImageUrl;
    if (coverImagePublicId) post.coverImagePublicId = coverImagePublicId;

    // Nếu người dùng upload cover mới
    if (req.file) {
      const folder = process.env.CLOUDINARY_FOLDER || "travela/blogs";
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder, resource_type: "image", overwrite: true },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        stream.end(req.file.buffer);
      });
      
      // Xoá ảnh cũ để dọn dẹp bộ nhớ Cloudinary
      if (post.coverImagePublicId) {
        try {
          await cloudinary.uploader.destroy(post.coverImagePublicId);
        } catch (e) {}
      }

      post.coverImageUrl = uploadResult.secure_url;
      post.coverImagePublicId = uploadResult.public_id;
    }

    if (privacy) post.privacy = privacy;
    if (locationDetail !== undefined) post.locationDetail = locationDetail;
    if (province !== undefined) post.province = province;
    if (ward !== undefined) post.ward = ward;

    // Reset status to pending if updated from rejected or published (for public posts)
    if (post.privacy === "public") {
      post.status = "pending";
      post.rejectReason = "";
    } else if (post.privacy === "private") {
      post.status = "published";
    }

    await post.save();
    res.json({ message: "Updated", post });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/blog/user/:id
export const deleteOwnPost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const ok = await BlogPost.findOneAndDelete({ _id: id, authorId: req.user.id, authorModel: "User" });
    if (!ok) return res.status(404).json({ message: "Post not found or unauthorized" });

    // Xoá ảnh cover cũ trên Cloudinary
    if (ok.coverImagePublicId) {
      try {
        await cloudinary.uploader.destroy(ok.coverImagePublicId);
      } catch (e) {}
    }

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/blog/user/preview/:slug
export const previewOwnPost = async (req, res) => {
  try {
    const { slug } = req.params;
    const post = await BlogPost.findOne({ slug, authorId: req.user.id, authorModel: "User" })
      .populate("authorId", "firstName lastName fullName email avatar avatarUrl")
      .lean();
      
    if (!post) return res.status(404).json({ message: "Post not found or unauthorized" });

    let authorObj = { name: "Admin", avatar: "/Logo.svg" };
    if (post.authorId && typeof post.authorId === "object") {
      authorObj.name = `${post.authorId.firstName || ""} ${post.authorId.lastName || ""}`.trim() || post.authorId.fullName || post.authorId.email || "Admin";
      authorObj.avatar = post.authorId.avatar || post.authorId.avatarUrl || "/Logo.svg";
    }
    post.author = authorObj;

    const ratingResult = await BlogComment.aggregate([
      { $match: { blogId: post._id } },
      { $group: { _id: null, ratingAvg: { $avg: "$rating" }, ratingCount: { $sum: 1 } } }
    ]);
    const ratingStats = ratingResult[0] || { ratingAvg: 0, ratingCount: 0 };
    post.ratingAvg = ratingStats.ratingAvg ? Math.round(ratingStats.ratingAvg * 10) / 10 : 0;
    post.ratingCount = ratingStats.ratingCount;

    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/blog/user/:id
export const getOwnPostById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const post = await BlogPost.findOne({ _id: id, authorId: req.user.id, authorModel: "User" }).lean();
    if (!post) return res.status(404).json({ message: "Post not found" });

     res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/** ========== COMMENT + RATING (USER) ========== */

// GET /api/blog/:slug/comments
export const listComments = async (req, res) => {
  const { slug } = req.params;
  const post = await BlogPost.findOne({ slug, status: "published" }).select("ratingAvg ratingCount").lean();
  if (!post) return res.status(404).json({ message: "Post not found" });

  const comments = await BlogComment.find({ blogId: post._id })
    .populate("userId", "firstName lastName fullName email avatar avatarUrl")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ ...post, comments });
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

    const newComment = await BlogComment.create({
      blogId: post._id,
      userId: req.user.id,
      fullName: req.user.fullName || "",
      rating,
      content: content.trim()
    });

    const stats = await recalcGlobalRating(post._id);

    res.status(201).json({
      message: "Comment added",
      comment: newComment,
      ratingAvg: stats.ratingAvg,
      ratingCount: stats.ratingCount
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

    const comment = await BlogComment.findById(commentId);
    if (!comment || String(comment.blogId) !== String(post._id)) {
      return res.status(404).json({ message: "Comment not found" });
    }

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
    
    await comment.save();

    const stats = await recalcGlobalRating(post._id);

    res.json({
      message: "Comment updated",
      comment,
      ratingAvg: stats.ratingAvg,
      ratingCount: stats.ratingCount
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

    const comment = await BlogComment.findById(commentId);
    if (!comment || String(comment.blogId) !== String(post._id)) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const isOwner = String(comment.userId) === String(req.user.id);
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await BlogComment.findByIdAndDelete(commentId);
    const stats = await recalcGlobalRating(post._id);

    res.json({
      message: "Comment deleted",
      ratingAvg: stats.ratingAvg,
      ratingCount: stats.ratingCount
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
