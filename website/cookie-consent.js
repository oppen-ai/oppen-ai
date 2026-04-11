// Öppen AI - consent-gated Google Analytics + vanilla-cookieconsent init

function loadGA() {
  if (window.__gaLoaded) return;
  window.__gaLoaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-RCS50JPQ53';
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', 'G-RCS50JPQ53', { anonymize_ip: true });
}

window.addEventListener('load', function () {
  if (typeof CookieConsent === 'undefined') return;

  CookieConsent.run({
    guiOptions: {
      consentModal: { layout: 'box inline', position: 'bottom center', equalWeightButtons: true },
      preferencesModal: { layout: 'box', equalWeightButtons: true },
    },
    categories: {
      necessary: { enabled: true, readOnly: true },
      analytics: {},
    },
    onConsent: function () {
      if (CookieConsent.acceptedCategory('analytics')) loadGA();
    },
    onChange: function () {
      if (CookieConsent.acceptedCategory('analytics')) loadGA();
    },
    onModalShow: function (data) {
      // Auto-expand every category in the preferences modal when it opens.
      if (data && data.modalName === 'preferencesModal') {
        setTimeout(() => {
          document
            .querySelectorAll('#cc-main .pm__section-title[aria-expanded="false"]')
            .forEach((btn) => btn.click());
        }, 50);
      }
    },
    language: {
      default: 'en',
      translations: {
        en: {
          consentModal: {
            title: 'Cookies Consent',
            description:
              'We use analytics cookies to measure how visitors interact with this website and to help us improve it. No personal data is collected. <a href="/privacy.html">Learn more</a>',
            acceptAllBtn: 'Accept',
            acceptNecessaryBtn: 'Reject',
            showPreferencesBtn: 'Options',
          },
          preferencesModal: {
            title: 'Manage cookie preferences',
            acceptAllBtn: 'Accept all',
            acceptNecessaryBtn: 'Reject all',
            savePreferencesBtn: 'Save preferences',
            closeIconLabel: 'Close',
            sections: [
              {
                title: 'Strictly necessary',
                description: 'Required for the site to function. Always enabled.',
                linkedCategory: 'necessary',
              },
              {
                title: 'Analytics',
                description:
                  'Google Analytics 4 - aggregate traffic measurement with IP anonymization. You can opt out at any time.',
                linkedCategory: 'analytics',
              },
            ],
          },
        },
      },
    },
  });
});
