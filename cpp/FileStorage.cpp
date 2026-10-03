#include "FileStorage.h"
#include "Utils.h"
#include <fstream>
#include <iomanip>
#include <map>

FileStorage::FileStorage(const std::string& dataDir) : dir(dataDir) {}

// inventory.dat format (one record per line):
//   M,medId,name,category,price,minLevel
//   B,medId,batchNo,quantity,YYYY-MM-DD
void FileStorage::loadInventory(std::vector<Medicine>& out) {
    out.clear();
    std::ifstream in(path("inventory.dat"));
    if (!in) return;                                   // first run: no file yet -> empty inventory
    std::string line;
    int lineNo = 0;
    while (std::getline(in, line)) {
        lineNo++;
        line = util::trim(line);
        if (line.empty() || line[0] == '#') continue;
        std::vector<std::string> f = util::split(line, ',');
        try {
            if (f[0] == "M" && f.size() == 6) {
                out.push_back(Medicine(f[1], f[2], f[3].at(0), util::toDouble(f[4], "price"), util::toInt(f[5], "minLevel")));
            } else if (f[0] == "B" && f.size() == 5) {
                bool found = false;
                for (auto& m : out)
                    if (m.getId() == f[1]) {
                        m.addBatch(Batch(f[2], util::toInt(f[3], "quantity"), Date::parse(f[4])));
                        found = true;
                    }
                if (!found) throw StorageException("batch refers to unknown medicine");
            } else throw StorageException("unknown record type");
        } catch (const std::exception& e) {
            throw StorageException("inventory.dat line " + std::to_string(lineNo) + ": " + e.what());
        }
    }
}

void FileStorage::saveInventory(const std::vector<Medicine>& meds) {
    std::ofstream o(path("inventory.dat"), std::ios::trunc);
    if (!o) throw StorageException("Cannot write inventory.dat");
    o << "# M,id,name,category,price,minLevel   |   B,medId,batchNo,quantity,expiry\n";
    for (const auto& m : meds) {
        o << "M," << m.getId() << "," << m.getName() << "," << m.getCategory() << ","
          << util::money(m.getPrice()) << "," << m.getMinLevel() << "\n";
        for (const auto& b : m.getBatches())
            o << "B," << m.getId() << "," << b.getBatchNo() << "," << b.getQuantity() << "," << b.getExpiry().toString() << "\n";
    }
    if (!o) throw StorageException("Error while writing inventory.dat");
}

void FileStorage::appendUsage(const UsageRecord& r) {
    std::ofstream o(path("usage_log.txt"), std::ios::app);
    if (!o) throw StorageException("Cannot write usage_log.txt");
    o << r.date.toString() << "," << r.medicineId << "," << r.quantity << "\n";
}

std::vector<UsageRecord> FileStorage::readUsage() {
    std::vector<UsageRecord> v;
    std::ifstream in(path("usage_log.txt"));
    std::string line;
    while (std::getline(in, line)) {
        std::vector<std::string> f = util::split(util::trim(line), ',');
        if (f.size() != 3) continue;
        try { v.push_back(UsageRecord{Date::parse(f[0]), f[1], util::toInt(f[2], "qty")}); } catch (...) {}
    }
    return v;
}

void FileStorage::appendAlertLog(const std::string& line) {
    std::ofstream o(path("alerts.log"), std::ios::app);
    if (!o) throw StorageException("Cannot write alerts.log");
    o << line << "\n";
}

// bills.dat format:
//   BILL|id|date|buyer|total
//   ITEM|medicine|batch|qty|unitPrice
//   END
void FileStorage::loadBills(std::vector<Bill>& out) {
    out.clear();
    std::ifstream in(path("bills.dat"));
    if (!in) return;
    std::string line;
    bool open = false;
    std::string id, buyer;
    Date date(2000, 1, 1);
    std::vector<BillItem> items;
    while (std::getline(in, line)) {
        std::vector<std::string> f = util::split(util::trim(line), '|');
        if (f.empty()) continue;
        try {
            if (f[0] == "BILL" && f.size() >= 4) {
                id = f[1]; date = Date::parse(f[2]); buyer = f[3]; items.clear(); open = true;
            } else if (f[0] == "ITEM" && f.size() == 5 && open) {
                items.push_back(BillItem(f[1], f[2], util::toInt(f[3], "qty"), util::toDouble(f[4], "price")));
            } else if (f[0] == "END" && open) {
                Bill b(id, date, buyer);
                for (const auto& it : items) b += it;
                out.push_back(b);
                open = false;
            }
        } catch (const std::exception& e) {
            throw StorageException(std::string("bills.dat corrupted: ") + e.what());
        }
    }
}

void FileStorage::appendBill(const Bill& b) {
    std::ofstream o(path("bills.dat"), std::ios::app);
    if (!o) throw StorageException("Cannot write bills.dat");
    o << "BILL|" << b.getId() << "|" << b.getDate().toString() << "|" << b.getBuyer() << "|" << util::money(b.total()) << "\n";
    for (const auto& i : b.getItems())
        o << "ITEM|" << i.getMedicine() << "|" << i.getBatchNo() << "|" << i.getQuantity() << "|" << util::money(i.getPrice()) << "\n";
    o << "END\n";
}
