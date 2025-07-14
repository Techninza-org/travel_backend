import { Router } from 'express'
import postController from '../controller/posts.controller'
import { upload } from '..'
// import middleware from '../utils/middleware'
const postRouter = Router()

//@ts-ignore
postRouter
    //@ts-ignore
    .get('/', postController.GetPosts)
    //@ts-ignore
    .get('/videos', postController.GetOnlyVideos)
    //@ts-ignore
    .get('/:id', postController.GetSpecificPost)
    //@ts-ignore
    // .post('/', postController.CreatePost)
    .post('/', upload.single('image'), postController.CreatePost)
    //@ts-ignore
    .post('/template', upload.array('videos', 10), postController.createTemplate)
    //@ts-ignore
    .delete('/:id', postController.DeletePost)
    //@ts-ignore
    .post('/user', postController.GetPostsByUserId)
    //@ts-ignore
    .put('/edit/:id', postController.editPost)
    //@ts-ignore
    .get('/get/memories', postController.getMemories)
    //@ts-ignore
    .get('/templates/all', postController.getAdminTemplates)

export default postRouter
