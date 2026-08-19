/**
 * RUBIEL PHOTO ART - NAVIDAD 2026: "HISTORIAS ENMARCADAS"
 * Lógica: Nieve en Cristales de Estrella, Humo y Vapor Anclados, Lightbox de Galería, FAQ Acordeón, Scroll Reveal y Formulario VIP
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. INICIALIZAR CRISTALES DE NIEVE EN FORMA DE ESTRELLA EN CANVAS
  initSnowfall();

  // 2. INICIALIZAR HUMO DE CHIMENEA, LUZ DEL FAROL Y VAPOR DE RUEDAS CON ANCLAJE EXACTO
  initAtmosphericLocomotiveEffects();

  // 3. DETECTOR DE SCROLL PARA HEADER
  const header = document.getElementById('site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
  });

  // 4. ANIMACIÓN SUAVE AL HACER SCROLL (SCROLL REVEAL OBSERVER)
  initScrollReveal();

  // 5. VISOR LIGHTBOX Y MATRIZ 3D PARALLAX UNFURLING GALLERY
  initGalleryLightbox();
  initParallaxUnfurlingGallery();

  // 5.1 REPRODUCTOR DE MÚSICA NAVIDEÑA DE FONDO
  initBackgroundAudioPlayer();

  // 6. REPRODUCTOR DE VIDEO RESUMEN INTERACTIVO
  const videoTrigger = document.getElementById('video-poster-trigger');
  const highlightVideo = document.getElementById('highlight-video');
  if (videoTrigger && highlightVideo) {
    const playVideo = () => {
      videoTrigger.classList.add('is-hidden');
      highlightVideo.play().catch(e => console.log('Autoplay handled', e));
    };
    videoTrigger.addEventListener('click', playVideo);
    videoTrigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        playVideo();
      }
    });
  }

  // 7. FORMULARIO VIP Y MODAL DE CONFIRMACIÓN CON REDIRECCIÓN A GRUPO DE WHATSAPP
  const bookingForm = document.getElementById('vip-booking-form');
  const modal = document.getElementById('vip-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalFolioDisplay = document.getElementById('modal-folio-display');
  const modalMsgCopy = document.getElementById('modal-msg-copy');
  const modalWhatsappBtn = document.getElementById('modal-whatsapp-btn');

  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('lead-name');
      const emailInput = document.getElementById('lead-email');
      const phoneInput = document.getElementById('lead-phone');
      const countInput = document.getElementById('lead-count');
      const consentInput = document.getElementById('lead-consent');

      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const phone = phoneInput.value.trim();
      const count = countInput.value || 'Familia';

      if (!name) {
        highlightError(nameInput);
        return;
      }
      if (!email || !email.includes('@')) {
        highlightError(emailInput);
        return;
      }
      if (!phone || phone.length < 8) {
        highlightError(phoneInput);
        return;
      }
      if (consentInput && !consentInput.checked) {
        alert('Por favor acepta los términos para recibir información exclusiva.');
        return;
      }

      // Folio VIP Único
      const randomFolio = Math.floor(1000 + Math.random() * 9000);
      const folioCode = `VIP-2026-${randomFolio}`;

      modalFolioDisplay.textContent = `FOLIO DE ACCESO: #${folioCode}`;
      modalMsgCopy.innerHTML = `¡Hola, <strong>${escapeText(name)}</strong>! Tu registro prioritario para <strong>${escapeText(count)}</strong> ha sido guardado. Haz clic en el botón de abajo para <strong>unirte al Grupo Exclusivo de WhatsApp</strong> donde publicaremos en primicia las fechas oficiales, costos y paquetes.`;

      // Enlace directo al Grupo Oficial de WhatsApp
      const waGroupUrl = 'https://chat.whatsapp.com/JhaAaFnj4kS4qPZj3wBbLe?s=cl&p=i&ilr=2';
      modalWhatsappBtn.href = waGroupUrl;

      // Desbloquear dinámicamente la sección del Grupo VIP en la página
      const vipSection = document.getElementById('grupo-vip');
      const unlockedTitle = document.getElementById('unlocked-vip-title');
      const unlockedDesc = document.getElementById('unlocked-vip-desc');
      if (vipSection) {
        vipSection.classList.remove('is-hidden');
      }
      if (unlockedTitle) {
        unlockedTitle.innerHTML = `¡BIENVENIDO/A, ${escapeText(name.toUpperCase())}!`;
      }
      if (unlockedDesc) {
        unlockedDesc.innerHTML = `Tu Folio <strong>#${folioCode}</strong> está confirmado para <strong>${escapeText(count)}</strong>. Da el último paso y únete a nuestra <strong>comunidad privada en WhatsApp</strong> donde compartiremos en primicia los paquetes de inversión, fechas de sesiones y detrás de cámaras antes del lanzamiento general.`;
      }

      // Guardar en LocalStorage
      try {
        const stored = JSON.parse(localStorage.getItem('rubiel_leads_2026') || '[]');
        stored.push({
          id: 'lead_' + Date.now(),
          name,
          email,
          phone,
          count,
          folioCode,
          date: new Date().toISOString(),
          status: 'Pendiente'
        });
        localStorage.setItem('rubiel_leads_2026', JSON.stringify(stored));
      } catch (err) {
        console.warn('LocalStorage error', err);
      }

      // Abrir la pestaña de Bienvenida VIP dedicada
      const welcomeUrl = `gracias.html?nombre=${encodeURIComponent(name)}&folio=${encodeURIComponent(folioCode)}&personas=${encodeURIComponent(count)}`;
      
      try {
        const newTab = window.open(welcomeUrl, '_blank');
        if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
          window.location.href = welcomeUrl;
        }
      } catch (err) {
        window.location.href = welcomeUrl;
      }

      openModal();
      bookingForm.reset();
    });
  }

  function openModal() {
    if (modal) {
      modal.classList.add('is-visible');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal() {
    if (modal) {
      modal.classList.remove('is-visible');
      document.body.style.overflow = '';
      const vipSection = document.getElementById('grupo-vip');
      if (vipSection && !vipSection.classList.contains('is-hidden')) {
        setTimeout(() => {
          vipSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('is-visible')) {
      closeModal();
    }
  });

  function highlightError(input) {
    input.focus();
    input.style.borderColor = '#9e2a2b';
    input.style.boxShadow = '0 0 0 3px rgba(158, 42, 43, 0.25)';
    setTimeout(() => {
      input.style.borderColor = '';
      input.style.boxShadow = '';
    }, 2800);
  }

  function escapeText(str) {
    return str.replace(/[&<>'"]/g, 
      t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t)
    );
  }

  // --------------------------------------------------------------------------
  // 8. SISTEMA DE LIGHTBOX CINEMATOGRÁFICO DE GALERÍA
  // --------------------------------------------------------------------------
  function initGalleryLightbox() {
    const lightbox = document.getElementById('gallery-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxDesc = document.getElementById('lightbox-desc');
    const closeBtn = document.getElementById('lightbox-close-btn');
    const prevBtn = document.getElementById('lightbox-prev-btn');
    const nextBtn = document.getElementById('lightbox-next-btn');
    const backdrop = document.getElementById('lightbox-backdrop');
    const triggers = document.querySelectorAll('[data-lightbox-idx]');

    if (!lightbox || triggers.length === 0) return;

    const galleryData = [
      {
        src: 'assets/images/set_anterior_1.jpg',
        title: 'SETS DE TEMPORADAS ANTERIORES',
        desc: ''
      },
      {
        src: 'assets/images/set_anterior_2.jpg',
        title: 'SETS DE TEMPORADAS ANTERIORES',
        desc: ''
      },
      {
        src: 'assets/images/set_anterior_3.jpg',
        title: 'SETS DE TEMPORADAS ANTERIORES',
        desc: ''
      },
      {
        src: 'assets/images/set_anterior_4.jpg',
        title: 'SETS DE TEMPORADAS ANTERIORES',
        desc: ''
      },
      {
        src: 'assets/images/set_anterior_5.jpg',
        title: 'SETS DE TEMPORADAS ANTERIORES',
        desc: ''
      }
    ];

    let currentIdx = 0;

    function showImage(idx) {
      if (idx < 0) idx = galleryData.length - 1;
      if (idx >= galleryData.length) idx = 0;
      currentIdx = idx;

      const item = galleryData[currentIdx];
      if (lightboxImg) {
        lightboxImg.src = item.src;
        lightboxImg.alt = item.title;
      }
      if (lightboxTitle) lightboxTitle.textContent = item.title;
      if (lightboxDesc) lightboxDesc.textContent = item.desc;
    }

    function openLightbox(idx) {
      showImage(idx);
      lightbox.classList.add('is-visible');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      lightbox.classList.remove('is-visible');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    triggers.forEach(trigger => {
      trigger.addEventListener('click', () => {
        const idx = parseInt(trigger.getAttribute('data-lightbox-idx'), 10) || 0;
        openLightbox(idx);
      });
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const idx = parseInt(trigger.getAttribute('data-lightbox-idx'), 10) || 0;
          openLightbox(idx);
        }
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (backdrop) backdrop.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', () => showImage(currentIdx - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => showImage(currentIdx + 1));

    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('is-visible')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showImage(currentIdx - 1);
      if (e.key === 'ArrowRight') showImage(currentIdx + 1);
    });
  }

  // --------------------------------------------------------------------------
  // 8.1 MATRIZ 3D PARALLAX UNFURLING GALLERY
  // --------------------------------------------------------------------------
  function initParallaxUnfurlingGallery() {
    const viewport = document.getElementById('parallax-unfurl-viewport');
    const matrix = document.getElementById('parallax-3d-matrix');

    if (!viewport || !matrix) return;

    let targetRotateX = 15;
    let targetRotateY = -12;
    let currentRotateX = 15;
    let currentRotateY = -12;
    let isMouseInside = false;

    // Inclinación 3D interactiva al mover el mouse
    viewport.addEventListener('mousemove', (e) => {
      isMouseInside = true;
      const rect = viewport.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      targetRotateY = -12 + x * 14;
      targetRotateX = 15 - y * 12;
    });

    viewport.addEventListener('mouseleave', () => {
      isMouseInside = false;
      targetRotateX = 15;
      targetRotateY = -12;
    });

    // Inclinación suave mediante scroll de página
    window.addEventListener('scroll', () => {
      if (isMouseInside) return;
      const rect = viewport.getBoundingClientRect();
      const windowH = window.innerHeight;
      if (rect.top < windowH && rect.bottom > 0) {
        const progress = (windowH - rect.top) / (windowH + rect.height);
        targetRotateX = 20 - progress * 10;
        targetRotateY = -16 + progress * 8;
      }
    }, { passive: true });

    function renderParallaxTilt() {
      currentRotateX += (targetRotateX - currentRotateX) * 0.08;
      currentRotateY += (targetRotateY - currentRotateY) * 0.08;

      matrix.style.transform = `rotateX(${currentRotateX.toFixed(2)}deg) rotateY(${currentRotateY.toFixed(2)}deg) rotateZ(3deg)`;
      requestAnimationFrame(renderParallaxTilt);
    }

    renderParallaxTilt();
  }

  // --------------------------------------------------------------------------
  // 9. ANIMACIÓN AL HACER SCROLL (INTERSECTION OBSERVER)
  // --------------------------------------------------------------------------
  function initScrollReveal() {
    const targets = document.querySelectorAll('.reveal-on-scroll');
    if (!('IntersectionObserver' in window)) {
      targets.forEach(t => t.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          obs.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.12
    });

    targets.forEach(t => observer.observe(t));
  }

  // --------------------------------------------------------------------------
  // 10. SISTEMA CINEMÁTICO: ANCLAJE EXACTO 1:1 DE HUMO, FARO Y VAPOR DE RUEDAS
  // --------------------------------------------------------------------------
  function initAtmosphericLocomotiveEffects() {
    const canvas = document.getElementById('smoke-canvas');
    const stageBackdrop = document.getElementById('hero-stage-backdrop');
    const flareEl = document.getElementById('train-lens-flare');
    if (!canvas || !stageBackdrop) return;

    const ctx = canvas.getContext('2d');
    let stageWidth = (canvas.width = stageBackdrop.offsetWidth);
    let stageHeight = (canvas.height = stageBackdrop.offsetHeight);

    // Helper: calcula el rect exacto renderizado por object-fit: cover
    function getRenderedCoverRect(cW, cH, naturalW, naturalH, posXPercent, posYPercent) {
      const cRatio = cW / cH;
      const iRatio = naturalW / naturalH;
      let rW, rH;

      if (cRatio > iRatio) {
        rW = cW;
        rH = cW / iRatio;
      } else {
        rH = cH;
        rW = cH * iRatio;
      }

      const oX = (cW - rW) * (posXPercent / 100);
      const oY = (cH - rH) * (posYPercent / 100);

      return { x: oX, y: oY, width: rW, height: rH };
    }

    // Coordenadas calculadas con anclaje a prueba de cambios de pantalla
    const loc = {
      chimneyX: 0,
      chimneyY: 0,
      lanternX: 0,
      lanternY: 0,
      wheelsX: 0,
      wheelsY: 0
    };

    function recalculateAnchors() {
      stageWidth = canvas.width = stageBackdrop.offsetWidth;
      stageHeight = canvas.height = stageBackdrop.offsetHeight;

      const isMobile = window.innerWidth <= 980;

      if (!isMobile) {
        // Desktop Image: 1024x576, object-position: 90% 50%
        const rect = getRenderedCoverRect(stageWidth, stageHeight, 1024, 576, 90, 50);
        loc.lanternX = rect.x + rect.width * 0.665;
        loc.lanternY = rect.y + rect.height * 0.31;
        loc.chimneyX = rect.x + rect.width * 0.615;
        loc.chimneyY = rect.y + rect.height * 0.175;
        loc.wheelsX = rect.x + rect.width * 0.610;
        loc.wheelsY = rect.y + rect.height * 0.72;
      } else {
        // Mobile Image: 1080x1920, object-position: 50% 0%
        const rect = getRenderedCoverRect(stageWidth, stageHeight, 1080, 1920, 50, 0);
        loc.lanternX = rect.x + rect.width * 0.67;
        loc.lanternY = rect.y + rect.height * 0.42;
        loc.chimneyX = rect.x + rect.width * 0.58;
        loc.chimneyY = rect.y + rect.height * 0.34;
        loc.wheelsX = rect.x + rect.width * 0.52;
        loc.wheelsY = rect.y + rect.height * 0.76;
      }

      // Colocar el destello del faro exactamente en su linterna
      if (flareEl) {
        flareEl.style.left = `${loc.lanternX}px`;
        flareEl.style.top = `${loc.lanternY}px`;
      }
    }

    recalculateAnchors();
    window.addEventListener('resize', recalculateAnchors);

    // Partículas de Humo de Chimenea (Carbón y Vapor Alto)
    const chimneyParticles = [];
    const maxChimneyParticles = 65;

    class ChimneyParticle {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = loc.chimneyX + (Math.random() * 14 - 7);
        this.y = loc.chimneyY + (Math.random() * 8 - 4);
        this.radius = Math.random() * 10 + 8;
        this.maxRadius = Math.random() * 95 + 65;
        this.growth = (this.maxRadius - this.radius) / (Math.random() * 90 + 80);
        this.vx = Math.random() * 1.5 + 0.4;
        this.vy = -(Math.random() * 1.4 + 0.8);
        this.alpha = Math.random() * 0.48 + 0.26;
        this.fade = this.alpha / (Math.random() * 90 + 80);
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() * 0.02 - 0.01);

        if (initial) {
          this.y -= Math.random() * 120;
          this.x += Math.random() * 80;
          this.radius += Math.random() * 35;
        }
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.radius += this.growth;
        this.alpha -= this.fade;
        this.rotation += this.rotationSpeed;

        if (this.alpha <= 0 || this.radius >= this.maxRadius || this.y < -20) {
          this.reset();
        }
      }

      draw(context) {
        if (this.alpha <= 0) return;
        context.save();
        context.translate(this.x, this.y);
        context.rotate(this.rotation);

        const grad = context.createRadialGradient(0, 0, this.radius * 0.15, 0, 0, this.radius);
        grad.addColorStop(0, `rgba(40, 32, 24, ${this.alpha * 0.95})`);
        grad.addColorStop(0.45, `rgba(68, 55, 42, ${this.alpha * 0.55})`);
        grad.addColorStop(1, 'rgba(110, 95, 80, 0)');

        context.fillStyle = grad;
        context.beginPath();
        context.arc(0, 0, this.radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
    }

    // Partículas de Vapor de Ruedas / Pistones / Freno (Neblina Baja)
    const wheelParticles = [];
    const maxWheelParticles = 45;

    class WheelSteamParticle {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = loc.wheelsX + (Math.random() * 36 - 18);
        this.y = loc.wheelsY + (Math.random() * 14 - 7);
        this.radius = Math.random() * 12 + 10;
        this.maxRadius = Math.random() * 80 + 55;
        this.growth = (this.maxRadius - this.radius) / (Math.random() * 70 + 60);
        this.vx = (Math.random() * 2.2 - 1.1) + (Math.random() > 0.5 ? -0.6 : 0.4);
        this.vy = -(Math.random() * 0.55 + 0.1);
        this.alpha = Math.random() * 0.35 + 0.18;
        this.fade = this.alpha / (Math.random() * 70 + 60);
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() * 0.015 - 0.0075);

        if (initial) {
          this.x += Math.random() * 60 - 30;
          this.radius += Math.random() * 30;
        }
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.radius += this.growth;
        this.alpha -= this.fade;
        this.rotation += this.rotationSpeed;

        if (this.alpha <= 0 || this.radius >= this.maxRadius) {
          this.reset();
        }
      }

      draw(context) {
        if (this.alpha <= 0) return;
        context.save();
        context.translate(this.x, this.y);
        context.rotate(this.rotation);

        const grad = context.createRadialGradient(0, 0, this.radius * 0.12, 0, 0, this.radius);
        grad.addColorStop(0, `rgba(255, 248, 235, ${this.alpha * 0.9})`);
        grad.addColorStop(0.5, `rgba(225, 210, 190, ${this.alpha * 0.5})`);
        grad.addColorStop(1, 'rgba(180, 165, 145, 0)');

        context.fillStyle = grad;
        context.beginPath();
        context.arc(0, 0, this.radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
    }

    for (let i = 0; i < maxChimneyParticles; i++) {
      chimneyParticles.push(new ChimneyParticle());
    }
    for (let i = 0; i < maxWheelParticles; i++) {
      wheelParticles.push(new WheelSteamParticle());
    }

    function animateAtmosphere() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Renderizar vapor de ruedas y pistones (capa baja)
      for (let i = 0; i < wheelParticles.length; i++) {
        const wp = wheelParticles[i];
        wp.update();
        wp.draw(ctx);
      }

      // Renderizar humo de chimenea (capa alta)
      for (let i = 0; i < chimneyParticles.length; i++) {
        const cp = chimneyParticles[i];
        cp.update();
        cp.draw(ctx);
      }

      requestAnimationFrame(animateAtmosphere);
    }

    animateAtmosphere();
  }

  // --------------------------------------------------------------------------
  // 11. SISTEMA DE CRISTALES DE NIEVE EN FORMA DE ESTRELLA (6 PUNTAS / DESTELLES)
  // --------------------------------------------------------------------------
  function initSnowfall() {
    const canvas = document.getElementById('snow-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    // Cantidad sutil y delicada de copos de nieve (sin saturar la pantalla)
    const flakeCount = width > 768 ? 26 : 14;
    const flakes = [];

    for (let i = 0; i < flakeCount; i++) {
      flakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 3.6 + 1.4,
        speedY: Math.random() * 0.75 + 0.35,
        speedX: Math.random() * 0.4 - 0.2,
        opacity: Math.random() * 0.35 + 0.15,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() * 0.02 - 0.01),
        swing: Math.random() * Math.PI * 2,
        swingSpeed: Math.random() * 0.015 + 0.008
      });
    }

    // Dibujar cristal de nieve en estrella de 6 puntas
    function drawStarSnowflake(c, x, y, r, rot, op) {
      c.save();
      c.translate(x, y);
      c.rotate(rot);

      c.strokeStyle = `rgba(255, 255, 255, ${op})`;
      c.fillStyle = `rgba(255, 255, 255, ${op * 0.95})`;
      c.lineWidth = r > 4.5 ? 1.6 : 1.1;
      c.lineCap = 'round';

      // 6 brazos simétricos
      for (let i = 0; i < 6; i++) {
        c.rotate(Math.PI / 3);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(0, r);
        c.stroke();

        // Ramificaciones cristalinas para estrellas medianas y grandes
        if (r > 3.2) {
          const branchPos = r * 0.58;
          const branchLen = r * 0.35;
          c.beginPath();
          c.moveTo(0, branchPos);
          c.lineTo(branchLen * 0.7, branchPos + branchLen * 0.5);
          c.moveTo(0, branchPos);
          c.lineTo(-branchLen * 0.7, branchPos + branchLen * 0.5);
          c.stroke();
        }
      }

      // Núcleo brillante central de la estrella
      c.beginPath();
      c.arc(0, 0, Math.max(1, r * 0.22), 0, Math.PI * 2);
      c.fill();

      // Destello suave en estrellas grandes
      if (r > 4.5) {
        c.shadowBlur = 6;
        c.shadowColor = 'rgba(255, 255, 255, 0.9)';
      }

      c.restore();
    }

    function renderSnow() {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];

        f.swing += f.swingSpeed;
        f.rotation += f.rotationSpeed;
        f.x += Math.sin(f.swing) * 0.5 + f.speedX;
        f.y += f.speedY;

        if (f.y > height + 10) {
          f.y = -10;
          f.x = Math.random() * width;
        }
        if (f.x > width + 10) f.x = -10;
        if (f.x < -10) f.x = width + 10;

        drawStarSnowflake(ctx, f.x, f.y, f.radius, f.rotation, f.opacity);
      }

      requestAnimationFrame(renderSnow);
    }

    renderSnow();
  }

  // --------------------------------------------------------------------------
  // 10. REPRODUCTOR NATIVO DE MÚSICA NAVIDEÑA (HTML5 AUDIO ENGINE)
  // --------------------------------------------------------------------------
  function initBackgroundAudioPlayer() {
    const audio = document.getElementById('bg-audio-player');
    const toggleBtn = document.getElementById('music-toggle-btn');
    const labelText = document.getElementById('speaker-label-text');
    if (!audio || !toggleBtn) return;

    audio.volume = 0.18; // Volumen ambiental sutil (a la mitad de intensidad)
    let isUserMuted = false;

    function playAudio() {
      if (isUserMuted) return;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            toggleBtn.classList.remove('is-muted');
            toggleBtn.classList.add('is-playing');
            if (labelText) labelText.textContent = 'Apagar Música';
            toggleBtn.setAttribute('title', 'Apagar música navideña');
          })
          .catch(() => {
            // Esperando primer micro-gesto del navegador
            toggleBtn.classList.add('is-muted');
            toggleBtn.classList.remove('is-playing');
            if (labelText) labelText.textContent = 'Apagar Música';
          });
      }
    }

    function pauseAudio() {
      audio.pause();
      toggleBtn.classList.add('is-muted');
      toggleBtn.classList.remove('is-playing');
      if (labelText) labelText.textContent = 'Activar Música';
      toggleBtn.setAttribute('title', 'Activar música navideña');
    }

    // Intentar reproducción inmediata
    playAudio();
    window.addEventListener('load', playAudio);

    // Botón para apagar o encender música
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!audio.paused) {
        isUserMuted = true;
        pauseAudio();
      } else {
        isUserMuted = false;
        playAudio();
      }
    });

    // Desbloqueo ultra rápido al primer movimiento o scroll
    const unlockOnGesture = () => {
      if (!isUserMuted && audio.paused) {
        playAudio();
      }
    };

    ['pointerdown', 'touchstart', 'scroll', 'touchmove', 'wheel', 'keydown', 'click'].forEach((evt) => {
      window.addEventListener(evt, unlockOnGesture, { once: true, passive: true });
    });
  }
});
