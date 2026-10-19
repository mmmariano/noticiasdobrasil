(function () {
  'use strict';

  // Se uma foto externa não carregar, o espaço fica com a cor de fundo.
  document.querySelectorAll('img').forEach(function (img) {
    img.addEventListener('error', function () { img.style.visibility = 'hidden'; });
  });

  // Carrossel de destaques (só existe na página inicial).
  var track = document.getElementById('track');
  if (!track) return;
  var dots = document.getElementById('dots');
  var n = track.children.length, i = 0;

  function go(x) {
    i = (x + n) % n;
    track.style.transform = 'translateX(' + (-100 * i) + '%)';
    Array.prototype.forEach.call(dots.children, function (d, j) {
      d.setAttribute('aria-current', j === i ? 'true' : 'false');
    });
  }

  for (var k = 0; k < n; k++) {
    (function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Ir para o destaque ' + (k + 1));
      b.addEventListener('click', function () { go(k); });
      dots.appendChild(b);
    })(k);
  }
  document.getElementById('prev').addEventListener('click', function () { go(i - 1); });
  document.getElementById('next').addEventListener('click', function () { go(i + 1); });
  go(0);
})();
