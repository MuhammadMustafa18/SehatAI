import { Typography } from '@/constants/theme';
import { Pharmacy, getNearbyPharmacies } from '@/services/serper-places';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface PharmaciesModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function PharmaciesModal({ visible, onClose }: PharmaciesModalProps) {
    const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
    const [loading, setLoading] = useState(true);
    const [areaName, setAreaName] = useState<string>('your location');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            fetchPharmacies();
        }
    }, [visible]);

    async function fetchPharmacies() {
        setLoading(true);
        setError(null);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError('Location permission is required to find nearby pharmacies.');
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

            const nearbyPharmacies = await getNearbyPharmacies(latitude, longitude, area);
            setPharmacies(nearbyPharmacies);
        } catch (err) {
            console.error('Error fetching pharmacies:', err);
            setError('Failed to fetch nearby pharmacies. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    function openDirections(pharmacy: Pharmacy) {
        // Search by pharmacy name on Google Maps for better results
        const searchQuery = encodeURIComponent(pharmacy.name);
        const url = `https://www.google.com/maps/search/${searchQuery}`;
        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Could not open Google Maps.');
        });
    }

    function openDetails(pharmacy: Pharmacy) {
        if (pharmacy.placeId) {
            const url = `https://www.google.com/maps/place/?q=place_id:${pharmacy.placeId}`;
            Linking.openURL(url).catch(() => {
                Alert.alert('Error', 'Could not open Google Maps.');
            });
        } else {
            openDirections(pharmacy);
        }
    }

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Nearby Pharmacies</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.subtitle}>Near {areaName}</Text>

                {loading && (
                    <View style={styles.centerContent}>
                        <ActivityIndicator size="large" color="#4ADE80" />
                        <Text style={styles.loadingText}>Finding nearby pharmacies...</Text>
                    </View>
                )}

                {error && (
                    <View style={styles.centerContent}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity onPress={fetchPharmacies} style={styles.retryButton}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {!loading && !error && pharmacies.length === 0 && (
                    <View style={styles.centerContent}>
                        <Text style={styles.emptyText}>No pharmacies found nearby.</Text>
                    </View>
                )}

                {!loading && !error && pharmacies.length > 0 && (
                    <FlatList
                        data={pharmacies}
                        keyExtractor={(item, index) => item.placeId || `${index}`}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => (
                            <View style={styles.pharmacyCard}>
                                <View style={styles.pharmacyInfo}>
                                    <Text style={styles.pharmacyName}>{item.name}</Text>
                                    <Text style={styles.pharmacyAddress}>{item.address}</Text>
                                    <View style={styles.pharmacyMeta}>
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
                                <View style={styles.pharmacyActions}>
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
    pharmacyCard: {
        backgroundColor: '#f0fdf4',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    pharmacyInfo: {
        marginBottom: 12,
    },
    pharmacyName: {
        fontSize: 18,
        fontFamily: Typography.bold,
        color: '#14532d',
        marginBottom: 4,
    },
    pharmacyAddress: {
        fontSize: 14,
        fontFamily: Typography.regular,
        color: '#166534',
        marginBottom: 8,
    },
    pharmacyMeta: {
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
    pharmacyActions: {
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
