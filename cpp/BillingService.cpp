#include "BillingService.h"
#include "Utils.h"
#include "Exceptions.h"

BillingService::BillingService(InventoryManager& inv, Storage& st) : inventory(inv), storage(st) {}

void BillingService::load() {
    storage.loadBills(history);
    int mx = 0;
    for (const auto& b : history) mx = std::max(mx, Bill::numberFromId(b.getId()));
    Bill::setCounter(mx);
}

Bill BillingService::createBill(const std::string& buyerIn, const std::vector<std::pair<std::string, int>>& request,
                                const Date& today) {
    std::string buyer = util::trim(buyerIn);
    if (buyer.empty()) buyer = "Walk-in";
    if (buyer.find('|') != std::string::npos) throw ValidationException("Buyer name cannot contain |");
    if (request.empty()) throw ValidationException("Bill needs at least one item");

    std::vector<Medicine> backup = inventory.snapshot();          // so a failed bill changes nothing
    Bill bill("TEMP", today, buyer);
    std::vector<UsageRecord> usage;
    try {
        for (const auto& line : request) {
            Medicine& m = inventory.get(line.first);                              // 1. medicine exists?
            if (line.second <= 0) throw ValidationException("Quantity must be greater than zero for " + m.getName());
            int usable = m.validQty(today);                                      // 2/3. enough NON-EXPIRED stock?
            if (usable < line.second)
                throw InsufficientStockException(m.getName() + ": requested " + std::to_string(line.second) +
                                                 ", only " + std::to_string(usable) + " usable (non-expired) in stock");
            auto used = m.consumeFEFO(line.second, today);                       // 4/5. FEFO + reduce quantity
            for (const auto& u : used) bill += BillItem(m.getName(), u.first, u.second, m.getPrice());   // 6. calculate
            usage.push_back(UsageRecord{today, m.getId(), line.second});
        }
    } catch (...) {
        inventory.restore(backup);
        throw;
    }

    Bill finalBill(Bill::generateId(), today, buyer);
    for (const auto& it : bill.getItems()) finalBill += it;
    try {
        inventory.save();
        storage.appendBill(finalBill);                                           // 7. save in history
        for (const auto& u : usage) storage.appendUsage(u);
    } catch (...) {
        inventory.restore(backup);
        Bill::setCounter(Bill::getCounter() - 1);
        throw;
    }
    history.push_back(finalBill);
    return finalBill;                                                            // 8. printable via operator<<
}

const Bill& BillingService::getBill(const std::string& id) const {
    for (const auto& b : history)
        if (util::lower(b.getId()) == util::lower(id)) return b;
    throw NotFoundException("Bill not found: " + id);
}

std::string BillingService::historyJson() const {
    std::string j = "[";
    for (size_t i = history.size(); i-- > 0;) {                  // newest first
        j += history[i].toJson();
        if (i) j += ",";
    }
    return j + "]";
}
