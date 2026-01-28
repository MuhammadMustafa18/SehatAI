# Sehat AI

Sehat AI is a healthcare companion app that uses AI to make medical information and personal health management more accessible. It combines computer vision and voice technology to help users understand prescriptions, assess symptoms, and manage their daily medication.

## Key Features

### Prescription Scanner & Medicine Finder
Quickly understand what your doctor prescribed without the confusion.
- **Scan Prescriptions**: Uses AI to read handwritten prescriptions and extract medicine names and dosages.
- **Find Medicines**: Checks for medicine availability at nearby pharmacies.
- **Digital Records**: Automatically converts physical prescriptions into a digital schedule.

### Symptom Analysis
A voice-first interface to help you decide what to do when you're feeling unwell.
- **Voice Description**: Simply describe your symptoms out loud.
- **Severity Assessment**: The app analyzes your symptoms to determine if they are low, medium, or high risk.
- **Immediate Advice**: Provides clear, practical recommendations on next steps.

### Medication Reminders
A reliable system to ensure you never miss a dose.
- **Smart Scheduling**: Automatically sets up reminders based on common dosage patterns (e.g., "twice a day").
- **Follow-up Alerts**: Sends repeated notifications if you forget to log a dose.
- **History**: Keeps track of your medication history for easy reference.

### Emergency SOS
A quick way to get help when it matters most.
- **One-Tap Alert**: Activates a countdown to prevent accidental triggers.
- **Location Sharing**: Sends your current GPS location to emergency contacts via SMS and Email.
- **Audio Recording**: Captures audio during the event to provide context to responders.

## Technology Stack

- **Frontend**: React Native with Expo
- **AI Models**: Groq API (Llama for text/vision, Whisper for voice)
- **Location**: Serper API (Google Places)
- **Storage**: SQLite for offline data
- **Notifications**: Expo Notifications

## Project Structure

```
SehatAI/
├── app/                  # Main application screens and navigation
├── components/           # Reusable UI components
├── services/             # API integrations and backend logic
│   ├── groq.ts           # AI handling
│   ├── database.ts       # Local storage
│   └── notifications.ts  # Reminder logic
└── assets/               # Images and fonts
```

## Getting Started

### Prerequisites
- Node.js
- Expo Go app on your phone

### Setup
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file with your API keys:
   ```bash
   EXPO_PUBLIC_GROQ_API_KEY=your_key
   EXPO_PUBLIC_SERPER_API_KEY=your_key
   ```
3. Run the app:
   ```bash
   npx expo start
   ```

---

*Disclaimer: Sehat AI provides information and assistance but is not a substitute for professional medical advice.*