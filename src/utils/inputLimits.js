/**
 * Central place for the maximum length of every free-text field in the app.
 * Use it as:  <input maxLength={INPUT_LIMITS.NAME} ... />
 *
 * Keep these in sync with the @Size(max = ...) rules in the Spring Boot request DTOs.
 * Limits are counted in characters.
 */
export const INPUT_LIMITS = {
  NAME: 50,            // first name, last name, candidate name
  USERNAME: 50,        // login username (backend: 3-50)
  EMAIL: 100,          // email address / "email or username" on login screens
  PHONE: 10,           // 10-digit Indian mobile number
  PASSWORD: 20,        // new / changed passwords (backend: 8-20)
  LOGIN_PASSWORD: 100, // existing password typed on login (backend allows up to 100)
  SEARCH: 100,         // every search box
  TITLE: 120,          // titles / headings (events, celebrations, magazine)
  SHORT_TEXT: 100,     // department, position, bank, remarks, type, etc.
  EXPERIENCE: 30,      // e.g. "2 years"
  URL: 500,
  REASON: 500,         // reasons (leave, regularization, rejection)
  HOLIDAY_NAME: 100,   // backend: 100
  HOLIDAY_NOTE: 300,   // backend: 300
  FEEDBACK: 2000,      // performance - overall feedback
  REVIEW_NOTES: 1000,  // performance - strengths / improvements / goals
};