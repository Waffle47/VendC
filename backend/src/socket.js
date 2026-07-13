const socketIO = require('socket.io');
const db = require('./config/dbconnect');

let io;

const toGCID = (id, type = 'user') => {
    if (!id) return '';
    const strId = String(id);
    if (strId.includes('admin')) return 'admin-support';
    if (strId.includes('-')) return strId.toLowerCase();

    const cleanId = strId.replace(/^(user_|retailer_|wholesaler_|admin_)/, '');
    return `${type.toLowerCase()}-${cleanId}`;
};

const generateRoomId = (gcid1, gcid2) => {
    if (gcid1 === 'admin-support') return `admin_chat_${gcid2}`;
    if (gcid2 === 'admin-support') return `admin_chat_${gcid1}`;
    const sorted = [gcid1, gcid2].sort((a, b) => a.localeCompare(b));
    return `chat_${sorted[0]}_${sorted[1]}`;
};

const initializeSocket = (server) => {
    io = socketIO(server, {
        cors: {
            origin: ['http://localhost:3000', 'http://localhost:5173'],
            methods: ['GET', 'POST'],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    const onlineUsers = new Map();

    const saveMessage = async (roomId, senderId, senderName, message, isAdmin) => {
        try {
            const [result] = await db.query(`
                INSERT INTO chat_messages (room_id, sender_id, sender_name, message, is_admin)
                VALUES (?, ?, ?, ?, ?)
            `, [roomId, senderId, senderName || 'User', message, isAdmin]);
            return result.insertId;
        } catch (error) {
            console.error('❌ DB Error in saveMessage:', error);
            return null;
        }
    };

    const getChatHistory = async (roomId) => {
        try {
            const [messages] = await db.query(`
                SELECT message_id as id, sender_id, sender_name, message, is_admin, created_at as timestamp
                FROM chat_messages
                WHERE room_id = ?
                ORDER BY created_at ASC
                LIMIT 150
            `, [roomId]);
            return messages;
        } catch (error) {
            console.error('❌ DB Error in getChatHistory:', error);
            return [];
        }
    };

    const upsertUserRoom = async (userId, roomId, otherUserId, otherUserName, otherUserType, lastMessage = null) => {
        try {
            await db.query(`
                INSERT INTO user_chat_rooms 
                    (user_id, room_id, other_user_id, other_user_name, other_user_type, last_message, last_message_time)
                VALUES (?, ?, ?, ?, ?, ?, IF(? IS NOT NULL, NOW(), NULL))
                ON DUPLICATE KEY UPDATE 
                    other_user_name = VALUES(other_user_name),
                    last_message = COALESCE(VALUES(last_message), last_message),
                    last_message_time = IF(VALUES(last_message) IS NOT NULL, NOW(), last_message_time)
            `, [userId, roomId, otherUserId, otherUserName || 'User', otherUserType || 'user', lastMessage, lastMessage]);
        } catch (error) {
            console.error('❌ DB Error in upsertUserRoom:', error);
        }
    };

    const fetchAndFormatUserRooms = async (gcid) => {
        try {
            const userId = gcid;
            const isAdmin = userId === 'admin-support';

            const [dbRooms] = await db.query(`
                SELECT room_id, other_user_id, other_user_name, other_user_type, 
                       last_message, last_message_time, is_pinned, unread_count
                FROM user_chat_rooms
                WHERE user_id = ?
                ORDER BY last_updated DESC
            `, [userId]);

            const formattedRooms = dbRooms.map(r => ({
                roomId: r.room_id,
                isPinned: Boolean(r.is_pinned),
                lastMessage: r.last_message,
                lastMessageTime: r.last_message_time,
                unreadCount: r.unread_count,
                otherUser: {
                    id: r.other_user_id,
                    name: r.other_user_name,
                    userType: r.other_user_type,
                    isAdmin: r.other_user_id === 'admin-support'
                }
            }));

            if (isAdmin) return formattedRooms;

            const adminRoomId = `admin_chat_${userId}`;
            let adminRoom = formattedRooms.find(r => r.roomId === adminRoomId);
            const otherRooms = formattedRooms.filter(r => r.roomId !== adminRoomId);

            if (!adminRoom) {
                adminRoom = {
                    roomId: adminRoomId,
                    isPinned: true,
                    lastMessage: null,
                    lastMessageTime: null,
                    unreadCount: 0,
                    otherUser: {
                        id: 'admin-support',
                        name: 'VendConnect Support',
                        userType: 'admin',
                        isAdmin: true
                    }
                };
            } else {
                adminRoom.isPinned = true;
            }

            return [adminRoom, ...otherRooms];
        } catch (error) {
            console.error('❌ DB Error in fetchAndFormatUserRooms:', error);
            return [];
        }
    };

    io.on('connection', (socket) => {
        socket.on('user-connected', async (userData) => {
            try {
                if (!userData?.id) return socket.disconnect();

                const userId = toGCID(userData.id, userData.userType);
                socket.userId = userId;
                //  Save the user's role so it can be mapped later
                socket.userType = userData.userType || 'user';
                socket.userName = userData.name || userData.store_name || 'User';

                onlineUsers.set(userId, { socketId: socket.id, user: userData });

                const rooms = await fetchAndFormatUserRooms(userId);
                const roomIdsToJoin = rooms.map(r => r.roomId);
                socket.join([`user_${userId}`, `admin_chat_${userId}`, ...roomIdsToJoin]);

                socket.emit('chat-rooms', rooms);
                io.emit('users-online', Array.from(onlineUsers.keys()));
            } catch (err) {
                console.error('Socket error on user-connected:', err);
            }
        });

        socket.on('start-conversation', async ({ currentUser, otherUser }) => {
            try {
                if (!currentUser || !otherUser) return;

                const currentUserId = toGCID(currentUser.id, currentUser.userType);
                const otherUserId = toGCID(otherUser.id, otherUser.userType);
                const roomId = generateRoomId(currentUserId, otherUserId);

                socket.join(roomId);

                await upsertUserRoom(currentUserId, roomId, otherUserId, otherUser.name, otherUser.userType);
                await upsertUserRoom(otherUserId, roomId, currentUserId, currentUser.name || currentUser.store_name, currentUser.userType);

                const history = await getChatHistory(roomId);
                socket.emit('room-joined', { roomId, otherUser, messages: history });

                const senderRooms = await fetchAndFormatUserRooms(currentUserId);
                socket.emit('chat-rooms', senderRooms);

                const recipientSocketData = onlineUsers.get(otherUserId);
                if (recipientSocketData?.socketId) {
                    const recipientSocket = io.sockets.sockets.get(recipientSocketData.socketId);
                    if (recipientSocket) recipientSocket.join(roomId);

                    const recipientRooms = await fetchAndFormatUserRooms(otherUserId);
                    io.to(recipientSocketData.socketId).emit('chat-rooms', recipientRooms);
                }
            } catch (err) {
                console.error('Socket error on start-conversation:', err);
            }
        });

        socket.on('send-message', async ({ room, message, otherUser }) => {
            try {
                if (!socket.userId || !message || !room) return;

                const isAdmin = socket.userId === 'admin-support';
                await saveMessage(room, socket.userId, socket.userName, message, isAdmin);

                const messagePayload = {
                    id: Date.now(),
                    sender: socket.userId,
                    senderName: socket.userName,
                    message: message,
                    timestamp: new Date().toISOString(),
                    isAdmin: isAdmin,
                    roomId: room
                };

                io.to(room).emit('new-message', messagePayload);

                if (otherUser) {
                    const otherUserId = toGCID(otherUser.id, otherUser.userType);

                    await upsertUserRoom(socket.userId, room, otherUserId, otherUser.name, otherUser.userType, message);

                    // CRITICAL FIX: Use the sender's actual dynamically saved userType instead of hardcoded 'user'
                    await upsertUserRoom(otherUserId, room, socket.userId, socket.userName, socket.userType, message);

                    const senderRooms = await fetchAndFormatUserRooms(socket.userId);
                    socket.emit('chat-rooms', senderRooms);

                    const recipientSocketData = onlineUsers.get(otherUserId);
                    if (recipientSocketData?.socketId) {
                        const recipientRooms = await fetchAndFormatUserRooms(otherUserId);
                        io.to(recipientSocketData.socketId).emit('chat-rooms', recipientRooms);
                    }
                }
            } catch (err) {
                console.error('Socket error on send-message:', err);
            }
        });

        socket.on('get-history', async (room) => {
            try {
                const history = await getChatHistory(room);
                socket.emit('chat-history', history);
            } catch (err) {
                console.error('Socket error on get-history:', err);
            }
        });

        socket.on('typing', ({ room, isTyping }) => {
            socket.to(room).emit('user-typing', { userId: socket.userId, isTyping });
        });

        socket.on('disconnect', () => {
            if (socket.userId) {
                onlineUsers.delete(socket.userId);
                io.emit('users-online', Array.from(onlineUsers.keys()));
            }
        });
    });

    return io;
};

module.exports = { initializeSocket, getIO: () => io };