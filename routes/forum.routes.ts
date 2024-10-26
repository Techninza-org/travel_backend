import { Router } from "express";
import forumController from "../controller/forum.controller";
const forumRouter = Router();

//@ts-ignore
forumRouter.post("/", forumController.createForumQuestion)

//@ts-ignore
forumRouter.get("/", forumController.getAllForumQuestions)

//@ts-ignore
forumRouter.get("/:id", forumController.getForumQuestion)

//@ts-ignore
forumRouter.delete("/:id", forumController.deleteForum)

//@ts-ignore
forumRouter.post("/answer/:id", forumController.createAnswer)

//@ts-ignore
forumRouter.post("/like/:id", forumController.likeQuestion)

//@ts-ignore
forumRouter.post("/location", forumController.getForumQuestionsByLocation)

export default forumRouter
