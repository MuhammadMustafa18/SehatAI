import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDB = async () => {
    if (db) {
        return db;
    }
    db = await SQLite.openDatabaseAsync('medicines.db');
    return db;
};

export const initDB = async () => {
    const database = await getDB();
    await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      dosage TEXT,
      frequency INTEGER,
      times TEXT,
      external_links TEXT,
      created_at INTEGER
    );
    `);
    // Migration: Safely add external_links if missing
    try {
        const result = await database.getAllAsync('PRAGMA table_info(medicines)');
        const hasExternalLinks = result.some((col: any) => col.name === 'external_links');

        if (!hasExternalLinks) {
            await database.execAsync('ALTER TABLE medicines ADD COLUMN external_links TEXT;');
        }
    } catch (e) {
        console.log('Migration error (harmless if column exists):', e);
    }

    await database.execAsync(`
    CREATE TABLE IF NOT EXISTS dose_history(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_id INTEGER,
        taken_at INTEGER,
        time_slot TEXT,
        FOREIGN KEY(medicine_id) REFERENCES medicines(id)
    );
    `);

    await database.execAsync(`
    CREATE TABLE IF NOT EXISTS contacts(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        relation TEXT,
        is_emergency INTEGER DEFAULT 1
    );
    `);

    // Migration: Safely add email to contacts if missing
    try {
        const result = await database.getAllAsync('PRAGMA table_info(contacts)');
        const hasEmail = result.some((col: any) => col.name === 'email');

        if (!hasEmail) {
            await database.execAsync('ALTER TABLE contacts ADD COLUMN email TEXT;');
        }
    } catch (e) {
        console.log('Migration error (harmless if column exists):', e);
    }
};

export interface MedicineRecord {
    id: number;
    name: string;
    dosage: string;
    frequency: number;
    times: string[]; // Stored as JSON string in DB
    external_links?: string[]; // Stored as JSON string in DB
}

export interface ContactRecord {
    id: number;
    name: string;
    phone: string;
    email?: string;
    relation?: string;
    is_emergency: boolean;
}

export const addMedicine = async (name: string, dosage: string, frequency: number, times: string[], externalLinks: string[] = []) => {
    const database = await getDB();
    const timesJson = JSON.stringify(times);
    const linksJson = JSON.stringify(externalLinks);
    const result = await database.runAsync(
        'INSERT INTO medicines (name, dosage, frequency, times, external_links, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        name, dosage, frequency, timesJson, linksJson, Date.now()
    );
    return result.lastInsertRowId;
};

export const getMedicines = async (): Promise<MedicineRecord[]> => {
    const database = await getDB();
    const rows = await database.getAllAsync<any>('SELECT * FROM medicines ORDER BY created_at DESC');

    return rows.map(row => ({
        ...row,
        times: JSON.parse(row.times),
        external_links: row.external_links ? JSON.parse(row.external_links) : []
    }));
};

export const updateMedicine = async (id: number, frequency: number, times: string[]) => {
    const database = await getDB();
    const timesJson = JSON.stringify(times);
    await database.runAsync(
        'UPDATE medicines SET frequency = ?, times = ? WHERE id = ?',
        frequency, timesJson, id
    );
};

export const deleteMedicine = async (id: number) => {
    const database = await getDB();
    await database.runAsync('DELETE FROM medicines WHERE id = ?', id);
    await database.runAsync('DELETE FROM dose_history WHERE medicine_id = ?', id);
};

// --- Contacts ---

export const addContact = async (name: string, phone: string, email: string, relation: string) => {
    const database = await getDB();
    await database.runAsync(
        'INSERT INTO contacts (name, phone, email, relation, is_emergency) VALUES (?, ?, ?, ?, 1)',
        name, phone, email, relation
    );
};

export const getContacts = async (): Promise<ContactRecord[]> => {
    const database = await getDB();
    const rows = await database.getAllAsync<any>('SELECT * FROM contacts');
    return rows.map(row => ({
        ...row,
        is_emergency: !!row.is_emergency
    }));
};

export const deleteContact = async (id: number) => {
    const database = await getDB();
    await database.runAsync('DELETE FROM contacts WHERE id = ?', id);
};

// --- Dose History ---

export const logDose = async (medicineId: number, timeSlot: string) => {
    const database = await getDB();
    await database.runAsync(
        'INSERT INTO dose_history (medicine_id, taken_at, time_slot) VALUES (?, ?, ?)',
        medicineId, Date.now(), timeSlot
    );
};

export const getDoseHistory = async (medicineId: number): Promise<string[]> => {
    const database = await getDB();
    // Get doses taken TODAY
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const rows = await database.getAllAsync<{ time_slot: string }>(
        'SELECT time_slot FROM dose_history WHERE medicine_id = ? AND taken_at >= ?',
        medicineId, startOfDay.getTime()
    );
    return rows.map(r => r.time_slot);
};
