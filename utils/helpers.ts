import nodemailer from 'nodemailer'
import * as admin from 'firebase-admin'

const isValidatePaylod = (body: any, fields: string[]): boolean => {
    if (!body) {
        return false
    }
    for (let i = 0; i < fields.length; i++) {
        if (!body[fields[i]]) return false
    }
    return true
}

const isValidDateFormat = (date: string) => {
    const splitedDate = date.split('-')
    if (splitedDate.length < 3) {
        return false
    }
    if (splitedDate[0].length < 4) {
        return false
    }
    const convert_month = Number(splitedDate[1])
    if (Number.isNaN(convert_month) || convert_month < 1 || convert_month > 12) {
        return false
    }
    const convert_date = Number(splitedDate[2])
    if (Number.isNaN(convert_date) || convert_date < 1 || convert_date > 31) {
        return false
    }
    return true
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_APP_EMAIL!,
        pass: process.env.GMAIL_APP_PASSWORD!,
    },
})
const sendMail = (to: string, subject: string, body: string) => {
    transporter.sendMail({
        from: process.env.GMAIL_APP_EMAIL!,
        to: to,
        subject: subject,
        text: body,
    })
}
const imageUrlGen = (filePath: string) => {
    const gen_url = process.env.BACKEND_BASE_URL! + + "/images/" + filePath;
    return gen_url
}

const removeWhitespace = (str: string) : string => {
    return str.replace(/\s+/g, '').trim(); // Remove all whitespace characters
}

const DEFAULT_IMAGE: string = 'https://ezio.s3.eu-north-1.amazonaws.com/1744105722299.png';

const sendNotification = async (title: string, body: string, token: string) => {
    const message = {
        notification: {
            title: title,
            body: body,
        },
        token: token,
    }

    try {
        await admin.messaging().send(message)
        console.log('Notification sent successfully')
    } catch (error) {
        console.error('Error sending notification:', error)
    }
};

const sendNotifications = async (title: string, body: string, tokens: string[]) => {
    try {
        const chunkSize = 200;

        for (let i = 0; i < tokens.length; i += chunkSize) {
          const slice = tokens.slice(i, i + chunkSize);
          const message = {
            notification: { title, body },
            tokens: slice,
          };
      
          const response = await admin.messaging().sendEachForMulticast(message);
          console.log(
            `Sent to ${response.successCount} devices, failed: ${response.failureCount}`
          );
        }
        console.log('Notifications sent successfully')
        return true;
    } catch (error) {
        console.error('Error sending notification:', error)
    }
};

const helper = { isValidatePaylod, isValidDateFormat, sendMail, imageUrlGen, removeWhitespace, sendNotifications, sendNotification, DEFAULT_IMAGE }
export default helper

