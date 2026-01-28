import { Typography } from '@/constants/theme';
import { Clinic, getNearbyClinics } from '@/services/serper-places';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ClinicsModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function ClinicsModal({ visible, onClose }: ClinicsModalProps) {
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [loading, setLoading] = useState(true);
    const [areaName, setAreaName] = useState<string>('your location');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            fetchClinics();
        }
    }, [visible]);

    async function fetchClinics() {
        setLoading(true);
        setError(null);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError('Location permission is required to find nearby clinics.');
                setLoading(false);
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            // Reverse geocode to get area name
            let area = 'your area';
            try {
                const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (address) {
                    area = address.district || address.subregion || address.city || 'your area';
                    setAreaName(area);
                }
            } catch (geoError) {
                console.log('Reverse geocode failed, using default area name');
            }

            const nearbyClinics = await getNearbyClinics(latitude, longitude, area);
            setClinics(nearbyClinics);
        } catch (err) {
            console.error('Error fetching clinics:', err);
            setError('Failed to fetch nearby clinics. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    function openDirections(clinic: Clinic) {
        // Search by clinic name on Google Maps for better results
        const searchQuery = encodeURIComponent(clinic.name);
        const url = `https://www.google.com/maps/search/${searchQuery}`;
        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Could not open Google Maps.');
        });
    }

    function openDetails(clinic: Clinic) {
        if (clinic.placeId) {
            const url = `https://www.google.com/maps/place/?q=place_id:${clinic.placeId}`;
            Linking.openURL(url).catch(() => {
                Alert.alert('Error', 'Could not open Google Maps.');
            });
        } else {
            openDirections(clinic);
        }
    }

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Clinics & Hospitals</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.subtitle}>Near {areaName}</Text>

                {loading && (
                    <View style={styles.centerContent}>
                        <ActivityIndicator size="large" color="#4ADE80" />
                        <Text style={styles.loadingText}>Finding nearby clinics...</Text>
                    </View>
                )}

                {error && (
                    <View style={styles.centerContent}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity onPress={fetchClinics} style={styles.retryButton}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {!loading && !error && clinics.length === 0 && (
                    <View style={styles.centerContent}>
                        <Text style={styles.emptyText}>No clinics found nearby.</Text>
                    </View>
                )}

                {!loading && !error && clinics.length > 0 && (
                    <FlatList
                        data={clinics}
                        keyExtractor={(item, index) => item.placeId || `${index}`}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => (
                            <View style={styles.clinicCard}>
                                <View style={styles.clinicInfo}>
                                    <Text style={styles.clinicName}>{item.name}</Text>
                                    <Text style={styles.clinicAddress}>{item.address}</Text>
                                    <View style={styles.clinicMeta}>
                                        {item.rating && (
                                            <Text style={styles.rating}>⭐ {item.rating}</Text>
                                        )}
                                        {item.distance && (
                                            <Text style={styles.distance}>{item.distance}</Text>
                                        )}
                                        {item.isOpen !== undefined && (
                                            <Text style={item.isOpen ? styles.open : styles.closed}>
                                                {item.isOpen ? 'Open' : 'Closed'}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.clinicActions}>
                                    <TouchableOpacity onPress={() => openDirections(item)} style={styles.directionsButton}>
                                        <Text style={styles.directionsButtonText}>Directions</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => openDetails(item)} style={styles.detailsButton}>
                                        <Text style={styles.detailsButtonText}>Details</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    />
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    title: {
        fontSize: 24,
        fontFamily: Typography.extraBold,
        color: '#11181C',
    },
    closeButton: {
        padding: 8,
    },
    closeButtonText: {
        fontSize: 24,
        fontFamily: Typography.regular,
        color: '#888',
    },
    subtitle: {
        fontSize: 16,
        color: '#4ADE80',
        fontFamily: Typography.semiBold,
        paddingHorizontal: 20,
        paddingTop: 10,
        textTransform: 'capitalize',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        fontFamily: Typography.regular,
        color: '#888',
    },
    errorText: {
        fontSize: 16,
        fontFamily: Typography.regular,
        color: '#ef4444',
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: '#4ADE80',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontFamily: Typography.semiBold,
    },
    emptyText: {
        fontSize: 16,
        fontFamily: Typography.regular,
        color: '#888',
    },
    listContent: {
        padding: 16,
    },
    clinicCard: {
        backgroundColor: '#f0fdf4',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    clinicInfo: {
        marginBottom: 12,
    },
    clinicName: {
        fontSize: 18,
        fontFamily: Typography.bold,
        color: '#14532d',
        marginBottom: 4,
    },
    clinicAddress: {
        fontSize: 14,
        fontFamily: Typography.regular,
        color: '#166534',
        marginBottom: 8,
    },
    clinicMeta: {
        flexDirection: 'row',
        gap: 12,
    },
    rating: {
        fontSize: 14,
        fontFamily: Typography.regular,
        color: '#666',
    },
    distance: {
        fontSize: 14,
        fontFamily: Typography.regular,
        color: '#666',
    },
    open: {
        fontSize: 14,
        fontFamily: Typography.semiBold,
        color: '#22c55e',
    },
    closed: {
        fontSize: 14,
        fontFamily: Typography.semiBold,
        color: '#ef4444',
    },
    clinicActions: {
        flexDirection: 'row',
        gap: 12,
    },
    directionsButton: {
        flex: 1,
        backgroundColor: '#4ADE80',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    directionsButtonText: {
        color: '#fff',
        fontFamily: Typography.semiBold,
    },
    detailsButton: {
        flex: 1,
        backgroundColor: '#e0f2e9',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    detailsButtonText: {
        color: '#166534',
        fontFamily: Typography.semiBold,
    },
});
