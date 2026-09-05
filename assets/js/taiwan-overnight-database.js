(() => {
  const centreScrollableMaps = () => {
    document.querySelectorAll('.overnight-map__canvas').forEach((canvas) => {
      if (canvas.dataset.centred === 'true' || canvas.scrollWidth <= canvas.clientWidth) return;
      canvas.scrollLeft = Math.max(0, (canvas.scrollWidth - canvas.clientWidth) / 2);
      canvas.dataset.centred = 'true';
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', centreScrollableMaps, { once: true });
  } else {
    centreScrollableMaps();
  }
})();
