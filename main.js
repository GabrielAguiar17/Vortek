/* ═══════════════════════════════════════════
   VORTEK — main.js
═══════════════════════════════════════════ */

/* Detecta preferência por movimento reduzido */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;

/* ═══════════════════════════════════════════
   HEADER — scroll + acessibilidade
═══════════════════════════════════════════ */
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ═══════════════════════════════════════════
   MENU MOBILE — acessibilidade completa
═══════════════════════════════════════════ */
const hamburger = document.getElementById('hamburger');
const nav       = document.getElementById('nav');

function openMenu() {
  nav.classList.add('open');
  hamburger.setAttribute('aria-expanded', 'true');
  hamburger.setAttribute('aria-label', 'Fechar menu');
  hamburger.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  nav.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-label', 'Abrir menu');
  hamburger.classList.remove('active');
  document.body.style.overflow = '';
}

hamburger.setAttribute('aria-expanded', 'false');
hamburger.setAttribute('aria-controls', 'nav');

hamburger.addEventListener('click', () => {
  nav.classList.contains('open') ? closeMenu() : openMenu();
});

/* Fecha ao clicar em um link */
nav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', closeMenu);
});

/* Fecha ao pressionar Escape */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && nav.classList.contains('open')) closeMenu();
});

/* Fecha ao clicar fora do menu */
document.addEventListener('click', (e) => {
  if (nav.classList.contains('open') &&
      !nav.contains(e.target) &&
      !hamburger.contains(e.target)) {
    closeMenu();
  }
});

/* ═══════════════════════════════════════════
   SCROLL REVEAL — com suporte a reduced motion
═══════════════════════════════════════════ */
if (!prefersReducedMotion) {
  const revealEls = document.querySelectorAll(
    '#servicos .service-card, ' +
    '#projetos .projeto-showcase, #projetos .proximo-card, ' +
    '#contato .contato-text, #contato .contato-form, ' +
    '#cta-banner .cta-banner-inner'
  );

  revealEls.forEach(el => el.classList.add('reveal'));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  revealEls.forEach(el => revealObserver.observe(el));
}

/* ═══════════════════════════════════════════
   FORMULÁRIO → WHATSAPP com validação
═══════════════════════════════════════════ */
const form = document.getElementById('contato-form');

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const nome     = document.getElementById('nome').value.trim();
  const telefone = document.getElementById('telefone').value.trim();
  const servico  = document.getElementById('servico').value;
  const mensagem = document.getElementById('mensagem').value.trim();

  /* Validação do nome */
  if (!nome || nome.length < 2) {
    showFieldError('nome', 'Por favor, informe seu nome.');
    return;
  }

  const texto =
`Olá, vim pelo site da Vortek! 👋

━━━━━━━━━━━━━━━━━━
📋 *NOVO CONTATO*
━━━━━━━━━━━━━━━━━━
👤 *Nome:* ${nome}
📱 *Telefone:* ${telefone || 'Não informado'}
🛠️ *Serviço:* ${servico || 'Não selecionado'}
💬 *Mensagem:* ${mensagem || 'Sem mensagem adicional'}
━━━━━━━━━━━━━━━━━━`;

  const url = `https://wa.me/5538992193008?text=${encodeURIComponent(texto)}`;

  const btn = form.querySelector('button[type="submit"]');
  const original = btn.innerHTML;

  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;animation:spin 1s linear infinite"><path d="M12 2a10 10 0 0 1 10 10"/></svg> Abrindo WhatsApp...`;
  btn.style.background = '#1a9e5c';
  btn.disabled = true;

  setTimeout(() => {
    window.open(url, '_blank');
    btn.innerHTML = '✓ Mensagem enviada!';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.background = '';
      btn.disabled = false;
      form.reset();
      clearFieldErrors();
    }, 2500);
  }, 600);
});

/* Validação inline em tempo real */
document.getElementById('nome').addEventListener('blur', function () {
  if (this.value.trim().length < 2 && this.value.trim().length > 0) {
    showFieldError('nome', 'Nome muito curto.');
  } else {
    clearFieldError('nome');
  }
});

function showFieldError(id, msg) {
  const field = document.getElementById(id);
  field.classList.add('field-error');
  let err = field.parentElement.querySelector('.field-error-msg');
  if (!err) {
    err = document.createElement('span');
    err.className = 'field-error-msg';
    field.parentElement.appendChild(err);
  }
  err.textContent = msg;
  field.focus();
}

function clearFieldError(id) {
  const field = document.getElementById(id);
  field.classList.remove('field-error');
  const err = field.parentElement.querySelector('.field-error-msg');
  if (err) err.remove();
}

function clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
  document.querySelectorAll('.field-error-msg').forEach(el => el.remove());
}

/* ═══════════════════════════════════════════
   WAVE CANVAS — Sobre section
   (desativado em mobile/reduced motion)
═══════════════════════════════════════════ */
(function () {
  const canvas = document.getElementById('sobre-canvas');
  if (!canvas || prefersReducedMotion || isMobile) {
    if (canvas) canvas.style.display = 'none';
    return;
  }

  const ctx = canvas.getContext('2d');
  let W, H, t = 0, running = true;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function drawWave(yBase, amp, freq, speed, alpha, dotSize) {
    const cols = Math.ceil(W / 20);
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const points = [];
      for (let c = 0; c <= cols; c++) {
        const x = c * 20;
        const wave = Math.sin(c * freq + t * speed + r * 0.4) * amp;
        const y = yBase + r * 12 + wave;
        points.push({ x, y });
      }
      ctx.beginPath();
      ctx.strokeStyle = `rgba(79,142,247,${alpha * 0.45})`;
      ctx.lineWidth = 0.5;
      for (let i = 0; i < points.length - 1; i++) {
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[i + 1].x, points[i + 1].y);
      }
      ctx.stroke();
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, dotSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(79,142,247,${alpha})`;
        ctx.fill();
      });
    }
  }

  /* Pausa quando fora da viewport para economizar CPU */
  const sobreSection = document.getElementById('sobre');
  const visObs = new IntersectionObserver(entries => {
    running = entries[0].isIntersecting;
  });
  visObs.observe(sobreSection);

  function loop() {
    if (running) {
      ctx.clearRect(0, 0, W, H);
      drawWave(H * 0.04, 20, 0.33, 0.38, 0.32, 1.1);
      drawWave(H * 0.60, 20, 0.33, 0.38, 0.32, 1.1);
      t += 0.011;
    }
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  loop();
})();

/* ═══════════════════════════════════════════
   PARTICLES CANVAS — Hero
   (reduz partículas em mobile)
═══════════════════════════════════════════ */
(function () {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;

  /* Se prefersReducedMotion, mostra canvas estático sem animação */
  if (prefersReducedMotion) {
    canvas.style.opacity = '0.3';
  }

  const ctx = canvas.getContext('2d');
  let W, H, particles;
  let mouse = { x: -9999, y: -9999 };

  const COUNT   = isMobile ? 60 : 180;
  const CONNECT = isMobile ? 80 : 120;
  const MOUSE_R = 160;
  const BLUE    = '79,142,247';

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function createParticle() {
    const clustered = Math.random() < 0.72;
    return {
      x:  clustered ? rand(W * 0.3, W * 0.95) : rand(0, W),
      y:  clustered ? rand(H * 0.15, H * 0.85) : rand(0, H),
      vx: prefersReducedMotion ? 0 : rand(-0.22, 0.22),
      vy: prefersReducedMotion ? 0 : rand(-0.22, 0.22),
      r:  rand(1, 2.4),
      a:  rand(0.3, 0.9),
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: COUNT }, createParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p = particles[i], q = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${BLUE},${(1 - dist / CONNECT) * 0.22})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }

    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${BLUE},${p.a})`;
      ctx.fill();
      if (p.r > 1.6) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${BLUE},${p.a * 0.12})`;
        ctx.fill();
      }
    });
  }

  function update() {
    if (prefersReducedMotion) return;
    particles.forEach(p => {
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MOUSE_R && dist > 0) {
        const force = (MOUSE_R - dist) / MOUSE_R * 0.6;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > 1.2) { p.vx *= 0.92; p.vy *= 0.92; }
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;
    });
  }

  function loop() { update(); draw(); requestAnimationFrame(loop); }

  window.addEventListener('resize', resize, { passive: true });

  if (!isMobile) {
    const heroSection = document.getElementById('hero');
    heroSection.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }, { passive: true });
    heroSection.addEventListener('mouseleave', () => {
      mouse.x = -9999; mouse.y = -9999;
    });
  }

  init();
  loop();
})();

/* ═══════════════════════════════════════════
   ACTIVE NAV LINK — destaca seção atual
═══════════════════════════════════════════ */
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav a');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.classList.toggle(
          'nav-active',
          link.getAttribute('href') === `#${entry.target.id}`
        );
      });
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => sectionObserver.observe(s));
