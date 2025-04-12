import multer from 'multer'
import dotenv from 'dotenv'
dotenv.config()

const storage = multer.memoryStorage()
export const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, 
      },
 })

const PORT = 5000;
const HTTP_PORT = 3000;

import('./app')
    .then((server) => {
        const httpsServer = server.httpsServer; 
        const httpServer = server.httpServer; 
        httpsServer.listen(PORT, () => {
            console.log(`HTTPS Server running on port ${PORT}`);
        });

        httpServer.listen(HTTP_PORT, () => {
            console.log(`HTTP Server running on port ${HTTP_PORT} and redirecting to HTTPS`);
        });
    })
    .catch((err) => {
        console.error('Error in loading app', err);
    });