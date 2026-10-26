const activeBanks = new WeakSet();

function replaceMethod(object, key, replacement, restores) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (typeof object[key] !== "function") throw new Error(`Missing native method: ${key}`);
  Object.defineProperty(object, key, {
    value: replacement,
    configurable: descriptor?.configurable ?? true,
    enumerable: descriptor?.enumerable ?? false,
    writable: descriptor?.writable ?? true,
  });
  restores.push(() => {
    if (descriptor) Object.defineProperty(object, key, descriptor);
    else delete object[key];
  });
}

function committedError(error) {
  try {
    error.ownershipCommitted = true;
    if (error.ownershipCommitted) return error;
  } catch { /* A primitive or frozen error needs a wrapper. */ }
  const failure = new Error(error instanceof Error ? error.message : String(error), { cause: error });
  failure.ownershipCommitted = true;
  return failure;
}

function addOwnership(totals, item, quantity) {
  totals.set(item, (totals.get(item) ?? 0) + quantity);
}

function checkOwnership(before, after) {
  for (const item of new Set([...before.keys(), ...after.keys()])) {
    if ((before.get(item) ?? 0) !== (after.get(item) ?? 0))
      throw new Error(`Equipment transaction changes ownership of ${item.id}.`);
  }
}

/** Apply preflighted complete root entries to native Equipment objects without publishing partial ownership. */
export function applyEquipmentTransaction(game, changes, bankQuantities, afterCommit) {
  const bank = game.bank;
  if (activeBanks.has(bank)) throw new Error("An equipment transaction is already running.");
  const bankBefore = new Map();
  const changedBank = new Map();
  for (const [item, quantity] of bankQuantities) {
    if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error("Invalid final bank quantity.");
    const bankItem = bank.items.get(item);
    const oldQuantity = bankItem?.quantity ?? 0;
    if (quantity === oldQuantity) continue;
    bankBefore.set(item, { bankItem, quantity: oldQuantity });
    changedBank.set(item, quantity);
  }
  const beforeOwnership = new Map(), plannedOwnership = new Map();
  for (const { equipment, entries } of changes) {
    for (const equipped of equipment.equippedArray) {
      if (equipped.providesStats) addOwnership(beforeOwnership, equipped.item, equipped.quantity);
    }
    for (const { item, quantity } of entries) addOwnership(plannedOwnership, item, quantity);
  }
  for (const [item, { quantity }] of bankBefore) addOwnership(beforeOwnership, item, quantity);
  for (const [item, quantity] of changedBank) addOwnership(plannedOwnership, item, quantity);
  checkOwnership(beforeOwnership, plannedOwnership);
  const tabsBefore = new Map();
  for (const [item, { bankItem }] of bankBefore) {
    const tab = bankItem?.tab ?? bank.getItemDefaultTab(item);
    if (!tabsBefore.has(tab)) {
      const array = bank.itemsByTab[tab];
      tabsBefore.set(tab, { array, entries: array.slice() });
    }
  }
  const sortOrder = changedBank.size ? bank.customSortOrder : undefined;
  const sortBefore = sortOrder?.slice();
  const equipmentBefore = changes.map(({ equipment }) => ({
    equipment,
    slots: equipment.equippedArray.map(equipped => ({
      equipped,
      fields: new Map(["item", "quantity", "occupies", "occupiedBy"].map(key => [
        key, Object.getOwnPropertyDescriptor(equipped, key),
      ])),
    })),
    itemSlots: [...equipment.itemSlotMap],
    chargeUsers: [...equipment.itemChargeUsers],
  }));
  const restores = [];
  const deferred = [];
  let ownershipCommitted = false;
  let publishedQuantities;
  const deferQuantity = (object, emit, args, events) => {
    const event = args[1];
    if (!events.has(event.item)) {
      events.set(event.item, event);
      deferred.push(() => {
        event.oldQuantity = bankBefore.get(event.item).quantity;
        event.newQuantity = publishedQuantities.get(event.item);
        if (event.oldQuantity !== event.newQuantity) emit.apply(object, args);
      });
    }
  };
  const rollback = () => {
    for (const [item, { bankItem, quantity }] of bankBefore) {
      if (bankItem) {
        bankItem.quantity = quantity;
        bank.items.set(item, bankItem);
      } else bank.items.delete(item);
    }
    for (const [tab, { array, entries }] of tabsBefore) {
      bank.itemsByTab[tab] = array;
      array.length = entries.length;
      entries.forEach((entry, position) => {
        array[position] = entry;
        entry.tab = tab;
        entry.tabPosition = position;
      });
    }
    if (sortOrder) {
      bank.customSortOrder = sortOrder;
      sortOrder.length = sortBefore.length;
      sortBefore.forEach((item, index) => { sortOrder[index] = item; });
    }
    for (const { equipment, slots, itemSlots, chargeUsers } of equipmentBefore) {
      for (const { equipped, fields } of slots) {
        for (const [key, descriptor] of fields) {
          if (descriptor) Object.defineProperty(equipped, key, descriptor);
          else delete equipped[key];
        }
      }
      equipment.itemSlotMap.clear();
      itemSlots.forEach(([item, slot]) => equipment.itemSlotMap.set(item, slot));
      equipment.itemChargeUsers.clear();
      chargeUsers.forEach(equipped => equipment.itemChargeUsers.add(equipped));
    }
  };
  activeBanks.add(bank);
  try {
    try {
      if (changedBank.size) {
        const bankEmit = bank._events.emit;
        const bankEvents = new Map();
        replaceMethod(bank._events, "emit", function (...args) {
          if (args[0] === "itemChanged" && bankBefore.has(args[1]?.item)) {
            deferQuantity(this, bankEmit, args, bankEvents);
          } else deferred.push(() => bankEmit.apply(this, args));
        }, restores);
        for (const item of bankBefore.keys()) {
          const emit = item.emit;
          const itemEvents = new Map();
          replaceMethod(item, "emit", function (...args) {
            if (args[0] === "bankQuantityChanged") deferQuantity(this, emit, args, itemEvents);
            else return emit.apply(this, args);
          }, restores);
        }
        const telemetry = game.telemetry;
        const gained = telemetry.createItemGainedEvent;
        replaceMethod(telemetry, "createItemGainedEvent", function (...args) {
          deferred.push(() => gained.apply(this, args));
        }, restores);
      }
      for (const [item, quantity] of changedBank) {
        const oldQuantity = bankBefore.get(item).quantity;
        if (quantity < oldQuantity) bank.removeItemQuantity(item, oldQuantity - quantity, false);
      }
      for (const { equipment, entries } of changes) {
        for (const equipped of equipment.equippedArray) {
          if (equipped.providesStats) equipment.unequipItem(equipped.slot);
        }
        for (const { slot, item, quantity } of entries) equipment.equipItem(item, slot, quantity);
      }
      for (const [item, quantity] of changedBank) {
        const oldQuantity = bankBefore.get(item).quantity;
        if (quantity > oldQuantity && !bank.addItem(item, quantity - oldQuantity, false, false, false, false, "Game.Unequip")) {
          throw new Error("Equipment could not be returned to the bank.");
        }
      }
      const actualOwnership = new Map();
      for (const { equipment } of changes) {
        for (const equipped of equipment.equippedArray) {
          if (equipped.providesStats) addOwnership(actualOwnership, equipped.item, equipped.quantity);
        }
      }
      for (const item of changedBank.keys()) addOwnership(actualOwnership, item, bank.items.get(item)?.quantity ?? 0);
      checkOwnership(beforeOwnership, actualOwnership);
      ownershipCommitted = true;
      afterCommit();
      publishedQuantities = new Map([...bankBefore.keys()].map(item => [item, bank.items.get(item)?.quantity ?? 0]));
    } catch (error) {
      if (!ownershipCommitted) rollback();
      throw error;
    } finally {
      for (let index = restores.length - 1; index >= 0; index--) restores[index]();
    }
    for (const publish of deferred) publish();
  } catch (error) {
    throw ownershipCommitted ? committedError(error) : error;
  } finally {
    activeBanks.delete(bank);
  }
}
