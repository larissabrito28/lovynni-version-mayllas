'use strict';

import CONFIG from './config.js';

const $ = s => document.querySelector(s);

// ============================================================
// ESTADO GLOBAL
// ============================================================
let products = [];
let favorites = read('lovynni-favorites-v2', []);
let cart = read('lovynni-cart-v2', []);
let filter = 'Todos';
let search = '';
let currentAccount = null;
let cloudSave = null;
let accountReady = true;

const currency = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function read(key, fallback) {
  try {
    const x = JSON.parse(localStorage.getItem(key));
    return x ?? fallback;
  } catch {
    return fallback;
  }
}

// ============================================================
// API PÚBLICA — usada pelo auth.js
// ============================================================
window.LovynniStore = {
  getState: () => ({
    favorites: [...favorites],
    cart: cart.map(x => ({ ...x }))
  }),

  setAccount(user, save) {
    currentAccount = user;
    cloudSave = save;
    accountReady = true;
  },

  setReady(value) {
    accountReady = value;
  },

  setState(data) {
    favorites = Array.isArray(data?.favorites)
      ? data.favorites.filter(id => products.some(p => p.id === id))
      : [];
    cart = Array.isArray(data?.cart)
      ? data.cart.filter(x => products.some(p => p.id === x.id))
      : [];
    counts();
    render();
  },

  resetGuest() {
    favorites = read('lovynni-favorites-v2', []);
    cart = read('lovynni-cart-v2', []);
    counts();
    render();
  },

  openDrawer: (type) => openDrawer(type),
  toast: (message) => toast(message)
};

// ============================================================
// ESTOQUE E DISPONIBILIDADE
// ============================================================
function stock() {
  const fromProducts = Object.fromEntries(products.map(p => [p.id, p.stock ?? 0]));
  const overrides = read('lovynni-stock-v2', {});
  return { ...fromProducts, ...overrides };
}

function available(id) {
  return Number(stock()[id] ?? 0) - cart.filter(x => x.id === id).length;
}

// ============================================================
// PERSISTÊNCIA
// ============================================================
function persist() {
  if (currentAccount) {
    if (cloudSave) cloudSave({ favorites: [...favorites], cart: cart.map(x => ({ ...x })) });
  } else {
    localStorage.setItem('lovynni-favorites-v2', JSON.stringify(favorites));
    localStorage.setItem('lovynni-cart-v2', JSON.stringify(cart));
  }
  counts();
}

function counts() {
  if ($('#favCount')) $('#favCount').textContent = favorites.length;
  if ($('#cartCount')) $('#cartCount').textContent = cart.length;
}

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ============================================================
// RENDER
// ============================================================
function priceBlock(p) {
  if (p.promoPrice && p.promoPrice > 0 && p.promoPrice < p.price) {
    return `<p><s>${currency(p.price)}</s> <strong>${currency(p.promoPrice)}</strong></p>`;
  }
  return `<p>${currency(p.price)}</p>`;
}

function productCard(p) {
  const liked = favorites.includes(p.id);
  const isPromo = p.promoPrice && p.promoPrice > 0 && p.promoPrice < p.price;
  const tag = isPromo ? 'PROMOÇÃO' : p.new ? 'NOVIDADE' : p.best ? 'BEST SELLER' : 'LOVYNNI';

  return `<article class="product-card">
    <div class="product-art" data-open="${p.id}" data-type="${p.category}" style="--tone:${p.tone};--garment:${p.hex}" role="button" tabindex="0" aria-label="Detalhes de ${p.name}">
      <div class="shape"></div>
      <span class="tag">${tag}</span>
      <button class="heart ${liked ? 'active' : ''}" data-fav="${p.id}" aria-label="${liked ? 'Remover dos' : 'Adicionar aos'} favoritos">${liked ? '♥' : '♡'}</button>
    </div>
    <div class="product-meta">
      <div>
        <h3>${p.name}</h3>
        <small>${p.category} · ${p.color}</small>
        ${priceBlock(p)}
      </div>
      <button class="add-mini" data-open="${p.id}" aria-label="Selecionar ${p.name}">+</button>
    </div>
  </article>`;
}

function render() {
  const active = products.filter(p => p.active !== false);

  let items = active.filter(p =>
    (filter === 'Todos'
      || (filter === 'Novidades' && p.new)
      || (filter === 'Mais vendidos' && p.best)
      || p.category === filter)
    && p.name.toLowerCase().includes(search)
  );

  const sort = $('#sort')?.value;
  if (sort === 'low') items.sort((a, b) => (a.promoPrice || a.price) - (b.promoPrice || b.price));
  if (sort === 'high') items.sort((a, b) => (b.promoPrice || b.price) - (a.promoPrice || a.price));
  if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));

  if ($('#featuredProducts')) {
    $('#featuredProducts').innerHTML = active.slice(0, 4).map(productCard).join('');
  }
  if ($('#allProducts')) {
    $('#allProducts').innerHTML = items.map(productCard).join('');
  }
  if ($('#resultCount')) $('#resultCount').textContent = `${items.length} PEÇAS`;
  if ($('#empty')) $('#empty').hidden = items.length !== 0;
}

function chooseFilter(value) {
  filter = value;
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === value));
  render();
}

// ============================================================
// AÇÕES
// ============================================================
function toggleFav(id) {
  if (!accountReady) {
    toast('Aguarde o carregamento da conta');
    return;
  }
  favorites = favorites.includes(id)
    ? favorites.filter(x => x !== id)
    : [...favorites, id];
  persist();
  render();
  if ($('#drawer')?.classList.contains('open') && $('#drawerTitle')?.textContent === 'Favoritos') {
    openDrawer('favorites');
  }
  toast('Favoritos atualizados');
}

function addCart(id, size, color) {
  if (!accountReady) {
    toast('Aguarde o carregamento da conta');
    return;
  }
  const p = products.find(p => p.id === id);
  if (!p) return;
  if (available(id) <= 0) {
    toast('Peça indisponível no estoque demonstrativo');
    return;
  }
  cart.push({ id, size, color });
  persist();
  toast('Peça adicionada à sacola');
}

// ============================================================
// DRAWER
// ============================================================
function openDrawer(type) {
  const drawer = $('#drawer');
  if (!drawer) return;

  const fav = type === 'favorites';
  const account = type === 'account';

  $('#drawerTitle').textContent = account ? 'Minha conta' : fav ? 'Favoritos' : 'Sua sacola';

  if (account) {
    $('#drawerBody').innerHTML = '<h3>Universo LOVYNNI</h3><p>Área de conta demonstrativa. Login e pedidos reais serão habilitados quando o Firebase da LOVYNNI estiver configurado.</p><p>Você pode explorar os produtos, salvar favoritos e montar sua sacola sem cadastro.</p>';
    $('#drawerFooter').innerHTML = '';
  } else {
    const ids = fav ? favorites : cart.map(x => x.id);

    $('#drawerBody').innerHTML = ids.length
      ? ids.map((id, i) => {
          const p = products.find(p => p.id === id);
          if (!p) return '';
          const variation = fav ? '' : `<p>${cart[i].size} · ${cart[i].color}</p>`;
          return `<div class="drawer-item">
            <div class="swatch" style="--garment:${p.hex}"></div>
            <div>
              <h3>${p.name}</h3>
              ${priceBlock(p)}
              ${variation}
              <button data-remove="${type}:${i}">REMOVER</button>
              ${fav ? ` <button data-open="${id}">VER PEÇA</button>` : ''}
            </div>
          </div>`;
        }).join('')
      : '<p>Nenhuma peça por aqui ainda.</p>';

    const total = cart.reduce((sum, item) => {
      const p = products.find(p => p.id === item.id);
      if (!p) return sum;
      return sum + (p.promoPrice && p.promoPrice > 0 ? p.promoPrice : p.price);
    }, 0);

    $('#drawerFooter').innerHTML = fav
      ? ''
      : `<strong>Total: ${currency(total)}</strong>
         <button class="checkout" id="checkout">FINALIZAR PEDIDO</button>
         <small>${CONFIG.checkoutNotice}</small>`;
  }

  $('#backdrop').hidden = false;
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  $('#closeDrawer').focus();
}

function closeDrawer() {
  $('#drawer')?.classList.remove('open');
  $('#drawer')?.setAttribute('aria-hidden', 'true');
  if ($('#backdrop')) $('#backdrop').hidden = true;
  document.body.style.overflow = '';
}

// ============================================================
// MODAL DO PRODUTO
// ============================================================
function openProduct(id) {
  const p = products.find(p => p.id === id);
  if (!p) return;

  const sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ['PP', 'P', 'M', 'G', 'GG'];
  const sizeOptions = sizes.map((s, i) =>
    `<option ${i === Math.floor(sizes.length / 2) ? 'selected' : ''}>${s}</option>`
  ).join('');

  const promoLine = p.promoPrice && p.promoPrice > 0 && p.promoPrice < p.price
    ? `<p><s>${currency(p.price)}</s> <strong>${currency(p.promoPrice)}</strong></p>`
    : `<p><strong>${currency(p.price)}</strong></p>`;

  const description = p.description || 'Peça LOVYNNI. Descrição, composição e medidas serão adicionadas em breve.';
  const composition = p.composition ? `<p><strong>Composição:</strong> ${p.composition}</p>` : '';
  const measurements = p.measurements ? `<p><strong>Medidas:</strong> ${p.measurements}</p>` : '';

  const art = p.imageUrl
    ? `<div class="modal-art" style="--tone:${p.tone};--garment:${p.hex}"><img src="${p.imageUrl}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover"></div>`
    : `<div class="modal-art" style="--tone:${p.tone};--garment:${p.hex}"><span>✦</span></div>`;

  $('#modalBody').innerHTML = `<div class="modal-content">
    ${art}
    <div>
      <p class="eyebrow wine">LOVYNNI · ${p.category.toUpperCase()}</p>
      <h2 id="modalTitle">${p.name}</h2>
      ${promoLine}
      <p>${description}</p>
      ${composition}
      ${measurements}
      <label>Tamanho <select id="sizeChoice">${sizeOptions}</select></label>
      <label>Cor <select id="colorChoice"><option>${p.color}</option></select></label>
      <p>Disponibilidade: ${Math.max(0, available(id))} unidade(s)</p>
      <button class="checkout" data-confirm-cart="${id}">ADICIONAR À SACOLA</button>
    </div>
  </div>`;

  $('#modal').classList.add('open');
  $('#modal').setAttribute('aria-hidden', 'false');
  $('#closeModal').focus();
}

function closeModal() {
  $('#modal')?.classList.remove('open');
  $('#modal')?.setAttribute('aria-hidden', 'true');
}

// ============================================================
// EVENTOS GLOBAIS
// ============================================================
document.addEventListener('click', e => {
  const f = e.target.closest('[data-fav]');
  const r = e.target.closest('[data-remove]');
  const confirmBtn = e.target.closest('[data-confirm-cart]');
  const open = e.target.closest('[data-open]');

  if (f) {
    e.stopPropagation();
    toggleFav(Number(f.dataset.fav));
  } else if (r) {
    if (!accountReady) {
      toast('Aguarde o carregamento da conta');
      return;
    }
    const [type, index] = r.dataset.remove.split(':');
    if (type === 'favorites') favorites.splice(Number(index), 1);
    else cart.splice(Number(index), 1);
    persist();
    render();
    openDrawer(type);
  } else if (confirmBtn) {
    addCart(Number(confirmBtn.dataset.confirmCart), $('#sizeChoice').value, $('#colorChoice').value);
    closeModal();
  } else if (open) {
    openProduct(Number(open.dataset.open));
  } else if (e.target.id === 'checkout') {
    toast(CONFIG.checkoutNotice || 'Checkout ainda não conectado.');
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    closeDrawer();
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.product-art[data-open]')) {
    e.preventDefault();
    openProduct(Number(e.target.dataset.open));
  }
});

// ============================================================
// INIT
// ============================================================
async function loadProducts() {
  try {
    const res = await fetch('products.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    products = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Falha ao carregar products.json:', err);
    products = [];
    toast('Não foi possível carregar o catálogo.');
  }
}

function init() {
  counts();
  render();

  $('#openFavorites')?.addEventListener('click', () => openDrawer('favorites'));
  $('#openCart')?.addEventListener('click', () => openDrawer('cart'));
  $('#closeDrawer')?.addEventListener('click', closeDrawer);
  $('#backdrop')?.addEventListener('click', closeDrawer);
  $('#closeModal')?.addEventListener('click', closeModal);
  $('#modal')?.addEventListener('click', e => {
    if (e.target.id === 'modal') closeModal();
  });
  $('#search')?.addEventListener('input', e => {
    search = e.target.value.trim().toLowerCase();
    render();
  });
  $('#sort')?.addEventListener('change', render);
  $('#filters')?.addEventListener('click', e => {
    const b = e.target.closest('[data-filter]');
    if (b) chooseFilter(b.dataset.filter);
  });
  $('#exploreCollection')?.addEventListener('click', () => chooseFilter('Todos'));

  if ($('#year')) $('#year').textContent = CONFIG.copyrightYear || new Date().getFullYear();
}

setTimeout(() => {
  $('#loader')?.classList.add('hidden');
  setTimeout(() => { $('#loader')?.remove(); }, 550);
}, 2000);

(async () => {
  await loadProducts();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Carrega o auth.js DEPOIS que o LovynniStore já existe
import('./auth.js').catch(err => console.error('Falha ao carregar auth.js:', err));