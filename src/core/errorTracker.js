/**
 * Global Error Tracking Service
 * Wraps error capturing logic to standardize reporting across the application.
 * In a real production scenario, this hooks into Sentry, Datadog, or LogRocket.
 */
class ErrorTracker {
    constructor() {
        this.isInitialized = false;
        this.sessionData = {};
    }

    init(config = {}) {
        // e.g., Sentry.init({ dsn: '...', ...config })
        this.isInitialized = true;
        console.log('[ErrorTracker] Initialized with config:', config);
        
        // Listen to global unhandled promises
        window.addEventListener('unhandledrejection', (event) => {
            this.captureException(event.reason, { type: 'UnhandledRejection' });
        });

        // Listen to global runtime errors
        window.addEventListener('error', (event) => {
            this.captureException(event.error, {
                type: 'RuntimeError',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
    }

    setUser(user) {
        this.sessionData.user = user;
        // Sentry.setUser(user);
    }

    setTag(key, value) {
        this.sessionData[key] = value;
        // Sentry.setTag(key, value);
    }

    captureException(error, context = {}) {
        if (!this.isInitialized) {
            console.warn('[ErrorTracker] Not initialized, falling back to console:', error);
            return;
        }
        
        const payload = {
            error,
            context,
            sessionData: this.sessionData,
            timestamp: new Date().toISOString()
        };

        // Here we would send to the actual reporting service
        // Sentry.captureException(error, { extra: context });
        console.error('[ErrorTracker] Captured Exception =>', payload);
    }

    captureMessage(message, level = 'info') {
        if (!this.isInitialized) return;
        
        // Sentry.captureMessage(message, level);
        console.info(`[ErrorTracker] [${level.toUpperCase()}] ${message}`);
    }
}

export const errorTracker = new ErrorTracker();
