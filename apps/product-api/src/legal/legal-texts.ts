// Single source of the public legal texts. Served as HTML by routes/legal-routes.ts.
// Format: a small markdown subset (#, ##, ### headings, "- " bullets, paragraphs, **bold**).
// Square-bracket placeholders such as [COMPANY LEGAL NAME] must be filled in by the owner.
// Lines starting with "[VERIFY:" are notes for the owner/counsel and must be removed before publication.

export const LEGAL_DRAFT_BANNER = "DRAFT - requires legal review before publication";

export interface LegalDocument {
  slug: "privacy" | "terms";
  title: string;
  markdown: string;
}

const privacyMarkdown = `
# Thesis Privacy Policy

**${LEGAL_DRAFT_BANNER}**

Effective date: [EFFECTIVE DATE]. Last updated: [LAST UPDATED DATE].

This Privacy Policy explains how [COMPANY LEGAL NAME] ("we", "us") collects, uses and shares personal data when you use the Thesis mobile app and the Thesis service (together, the "Service").

Part A applies to all users. Part B adds rules for users in the United States. Part C adds rules for users in the European Economic Area (EEA), the United Kingdom (UK) and Switzerland.

# Part A - All users

## 1. Who we are

The Service is operated by [COMPANY LEGAL NAME], [COMPANY REGISTERED ADDRESS]. Contact for privacy questions: [PRIVACY CONTACT EMAIL].

## 2. Data we collect

### 2.1 Account data (you give it to us)

- Email address.
- Password. We store only a one-way hash of your password (bcrypt). We cannot read your password.
- Email verification status and account creation date.
- If you sign in with Google: your Google account identifier and the email address on that Google account. We do not receive your Google password.
- Session records (when you signed in, when a session expires or is revoked).

### 2.2 Research content (you create it in the app)

- Watchlist tickers.
- Holdings you choose to enter: ticker, and optionally quantity, cost basis, a label and notes.
- Notes you write on reports.
- Alert rules and "kill switch" rules you set (ticker, condition, anchor price).
- Notification preferences.
- Your research state (the set of names you follow and related settings).
- Feedback you send us about a report or your subscription, including any text you type.
- The Deep Dive reports you request, and a daily count of how many you requested (used for plan limits).

### 2.3 Subscription data

- Your plan (Free or Pro), the end of your current billing period, and a subscription identifier from our billing provider (RevenueCat).
- Payments are processed by Google Play. We do not receive or store your card number or other payment details.

### 2.4 Device and notification data

- A random installation identifier created by the app.
- A push notification token from Google Firebase Cloud Messaging, the device platform (Android) and when the device was last seen.

### 2.5 Usage and technical data

- Product analytics events, if analytics is enabled in the build: for example "app opened", actions such as starting a Deep Dive or changing a setting, and API error codes and messages. These events are linked to your installation identifier or, when you are signed in, to your account identifier. We do not send your email address to our analytics provider.
- Your IP address. We use it for rate limiting and to protect sign-in against abuse. [VERIFY: confirm IP addresses are not written to persistent logs; if they are, state the log retention period.]
- Server logs and an audit log of account and research actions (for example sign-in, report requested, settings changed), with timestamps and request identifiers.
- Error reports from our servers, if error monitoring is enabled. These can contain request, job and user identifiers.

### 2.6 Data stored on your device

- Sign-in tokens are kept in encrypted storage on your device.
- The app keeps an offline copy of some reports so you can read them without a connection.
- [VERIFY: the Android app currently allows Android backup (allowBackup=true). Decide if app data may be included in the user's device backup, and update this section.]

### 2.7 Data we do not collect

- We do not ask for your name, phone number, postal address, government ID, or brokerage account access.
- We do not use your device location, camera, microphone or contacts.
- Biometric unlock (fingerprint or face) is handled by Android. We never receive your biometric data.

## 3. How we use your data

- To create and secure your account, and to sign you in.
- To provide the Service: generate research reports, Market Pulse briefs, alerts, digests and notifications for the names you follow.
- To manage your subscription and enforce plan limits.
- To send service email, such as account verification, password reset and the weekly digest (if you turn it on).
- To send push notifications you have enabled.
- To understand how the app is used, find errors and improve the Service.
- To prevent abuse, fraud and security incidents, and to meet legal obligations.

We do not sell your personal data. We do not use your personal data for third-party advertising.

## 4. AI processing

Thesis uses large language model (LLM) providers to write parts of research reports and Market Pulse commentary. Prompts are built mainly from public market data, company filings, news and the ticker symbols you request or follow. We design prompts to exclude your email address and sign-in credentials.

- [VERIFY: confirm that holdings quantities, cost basis, holding notes, report notes and feedback text are never included in LLM prompts. If any of them are, list them here.]
- We do not use your data to train our own AI models. [VERIFY: confirm the contract terms of each active LLM provider on training and retention of API data.]
- Report signals (for example "Positive 7/10") are produced automatically. They do not have legal or similarly significant effects on you, and they are not decisions about you.

## 5. Who we share data with

We share personal data only with service providers that process it for us, under contract, and only as needed for the purposes in Section 3.

- Hosting and databases: [HOSTING PROVIDER] ([HOSTING REGION]). File storage for reports: [OBJECT STORAGE PROVIDER].
- Email delivery: Resend.
- Product analytics: PostHog ([POSTHOG REGION, e.g. US or EU cloud]), if enabled.
- Server error monitoring: Sentry, if enabled.
- Push notifications: Google Firebase Cloud Messaging.
- Sign in with Google: Google.
- Subscriptions: RevenueCat and Google Play.
- LLM providers that generate report text, depending on configuration: Anthropic, OpenAI and/or OpenRouter (OpenRouter routes requests to third-party model providers). [VERIFY: list only the providers enabled in production.]
- LLM tracing, if enabled: LangSmith (receives prompts and model outputs for debugging).
- Web research tools used while building reports, if enabled: Tavily, Exa and Perplexity. They receive search queries about companies and markets, not your account data.

We may also disclose data if the law requires it, to protect rights and safety, or as part of a merger, acquisition or sale of assets (we will tell you before your data becomes subject to a different privacy policy).

Market data and filing providers (for example SEC EDGAR, FRED and other financial data vendors) receive requests about public companies and markets only. They do not receive your personal data.

## 6. How long we keep data

- Account data and research content: while your account is open. When you delete your account, we delete it as described in Section 7.
- Audit and security logs: [AUDIT LOG RETENTION PERIOD].
- Server and error logs: [LOG RETENTION PERIOD].
- Analytics events: [ANALYTICS RETENTION PERIOD] (set in PostHog).
- Database backups: up to [BACKUP RETENTION PERIOD] after deletion.
- Records we must keep for tax, accounting or legal reasons: for the period the law requires.

[VERIFY: the Service does not yet have automatic purge jobs for audit events or logs. Implement them or adjust the periods above.]

## 7. Deleting your account

You can delete your account in the app (You tab, "Delete account") or by emailing [PRIVACY CONTACT EMAIL] from the email address on your account. [VERIFY: confirm the in-app deletion feature has shipped.]

When you delete your account we delete your account data, sessions, devices, watchlist, holdings, notes, alert rules, preferences, research state, feedback and subscription record. Some records are kept without a link to you: audit log entries and job records lose your user identifier, and research reports about public companies may be kept because they contain no personal data. Deleting your account does not cancel a Google Play subscription. Cancel it in Google Play.

## 8. Security

We use encryption in transit (HTTPS), hashed passwords, short-lived access tokens, rate limiting and account lockout after repeated failed sign-ins. No system is fully secure. If a breach affects your personal data, we will notify you and the authorities as the law requires.

## 9. Children

The Service is not for anyone under [MINIMUM AGE, e.g. 18]. We do not knowingly collect data from children. If you think a child has given us data, contact [PRIVACY CONTACT EMAIL] and we will delete it.

## 10. International transfers

We and our service providers may process data in the United States and other countries. Where the law requires it, we use appropriate safeguards for these transfers (see Part C).

## 11. Changes

We will post changes on this page and update the date above. If a change is material, we will tell you in the app or by email before it takes effect.

## 12. Contact

[COMPANY LEGAL NAME], [COMPANY REGISTERED ADDRESS], [PRIVACY CONTACT EMAIL].

# Part B - Additional terms for United States users

## B1. California (CCPA/CPRA) and other US state privacy laws

[VERIFY: confirm whether the company meets the thresholds of the CCPA/CPRA or other state laws. If not, this section can be shortened.]

- Categories of personal information collected in the last 12 months: identifiers (email, account and installation identifiers, IP address); commercial information (subscription plan); internet or electronic network activity (app usage events, logs); and other information you choose to give us (holdings, notes, feedback). Sources, purposes and recipients are described in Part A.
- We do not sell personal information and we do not "share" it for cross-context behavioral advertising, as those terms are defined in California law.
- We do not use or disclose sensitive personal information for purposes that would give a right to limit its use. Account sign-in credentials are used only to sign you in.
- Your rights: to know and access, to delete, to correct, and to not be discriminated against for using these rights. You can also use an authorized agent.
- To make a request, email [PRIVACY CONTACT EMAIL]. We will verify your request by confirming control of the account email address. If we deny a request, you can appeal by replying to our decision; [STATE APPEAL PROCESS DETAILS IF REQUIRED].

## B2. Do Not Track

The app does not respond to browser Do Not Track signals, because it is not a web browser. We do not track you across third-party apps or websites.

# Part C - Additional terms for EEA, UK and Swiss users (GDPR)

## C1. Controller and representative

The controller of your personal data is [COMPANY LEGAL NAME], [COMPANY REGISTERED ADDRESS]. [EU REPRESENTATIVE NAME AND ADDRESS, if the company has no establishment in the EU (GDPR Art. 27).] [UK REPRESENTATIVE, if required.] [DATA PROTECTION OFFICER CONTACT, if one is appointed.]

## C2. Legal bases

- Performance of a contract (Art. 6(1)(b)): account data, research content, subscription data, push tokens and service email, to provide the Service you asked for.
- Legitimate interests (Art. 6(1)(f)): security, abuse prevention, error monitoring, audit logs and service improvement. Our interest is to run a safe and reliable service. You can object (see C3).
- Consent (Art. 6(1)(a)): product analytics and optional notifications or email digests, where consent is required. You can withdraw consent at any time in the app settings, without affecting earlier processing. [VERIFY: the app currently sends analytics without an opt-in. Counsel to confirm whether consent is required (ePrivacy / device access rules) and add an in-app toggle if so.]
- Legal obligation (Art. 6(1)(c)): records we must keep by law.

## C3. Your rights

You have the right to access, correct, delete, restrict and port your personal data, and to object to processing based on legitimate interests. Where processing is based on consent, you can withdraw it at any time. To use these rights, email [PRIVACY CONTACT EMAIL]. We will answer within one month (this can be extended by two months for complex requests).

You also have the right to complain to a data protection supervisory authority, in particular in the country where you live or work. [LEAD SUPERVISORY AUTHORITY, if applicable.]

## C4. International transfers

Some of our service providers are in the United States or other countries outside the EEA/UK. For these transfers we rely on adequacy decisions (including the EU-US Data Privacy Framework where the provider is certified), or on the European Commission's Standard Contractual Clauses (and the UK Addendum), with additional safeguards where needed. You can ask for a copy of the safeguards at [PRIVACY CONTACT EMAIL].

## C5. Automated decision-making

We do not make decisions about you based solely on automated processing that produce legal or similarly significant effects. Report signals are automated research outputs about companies, not about you.

## C6. Providing data

You must give an email address and password (or use Google sign-in) to create an account. All other data is optional, but some features will not work without it.
`;

const termsMarkdown = `
# Thesis Terms of Service

**${LEGAL_DRAFT_BANNER}**

Effective date: [EFFECTIVE DATE]. Last updated: [LAST UPDATED DATE].

These Terms of Service ("Terms") are a contract between you and [COMPANY LEGAL NAME] ("we", "us") for the Thesis mobile app and service (the "Service"). By creating an account or using the Service, you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the Service.

Part A applies to all users. Part B adds rules for users in the United States. Part C adds rules for consumers in the European Economic Area (EEA), the United Kingdom (UK) and Switzerland. If Part B or Part C conflicts with Part A, Part B or Part C applies to the users it covers.

# Part A - All users

## 1. Eligibility

You must be at least [MINIMUM AGE, e.g. 18] years old and able to make a binding contract. The Service is available in [ELIGIBLE COUNTRIES]. You must not use the Service where it is not permitted by law.

## 2. The Service

Thesis is a research tool. It collects public market data, company filings, news and macroeconomic data, and uses software, including large language models, to produce research summaries, reports, briefs, alerts and automated signals about companies and markets.

## 3. Not financial advice

**Thesis is a research tool, not financial advice.** Read this section carefully.

- The Service gives general information only. Nothing in the Service is investment, financial, legal, tax or accounting advice, or an offer or solicitation to buy or sell any security or other financial instrument.
- **Signals, scores and labels are not recommendations.** Labels such as "Positive", "Neutral" or "Negative" and scores such as "7/10" are automated summaries of the evidence the software found about a company at one point in time. They are not a recommendation to buy, sell or hold any security, and they do not consider your financial situation, objectives, risk tolerance or needs.
- We are not a registered investment adviser, broker-dealer, financial planner or investment firm, and we do not act as your adviser or fiduciary. [VERIFY: counsel to confirm the status and wording for each launch market.]
- Content may be wrong, incomplete or out of date. Market data may be delayed. AI-generated text can contain errors, including statements that sound confident but are false. Always check important facts in the original sources.
- Past performance does not predict future results. All investments carry risk, including the loss of all money invested.
- You alone are responsible for your investment decisions and their results. Do your own research and, where appropriate, talk to a licensed professional before you make an investment decision.

## 4. Your account

- Give us accurate information and keep your email address up to date.
- Keep your password secret. You are responsible for activity on your account. Tell us at once at [CONTACT EMAIL] if you think your account has been used without your permission.
- One account is for one person. Do not share your account.

## 5. Subscriptions and payments

- Thesis has a free plan with limits (for example a daily number of Deep Dive reports) and a paid Pro plan.
- Pro subscriptions are bought and billed through Google Play. Google Play's terms apply to the payment. Prices are shown in the app before you buy.
- **Subscriptions renew automatically** at the end of each billing period until you cancel. You can cancel at any time in Google Play. Cancellation takes effect at the end of the current billing period. Deleting your Thesis account does not cancel your Google Play subscription.
- Refunds are handled under Google Play's refund policy, except where the law gives you other rights (see Part C).
- We may change prices. We will tell you in advance, and the new price applies from your next billing period. If you do not agree, cancel before then.
- Free trials, if offered, convert into a paid subscription at the end of the trial unless you cancel before it ends.

## 6. Acceptable use

You must not:

- copy, resell, redistribute or publish reports, data or other content from the Service for commercial purposes, or present it as your own research;
- scrape, crawl or access the Service with automated tools, or try to get around plan limits or rate limits;
- reverse engineer, decompile or try to extract the source code of the app, except where the law allows it;
- interfere with or disrupt the Service, or try to get unauthorized access to it or to other users' data;
- use the Service for market manipulation, insider trading or any other unlawful purpose;
- upload content that is unlawful or that you do not have the right to share.

## 7. Content and intellectual property

- We and our licensors own the Service and its content, including reports, software, design and trademarks. Some data comes from third-party providers and is subject to their terms.
- We give you a personal, non-exclusive, non-transferable, revocable license to use the Service and its content for your own non-commercial research, under these Terms.
- You keep ownership of the content you enter (for example notes, holdings and feedback). You give us a license to store and process it to provide and improve the Service, as described in the Privacy Policy.
- If you send us suggestions or feedback, we may use them without obligation to you.

## 8. Third-party services

The Service uses third-party services, such as Google Play, Google sign-in and data providers. Their terms and privacy policies apply to your use of them. We are not responsible for third-party services or content.

## 9. Changes to the Service and to these Terms

We may add, change or remove features. We may change these Terms. If a change is material, we will tell you in the app or by email at least [NOTICE PERIOD, e.g. 30] days before it takes effect. If you keep using the Service after that date, the new Terms apply. If you do not agree, stop using the Service and delete your account.

## 10. Suspension and termination

- You can stop using the Service and delete your account at any time in the app (You tab) or by emailing [CONTACT EMAIL].
- We may suspend or close your account if you break these Terms, if the law requires it, or to protect the Service or other users. Where reasonable, we will tell you first and explain why.
- Sections 3, 7, 11, 12 and 13 continue after termination.

## 11. Disclaimers

To the maximum extent permitted by law, the Service is provided "as is" and "as available", without warranties of any kind, express or implied, including warranties of accuracy, completeness, timeliness, merchantability, fitness for a particular purpose and non-infringement. We do not warrant that the Service will be uninterrupted or error-free.

## 12. Limitation of liability

To the maximum extent permitted by law:

- we are not liable for any investment loss or any trading decision you make based on the Service;
- we are not liable for indirect, incidental, special, consequential or punitive damages, or for loss of profits, revenue or data;
- our total liability for all claims about the Service is limited to the greater of the amount you paid us in the 12 months before the claim and [LIABILITY CAP AMOUNT, e.g. USD 100].

Nothing in these Terms limits liability that cannot be limited by law.

## 13. Governing law and disputes

These Terms are governed by the laws of [GOVERNING LAW], without regard to conflict-of-law rules. Disputes will be resolved [DISPUTE RESOLUTION: courts of [VENUE] or arbitration - counsel to decide], subject to Parts B and C.

## 14. General

These Terms and the Privacy Policy are the whole agreement between you and us about the Service. If a part of these Terms is not enforceable, the rest stays in effect. If we do not enforce a right, we do not give it up. You may not transfer your rights under these Terms without our consent. We may transfer them as part of a merger, acquisition or sale of assets.

## 15. Contact

[COMPANY LEGAL NAME], [COMPANY REGISTERED ADDRESS], [CONTACT EMAIL].

# Part B - Additional terms for United States users

- **Indemnity.** You agree to indemnify us against claims, losses and costs (including reasonable legal fees) that come from your breach of these Terms or your unlawful use of the Service.
- **Dispute resolution.** [ARBITRATION AGREEMENT AND CLASS ACTION WAIVER, if counsel recommends one, including the opt-out process and small-claims exception. Otherwise remove this item.]
- **Not an investment adviser.** We publish general, impersonal research that is not tailored to any user. [VERIFY: counsel to confirm reliance on the publisher exclusion under the US Investment Advisers Act of 1940 and any state requirements.]
- **Google Play.** Google is not a party to these Terms and is not responsible for the Service.

# Part C - Additional terms for EEA, UK and Swiss consumers

- **Your statutory rights.** If you are a consumer, nothing in these Terms limits the rights you have under the mandatory consumer protection law of the country where you live. The governing-law clause in Section 13 does not take away the protection of those laws, and you can bring claims in the courts of the country where you live.
- **Liability.** Section 12 does not limit our liability for death or personal injury caused by negligence, for fraud, for intentional misconduct or gross negligence, or for any other liability that cannot be limited under applicable law. [VERIFY: counsel to adapt the liability cap to the governing law.]
- **Digital content conformity.** You have the legal rights for digital content and digital services that do not conform to the contract. Sections 11 and 12 do not limit them.
- **Right of withdrawal.** You normally have 14 days to withdraw from a contract for a digital service. When you start a paid subscription, you ask us to start the service at once and you acknowledge that you lose your right of withdrawal once the service has been fully performed, or keep a right only to a proportionate refund for a service that has started, as the law provides. [VERIFY: counsel to confirm the withdrawal wording and the in-purchase consent step for Google Play purchases.]
- **Not investment advice.** The Service is not investment advice and not a personal recommendation under EU or UK financial services law. [VERIFY: counsel to confirm whether automated company signals are "investment recommendations" under the EU Market Abuse Regulation (MAR) and Delegated Regulation (EU) 2016/958, or "investment advice" under MiFID II, and what disclosures or authorisation would be needed.]
- **Changes to Terms.** For consumers, we will only make changes for valid reasons (for example a change in law, in our services, or for security), and you can end the contract before the change takes effect.
- **Complaints.** Contact [CONTACT EMAIL] first. [ALTERNATIVE DISPUTE RESOLUTION BODY, if required in the launch country.]
`;

export const LEGAL_DOCUMENTS: Record<LegalDocument["slug"], LegalDocument> = {
  privacy: { slug: "privacy", title: "Thesis Privacy Policy", markdown: privacyMarkdown },
  terms: { slug: "terms", title: "Thesis Terms of Service", markdown: termsMarkdown }
};
