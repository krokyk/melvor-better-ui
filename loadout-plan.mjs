const MAX_QUANTITY = 0xffffffff;

function checkQuantity(value, label, allowZero = false) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > MAX_QUANTITY)
    throw new Error(`${label} must be ${allowZero ? "a non-negative" : "a positive"} uint32 integer.`);
  return value;
}

function checkItem(item) {
  if (!item || typeof item.id !== "string" || item.id.length === 0)
    throw new Error("An equipment item is missing or invalid.");
}

function checkSlot(slot) {
  if (!slot || typeof slot.id !== "string" || slot.id.length === 0 || typeof slot.allowQuantity !== "boolean")
    throw new Error("An equipment slot is missing or invalid.");
}

function checkEntries(entries, withQuantities) {
  if (!Array.isArray(entries)) throw new Error("Equipment entries must be an array.");
  const items = new Set(), itemIDs = new Set(), occupied = new Map();
  for (const entry of entries) {
    const { slot, item, quantity } = entry ?? {};
    checkSlot(slot); checkItem(item);
    if (withQuantities) checkQuantity(quantity, `Equipped quantity of ${item.id}`);
    if (items.has(item) || itemIDs.has(item.id)) throw new Error(`${item.id} is assigned to more than one equipment slot.`);
    items.add(item); itemIDs.add(item.id);
    const fits = typeof item.fitsInSlot === "function" ? item.fitsInSlot(slot.id)
      : Array.isArray(item.validSlots) && item.validSlots.some(valid => valid === slot || valid?.id === slot.id);
    if (!fits) throw new Error(`${item.id} cannot be equipped in ${slot.id}.`);
    if (item.occupiesSlots !== undefined && !Array.isArray(item.occupiesSlots))
      throw new Error(`${item.id} has invalid occupied equipment slots.`);
    for (const claimed of [slot, ...(item.occupiesSlots ?? [])]) {
      checkSlot(claimed);
      if (occupied.has(claimed.id)) throw new Error(`${claimed.id} is required by more than one equipment entry.`);
      occupied.set(claimed.id, item);
    }
  }
  for (const { item } of entries) {
    if (item.cantEquipWith !== undefined && !Array.isArray(item.cantEquipWith))
      throw new Error(`${item.id} has invalid equipment conflicts.`);
    for (const conflict of item.cantEquipWith ?? []) {
      if (items.has(conflict)) throw new Error(`${item.id} cannot be equipped with ${conflict.id}.`);
    }
  }
}

function bankQuantity(bankQuantities, item) {
  const quantity = bankQuantities.get(item);
  return checkQuantity(quantity === undefined ? 0 : quantity, `Bank quantity of ${item.id}`, true);
}

/** Plans physical holdings for one active set; unavailable stack references stay empty. */
export function planLoadout(activeEntries, desiredEntries, bankQuantities = new Map()) {
  if (!(bankQuantities instanceof Map)) throw new Error("Bank quantities must be a Map.");
  checkEntries(activeEntries, true); checkEntries(desiredEntries, false);
  const bank = new Map(), activeByItem = new Map();
  for (const { item, quantity } of activeEntries) {
    bank.set(item, bankQuantity(bankQuantities, item) + quantity);
    activeByItem.set(item, quantity);
  }
  for (const { item } of desiredEntries) {
    if (!bank.has(item)) bank.set(item, bankQuantity(bankQuantities, item));
  }
  const equipment = [], missingStacks = [];
  for (const { slot, item } of desiredEntries) {
    const available = bank.get(item);
    if (available === 0) {
      if (!slot.allowQuantity) throw new Error(`${item.id} is unavailable in the Bank and active equipment.`);
      missingStacks.push({ slot, item });
      continue;
    }
    const quantity = slot.allowQuantity ? activeByItem.get(item) ?? available : 1;
    checkQuantity(quantity, `Target quantity of ${item.id}`);
    equipment.push({ slot, item, quantity });
    bank.set(item, available - quantity);
  }
  for (const [item, quantity] of bank) checkQuantity(quantity, `Resulting Bank quantity of ${item.id}`, true);
  return { equipment, bank, missingStacks };
}

/** Returns real inactive holdings to the Bank without inspecting the active set. */
export function planMigration(setsEntries, activeIndex, bankQuantities = new Map()) {
  if (!Array.isArray(setsEntries) || !Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= setsEntries.length)
    throw new Error("The active equipment set index is invalid.");
  if (!(bankQuantities instanceof Map)) throw new Error("Bank quantities must be a Map.");
  const bank = new Map(), clearSets = [];
  for (let index = 0; index < setsEntries.length; index++) {
    if (index === activeIndex) continue;
    const entries = setsEntries[index];
    if (!Array.isArray(entries)) throw new Error("Equipment entries must be an array.");
    for (const { item, quantity } of entries) {
      checkItem(item); checkQuantity(quantity, `Equipped quantity of ${item.id}`);
      const total = (bank.has(item) ? bank.get(item) : bankQuantity(bankQuantities, item)) + quantity;
      bank.set(item, checkQuantity(total, `Resulting Bank quantity of ${item.id}`, true));
    }
    clearSets.push(index);
  }
  return { bank, clearSets };
}
