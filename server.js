const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Statik dosyaları serve et
app.use(express.static(path.join(__dirname, './')));
app.use(cors());

// Oda yönetimi için store
const rooms = new Map();

// WebRTC Signaling - Ortak oda desteği ile
io.on('connection', (socket) => {
    console.log('Yeni kullanıcı bağlandı:', socket.id);

    socket.on('join-room', (roomId, userId, mode) => {
        // Önceki odadan çık
        const previousRooms = Array.from(socket.rooms);
        previousRooms.forEach(room => {
            if (room !== socket.id) {
                socket.leave(room);
            }
        });

        // Yeni odaya katıl
        socket.join(roomId);
        
        // Oda bilgisini sakla
        socket.data = { roomId, userId, mode };
        
        // Odaya kullanıcı sayısını güncelle
        const roomClients = io.sockets.adapter.rooms.get(roomId);
        const userCount = roomClients ? roomClients.size : 0;
        
        console.log(`Kullanıcı odaya katıldı: ${userId} (${socket.id}) | Oda: ${roomId} | Mod: ${mode} | Toplam: ${userCount}`);
        
        // Odadaki diğer kullanıcılara bildir (socket.id ile)
        socket.to(roomId).emit('user-joined', userId, mode, socket.id);
        
        // Kullanıcıya başarılı katılım bildirimi gönder
        socket.emit('room-joined', roomId, userCount);
        
        // Viewer ise ve odada yayıncı varsa, yayıncı listesini gönder
        if (mode === 'viewer') {
            const roomClients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
            const broadcasters = [];
            
            roomClients.forEach(clientId => {
                const clientSocket = io.sockets.sockets.get(clientId);
                if (clientSocket && clientSocket.data?.mode === 'broadcaster') {
                    broadcasters.push({
                        socketId: clientId,
                        userId: clientSocket.data?.userId
                    });
                }
            });
            
            if (broadcasters.length > 0) {
                setTimeout(() => {
                    socket.emit('broadcasters-list', broadcasters);
                }, 500);
            }
        }
    });

    // Yayıncı listesi isteği
    socket.on('request-broadcasters', (roomId) => {
        if (roomId && socket.data?.roomId === roomId) {
            const roomClients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
            const broadcasters = [];
            
            roomClients.forEach(clientId => {
                const clientSocket = io.sockets.sockets.get(clientId);
                if (clientSocket && clientSocket.data?.mode === 'broadcaster') {
                    broadcasters.push({
                        socketId: clientId,
                        userId: clientSocket.data?.userId
                    });
                }
            });
            
            socket.emit('broadcasters-list', broadcasters);
        }
    });

    // Chat mesajı
    socket.on('chat-message', (data) => {
        const { roomId, userId, message, timestamp, imageData, imageName, mimeType, stickerId } = data;
        if (roomId && socket.data?.roomId === roomId) {
            console.log(`Chat mesajı: ${userId} -> Oda: ${roomId}`);
            // Odaya mesajı broadcast et
            io.to(roomId).emit('chat-message', {
                userId,
                message,
                timestamp,
                imageData,
                imageName,
                mimeType,
                stickerId
            });
        }
    });

    // Yayın başladığında
    socket.on('broadcast-started', (roomId, userId) => {
        if (roomId && socket.data?.roomId === roomId) {
            console.log(`Yayın başladı: ${userId} -> Oda: ${roomId}`);
            // Odaya yayın başladığını bildir (socket.id ile yayıncı ID'si)
            socket.to(roomId).emit('broadcast-started', socket.id, userId);
        }
    });

    // WebRTC Offer
    socket.on('offer', (data) => {
        const { offer, roomId, targetId, fromId } = data;
        if (targetId) {
            console.log(`Offer gönderiliyor: ${fromId || socket.id} -> ${targetId}`);
            socket.to(targetId).emit('offer', {
                offer,
                fromId: fromId || socket.id
            });
        }
    });

    // WebRTC Answer
    socket.on('answer', (data) => {
        const { answer, roomId, targetId, fromId } = data;
        if (targetId) {
            console.log(`Answer gönderiliyor: ${fromId || socket.id} -> ${targetId}`);
            socket.to(targetId).emit('answer', {
                answer,
                fromId: fromId || socket.id
            });
        }
    });

    // WebRTC ICE Candidate
    socket.on('ice-candidate', (data) => {
        const { candidate, roomId, targetId } = data;
        if (targetId) {
            socket.to(targetId).emit('ice-candidate', {
                candidate,
                targetId: socket.id
            });
        }
    });

    socket.on('disconnect', () => {
        const roomId = socket.data?.roomId;
        if (roomId) {
            const roomClients = io.sockets.adapter.rooms.get(roomId);
            const userCount = roomClients ? roomClients.size - 1 : 0;
            console.log(`Kullanıcı odadan ayrıldı: ${socket.id} | Oda: ${roomId} | Kalan: ${userCount}`);
            socket.to(roomId).emit('user-left', socket.data?.userId);
        }
        console.log('Kullanıcı bağlantısı kesildi:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 