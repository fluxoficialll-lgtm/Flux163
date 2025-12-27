
import { io, Socket } from 'socket.io-client';
import { API_BASE } from '../apiConfig';
import { authService } from './authService';

let socket: Socket | null = null;

export const socketService = {
    connect: () => {
        if (socket && socket.connected) return;

        const userEmail = authService.getCurrentUserEmail();
        
        // Connect to the same origin or configured API_BASE
        socket = io(API_BASE || window.location.origin, {
            autoConnect: true,
            reconnection: true,
            // Pass minimal auth info via query or auth object
            auth: {
                token: localStorage.getItem('auth_token'),
                email: userEmail
            }
        });

        socket.on('connect', () => {
            console.log('🟢 [Socket.io] Connected:', socket?.id);
            if (userEmail) {
                socket?.emit('join_user', userEmail);
            }
        });

        socket.on('connect_error', (err) => {
            console.warn('🔴 [Socket.io] Connection error:', err.message);
        });
    },

    disconnect: () => {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
    },

    joinChat: (chatId: string) => {
        if (socket) {
            socket.emit('join_chat', chatId);
        }
    },

    on: (event: string, callback: (...args: any[]) => void) => {
        if (!socket) socketService.connect();
        socket?.on(event, callback);
        return () => socket?.off(event, callback);
    },

    emit: (event: string, data: any) => {
        if (!socket) socketService.connect();
        socket?.emit(event, data);
    },

    getSocket: () => socket
};
