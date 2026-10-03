// ReportService.h  -  dashboard + reports (returns JSON text for the web UI)
#pragma once
#include <string>
#include "InventoryManager.h"
#include "ThresholdEngine.h"
#include "AlertService.h"

class ReportService {
    InventoryManager& inventory;
    ThresholdEngine& engine;
    Storage& storage;
    std::string medicineJson(const Medicine& m, const Date& today) const;
public:
    ReportService(InventoryManager& inv, ThresholdEngine& eng, Storage& st);
    std::string medicines(const Date& today) const;       // full inventory list (with batches)
    std::string dashboard(const Date& today) const;       // summary cards
    std::string inventoryReport(const Date& today) const; // one row per batch
    std::string expiredReport(const Date& today) const;
    std::string nearExpiryReport(const Date& today, int days = 90) const;
    std::string lowStockReport(const Date& today) const;
};
