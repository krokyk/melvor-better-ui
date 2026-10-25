const settingName = "skill-item-stats-mode";
const mainArt = ".kroky-production-card .kroky-production-image";

export function createItemStatsPreview(item, game) {
  const element = document.createElement("div");
  element.className = "kroky-item-stats-preview text-left font-size-sm";
  const stats = Array.isArray(item?.equipmentStats) ? item.equipmentStats : [];
  const requirements = Array.isArray(item?.equipRequirements) ? item.equipRequirements : [];
  const hasStats = stats.some(stat => Number.isFinite(stat.value) && stat.value !== 0)
    || (item?.specialAttacks?.length ?? 0) > 0 || requirements.length > 0 || (item?.hasDescription && !!item.modifiedDescription);
  const Tooltip = customElements.get("equipment-tooltip");
  const equipment = typeof EquipmentItem === "function" && item instanceof EquipmentItem;
  if (hasStats && equipment && typeof Tooltip?.prototype.setItem === "function") {
    const tooltip = document.createElement("equipment-tooltip");
    tooltip.setItem(item, true);
    element.append(tooltip);
  } else {
    const name = document.createElement("strong");
    name.className = "d-block text-warning"; name.textContent = item?.name ?? "";
    element.append(name);
    if (hasStats) {
      if (item.hasDescription && item.modifiedDescription) {
        const description = document.createElement("small");
        description.className = "d-block text-info"; description.innerHTML = item.modifiedDescription;
        element.append(description);
      }
      for (const stat of stats) {
        if (!Number.isFinite(stat.value) || stat.value === 0) continue;
        const line = document.createElement("div");
        line.textContent = typeof Equipment === "function" && typeof Equipment.getEquipStatDescription === "function" ? Equipment.getEquipStatDescription(stat) : `${stat.key}: ${stat.value}`;
        line.className = stat.value < 0 ? "text-danger" : "text-success";
        element.append(line);
      }
    }
  }
  for (const requirement of requirements) {
    if (typeof requirement.getNodes !== "function") continue;
    const line = document.createElement("div"); line.className = "font-size-sm mt-1";
    line.append(...requirement.getNodes("skill-icon-xs mr-2"));
    if (typeof requirement.isMet === "function") line.classList.add(requirement.isMet() ? "text-success" : "text-danger");
    element.append(line);
  }
  if (hasStats && item?.consumesChargesOn && typeof game.itemCharges?.getCharges === "function") {
    const charges = game.itemCharges.getCharges(item), line = document.createElement("small");
    line.className = "d-block text-success";
    const quantity = typeof numberWithCommas === "function" ? numberWithCommas(charges) : String(charges);
    line.textContent = typeof templateLangString === "function" ? templateLangString("MENU_TEXT_CHARGES_REMAINING", { charges: quantity }) : `${quantity} charges remaining`;
    element.append(line);
  }
  return { element, hasStats: !!hasStats };
}

export function installSkillItemStats(ctx, game) {
  const settings = ctx.settings.section("General"), bindings = new WeakMap();
  let mode = "click", ready = false;
  const validMode = value => ["icon", "click", "hover"].includes(value);
  settings.add({
    type: "radio-group", name: settingName, label: "Show Item Stats in Skills", default: "click",
    hint: "Applies to main item artwork with View Item Stats. Recipe sources, shop shortcuts and ingredient navigation keep their existing actions.",
    options: [
      { value: "icon", label: "As top-right corner icon" },
      { value: "click", label: "By clicking on item" },
      { value: "hover", label: "By hovering over item" },
    ],
    onChange(value) {
      if (!validMode(value)) return "Choose an item-stats interaction.";
      mode = value; update();
    },
  });

  function nativeButton(binding) {
    const button = binding.image.closest(".kroky-production-card")?.querySelector(".kroky-production-view-stats");
    const item = binding.icon.item;
    return button && !button.hidden && !button.classList.contains("d-none") && typeof button.onclick === "function"
      && item?.id && game.items.getObjectByID(item.id) === item ? button : undefined;
  }
  function restoreNativeTooltip(binding) {
    if (binding.nativeTooltip && binding.nativeTooltipEnabled && !binding.nativeTooltip.state?.isDestroyed) binding.nativeTooltip.enable?.();
    binding.nativeTooltip = undefined;
  }
  function hidePreview(binding) {
    binding.preview?.hide();
    restoreNativeTooltip(binding);
  }
  function showPreview(binding) {
    if (!ready || mode !== "hover" || !nativeButton(binding) || typeof tippy !== "function") return;
    const tooltip = binding.icon.tooltip;
    if (tooltip && binding.nativeTooltip !== tooltip) {
      restoreNativeTooltip(binding);
      binding.nativeTooltip = tooltip;
      binding.nativeTooltipEnabled = tooltip.state?.isEnabled !== false;
      tooltip.hide?.(); tooltip.disable?.();
    }
    if (!binding.preview) binding.preview = tippy(binding.image, {
      trigger: "manual", content: "", placement: "right", interactive: false, animation: false,
      maxWidth: 360, appendTo: document.body,
      popperOptions: { strategy: "fixed", modifiers: [{ name: "preventOverflow", options: { altAxis: true, tether: false } }] },
    });
    binding.preview.setContent(createItemStatsPreview(binding.icon.item, game).element);
    binding.preview.show();
  }
  function openStats(binding, event) {
    const button = ready && mode !== "icon" && nativeButton(binding);
    if (!button) return;
    event.preventDefault(); event.stopPropagation(); hidePreview(binding); button.click();
  }
  function restoreAttributes(image, values) {
    for (const [name, value] of Object.entries(values)) {
      if (value === null) image.removeAttribute(name);
      else image.setAttribute(name, value);
    }
  }
  function apply(binding) {
    const button = nativeButton(binding), active = !!button && mode !== "icon";
    if (binding.item !== binding.icon.item) { hidePreview(binding); binding.item = binding.icon.item; }
    if (button && !button.classList.contains("kroky-production-stats-overlay")) {
      const label = button.getAttribute("aria-label") || button.title || button.textContent || "View Item Stats";
      const glyph = document.createElement("i"); glyph.className = "fa fa-list"; glyph.setAttribute("aria-hidden", "true");
      button.replaceChildren(glyph);
      button.classList.remove("btn-outline-info", "align-self-center", "m-1");
      button.classList.add("btn-link", "text-info", "kroky-production-stats-overlay");
      button.title = label; button.setAttribute("aria-label", label);
      for (const event of ["click", "dblclick", "keydown", "keyup"]) button.addEventListener(event, event => event.stopPropagation());
      binding.image.parentElement.append(button); binding.embeddedButton = true;
    }
    binding.image.closest(".kroky-production-card")?.classList.toggle("kroky-main-stats-bound", !!button);
    binding.image.classList.toggle("kroky-skill-stats-art", active);
    if (mode !== "hover" || !active) hidePreview(binding);
    if (active) {
      binding.image.setAttribute("role", "button"); binding.image.setAttribute("tabindex", "0");
      binding.image.setAttribute("aria-label", `View Item Stats for ${binding.icon.item.name}`);
      if (binding.image.parentElement?.getAttribute("role") === "img") binding.image.parentElement.setAttribute("role", "group");
    } else {
      restoreAttributes(binding.image, binding.attributes);
      if (binding.parentRole === "img" && binding.image.parentElement?.getAttribute("role") === "group" && !binding.embeddedButton) binding.image.parentElement.setAttribute("role", "img");
    }
    if (button && binding.embeddedButton && binding.image.parentElement?.getAttribute("role") === "img") binding.image.parentElement.setAttribute("role", "group");
  }
  function bind(image) {
    if (!image?.matches(mainArt)) return;
    const icon = image.closest("item-current-icon");
    if (!icon || icon.itemImage !== image) return;
    let binding = bindings.get(image);
    if (!binding) {
      binding = { image, icon, parentRole: image.parentElement?.getAttribute("role"),
        attributes: Object.fromEntries(["role", "tabindex", "aria-label"].map(name => [name, image.getAttribute(name)])) };
      bindings.set(image, binding);
      image.addEventListener("click", event => openStats(binding, event));
      image.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") openStats(binding, event); });
      image.addEventListener("mouseenter", () => showPreview(binding));
      image.addEventListener("focus", () => showPreview(binding));
      image.addEventListener("mouseleave", () => hidePreview(binding));
      image.addEventListener("blur", () => hidePreview(binding));
    }
    if (ready) apply(binding);
  }
  function update() {
    if (!ready) return;
    const page = document.getElementById("page-container");
    page?.classList.toggle("kroky-skill-stats-click", mode === "click");
    page?.classList.toggle("kroky-skill-stats-hover", mode === "hover");
    for (const image of document.querySelectorAll(mainArt)) bind(image);
  }
  const CurrentIcon = customElements.get("item-current-icon");
  if (typeof CurrentIcon?.prototype.setItem === "function") ctx.patch(CurrentIcon, "setItem").after(function () { bind(this.itemImage); });
  if (typeof CurrentIcon?.prototype.disconnectedCallback === "function") ctx.patch(CurrentIcon, "disconnectedCallback").after(function () {
    const binding = bindings.get(this.itemImage);
    if (binding) { hidePreview(binding); binding.preview?.destroy(); binding.preview = undefined; }
  });
  const restore = () => { const saved = settings.get(settingName); mode = validMode(saved) ? saved : "click"; update(); };
  ctx.onCharacterLoaded(restore);
  ctx.patch(Game, "decode").after(restore);
  ctx.onInterfaceReady(() => {
    ready = true;
    if (!document.getElementById("kroky-item-stats-style")) {
      const style = document.createElement("style"); style.id = "kroky-item-stats-style";
      style.textContent = `
        .kroky-skill-stats-click .kroky-main-stats-bound .kroky-production-view-stats,
        .kroky-skill-stats-hover .kroky-main-stats-bound .kroky-production-view-stats { display: none !important; }
        .kroky-skill-stats-art { cursor: pointer; }
        .kroky-item-stats-preview { white-space: normal; }
        .kroky-item-stats-preview equipment-tooltip { display: block; }
      `;
      document.head.append(style);
    }
    restore();
  });
}
