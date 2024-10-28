import { Router } from 'express'
import actionController from '../controller/action.controller.'

const actionRouter = Router()

actionRouter
    //@ts-ignore
    .post('/like', actionController.LikePost)
    // .post('/like', middleware.AccountVerificationHandler, postController.LikePost)
    //@ts-ignore
    .post('/comment', actionController.CommentPost)
    //@ts-ignore
    // .post('/follow', actionController.Follows)
    //@ts-ignore
    .post('/request', actionController.sendFollowRequest)
    //@ts-ignore
    .get("/request", actionController.getFollowRequests)
    //@ts-ignore
    .put("/request/accept", actionController.acceptFollowRequest)
    //@ts-ignore
    .put("/request/reject", actionController.rejectFollowRequest)
    //@ts-ignore
    .post('/unfollow', actionController.unfollowUser)
    //@ts-ignore
    .post('/report-post', actionController.reportPost)
    //@ts-ignore
    .post('/report-forum', actionController.reportForumQuestion)
    //@ts-ignore
    .delete('/comment', actionController.deleteComment)

export default actionRouter
