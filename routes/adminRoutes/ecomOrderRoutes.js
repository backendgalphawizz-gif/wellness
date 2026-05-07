const express = require("express");
const { protectAdmin } = require("../../middleware/auth");
const ecomOrderController = require("../../controllers/adminControllers/ecomOrderController");

const router = express.Router();

router.use(protectAdmin);

router.get("/", ecomOrderController.listOrders);
router.get("/:id", ecomOrderController.getOrderById);
router.post("/", ecomOrderController.createOrder);
router.patch("/:id", ecomOrderController.updateOrder);
router.delete("/:id", ecomOrderController.deleteOrder);

module.exports = router;
