import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import ticketsRouter from "./tickets";
import commentsRouter from "./comments";
import notesRouter from "./notes";
import activityRouter from "./activity";
import notificationsRouter from "./notifications";
import statsRouter from "./stats";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(ticketsRouter);
router.use(commentsRouter);
router.use(notesRouter);
router.use(activityRouter);
router.use(notificationsRouter);
router.use(statsRouter);
router.use(stripeRouter);

export default router;
