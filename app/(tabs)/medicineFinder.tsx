import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { analyzePrescription } from '@/services/groq';
import { searchMedicineOnline, SearchResult } from '@/services/search';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Medicine {
    name: string;
    dosage: string;
}

interface AnalysisResult {
    summary: string;
    medicines: Medicine[];
}

interface MedicineWithLinks extends Medicine {
    links?: SearchResult[];
    loadingLinks?: boolean;
}

export default function MedicineFinderScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const colors = Colors[colorScheme];
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [medicineLinks, setMedicineLinks] = useState<Record<string, SearchResult[]>>({});
    const [loadingLinks, setLoadingLinks] = useState<Record<string, boolean>>({});

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
        setMedicineLinks({});
        setLoadingLinks({});

        try {
            const data = await analyzePrescription(base64);
            setResult(data);

            // Trigger background searches for each medicine
            data.medicines.forEach((med: Medicine) => {
                fetchLinks(med.name);
            });
        } catch (error) {
            console.error(error);
            alert('Failed to analyze prescription. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const fetchLinks = async (medName: string) => {
        setLoadingLinks(prev => ({ ...prev, [medName]: true }));
        try {
            const links = await searchMedicineOnline(medName);
            setMedicineLinks(prev => ({ ...prev, [medName]: links }));
        } catch (error) {
            console.error(`Error fetching links for ${medName}:`, error);
        } finally {
            setLoadingLinks(prev => ({ ...prev, [medName]: false }));
        }
    };

    const openLink = async (url: string) => {
        await WebBrowser.openBrowserAsync(url);
    };

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>Prescription Reader</Text>
            <Text style={[styles.subtitle, { color: colors.text }]}>
                Analyze your prescription and find the best prices online instantly.
            </Text>

            <View style={styles.imageContainer}>
                {image ? (
                    <Image source={{ uri: image }} style={styles.previewImage} />
                ) : (
                    <View style={[styles.placeholder, { backgroundColor: colorScheme === 'light' ? '#f0f0f0' : '#222' }]}>
                        <IconSymbol name="doc.text.fill" size={48} color="#888" />
                        <Text style={styles.placeholderText}>Click below to start</Text>
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
                    <Text style={[styles.loadingText, { color: colors.text }]}>Reading Prescription...</Text>
                </View>
            )}

            {result && (
                <View style={styles.resultsWrapper}>
                    <View style={[styles.summaryCard, { backgroundColor: colorScheme === 'light' ? '#E3F2FD' : '#1D3D47' }]}>
                        <Text style={[styles.summaryTitle, { color: colors.text }]}>AI Overview</Text>
                        <Text style={[styles.summaryText, { color: colors.text }]}>{result.summary}</Text>
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Detected Medicines</Text>

                    {result.medicines.map((med, index) => (
                        <View key={index} style={[styles.medicineCard, { backgroundColor: colorScheme === 'light' ? '#fff' : '#1a1a1a' }]}>
                            <View style={styles.medicineHeader}>
                                <View style={styles.medicineInfo}>
                                    <Text style={[styles.medicineName, { color: colors.text }]}>{med.name}</Text>
                                    <Text style={[styles.medicineDosage, { color: colors.text }]}>{med.dosage}</Text>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            <Text style={[styles.buyLabel, { color: colors.text }]}>Best Online Prices:</Text>

                            {loadingLinks[med.name] ? (
                                <ActivityIndicator size="small" color="#0a7ea4" style={{ alignSelf: 'flex-start', marginVertical: 10 }} />
                            ) : (
                                <View style={styles.linksContainer}>
                                    {medicineLinks[med.name]?.length > 0 ? (
                                        medicineLinks[med.name].map((link, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                style={styles.linkItem}
                                                onPress={() => openLink(link.link)}
                                            >
                                                <IconSymbol name="chevron.right" size={14} color="#0a7ea4" />
                                                <Text style={[styles.linkSource, { color: colors.text }]} numberOfLines={1}>
                                                    {link.source} - <Text style={styles.linkTitle}>{link.title}</Text>
                                                </Text>
                                            </TouchableOpacity>
                                        ))
                                    ) : (
                                        <Text style={styles.noLinks}>No online links found.</Text>
                                    )}
                                </View>
                            )}
                        </View>
                    ))}
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
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 30,
        opacity: 0.7,
        paddingHorizontal: 20,
    },
    imageContainer: {
        width: '100%',
        height: 250,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 25,
        borderWidth: 1,
        borderColor: '#eee',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    placeholderText: {
        color: '#888',
        fontSize: 15,
        fontWeight: '500',
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
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
        gap: 10,
        elevation: 2,
    },
    cameraButton: {
        backgroundColor: '#34a853',
    },
    buttonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    loadingContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        fontWeight: '500',
    },
    resultsWrapper: {
        width: '100%',
        marginBottom: 40,
    },
    summaryCard: {
        padding: 20,
        borderRadius: 20,
        marginBottom: 30,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    summaryText: {
        fontSize: 15,
        lineHeight: 22,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 20,
    },
    medicineCard: {
        padding: 20,
        borderRadius: 24,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#eee',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    medicineHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    medicineInfo: {
        flex: 1,
    },
    medicineName: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    medicineDosage: {
        fontSize: 14,
        opacity: 0.6,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 15,
    },
    buyLabel: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        opacity: 0.8,
    },
    linksContainer: {
        gap: 12,
    },
    linkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(10, 126, 164, 0.05)',
        padding: 12,
        borderRadius: 12,
    },
    linkSource: {
        fontSize: 14,
        fontWeight: '700',
        flex: 1,
    },
    linkTitle: {
        fontWeight: '400',
        opacity: 0.8,
    },
    noLinks: {
        fontSize: 14,
        color: '#888',
        fontStyle: 'italic',
    },
});
