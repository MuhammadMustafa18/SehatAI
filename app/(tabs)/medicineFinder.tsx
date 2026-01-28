import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { analyzePrescription, extractMedicinesFromText, transcribeAudio } from '@/services/groq';
import { searchMedicineOnline, SearchResult } from '@/services/search';

// NEW SERVICES
import PharmaciesModal from '@/components/PharmaciesModal';
import { addMedicine, initDB } from '@/services/database';
import { registerForPushNotificationsAsync, scheduleDoseWithNags } from '@/services/notifications';
import RNDateTimePicker from '@react-native-community/datetimepicker';

import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Medicine {
    name: string;
    dosage: string;
}

interface AnalysisResult {
    summary: string;
    medicines: Medicine[];
}

export default function MedicineFinderScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const colors = Colors[colorScheme];

    // UI State
    const [image, setImage] = useState<string | null>(null);
    const [textInput, setTextInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [showMediaMenu, setShowMediaMenu] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);

    // Processing State
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [medicineLinks, setMedicineLinks] = useState<Record<string, SearchResult[]>>({});
    const [loadingLinks, setLoadingLinks] = useState<Record<string, boolean>>({});

    // Reminder State
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
    const [reminderFreq, setReminderFreq] = useState(2);
    const [reminderTimes, setReminderTimes] = useState<string[]>(['10:00', '20:00']);

    // Time Picker State
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [activeTimeIndex, setActiveTimeIndex] = useState(0);

    // Pharmacy Modal State
    const [showPharmaciesModal, setShowPharmaciesModal] = useState(false);

    // Animations & Refs
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const menuAnim = useRef(new Animated.Value(0)).current;
    const timerRef = useRef<any>(null);
    const isOperationInProgress = useRef(false);
    const recordingRef = useRef<Audio.Recording | null>(null);
    const shouldStopImmediately = useRef(false);

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    // Cleaning up on unmount
    useEffect(() => {
        initDB();
        registerForPushNotificationsAsync();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (recording) {
                recording.stopAndUnloadAsync().catch(() => { });
            }
        };
    }, []);

    // Handle recording timer and pulse animation
    useEffect(() => {
        if (isRecording) {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
                ])
            ).start();
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            setRecordingTime(0);
            pulseAnim.setValue(1);
        }
    }, [isRecording]);

    // Media menu animation
    useEffect(() => {
        Animated.timing(menuAnim, {
            toValue: showMediaMenu ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [showMediaMenu]);

    // --- Audio Logic (Bulletproof) ---
    async function cleanupRecording() {
        if (recordingRef.current) {
            try {
                await recordingRef.current.stopAndUnloadAsync();
            } catch (e) { }
            recordingRef.current = null;
        }

        if (recording) {
            try {
                await recording.stopAndUnloadAsync();
            } catch (e) { }
            setRecording(null);
        }

        // Reset audio mode to completely clear the subsystem
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: false,
            });
        } catch (e) { }

        // Longer delay to ensure native cleanup
        await delay(300);
    }

    async function startRecording() {
        if (isOperationInProgress.current) {
            console.log('Operation already in progress, skipping');
            return;
        }

        isOperationInProgress.current = true;
        shouldStopImmediately.current = false;

        try {
            // 1. Complete cleanup and reset
            await cleanupRecording();

            // 2. Permissions
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                alert('Permission to access microphone is required!');
                return;
            }

            // 3. Configure audio mode fresh
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Small delay after mode change
            await delay(100);

            // 4. Create recording
            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            // 5. Check if user already released
            if (shouldStopImmediately.current) {
                await newRecording.stopAndUnloadAsync();
                await cleanupRecording();
                return;
            }

            recordingRef.current = newRecording;
            setRecording(newRecording);
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start recording', err);
            setIsRecording(false);
            await cleanupRecording();
            alert('Could not start recording. Please try again.');
        } finally {
            isOperationInProgress.current = false;
        }
    }

    async function stopRecording() {
        shouldStopImmediately.current = true;

        if (isOperationInProgress.current) {
            setIsRecording(false);
            return;
        }

        if (!recordingRef.current) {
            setIsRecording(false);
            return;
        }

        isOperationInProgress.current = true;
        try {
            setIsRecording(false);
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();

            recordingRef.current = null;
            setRecording(null);

            if (uri) {
                processAudio(uri);
            }

            // Clean up audio mode after recording
            await cleanupRecording();
        } catch (error) {
            console.error('Failed to stop recording', error);
            await cleanupRecording();
            setIsRecording(false);
        } finally {
            isOperationInProgress.current = false;
        }
    }

    // --- Processing Logic ---
    const startProcessing = () => {
        setLoading(true);
        setResult(null);
        setMedicineLinks({});
        setLoadingLinks({});
    };

    const handleResult = (data: AnalysisResult) => {
        setResult(data);
        setLoading(false);
        if (data.medicines) {
            data.medicines.forEach(med => fetchLinks(med.name));
        }
    };

    const processImage = async (base64: string) => {
        setShowMediaMenu(false);
        startProcessing();
        try {
            const data = await analyzePrescription(base64);
            handleResult(data);
        } catch (error) {
            alert('Failed to read prescription.');
            setLoading(false);
        }
    };

    const processAudio = async (uri: string) => {
        startProcessing();
        try {
            const text = await transcribeAudio(uri);
            const data = await extractMedicinesFromText(text);
            handleResult(data);
        } catch (error) {
            alert('Failed to transcribe audio.');
            setLoading(false);
        }
    };

    const processText = async () => {
        if (!textInput.trim()) return;
        Keyboard.dismiss();
        startProcessing();
        try {
            const data = await extractMedicinesFromText(textInput);
            handleResult(data);
            setTextInput('');
        } catch (error) {
            alert('Failed to process text.');
            setLoading(false);
        }
    };

    const fetchLinks = async (medName: string) => {
        setLoadingLinks(prev => ({ ...prev, [medName]: true }));
        try {
            const links = await searchMedicineOnline(medName);
            setMedicineLinks(prev => ({ ...prev, [medName]: links }));
        } finally {
            setLoadingLinks(prev => ({ ...prev, [medName]: false }));
        }
    };

    // --- Reminder Logic ---
    const openReminderSetup = (med: Medicine) => {
        setSelectedMedicine(med);

        // Auto-detect frequency
        let freq = 2; // Default
        const dosageLower = med.dosage.toLowerCase();

        if (dosageLower.includes('once') || dosageLower.includes('1 time') || dosageLower.includes('1x')) freq = 1;
        else if (dosageLower.includes('twice') || dosageLower.includes('twize') || dosageLower.includes('2 times') || dosageLower.includes('2x')) freq = 2;
        else if (dosageLower.includes('thrice') || dosageLower.includes('3 times') || dosageLower.includes('3x')) freq = 3;
        else if (dosageLower.includes('4 times') || dosageLower.includes('4x')) freq = 4;

        setReminderFreq(freq);

        // Set initial times based on detected freq
        let newTimes: string[] = [];
        if (freq === 1) newTimes = ['10:00'];
        if (freq === 2) newTimes = ['10:00', '20:00'];
        if (freq === 3) newTimes = ['08:00', '14:00', '20:00'];
        if (freq === 4) newTimes = ['08:00', '12:00', '16:00', '20:00'];
        if (freq > 4) newTimes = Array(freq).fill('12:00');

        setReminderTimes(newTimes);
        setShowReminderModal(true);
    };

    const updateFrequency = (freq: number) => {
        setReminderFreq(freq);
        let newTimes: string[] = [];
        if (freq === 1) newTimes = ['10:00'];
        if (freq === 2) newTimes = ['10:00', '20:00'];
        if (freq === 3) newTimes = ['08:00', '14:00', '20:00'];
        if (freq === 4) newTimes = ['08:00', '12:00', '16:00', '20:00'];
        if (freq > 4) {
            // Just fill with something distinct or keep previous
            newTimes = Array(freq).fill('12:00');
        }
        setReminderTimes(newTimes);
    };

    const updateTime = (index: number, text: string) => {
        const newTimes = [...reminderTimes];
        newTimes[index] = text;
        setReminderTimes(newTimes);
    };

    const saveReminder = async () => {
        if (selectedMedicine && reminderTimes.length > 0) {
            setLoading(true);
            try {
                // Collect links for this medicine
                const links = medicineLinks[selectedMedicine.name]?.map(l => l.link) || [];

                const id = await addMedicine(
                    selectedMedicine.name,
                    selectedMedicine.dosage,
                    reminderFreq,
                    reminderTimes,
                    links
                );

                await scheduleDoseWithNags(
                    id,
                    selectedMedicine.name,
                    selectedMedicine.dosage,
                    parseInt(reminderTimes[0].split(':')[0]),
                    parseInt(reminderTimes[0].split(':')[1])
                );

                // Show Success
                Alert.alert("Saved", "Reminder set successfully!", [
                    { text: "OK", onPress: () => setShowReminderModal(false) }
                ]);

            } catch (e) {
                console.error(e);
                Alert.alert("Error", "Failed to save reminder");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleTimeChange = (event: any, selectedDate?: Date) => {
        setShowTimePicker(false);
        if (selectedDate) {
            const hour = selectedDate.getHours().toString().padStart(2, '0');
            const minute = selectedDate.getMinutes().toString().padStart(2, '0');
            updateTime(activeTimeIndex, `${hour}:${minute}`);
        }
    };


    const openDirections = (pharmacy: SearchResult) => {
        const { lat, lng } = pharmacy.coordinates;
        const url = Platform.select({
            ios: `maps://app?daddr=${lat},${lng}`,
            android: `google.navigation:q=${lat},${lng}`,
        });

        if (url) {
            Linking.openURL(url).catch(() => {
                // Fallback to browser-based Google Maps
                const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                Linking.openURL(fallbackUrl);
            });
        }
    };

    // --- Image Picker ---
    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
            base64: true,
        });
        if (!result.canceled) {
            setImage(result.assets[0].uri);
            processImage(result.assets[0].base64!);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return alert('Camera permission required!');
        let result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.8,
            base64: true,
        });
        if (!result.canceled) {
            setImage(result.assets[0].uri);
            processImage(result.assets[0].base64!);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.container}
        >
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Medicine Finder</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0a7ea4" />
                        <Text style={[styles.loadingText, { color: colors.text }]}>Thinking...</Text>
                    </View>
                )}

                {image && !result && !loading && (
                    <View style={styles.imagePreviewContainer}>
                        <Image source={{ uri: image }} style={styles.imagePreview} />
                        <TouchableOpacity style={styles.clearImage} onPress={() => setImage(null)}>
                            <IconSymbol name="plus" size={20} color="#fff" style={{ transform: [{ rotate: '45deg' }] }} />
                        </TouchableOpacity>
                    </View>
                )}

                {result && (
                    <View style={styles.results}>
                        <View style={[styles.summary, { backgroundColor: '#E3F2FD' }]}>
                            <Text style={[styles.summaryTitle, { color: colors.text }]}>AI Analysis</Text>
                            <Text style={[styles.summaryText, { color: colors.text }]}>{result.summary}</Text>
                        </View>

                        {result.medicines.map((med, idx) => (
                            <View key={idx} style={[styles.medCard, { backgroundColor: '#fff' }]}>
                                <View style={styles.medHeader}>
                                    <View>
                                        <Text style={[styles.medName, { color: colors.text }]}>{med.name}</Text>
                                        <Text style={[styles.medDosage, { color: colors.text }]}>{med.dosage}</Text>
                                    </View>
                                </View>

                                <View style={styles.divider} />

                                {loadingLinks[med.name] ? (
                                    <ActivityIndicator size="small" color="#0a7ea4" style={{ alignSelf: 'flex-start' }} />
                                ) : (
                                    <View style={styles.links}>
                                        {medicineLinks[med.name]?.map((l, i) => (
                                            <TouchableOpacity key={i} style={styles.link} onPress={() => WebBrowser.openBrowserAsync(l.link)}>
                                                <Text style={[styles.linkSource, { color: colors.text }]} numberOfLines={1}>{l.source} - {l.title}</Text>
                                                <IconSymbol name="chevron.right" size={12} color="#0a7ea4" />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={[styles.reminderBtn, { backgroundColor: '#E3F2FD' }]}
                                    onPress={() => openReminderSetup(med)}
                                >
                                    <IconSymbol name="bell.fill" size={16} color="#0a7ea4" />
                                    <Text style={styles.reminderBtnText}>Set Reminder</Text>
                                </TouchableOpacity>
                            </View>
                        ))}

                        {/* Pharmacy Finder - Now with Modal */}
                        <TouchableOpacity
                            style={[styles.pharmacyButton, { marginTop: 20, backgroundColor: '#4ADE80' }]}
                            onPress={() => setShowPharmaciesModal(true)}
                        >
                            <IconSymbol name="map.fill" size={20} color="#fff" />
                            <Text style={styles.pharmacyButtonText}>Find Nearby Pharmacies</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            <PharmaciesModal visible={showPharmaciesModal} onClose={() => setShowPharmaciesModal(false)} />



            {/* Media Menu */}
            {
                showMediaMenu && (
                    <Animated.View style={[styles.mediaMenu, { opacity: menuAnim, transform: [{ translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
                        <TouchableOpacity style={styles.mediaBtn} onPress={takePhoto}>
                            <View style={styles.mediaIconBg}>
                                <IconSymbol name="camera.fill" size={24} color="#0a7ea4" />
                            </View>
                            <Text style={styles.mediaLabel}>Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mediaBtn} onPress={pickImage}>
                            <View style={styles.mediaIconBg}>
                                <IconSymbol name="photo.fill" size={24} color="#0a7ea4" />
                            </View>
                            <Text style={styles.mediaLabel}>Photos</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )
            }

            {/* Input Bar */}
            <View style={[styles.inputContainer, { backgroundColor: colors.background }]}>
                <View style={styles.inputRow}>
                    <View style={[styles.inputBar, { backgroundColor: '#f5f5f5' }]}>
                        {!isRecording ? (
                            <>
                                <TouchableOpacity style={styles.plusBtn} onPress={() => setShowMediaMenu(!showMediaMenu)}>
                                    <IconSymbol name="plus" size={24} color={colors.text} />
                                </TouchableOpacity>

                                <TextInput
                                    style={[styles.textInput, { color: colors.text }]}
                                    placeholder="Ask anything"
                                    placeholderTextColor="#888"
                                    value={textInput}
                                    onChangeText={setTextInput}
                                />
                            </>
                        ) : (
                            <View style={styles.recordingState}>
                                <Animated.View style={[styles.recordingDot, { opacity: pulseAnim }]} />
                                <Text style={[styles.recordingTime, { color: '#ea4335' }]}>
                                    {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
                                </Text>
                                <Text style={styles.recordingText}>Recording...</Text>
                            </View>
                        )}
                    </View>

                    {/* WhatsApp style Action Button */}
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPressIn={() => textInput.trim().length === 0 && startRecording()}
                        onPressOut={() => textInput.trim().length === 0 && stopRecording()}
                        onPress={() => textInput.trim().length > 0 && processText()}
                        style={[
                            styles.actionFab,
                            { backgroundColor: (textInput.trim().length > 0 || isRecording) ? '#0a7ea4' : '#25D366' }
                        ]}
                    >
                        <IconSymbol
                            name={textInput.trim().length > 0 ? "paperplane.fill" : "mic"}
                            size={24}
                            color="#fff"
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Reminder Modal */}
            <Modal
                transparent={true}
                visible={showReminderModal}
                animationType="slide"
                onRequestClose={() => setShowReminderModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Set Reminder</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.text }]}>
                            {selectedMedicine?.name} ({selectedMedicine?.dosage})
                        </Text>

                        <Text style={[styles.label, { color: colors.text }]}>How many times a day?</Text>
                        <View style={styles.freqRow}>
                            {[1, 2, 3, 4].map(num => (
                                <TouchableOpacity
                                    key={num}
                                    style={[
                                        styles.freqOption,
                                        reminderFreq === num && styles.freqOptionSelected
                                    ]}
                                    onPress={() => updateFrequency(num)}
                                >
                                    <Text style={[
                                        styles.freqText,
                                        reminderFreq === num && styles.freqTextSelected,
                                        { color: reminderFreq === num ? '#fff' : colors.text }
                                    ]}>{num}x</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.label, { color: colors.text }]}>Set Timings (HH:MM)</Text>
                        <View style={styles.timesContainer}>
                            {reminderTimes.map((time, idx) => (
                                <View key={idx} style={styles.timeInputRow}>
                                    <Text style={[styles.doseLabel, { color: colors.text }]}>Dose {idx + 1}</Text>
                                    <TouchableOpacity
                                        style={[styles.timeInputBtn, { borderBottomColor: colors.text }]}
                                        onPress={() => {
                                            setActiveTimeIndex(idx);
                                            setShowTimePicker(true);
                                        }}
                                    >
                                        <Text style={[styles.timeInputText, { color: colors.text }]}>{time}</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>

                        {showTimePicker && (
                            <RNDateTimePicker
                                value={(() => {
                                    const [h, m] = reminderTimes[activeTimeIndex].split(':');
                                    const d = new Date();
                                    d.setHours(Number(h));
                                    d.setMinutes(Number(m));
                                    return d;
                                })()}
                                mode="time"
                                is24Hour={true}
                                display="spinner"
                                onChange={handleTimeChange}
                            />
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowReminderModal(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={saveReminder}>
                                <Text style={styles.saveBtnText}>Save & Schedule</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 60, backgroundColor: '#fff' },
    header: { paddingHorizontal: 20, marginBottom: 10 },
    title: { fontSize: 24, fontFamily: Typography.bold },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },

    loadingContainer: { alignItems: 'center', marginVertical: 30 },
    loadingText: { marginTop: 10, fontFamily: Typography.medium },

    imagePreviewContainer: { width: '100%', height: 300, borderRadius: 20, overflow: 'hidden', marginBottom: 20 },
    imagePreview: { width: '100%', height: '100%' },
    clearImage: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },

    results: { gap: 15 },
    summary: { padding: 18, borderRadius: 16 },
    summaryTitle: { fontSize: 16, fontFamily: Typography.bold, marginBottom: 4 },
    summaryText: { fontSize: 14, fontFamily: Typography.regular, lineHeight: 20, opacity: 0.9 },

    medCard: { padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#eee' },
    medHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    medName: { fontSize: 17, fontFamily: Typography.bold },
    medDosage: { fontSize: 13, fontFamily: Typography.regular, opacity: 0.6, marginTop: 2 },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
    links: { gap: 10 },
    link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(10, 126, 164, 0.05)', padding: 12, borderRadius: 10 },
    linkSource: { fontSize: 13, fontFamily: Typography.medium, flex: 1, marginRight: 10 },

    reminderBtn: {
        marginTop: 15,
        padding: 12,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    reminderBtnText: {
        color: '#0a7ea4',
        fontFamily: Typography.semiBold,
    },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', borderRadius: 20, padding: 24, elevation: 5 },
    modalTitle: { fontSize: 20, fontFamily: Typography.bold, marginBottom: 5 },
    modalSubtitle: { fontSize: 14, fontFamily: Typography.regular, opacity: 0.7, marginBottom: 20 },
    label: { fontSize: 16, fontFamily: Typography.semiBold, marginTop: 15, marginBottom: 10 },

    freqRow: { flexDirection: 'row', gap: 10 },
    freqOption: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
    freqOptionSelected: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
    freqText: { fontFamily: Typography.semiBold, color: '#333' },
    freqTextSelected: { color: '#fff' },

    timesContainer: { gap: 10 },
    timeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    doseLabel: { width: 60, fontFamily: Typography.regular },
    timeInputBtn: { flex: 1, padding: 8, borderBottomWidth: 1 },
    timeInputText: { fontSize: 16, fontFamily: Typography.regular },

    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 30 },
    cancelBtn: { padding: 10 },
    cancelBtnText: { color: '#888', fontFamily: Typography.regular },
    saveBtn: { backgroundColor: '#0a7ea4', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
    saveBtnText: { color: '#fff', fontFamily: Typography.bold },

    // Dynamic UI
    mediaMenu: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        gap: 20,
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        zIndex: 100,
    },
    mediaBtn: { alignItems: 'center', gap: 5 },
    mediaIconBg: { width: 56, height: 56, backgroundColor: '#f0f0f0', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    mediaLabel: { color: '#333', fontSize: 12, fontFamily: Typography.regular },

    inputContainer: { padding: 10, position: 'absolute', bottom: 0, left: 0, right: 0 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    inputBar: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 30, paddingLeft: 12, minHeight: 48 },
    plusBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
    textInput: { flex: 1, paddingHorizontal: 12, fontSize: 16, height: 40, fontFamily: Typography.regular },

    actionFab: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },

    recordingState: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 10 },
    recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ea4335', marginRight: 10 },
    recordingTime: { fontSize: 16, fontFamily: Typography.bold, marginRight: 10 },
    recordingText: { fontSize: 16, fontFamily: Typography.regular, color: '#888' },

    // Pharmacy Finder
    pharmacyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#25D366',
        padding: 16,
        borderRadius: 16,
        gap: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    pharmacyButtonText: { color: '#fff', fontSize: 16, fontFamily: Typography.semiBold },
});
