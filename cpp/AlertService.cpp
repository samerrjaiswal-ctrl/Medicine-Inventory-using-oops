#include "AlertService.h"
#include <algorithm>

AlertService::AlertService(InventoryManager& inv, ThresholdEngine& eng, Storage& st)
    : inventory(inv), engine(eng), storage(st) {}

std::vector<std::unique_ptr<Alert>> AlertService::generate(const Date& today) const {
    std::vector<std::unique_ptr<Alert>> list;
    for (const auto& m : inventory.getAll()) {
        for (const auto& b : m.getBatches()) {
            if (b.getQuantity() == 0) continue;
            long d = b.daysLeft(today);
            if (ExpiryAlert::levelFor(d) != "Safe")
                list.push_back(std::unique_ptr<Alert>(new ExpiryAlert(m.getName(), b.getBatchNo(), d, b.getQuantity())));
        }
        int usable = m.validQty(today);
        int threshold = engine.reorderThreshold(m, today);
        if (usable < threshold)
            list.push_back(std::unique_ptr<Alert>(new LowStockAlert(m.getName(), usable, threshold)));
    }
    std::sort(list.begin(), list.end(),
              [](const std::unique_ptr<Alert>& a, const std::unique_ptr<Alert>& b) { return a->severity() > b->severity(); });
    return list;
}

std::string AlertService::toJson(const Date& today) const {
    auto list = generate(today);
    std::string j = "[";
    for (size_t i = 0; i < list.size(); i++) {
        if (i) j += ",";
        j += list[i]->toJson();                  // virtual calls resolved at run time
    }
    return j + "]";
}

void AlertService::logAlerts(const Date& today) const {
    for (const auto& a : generate(today)) storage.appendAlertLog(a->toLogLine(today.toString()));
}
