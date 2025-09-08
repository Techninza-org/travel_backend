// eslint-disable-next-line @typescript-eslint/ban-ts-comment@ts-nocheck
import { Router } from 'express'
import userController, { followerFollowingHilights } from '../controller/user.controller'
import { upload } from '../index'
const userRouter = Router()

userRouter
    //@ts-ignore
    .get('/all', userController.get_all_users)
    //@ts-ignore
    .get("/suggest", userController.getSuggestion)
    //@ts-ignore
    .get("/search/:username", userController.getUsersByUsername)
    //@ts-ignore
    .put("/status", userController.userTravelingStatus)
    //@ts-ignore
    .post("/travel_status", userController.updateUserTravelStatusNew)
    //@ts-ignore
    .put("/visible", userController.visibleStatus)
    //@ts-ignore
    .post("/block", userController.blockUser)
    //@ts-ignore
    .get("/block", userController.getBlockedUsers)
    //@ts-ignore
    .post("/unblock", userController.unblockUser)
    //@ts-ignore
    .get('/feed', userController.get_user_feed)
    //@ts-ignore
    .get('/feed/:place', userController.feedByPlace)
    //@ts-ignore
    .get('/', userController.get_user_details)
    //@ts-ignore
    .put('/', upload.single('profile_pic'), userController.update_user)  
    //@ts-ignore
    .put('/bg', upload.single('bg'), userController.update_user_bg)  
    //@ts-ignore
    .get('/followers', userController.Get_follower)
    //@ts-ignore
    .get('/following', userController.GET_following)
    //@ts-ignore
    .get('/followers-following', userController.getFollowersAndFollowing)
    //@ts-ignore
    .put('/location', userController.updateLatLong)
    //@ts-ignore
    .put('/registrationToken', userController.updateRegistrationToken)
    //@ts-ignore
    .get('/nearby', userController.getNearbyUsers)
    //@ts-ignore
    .delete('/delete', userController.deleteAccount)
    //@ts-ignore
    .post('/reset', userController.changePassword)
    //@ts-ignore
    .put('/rating', userController.rateService)
    //@ts-ignore
    .post('/friends/:id', userController.getUserFollowersFollowingById)
    //@ts-ignore
    .post('/kyc', userController.submitKycDetails)
    //@ts-ignore
    .post('/followStatus', userController.getFollowStatus)
    //@ts-ignore
    .get('/pin', userController.getPinnedLocations)
    //@ts-ignore
    .post('/pin', userController.pinLocation)
    //@ts-ignore
    .delete('/pin/:id', userController.deletePinnedLocation)
    //@ts-ignore
    .get('/notifications', userController.getNotifications)
    //@ts-ignore
    .delete('/notifications', userController.deleteNotification)
    //@ts-ignore
    .put('/notifications/read', userController.markAsRead)
    //@ts-ignore
    .get('/suggestions', userController.friendsSuggestions)
    //@ts-ignore
    .put('/switch-notifications', userController.switchPushNotifications)
    //@ts-ignore
    .post('/create-transaction', userController.createTransaction)
    //@ts-ignore
    .get('/transactions', userController.getTransactions)
    //@ts-ignore
    .post("/create-highlight", userController.createHighlight)
    //@ts-ignore
    .get("/highlights", userController.getHighlightsAll)
    //@ts-ignore
    .post("/addToHighlight", userController.addPostToHighlight)
    //@ts-ignore
    .get("/highlights/:id", userController.getHighlightById)
    //@ts-ignore
    .get("/user_highlights/:user_id", userController.getHighlightsByUserId)
    //@ts-ignore
    .post("/add_itinerary", userController.createItinerary)
    //@ts-ignore
    .post("/get_itinerary", userController.getItineraries)
    //@ts-ignore
    .post('/add_member_to_itinerary', userController.addUserToItineraryMembers)
    //@ts-ignore
    .post("/update_details_to_itinerary_city", userController.updateDetailsToItineraryCity)
    //@ts-ignore
    .post("/test", userController.test)
    //@ts-ignore
    .post("/marketplace", userController.marketPlace)
    //@ts-ignore
    .get("/marketplace", userController.getMarketplaceDetails)
    //@ts-ignore
    .delete("/itenerary", userController.deleteItenerary)
    //@ts-ignore
    .get("/campanion", userController.searchUsers)
    //@ts-ignore
    .post("/query", userController.submitQuery)
    //@ts-ignore
    .get("/highlights_with_users", followerFollowingHilights)
    //@ts-ignore
    .post('/gpt', userController.gpt)
    //@ts-ignore
    .post('/auto-suggest-quotes', userController.autoSuggestQuotesByWords)
    //@ts-ignore
    .get('/click_travel_request/:id', userController.addUserInTravelRequestResuests)
    //@ts-ignore
    .post('/travel_request', userController.createTravelRequest)
    //@ts-ignore
    .get('/travel_request/get/my', userController.getMyTravelRequests)
    //@ts-ignore
    .get('/travel_request', userController.getAllTravelRequests)
    //@ts-ignore
    .get('/travel_request/destination/:destination_id', userController.getTravelRequestsByDestinationId)
    //@ts-ignore
    .delete('/travel_request/:request_id', userController.deleteTravelRequestById)
    //@ts-ignore
    .get('/airport/:airport_code', userController.getAirportDetailsByAirportCode)
    //@ts-ignore
    .get('/airport', userController.getAllAirports)
    //@ts-ignore
    .get('/filter_travel_requests', userController.filterTravelRequests)
    //@ts-ignore
    .delete('/deleteItinerary/:id', userController.deleteItineraryById)
    //@ts-ignore
    .get('/domestic_packages_home', userController.domesticPackages)
    //@ts-ignore
    .get('/international_packages_home', userController.intlPackages)
    //@ts-ignore
    .get('/domestic_by_category/:category', userController.getDomesticPackagesByCategoryName)
    //@ts-ignore
    .get('/intl_by_category/:category', userController.getIntlPackagesByCategoryName)
    //@ts-ignore
    .get('/domestic_by_state/:state', userController.getDomesticPackagesByStateName)
    //@ts-ignore
    .get('/intl_by_country/:country', userController.getIntlPackagesByCountryName)
    //@ts-ignore
    .get('/package/:id', userController.getPackageById)

export default userRouter
