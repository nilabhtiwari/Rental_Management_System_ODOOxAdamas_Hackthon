const express = require("express");
const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  quoteProduct,
} = require("../controllers/productController");
const { protect, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", listProducts);
router.get("/:id", getProduct);
router.post("/:id/quote", quoteProduct);

router.post("/", protect, requireRole("admin", "staff"), createProduct);
router.put("/:id", protect, requireRole("admin", "staff"), updateProduct);
router.delete("/:id", protect, requireRole("admin"), deleteProduct);

module.exports = router;
