
import { NotificationItem } from '../types';
import { authService } from './authService';
import { db } from '@/database';

export const notificationService = {
  getNotifications: (): NotificationItem[] => {
    const currentUserEmail = authService.getCurrentUserEmail();
    if (!currentUserEmail) return [];

    const stored = db.notifications.getAll();

    // Filter for current user
    const myNotifications = stored.filter(n => n.recipientEmail === currentUserEmail);
    
    return myNotifications.sort((a, b) => b.timestamp - a.timestamp);
  },

  getUnreadCount: (): number => {
    const notifs = notificationService.getNotifications();
    return notifs.filter(n => !n.read).length;
  },

  addNotification: (notif: Omit<NotificationItem, 'id' | 'time' | 'timestamp' | 'read'>) => {
    const newNotif: NotificationItem = {
        ...notif,
        id: Date.now(),
        timestamp: Date.now(),
        time: 'Agora', // In a real app, this would be calculated dynamically on render relative to timestamp
        read: false
    };

    db.notifications.add(newNotif);
  },

  // Fix: Added missing removeNotification method
  removeNotification: (id: number) => {
    db.notifications.delete(id);
  },

  // Fix: Added missing markAllAsRead method
  markAllAsRead: () => {
     const all = notificationService.getNotifications();
     all.forEach(n => {
         if(!n.read) {
             n.read = true;
             db.notifications.add(n); // Updates existing ID
         }
     });
  }
};
