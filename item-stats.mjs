const settingName = "skill-item-stats-mode";
const mainArt = ".kroky-production-card .kroky-production-image";

function equipmentStatsTables(item, game, options) {
  const container = document.createElement("div"); container.className = "kroky-equipment-stats-tables";
  const values = new EquipmentStats(item.equipmentStats);
  const equipment = options.equipment ?? game.combat?.player?.equipment;
  const slot = options.slot ?? item.validSlots?.[0];
  let current, next;
  if (equipment && typeof equipment.addEquipmentStats === "function" && typeof equipment.getItemsAddedOnEquip === "function") {
    current = new EquipmentStats(); next = new EquipmentStats();
    equipment.addEquipmentStats(current); equipment.addEquipmentStats(next);
    for (const removed of equipment.getItemsAddedOnEquip(item, slot)) {
      const rootSlot = equipment.getSlotOfItem?.(removed.item);
      const equipped = rootSlot ? equipment.getEquippedInSlot(rootSlot)
        : equipment.equippedArray?.find(entry => entry.item === removed.item && entry.occupiedBy === undefined);
      if (equipped?.providesStats === false || equipped?.slot.providesEquipStats === false) continue;
      next.remItemStats(removed.item);
    }
    if (slot?.providesEquipStats !== false) next.addItemStats(item);
  }
  const lang = (key, fallback) => typeof getLangString === "function" ? getLangString(key) : fallback;
  const numeric = value => typeof numberWithCommas === "function" ? numberWithCommas(value) : String(value);
  const percent = value => typeof formatPercent === "function" ? formatPercent(value) : `${value}%`;
  const seconds = value => typeof templateLangString === "function" ? templateLangString("MENU_TEXT_SECONDS_SHORT", { seconds: String(value / 1000) }) : `${value / 1000}s`;
  function section(key, fallback) {
    const block = document.createElement("section"), heading = document.createElement("h5"), table = document.createElement("table");
    block.className = "kroky-equipment-stats-section";
    heading.className = "kroky-equipment-stats-heading"; heading.textContent = lang(key, fallback);
    table.className = "kroky-equipment-stats-table";
    block.append(heading, table); container.append(block);
    return table;
  }
  function row(table, key, label, value, difference, { skill, format = numeric, lowerBetter = false } = {}) {
    const line = document.createElement("tr"), name = document.createElement("th"), amount = document.createElement("td"), change = document.createElement("td");
    line.dataset.stat = key; name.scope = "row";
    amount.className = "kroky-equipment-stat-value-cell"; change.className = "kroky-equipment-stat-difference-cell";
    if (skill?.media) {
      const image = document.createElement("img"); image.className = "skill-icon-xxs m-0 mr-1"; image.src = skill.media; image.alt = skill.name ?? "";
      name.append(image);
    }
    const text = document.createElement("span"); text.textContent = label; name.append(text);
    const absolute = document.createElement("span"); absolute.className = "kroky-equipment-stat-value font-w600";
    absolute.textContent = format(value); amount.append(absolute);
    if (current) {
      const delta = document.createElement("span"); delta.className = "kroky-equipment-stat-difference";
      delta.textContent = `${difference > 0 ? "+" : ""}${format(difference)}`;
      if (difference !== 0) delta.classList.add((lowerBetter ? difference < 0 : difference > 0) ? "text-success" : "text-danger");
      change.append(delta);
    }
    line.append(name, amount, change); table.append(line);
  }
  const offensive = section("COMBAT_MISC_42", "Offensive Stats");
  const weapon = typeof WeaponItem === "function" ? item instanceof WeaponItem : !!item.damageType || item.equipmentStats.some(stat => stat.key === "attackSpeed");
  if (weapon) {
    if (item.damageType) {
      const line = document.createElement("tr"), name = document.createElement("th"), value = document.createElement("td");
      line.dataset.stat = "damageType"; name.scope = "row"; name.textContent = lang("DAMAGE_TYPE", "Damage Type");
      value.colSpan = 2;
      value.textContent = item.damageType.name; line.append(name, value); offensive.append(line);
    }
    const difference = current ? (next.attackSpeed || 4000) - (current.attackSpeed || 4000) : 0;
    row(offensive, "attackSpeed", lang("EQUIPMENT_STAT_ATTACK_INTERVAL", "Attack Interval"), values.attackSpeed, difference, { format: seconds, lowerBetter: true });
  }
  const fields = [
    ["stabAttackBonus", "STAB_BONUS", "Stab Bonus", game.attack],
    ["slashAttackBonus", "SLASH_BONUS", "Slash Bonus", game.attack],
    ["blockAttackBonus", "BLOCK_BONUS", "Block Bonus", game.attack],
    ["meleeStrengthBonus", "STRENGTH_BONUS", "Melee Strength Bonus", game.strength],
    ["rangedAttackBonus", "ATTACK_BONUS", "Ranged Attack Bonus", game.ranged],
    ["rangedStrengthBonus", "STRENGTH_BONUS", "Ranged Strength Bonus", game.ranged],
    ["magicAttackBonus", "ATTACK_BONUS", "Magic Attack Bonus", game.altMagic ?? game.magic],
    ["magicDamageBonus", "DAMAGE_BONUS", "Magic Damage Bonus", game.altMagic ?? game.magic],
  ];
  for (const [key, label, fallback, skill] of fields) row(offensive, key, lang(`EQUIPMENT_STAT_${label}`, fallback), values[key], current ? next[key] - current[key] : 0, { skill });
  const defensive = section("COMBAT_MISC_91", "Defensive Stats");
  for (const [key, skill, fallback] of [["meleeDefenceBonus", game.defence, "Melee Defence Bonus"], ["rangedDefenceBonus", game.ranged, "Ranged Defence Bonus"], ["magicDefenceBonus", game.altMagic ?? game.magic, "Magic Defence Bonus"]]) {
    row(defensive, key, lang("EQUIPMENT_STAT_DEFENCE_BONUS", fallback), values[key], current ? next[key] - current[key] : 0, { skill });
  }
  game.damageTypes?.forEach(damageType => {
    const value = values.getResistance(damageType), before = current?.getResistance(damageType) ?? 0, after = next?.getResistance(damageType) ?? 0;
    if (damageType.onlyShowIfUsing && value === 0 && before === 0 && after === 0 && !game.combat?.isDamageTypeInUse?.(damageType)) return;
    row(defensive, `resistance:${damageType.id}`, damageType.resistanceName ?? damageType.name, value, after - before,
      { format: percent, skill: { media: damageType.media, name: damageType.resistanceName ?? damageType.name } });
  });
  return container;
}

export function createItemStatsPreview(item, game, options = {}) {
  const element = document.createElement("div");
  element.className = "kroky-item-stats-preview text-left font-size-sm";
  const stats = Array.isArray(item?.equipmentStats) ? item.equipmentStats : [];
  const requirements = Array.isArray(item?.equipRequirements) ? item.equipRequirements : [];
  const hasStats = stats.some(stat => Number.isFinite(stat.value) && stat.value !== 0)
    || (item?.specialAttacks?.length ?? 0) > 0 || requirements.length > 0 || (item?.hasDescription && !!item.modifiedDescription);
  const Tooltip = customElements.get("equipment-tooltip");
  const equipment = typeof EquipmentItem === "function" && item instanceof EquipmentItem;
  const fullStats = options.fullStats && hasStats && typeof EquipmentStats === "function" && (equipment || stats.length > 0);
  const vanilla = fullStats && options.layout === "vanilla";
  const details = fullStats ? document.createElement("div") : element;
  if (fullStats) {
    details.className = "kroky-equipment-item-details";
    const tables = equipmentStatsTables(item, game, options);
    if (vanilla) {
      element.classList.add("kroky-item-stats-vanilla");
      element.append(details, tables);
      const name = document.createElement("h5");
      name.className = "kroky-equipment-preview-name"; name.textContent = item.name;
      details.append(name);
      if (item.media) {
        const image = document.createElement("img");
        image.className = "kroky-equipment-preview-art"; image.src = item.media; image.alt = "";
        details.append(image);
      }
    } else element.append(tables, details);
  }
  if (hasStats && equipment && typeof Tooltip?.prototype.setItem === "function") {
    const tooltip = document.createElement("equipment-tooltip");
    tooltip.setItem(item, !fullStats);
    if (vanilla) {
      if (tooltip.itemName) tooltip.itemName.hidden = true;
      if (tooltip.itemDamageType) tooltip.itemDamageType.hidden = true;
    }
    details.append(tooltip);
  } else {
    if (!vanilla) {
      const name = document.createElement("strong");
      name.className = "d-block text-warning"; name.textContent = item?.name ?? "";
      details.append(name);
    }
    if (hasStats) {
      if (item.hasDescription && item.modifiedDescription) {
        const description = document.createElement("small");
        description.className = "d-block text-info"; description.innerHTML = item.modifiedDescription;
        details.append(description);
      }
      for (const stat of fullStats ? [] : stats) {
        if (!Number.isFinite(stat.value) || stat.value === 0) continue;
        const line = document.createElement("div");
        line.textContent = typeof Equipment === "function" && typeof Equipment.getEquipStatDescription === "function" ? Equipment.getEquipStatDescription(stat) : `${stat.key}: ${stat.value}`;
        line.className = stat.value < 0 ? "text-danger" : "text-success";
        details.append(line);
      }
    }
  }
  for (const requirement of requirements) {
    if (typeof requirement.getNodes !== "function") continue;
    const line = document.createElement("div"); line.className = "font-size-sm mt-1";
    line.append(...requirement.getNodes("skill-icon-xs mr-2"));
    if (typeof requirement.isMet === "function") line.classList.add(requirement.isMet() ? "text-success" : "text-danger");
    details.append(line);
  }
  if (hasStats && item?.consumesChargesOn && typeof game.itemCharges?.getCharges === "function") {
    const charges = game.itemCharges.getCharges(item), line = document.createElement("small");
    line.className = "d-block text-success";
    const quantity = typeof numberWithCommas === "function" ? numberWithCommas(charges) : String(charges);
    line.textContent = typeof templateLangString === "function" ? templateLangString("MENU_TEXT_CHARGES_REMAINING", { charges: quantity }) : `${quantity} charges remaining`;
    details.append(line);
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
