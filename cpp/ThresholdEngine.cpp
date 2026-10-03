#include "ThresholdEngine.h"
#include "MovingAverage.h"
#include <cmath>
#include <algorithm>

ThresholdEngine::ThresholdEngine(Storage& s, int w, int l) : storage(s), windowDays(w), leadTimeDays(l) {}

double ThresholdEngine::vedFactor(char c) {
    switch (c) {
        case 'V': return 1.5;
        case 'E': return 1.2;
        default:  return 1.0;
    }
}

double ThresholdEngine::avgDailyUsage(const std::string& id, const Date& today) const {
    std::vector<UsageRecord> log = storage.readUsage();
    MovingAverage<int> ma(windowDays);                        // template class
    for (int i = windowDays - 1; i >= 0; i--) {                // oldest day -> today
        Date day = today.addDays(-i);
        int sold = 0;
        for (const auto& r : log)
            if (r.medicineId == id && r.date == day) sold += r.quantity;
        ma.add(sold);
    }
    return ma.average();
}

int ThresholdEngine::reorderThreshold(const Medicine& m, const Date& today) const {
    double dynamic = avgDailyUsage(m.getId(), today) * leadTimeDays * vedFactor(m.getCategory());
    return std::max(m.getMinLevel(), (int)std::ceil(dynamic));
}

int ThresholdEngine::atRiskQty(const Medicine& m, const Date& today) const {
    double avg = avgDailyUsage(m.getId(), today);
    std::vector<Batch> bs = m.getBatches();                     // already FEFO sorted
    std::sort(bs.begin(), bs.end());
    double before = 0, atRisk = 0;
    for (const auto& b : bs) {
        if (b.isExpired(today) || b.getQuantity() == 0) continue;
        double canSell = std::max(0.0, avg * b.daysLeft(today) - before);   // sold from this batch before it expires
        atRisk += std::max(0.0, b.getQuantity() - canSell);
        before += b.getQuantity();
    }
    return (int)std::ceil(atRisk);
}
