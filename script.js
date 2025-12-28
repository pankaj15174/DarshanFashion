/*******************************************
 Darshan Fashions – Supabase Edition
 - Products, Categories, Admin PIN/Security via Supabase
 - Images via Supabase Storage (product-images)
 - Color (multi) + Size (multi) selection with WhatsApp order
 - UPDATED: Color-specific image handling on EDIT only
 - UPDATED: Default image is editable
 - UPDATED: No color is pre-selected on page load. Default image is shown.
 - 🟨 FIX: Dynamic image source for Image Preview Modal.
 - 🆕 FEATURE: Category Image Management (Add/Edit)
 - 🆕 FEATURE: Full Draggable Panning Zoom
********************************************/

/* ---------- Supabase Client ---------- */
const supabaseClient = window.supabase.createClient(
  window.__SUPABASE_URL__,
  window.__SUPABASE_ANON_KEY__
);
const BUCKET = window.__SUPABASE_BUCKET__;

/* ---------- App State ---------- */
let isAdmin = false;
let selectedCategoryId = null;
let editingProductId = null;
let editingCategoryId = null; // 🆕 Added for category editing
let categoriesCache = [];   // [{id,name,img_url}]
let productsCache = [];     // products with joined category if needed
let adminConfig = null;     // {id, admin_pin, security_question, security_answer}

/* Per-product selections */
const selectedColors = {};  // { [productId]: "Black" }
const selectedSizes  = {};  // { [productId]: "XL" }
const selectedImages = {};  // { [productId]: "URL" } To store the currently displayed image

/* State for Color Images in Admin Flow */
let colorImagesData = {}; // { "ColorName": "ImageURL" }


/* State for Draggable Panning Zoom */
let isDragging = false;
let startX, startY;
let initialX, initialY; // Stores the current translation state
let currentPanX = 0;
let currentPanY = 0;


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

/* Category Modal 🆕 Updated elements for image */
const categoryModal = $("categoryModal");
const newCategoryName = $("newCategoryName");
const saveCategoryBtn = $("saveCategoryBtn");
const closeCategoryBtn = $("closeCategoryBtn");
const categoryImage = document.createElement("input"); // Creating element dynamically for image URL
categoryImage.setAttribute("type", "text");
categoryImage.setAttribute("id", "categoryImage");
categoryImage.setAttribute("class", "input");
categoryImage.setAttribute("placeholder", "Paste Default Image URL (Required)");
const categoryImageFile = document.createElement("input"); // Creating element dynamically for image file
categoryImageFile.setAttribute("type", "file");
categoryImageFile.setAttribute("id", "categoryImageFile");
categoryImageFile.setAttribute("accept", "image/*");
categoryImageFile.setAttribute("class", "input");
categoryImageFile.style.marginTop = '6px';

// Append new elements to category modal box (or inject them directly into index.html)
// For now, let's keep it simple by appending them inside the logic below
const categoryModalBox = categoryModal.querySelector('.modal-box');
categoryModalBox.insertBefore(categoryImage, saveCategoryBtn.closest('.row'));
categoryModalBox.insertBefore(categoryImageFile, saveCategoryBtn.closest('.row'));


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

/* Color Image Management Elements */
const manageColorImagesBtn = $("manageColorImagesBtn");
const colorImageModal = $("colorImageModal");
const colorImageProductName = $("colorImageProductName");
const colorImageInputs = $("colorImageInputs");
const saveColorImagesBtn = $("saveColorImagesBtn");
const closeColorImageBtn = $("closeColorImageBtn");


/* Image Preview 🆕 Updated elements for drag/zoom */
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
  const { data, error } = await supabaseClient
    .from("admin_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error reading admin_config:", error);
    return;
  }

  if (!data) {
    const { error: insErr } = await supabaseClient
      .from("admin_config")
      .insert([{ admin_pin: "admin123", security_question: null, security_answer: null }]);
    if (insErr) console.error("Error creating default admin_config:", insErr);
    adminConfig = { admin_pin: "admin123", security_question: null, security_answer: null };
  } else {
    adminConfig = data;
  }
}

async function refreshAdminConfig() {
  const { data, error } = await supabaseClient
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

  const { error } = await supabaseClient
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

  const { error } = await supabaseClient
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
 * Supabase – Categories 🆕 Updated
 ***********************/
async function fetchCategories() {
  // 🆕 Include img_url in select
  const { data, error } = await supabaseClient
    .from("categories")
    .select("id, name, img_url")
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

// 🆕 Function to add a category (now includes image URL)
async function addCategoryToSupabase(name, imgUrl) {
  const { error } = await supabaseClient
    .from("categories")
    .insert([{ name: sanitize(name), img_url: imgUrl }]);
  if (error) {
    alert("Failed to add category!");
    console.error(error);
  }
  await fetchCategories();
}

// 🆕 Function to update a category (now includes image URL)
async function updateCategoryInSupabase(id, name, imgUrl) {
  const { error } = await supabaseClient
    .from("categories")
    .update({ name: sanitize(name), img_url: imgUrl })
    .eq("id", id);
  if (error) {
    alert("Failed to update category!");
    console.error(error);
    return false;
  }
  return true;
}

async function deleteCategoryFromSupabase(catId) {
  // Use custom modal or keep standard confirm for simplicity here
  if (!window.confirm("Delete this category and all products under it?")) return;
  const { error } = await supabaseClient
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
  // include 'color', 'sizes' AND 'color_images_json' in the select list
  const { data, error } = await supabaseClient
    .from("products")
    .select("id,name,category_id,mrp,price,quantity,img_url,color,sizes,color_images_json, categories(name)")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching products:", error);
    productsCache = [];
    return;
  }
  productsCache = data || [];
  
  // Initialize selectedImages with the default img_url for each product
  productsCache.forEach(p => {
    selectedImages[p.id] = p.img_url;
  });
}

async function addProductToSupabase({ name, categoryId, mrp, price, quantity, imgUrl, color, sizes, colorImagesJson }) { 
  const payload = {
    name: sanitize(name),
    category_id: categoryId,
    mrp: money(mrp),
    price: money(price),
    quantity: Number.isFinite(quantity) ? quantity : 1,
    img_url: imgUrl,
    color: sanitize(color),             // CSV for colors
    sizes: sanitize(sizes),              // CSV for sizes
    color_images_json: colorImagesJson || null 
  };

  const { error } = await supabaseClient.from("products").insert([payload]);
  if (error) {
    console.error(error);
    return { ok: false, message: "Failed to add product!" };
  }
  return { ok: true, message: "✅ Product added successfully!" };
}

// script.js (Around line 334)

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
// ... (rest of saveSecurityBtn logic)
});

// 🟨 NEW: Handle Enter key press on login modal
loginModal.addEventListener("keydown", (e) => {
    // Check if the Enter key was pressed (keyCode 13 or key 'Enter')
    if (e.key === 'Enter' || e.keyCode === 13) {
        
        // Prevent default action (like form submission or browser navigation)
        e.preventDefault(); 
        
        // Check if the current focused element is the PIN input or the Admin Login button
        if (document.activeElement === adminPinInput || document.activeElement === adminLoginBtn) {
            // Programmatically click the login button
            adminLoginBtn.click();
        } else if (document.activeElement === guestLoginBtn) {
            // Allow logging in as guest via Enter
            guestLoginBtn.click();
        }
    }
});

async function updateProductInSupabase(id, { name, categoryId, mrp, price, quantity, imgUrl, color, sizes, colorImagesJson }) { 
  const payload = {
    name: sanitize(name),
    category_id: categoryId,
    mrp: money(mrp),
    price: money(price),
    quantity: Number.isFinite(quantity) ? quantity : 1,
    img_url: imgUrl, 
    color: sanitize(color),
    sizes: sanitize(sizes),
    color_images_json: colorImagesJson || null 
  };
  const { error } = await supabaseClient.from("products").update(payload).eq("id", id);
  if (error) {
    console.error(error);
    return { ok: false, message: "Failed to update product!" };
  }
  return { ok: true, message: "✅ Product updated!" };
}

async function deleteProductFromSupabase(id) {
  // Use custom modal or keep standard confirm for simplicity here
  if (!window.confirm("Delete this product?")) return;
  const { error } = await supabaseClient.from("products").delete().eq("id", id);
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
async function uploadImageToSupabase(file, isCategory = false) {
  const folder = isCategory ? 'categories' : 'products'; // 🆕 Select folder
  const fileName = `${folder}/${Date.now()}_${file.name}`;
  const { error } = await supabaseClient.storage.from(BUCKET).upload(fileName, file);
  if (error) {
    console.error("Upload error:", error);
    alert("Failed to upload image!");
    return null;
  }
  const { data: urlData } = supabaseClient.storage.from(BUCKET).getPublicUrl(fileName);
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
 * Category Management 🆕 Updated
 ***********************/
addCategoryBtn.addEventListener("click", () => {
  if (!isAdmin) return window.alert("Admin only.");
  editingCategoryId = null; // Clear editing state
  newCategoryName.value = "";
  categoryImage.value = "";
  categoryImageFile.value = "";
  saveCategoryBtn.textContent = "Save"; // Set button text for ADD
  categoryModal.querySelector('h3').textContent = "Add Category";
  categoryModal.classList.add("open");
});

closeCategoryBtn.addEventListener("click", () => {
  categoryModal.classList.remove("open");
  editingCategoryId = null;
});

// 🆕 Edit Category function
window.editCategory = function (id) {
    if (!isAdmin) return window.alert("Admin only.");
    const cat = categoriesCache.find(c => String(c.id) === String(id));
    if (!cat) return;
    editingCategoryId = id;
    
    // Open modal & prefill
    newCategoryName.value = cat.name;
    categoryImage.value = cat.img_url || "";
    categoryImageFile.value = ""; // Clear file input for edit
    saveCategoryBtn.textContent = "Update"; // Set button text for EDIT
    categoryModal.querySelector('h3').textContent = "Edit Category";
    categoryModal.classList.add("open");
};


saveCategoryBtn.addEventListener("click", async () => {
  if (!isAdmin) return window.alert("Admin only.");
  const name = sanitize(newCategoryName.value);
  if (!name) return window.alert("Please enter a category name");
  
  showLoading();
  
  let imgUrl = sanitize(categoryImage.value);
  const file = categoryImageFile && categoryImageFile.files ? categoryImageFile.files[0] : null;

  // 1. Handle image upload (if a file is present)
  if (file) {
      const uploadUrl = await uploadImageToSupabase(file, true); // true for isCategory
      if (!uploadUrl) {
          hideLoading();
          return; // upload failed
      }
      imgUrl = uploadUrl;
  } 

  // 2. Final image URL check
  if (!imgUrl) {
      window.alert("Please provide a Default Image URL or upload a file!");
      hideLoading();
      return;
  }

  // 3. Save/Update logic
  if (editingCategoryId) {
      const updated = await updateCategoryInSupabase(editingCategoryId, name, imgUrl);
      if (updated) {
          window.alert("✅ Category updated successfully!");
      }
      editingCategoryId = null; // Clear edit state
  } else {
      // Add mode
      await addCategoryToSupabase(name, imgUrl);
      window.alert("✅ Category added successfully!");
  }
  
  hideLoading();
  newCategoryName.value = "";
  categoryImage.value = "";
  categoryImageFile.value = "";
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
  
  // Clear color-specific data on creation
  colorImagesData = {};

  // Enable image inputs in create mode
  productImage.disabled = false;
  productImageFile.disabled = false;
  manageColorImagesBtn.disabled = true; // Disable color image management on CREATE
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
  
  // Check if color images are set but the color list is empty
  const currentColors = parseOptions(productColor.value);
  const colorImagesArePresent = Object.keys(colorImagesData).length > 0;
  
  if (colorImagesArePresent && currentColors.length === 0) {
      window.alert("You have color-specific images saved, but the Color list is empty. Please enter colors or clear the images (by cancelling the product edit).");
      return;
  }
  
  showLoading(); // Show loading spinner

  let result = { ok: false, message: "" };

  // EDIT mode
  if (editingProductId) {
    let imgUrl = sanitize(productImage.value);
    const file = productImageFile && productImageFile.files ? productImageFile.files[0] : null;
    
    // Check if a new file was uploaded in EDIT mode
    if (file) {
        const uploadUrl = await uploadImageToSupabase(file);
        if (!uploadUrl) {
            hideLoading();
            return; // upload failed
        }
        imgUrl = uploadUrl;
    } else if (!imgUrl) {
        // If the admin cleared the URL and didn't upload a file
        window.alert("Please provide a Default Product Image URL or upload a file!");
        hideLoading();
        return;
    }

    result = await updateProductInSupabase(editingProductId, {
      name: productName.value,
      categoryId: productCategory.value,
      mrp: productMRP.value,
      price: productPrice.value || 0,
      quantity: Number(productQty.value || 0),
      imgUrl: imgUrl, // Pass the (potentially new) default image URL
      color: productColor ? productColor.value : "",
      sizes: productSizes ? productSizes.value : "",
      colorImagesJson: JSON.stringify(colorImagesData) 
    });
    
  } else {
    // CREATE mode
    let imgUrl = "";
    const file = productImageFile && productImageFile.files ? productImageFile.files[0] : null;
    
    if (file) {
      const uploadUrl = await uploadImageToSupabase(file);
      if (!uploadUrl) {
        hideLoading();
        return; 
      }
      imgUrl = uploadUrl;
    } else if (sanitize(productImage.value)) {
      imgUrl = sanitize(productImage.value);
    } 
    
    // Final check for default image
    if (!imgUrl || imgUrl.includes("dummyimage")) {
        window.alert("Please provide a Default Product Image URL or upload a file!");
        hideLoading();
        return;
    }

    result = await addProductToSupabase({
      name: productName.value,
      categoryId: productCategory.value,
      mrp: productMRP.value,
      price: productPrice.value || 0,
      quantity: Number(productQty.value || 1),
      imgUrl,
      color: productColor ? productColor.value : "",
      sizes: productSizes ? productSizes.value : "",
      colorImagesJson: JSON.stringify(colorImagesData)
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
  
  // Populate colorImagesData state
  colorImagesData = {};
  if (p.color_images_json) {
    try {
      colorImagesData = JSON.parse(p.color_images_json);
    } catch (e) {
      console.error("Error parsing color_images_json:", e);
    }
  }
  
  productImage.value = p.img_url || ""; 

  // Enable default image inputs in EDIT mode
  productImage.disabled = false; 
  productImageFile.disabled = false; 
  manageColorImagesBtn.disabled = false; 
};

// Color Image Management Modal Logic
manageColorImagesBtn.addEventListener("click", () => {
  const colors = parseOptions(productColor.value);
  if (!colors.length) {
    window.alert("Please first enter the product colors in the main form (e.g., Red, Blue) to manage color-specific images.");
    return;
  }

  // Ensure current product name is available for the modal title
  const currentName = sanitize(productName.value) || (
    editingProductId ? productsCache.find(p => p.id === editingProductId)?.name : 'New Product'
  );
  colorImageProductName.textContent = currentName;

  renderColorImageInputs(colors);

  productModal.classList.remove("open");
  colorImageModal.classList.add("open");
});

closeColorImageBtn.addEventListener("click", () => {
  colorImageModal.classList.remove("open");
  productModal.classList.add("open"); // Return to main product modal
});

function renderColorImageInputs(colors) {
  colorImageInputs.innerHTML = colors.map(color => {
    const currentUrl = colorImagesData[color] || "";
    // Use a unique ID for the file input to handle multiple uploads
    const fileInputId = `colorImageUpload_${color.replace(/\s/g, '_')}`;

    return `
      <div style="margin-bottom: 12px; padding: 10px; border: 1px solid var(--border); border-radius: 8px;">
        <strong>${color} Image:</strong>
        <input type="text" id="colorImageUrl_${color}" class="input" 
          placeholder="Paste Image URL for ${color}" value="${currentUrl}" style="margin-top: 5px;">
        <div class="center muted" style="margin:6px 0;">OR</div>
        <input type="file" id="${fileInputId}" accept="image/*" class="input" 
          onchange="handleColorImageUpload(this, '${color}')">
        ${currentUrl ? `<img src="${currentUrl}" style="width:50px; height:50px; margin-fit:cover; border-radius:4px;">` : ''}
      </div>
    `;
  }).join('');
}

// Helper to handle single color image file upload
window.handleColorImageUpload = async function (fileInput, color) {
  const file = fileInput.files[0];
  if (!file) return;

  showLoading();
  const uploadUrl = await uploadImageToSupabase(file);
  hideLoading();

  if (uploadUrl) {
    colorImagesData[color] = uploadUrl;
    // Update the text input with the new URL and re-render the list
    renderColorImageInputs(parseOptions(productColor.value)); 
  } else {
    // Clear the file input if upload failed
    fileInput.value = ''; 
  }
};

saveColorImagesBtn.addEventListener("click", () => {
  // 1. Gather all data from the URL input fields
  const colors = parseOptions(productColor.value);
  const tempColorData = {};
  
  colors.forEach(color => {
    const urlInput = $(`colorImageUrl_${color}`);
    const url = sanitize(urlInput ? urlInput.value : "");
    if (url) {
      tempColorData[color] = url;
    }
  });

  // 2. Update the main state
  colorImagesData = tempColorData;

  // 3. Close the modal and return to the main product form
  colorImageModal.classList.remove("open");
  productModal.classList.add("open");
});

/***********************
 * Color/Size selection + WhatsApp
 ***********************/
window.selectColor = function (productId, color, element) {
  selectedColors[productId] = color;
  
  // 1. Remove 'selected' class from all color buttons for this product
  const container = element.closest('.meta');
  container.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('selected'));

  // 2. Add 'selected' class to the clicked button
  element.classList.add('selected');

  // Change product image based on selection
  const productCard = element.closest('.product');
  const productImageEl = productCard.querySelector('.thumb');
  
  const p = productsCache.find(x => String(x.id) === String(productId));
  if (!p) return;
  
  let newImageUrl = p.img_url; // Default to main image
  
  if (p.color_images_json) {
    try {
      const colorImages = JSON.parse(p.color_images_json);
      // If a color-specific image exists, use it
      if (colorImages[color]) {
        newImageUrl = colorImages[color]; 
      }
    } catch (e) {
      console.error("Error parsing color_images_json for selectColor:", e);
    }
  }

  productImageEl.src = newImageUrl;
  selectedImages[productId] = newImageUrl; // Update the selected image state

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
  
  // Use the currently visible image URL
  const chosenImage = selectedImages[productId] || p.img_url; 

  const msg =
    `🛍 *Product Enquiry*\n` +
    `Name: ${p.name}\n` +
    `Color: ${chosenColor}\n` +
    `Size: ${chosenSize}\n` +
    `Price: ₹${hasSpecial ? special : mrp}\n` +
    `Image: ${chosenImage}\n\n` +
    `Please confirm availability.`;

  const url = `https://wa.me/918179771029?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
};

// 🟨 FIX: Update openImagePreview to use selectedImages[productId] and initialize drag state
window.openImagePreview = function (productId) {
  const src = selectedImages[productId];
  if (!src) return; 

  previewImage.src = src;
  
  // 🆕 Reset pan/zoom state for new image
  previewImage.classList.remove("zoomed");
  previewImage.style.transform = `translate(0px, 0px) scale(1)`; 
  currentPanX = 0;
  currentPanY = 0;
  
  imagePreviewModal.classList.add("open");
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
          (cat) => {
            // 🆕 Use the actual category image URL or a fallback
            const imageUrl = cat.img_url || `https://dummyimage.com/600x400/f3f4f6/555&text=${encodeURIComponent(cat.name)}`;
            return `
              <div class="card">
                <img src="${imageUrl}" class="thumb" onclick="openCategory('${cat.id}')">
                <div class="card-body">
                  ${cat.name}
                  ${
                    isAdmin
                      ? `<button class="btn" style="float:right;background:red;color:white;margin-left:8px;"
                           onclick="deleteCategoryFromSupabase('${cat.id}')">Delete</button>
                         <button class="btn" style="float:right;"
                           onclick="editCategory('${cat.id}')">Edit</button>` // 🆕 Edit Button
                      : ""
                  }
                </div>
              </div>
            `;
          }
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
      
      // Logic to determine initial image URL and selected color
      let initialImageUrl = p.img_url; // Default image is always the base product image
      let selectedColorName = selectedColors[p.id] || null; // Only use explicitly selected color from cache

      
      // If a color is explicitly selected, check for a color-specific image
      if (selectedColorName && p.color_images_json) {
        try {
          const colorImages = JSON.parse(p.color_images_json);
          // Check if there is an image for the currently selected color
          if (colorImages[selectedColorName]) {
            initialImageUrl = colorImages[selectedColorName];
          }
        } catch (e) {
          console.error("Error parsing color_images_json for renderProducts:", e);
        }
      }
      // Update state for image preview/WhatsApp link
      selectedImages[p.id] = initialImageUrl;


      return `
        <div class="product">
          <img src="${initialImageUrl}" class="thumb" onclick="openImagePreview('${p.id}')">
          <div class="meta">
            <strong>${p.name}</strong>
            <div class="muted">${catName}</div>

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
 * Image Preview & Zoom/Drag 🆕 Updated
 ***********************/

closeImagePreview.addEventListener("click", () => {
  imagePreviewModal.classList.remove("open");
});

// Toggle Zoom on click
previewImage.addEventListener("click", () => {
  // Toggle the 'zoomed' class
  const isZoomed = previewImage.classList.toggle("zoomed");
  
  if (isZoomed) {
    // Zoom in: Set initial scale and reset pan
    previewImage.style.transform = `translate(0px, 0px) scale(2)`;
    currentPanX = 0;
    currentPanY = 0;
  } else {
    // Zoom out: Reset transform
    previewImage.style.transform = `translate(0px, 0px) scale(1)`;
    currentPanX = 0;
    currentPanY = 0;
  }
});


// DRAG/PAN Logic (Only when zoomed)
previewImage.addEventListener('mousedown', (e) => {
    if (!previewImage.classList.contains('zoomed')) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    // Store the initial translation to calculate the new position
    const currentTransform = previewImage.style.transform || 'translate(0px, 0px) scale(2)';
    const match = currentTransform.match(/translate\(([-\d.]+px),\s*([-\d.]+px)\)/);
    
    if (match) {
        initialX = parseFloat(match[1]);
        initialY = parseFloat(match[2]);
    } else {
        initialX = 0;
        initialY = 0;
    }

    previewImage.style.transition = 'none'; // Disable smooth transition while dragging
    e.preventDefault(); // Prevent default browser drag behaviors
});

imagePreviewModal.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newPanX = initialX + dx;
    let newPanY = initialY + dy;
    
    // Limit panning so the image boundary doesn't exceed the container bounds (this is complex and often requires a library, but here's a basic limit)
    const box = previewImage.getBoundingClientRect();
    const modalBox = imagePreviewModal.querySelector('.modal-box');
    
    // Simple Boundary Constraint (approximate)
    const maxPanX = box.width / 4; 
    const maxPanY = box.height / 4; 
    const minPanX = -maxPanX;
    const minPanY = -maxPanY;

    newPanX = Math.min(maxPanX, Math.max(minPanX, newPanX));
    newPanY = Math.min(maxPanY, Math.max(minPanY, newPanY));
    
    // Apply the translation
    previewImage.style.transform = `translate(${newPanX}px, ${newPanY}px) scale(2)`;
    currentPanX = newPanX;
    currentPanY = newPanY;
});

imagePreviewModal.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        previewImage.style.transition = 'transform 0.2s ease-in-out'; // Re-enable transition
    }
});

// Also stop dragging if mouse leaves the modal (safety)
imagePreviewModal.addEventListener('mouseleave', () => {
    if (isDragging) {
        isDragging = false;
        previewImage.style.transition = 'transform 0.2s ease-in-out'; 
    }
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