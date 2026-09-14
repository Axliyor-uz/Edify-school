import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Only types an emitter actually sends (grep before adding): 'assignment'
// (AssignTestModal), 'request' (follow, lib/social.ts), 'levelup' (lib/xp.ts).
// 'general' is the catch-all the student page renders with the default icon.
export type NotificationType = 'assignment' | 'request' | 'levelup' | 'general';

export async function sendNotification(
  userId: string, // The person RECEIVING the notification
  type: NotificationType,
  title: string, 
  message: string, 
  link?: string
) {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      message,
      link: link || null,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to send notification", error);
  }
}