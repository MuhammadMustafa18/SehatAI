import { StyleSheet, Text, View } from 'react-native';

export default function AppointmentsScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Your Appointments</Text>
            <View style={styles.separator} />
            <Text style={styles.placeholder}>No upcoming appointments.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    separator: {
        marginVertical: 30,
        height: 1,
        width: '80%',
        backgroundColor: '#eee',
    },
    placeholder: {
        fontSize: 16,
        color: '#666',
    },
});
