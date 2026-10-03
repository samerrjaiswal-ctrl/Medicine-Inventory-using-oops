// main.cpp  -  tiny HTTP layer. The browser (HTML/CSS/JS) talks to the C++ classes through these routes.
#include <iostream>
#include <mutex>
#include <functional>
#include <fstream>
#include "httplib.h"
#include "FileStorage.h"
#include "InventoryManager.h"
#include "ThresholdEngine.h"
#include "AlertService.h"
#include "ReportService.h"
#include "BillingService.h"
#include "Utils.h"

using namespace httplib;
using std::string;

// read a parameter from form-data / query string / flat JSON body
static string param(const Request& req, const string& key, const string& def = "") {
    if (req.has_param(key)) return req.get_param_value(key);
    if (req.get_header_value("Content-Type").find("json") != string::npos) {
        auto m = util::parseFlatJson(req.body);
        auto it = m.find(key);
        if (it != m.end()) return it->second;
    }
    return def;
}
static string required(const Request& req, const string& key) {
    string v = util::trim(param(req, key));
    if (v.empty()) throw ValidationException("Missing field: " + key);
    return v;
}
static string ok(const string& msg) { return "{\"success\":true," + util::jstr("message", msg) + "}"; }

// "Paracetamol:2,Amoxicillin:1"  ->  [(Paracetamol,2),(Amoxicillin,1)]
static std::vector<std::pair<string, int>> parseItems(const string& s) {
    std::vector<std::pair<string, int>> out;
    for (const string& part : util::split(s, ',')) {
        if (util::trim(part).empty()) continue;
        size_t c = part.rfind(':');
        if (c == string::npos) throw ValidationException("Item must look like Name:Qty -> " + part);
        out.push_back({util::trim(part.substr(0, c)), util::toInt(part.substr(c + 1), "Quantity")});
    }
    return out;
}

int main(int argc, char** argv) {
    string dataDir = "data", webDir = "web";
    int port = 8080;
    if (argc > 1) port = std::atoi(argv[1]);

    FileStorage storage(dataDir);                  // Storage* -> FileStorage (polymorphism)
    InventoryManager inventory(storage);
    ThresholdEngine engine(storage, 7, 7);
    AlertService alerts(inventory, engine, storage);
    ReportService reports(inventory, engine, storage);
    BillingService billing(inventory, storage);

    try {
        inventory.load();
        billing.load();
        alerts.logAlerts(Date::today());
    } catch (const std::exception& e) {
        std::cerr << "Startup error: " << e.what() << "\n";
        return 1;
    }

    Server svr;
    std::mutex lock;
    svr.set_default_headers({{"Access-Control-Allow-Origin", "*"},
                             {"Access-Control-Allow-Methods", "GET, POST, OPTIONS"},
                             {"Access-Control-Allow-Headers", "Content-Type"}});
    svr.Options(R"(.*)", [](const Request&, Response& res) { res.status = 204; });

    // wraps every route: thread lock + exception handling (nested try/catch, multiple catch)
    auto route = [&](std::function<string(const Request&)> fn) {
        return [&lock, fn](const Request& req, Response& res) {
            std::lock_guard<std::mutex> g(lock);
            try {
                res.set_content(fn(req), "application/json");
            } catch (const ValidationException& e) {
                res.status = 400; res.set_content("{\"success\":false," + util::jstr("error", e.what()) + "}", "application/json");
            } catch (const NotFoundException& e) {
                res.status = 404; res.set_content("{\"success\":false," + util::jstr("error", e.what()) + "}", "application/json");
            } catch (const InsufficientStockException& e) {
                res.status = 409; res.set_content("{\"success\":false," + util::jstr("error", e.what()) + "}", "application/json");
            } catch (const std::exception& e) {
                res.status = 500; res.set_content("{\"success\":false," + util::jstr("error", e.what()) + "}", "application/json");
            }
        };
    };

    // ---------- dashboard / inventory ----------
    svr.Get("/api/health", route([&](const Request&) { return ok("C++ backend running"); }));
    svr.Get("/api/dashboard", route([&](const Request&) { return reports.dashboard(Date::today()); }));
    svr.Get("/api/medicines", route([&](const Request&) { return reports.medicines(Date::today()); }));

    svr.Post("/api/medicines", route([&](const Request& r) {
        string cat = util::trim(param(r, "category", "D"));
        string msg = inventory.addMedicine(required(r, "name"), cat.empty() ? 'D' : (char)std::toupper(cat[0]),
                                           util::toDouble(required(r, "price"), "Price"),
                                           util::toInt(param(r, "minLevel", "10"), "Minimum level"),
                                           required(r, "batchNo"), util::toInt(required(r, "quantity"), "Quantity"),
                                           Date::parse(required(r, "expiry")));
        alerts.logAlerts(Date::today());
        return ok(msg);
    }));

    svr.Post("/api/medicines/quantity", route([&](const Request& r) {
        inventory.updateQuantity(required(r, "medicine"), required(r, "batchNo"), util::toInt(required(r, "quantity"), "Quantity"));
        return ok("Quantity updated");
    }));

    svr.Post("/api/medicines/expiry", route([&](const Request& r) {
        inventory.updateExpiry(required(r, "medicine"), required(r, "batchNo"), Date::parse(required(r, "expiry")));
        return ok("Expiry updated");
    }));

    svr.Post("/api/medicines/remove-expired", route([&](const Request&) {
        int n = inventory.removeExpired(Date::today());
        return ok(std::to_string(n) + " expired batch(es) removed");
    }));

    // ---------- alerts & reports ----------
    svr.Get("/api/alerts", route([&](const Request&) { return alerts.toJson(Date::today()); }));
    svr.Get("/api/reports/inventory", route([&](const Request&) { return reports.inventoryReport(Date::today()); }));
    svr.Get("/api/reports/expired", route([&](const Request&) { return reports.expiredReport(Date::today()); }));
    svr.Get("/api/reports/near-expiry", route([&](const Request& r) {
        return reports.nearExpiryReport(Date::today(), util::toInt(param(r, "days", "90"), "days"));
    }));
    svr.Get("/api/reports/low-stock", route([&](const Request&) { return reports.lowStockReport(Date::today()); }));

    // ---------- billing ----------
    svr.Post("/api/bills", route([&](const Request& r) {
        Bill b = billing.createBill(param(r, "buyer"), parseItems(required(r, "items")), Date::today());
        alerts.logAlerts(Date::today());
        return "{\"success\":true,\"bill\":" + b.toJson() + "}";
    }));
    svr.Get("/api/bills", route([&](const Request&) { return billing.historyJson(); }));
    svr.Get(R"(/api/bills/([A-Za-z0-9]+))", route([&](const Request& r) {
        return billing.getBill(r.matches[1]).toJson();
    }));
    svr.Get(R"(/api/bills/([A-Za-z0-9]+)/print)", [&](const Request& r, Response& res) {
        std::lock_guard<std::mutex> g(lock);
        try {
            std::ostringstream os;
            os << billing.getBill(r.matches[1]);                 // operator<< (printable bill)
            res.set_content(os.str(), "text/plain; charset=utf-8");
        } catch (const std::exception& e) {
            res.status = 404; res.set_content(e.what(), "text/plain");
        }
    });

    svr.set_mount_point("/", webDir);                              // serves web/index.html if present

    std::cout << "Medical Inventory backend running on http://localhost:" << port << "\n"
              << "Today (system date): " << Date::today().toString() << "\n";
    if (!svr.listen("0.0.0.0", port)) {
        std::cerr << "Could not start server on port " << port << " (is it already in use?)\n";
        return 1;
    }
    return 0;
}
