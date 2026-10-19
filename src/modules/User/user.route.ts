import { Router } from "express";
import { userController } from "./user.controller";
import { auth } from "../../middlewares/auth";

const router = Router();

router.patch("/me/profile", auth(), userController.updateMyProfile);


router.get("/", auth("ADMIN"), userController.getAllUsers);
router.patch("/:id/status", auth("ADMIN"), userController.updateUserStatus);

export const userRouters = router;
