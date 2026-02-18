import { Router } from "express";
import { authRouter } from "./auth.routes";
import { sosRouter } from "./sos.routes";
import { usersRouter } from "./users.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/sos", sosRouter);
