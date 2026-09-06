// Initialise once outside React so re-renders do not duplicate the overlay.
if (window.kofiWidgetOverlay) {
  window.kofiWidgetOverlay.draw('0xkai', {
    'type': 'floating-chat',
    'floating-chat.donateButton.text': 'Support Me',
    'floating-chat.donateButton.background-color': '#062b47',
    'floating-chat.donateButton.text-color': '#fff'
  });
}
