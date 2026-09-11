/* Grain and Gold — small, dependency-free behaviours. */
(function () {
  'use strict';

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------------- Mobile menu drawer ---------------- */
  function initDrawer() {
    var drawer = qs('[data-gg-drawer]');
    if (!drawer) return;
    var openers = qsa('[data-gg-drawer-open]');
    var closers = qsa('[data-gg-drawer-close]', drawer);
    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('gg-drawer-open');
      openers.forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      var first = qs('a, button', qs('.gg-drawer__panel', drawer));
      if (first) first.focus();
    }
    function close() {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('gg-drawer-open');
      openers.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      if (lastFocus) lastFocus.focus();
    }
    openers.forEach(function (b) { b.addEventListener('click', open); });
    closers.forEach(function (b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
    });
  }

  /* ---------------- Header search popover ---------------- */
  function initSearch() {
    var pop = qs('[data-gg-search]');
    if (!pop || pop.dataset.ggInit) return;
    pop.dataset.ggInit = '1';
    var toggles = qsa('[data-gg-search-toggle]');
    var input = qs('input[type="search"]', pop);
    function setOpen(open) {
      pop.hidden = !open;
      toggles.forEach(function (b) { b.setAttribute('aria-expanded', open ? 'true' : 'false'); });
      if (open && input) { input.focus(); input.select(); }
    }
    toggles.forEach(function (btn) {
      btn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(pop.hidden); });
    });
    qsa('[data-gg-search-close]', pop).forEach(function (b) { b.addEventListener('click', function () { setOpen(false); }); });
    pop.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { if (!pop.hidden) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) setOpen(false); });
  }

  /* ---------------- Quantity stepper ---------------- */
  function initQty() {
    qsa('[data-gg-qty]').forEach(function (wrap) {
      var input = qs('input', wrap);
      var minus = qs('[data-gg-qty-minus]', wrap);
      var plus = qs('[data-gg-qty-plus]', wrap);
      if (!input) return;
      var min = parseInt(input.min || '1', 10);
      var max = input.max ? parseInt(input.max, 10) : 99;
      function set(n) {
        n = Math.max(min, Math.min(max, n || min));
        input.value = n;
        if (minus) minus.disabled = n <= min;
        if (plus) plus.disabled = n >= max;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (minus) minus.addEventListener('click', function () { set(parseInt(input.value, 10) - 1); });
      if (plus) plus.addEventListener('click', function () { set(parseInt(input.value, 10) + 1); });
      input.addEventListener('change', function () { set(parseInt(input.value, 10)); });
      set(parseInt(input.value, 10));
    });
  }

  /* ---------------- Product form: variants, price, gallery, sticky bar ---------------- */
  function money(cents) {
    var fmt = (window.ggMoneyFormat || '€{{amount_with_comma_separator}}');
    var amount = (cents / 100);
    var withComma = amount.toFixed(2).replace('.', ',');
    var withDot = amount.toFixed(2);
    var noDecimals = Math.round(amount).toString();
    return fmt
      .replace('{{amount_with_comma_separator}}', withComma)
      .replace('{{amount_no_decimals_with_comma_separator}}', noDecimals)
      .replace('{{amount_no_decimals}}', noDecimals)
      .replace('{{amount}}', withDot);
  }

  function initProduct() {
    qsa('[data-gg-product]').forEach(function (root) {
      var dataEl = qs('[data-gg-variants]', root);
      if (!dataEl) return;
      var variants = [];
      try { variants = JSON.parse(dataEl.textContent); } catch (e) { return; }
      var form = qs('form[data-gg-product-form]', root);
      var idInput = form ? qs('input[name="id"]', form) : null;
      var priceEls = qsa('[data-gg-price]', root);
      var compareEls = qsa('[data-gg-compare]', root);
      var buttons = qsa('[data-gg-add]', root);
      var availability = qsa('[data-gg-availability]', root);
      var optionInputs = qsa('input[data-gg-option]', root);

      function selectedOptions() {
        var opts = [];
        optionInputs.forEach(function (i) {
          if (i.checked) opts[parseInt(i.dataset.ggOption, 10)] = i.value;
        });
        return opts;
      }
      function findVariant(opts) {
        for (var v = 0; v < variants.length; v++) {
          var ok = true;
          for (var i = 0; i < opts.length; i++) {
            if (opts[i] !== undefined && variants[v].options[i] !== opts[i]) { ok = false; break; }
          }
          if (ok) return variants[v];
        }
        return null;
      }
      function markAvailability(opts) {
        optionInputs.forEach(function (input) {
          var idx = parseInt(input.dataset.ggOption, 10);
          var test = opts.slice();
          test[idx] = input.value;
          var match = variants.some(function (v) {
            for (var i = 0; i < test.length; i++) {
              if (test[i] !== undefined && v.options[i] !== test[i]) return false;
            }
            return v.available;
          });
          var label = input.closest('.gg-option__value');
          if (label) {
            label.classList.toggle('is-unavailable', !match);
            label.classList.toggle('is-selected', input.checked);
          }
        });
      }
      function update() {
        var opts = selectedOptions();
        var variant = findVariant(opts);
        markAvailability(opts);
        if (!variant) {
          buttons.forEach(function (b) { b.disabled = true; b.querySelector('[data-gg-add-text]').textContent = b.dataset.ggUnavailable || 'Unavailable'; });
          return;
        }
        if (idInput) idInput.value = variant.id;
        priceEls.forEach(function (el) { el.textContent = money(variant.price); });
        compareEls.forEach(function (el) {
          if (variant.compare_at_price && variant.compare_at_price > variant.price) {
            el.textContent = money(variant.compare_at_price); el.hidden = false;
          } else { el.hidden = true; }
        });
        buttons.forEach(function (b) {
          var text = qs('[data-gg-add-text]', b);
          if (variant.available) {
            b.disabled = false;
            if (text) text.textContent = (b.dataset.ggAddLabel || 'Add to bag') + ' · ' + money(variant.price);
          } else {
            b.disabled = true;
            if (text) text.textContent = b.dataset.ggSoldOut || 'Sold out';
          }
        });
        availability.forEach(function (el) { el.hidden = !variant.available; });
        if (variant.featured_media_id) showMedia(variant.featured_media_id);
        if (history.replaceState && variants.length > 1) {
          var url = new URL(window.location.href);
          url.searchParams.set('variant', variant.id);
          history.replaceState({}, '', url.toString());
        }
      }
      optionInputs.forEach(function (i) { i.addEventListener('change', update); });

      /* gallery */
      var mainImg = qs('[data-gg-gallery-main] img', root);
      var thumbs = qsa('[data-gg-thumb]', root);
      function showMedia(mediaId) {
        var t = thumbs.filter(function (th) { return th.dataset.ggMediaId === String(mediaId); })[0];
        if (t) showThumb(t);
      }
      function showThumb(t) {
        if (mainImg && t.dataset.ggSrc) {
          mainImg.src = t.dataset.ggSrc;
          if (t.dataset.ggSrcset) mainImg.srcset = t.dataset.ggSrcset;
          mainImg.alt = t.dataset.ggAlt || '';
        }
        thumbs.forEach(function (th) { th.classList.toggle('is-active', th === t); });
      }
      thumbs.forEach(function (t) { t.addEventListener('click', function () { showThumb(t); }); });

      /* sticky add-to-bag on phones: show once the main buy button scrolls out of view */
      var sticky = qs('[data-gg-sticky]', root);
      var mainBuy = qs('[data-gg-buy-anchor]', root);
      if (sticky && mainBuy && 'IntersectionObserver' in window) {
        document.body.classList.add('gg-has-sticky-buy');
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { sticky.classList.toggle('is-visible', !en.isIntersecting && en.boundingClientRect.top < 0); });
        }, { threshold: 0 });
        io.observe(mainBuy);
        var stickyBtn = qs('[data-gg-sticky-submit]', sticky);
        if (stickyBtn && form) stickyBtn.addEventListener('click', function () { form.requestSubmit ? form.requestSubmit() : form.submit(); });
      }

      /* secondary "add to bag" buttons elsewhere on the page (CTA band) submit the main form */
      qsa('[data-gg-submit-product-form]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.preventDefault();
          if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
        });
      });

      update();
    });
  }


  /* ---------------- Review slider (buy box) ---------------- */
  function initReviewSlider() {
    qsa('[data-gg-rslider]').forEach(function (root) {
      if (root.dataset.ggInit) return;
      root.dataset.ggInit = '1';
      var track = qs('[data-gg-rslider-track]', root);
      var items = qsa('[data-gg-rslider-item]', root);
      var dotsWrap = qs('[data-gg-rslider-dots]', root);
      var prev = qs('[data-gg-rslider-prev]', root);
      var next = qs('[data-gg-rslider-next]', root);
      var interval = parseInt(root.dataset.ggInterval || '0', 10);
      if (!track || items.length < 2) return;
      var index = 0, timer = null, dots = [];
      if (dotsWrap) {
        items.forEach(function (_, i) {
          var d = document.createElement('button');
          d.type = 'button'; d.className = 'gg-rslider__dot' + (i === 0 ? ' is-active' : '');
          d.setAttribute('aria-label', 'Review ' + (i + 1));
          d.addEventListener('click', function () { go(i, true); });
          dotsWrap.appendChild(d); dots.push(d);
        });
      }
      function go(i, user) {
        index = (i + items.length) % items.length;
        track.scrollTo({ left: items[index].offsetLeft - track.offsetLeft, behavior: 'smooth' });
        dots.forEach(function (d, k) { d.classList.toggle('is-active', k === index); });
        if (user) restart();
      }
      function restart() {
        if (timer) clearInterval(timer);
        if (interval > 0) timer = setInterval(function () { go(index + 1); }, interval);
      }
      if (prev) prev.addEventListener('click', function () { go(index - 1, true); });
      if (next) next.addEventListener('click', function () { go(index + 1, true); });
      var scrollT = null;
      track.addEventListener('scroll', function () {
        clearTimeout(scrollT);
        scrollT = setTimeout(function () {
          var w = items[0].offsetWidth + 16;
          var i = Math.round(track.scrollLeft / w);
          if (i !== index) { index = Math.max(0, Math.min(items.length - 1, i)); dots.forEach(function (d, k) { d.classList.toggle('is-active', k === index); }); }
        }, 80);
      }, { passive: true });
      root.addEventListener('mouseenter', function () { if (timer) clearInterval(timer); });
      root.addEventListener('mouseleave', restart);
      restart();
    });
  }

  /* ---------------- Mark the current page in the nav ---------------- */
  function initNavState() {
    var path = window.location.pathname.replace(/\/$/, '');
    qsa('.gg-header__nav a, .gg-drawer__nav a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href.indexOf('#') > -1 && href.split('#')[0] === '') return; /* in-page anchors never mark current */
      var clean = href.split('#')[0].split('?')[0].replace(/\/$/, '');
      var isCurrent = (clean === '' ? (path === '' || path === '/') : clean === path);
      if (isCurrent) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function init() {
    initDrawer();
    initSearch();
    initQty();
    initProduct();
    initReviewSlider();
    initNavState();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Re-run for sections re-rendered inside the theme editor */
  document.addEventListener('shopify:section:load', function () { initQty(); initProduct(); initReviewSlider(); initDrawer(); initSearch(); });
})();
