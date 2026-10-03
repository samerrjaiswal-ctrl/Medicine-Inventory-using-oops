#include "InventoryManager.h"
#include "Utils.h"
#include "Exceptions.h"
#include <cstdio>

InventoryManager::InventoryManager(Storage& s) : storage(s) {}

void InventoryManager::load() { storage.loadInventory(medicines); }
void InventoryManager::save() { storage.saveInventory(medicines); }

std::string InventoryManager::nextId() const {
    int mx = 0;
    for (const auto& m : medicines) {
        try { mx = std::max(mx, std::stoi(m.getId().substr(1))); } catch (...) {}
    }
    char buf[16];
    std::snprintf(buf, sizeof buf, "M%03d", mx + 1);
    return buf;
}

Medicine* InventoryManager::find(const std::string& key) {
    std::string k = util::lower(util::trim(key));
    for (auto& m : medicines)
        if (util::lower(m.getId()) == k || util::lower(m.getName()) == k) return &m;
    return nullptr;
}

Medicine& InventoryManager::get(const std::string& key) {
    Medicine* m = find(key);
    if (!m) throw NotFoundException("Medicine not found: " + key);
    return *m;
}

std::string InventoryManager::addMedicine(const std::string& name, char category, double price, int minLevel,
                                          const std::string& batchNo, int qty, const Date& expiry) {
    Medicine* existing = find(name);
    if (existing) {                                       // same medicine, new batch
        existing->addBatch(Batch(batchNo, qty, expiry));
        existing->setPrice(price).setMinLevel(minLevel);  // method chaining
        save();
        return "Batch " + batchNo + " added to existing medicine " + existing->getName();
    }
    Medicine m(nextId(), util::trim(name), category, price, minLevel);
    m.addBatch(Batch(batchNo, qty, expiry));
    medicines.push_back(m);
    save();
    return "Medicine added successfully (" + m.getId() + ")";
}

void InventoryManager::updateQuantity(const std::string& medicine, const std::string& batchNo, int qty) {
    Medicine& m = get(medicine);
    Batch* b = m.findBatch(batchNo);
    if (!b) throw NotFoundException("Batch not found: " + batchNo);
    b->setQuantity(qty);
    save();
}

void InventoryManager::updateExpiry(const std::string& medicine, const std::string& batchNo, const Date& expiry) {
    Medicine& m = get(medicine);
    Batch* b = m.findBatch(batchNo);
    if (!b) throw NotFoundException("Batch not found: " + batchNo);
    b->setExpiry(expiry);
    m.sortFEFO();
    save();
}

int InventoryManager::removeExpired(const Date& today) {
    int removed = 0;
    for (auto& m : medicines) removed += m.removeExpiredBatches(today);
    save();
    return removed;
}
