import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import usersRouter from "./users";
import ticketsRouter from "./tickets";
import commentsRouter from "./comments";
import notesRouter from "./notes";
import activityRouter from "./activity";
import notificationsRouter from "./notifications";
import statsRouter from "./stats";
import stripeRouter from "./stripe";
import settingsRouter from "./settings";
import invitesRouter from "./invites";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(usersRouter);
router.use(ticketsRouter);
router.use(commentsRouter);
router.use(notesRouter);
router.use(activityRouter);
router.use(notificationsRouter);
router.use(statsRouter);
router.use(stripeRouter);
router.use(settingsRouter);
router.use(invitesRouter);

export default router;
