#include "Bill.h"
#include "Utils.h"
#include <iomanip>
#include <cstdio>

BillItem::BillItem(const std::string& med, const std::string& batch, int qty, double p)
    : medicine(med), batchNo(batch), quantity(qty), price(p) {}

int Bill::counter = 0;

Bill::Bill(const std::string& id_, const Date& d, const std::string& b) : id(id_), date(d), buyer(b) {}

std::string Bill::generateId() {
    ++counter;
    char buf[16];
    std::snprintf(buf, sizeof buf, "B%03d", counter);
    return buf;
}

int Bill::numberFromId(const std::string& id) {
    if (id.size() < 2) return 0;
    try { return std::stoi(id.substr(1)); } catch (...) { return 0; }
}

double Bill::total() const {
    double t = 0;
    for (const auto& i : items) t += i.total();
    return t;
}

std::string Bill::toJson() const {
    std::string j = "{" + util::jstr("id", id) + "," + util::jstr("date", date.toString()) + "," +
                    util::jstr("buyer", buyer) + "," + util::jnum("total", total()) + ",\"items\":[";
    for (size_t i = 0; i < items.size(); i++) {
        const BillItem& it = items[i];
        if (i) j += ",";
        j += "{" + util::jstr("medicine", it.getMedicine()) + "," + util::jstr("batch", it.getBatchNo()) + "," +
             util::jint("quantity", it.getQuantity()) + "," + util::jnum("price", it.getPrice()) + "," +
             util::jnum("total", it.total()) + "}";
    }
    return j + "]}";
}

std::ostream& operator<<(std::ostream& os, const Bill& b) {
    const std::string line(44, '-');
    os << "MEDICAL INVENTORY MANAGEMENT\n" << line << "\n"
       << "Bill No: " << b.id << "\n"
       << "Date: " << b.date.toDisplay() << "\n\n"
       << "Buyer: " << b.buyer << "\n\n"
       << std::left << std::setw(18) << "Medicine" << std::setw(8) << "Batch" << std::setw(6) << "Qty" << "Amount\n"
       << line << "\n";
    for (const auto& i : b.items)
        os << std::left << std::setw(18) << i.getMedicine() << std::setw(8) << i.getBatchNo()
           << std::setw(6) << i.getQuantity() << "Rs." << util::money(i.total()) << "\n";
    os << line << "\nTOTAL: Rs." << util::money(b.total()) << "\n" << line << "\n\n        Thank You\n";
    return os;
}
