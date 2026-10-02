import { Router, type IRouter } from "express";
import dashboardRouter from "./dashboard";
import healthRouter from "./health";
import identityRouter from "./identity";

const router: IRouter = Router();

router.use(healthRouter);
router.use(identityRouter);
router.use(dashboardRouter);

export default router;
