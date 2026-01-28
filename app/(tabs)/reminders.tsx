
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { deleteMedicine, getDoseHistory, getMedicines, logDose, MedicineRecord, updateMedicine } from '@/services/database';
import { cancelMedicineNotifications, scheduleDoseWithNags } from '@/services/notifications';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RemindersScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const colors = Colors[colorScheme];

    const [medicines, setMedicines] = useState<MedicineRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Edit State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingMed, setEditingMed] = useState<MedicineRecord | null>(null);
    const [editFreq, setEditFreq] = useState(2);
    const [editTimes, setEditTimes] = useState<string[]>([]);

    // Time Picker State
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [activeTimeIndex, setActiveTimeIndex] = useState(0);

    // Active Meds (Map of ID -> Boolean if action needed)
    const [actionableMeds, setActionableMeds] = useState<Set<number>>(new Set());

    // Expanded Links (Track which medicine cards have links section open)
    const [expandedLinks, setExpandedLinks] = useState<Set<number>>(new Set());

    const toggleLinks = (id: number) => {
        setExpandedLinks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const loadMedicines = async () => {
        try {
            const data = await getMedicines();
            setMedicines(data);
            checkActionableStatus(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const checkActionableStatus = async (medList: MedicineRecord[]) => {
        const now = new Date();
        const activeSet = new Set<number>();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTimeVal = currentHours * 60 + currentMinutes;

        for (const med of medList) {
            const history = await getDoseHistory(med.id);
            for (const timeStr of med.times) {
                const [h, m] = timeStr.split(':').map(Number);
                const scheduledVal = h * 60 + m;
                if (currentTimeVal >= scheduledVal && currentTimeVal <= scheduledVal + 60) {
                    if (!history.includes(timeStr)) {
                        activeSet.add(med.id);
                    }
                }
            }
        }
        setActionableMeds(activeSet);
    };

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            loadMedicines();
            const interval = setInterval(() => {
                if (medicines.length > 0) checkActionableStatus(medicines);
            }, 10000);
            return () => clearInterval(interval);
        }, [medicines.length])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadMedicines();
    };

    const handleDelete = (id: number, name: string) => {
        Alert.alert(
            "Delete Reminder",
            `Are you sure you want to delete the reminder for ${name}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await cancelMedicineNotifications(id);
                            await deleteMedicine(id);
                            loadMedicines();
                        } catch (e) {
                            Alert.alert("Error", "Failed to delete reminder");
                        }
                    }
                }
            ]
        );
    };

    const handleMarkAsTaken = async (id: number, name: string) => {
        try {
            const med = medicines.find(m => m.id === id);
            if (med) {
                const now = new Date();
                const currentHours = now.getHours();
                const currentMinutes = now.getMinutes();
                const currentTimeVal = currentHours * 60 + currentMinutes;

                const slot = med.times.find((t: string) => {
                    const [h, m] = t.split(':').map(Number);
                    const sVal = h * 60 + m;
                    return currentTimeVal >= sVal && currentTimeVal <= sVal + 60;
                });

                if (slot) {
                    await logDose(id, slot);
                }
            }

            await cancelMedicineNotifications(id);
            Alert.alert("Confirmed", `Great job taking your ${name}!`);
            checkActionableStatus(medicines);
        } catch (e) {
            console.error(e);
        }
    };

    // --- Edit Logic ---
    const openEditModal = (med: MedicineRecord) => {
        setEditingMed(med);
        setEditFreq(med.frequency);
        setEditTimes([...med.times]);
        setShowEditModal(true);
    };

    const updateEditFrequency = (freq: number) => {
        setEditFreq(freq);
        let newTimes: string[] = [];
        if (freq === 1) newTimes = ['10:00'];
        if (freq === 2) newTimes = ['10:00', '20:00'];
        if (freq === 3) newTimes = ['08:00', '14:00', '20:00'];
        if (freq === 4) newTimes = ['08:00', '12:00', '16:00', '20:00'];
        if (freq > 4) newTimes = Array(freq).fill('12:00');
        setEditTimes(newTimes);
    };

    const updateEditTime = (index: number, text: string) => {
        const newTimes = [...editTimes];
        newTimes[index] = text;
        setEditTimes(newTimes);
    };

    const saveEdit = async () => {
        if (!editingMed) return;
        try {
            await cancelMedicineNotifications(editingMed.id);
            await updateMedicine(editingMed.id, editFreq, editTimes);

            for (const time of editTimes) {
                const [hour, minute] = time.split(':').map(Number);
                if (!isNaN(hour) && !isNaN(minute)) {
                    await scheduleDoseWithNags(
                        editingMed.id,
                        editingMed.name,
                        editingMed.dosage,
                        hour,
                        minute
                    );
                }
            }

            setShowEditModal(false);
            setEditingMed(null);
            loadMedicines();
            Alert.alert("Updated", "Reminder schedule updated successfully.");
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to update reminder.");
        }
    };

    const handleTimeChange = (event: any, selectedDate?: Date) => {
        setShowTimePicker(false);
        if (selectedDate) {
            const hour = selectedDate.getHours().toString().padStart(2, '0');
            const minute = selectedDate.getMinutes().toString().padStart(2, '0');
            updateEditTime(activeTimeIndex, `${hour}:${minute}`);
        }
    };

    const renderItem = ({ item }: { item: MedicineRecord }) => (
        <View style={[styles.card, { backgroundColor: colorScheme === 'light' ? '#fff' : '#fff', borderColor: '#eee' }]}>
            <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                    <View style={styles.iconBg}>
                        <IconSymbol name="pills.fill" size={20} color="#0a7ea4" />
                    </View>
                    <View>
                        <Text style={[styles.medName, { color: '#11181C' }]}>{item.name}</Text>
                        <Text style={[styles.medDosage, { color: '#666666' }]}>{item.dosage}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.deleteBtn}>
                    <IconSymbol name="trash.fill" size={20} color="#ea4335" />
                </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.scheduleInfo}>
                <Text style={[styles.freqText, { color: '#444444' }]}>
                    <IconSymbol name="clock.fill" size={12} color="#444444" /> {item.frequency}x Daily
                </Text>
                <View style={styles.timesList}>
                    {item.times.map((time: string, idx: number) => (
                        <View key={idx} style={[styles.timeBadge, { backgroundColor: '#E3F2FD' }]}>
                            <Text style={[styles.timeText, { color: '#0a7ea4' }]}>{time}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, styles.editBtn, { backgroundColor: '#f0f0f0' }]} onPress={() => openEditModal(item)}>
                    <Text style={[styles.editBtnText, { color: '#666666' }]}>Edit</Text>
                </TouchableOpacity>
                {actionableMeds.has(item.id) && (
                    <TouchableOpacity style={[styles.actionBtn, styles.takenBtn]} onPress={() => handleMarkAsTaken(item.id, item.name)}>
                        <IconSymbol name="checkmark.circle.fill" size={16} color="#fff" />
                        <Text style={styles.takenBtnText}>Mark Taken</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* External Links - Toggleable */}
            {item.external_links && item.external_links.length > 0 && (
                <View style={styles.linkContainer}>
                    <TouchableOpacity
                        style={styles.linkToggleHeader}
                        onPress={() => toggleLinks(item.id)}
                    >
                        <IconSymbol name="cart.fill" size={14} color="#0a7ea4" />
                        <Text style={[styles.linkSectionTitle, { color: '#11181C' }]}>
                            Buy Online ({item.external_links.length})
                        </Text>
                        <IconSymbol
                            name={expandedLinks.has(item.id) ? "chevron.up" : "chevron.down"}
                            size={14}
                            color="#0a7ea4"
                        />
                    </TouchableOpacity>
                    {expandedLinks.has(item.id) && (
                        <View style={styles.linksExpanded}>
                            {item.external_links.map((link: string, idx: number) => (
                                <TouchableOpacity key={idx} onPress={() => WebBrowser.openBrowserAsync(link)} style={styles.linkBtn}>
                                    <Text style={styles.linkText} numberOfLines={1}>{link}</Text>
                                    <IconSymbol name="chevron.right" size={12} color="#0a7ea4" />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: '#11181C' }]}>My Reminders</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#0a7ea4" />
                </View>
            ) : (
                <FlatList
                    data={medicines}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListFooterComponent={
                        medicines.length > 0 ? (
                            <TouchableOpacity
                                style={styles.pharmacyButton}
                                onPress={() => Linking.openURL('https://www.google.com/maps/search/pharmacies+near+me')}
                            >
                                <IconSymbol name="map.fill" size={20} color="#fff" />
                                <Text style={styles.pharmacyButtonText}>Find Pharmacies on Google Maps</Text>
                            </TouchableOpacity>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <IconSymbol name="bell.slash.fill" size={48} color="#ccc" />
                            <Text style={[styles.emptyText, { color: '#11181C' }]}>No active reminders</Text>
                            <Text style={styles.emptySubtext}>Scan a prescription to add one!</Text>
                        </View>
                    }
                />
            )}

            {/* Edit Modal */}
            <Modal
                transparent={true}
                visible={showEditModal}
                animationType="slide"
                onRequestClose={() => setShowEditModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: '#FFFFFF' }]}>
                        <Text style={[styles.modalTitle, { color: '#11181C' }]}>Edit Reminder</Text>
                        <Text style={[styles.modalSubtitle, { color: '#666666' }]}>
                            {editingMed?.name}
                        </Text>

                        <Text style={[styles.label, { color: '#11181C' }]}>Frequency</Text>
                        <View style={styles.freqRow}>
                            {[1, 2, 3, 4].map(num => (
                                <TouchableOpacity
                                    key={num}
                                    style={[
                                        styles.freqOption,
                                        editFreq === num && styles.freqOptionSelected
                                    ]}
                                    onPress={() => updateEditFrequency(num)}
                                >
                                    <Text style={[
                                        styles.freqOptionText,
                                        editFreq === num && styles.freqTextSelected
                                    ]}>{num}x</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[styles.label, { color: '#11181C' }]}>Timings</Text>
                        <View style={styles.timesContainer}>
                            {editTimes.map((time, idx) => (
                                <View key={idx} style={styles.timeInputRow}>
                                    <Text style={[styles.doseLabel, { color: '#11181C' }]}>Dose {idx + 1}</Text>
                                    <TouchableOpacity
                                        style={[styles.timeInputBtn, { borderBottomColor: '#cccccc' }]}
                                        onPress={() => {
                                            setActiveTimeIndex(idx);
                                            setShowTimePicker(true);
                                        }}
                                    >
                                        <Text style={[styles.timeInputText, { color: '#11181C' }]}>{time}</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>

                        {showTimePicker && (
                            <RNDateTimePicker
                                value={(() => {
                                    const [h, m] = editTimes[activeTimeIndex].split(':');
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
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
                                <Text style={styles.saveBtnText}>Update</Text>
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
    header: { paddingHorizontal: 20, marginBottom: 15 },
    title: { fontSize: 24, fontFamily: Typography.bold },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: 20, paddingBottom: 100 },

    card: { padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(10, 126, 164, 0.1)', justifyContent: 'center', alignItems: 'center' },
    medName: { fontSize: 16, fontFamily: Typography.bold },
    medDosage: { fontSize: 13, fontFamily: Typography.regular, opacity: 0.7 },
    deleteBtn: { padding: 8 },

    divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },

    scheduleInfo: { gap: 8 },
    freqText: { fontSize: 13, fontFamily: Typography.semiBold, opacity: 0.8 },
    timesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    timeBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    timeText: { fontSize: 12, fontFamily: Typography.semiBold, color: '#0a7ea4' },

    emptyContainer: { alignItems: 'center', marginTop: 100, gap: 10 },
    emptyText: { fontSize: 18, fontFamily: Typography.semiBold, marginTop: 10 },
    emptySubtext: { color: '#888', fontFamily: Typography.regular },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', borderRadius: 20, padding: 24, elevation: 5 },
    modalTitle: { fontSize: 20, fontFamily: Typography.bold, marginBottom: 5 },
    modalSubtitle: { fontSize: 14, fontFamily: Typography.regular, opacity: 0.7, marginBottom: 20 },
    label: { fontSize: 16, fontFamily: Typography.semiBold, marginTop: 15, marginBottom: 10 },

    freqRow: { flexDirection: 'row', gap: 10 },
    freqOption: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
    freqOptionSelected: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
    freqOptionText: { fontFamily: Typography.semiBold, color: '#333' },
    freqTextSelected: { color: '#fff' },

    timesContainer: { gap: 10 },
    timeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    doseLabel: { width: 60, fontFamily: Typography.regular },
    timeInputBtn: { flex: 1, padding: 8, borderBottomWidth: 1 },
    timeInputText: { fontSize: 16, fontFamily: Typography.regular },

    // Action Buttons
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
    actionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 10, borderRadius: 8, gap: 6 },
    editBtn: { backgroundColor: '#f0f0f0' },
    editBtnText: { fontFamily: Typography.semiBold, color: '#666' },
    takenBtn: { backgroundColor: '#34A853' },
    takenBtnText: { fontFamily: Typography.semiBold, color: '#fff' },

    linkContainer: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
    linkToggleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: 'rgba(10, 126, 164, 0.08)', borderRadius: 8 },
    linkSectionTitle: { fontSize: 13, fontFamily: Typography.semiBold, flex: 1 },
    linksExpanded: { marginTop: 8, gap: 6 },
    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(10, 126, 164, 0.05)', padding: 10, borderRadius: 8 },
    linkText: { color: '#0a7ea4', fontFamily: Typography.medium, fontSize: 12, flex: 1 },

    pharmacyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4285F4', padding: 16, borderRadius: 16, gap: 10, marginTop: 20, marginBottom: 20 },
    pharmacyButtonText: { color: '#fff', fontSize: 16, fontFamily: Typography.semiBold },

    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 30 },
    cancelBtn: { padding: 10 },
    cancelBtnText: { color: '#888', fontFamily: Typography.regular },
    saveBtn: { backgroundColor: '#0a7ea4', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
    saveBtnText: { color: '#fff', fontFamily: Typography.bold },
});
