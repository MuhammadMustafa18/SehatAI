import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { analyzePrescription } from '@/services/groq';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MedicineFinderScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const colors = Colors[colorScheme];
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

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
        if (status !== 'granted') {
            alert('Sorry, we need camera permissions to make this work!');
            return;
        }

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

    const processImage = async (base64: string) => {
        setLoading(true);
        setResult(null);
        try {
            const text = await analyzePrescription(base64);
            setResult(text);
        } catch (error) {
            console.error(error);
            setResult('Failed to analyze prescription. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>Prescription Reader</Text>
            <Text style={[styles.subtitle, { color: colors.text }]}>
                Upload or take a photo of your prescription to extract medicines and instructions.
            </Text>

            <View style={styles.imageContainer}>
                {image ? (
                    <Image source={{ uri: image }} style={styles.previewImage} />
                ) : (
                    <View style={[styles.placeholder, { backgroundColor: colorScheme === 'light' ? '#f0f0f0' : '#222' }]}>
                        <IconSymbol name="doc.text.fill" size={48} color="#888" />
                        <Text style={styles.placeholderText}>No image selected</Text>
                    </View>
                )}
            </View>

            <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.button} onPress={pickImage}>
                    <IconSymbol name="house.fill" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.cameraButton]} onPress={takePhoto}>
                    <IconSymbol name="paperplane.fill" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Camera</Text>
                </TouchableOpacity>
            </View>

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0a7ea4" />
                    <Text style={[styles.loadingText, { color: colors.text }]}>Analyzing Prescription...</Text>
                </View>
            )}

            {result && (
                <View style={[styles.resultContainer, { backgroundColor: colorScheme === 'light' ? '#f9f9f9' : '#1a1a1a' }]}>
                    <Text style={[styles.resultTitle, { color: colors.text }]}>Analysis Result:</Text>
                    <Text style={[styles.resultText, { color: colors.text }]}>{result}</Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingTop: 60,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
        opacity: 0.7,
    },
    imageContainer: {
        width: '100%',
        height: 300,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 30,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    previewImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    placeholderText: {
        color: '#888',
        fontSize: 16,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 30,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0a7ea4',
        paddingHorizontal: 25,
        paddingVertical: 15,
        borderRadius: 15,
        gap: 10,
    },
    cameraButton: {
        backgroundColor: '#34a853',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    loadingContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
    },
    resultContainer: {
        width: '100%',
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#eee',
        marginBottom: 40,
    },
    resultTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    resultText: {
        fontSize: 15,
        lineHeight: 22,
    },
});
