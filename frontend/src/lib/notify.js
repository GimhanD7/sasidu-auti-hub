// Publish a browser notification event for the shared toast component to display.
export function notify(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type, id: Date.now() } }));
}
