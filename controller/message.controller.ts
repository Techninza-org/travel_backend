import { NextFunction, Response } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import { getUserToken, io, sendMessageNotif, sendMessageNotification } from '../app'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export const sendMessage = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const senderId = req.user.id
        const receiverId = req.params.receiverId
        console.log(senderId, receiverId, 'senderId, receiverId');
        
        const rec = await prisma.user.findUnique({ where: { id: Number(receiverId) } });
        console.log(rec, 'rec');
        
        if (!rec) return res.status(404).send({ message: 'Receiver not found' })
        const message = req.body.message.trim()
        if (!message || !receiverId) return res.status(400).send({ message: 'Receiver and message are required' })
        if (senderId === receiverId) return res.status(400).send({ message: 'You can not send message to yourself' })
        let senderConversations = await prisma.participant.findMany({
            where: {
                userId: senderId,
            },
        })
        let senderConversationIds = senderConversations.map((participant) => participant.conversationId)

        let getConversation = await prisma.conversation.findFirst({
            where: {
                id: {
                    in: senderConversationIds,
                },
                participants: {
                    some: {
                        userId: Number(receiverId),
                    },
                },
                type: {
                    not: 'GROUP',   
                },
            },
        })
        console.log(getConversation, 'getConversation');
        
       
        if (!getConversation) {
            getConversation = await prisma.conversation.create({
                data: {},
            })

            await prisma.participant.create({
                data: {
                    userId: senderId,
                    conversationId: getConversation.id,
                },
            })
            
            await prisma.participant.create({
                data: {
                    userId: Number(receiverId),
                    conversationId: getConversation.id,
                },
            })
        }
        console.log(getConversation, 'getConversation 2');
        

        const newMessage = await prisma.message.create({
            data: {
                user_id: senderId,
                message,
                receiver_id: Number(receiverId),
                conversation_id: getConversation.id,
            },
        })
        console.log(newMessage, 'newMessage');
        
        
        if (newMessage) {
            await prisma.conversation.update({
                where: { id: getConversation.id },
                data: {
                    messages: {
                        connect: { 
                            id: newMessage.id
                        },
                    },
                },
            })
        }
        
        io.emit("newMessage", { message: newMessage })
        console.log('msg emitted');
        

        const convo = await prisma.conversation.findFirst({
            where: {
                id: getConversation.id
            },
            include: { messages: true, participants: {select: {user: {select: {username: true, image: true, id: true}}}}}
        })
        console.log(convo, 'convo');
        
        if(convo?.messages.length === 1){
            const sender = await prisma.user.findUnique({ where: { id: senderId } });
            const senderProfilePic = sender?.image ?? '';
            sendMessageNotif(senderId, Number(receiverId), senderProfilePic, 'New Message', `${sender?.username} sent you a message`, String(getConversation.id));
            const receiver = await prisma.user.findUnique({ where: { id: Number(receiverId) } });
            const receiverToken = receiver?.registrationToken;
            if (receiverToken) {
                const payload = {
                    title: 'New Message',
                    body: `${sender?.username} sent you a message`
                };
                const res = sendMessageNotification(receiverToken, payload, String(getConversation.id));
                console.log(res, 'res');
            }
        }
        console.log('convo updated');
        return res.status(200).send({ message: 'Message sent' })
    } catch (err) {
        console.log(err);
        return res.status(400).send({ message: 'Error sending message' })
    }
}

export const sendGroupMessage = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const senderId = req.user.id
        const conversationId = req.params.conversationId
        const message = req.body.message.trim()
        if (!message || !conversationId) return res.status(400).send({ message: 'Group and message are required' })
        const group = await prisma.conversation.findFirst({
            where: {
                id: Number(conversationId),
                participants: {
                    some: {
                        userId: senderId
                    }
                },
            }
        })
        if(!group) return res.status(404).send({ message: 'Group not found' })
        const newMessage = await prisma.message.create({
            data: {
                user_id: senderId,
                conversation_id: Number(conversationId),
                message
            }
        })
        if(newMessage) {
            await prisma.conversation.update({
                where: { id: Number(conversationId) },
                data: {
                    messages: {
                        connect: { id: newMessage.id }
                    }
                }
            })
        }
        io.emit("newMessage", { message: newMessage })
        return res.status(200).send({ message: 'Message sent' })
    }catch(err){
        return res.status(500).send({ message: 'Error sending message' })
    }
}

export const createGroup = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const senderId = req.user.id
        const participants = req.body.participants
        const groupName = req.body.groupName
        const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
        const profile_pic = sender?.image ?? '';
        if(!participants || participants.length === 0) return res.status(400).send({ message: 'Participants are required' })
        participants.push(senderId)
        const conversation = await prisma.conversation.create({
            data: {
                name: groupName,
                type: 'GROUP'
            }
        })
        for(const participant of participants){
            const participantExists = await prisma.user.findUnique({ where: { id: Number(participant) } });
            if(!participantExists) return res.status(404).send({ message: 'Participant not found' })
                if(participant === senderId) {
                    await prisma.participant.create({
                        data: {
                            userId: Number(participant),
                            conversationId: conversation.id,
                            isAdmin: true
                        }
                    })
                }else{
                    await prisma.participant.create({
                        data: {
                            userId: Number(participant),
                            conversationId: conversation.id,
                        }
                    })
                }
            
            if(Number(participant) !== senderId){
                await sendMessageNotif(senderId, participant, profile_pic, 'New Group', `${req.user.username} added you in a group`, String(conversation.id));
                const receiverToken = await getUserToken(participant);
            if (receiverToken) {
                const payload = {
                    title: 'New Group',
                    body: `${req.user.username} added you in a group`
                };
                await sendMessageNotification(receiverToken, payload, String(conversation.id));
            }
            }
        }
        return res.status(200).send({ message: 'Group created', conversationId: conversation.id})
    }catch(err){
        return res.status(500).send({ message: 'Error creating group' })
    }
}

export const editGroupName = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const senderId = req.user.id
        const groupName = req.body.groupName
        const conversationId = req.params.conversationId
        if(!groupName) return res.status(400).send({ message: 'Group name is required' })
        const participantIsAdmin = await prisma.participant.findFirst({
            where: {
                userId: senderId,
                conversationId: Number(conversationId),
                isAdmin: true
            }})
            
        if(!participantIsAdmin) return res.status(403).send({ message: 'You are not admin of this group' })
        const group = await prisma.conversation.findFirst({
            where: {
                id: Number(conversationId),
                participants: {
                    some: {
                        userId: senderId
                    }
                },
            }
        })
        if(!group) return res.status(404).send({ message: 'Group not found' })
        await prisma.conversation.update({
            where: { id: Number(conversationId) },
            data: { name: groupName }
        })
        return res.status(200).send({ message: 'Group name updated' })
    }catch(err){
        return res.status(500).send({ message: 'Error updating group name' })
    }
}

export const removeParticipantFromGroup = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const senderId = req.user.id
        const participantId = Number(req.body.participantId)
        const conversationId = req.params.conversationId
        if(!participantId) return res.status(400).send({ message: 'Participant id is required' })
        const group = await prisma.conversation.findFirst({
            where: {
                id: Number(conversationId),
                participants: {
                    some: {
                        userId: senderId
                    }
                },
            }
        })
        if(!group) return res.status(404).send({ message: 'Group not found' })
        const participant = await prisma.participant.findFirst({
    where: {
        userId: participantId,
        conversationId: Number(conversationId)
    }})
    if(!participant){
        return res.status(404).send({ message: 'Participant not found in group' })
    }
        await prisma.participant.delete({
            where: {
                id: participant.id
            }
        })
        return res.status(200).send({ message: 'Participant removed from group' })
    }catch(err){
        return res.status(500).send({ message: 'Error removing participant from group' })
    }
}

export const addParticipantsToGroup = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const senderId = req.user.id
        const participants = req.body.participants
        const conversationId = req.params.conversationId
        const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
        const profile_pic = sender?.image ?? '';
        if(!participants) return res.status(400).send({ message: 'Participants are required' })
        const group = await prisma.conversation.findFirst({
            where: {
                id: Number(conversationId),
                participants: {
                    some: {
                        userId: senderId
                    }
                },
            }
        })
        if(!group) return res.status(404).send({ message: 'Group not found' })
        for( const participant of participants){ 
            await prisma.participant.create({
                data: {
                    userId: Number(participant),
                    conversationId: Number(conversationId),
                }
            })
            await sendMessageNotif(senderId, participant, profile_pic, 'New Group', `${req.user.username} added you in a group`, String(conversationId));
            const receiverToken = await getUserToken(participant);
            if (receiverToken) {
                const payload = {
                    title: 'New Group',
                    body: `${req.user.username} added you in a group`
                };
                await sendMessageNotification(receiverToken, payload, String(conversationId));
            }
        }
        return res.status(200).send({ message: 'Participants added to group' })
    }catch(err){
        return res.status(500).send({ message: 'Error adding participants to group' })
    }
}

export const getConversationByConvoId = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const senderId = req.user.id
        const conversationId = Number(req.params.conversationId)
        if (typeof conversationId !== 'number' || !Number.isInteger(conversationId) || conversationId <= 0) {
            return res.status(400).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Conversation id should be a positive integer value',
            });
        }

        const getConversation = await prisma.conversation.findFirst({
            where: {
                id: conversationId,
                participants: {
                    some: {
                        userId: senderId,
                    },
                },
            },
            include: {
                messages: true,
                participants: {
                    select: {
                        isAdmin: true,
                        user: {
                            select: {
                                username: true,
                                image: true,
                                id: true,
                            },
                        },
                    },
                },
            },
        })

        if (!getConversation) return res.status(404).send({ message: 'No conversation found' })
        return res.status(200).send({ conversation: getConversation })
    } catch (err) {
        return res.status(500).send({ message: 'Error getting conversation' })
    }
}

export const deleteMessageFromConversation = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const senderId = req.user.id
        const messageId = Number(req.params.messageId)
        if (typeof messageId !== 'number' || !Number.isInteger(messageId) || messageId <= 0) {
            return res.status(400).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Message id should be a positive integer value',
            });
        }

        const message = await prisma.message.findFirst({
            where: {
                id: messageId,
                user_id: senderId,
            },
        })

        if (!message) return res.status(404).send({ valid: false, message: 'No message found or you did not send this message' })
        
        await prisma.message.delete({
            where: {
                id: messageId,
            },
        })

        return res.status(200).send({ message: 'Message deleted' })
    }catch(err){
        return next(err)
    }
}

export const getConversation = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const senderId = req.user.id
        const receiverId = Number(req.params.receiverId)
        if (typeof receiverId !== 'number' || !Number.isInteger(receiverId) || receiverId <= 0) {
            return res.status(400).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Receiver id should be a positive integer value',
            });
        }

        const getConversation = await prisma.conversation.findFirst({
            where: {
              type: {
                not: 'GROUP',
              },
              participants: {
                some: {
                  userId: senderId,
                },
              },
              AND: {
                participants: {
                  some: {
                    userId: receiverId,
                  },
                },
              },
            },
            include: {
              messages: true,
              participants: {
                select: {
                    isAdmin: true,
                  user: {
                    select: {
                      username: true,
                      image: true,
                      id: true,
                    },
                  },
                },
              },
            },
          })
          
        console.log(getConversation, 'getConversation');
        

        if (!getConversation) return res.status(404).send({ message: 'No conversation found' })
        return res.status(200).send({ conversation: getConversation })
    } catch (err) {
        return res.status(500).send({ message: 'Error getting conversation' })
    }
}

export const getAllConversations = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const senderId = req.user.id
        let conversations = await prisma.conversation.findMany({
            where: { participants: { some: { user: { id: senderId } } } },
            include: { messages: true, participants: {select: {isAdmin: true, user: {select: {username: true, image: true, id: true}}}}},
        })
        let conversationIds = conversations.map((conversation) => conversation.id);
        let participants = await prisma.participant.findMany({
            where: {
                conversationId: {
                    in: conversationIds,
                },
            },
            select: {
                userId: true,
                conversationId: true,
            },
        });
        conversations = conversations.map((conversation) => {
            const conversationParticipants = participants.filter((participant) => participant.conversationId === conversation.id);
            const participantIds = conversationParticipants.map((participant) => participant.userId);
            return {
                ...conversation,
                participants_id: participantIds,
            };
        });

        return res.status(200).send({ conversations: conversations });
    } catch (err) {
        return res.status(500).send({ message: 'Error getting conversations' })
    }
}

const messageController = { sendMessage, getConversation, deleteMessageFromConversation, getConversationByConvoId, getAllConversations, removeParticipantFromGroup, editGroupName, createGroup, sendGroupMessage, addParticipantsToGroup }
export default messageController
