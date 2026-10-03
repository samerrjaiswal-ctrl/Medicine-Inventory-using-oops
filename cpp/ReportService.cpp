#include "ReportService.h"
#include "Utils.h"
#include <algorithm>

ReportService::ReportService(InventoryManager& inv, ThresholdEngine& eng, Storage& st)
    : inventory(inv), engine(eng), storage(st) {}

std::string ReportService::medicineJson(const Medicine& m, const Date& today) const {
    std::string j = "{" + util::jstr("id", m.getId()) + "," + util::jstr("name", m.getName()) + "," +
                    util::jstr("category", std::string(1, m.getCategory())) + "," + util::jnum("price", m.getPrice()) + "," +
                    util::jint("minLevel", m.getMinLevel()) + "," + util::jint("totalQty", m.totalQty()) + "," +
                    util::jint("usableQty", m.validQty(today)) + "," +
                    util::jint("reorderThreshold", engine.reorderThreshold(m, today)) + "," +
                    util::jnum("avgDailyUsage", engine.avgDailyUsage(m.getId(), today)) + "," +
                    util::jint("atRiskQty", engine.atRiskQty(m, today)) + ",\"batches\":[";
    const auto& bs = m.getBatches();
    for (size_t i = 0; i < bs.size(); i++) {
        if (i) j += ",";
        long d = bs[i].daysLeft(today);
        j += "{" + util::jstr("batchNo", bs[i].getBatchNo()) + "," + util::jint("quantity", bs[i].getQuantity()) + "," +
             util::jstr("expiry", bs[i].getExpiry().toString()) + "," + util::jint("daysLeft", d) + "," +
             util::jstr("status", ExpiryAlert::levelFor(d)) + "}";
    }
    return j + "]}";
}

std::string ReportService::medicines(const Date& today) const {
    std::string j = "[";
    const auto& all = inventory.getAll();
    for (size_t i = 0; i < all.size(); i++) {
        if (i) j += ",";
        j += medicineJson(all[i], today);
    }
    return j + "]";
}

std::string ReportService::dashboard(const Date& today) const {
    int batches = 0, expired = 0, near = 0, low = 0, units = 0;
    for (const auto& m : inventory.getAll()) {
        units += m.totalQty();
        for (const auto& b : m.getBatches()) {
            batches++;
            long d = b.daysLeft(today);
            if (b.getQuantity() > 0 && d < 0) expired++;
            else if (b.getQuantity() > 0 && d <= 90) near++;
        }
        if (m.validQty(today) < engine.reorderThreshold(m, today)) low++;
    }
    std::vector<Bill> bills;
    storage.loadBills(bills);
    double todaySales = 0;
    for (const auto& b : bills) if (b.getDate() == today) todaySales += b.total();
    AlertService as(inventory, engine, storage);
    return "{" + util::jint("totalMedicines", (long)inventory.getAll().size()) + "," + util::jint("totalBatches", batches) + "," +
           util::jint("totalUnits", units) + "," + util::jint("expired", expired) + "," + util::jint("nearExpiry", near) + "," +
           util::jint("lowStock", low) + "," + util::jint("totalBills", (long)bills.size()) + "," +
           util::jnum("todaySales", todaySales) + "," + util::jstr("today", today.toString()) + "," +
           util::jint("alertCount", (long)as.generate(today).size()) + "}";
}

static std::string rowJson(const Medicine& m, const Batch& b, const Date& today) {
    long d = b.daysLeft(today);
    return "{" + util::jstr("medicine", m.getName()) + "," + util::jstr("batchNo", b.getBatchNo()) + "," +
           util::jint("quantity", b.getQuantity()) + "," + util::jstr("expiry", b.getExpiry().toString()) + "," +
           util::jint("daysLeft", d) + "," + util::jstr("status", ExpiryAlert::levelFor(d)) + "," +
           util::jnum("value", m.getPrice() * b.getQuantity()) + "}";
}

std::string ReportService::inventoryReport(const Date& today) const {
    std::string j = "[";
    bool first = true;
    for (const auto& m : inventory.getAll())
        for (const auto& b : m.getBatches()) { if (!first) j += ","; first = false; j += rowJson(m, b, today); }
    return j + "]";
}

std::string ReportService::expiredReport(const Date& today) const {
    std::string j = "[";
    bool first = true;
    for (const auto& m : inventory.getAll())
        for (const auto& b : m.getBatches())
            if (b.isExpired(today) && b.getQuantity() > 0) { if (!first) j += ","; first = false; j += rowJson(m, b, today); }
    return j + "]";
}

std::string ReportService::nearExpiryReport(const Date& today, int days) const {
    std::string j = "[";
    bool first = true;
    for (const auto& m : inventory.getAll())
        for (const auto& b : m.getBatches()) {
            long d = b.daysLeft(today);
            if (b.getQuantity() > 0 && d >= 0 && d <= days) { if (!first) j += ","; first = false; j += rowJson(m, b, today); }
        }
    return j + "]";
}

std::string ReportService::lowStockReport(const Date& today) const {
    std::string j = "[";
    bool first = true;
    for (const auto& m : inventory.getAll()) {
        int usable = m.validQty(today), th = engine.reorderThreshold(m, today);
        if (usable < th) {
            if (!first) j += ",";
            first = false;
            j += "{" + util::jstr("medicine", m.getName()) + "," + util::jstr("category", std::string(1, m.getCategory())) + "," +
                 util::jint("usableQty", usable) + "," + util::jint("reorderThreshold", th) + "," +
                 util::jint("suggestedOrder", std::max(0, 2 * th - usable)) + "}";
        }
    }
    return j + "]";
}
