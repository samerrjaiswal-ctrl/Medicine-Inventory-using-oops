// AlertService.h  -  builds Alert objects; works with base-class pointers (polymorphism)
#pragma once
#include <memory>
#include <vector>
#include "Alert.h"
#include "InventoryManager.h"
#include "ThresholdEngine.h"

class AlertService {
    InventoryManager& inventory;
    ThresholdEngine& engine;
    Storage& storage;
public:
    AlertService(InventoryManager& inv, ThresholdEngine& eng, Storage& st);
    std::vector<std::unique_ptr<Alert>> generate(const Date& today) const;   // sorted by severity
    std::string toJson(const Date& today) const;
    void logAlerts(const Date& today) const;                                   // writes alerts.log
};
