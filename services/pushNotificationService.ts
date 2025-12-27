
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { authService } from './authService';
import { API_BASE } from '../apiConfig';

export const pushNotificationService = {
    init: async () => {
        if (!Capacitor.isNativePlatform()) {
            console.log("⚠️ [Push] Web platform detected. Push notifications are limited/simulated.");
            return;
        }

        try {
            // 1. Request Permission
            const permStatus = await PushNotifications.checkPermissions();
            
            if (permStatus.receive === 'prompt') {
                const newStatus = await PushNotifications.requestPermissions();
                if (newStatus.receive !== 'granted') {
                    console.warn("🚫 [Push] Permission denied.");
                    return;
                }
            }

            if (permStatus.receive !== 'granted') {
                return;
            }

            // 2. Register
            await PushNotifications.register();

            // 3. Listeners
            PushNotifications.addListener('registration', async (token) => {
                console.log('✅ [Push] Device Token:', token.value);
                // Save token to backend
                await pushNotificationService.saveTokenToBackend(token.value);
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('❌ [Push] Registration Error:', error);
            });

            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('🔔 [Push] Received:', notification);
                // You can trigger a local toast or update UI badge here
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                console.log('👆 [Push] Action Performed:', notification);
                const data = notification.notification.data;
                // Handle deep link logic from notification data here if needed, 
                // though generic deep link handler in App.tsx might catch URL schemes.
                if (data.chatId) {
                    window.location.hash = `/chat/${data.chatId}`;
                }
            });

        } catch (e) {
            console.error("⚠️ [Push] Init failed:", e);
        }
    },

    saveTokenToBackend: async (token: string) => {
        const userEmail = authService.getCurrentUserEmail();
        if (!userEmail) return;

        try {
            await fetch(`${API_BASE}/api/device/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userEmail,
                    token: token,
                    platform: Capacitor.getPlatform()
                })
            });
        } catch (e) {
            console.error("Failed to save push token:", e);
        }
    }
};
