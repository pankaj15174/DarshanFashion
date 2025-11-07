/*******************************************
 Darshan Fashions – Supabase Edition
 - Products, Categories, Admin PIN/Security via Supabase
 - Images via Supabase Storage (product-images)
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
let categoriesCache = [];  // [{id,name}]
let productsCache = [];    // products result with joined category if needed
let adminConfig = null;    // {admin_pin, security_question, security_answer}

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const yearEl = $("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

function money(n) { return Number(n || 0); }
function sanitize(str) { return (str || "").toString().trim(); }

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
const productStock = $("productStock"); // not used in db, only derived from quantity
const productQty = $("productQty");
const saveProductBtn = $("saveProductBtn");
const closeProductBtn = $("closeProductBtn");

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
  // Try to load the row
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
    // Insert default
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
  await refreshAdminConfig(); // fetch latest row
  const { id } = adminConfig; // get the actual UUID

  const { error } = await supabase
    .from("admin_config")
    .update({
      security_question: qKey,
      security_answer: sanitize(ans).toLowerCase()
    })
    .eq("id", id); // ✅ update ONLY row with this ID

  if (error) {
    console.error("Error saving security question:", error);
    alert("❌ Failed to save security question!");
  } else {
    alert("✅ Security question saved successfully!");
  }
}

// ✅ Update Admin PIN securely using ID
async function changeAdminPin(newPin) {
  await refreshAdminConfig();   // get the latest data from DB
  const { id } = adminConfig;  // extract row ID

  const { error } = await supabase
    .from("admin_config")
    .update({
      admin_pin: sanitize(newPin)   // sanitize before saving
    })
    .eq("id", id);  // ✅ updates exact row only

  if (error) {
    console.error("❌ Error updating PIN:", error);
    alert("Failed to change PIN!");
  } else {
    alert("✅ PIN updated successfully!");
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
  if (!confirm("Delete this category and all products under it?")) return;
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

/***********************
 * Supabase – Products
 ***********************/
async function fetchProducts() {
  // Join category name for rendering convenience
  const { data, error } = await supabase
    .from("products")
    .select("id,name,category_id,mrp,price,quantity,img_url, categories(name)")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching products:", error);
    productsCache = [];
    return;
  }
  productsCache = data || [];
}

async function addProductToSupabase({ name, categoryId, mrp, price, quantity, imgUrl }) {
  const payload = {
    name: sanitize(name),
    category_id: categoryId,
    mrp: money(mrp),
    price: money(price),
    quantity: Number.isFinite(quantity) ? quantity : 1,
    img_url: imgUrl
  };

  const { error } = await supabase.from("products").insert([payload]);
  if (error) {
    alert("Failed to add product!");
    console.error(error);
    return false;
  }
  return true;
}

async function updateProductInSupabase(id, { name, categoryId, mrp, price, quantity }) {
  const payload = {
    name: sanitize(name),
    category_id: categoryId,
    mrp: money(mrp),
    price: money(price),
    quantity: Number.isFinite(quantity) ? quantity : 1
  };
  const { error } = await supabase.from("products").update(payload).eq("id", id);
  if (error) {
    alert("Failed to update product!");
    console.error(error);
    return false;
  }
  return true;
}

async function deleteProductFromSupabase(id) {
  if (!confirm("Delete this product?")) return;
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

    // First-time security question
    if (!adminConfig || !adminConfig.security_question) {
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

saveSecurityBtn.addEventListener("click", async () => {
  const q = securityQuestion.value;
  const ans = securityAnswer.value;
  if (!q || !sanitize(ans)) {
    alert("Please select a question and enter answer!");
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
    alert("Incorrect answer!");
  }
});

cancelNewPinBtn.addEventListener("click", () => {
  changePinModal.classList.remove("open");
});

saveNewPinBtn.addEventListener("click", async () => {
  const newPin = sanitize(newPinInput.value);
  if (!newPin) {
    alert("PIN cannot be empty!");
    return;
  }

  await changeAdminPin(newPin);     // ✅ Using updated logic
  changePinModal.classList.remove("open");
});

/***********************
 * Category Management
 ***********************/
addCategoryBtn.addEventListener("click", () => {
  if (!isAdmin) return alert("Admin only.");
  categoryModal.classList.add("open");
});
closeCategoryBtn.addEventListener("click", () => {
  categoryModal.classList.remove("open");
});

saveCategoryBtn.addEventListener("click", async () => {
  if (!isAdmin) return alert("Admin only.");
  const name = sanitize(newCategoryName.value);
  if (!name) return alert("Please enter a category name");
  await addCategoryToSupabase(name);
  newCategoryName.value = "";
  categoryModal.classList.remove("open");
});

/***********************
 * Product Management (Add / Edit / Delete)
 ***********************/
addProductBtn.addEventListener("click", async () => {
  if (!isAdmin) return alert("Admin only.");
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

  // Enable image inputs in create mode
  productImage.disabled = false;
  productImageFile.disabled = false;
});

closeProductBtn.addEventListener("click", () => {
  productModal.classList.remove("open");
  editingProductId = null;
});

saveProductBtn.addEventListener("click", async () => {
  if (!isAdmin) return alert("Admin only.");

  if (!productCategory.value || !sanitize(productName.value) || !productMRP.value) {
    alert("Please enter Category, Product Name, and MRP!");
    return;
  }

  // EDIT mode
  if (editingProductId) {
    const ok = await updateProductInSupabase(editingProductId, {
      name: productName.value,
      categoryId: productCategory.value,
      mrp: productMRP.value,
      price: productPrice.value || 0,
      quantity: Number(productQty.value || 0)
    });
    if (ok) {
      productModal.classList.remove("open");
      editingProductId = null;
      alert("✅ Product updated!");
      await fetchProducts();
      renderProducts();
    }
    return;
  }

  // CREATE mode
  let imgUrl = "";
  const file = productImageFile && productImageFile.files ? productImageFile.files[0] : null;
  if (file) {
    imgUrl = await uploadImageToSupabase(file);
    if (!imgUrl) return; // upload failed
  } else if (sanitize(productImage.value)) {
    imgUrl = sanitize(productImage.value);
  } else {
    imgUrl = `https://dummyimage.com/600x600/f3f4f6/555&text=${encodeURIComponent(productName.value)}`;
  }

  const ok = await addProductToSupabase({
    name: productName.value,
    categoryId: productCategory.value,
    mrp: productMRP.value,
    price: productPrice.value || 0,
    quantity: Number(productQty.value || 1),
    imgUrl
  });

  if (ok) {
    productModal.classList.remove("open");
    alert("✅ Product added successfully!");
    await fetchProducts();
    renderProducts();
  }
});

window.deleteProduct = async function (id) {
  if (!isAdmin) return alert("Admin only.");
  await deleteProductFromSupabase(id);
};

window.editProduct = function (id) {
  if (!isAdmin) return alert("Admin only.");
  const p = productsCache.find(pr => pr.id === id);
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

  // Disable image inputs in edit mode (image not editable in this simple flow)
  productImage.disabled = true;
  productImageFile.disabled = true;
};

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

  if (selectedCategoryId) {
    list = list.filter((p) => p.category_id === selectedCategoryId);
  }

  const q = (searchBox.value || "").toLowerCase();
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));

  const effectivePrice = (p) => (p.price && p.price > 0 ? p.price : p.mrp || 0);
  const effectiveQty = (p) => (typeof p.quantity === "number" ? p.quantity : 0);

  const sort = sortSelect.value;
  if (sort === "priceAsc") list.sort((a, b) => effectivePrice(a) - effectivePrice(b));
  if (sort === "priceDesc") list.sort((a, b) => effectivePrice(b) - effectivePrice(a));
  if (sort === "available") list.sort((a, b) => (effectiveQty(b) > 0) - (effectiveQty(a) > 0));

  productsGrid.innerHTML = list
    .map((p) => {
      const catName = p.categories?.name || (categoriesCache.find(c => c.id === p.category_id)?.name) || "Category";
      const mrp = money(p.mrp);
      const special = money(p.price);
      const hasSpecial = special > 0 && special < mrp;
      const qty = effectiveQty(p);
      const inStock = qty > 0;

      return `
      <div class="product">
        <img src="${p.img_url}" class="thumb" onclick="openImagePreview('${p.img_url}')">
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
      ? `
        <button class="btn" onclick="editProduct('${p.id}')">Edit</button>
        <button class="btn" style="background:#ef4444; color:#fff;" onclick="deleteProductFromSupabase('${p.id}')">
          Delete
        </button>`
      : ""
  }
  ${
    inStock
      ? `
        <a class="btn" style="flex:1; text-align:center;"
          href="https://wa.me/918179771029?text=${encodeURIComponent(
            `🛍 *Product Enquiry*\n` +
            `Name: ${p.name}\n` +
            `Price: ₹${hasSpecial ? special : mrp}\n` +
            `Image: ${p.img_url}\n\n` +
            `Please confirm availability.`
          )}"
          target="_blank">
          Order on WhatsApp
        </a>`
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

console.log("✅ Supabase App Loaded");
