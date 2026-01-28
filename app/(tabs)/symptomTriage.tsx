import ClinicsModal from '@/components/ClinicsModal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Typography } from '@/constants/theme';
import { analyzeSymptoms, transcribeAudio } from '@/services/groq';
import { Audio } from 'expo-av';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

type TriageState = 'IDLE' | 'RECORDING' | 'PROCESSING_AUDIO' | 'CONFIRMING' | 'ANALYZING' | 'RESULTS';

export default function SymptomTriageScreen() {
    const [state, setState] = useState<TriageState>('IDLE');
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [symptoms, setSymptoms] = useState<string>('');
    const [result, setResult] = useState<{ severity: string; advice: string } | null>(null);
    const [permissionResponse, requestPermission] = Audio.usePermissions();
    const [showClinicsModal, setShowClinicsModal] = useState(false);

    // Pulse animation for recording state
    const pulseScale = useSharedValue(1);

    useEffect(() => {
        if (state === 'RECORDING') {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.2, { duration: 500 }),
                    withTiming(1, { duration: 500 })
                ),
                -1,
                true
            );
        } else {
            pulseScale.value = withTiming(1);
        }
    }, [state]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
    }));

    async function startRecording() {
        try {
            if (permissionResponse?.status !== 'granted') {
                const permission = await requestPermission();
                if (permission.status !== 'granted') {
                    Alert.alert('Permission needed', 'Microphone permission is required to use this feature.');
                    return;
                }
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(recording);
            setState('RECORDING');
        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert('Error', 'Failed to start recording.');
        }
    }

    async function stopRecording() {
        if (!recording) return;

        setState('PROCESSING_AUDIO');
        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);

            if (uri) {
                console.log('Audio URI:', uri);
                const transcribedText = await transcribeAudio(uri);
                setSymptoms(transcribedText);
                setState('CONFIRMING');
            }
        } catch (error) {
            console.error('Transcription error', error);
            Alert.alert('Error', 'Failed to transcribe audio.');
            setState('IDLE');
        }
    }

    async function handleConfirm() {
        setState('ANALYZING');
        try {
            console.log('Analyzing symptoms:', symptoms);
            const analysis = await analyzeSymptoms(symptoms);
            setResult({
                severity: analysis.severity,
                advice: analysis.advice
            });
            setState('RESULTS');
        } catch (error) {
            console.error('Analysis error', error);
            Alert.alert('Error', 'Failed to analyze symptoms.');
            setState('CONFIRMING');
        }
    }

    function handleReset() {
        setState('IDLE');
        setSymptoms('');
        setResult(null);
    }

    function callAmbulance() {
        Linking.openURL('tel:1020').catch(() => {
            Alert.alert('Error', 'Could not open phone dialer.');
        });
    }

    return (
        <View style={styles.container}>
            {state === 'IDLE' && (
                <View style={styles.centerContent}>
                    <Text style={styles.heading}>Describe your symptoms</Text>
                    <Text style={styles.subHeading}>Tap the button below and speak clearly.</Text>

                    <TouchableOpacity onPress={startRecording} style={styles.micButtonContainer}>
                        <View style={styles.micButton}>
                            <IconSymbol name="mic" size={64} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            {state === 'RECORDING' && (
                <View style={styles.centerContent}>
                    <Text style={styles.heading}>Listening...</Text>
                    <Animated.View style={[styles.micButtonContainer, animatedStyle]}>
                        <TouchableOpacity onPress={stopRecording} style={[styles.micButton, styles.recordingButton]}>
                            <IconSymbol name="mic" size={64} color="#fff" />
                        </TouchableOpacity>
                    </Animated.View>
                    <Text style={styles.instructionText}>Tap to stop</Text>
                </View>
            )}

            {state === 'PROCESSING_AUDIO' && (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={Colors.light.tint} />
                    <Text style={styles.loadingText}>Processing your voice...</Text>
                </View>
            )}

            {state === 'CONFIRMING' && (
                <View style={styles.content}>
                    <Text style={styles.label}>You mentioned:</Text>
                    <ScrollView style={styles.transcriptContainer}>
                        <Text style={styles.transcriptText}>{symptoms}</Text>
                    </ScrollView>

                    <View style={styles.buttonGroup}>
                        <TouchableOpacity onPress={handleReset} style={styles.retryButton}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton}>
                            <Text style={styles.confirmButtonText}>Confirm & Analyze</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {state === 'ANALYZING' && (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={Colors.light.tint} />
                    <Text style={styles.loadingText}>Analyzing severity...</Text>
                </View>
            )}

            {state === 'RESULTS' && result && (
                <View style={styles.content}>
                    <View style={styles.resultContainer}>
                        <Text style={styles.resultLabel}>Severity Level</Text>
                        <Text style={[
                            styles.severityText,
                            result.severity.toUpperCase() === 'HIGH' ? styles.highSeverity :
                                result.severity.toUpperCase() === 'MEDIUM' ? styles.mediumSeverity :
                                    styles.lowSeverity
                        ]}>
                            {result.severity.toUpperCase()}
                        </Text>
                    </View>

                    <View style={styles.adviceContainer}>
                        <Text style={styles.adviceLabel}>Recommendation</Text>
                        <Text style={styles.adviceText}>{result.advice}</Text>
                    </View>

                    {(result.severity.toUpperCase() === 'HIGH' || result.severity.toUpperCase() === 'MEDIUM') && (
                        <View style={styles.emergencyActions}>
                            <TouchableOpacity onPress={callAmbulance} style={styles.ambulanceButton}>
                                <Text style={styles.ambulanceButtonText}>🚑 Call Ambulance</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowClinicsModal(true)} style={styles.clinicsButton}>
                                <Text style={styles.clinicsButtonText}>🏥 Find Clinics</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
                        <Text style={styles.resetButtonText}>Start Over</Text>
                    </TouchableOpacity>
                </View>
            )}

            <ClinicsModal visible={showClinicsModal} onClose={() => setShowClinicsModal(false)} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 24,
        justifyContent: 'center',
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingTop: 60,
    },
    heading: {
        fontSize: 32,
        fontFamily: Typography.extraBold,
        color: '#11181C',
        textAlign: 'center',
        marginBottom: 16,
    },
    subHeading: {
        fontSize: 18,
        fontFamily: Typography.regular,
        color: '#687076',
        textAlign: 'center',
        marginBottom: 60,
    },
    micButtonContainer: {
        marginBottom: 20,
    },
    micButton: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#4ADE80',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#4ADE80",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    recordingButton: {
        backgroundColor: '#ef4444',
    },
    instructionText: {
        marginTop: 20,
        fontSize: 16,
        fontFamily: Typography.regular,
        color: '#888',
    },
    loadingText: {
        marginTop: 20,
        fontSize: 20,
        fontFamily: Typography.semiBold,
        color: '#4ADE80',
    },
    label: {
        fontSize: 24,
        fontFamily: Typography.bold,
        color: '#11181C',
        marginBottom: 20,
    },
    transcriptContainer: {
        maxHeight: 200,
        backgroundColor: '#f0fdf4',
        borderRadius: 16,
        padding: 20,
        marginBottom: 40,
    },
    transcriptText: {
        fontSize: 22,
        fontFamily: Typography.regular,
        color: '#14532d',
        lineHeight: 32,
    },
    buttonGroup: {
        flexDirection: 'row',
        gap: 16,
    },
    retryButton: {
        flex: 1,
        paddingVertical: 18,
        borderRadius: 12,
        backgroundColor: '#f4f4f5',
        alignItems: 'center',
    },
    retryButtonText: {
        fontSize: 18,
        fontFamily: Typography.semiBold,
        color: '#666',
    },
    confirmButton: {
        flex: 2,
        paddingVertical: 18,
        borderRadius: 12,
        backgroundColor: '#4ADE80',
        alignItems: 'center',
        shadowColor: "#4ADE80",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    confirmButtonText: {
        fontSize: 18,
        fontFamily: Typography.bold,
        color: '#fff',
    },
    resultContainer: {
        marginBottom: 40,
        alignItems: 'center',
    },
    resultLabel: {
        fontSize: 18,
        fontFamily: Typography.semiBold,
        color: '#888',
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    severityText: {
        fontSize: 64,
        fontFamily: Typography.black,
        letterSpacing: -2,
    },
    lowSeverity: { color: '#4ADE80' },
    mediumSeverity: { color: '#facc15' },
    highSeverity: { color: '#ef4444' },
    adviceContainer: {
        backgroundColor: '#f0fdf4',
        padding: 30,
        borderRadius: 24,
        marginBottom: 40,
    },
    adviceLabel: {
        fontSize: 16,
        fontFamily: Typography.bold,
        color: '#166534',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    adviceText: {
        fontSize: 24,
        fontFamily: Typography.medium,
        color: '#14532d',
        lineHeight: 34,
    },
    resetButton: {
        paddingVertical: 20,
        width: '100%',
        alignItems: 'center',
    },
    resetButtonText: {
        fontSize: 18,
        fontFamily: Typography.semiBold,
        color: '#888',
    },
    emergencyActions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    ambulanceButton: {
        flex: 1,
        backgroundColor: '#ef4444',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    ambulanceButtonText: {
        color: '#fff',
        fontFamily: Typography.bold,
        fontSize: 16,
    },
    clinicsButton: {
        flex: 1,
        backgroundColor: '#4ADE80',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    clinicsButtonText: {
        color: '#fff',
        fontFamily: Typography.bold,
        fontSize: 16,
    },
});
