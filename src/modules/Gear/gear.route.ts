import { Router } from "express";
import { gearController } from "./gear.controller";
import { auth } from "../../middlewares/auth";

const router = Router();


router.get("/", gearController.getAllGears);


router.get("/mine", auth("PROVIDER"), gearController.getMyGear);
router.post("/", auth("PROVIDER"), gearController.createGear);
router.put("/:id", auth("PROVIDER"), gearController.updateGear);
router.delete("/:id", auth("PROVIDER"), gearController.deleteGear);


router.get("/:id", gearController.getGearById);

export const gearRoutes = router;
