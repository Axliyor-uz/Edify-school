// Single source of truth for ALL privacy policies (docs/APP_DISTRIBUTION.md).
// To publish a policy for a new app: add one entry to POLICIES — the page
// appears automatically at /privacy/<slug>. Update `lastUpdated` whenever the
// text changes; Play Store just needs the stable URL.

export interface PolicySection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface Policy {
  slug: string;
  appName: string;
  packageId: string;
  audience: string;
  lastUpdated: string; // YYYY-MM-DD
  intro: string;
  sections: PolicySection[];
}

const CONTACT_SECTION: PolicySection = {
  title: 'Contact Us',
  paragraphs: [
    'If you have questions about this Privacy Policy or want to exercise any of your rights, contact us:',
  ],
  bullets: [
    'Email: ilonmask0339@gmail.com',
    'Phone: +998338602006',
    'Website: https://edify.uz',
  ],
};

export const POLICIES: Record<string, Policy> = {
  manager: {
    slug: 'manager',
    appName: 'Edify Manager',
    packageId: 'uz.wasp2ai.edifymanager',
    audience: 'managers of learning centers',
    lastUpdated: '2026-07-23',
    intro:
      'This Privacy Policy describes how the Edify Manager Android application ' +
      '("the App") collects, uses and protects information. The App is a tool for ' +
      'managers of learning centers registered on the Edify platform (edify.uz), ' +
      'operated by Wasp2AI ("we", "us").',
    sections: [
      {
        title: 'Information We Collect',
        paragraphs: ['When you use the App, the following information is processed:'],
        bullets: [
          'Account information: your name, email address, username, phone number, profile photo and role on the Edify platform.',
          'Learning center data: center name, groups, rooms, schedules and settings.',
          'Records about students and teachers that managers enter into the system: names, contact details, group membership, attendance records, and payment/charge records.',
          'Sign-in data processed by Firebase Authentication (email/password, username, or Google Sign-In).',
          'Basic technical data needed for the App to work, such as the installed app version (used for the update check).',
        ],
      },
      {
        title: 'How We Use Information',
        paragraphs: [
          'The information is used only to operate the Edify platform: authentication, managing groups and schedules, recording attendance, managing payments and payroll, and providing support.',
          'We do not show advertising, do not build advertising profiles, and do not sell personal data.',
        ],
      },
      {
        title: 'Where Data Is Stored and How It Is Protected',
        paragraphs: [
          'Data is stored in Google Firebase services (Firestore, Cloud Storage, Authentication). All communication between the App and our servers is encrypted in transit (HTTPS/TLS).',
          'Access is restricted by server-side security rules: a manager can only access data belonging to their own learning center.',
        ],
      },
      {
        title: 'Third-Party Services',
        paragraphs: ['The App relies on the following service providers:'],
        bullets: [
          'Google Firebase (authentication, database, file storage) — https://firebase.google.com/support/privacy',
          'Google Sign-In (optional sign-in method) — https://policies.google.com/privacy',
        ],
      },
      {
        title: 'Data Sharing',
        paragraphs: [
          'We do not sell or share personal data with third parties for marketing. Data is shared only with the service providers listed above, to the extent required to operate the platform, or when disclosure is required by law.',
        ],
      },
      {
        title: 'Data Retention and Deletion',
        paragraphs: [
          'Data is retained while the related Edify account or learning center remains active.',
          'You can request deletion of your account and associated personal data from your account settings in the Edify web application at edify.uz, or by contacting us using the details below. Full instructions: https://edify.uz/delete-account. Some records may be retained where required by law.',
        ],
      },
      {
        title: 'Children',
        paragraphs: [
          'The App is intended for adults (18+) who manage learning centers. It is not directed at children. Records about students are entered and controlled by their learning center.',
        ],
      },
      {
        title: 'Changes to This Policy',
        paragraphs: [
          'We may update this Privacy Policy from time to time. The date of the latest revision is shown at the top of this page. Significant changes will be announced on the Edify platform.',
        ],
      },
      CONTACT_SECTION,
    ],
  },
};
