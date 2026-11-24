// Text length limits, shared by the backend (which enforces them) and the app (which stops the
// user typing past them). Plain constants with no imports, so the app can bundle this file
// without pulling in any server code.

export const TRIP_NAME_MAX_LENGTH = 60;
export const TRIP_NOTES_MAX_LENGTH = 2000;
