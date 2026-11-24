// Expo Router calls this for every link that opens the app (wandr://…, or exp://… in Expo Go)
// before turning it into a screen. Returning null means "ignore this link, stay where you are".
//
// Google sign-in ends with the browser opening wandr://sso-callback?…. That link is meant for
// Clerk's sign-in code (useSSO reads it itself); there is no screen for it, so without this the
// router would show "Unmatched route" while the sign-in finishes.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  if (path.includes('sso-callback')) return null;
  return path;
}
