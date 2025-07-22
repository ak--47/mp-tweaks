# Privacy Policy for MP Tweaks

**Effective Date:** July 22, 2025

## Overview

MP Tweaks is a Chrome extension designed for internal use by Mixpanel employees and customers to test features, manage feature flags, modify HTTP headers, and debug the Mixpanel web application. This privacy policy explains how we collect, use, and protect your data.

## Data Collection and Use

### What Data We Collect

MP Tweaks collects minimal data necessary for its core functionality:

1. **Usage Analytics**: Anonymous usage statistics sent to Mixpanel to understand feature adoption and improve the extension
2. **Local Configuration Data**: Extension settings, feature flags, and HTTP headers stored locally in Chrome's storage
3. **Authentication Information**: Mixpanel OAuth tokens to verify employee status and enable authenticated features

### How We Use Your Data

We use collected data solely to:
- Provide and improve the extension's core functionality
- Analyze feature usage to enhance user experience
- Authenticate Mixpanel employees for internal features
- Store user preferences and settings locally

### Data Storage and Security

- **Local Storage**: All user settings and preferences are stored locally in Chrome's secure storage API
- **Authentication**: OAuth tokens are handled securely and never exposed or logged
- **Analytics**: Only anonymous usage events are transmitted to Mixpanel's analytics platform
- **Encryption**: All data transmission uses modern cryptography (HTTPS/TLS)

## Data Sharing and Third Parties

We **do not**:
- Sell, rent, or trade your personal information
- Share data with advertising platforms or data brokers
- Use data for personalized advertisements
- Transfer data for credit-worthiness or lending purposes

We **only** share data:
- With Mixpanel's internal analytics platform for usage statistics
- When required by law or to protect against fraud and abuse
- In aggregated, anonymized form for internal operations

## Your Rights and Choices

- **Local Control**: All extension settings are stored locally and can be cleared at any time
- **Opt-out**: You can disable the extension or remove it entirely to stop all data collection
- **Data Access**: Contact privacy@mixpanel.com to request information about data we may have collected

## Single Purpose Statement

MP Tweaks is designed with a single purpose: to assist Mixpanel employees and customers in testing features, managing configurations, and debugging the Mixpanel web application. All data collection and processing is strictly limited to supporting this core functionality.

## Limited Use Compliance

The use of information received from Google APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program_policies/), including the Limited Use requirements.

We limit our use of user data to:
- Providing and improving our single purpose functionality
- Complying with applicable laws
- Protecting against malware, spam, phishing, and other fraud or abuse

## Contact Information

For privacy-related questions or concerns:
- Email: privacy@mixpanel.com
- Extension Issues: Report on GitHub at https://github.com/anthropics/claude-code/issues

## Updates to This Policy

We may update this privacy policy as needed to remain compliant with applicable laws and Chrome Web Store policies. Users will be notified of material changes through the extension's update mechanism.

## Permissions Usage

MP Tweaks requests only the minimum permissions necessary for its functionality:

- **tabs**: To interact with Mixpanel web pages and inject debugging tools
- **storage**: To save user preferences and settings locally
- **scripting**: To inject debugging scripts into web pages
- **declarativeNetRequest**: To modify HTTP headers for testing
- **cookies**: To access debugging information
- **<all_urls>**: To provide comprehensive debugging across Mixpanel domains

These permissions are used exclusively to support the extension's core debugging and testing functionality for Mixpanel's web application.