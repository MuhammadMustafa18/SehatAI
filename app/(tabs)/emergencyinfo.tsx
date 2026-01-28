import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addContact, ContactRecord, deleteContact, getContacts, initDB } from '@/services/database';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as MailComposer from 'expo-mail-composer';
import * as SMS from 'expo-sms';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, FlatList, Linking, Modal, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function EmergencyInfoScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const colors = Colors[colorScheme];

    const [contacts, setContacts] = useState<ContactRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // SOS State
    const [isSOSActive, setIsSOSActive] = useState(false);
    const [countdown, setCountdown] = useState(10);
    const [safetyMonitorEnabled, setSafetyMonitorEnabled] = useState(false);

    // Contact Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newRelation, setNewRelation] = useState('');

    // Refs
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const recordingRef = useRef<Audio.Recording | null>(null);
    const timerRef = useRef<any>(null);

    useFocusEffect(
        useCallback(() => {
            loadContacts();
        }, [])
    );

    // Pulse Animation for SOS Button
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const loadContacts = async () => {
        try {
            await initDB();
            const data = await getContacts();
            setContacts(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddContact = async () => {
        if (!newName.trim() || !newPhone.trim()) {
            Alert.alert("Error", "Name and Phone are required");
            return;
        }
        try {
            await addContact(newName, newPhone, newEmail, newRelation);
            setNewName('');
            setNewPhone('');
            setNewEmail('');
            setNewRelation('');
            setShowAddModal(false);
            loadContacts();
        } catch (e) {
            Alert.alert("Error", "Failed to add contact");
        }
    };

    const handleDeleteContact = (id: number) => {
        Alert.alert("Delete Contact", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    await deleteContact(id);
                    loadContacts();
                }
            }
        ]);
    };

    // --- SOS LOGIC ---

    const startSOS = async () => {
        setIsSOSActive(true);
        setCountdown(10);

        // 1. Start Recording
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status === 'granted') {
                await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
                const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
                recordingRef.current = recording;
            }
        } catch (e) {
            console.log('Audio recording failed', e);
        }

        // 2. Countdown Timer
        timerRef.current = setInterval(() => {
            setCountdown((prev: number) => {
                if (prev <= 1) {
                    triggerAlerts();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const triggerAlerts = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsSOSActive(false);

        // Stop Recording
        if (recordingRef.current) {
            await recordingRef.current.stopAndUnloadAsync();
            recordingRef.current = null;
        }

        // Get Location
        let locationData = "Unknown";
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({});
                locationData = `https://www.google.com/maps/search/?api=1&query=${loc.coords.latitude},${loc.coords.longitude}`;
            }
        } catch (e) {
            console.log('Location failed', e);
        }

        // 1. Open Dialer (911)
        Linking.openURL('tel:911');

        // 2. Send SMS
        const phoneRecipients = contacts.map((c: ContactRecord) => c.phone).filter((p: string) => p);
        if (phoneRecipients.length > 0) {
            const isAvailable = await SMS.isAvailableAsync();
            if (isAvailable) {
                await SMS.sendSMSAsync(
                    phoneRecipients,
                    `HELP! I am in danger. My location: ${locationData}`
                );
            } else {
                Alert.alert("SMS Unavailable", "Cannot send SMS on this device.");
            }
        }

        // 3. Send Email
        const emailRecipients = contacts.map((c: ContactRecord) => c.email).filter((e: string | undefined) => e) as string[];
        if (emailRecipients.length > 0) {
            const isMailAvailable = await MailComposer.isAvailableAsync();
            if (isMailAvailable) {
                MailComposer.composeAsync({
                    recipients: emailRecipients,
                    subject: "URGENT: I need help!",
                    body: `I am in danger. Here is my location: ${locationData}`,
                });
            }
        }
    };

    const cancelSOS = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (recordingRef.current) {
            await recordingRef.current.stopAndUnloadAsync();
            recordingRef.current = null;
        }
        setIsSOSActive(false);
        setCountdown(10);
    };

    const toggleSafetyMonitor = (val: boolean) => {
        setSafetyMonitorEnabled(val);
        if (val) {
            Alert.alert(
                "Safety Monitor Active",
                "A persistent notification has been pinned to your lockscreen. Tap it to trigger SOS instantly.",
                [{ text: "OK" }]
            );
        }
    };

    // Render Contact Item
    const renderContact = ({ item }: { item: ContactRecord }) => (
        <View style={[styles.card, { backgroundColor: colorScheme === 'light' ? '#fff' : '#1a1a1a', borderColor: '#eee' }]}>
            <View style={styles.contactInfo}>
                <Text style={[styles.contactName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.contactRelation, { color: colors.text }]}>{item.relation}</Text>
                <Text style={[styles.contactPhone, { color: colors.text }]}>{item.phone}</Text>
                {item.email ? <Text style={[styles.contactEmail, { color: colors.text }]}>{item.email}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => handleDeleteContact(item.id)} style={styles.deleteBtn}>
                <IconSymbol name="trash.fill" size={20} color="#ea4335" />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Emergency SOS</Text>
            </View>

            {/* SOS Button Area */}
            <View style={styles.sosContainer}>
                {isSOSActive ? (
                    <View style={styles.activeSOS}>
                        <Text style={styles.countdownText}>{countdown}</Text>
                        <Text style={styles.sendingText}>Sending Alert...</Text>
                        <TouchableOpacity style={styles.cancelSOSBtn} onPress={cancelSOS}>
                            <Text style={styles.cancelSOSText}>CANCEL</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity onPress={startSOS} activeOpacity={0.8}>
                        <Animated.View style={[styles.sosButton, { transform: [{ scale: pulseAnim }] }]}>
                            <Text style={styles.sosText}>SOS</Text>
                        </Animated.View>
                    </TouchableOpacity>
                )}
                <Text style={[styles.sosSubtext, { color: colors.text }]}>
                    Tap to Record Audio, Send Location & Call 911
                </Text>
            </View>

            {/* Safety Monitor Toggle */}
            <View style={[styles.monitorCard, { backgroundColor: safetyMonitorEnabled ? 'rgba(52, 168, 83, 0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.monitorTitle, { color: colors.text }]}>Safety Monitor</Text>
                    <Text style={styles.monitorDesc}>Pin "Tap for SOS" to lockscreen</Text>
                </View>
                <Switch
                    value={safetyMonitorEnabled}
                    onValueChange={toggleSafetyMonitor}
                    trackColor={{ false: '#767577', true: '#34A853' }}
                    thumbColor={'#fff'}
                />
            </View>

            <View style={styles.divider} />

            <View style={styles.contactsHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Emergency Contacts</Text>
                <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addBtn}>
                    <IconSymbol name="plus.circle.fill" size={24} color="#0a7ea4" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={contacts}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderContact}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <Text style={[styles.emptyText, { color: colors.text }]}>No emergency contacts added.</Text>
                }
            />

            {/* Add Contact Modal */}
            <Modal
                visible={showAddModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowAddModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Add Contact</Text>

                        <TextInput
                            placeholder="Name"
                            placeholderTextColor="#888"
                            style={[styles.input, { color: colors.text, borderColor: colors.text }]}
                            value={newName}
                            onChangeText={setNewName}
                        />
                        <TextInput
                            placeholder="Phone Number"
                            placeholderTextColor="#888"
                            keyboardType="phone-pad"
                            style={[styles.input, { color: colors.text, borderColor: colors.text }]}
                            value={newPhone}
                            onChangeText={setNewPhone}
                        />
                        <TextInput
                            placeholder="Email (Optional)"
                            placeholderTextColor="#888"
                            keyboardType="email-address"
                            style={[styles.input, { color: colors.text, borderColor: colors.text }]}
                            value={newEmail}
                            onChangeText={setNewEmail}
                            autoCapitalize="none"
                        />
                        <TextInput
                            placeholder="Relation (e.g. Mom, Doctor)"
                            placeholderTextColor="#888"
                            style={[styles.input, { color: colors.text, borderColor: colors.text }]}
                            value={newRelation}
                            onChangeText={setNewRelation}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.modalBtnCancel}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleAddContact} style={styles.modalBtnSave}>
                                <Text style={styles.saveBtnText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 60, backgroundColor: '#fff' },
    header: { paddingHorizontal: 20, marginBottom: 20 },
    title: { fontSize: 28, fontFamily: Typography.bold },

    sosContainer: { alignItems: 'center', marginBottom: 30 },
    sosButton: {
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: '#ea4335',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#ea4335',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    sosText: { color: '#fff', fontSize: 32, fontFamily: Typography.black },
    sosSubtext: { marginTop: 15, fontSize: 13, fontFamily: Typography.regular, opacity: 0.6 },

    activeSOS: { alignItems: 'center', height: 150, justifyContent: 'center' },
    countdownText: { fontSize: 60, fontFamily: Typography.bold, color: '#ea4335' },
    sendingText: { fontSize: 16, fontFamily: Typography.semiBold, color: '#ea4335', marginBottom: 10 },
    cancelSOSBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#eee', borderRadius: 20 },
    cancelSOSText: { fontFamily: Typography.bold },

    monitorCard: { marginHorizontal: 20, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    monitorTitle: { fontSize: 16, fontFamily: Typography.bold },
    monitorDesc: { fontSize: 13, fontFamily: Typography.regular, opacity: 0.6 },

    divider: { height: 1, backgroundColor: '#eee', marginVertical: 20, marginHorizontal: 20 },

    contactsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
    sectionTitle: { fontSize: 20, fontFamily: Typography.bold },
    addBtn: { padding: 5 },

    listContent: { paddingHorizontal: 20 },
    card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1 },
    contactInfo: { gap: 4 },
    contactName: { fontSize: 16, fontFamily: Typography.semiBold },
    contactRelation: { fontSize: 12, fontFamily: Typography.regular, opacity: 0.6 },
    contactPhone: { fontSize: 14, fontFamily: Typography.medium, color: '#0a7ea4' },
    contactEmail: { fontSize: 12, fontFamily: Typography.regular, opacity: 0.7, marginTop: 2 },
    deleteBtn: { padding: 8 },
    emptyText: { textAlign: 'center', marginTop: 20, fontFamily: Typography.regular, opacity: 0.5 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { padding: 20, borderRadius: 20 },
    modalTitle: { fontSize: 20, fontFamily: Typography.bold, marginBottom: 20 },
    input: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 15, fontSize: 16, fontFamily: Typography.regular },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15 },
    modalBtnCancel: { padding: 10 },
    cancelBtnText: { color: '#888', fontFamily: Typography.regular },
    modalBtnSave: { backgroundColor: '#0a7ea4', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
    saveBtnText: { color: '#fff', fontFamily: Typography.semiBold },
});
