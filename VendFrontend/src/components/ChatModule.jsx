import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import * as icons from 'react-icons/lu';
import API from '../api/axiosConfig'; // Adjust API path as needed
import '../styling/ChatModule.css';

const ADMIN_PROFILE = {
    id: 'admin_support',
    name: 'VendConnect Support',
    userType: 'admin',
    isAdmin: true
};

function ChatModule() {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [chatRooms, setChatRooms] = useState([]);
    const [currentChat, setCurrentChat] = useState(ADMIN_PROFILE);

    const [onlineUsers, setOnlineUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    const [isConnected, setIsConnected] = useState(false);
    const [isJoiningRoom, setIsJoiningRoom] = useState(false);

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const currentChatRef = useRef(currentChat);

    // Dynamic user fetch to handle account switching
    const currentUserProfile = JSON.parse(localStorage.getItem('user') || '{}');

    // Sync ref for the socket message listener
    useEffect(() => { currentChatRef.current = currentChat; }, [currentChat]);

    // Formatters & Generators
    const getInitials = (name) => (!name || typeof name !== 'string') ? 'U' : name.charAt(0).toUpperCase();

    const cleanId = (id) => {
        if (!id) return '';
        const strId = String(id);
        return strId === 'admin_support' ? strId : strId.replace(/^(user_|admin_)/, '');
    };

    const generateRoomId = (id1, id2) => {
        const clean1 = cleanId(id1);
        const clean2 = cleanId(id2);
        if (clean1 === 'admin_support') return `admin_chat_${clean2}`;
        if (clean2 === 'admin_support') return `admin_chat_${clean1}`;
        const sorted = [clean1, clean2].sort((a, b) => a.localeCompare(b));
        return `chat_${sorted[0]}_${sorted[1]}`;
    };

    const isOwnMessage = useCallback((msg) => {
        const myId = cleanId(currentUserProfile.id);
        return cleanId(msg.sender) === myId || cleanId(msg.sender_id) === myId;
    }, [currentUserProfile.id]);

    // --- Socket Lifecycle ---
    useEffect(() => {
        if (!currentUserProfile?.id) return;

        const socket = io('http://localhost:5000', { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
            socket.emit('user-connected', {
                id: currentUserProfile.id,
                userType: currentUserProfile.userType,
                name: currentUserProfile.name || currentUserProfile.store_name || 'User'
            });
            // Automatically fetch the isolated admin history on mount
            socket.emit('get-history', generateRoomId(currentUserProfile.id, 'admin_support'));
        });

        socket.on('disconnect', () => {
            if (socketRef.current === socket) setIsConnected(false);
        });

        socket.on('users-online', setOnlineUsers);
        socket.on('chat-rooms', setChatRooms);
        socket.on('chat-history', setMessages);

        socket.on('new-message', (incomingMessage) => {
            const activeRoomId = generateRoomId(currentUserProfile.id, currentChatRef.current.id);
            // Only append the message visually if it belongs to the CURRENT open chat tab
            if (incomingMessage.roomId === activeRoomId) {
                setMessages(prev => prev.some(m => m.id === incomingMessage.id) ? prev : [...prev, incomingMessage]);
            }
        });

        socket.on('room-joined', (data) => {
            setMessages(data.messages || []);
            if (data.otherUser) setCurrentChat(prev => ({ ...prev, ...data.otherUser }));
            setIsJoiningRoom(false);
        });

        return () => {
            socket.disconnect();
            if (socketRef.current === socket) socketRef.current = null;
        };
    }, [currentUserProfile?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // --- Interactions ---
    const handleSearch = async (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (term.length < 2) return setSearchResults([]);

        try {
            const res = await API.get(`/user/search?q=${encodeURIComponent(term)}`);
            setSearchResults(res.data);
        } catch (err) { console.error('Search failed'); }
    };

    const startNewChat = (user) => {
        if (isJoiningRoom || String(currentChat?.id) === String(user.id)) return;

        setIsJoiningRoom(true);
        setSearchTerm('');
        setSearchResults([]);

        if (user.isAdmin || user.id === 'admin_support') {
            setCurrentChat(ADMIN_PROFILE);
            setMessages([]);
            socketRef.current?.emit('get-history', generateRoomId(currentUserProfile.id, 'admin_support'));
            setIsJoiningRoom(false);
        } else {
            setCurrentChat({ id: user.id, name: user.name, userType: user.userType });
            setMessages([]);
            socketRef.current?.emit('start-conversation', { currentUser: currentUserProfile, otherUser: user });
            setTimeout(() => setIsJoiningRoom(false), 5000); // Failsafe unlock
        }
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!inputMessage.trim() || !isConnected || isJoiningRoom) return;

        const room = generateRoomId(currentUserProfile.id, currentChat.id);
        socketRef.current.emit('send-message', { room, message: inputMessage.trim(), otherUser: currentChat });
        setInputMessage('');
    };

    // --- Render ---
    return (
        <div className="chat-module">
            <div className="chat-header">
                <div className="chat-title">
                    <icons.LuMessageCircle size={22} />
                    <h2>Messages</h2>
                </div>
                <div className="chat-status">
                    <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                    {isConnected ? 'Connected' : 'Connecting...'}
                </div>
            </div>

            <div className="chat-container">
                {/* Sidebar */}
                <div className="chat-sidebar">
                    <div className="current-chat-info">
                        <div className="chat-avatar">
                            <span className="avatar-placeholder">{getInitials(currentChat?.name)}</span>
                        </div>
                        <div className="chat-user-details">
                            <div className="chat-user-name">{currentChat?.name || 'Select a chat'}</div>
                            <div className="chat-user-status">
                                <span className={`status-indicator ${onlineUsers.includes(cleanId(currentChat?.id)) ? 'online' : 'offline'}`} />
                                {onlineUsers.includes(cleanId(currentChat?.id)) ? 'Online' : 'Offline'}
                            </div>
                        </div>
                    </div>

                    <div className="chat-rooms-section">
                        <h3>Recent Chats</h3>
                        <div className="chat-rooms-list">
                            {chatRooms.length === 0 ? <p className="no-rooms">No recent chats</p> :
                                chatRooms.map((room) => (
                                    <div
                                        key={room.roomId}
                                        className={`chat-room-item ${cleanId(currentChat?.id) === cleanId(room.otherUser?.id) ? 'active' : ''} ${room.isPinned ? 'pinned' : ''}`}
                                        onClick={() => !isJoiningRoom && startNewChat(room.otherUser)}
                                    >
                                        {room.isPinned && <span className="pin-icon">📌</span>}
                                        <div className="room-avatar"><span>{getInitials(room.otherUser?.name)}</span></div>
                                        <div className="room-info">
                                            <div className="room-name">
                                                {room.otherUser?.name || 'Unknown User'}
                                                {room.isPinned && <span className="admin-badge-small">Admin</span>}
                                            </div>
                                            <div className="room-last-message">
                                                {room.lastMessage ? (room.lastMessage.length > 30 ? `${room.lastMessage.substring(0, 30)}...` : room.lastMessage) : 'No messages yet'}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>

                    <div className="search-section">
                        <div className="search-input-wrapper">
                            <icons.LuSearch size={18} className="search-icon" />
                            <input type="text" placeholder="Search users..." value={searchTerm} onChange={handleSearch} />
                        </div>

                        {searchTerm.length > 1 && (
                            <div className="search-results">
                                {searchResults.length === 0 ? <p className="no-results">No users found</p> :
                                    searchResults.map(user => (
                                        <div key={user.id} className="search-result-item" onClick={() => startNewChat(user)}>
                                            <div className="result-avatar"><span>{getInitials(user.name)}</span></div>
                                            <div className="result-info">
                                                <span className="result-name">{user.name}</span>
                                                <span className="result-type">{user.userType}</span>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="chat-main">
                    <div className="chat-main-header">
                        <span className="chat-main-name">
                            {currentChat?.name || 'User'}
                            {currentChat?.isAdmin && <span className="admin-badge">Admin</span>}
                            {isJoiningRoom && <span className="joining-indicator"> (Connecting...)</span>}
                        </span>
                    </div>

                    <div className="chat-messages">
                        {messages.map((msg) => {
                            const isSent = isOwnMessage(msg);
                            const senderName = msg.senderName || msg.sender_name || 'User';

                            return (
                                <div key={msg.id || Math.random()} className={`message ${isSent ? 'sent' : 'received'}`}>
                                    <div className="message-avatar">
                                        {msg.isAdmin ? <span className="admin-avatar">A</span> : <span className="user-avatar">{getInitials(senderName)}</span>}
                                    </div>
                                    <div className="message-content">
                                        <div className="message-header">
                                            <span className="message-sender">
                                                {isSent ? 'You' : senderName}
                                                {msg.isAdmin && <span className="admin-badge">Admin</span>}
                                            </span>
                                            <span className="message-time">
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="message-body">{msg.message}</div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={sendMessage} className="message-input">
                        <input
                            type="text"
                            placeholder={isJoiningRoom ? "Connecting..." : "Type a message..."}
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            disabled={!isConnected || isJoiningRoom}
                        />
                        <button type="submit" disabled={!isConnected || !inputMessage.trim() || isJoiningRoom}>
                            <icons.LuSend size={18} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default ChatModule;