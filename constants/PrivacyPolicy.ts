export const PRIVACY_POLICY_MD = `# Privacy Policy

Last updated: June 2026

WeDeen — Your Daily Muslim Companion ("App", "we", "our", or "us") respects your privacy and is
committed to protecting your personal information. This Privacy Policy explains how we collect,
use, store, and protect your data when you use the WeDeen application.

By using the App, you agree to the terms of this Privacy Policy.

---

## Information We Collect

### Account Information
When you create an account, we collect your name, email address, and a securely hashed password.
Passwords are never stored in plain text. Authentication is handled using secure JSON Web Tokens (JWT).

### Quran Memorization Data
To provide personalized memorization tracking, we store the following data linked to your account:
- Surah and Ayah numbers marked as memorized
- Memorization progress and completion percentages
- Review dates and scheduling data (last reviewed, next review)
- Streaks (current and longest)

### Locally Stored Data
Certain data is stored directly on your device to enable offline functionality, including:
- Full Quran text (downloaded on first launch from AlQuran.cloud)
- Downloaded audio files for selected Surahs and reciters
- Cached daily content (Hijri date, Hadith of the Day, Duas & Azkar, Islamic reminders)

This data is stored using AsyncStorage and Expo FileSystem on your device and is not transmitted
to our servers.

### Usage Data
We may collect basic technical information to maintain app reliability, such as error logs and
performance metrics. This data does not personally identify you.

---

## How We Use Your Information

We use your information only to:
- Create and manage your account
- Track and sync your Quran memorization progress
- Provide offline access to Quran text and audio
- Display personalized stats (streaks, completion rates, memorized Ayahs)
- Cache daily Islamic content for a smooth experience
- Improve app reliability, performance, and stability

We do not sell, rent, or share your personal data with advertisers or third parties for
marketing purposes.

---

## Third-Party APIs and Services

WeDeen integrates with the following third-party services to deliver content:

- **AlQuran.cloud API** — Used to fetch the full Quran text and audio recitations. Data is
  downloaded to your device and used offline. No personal data is shared with this service.
- **UmmahAPI** — Used to fetch the Hijri calendar date, Hadith of the Day, Daily Islamic
  Reminders, and Duas & Azkar categories. No personal data is shared with this service.
- **Cloud Hosting Providers** — Our backend infrastructure may be hosted on third-party cloud
  platforms. These providers operate under their own privacy and security policies.

These services are used solely to deliver app features and are not provided with your account
credentials or personal identifiers.

---

## Data Storage and Security

We apply industry-standard security practices to protect your data, including:

- Passwords hashed using bcrypt (never stored in plain text)
- Secure JWT-based authentication tokens
- HTTPS-encrypted data transmission
- Security headers enforced via Helmet.js
- Rate limiting to protect against abuse
- MongoDB indexes and access-controlled database environments
- Environment variables used for all sensitive configuration

While we take reasonable precautions to protect your data, no system can guarantee absolute
security. We encourage you to use a strong, unique password for your account.

---

## Offline Data and Local Storage

WeDeen is designed to function offline after initial setup. The following data is stored
locally on your device:

- Full Quran text (Arabic + translation)
- Downloaded Surah audio files
- Cached daily content (refreshed once per day when online)
- Memorization progress (synced to the server when an internet connection is available)

You may manage or clear locally stored data through your device settings at any time.

---

## Data Retention and Deletion

Your account data is retained for as long as your account remains active. If you choose to
delete your account, all associated personal data — including memorization records and account
information — will be permanently removed from our systems within a reasonable timeframe.

Locally stored data on your device (Quran files, audio downloads, cache) can be removed by
uninstalling the App or clearing app data through your device settings.

---

## Children's Privacy

WeDeen is designed for users of **all ages**. Children are warmly welcomed to use the App to
read and listen to the Holy Quran, explore daily Islamic reminders, and benefit from its
educational content.

**We do not require children to create an account.** Core features such as reading and
listening to the Quran are fully accessible without registration. Account creation is only
needed for optional features such as memorization tracking and progress syncing.

We do not knowingly collect personal information from children without parental awareness.
If you are a parent or guardian and have concerns about your child's use of the App or the
data associated with their account, please contact us and we will promptly address your request.

We encourage parents and guardians to guide their children in using the App and to reach out
to us with any privacy-related questions.

---

## Your Rights

Depending on your location, you may have the right to:
- Access the personal data we hold about you
- Request correction of inaccurate data
- Request deletion of your account and associated data
- Withdraw consent at any time

To exercise any of these rights, please contact us using the information provided below.

---

## Changes to This Policy

We may update this Privacy Policy from time to time to reflect changes in the App or applicable
laws. Updates will be indicated by the "Last updated" date at the top of this document.
Continued use of the App after any changes constitutes acceptance of the updated policy.

We encourage you to review this Privacy Policy periodically.

---

## Contact Us

If you have any questions, concerns, or requests regarding this Privacy Policy or your data,
please contact us at:

**Email:** workwithhussnainahmad@gmail.com

---

*WeDeen — Your Daily Muslim Companion*
`;
