import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { getMyCollections, getTourSuggestions } from "../controllers/journey.controller.js";

const router = Router();

// GET /api/journey/collections/me
router.get("/collections/me", auth, getMyCollections);

// GET /api/journey/suggestions
router.get("/suggestions", auth, getTourSuggestions);

export default router;
