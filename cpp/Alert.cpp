#include "Alert.h"
#include "Utils.h"

int Alert::created = 0;

Alert::Alert(const std::string& m, const std::string& b) : medicine(m), batch(b) { created++; }
Alert::~Alert() {}

std::string Alert::toJson() const {
    return "{" + util::jstr("type", type()) + "," + util::jstr("level", level()) + "," +
           util::jstr("medicine", medicine) + "," + util::jstr("batch", batch) + "," +
           util::jstr("message", message()) + "," + util::jint("severity", severity()) + "}";
}

std::string Alert::toLogLine(const std::string& date) const {
    return date + " [" + level() + "] " + message();
}

ExpiryAlert::ExpiryAlert(const std::string& m, const std::string& b, long d, int q)
    : Alert(m, b), daysLeft(d), qty(q) {}

std::string ExpiryAlert::levelFor(long d) {
    if (d < 0) return "Expired";
    if (d <= 30) return "Critical";
    if (d <= 60) return "Warning";
    if (d <= 90) return "Watch";
    return "Safe";
}

std::string ExpiryAlert::message() const {
    std::string base = medicine + " (batch " + batch + ", qty " + std::to_string(qty) + ") ";
    if (daysLeft < 0) return base + "expired " + std::to_string(-daysLeft) + " day(s) ago";
    if (daysLeft == 0) return base + "expires today";
    return base + "expires in " + std::to_string(daysLeft) + " day(s)";
}

int ExpiryAlert::severity() const {
    std::string l = level();
    if (l == "Expired") return 5;
    if (l == "Critical") return 4;
    if (l == "Warning") return 3;
    return 2;
}

LowStockAlert::LowStockAlert(const std::string& m, int q, int t) : Alert(m, ""), qty(q), threshold(t) {}

std::string LowStockAlert::message() const {
    return medicine + " has only " + std::to_string(qty) + " usable unit(s); reorder threshold is " + std::to_string(threshold);
}
