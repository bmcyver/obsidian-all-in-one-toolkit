/**
 * Shows an error message in the specified error element by setting its text
 * and removing the 'is-hidden' class.
 */
export function showError(errorEl: HTMLElement, message: string): void {
  errorEl.textContent = message;
  errorEl.removeClass('is-hidden');
}

/**
 * Clears the error message from the specified error element by adding the
 * 'is-hidden' class and emptying its text.
 */
export function clearError(errorEl: HTMLElement): void {
  errorEl.addClass('is-hidden');
  errorEl.textContent = '';
}
