import { validationResult } from "express-validator";

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const mapped = errors.array().map(e => ({ field: e.path, msg: e.msg }));
  return res.status(400).json({ message: "Validation error", errors: mapped });
};
