import { Router } from "express";

const router = Router();

// Mock array of tourist wards/districts for the blog
const WARDS = [
  { _id: "w1", name: "Phường Bến Nghé, Quận 1, TP HCM" },
  { _id: "w2", name: "Phường Bến Thành, Quận 1, TP HCM" },
  { _id: "w3", name: "Phường Điện Biên, Ba Đình, Hà Nội" },
  { _id: "w4", name: "Phường Hàng Đào, Hoàn Kiếm, Hà Nội" },
  { _id: "w5", name: "Phường Minh An, Hội An, Quảng Nam" },
  { _id: "w6", name: "Phường Lộc Thọ, Nha Trang, Khánh Hòa" },
  { _id: "w7", name: "Phường 1, Đà Lạt, Lâm Đồng" },
  { _id: "w8", name: "Phường 2, Vũng Tàu, BR-VT" },
  { _id: "w9", name: "Thị trấn Sa Pa, Lào Cai" },
  { _id: "w10", name: "Khác / Ngoài danh sách" },
];

router.get("/", (req, res) => {
  res.json(WARDS);
});

router.get("/id/:id", (req, res) => {
  const w = WARDS.find((x) => x._id === req.params.id);
  if (!w) return res.status(404).json({ message: "Ward not found" });
  res.json(w);
});

router.get("/name/:name", (req, res) => {
  const name = req.params.name.toLowerCase();
  const w = WARDS.find((x) => x.name.toLowerCase().includes(name));
  if (!w) return res.status(404).json({ message: "Ward not found" });
  res.json(w);
});

export default router;
