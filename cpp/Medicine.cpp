#include "Medicine.h"
#include "Exceptions.h"
#include <algorithm>

Medicine::Medicine() : id(""), name(""), category('D'), price(0), minLevel(0) {}

Medicine::Medicine(const std::string& id_, const std::string& name_, char cat, double price_, int minLevel_)
    : id(id_), name(name_), category(cat), price(price_), minLevel(minLevel_) {
    if (name.empty() || name.find(',') != std::string::npos || name.find('|') != std::string::npos)
        throw ValidationException("Medicine name is invalid (empty or contains , or |)");
    if (cat != 'V' && cat != 'E' && cat != 'D') throw ValidationException("Category must be V, E or D");
    if (price < 0) throw ValidationException("Price cannot be negative");
    if (minLevel < 0) throw ValidationException("Minimum level cannot be negative");
}

Medicine& Medicine::setPrice(double p) {
    if (p < 0) throw ValidationException("Price cannot be negative");
    this->price = p;
    return *this;
}

Medicine& Medicine::setMinLevel(int m) {
    if (m < 0) throw ValidationException("Minimum level cannot be negative");
    this->minLevel = m;
    return *this;
}

Batch* Medicine::findBatch(const std::string& batchNo) {
    for (auto& b : batches)
        if (b.getBatchNo() == batchNo) return &b;
    return nullptr;
}

void Medicine::addBatch(const Batch& b) {
    Batch* existing = findBatch(b.getBatchNo());
    if (existing) existing->setQuantity(existing->getQuantity() + b.getQuantity());
    else batches.push_back(b);
    sortFEFO();
}

void Medicine::sortFEFO() { std::sort(batches.begin(), batches.end()); }   // uses Batch::operator<

int Medicine::totalQty() const {
    int t = 0;
    for (const auto& b : batches) t += b.getQuantity();
    return t;
}

int Medicine::validQty(const Date& today) const {
    int t = 0;
    for (const auto& b : batches)
        if (!b.isExpired(today)) t += b.getQuantity();
    return t;
}

int Medicine::removeExpiredBatches(const Date& today) {
    int removed = 0;
    for (auto it = batches.begin(); it != batches.end();) {
        if (it->isExpired(today)) { it = batches.erase(it); removed++; }
        else ++it;
    }
    return removed;
}

std::vector<std::pair<std::string, int>> Medicine::consumeFEFO(int qty, const Date& today) {
    if (qty <= 0) throw ValidationException("Quantity must be greater than zero");
    if (validQty(today) < qty) throw InsufficientStockException("Not enough non-expired stock of " + name);
    sortFEFO();
    std::vector<std::pair<std::string, int>> used;
    int need = qty;
    for (auto& b : batches) {
        if (need == 0) break;
        if (b.isExpired(today) || b.getQuantity() == 0) continue;     // never sell expired stock
        int take = std::min(need, b.getQuantity());
        b.setQuantity(b.getQuantity() - take);
        need -= take;
        used.push_back(std::make_pair(b.getBatchNo(), take));
    }
    batches.erase(std::remove_if(batches.begin(), batches.end(),
                  [](const Batch& b) { return b.getQuantity() == 0; }), batches.end());
    return used;
}

std::ostream& operator<<(std::ostream& os, const Medicine& m) {
    os << m.id << " " << m.name << " [" << m.category << "] Rs." << m.price << " stock=" << m.totalQty();
    return os;
}
