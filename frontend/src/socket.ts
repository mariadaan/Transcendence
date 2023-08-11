import { io } from 'socket.io-client';

export const socket = io(process.env.VUE_APP_HOST_COMPUTER + ':3000', { 
    auth: {
        id: localStorage.getItem('playerId') || '0'
    }
});
