/*******************************************
 Darshan Fashions – Supabase Edition
 - Products, Categories, Admin PIN/Security via Supabase
 - Images via Supabase Storage (product-images)
 - Color (multi) + Size (multi) selection with WhatsApp order
********************************************/

/* ---------- Supabase Client ---------- */
const supabase = window.supabase.createClient(
  window.__SUPABASE_URL__,
  window.__SUPABASE_ANON_KEY__
);
const BUCKET = window.__SUPABASE_BUCKET__;

/* ---------- App State ---------- */
let isAdmin = false;
let selectedCategoryId = null;
let editingProductId = null;
let categoriesCache = [];   // [{id,name}]
let productsCache = [];     // products with joined category if needed
let adminConfig = null;     // {id, admin_pin, security_question, security_answer}

/* Per-product selections */
const selectedColors = {};  // { [productId]: "Black" }
const selectedSizes  = {};  // { [productId]: "XL" }

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const yearEl = $("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

function money(n) { return Number(n || 0); }
function sanitize(str) { return (str || "").toString().trim(); }

/* Split a comma/pipe separated string into trimmed, unique options */
function parseOptions(str) {
  if (!str) return [];
  return Array.from(
    new Set(
      str
        .split(/[,|]/g)
        .map(s => sanitize(s))
        .filter(Boolean)
    )
  );
}

// Helper to show/hide loading spinner
function showLoading() {
  $("loadingModal").classList.add("open");
}
function hideLoading() {
  $("loadingModal").classList.remove("open");
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
const productImage = $("productImage");
const productImageFile = $("productImageFile");
const productStock = $("productStock"); // derived from quantity
const productQty = $("productQty");
const saveProductBtn = $("saveProductBtn");
const closeProductBtn = $("closeProductBtn");
/* New fields for options (comma- or | -separated) */
const productColor = $("productColor");   // e.g. "Black, White, Cream"
const productSizes = $("productSizes");   // e.g. "S, M, L, XL"

/* Image Preview */
const imagePreviewModal = $("imagePreviewModal");
const previewImage = $("previewImage");
const closeImagePreview = $("closeImagePreview");

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
  a.addEventListener("click", async (e) => {
    const route = a.getAttribute("data-route");
    if (a.id === "loginLink") {
      e.preventDefault();
      loginModal.classList.add("open");
      return;
    }
    if (route === "home") showView(viewHome);
    if (route === "products") {
      showView(viewProducts);
      await fetchProducts();
      renderProducts();
    }
    if (route === "about") showView(viewAbout);
  })
);

/***********************
 * Supabase – Admin Config
 ***********************/
async function ensureAdminConfigRow() {
  const { data, error } = await supabase
    .from("admin_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error reading admin_config:", error);
    return;
  }

  if (!data) {
    const { error: insErr } = await supabase
      .from("admin_config")
      .insert([{ admin_pin: "admin123", security_question: null, security_answer: null }]);
    if (insErr) console.error("Error creating default admin_config:", insErr);
    adminConfig = { admin_pin: "admin123", security_question: null, security_answer: null };
  } else {
    adminConfig = data;
  }
}

async function refreshAdminConfig() {
  const { data, error } = await supabase
    .from("admin_config")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (!error) adminConfig = data;
}

async function adminLoginFromSupabase(pin) {
  await refreshAdminConfig();
  if (!adminConfig) return false;
  return sanitize(pin) === sanitize(adminConfig.admin_pin);
}

async function setSecurityQuestion(qKey, ans) {
  await refreshAdminConfig();
  const { id } = adminConfig;

  const { error } = await supabase
    .from("admin_config")
    .update({
      security_question: qKey,
      security_answer: sanitize(ans).toLowerCase()
    })
    .eq("id", id);

  if (error) {
    console.error("Error saving security question:", error);
    // Removed alert
  } else {
    // Removed alert
  }
}

async function changeAdminPin(newPin) {
  await refreshAdminConfig();
  const { id } = adminConfig;

  const { error } = await supabase
    .from("admin_config")
    .update({
      admin_pin: sanitize(newPin)
    })
    .eq("id", id);

  if (error) {
    console.error("❌ Error updating PIN:", error);
    // Removed alert
  } else {
    // Removed alert
  }
}

/***********************
 * Supabase – Categories
 ***********************/
async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching categories:", error);
    categoriesCache = [];
    return;
  }
  categoriesCache = data || [];
  renderHome();
  renderProductsDropdown();
}

async function addCategoryToSupabase(name) {
  const { error } = await supabase
    .from("categories")
    .insert([{ name: sanitize(name) }]);
  if (error) {
    alert("Failed to add category!");
    console.error(error);
  }
  await fetchCategories();
}

async function deleteCategoryFromSupabase(catId) {
  // Use custom modal or keep standard confirm for simplicity here
  if (!window.confirm("Delete this category and all products under it?")) return;
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", catId);
  if (error) {
    alert("Failed to delete category!");
    console.error(error);
  }
  await fetchCategories();
  await fetchProducts();
}

async function fetchProducts() {
  // include 'color' and 'sizes' in the select list
  const { data, error } = await supabase
    .from("products")
    .select("id,name,category_id,mrp,price,quantity,img_url,color,sizes, categories(name)")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching products:", error);
    productsCache = [];
    return;
  }
  productsCache = data || [];
}

async function addProductToSupabase({ name, categoryId, mrp, price, quantity, imgUrl, color, sizes }) {
  const payload = {
    name: sanitize(name),
    category_id: categoryId,
    mrp: money(mrp),
    price: money(price),
    quantity: Number.isFinite(quantity) ? quantity : 1,
    img_url: imgUrl,
    color: sanitize(color),             // CSV for colors
    sizes: sanitize(sizes)              // CSV for sizes
  };

  const { error } = await supabase.from("products").insert([payload]);
  if (error) {
    console.error(error);
    return { ok: false, message: "Failed to add product!" };
  }
  return { ok: true, message: "✅ Product added successfully!" };
}

async function updateProductInSupabase(id, { name, categoryId, mrp, price, quantity, color, sizes }) {
  const payload = {
    name: sanitize(name),
    category_id: categoryId,
    mrp: money(mrp),
    price: money(price),
    quantity: Number.isFinite(quantity) ? quantity : 1,
    color: sanitize(color),
    sizes: sanitize(sizes)
  };
  const { error } = await supabase.from("products").update(payload).eq("id", id);
  if (error) {
    console.error(error);
    return { ok: false, message: "Failed to update product!" };
  }
  return { ok: true, message: "✅ Product updated!" };
}

async function deleteProductFromSupabase(id) {
  // Use custom modal or keep standard confirm for simplicity here
  if (!window.confirm("Delete this product?")) return;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    alert("Failed to delete product!");
    console.error(error);
  }
  await fetchProducts();
  renderProducts();
}

/***********************
 * Supabase – Storage (Images)
 ***********************/
async function uploadImageToSupabase(file) {
  const fileName = `products/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(fileName, file);
  if (error) {
    console.error("Upload error:", error);
    alert("Failed to upload image!");
    return null;
  }
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return urlData.publicUrl;
}

/***********************
 * Admin Login Flow
 ***********************/
adminLoginBtn.addEventListener("click", async () => {
  const pin = adminPinInput.value;
  const ok = await adminLoginFromSupabase(pin);
  if (ok) {
    isAdmin = true;
    loginModal.classList.remove("open");

    if (!adminConfig || !adminConfig.security_question) {
      securityModal.classList.add("open");
    } else {
      enableAdminControls();
    }
  } else {
    // Note: Kept standard alert here as this is outside the main app flow
    window.alert("Incorrect PIN");
  }
});

guestLoginBtn.addEventListener("click", () => {
  isAdmin = false;
  loginModal.classList.remove("open");
});

closeLoginBtn.addEventListener("click", () => {
  loginModal.classList.remove("open");
});

saveSecurityBtn.addEventListener("click", async () => {
  const q = securityQuestion.value;
  const ans = securityAnswer.value;
  if (!q || !sanitize(ans)) {
    window.alert("Please select a question and enter answer!");
    return;
  }
  await setSecurityQuestion(q, ans);
  await refreshAdminConfig();
  securityModal.classList.remove("open");
  enableAdminControls();
});

/***********************
 * Enable/Disable Admin Controls
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
openChangePinModalBtn.addEventListener("click", async () => {
  loginModal.classList.remove("open");
  await refreshAdminConfig();
  const qKey = adminConfig?.security_question;
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

verifySecurityAnswerBtn.addEventListener("click", async () => {
  const ans = sanitize(securityAnswerVerify.value).toLowerCase();
  await refreshAdminConfig();
  if (adminConfig && ans && ans === (adminConfig.security_answer || "")) {
    changePinStep1.style.display = "none";
    changePinStep2.style.display = "block";
  } else {
    window.alert("Incorrect answer!");
  }
});

cancelNewPinBtn.addEventListener("click", () => {
  changePinModal.classList.remove("open");
});

saveNewPinBtn.addEventListener("click", async () => {
  const newPin = sanitize(newPinInput.value);
  if (!newPin) {
    window.alert("PIN cannot be empty!");
    return;
  }
  await changeAdminPin(newPin);
  changePinModal.classList.remove("open");
});

/***********************
 * Category Management
 ***********************/
addCategoryBtn.addEventListener("click", () => {
  if (!isAdmin) return window.alert("Admin only.");
  categoryModal.classList.add("open");
});
closeCategoryBtn.addEventListener("click", () => {
  categoryModal.classList.remove("open");
});

saveCategoryBtn.addEventListener("click", async () => {
  if (!isAdmin) return window.alert("Admin only.");
  const name = sanitize(newCategoryName.value);
  if (!name) return window.alert("Please enter a category name");
  await addCategoryToSupabase(name);
  newCategoryName.value = "";
  categoryModal.classList.remove("open");
});

/***********************
 * Product Management (Add / Edit / Delete)
 ***********************/
addProductBtn.addEventListener("click", async () => {
  if (!isAdmin) return window.alert("Admin only.");
  editingProductId = null;
  productModal.classList.add("open");

  // Populate categories
  productCategory.innerHTML =
    `<option value="">-- Select Category --</option>` +
    categoriesCache.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");

  // Reset form
  productName.value = "";
  productMRP.value = "";
  productPrice.value = "";
  productQty.value = "1";
  productImage.value = "";
  productImageFile.value = "";
  productStock.value = "true";
  if (productColor) productColor.value = "";   // CSV for colors
  if (productSizes) productSizes.value = "";   // CSV for sizes

  // Enable image inputs in create mode
  productImage.disabled = false;
  productImageFile.disabled = false;
});

closeProductBtn.addEventListener("click", () => {
  productModal.classList.remove("open");
  editingProductId = null;
});

saveProductBtn.addEventListener("click", async () => {
  if (!isAdmin) return window.alert("Admin only.");

  if (!productCategory.value || !sanitize(productName.value) || !productMRP.value) {
    window.alert("Please enter Category, Product Name, and MRP!");
    return;
  }

  showLoading(); // Show loading spinner

  let result = { ok: false, message: "" };

  // EDIT mode
  if (editingProductId) {
    result = await updateProductInSupabase(editingProductId, {
      name: productName.value,
      categoryId: productCategory.value,
      mrp: productMRP.value,
      price: productPrice.value || 0,
      quantity: Number(productQty.value || 0),
      color: productColor ? productColor.value : "",
      sizes: productSizes ? productSizes.value : ""
    });
    
  } else {
    // CREATE mode
    let imgUrl = "";
    const file = productImageFile && productImageFile.files ? productImageFile.files[0] : null;
    if (file) {
      const uploadUrl = await uploadImageToSupabase(file);
      if (!uploadUrl) {
        hideLoading();
        return; // upload failed (alert handled inside uploadImageToSupabase)
      }
      imgUrl = uploadUrl;
    } else if (sanitize(productImage.value)) {
      imgUrl = sanitize(productImage.value);
    } else {
      // Dummy image fallback
      imgUrl = `https://dummyimage.com/600x600/f3f4f6/555&text=${encodeURIComponent(productName.value)}`;
    }

    result = await addProductToSupabase({
      name: productName.value,
      categoryId: productCategory.value,
      mrp: productMRP.value,
      price: productPrice.value || 0,
      quantity: Number(productQty.value || 1),
      imgUrl,
      color: productColor ? productColor.value : "",
      sizes: productSizes ? productSizes.value : ""
    });
  }

  hideLoading(); // Hide loading spinner

  if (result.ok) {
    productModal.classList.remove("open");
    window.alert(result.message);
    await fetchProducts();
    renderProducts();
  } else {
    // Show error message if not ok
    window.alert(result.message);
  }
});

window.deleteProduct = async function (id) {
  if (!isAdmin) return window.alert("Admin only.");
  await deleteProductFromSupabase(id);
};

window.editProduct = function (id) {
  if (!isAdmin) return window.alert("Admin only.");
  const p = productsCache.find(pr => String(pr.id) === String(id));
  if (!p) return;
  editingProductId = id;

  // Open modal & prefill
  productModal.classList.add("open");
  productCategory.innerHTML =
    `<option value="">-- Select Category --</option>` +
    categoriesCache.map((c) =>
      `<option value="${c.id}" ${c.id === p.category_id ? "selected" : ""}>${c.name}</option>`
    ).join("");

  productName.value = p.name;
  productMRP.value = p.mrp;
  productPrice.value = p.price || 0;
  productQty.value = typeof p.quantity === "number" ? p.quantity : 1;
  if (productColor) productColor.value = p.color || "";
  if (productSizes) productSizes.value = p.sizes || "";

  // Disable image inputs in edit mode (image not editable in this simple flow)
  productImage.disabled = true;
  productImageFile.disabled = true;
};

/***********************
 * Color/Size selection + WhatsApp (functions are used in Part 2)
 ***********************/
window.selectColor = function (productId, color, element) {
  selectedColors[productId] = color;
  
  // 1. Remove 'selected' class from all color buttons for this product
  const container = element.closest('.meta');
  container.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('selected'));

  // 2. Add 'selected' class to the clicked button
  element.classList.add('selected');

  // Removed alert()
};

window.selectSize = function (productId, size, element) {
  selectedSizes[productId] = size;
  
  // 1. Remove 'selected' class from all size buttons for this product
  const container = element.closest('.meta');
  container.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('selected'));

  // 2. Add 'selected' class to the clicked button
  element.classList.add('selected');

  // Removed alert()
};

window.openWhatsApp = function (productId) {
  const p = productsCache.find(x => String(x.id) === String(productId));
  if (!p) return;

  const mrp = money(p.mrp);
  const special = money(p.price);
  const hasSpecial = special > 0 && special < mrp;

  // No longer mandatory, check if they exist
  const chosenColor = selectedColors[productId] || "Not Selected (Customer needs to choose)";
  const chosenSize  = selectedSizes[productId]  || "Not Selected (Customer needs to choose)";

  const msg =
    `🛍 *Product Enquiry*\n` +
    `Name: ${p.name}\n` +
    `Color: ${chosenColor}\n` +
    `Size: ${chosenSize}\n` +
    `Price: ₹${hasSpecial ? special : mrp}\n` +
    `Image: ${p.img_url}\n\n` +
    `Please confirm availability.`;

  const url = `https://wa.me/918179771029?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
};

/***********************
 * Render (continues in Part 2)
 ***********************/
/***********************
 * Render
 ***********************/
function renderHome() {
  $("view-home").innerHTML = `
    <h2>Browse Categories</h2>
    <div class="grid">
      ${categoriesCache
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
                     onclick="deleteCategoryFromSupabase('${cat.id}')">Delete</button>`
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

function renderProductsDropdown() {
  productsDropdown.innerHTML = categoriesCache
    .map((c) => `<a href="#products" onclick="openCategory('${c.id}')">${c.name}</a>`)
    .join("");
}

window.openCategory = async function (catId) {
  selectedCategoryId = catId;
  showView(viewProducts);
  await fetchProducts();
  renderProducts();
};

function renderProducts() {
  let list = productsCache.slice();

  // Category filter
  if (selectedCategoryId) {
    list = list.filter((p) => p.category_id === selectedCategoryId);
  }

  // Search filter
  const q = (searchBox.value || "").toLowerCase();
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));

  // Sorting
  const effectivePrice = (p) => (p.price && p.price > 0 ? p.price : p.mrp || 0);
  const effectiveQty = (p) => (typeof p.quantity === "number" ? p.quantity : 0);
  const sort = sortSelect.value;
  if (sort === "priceAsc") list.sort((a, b) => effectivePrice(a) - effectivePrice(b));
  if (sort === "priceDesc") list.sort((a, b) => effectivePrice(b) - effectivePrice(a));
  if (sort === "available") list.sort((a, b) => (effectiveQty(b) > 0) - (effectiveQty(a) > 0));

  // Build UI
  productsGrid.innerHTML = list
    .map((p) => {
      const catName =
        p.categories?.name ||
        (categoriesCache.find(c => c.id === p.category_id)?.name) ||
        "Category";
      const mrp = money(p.mrp);
      const special = money(p.price);
      const hasSpecial = special > 0 && special < mrp;
      const qty = effectiveQty(p);
      const inStock = qty > 0;

      // Parse multi-colors and sizes CSVs
      const colorOptions = parseOptions(p.color);
      const sizeOptions  = parseOptions(p.sizes);

      // Pre-select first option if nothing is selected yet
      if (colorOptions.length && !selectedColors[p.id]) {
        selectedColors[p.id] = colorOptions[0];
      }
      if (sizeOptions.length && !selectedSizes[p.id]) {
        selectedSizes[p.id] = sizeOptions[0];
      }


      return `
        <div class="product">
          <img src="${p.img_url}" class="thumb" onclick="openImagePreview('${p.img_url}')">
          <div class="meta">
            <strong>${p.name}</strong>
            <div class="muted">${catName}</div>

            <!-- COLORS -->
            ${colorOptions.length ? `
              <div style="margin-top:6px;">
                <strong>Color:</strong>
                <div class="color-options-container" style="margin-top:4px;">
                  ${colorOptions
                    .map(color => `
                      <button 
                        class="btn color-btn ${selectedColors[p.id] === color ? 'selected' : ''}" 
                        onclick="selectColor('${p.id}', '${color}', this)">
                        ${color}
                      </button>
                    `)
                    .join('')}
                </div>
              </div>
            ` : ""}

            <!-- SIZES -->
            ${sizeOptions.length ? `
              <div style="margin-top:6px;">
                <strong>Size:</strong>
                <div class="color-options-container" style="margin-top:4px;">
                  ${sizeOptions
                    .map(size => `
                      <button
                        class="btn size-btn ${selectedSizes[p.id] === size ? 'selected' : ''}"
                        onclick="selectSize('${p.id}', '${size}', this)">
                        ${size}
                      </button>
                    `)
                    .join('')}
                </div>
              </div>
            ` : ""}

            <!-- Price and Stock -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
              <div>
                <span class="price price-mrp">₹${mrp}</span>
                ${hasSpecial ? `<span class="price-special">₹${special}</span>` : ""}
              </div>
              <span class="badge ${inStock ? "ok" : "na"}">
                ${inStock ? `Available (${qty})` : "Out of Stock"}
              </span>
            </div>

            <!-- Action Buttons -->
            <div style="display:flex; gap:8px; margin-top:10px;">
              ${
                isAdmin
                  ? `
                    <button class="btn" onclick="editProduct('${p.id}')">Edit</button>
                    <button class="btn" style="background:#ef4444;color:#fff;" onclick="deleteProductFromSupabase('${p.id}')">
                      Delete
                    </button>
                  `
                  : ""
              }
              ${
                inStock
                  ? `<button class="btn primary" style="flex:1;" onclick="openWhatsApp('${p.id}')">
                      Order on WhatsApp
                    </button>`
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
 * Initialize
 ***********************/
async function init() {
  await ensureAdminConfigRow();
  await fetchCategories();
  await fetchProducts();
  renderHome();
  renderProductsDropdown();
  showView(viewHome);
}
init();

console.log("✅ Supabase App Loaded with Color & Size Support and Responsive Fixes");