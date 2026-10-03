// ThresholdEngine.h  -  research-paper features: moving average, dynamic reorder threshold (with VED), at-risk quantity
#pragma once
#include "Storage.h"
#include "Medicine.h"

class ThresholdEngine {
    Storage& storage;
    int windowDays;      // moving-average window (days)
    int leadTimeDays;    // supplier lead time (days)
public:
    ThresholdEngine(Storage& s, int windowDays = 7, int leadTimeDays = 7);
    ~ThresholdEngine() {}

    static double vedFactor(char category);                                  // V=1.5, E=1.2, D=1.0
    double avgDailyUsage(const std::string& medicineId, const Date& today) const;
    int reorderThreshold(const Medicine& m, const Date& today) const;       // max(minLevel, avg*lead*VED)
    int atRiskQty(const Medicine& m, const Date& today) const;              // stock unlikely to be sold before expiry
    int getWindowDays() const { return windowDays; }
    int getLeadTimeDays() const { return leadTimeDays; }
};
