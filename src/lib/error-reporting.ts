import type { ErrorUtils } from 'react-native';
import { Alert } from 'react-native';

// Where an error was caught, for the log line
type ErrorSource = 'screen' | 'global' | 'unhandled promise' | 'query' | 'action';

// The one place every unexpected error goes. For now it writes to the log (the Metro terminal in
// development, logcat in release builds). A crash-reporting service (e.g. Sentry) plugs in here
// later, and every source below reports to it without further changes.
export function reportError(error: unknown, source: ErrorSource, isFatal = false) {
  console.error(`[${source}${isFatal ? ', fatal' : ''}]`, error);
}

// React Native globals that the TypeScript types don't declare
type HermesInternal = {
  enablePromiseRejectionTracker?: (options: {
    allRejections: boolean;
    onUnhandled: (id: number, rejection: unknown) => void;
  }) => void;
};
const globals = globalThis as typeof globalThis & {
  ErrorUtils?: ErrorUtils;
  HermesInternal?: HermesInternal;
  // Set once the handler is installed: hot reload runs the installing module again
  __wanderlogErrorHandler?: true;
};

// Catches what React error boundaries can't: errors thrown outside rendering (in a button's
// onPress, a timer, a native callback) and promises that fail without anyone handling them.
// Error boundaries (src/components/screen-error-boundary.tsx) handle errors while rendering.
export function installGlobalErrorHandler() {
  if (globals.__wanderlogErrorHandler || !globals.ErrorUtils) return;
  globals.__wanderlogErrorHandler = true;

  const errorUtils = globals.ErrorUtils;
  const defaultHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    reportError(error, 'global', isFatal);
    // A non-fatal error in a release build would otherwise pass silently
    if (!__DEV__ && !isFatal) Alert.alert('Something went wrong', 'Please try again.');
    // Keep React Native's own behaviour: the red error screen in development, and in a release
    // build a fatal error still closes the app, because its state can't be trusted any more
    defaultHandler(error, isFatal);
  });

  // In development React Native already warns about these on screen. Release builds would drop
  // them silently, so log them there.
  if (!__DEV__) {
    globals.HermesInternal?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id, rejection) => reportError(rejection, 'unhandled promise'),
    });
  }
}
