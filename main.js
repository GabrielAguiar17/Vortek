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
const navOverlay = document.getElementById('nav-overlay');

function openMenu() {
  nav.classList.add('open');
  hamburger.setAttribute('aria-expanded', 'true');
  hamburger.setAttribute('aria-label', 'Fechar menu');
  hamburger.classList.add('active');
  document.body.style.overflow = 'hidden';
  if (navOverlay) {
    navOverlay.classList.add('active');
    navOverlay.setAttribute('aria-hidden', 'false');
  }
}

function closeMenu() {
  nav.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-label', 'Abrir menu');
  hamburger.classList.remove('active');
  document.body.style.overflow = '';
  if (navOverlay) {
    navOverlay.classList.remove('active');
    navOverlay.setAttribute('aria-hidden', 'true');
  }
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

/* Fecha ao clicar no overlay */
if (navOverlay) {
  navOverlay.addEventListener('click', closeMenu);
}

/* ═══════════════════════════════════════════
   SCROLL REVEAL — com suporte a reduced motion
═══════════════════════════════════════════ */
if (!prefersReducedMotion) {
  const revealEls = document.querySelectorAll(
    '#servicos .service-card, ' +
    '#processo .processo-step, ' +
    '#projetos .projeto-showcase, ' +
    '#projetos .proximo-card, ' +
    '#cta-banner .cta-banner-inner, ' +
    '#contato .contato-text, ' +
    '#contato .contato-form'
  );

  revealEls.forEach(el => el.classList.add('reveal'));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const siblings = Array.from(
          entry.target.parentElement.querySelectorAll('.reveal')
        );
        const idx = siblings.indexOf(entry.target);
        const delay = idx >= 0 ? idx * 110 : 0;
        setTimeout(() => entry.target.classList.add('visible'), delay);
      } else {
        /* Remove a classe quando sai da tela — anima de novo ao rolar de volta */
        entry.target.classList.remove('visible');
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

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
  const btnText = document.getElementById('submit-btn-text');
  const originalText = btnText ? btnText.textContent : 'Enviar pelo WhatsApp';

  if (btnText) btnText.textContent = 'Abrindo WhatsApp...';
  btn.style.background = '#1a9e5c';
  btn.disabled = true;

  setTimeout(() => {
    window.open(url, '_blank');
    if (btnText) btnText.textContent = '✓ Mensagem enviada!';
    setTimeout(() => {
      if (btnText) btnText.textContent = originalText;
      btn.style.background = '';
      btn.disabled = false;
      form.reset();
      clearFieldErrors();
      /* Reset char counter */
      const counter = document.getElementById('char-counter');
      if (counter) { counter.textContent = '0/500'; counter.className = 'char-counter'; }
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
   FORMULÁRIO — máscara de telefone
═══════════════════════════════════════════ */
const telefoneInput = document.getElementById('telefone');
if (telefoneInput) {
  telefoneInput.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 10) {
      v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (v.length > 6) {
      v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else if (v.length > 2) {
      v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    } else if (v.length > 0) {
      v = v.replace(/^(\d{0,2})/, '($1');
    }
    this.value = v;
  });
}

/* ═══════════════════════════════════════════
   FORMULÁRIO — contador de caracteres
═══════════════════════════════════════════ */
const mensagemTextarea = document.getElementById('mensagem');
const charCounter      = document.getElementById('char-counter');
const MAX_CHARS        = 500;

if (mensagemTextarea && charCounter) {
  mensagemTextarea.addEventListener('input', function () {
    const len = this.value.length;
    charCounter.textContent = `${len}/${MAX_CHARS}`;
    charCounter.className = 'char-counter';
    if (len >= MAX_CHARS)         charCounter.classList.add('at-limit');
    else if (len >= MAX_CHARS * 0.8) charCounter.classList.add('near-limit');
  });
}

/* ═══════════════════════════════════════════
   FORMULÁRIO — label do botão com nome
═══════════════════════════════════════════ */
const nomeInput   = document.getElementById('nome');
const submitBtnText = document.getElementById('submit-btn-text');

if (nomeInput && submitBtnText) {
  nomeInput.addEventListener('input', function () {
    const nome = this.value.trim();
    submitBtnText.textContent = nome.length >= 2
      ? `Enviar mensagem, ${nome.split(' ')[0]}`
      : 'Enviar pelo WhatsApp';
  });
}

/* ═══════════════════════════════════════════
   CALCULADORA DE ORÇAMENTO
═══════════════════════════════════════════ */
(function () {
  const cards       = document.querySelectorAll('.orcamento-card');
  const emptyEl     = document.getElementById('orcamento-empty');
  const contentEl   = document.getElementById('orcamento-content');
  const itensEl     = document.getElementById('orcamento-itens');
  const totalEl     = document.getElementById('orcamento-total');
  const whatsappBtn = document.getElementById('orcamento-whatsapp-btn');
  const notaEl      = document.querySelector('.orcamento-nota');

  if (!cards.length || !emptyEl || !contentEl) return;

  const selected = new Map(); /* servico → valor */

  function fmt(val) {
    return 'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
  }

  function update() {
    if (selected.size === 0) {
      emptyEl.hidden  = false;
      contentEl.hidden = true;
      whatsappBtn.disabled = true;
      whatsappBtn.classList.remove('enabled');
      if (notaEl) { notaEl.classList.remove('hidden'); }
      return;
    }

    emptyEl.hidden  = true;
    contentEl.hidden = false;

    /* Monta itens */
    itensEl.innerHTML = '';
    let total = 0;
    selected.forEach((valor, servico) => {
      total += valor;
      const row = document.createElement('div');
      row.className = 'orcamento-item';
      row.innerHTML = `<span>${servico}</span><span>${fmt(valor)}</span>`;
      itensEl.appendChild(row);
    });

    totalEl.textContent = fmt(total);

    whatsappBtn.disabled = false;
    whatsappBtn.classList.add('enabled');
    if (notaEl) notaEl.classList.add('hidden');
  }

  function toggleCard(card) {
    const servico = card.dataset.servico;
    const valor   = parseInt(card.dataset.valor, 10);

    if (selected.has(servico)) {
      selected.delete(servico);
      card.classList.remove('selected');
      card.setAttribute('aria-checked', 'false');
    } else {
      selected.set(servico, valor);
      card.classList.add('selected');
      card.setAttribute('aria-checked', 'true');
    }
    update();
  }

  cards.forEach(card => {
    card.addEventListener('click', () => toggleCard(card));
    card.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleCard(card);
      }
    });
  });

  /* Botão WhatsApp */
  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      if (selected.size === 0) return;

      let total = 0;
      let linhas = '';
      selected.forEach((valor, servico) => {
        total += valor;
        linhas += `  • ${servico} — a partir de ${fmt(valor)}\n`;
      });

      const msg =
`Olá, vim pelo site da Vortek! 👋

━━━━━━━━━━━━━━━━━━
💰 *SOLICITAÇÃO DE ORÇAMENTO*
━━━━━━━━━━━━━━━━━━
Serviços de interesse:
${linhas}
📊 *Estimativa total:* a partir de ${fmt(total)}
━━━━━━━━━━━━━━━━━━
Gostaria de mais informações!`;

      window.open(`https://wa.me/5538992193008?text=${encodeURIComponent(msg)}`, '_blank');
    });
  }
})();

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
