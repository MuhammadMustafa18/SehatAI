import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (!Device.isDevice) {
        // Simulator handling
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        alert('Failed to get push token for push notification!');
        return false;
    }
    return true;
}

// --- Nagging Logic ---

// Helper to get next occurrence of a time
function getNextOccurrence(hour: number, minute: number): Date {
    const now = new Date();
    const date = new Date();
    date.setHours(hour, minute, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (date <= now) {
        date.setDate(date.getDate() + 1);
    }
    return date;
}

export async function scheduleDoseWithNags(
    id: number,
    name: string,
    dosage: string,
    hour: number,
    minute: number
) {
    // 1. Schedule the main recurring notification (Safety net, ensures users get at least one ping daily)
    // We use a specific identifier format: `med-${id}-base-${hour}-${minute}`
    const baseId = `med-${id}-base-${hour}-${minute}`;

    await Notifications.scheduleNotificationAsync({
        identifier: baseId,
        content: {
            title: `Time to take your medicine: ${name}`,
            body: `Dosage: ${dosage}`,
            data: { medicineId: id, type: 'base', hour, minute },
            sound: true,
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
        },
    });

    // 2. Schedule Nags for the NEXT occurrence
    // We can't schedule repeating nags easily without cluttering. 
    // So we schedule 5 one-off nags for the distinct next occurrence.
    // When the user opens the app, we must "replenish" these nags for the future.
    await scheduleNagsForNextDose(id, name, dosage, hour, minute);
}

export async function scheduleNagsForNextDose(
    id: number,
    name: string,
    dosage: string,
    hour: number,
    minute: number
) {
    const nextDate = getNextOccurrence(hour, minute);

    // Schedule 5 nags, every minute after the due time
    for (let i = 1; i <= 5; i++) {
        const nagTime = new Date(nextDate.getTime() + i * 60000); // + i minutes
        const nagId = `med-${id}-nag-${hour}-${minute}-${i}`;

        await Notifications.scheduleNotificationAsync({
            identifier: nagId,
            content: {
                title: `Reminder: Have you taken ${name}?`,
                body: `Please confirm in the app to stop these alerts.`,
                data: { medicineId: id, type: 'nag' },
                sound: true,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: nagTime,
            },
        });
    }
}

export async function confirmDose(medicineId: number) {
    // Cancel all NAGS for this medicine
    // We don't cancel the base recurring notification
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    for (const notification of scheduled) {
        const data = notification.content.data;
        if (data && data.medicineId === medicineId && data.type === 'nag') {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
    }
}

export async function cancelMedicineNotifications(medicineId: number) {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
        const data = notification.content.data;
        if (data && data.medicineId === medicineId) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
    }
}

export async function getAllScheduled() {
    return await Notifications.getAllScheduledNotificationsAsync();
}

export async function getActiveMedicineIds(): Promise<number[]> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const activeIds = new Set<number>();
    const now = new Date();

    for (const notification of scheduled) {
        const data = notification.content.data;
        // console.log('Checking notification:', notification.identifier, data);
        if (data && data.type === 'nag' && notification.trigger) {
            // console.log('Found Nag:', notification.trigger);
            // Triggers can be complex. For date trigger, it might be nested or direct.
            // Let's assume standard Expo behavior for now but log if we fail to parse.
            let triggerDate: Date | null = null;

            if ('date' in notification.trigger) {
                triggerDate = new Date((notification.trigger as any).date); // safely cast
            } else if ('value' in notification.trigger && typeof notification.trigger.value === 'number') {
                // Android TimestampTrigger might use value? No, typically Expo unifies this.
                triggerDate = new Date(notification.trigger.value);
            }

            if (triggerDate) {
                const diffMs = triggerDate.getTime() - now.getTime();
                // console.log('Nag Time Diff:', diffMs);

                // Allow past messages if they haven't been wiped yet (negative diff)
                // And future messages within 15 mins.
                if (diffMs < 15 * 60 * 1000) {
                    // @ts-ignore
                    activeIds.add(data.medicineId);
                }
            }
        }
    }
    return Array.from(activeIds);
}
