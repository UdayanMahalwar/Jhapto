// Message left by the API client when it logged the user out,
// e.g. "Your account has been banned" or "Session expired".
// Read it during render, clear it in an effect (render may run twice in StrictMode).
export const readAuthMessage = () => {
  try {
    return sessionStorage.getItem('authMessage') || '';
  } catch {
    return '';
  }
};

export const clearAuthMessage = () => {
  try {
    sessionStorage.removeItem('authMessage');
  } catch { /* storage unavailable */ }
};
