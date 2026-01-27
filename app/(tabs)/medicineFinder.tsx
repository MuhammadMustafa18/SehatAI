import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { analyzePrescription, extractMedicinesFromText, transcribeAudio } from '@/services/groq';
import { searchMedicineOnline, SearchResult } from '@/services/search';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Medicine {
    name: string;
    dosage: string;
}

interface AnalysisResult {
    summary: string;
    medicines: Medicine[];
}

type FinderMode = 'image' | 'voice' | 'text';

export default function MedicineFinderScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const colors = Colors[colorScheme];

    // UI State
    const [mode, setMode] = useState<FinderMode>('image');
    const [image, setImage] = useState<string | null>(null);
    const [textInput, setTextInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);

    // Processing State
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [medicineLinks, setMedicineLinks] = useState<Record<string, SearchResult[]>>({});
    const [loadingLinks, setLoadingLinks] = useState<Record<string, boolean>>({});

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // --- Audio Logic ---
    async function startRecording() {
        try {
            // Clean up any existing recording state first
            if (recording) {
                try {
                    await recording.stopAndUnloadAsync();
                } catch (e) {
                    // Ignore if already stopped
                }
                setRecording(null);
            }

            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') return alert('Permission to access microphone is required!');

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Double check recording is null before creating
            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(newRecording);
            setIsRecording(true);

            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
                ])
            ).start();
        } catch (err) {
            console.error('Failed to start recording', err);
            setIsRecording(false);
            setRecording(null);
        }
    }

    async function stopRecording() {
        if (!recording) return;

        try {
            setIsRecording(false);
            pulseAnim.setValue(1);

            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();

            // Critical: Unset recording BEFORE processing to allow next session
            setRecording(null);

            if (uri) processAudio(uri);
        } catch (error) {
            console.error('Failed to stop recording', error);
            setRecording(null);
            setIsRecording(false);
        }
    }

    // --- Processing Logic ---
    const processImage = async (base64: string) => {
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
        startProcessing();
        try {
            const data = await extractMedicinesFromText(textInput);
            handleResult(data);
        } catch (error) {
            alert('Failed to process text.');
            setLoading(false);
        }
    };

    const startProcessing = () => {
        setLoading(true);
        setResult(null);
        setMedicineLinks({});
        setLoadingLinks({});
    };

    const handleResult = (data: AnalysisResult) => {
        setResult(data);
        setLoading(false);
        data.medicines.forEach(med => fetchLinks(med.name));
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
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Medicine Finder</Text>

                {/* Mode Selector */}
                <View style={[styles.modeSelector, { backgroundColor: colorScheme === 'light' ? '#F0F0F0' : '#222' }]}>
                    {(['image', 'voice', 'text'] as FinderMode[]).map((m) => (
                        <TouchableOpacity
                            key={m}
                            onPress={() => setMode(m)}
                            style={[styles.modeBtn, mode === m && { backgroundColor: '#0a7ea4' }]}
                        >
                            <Text style={[styles.modeText, mode === m ? { color: '#fff' } : { color: colors.text }]}>
                                {m.charAt(0).toUpperCase() + m.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Input Section */}
                <View style={styles.inputCard}>
                    {mode === 'image' && (
                        <View style={styles.imageSection}>
                            <View style={[styles.imagePreview, { backgroundColor: colorScheme === 'light' ? '#f5f5f5' : '#1a1a1a' }]}>
                                {image ? <Image source={{ uri: image }} style={styles.image} /> : <IconSymbol name="plus" size={40} color="#888" />}
                            </View>
                            <View style={styles.btnRow}>
                                <TouchableOpacity style={styles.actionBtn} onPress={pickImage}>
                                    <Text style={styles.actionBtnText}>Gallery</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.actionBtn, styles.cameraBtn]} onPress={takePhoto}>
                                    <Text style={styles.actionBtnText}>Camera</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {mode === 'voice' && (
                        <View style={styles.voiceSection}>
                            <Animated.View style={[styles.voiceBtnCircle, { transform: [{ scale: pulseAnim }] }]}>
                                <TouchableOpacity
                                    onPressIn={startRecording}
                                    onPressOut={stopRecording}
                                    style={styles.voiceBtn}
                                >
                                    <IconSymbol name="mic" size={40} color="#fff" />
                                </TouchableOpacity>
                            </Animated.View>
                            <Text style={[styles.voiceHint, { color: colors.text }]}>
                                {isRecording ? 'Listening...' : 'Hold to speak medicine names'}
                            </Text>
                        </View>
                    )}

                    {mode === 'text' && (
                        <View style={styles.textSection}>
                            <TextInput
                                style={[styles.textInput, { color: colors.text, borderColor: colors.icon }]}
                                placeholder="E.g. Panadol 500mg, Amoxicillin..."
                                placeholderTextColor="#999"
                                value={textInput}
                                onChangeText={setTextInput}
                                multiline
                            />
                            <TouchableOpacity style={styles.findBtn} onPress={processText}>
                                <Text style={styles.findBtnText}>Find Medicines</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Loading State */}
                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0a7ea4" />
                        <Text style={[styles.loadingText, { color: colors.text }]}>Processing your request...</Text>
                    </View>
                )}

                {/* Results Section */}
                {result && (
                    <View style={styles.results}>
                        <View style={[styles.summary, { backgroundColor: colorScheme === 'light' ? '#E3F2FD' : '#1D3D47' }]}>
                            <Text style={[styles.summaryTitle, { color: colors.text }]}>Analysis Result</Text>
                            <Text style={[styles.summaryText, { color: colors.text }]}>{result.summary}</Text>
                        </View>

                        {result.medicines.map((med, idx) => (
                            <View key={idx} style={[styles.medCard, { backgroundColor: colorScheme === 'light' ? '#fff' : '#1a1a1a', borderColor: '#eee' }]}>
                                <View style={styles.medHeader}>
                                    <Text style={[styles.medName, { color: colors.text }]}>{med.name}</Text>
                                    <View style={styles.badge}><Text style={styles.badgeText}>{med.dosage}</Text></View>
                                </View>

                                <View style={styles.divider} />

                                <Text style={[styles.buyLabel, { color: colors.text }]}>Buy Online</Text>
                                <View style={styles.links}>
                                    {loadingLinks[med.name] ? (
                                        <ActivityIndicator size="small" color="#0a7ea4" />
                                    ) : (
                                        medicineLinks[med.name]?.map((l, i) => (
                                            <TouchableOpacity key={i} style={styles.link} onPress={() => WebBrowser.openBrowserAsync(l.link)}>
                                                <Text style={[styles.linkSource, { color: colors.text }]}>{l.source}</Text>
                                                <IconSymbol name="chevron.right" size={12} color="#0a7ea4" />
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 60 },
    header: { paddingHorizontal: 20, marginBottom: 20 },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 15 },
    modeSelector: { flexDirection: 'row', borderRadius: 12, padding: 4 },
    modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    modeText: { fontSize: 13, fontWeight: '600' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    inputCard: { marginBottom: 20 },

    // Image Mode
    imageSection: { alignItems: 'center' },
    imagePreview: { width: '100%', height: 200, borderRadius: 20, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 15 },
    image: { width: '100%', height: '100%' },
    btnRow: { flexDirection: 'row', gap: 10 },
    actionBtn: { flex: 1, backgroundColor: '#eee', padding: 15, borderRadius: 12, alignItems: 'center' },
    actionBtnText: { fontWeight: '600' },
    cameraBtn: { backgroundColor: '#34a853' },

    // Voice Mode
    voiceSection: { alignItems: 'center', paddingVertical: 20 },
    voiceBtnCircle: { backgroundColor: 'rgba(10, 126, 164, 0.1)', padding: 15, borderRadius: 100 },
    voiceBtn: { backgroundColor: '#0a7ea4', width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    voiceHint: { marginTop: 15, fontSize: 14, fontStyle: 'italic' },

    // Text Mode
    textSection: { gap: 10 },
    textInput: { borderWidth: 1, borderRadius: 15, padding: 15, height: 100, textAlignVertical: 'top', fontSize: 16 },
    findBtn: { backgroundColor: '#0a7ea4', padding: 15, borderRadius: 15, alignItems: 'center' },
    findBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    loadingContainer: { alignItems: 'center', marginVertical: 30 },
    loadingText: { marginTop: 10, fontWeight: '500' },

    // Results
    results: { gap: 20 },
    summary: { padding: 20, borderRadius: 20 },
    summaryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
    summaryText: { fontSize: 14, lineHeight: 20 },
    medCard: { padding: 20, borderRadius: 20, borderWidth: 1 },
    medHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    medName: { fontSize: 18, fontWeight: '700' },
    badge: { backgroundColor: '#eee', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeText: { fontSize: 10, fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 15 },
    buyLabel: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 10, opacity: 0.6 },
    links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    link: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(10, 126, 164, 0.05)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    linkSource: { fontSize: 12, fontWeight: '600' }
});
