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
        
        // Odadaki diğer kullanıcılara bildir
        socket.to(roomId).emit('user-joined', userId, mode);
        
        // Kullanıcıya başarılı katılım bildirimi gönder
        socket.emit('room-joined', roomId, userCount);
    });

    socket.on('offer', (offer, targetId) => {
        console.log(`Offer gönderiliyor: ${socket.id} -> ${targetId}`);
        socket.to(targetId).emit('offer', offer, socket.id);
    });

    socket.on('answer', (answer, targetId) => {
        console.log(`Answer gönderiliyor: ${socket.id} -> ${targetId}`);
        socket.to(targetId).emit('answer', answer, socket.id);
    });

    socket.on('ice-candidate', (candidate, targetId) => {
        socket.to(targetId).emit('ice-candidate', candidate, socket.id);
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