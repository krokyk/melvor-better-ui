const settingName = "recipe-item-sources-enabled";
const unavailable = "Requires Show Item Sources And Uses to be installed and enabled with a compatible API. Reload after changing mods.";
const recipeAreas = ".kroky-production-recipe-details, .kroky-woodcutting-stock, .kroky-mining-stock, .kroky-fishing-stock, .kroky-upgrade-costs, .kroky-agility-costs, #firemaking-container, #cooking-container";
const observedAreas = ".kroky-production, #woodcutting-tree-container, #mining-ores-container, #fishing-area-menu-container, #modal-item-upgrade, #firemaking-container, #cooking-container";

export function installItemSourcesAndUses(ctx, game) {
  const getProvider = () => typeof mod === "undefined" ? undefined : mod.api?.ShowItemSourcesAndUses;
  const available = typeof getProvider()?.showList === "function";
  const settings = ctx.settings.section("General");
  let enabled = false, ready = false, observer, sourceModal;
  const bindings = new WeakMap();

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
      label.htmlFor = name; label.className = "font-weight-normal flex-wrap justify-content-start ml-2 custom-control-label";
      label.textContent = config.label;
      const hint = document.createElement("small");
      hint.className = "d-block";
      hint.textContent = available
        ? "Add a blue ? just outside the top-right corner of recipe, upgrade-cost and Agility cost item icons, mirroring the shop-coin overlay. Main artwork and shop coin shortcuts stay unchanged."
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

  const sourceTable = "#swal2-html-container > table.font-w400.font-size-sm > tbody > tr > td:first-child.text-info";
  const sizeSourcePopup = popup => {
    if (!popup) return;
    const width = document.getElementById("main-container")?.clientWidth;
    if (!width) return;
    const cap = `${width * .75}px`;
    if (popup.style.getPropertyValue("--kroky-item-sources-max-width") !== cap) popup.style.setProperty("--kroky-item-sources-max-width", cap);
  };
  const handleSourceFocus = event => {
    const popup = event.target.closest?.(".swal2-popup");
    if (popup && !popup.classList.contains("kroky-item-sources-dialog") && popup.querySelector(sourceTable)) {
      popup.classList.add("kroky-item-sources-dialog");
      sizeSourcePopup(popup);
    }
    if (enabled && sourceModal?.classList.contains("show")) event.stopPropagation();
  };
  // jQuery delegates run before Bootstrap's direct focus guard, including simulated focusin events.
  if (typeof $ === "function") $(document).on("focusin.krokyItemSources", ".swal2-container", handleSourceFocus);
  document.defaultView?.addEventListener("resize", () => sizeSourcePopup(document.querySelector(".kroky-item-sources-dialog")));
  if (typeof $ === "function") $(document).on("hidden.bs.modal.krokyItemSources", event => {
    if (event.target === sourceModal) sourceModal = undefined;
  });

  function exposeButton(container) {
    // Image roles hide their children from assistive technology.
    if (container?.getAttribute("role") !== "img") return;
    const button = container.querySelector(".kroky-item-source-button");
    if (button && !button.hidden) container.setAttribute("role", "group");
  }

  function decorate(image) {
    const binding = bindings.get(image);
    if (!binding || !image.closest(recipeAreas)) return;
    const item = binding.item;
    const summoningProduct = image.closest("#summoning-container") && image.closest(".kroky-production-products");
    const eligible = item && !binding.quickBuy && !summoningProduct && !image.classList.contains("kroky-production-image");
    if (!eligible && !binding.button) return;
    if (!binding.button) {
      if (binding.wrapperClass && !image.parentElement.classList.contains(binding.wrapperClass.split(" ")[0])) {
        const wrapper = document.createElement("span");
        wrapper.className = binding.wrapperClass;
        image.before(wrapper); wrapper.append(image);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "kroky-item-source-button info-icon-overlay skill-icon-xxs btn btn-link text-info p-0";
      button.textContent = "?";
      for (const event of ["click", "dblclick", "keydown", "keyup"]) button.addEventListener(event, event => event.stopPropagation());
      button.addEventListener("click", event => {
        event.preventDefault();
        const current = bindings.get(image)?.item, provider = getProvider();
        if (!enabled || !current || typeof provider?.showList !== "function") return;
        sourceModal = image.closest(".modal.show");
        try { provider.showList(current.id); }
        catch (error) {
          console.warn("[Better UI] Show Item Sources And Uses could not open this item.", error);
          SwalLocale.fire({ icon: "error", title: "Sources and uses unavailable", text: "Show Item Sources And Uses could not display this item." });
        }
      });
      image.parentElement.append(button);
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
      exposeButton(image.parentElement);
    }
  }

  function bind(image, item, quickBuy = false, wrapperClass) {
    if (!image) return;
    const binding = bindings.get(image) ?? {};
    binding.item = item?.id && game.items.getObjectByID(item.id) === item ? item : undefined;
    binding.quickBuy = quickBuy;
    binding.wrapperClass = wrapperClass;
    bindings.set(image, binding);
    if (ready && enabled) decorate(image);
  }

  const hooks = [
    ["item-quantity-icon", "setItem", "itemImage", item => item, true],
    ["item-current-icon", "setItem", "itemImage", item => item, true],
    ["item-chance-icon", "setItem", "itemImage", item => item],
    ["cooking-stockpile-icon", "setItem", "itemImage", item => item],
    ["cooking-stockpile-icon", "unsetItem", "itemImage", () => undefined],
  ];
  for (const [tag, method, field, getItem, hasCoin] of hooks) {
    const Class = customElements.get(tag);
    if (typeof Class?.prototype[method] !== "function") continue;
    ctx.patch(Class, method).after(function (_result, target) {
      const coin = hasCoin && this.autoBuyIcon;
      bind(this[field], getItem(target), coin && !coin.hidden && !coin.classList.contains("d-none"));
    });
  }
  let upgradeHookInstalled = false;
  function installUpgradeHook() {
    if (upgradeHookInstalled) return;
    const UpgradeMenu = customElements.get("item-upgrade-menu");
    if (typeof UpgradeMenu?.prototype.setUpgradeCosts !== "function") return;
    ctx.patch(UpgradeMenu, "setUpgradeCosts").after(function (_result, upgrade) {
      this.itemCosts.classList.add("kroky-upgrade-costs");
      const images = this.itemCosts.querySelectorAll("img");
      upgrade.itemCosts.forEach(({ item }, index) => bind(images[index], item, false, "kroky-upgrade-cost-icon skill-icon-sm mr-1"));
    });
    upgradeHookInstalled = true;
  }
  installUpgradeHook();
  let agilityHookInstalled = false;
  function installAgilityHook() {
    if (agilityHookInstalled) return;
    const Selection = customElements.get("agility-obstacle-selection");
    if (typeof Selection?.prototype.setCosts !== "function") return;
    ctx.patch(Selection, "setCosts").after(function (_result, items) {
      this.costContainer.classList.add("kroky-agility-costs");
      items.forEach(({ item }, index) => bind(this.costContainer.children[index]?.image, item, false, "kroky-agility-cost-icon skill-icon-xs mr-2"));
    });
    agilityHookInstalled = true;
  }
  installAgilityHook();
  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.tagName === "IMG") decorate(node);
    for (const image of node.querySelectorAll("img")) decorate(image);
  }

  function update() {
    if (!ready) return;
    document.getElementById("page-container")?.classList.toggle("kroky-item-sources-enabled", enabled);
    observer?.disconnect();
    if (!document.getElementById("kroky-item-sources-style")) {
      const style = document.createElement("style");
      style.id = "kroky-item-sources-style";
      style.textContent = `
        .kroky-item-source-button { display: none; }
        .kroky-upgrade-cost-icon, .kroky-agility-cost-icon { position: relative; display: inline-block; vertical-align: middle; }
        .kroky-upgrade-cost-icon > img, .kroky-agility-cost-icon > img { margin: 0 !important; }
        .kroky-item-sources-enabled .kroky-item-source-button:not([hidden]) { display: block; left: auto; right: -6px; z-index: 1; border: 0; line-height: 1; font-size: .875rem; font-weight: bold; border-radius: 50%; background: #232a35; text-decoration: none; }
        .kroky-item-sources-dialog { width: max-content; max-width: min(var(--kroky-item-sources-max-width, 75vw), calc(100vw - 2rem)); }
        .kroky-item-sources-dialog > #swal2-html-container > table td { vertical-align: top; }
        .kroky-item-sources-dialog > #swal2-html-container > table td:first-child { white-space: nowrap; padding-right: .5rem; }
        .kroky-item-sources-dialog > #swal2-html-container > table td:last-child { white-space: normal; word-break: normal; overflow-wrap: break-word; }
      `;
      document.head.append(style);
    }
    if (!enabled) { sourceModal = undefined; return; }
    if (!observer && typeof MutationObserver === "function") observer = new MutationObserver(records => {
      for (const record of records) {
        exposeButton(record.target?.closest?.(".info-icon"));
        for (const node of record.addedNodes) scan(node);
      }
    });
    for (const root of document.querySelectorAll(observedAreas)) {
      scan(root);
      observer?.observe(root, { childList: true, subtree: true });
    }
    for (const area of document.querySelectorAll(".kroky-agility-costs")) scan(area);
  }
  const restore = () => { sourceModal = undefined; enabled = settings.get(settingName) === true; update(); };
  ctx.onCharacterLoaded(restore);
  ctx.onInterfaceReady(() => { ready = true; installUpgradeHook(); installAgilityHook(); restore(); });
  ctx.patch(Game, "decode").after(restore);
}
