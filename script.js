/*******************************************
 Darshan Fashions - script.js (Products: Edit/Delete + Quantity)
********************************************/

/* ---------- LocalStorage Keys ---------- */
const DATA_KEY = "fashion_data_v_noSub_qty";
const PIN_KEY = "admin_pin";
const SEC_Q_KEY = "security_question";
const SEC_A_KEY = "security_answer";

/* ---------- App State ---------- */
let isAdmin = false;
let selectedCategoryId = null;
let editingProductId = null; // null = adding; string = editing

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const genId = () => "id_" + Math.random().toString(36).substr(2, 9);
const saveData = () => localStorage.setItem(DATA_KEY, JSON.stringify(data));

/* ---------- Load OR Initialize Data ---------- */
let data = JSON.parse(localStorage.getItem(DATA_KEY)) || {
  categories: [
    { id: genId(), name: "Nighties" },
    { id: genId(), name: "Petticoat" },
    { id: genId(), name: "Plazo" },
    { id: genId(), name: "Blouse" }
  ],
  products: []
};

/* Ensure Default PIN */
if (!localStorage.getItem(PIN_KEY)) {
  localStorage.setItem(PIN_KEY, "admin123");
}

/* ---------- Elements ---------- */
const viewHome = $("view-home");
const viewProducts = $("view-products");
const viewAbout = $("view-about");
const productsGrid = $("productsGrid");
const productsDropdown = $("productsDropdown");

const searchBox = $("searchBox");
const sortSelect = $("sortSelect");

/* Login */
const loginModal = $("loginModal");
const adminPinInput = $("adminPin");
const adminLoginBtn = $("adminLoginBtn");
const guestLoginBtn = $("guestLoginBtn");
const closeLoginBtn = $("closeLoginBtn");

/* Security Question (First Time Login) */
const securityModal = $("securityModal");
const securityQuestion = $("securityQuestion");
const securityAnswer = $("securityAnswer");
const saveSecurityBtn = $("saveSecurityBtn");

/* Change PIN */
const changePinModal = $("changePinModal");
const openChangePinModalBtn = $("openChangePinModal");
const changePinStep1 = $("changePinStep1");
const changePinStep2 = $("changePinStep2");
const securityQuestionText = $("securityQuestionText");
const securityAnswerVerify = $("securityAnswerVerify");
const newPinInput = $("newPinInput");
const verifySecurityAnswerBtn = $("verifySecurityAnswer");
const saveNewPinBtn = $("saveNewPin");
const cancelChangePinBtn = $("cancelChangePin");
const cancelNewPinBtn = $("cancelNewPin");

/* Category & Product Buttons */
const addCategoryBtn = $("addCategoryBtn");
const addProductBtn = $("addProductBtn");
const logoutBtn = $("logoutBtn");

/* Category Modal */
const categoryModal = $("categoryModal");
const newCategoryName = $("newCategoryName");
const saveCategoryBtn = $("saveCategoryBtn");
const closeCategoryBtn = $("closeCategoryBtn");

/* Product Modal */
const productModal = $("productModal");
const productCategory = $("productCategory");
const productName = $("productName");
const productMRP = $("productMRP");
const productPrice = $("productPrice");
const productImage = $("productImage");       // used only on create
const productImageFile = $("productImageFile");// used only on create
const productStock = $("productStock");       // legacy (not used now, but we keep for compatibility)
const productQty = $("productQty");           // OPTIONAL input; default to 1 if missing
const saveProductBtn = $("saveProductBtn");
const closeProductBtn = $("closeProductBtn");

/* Image Preview */
const imagePreviewModal = $("imagePreviewModal");
const previewImage = $("previewImage");
const closeImagePreview = $("closeImagePreview");

/* Year in Footer */
const yearEl = $("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

/***********************
 * Navigation
 ***********************/
function showView(section) {
  viewHome.style.display = "none";
  viewProducts.style.display = "none";
  viewAbout.style.display = "none";
  section.style.display = "block";
}

document.querySelectorAll("nav a").forEach((a) =>
  a.addEventListener("click", (e) => {
    const route = a.getAttribute("data-route");
    if (a.id === "loginLink") {
      e.preventDefault();
      loginModal.classList.add("open");
      return;
    }
    if (route === "home") showView(viewHome);
    if (route === "products") {
      showView(viewProducts);
      renderProducts();
    }
    if (route === "about") showView(viewAbout);
  })
);

/***********************
 * Admin Login
 ***********************/
adminLoginBtn.addEventListener("click", () => {
  const pin = adminPinInput.value;
  if (pin === localStorage.getItem(PIN_KEY)) {
    isAdmin = true;
    loginModal.classList.remove("open");

    // First time security question
    if (!localStorage.getItem(SEC_Q_KEY)) {
      securityModal.classList.add("open");
    } else {
      enableAdminControls();
    }
  } else {
    alert("Incorrect PIN");
  }
});

guestLoginBtn.addEventListener("click", () => {
  isAdmin = false;
  loginModal.classList.remove("open");
});

closeLoginBtn.addEventListener("click", () => {
  loginModal.classList.remove("open");
});

/***********************
 * Security Question Setup
 ***********************/
saveSecurityBtn.addEventListener("click", () => {
  const q = securityQuestion.value;
  const ans = securityAnswer.value.trim().toLowerCase();
  if (!q || !ans) {
    alert("Please select a question and enter answer!");
    return;
  }
  localStorage.setItem(SEC_Q_KEY, q);
  localStorage.setItem(SEC_A_KEY, ans);
  securityModal.classList.remove("open");
  enableAdminControls();
});

/***********************
 * Enable Admin Controls
 ***********************/
function enableAdminControls() {
  addCategoryBtn.style.display = "inline-block";
  addProductBtn.style.display = "inline-block";
  logoutBtn.style.display = "inline-block";
}

logoutBtn.addEventListener("click", () => {
  isAdmin = false;
  addCategoryBtn.style.display = "none";
  addProductBtn.style.display = "none";
  logoutBtn.style.display = "none";
});

/***********************
 * Change PIN (with Security)
 ***********************/
openChangePinModalBtn.addEventListener("click", () => {
  loginModal.classList.remove("open");
  const qKey = localStorage.getItem(SEC_Q_KEY);
  const questions = {
    dog: "What is your dog name?",
    nickname: "What is your nick name?",
    surname: "What is your surname?",
    village: "What is your village name?"
  };
  securityQuestionText.textContent = questions[qKey] || "Security Question not set";
  changePinStep1.style.display = "block";
  changePinStep2.style.display = "none";
  changePinModal.classList.add("open");
});

cancelChangePinBtn.addEventListener("click", () => {
  changePinModal.classList.remove("open");
});

verifySecurityAnswerBtn.addEventListener("click", () => {
  const ans = securityAnswerVerify.value.trim().toLowerCase();
  if (ans === localStorage.getItem(SEC_A_KEY)) {
    changePinStep1.style.display = "none";
    changePinStep2.style.display = "block";
  } else {
    alert("Incorrect answer!");
  }
});

cancelNewPinBtn.addEventListener("click", () => {
  changePinModal.classList.remove("open");
});

saveNewPinBtn.addEventListener("click", () => {
  const newPin = newPinInput.value.trim();
  if (!newPin) return alert("PIN cannot be empty!");
  localStorage.setItem(PIN_KEY, newPin);
  alert("✅ PIN changed successfully!");
  changePinModal.classList.remove("open");
});

/***********************
 * Category Management
 ***********************/
addCategoryBtn.addEventListener("click", () => {
  categoryModal.classList.add("open");
});
closeCategoryBtn.addEventListener("click", () => {
  categoryModal.classList.remove("open");
});

saveCategoryBtn.addEventListener("click", () => {
  const name = newCategoryName.value.trim();
  if (!name) return alert("Please enter a category name");
  data.categories.push({ id: genId(), name });
  saveData();
  newCategoryName.value = "";
  categoryModal.classList.remove("open");
  renderHome();
  renderProductsDropdown();
});

function renderHome() {
  viewHome.innerHTML = `
    <h2>Browse Categories</h2>
    <div class="grid">
      ${data.categories
        .map(
          (cat) => `
        <div class="card">
          <img src="https://dummyimage.com/600x400/f3f4f6/555&text=${encodeURIComponent(
            cat.name
          )}" class="thumb" onclick="openCategory('${cat.id}')">
          <div class="card-body">
            ${cat.name}
            ${
              isAdmin
                ? `<button class="btn" style="float:right;background:red;color:white;"
                     onclick="deleteCategory('${cat.id}')">Delete</button>`
                : ""
            }
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

window.openCategory = function (catId) {
  selectedCategoryId = catId;
  showView(viewProducts);
  renderProducts();
};

window.deleteCategory = function (catId) {
  if (!confirm("Delete this category and all products under it?")) return;
  data.categories = data.categories.filter((c) => c.id !== catId);
  data.products = data.products.filter((p) => p.categoryId !== catId);
  saveData();
  renderHome();
  renderProductsDropdown();
  renderProducts();
};

/***********************
 * Product Management (Add / Edit / Delete)
 ***********************/
addProductBtn.addEventListener("click", () => {
  // Create mode
  editingProductId = null;
  productModal.classList.add("open");
  productCategory.innerHTML =
    `<option value="">-- Select Category --</option>` +
    data.categories.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");

  // Reset form
  productName.value = "";
  productMRP.value = "";
  productPrice.value = "";
  if (productQty) productQty.value = "1"; // default 1
  if (productImage) productImage.value = "";
  if (productImageFile) productImageFile.value = "";
  if (productStock) productStock.value = "true"; // legacy, not used

  // Enable image inputs in create mode
  if (productImage) productImage.disabled = false;
  if (productImageFile) productImageFile.disabled = false;
});

closeProductBtn.addEventListener("click", () => {
  productModal.classList.remove("open");
  editingProductId = null;
});

saveProductBtn.addEventListener("click", () => {
  if (!productCategory.value || !productName.value.trim() || !productMRP.value) {
    alert("Please enter Category, Product Name, and MRP!");
    return;
  }

  // EDIT mode
  if (editingProductId) {
    const p = data.products.find(pr => pr.id === editingProductId);
    if (!p) return;

    p.name = productName.value.trim();
    p.categoryId = productCategory.value;
    p.mrp = Number(productMRP.value);
    p.price = Number(productPrice.value) || 0;
    const qty = productQty ? Number(productQty.value || 0) : 1;
    p.quantity = Math.max(0, qty);

    saveData();
    productModal.classList.remove("open");
    editingProductId = null;
    alert("✅ Product updated!");
    renderProducts();
    return;
  }

  // CREATE mode
  const finalize = (imgSrc) => {
    const mrp = Number(productMRP.value);
    const special = Number(productPrice.value) || 0;
    const qty = productQty ? Number(productQty.value || 1) : 1;

    data.products.push({
      id: genId(),
      name: productName.value.trim(),
      categoryId: productCategory.value,
      mrp: mrp,
      price: special > 0 && special < mrp ? special : 0, // 0 = no special price
      quantity: Math.max(0, qty),
      img: imgSrc
    });
    saveData();

    productModal.classList.remove("open");
    alert("✅ Product added successfully!");
    renderProducts();
  };

  // Handle image (file or URL)
  const file = productImageFile && productImageFile.files ? productImageFile.files[0] : null;
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => finalize(e.target.result);
    reader.readAsDataURL(file);
  } else {
    const url =
      (productImage && productImage.value.trim()) ||
      `https://dummyimage.com/600x600/f3f4f6/555&text=${encodeURIComponent(productName.value)}`;
    finalize(url);
  }
});

window.deleteProduct = function (id) {
  if (!confirm("Delete this product?")) return;
  data.products = data.products.filter(p => p.id !== id);
  saveData();
  renderProducts();
};

window.editProduct = function (id) {
  const p = data.products.find(pr => pr.id === id);
  if (!p) return;
  editingProductId = id;

  // Open modal & prefill
  productModal.classList.add("open");
  productCategory.innerHTML =
    `<option value="">-- Select Category --</option>` +
    data.categories.map((c) =>
      `<option value="${c.id}" ${c.id === p.categoryId ? "selected" : ""}>${c.name}</option>`
    ).join("");

  productName.value = p.name;
  productMRP.value = p.mrp;
  productPrice.value = p.price || 0;
  if (productQty) productQty.value = typeof p.quantity === "number" ? p.quantity : (p.inStock ? 1 : 0);

  // Disable image inputs in edit mode (image not editable)
  if (productImage) productImage.disabled = true;
  if (productImageFile) productImageFile.disabled = true;
};

/***********************
 * Render Products
 ***********************/
function renderProducts() {
  let list = data.products.slice();
  if (selectedCategoryId) {
    list = list.filter((p) => p.categoryId === selectedCategoryId);
  }

  const q = (searchBox.value || "").toLowerCase();
  if (q) {
    list = list.filter((p) => p.name.toLowerCase().includes(q));
  }

  const sort = sortSelect.value;
  const effectivePrice = (p) => (p.price && p.price > 0 ? p.price : p.mrp || 0);
  const effectiveQty = (p) => (typeof p.quantity === "number" ? p.quantity : (p.inStock ? 1 : 0));

  if (sort === "priceAsc") list.sort((a, b) => effectivePrice(a) - effectivePrice(b));
  if (sort === "priceDesc") list.sort((a, b) => effectivePrice(b) - effectivePrice(a));
  if (sort === "available") list.sort((a, b) => (effectiveQty(b) > 0) - (effectiveQty(a) > 0));

  productsGrid.innerHTML = list
    .map((p) => {
      const catName = data.categories.find((c) => c.id === p.categoryId)?.name || "Category";
      const mrp = Number(p.mrp || 0);
      const special = Number(p.price || 0);
      const hasSpecial = special > 0 && special < mrp;
      const qty = effectiveQty(p);
      const inStock = qty > 0;

      return `
      <div class="product">
        <img src="${p.img}" class="thumb" onclick="openImagePreview('${p.img}')">
        <div class="meta">
          <strong>${p.name}</strong>
          <div class="muted">${catName}</div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
            <div>
              <span class="price price-mrp">₹${mrp}</span>
              ${hasSpecial ? `<span class="price-special">₹${special}</span>` : ""}
            </div>
            <span class="badge ${inStock ? "ok" : "na"}">
              ${inStock ? `Available (${qty})` : "Out of Stock"}
            </span>
          </div>

          <div style="display:flex; gap:8px; margin-top:10px;">
            ${
              isAdmin
                ? `<button class="btn" onclick="editProduct('${p.id}')">Edit</button>
                   <button class="btn" style="background:#ef4444;color:#fff" onclick="deleteProduct('${p.id}')">Delete</button>`
                : ""
            }
            ${
              inStock
                ? `<a class="btn" style="flex:1;text-align:center;"
                     href="https://wa.me/918179771029?text=${encodeURIComponent(
                       `I want to enquire about ${p.name} priced at ₹${hasSpecial ? special : mrp}`
                     )}" target="_blank">Order on WhatsApp</a>`
                : `<span style="flex:1"></span>`
            }
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  if (!list.length) {
    productsGrid.innerHTML = `<p>No products found.</p>`;
  }
}

/***********************
 * Image Preview & Zoom
 ***********************/
window.openImagePreview = function (src) {
  previewImage.src = src;
  previewImage.classList.remove("zoomed");
  imagePreviewModal.classList.add("open");
};

closeImagePreview.addEventListener("click", () => {
  imagePreviewModal.classList.remove("open");
});

previewImage.addEventListener("click", () => {
  previewImage.classList.toggle("zoomed");
});

imagePreviewModal.addEventListener("click", (e) => {
  if (e.target === imagePreviewModal) {
    imagePreviewModal.classList.remove("open");
  }
});

/***********************
 * Search & Sort
 ***********************/
searchBox.addEventListener("input", renderProducts);
sortSelect.addEventListener("change", renderProducts);

/***********************
 * Category Menu (Top Products Dropdown)
 ***********************/
function renderProductsDropdown() {
  productsDropdown.innerHTML = data.categories
    .map((c) => `<a href="#products" onclick="openCategory('${c.id}')">${c.name}</a>`)
    .join("");
}

/***********************
 * Initialize
 ***********************/
function renderHome() {
  viewHome.innerHTML = `
    <h2>Browse Categories</h2>
    <div class="grid">
      ${data.categories
        .map(
          (cat) => `
        <div class="card">
          <img src="https://dummyimage.com/600x400/f3f4f6/555&text=${encodeURIComponent(
            cat.name
          )}" class="thumb" onclick="openCategory('${cat.id}')">
          <div class="card-body">
            ${cat.name}
            ${
              isAdmin
                ? `<button class="btn" style="float:right;background:red;color:white;"
                     onclick="deleteCategory('${cat.id}')">Delete</button>`
                : ""
            }
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

function init() {
  renderHome();
  renderProductsDropdown();
  showView(viewHome);
}
init();

console.log("✅ Script Loaded (Qty + Edit/Delete)");
