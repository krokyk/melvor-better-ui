const settingName = "recipe-item-sources-enabled";
const unavailable = "Requires Show Item Sources And Uses to be installed and enabled with a compatible API. Reload after changing mods.";

export function installItemSourcesAndUses(ctx, game) {
  const getProvider = () => typeof mod === "undefined" ? undefined : mod.api?.ShowItemSourcesAndUses;
  const available = typeof getProvider()?.showList === "function";
  const settings = ctx.settings.section("General");
  let enabled = false, ready = false, observer;
  const bindings = new WeakMap(), roots = new Set();

  settings.add({
    type: "custom", name: settingName, label: "Show Sources and Uses on Recipe Icons", default: false,
    render(name, onChange, config) {
      const root = document.createElement("div");
      root.className = "custom-control custom-switch custom-control-lg";
      const input = document.createElement("input");
      input.type = "checkbox"; input.id = input.name = name;
      input.className = "custom-control-input";
      input.disabled = !available;
      input.addEventListener("change", onChange);
      const label = document.createElement("label");
      label.htmlFor = name; label.className = "custom-control-label font-weight-normal";
      label.textContent = config.label;
      const hint = document.createElement("small");
      hint.className = "d-block";
      hint.textContent = available
        ? "Add a blue ? to recipe items and ingredients. Shop coin shortcuts keep their Quick Buy action."
        : unavailable;
      label.append(hint);
      root.append(input, label);
      return root;
    },
    get: root => root.querySelector("input").checked,
    set(root, value) { root.querySelector("input").checked = value === true; },
    onChange(value) {
      if (typeof value !== "boolean") return "Choose enabled or disabled.";
      if (!available) return unavailable;
      enabled = value;
      update();
    },
  });
  if (!available) return;

  function decorate(image) {
    const binding = bindings.get(image);
    if (!binding || !image.closest(".kroky-item-sources-skill")) return;
    const item = binding.item;
    const eligible = item && !binding.quickBuy;
    if (!eligible && !binding.button) return;
    if (!binding.button) {
      const nativeIcon = image.parentElement.classList.contains("info-icon");
      const wrapper = nativeIcon ? image.parentElement : document.createElement("span");
      if (!nativeIcon) {
        wrapper.className = "kroky-item-source-icon";
        image.replaceWith(wrapper);
        wrapper.append(image);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "kroky-item-source-button btn btn-link text-info p-0";
      button.textContent = "?";
      for (const event of ["click", "dblclick", "keydown", "keyup"]) button.addEventListener(event, event => event.stopPropagation());
      button.addEventListener("click", event => {
        event.preventDefault();
        const current = bindings.get(image)?.item, provider = getProvider();
        if (!enabled || !current || typeof provider?.showList !== "function") return;
        try { provider.showList(current.id); }
        catch (error) {
          console.warn("[Better UI] Show Item Sources And Uses could not open this item.", error);
          SwalLocale.fire({ icon: "error", title: "Sources and uses unavailable", text: "Show Item Sources And Uses could not display this item." });
        }
      });
      wrapper.append(button);
      binding.button = button;
    }
    const button = binding.button;
    button.hidden = !eligible;
    if (eligible) {
      const label = `Show sources and uses for ${item.name}`;
      if (button.title !== label) {
        button.title = label;
        button.setAttribute("aria-label", label);
      }
    }
  }

  function bind(image, item, quickBuy = false) {
    if (!image) return;
    const binding = bindings.get(image) ?? {};
    binding.item = item?.id && game.items.getObjectByID(item.id) === item ? item : undefined;
    binding.quickBuy = quickBuy;
    bindings.set(image, binding);
    if (ready && enabled) decorate(image);
  }

  const hooks = [
    ["item-quantity-icon", "setItem", "itemImage", item => item, true],
    ["item-current-icon", "setItem", "itemImage", item => item, true],
    ["item-chance-icon", "setItem", "itemImage", item => item],
    ["cooking-stockpile-icon", "setItem", "itemImage", item => item],
    ["cooking-stockpile-icon", "unsetItem", "itemImage", () => undefined],
    ["artisan-menu", "setProduct", "productImage", item => item],
    ["item-recipe-option", "setUnlocked", "recipeImage", recipe => recipe.product],
    ["herblore-recipe-option", "setUnlocked", "recipeImage", recipe => recipe.potions[game.herblore.getPotionTier(recipe)]],
    ["woodcutting-tree", "setTree", "treeImage", tree => tree.product],
    ["mining-rock", "setRock", "rockImage", rock => rock.product],
    ["fishing-area-menu-button", "setFishUnlocked", "fishImage", fish => fish.product],
    ["fishing-area-menu-button", "setFishLocked", "fishImage", () => undefined],
    ["fishing-area-menu", "setSelectedFish", "fishImage", fish => fish.product],
    ["fishing-area-menu", "setUnselected", "fishImage", () => undefined],
    ["cooking-menu", "setSelectedRecipe", "productImage", recipe => recipe?.product],
    ["cooking-recipe-selection", "setRecipe", "productImage", recipe => recipe.product],
    ["harvesting-vein-product", "setProduct", "productImage", product => product.item],
    ["farming-plot", "updatePlotState", "seedImage", plot => plot.state === 2 ? plot.plantedRecipe?.seedCost.item : plot.state === 3 ? plot.plantedRecipe?.product : undefined],
    ["farming-plot", "updateSelectedSeed", "selectSeedDropdownImage", plot => plot.selectedRecipe?.seedCost.item],
  ];
  for (const [tag, method, field, getItem, hasCoin] of hooks) {
    const Class = customElements.get(tag);
    if (typeof Class?.prototype[method] !== "function") continue;
    ctx.patch(Class, method).after(function (_result, target) {
      const coin = hasCoin && this.autoBuyIcon;
      bind(this[field], getItem(target), coin && !coin.hidden && !coin.classList.contains("d-none"));
    });
  }
  const RecipeOption = customElements.get("recipe-option");
  if (typeof RecipeOption?.prototype.updateRecipeCosts === "function") {
    ctx.patch(RecipeOption, "updateRecipeCosts").after(function (_result, recipe, skill) {
      const items = this.getRecipeIngredients(recipe, skill).getItemQuantityArray();
      this.recipeCost.querySelectorAll("img").forEach((image, index) => {
        const item = items[index]?.item;
        bind(image, item, item && game.shop.getQuickBuyPurchase(item) !== undefined);
      });
    });
  }
  const Constellation = customElements.get("constellation-menu");
  if (typeof Constellation?.prototype.createRewardItemIcon === "function") {
    ctx.patch(Constellation, "createRewardItemIcon").after(function (_result, item) { bind(this.rewardsContainer.lastElementChild, item); });
  }

  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.tagName === "IMG") decorate(node);
    for (const image of node.querySelectorAll("img")) decorate(image);
  }

  function update() {
    if (!ready) return;
    document.getElementById("page-container")?.classList.toggle("kroky-item-sources-enabled", enabled);
    observer?.disconnect();
    if (!enabled) return;
    if (!document.getElementById("kroky-item-sources-style")) {
      const style = document.createElement("style");
      style.id = "kroky-item-sources-style";
      style.textContent = `
        .kroky-item-source-icon { display: contents; }
        .kroky-item-source-button { display: none; }
        .kroky-item-sources-enabled .kroky-item-source-icon { display: inline-flex; position: relative; vertical-align: middle; }
        .kroky-item-sources-enabled .kroky-item-source-button:not([hidden]) { display: block; position: absolute; top: 0; left: 0; z-index: 1; width: 18px; height: 18px; line-height: 18px; font-size: 14px; font-weight: bold; border-radius: 50%; background: #232a35; text-decoration: none; }
      `;
      document.head.append(style);
    }
    game.skills.forEach(skill => {
      for (const page of game.getPagesForSkill(skill) ?? []) {
        const root = document.getElementById(page.containerID);
        if (root) { root.classList.add("kroky-item-sources-skill"); roots.add(root); }
      }
    });
    if (!observer && typeof MutationObserver === "function") observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) scan(node);
    });
    for (const root of roots) {
      scan(root);
      observer?.observe(root, { childList: true, subtree: true });
    }
  }
  const restore = () => { enabled = settings.get(settingName) === true; update(); };
  ctx.onCharacterLoaded(restore);
  ctx.onInterfaceReady(() => { ready = true; restore(); });
  ctx.patch(Game, "decode").after(restore);
}
